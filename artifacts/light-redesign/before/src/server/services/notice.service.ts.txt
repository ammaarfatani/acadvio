import {Student} from "../models/student.model";
import {ClassModel,SectionModel} from "../models/classSection.model";
import { Announcement } from "../models/announcement.model";
import { NoticeRead } from "../models/noticeRead.model";
import { Branch } from "../models/branch.model";
import { Role } from "../models/role.model";
import { School } from "../models/school.model";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { branchContext, withoutBranchScope } from "../utils/branchScope";
export async function listNotices(actor: AuthenticatedUser, managing = false, schoolId?: string, studentId?: string) {
  const tenant = actor.isSuperAdmin ? schoolId : actor.schoolId;
  if (!tenant) throw { statusCode: 400, message: "Select a school." };
  if (managing && !actor.isSuperAdmin && !actor.permissions?.includes("notices.manage")) throw { statusCode: 403, message: "Notice management permission required." };
  const work = async () => {
    const audience=actor.userType==="PARENT"&&studentId?await (await import("./parentAudience.service")).parentAudience(tenant,actor.userId,studentId):{};
    const notices = await Announcement.find({ $and:[{schoolId:tenant},audience] }).sort({ publishAt: -1, createdAt: -1 }).limit(100).lean();
    const reads = await NoticeRead.find({ schoolId: tenant, userId: actor.userId, noticeId: { $in: notices.map((n: any) => n._id) } }).select("noticeId").lean();
    const readIds = new Set(reads.map((r: any) => String(r.noticeId)));
    return notices.map((n: any) => ({ ...n, isRead: readIds.has(String(n._id)) }));
  };
  const scope = branchContext.getStore();
  return scope && managing ? branchContext.run({ ...scope, noticeManagement: true }, work) : work();
}
export async function saveNotice(actor: AuthenticatedUser, input: any, id?: string) {
  if (!actor.isSuperAdmin && !actor.permissions?.includes("notices.manage")) throw { statusCode: 403, message: "Notice management permission required." };
  const schoolId = actor.isSuperAdmin ? input.schoolId : actor.schoolId;
  const school = await School.findById(schoolId); if (!school) throw { statusCode: 404, message: "School not found." };
  const current = branchContext.getStore();
  const branchId = actor.isSuperAdmin || current?.owner ? input.branchId ?? null : current?.branchId;
  if (!actor.isSuperAdmin && !current?.owner && input.branchId !== undefined && String(input.branchId) !== String(branchId)) throw { statusCode: 403, message: "You can publish only to your branch." };
  if (branchId && !await Branch.exists({ _id: branchId, organizationId: schoolId })) {
    if (String(branchId) !== String(schoolId)) throw { statusCode: 403, message: "Branch does not belong to this organization." };
  }
  if(actor.isSuperAdmin)for(const [field,model] of [["targetStudentIds",Student],["targetClassIds",ClassModel],["targetSectionIds",SectionModel]] as const){const ids=[...new Set(input[field]||[])];if(ids.length&&await model.countDocuments({schoolId,_id:{$in:ids},...(branchId?{$or:[{branchId},...(String(branchId)===String(schoolId)?[{branchId:{$exists:false}}]:[])]}:{})})!==ids.length)throw{statusCode:403,message:"Audience records must belong to the chosen school and branch."};}
  const roles = await Role.find({ $or: [{ schoolId: null }, { schoolId }] }).distinct("userType");
  if (input.targetRoles.some((r: string) => r !== "ADMISSION" && !roles.includes(r))) throw { statusCode: 400, message: "Unknown target audience." };
  const data = { targetStudentIds:input.targetStudentIds||[],targetClassIds:input.targetClassIds||[],targetSectionIds:input.targetSectionIds||[],title: input.title, content: input.content, category: input.category, targetRoles: input.targetRoles, priority: input.priority, status: input.status, publishAt: input.publishAt || new Date(), expiresAt: input.expiresAt || null, isPublished: input.status === "PUBLISHED", schoolId, organizationId: schoolId, branchId, postedByName: actor.email };
  const work = async () => {
    if (!id) return Announcement.create({ ...data, createdBy: actor.userId });
    // Branch administrators cannot modify organization-wide announcements.
    const filter: any = { _id: id, schoolId }; if (!actor.isSuperAdmin && !current?.owner) filter.branchId = branchId;
    const notice = await Announcement.findOne(filter); if (!notice) throw { statusCode: 404, message: "Notice not found or not editable by this account." };
    if (String(notice.branchId || "") !== String(branchId || "")) throw { statusCode: 400, message: "Notice scope cannot be reassigned. Create a separate notice." };
    Object.assign(notice, data); await notice.save(); return notice;
  };
  return current ? branchContext.run({ ...current, branchId, noticeManagement: true }, work) : work();
}
export async function readNotice(actor: AuthenticatedUser, id: string) {
  if (!actor.schoolId || !await Announcement.exists({ _id: id, schoolId: actor.schoolId })) throw { statusCode: 404, message: "Notice not found." };
  await NoticeRead.findOneAndUpdate({ noticeId: id, userId: actor.userId, schoolId: actor.schoolId }, { $setOnInsert: { readAt: new Date() } }, { upsert: true });
  return { isRead: true };
}
