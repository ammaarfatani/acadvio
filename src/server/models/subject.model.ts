import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface ISubject extends Document {
  schoolId: mongoose.Types.ObjectId;
  name: string; // e.g. "Mathematics"
  code: string; // e.g. "MATH-10"
  type: "Core" | "Elective" | "Practical";
  classId: mongoose.Types.ObjectId;
  className: string;
  totalMarks: number;
  passingMarks: number;
  teacherId?: mongoose.Types.ObjectId;
  teacherName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Core", "Elective", "Practical"], default: "Core" },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    totalMarks: { type: Number, default: 100 },
    passingMarks: { type: Number, default: 33 },
    teacherId: { type: Schema.Types.ObjectId, ref: "User" },
    teacherName: { type: String },
  },
  { timestamps: true }
);

SubjectSchema.index({ schoolId: 1, classId: 1, name: 1 }, { unique: true });

SubjectSchema.plugin(branchScoped);
export const Subject = mongoose.models.Subject || mongoose.model<ISubject>("Subject", SubjectSchema);

export interface ITimetableSlot extends Document {
  schoolId: mongoose.Types.ObjectId;
  academicSessionId?: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  sectionId?: mongoose.Types.ObjectId;
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  teacherId?: mongoose.Types.ObjectId;
  teacherName?: string;
  roomNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableSlotSchema = new Schema<ITimetableSlot>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", index: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel" },
    dayOfWeek: { type: String, required: true },
    periodNumber: { type: Number, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectName: { type: String, required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User" },
    teacherName: { type: String },
    roomNumber: { type: String },
  },
  { timestamps: true }
);

TimetableSlotSchema.plugin(branchScoped);
export const TimetableSlot =
  mongoose.models.TimetableSlot || mongoose.model<ITimetableSlot>("TimetableSlot", TimetableSlotSchema);
