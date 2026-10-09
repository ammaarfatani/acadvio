import { branchScoped } from "../utils/branchScope";
import mongoose, { Document, Schema } from "mongoose";

export interface IVisitor extends Document {
  schoolId: mongoose.Types.ObjectId;
  visitorName: string;
  phone: string;
  cnicOrId?: string;
  purpose: string;
  personToMeet: string;
  department: string;
  studentName?: string;
  studentRollNo?: string;
  checkInTime: Date;
  checkOutTime?: Date;
  status: "IN_PREMISES" | "CHECKED_OUT";
  notes?: string;
  recordedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VisitorSchema = new Schema<IVisitor>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    visitorName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    cnicOrId: { type: String, trim: true },
    purpose: { type: String, required: true, trim: true },
    personToMeet: { type: String, required: true, trim: true },
    department: {
      type: String,
      default: "Admin",
      trim: true,
    },
    studentName: { type: String, trim: true },
    studentRollNo: { type: String, trim: true },
    checkInTime: { type: Date, required: true, default: Date.now },
    checkOutTime: { type: Date },
    status: {
      type: String,
      enum: ["IN_PREMISES", "CHECKED_OUT"],
      default: "IN_PREMISES",
      index: true,
    },
    notes: { type: String, trim: true },
    recordedBy: { type: String },
  },
  { timestamps: true }
);

VisitorSchema.index({ schoolId: 1, checkInTime: -1 });
VisitorSchema.index({ schoolId: 1, status: 1 });

VisitorSchema.plugin(branchScoped);
export const Visitor = mongoose.models.Visitor || mongoose.model<IVisitor>("Visitor", VisitorSchema);
