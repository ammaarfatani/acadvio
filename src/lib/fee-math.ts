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
