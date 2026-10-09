import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface ILeaveRequest extends Document {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  teacherName: string;
  employeeId?: string;
  leaveType: "Casual" | "Sick" | "Earned" | "Maternity" | "Unpaid";
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedByUserName?: string;
  reviewComment?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teacherName: { type: String, required: true },
    employeeId: { type: String },
    leaveType: {
      type: String,
      enum: ["Casual", "Sick", "Earned", "Maternity", "Unpaid"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, default: 1 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    reviewedByUserName: { type: String },
    reviewComment: { type: String },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

LeaveRequestSchema.plugin(branchScoped);
export const LeaveRequest =
  mongoose.models.LeaveRequest || mongoose.model<ILeaveRequest>("LeaveRequest", LeaveRequestSchema);
