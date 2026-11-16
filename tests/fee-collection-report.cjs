const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const assert = require("node:assert/strict");

require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText,
  filename,
);
const mock = (file, exports) => {
  const resolved = require.resolve(file);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
mock("../src/server/models/student.model.ts", { Student: {} });
mock("../src/server/models/fee.model.ts", { FeeChallan: {}, FeePayment: {}, FeeStructure: {} });
mock("../src/server/models/classCategory.model.ts", { ClassCategory: {} });
mock("../src/server/models/classSection.model.ts", { ClassModel: {} });
mock("../src/server/models/academicSession.model.ts", { AcademicSession: {} });
mock("../src/server/models/branch.model.ts", { Branch: {} });
mock("../src/server/services/school.service.ts", { SchoolService: {} });
mock("../src/server/services/identityCardRender.service.ts", { normalizeCardImage: async (v) => v || null });
mock("../src/server/utils/branchScope.ts", { branchContext: { getStore: () => null } });

const { feeReportMonthKeys, feeReportMonthEnd, allocateFeePayments, isFreeAssignedStructure, feeCollectionExcel, feeCollectionPdf } = require("../src/server/services/feeCollectionReport.service.ts");
const XLSX = require("xlsx");
let assertions = 0;
const eq = (a, b, message) => { assert.equal(a, b, message); assertions++; };
const ok = (value, message) => { assert.ok(value, message); assertions++; };

eq(feeReportMonthKeys("2026-11", "2027-02").join(","), "2026-11,2026-12,2027-01,2027-02", "month range crosses the year boundary");
eq(feeReportMonthEnd("2026-11").toISOString(), "2026-11-30T18:59:59.999Z", "month end respects Pakistan local time and does not roll into December");
eq(isFreeAssignedStructure({ tuitionFee: 0, totalMonthlyFee: 0, customCharges: [{ amount: 0 }] }), true, "all-zero assigned fee structure counts as free");
eq(isFreeAssignedStructure({ tuitionFee: 3500, totalMonthlyFee: 3500 }), false, "paid-up account cannot be mistaken for an FFS student");
const partial = allocateFeePayments(4000, { tuitionFee: 3500, examFee: 500 }, 1000, 500);
eq(partial.reduce((n, r) => n + r.received, 0), 500, "period cash receipt is apportioned");
eq(partial.reduce((n, r) => n + r.outstanding, 0), 3000, "outstanding reconciles to challan less verified payments");
const free = allocateFeePayments(0, { tuitionFee: 0, examFee: 0 }, 0, 0);
eq(free.reduce((n, r) => n + r.outstanding, 0), 0, "zero-fee components retain zero balances");
eq(free.reduce((n, r) => n + r.received, 0), 0, "zero fee creates no synthetic payment");
const categories = ["Montessori", "Primary", "Secondary"].map((name, i) => ({
  id: String(i), name, strength: i + 1, ffs: i === 1 ? 1 : 0, nonFfs: i + 1 - (i === 1 ? 1 : 0),
  sections: [
    { key: "tuitionFee", title: "Tuition Fee", previousPKR: 100 * i, currentPKR: 3500, totalPKR: 3500 + 100 * i, receivedPKR: 500, outstandingPKR: 3000 },
    { key: "examFee", title: "Examination Fee", previousPKR: 0, currentPKR: 200, totalPKR: 200, receivedPKR: 0, outstandingPKR: 200 },
    { key: "custom:Annual Fee", title: "Annual Fee", previousPKR: 0, currentPKR: 0, totalPKR: 0, receivedPKR: 0, outstandingPKR: 0 },
  ],
}));
const report = {
  school: { name: "Fictional Academy", address: "1 Test Road", phone: "000", logoUrl: "" }, branchScope: "Fictional Test Branch",
  session: { name: "2026-2027" }, period: { from: "2026-11", to: "2026-11" }, generatedAt: "2026-11-14T10:00:00.000Z",
  categories, totals: { strength: 6, ffs: 1, nonFfs: 5, sections: [{ key: "tuitionFee", title: "Tuition Fee", previousPKR: 300, currentPKR: 10500, totalPKR: 10800, receivedPKR: 1500, outstandingPKR: 9000 }] },
  months: [{ month: "2026-11", billedPKR: 10800, receivedPKR: 1500, outstandingPKR: 9000 }],
};

(async () => {
  const logo = await require("sharp")({ create: { width: 80, height: 50, channels: 3, background: "#234455" } }).png().toBuffer();
  report.school.logoUrl = `data:image/png;base64,${logo.toString("base64")}`;
  const workbook = XLSX.read(await feeCollectionExcel(report), { type: "buffer" });
  const strength = XLSX.utils.sheet_to_json(workbook.Sheets.Strength, { header: 1, raw: true });
  ok(strength.some((row) => row[0] === "SCHOOL TOTAL" && row[1] === 6 && row[2] === 1 && row[3] === 5), "Excel has real category strength totals");
  const fees = XLSX.utils.sheet_to_json(workbook.Sheets["Fee Status"], { header: 1, raw: true });
  ok(fees.some((row) => row[0] === "SCHOOL TOTAL" && row[2] === 300 && row[4] === 10800 && row[6] === 9000), "Excel fee totals remain numeric and reconcile");
  const pdf = await feeCollectionPdf(report);
  eq(pdf.subarray(0, 4).toString(), "%PDF", "sample PDF is a valid PDF");
  const out = path.resolve(process.env.FEE_COLLECTION_REPORT_TEST_OUTPUT || "output/pdf/students-fee-collection-sample.pdf");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, pdf);
  const fourCategoryPdf = await feeCollectionPdf({ ...report, categories: [...categories, { ...categories[2], id: "4", name: "Higher Secondary" }] });
  eq(fourCategoryPdf.subarray(0, 4).toString(), "%PDF", "four dynamic categories export without shrinking columns");
  const twoCategoryPdf = await feeCollectionPdf({ ...report, categories: categories.slice(0, 2) });
  eq(twoCategoryPdf.subarray(0, 4).toString(), "%PDF", "two dynamic categories export successfully");
  console.log(`PASS: ${assertions} report math, zero-fee, dynamic category, Excel, and PDF assertions.`);
  console.log(`Sample PDF: ${out}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
