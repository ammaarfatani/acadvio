import { createHash } from "crypto";
import { z } from "zod";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import {
  reportCatalogue,
  reportDefinitions,
  reportPipeline,
  periodBounds,
  Filters,
} from "./smartReports.service";
import { assistantConfigured, configuredCompletion } from "./assistant.service";
import { branchContext } from "../utils/branchScope";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";

export const intelligenceSettings = z
  .object({
    lowAttendance: z.number().min(1).max(100).default(80),
    expenseIncrease: z.number().min(1).max(500).default(20),
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
  const metrics: any[] = [];
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
    const rows = await aggregate("invoices", filters, [
      { $group: { _id: null, value: { $sum: "$remainingAmountPKR" } } },
    ]);
    metrics.push({
      key: "outstanding",
      label: "Current balance on selected invoices",
      current: rows[0]?.value || 0,
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
  }
  const expense = metrics.find((m) => m.key === "expenses");
  if (expense?.percent >= settings.expenseIncrease)
    insights.push({
      rule: "expense-increase",
      title: "Review the increase in recorded expenses",
      priority: "MEDIUM",
      kind: "ATTENTION",
      evidence: `Recorded expenses rose ${expense.percent.toFixed(1)}% over the equal-length preceding period.`,
      action:
        "Compare expense categories and check for one-off payments. The cause has not been established.",
      expectedOutcome: "Understand the recorded cost change.",
      measurement:
        "Review category totals and budget notes before the next period.",
    });
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
  return {
    metrics,
    charts,
    quality,
    insights: insights.map((i) => ({
      ...i,
      reviewDate: new Date(Date.now() + 14 * 86400000 + 5 * 3600000)
        .toISOString()
        .slice(0, 10),
    })),
    filters,
    previous: {
      from: previous.from,
      to: previous.to,
      fromInstant: previousStart,
      toExclusive: previousEnd,
    },
    evaluated: { fromInstant: start, toExclusive: end },
    settings,
    generatedAt: new Date(),
    timezone: "Asia/Karachi",
    aiAvailable: assistantConfigured(),
  };
}
const responseSchema = z
  .object({
    summary: z.string().max(1200),
    recommendations: z
      .array(
        z
          .object({
            priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
            evidence: z.string().max(600),
            hypothesis: z.string().max(600),
            action: z.string().max(600),
            measurement: z.string().max(600),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
const cache = new Map<string, { expires: number; data: any }>();
export async function interpretIntelligence(
  actor: AuthenticatedUser,
  dashboard: Awaited<ReturnType<typeof intelligenceDashboard>>,
) {
  // Provider receives computed aggregates and fixed rule descriptions only, never row-level records or actor details.
  const payload = {
    metrics: dashboard.metrics,
    quality: dashboard.quality,
    insights: dashboard.insights,
  };
  const key = createHash("sha256")
    .update(
      JSON.stringify({
        school: actor.schoolId,
        branch: branchContext.getStore()?.branchId,
        filters: dashboard.filters,
        payload,
      }),
    )
    .digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now())
    return { ...cached.data, cached: true };
  const result = await configuredCompletion(
    [
      {
        role: "system",
        content:
          'Interpret only the supplied school aggregate evidence. Do not invent numbers, people, facts, causality or promises. Distinguish hypotheses from evidence. Return JSON only: {"summary":string,"recommendations":[{"priority":"HIGH"|"MEDIUM"|"LOW","evidence":string,"hypothesis":string,"action":string,"measurement":string}]}. You are advisory and cannot change records.',
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
    { response_format: { type: "json_object" } },
  );
  let parsed: any;
  try {
    parsed = responseSchema.parse(JSON.parse(result.content));
  } catch {
    throw {
      statusCode: 502,
      message:
        "AI returned an invalid interpretation. Deterministic school insights remain available.",
    };
  }
  const numbers = (value: string) =>
    (value.match(/\b\d+(?:\.\d+)?\b/g) || []).map(Number);
  const allowedNumbers = new Set(numbers(JSON.stringify(payload)));
  if (numbers(JSON.stringify(parsed)).some((n) => !allowedNumbers.has(n)))
    throw {
      statusCode: 502,
      message:
        "AI supplied unsupported numeric evidence. Use the calculated school insights instead.",
    };
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  const data = { ...parsed, generatedAt: new Date(), advisory: true };
  cache.set(key, { expires: Date.now() + 5 * 60000, data });
  return data;
}
