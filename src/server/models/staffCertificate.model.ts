import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";

const schema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    employeeId: { type: String, required: true },
    staffName: { type: String, required: true },
    staffType: { type: String, required: true },
    designation: String,
    department: String,
    joiningDate: String,
    employmentStatus: String,
    certificateType: { type: String, required: true, maxlength: 80 },
    certificateTitle: { type: String, required: true, maxlength: 180 },
    certificateNumber: { type: String, required: true },
    verificationId: { type: String, required: true },
    issueDate: { type: Date, required: true },
    status: { type: String, enum: ["ISSUED", "REVOKED", "REPLACED"], default: "ISSUED" },
    templateId: { type: String, required: true },
    templateVersion: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    issuedByName: { type: String, required: true },
    previousCertificateId: { type: Schema.Types.ObjectId, ref: "StaffCertificate" },
    issuanceKey: String,
    reissueReason: String,
    revokedAt: Date,
    revokedBy: String,
    revocationReason: String,
    replacedAt: Date,
    replacedBy: String,
    replacementReason: String,
    history: [{ action: String, at: Date, by: String, reason: String, relatedCertificateId: Schema.Types.ObjectId }],
  },
  { timestamps: true },
);

schema.index({ schoolId: 1, certificateNumber: 1 }, { unique: true });
schema.index({ schoolId: 1, verificationId: 1 }, { unique: true });
schema.index({ schoolId: 1, issuanceKey: 1 }, { unique: true, partialFilterExpression: { issuanceKey: { $type: "string" } } });
schema.index({ schoolId: 1, branchId: 1, issueDate: -1, _id: -1 });
schema.index({ schoolId: 1, staffId: 1, issueDate: -1 });
schema.plugin(branchScoped);

export const StaffCertificate = mongoose.models.StaffCertificate || mongoose.model("StaffCertificate", schema);
