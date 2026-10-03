import mongoose, { Schema, Document } from "mongoose";

export interface IExamSchedule extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
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
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true },
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
  { timestamps: true }
);

export const ExamSchedule =
  mongoose.models.ExamSchedule || mongoose.model<IExamSchedule>("ExamSchedule", ExamScheduleSchema);

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
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true, default: "Standard School Grading Scale" },
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
  { timestamps: true }
);

export const GradingScale =
  mongoose.models.GradingScale || mongoose.model<IGradingScale>("GradingScale", GradingScaleSchema);

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
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examId: { type: Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
    examTitle: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectName: { type: String, required: true },
    maxMarks: { type: Number, default: 100 },
    passingMarks: { type: Number, default: 33 },
    records: [
      {
        studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
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
    status: { type: String, enum: ["DRAFT", "SUBMITTED", "APPROVED"], default: "DRAFT" },
  },
  { timestamps: true }
);

MarksEntrySchema.index({ schoolId: 1, examId: 1, classId: 1, subjectId: 1 }, { unique: true });

export const MarksEntry = mongoose.models.MarksEntry || mongoose.model<IMarksEntry>("MarksEntry", MarksEntrySchema);

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
    obtainedMarks: number;
    grade: string;
    remarks?: string;
  }>;
  totalMaxMarks: number;
  totalObtainedMarks: number;
  percentage: number;
  overallGrade: string;
  rank?: number;
  status: "PASSED" | "PROMOTED" | "FAILED";
  attendancePercentage?: number;
  teacherRemarks?: string;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessedResultSchema = new Schema<IProcessedResult>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examId: { type: Schema.Types.ObjectId, ref: "ExamSchedule", required: true },
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
        obtainedMarks: { type: Number, required: true },
        grade: { type: String, required: true },
        remarks: { type: String },
      },
    ],
    totalMaxMarks: { type: Number, required: true },
    totalObtainedMarks: { type: Number, required: true },
    percentage: { type: Number, required: true },
    overallGrade: { type: String, required: true },
    rank: { type: Number },
    status: { type: String, enum: ["PASSED", "PROMOTED", "FAILED"], required: true },
    attendancePercentage: { type: Number },
    teacherRemarks: { type: String },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

ProcessedResultSchema.index({ schoolId: 1, examId: 1, studentId: 1 }, { unique: true });

export const ProcessedResult =
  mongoose.models.ProcessedResult || mongoose.model<IProcessedResult>("ProcessedResult", ProcessedResultSchema);

export interface ICertificateRecord extends Document {
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
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
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
  { timestamps: true }
);

export const CertificateRecord =
  mongoose.models.CertificateRecord || mongoose.model<ICertificateRecord>("CertificateRecord", CertificateRecordSchema);
