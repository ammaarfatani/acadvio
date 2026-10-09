import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";
import { UserType } from "../constants/roles.constant";

export interface ILoginActivity extends Document {
  userId?: mongoose.Types.ObjectId;
  schoolId?: mongoose.Types.ObjectId;
  userType?: UserType;
  emailAttempt: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

const LoginActivitySchema = new Schema<ILoginActivity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", index: true },
    userType: { type: String, enum: Object.values(UserType) },
    emailAttempt: { type: String, required: true },
    action: { type: String, required: true },
    ipAddress: { type: String, default: "127.0.0.1" },
    userAgent: { type: String, default: "Unknown" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LoginActivitySchema.plugin(branchScoped);
export const LoginActivity =
  mongoose.models.LoginActivity ||
  mongoose.model<ILoginActivity>("LoginActivity", LoginActivitySchema);
