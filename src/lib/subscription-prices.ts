// Default public catalogue. Stored plan records remain the authority for checkout.
export const DEFAULT_SUBSCRIPTION_PRICES: Record<
  string,
  { monthly: number; annualMonthly: number }
> = {
  STARTER: { monthly: 2000, annualMonthly: 20000 / 12 },
  PROFESSIONAL: { monthly: 4000, annualMonthly: 40000 / 12 },
  ENTERPRISE: { monthly: 8000, annualMonthly: 80000 / 12 },
};
export function annualSavingPercent(monthly: number, annualMonthly: number) {
  return Number.isFinite(monthly) &&
    Number.isFinite(annualMonthly) &&
    monthly > 0 &&
    annualMonthly >= 0 &&
    annualMonthly < monthly
    ? Math.floor(((monthly - annualMonthly) * 100) / monthly)
    : 0;
}
