import { branchScoped } from "../utils/branchScope";
import mongoose, { Document, Schema } from "mongoose";

export interface IStudentLifecycleEvent extends Document {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  eventType: "STATUS_CHANGED" | "PLACEMENT_CHANGED";
  fromStatus?: string;
  toStatus?: string;
  fromClassId?: mongoose.Types.ObjectId;
  toClassId?: mongoose.Types.ObjectId;
  fromSectionId?: mongoose.Types.ObjectId;
  toSectionId?: mongoose.Types.ObjectId;
  fromSessionId?: mongoose.Types.ObjectId;
  toSessionId?: mongoose.Types.ObjectId;
  reason?: string;
  effectiveAt: Date;
  performedByUserId?: mongoose.Types.ObjectId;
  performedByName: string;
  createdAt: Date;
}

const StudentLifecycleEventSchema = new Schema<IStudentLifecycleEvent>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  eventType: { type: String, enum: ["STATUS_CHANGED", "PLACEMENT_CHANGED"], required: true },
  fromStatus: { type: String }, toStatus: { type: String },
  fromClassId: { type: Schema.Types.ObjectId, ref: "ClassModel" }, toClassId: { type: Schema.Types.ObjectId, ref: "ClassModel" },
  fromSectionId: { type: Schema.Types.ObjectId, ref: "SectionModel" }, toSectionId: { type: Schema.Types.ObjectId, ref: "SectionModel" },
  fromSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" }, toSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
  reason: { type: String, trim: true }, effectiveAt: { type: Date, required: true },
  performedByUserId: { type: Schema.Types.ObjectId, ref: "User" }, performedByName: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

StudentLifecycleEventSchema.index({ schoolId: 1, studentId: 1, effectiveAt: -1 });
StudentLifecycleEventSchema.plugin(branchScoped);
export const StudentLifecycleEvent = mongoose.models.StudentLifecycleEvent || mongoose.model<IStudentLifecycleEvent>("StudentLifecycleEvent", StudentLifecycleEventSchema);
