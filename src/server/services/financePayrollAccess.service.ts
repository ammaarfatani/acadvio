import mongoose from "mongoose";
import { Role } from "../models/role.model";
import { User } from "../models/user.model";
import { AuditLog } from "../models/auditLog.model";
import { School } from "../models/school.model";
import { ROLE_PERMISSION_MAP } from "../constants/permissions.constant";
import { withoutBranchScope } from "../utils/branchScope";
import { transaction } from "./workforce.service";
import { hasFeature } from "../../lib/plan-features";

function requireSchoolAdmin(actor: any, changing = false) {
  if (actor.userType !== "SCHOOL_ADMIN" || !actor.schoolId || !actor.permissions?.includes("payroll.manage")) {
    throw { statusCode: 403, message: "Only a School Admin with payroll management access can configure Finance payroll payments." };
  }
  if (changing && hasFeature(actor.plan, "MULTI_BRANCH") && actor.isOrganizationOwner !== true) {
    throw { statusCode: 403, message: "Only the organization owner can change Finance payment access across branches." };
  }
}

export async function getFinancePayrollAccess(actor: any) {
  requireSchoolAdmin(actor);
  const [role, financeUsers] = await Promise.all([
    Role.findOne({ schoolId: actor.schoolId, code: "ROLE_FINANCE", userType: "FINANCE" }).lean(),
    withoutBranchScope(() => User.countDocuments({ schoolId: actor.schoolId, userType: "FINANCE" })),
  ]);
  return {
    enabled: !!(role as any)?.permissions?.includes("payroll.pay"),
    financeAccounts: financeUsers,
  };
}

export async function setFinancePayrollAccess(actor: any, enabled: boolean) {
  requireSchoolAdmin(actor, true);
  const schoolId = new mongoose.Types.ObjectId(actor.schoolId);
  return transaction(async (session: any) => {
    const [schoolResult, existingRole, baseRole, financeAccounts] = await Promise.all([
      School.findById(schoolId).select("name").session(session).lean(),
      Role.findOne({ schoolId, code: "ROLE_FINANCE", userType: "FINANCE" }).session(session),
      Role.findOne({ schoolId: null, code: "ROLE_FINANCE", userType: "FINANCE" }).session(session),
      withoutBranchScope(() => User.countDocuments({ schoolId, userType: "FINANCE" }).session(session)),
    ]);
    const school: any = Array.isArray(schoolResult) ? schoolResult[0] : schoolResult;
    if (!school) throw { statusCode: 404, message: "School not found." };

    const inheritedPermissions: string[] = Array.isArray(existingRole?.permissions)
      ? existingRole.permissions
      : Array.isArray(baseRole?.permissions)
        ? baseRole.permissions
        : ROLE_PERMISSION_MAP.FINANCE;
    const permissions = [...new Set<string>(inheritedPermissions)].filter(permission => permission !== "payroll.pay");
    if (enabled) permissions.push("payroll.pay");

    let financeRole = existingRole;
    if (!financeRole) {
      [financeRole] = await Role.create([{
        schoolId,
        name: "Finance",
        code: "ROLE_FINANCE",
        userType: "FINANCE",
        description: "School-specific Finance role and payroll payment permissions.",
        permissions,
        isSystemRole: false,
      }], { session });
    } else {
      financeRole.permissions = permissions;
      await financeRole.save({ session });
    }

    // Scope the role to this school. Never mutate the shared platform Finance role.
    const reassigned = await withoutBranchScope(() => User.updateMany(
      { schoolId, userType: "FINANCE" },
      { $set: { roleId: financeRole!._id } },
      { session },
    ));
    const admin = await User.findById(actor.userId).select("name email").session(session).lean() as any;
    await AuditLog.create([{
      schoolId,
      actorUserId: actor.userId,
      actorName: admin?.name || actor.email,
      actorEmail: actor.email,
      actorRole: "SCHOOL_ADMIN",
      action: enabled ? "FINANCE_PAYROLL_ACCESS_ENABLED" : "FINANCE_PAYROLL_ACCESS_DISABLED",
      resource: "Role",
      entityId: String(financeRole!._id),
      schoolName: school.name,
      details: `${enabled ? "Enabled" : "Disabled"} payroll payment access for Finance accounts (${financeAccounts}). Reassigned ${reassigned.modifiedCount} account(s) to the school-specific Finance role.`,
      previousValue: { enabled: !!existingRole?.permissions?.includes("payroll.pay") },
      newValue: { enabled, financeAccounts, reassignedAccounts: reassigned.modifiedCount },
    }], { session });

    return { enabled, financeAccounts, reassignedAccounts: reassigned.modifiedCount };
  });
}
