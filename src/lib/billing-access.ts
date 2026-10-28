// Shared UI/API policy: organization billing stays with the main school administrator.
export function canManageSchoolBilling(
  user:
    | {
        userType?: string;
        isOrganizationOwner?: boolean;
        plan?: string;
        billingPlan?: string;
        schoolId?: unknown;
        organizationId?: string;
        branchId?: string | null;
        school?: { _id?: string; plan?: string } | null;
      }
    | null
    | undefined,
): boolean {
  if (user?.userType !== "SCHOOL_ADMIN") return false;
  const plan = user.school?.plan || user.billingPlan || user.plan;
  const mainId =
    user.school?._id ||
    user.organizationId ||
    (user.schoolId ? String(user.schoolId) : undefined);
  if (user.branchId && mainId && String(user.branchId) !== String(mainId))
    return false;
  return plan !== "ENTERPRISE" || user.isOrganizationOwner === true;
}
