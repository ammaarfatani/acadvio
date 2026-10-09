import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
  amount: { type: Number, required: true },
  plan: { type: String, required: true },
  billingCycle: { type: String, enum: ["monthly", "annual"], required: true },
  paymentMethod: { type: String, default: "Bank Transfer" },
  reference: { type: String, maxlength: 160 },
  account: { type: String, required: true },
  screenshot: { type: Buffer, required: true, select: false },
  screenshotMime: { type: String, required: true },
  screenshotHash: { type: String, required: true },
  status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
  rejectionReason: String,
  reviewDecision: { type: String, enum: ["APPROVED"] },
  reviewOperationId: String,
  reviewLeaseUntil: Date,
  activationComplete: { type: Boolean },
  approvedPeriodStart: Date,
  approvedPeriodEnd: Date,
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
schema.index({ schoolId: 1 }, { unique: true, partialFilterExpression: { status: "PENDING" } });
schema.index({ schoolId: 1, screenshotHash: 1 }, { unique: true });
export const SubscriptionPayment = mongoose.models.SubscriptionPayment || mongoose.model("SubscriptionPayment", schema);

