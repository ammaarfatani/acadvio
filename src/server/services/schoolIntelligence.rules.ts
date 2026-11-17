export type IntelligenceRange = { from: string; to: string };
export type ImprovementSettings = {
  lowAttendance: number;
  lowFeeRecovery: number;
  highOutstandingPercent: number;
  highFailureRate: number;
  expenseIncrease: number;
  enrollmentDecline: number;
};
export type ClassAttendanceEvidence = { className: string; total: number; attended: number };
export type SubjectFailureEvidence = { subjectName: string; total: number; failed: number };

export function buildSupplementalFindings(
  evidence: {
    classAttendance?: ClassAttendanceEvidence[];
    staffAttendance?: { total: number; attended: number };
    invoiceCohort?: { count: number; billed: number; paid: number; outstanding: number };
    publishedResults?: { count: number; failed: number; average: number | null };
    subjectResults?: SubjectFailureEvidence[];
    admissions?: { current: number; baseline: number };
    expenses?: { current: number; baseline: number };
  },
  settings: ImprovementSettings,
  range: IntelligenceRange,
) {
  const findings: any[] = [];
  const add = (rule: string, title: string, priority: string, proof: string, action: string, measurement: string, report: string, affected?: string) => findings.push({
    rule, title, priority, kind: "ATTENTION", evidence: proof, period: range,
    ...(affected ? { affected } : {}), report,
    action, expectedOutcome: "Support a focused review; improvement is not guaranteed.", measurement,
  });
  const percent = (n: number, d: number) => d > 0 ? n / d * 100 : null;

  for (const row of evidence.classAttendance || []) {
    const rate = percent(row.attended, row.total);
    if (rate !== null && row.total > 0 && rate < settings.lowAttendance)
      add("class-attendance-" + row.className.toLowerCase().replace(/[^a-z0-9]+/g, "-"), `Review attendance in ${row.className}`, "HIGH",
        `${rate.toFixed(1)}% attended (${row.attended} of ${row.total} recorded entries); review threshold ${settings.lowAttendance}%.`,
        "Review this class register, verify missing entries and follow up using the school attendance workflow.",
        "Recalculate recorded attendance and register completeness after two weeks.", "attendance", row.className);
  }

  if (evidence.staffAttendance && evidence.staffAttendance.total > 0) {
    const { total, attended } = evidence.staffAttendance, rate = percent(attended, total)!;
    if (rate < settings.lowAttendance)
      add("staff-attendance", "Review recorded staff attendance", "MEDIUM",
        `${rate.toFixed(1)}% attended (${attended} of ${total} recorded staff entries); review threshold ${settings.lowAttendance}%.`,
        "Review staff attendance exceptions and confirm any leave or register corrections in the workforce module.",
        "Compare recorded attendance and exceptions after two weeks.", "staffAttendance");
  }

  const invoices = evidence.invoiceCohort;
  if (invoices && invoices.count > 0 && invoices.billed > 0) {
    const recovery = percent(invoices.paid, invoices.billed)!, outstandingShare = percent(invoices.outstanding, invoices.billed)!;
    if (recovery < settings.lowFeeRecovery)
      add("low-fee-recovery", "Review recovery on invoices created in this period", "HIGH",
        `${recovery.toFixed(1)}% currently paid (PKR ${invoices.paid.toLocaleString()} of PKR ${invoices.billed.toLocaleString()} billed across ${invoices.count} non-voided invoices); selected invoice cohort ${range.from} to ${range.to}.`,
        "Review unpaid challans in this invoice cohort and follow up with guardians through the existing finance workflow.",
        "Compare the paid and outstanding amounts on this invoice cohort at the next review.", "invoices");
    if (invoices.outstanding > 0 && outstandingShare >= settings.highOutstandingPercent)
      add("high-outstanding-balances", "Review outstanding balances on selected invoices", "HIGH",
        `PKR ${invoices.outstanding.toLocaleString()} remains on ${invoices.count} non-voided invoices; ${outstandingShare.toFixed(1)}% of PKR ${invoices.billed.toLocaleString()} billed.`,
        "Open the Fee Defaulters Report, review current balances and prioritize follow-up according to school policy.",
        "Recheck current outstanding balances after follow-up.", "invoices");
  }

  const results = evidence.publishedResults;
  if (results && results.count > 0) {
    const rate = percent(results.failed, results.count)!;
    if (rate >= settings.highFailureRate)
      add("exam-failure-rate", "Review published examination outcomes", "HIGH",
        `${results.failed} of ${results.count} published results are marked FAILED (${rate.toFixed(1)}%); published-result average ${results.average === null ? "unavailable" : results.average.toFixed(1) + "%"}.`,
        "Review affected class and exam results with the academic team, then use existing subject and student support processes.",
        "Compare only with a later comparable exam after publication.", "results");
  }
  for (const subject of evidence.subjectResults || []) {
    const rate = percent(subject.failed, subject.total);
    if (rate !== null && subject.total > 0 && rate >= settings.highFailureRate)
      add("subject-failure-" + subject.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), `Review outcomes in ${subject.subjectName}`, "HIGH",
        `${subject.failed} of ${subject.total} published subject scores have the school's configured F grade (${rate.toFixed(1)}%).`,
        "Review the published marks and lesson coverage for this subject with the academic team.",
        "Reassess after the next comparable published exam.", "subjectResults", subject.subjectName);
  }

  const admissions = evidence.admissions;
  if (admissions && admissions.baseline > 0) {
    const change = (admissions.current - admissions.baseline) / admissions.baseline * 100;
    if (change <= -settings.enrollmentDecline)
      add("admissions-decline", "Review the change in new admissions", "MEDIUM",
        `Recorded admissions were ${admissions.current} in ${range.from} to ${range.to}, compared with ${admissions.baseline} in the equal-length preceding period (${Math.abs(change).toFixed(1)}% lower).`,
        "Review the admission pipeline and outreach activity; this comparison alone does not establish a cause.",
        "Compare admissions over another equal-length period.", "students");
  }
  const expenses = evidence.expenses;
  if (expenses && expenses.baseline > 0) {
    const change = (expenses.current - expenses.baseline) / expenses.baseline * 100;
    if (change >= settings.expenseIncrease)
      add("expense-increase", "Review the increase in recorded expenses", "MEDIUM",
        `Recorded expenses rose ${change.toFixed(1)}% from PKR ${expenses.baseline.toLocaleString()} to PKR ${expenses.current.toLocaleString()} over equal-length periods.`,
        "Compare expense categories and check for one-off payments. The cause has not been established.",
        "Review category totals and budget notes before the next period.", "expenses");
  }
  return findings;
}

export function improvementAnalysisState(states: Record<string, string>) {
  const visible = Object.values(states).filter((state) => state !== "UNAVAILABLE");
  if (!visible.length) return "NO_DATA_AVAILABLE";
  if (visible.some((state) => state === "AVAILABLE")) return "DATA_AVAILABLE";
  return "INSUFFICIENT_DATA";
}
