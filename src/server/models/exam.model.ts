import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IExamSchedule extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  term?: "MID_TERM" | "FINAL_TERM";
  academicSessionId?: mongoose.Types.ObjectId;
  academicSessionName?: string;
  classes: string[];
  subjects: string[];
  startDate: Date;
  endDate: Date;
  status: "DRAFT" | "SCHEDULED" | "IN_PROGRESS" | "PROCESSED" | "PUBLISHED";
  publishedAt?: Date;
  publishedByUserName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExamScheduleSchema = new Schema<IExamSchedule>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    term: { type: String, enum: ["MID_TERM", "FINAL_TERM"] },
    academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession" },
    academicSessionName: { type: String },
    classes: [{ type: String }],
    subjects: [{ type: String }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "SCHEDULED", "IN_PROGRESS", "PROCESSED", "PUBLISHED"],
      default: "DRAFT",
      index: true,
    },
    publishedAt: { type: Date },
    publishedByUserName: { type: String },
  },
  { timestamps: true },
);

ExamScheduleSchema.plugin(branchScoped);
export const ExamSchedule =
  mongoose.models.ExamSchedule ||
  mongoose.model<IExamSchedule>("ExamSchedule", ExamScheduleSchema);

export interface IGradingScale extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  rules: Array<{
    grade: string;
    minPercentage: number;
    maxPercentage: number;
    gradePoint?: number;
    remarks?: string;
  }>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GradingScaleSchema = new Schema<IGradingScale>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: "Standard School Grading Scale",
    },
    rules: [
      {
        grade: { type: String, required: true },
        minPercentage: { type: Number, required: true },
        maxPercentage: { type: Number, required: true },
        gradePoint: { type: Number, default: 0 },
        remarks: { type: String },
      },
    ],
    isDefault: { type: Boolean, default: true },
  },
  { timestamps: true },
);

GradingScaleSchema.plugin(branchScoped);
export const GradingScale =
  mongoose.models.GradingScale ||
  mongoose.model<IGradingScale>("GradingScale", GradingScaleSchema);

export interface IMarksEntry extends Document {
  schoolId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  examTitle: string;
  classId: mongoose.Types.ObjectId;
  className: string;
  subjectId: mongoose.Types.ObjectId;
  subjectName: string;
  maxMarks: number;
  passingMarks: number;
  records: {
    studentId: mongoose.Types.ObjectId;
    studentName: string;
    rollNumber: string;
    obtainedMarks: number;
    grade?: string;
    remarks?: string;
    isAbsent?: boolean;
  }[];
  enteredByTeacherId?: mongoose.Types.ObjectId;
  enteredByTeacherName: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  createdAt: Date;
  updatedAt: Date;
}

const MarksEntrySchema = new Schema<IMarksEntry>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    examTitle: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectName: { type: String, required: true },
    maxMarks: { type: Number, default: 100 },
    passingMarks: { type: Number, default: 33 },
    records: [
      {
        studentId: {
          type: Schema.Types.ObjectId,
          ref: "Student",
          required: true,
        },
        studentName: { type: String, required: true },
        rollNumber: { type: String, required: true },
        obtainedMarks: { type: Number, required: true, default: 0 },
        grade: { type: String },
        remarks: { type: String },
        isAbsent: { type: Boolean, default: false },
      },
    ],
    enteredByTeacherId: { type: Schema.Types.ObjectId, ref: "User" },
    enteredByTeacherName: { type: String, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED"],
      default: "DRAFT",
    },
  },
  { timestamps: true },
);

MarksEntrySchema.index(
  { schoolId: 1, examId: 1, classId: 1, subjectId: 1 },
  { unique: true },
);

MarksEntrySchema.plugin(branchScoped);
export const MarksEntry =
  mongoose.models.MarksEntry ||
  mongoose.model<IMarksEntry>("MarksEntry", MarksEntrySchema);

export interface IProcessedResult extends Document {
  schoolId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  examTitle: string;
  classId: mongoose.Types.ObjectId;
  className: string;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string;
  subjectScores: Array<{
    subjectId: mongoose.Types.ObjectId;
    subjectName: string;
    maxMarks: number;
    obtainedMarks: number | null;
    isAbsent?: boolean;
    grade: string;
    remarks?: string;
  }>;
  totalMaxMarks: number;
  totalObtainedMarks: number;
  percentage: number | null;
  overallGrade: string;
  rank?: number;
  status: "PASSED" | "PROMOTED" | "FAILED" | "PENDING";
  attendancePercentage?: number;
  teacherRemarks?: string;
  isPublished: boolean;
  needsProcessing?: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessedResultSchema = new Schema<IProcessedResult>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    examTitle: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, required: true },
    admissionNumber: { type: String },
    subjectScores: [
      {
        subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
        subjectName: { type: String, required: true },
        maxMarks: { type: Number, required: true },
        obtainedMarks: { type: Number, default: null },
        isAbsent: { type: Boolean, default: false },
        grade: { type: String, required: true },
        remarks: { type: String },
      },
    ],
    totalMaxMarks: { type: Number, required: true },
    totalObtainedMarks: { type: Number, required: true },
    percentage: { type: Number, default: null },
    overallGrade: { type: String, required: true },
    rank: { type: Number },
    status: {
      type: String,
      enum: ["PASSED", "PROMOTED", "FAILED", "PENDING"],
      required: true,
    },
    attendancePercentage: { type: Number },
    teacherRemarks: { type: String },
    isPublished: { type: Boolean, default: false },
    needsProcessing: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

ProcessedResultSchema.index(
  { schoolId: 1, examId: 1, studentId: 1 },
  { unique: true },
);

ProcessedResultSchema.plugin(branchScoped);
export const ProcessedResult =
  mongoose.models.ProcessedResult ||
  mongoose.model<IProcessedResult>("ProcessedResult", ProcessedResultSchema);

export interface ICertificateRecord extends Document {
  issuanceKey?: string;
  documentSnapshot?: any;
  schoolId: mongoose.Types.ObjectId;
  certificateNumber: string;
  type: "BONAFIDE" | "CHARACTER" | "LEAVING" | "TRANSFER" | "RESULT";
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string;
  className: string;
  session: string;
  issueDate: Date;
  reason?: string;
  conductRemarks?: string;
  issuedByUserName: string;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateRecordSchema = new Schema<ICertificateRecord>(
  {
    issuanceKey: { type: String },
    documentSnapshot: Schema.Types.Mixed,
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    certificateNumber: { type: String, required: true },
    type: {
      type: String,
      enum: ["BONAFIDE", "CHARACTER", "LEAVING", "TRANSFER", "RESULT"],
      required: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, required: true },
    admissionNumber: { type: String },
    className: { type: String, required: true },
    session: { type: String, required: true },
    issueDate: { type: Date, default: Date.now },
    reason: { type: String },
    conductRemarks: { type: String },
    issuedByUserName: { type: String, required: true },
  },
  { timestamps: true },
);

CertificateRecordSchema.index(
  { schoolId: 1, issuanceKey: 1 },
  {
    unique: true,
    partialFilterExpression: { issuanceKey: { $type: "string" } },
  },
);
CertificateRecordSchema.plugin(branchScoped);
export const CertificateRecord =
  mongoose.models.CertificateRecord ||
  mongoose.model<ICertificateRecord>(
    "CertificateRecord",
    CertificateRecordSchema,
  );

const ExamTimetableSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    examId: {
      type: Schema.Types.ObjectId,
      ref: "ExamSchedule",
      required: true,
    },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: "SectionModel",
      required: true,
    },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    supervisorId: { type: Schema.Types.ObjectId, ref: "User" },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, maxlength: 80 },
  },
  { timestamps: true },
);
ExamTimetableSchema.index(
  { schoolId: 1, examId: 1, sectionId: 1, subjectId: 1 },
  { unique: true },
);
ExamTimetableSchema.plugin(branchScoped);
export const ExamTimetable =
  mongoose.models.ExamTimetable ||
  mongoose.model("ExamTimetable", ExamTimetableSchema);
