export const FEATURES = ["CORE_ADMIN", "NOTICES", "BASIC_REPORTS", "FINANCE", "EXAMINATIONS", "ADVANCED_REPORTS", "STAFF_ROLES", "MULTI_BRANCH", "BRANCH_MANAGEMENT", "ORGANIZATION_REPORTS", "SCHOOL_ADMIN_MANAGEMENT"] as const;
export type PlanFeature = typeof FEATURES[number];
const starter: PlanFeature[] = ["CORE_ADMIN", "NOTICES", "BASIC_REPORTS"];
const professional: PlanFeature[] = [...starter, "FINANCE", "EXAMINATIONS", "ADVANCED_REPORTS", "STAFF_ROLES"];
export const PLAN_FEATURES: Record<string, readonly PlanFeature[]> = { STARTER: starter, PROFESSIONAL: professional, FREE_TRIAL: professional, ENTERPRISE: [...professional, "MULTI_BRANCH", "BRANCH_MANAGEMENT", "ORGANIZATION_REPORTS", "SCHOOL_ADMIN_MANAGEMENT"] };
export function hasFeature(plan: string | undefined, feature: PlanFeature) { return !!plan && !!PLAN_FEATURES[plan]?.includes(feature); }
export function routeFeature(path: string): PlanFeature | undefined {
  if (/\/(?:payroll|salary)(?:\/|$)/.test(path)) return "FINANCE";
  if (/\/attendance\/reports(?:\/|$)/.test(path)) return "BASIC_REPORTS";
  if (/\/reports\/basic(?:\/|$)/.test(path)) return "BASIC_REPORTS";
  if (/\/organization(?:\/|$)/.test(path)) return "MULTI_BRANCH";
  if (/\/(?:roles|staff|receptionist)(?:\/|$)/.test(path)) return "STAFF_ROLES";
  if (/\/(?:reports(?:\/summary)?|finance\/reports|exam-staff\/reports)(?:\/|$)/.test(path)) return "ADVANCED_REPORTS";
  if (/\/(?:finance|fees)(?:\/|$)/.test(path)) return "FINANCE";
  if (/\/(?:exams|exam-staff|examinations|marks|results|certificates)(?:\/|$)/.test(path)) return "EXAMINATIONS";
}
export function permissionFeature(permission: string): PlanFeature | undefined {
  if (permission.startsWith("payroll.")) return "FINANCE";
  if (permission.startsWith("fees.")) return "FINANCE";
  if (/^(exams|results)\./.test(permission)) return "EXAMINATIONS";
  if (permission.startsWith("organization.")) return "MULTI_BRANCH";
}

const coreLabels = ["Student Records & Enrollment", "Teacher Directory", "Classes & Sections", "Subjects", "Attendance Registers", "Timetable", "School Branding", "Basic Enrollment & Attendance Reports", "Notice Board", "Linked Parent Accounts"];
const professionalLabels = [...coreLabels, "Fee Structures & Challans", "Payment Receipts", "Expense Tracking", "Examination Schedules", "Marks & Published Results", "Report Cards & Certificates", "Advanced Reports", "Finance, Examination & Reception Roles"];
export const PLAN_FEATURE_LABELS: Record<string, readonly string[]> = {STARTER: coreLabels, PROFESSIONAL: professionalLabels, FREE_TRIAL: professionalLabels, ENTERPRISE: [...professionalLabels, "Organization Dashboard", "Multiple Branches", "Branch Management & Switching", "Branch School Admin Accounts", "Consolidated & Branch Reports"]};
