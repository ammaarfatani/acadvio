import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";
import { UserType, UserStatus } from "../constants/roles.constant";

export interface IUser extends Document {
  schoolId?: mongoose.Types.ObjectId; // null for SUPER_ADMIN
  organizationId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  isOrganizationOwner?: boolean;
  roleId?: mongoose.Types.ObjectId;
  userType: UserType;
  employeeId?: string;
  idPhoto?: string;
  name: string;
  email: string;
  passwordHash: string;
  tokenVersion?: number;
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
    isOrganizationOwner: { type: Boolean },
    roleId: { type: Schema.Types.ObjectId, ref: "Role" },
    userType: { type: String, enum: Object.values(UserType), required: true },
    employeeId: { type: String, immutable:true },
    idPhoto:{type:String,select:false},
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_APPROVAL,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

const redactUserSecrets = (_doc:any, result:any) => {
  for(const field of ["passwordHash","refreshTokenHash","resetPasswordToken","resetPasswordExpires","emailVerificationToken","emailVerificationExpires"])delete result[field];
  return result;
};
UserSchema.set("toJSON",{transform:redactUserSecrets});
UserSchema.set("toObject",{transform:redactUserSecrets});
UserSchema.plugin(branchScoped);
UserSchema.pre("validate", async function(){if(this.isNew&&this.schoolId&&!["PARENT","SUPER_ADMIN"].includes(this.userType)){const {permanentIdentity}=await import("../services/permanentIdentity.service");this.employeeId=await permanentIdentity(this.schoolId,"employee",this._id);}});
UserSchema.post("save", async function(doc:any){if(doc.schoolId&&!["PARENT","SUPER_ADMIN"].includes(doc.userType)){const {IdentityCard}=await import("./identityCard.model");await IdentityCard.updateOne({schoolId:doc.schoolId,kind:"staff",subjectId:doc._id},{$setOnInsert:{status:"PENDING_APPROVAL",organizationId:doc.organizationId||doc.schoolId,branchId:doc.branchId||doc.schoolId}},{upsert:true,session:doc.$session()||undefined});}});
// Use the existing scoped write path; generic bulkWrite is intentionally forbidden.
UserSchema.post("insertMany",async function(docs:any[]){const {IdentityCard}=await import("./identityCard.model");for(const doc of docs){if(doc.schoolId&&!["PARENT","SUPER_ADMIN"].includes(doc.userType))await IdentityCard.updateOne({schoolId:doc.schoolId,kind:"staff",subjectId:doc._id},{$setOnInsert:{status:"PENDING_APPROVAL",organizationId:doc.organizationId||doc.schoolId,branchId:doc.branchId||doc.schoolId}},{upsert:true,session:doc.$session?.()||undefined});}});
export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
