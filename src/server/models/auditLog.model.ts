import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  schoolName?: string;
  schoolId?: mongoose.Types.ObjectId;
  resource: string;
  ipAddress?: string;
  details?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorName: { type: String, default: "System User" },
    actorEmail: { type: String, default: "system@acadivo.com" },
    actorRole: { type: String, default: "STAFF" },
    action: { type: String, required: true },
    schoolName: { type: String },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", index: true },
    resource: { type: String, default: "System" },
    ipAddress: { type: String, default: "127.0.0.1" },
    details: { type: String },
  },
  { timestamps: true }
);

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
