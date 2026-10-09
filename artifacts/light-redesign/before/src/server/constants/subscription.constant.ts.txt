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
  [SubscriptionPlan.STARTER]: 4999,
  [SubscriptionPlan.PROFESSIONAL]: 9999,
  [SubscriptionPlan.ENTERPRISE]: 19999,
};

export const STANDARD_TRIAL_DAYS = 14;
