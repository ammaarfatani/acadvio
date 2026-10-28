import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";
const schema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    kind: { type: String, enum: ["student", "staff"], required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    status: {
      type: String,
      enum: ["PENDING_APPROVAL", "ISSUED", "NEEDS_CORRECTION", "REVOKED"],
      default: "PENDING_APPROVAL",
    },
    revision: { type: Number, default: 0 },
    version: { type: Number, default: 0 },
    reason: String,
    approvedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reference: { type: String },
    sourceHash: String,
    snapshot: { type: Schema.Types.Mixed },
    issuedDocumentId: {
      type: Schema.Types.ObjectId,
      ref: "IssuedSchoolDocument",
    },
  },
  { timestamps: true },
);
schema.plugin(branchScoped);
schema.index({ schoolId: 1, kind: 1, subjectId: 1 }, { unique: true });
schema.index(
  { reference: 1 },
  { unique: true, partialFilterExpression: { reference: { $type: "string" } } },
);
export const IdentityCard =
  mongoose.models.IdentityCard || mongoose.model("IdentityCard", schema);
