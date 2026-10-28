const ts = require("typescript"),
  fs = require("fs"),
  assert = require("assert/strict");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    f,
  );
const {
  feeMonth,
  feeMonthVariants,
  invoiceTotals,
  challanPrintGroups,
} = require("../src/lib/fee-math.ts");
let n = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  n++;
};
eq(feeMonth("October 2026"), "2026-10");
eq(feeMonth("2026-10"), "2026-10");
eq(feeMonthVariants("October 2026"), ["2026-10", "October 2026"]);
assert.throws(() => feeMonth("2026-13"));
n++;
eq(
  invoiceTotals([
    { totalAmountPKR: 100, paidAmountPKR: 20, remainingAmountPKR: 80 },
    { totalAmountPKR: 1000, status: "VOIDED" },
    { totalAmountPKR: 0.1, paidAmountPKR: 0, remainingAmountPKR: 0.1 },
    { totalAmountPKR: 0.2, paidAmountPKR: 0, remainingAmountPKR: 0.2 },
  ]),
  { charged: 100.3, paid: 20, pending: 80.3 },
);
const groups = challanPrintGroups(
  Array.from({ length: 10 }, (_, i) => ({
    _id: "invoice" + i,
    studentId: "student" + i,
    status: "PENDING",
  })),
);
eq(groups.length, 10);
eq(groups.flatMap((g) => g.copies).length, 30);
eq(groups[9].invoice.studentId, "student9");
eq(groups[0].copies, ["STUDENT COPY", "BANK COPY", "SCHOOL COPY"]);
assert.throws(() =>
  challanPrintGroups([{ studentId: "same" }, { studentId: "same" }]),
);
n++;
assert.throws(() => challanPrintGroups([{ studentId: "a", isVoided: true }]));
n++;
console.log(
  `PASS: ${n} fee-period, totals, 30-copy grouping and duplicate/void protection checks.`,
);
