const ts = require("typescript"),
  fs = require("fs"),
  assert = require("assert/strict");
require.extensions[".tsx"] = require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const {
  marksheetPdf,
  bulkMarksheetPdf,
} = require("../src/server/services/marksheetPdf.service.ts");
const fixture = (id, count = 8) => ({
  school: { name: "Test School" },
  student: {
    name: `Test Student ${id}`,
    studentId: `TEST-${id}`,
    academicSessionName: "2026–2027",
    className: "Class 1",
    sectionName: "A",
    rollNumber: String(id),
  },
  view: "ANNUAL",
  policy: { method: "CUMULATIVE", legacy: false },
  overall: {
    complete: true,
    status: "PASSED",
    percentage: 75,
    obtained: count * 75,
    max: count * 100,
    grade: "B",
  },
  components: [{ title: "Mid-Term", examId: "test" }],
  rows: Array.from({ length: count }, (_, i) => ({
    subjectId: String(i),
    name: `Subject ${i + 1}`,
    total: 75,
    max: 100,
    scores: [{ obtained: 75, max: 100 }],
    percentage: 75,
    grade: "B",
    status: "PASSED",
  })),
});
(async () => {
  const out = "artifacts/print-regression";
  fs.mkdirSync(out, { recursive: true });
  const single = await marksheetPdf(fixture(1));
  assert.equal(single.subarray(0, 5).toString(), "%PDF-");
  fs.writeFileSync(`${out}/single.pdf`, single);
  const bulk = await bulkMarksheetPdf([fixture(1), fixture(2), fixture(3, 35)]);
  assert.equal(bulk.subarray(0, 5).toString(), "%PDF-");
  fs.writeFileSync(`${out}/class.pdf`, bulk);
  const sharp = require("sharp");
  const image =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 120, height: 150, channels: 3, background: "#d8dce0" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
  for (const count of [7, 8, 9, 12]) {
    const data = fixture(count, count);
    data.photo = image;
    data.school.signature = image;
    data.school.stamp = image;
    data.components = [
      { title: "Mid-Term", examId: "mid" },
      { title: "Final Term", examId: "final" },
    ];
    data.rows.forEach((row) => {
      row.scores = [
        { obtained: 35, max: 50 },
        { obtained: 40, max: 50 },
      ];
    });
    fs.writeFileSync(`${out}/subjects-${count}.pdf`, await marksheetPdf(data));
  }
  fs.writeFileSync(
    `${out}/bulk-nine.pdf`,
    await bulkMarksheetPdf([fixture(91, 9), fixture(92, 9), fixture(93, 9)]),
  );
  // Render the real React marksheet with its real provider into a static QA fixture.
  const Module = require("module"),
    path = require("path"),
    original = Module._resolveFilename;
  Module._resolveFilename = function (name, ...args) {
    return original.call(
      this,
      name.startsWith("@/") ? path.resolve("src", name.slice(2)) : name,
      ...args,
    );
  };
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  const { AuthProvider } = require("../src/lib/auth-context.tsx");
  const AnnualMarksheet =
    require("../src/components/AnnualMarksheet.tsx").default;
  const html = renderToStaticMarkup(
    React.createElement(
      AuthProvider,
      null,
      React.createElement(AnnualMarksheet, {
        data: fixture(9, 9),
        inline: true,
      }),
    ),
  );
  assert(!html.includes("Included:"));
  assert(!html.includes("Missing marks are not zero"));
  assert(html.includes('data-has-signature-images="false"'));
  fs.writeFileSync(
    `${out}/nine-subjects.html`,
    '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/qa.css"><link rel="stylesheet" href="/documents.css"><style>body{margin:0;background:#e5e5e5;padding:20px}.marksheet-preview{width:794px;margin:auto}.school-document{padding:45px!important}.no-print{display:none!important}</style></head><body>' +
      html +
      "</body></html>",
  );
  await assert.rejects(() => bulkMarksheetPdf([]), /No marksheets/);
  console.log(
    "PASS: Single, multi-student, long marksheet PDFs generated; empty class rejected. No database accessed.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
