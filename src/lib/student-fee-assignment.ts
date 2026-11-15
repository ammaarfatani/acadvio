import { normalizeBillingDate } from "./billing-date";
/** Resolve the assignment at the billing date. Never guess a class default. */
export function studentFeeAssignment(student: any, month: string, billingDate?: unknown) {
  const calendarDate = normalizeBillingDate(billingDate, month);
  const cutoff = new Date(`${calendarDate}T23:59:59.999+05:00`).getTime();
  const history = [...(student.feeStructureHistory || [])].sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
  const effective = history.filter(e => new Date(e.effectiveDate).getTime() <= cutoff).at(-1);
  if (effective) return { feeStructureId: effective.newFeeStructureId, concessionType: effective.newConcessionType, concessionValue: effective.newConcessionValue, concessionReason: effective.concessionReason };
  if (history.length) return { feeStructureId: history[0].previousFeeStructureId, concessionType: history[0].previousConcessionType, concessionValue: history[0].previousConcessionValue };
  return student;
}
export function feeStructureEligible(structure: any, student: any) {
  const scope = structure?.classScope || "SPECIFIC";
  return !!structure && (scope === "ALL" || String(structure.classId) === String(student.classId)) &&
    (!structure.sectionId || String(structure.sectionId) === String(student.sectionId)) &&
    (!structure.academicSession || structure.academicSession === student.academicSessionName);
}
