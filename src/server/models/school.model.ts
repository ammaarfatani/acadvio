import mongoose, { Schema, Document } from "mongoose";
import { SubscriptionStatus, SubscriptionPlan } from "../constants/subscription.constant";

export interface ISchool extends Document {
  documentSettings?:any; documentSettingsRevision?:number; documentSetupCompletedAt?:Date;
  accountStatus?: "ACTIVE" | "DEACTIVATED";
  accountRevision?: number;
  accountStatusReason?: string;
  accountStatusChangedAt?: Date;
  accountStatusChangedBy?: mongoose.Types.ObjectId;
  workforceRevision?: number;
  academicRevision?: number;
  branchCapacityRevision?: number;
  attendanceMode?: "MANUAL" | "BIOMETRIC";
  attendanceSetupCompletedAt?: Date;
  attendancePolicy?: any;
  financeReminderDays?:number;
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
  feePolicy?: {
    earlyDiscountEnabled?: boolean;
    earlyDiscountAmount?: number;
    earlyDiscountType?: "FIXED" | "PERCENTAGE";
    earlyDiscountDaysBeforeDue?: number;
    lateFineModel?: "ONE_TIME" | "STAGES" | "RECURRING" | "DISABLED";
    lateFineAmount?: number;
    lateFineGraceDays?: number;
    lateFineCap?: number;
    lateFineStages?: Array<{ afterDays: number; fineAmount: number }>;
    lateFineDailyRate?: number;
    unpaidBalancesCarryForward?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema = new Schema<ISchool>(
  {
    accountStatus: {type:String,enum:["ACTIVE","DEACTIVATED"],default:"ACTIVE"},
    accountRevision: {type:Number,default:0},
    accountStatusReason: String, accountStatusChangedAt: Date,
    accountStatusChangedBy: {type:Schema.Types.ObjectId,ref:"User"},
    workforceRevision: {type:Number,default:0},
    documentSettings:Schema.Types.Mixed,
    documentSettingsRevision:{type:Number,default:0},
    documentSetupCompletedAt:Date,
    academicRevision: {type:Number,default:0},
    branchCapacityRevision: {type:Number,default:0},
    attendanceMode: {type:String,enum:["MANUAL","BIOMETRIC"]},
    attendanceSetupCompletedAt: Date,
    attendancePolicy: Schema.Types.Mixed,
    financeReminderDays:{type:Number,min:1,max:90,default:7},
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
    feePolicy: {
      earlyDiscountEnabled: { type: Boolean, default: false },
      earlyDiscountAmount: { type: Number, default: 0 },
      earlyDiscountType: { type: String, enum: ["FIXED", "PERCENTAGE"], default: "FIXED" },
      earlyDiscountDaysBeforeDue: { type: Number, default: 0 },
      lateFineModel: { type: String, enum: ["ONE_TIME", "STAGES", "RECURRING", "DISABLED"], default: "DISABLED" },
      lateFineAmount: { type: Number, default: 0 },
      lateFineGraceDays: { type: Number, default: 0 },
      lateFineCap: { type: Number, default: 0 },
      lateFineStages: [{ afterDays: Number, fineAmount: Number }],
      lateFineDailyRate: { type: Number, default: 0 },
      unpaidBalancesCarryForward: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const School = mongoose.models.School || mongoose.model<ISchool>("School", SchoolSchema);

