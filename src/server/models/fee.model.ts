import { branchScoped } from "../utils/branchScope";
import mongoose, { Schema, Document } from "mongoose";

export interface IFeeStructure extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  structureType?: string;
  isDefault?: boolean;
  academicSession?: string;
  classScope?: "SPECIFIC" | "ALL";
  classId?: mongoose.Types.ObjectId;
  className?: string;
  classCategoryName?: string;
  sectionId?: mongoose.Types.ObjectId;
  admissionFee: number;
  tuitionFee: number;
  examFee: number;
  transportFee: number;
  libraryFee: number;
  computerFee: number;
  customCharges?: Array<{ label: string; amount: number }>;
  otherCharges: number;
  totalMonthlyFee: number;
  defaultDiscount?: number;
  lateFeeFineRate?: number;
  dueDateDay?: number;
  earlyPaymentDiscount?: {
    enabled: boolean;
    type: "FIXED" | "PERCENTAGE";
    amount: number;
    cutoffDaysBeforeDue?: number;
  };
  lateFeeFinePolicy?: {
    type?: "FIXED" | "PERCENTAGE";
    model: "ONE_TIME" | "STAGES" | "RECURRING" | "DISABLED";
    amount: number;
    graceDays?: number;
    stages?: Array<{ daysAfterDue: number; fineAmount: number }>;
    dailyRate?: number;
    maxFineCap?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FeeStructureSchema = new Schema<IFeeStructure>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true },
    structureType: { type: String, trim: true, default: "Standard" },
    isDefault: { type: Boolean, default: false },
    academicSession: { type: String },
    classScope: { type: String, enum: ["SPECIFIC", "ALL"], default: "SPECIFIC", index: true },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: function(this: any) { return this.classScope !== "ALL" && this.get?.("classScope") !== "ALL"; } },
    className: { type: String, required: function(this: any) { return this.classScope !== "ALL" && this.get?.("classScope") !== "ALL"; }, default: "All Classes" },
    classCategoryName: { type: String, trim: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel" },
    admissionFee: { type: Number, min: 0, default: 0 },
    tuitionFee: { type: Number, min: 0, required: true, default: 0 },
    examFee: { type: Number, min: 0, default: 0 },
    transportFee: { type: Number, min: 0, default: 0 },
    libraryFee: { type: Number, min: 0, default: 0 },
    computerFee: { type: Number, min: 0, default: 0 },
    customCharges: [{ label: { type: String, maxlength: 60 }, amount: { type: Number, min: 0 } }],
    otherCharges: { type: Number, min: 0, default: 0 },
    totalMonthlyFee: { type: Number, min: 0, required: true },
    defaultDiscount: { type: Number, min: 0, default: 0 },
    lateFeeFineRate: { type: Number, min: 0, default: 0 },
    dueDateDay: { type: Number, default: 10 },
    earlyPaymentDiscount: {
      enabled: { type: Boolean, default: false },
      type: { type: String, enum: ["FIXED", "PERCENTAGE"], default: "FIXED" },
      amount: { type: Number, min: 0, default: 0 },
      cutoffDaysBeforeDue: { type: Number, default: 0 },
    },
    lateFeeFinePolicy: {
      type: { type: String, enum: ["FIXED", "PERCENTAGE"], default: "FIXED" },
      model: { type: String, enum: ["ONE_TIME", "STAGES", "RECURRING", "DISABLED"], default: "DISABLED" },
      amount: { type: Number, min: 0, default: 0 },
      graceDays: { type: Number, default: 0 },
      stages: [
        {
          daysAfterDue: Number,
          fineAmount: { type: Number, min: 0 },
        },
      ],
      dailyRate: { type: Number, min: 0, default: 0 },
      maxFineCap: { type: Number, min: 0, default: 0 },
    },
  },
  { timestamps: true }
);

FeeStructureSchema.pre("init", function (raw: any) {
  if (typeof raw?.lateFeeFinePolicy !== "string") return;
  const original = raw.lateFeeFinePolicy.trim(), legacy = original.toUpperCase(), amount = Math.max(0, Number(raw.lateFeeFineRate) || 0);
  if (legacy.startsWith("{")) {
    try { raw.lateFeeFinePolicy = JSON.parse(original); } catch { return; }
  } else if (["NONE", "NO_FINE", "DISABLED"].includes(legacy)) {
    raw.lateFeeFinePolicy = { model: "DISABLED", type: "FIXED", amount: 0, graceDays: 0, dailyRate: 0, maxFineCap: 0, stages: [] };
  } else if (legacy === "ONE_TIME") {
    raw.lateFeeFinePolicy = { model: "ONE_TIME", type: "FIXED", amount, graceDays: 0, dailyRate: 0, maxFineCap: 0, stages: [] };
  } else if (["FIXED", "PERCENTAGE"].includes(legacy)) {
    raw.lateFeeFinePolicy = { model: amount > 0 ? "ONE_TIME" : "DISABLED", type: legacy, amount, graceDays: 0, dailyRate: 0, maxFineCap: 0, stages: [] };
  } else if (["STAGES", "RECURRING"].includes(legacy)) {
    raw.lateFeeFinePolicy = { model: legacy, type: "FIXED", amount: 0, graceDays: 0, dailyRate: amount, maxFineCap: 0, stages: [] };
  }
});

FeeStructureSchema.plugin(branchScoped);
export const FeeStructure =
  mongoose.models.FeeStructure || mongoose.model<IFeeStructure>("FeeStructure", FeeStructureSchema);

export interface IFeeChallan extends Document {
  documentSnapshot?: any;
  previousBalanceInformational?: boolean;
  issuedTotalPKR?: number;
  appliedEarlyDiscountPKR?: number;
  lateFineWaived?: boolean;
  lateFineWaivedAt?: Date;
  lateFineWaivedBy?: string;
  lateFineWaiverReason?: string;
  earlyDiscountAppliedAt?: Date;
  lateFeePolicyAmount?: number;
  lateFeeFinePolicy?: {
    model?: "ONE_TIME" | "STAGES" | "RECURRING" | "DISABLED";
    type?: "FIXED" | "PERCENTAGE";
    amount: number;
    graceDays?: number;
    dailyRate?: number;
    maxFineCap?: number;
    stages?: Array<{ daysAfterDue: number; fineAmount: number }>;
  };
  lateFeeAppliedAt?: Date;
  schoolId: mongoose.Types.ObjectId;
  challanNumber: string;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  fatherName?: string;
  feeStructureId?: mongoose.Types.ObjectId;
  feeStructureTitle?: string;
  rollNumber: string;
  admissionNumber?: string;
  classId: mongoose.Types.ObjectId;
  className: string;
  classCategoryName?: string;
  sectionName?: string;
  academicSession?: string;
  month: string;
  dueDate: Date;
  previousBalance: number;
  concessionAmount?: number;
  concessionReason?: string;
  earlyPaymentDiscount?: number;
  earlyPaymentDeadline?: Date;
  amountPayableWithEarlyDiscount?: number;
  lateFinePolicyModel?: "ONE_TIME" | "STAGES" | "RECURRING" | "DISABLED";
  lateFineStages?: Array<{
    label: string;
    deadlineDate: Date;
    payableAmount: number;
    fineAmount: number;
  }>;
  amountPayableAfterDueDate?: number;
  copiesPrintedCount?: number;
  feeBreakdown: {
    customCharges?: Array<{ label: string; amount: number }>;
    admissionFee?: number;
    tuitionFee: number;
    examFee?: number;
    transportFee?: number;
    libraryFee?: number;
    computerFee?: number;
    otherCharges?: number;
    arrears?: number;
    lateFeeFine?: number;
    discount?: number;
    scholarship?: number;
  };
  totalAmountPKR: number;
  paidAmountPKR: number;
  remainingAmountPKR: number;
  status: "PAID" | "PENDING" | "PARTIAL" | "OVERDUE" | "ZERO_BALANCE" | "VOIDED";
  paymentMethod?: "Cash" | "Bank Transfer" | "Online" | "Cheque" | "Other";
  paidDate?: Date;
  receiptNumber?: string;
  collectedByUserName?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeeChallanSchema = new Schema<IFeeChallan>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    challanNumber: { type: String, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    studentName: { type: String, required: true },
    fatherName: { type: String, trim: true },
    feeStructureId: { type: Schema.Types.ObjectId, ref: "FeeStructure" },
    feeStructureTitle: { type: String, trim: true },
    rollNumber: { type: String, required: true },
    admissionNumber: { type: String },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    classCategoryName: { type: String, trim: true },
    sectionName: { type: String },
    academicSession: { type: String },
    month: { type: String, required: true },
    dueDate: { type: Date, required: true },
    previousBalance: { type: Number, default: 0 },
    concessionAmount: { type: Number, default: 0 },
    concessionReason: { type: String, trim: true },
    earlyPaymentDiscount: { type: Number, default: 0 },
    earlyPaymentDeadline: { type: Date },
    amountPayableWithEarlyDiscount: { type: Number },
    lateFeeFinePolicy: {
      type: new Schema({
        model: { type: String, enum: ["ONE_TIME", "STAGES", "RECURRING", "DISABLED"], default: "DISABLED" },
        type: { type: String, enum: ["FIXED", "PERCENTAGE"], default: "FIXED" },
        amount: { type: Number, min: 0, default: 0 },
        graceDays: { type: Number, min: 0, default: 0 },
        dailyRate: { type: Number, min: 0, default: 0 },
        maxFineCap: { type: Number, min: 0, default: 0 },
        stages: [{ daysAfterDue: { type: Number, min: 1 }, fineAmount: { type: Number, min: 0 } }],
      }, { _id: false, id: false, strict: true }),
      default: undefined,
    },
    lateFinePolicyModel: {
      type: String,
      enum: ["ONE_TIME", "STAGES", "RECURRING", "DISABLED"],
      default: "ONE_TIME",
    },
    lateFineStages: [
      {
        label: String,
        deadlineDate: Date,
        payableAmount: Number,
        fineAmount: Number,
      },
    ],
    amountPayableAfterDueDate: { type: Number },
    copiesPrintedCount: { type: Number, default: 0 },
    feeBreakdown: {
      customCharges: [{ label: String, amount: Number }],
      admissionFee: { type: Number, default: 0 },
      tuitionFee: { type: Number, required: true, default: 0 },
      examFee: { type: Number, default: 0 },
      transportFee: { type: Number, default: 0 },
      libraryFee: { type: Number, default: 0 },
      computerFee: { type: Number, default: 0 },
      otherCharges: { type: Number, default: 0 },
      arrears: { type: Number, default: 0 },
      lateFeeFine: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      scholarship: { type: Number, default: 0 },
    },
    totalAmountPKR: { type: Number, required: true },
    paidAmountPKR: { type: Number, default: 0 },
    remainingAmountPKR: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PAID", "PENDING", "PARTIAL", "OVERDUE", "ZERO_BALANCE", "VOIDED"],
      default: "PENDING",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Online", "Cheque", "Other"],
    },
    paidDate: { type: Date },
    receiptNumber: { type: String },
    collectedByUserName: { type: String },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String },
    voidedAt: { type: Date },
  },
  { timestamps: true }
);

// Older challans stored the policy model as a string. Normalize those values
// in memory when reading; no bulk migration or historical rewrite is needed.
FeeChallanSchema.pre("init", function (raw: any) {
  if (typeof raw?.lateFeeFinePolicy !== "string") return;
  const legacy = raw.lateFeeFinePolicy.toUpperCase();
  const modelSet = new Set(["ONE_TIME", "STAGES", "RECURRING", "DISABLED"]);
  const typeSet = new Set(["FIXED", "PERCENTAGE"]);
  if (modelSet.has(legacy)) {
    raw.lateFeeFinePolicy = {
      model: legacy,
      type: "FIXED",
      amount: Math.max(0, Number(raw.lateFeePolicyAmount) || 0),
      graceDays: 0,
      dailyRate: 0,
      maxFineCap: 0,
      stages: [],
    };
  } else if (typeSet.has(legacy)) {
    raw.lateFeeFinePolicy = {
      model: raw.lateFinePolicyModel || (Number(raw.lateFeePolicyAmount) > 0 ? "ONE_TIME" : "DISABLED"),
      type: legacy,
      amount: Math.max(0, Number(raw.lateFeePolicyAmount) || 0),
      graceDays: 0,
      dailyRate: 0,
      maxFineCap: 0,
      stages: [],
    };
  } else if (["NONE", "NO_FINE"].includes(legacy)) {
    raw.lateFeeFinePolicy = { model: "DISABLED", type: "FIXED", amount: 0, graceDays: 0, dailyRate: 0, maxFineCap: 0, stages: [] };
  }
});
FeeChallanSchema.add({previousBalanceInformational:Boolean,issuedTotalPKR:Number,appliedEarlyDiscountPKR:Number,documentSnapshot:Schema.Types.Mixed,lateFeePolicyAmount:Number,lateFineWaivedAt:Date,lateFineWaivedBy:String,lateFineWaiverReason:String,earlyDiscountAppliedAt:Date,lateFeeAppliedAt:Date});
FeeChallanSchema.index({ schoolId: 1, challanNumber: 1 }, { unique: true });

FeeChallanSchema.plugin(branchScoped);
export const FeeChallan = mongoose.models.FeeChallan || mongoose.model<IFeeChallan>("FeeChallan", FeeChallanSchema);

export interface IFeePayment extends Document {
  schoolId: mongoose.Types.ObjectId;
  challanId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  rollNumber: string;
  className: string;
  amountPKR: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Online" | "Cheque" | "Other";
  paidAt: Date;
  receiptNumber: string;
  collectedByUserName: string;
  documentSnapshot?: any; paymentRequestId?:string; transactionReference?:string; balanceAfterPKR?:number;
  createdAt: Date;
}

const FeePaymentSchema = new Schema<IFeePayment>({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
  challanId: { type: Schema.Types.ObjectId, ref: "FeeChallan", required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  rollNumber: { type: String, required: true },
  className: { type: String, required: true },
  amountPKR: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ["Cash", "Bank Transfer", "Online", "Cheque", "Other"], required: true },
  paidAt: { type: Date, required: true, default: Date.now },
  receiptNumber: { type: String, required: true },
  collectedByUserName: { type: String, required: true },
}, { timestamps: true });
FeePaymentSchema.add({documentSnapshot:Schema.Types.Mixed,paymentRequestId:String,transactionReference:String,balanceAfterPKR:Number});
FeePaymentSchema.index({schoolId:1,paymentRequestId:1},{unique:true,partialFilterExpression:{paymentRequestId:{$type:"string"}}});
FeePaymentSchema.index({ schoolId: 1, receiptNumber: 1 }, { unique: true });
FeePaymentSchema.index({ schoolId: 1, paidAt: -1 });
FeePaymentSchema.plugin(branchScoped);
export const FeePayment = mongoose.models.FeePayment || mongoose.model<IFeePayment>("FeePayment", FeePaymentSchema);

export interface IExpense extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  category: "Salary" | "Water" | "Rent" | "Electricity" | "Stationery" | "Maintenance" | "Transport" | "Other";
  amountPKR: number;
  expenseDate: Date;
  description?: string;
  paymentMethod: "Cash" | "Bank Transfer" | "Cheque" | "Online" | "Other";
  receiptRef?: string;
  loggedByName: string;
  isVoided?: boolean;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ["Salary", "Water", "Rent", "Electricity", "Stationery", "Maintenance", "Transport", "Other"],
      required: true,
    },
    amountPKR: { type: Number, required: true },
    expenseDate: { type: Date, default: Date.now },
    description: { type: String },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Cheque", "Online", "Other"],
      default: "Cash",
    },
    receiptRef: { type: String },
    loggedByName: { type: String, required: true },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String },
  },
  { timestamps: true }
);

ExpenseSchema.plugin(branchScoped);
export const Expense = mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);
