import { branchScoped } from "../utils/branchScope";
import mongoose, { Document, Schema } from "mongoose";

export type AdmissionStatus = "NEW" | "CONTACTED" | "FOLLOW_UP" | "APPLIED" | "APPROVED" | "ADMITTED" | "REJECTED" | "CANCELLED";

export interface IAdmission extends Document {
  schoolId: mongoose.Types.ObjectId;
  applicationNumber: string;
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  previousSchool?: string;
  previousClass?: string;
  applyingClassId: mongoose.Types.ObjectId;
  applyingClassName: string;
  academicSessionId: mongoose.Types.ObjectId;
  academicSessionName: string;
  admissionSource?: string;
  status: AdmissionStatus;
  inquiryDate: Date;
  followUpDate?: Date;
  notes?: string;
  documentsStatus: "PENDING" | "PARTIAL" | "COMPLETE";
  studentId?: mongoose.Types.ObjectId;
  admissionNumber?: string;
  admittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdmissionSchema = new Schema<IAdmission>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  applicationNumber: { type: String, required: true },
  studentName: { type: String, required: true, trim: true },
  guardianName: { type: String, required: true, trim: true },
  guardianPhone: { type: String, required: true, trim: true },
  guardianEmail: { type: String, trim: true, lowercase: true },
  previousSchool: { type: String, trim: true },
  previousClass: { type: String, trim: true },
  applyingClassId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
  applyingClassName: { type: String, required: true },
  academicSessionId: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },
  academicSessionName: { type: String, required: true },
  admissionSource: { type: String, trim: true },
  status: { type: String, enum: ["NEW", "CONTACTED", "FOLLOW_UP", "APPLIED", "APPROVED", "ADMITTED", "REJECTED", "CANCELLED"], default: "NEW", index: true },
  inquiryDate: { type: Date, required: true, default: Date.now },
  followUpDate: { type: Date },
  notes: { type: String, trim: true },
  documentsStatus: { type: String, enum: ["PENDING", "PARTIAL", "COMPLETE"], default: "PENDING" },
  studentId: { type: Schema.Types.ObjectId, ref: "Student" },
  admissionNumber: { type: String },
  admittedAt: { type: Date },
}, { timestamps: true });

AdmissionSchema.index({ schoolId: 1, applicationNumber: 1 }, { unique: true });
AdmissionSchema.index({ schoolId: 1, academicSessionId: 1, applyingClassId: 1, status: 1, inquiryDate: -1 });
AdmissionSchema.plugin(branchScoped);
export const Admission = mongoose.models.Admission || mongoose.model<IAdmission>("Admission", AdmissionSchema);
