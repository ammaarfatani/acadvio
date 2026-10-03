import mongoose, { Schema, Document } from "mongoose";

export interface IFeeStructure extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  academicSession?: string;
  classId: mongoose.Types.ObjectId;
  className: string;
  sectionId?: mongoose.Types.ObjectId;
  admissionFee: number;
  tuitionFee: number;
  examFee: number;
  transportFee: number;
  libraryFee: number;
  computerFee: number;
  otherCharges: number;
  totalMonthlyFee: number;
  defaultDiscount?: number;
  lateFeeFineRate?: number;
  dueDateDay?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FeeStructureSchema = new Schema<IFeeStructure>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true },
    academicSession: { type: String },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "SectionModel" },
    admissionFee: { type: Number, default: 0 },
    tuitionFee: { type: Number, required: true, default: 0 },
    examFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 },
    libraryFee: { type: Number, default: 0 },
    computerFee: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    totalMonthlyFee: { type: Number, required: true },
    defaultDiscount: { type: Number, default: 0 },
    lateFeeFineRate: { type: Number, default: 500 },
    dueDateDay: { type: Number, default: 10 },
  },
  { timestamps: true }
);

export const FeeStructure =
  mongoose.models.FeeStructure || mongoose.model<IFeeStructure>("FeeStructure", FeeStructureSchema);

export interface IFeeChallan extends Document {
  schoolId: mongoose.Types.ObjectId;
  challanNumber: string;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string;
  classId: mongoose.Types.ObjectId;
  className: string;
  sectionName?: string;
  academicSession?: string;
  month: string;
  dueDate: Date;
  previousBalance: number;
  feeBreakdown: {
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
  status: "PAID" | "PENDING" | "OVERDUE" | "PARTIAL" | "VOIDED";
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
    rollNumber: { type: String, required: true },
    admissionNumber: { type: String },
    classId: { type: Schema.Types.ObjectId, ref: "ClassModel", required: true },
    className: { type: String, required: true },
    sectionName: { type: String },
    academicSession: { type: String },
    month: { type: String, required: true },
    dueDate: { type: Date, required: true },
    previousBalance: { type: Number, default: 0 },
    feeBreakdown: {
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
      enum: ["PAID", "PENDING", "OVERDUE", "PARTIAL", "VOIDED"],
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

FeeChallanSchema.index({ schoolId: 1, challanNumber: 1 }, { unique: true });

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
FeePaymentSchema.index({ schoolId: 1, receiptNumber: 1 }, { unique: true });
FeePaymentSchema.index({ schoolId: 1, paidAt: -1 });
export const FeePayment = mongoose.models.FeePayment || mongoose.model<IFeePayment>("FeePayment", FeePaymentSchema);

export interface IExpense extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  category: "Salary" | "Rent" | "Electricity" | "Stationery" | "Maintenance" | "Transport" | "Other";
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
      enum: ["Salary", "Rent", "Electricity", "Stationery", "Maintenance", "Transport", "Other"],
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

export const Expense = mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);
