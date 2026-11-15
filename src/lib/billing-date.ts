const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i;
const MONTH = /^(\d{4})-(\d{2})$/;

function validCalendarDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
}

export function isStrictBillingDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const month = MONTH.exec(value);
  if (month) return validCalendarDate(Number(month[1]), Number(month[2]), 1);
  const match = DATE.exec(value) || ISO_DATE_TIME.exec(value);
  if (!match || !validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) return false;
  return !ISO_DATE_TIME.test(value) || Number.isFinite(Date.parse(value));
}

/** Returns a school-local calendar date key, without converting through local/UTC timezones. */
export function normalizeBillingDate(value: unknown, fallbackMonth?: string): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error("Choose a valid billing date.");
    const y = value.getUTCFullYear(), m = value.getUTCMonth() + 1, d = value.getUTCDate();
    if (!validCalendarDate(y, m, d)) throw new Error("Choose a valid billing date.");
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const input = value.trim();
    const month = MONTH.exec(input);
    if (month && validCalendarDate(Number(month[1]), Number(month[2]), 1)) return `${month[1]}-${month[2]}-01`;
    if (isStrictBillingDateString(input)) return input.slice(0, 10);
    throw new Error("Choose a valid billing date.");
  }
  if (value === undefined || value === null) {
    if (typeof fallbackMonth === "string") {
      const month = MONTH.exec(fallbackMonth);
      if (month && validCalendarDate(Number(month[1]), Number(month[2]), 1)) return `${month[1]}-${month[2]}-01`;
    }
    throw new Error("Choose a valid billing date.");
  }
  throw new Error("Choose a valid billing date.");
}

export function billingDateAsUtcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
