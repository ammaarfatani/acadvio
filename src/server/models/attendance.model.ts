import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IStudentAttendance extends Document {
  schoolId: mongoose.Types.ObjectId;
  date: Date;
  classId: mongoose.Types.ObjectId;
  academicSessionId?: mongoose.Types.ObjectId;
  className: string;
  sectionId?: mongoose.Types.ObjectId;
  sectionName?: string;
  records: {
    studentId: mongoose.Types.ObjectId;
    studentName: string;
    rollNumber: string;
    status: "PRESENT" | "ABSENT" | "LEAVE" | "LATE";
    remarks?: string;
  }[];
  markedByUserId: mongoose.Types.ObjectId;
  markedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentAttendanceSchema = new Schema<IStudentAttendance>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    date: { type: Date, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", index: true },
    className: { type: String, required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel" },
    sectionName: { type: String },
    records: [
      {
        studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
        studentName: { type: String, required: true },
        rollNumber: { type: String, required: true },
        status: { type: String, enum: ["PRESENT", "ABSENT", "LEAVE", "LATE"], default: "PRESENT" },
        remarks: { type: String },
      },
    ],
    markedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    markedByName: { type: String, required: true },
  },
  { timestamps: true }
);

StudentAttendanceSchema.index({ schoolId: 1, classId: 1, sectionId: 1, date: 1 }, { unique: true });

StudentAttendanceSchema.plugin(branchScoped);
export const StudentAttendance =
  mongoose.models.StudentAttendance ||
  mongoose.model<IStudentAttendance>("StudentAttendance", StudentAttendanceSchema);

export interface ITeacherAttendance extends Document {
  schoolId: mongoose.Types.ObjectId;
  date: Date;
  records: {
    teacherUserId: mongoose.Types.ObjectId;
    teacherName: string;
    status: "PRESENT" | "ABSENT" | "LEAVE" | "LATE";
    arrivalTime?: string;
    checkedInAt?: Date;
    checkedOutAt?: Date;
    remarks?: string;
  }[];
  markedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherAttendanceSchema = new Schema<ITeacherAttendance>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    date: { type: Date, required: true },
    records: [
      {
        teacherUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        teacherName: { type: String, required: true },
        status: { type: String, enum: ["PRESENT", "ABSENT", "LEAVE", "LATE"], default: "PRESENT" },
        arrivalTime: { type: String },
        checkedInAt: { type: Date },
        checkedOutAt: { type: Date },
        remarks: { type: String },
      },
    ],
    markedByName: { type: String, required: true },
  },
  { timestamps: true }
);

TeacherAttendanceSchema.index({ schoolId: 1, date: 1 }, { unique: true });

TeacherAttendanceSchema.plugin(branchScoped);
export const TeacherAttendance =
  mongoose.models.TeacherAttendance ||
  mongoose.model<ITeacherAttendance>("TeacherAttendance", TeacherAttendanceSchema);
