const fs = require("fs");
const ts = require("typescript");
const assert = require("node:assert/strict");

require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText,
  filename,
);
const presentation = require("../src/lib/report-presentation.ts");
const smartPath = require.resolve("../src/server/services/smartReports.service.ts");
require.cache[smartPath] = {
  id: smartPath,
  filename: smartPath,
  loaded: true,
  exports: {
    reportRows: async () => ({}),
    cellValue: (row, path) => presentation.readableReportValue(presentation.reportPathValue(row, path), path),
    safeSpreadsheet: (value) => value,
    csvReport: () => "",
  },
};
const imagePath = require.resolve("../src/server/services/identityCardRender.service.ts");
require.cache[imagePath] = { id: imagePath, filename: imagePath, loaded: true, exports: { normalizeCardImage: async (value) => value } };
const fontPath = require.resolve("../src/server/services/reportFonts.ts");
require.cache[fontPath] = { id: fontPath, filename: fontPath, loaded: true, exports: { registerReportFonts: (doc) => doc } };

const { workbookExport, pdfExport } = require("../src/server/services/reportExport.service.ts");
const XLSX = require("xlsx");

(async () => {
  const groups = ["Montessori Program", "Senior Secondary"].map((category, groupIndex) => {
    const rows = Array.from({ length: 85 }, (_, i) => ({
      studentId: `ST-${groupIndex}-${String(i + 1).padStart(3, "0")}`,
      studentName: `Fictional Student ${groupIndex}-${i + 1}`,
      className: groupIndex ? "Grade 11" : "Grade 2",
      sectionName: i % 2 ? "B" : "A",
      classCategoryName: category,
      totalAmountPKR: groupIndex ? 4000 : 2500,
      admissionDate: new Date("2026-08-15T00:00:00Z"),
    }));
    return { category, count: rows.length, rows, subtotals: { totalAmountPKR: rows.reduce((sum, row) => sum + row.totalAmountPKR, 0) } };
  });
  const report = {
    report: "students",
    title: "Student Directory",
    note: "Fictional category grouping export regression.",
    columns: ["studentId", "studentName", "classCategoryName", "className", "sectionName", "totalAmountPKR", "admissionDate"],
    rows: groups.flatMap((group) => group.rows),
    groups,
    total: 170,
  };

  const workbookBuffer = workbookExport([report], "Fictional school / 2026-08-01 to 2026-08-31");
  const workbook = XLSX.read(workbookBuffer, { type: "buffer", cellDates: true });
  const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets.students, { header: 1, raw: true });
  assert.ok(sheetRows.some((row) => row[0] === "Montessori Program — Student Directory"));
  assert.ok(sheetRows.some((row) => row[0] === "Senior Secondary — Student Directory"));
  const headers = sheetRows[0];
  assert.ok(!headers.includes("Class Category"), "grouped workbook omits the redundant category column");
  assert.ok(headers.includes("Total Fees (PKR)"));
  const grandTotal = sheetRows.find((row) => String(row[0]).startsWith("GRAND TOTAL"));
  assert.equal(grandTotal[headers.indexOf("Total Fees (PKR)")], 552500);
  const dateCell = workbook.Sheets.students["F3"];
  assert.equal(dateCell.t, "d", "workbook date cells remain dates");

  const sharp = require("sharp");
  const png = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#234455" } }).png().toBuffer();
  const logoUrl = `data:image/png;base64,${png.toString("base64")}`;
  const pdf = await pdfExport([report], "Fictional school · 2026-08-01 through 2026-08-31", "Fictional Academy", {
    branding: { logoUrl },
    templates: { "report-card": { showSignatures: false } },
  });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
  assert.ok(pageCount >= 2, `expected category report to paginate, found ${pageCount} pages`);
  console.log("PASS: grouped workbook headings/subtotals/grand total/date cells and branded multi-page PDF generation.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
