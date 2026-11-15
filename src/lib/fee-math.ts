const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const moneyRound = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export function feeMonth(value: string) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(value.trim());
  if (m) {
    const i = months.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, "0")}`;
  }
  throw Error("Choose a valid fee month.");
}
export function feeMonthFromRecord(value: unknown, dueDate?: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw) return raw.slice(0, 7);
    return undefined;
  }
  try { return feeMonth(raw); } catch { /* Normalize only known legacy values below. */ }
  const monthNames = months.map((name) => name.toLowerCase());
  const monthIndex = monthNames.findIndex((name) => name === raw.toLowerCase() || name.slice(0, 3) === raw.toLowerCase());
  if (monthIndex < 0) return undefined;
  let contextYear: number | undefined;
  if (dueDate instanceof Date && Number.isFinite(dueDate.getTime())) contextYear = dueDate.getUTCFullYear();
  else if (typeof dueDate === "string") {
    const datePart = /^\d{4}-\d{2}-\d{2}/.exec(dueDate)?.[0];
    if (datePart) {
      const date = new Date(`${datePart}T00:00:00.000Z`);
      if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === datePart) contextYear = date.getUTCFullYear();
    }
  }
  return contextYear ? `${contextYear}-${String(monthIndex + 1).padStart(2, "0")}` : undefined;
}
export function feeMonthLabel(value: string) {
  const key = feeMonth(value);
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}
export function feeMonthVariants(value: string) {
  const key = feeMonth(value),
    [year, month] = key.split("-");
  return [key, `${months[Number(month) - 1]} ${year}`];
}
export function invoiceTotals(rows: any[]) {
  return rows
    .filter((r) => !r.isVoided && r.status !== "VOIDED")
    .reduce(
      (t, r) => ({
        charged: moneyRound(t.charged + Number(r.totalAmountPKR || 0)),
        paid: moneyRound(t.paid + Number(r.paidAmountPKR || 0)),
        pending: moneyRound(t.pending + Number(r.remainingAmountPKR || 0)),
      }),
      { charged: 0, paid: 0, pending: 0 },
    );
}

export function challanPrintGroups(invoices: any[]) {
  const students = new Set<string>();
  return invoices.map((invoice) => {
    const id = String(invoice.studentId?._id || invoice.studentId || "");
    if (
      !id ||
      students.has(id) ||
      invoice.isVoided ||
      invoice.status === "VOIDED"
    )
      throw Error(
        "Choose one active saved challan per student before printing.",
      );
    students.add(id);
    return { invoice, copies: ["STUDENT COPY", "BANK COPY", "SCHOOL COPY"] };
  });
}
