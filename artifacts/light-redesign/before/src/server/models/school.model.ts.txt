import mongoose, { Schema, Document } from "mongoose";
import { SubscriptionStatus, SubscriptionPlan } from "../constants/subscription.constant";

export interface ISchool extends Document {
  workforceRevision?: number;
  academicRevision?: number;
  attendanceMode?: "MANUAL" | "BIOMETRIC";
  attendanceSetupCompletedAt?: Date;
  attendancePolicy?: any;
  name: string;
  code: string;
  slug?: string;
  email: string;
  phone: string;
  address: string;
  studentCountRange: string;
  teacherCount: number;
  plan: SubscriptionPlan;
  registrationType?: "trial" | "paid";
  isDemo?: boolean;
  status: SubscriptionStatus;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  logoUrl?: string;
  domain?: string;
  currency?: string;
  dateFormat?: string;
  bankDetails?: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban?: string;
    branch?: string;
    instructions?: string;
    enabled?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema = new Schema<ISchool>(
  {
    workforceRevision: {type:Number,default:0},
    academicRevision: {type:Number,default:0},
    attendanceMode: {type:String,enum:["MANUAL","BIOMETRIC"]},
    attendanceSetupCompletedAt: Date,
    attendancePolicy: Schema.Types.Mixed,
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    slug: { type: String, lowercase: true, trim: true, sparse: true, unique: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    studentCountRange: { type: String, required: true },
    teacherCount: { type: Number, required: true, default: 0 },
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlan),
      default: SubscriptionPlan.PROFESSIONAL,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING_APPROVAL,
    },
    registrationType: { type: String, enum: ["trial", "paid"], default: "trial" },
    isDemo: { type: Boolean, default: false },
    trialStartedAt: { type: Date },
    trialEndsAt: { type: Date },
    logoUrl: { type: String },
    domain: { type: String },
    currency: { type: String, enum: ["PKR"], default: "PKR" },
    dateFormat: { type: String, enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"], default: "DD/MM/YYYY" },
    bankDetails: {
      bankName: { type: String },
      accountTitle: { type: String },
      accountNumber: { type: String },
      iban: { type: String },
      branch: String, instructions: String, enabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export const School = mongoose.models.School || mongoose.model<ISchool>("School", SchoolSchema);

