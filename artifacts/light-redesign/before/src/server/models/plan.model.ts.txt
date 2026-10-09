import mongoose, { Schema, Document } from "mongoose";
import { SubscriptionPlan } from "../constants/subscription.constant";

export interface IPlan extends Document {
  code: SubscriptionPlan;
  name: string;
  priceMonthlyPKR: number;
  priceAnnualPKR: number;
  description: string;
  features: string[];
  isCustom: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    code: { type: String, enum: Object.values(SubscriptionPlan), required: true, unique: true },
    name: { type: String, required: true },
    priceMonthlyPKR: { type: Number, required: true },
    priceAnnualPKR: { type: Number, required: true },
    description: { type: String, required: true },
    features: [{ type: String }],
    isCustom: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Plan = mongoose.models.Plan || mongoose.model<IPlan>("Plan", PlanSchema);
