const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const PDFDocument = require("pdfkit");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, file);

const { defaultMarksheetPrintSettings, marksheetPrintSettingsSchema } = require("../src/lib/marksheet-print-settings.ts");
const { preprintedMarksheetPdf, sampleMarksheet } = require("../src/server/services/preprintedMarksheetPdf.service.ts");
const { Branch } = require("../src/server/models/branch.model.ts");
const { readMarksheetPrintSettings } = require("../src/server/services/marksheetPrintSettings.service.ts");
const fixture = {
  ...sampleMarksheet("Configured Half-Yearly"),
  school: { name: "Pre-existing school brand", logoUrl: "pre-existing logo", address: "Pre-existing campus footer" },
  view: "ANNUAL",
  components: [{ examId: "first", title: "First Term" }, { examId: "half", title: "Configured Half-Yearly" }],
  rows: [{ name: "Mathematics", scores: [{ obtained: 0, max: 50 }, { isAbsent: true, max: 50 }], total: 0, max: 100, status: "FAILED" }],
  overall: { obtained: 0, max: 100, percentage: 0, grade: "F", status: "FAILED" },
  stationeryDetails: { rank: 2, attendancePercentage: 93, teacherRemarks: "Keep practising.", componentTotals: { first: { obtained: 0, max: 50 } } },
};

async function inspect(settings, sheets, sample = false) {
  const trace = { pages: [], text: [], borders: 0, images: 0 };
  const handlers = {
    addPage: ([options]) => trace.pages.push(options.size),
    text: ([value, x, y]) => trace.text.push({ value, x, y }),
    stroke: () => trace.borders++,
    image: () => trace.images++,
  };
  const originals = {};
  for (const [key, handler] of Object.entries(handlers)) {
    originals[key] = PDFDocument.prototype[key];
    PDFDocument.prototype[key] = function (...args) {
      handler(args);
      return originals[key].apply(this, args);
    };
  }
  try {
    trace.pdf = await preprintedMarksheetPdf(settings, sheets, sample);
    assert.equal(trace.pdf.subarray(0, 5).toString(), "%PDF-");
    return trace;
  } finally { Object.assign(PDFDocument.prototype, originals); }
}

async function main() {
  const values = { ...defaultMarksheetPrintSettings, format: "preprinted" };
  const trace = await inspect(values, [fixture]);
  assert.equal(trace.pages.length, 1);
  assert.ok(Math.abs(trace.pages[0][0] - 210 * 72 / 25.4) < 0.01);
  assert.equal(trace.borders, 0);
  assert.equal(trace.images, 0);
  const all = trace.text.map(run => run.value).join(" ");
  for (const value of ["Sample Student", "Sample Parent", "SAMPLE-01", "Mathematics", "0", "50", "A", "0.00%", "93.00%", "Keep practising."])
  assert.ok(all.includes(value), value);
  assert.doesNotMatch(all, /Pre-existing|Grand total|Subject:/);

  const table = await inspect({ ...values, mode: "table", paper: "Legal", offsetX: 3, offsetY: -4 }, [fixture, fixture]);
  assert.equal(table.pages.length, 2);
  assert.ok(Math.abs(table.pages[0][1] - 1008) < 0.01);
  assert.equal(table.borders, 0, "preprinted output must not draw stationery table borders");
  assert.equal(table.images, 0);
  assert.match(table.text.map(run => run.value).join(" "), /First Term.*Configured Half-Yearly/);
  const position = trace => trace.text.find(run => run.value.includes("Sample Student"));
  assert.ok(Math.abs(position(table).x - position(trace).x - 3 * 72 / 25.4) < 0.01);
  assert.ok(Math.abs(position(table).y - position(trace).y + 4 * 72 / 25.4) < 0.01);
  const sample = await inspect(values, [fixture], true);
  assert.equal(position(trace).y, position(sample).y);
  assert.doesNotMatch(trace.text.map(run => run.value).join(" "), /SAMPLE — TEST PRINT|TEST PRINT/);
  assert.ok(sample.borders >= 5, "alignment test includes calibration marks");
  assert.doesNotMatch(sample.text.map(run => run.value).join(" "), /SAMPLE — TEST PRINT|TEST PRINT/);
  await assert.rejects(() => inspect({ ...values, mode: "table" }, [{ ...fixture, rows: Array.from({ length: 60 }, (_, i) => ({ ...fixture.rows[0], name: "Subject " + i })) }]), error => error.statusCode === 422);
  const landscape = await inspect({ ...values, orientation: "landscape", resultSummary: false, teacherComments: false, signatures: false }, [fixture]);
  assert.ok(Math.abs(landscape.pages[0][0] - 297 * 72 / 25.4) < 0.01);
  assert.ok(Math.abs(landscape.pages[0][1] - 210 * 72 / 25.4) < 0.01);
  const custom = await inspect({ ...values, customPaper: true, pageWidth: 300, pageHeight: 250, orientation: "landscape",
    backgroundImage: "data:image/png;base64,aGVsbG8=" }, [fixture]);
  assert.ok(Math.abs(custom.pages[0][0] - 250 * 72 / 25.4) < 0.01);
  assert.ok(Math.abs(custom.pages[0][1] - 300 * 72 / 25.4) < 0.01);
  assert.equal(custom.images, 0, "editor scan is not embedded in print output");
  const reusable = { id: "d576ac11-7be2-4a1d-a120-d99eeb2af419", name: "Academy template", fields: defaultMarksheetPrintSettings.fields,
    rowStartY: 103, rowHeight: 8, calibrationX: 0, calibrationY: 0, paper: "A4", orientation: "portrait", customPaper: false, pageWidth: 210, pageHeight: 297 };
  assert.equal(marksheetPrintSettingsSchema.safeParse({ ...values, templates: [reusable], activeTemplateId: reusable.id }).success, true);
  assert.equal(marksheetPrintSettingsSchema.safeParse({ ...values, backgroundImage: "javascript:alert(1)" }).success, false);
  const hidden = await inspect({ ...values, studentDetails: false, marksTable: false, teacherComments: false, signatures: false }, [fixture]);
  assert.doesNotMatch(hidden.text.map(run => run.value).join(" "), /Sample Student|Keep practising|Class Teacher|Mathematics/);
  assert.equal(marksheetPrintSettingsSchema.safeParse({ ...values, offsetX: 100 }).success, false);
  assert.equal(marksheetPrintSettingsSchema.safeParse({ ...values, layout: {} }).success, false);

  const original = Branch.findOne;
  const saved = { ...values, paper: "Letter" };
  Branch.findOne = filter => {
    assert.deepEqual(filter, { _id: "branch-A", organizationId: "school-A" });
    return { select: () => ({ lean: async () => ({ marksheetPrintSettings: saved }) }) };
  };
  try {
    assert.deepEqual(await readMarksheetPrintSettings({ branchId: "branch-A", schoolId: "school-A" }), saved);
    assert.equal((await readMarksheetPrintSettings({ branchId: null })).format, "default");
  } finally { Branch.findOne = original; }
  if (process.env.MARKSHEET_TEST_OUTPUT) {
    const out = process.env.MARKSHEET_TEST_OUTPUT;
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(out + "/preprinted-values.pdf", trace.pdf);
    fs.writeFileSync(out + "/preprinted-table.pdf", table.pdf);
  }
  console.log("PASS: saved branch settings, schema, correct values, both output modes, paper and offsets, optional sections and batch pagination.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
