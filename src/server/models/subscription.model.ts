import mongoose, { Schema, Document } from "mongoose";
import { SubscriptionPlan, SubscriptionStatus } from "../constants/subscription.constant";

export interface ISubscription extends Document {
  schoolId: mongoose.Types.ObjectId;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  price: number;
  billingCycle: "monthly" | "annual";
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  expiryReminderClaims?: string[];
  cancelAtPeriodEnd: boolean;
  paymentStatus: "UNPAID" | "PAID" | "FAILED";
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, unique: true, index: true },
    plan: { type: String, enum: Object.values(SubscriptionPlan), required: true },
    status: { type: String, enum: Object.values(SubscriptionStatus), required: true },
    price: { type: Number, required: true },
    billingCycle: { type: String, enum: ["monthly", "annual"], default: "monthly" },
    trialStartedAt: { type: Date },
    trialEndsAt: { type: Date },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    expiryReminderClaims: {type:[String],default:[]},
    cancelAtPeriodEnd: { type: Boolean, default: false },
    paymentStatus: { type: String, enum: ["UNPAID", "PAID", "FAILED"], default: "UNPAID" },
  },
  { timestamps: true }
);

export const Subscription =
  mongoose.models.Subscription || mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
