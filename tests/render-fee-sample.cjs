const fs = require("fs");
const path = require("path");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};
const schoolServicePath = require.resolve("../src/server/services/school.service.ts");
require.cache[schoolServicePath] = { id: schoolServicePath, filename: schoolServicePath, loaded: true, exports: { SchoolService: { getSchoolProfile: async () => ({ name: "Fictional Academy", address: "12 Garden Avenue, Lahore", phone: "+92 300 1234567", bankDetails: { enabled: true, bankName: "Example Bank", accountTitle: "Fictional Academy", accountNumber: "0000000000", iban: "PK00EXAMPLE000000" } }) } } };
const imagePath = require.resolve("../src/server/services/identityCardRender.service.ts");
require.cache[imagePath] = { id: imagePath, filename: imagePath, loaded: true, exports: { normalizeCardImage: async () => "" } };
(async () => {
  const { ChallanPdfService } = require("../src/server/services/challanPdf.service.ts");
  const pdf = await ChallanPdfService.generateStudentChallanPdf("fictional-school", {
    challanNumber: "CH-SAMPLE-2026-001", studentName: "Ayesha Example With An Exceptionally Long Full Name", fatherName: "Guardian Example With A Long Name",
    admissionNumber: "ADM-001", rollNumber: "2-A-014", className: "Class 2", classCategoryName: "Primary",
    sectionName: "A", academicSession: "2026-27", month: "November 2026", dueDate: new Date("2026-11-10"),
    feeStructureTitle: "Concession Fee", totalAmountPKR: 6300, remainingAmountPKR: 6300, status: "PENDING",
    concessionAmount: 500, earlyPaymentDiscount: 50, amountPayableWithEarlyDiscount: 6250,
    amountPayableAfterDueDate: 6400, lateFinePolicyModel: "ONE_TIME", previousBalance: 750,
    feeBreakdown: { tuitionFee: 3500, admissionFee: 1000, examFee: 250, transportFee: 800, libraryFee: 100, computerFee: 250, otherCharges: 150, arrears: 750, discount: 500 },
  });
  const output = path.resolve("artifacts/fee-verification/sample-three-copy-challan.pdf");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, pdf);
  const batch = await ChallanPdfService.generateClassChallanBatchPdf("fictional-school", [
    { challanNumber: "CH-SAMPLE-2026-001", studentName: "Ayesha Example", rollNumber: "2-A-014", className: "Class 2", month: "November 2026", dueDate: new Date("2026-11-10"), totalAmountPKR: 6300, remainingAmountPKR: 6300, amountPayableAfterDueDate: 6400, feeBreakdown: { tuitionFee: 3500, discount: 500 } },
    { challanNumber: "CH-SAMPLE-2026-002", studentName: "Bilal Example", rollNumber: "2-A-015", className: "Class 2", month: "November 2026", dueDate: new Date("2026-11-10"), totalAmountPKR: 2500, remainingAmountPKR: 2500, amountPayableAfterDueDate: 2500, feeBreakdown: { tuitionFee: 2500 } },
  ]);
  fs.writeFileSync(path.resolve("artifacts/fee-verification/sample-bulk-two-challans.pdf"), batch);
  process.stdout.write(output + "\n");
})();
