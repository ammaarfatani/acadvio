import { parentAudience,teacherAudience } from "../services/parentAudience.service";
import { branchContext, branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IAnnouncement extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  category: "General" | "Academic" | "Examination" | "Holiday" | "Urgent";
  targetStudentIds?:mongoose.Types.ObjectId[];
  targetClassIds?:mongoose.Types.ObjectId[];
  targetSectionIds?:mongoose.Types.ObjectId[];
  targetRoles?: string[]; // e.g. ["TEACHER", "FINANCE"]
  postedByName: string;
  isPublished: boolean;
  createdBy?: mongoose.Types.ObjectId;
  priority: string;
  status: string;
  publishAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, enum: ["General", "Academic", "Examination", "Holiday", "Urgent"], default: "General" },
    targetRoles: [{ type: String }],
    targetStudentIds:[{type:Schema.Types.ObjectId,ref:"Student"}],targetClassIds:[{type:Schema.Types.ObjectId,ref:"ClassModel"}],targetSectionIds:[{type:Schema.Types.ObjectId,ref:"SectionModel"}],
    postedByName: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    priority: { type: String, enum: ["NORMAL", "HIGH", "URGENT"], default: "NORMAL" },
    status: { type: String, enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "PUBLISHED" },
    publishAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AnnouncementSchema.pre("validate", function () { const context = branchContext.getStore(); if (this.isNew && context?.userId) this.createdBy = new mongoose.Types.ObjectId(context.userId); });
AnnouncementSchema.index({ schoolId: 1, branchId: 1, status: 1, publishAt: -1 });
export function noticeVisibility(role: string, now = new Date()) {
  const audiences = [role, "ALL_SCHOOL", ...(role === "TEACHER" ? ["TEACHERS_ONLY"] : role === "PARENT" ? ["PARENTS_ONLY"] : role === "RECEPTIONIST" ? ["ADMISSION"] : [])];
  return { $and: [ { isPublished: true }, { $or: [{ status: "PUBLISHED" }, { status: { $exists: false } }] }, { $or: [{ publishAt: { $lte: now } }, { publishAt: { $exists: false } }] }, { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: [{ targetRoles: { $size: 0 } }, { targetRoles: { $exists: false } }, { targetRoles: { $in: audiences } }] } ] };
}
for (const op of ["find", "findOne", "countDocuments"] as const) AnnouncementSchema.pre(op, async function () {
  const context = branchContext.getStore(); if (!context || context.noticeManagement) return;
  const audience=context.userType==="PARENT"?await parentAudience(context.organizationId,context.userId!):context.userType==="TEACHER"?await teacherAudience(context.organizationId,context.userId!):{};
  this.setQuery({ $and: [this.getFilter(), noticeVisibility(context.userType || ""), audience] });
});
AnnouncementSchema.plugin(branchScoped, { shared: true });
export const Announcement =
  mongoose.models.Announcement || mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
