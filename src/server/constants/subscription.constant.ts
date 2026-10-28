import { DEFAULT_SUBSCRIPTION_PRICES } from "../../lib/subscription-prices";
export enum SubscriptionStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  TRIAL = "TRIAL",
  TRIAL_EXPIRED = "TRIAL_EXPIRED",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum SubscriptionPlan {
  FREE_TRIAL = "FREE_TRIAL",
  STARTER = "STARTER",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
}

export const PLAN_PRICING_PKR: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE_TRIAL]: 0,
  [SubscriptionPlan.STARTER]: DEFAULT_SUBSCRIPTION_PRICES.STARTER.monthly,
  [SubscriptionPlan.PROFESSIONAL]: DEFAULT_SUBSCRIPTION_PRICES.PROFESSIONAL.monthly,
  [SubscriptionPlan.ENTERPRISE]: DEFAULT_SUBSCRIPTION_PRICES.ENTERPRISE.monthly,
};

export const STANDARD_TRIAL_DAYS = 14;
