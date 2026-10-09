import mongoose from "mongoose";
import { Branch } from "../models/branch.model";
import { User } from "../models/user.model";
import { hasFeature } from "../../lib/plan-features";
import { withoutBranchScope, BranchScope } from "../utils/branchScope";
export async function mainBranch(school: any) {
  return Branch.findOneAndUpdate({ _id: school._id, organizationId: school._id }, { $setOnInsert: { isMain: true, name: school.name, code: "main", address: school.address, phone: school.phone, email: school.email, status: "ACTIVE" } }, { upsert: true, new: true, runValidators: true });
}
export async function resolveBranchContext(user: any, school: any, selection?: string): Promise<BranchScope> {
  return withoutBranchScope(async () => {
    const mainId = String(school._id);
    const enterprise = hasFeature(school.plan, "MULTI_BRANCH");
    let owner = enterprise && user.isOrganizationOwner === true;
    if (enterprise && user.userType === "SCHOOL_ADMIN" && user.isOrganizationOwner == null) {
      const primary = await User.findOne({ schoolId: school._id, userType: "SCHOOL_ADMIN", isOrganizationOwner: { $ne: false } }).sort({ createdAt: 1, _id: 1 });
      if (primary && String(primary._id) === String(user._id)) { await User.updateOne({ _id: user._id }, { $set: { isOrganizationOwner: true, organizationId: school._id, branchId: user.branchId || school._id } }); owner = true; }
    }
    owner = owner && !!user.roleId?.permissions?.includes("organization.manage");
    const assigned = String(user.branchId || mainId), selected = selection || (owner ? "all" : assigned);
    if (!owner && selection && selected !== assigned) throw { statusCode: 403, message: "You cannot switch to another branch." };
    if (!enterprise && assigned !== mainId) throw { statusCode: 403, message: "This branch requires an Enterprise subscription." };
    if (selected === "all") {
      if (!owner) throw { statusCode: 403, message: "Organization-wide access requires an Enterprise owner." };
      return { organizationId: mainId, branchId: null, mainBranchId: mainId, owner };
    }
    if (!mongoose.isValidObjectId(selected)) throw { statusCode: 400, message: "Invalid branch selection." };
    if (enterprise || selected !== mainId) {
      await mainBranch(school);
      const branch = await Branch.findOne({ _id: selected, organizationId: school._id });
      if (!branch || branch.status !== "ACTIVE") throw { statusCode: 403, message: "The selected branch is unavailable or inactive." };
    }
    return { organizationId: mainId, branchId: selected, mainBranchId: mainId, owner };
  });
}
