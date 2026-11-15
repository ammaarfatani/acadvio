import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IFeeFollowUp extends Document {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  contactDate: Date;
  nextFollowUpDate?: Date;
  status: "OPEN" | "CONTACTED" | "PROMISED" | "FOLLOW_UP" | "RESOLVED";
  note: string;
  createdByUserId: mongoose.Types.ObjectId;
  createdByName: string;
}

const FeeFollowUpSchema = new Schema<IFeeFollowUp>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  contactDate: { type: Date, required: true },
  nextFollowUpDate: { type: Date },
  status: { type: String, enum: ["OPEN", "CONTACTED", "PROMISED", "FOLLOW_UP", "RESOLVED"], required: true, default: "OPEN" },
  note: { type: String, required: true, trim: true, maxlength: 2000 },
  createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String, required: true, trim: true },
}, { timestamps: true });
FeeFollowUpSchema.index({ schoolId: 1, studentId: 1, contactDate: -1 });
FeeFollowUpSchema.plugin(branchScoped);

export const FeeFollowUp = mongoose.models.FeeFollowUp || mongoose.model<IFeeFollowUp>("FeeFollowUp", FeeFollowUpSchema);
