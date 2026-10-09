import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IClassTeacherAssignment extends Document {
  schoolId: mongoose.Types.ObjectId;
  academicSessionId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  sectionId: mongoose.Types.ObjectId;
  teacherUserId: mongoose.Types.ObjectId;
  teacherName: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClassTeacherAssignmentSchema = new Schema<IClassTeacherAssignment>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
  sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel", required: true },
  teacherUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  teacherName: { type: String, required: true },
}, { timestamps: true });

ClassTeacherAssignmentSchema.index({ schoolId: 1, academicSessionId: 1, sectionId: 1 }, { unique: true });
ClassTeacherAssignmentSchema.index({ schoolId: 1, academicSessionId: 1, teacherUserId: 1 });
ClassTeacherAssignmentSchema.plugin(branchScoped);
export const ClassTeacherAssignment = mongoose.models.ClassTeacherAssignment || mongoose.model<IClassTeacherAssignment>("ClassTeacherAssignment", ClassTeacherAssignmentSchema);
