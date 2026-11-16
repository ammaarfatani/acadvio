const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const mock = (file, exports) => { const resolved = require.resolve(file); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports }; };
let branchScope = null;
mock("../src/server/models/student.model.ts", { Student: {} });
mock("../src/server/models/fee.model.ts", { FeeChallan: {}, FeePayment: {} });
mock("../src/server/models/academicSession.model.ts", { AcademicSession: {} });
mock("../src/server/models/classCategory.model.ts", { ClassCategory: {} });
mock("../src/server/models/classSection.model.ts", { ClassModel: {}, SectionModel: {} });
mock("../src/server/models/branch.model.ts", { Branch: {} });
mock("../src/server/services/school.service.ts", { SchoolService: {} });
mock("../src/server/services/identityCardRender.service.ts", { normalizeCardImage: async () => `data:image/png;base64,${fs.readFileSync("public/logo.png").toString("base64")}` });
mock("../src/server/utils/branchScope.ts", { branchContext: { getStore: () => branchScope } });

const { buildFeeCollectionMatrix, feeCollectionMatrixExcel, feeCollectionMatrixPdf, feeCollectionMatrixReport } = require("../src/server/services/feeCollectionMatrixReport.service.ts");
const { Student } = require("../src/server/models/student.model.ts"), { FeeChallan, FeePayment } = require("../src/server/models/fee.model.ts");
const { AcademicSession } = require("../src/server/models/academicSession.model.ts"), { ClassCategory } = require("../src/server/models/classCategory.model.ts");
const { ClassModel, SectionModel } = require("../src/server/models/classSection.model.ts"), { Branch } = require("../src/server/models/branch.model.ts");
const { SchoolService } = require("../src/server/services/school.service.ts");
const catA = { _id: "cat-a", name: "Primary Department", displayOrder: 1 }, catB = { _id: "cat-b", name: "Secondary Department", displayOrder: 2 };
const classes = [{ _id: "class-a", name: "Class 1", classCategoryId: "cat-a" }, { _id: "class-b", name: "Class 8", classCategoryId: "cat-b" }];
const students = [
  { _id: "student-a", studentId: "ST-1001", name: "Fictional A", rollNumber: "01", classId: "class-a", className: "Class 1", sectionName: "A" },
  { _id: "student-b", studentId: "ST-2001", name: "Fictional B", rollNumber: "08", classId: "class-b", className: "Class 8", sectionName: "B" },
];
const challans = [
  { _id: "ch-a", studentId: "student-a", classId: "class-a", className: "Class 1", sectionName: "A", month: "2026-10", feeBreakdown: { tuitionFee: 900, admissionFee: 100, discount: 100 } },
  { _id: "ch-b", studentId: "student-b", classId: "class-b", className: "Class 8", sectionName: "B", month: "November 2026", dueDate: new Date("2026-11-20T00:00:00Z"), feeBreakdown: { tuitionFee: 250 } },
  { _id: "ch-legacy-month", studentId: "student-b", classId: "class-b", className: "Class 8", sectionName: "B", month: "May", dueDate: new Date("2026-05-20T00:00:00Z"), feeBreakdown: { tuitionFee: 30 } },
  { _id: "ch-snapshot-month", studentId: "student-b", classId: "class-b", className: "Class 8", sectionName: "B", month: "legacy-invalid", feeBreakdown: { tuitionFee: 15 } },
  { _id: "ch-invalid-month", studentId: "student-b", classId: "class-b", className: "Class 8", sectionName: "B", month: "legacy-invalid", feeBreakdown: {} },
  { _id: "ch-void", studentId: "student-a", classId: "class-a", className: "Class 1", sectionName: "A", month: "2026-10", isVoided: true, feeBreakdown: { tuitionFee: 999 } },
];
const payments = [
  { _id: "p1", studentId: "student-a", challanId: "ch-a", amountPKR: 600, paidAt: new Date("2026-11-02T00:00:00Z"), rollNumber: "01", studentName: "Fictional A" },
  { _id: "p2", studentId: "student-a", challanId: "ch-a", amountPKR: 400, paidAt: new Date("2026-11-05T00:00:00Z"), receiptNumber: "REC-SYNTH-2", rollNumber: "01", studentName: "Fictional A" },
  { _id: "p2-duplicate", studentId: "student-a", challanId: "ch-a", amountPKR: 400, paidAt: new Date("2026-11-05T00:00:00Z"), receiptNumber: "REC-SYNTH-2", rollNumber: "01", studentName: "Fictional A" },
  { _id: "p3", studentId: "student-a", challanId: "ch-a", amountPKR: 100, paidAt: new Date("2026-11-07T00:00:00Z"), rollNumber: "01", studentName: "Fictional A", documentSnapshot: { paymentAllocation: { admission: 50, annual: 50 } } },
  { _id: "p4", studentId: "student-b", challanId: "ch-b", amountPKR: 250, paidAt: new Date("2026-11-08T00:00:00Z"), rollNumber: "08", studentName: "Fictional B" },
  { _id: "p5", studentId: "student-b", challanId: "ch-invalid-month", amountPKR: 20, paidAt: new Date("2026-11-09T00:00:00Z"), rollNumber: "08", studentName: "Fictional B" },
  { _id: "p6", studentId: "student-b", challanId: "ch-legacy-month", amountPKR: 30, paidAt: new Date("2026-11-10T00:00:00Z"), rollNumber: "08", studentName: "Fictional B" },
  { _id: "p7", studentId: "student-b", challanId: "ch-snapshot-month", amountPKR: 15, paidAt: new Date("2026-11-11T00:00:00Z"), rollNumber: "08", studentName: "Fictional B", documentSnapshot: { month: "2026-09", challan: { month: "2026-09" } } },
  { _id: "p-void", studentId: "student-a", challanId: "ch-void", amountPKR: 999, paidAt: new Date("2026-11-09T00:00:00Z") },
];

(async () => {
  const report = buildFeeCollectionMatrix({
    school: { name: "Fictional Academy", address: "Test Road", phone: "000" }, session: { name: "2026-2027" }, branchScope: "Test Branch", generatedAt: "2026-11-16T00:00:00.000Z",
    students, classes, categories: [catA, catB], challans, payments: payments.filter(payment => payment._id !== "p-void"),
  });
  report.fromDate = "2026-11-01"; report.toDate = "2026-11-30"; report.filters = { classCategory: "All categories" };
  assert.equal(report.grandTotalPKR, 1415);
  assert.equal(report.matrixTotalPKR, 1415);
  assert.equal(report.componentTotalPKR, 1415);
  assert.equal(report.componentReconciliationDifferencePKR, 0);
  assert.equal(report.unallocatedMonthPKR, 20);
  assert.equal(report.reconciliationDifferencePKR, 0);
  assert.equal(report.duplicatePaymentRecords, 1);
  assert.equal(report.categories.length, 2);
  assert.equal(report.categories[0].name, "Primary Department");
  assert.equal(report.categories[0].rows[0].id, "ST-1001");
  assert.equal(report.categories[0].rows[0].rollNumber, "01");
  assert.equal(report.categories[0].rows[0].values.oct, 1100);
  assert.equal(report.categories[0].rows[0].values.discount, 100);
  assert.equal(report.categories[0].rows[0].values.admission, 50);
  assert.equal(report.categories[0].rows[0].values.annual, 50);
  assert.equal(report.categories[0].rows[0].values.total, 1100);
  assert.equal(report.categories[1].rows[0].values.nov, 250);
  assert.equal(report.categories[1].rows[0].values.may, 30, "legacy month names derive year only from linked challan due date");
  assert.equal(report.categories[1].rows[0].values.sep, 15, "saved receipt billing-period snapshot recovers a legacy challan month");
  assert.equal(report.categories[1].rows[0].values.unallocatedMonth, 20);
  assert.equal(report.categories[1].rows[0].values.total, 315);
  assert.equal(report.totals.discount, 100);
  assert.equal(report.totals.total, report.grandTotalPKR);

  const query = value => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value });
  const queryFilters = {};
  AcademicSession.findOne = filter => { queryFilters.session = filter; return query({ _id: "session-a", name: "2026-2027" }); };
  ClassCategory.findOne = () => query(null);
  ClassCategory.find = filter => { queryFilters.categories = filter; return query([catA, catB]); };
  ClassModel.findOne = () => query(null);
  ClassModel.find = filter => { queryFilters.classes = filter; return query(classes); };
  SectionModel.findOne = () => query(null);
  Student.find = filter => { queryFilters.students = filter; return query(students); };
  FeeChallan.find = filter => { queryFilters.challans = filter; return query(challans.filter(challan => !challan.isVoided)); };
  FeePayment.find = filter => { queryFilters.payments = filter; return query(payments.filter(payment => payment._id !== "p-void" && payment._id !== "p2-duplicate")); };
  Branch.exists = filter => { queryFilters.branchValidation = filter; return true; };
  Branch.findOne = filter => { queryFilters.branch = filter; return query({ name: "Test Branch" }); };
  SchoolService.getSchoolProfile = async schoolId => { queryFilters.schoolProfile = schoolId; return { name: "Fictional Academy" }; };
  branchScope = { organizationId: "school-a", branchId: "branch-a", mainBranchId: "branch-a", owner: false };
  const serviceReport = await feeCollectionMatrixReport({ schoolId: "school-a" }, { academicSessionId: "session-a", fromDate: "2026-11-01", toDate: "2026-11-30", branchId: "branch-a" });
  assert.equal(serviceReport.matrixTotalPKR, 1415);
  assert.equal(queryFilters.session.schoolId, "school-a");
  assert.equal(queryFilters.challans.branchId, "branch-a");
  assert.equal(queryFilters.payments.branchId, "branch-a");
  assert.equal(queryFilters.payments.paidAt.$gte.toISOString(), "2026-10-31T19:00:00.000Z");
  assert.equal(queryFilters.payments.paidAt.$lte.toISOString(), "2026-11-30T18:59:59.999Z");
  assert.equal(queryFilters.students.schoolId, "school-a");
  await assert.rejects(() => feeCollectionMatrixReport({ schoolId: "school-a" }, { academicSessionId: "session-a", fromDate: "2026-11-01", toDate: "2026-11-30", branchId: "branch-b" }), error => error.statusCode === 403);
  await assert.rejects(() => feeCollectionMatrixReport({ schoolId: "school-a" }, { academicSessionId: "session-a", fromDate: "2026-02-30", toDate: "2026-03-01" }), error => error.statusCode === 400);
  branchScope = null;

  const workbook = XLSX.read(await feeCollectionMatrixExcel(report), { type: "buffer" });
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets["By Billing Month"], { header: 1, raw: true });
  const components = XLSX.utils.sheet_to_json(workbook.Sheets["By Component"], { header: 1, raw: true });
  assert.ok(matrix.some(row => row[1] === "ST-1001" && row[3] === "Fictional A" && row[12] === 1100));
  assert.ok(matrix.some(row => row[0] === "GRAND TOTAL" && row.at(-1) === 1415));
  assert.ok(components.some(row => row[1] === "ST-1001" && row[3] === "Fictional A" && row.at(-1) === 1100));
  assert.ok(components.some(row => row[0] === "GRAND TOTAL" && row.at(-1) === 1415));
  assert.equal(workbook.SheetNames.includes("Notes"), true);

  const originalAddPage = PDFDocument.prototype.addPage;
  const originalText = PDFDocument.prototype.text;
  let addPageCount = 0, reportHeaders = 0;
  PDFDocument.prototype.addPage = function (options, ...rest) { addPageCount++; return originalAddPage.call(this, options, ...rest); };
  PDFDocument.prototype.text = function (value, ...rest) { if (String(value).includes("Fee Collection Report - Monthly Matrix")) reportHeaders++; return originalText.call(this, value, ...rest); };
  let pdf;
  const longReport = { ...report, categories: [{ ...report.categories[0], rows: Array.from({ length: 100 }, (_, index) => ({ ...report.categories[0].rows[0], key: `row-${index}`, name: `Fictional A ${index}`, values: { ...report.categories[0].rows[0].values } })) }, report.categories[1]] };
  const zeroValues = Object.fromEntries(Object.keys(report.totals).map(key => [key, 0]));
  const sampleRows = [report.categories[0].rows[0], ...Array.from({ length: 25 }, (_, index) => ({
    ...report.categories[0].rows[0], key: `sample-student-${index + 2}`, id: `ST-SYN-${String(index + 2).padStart(4, "0")}`,
    rollNumber: String(index + 2).padStart(2, "0"), name: `Synthetic Student ${String(index + 2).padStart(2, "0")}`, values: { ...zeroValues },
  }))];
  const sampleReport = { ...report, categories: [{ ...report.categories[0], rows: sampleRows, totalStudents: sampleRows.length }, report.categories[1]] };
  try { pdf = await feeCollectionMatrixPdf({ ...report, duplicatePaymentRecords: 0 }); await feeCollectionMatrixPdf(longReport); }
  finally { PDFDocument.prototype.addPage = originalAddPage; PDFDocument.prototype.text = originalText; }
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(addPageCount > 1, "PDF creates a multi-page report with repeated headers");
  assert.ok(reportHeaders > 2, "Each PDF page repeats the report header");
  const out = process.env.FEE_MATRIX_TEST_OUTPUT;
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(out + "/fee-collection-matrix.pdf", await feeCollectionMatrixPdf(sampleReport)); fs.writeFileSync(out + "/fee-collection-matrix.xlsx", await feeCollectionMatrixExcel(report)); }
  console.log("PASS: synthetic categories, actual human IDs, ISO and legacy challan-month mapping, no receipt-month fallback, explicit/unallocated components, independent month/component reconciliations, discounts, duplicate and void exclusions, category totals, school/branch filters, PKT date boundaries, numeric split-sheet Excel and multi-page branded A3 PDF.");
})().catch(error => { console.error(error); process.exitCode = 1; });
