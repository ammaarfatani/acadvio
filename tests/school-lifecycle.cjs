// Never connect this regression suite to an online or production database.
if (
  !/^mongodb:\/\/(127\.0\.0\.1|localhost):27018\//.test(
    process.env.MONGODB_URI || "",
  )
)
  throw new Error(
    "Set MONGODB_URI to the isolated local MongoDB on port 27018.",
  );
// Real service/API integration in a disposable MongoDB database. Never seeds the existing school.
const fs = require("node:fs"),
  ts = require("typescript"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const mongoose = require("mongoose"),
  { env } = require("../src/server/config/env.ts");
require("../src/server/utils/email.util.ts").sendEmailNotification = async () =>
  true;
const { createApp } = require("../src/server/app.ts"),
  { School } = require("../src/server/models/school.model.ts"),
  { User } = require("../src/server/models/user.model.ts"),
  { Role } = require("../src/server/models/role.model.ts"),
  { Student } = require("../src/server/models/student.model.ts"),
  {
    ClassModel,
    SectionModel,
  } = require("../src/server/models/classSection.model.ts"),
  {
    AcademicSession,
  } = require("../src/server/models/academicSession.model.ts"),
  { Subject } = require("../src/server/models/subject.model.ts"),
  { ParentProfile } = require("../src/server/models/parentProfile.model.ts"),
  {
    TeachingAssignment,
  } = require("../src/server/models/teacherProfile.model.ts"),
  {
    MarksEntry,
    ProcessedResult,
  } = require("../src/server/models/exam.model.ts"),
  { StaffDepartment } = require("../src/server/models/workforce.model.ts");
const {
    ROLE_PERMISSION_MAP,
  } = require("../src/server/constants/permissions.constant.ts"),
  { hashPassword } = require("../src/server/utils/password.util.ts"),
  { annualMarksheet } = require("../src/server/services/marksheet.service.ts");
const dbName =
    "acadivo_lifecycle_test_" + crypto.randomBytes(6).toString("hex"),
  password = crypto.randomBytes(16).toString("hex");
let connected = false,
  server,
  count = 0;
const eq = (a, b, label) => {
  assert.equal(a, b, label);
  count++;
};
(async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName,
      serverSelectionTimeoutMS: 15000,
    });
    connected = true;
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    const roles = {};
    for (const type of [
      "SCHOOL_ADMIN",
      "PARENT",
      "TEACHER",
      "FINANCE",
      "EXAM_STAFF",
    ])
      roles[type] = await Role.create({
        name: type,
        code: type,
        userType: type,
        permissions: ROLE_PERMISSION_MAP[type],
        schoolId: null,
        isSystemRole: true,
      });
    const school = await School.create({
      name: "Lifecycle test",
      code: "lifecycle",
      slug: "lifecycle",
      email: "school@example.invalid",
      phone: "03000000000",
      address: "Disposable integration",
      plan: "ENTERPRISE",
      status: "ACTIVE",
      studentCountRange: "1-200",
    });
    const schoolId = String(school._id),
      hash = await hashPassword(password);
    const admin = await User.create({
      schoolId,
      branchId: schoolId,
      organizationId: schoolId,
      name: "Admin",
      email: "admin@example.invalid",
      passwordHash: hash,
      userType: "SCHOOL_ADMIN",
      roleId: roles.SCHOOL_ADMIN._id,
      status: "ACTIVE",
      isEmailVerified: true,
      isOrganizationOwner: true,
    });
    const c = await ClassModel.create({
        schoolId,
        name: "Class 9",
        code: "class9",
        numericLevel: 9,
      }),
      section = await SectionModel.create({
        schoolId,
        classId: c._id,
        className: c.name,
        name: "A",
      }),
      session = await AcademicSession.create({
        schoolId,
        name: "2026–2027",
        startDate: "2026-04-01",
        endDate: "2027-03-31",
        isCurrent: true,
      });
    const math = await Subject.create({
        schoolId,
        classId: c._id,
        className: c.name,
        name: "Mathematics",
        code: "MATH",
        totalMarks: 50,
        passingMarks: 17,
      }),
      english = await Subject.create({
        schoolId,
        classId: c._id,
        className: c.name,
        name: "English",
        code: "ENG",
        totalMarks: 100,
        passingMarks: 33,
      });
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port + "/api";
    const call = async (path, token, body, method) => {
      const r = await fetch(base + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? { Authorization: "Bearer " + token, "X-Acadivo-Branch": schoolId }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    const login = async (email) => {
      const r = await call("/auth/login", null, { email, password });
      eq(r.status, 200, "login " + email);
      return r.body.data.accessToken;
    };
    const token = await login(admin.email);
    const input = {
      name: "Ali Ahmed",
      dob: "2012-01-02",
      gender: "Male",
      classId: String(c._id),
      className: c.name,
      sectionId: String(section._id),
      academicSessionId: String(session._id),
      address: "Karachi Pakistan",
      parentInfo: {
        fatherName: "Ahmed Khan",
        fatherPhone: "03000000000",
        guardianEmail: "parent@example.invalid",
      },
      parentAccount: { password },
      emergencyContact: {
        name: "Ahmed Khan",
        phone: "03000000000",
        relation: "Father",
      },
    };
    const admitted = await call("/school-admin/students", token, input);
    eq(admitted.status, 201, "student and primary parent created");
    const student = admitted.body.data;
    eq(student.primaryParent.created, true, "new primary parent created");
    eq(
      student.primaryParent.initialPassword,
      undefined,
      "password never returned in admission response",
    );
    eq(
      await ParentProfile.countDocuments({ schoolId, studentIds: student._id }),
      1,
      "one primary account linked",
    );
    const pt = await login("parent@example.invalid");
    eq(
      (await call("/parent/children", pt)).body.data.length,
      1,
      "parent sees admitted child",
    );
    const sibling = await call("/school-admin/students", token, {
      ...input,
      name: "Sana Ahmed",
      parentAccount: undefined,
    });
    eq(sibling.status, 201, "sibling admitted");
    eq(
      sibling.body.data.primaryParent.created,
      false,
      "existing parent reused",
    );
    eq(
      await User.countDocuments({ schoolId, userType: "PARENT" }),
      1,
      "no duplicate parent",
    );
    eq(
      (await call("/parent/children", pt)).body.data.length,
      2,
      "parent sees siblings",
    );
    const countBeforeBlank = await Student.countDocuments({ schoolId });
    const blankParent = await call("/school-admin/students", token, {
      ...input,
      name: "Blank password fixture",
      parentAccount: undefined,
      parentInfo: {
        ...input.parentInfo,
        guardianEmail: "new-no-password@example.invalid",
      },
    });
    eq(blankParent.status, 400, "new parent requires explicit password");
    eq(
      await Student.countDocuments({ schoolId }),
      countBeforeBlank,
      "missing password rolls back admission",
    );
    eq(
      await User.countDocuments({ email: "new-no-password@example.invalid" }),
      0,
      "no generated parent account",
    );
    const before = await Student.countDocuments({ schoolId });
    eq(
      (
        await call("/school-admin/students", token, {
          ...input,
          name: "Invalid parent relation",
          parentInfo: { ...input.parentInfo, guardianEmail: admin.email },
        })
      ).status,
      409,
      "parent email collision rejected",
    );
    eq(
      await Student.countDocuments({ schoolId }),
      before,
      "failed parent creation rolls back student",
    );
    const teacher = await call("/school-admin/teachers", token, {
      name: "Sana Teacher",
      email: "teacher@example.invalid",
      password,
      classAssignments: [
        {
          academicSessionId: String(session._id),
          classId: String(c._id),
          sectionId: String(section._id),
        },
      ],
    });
    eq(teacher.status, 201, "teacher class-only assignment");
    eq(
      teacher.body.data.classAssignments.length,
      1,
      "class assignment returned",
    );
    const teacherId = teacher.body.data._id;
    await TeachingAssignment.create({
      schoolId,
      teacherUserId: teacherId,
      academicSessionId: session._id,
      classId: c._id,
      sectionId: section._id,
      subjectId: math._id,
      status: "ACTIVE",
    });
    eq(
      (
        await call(
          "/school-admin/teachers/" + teacherId,
          token,
          { name: "Updated Teacher" },
          "PUT",
        )
      ).status,
      200,
      "teacher edit",
    );
    eq(
      await TeachingAssignment.countDocuments({
        teacherUserId: teacherId,
        status: "ACTIVE",
      }),
      1,
      "unrelated subject duty preserved",
    );
    const tt = await login("teacher@example.invalid");
    eq(
      (await call("/exams/students", tt)).status,
      403,
      "teacher broad exam roster denied",
    );
    eq(
      (await call("/teacher/my-classes", tt)).status,
      200,
      "teacher scoped class access works",
    );
    const examData = {
      title: "Mid-Term 2026",
      term: "MID_TERM",
      academicSessionId: String(session._id),
      classes: [String(c._id)],
      startDate: "2026-09-01",
      endDate: "2026-09-15",
    };
    const mid = await call("/exams/schedules", token, examData);
    eq(mid.status, 201, "term exam without subject choice");
    eq(mid.body.data.subjects.length, 2, "class subjects resolved server side");
    const final = await call("/exams/schedules", token, {
      ...examData,
      title: "Final Term",
      term: "FINAL_TERM",
      startDate: "2026-10-01",
      endDate: "2026-10-15",
    });
    eq(final.status, 201, "Final term");
    const paper = {
      examId: mid.body.data._id,
      classId: String(c._id),
      sectionId: String(section._id),
      subjectId: String(math._id),
      date: "2026-09-02",
      startTime: "09:00",
      endTime: "11:00",
      room: "Hall A",
    };
    eq(
      (await call("/exams/timetable", token, paper)).status,
      200,
      "paper scheduled",
    );
    eq(
      (
        await call("/exams/timetable", token, {
          ...paper,
          subjectId: String(english._id),
        })
      ).status,
      409,
      "overlapping section paper denied",
    );
    eq(
      (await call("/exams/timetable", token, { ...paper, date: "2026-08-01" }))
        .status,
      400,
      "paper outside term denied",
    );
    eq(
      (await call("/teacher/exam-timetable", tt)).body.data.length,
      1,
      "class teacher sees applicable paper",
    );
    eq(
      (await call("/parent/children/" + student._id, pt)).body.data
        .examTimetable.length,
      1,
      "parent sees child paper",
    );
    const save = async (examId, subject, marks, max) =>
      call("/exams/marks", token, {
        examId,
        classId: String(c._id),
        subjectId: String(subject._id),
        subjectName: subject.name,
        maxMarks: max,
        passingMarks: subject.passingMarks,
        records: marks.map((m) => ({
          studentId: m[0],
          studentName: "Student",
          rollNumber: "9-A",
          ...(m[1] === null ? { isAbsent: true } : { obtainedMarks: m[1] }),
        })),
      });
    eq(
      (
        await save(
          mid.body.data._id,
          math,
          [
            [student._id, 40],
            [sibling.body.data._id, null],
          ],
          50,
        )
      ).status,
      200,
      "marks and absence saved without absent score",
    );
    eq(
      (
        await call("/exams/process", token, {
          examId: mid.body.data._id,
          classId: String(c._id),
        })
      ).status,
      200,
      "partial result processed",
    );
    let result = await ProcessedResult.findOne({
      studentId: student._id,
      examId: mid.body.data._id,
    });
    eq(result.status, "PENDING", "missing subject stays pending");
    eq(result.percentage, null, "no invented partial percentage");
    eq(result.subjectScores.length, 2, "all applicable subjects retained");
    eq(result.attendancePercentage, undefined, "no fabricated attendance");
    await save(mid.body.data._id, english, [[student._id, 80]], 100);
    await call("/exams/process", token, {
      examId: mid.body.data._id,
      classId: String(c._id),
    });
    result = await ProcessedResult.findOne({
      studentId: student._id,
      examId: mid.body.data._id,
    });
    eq(result.percentage, 80, "weighted percentage from actual maxima");
    eq(result.status, "PASSED", "absolute passing marks compared correctly");
    await call("/exams/publish", token, {
      examId: mid.body.data._id,
      classId: String(c._id),
      publish: true,
    });
    eq(
      (
        await ProcessedResult.findOne({
          studentId: sibling.body.data._id,
          examId: mid.body.data._id,
        })
      ).isPublished,
      false,
      "incomplete result not published",
    );
    await save(final.body.data._id, math, [[student._id, 45]], 50);
    await save(final.body.data._id, english, [[student._id, 90]], 100);
    await call("/exams/process", token, {
      examId: final.body.data._id,
      classId: String(c._id),
    });
    await call("/exams/publish", token, {
      examId: final.body.data._id,
      classId: String(c._id),
      publish: true,
    });
    const child = (await call("/parent/children/" + student._id, pt)).body.data;
    eq(child.marksheet.overall.obtained, 255, "Mid plus Final total");
    eq(child.marksheet.overall.max, 300, "real maximum total");
    eq(child.marksheet.overall.percentage, 85, "combined weighted percentage");
    eq(
      child.marksheet.rows.length,
      2,
      "combined report includes class subjects",
    );
    // Report repair regression: run only against this suite's disposable database.
    const policyBody = {
      academicSessionId: String(session._id),
      classId: String(c._id),
      method: "WEIGHTED",
      absence: "ZERO_FAIL",
      revision: 0,
      components: [
        { examId: mid.body.data._id, weight: 40 },
        { examId: final.body.data._id, weight: 60 },
      ],
    };
    let savedPolicy = await call(
      "/exams/assessment-policy",
      token,
      policyBody,
      "PUT",
    );
    eq(savedPolicy.status, 200, "weighted policy saved");
    const candidateQuery = `/exams/marksheet-candidates?academicSessionId=${session._id}&classId=${c._id}`;
    const candidates = await call(candidateQuery, token);
    eq(candidates.status, 200, "authorized marksheet candidates");
    eq(
      candidates.body.data.students.some((s) => s._id === student._id),
      true,
      "saved student available in session/class",
    );
    eq(
      (
        await call(
          candidateQuery.replace(
            String(session._id),
            String(new mongoose.Types.ObjectId()),
          ),
          token,
        )
      ).status,
      400,
      "unknown candidate session rejected",
    );
    eq(savedPolicy.body.data.revision, 1, "first revision is one");
    eq(
      (await call("/exams/assessment-policy", token, policyBody, "PUT")).status,
      409,
      "stale policy revision denied",
    );
    const sheetPath =
      "/exams/marksheet/" +
      student._id +
      "?academicSessionId=" +
      session._id +
      "&classId=" +
      c._id;
    let weighted = (await call(sheetPath + "&view=ANNUAL", token)).body.data;
    eq(weighted.overall.percentage, 86, "annual normalized weighted result");
    eq(
      weighted.overall.obtained,
      null,
      "weighted result has no false raw total",
    );
    eq(
      weighted.policy.legacy,
      false,
      "saved policy replaces labelled legacy summary",
    );
    const midOnly = (
      await call(sheetPath + "&view=EXAM&examId=" + mid.body.data._id, token)
    ).body.data;
    eq(midOnly.overall.percentage, 80, "mid-only result excludes final");
    eq(midOnly.policy.method, "EXAM_ONLY", "exam-only accurately labelled");
    let pdfResponse = await fetch(
      base +
        "/exams/marksheet/" +
        student._id +
        "/pdf?academicSessionId=" +
        session._id +
        "&classId=" +
        c._id +
        "&expectedHash=" +
        weighted.sourceHash,
      {
        headers: {
          Authorization: "Bearer " + token,
          "X-Acadivo-Branch": schoolId,
        },
      },
    );
    const bulkBody = {
      studentIds: [String(student._id)],
      query: {
        academicSessionId: String(session._id),
        classId: String(c._id),
        view: "ANNUAL",
      },
      sourceHashes: { [student._id]: weighted.sourceHash },
    };
    const bulkResponse = await fetch(base + "/exams/marksheets/bulk-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "X-Acadivo-Branch": schoolId,
      },
      body: JSON.stringify(bulkBody),
    });
    eq(bulkResponse.status, 200, "authorized bulk PDF export");
    eq(
      Buffer.from(await bulkResponse.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
      "bulk PDF bytes",
    );
    eq(
      (await call("/exams/marksheets/bulk-pdf", null, bulkBody)).status,
      401,
      "anonymous bulk export blocked",
    );
    eq(
      (await call("/exams/marksheets/bulk-pdf", pt, bulkBody)).status,
      403,
      "parent bulk export blocked",
    );
    eq(
      (
        await call("/exams/marksheets/bulk-pdf", token, {
          ...bulkBody,
          studentIds: [String(student._id), String(student._id)],
        })
      ).status,
      400,
      "duplicate bulk students rejected",
    );
    eq(
      (
        await call("/exams/marksheets/bulk-pdf", token, {
          ...bulkBody,
          sourceHashes: { [student._id]: "0".repeat(64) },
        })
      ).status,
      409,
      "stale bulk preview rejected",
    );
    eq(
      (
        await call("/exams/marksheets/bulk-pdf", token, {
          ...bulkBody,
          studentIds: [String(new mongoose.Types.ObjectId())],
          sourceHashes: {},
        })
      ).status,
      404,
      "unknown bulk student rejected",
    );
    eq(pdfResponse.status, 200, "authoritative PDF export");
    eq(
      pdfResponse.headers.get("content-type").startsWith("application/pdf"),
      true,
      "PDF MIME",
    );
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    eq(pdfBuffer.subarray(0, 5).toString(), "%PDF-", "real PDF signature");
    fs.mkdirSync("artifacts/report-repair", { recursive: true });
    fs.writeFileSync(
      "artifacts/report-repair/annual-weighted-verification.pdf",
      pdfBuffer,
    );
    eq(
      (await call("/exams/assessment-policy", pt, policyBody, "PUT")).status,
      403,
      "parent cannot change policy",
    );
    let updatePolicy = await call(
      "/exams/assessment-policy",
      token,
      {
        ...policyBody,
        revision: 1,
        method: "FINAL_ONLY",
        components: [{ examId: final.body.data._id }],
      },
      "PUT",
    );
    eq(updatePolicy.status, 200, "final-only configured");
    eq(
      (await call(sheetPath + "&view=ANNUAL", token)).body.data.overall
        .percentage,
      90,
      "final-only excludes mid",
    );
    const stalePdf = await fetch(
      base +
        "/exams/marksheet/" +
        student._id +
        "/pdf?expectedHash=" +
        weighted.sourceHash,
      {
        headers: {
          Authorization: "Bearer " + token,
          "X-Acadivo-Branch": schoolId,
        },
      },
    );
    eq(stalePdf.status, 409, "PDF refuses changed preview");
    const invalid = await call(
      "/exams/assessment-policy",
      token,
      {
        ...policyBody,
        revision: 2,
        components: [
          { examId: mid.body.data._id, weight: 30 },
          { examId: final.body.data._id, weight: 60 },
        ],
      },
      "PUT",
    );
    eq(invalid.status, 400, "weights cannot silently normalize");
    updatePolicy = await call(
      "/exams/assessment-policy",
      token,
      { ...policyBody, revision: 2, method: "CUMULATIVE" },
      "PUT",
    );
    eq(updatePolicy.status, 200, "cumulative configured");
    eq(
      (await call(sheetPath + "&view=ANNUAL", token)).body.data.overall
        .percentage,
      85,
      "eligible cumulative maxima",
    );
    eq(
      (await call("/workforce/self", token)).status,
      403,
      "administrator without employment has no personal attendance",
    );
    eq(
      (await call("/exams/timetable", token, { ...paper, date: "2026-02-31" }))
        .status,
      400,
      "invalid calendar date rejected",
    );
    await save(mid.body.data._id, english, [[sibling.body.data._id, 75]], 100);
    let merged = await MarksEntry.findOne({
      examId: mid.body.data._id,
      subjectId: english._id,
    });
    eq(
      merged.records.length,
      2,
      "saving another student preserves existing marks",
    );
    eq(
      merged.records.find((r) => String(r.studentId) === student._id)
        .obtainedMarks,
      80,
      "existing score retained",
    );
    eq(
      merged.records.find((r) => String(r.studentId) === student._id)
        .studentName,
      "Ali Ahmed",
      "canonical student name stored",
    );
    await save(final.body.data._id, english, [[student._id, 85]], 100);
    eq(
      (
        await ProcessedResult.findOne({
          studentId: student._id,
          examId: final.body.data._id,
        })
      ).isPublished,
      false,
      "edited marks require result processing and publication",
    );
    eq(
      (
        await call("/exams/publish", token, {
          examId: final.body.data._id,
          classId: String(c._id),
          publish: true,
        })
      ).status,
      409,
      "changed result cannot be republished without processing",
    );
    const sharp = require("sharp");
    const image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#b20913" },
    })
      .png()
      .toBuffer();
    const photo = "data:image/png;base64," + image.toString("base64");
    for (const [index, fields] of [
      {},
      { bFormNumber: " 00123-4567890-1 " },
      { photoData: photo },
      { bFormNumber: "0000000000001", photoData: photo },
    ].entries()) {
      const r = await call("/school-admin/students", token, {
        ...input,
        parentInfo: { ...input.parentInfo, guardianEmail: "" },
        name: "Photo fixture " + index,
        ...fields,
      });
      eq(r.status, 201, "optional identity creation " + index);
      if (fields.bFormNumber)
        eq(
          r.body.data.bFormNumber,
          fields.bFormNumber.trim(),
          "B-Form trimmed preserves zeros",
        );
      if (fields.photoData) {
        eq(
          (await call("/student-media/" + r.body.data._id + "/photo", token))
            .status,
          200,
          "authenticated persisted GridFS retrieval",
        );
        eq(
          (await call("/student-media/" + r.body.data._id + "/photo", pt))
            .status,
          404,
          "unlinked parent photo denied",
        );
      }
    }
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          { bFormNumber: "0012345678901", photoData: photo },
          "PUT",
        )
      ).status,
      200,
      "edit identity and upload",
    );
    let stored = await Student.findById(student._id).select("+photoStorageId");
    const oldId = stored.photoStorageId;
    eq(stored.bFormNumber, "0012345678901", "B-Form leading zeros preserved");
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          { name: "Ali Updated" },
          "PUT",
        )
      ).status,
      200,
      "unrelated edit",
    );
    eq(
      (await Student.findById(student._id)).bFormNumber,
      "0012345678901",
      "unrelated edit retains B-Form",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          { photoData: photo },
          "PUT",
        )
      ).status,
      200,
      "replace photo",
    );
    eq(
      await mongoose.connection.db
        .collection("studentPhotos.files")
        .countDocuments({ _id: new mongoose.Types.ObjectId(oldId) }),
      0,
      "old photo cleaned",
    );
    eq(
      (await call("/student-media/" + student._id + "/photo", pt)).status,
      200,
      "linked parent can see photo",
    );
    eq(
      (await call("/student-media/" + student._id + "/photo", null)).status,
      401,
      "anonymous photo denied",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          {
            photoData:
              "data:image/png;base64," +
              Buffer.from("not an image").toString("base64"),
          },
          "PUT",
        )
      ).status,
      400,
      "invalid image content rejected",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          { photoData: "data:image/svg+xml;base64,PHN2Zz4=" },
          "PUT",
        )
      ).status,
      400,
      "SVG rejected",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          {
            photoData:
              "data:image/png;base64," +
              Buffer.alloc(5242881).toString("base64"),
          },
          "PUT",
        )
      ).status,
      400,
      "oversized image rejected",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          tt,
          { bFormNumber: "other" },
          "PUT",
        )
      ).status,
      403,
      "teacher edit denied",
    );
    const unassignedTeacher = await User.create({
      schoolId,
      organizationId: schoolId,
      branchId: schoolId,
      name: "Unassigned photo fixture",
      email: "unassigned-photo@example.invalid",
      passwordHash: hash,
      userType: "TEACHER",
      roleId: roles.TEACHER._id,
      status: "ACTIVE",
    });
    const unassignedToken = await login(unassignedTeacher.email);
    eq(
      (await call("/student-media/" + student._id + "/photo", unassignedToken))
        .status,
      404,
      "unassigned teacher photo denied",
    );
    const foreignSchool = await School.create({
      name: "Foreign media fixture",
      code: "foreign-media",
      slug: "foreign-media",
      email: "foreign@example.invalid",
      phone: "03000000000",
      address: "Disposable fixture",
      plan: "ENTERPRISE",
      status: "ACTIVE",
      studentCountRange: "1-200",
    });
    const foreignAdmin = await User.create({
      schoolId: foreignSchool._id,
      branchId: foreignSchool._id,
      organizationId: foreignSchool._id,
      name: "Foreign admin",
      email: "foreign-admin@example.invalid",
      passwordHash: hash,
      userType: "SCHOOL_ADMIN",
      roleId: roles.SCHOOL_ADMIN._id,
      status: "ACTIVE",
    });
    await require("../src/server/services/branchMigration.service.ts").migrateBranchScopes();
    const foreignRole = await Role.create({
      schoolId: foreignSchool._id,
      organizationId: foreignSchool._id,
      branchId: foreignSchool._id,
      name: "Foreign admin role",
      code: "FOREIGN_ADMIN",
      userType: "SCHOOL_ADMIN",
      permissions: ROLE_PERMISSION_MAP.SCHOOL_ADMIN,
      isSystemRole: false,
    });
    await User.updateOne(
      { _id: foreignAdmin._id },
      { $set: { roleId: foreignRole._id, isOrganizationOwner: true } },
    );
    const foreignToken = await login(foreignAdmin.email);
    const foreignPhoto = await call(
      "/student-media/" + student._id + "/photo",
      foreignToken,
    );
    assert(
      [403, 404].includes(foreignPhoto.status),
      "foreign school photo denied",
    );
    count++;
    const foreignEdit = await call(
      "/school-admin/students/" + student._id,
      foreignToken,
      { bFormNumber: "other" },
      "PUT",
    );
    assert(
      [403, 404].includes(foreignEdit.status),
      "foreign school identity edit denied",
    );
    count++;
    eq(
      (await Student.findById(student._id)).bFormNumber,
      "0012345678901",
      "foreign edit never changes B-Form",
    );
    for (const format of ["jpeg", "webp"]) {
      const bytes = await sharp(image).toFormat(format).toBuffer();
      eq(
        (
          await call(
            "/school-admin/students/" + student._id,
            token,
            {
              photoData:
                "data:image/" + format + ";base64," + bytes.toString("base64"),
            },
            "PUT",
          )
        ).status,
        200,
        format + " upload supported",
      );
    }
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          { photoUrl: "https://example.invalid/other.webp" },
          "PUT",
        )
      ).status,
      400,
      "arbitrary photo URL rejected",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          {
            photoData:
              "data:image/png;base64," +
              image.subarray(0, 8).toString("base64"),
          },
          "PUT",
        )
      ).status,
      400,
      "signature-only corrupt image rejected",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + student._id,
          token,
          { photoData: null },
          "PUT",
        )
      ).status,
      200,
      "photo removed",
    );
    eq(
      (await Student.findById(student._id)).photoUrl,
      "",
      "fallback avatar after removal",
    );
    eq(
      (await call("/student-media/" + student._id + "/photo", token)).status,
      404,
      "removed photo no longer accessible",
    );
    console.log(
      "PASS: " +
        count +
        " admission, parent, assignment, exam timetable, absent/pending result and marksheet integration checks.",
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((r) => server.close(r));
    if (connected) {
      assert.match(
        mongoose.connection.name,
        /^acadivo_lifecycle_test_[a-f0-9]+$/,
      );
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  }
})();
