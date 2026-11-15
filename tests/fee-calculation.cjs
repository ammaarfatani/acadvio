const ts = require("typescript");
const fs = require("fs");
const assert = require("assert/strict");

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
};

const { FeeCalculationService } = require("../src/server/services/feeCalculation.service.ts");
const evaluate = FeeCalculationService.evaluateCurrentPayable;
const dueDate = new Date("2026-11-10T12:00:00.000Z");
const date = (day, hour = 12) => new Date(Date.UTC(2026, 10, day, hour));
const base = { totalAmountPKR: 3500, remainingAmountPKR: 3500, paidAmountPKR: 0, dueDate, lateFineStages: [] };
let assertions = 0;
const eq = (actual, expected) => { assert.equal(actual, expected); assertions++; };

eq(evaluate({ ...base, lateFinePolicyModel: "DISABLED" }, date(12)).payableAmount, 3500);
eq(evaluate({ ...base, lateFinePolicyModel: "ONE_TIME", lateFeePolicyAmount: 125 }, date(12)).lateFineApplied, 125);
const fixed = { ...base, lateFinePolicyModel: "RECURRING", lateFeeFinePolicy: { type: "FIXED", dailyRate: 10, graceDays: 1, maxFineCap: 50 } };
eq(evaluate(fixed, date(11)).lateFineApplied, 0);
eq(evaluate(fixed, date(12)).lateFineApplied, 10);
eq(evaluate(fixed, date(18)).lateFineApplied, 50);
eq(evaluate({ ...fixed, remainingAmountPKR: 2000, paidAmountPKR: 1500 }, date(12)).payableAmount, 2010);
const percent = { ...base, lateFinePolicyModel: "RECURRING", remainingAmountPKR: 1750, paidAmountPKR: 1750, lateFeeFinePolicy: { type: "PERCENTAGE", dailyRate: 1, graceDays: 0, maxFineCap: 100 } };
eq(evaluate(percent, date(12)).lateFineApplied, 35);
eq(evaluate({ ...base, lateFinePolicyModel: "STAGES", lateFineStages: [{ deadlineDate: date(15), fineAmount: 100 }, { deadlineDate: date(20), fineAmount: 200 }] }, date(16)).lateFineApplied, 200);
eq(evaluate({ ...base, lateFinePolicyModel: "STAGES", lateFineStages: [{ deadlineDate: date(15), fineAmount: 100 }, { deadlineDate: date(20), fineAmount: 200 }] }, date(21)).lateFineApplied, 200);
eq(evaluate({ ...base, lateFinePolicyModel: "RECURRING", lateFineWaivedAt: date(12), lateFeeFinePolicy: { dailyRate: 20, maxFineCap: 100 } }, date(14)).lateFineApplied, 0);
const localDate = (day, hour = 12) => new Date(`2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00+05:00`);
const earlyBase = { ...base, dueDate: localDate(20) };
eq(evaluate({ ...earlyBase, earlyPaymentDeadline: localDate(11), earlyPaymentDiscount: 50 }, localDate(11, 23)).payableAmount, 3450);
eq(evaluate({ ...earlyBase, earlyPaymentDeadline: localDate(11), earlyPaymentDiscount: 50 }, localDate(12)).payableAmount, 3500);
eq(evaluate({ ...earlyBase, remainingAmountPKR: 2000, paidAmountPKR: 1500, earlyPaymentDeadline: localDate(11), earlyPaymentDiscount: 50 }, localDate(11)).payableAmount, 2000);
console.log(`PASS: ${assertions} fee calculation date, fine, waiver, discount, and partial balance assertions.`);
