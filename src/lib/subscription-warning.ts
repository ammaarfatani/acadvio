export function needsSubscriptionReminder(
  overview:
    | {
        daysRemaining?: number | null;
        isExpired?: boolean;
        accountStatus?: string;
      }
    | null
    | undefined,
): boolean {
  if (!overview) return false;
  return (
    overview.accountStatus === "DEACTIVATED" ||
    overview.isExpired === true ||
    (typeof overview.daysRemaining === "number" &&
      Number.isFinite(overview.daysRemaining) &&
      overview.daysRemaining >= 0 &&
      overview.daysRemaining <= 7)
  );
}
