import mongoose, { Schema, Document } from "mongoose";
import { UserType } from "../constants/roles.constant";

export interface IRole extends Document {
  schoolId?: mongoose.Types.ObjectId; // null for system/global roles
  name: string;
  code: string;
  userType: UserType;
  description?: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    userType: { type: String, enum: Object.values(UserType), required: true },
    description: { type: String },
    permissions: [{ type: String, required: true }],
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RoleSchema.index({ schoolId: 1, code: 1 }, { unique: true });

export const Role = mongoose.models.Role || mongoose.model<IRole>("Role", RoleSchema);
