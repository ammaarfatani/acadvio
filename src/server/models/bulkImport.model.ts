import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema } from "mongoose";
const BulkImportSchema = new Schema({
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    entity: { type: String, enum: ["students", "teachers"], required: true },
    filename: { type: String, required: true },
    status: { type: String, enum: ["PREVIEW", "PROCESSING", "COMPLETED", "FAILED"], default: "PREVIEW" },
    rows: { type: [Schema.Types.Mixed], required: true, select: false },
    summary: { type: Schema.Types.Mixed, required: true },
    processed: { type: Number, default: 0 },
    message: String,
    expiresAt: { type: Date, required: true },
    heartbeatAt: Date,
    leaseUntil: Date,
    leaseToken: String,
}, { timestamps: true });
BulkImportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
BulkImportSchema.index({ schoolId: 1, entity: 1 }, { unique: true, partialFilterExpression: { status: "PROCESSING" }, name: "one_active_import_per_school_entity" });
BulkImportSchema.plugin(branchScoped);
export const BulkImport = mongoose.models.BulkImport || mongoose.model("BulkImport", BulkImportSchema);
