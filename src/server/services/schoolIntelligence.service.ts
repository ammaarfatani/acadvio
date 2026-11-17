import { z } from "zod";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import {
  reportCatalogue,
  reportDefinitions,
  reportPipeline,
  periodBounds,
  Filters,
} from "./smartReports.service";
import { branchContext } from "../utils/branchScope";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { buildSupplementalFindings, improvementAnalysisState } from "./schoolIntelligence.rules";

export const intelligenceSettings = z
  .object({
    lowAttendance: z.number().min(1).max(100).default(80),
    lowFeeRecovery: z.number().min(1).max(100).default(80),
    highOutstandingPercent: z.number().min(1).max(100).default(20),
    highFailureRate: z.number().min(1).max(100).default(20),
    expenseIncrease: z.number().min(1).max(500).default(20),
    enrollmentDecline: z.number().min(1).max(100).default(20),
    staleAdmissionDays: z.number().int().min(1).max(90).default(7),
  })
  .strict();
export async function intelligenceDashboard(
  actor: AuthenticatedUser,
  filters: Filters,
  settings: z.infer<typeof intelligenceSettings>,
) {
  const today = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
  if (filters.from > today)
    throw {
      statusCode: 400,
      message:
        "Intelligence cannot evaluate a future period. Choose a start date on or before today.",
    };
  filters = { ...filters, to: filters.to > today ? today : filters.to };
  const catalogue = reportCatalogue(actor),
    { start, end: requestedEnd } = periodBounds(filters),
    end = new Date(Math.min(requestedEnd.getTime(), Date.now())),
    duration = end.getTime() - start.getTime();
  // Equal elapsed day ranges. Calendar-year comparisons are deliberately not assumed equivalent.
  const previousEnd = new Date(start.getTime()),
    previousStart = new Date(start.getTime() - duration);
  const pakistanDate = (d: Date) =>
    new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10);
  const previous = {
    ...filters,
    from: pakistanDate(previousStart),
    to: pakistanDate(new Date(previousEnd.getTime() - 1)),
  };
  const available = (key: string) => catalogue.some((c) => c.key === key);
  const aggregate = async (key: string, f: Filters, stages: any[]) => {
    const pipeline = reportPipeline(actor, key, f),
      spec = reportDefinitions[key];
    if (!spec.stringDate && pipeline[0].$match[spec.date])
      pipeline[0].$match[spec.date] = {
        $gte: f === previous ? previousStart : start,
        $lt: f === previous ? previousEnd : end,
      };
    return spec.model
      .aggregate([...pipeline, ...stages])
      .option({ maxTimeMS: 10000 });
  };
  const total = async (key: string, f: Filters, field?: string) => {
    if (!available(key)) return null;
    const rows = await aggregate(key, f, [
      { $group: { _id: null, value: { $sum: field ? "$" + field : 1 } } },
    ]);
    return rows[0]?.value || 0;
  };
  const metrics: any[] = [], supplementalEvidence: any = {};
  if (available("students")) {
    const scope = { schoolId: actor.schoolId },
      [active, unassigned] = await Promise.all([
        Student.countDocuments({ ...scope, status: "ACTIVE" }).maxTimeMS(10000),
        Student.countDocuments({
          ...scope,
          status: "ACTIVE",
          sectionId: null,
        }).maxTimeMS(10000),
      ]);
    metrics.push({
      key: "active-students",
      label: "Active students now (all cohorts)",
      current: active,
      baseline: null,
      percent: null,
      unit: "",
    });
    // Enrollment snapshots are intentionally separate from admissions in the selected period.
    metrics.push({
      key: "unassigned-sections",
      label: "Active students without a section",
      current: unassigned,
      baseline: null,
      percent: null,
      unit: "",
    });
  }
  if (available("staff"))
    metrics.push({
      key: "active-teachers",
      label: "Active teachers now",
      current: await User.countDocuments({
        schoolId: actor.schoolId,
        userType: "TEACHER",
        status: "ACTIVE",
      }).maxTimeMS(10000),
      baseline: null,
      percent: null,
      unit: "",
    });
  for (const [key, label, field, unit] of [
    ["students", "New admissions", "", ""],
    ["collections", "Collected payments", "amountPKR", "PKR"],
    ["expenses", "Recorded expenses", "amountPKR", "PKR"],
    ["payroll", "Paid payroll (separate ledger)", "paidAmountPKR", "PKR"],
  ]) {
    if (!available(key)) continue;
    const [current, baseline] = await Promise.all([
      total(key, filters, field || undefined),
      total(key, previous, field || undefined),
    ]);
    metrics.push({
      key,
      label,
      current,
      baseline,
      change: current - baseline,
      percent: baseline > 0 ? ((current - baseline) / baseline) * 100 : null,
      unit,
    });
  }
  const charts: any[] = [],
    quality: string[] = [],
    insights: any[] = [];
  const groupChart = async (
    key: string,
    title: string,
    field: string,
    unit = "",
    value: any = 1,
  ) => {
    if (!available(key)) return;
    const rows = await aggregate(key, filters, [
      { $group: { _id: "$" + field, value: { $sum: value } } },
      { $sort: { value: -1, _id: 1 } },
      { $limit: 30 },
    ]);
    charts.push({
      title,
      kind: "bar",
      unit,
      data: rows.map((r: any) => ({
        label: String(r._id || "Unspecified"),
        value: r.value,
      })),
      description: reportDefinitions[key].note,
      report: key,
    });
  };
  await groupChart("students", "Admitted students by class", "className");
  await groupChart("admissions", "Application status", "status");
  await groupChart(
    "attendance",
    "Recorded student attendance",
    "records.status",
  );
  await groupChart("staffAttendance", "Real staff attendance", "status");
  await groupChart(
    "collections",
    "Received payments by method",
    "paymentMethod",
    "PKR",
    "$amountPKR",
  );
  await groupChart(
    "expenses",
    "Expenses by category",
    "category",
    "PKR",
    "$amountPKR",
  );
  await groupChart("results", "Published result status", "status");
  if (available("attendance")) {
    const rows = await aggregate("attendance", filters, [
      { $group: { _id: "$className", total: { $sum: 1 }, attended: { $sum: { $cond: [{ $in: ["$records.status", ["PRESENT", "LATE"]] }, 1, 0] } } } },
      { $sort: { _id: 1 } }, { $limit: 100 },
    ]);
    supplementalEvidence.classAttendance = rows.map((row: any) => ({ className: String(row._id || "Unspecified class"), total: row.total, attended: row.attended }));
    charts.push({ title: "Recorded attendance by class", kind: "bar", unit: "%", data: rows.filter((row: any) => row.total > 0).map((row: any) => ({ label: String(row._id || "Unspecified class"), value: Math.round(row.attended / row.total * 1000) / 10, entries: row.total, attended: row.attended })), description: "Present and late entries count as attended. Only recorded entries are included; missing registers are not treated as absences.", report: "attendance" });
  }
  if (available("staffAttendance")) {
    const rows = await aggregate("staffAttendance", filters, [
      { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } },
    ]);
    const total = rows.reduce((sum: number, row: any) => sum + row.count, 0), attended = rows.filter((row: any) => ["PRESENT", "LATE"].includes(row._id)).reduce((sum: number, row: any) => sum + row.count, 0);
    supplementalEvidence.staffAttendance = { total, attended };
    metrics.push({ key: "staff-attendance", label: "Recorded staff attendance", current: total ? Math.round(attended / total * 1000) / 10 : null, baseline: null, percent: null, unit: "%" });
  }
  if (available("results")) {
    const rows = await aggregate("results", filters, [
      { $unwind: "$subjectScores" },
      {
        $match: {
          "subjectScores.maxMarks": { $gt: 0 },
          "subjectScores.obtainedMarks": { $type: "number" },
        },
      },
      {
        $group: {
          _id: "$subjectScores.subjectName",
          value: {
            $avg: {
              $multiply: [
                100,
                {
                  $divide: [
                    "$subjectScores.obtainedMarks",
                    "$subjectScores.maxMarks",
                  ],
                },
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]);
    charts.push({
      title: "Published subject averages",
      kind: "bar",
      unit: "%",
      data: rows.map((r: any) => ({ label: String(r._id), value: r.value })),
      description:
        "Numeric scores from processed published results. This is a cross-sectional average, not a progress comparison.",
      report: "results",
    });
  }
  if (available("invoices")) {
    const rows = await aggregate("invoices", filters, [
      { $group: { _id: null, count: { $sum: 1 }, billed: { $sum: "$totalAmountPKR" }, paid: { $sum: "$paidAmountPKR" }, outstanding: { $sum: "$remainingAmountPKR" } } },
    ]);
    const invoices = rows[0] || { count: 0, billed: 0, paid: 0, outstanding: 0 };
    supplementalEvidence.invoiceCohort = invoices;
    metrics.push({ key: "fee-recovery", label: "Current recovery on invoices created in period", current: invoices.billed > 0 ? Math.round(invoices.paid / invoices.billed * 1000) / 10 : null, baseline: null, percent: null, unit: "%" });
  }
  if (available("results")) {
    const rows = await aggregate("results", filters, [
      { $group: { _id: { exam: "$examTitle", class: "$className" }, count: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } }, average: { $avg: "$percentage" } } },
      { $sort: { "_id.exam": 1, "_id.class": 1 } }, { $limit: 100 },
    ]);
    const count = rows.reduce((sum: number, row: any) => sum + row.count, 0), failed = rows.reduce((sum: number, row: any) => sum + row.failed, 0), weightedAverage = count ? rows.reduce((sum: number, row: any) => sum + row.average * row.count, 0) / count : null;
    supplementalEvidence.publishedResults = { count, failed, average: weightedAverage };
    charts.push({ title: "Published result averages by exam and class", kind: "bar", unit: "%", data: rows.map((row: any) => ({ label: `${row._id.exam} · ${row._id.class}`, value: Math.round(row.average * 10) / 10, count: row.count, failed: row.failed })), description: "Published, processed numeric results only. Different examinations are not treated as a trend.", report: "results" });
  }
  if (available("subjectResults")) {
    const rows = await aggregate("subjectResults", filters, [
      { $match: { "subjectScores.grade": { $type: "string", $nin: ["", "PENDING", "WITHHELD", "EXEMPT"] } } },
      { $group: { _id: "$subjectScores.subjectName", total: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: [{ $toUpper: "$subjectScores.grade" }, "F"] }, 1, 0] } } } },
      { $sort: { failed: -1, _id: 1 } }, { $limit: 100 },
    ]);
    supplementalEvidence.subjectResults = rows.map((row: any) => ({ subjectName: String(row._id || "Unspecified subject"), total: row.total, failed: row.failed }));
    charts.push({ title: "Published subject failure rates", kind: "bar", unit: "%", data: rows.filter((row: any) => row.total > 0).map((row: any) => ({ label: row._id || "Unspecified subject", value: Math.round(row.failed / row.total * 1000) / 10, entries: row.total, failed: row.failed })), description: "Failure counts use the school's configured F grade from published subject scores; pending, withheld and exempt entries are excluded.", report: "subjectResults" });
  }
  if (available("attendance")) {
    const rows = await aggregate("attendance", filters, [
      { $match: { "records.status": "ABSENT" } },
      {
        $group: {
          _id: "$records.studentId",
          name: { $first: "$records.studentName" },
          value: { $sum: 1 },
        },
      },
      { $match: { value: { $gte: 3 } } },
      { $sort: { value: -1 } },
      { $limit: 20 },
    ]);
    charts.push({
      title: "Recurring recorded absences",
      kind: "bar",
      data: rows.map((r: any) => ({
        label: r.name || "Student",
        value: r.value,
      })),
      description:
        "Students with at least three recorded absences in the selected period (review default). Missing registers are excluded.",
      report: "attendance",
    });
  }
  if (available("collections")) {
    const rows = await aggregate("collections", filters, [
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$paidAt",
              format: "%Y-%m-%d",
              timezone: "Asia/Karachi",
            },
          },
          value: { $sum: "$amountPKR" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    charts.push({
      title: "Daily received payments",
      kind: "line",
      unit: "PKR",
      data: rows.map((r: any) => ({ label: r._id, value: r.value })),
      description:
        "Actual payment ledger by local date; dates with no recorded payments are omitted.",
      report: "collections",
    });
  }
  const studentChart = charts.find((c) => c.report === "attendance");
  if (studentChart) {
    const entries = studentChart.data.reduce(
        (s: number, r: any) => s + r.value,
        0,
      ),
      attended = studentChart.data
        .filter((r: any) => ["PRESENT", "LATE"].includes(r.label))
        .reduce((s: number, r: any) => s + r.value, 0);
    const rate = entries ? (attended / entries) * 100 : null;
    metrics.push({
      key: "attendance",
      label: "Recorded student attendance",
      current: rate,
      baseline: null,
      change: null,
      percent: null,
      unit: "%",
    });
    quality.push(
      "Student attendance rate covers marked entries only. Missing registers and unmarked days are not counted as absences. A full expected-register coverage calculation is not available.",
    );
    if (rate !== null && rate < settings.lowAttendance)
      insights.push({
        rule: "low-attendance",
        title: "Review recorded student attendance",
        priority: "HIGH",
        kind: "ATTENTION",
        evidence: `${rate.toFixed(1)}% attendance across ${entries} recorded entries; review threshold ${settings.lowAttendance}%.`,
        action:
          "Review class registers and contact guardians through the existing school process.",
        expectedOutcome:
          "Better understanding of attendance barriers; improvement is not guaranteed.",
        measurement:
          "Compare recorded attendance and register completeness after two weeks.",
      });
    else if (rate !== null)
      insights.push({
        rule: "attendance-positive",
        title: "Recorded attendance meets your review threshold",
        priority: "LOW",
        kind: "POSITIVE",
        evidence: `${rate.toFixed(1)}% of marked entries attended.`,
        action: "Continue register checks and review unmarked days.",
        expectedOutcome: "Maintain reliable attendance monitoring.",
        measurement: "Review attendance and register completeness weekly.",
      });
  }
  if (available("invoices")) {
    const invoices = supplementalEvidence.invoiceCohort || { count: 0, outstanding: 0 };
    metrics.push({
      key: "outstanding",
      label: "Outstanding on invoices created in period (current balance)",
      current: invoices.outstanding,
      baseline: null,
      percent: null,
      unit: "PKR",
    });
    quality.push(
      "Invoice balances are current. A historical overdue-growth comparison cannot be reconstructed from current balances.",
    );
  }
  if (available("admissions")) {
    const rows = await aggregate("admissions", filters, [
      {
        $match: {
          status: { $in: ["NEW", "CONTACTED", "FOLLOW_UP", "APPLIED"] },
          inquiryDate: {
            $lt: new Date(Date.now() - settings.staleAdmissionDays * 86400000),
          },
        },
      },
      { $count: "value" },
    ]);
    if (rows[0]?.value)
      insights.push({
        rule: "stale-admissions",
        title: "Follow up on admission applications",
        priority: "MEDIUM",
        kind: "ATTENTION",
        evidence: `${rows[0].value} selected applications are older than ${settings.staleAdmissionDays} days and remain open.`,
        action: "Review pending applications and record follow-up outcomes.",
        expectedOutcome: "Reduce unresolved inquiries.",
        measurement: "Review the open application count next week.",
      });
    supplementalEvidence.admissions = { current: metrics.find((m) => m.key === "students")?.current || 0, baseline: metrics.find((m) => m.key === "students")?.baseline || 0 };
  }
  const expense = metrics.find((m) => m.key === "expenses");
  supplementalEvidence.expenses = expense && { current: expense.current, baseline: expense.baseline };
  supplementalEvidence.admissions ||= { current: metrics.find((m) => m.key === "students")?.current || 0, baseline: metrics.find((m) => m.key === "students")?.baseline || 0 };
  insights.push(...buildSupplementalFindings(supplementalEvidence, settings, filters));
  const collected = metrics.find((m) => m.key === "collections");
  if (collected && expense)
    metrics.push({
      key: "net",
      label: "Net recorded fee / expense balance",
      current: collected.current - expense.current,
      baseline: null,
      percent: null,
      unit: "PKR",
    });
  quality.push(
    "An ongoing period stops at the calculation time. Its preceding comparison uses exactly the same elapsed duration; future days and later times today are excluded from dated KPI comparisons.",
    "Financial summaries are recorded ledger activity, not a bank reconciliation or audited profit. Paid payroll is a separate register and is not subtracted again.",
    "Academic trend comparisons require explicitly comparable exams; no decline is inferred across different exams.",
    "Transport operations, inventory, historical capacity and missing-document requirements are unavailable to this center.",
  );
  const attendanceEntries = (supplementalEvidence.classAttendance || []).reduce((sum: number, row: any) => sum + row.total, 0);
  const staffEntries = Number(supplementalEvidence.staffAttendance?.total || 0);
  const resultEntries = Number(supplementalEvidence.publishedResults?.count || 0);
  const subjectEntries = (supplementalEvidence.subjectResults || []).reduce((sum: number, row: any) => sum + Number(row.total || 0), 0);
  const invoiceCount = Number(supplementalEvidence.invoiceCohort?.count || 0);
  const admissionsCount = Number(supplementalEvidence.admissions?.current || 0) + Number(supplementalEvidence.admissions?.baseline || 0);
  const dataStatus = {
    studentAttendance: !available("attendance") ? "UNAVAILABLE" : attendanceEntries ? "AVAILABLE" : "NO_DATA",
    staffAttendance: !available("staffAttendance") ? "UNAVAILABLE" : staffEntries ? "AVAILABLE" : "NO_DATA",
    fees: !available("invoices") ? "UNAVAILABLE" : invoiceCount ? "AVAILABLE" : "NO_DATA",
    examinationResults: !available("results") ? "UNAVAILABLE" : resultEntries ? "AVAILABLE" : "NO_DATA",
    subjectResults: !available("subjectResults") ? "UNAVAILABLE" : subjectEntries ? "AVAILABLE" : "NO_DATA",
    admissions: !available("students") ? "UNAVAILABLE" : admissionsCount ? "AVAILABLE" : "NO_DATA",
  };
  const baseState = improvementAnalysisState(dataStatus);
  const analysisState = baseState === "DATA_AVAILABLE"
    ? insights.some((finding) => finding.kind === "ATTENTION") ? "FINDINGS_DETECTED" : "NO_THRESHOLDS_EXCEEDED"
    : baseState;
  return {
    metrics,
    charts,
    quality,
    insights: insights.map((i) => {
      const report = i.report || (i.rule?.includes("attendance") ? "attendance" : i.rule?.includes("fee") || i.rule?.includes("outstanding") ? "invoices" : i.rule?.includes("exam") || i.rule?.includes("subject") ? "results" : i.rule?.includes("admission") ? "admissions" : i.rule?.includes("expense") ? "expenses" : "reports");
      return {
      ...i,
      period: i.period || { from: filters.from, to: filters.to },
      report,
      affected: i.affected || `School-wide · ${report}`,
      branchScope: branchContext.getStore()?.branchId ? `Selected branch ${branchContext.getStore()?.branchId}` : "Current authorized branch scope",
      reviewDate: new Date(Date.now() + 14 * 86400000 + 5 * 3600000)
        .toISOString()
        .slice(0, 10),
    };}),
    filters,
    previous: {
      from: previous.from,
      to: previous.to,
      fromInstant: previousStart,
      toExclusive: previousEnd,
    },
    evaluated: { fromInstant: start, toExclusive: end },
    settings,
    dataStatus,
    analysisState,
    generatedAt: new Date(),
    timezone: "Asia/Karachi",
  };
}
export function deterministicIntelligenceSummary(
  _actor: AuthenticatedUser,
  dashboard: Awaited<ReturnType<typeof intelligenceDashboard>>,
) {
  const attention = dashboard.insights.filter((finding: any) => finding.kind === "ATTENTION");
  const metrics = dashboard.metrics.filter((metric: any) => typeof metric.current === "number" && Number.isFinite(metric.current));
  const dataAvailable = Object.values(dashboard.dataStatus).some((state: any) => state === "AVAILABLE");
  const summary = dashboard.analysisState === "NO_DATA_AVAILABLE"
    ? "No intelligence domains are available for this account. Check report permissions and subscription access."
    : dashboard.analysisState === "INSUFFICIENT_DATA"
      ? "The authorized domains have no recorded entries in this reporting period. Choose a period with data or review register and ledger coverage."
      : attention.length
        ? `${attention.length} evidence-based area${attention.length === 1 ? "" : "s"} need review for ${dashboard.filters.from} to ${dashboard.filters.to}. Findings below use CRM aggregates and configured thresholds.`
        : `No configured risk threshold was exceeded in the assessed data for ${dashboard.filters.from} to ${dashboard.filters.to}. Continue routine register, ledger and published-result reviews. ${metrics.length} available metrics were assessed.`;
  const recommendations = attention.slice(0, 5).map((finding: any) => ({
    priority: finding.priority, evidence: finding.evidence,
    hypothesis: "This is a recorded observation; it does not establish a cause.",
    action: finding.action, measurement: finding.measurement,
    report: finding.report, period: finding.period || dashboard.filters,
  }));
  if (!recommendations.length && dataAvailable) recommendations.push({
    priority: "LOW", evidence: `No configured risk threshold was exceeded in the assessed CRM data for ${dashboard.filters.from} to ${dashboard.filters.to}.`,
    hypothesis: "Available evidence supports routine monitoring; unmeasured domains are not assessed.",
    action: "Continue scheduled attendance, fee ledger and published-results reviews; complete any registers marked as missing.",
    measurement: "Refresh this analysis for the next comparable reporting period.",
    report: "reports", period: dashboard.filters,
  });
  return { mode: "deterministic_rules", provider: null, summary, recommendations, analysisState: dashboard.analysisState, dataStatus: dashboard.dataStatus, quality: dashboard.quality, generatedAt: new Date(), advisory: true };
}
