const ts = require("typescript"),
  fs = require("fs"),
  assert = require("assert/strict");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    f,
  );
const {
  reportColumnLabel,
  readableReportValue,
  displayReportCell,
  reportFilterLabel,
} = require("../src/lib/report-presentation.ts");
let checks = 0;
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
eq(reportColumnLabel("assignments", "teacherUserId"), "Teacher Name");
eq(reportColumnLabel("staffAttendance", "employeeId"), "Staff Name");
eq(reportColumnLabel("staff", "employeeId"), "Employee ID");
eq(reportColumnLabel("payroll", "employeeId"), "Employee ID");
eq(reportColumnLabel("students", "name"), "Student Name");
eq(reportColumnLabel("sessions", "name"), "Academic Session");
eq(
  reportColumnLabel("subjectResults", "subjectScores.obtainedMarks"),
  "Obtained Marks",
);
eq(
  reportColumnLabel("students", "parentInfo.fatherName"),
  "Guardian: Father Name",
);
eq(
  reportColumnLabel("invoices", "remainingAmountPKR"),
  "Outstanding Balance (PKR)",
);
eq(readableReportValue(null, "name"), "Not recorded");
eq(readableReportValue({ private: "hidden" }, "name"), "Not recorded");
eq(readableReportValue(false, "isArchived"), "No");
eq(readableReportValue(0, "amountPKR"), 0);
eq(readableReportValue(1.236, "amountPKR"), 1.24);
eq(
  readableReportValue("2026-10-06T19:29:00.000Z", "assignedAt"),
  "07 Oct 2026, 00:29",
);
eq(readableReportValue("2012-01-02T00:00:00.000Z", "dob"), "02 Jan 2012");
eq(readableReportValue("2026-10-22", "date"), "22 Oct 2026");
eq(readableReportValue("MID_TERM", "term"), "Mid-Term");
eq(readableReportValue("EXAM_STAFF", "userType"), "Examination Staff");
eq(displayReportCell({ amountPKR: 1500 }, "amountPKR"), "1,500.00");
eq(reportFilterLabel("employeeId"), "Staff Member");
console.log(`PASS: ${checks} report presentation checks.`);
