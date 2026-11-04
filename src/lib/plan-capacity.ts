export const ENTERPRISE_ADDITIONAL_BRANCHES = 5;
// Preserve existing student/teacher entitlements; staff roles have no configured seat cap.
export const PLAN_CAPACITY: Record<string, { students: number; teachers: number; additionalBranches: number }> = {
  FREE_TRIAL: { students: 1500, teachers: 75, additionalBranches: 0 },
  STARTER: { students: 300, teachers: 15, additionalBranches: 0 },
  PROFESSIONAL: { students: 1500, teachers: 75, additionalBranches: 0 },
  ENTERPRISE: { students: 999999, teachers: 999999, additionalBranches: ENTERPRISE_ADDITIONAL_BRANCHES },
};
export function capacityMetric(used: number, limit: number | null) {
  return { used, limit, remaining: limit === null ? null : Math.max(0, limit-used), overLimit: limit !== null && used > limit };
}
