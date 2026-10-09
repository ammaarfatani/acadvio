import { branchScoped } from "../utils/branchScope";
import mongoose, { Document, Schema } from "mongoose";

export interface IFrontDeskRequest extends Document {
  schoolId: mongoose.Types.ObjectId;
  requestNumber: string;
  requesterName: string;
  requesterType: "STUDENT" | "PARENT" | "VISITOR" | "STAFF";
  phone: string;
  requestType: "CERTIFICATE" | "STUDENT_RECORD" | "DOCUMENT_SUBMISSION" | "FEE_QUERY" | "ADMISSION_QUERY" | "GENERAL";
  studentName?: string;
  studentRollNo?: string;
  className?: string;
  assignedDepartment: "ADMIN" | "FINANCE" | "EXAM" | "ACADEMIC" | "RECEPTION";
  details: string;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  resolutionNotes?: string;
  recordedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FrontDeskRequestSchema = new Schema<IFrontDeskRequest>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    requestNumber: { type: String, required: true },
    requesterName: { type: String, required: true, trim: true },
    requesterType: {
      type: String,
      enum: ["STUDENT", "PARENT", "VISITOR", "STAFF"],
      default: "PARENT",
    },
    phone: { type: String, required: true, trim: true },
    requestType: {
      type: String,
      enum: ["CERTIFICATE", "STUDENT_RECORD", "DOCUMENT_SUBMISSION", "FEE_QUERY", "ADMISSION_QUERY", "GENERAL"],
      default: "GENERAL",
    },
    studentName: { type: String, trim: true },
    studentRollNo: { type: String, trim: true },
    className: { type: String, trim: true },
    assignedDepartment: {
      type: String,
      enum: ["ADMIN", "FINANCE", "EXAM", "ACADEMIC", "RECEPTION"],
      default: "RECEPTION",
    },
    details: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    resolutionNotes: { type: String, trim: true },
    recordedBy: { type: String },
  },
  { timestamps: true }
);

FrontDeskRequestSchema.index({ schoolId: 1, requestNumber: 1 }, { unique: true });
FrontDeskRequestSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

FrontDeskRequestSchema.plugin(branchScoped);
export const FrontDeskRequest =
  mongoose.models.FrontDeskRequest ||
  mongoose.model<IFrontDeskRequest>("FrontDeskRequest", FrontDeskRequestSchema);
