if (
  !/^mongodb:\/\/(127\.0\.0\.1|localhost):27018\//.test(
    process.env.MONGODB_URI || "",
  )
)
  throw Error("Only isolated local MongoDB 27018 is permitted");
const fs = require("fs"),
  ts = require("typescript"),
  crypto = require("crypto"),
  assert = require("assert/strict");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
require("../src/server/utils/email.util.ts").sendEmailNotification = async () =>
  true;
const mongoose = require("mongoose"),
  { createApp } = require("../src/server/app.ts"),
  { School } = require("../src/server/models/school.model.ts"),
  { User } = require("../src/server/models/user.model.ts"),
  { Role } = require("../src/server/models/role.model.ts"),
  { Student } = require("../src/server/models/student.model.ts"),
  {
    FeePayment,
    FeeChallan,
    Expense,
  } = require("../src/server/models/fee.model.ts"),
  {
    StudentAttendance,
    TeacherAttendance,
  } = require("../src/server/models/attendance.model.ts"),
  {
    StaffAttendance,
    StaffEmployment,
    BiometricPunch,
  } = require("../src/server/models/workforce.model.ts"),
  { ProcessedResult } = require("../src/server/models/exam.model.ts"),
  { AuditLog } = require("../src/server/models/auditLog.model.ts"),
  {
    ROLE_PERMISSION_MAP,
  } = require("../src/server/constants/permissions.constant.ts"),
  {
    migrateBranchScopes,
  } = require("../src/server/services/branchMigration.service.ts"),
  { hashPassword } = require("../src/server/utils/password.util.ts"),
  { generateAccessToken } = require("../src/server/utils/jwt.util.ts"),
  { Branch } = require("../src/server/models/branch.model.ts");
const dbName = "acadivo_reports_test_" + crypto.randomBytes(5).toString("hex");
let server,
  checks = 0;
const eq = (a, b, l) => {
  assert.deepEqual(a, b, l);
  checks++;
};
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Connected isolated local database; initializing indexes.");
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    const role = await Role.create({
        name: "Admin",
        code: "ROLE_SCHOOL_ADMIN",
        userType: "SCHOOL_ADMIN",
        permissions: ROLE_PERMISSION_MAP.SCHOOL_ADMIN,
        isSystemRole: true,
      }),
      teacherRole = await Role.create({
        name: "Teacher",
        code: "ROLE_TEACHER",
        userType: "TEACHER",
        permissions: ROLE_PERMISSION_MAP.TEACHER,
        isSystemRole: true,
      });
    const schools = [];
    for (let i = 0; i < 2; i++)
      schools.push(
        await School.create({
          name: "Disposable Report School " + i,
          code: "reports" + i,
          slug: "reports" + i,
          email: `school${i}@example.invalid`,
          phone: "03000000000",
          address: "Local only",
          plan: "ENTERPRISE",
          status: "ACTIVE",
          studentCountRange: "1-200",
          teacherCount: 0,
        }),
      );
    const hash = await hashPassword(crypto.randomBytes(10).toString("hex")),
      admin = await User.create({
        schoolId: schools[0]._id,
        name: "Practice admin",
        email: "reportsadmin@example.invalid",
        passwordHash: hash,
        userType: "SCHOOL_ADMIN",
        roleId: role._id,
        status: "ACTIVE",
      }),
      teacher = await User.create({
        schoolId: schools[0]._id,
        name: "Practice teacher",
        email: "reportsteacher@example.invalid",
        passwordHash: hash,
        userType: "TEACHER",
        roleId: teacherRole._id,
        status: "ACTIVE",
      });
    await migrateBranchScopes();
    const branch = await Branch.create({
        organizationId: schools[0]._id,
        name: "Second",
        code: "second",
        address: "Local only",
        phone: "03000000000",
        status: "ACTIVE",
      }),
      schoolId = schools[0]._id,
      studentId = new mongoose.Types.ObjectId(),
      classId = new mongoose.Types.ObjectId();
    const stamp = { schoolId, organizationId: schoolId, branchId: schoolId },
      date = new Date("2026-10-10T05:00:00Z");
    await Student.collection.insertMany([
      {
        ...stamp,
        _id: studentId,
        studentId: "STUD001",
        admissionNumber: "ADM001",
        name: '=HYPERLINK("https://example.invalid")',
        className: "Grade 5",
        classId,
        status: "ACTIVE",
        admissionDate: date,
        parentInfo: {
          fatherName: "Practice guardian",
          guardianEmail: "guardian@example.invalid",
        },
      },
      {
        ...stamp,
        branchId: branch._id,
        studentId: "STUD002",
        admissionNumber: "ADM002",
        name: "Other branch child",
        status: "ACTIVE",
        admissionDate: date,
      },
      {
        schoolId: schools[1]._id,
        branchId: schools[1]._id,
        studentId: "STUD003",
        admissionNumber: "ADM003",
        name: "Other school child",
        admissionDate: date,
      },
    ]);
    await FeePayment.collection.insertMany([
      {
        ...stamp,
        studentId,
        studentName: "Practice child",
        amountPKR: 600,
        paymentMethod: "Cash",
        paidAt: date,
        receiptNumber: "R1",
      },
      {
        ...stamp,
        studentId,
        studentName: "Practice child",
        amountPKR: 200,
        paymentMethod: "Online",
        paidAt: new Date("2026-09-20"),
        receiptNumber: "R0",
      },
      {
        ...stamp,
        branchId: branch._id,
        amountPKR: 9000,
        paidAt: date,
        receiptNumber: "OTHER",
      },
    ]);
    await FeeChallan.collection.insertMany([
      {
        ...stamp,
        studentId,
        studentName: "Practice child",
        challanNumber: "C1",
        remainingAmountPKR: 1200,
        totalAmountPKR: 1800,
        createdAt: date,
        isVoided: false,
      },
      {
        ...stamp,
        studentId,
        challanNumber: "VOID",
        remainingAmountPKR: 5000,
        createdAt: date,
        isVoided: true,
      },
    ]);
    await Expense.collection.insertMany([
      {
        ...stamp,
        title: "Practice rent",
        amountPKR: 300,
        category: "Rent",
        expenseDate: date,
        isVoided: false,
      },
      {
        ...stamp,
        title: "Void",
        amountPKR: 900,
        category: "Other",
        expenseDate: date,
        isVoided: true,
      },
    ]);
    await StudentAttendance.collection.insertOne({
      ...stamp,
      date,
      classId,
      className: "Grade 5",
      records: [
        { studentId, studentName: "Practice child", status: "PRESENT" },
        {
          studentId: new mongoose.Types.ObjectId(),
          studentName: "Second practice child",
          status: "LATE",
        },
        {
          studentId: new mongoose.Types.ObjectId(),
          studentName: "Third practice child",
          status: "ABSENT",
        },
      ],
    });
    await StaffAttendance.collection.insertOne({
      ...stamp,
      employeeId: teacher._id,
      date: "2026-10-10",
      source: "MANUAL",
      status: "PRESENT",
    });
    await BiometricPunch.collection.insertOne({
      ...stamp,
      isDemo: true,
      eventId: "DEMO",
      employeeId: teacher._id,
      timestamp: date,
      demoAttendance: { status: "PRESENT" },
    });
    await ProcessedResult.collection.insertMany([
      {
        ...stamp,
        studentId,
        examId: new mongoose.Types.ObjectId(),
        examTitle: "Midterm",
        percentage: 75,
        subjectScores: [
          {
            subjectName: "Mathematics",
            maxMarks: 100,
            obtainedMarks: 75,
            grade: "B",
            isAbsent: false,
          },
        ],
        isPublished: true,
        needsProcessing: false,
        status: "PASSED",
        publishedAt: date,
      },
      {
        ...stamp,
        studentId,
        examId: new mongoose.Types.ObjectId(),
        examTitle: "Pending",
        percentage: null,
        isPublished: true,
        status: "PENDING",
        publishedAt: date,
      },
      {
        ...stamp,
        studentId,
        examId: new mongoose.Types.ObjectId(),
        examTitle: "Stale",
        percentage: 30,
        isPublished: true,
        needsProcessing: true,
        status: "FAILED",
        publishedAt: date,
      },
    ]);
    await TeacherAttendance.collection.insertOne({
      ...stamp,
      date,
      records: [
        {
          teacherUserId: teacher._id,
          teacherName: "Practice teacher",
          status: "LATE",
        },
      ],
    });
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base =
      "http://127.0.0.1:" + server.address().port + "/api/smart-reports";
    const token = (u) =>
      generateAccessToken({
        userId: String(u._id),
        email: u.email,
        userType: u.userType,
        schoolId: String(u.schoolId),
        tokenVersion: u.tokenVersion || 0,
      });
    const call = async (path, body, options = {}) => {
      const response = await fetch(base + path, {
        method: options.method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          ...(options.noAuth
            ? {}
            : { Authorization: "Bearer " + (options.token || token(admin)) }),
          "X-Acadivo-Branch": options.branch || String(schoolId),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      let json;
      try {
        json = JSON.parse(raw);
      } catch {}
      return {
        status: response.status,
        data: json?.data,
        body: json,
        raw,
        headers: response.headers,
      };
    };
    const filters = { from: "2026-10-01", to: "2026-10-31" },
      selection = { report: "students", columns: ["name", "studentId"] },
      request = { filters, selections: [selection] };
    eq(
      (await call("/catalogue", null, { noAuth: true })).status,
      401,
      "auth required",
    );
    eq(
      (await call("/catalogue", null, { token: token(teacher) })).status,
      403,
      "teacher denied",
    );
    const catalogue = await call("/catalogue");
    eq(catalogue.status, 200, "admin catalogue");
    eq(
      (
        await call("/preview", {
          filters,
          selections: catalogue.data.reports.map((r) => ({
            report: r.key,
            columns: r.columns,
          })),
        })
      ).status,
      200,
      "all available report sections can be combined",
    );
    eq(
      catalogue.headers.get("cache-control"),
      "private, no-store",
      "private no-store",
    );
    eq(
      catalogue.data.reports.some((r) => r.key === "staffAttendance"),
      true,
      "real workforce permission",
    );
    let preview = await call("/preview", request);
    eq(preview.status, 200, "preview");
    eq(preview.data.reports[0].total, 1, "tenant and branch isolation");
    eq(preview.data.reports[0].rows[0].studentId, "STUD001", "correct student");
    eq(
      preview.data.reports[0].rows[0].passwordHash,
      undefined,
      "secrets absent",
    );
    eq(
      (
        await call("/preview", {
          ...request,
          selections: [{ report: "staff", columns: ["passwordHash"] }],
        })
      ).status,
      400,
      "unknown columns denied",
    );
    eq(
      (
        await call("/preview", {
          ...request,
          filters: { ...filters, schoolId: String(schools[1]._id) },
        })
      ).status,
      400,
      "tenant override rejected",
    );
    eq(
      (
        await call("/preview", {
          ...request,
          filters: { from: "2020-01-01", to: "2026-10-31" },
        })
      ).status,
      400,
      "date cap",
    );
    eq(
      (
        await call("/preview", {
          ...request,
          filters: { ...filters, category: "Salary" },
        })
      ).status,
      400,
      "unsupported filter never ignored",
    );
    preview = await call("/preview", {
      filters: { ...filters, studentId: String(studentId) },
      selections: [
        {
          report: "attendance",
          columns: ["records.studentName", "records.status"],
        },
      ],
    });
    eq(preview.data.reports[0].total, 1, "nested child attendance isolated");
    const dashboard = await call("/intelligence", { filters });
    eq(dashboard.status, 200, "dashboard");
    const metrics = dashboard.data.metrics;
    eq(
      metrics.find((m) => m.key === "collections").current,
      600,
      "collections actual ledger",
    );
    eq(
      metrics.find((m) => m.key === "expenses").current,
      300,
      "void expenses excluded",
    );
    eq(
      metrics.find((m) => m.key === "net").current,
      300,
      "net no double deduction",
    );
    eq(
      metrics.find((m) => m.key === "outstanding").current,
      1200,
      "void invoices excluded",
    );
    eq(
      Math.round(metrics.find((m) => m.key === "attendance").current),
      67,
      "late attended and unknown days excluded",
    );
    eq(
      dashboard.data.charts.find((c) => c.report === "staffAttendance").data[0]
        .value,
      1,
      "DEMO punches excluded",
    );
    eq(
      dashboard.data.charts.find((c) => c.report === "results").data,
      [{ label: "PASSED", value: 1 }],
      "pending stale results excluded",
    );
    const subjectPreview = await call("/preview", {
      filters: { ...filters, studentId: String(studentId) },
      selections: [
        {
          report: "subjectResults",
          columns: ["subjectScores.subjectName", "subjectScores.obtainedMarks"],
        },
      ],
    });
    eq(subjectPreview.status, 200, "subject marks preview");
    eq(
      subjectPreview.data.reports[0].rows[0].subjectScores,
      { subjectName: "Mathematics", obtainedMarks: 75 },
      "actual subject-level marks retained",
    );
    const legacyPreview = await call("/preview", {
      filters,
      selections: [
        {
          report: "legacyTeacherAttendance",
          columns: ["records.teacherName", "records.status"],
        },
        { report: "staffAttendance", columns: ["status"] },
      ],
    });
    eq(
      legacyPreview.data.reports.map((r) => r.total),
      [1, 1],
      "legacy and workforce registers remain separately available without double counting",
    );
    const csv = await call("/export", { ...request, formats: ["csv"] });
    eq(csv.status, 200, "CSV download");
    eq(
      csv.raw.toString().includes("\"'=HYPERLINK"),
      true,
      "formula injection neutralized",
    );
    eq(
      csv.headers.get("cache-control"),
      "private, no-store",
      "download private",
    );
    const xlsx = await call("/export", { ...request, formats: ["xlsx"] });
    eq(xlsx.status, 200, "xlsx download");
    const XLSX = require("xlsx"),
      workbook = XLSX.read(xlsx.raw, { type: "buffer" });
    eq(workbook.SheetNames.includes("students"), true, "real worksheet");
    eq(workbook.Sheets.students.A2.f, undefined, "no formula cell");
    eq(workbook.Sheets.students["!autofilter"].ref, "A1:B2", "autofilter");
    const pdf = await call("/export", { ...request, formats: ["pdf"] });
    eq(pdf.status, 200, "PDF download");
    eq(pdf.raw.subarray(0, 5).toString(), "%PDF-", "real PDF bytes");
    eq(
      (pdf.raw.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
      1,
      "no extra blank footer page",
    );
    fs.mkdirSync("artifacts/smart-reports", { recursive: true });
    fs.writeFileSync("artifacts/smart-reports/practice-report.pdf", pdf.raw);
    const zip = await call("/export", { ...request, formats: ["csv", "xlsx"] });
    eq(zip.status, 200, "ZIP download");
    eq(zip.raw.readUInt32LE(0), 0x04034b50, "ZIP format");
    fs.writeFileSync("artifacts/smart-reports/practice-reports.zip", zip.raw);
    eq(
      (
        await call("/student/" + new mongoose.Types.ObjectId() + "/export", {
          ...request,
          formats: ["xlsx"],
        })
      ).status,
      404,
      "unknown child denied",
    );
    eq(
      (
        await call("/student/" + studentId + "/export", {
          filters,
          selections: [{ report: "staff", columns: ["name"] }],
          formats: ["xlsx"],
        })
      ).status,
      400,
      "child export cannot include staff",
    );
    const preset = await call("/presets", {
      name: "Monthly practice",
      configuration: request,
    });
    eq(preset.status, 200, "preset saved");
    eq((await call("/presets")).data.length, 1, "preset scoped list");
    eq(
      (await call("/presets/" + preset.data._id, null, { method: "DELETE" }))
        .status,
      200,
      "preset deleted",
    );
    const action = await call(
      "/actions/low-attendance",
      {
        status: "IN_PROGRESS",
        notes: "Review practice registers",
        reviewDate: "2026-11-01",
      },
      { method: "PUT" },
    );
    eq(action.status, 200, "action saved");
    eq(
      (await call("/actions")).data[0].status,
      "IN_PROGRESS",
      "action persisted",
    );
    eq(
      (
        await call(
          "/actions/not-a-rule",
          { status: "COMPLETED" },
          { method: "PUT" },
        )
      ).status,
      400,
      "unknown action rejected",
    );
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_MODEL;
    delete process.env.OPENAI_MODEL;
    eq(
      (await call("/intelligence/interpret", { filters })).status,
      503,
      "AI unavailable honest fallback",
    );
    const assistant = require("../src/server/services/assistant.service.ts");
    let providerCalls = 0;
    assistant.configuredCompletion = async (messages) => {
      providerCalls++;
      const payload = JSON.parse(messages[1].content);
      eq(
        JSON.stringify(payload).includes("HYPERLINK"),
        false,
        "no student name sent to AI",
      );
      eq(
        JSON.stringify(payload).includes("guardian@example.invalid"),
        false,
        "no contact sent to AI",
      );
      return {
        content: JSON.stringify({
          summary: "Review the recorded attendance evidence.",
          recommendations: [
            {
              priority: "MEDIUM",
              evidence: "Attendance needs review.",
              hypothesis: "Register completeness may need checking.",
              action: "Review the source registers.",
              measurement: "Review marked entries next week.",
            },
          ],
        }),
      };
    };
    eq(
      (await call("/intelligence/interpret", { filters })).status,
      200,
      "valid structured AI",
    );
    eq(
      (await call("/intelligence/interpret", { filters })).data.cached,
      true,
      "AI cache reused",
    );
    eq(providerCalls, 1, "provider invoked once for identical evidence");
    assistant.configuredCompletion = async () => ({
      content: '{"invented":true}',
    });
    eq(
      (
        await call("/intelligence/interpret", {
          filters,
          settings: { lowAttendance: 70 },
        })
      ).status,
      502,
      "invalid AI schema rejected",
    );
    assistant.configuredCompletion = async () => {
      throw { statusCode: 502, message: "Secret provider error" };
    };
    const failed = await call("/intelligence/interpret", {
      filters,
      settings: { lowAttendance: 60 },
    });
    eq(failed.status, 502, "provider failure safe fallback");
    eq(
      failed.body.message.includes("Secret"),
      false,
      "provider details not exposed",
    );
    eq(
      (
        await call("/intelligence", {
          filters: { ...filters, to: "2030-01-01" },
        })
      ).status,
      400,
      "oversized dates rejected",
    );
    eq(
      (
        await call("/preview", {
          ...request,
          selections: [selection, selection],
        })
      ).status,
      400,
      "duplicate report rejected",
    );
    const duplicateColumns = await call("/preview", {
      ...request,
      selections: [{ report: "students", columns: ["name", "name"] }],
    });
    eq(duplicateColumns.status, 400, "duplicate columns rejected");
    const options = await call("/options?field=studentId&search=HYPERLINK");
    eq(options.status, 200, "searchable student options");
    await StaffEmployment.collection.insertOne({
      ...stamp,
      userId: teacher._id,
      employeeId: teacher.employeeId,
      department: "Academics",
      createdAt: date,
      status: "ACTIVE",
    });
    // Relationship regression coverage uses only this disposable localhost database.
    const {
      ClassModel,
      SectionModel,
    } = require("../src/server/models/classSection.model.ts");
    const { Subject } = require("../src/server/models/subject.model.ts");
    const {
      AcademicSession,
    } = require("../src/server/models/academicSession.model.ts");
    const {
      TeachingAssignment,
    } = require("../src/server/models/teacherProfile.model.ts");
    const sectionId = new mongoose.Types.ObjectId(),
      subjectId = new mongoose.Types.ObjectId(),
      sessionId = new mongoose.Types.ObjectId();
    await ClassModel.collection.insertOne({
      ...stamp,
      _id: classId,
      name: "Grade 5",
      createdAt: date,
    });
    await SectionModel.collection.insertOne({
      ...stamp,
      _id: sectionId,
      classId,
      name: "A",
      createdAt: date,
    });
    await Subject.collection.insertOne({
      ...stamp,
      _id: subjectId,
      classId,
      name: "Mathematics",
      createdAt: date,
    });
    await AcademicSession.collection.insertOne({
      ...stamp,
      _id: sessionId,
      name: "2026-2027",
      createdAt: date,
    });
    await TeachingAssignment.collection.insertMany([
      {
        ...stamp,
        teacherUserId: teacher._id,
        classId,
        sectionId,
        subjectId,
        academicSessionId: sessionId,
        status: "ACTIVE",
        assignedAt: date,
      },
      {
        ...stamp,
        teacherUserId: new mongoose.Types.ObjectId(),
        classId,
        sectionId,
        subjectId: new mongoose.Types.ObjectId(),
        academicSessionId: sessionId,
        status: "ENDED",
        assignedAt: date,
      },
      {
        ...stamp,
        branchId: branch._id,
        teacherUserId: teacher._id,
        classId,
        sectionId,
        subjectId,
        academicSessionId: sessionId,
        status: "ACTIVE",
        assignedAt: date,
      },
    ]);
    const relationRequest = {
      filters: {
        ...filters,
        classId: String(classId),
        sectionId: String(sectionId),
        subjectId: String(subjectId),
        academicSessionId: String(sessionId),
        employeeId: String(teacher._id),
        status: "ACTIVE",
      },
      selections: [
        {
          report: "assignments",
          columns: [
            "teacherUserId",
            "classId",
            "sectionId",
            "subjectId",
            "academicSessionName",
            "status",
          ],
        },
      ],
    };
    const named = await call("/preview", relationRequest);
    eq(
      named.status,
      200,
      "combined teacher/class/section/subject/session/status filters",
    );
    eq(
      named.data.reports[0].total,
      1,
      "combined filters and branch intersection",
    );
    eq(
      named.data.reports[0].rows[0],
      {
        teacherUserId: "Practice teacher",
        classId: "Grade 5",
        sectionId: "A",
        subjectId: "Mathematics",
        academicSessionName: "2026-2027",
        status: "ACTIVE",
      },
      "foreign keys resolve real related names",
    );
    eq(
      named.data.reports[0].filterLabels.subjectId,
      "Mathematics",
      "filter descriptions resolve names",
    );
    const relationAdmin = await User.create({
      schoolId,
      name: "Relation audit admin",
      email: "relations@example.invalid",
      passwordHash: hash,
      userType: "SCHOOL_ADMIN",
      roleId: role._id,
      status: "ACTIVE",
      branchId: schoolId,
    });
    const namedCsv = await call(
      "/export",
      { ...relationRequest, formats: ["csv"] },
      { token: token(relationAdmin) },
    );
    eq(namedCsv.status, 200, "filtered name CSV");
    eq(
      namedCsv.raw.toString().includes("Practice teacher"),
      true,
      "CSV contains teacher name",
    );
    eq(
      namedCsv.raw.toString().includes(String(subjectId)),
      false,
      "CSV contains no subject technical ID",
    );
    const namedXlsx = await call(
      "/export",
      { ...relationRequest, formats: ["xlsx"] },
      { token: token(relationAdmin) },
    );
    eq(namedXlsx.status, 200, "filtered name workbook");
    const namedBook = XLSX.read(namedXlsx.raw, { type: "buffer" });
    const meta = JSON.stringify(
      XLSX.utils.sheet_to_json(namedBook.Sheets["Read me"], { header: 1 }),
    );
    eq(
      meta.includes("Mathematics"),
      true,
      "Excel metadata contains subject name",
    );
    eq(
      meta.includes(String(subjectId)),
      false,
      "Excel metadata excludes technical filter IDs",
    );
    const unavailable = await call("/preview", {
      filters,
      selections: relationRequest.selections,
    });
    eq(
      unavailable.data.reports[0].total,
      2,
      "unavailable references do not drop rows or include other branch",
    );
    eq(
      unavailable.data.reports[0].rows.some(
        (r) =>
          r.teacherUserId === "Related record unavailable" &&
          r.subjectId === "Related record unavailable",
      ),
      true,
      "missing related records are explicit",
    );
    const departments = await call(
      "/options?field=department&search=Academics",
    );
    eq(departments.status, 200, "department lookup");
    eq(
      departments.data.options,
      [{ value: "Academics", label: "Academics" }],
      "department lookup casts tenant ID and returns recorded department",
    );
    eq(options.data.options.length, 1, "lookup branch isolation");
    eq(
      (await call("/options?field=studentId&schoolId=" + schools[1]._id))
        .status,
      400,
      "lookup tenant override denied",
    );
    await Role.updateOne(
      { _id: role._id },
      { $set: { permissions: ["reports.view"] } },
    );
    eq(
      (await call("/catalogue")).data.reports.length,
      0,
      "catalogue respects missing module permissions",
    );
    eq(
      (await call("/preview", request)).status,
      403,
      "cannot query permission-hidden report",
    );
    await Role.updateOne(
      { _id: role._id },
      { $set: { permissions: ROLE_PERMISSION_MAP.SCHOOL_ADMIN } },
    );
    await School.updateOne({ _id: schoolId }, { $set: { plan: "STARTER" } });
    eq(
      (await call("/catalogue")).status,
      403,
      "subscription entitlement enforced",
    );
    await School.updateOne({ _id: schoolId }, { $set: { plan: "ENTERPRISE" } });
    const extras = Array.from({ length: 26 }, (_, i) => ({
      ...stamp,
      classId,
      rollNumber: "PAGE" + i,
      studentId: "PAGE" + i,
      admissionNumber: "PAGEADM" + i,
      name: "Pagination child " + i,
      status: "ACTIVE",
      admissionDate: date,
    }));
    await Student.collection.insertMany(extras);
    const first = await call("/preview", request),
      second = await call("/preview", { ...request, page: 2 });
    eq(first.data.reports[0].rows.length, 25, "preview page bounded");
    eq(second.data.reports[0].rows.length, 2, "second page remaining rows");
    eq(
      new Set(
        [...first.data.reports[0].rows, ...second.data.reports[0].rows].map(
          (r) => r.studentId,
        ),
      ).size,
      27,
      "no duplicate or dropped preview rows",
    );
    await StudentAttendance.collection.updateOne(
      { schoolId },
      {
        $push: {
          records: {
            $each: Array.from({ length: 30 }, (_, i) => ({
              studentId: new mongoose.Types.ObjectId(),
              studentName: "Register row " + i,
              status: "PRESENT",
            })),
          },
        },
      },
    );
    const attendanceRequest = {
        filters,
        selections: [
          { report: "attendance", columns: ["records.studentName"] },
        ],
      },
      attendanceFirst = await call("/preview", attendanceRequest),
      attendanceSecond = await call("/preview", {
        ...attendanceRequest,
        page: 2,
      });
    eq(
      attendanceFirst.data.reports[0].rows.length,
      25,
      "nested register first page",
    );
    eq(
      attendanceSecond.data.reports[0].rows.length,
      8,
      "nested register second page",
    );
    eq(
      new Set(
        [
          ...attendanceFirst.data.reports[0].rows,
          ...attendanceSecond.data.reports[0].rows,
        ].map((r) => r.records.studentName),
      ).size,
      33,
      "nested pagination stable without duplicate or omitted children",
    );
    const limitRows = Array.from({ length: 5001 }, (_, i) => ({
      ...stamp,
      classId,
      rollNumber: "LIMIT" + i,
      studentId: "LIMIT" + i,
      admissionNumber: "LIMITADM" + i,
      name: "Bounded practice row " + i,
      status: "ACTIVE",
      admissionDate: new Date("2025-01-01T05:00:00Z"),
    }));
    await Student.collection.insertMany(limitRows);
    eq(
      (
        await call("/export", {
          ...request,
          filters: { from: "2025-01-01", to: "2025-01-02" },
          formats: ["csv"],
        })
      ).status,
      413,
      "5000 export row cap",
    );
    eq(
      (await call("/export", { ...request, formats: ["csv"] })).status,
      429,
      "export rate limit enforced",
    );
    eq(
      await AuditLog.countDocuments({ schoolId, action: "REPORT_EXPORT" }),
      7,
      "successful and failed exports, including relationship exports, audited",
    );
    eq(
      (await AuditLog.findOne({ action: "REPORT_EXPORT" })).details.includes(
        "HYPERLINK",
      ),
      false,
      "no exported PII in audit",
    );
    // Read-only class-ledger printing: pagination, record association and permissions.
    await Role.updateOne(
      { _id: role._id },
      { $set: { permissions: ROLE_PERMISSION_MAP.SCHOOL_ADMIN } },
    );
    const ledgerSession = new mongoose.Types.ObjectId(),
      ledgerClass = new mongoose.Types.ObjectId();
    await AcademicSession.collection.insertOne({
      ...stamp,
      _id: ledgerSession,
      name: "2026-2027 ledger",
      isCurrent: false,
    });
    await ClassModel.collection.insertOne({
      ...stamp,
      _id: ledgerClass,
      name: "Ledger Class",
    });
    const ledgerStudents = Array.from({ length: 105 }, (_, i) => ({
      ...stamp,
      _id: new mongoose.Types.ObjectId(),
      name: "Ledger student " + i,
      studentId: "LEDGER-" + i,
      admissionNumber: "L-" + i,
      rollNumber: "LEDGER-" + i,
      classId: ledgerClass,
      academicSessionId: ledgerSession,
      className: "Ledger Class",
      status: "ACTIVE",
    }));
    await Student.collection.insertMany([
      ...ledgerStudents,
      {
        ...ledgerStudents[0],
        _id: new mongoose.Types.ObjectId(),
        studentId: "OTHER-SCHOOL",
        schoolId: schools[1]._id,
        organizationId: schools[1]._id,
      },
      {
        ...ledgerStudents[0],
        _id: new mongoose.Types.ObjectId(),
        studentId: "OTHER-BRANCH",
        admissionNumber: "OTHER-BRANCH",
        rollNumber: "OTHER-BRANCH",
        branchId: branch._id,
      },
    ]);
    const bill = new mongoose.Types.ObjectId();
    await FeeChallan.collection.insertMany([
      {
        ...stamp,
        _id: bill,
        studentId: ledgerStudents[0]._id,
        academicSession: "2026-2027 ledger",
        month: "2026-10",
        challanNumber: "LEDGER-C",
        totalAmountPKR: 1000,
        paidAmountPKR: 300,
        remainingAmountPKR: 700,
        feeBreakdown: { tuitionFee: 900, arrears: 100 },
        status: "PARTIAL",
      },
      {
        ...stamp,
        studentId: ledgerStudents[0]._id,
        academicSession: "2026-2027 ledger",
        month: "2026-10",
        isVoided: true,
        totalAmountPKR: 9999,
        paidAmountPKR: 0,
        remainingAmountPKR: 9999,
      },
    ]);
    await FeePayment.collection.insertOne({
      ...stamp,
      studentId: ledgerStudents[0]._id,
      challanId: bill,
      amountPKR: 300,
      paidAt: date,
      receiptNumber: "LEDGER-R",
    });
    const ledgerQuery = new URLSearchParams({
      classId: String(ledgerClass),
      academicSessionId: String(ledgerSession),
      month: "2026-10",
    });
    const ledgerCall = async (query, auth = token(admin)) => {
      const response = await fetch(
        base.replace("/smart-reports", "/finance/ledger-print") + "?" + query,
        {
          headers: {
            Authorization: "Bearer " + auth,
            "X-Acadivo-Branch": String(schoolId),
          },
        },
      );
      return { status: response.status, body: await response.json() };
    };
    const firstLedgers = await ledgerCall(ledgerQuery);
    eq(firstLedgers.status, 200, "class ledger authorized");
    eq(
      firstLedgers.body.data.documents.length,
      100,
      "class ledger first page 100",
    );
    const nextQuery = new URLSearchParams(ledgerQuery);
    nextQuery.set("after", firstLedgers.body.data.next);
    const lastLedgers = await ledgerCall(nextQuery);
    eq(
      lastLedgers.body.data.documents.length,
      5,
      "last 5 students not omitted",
    );
    eq(lastLedgers.body.data.next, null, "pagination stops without extra page");
    const ids = new Set(
      [
        ...firstLedgers.body.data.documents,
        ...lastLedgers.body.data.documents,
      ].map((d) => d.student._id),
    );
    eq(ids.size, 105, "all class students unique, school and branch isolated");
    const firstDoc = firstLedgers.body.data.documents.find(
      (d) => d.student._id === String(ledgerStudents[0]._id),
    );
    eq(
      firstDoc.ledger.summary.remainingBalance,
      700,
      "stored balance excludes voided invoice and no duplicate arrears",
    );
    eq(firstDoc.ledger.payments.length, 1, "correct student payment");
    eq(
      firstDoc.ledger.payments[0].receiptNumber,
      "LEDGER-R",
      "payment receipt association",
    );
    const individualQuery = new URLSearchParams(ledgerQuery);
    individualQuery.set("studentId", String(ledgerStudents[0]._id));
    const oneLedger = await ledgerCall(individualQuery);
    eq(
      oneLedger.body.data.documents.length,
      1,
      "individual print selection preserved",
    );
    eq(
      oneLedger.body.data.documents[0].ledger.summary,
      firstDoc.ledger.summary,
      "bulk and individual calculations identical",
    );
    eq(
      (await ledgerCall(ledgerQuery, token(teacher))).status,
      403,
      "teacher cannot read class fee ledgers",
    );
    const wrongQuery = new URLSearchParams(ledgerQuery);
    wrongQuery.set("month", "2026-13");
    eq(
      (await ledgerCall(wrongQuery)).status,
      400,
      "invalid fee month rejected",
    );
    const emptyQuery = new URLSearchParams(ledgerQuery);
    emptyQuery.set("month", "2026-11");
    const emptyLedgers = await ledgerCall(emptyQuery);
    eq(
      emptyLedgers.body.data.documents[0].ledger.challans.length,
      0,
      "no invented charges for missing period",
    );
    // New production flows are tested only in this disposable database.
    const financeCall = async (path, body) => {
      const response = await fetch(
        base.replace("/smart-reports", "/finance") + path,
        {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: "Bearer " + token(admin),
            "X-Acadivo-Branch": String(schoolId),
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      return { status: response.status, body: await response.json() };
    };
    const { FeeStructure } = require("../src/server/models/fee.model.ts");
    await FeeStructure.collection.insertOne({
      ...stamp,
      classId: ledgerClass,
      academicSession: "2026-2027 ledger",
      title: "Ledger structure",
      tuitionFee: 900,
      admissionFee: 100,
      defaultDiscount: 50,
      totalMonthlyFee: 900,
    });
    // A legacy month label must match the canonical selection and never be charged twice.
    await FeeChallan.updateOne(
      { _id: bill },
      { $set: { month: "October 2026" } },
    );
    const generated = await financeCall("/generate-batch", {
      classId: String(ledgerClass),
      academicSessionId: String(ledgerSession),
      month: "2026-10",
      dueDate: "2026-10-30",
      lateFeeFine: 25,
      studentIds: ledgerStudents.slice(0, 2).map((s) => String(s._id)),
    });
    eq(generated.status, 200, "selected-student challan generation");
    eq(generated.body.data.count, 2, "individual/bulk selection exact");
    eq(
      await FeeChallan.countDocuments({
        studentId: ledgerStudents[0]._id,
        isVoided: { $ne: true },
      }),
      1,
      "legacy month invoice reused",
    );
    const newBill = await FeeChallan.findOne({
      studentId: ledgerStudents[1]._id,
      month: "2026-10",
    }).lean();
    eq(
      newBill.totalAmountPKR,
      975,
      "tuition plus first admission minus discount plus fine",
    );
    const replay = await financeCall("/generate-batch", {
      classId: String(ledgerClass),
      academicSessionId: String(ledgerSession),
      month: "October 2026",
      dueDate: "2026-10-30",
      studentIds: [String(ledgerStudents[1]._id)],
    });
    eq(replay.status, 200, "legacy generation month accepted");
    eq(
      await FeeChallan.countDocuments({
        studentId: ledgerStudents[1]._id,
        isVoided: { $ne: true },
      }),
      1,
      "repeat generation does not duplicate charges",
    );
    const candidate = await financeCall("/challan-candidates?" + ledgerQuery);
    eq(candidate.status, 200, "bulk challan print candidates");
    eq(
      candidate.body.data.students.length,
      100,
      "print candidates first batch",
    );
    eq(
      candidate.body.data.challans.length,
      2,
      "only saved eligible invoices included",
    );
    const afterCandidate = new URLSearchParams(ledgerQuery);
    afterCandidate.set("after", candidate.body.data.next);
    const lastCandidate = await financeCall(
      "/challan-candidates?" + afterCandidate,
    );
    eq(
      lastCandidate.body.data.students.length,
      5,
      "print candidates include final class students",
    );
    eq(
      (
        await financeCall("/generate-batch", {
          classId: String(ledgerClass),
          academicSessionId: String(ledgerSession),
          month: "2026-10",
          dueDate: "2026-10-30",
          studentIds: [
            String(ledgerStudents[0]._id),
            String(ledgerStudents[0]._id),
          ],
        })
      ).status,
      400,
      "duplicate selected students rejected",
    );
    const reportsData = await financeCall(
      "/report-data?sessionId=" + ledgerSession,
    );
    eq(reportsData.status, 200, "real finance report dataset");
    eq(
      reportsData.body.data.payments.some(
        (p) => p.receiptNumber === "LEDGER-R",
      ),
      true,
      "finance export contains recorded receipt",
    );
    const documentCall = async (body, auth = token(admin)) => {
      const response = await fetch(
        base.replace("/smart-reports", "/school-documents/bulk-preview"),
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + auth,
            "X-Acadivo-Branch": String(schoolId),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      return { status: response.status, body: await response.json() };
    };
    const documentRequest = {
      document: { type: "admission" },
      classId: String(ledgerClass),
      academicSessionId: String(ledgerSession),
    };
    const docs = await documentCall(documentRequest);
    eq(docs.status, 200, "bulk admission document API");
    eq(docs.body.data.documents.length, 20, "document batch bounded");
    eq(
      new Set(docs.body.data.documents.map((d) => d.student._id)).size,
      20,
      "student documents not mixed or duplicated",
    );
    const lastDocs = await documentCall({
      ...documentRequest,
      after: docs.body.data.next,
    });
    eq(
      lastDocs.body.data.documents.length,
      20,
      "document cursor continues past first page",
    );
    const noCertificates = await documentCall({
      ...documentRequest,
      document: { type: "bonafide" },
    });
    eq(
      noCertificates.body.data.documents.length,
      0,
      "missing certificates never invented",
    );
    eq(
      noCertificates.body.data.skipped.length,
      20,
      "missing issued certificates explicitly reported",
    );
    eq(
      (await documentCall(documentRequest, token(teacher))).status,
      403,
      "unauthorized role cannot bulk-print admission forms",
    );
    const { Admission } = require("../src/server/models/admission.model.ts");
    await Admission.collection.insertOne({
      ...stamp,
      applicationNumber: "LAYOUT-1",
      studentName: "Layout admission",
      guardianName: "Layout guardian",
      guardianPhone: "03000000000",
      applyingClassId: classId,
      academicSessionId: sessionId,
      inquiryDate: date,
      status: "NEW",
      documentsStatus: "PENDING",
    });
    const admissionColumns = [
      "applicationNumber",
      "studentName",
      "guardianName",
      "guardianPhone",
      "applyingClassName",
      "academicSessionName",
      "inquiryDate",
      "followUpDate",
      "documentsStatus",
      "status",
    ];
    const admissionPdf = await call(
      "/export",
      {
        filters,
        selections: [{ report: "admissions", columns: admissionColumns }],
        formats: ["pdf"],
      },
      { token: token(relationAdmin) },
    );
    eq(admissionPdf.status, 200, "admission full-table PDF");
    eq(
      (admissionPdf.raw.toString("latin1").match(/\/Type \/Page\b/g) || [])
        .length,
      1,
      "all ten admission columns in one table, no disconnected panels",
    );
    fs.writeFileSync(
      "artifacts/smart-reports/admission-table.pdf",
      admissionPdf.raw,
    );
    const emptyExport = await call(
      "/export",
      {
        filters: { from: "2030-01-01", to: "2030-01-31" },
        selections: [{ report: "students", columns: ["name"] }],
        formats: ["csv"],
      },
      { token: token(relationAdmin) },
    );
    eq(
      emptyExport.status,
      404,
      "empty export is explicit, not a misleading file",
    );
    eq(
      emptyExport.body.message.includes("No matching recorded data"),
      true,
      "empty export explains filter selection",
    );
    console.log(
      `PASS: ${checks} real HTTP/MongoDB report, accuracy, isolation, export and intelligence checks.`,
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((r) => server.close(r));
    if (mongoose.connection.readyState) {
      if (!mongoose.connection.name.startsWith("acadivo_reports_test_"))
        throw Error("Unsafe cleanup blocked");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
})();
