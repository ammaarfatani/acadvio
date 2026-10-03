import mongoose, { Schema, Document } from "mongoose";
import { UserType, UserStatus } from "../constants/roles.constant";

export interface IUser extends Document {
  schoolId?: mongoose.Types.ObjectId; // null for SUPER_ADMIN
  roleId?: mongoose.Types.ObjectId;
  userType: UserType;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  refreshTokenHash?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", default: null, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: "Role" },
    userType: { type: String, enum: Object.values(UserType), required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_APPROVAL,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    refreshTokenHash: { type: String },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
