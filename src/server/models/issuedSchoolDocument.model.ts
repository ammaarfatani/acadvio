import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";
const schema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    staffId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true },
    reference: { type: String, required: true },
    sourceHash: { type: String, required: true },
    requestId: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
schema.index({ schoolId: 1, requestId: 1 }, { unique: true });
schema.index({ schoolId: 1, reference: 1 }, { unique: true });
schema.plugin(branchScoped);
export const IssuedSchoolDocument =
  mongoose.models.IssuedSchoolDocument || mongoose.model("IssuedSchoolDocument", schema);
