import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";
const presetSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 80 },
    configuration: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
presetSchema.plugin(branchScoped);
presetSchema.index(
  { schoolId: 1, branchId: 1, userId: 1, name: 1 },
  { unique: true },
);
export const ReportPreset =
  mongoose.models.ReportPreset || mongoose.model("ReportPreset", presetSchema);
const actionSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    rule: { type: String, required: true, maxlength: 80 },
    status: {
      type: String,
      enum: ["NEW", "IN_PROGRESS", "COMPLETED", "DISMISSED"],
      default: "NEW",
    },
    notes: { type: String, maxlength: 2000 },
    reviewDate: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
actionSchema.plugin(branchScoped);
actionSchema.index({ schoolId: 1, branchId: 1, rule: 1 }, { unique: true });
export const ImprovementAction =
  mongoose.models.ImprovementAction ||
  mongoose.model("ImprovementAction", actionSchema);
