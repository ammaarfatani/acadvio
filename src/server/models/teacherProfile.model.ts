import mongoose, { Schema, Document } from "mongoose";

export interface ITeacherProfile extends Document {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  qualification?: string;
  employeeId?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherProfileSchema = new Schema<ITeacherProfile>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  qualification: { type: String, trim: true },
  employeeId: { type: String, trim: true },
  phone: { type: String, trim: true },
}, { timestamps: true });
TeacherProfileSchema.index({ schoolId: 1, employeeId: 1 }, { unique: true, partialFilterExpression: { employeeId: { $type: "string" } } });

export const TeacherProfile = mongoose.models.TeacherProfile || mongoose.model<ITeacherProfile>("TeacherProfile", TeacherProfileSchema);

export interface ITeachingAssignment extends Document {
  schoolId: mongoose.Types.ObjectId;
  teacherUserId: mongoose.Types.ObjectId;
  academicSessionId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  sectionId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  status: "ACTIVE" | "ENDED";
  assignedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeachingAssignmentSchema = new Schema<ITeachingAssignment>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  teacherUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
  classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
  sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel", required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  status: { type: String, enum: ["ACTIVE", "ENDED"], default: "ACTIVE", index: true },
  assignedAt: { type: Date, default: Date.now, required: true },
  endedAt: { type: Date },
}, { timestamps: true });
TeachingAssignmentSchema.index({ schoolId: 1, teacherUserId: 1, academicSessionId: 1, status: 1 });
TeachingAssignmentSchema.index({ schoolId: 1, classId: 1, sectionId: 1, subjectId: 1, status: 1 });

export const TeachingAssignment = mongoose.models.TeachingAssignment || mongoose.model<ITeachingAssignment>("TeachingAssignment", TeachingAssignmentSchema);
