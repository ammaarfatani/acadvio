import mongoose from "mongoose";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { School } from "../models/school.model";
import { User } from "../models/user.model";
import { StaffDepartment, StaffEmployment } from "../models/workforce.model";
import { StaffCertificate } from "../models/staffCertificate.model";
import { AuditLog } from "../models/auditLog.model";
import { withoutBranchScope } from "../utils/branchScope";
import { validateStudentPhoto } from "./studentPhoto.service";

export const staffCertificateCategories = [
  { id: "EMPLOYMENT", label: "Employment certificate", group: "Employment & service" },
  { id: "EMPLOYMENT_VERIFICATION", label: "Employment verification", group: "Employment & service" },
  { id: "EXPERIENCE", label: "Experience certificate", group: "Employment & service" },
  { id: "TEACHING_EXPERIENCE", label: "Teaching experience", group: "Employment & service" },
  { id: "SERVICE", label: "Service certificate", group: "Employment & service" },
  { id: "EMPLOYMENT_COMPLETION", label: "Employment completion", group: "Employment & service" },
  { id: "RELIEVING", label: "Relieving certificate", group: "Employment & service" },
  { id: "RETIREMENT", label: "Retirement certificate", group: "Employment & service" },
  { id: "RESIGNATION_ACCEPTANCE", label: "Resignation / service completion", group: "Employment & service" },
  { id: "TEACHER_OF_MONTH", label: "Teacher of the month", group: "Recognition & achievement" },
  { id: "STAFF_OF_MONTH", label: "Staff member of the month", group: "Recognition & achievement" },
  { id: "BEST_TEACHER", label: "Best teacher award", group: "Recognition & achievement" },
  { id: "OUTSTANDING_PERFORMANCE", label: "Outstanding performance", group: "Recognition & achievement" },
  { id: "EXCELLENCE_IN_TEACHING", label: "Excellence in teaching", group: "Recognition & achievement" },
  { id: "APPRECIATION", label: "Employee appreciation", group: "Recognition & achievement" },
  { id: "LONG_SERVICE", label: "Long service award", group: "Recognition & achievement" },
  { id: "ACHIEVEMENT", label: "Achievement certificate", group: "Recognition & achievement" },
  { id: "PROFESSIONAL_DEVELOPMENT", label: "Professional development", group: "Other" },
  { id: "TRAINING_COMPLETION", label: "Training completion", group: "Other" },
  { id: "WORKSHOP_PARTICIPATION", label: "Workshop participation", group: "Other" },
  { id: "CONTRIBUTION", label: "Contribution certificate", group: "Other" },
  { id: "CUSTOM", label: "Custom certificate", group: "Other" },
] as const;

const categoryIds = staffCertificateCategories.map((x) => x.id) as [string, ...string[]];
const allowedFields = ["reason", "employmentPeriod", "awardPeriod", "eventName", "customText"] as const;
const placeholders = ["staff.name", "staff.employeeId", "staff.designation", "staff.department", "staff.joiningDate", "staff.employmentStatus", "school.name", "school.address", "issueDate", "certificate.number", "details.reason", "details.employmentPeriod", "details.awardPeriod", "details.eventName", "details.customText"] as const;
const literalRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templateBody = z.string().trim().min(12).max(4000).refine((value) => {
  const tokens = [...value.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
  return tokens.every((token) => placeholders.includes(token as any));
}, "Use only the listed staff, school, issue-date, certificate and details placeholders.");
const templateInput = z.object({
  basedOnId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  name: z.string().trim().min(2).max(100),
  certificateType: z.enum(categoryIds),
  title: z.string().trim().min(3).max(180),
  body: templateBody,
  requiredFields: z.array(z.enum(allowedFields)).max(5).default([]),
  style: z.object({ family: z.enum(["modern", "classic", "institutional"]).default("classic"), color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#b20913"), font: z.enum(["sans", "serif"]).default("serif"), orientation: z.enum(["portrait", "landscape"]).default("landscape"), border: z.enum(["single", "double", "minimal"]).default("double") }).strict().default({ family: "classic", color: "#b20913", font: "serif", orientation: "landscape", border: "double" }),
  background: z.string().max(2_900_000).optional().or(z.literal("")),
}).strict();

function requireAdmin(actor: any) {
  if (actor?.userType !== "SCHOOL_ADMIN" || !actor.schoolId) throw { statusCode: 403, message: "Only a School Admin can manage staff certificates." };
}
function requireDocumentOwner(actor: any) {
  if (!actor.isOrganizationOwner && String(actor.branchId) !== String(actor.schoolId)) throw { statusCode: 403, message: "Only the organization owner or main school administrator can manage school-wide certificate templates." };
}
function templateList(school: any) { return Array.isArray(school?.documentSettings?.staffCertificateTemplates) ? school.documentSettings.staffCertificateTemplates : []; }
function publicTemplate(t: any) { const { background, ...rest } = t; return { ...rest, hasBackground: !!background }; }

export async function listStaffCertificateTemplates(actor: any) {
  requireAdmin(actor);
  const school: any = await School.findById(actor.schoolId).select("documentSettings documentSettingsRevision").lean();
  if (!school) throw { statusCode: 404, message: "School not found." };
  return { revision: school.documentSettingsRevision || 0, templates: templateList(school).map(publicTemplate), types: staffCertificateCategories };
}

async function saveTemplateArray(actor: any, revision: number, templates: any[], event: string, details: string) {
  requireAdmin(actor); requireDocumentOwner(actor);
  const session = await mongoose.startSession();
  try {
    let nextRevision = revision + 1;
    await session.withTransaction(async () => {
      const saved = await School.findOneAndUpdate({ _id: actor.schoolId, $or: [{ documentSettingsRevision: revision }, ...(revision === 0 ? [{ documentSettingsRevision: { $exists: false } }] : [])] }, { $set: { "documentSettings.staffCertificateTemplates": templates }, $inc: { documentSettingsRevision: 1 } }, { new: true, session });
      if (!saved) throw { statusCode: 409, message: "Document settings changed. Reload before saving." };
      nextRevision = saved.documentSettingsRevision || nextRevision;
      await withoutBranchScope(() => AuditLog.create([{ schoolId: actor.schoolId, organizationId: actor.schoolId, branchId: actor.schoolId, actorUserId: actor.userId, actorName: actor.name || actor.email, actorEmail: actor.email, actorRole: actor.userType, action: event, resource: "StaffCertificateTemplate", details }], { session }));
    });
    return { revision: nextRevision, templates: templates.map(publicTemplate) };
  } finally { await session.endSession(); }
}

export async function createStaffCertificateTemplate(actor: any, revision: number, raw: any) {
  requireAdmin(actor); requireDocumentOwner(actor);
  const input = templateInput.parse(raw);
  const background = input.background ? "data:image/webp;base64," + (await validateStudentPhoto(input.background))!.toString("base64") : "";
  const school: any = await School.findById(actor.schoolId).select("documentSettings").lean();
  const templates = templateList(school);
  if (templates.length >= 40) throw { statusCode: 400, message: "Archive an old template before creating another. The school library supports up to 40 staff templates." };
  const basedOn = input.basedOnId ? templates.find((x: any) => x.id === input.basedOnId && x.status === "APPROVED") : null;
  if (input.basedOnId && !basedOn) throw { statusCode: 409, message: "The approved template version you are copying is no longer available. Reload the template list." };
  const now = new Date();
  const entry = { ...input, background, id: new mongoose.Types.ObjectId().toString(), version: basedOn ? Number(basedOn.version || 1) + 1 : 1, status: "DRAFT", createdBy: actor.userId, createdByName: actor.name || actor.email, createdAt: now, updatedAt: now };
  const result = await saveTemplateArray(actor, revision, [...templates, entry], "STAFF_CERTIFICATE_TEMPLATE_CREATED", `Created staff certificate template ${entry.name}.`);
  return { ...result, template: publicTemplate(entry) };
}

export async function updateStaffCertificateTemplate(actor: any, id: string, revision: number, raw: any) {
  requireAdmin(actor); requireDocumentOwner(actor);
  const input = templateInput.parse(raw);
  const school: any = await School.findById(actor.schoolId).select("documentSettings").lean();
  const templates = templateList(school), index = templates.findIndex((x: any) => x.id === id);
  if (index < 0) throw { statusCode: 404, message: "Staff certificate template not found." };
  const current = templates[index];
  if (!["DRAFT", "REJECTED"].includes(current.status)) throw { statusCode: 409, message: "Only draft or returned templates can be edited. Clone an approved template to create a new version." };
  const background = input.background === undefined ? current.background || "" : input.background ? "data:image/webp;base64," + (await validateStudentPhoto(input.background))!.toString("base64") : "";
  const next = [...templates]; next[index] = { ...current, ...input, background, status: "DRAFT", updatedAt: new Date() };
  const result = await saveTemplateArray(actor, revision, next, "STAFF_CERTIFICATE_TEMPLATE_UPDATED", `Updated staff certificate template ${input.name}.`);
  return { ...result, template: publicTemplate(next[index]) };
}

export async function transitionStaffCertificateTemplate(actor: any, id: string, revision: number, action: "submit" | "approve" | "reject" | "archive", reason?: string) {
  requireAdmin(actor); requireDocumentOwner(actor);
  if (action === "reject" && (!reason || reason.trim().length < 3)) throw { statusCode: 400, message: "Provide a rejection reason of at least 3 characters." };
  const school: any = await School.findById(actor.schoolId).select("documentSettings").lean();
  const templates = templateList(school), index = templates.findIndex((x: any) => x.id === id);
  if (index < 0) throw { statusCode: 404, message: "Staff certificate template not found." };
  const current = templates[index], next = [...templates];
  const transitions: Record<string, string[]> = { submit: ["DRAFT", "REJECTED"], approve: ["PENDING_APPROVAL"], reject: ["PENDING_APPROVAL"], archive: ["APPROVED", "DRAFT", "REJECTED"] };
  if (!transitions[action].includes(current.status)) throw { statusCode: 409, message: `Template cannot be ${action}d from ${current.status}.` };
  const status = ({ submit: "PENDING_APPROVAL", approve: "APPROVED", reject: "REJECTED", archive: "ARCHIVED" } as const)[action];
  next[index] = { ...current, status, updatedAt: new Date(), ...(action === "approve" ? { approvedAt: new Date(), approvedBy: actor.userId, approvedByName: actor.name || actor.email } : {}), ...(action === "reject" ? { rejectionReason: reason!.trim(), rejectedAt: new Date(), rejectedBy: actor.userId } : {}), ...(action === "submit" ? { submittedAt: new Date() } : {}), ...(action === "archive" ? { archivedAt: new Date() } : {}) };
  const event = `STAFF_CERTIFICATE_TEMPLATE_${action.toUpperCase()}`;
  return saveTemplateArray(actor, revision, next, event, `${action[0].toUpperCase()}${action.slice(1)}d staff certificate template ${current.name}${reason ? `: ${reason.trim()}` : "."}`);
}

export async function staffCertificateOverview(actor: any) {
  requireAdmin(actor);
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const school: any = await School.findById(actor.schoolId).select("documentSettings").lean();
  const [issued, thisMonth, staffCount, recent] = await Promise.all([
    StaffCertificate.countDocuments({ schoolId: actor.schoolId }),
    StaffCertificate.countDocuments({ schoolId: actor.schoolId, issueDate: { $gte: start } }),
    User.countDocuments({ schoolId: actor.schoolId, userType: { $nin: ["PARENT", "SUPER_ADMIN"] }, status: "ACTIVE" }),
    StaffCertificate.find({ schoolId: actor.schoolId }).select("certificateNumber certificateTitle staffName certificateType issueDate status").sort({ issueDate: -1, _id: -1 }).limit(6).lean(),
  ]);
  return { totalIssued: issued, issuedThisMonth: thisMonth, approvedTemplates: templateList(school).filter((x: any) => x.status === "APPROVED").length, staffMembers: staffCount, recent };
}

export async function searchStaffCertificatesStaff(actor: any, raw: any) {
  requireAdmin(actor);
  const q = z.object({ search: z.string().trim().max(100).default(""), employeeId: z.string().trim().max(40).default(""), department: z.string().trim().max(100).default(""), designation: z.string().trim().max(100).default(""), staffType: z.enum(["", "TEACHING", "NON_TEACHING"]).default(""), employmentStatus: z.enum(["", "ACTIVE", "ENDED"]).default(""), page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(raw);
  const clauses: any[] = [{ schoolId: actor.schoolId, userType: { $nin: ["PARENT", "SUPER_ADMIN"] }, status: "ACTIVE" }];
  if (q.search) {
    const pattern = literalRegex(q.search);
    const employmentMatches = await StaffEmployment.find({ schoolId: actor.schoolId, employeeId: { $regex: pattern, $options: "i" } }).select("userId").lean();
    clauses.push({ $or: [{ name: { $regex: pattern, $options: "i" } }, { email: { $regex: pattern, $options: "i" } }, { employeeId: { $regex: pattern, $options: "i" } }, ...(employmentMatches.length ? [{ _id: { $in: employmentMatches.map((row: any) => row.userId) } }] : [])] });
  }
  if (q.employeeId) {
    const pattern = literalRegex(q.employeeId);
    const employmentMatches = await StaffEmployment.find({ schoolId: actor.schoolId, employeeId: { $regex: pattern, $options: "i" } }).select("userId").lean();
    clauses.push({ $or: [{ employeeId: { $regex: pattern, $options: "i" } }, ...(employmentMatches.length ? [{ _id: { $in: employmentMatches.map((row: any) => row.userId) } }] : [])] });
  }
  if (q.staffType) clauses.push({ userType: q.staffType === "TEACHING" ? "TEACHER" : { $nin: ["PARENT", "SUPER_ADMIN", "TEACHER"] } });
  if (q.department || q.designation || q.employmentStatus) {
    const employmentFilter: any = { schoolId: actor.schoolId };
    if (q.department) employmentFilter.department = q.department;
    if (q.designation) employmentFilter.designation = q.designation;
    if (q.employmentStatus) employmentFilter.status = q.employmentStatus;
    const matches = await StaffEmployment.find(employmentFilter).select("userId").lean();
    clauses.push({ _id: { $in: matches.map((row: any) => row.userId) } });
  }
  const filter: any = { $and: clauses };
  const pageSize = 25;
  const [users, total]: [any[], number] = await Promise.all([
    User.find(filter).select("name email userType employeeId status branchId").sort({ name: 1, _id: 1 }).skip((q.page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
  ]);
  const userIds = users.map((u) => u._id);
  const employments: any[] = await StaffEmployment.find({ schoolId: actor.schoolId, userId: { $in: userIds } }).select("userId employeeId department designation joiningDate leavingDate status").lean();
  const byUser = new Map(employments.map((e) => [String(e.userId), e]));
  const rows = users.map((u) => ({ ...u, employment: byUser.get(String(u._id)) || null }));
  return { staff: rows, total, page: q.page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function staffCertificateChoices(actor: any) {
  requireAdmin(actor);
  const [departments, employmentDepartments, designations, result] = await Promise.all([
    StaffDepartment.find({ schoolId: actor.schoolId }).select("name").sort({ name: 1 }).lean(),
    StaffEmployment.aggregate([{ $match: { schoolId: new mongoose.Types.ObjectId(String(actor.schoolId)), department: { $type: "string", $ne: "" } } }, { $group: { _id: "$department" } }, { $sort: { _id: 1 } }, { $limit: 250 }]),
    StaffEmployment.aggregate([{ $match: { schoolId: new mongoose.Types.ObjectId(String(actor.schoolId)), designation: { $type: "string", $ne: "" } } }, { $group: { _id: "$designation" } }, { $sort: { _id: 1 } }, { $limit: 250 }]),
    listStaffCertificateTemplates(actor),
  ]);
  const departmentNames = [...new Set([...departments.map((x: any) => x.name), ...employmentDepartments.map((x: any) => x._id)].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return { ...result, departments: departmentNames, designations: designations.map((x: any) => x._id), types: staffCertificateCategories };
}

function interpolate(body: string, data: Record<string, string>) {
  return body.replace(/\{\{([^}]+)\}\}/g, (_all, key) => data[key] ?? "");
}
const issueInput = z.object({ staffId: z.string().regex(/^[a-f0-9]{24}$/i), templateId: z.string().regex(/^[a-f0-9]{24}$/i), issueDate: z.string().date(), issuanceKey: z.string().uuid(), details: z.object({ reason: z.string().trim().max(1000).optional(), employmentPeriod: z.string().trim().max(120).optional(), awardPeriod: z.string().trim().max(80).optional(), eventName: z.string().trim().max(180).optional(), customText: z.string().trim().max(1000).optional() }).strict().default({}) }).strict();

export async function issueStaffCertificate(actor: any, raw: any, options: { source?: any; previousCertificateId?: string; reissueReason?: string } = {}) {
  requireAdmin(actor);
  const input = issueInput.parse(raw);
  const existing: any = await StaffCertificate.findOne({ schoolId: actor.schoolId, issuanceKey: input.issuanceKey }).lean();
  if (existing) {
    if (String(existing.staffId) !== input.staffId || String(existing.templateId) !== input.templateId || new Date(existing.issueDate).toISOString().slice(0, 10) !== input.issueDate || JSON.stringify(existing.snapshot?.details || {}) !== JSON.stringify(input.details || {})) {
      throw { statusCode: 409, message: "This issue request ID was already used for different certificate details. Start a new issue request." };
    }
    return existing;
  }
  const school: any = await School.findById(actor.schoolId).select("name address phone email logoUrl documentSettings").lean();
  if (!school) throw { statusCode: 404, message: "School not found." };
  const template: any = templateList(school).find((x: any) => x.id === input.templateId);
  if (!template || template.status !== "APPROVED") throw { statusCode: 409, message: "Select a Staff Certificate template approved by the School Admin." };
  const [staff, employment]: any[] = await Promise.all([
    User.findOne({ _id: input.staffId, schoolId: actor.schoolId, userType: { $nin: ["PARENT", "SUPER_ADMIN"] }, status: "ACTIVE" }).select("name userType employeeId").lean(),
    StaffEmployment.findOne({ schoolId: actor.schoolId, userId: input.staffId }).select("employeeId department designation joiningDate leavingDate status").lean(),
  ]);
  if (!staff) throw { statusCode: 404, message: "Active staff record not found for this school." };
  const employeeId = employment?.employeeId || staff.employeeId;
  if (!employeeId) throw { statusCode: 409, message: "This staff member has no recorded employee ID. Complete the staff record before issuing a certificate." };
  const missing = (template.requiredFields || []).filter((field: string) => !input.details[field as keyof typeof input.details]?.trim());
  if (missing.length) throw { statusCode: 400, message: `Complete the required certificate details: ${missing.join(", ")}.` };
  if (template.certificateType === "RETIREMENT" && !(employment?.status === "ENDED" || employment?.leavingDate) && !input.details.employmentPeriod) throw { statusCode: 400, message: "A recorded end date or an explicitly provided retirement period is required for a retirement certificate." };
  const issueDate = new Date(input.issueDate + "T12:00:00.000Z");
  const verificationId = randomBytes(32).toString("hex");
  const certificateNumber = `STAFF-${issueDate.getUTCFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`;
  const category = staffCertificateCategories.find((x) => x.id === template.certificateType);
  const schoolBranding = { name: school.name, address: school.address, phone: school.phone, email: school.email, logoUrl: school.logoUrl, ...(school.documentSettings?.branding || {}) };
  const verificationUrl = `${(process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "")}/verify/staff-certificate/${verificationId}`;
  const verificationQr = await require("qrcode").toDataURL(verificationUrl);
  const staffSnapshot = { name: staff.name, employeeId, staffType: staff.userType, designation: employment?.designation || "", department: employment?.department || "", joiningDate: employment?.joiningDate || "", employmentStatus: employment?.status || staff.status };
  const details = input.details;
  const vars: Record<string, string> = { "staff.name": staffSnapshot.name, "staff.employeeId": staffSnapshot.employeeId, "staff.designation": staffSnapshot.designation, "staff.department": staffSnapshot.department, "staff.joiningDate": staffSnapshot.joiningDate, "staff.employmentStatus": staffSnapshot.employmentStatus, "school.name": schoolBranding.name || "", "school.address": schoolBranding.address || "", issueDate: issueDate.toISOString().slice(0, 10), "certificate.number": certificateNumber, ...Object.fromEntries(allowedFields.map((f) => [`details.${f}`, (details as any)[f] || ""])) };
  const snapshot = { type: "staff-certificate", certificateType: template.certificateType, category: category?.group || "Other", certificateTitle: template.title, body: interpolate(template.body, vars), details, staff: staffSnapshot, school: schoolBranding, style: template.style, background: template.background || "", templateId: template.id, templateName: template.name, templateVersion: template.version, issuedAt: issueDate, certificateNumber, verificationId, verificationUrl, verificationQr };
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await StaffCertificate.create([{ schoolId: actor.schoolId, branchId: actor.branchId, staffId: staff._id, employeeId, staffName: staff.name, staffType: staff.userType, designation: staffSnapshot.designation, department: staffSnapshot.department, joiningDate: staffSnapshot.joiningDate, employmentStatus: staffSnapshot.employmentStatus, certificateType: template.certificateType, certificateTitle: template.title, certificateNumber, verificationId, issueDate, status: "ISSUED", templateId: template.id, templateVersion: template.version, snapshot, issuedBy: actor.userId, issuedByName: actor.name || actor.email, issuanceKey: input.issuanceKey, ...(options.previousCertificateId ? { previousCertificateId: options.previousCertificateId, reissueReason: options.reissueReason } : {}), history: [{ action: options.previousCertificateId ? "REISSUED" : "ISSUED", at: new Date(), by: actor.email, ...(options.reissueReason ? { reason: options.reissueReason } : {}), ...(options.previousCertificateId ? { relatedCertificateId: options.previousCertificateId } : {}) }] }], { session });
      result = result[0];
      if (options.previousCertificateId) {
        const prior = await StaffCertificate.updateOne({ _id: options.previousCertificateId, schoolId: actor.schoolId, status: "ISSUED" }, { $push: { history: { action: "REPLACEMENT_ISSUED", at: new Date(), by: actor.email, reason: options.reissueReason, relatedCertificateId: result._id } }, $set: { status: "REPLACED", replacedAt: new Date(), replacedBy: actor.email, replacementReason: options.reissueReason } }, { session });
        if (!prior.modifiedCount) throw { statusCode: 409, message: "Only an active issued certificate can be reissued." };
      }
      await AuditLog.create([{ schoolId: actor.schoolId, organizationId: actor.schoolId, branchId: actor.branchId, actorUserId: actor.userId, actorName: actor.name || actor.email, actorEmail: actor.email, actorRole: actor.userType, action: options.previousCertificateId ? "STAFF_CERTIFICATE_REISSUED" : "STAFF_CERTIFICATE_ISSUED", resource: "StaffCertificate", entityId: result._id, details: `${certificateNumber} · ${staff.name} · ${template.title}` }], { session });
    });
    return result.toObject();
  } catch (error: any) { if (error.code === 11000) throw { statusCode: 409, message: "A certificate with this number or request already exists. Reload the list before retrying." }; throw error; }
  finally { await session.endSession(); }
}

export async function listStaffCertificates(actor: any, raw: any) {
  requireAdmin(actor);
  const q = z.object({ search: z.string().trim().max(100).default(""), employeeSearch: z.string().trim().max(100).default(""), certificateNumber: z.string().trim().max(80).default(""), certificateType: z.enum(categoryIds).optional(), status: z.enum(["ISSUED", "REVOKED", "REPLACED"]).optional(), department: z.string().trim().max(100).optional(), designation: z.string().trim().max(100).optional(), staffType: z.enum(["TEACHING", "NON_TEACHING"]).optional(), from: z.string().date().optional(), to: z.string().date().optional(), page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(raw);
  if (q.from && q.to && q.from > q.to) throw { statusCode: 400, message: "The end date must be on or after the start date." };
  const filter: any = { schoolId: actor.schoolId };
  if (q.certificateType) filter.certificateType = q.certificateType;
  if (q.status) filter.status = q.status;
  if (q.department) filter.department = q.department;
  if (q.designation) filter.designation = q.designation;
  if (q.staffType) filter.staffType = q.staffType === "TEACHING" ? "TEACHER" : { $nin: ["TEACHER"] };
  if (q.from || q.to) filter.issueDate = { ...(q.from ? { $gte: new Date(q.from + "T00:00:00Z") } : {}), ...(q.to ? { $lte: new Date(q.to + "T23:59:59.999Z") } : {}) };
  const searchGroups: any[] = [];
  if (q.search) searchGroups.push({ $or: ["certificateNumber", "staffName", "employeeId", "certificateTitle", "department", "designation"].map((field) => ({ [field]: { $regex: literalRegex(q.search), $options: "i" } })) });
  if (q.employeeSearch) searchGroups.push({ $or: ["staffName", "employeeId"].map((field) => ({ [field]: { $regex: literalRegex(q.employeeSearch), $options: "i" } })) });
  if (q.certificateNumber) filter.certificateNumber = { $regex: literalRegex(q.certificateNumber), $options: "i" };
  if (searchGroups.length) filter.$and = searchGroups;
  const pageSize = 25, [records, total] = await Promise.all([StaffCertificate.find(filter).select("certificateNumber staffName employeeId staffType designation department certificateType certificateTitle issueDate status issuedByName previousCertificateId").sort({ issueDate: -1, _id: -1 }).skip((q.page - 1) * pageSize).limit(pageSize).lean(), StaffCertificate.countDocuments(filter)]);
  return { records, total, page: q.page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function staffCertificateDetail(actor: any, id: string) {
  requireAdmin(actor);
  const row = await StaffCertificate.findOne({ _id: id, schoolId: actor.schoolId }).lean();
  if (!row) throw { statusCode: 404, message: "Staff certificate not found." };
  return row;
}

export async function revokeStaffCertificate(actor: any, id: string, reason: string) {
  requireAdmin(actor);
  const tx = await mongoose.startSession();
  try { let row: any; await tx.withTransaction(async () => { row = await StaffCertificate.findOneAndUpdate({ _id: id, schoolId: actor.schoolId, status: "ISSUED" }, { $set: { status: "REVOKED", revokedAt: new Date(), revokedBy: actor.email, revocationReason: reason }, $push: { history: { action: "REVOKED", at: new Date(), by: actor.email, reason } } }, { new: true, session: tx }); if (!row) throw { statusCode: 409, message: "Certificate is not available or is already revoked." }; await AuditLog.create([{ schoolId: actor.schoolId, actorUserId: actor.userId, actorName: actor.name || actor.email, actorEmail: actor.email, actorRole: actor.userType, action: "STAFF_CERTIFICATE_REVOKED", resource: "StaffCertificate", entityId: row._id, details: `${row.certificateNumber}: ${reason}` }], { session: tx }); }); return row; } finally { await tx.endSession(); }
}

export async function reissueStaffCertificate(actor: any, id: string, raw: any) {
  requireAdmin(actor);
  const input = z.object({ reason: z.string().trim().min(3).max(1000), issueDate: z.string().date().optional(), issuanceKey: z.string().uuid(), body: z.string().trim().min(12).max(4000).optional() }).strict().parse(raw);
  const priorRequest: any = await StaffCertificate.findOne({ schoolId: actor.schoolId, issuanceKey: input.issuanceKey }).lean();
  if (priorRequest) {
    if (String(priorRequest.previousCertificateId) !== id) throw { statusCode: 409, message: "This reissue request ID has already been used for another certificate." };
    return priorRequest;
  }
  const old: any = await StaffCertificate.findOne({ _id: id, schoolId: actor.schoolId }).lean();
  if (!old) throw { statusCode: 404, message: "Original staff certificate not found." };
  if (old.status !== "ISSUED") throw { statusCode: 409, message: "Only an active issued certificate can be reissued." };
  const issueDate = input.issueDate || new Date().toISOString().slice(0, 10);
  const copy = { ...old.snapshot, ...(input.body ? { body: input.body } : {}), issuedAt: new Date(issueDate + "T12:00:00Z") };
  const certificateNumber = `STAFF-${issueDate.slice(0, 4)}-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`;
  const verificationId = randomBytes(32).toString("hex"); copy.certificateNumber = certificateNumber; copy.verificationId = verificationId;
  copy.verificationUrl = `${(process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "")}/verify/staff-certificate/${verificationId}`;
  copy.verificationQr = await require("qrcode").toDataURL(copy.verificationUrl);
  const session = await mongoose.startSession();
  try { let fresh: any; await session.withTransaction(async () => { fresh = (await StaffCertificate.create([{ schoolId: old.schoolId, branchId: actor.branchId, staffId: old.staffId, employeeId: old.employeeId, staffName: old.staffName, staffType: old.staffType, designation: old.designation, department: old.department, joiningDate: old.joiningDate, employmentStatus: old.employmentStatus, certificateType: old.certificateType, certificateTitle: old.certificateTitle, certificateNumber, verificationId, issueDate: copy.issuedAt, status: "ISSUED", templateId: old.templateId, templateVersion: old.templateVersion, snapshot: copy, issuedBy: actor.userId, issuedByName: actor.name || actor.email, issuanceKey: input.issuanceKey, previousCertificateId: old._id, reissueReason: input.reason, history: [{ action: "REISSUED", at: new Date(), by: actor.email, reason: input.reason, relatedCertificateId: old._id }] }], { session }))[0]; const prior = await StaffCertificate.updateOne({ _id: old._id, schoolId: actor.schoolId, status: "ISSUED" }, { $push: { history: { action: "REPLACEMENT_ISSUED", at: new Date(), by: actor.email, reason: input.reason, relatedCertificateId: fresh._id } }, $set: { status: "REPLACED", replacedAt: new Date(), replacedBy: actor.email, replacementReason: input.reason } }, { session }); if (!prior.modifiedCount) throw { statusCode: 409, message: "Only an active issued certificate can be reissued." }; await AuditLog.create([{ schoolId: actor.schoolId, actorUserId: actor.userId, actorName: actor.name || actor.email, actorEmail: actor.email, actorRole: actor.userType, action: "STAFF_CERTIFICATE_REISSUED", resource: "StaffCertificate", entityId: fresh._id, details: `${old.certificateNumber} replaced by ${certificateNumber}: ${input.reason}` }], { session }); }); return fresh.toObject(); } finally { await session.endSession(); }
}

export async function publicStaffCertificateVerification(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw { statusCode: 404, message: "Certificate verification not found." };
  const row: any = await StaffCertificate.findOne({ verificationId: token }).select("certificateNumber certificateTitle certificateType staffName issueDate status schoolId").lean();
  if (!row) throw { statusCode: 404, message: "Certificate verification not found." };
  const school: any = await School.findById(row.schoolId).select("name").lean();
  return { certificateNumber: row.certificateNumber, certificateTitle: row.certificateTitle, certificateType: row.certificateType, staffName: row.staffName, issueDate: row.issueDate, status: row.status || "ISSUED", valid: row.status === "ISSUED", schoolName: school?.name || "Issuing school" };
}
