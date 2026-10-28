// Safety: never use the application's online database host for integration tests.
if (
  !/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(
    process.env.MONGODB_URI || "",
  )
) {
  throw new Error(
    "Testing requires an explicit local MONGODB_URI. Online database connections are blocked.",
  );
}
// Integration fixtures are isolated in a disposable MongoDB database; no business records are used.
const fs = require("node:fs"),
  ts = require("typescript"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
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
const os = require("node:os"),
  path = require("node:path");
const provisionDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "acadivo-credentials-test-"),
);
process.env.BIOMETRIC_PROVISION_DIR = provisionDir;
const mongoose = require("mongoose"),
  { env } = require("../src/server/config/env.ts");
require("../src/server/utils/email.util.ts").sendEmailNotification = async () =>
  true;
const { createApp } = require("../src/server/app.ts"),
  { School } = require("../src/server/models/school.model.ts"),
  { User } = require("../src/server/models/user.model.ts"),
  { Role } = require("../src/server/models/role.model.ts"),
  { Branch } = require("../src/server/models/branch.model.ts"),
  models = require("../src/server/models/workforce.model.ts"),
  { AuditLog } = require("../src/server/models/auditLog.model.ts"),
  { LeaveRequest } = require("../src/server/models/leaveRequest.model.ts");
const { hashPassword } = require("../src/server/utils/password.util.ts"),
  {
    ROLE_PERMISSION_MAP,
  } = require("../src/server/constants/permissions.constant.ts"),
  {
    migrateBranchScopes,
  } = require("../src/server/services/branchMigration.service.ts"),
  {
    DEFAULT_POLICY: p,
    monthDates,
    workingDay,
  } = require("../src/lib/workforce-math.ts");
process.env.BIOMETRIC_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
const dbName =
    "acadivo_workforce_test_" + crypto.randomBytes(5).toString("hex"),
  password = crypto.randomBytes(12).toString("hex");
let server,
  connected = false,
  checks = 0;
const eq = (a, b, label) => {
  assert.equal(a, b, label);
  checks++;
};
(async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName,
      serverSelectionTimeoutMS: 15000,
    });
    connected = true;
    console.log("Connected disposable database; initializing indexes.");
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    console.log("Indexes ready; checking real workforce endpoints.");
    const hash = await hashPassword(password),
      roles = {};
    for (const type of Object.keys(ROLE_PERMISSION_MAP))
      roles[type] = await Role.create({
        name: type,
        code: "ROLE_" + type,
        userType: type,
        permissions: ROLE_PERMISSION_MAP[type],
        isSystemRole: true,
      });
    const schools = {};
    for (const plan of ["ENTERPRISE", "STARTER"])
      schools[plan] = await School.create({
        name: "Disposable payroll " + plan,
        code: plan.toLowerCase(),
        slug: plan.toLowerCase(),
        email: plan.toLowerCase() + "@example.invalid",
        phone: "03001234567",
        address: "Disposable fixtures",
        plan,
        status: "ACTIVE",
        teacherCount: 0,
        studentCountRange: "1-200",
      });
    const users = {};
    for (const type of [
      "SCHOOL_ADMIN",
      "TEACHER",
      "FINANCE",
      "EXAM_STAFF",
      "RECEPTIONIST",
      "PARENT",
    ])
      users[type] = await User.create({
        schoolId: schools.ENTERPRISE._id,
        name: "Fixture " + type,
        email: type.toLowerCase() + "@example.invalid",
        passwordHash: hash,
        userType: type,
        status: "ACTIVE",
        roleId: roles[type]._id,
      });
    const other = await User.create({
      schoolId: schools.STARTER._id,
      name: "Other admin",
      email: "other@example.invalid",
      passwordHash: hash,
      userType: "SCHOOL_ADMIN",
      status: "ACTIVE",
      roleId: roles.SCHOOL_ADMIN._id,
    });
    await migrateBranchScopes();
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port + "/api";
    const call = async (path, token, body, method, branch) => {
      const res = await fetch(base + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          ...(branch ? { "X-Acadivo-Branch": branch } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, body: await res.json() };
    };
    const tokens = {};
    for (const [type, user] of Object.entries({ ...users, other })) {
      const r = await call("/auth/login", null, {
        email: user.email,
        password,
      });
      eq(r.status, 200, "login " + type);
      tokens[type] = r.body.data.accessToken;
    }
    const admin = tokens.SCHOOL_ADMIN,
      main = String(schools.ENTERPRISE._id),
      teacher = String(users.TEACHER._id);

    const {
      DOCUMENT_TYPES,
      defaultDocumentStyle,
    } = require("../src/lib/document-templates.ts");
    const {
      IssuedSchoolDocument,
    } = require("../src/server/models/issuedSchoolDocument.model.ts");
    const {
      ClassModel,
      SectionModel,
    } = require("../src/server/models/classSection.model.ts");
    const {
      AcademicSession,
    } = require("../src/server/models/academicSession.model.ts");
    const { Student } = require("../src/server/models/student.model.ts");
    const {
      SchoolAdminService,
    } = require("../src/server/services/schoolAdmin.service.ts");
    const { ExamService } = require("../src/server/services/exam.service.ts");
    const {
      FeeChallan,
      FeePayment,
    } = require("../src/server/models/fee.model.ts");
    const {
      FinanceService,
    } = require("../src/server/services/finance.service.ts");
    const cls = await ClassModel.create({
        schoolId: main,
        name: "Grade 5",
        code: "G5",
        numericLevel: 5,
      }),
      section = await SectionModel.create({
        schoolId: main,
        classId: cls._id,
        className: cls.name,
        name: "A",
      }),
      academic = await AcademicSession.create({
        schoolId: main,
        name: "2026-2027",
        startDate: new Date("2026-08-01"),
        endDate: new Date("2027-06-30"),
        isCurrent: true,
      });
    const foreignScope = String(schools.STARTER._id);
    const foreignConfig = (
      await call(
        "/school-documents/settings",
        tokens.other,
        null,
        "GET",
        foreignScope,
      )
    ).body.data;
    eq(
      (
        await call(
          "/school-documents/settings",
          tokens.other,
          {
            revision: foreignConfig.revision,
            type: "admission",
            style: {
              ...defaultDocumentStyle("admission"),
              family: "institutional",
            },
          },
          "PUT",
          foreignScope,
        )
      ).status,
      200,
      "other school independently selects style",
    );
    eq(
      (await call("/school-documents/settings", admin, null, "GET", main)).body
        .data.templates.admission.family,
      "modern",
      "other school does not alter main school",
    );
    const sharp = require("sharp"),
      png = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "#b20913" },
      })
        .png()
        .toBuffer();
    eq(
      (
        await call(
          "/schools/logo",
          admin,
          { image: "data:image/png;base64," + png.toString("base64") },
          "PUT",
          main,
        )
      ).status,
      200,
      "real logo decoded and saved",
    );
    eq(
      (
        await call(
          "/schools/logo",
          admin,
          {
            image:
              "data:image/png;base64," + png.subarray(0, 8).toString("base64"),
          },
          "PUT",
          main,
        )
      ).status,
      400,
      "corrupt logo rejected",
    );
    const create = await call(
      "/school-admin/students",
      admin,
      {
        name: "Document fixture",
        dob: "2015-04-15",
        gender: "Male",
        classId: String(cls._id),
        className: cls.name,
        sectionId: String(section._id),
        academicSessionId: String(academic._id),
        address: "Residential fixture",
        permanentAddress: "Permanent fixture",
        nameUrdu: "نمونہ",
        bFormNumber: "0012345678901",
        photoData: "data:image/png;base64," + png.toString("base64"),
        parentInfo: {
          fatherName: "Fixture parent",
          fatherPhone: "03000000000",
        },
        emergencyContact: {
          name: "Guardian",
          phone: "03000000000",
          relation: "Father",
        },
      },
      "POST",
      main,
    );
    eq(create.status, 201, "student identity creation");
    const sid = String(create.body.data._id);
    let config = (
      await call("/school-documents/settings", admin, null, "GET", main)
    ).body.data;
    eq(
      Object.keys(config.templates).length,
      16,
      "sixteen default document styles",
    );
    eq(config.completedAt, undefined, "first-time setup pending");
    const saved = await call(
      "/school-documents/settings",
      admin,
      {
        revision: config.revision,
        type: "admission",
        style: {
          ...defaultDocumentStyle("admission"),
          family: "classic",
          color: "#17445a",
        },
        branding: { principalName: "Authorized fixture principal" },
        complete: true,
      },
      "PUT",
      main,
    );
    eq(saved.status, 200, "style and onboarding persisted");
    eq(
      saved.body.data.templates.admission.family,
      "classic",
      "admission independently styled",
    );
    eq(
      saved.body.data.templates["fee-receipt"].family,
      "modern",
      "other style unchanged",
    );
    eq(!!saved.body.data.completedAt, true, "onboarding completed");
    eq(
      (
        await call(
          "/school-documents/settings",
          admin,
          { revision: 0, complete: true },
          "PUT",
          main,
        )
      ).status,
      409,
      "stale revision rejected",
    );
    eq(
      (
        await call(
          "/school-documents/settings",
          tokens.FINANCE,
          null,
          "GET",
          main,
        )
      ).status,
      403,
      "finance cannot edit template configuration",
    );
    eq(
      (
        await call(
          "/school-documents/style?type=fee-receipt",
          tokens.FINANCE,
          null,
          "GET",
          main,
        )
      ).status,
      200,
      "finance can read its document style",
    );
    eq(
      (
        await call(
          "/school-documents/preview",
          tokens.FINANCE,
          { type: "admission", studentId: sid },
          "POST",
          main,
        )
      ).status,
      403,
      "finance cannot generate admissions",
    );
    eq(
      (
        await call(
          "/school-documents/preview",
          tokens.TEACHER,
          { type: "admission", studentId: sid },
          "POST",
          main,
        )
      ).status,
      403,
      "teacher cannot bypass document permission",
    );
    eq(
      (
        await call(
          "/school-documents/preview",
          tokens.other,
          { type: "admission", studentId: sid },
          "POST",
          String(schools.STARTER._id),
        )
      ).status,
      404,
      "foreign tenant document denied",
    );
    const preview = (
      await call(
        "/school-documents/preview",
        admin,
        { type: "admission", studentId: sid },
        "POST",
        main,
      )
    ).body.data;
    eq(preview.student.bFormNumber, "0012345678901", "B-Form live data");
    eq(
      preview.student.permanentAddress,
      "Permanent fixture",
      "optional addresses persisted",
    );
    eq(preview.style.family, "classic", "selected style applied");
    eq(
      preview.photo.startsWith("data:image/webp"),
      true,
      "private real photo hydrated",
    );
    const current = (
      await call("/school-documents/settings", admin, null, "GET", main)
    ).body.data;
    eq(
      (
        await call(
          "/school-documents/settings",
          admin,
          {
            revision: current.revision,
            type: "admission",
            style: {
              ...defaultDocumentStyle("admission"),
              sectionOrder: ["student", "student", "parents", "medical"],
            },
          },
          "PUT",
          main,
        )
      ).status,
      400,
      "duplicate section order rejected",
    );
    eq(
      (
        await call(
          "/school-documents/settings",
          admin,
          {
            revision: current.revision,
            branding: { signature: "data:image/svg+xml;base64,PHN2Zz4=" },
          },
          "PUT",
          main,
        )
      ).status,
      400,
      "unsafe signature format rejected",
    );
    const requestId = crypto.randomUUID(),
      input = { type: "admission", studentId: sid, requestId };
    const issuance = await Promise.all([
      call("/school-documents/issue", admin, input, "POST", main),
      call("/school-documents/issue", admin, input, "POST", main),
    ]);
    for (const r of issuance) eq(r.status, 200, "concurrent document issue");
    eq(
      await IssuedSchoolDocument.countDocuments({ schoolId: main, requestId }),
      1,
      "one immutable archived document",
    );
    const issued = issuance[0].body.data;
    eq(
      await AuditLog.countDocuments({
        schoolId: main,
        action: "SCHOOL_DOCUMENT_ARCHIVED",
      }),
      1,
      "one issue audit",
    );
    eq(
      (
        await call(
          "/school-documents/issue",
          admin,
          { ...input, type: "registration" },
          "POST",
          main,
        )
      ).status,
      409,
      "request ID mismatch blocked",
    );
    eq(
      (
        await call(
          "/school-admin/students/" + sid,
          admin,
          { name: "Changed student", photoData: null },
          "PUT",
          main,
        )
      ).status,
      200,
      "edit live record and remove photo",
    );
    config = (
      await call("/school-documents/settings", admin, null, "GET", main)
    ).body.data;
    eq(
      (
        await call(
          "/school-documents/settings",
          admin,
          {
            revision: config.revision,
            type: "admission",
            style: defaultDocumentStyle("admission"),
          },
          "PUT",
          main,
        )
      ).status,
      200,
      "change current style",
    );
    const archived = (
      await call(
        "/school-documents/issued/" + issued._id,
        admin,
        null,
        "GET",
        main,
      )
    ).body.data;
    eq(
      archived.snapshot.student.name,
      "Document fixture",
      "archived student unchanged",
    );
    eq(archived.snapshot.style.family, "classic", "archived style unchanged");
    eq(
      archived.snapshot.photo.startsWith("data:image/webp"),
      true,
      "archived photo survives live deletion",
    );
    eq(
      (
        await call(
          "/school-documents/issued/" + issued._id,
          tokens.other,
          null,
          "GET",
          String(schools.STARTER._id),
        )
      ).status,
      404,
      "foreign archive denied",
    );
    const challan = await FeeChallan.create({
      schoolId: main,
      studentId: sid,
      studentName: "Changed student",
      classId: cls._id,
      className: cls.name,
      rollNumber: "5-A-1",
      challanNumber: "DOC-CHALLAN",
      month: "October 2026",
      dueDate: new Date(),
      feeBreakdown: { tuitionFee: 1000 },
      totalAmountPKR: 1000,
      remainingAmountPKR: 1000,
      status: "PENDING",
    });
    eq(
      (
        await call(
          "/finance/collect-payment",
          tokens.FINANCE,
          {
            challanId: String(challan._id),
            amountPKR: 400,
            paymentMethod: "Cash",
            requestId: crypto.randomUUID(),
          },
          "POST",
          main,
        )
      ).status,
      200,
      "real payment fixture",
    );
    const payment = await FeePayment.findOne({ challanId: challan._id });
    const receipt = (
      await call(
        "/school-documents/preview",
        tokens.FINANCE,
        { type: "fee-receipt", studentId: sid, paymentId: String(payment._id) },
        "POST",
        main,
      )
    ).body.data;
    eq(receipt.payment.amountPKR, 400, "receipt uses actual partial payment");
    eq(
      receipt.payment.balanceAfterPKR,
      600,
      "receipt preserves payment balance",
    );
    for (const type of [
      "registration",
      "student-profile",
      "student-id",
      "transcript",
      "fee-statement",
    ])
      eq(
        (
          await call(
            "/school-documents/preview",
            admin,
            { type, studentId: sid },
            "POST",
            main,
          )
        ).status,
        200,
        type + " real document",
      );
    eq(
      (
        await call(
          "/school-documents/preview",
          admin,
          {
            type: "attendance",
            studentId: sid,
            from: "2026-10-01",
            to: "2026-10-13",
          },
          "POST",
          main,
        )
      ).status,
      200,
      "real empty attendance does not invent records",
    );
    // Bulk certificate issuance uses the same snapshots, audit and school scope as single issuance.
    const { CertificateRecord } = require("../src/server/models/exam.model.ts");
    const templateStudent = (await Student.findById(sid)).toObject();
    const secondStudent = await Student.create({
      ...templateStudent,
      _id: new mongoose.Types.ObjectId(),
      name: "Second certificate fixture",
      studentId: "CERT-BULK-2",
      admissionNumber: "CERT-BULK-2",
      rollNumber: "CERT-2",
    });
    const libraryScope = {
      classId: String(cls._id),
      academicSessionId: String(academic._id),
    };
    const beforeLibraryForms = await CertificateRecord.countDocuments({
      schoolId: main,
    });
    const formClass = await call(
      "/school-documents/bulk-preview",
      admin,
      { ...libraryScope, document: { type: "admission" } },
      "POST",
      main,
    );
    eq(formClass.status, 200, "class admission forms print without issuance");
    eq(
      formClass.body.data.documents.length,
      2,
      "all class forms prepared directly",
    );
    eq(
      await CertificateRecord.countDocuments({ schoolId: main }),
      beforeLibraryForms,
      "form printing does not issue certificates",
    );
    const missingClass = await call(
      "/school-documents/bulk-preview",
      admin,
      { ...libraryScope, document: { type: "transfer" } },
      "POST",
      main,
    );
    eq(
      missingClass.body.data.skipped.length,
      2,
      "library identifies students missing certificates",
    );
    eq(
      missingClass.body.data.skipped.every((row) => row.studentId),
      true,
      "missing students include authorized IDs for bulk issuance",
    );
    const libraryIssue = {
      classId: String(cls._id),
      type: "TRANSFER",
      studentIds: missingClass.body.data.skipped.map((row) => row.studentId),
      requestId: crypto.randomUUID(),
      onlyIfMissing: true,
    };
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          admin,
          libraryIssue,
          "POST",
          main,
        )
      ).status,
      201,
      "library issues missing certificates together",
    );
    const libraryCount = await CertificateRecord.countDocuments({
      schoolId: main,
    });
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          admin,
          { ...libraryIssue, requestId: crypto.randomUUID() },
          "POST",
          main,
        )
      ).status,
      201,
      "missing-only action reuses existing certificates",
    );
    eq(
      await CertificateRecord.countDocuments({ schoolId: main }),
      libraryCount,
      "missing-only action never reissues existing certificates",
    );
    const preparedClass = await call(
      "/school-documents/bulk-preview",
      admin,
      { ...libraryScope, document: { type: "transfer" } },
      "POST",
      main,
    );
    eq(
      preparedClass.body.data.documents.length,
      2,
      "issued class now prepares for printing",
    );
    eq(
      preparedClass.body.data.skipped.length,
      0,
      "no missing certificates after class issuance",
    );
    const choiceList = await call(
      "/school-documents/choices?type=transfer",
      admin,
      null,
      "GET",
      main,
    );
    eq(
      choiceList.body.data.certificates.every((c) => c.type === "TRANSFER"),
      true,
      "individual selector contains only matching certificate category",
    );
    const countBeforeMissingRace = await CertificateRecord.countDocuments({
      schoolId: main,
    });
    const missingRace = await Promise.all([
      call(
        "/exams/certificates/bulk-issue",
        admin,
        { ...libraryIssue, type: "LEAVING", requestId: crypto.randomUUID() },
        "POST",
        main,
      ),
      call(
        "/exams/certificates/bulk-issue",
        admin,
        { ...libraryIssue, type: "LEAVING", requestId: crypto.randomUUID() },
        "POST",
        main,
      ),
    ]);
    eq(
      missingRace.every((r) => r.status === 201),
      true,
      "concurrent missing-only class requests complete safely",
    );
    eq(
      await CertificateRecord.countDocuments({ schoolId: main }),
      countBeforeMissingRace + 2,
      "concurrent missing-only requests issue each student only once",
    );
    const bulkInput = {
      type: "BONAFIDE",
      classId: String(cls._id),
      studentIds: [sid, String(secondStudent._id)],
      reason: "Bulk fixture request",
      conductRemarks: "Fixture conduct",
      requestId: crypto.randomUUID(),
    };
    const batchResponse = await call(
      "/exams/certificates/bulk-issue",
      admin,
      bulkInput,
      "POST",
      main,
    );
    eq(batchResponse.status, 201, "selected students issued together");
    eq(batchResponse.body.data.count, 2, "two certificates issued");
    eq(
      new Set(
        batchResponse.body.data.certificates.map((c) => c.certificateNumber),
      ).size,
      2,
      "unique certificate numbers",
    );
    const beforeReplay = await CertificateRecord.countDocuments({
      schoolId: main,
    });
    const beforeAudit = await AuditLog.countDocuments({
      schoolId: main,
      action: "CERTIFICATE_ISSUED",
    });
    const replay = await call(
      "/exams/certificates/bulk-issue",
      admin,
      bulkInput,
      "POST",
      main,
    );
    eq(replay.status, 201, "same batch safely replayed");
    eq(
      await CertificateRecord.countDocuments({ schoolId: main }),
      beforeReplay,
      "no duplicate certificates on retry",
    );
    eq(
      await AuditLog.countDocuments({
        schoolId: main,
        action: "CERTIFICATE_ISSUED",
      }),
      beforeAudit,
      "no duplicate audit on retry",
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          admin,
          { ...bulkInput, type: "TRANSFER" },
          "POST",
          main,
        )
      ).status,
      409,
      "changed retry payload rejected",
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          admin,
          { ...bulkInput, studentIds: [sid, sid] },
          "POST",
          main,
        )
      ).status,
      400,
      "duplicate student IDs rejected",
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          null,
          bulkInput,
          "POST",
          main,
        )
      ).status,
      401,
      "unauthenticated bulk issue denied",
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          tokens.TEACHER,
          bulkInput,
          "POST",
          main,
        )
      ).status,
      403,
      "unauthorized role denied",
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          tokens.other,
          bulkInput,
          "POST",
          foreignScope,
        )
      ).status,
      403,
      "foreign school request denied by plan/permission checks",
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          admin,
          {
            ...bulkInput,
            requestId: crypto.randomUUID(),
            studentIds: [sid, String(new mongoose.Types.ObjectId())],
          },
          "POST",
          main,
        )
      ).status,
      400,
      "mixed invalid selection rejected",
    );
    eq(
      await CertificateRecord.countDocuments({ schoolId: main }),
      beforeReplay,
      "invalid batch writes nothing",
    );
    await assert.rejects(
      () =>
        ExamService.issueClassCertificates(
          foreignScope,
          { ...bulkInput, requestId: crypto.randomUUID() },
          "Foreign fixture",
        ),
      (error) => error.statusCode === 404,
    );
    checks++;
    const wholeClass = await call(
      "/exams/certificates/bulk-issue",
      admin,
      {
        ...bulkInput,
        studentIds: undefined,
        type: "CHARACTER",
        requestId: crypto.randomUUID(),
      },
      "POST",
      main,
    );
    eq(wholeClass.status, 201, "whole class issued together");
    eq(wholeClass.body.data.count, 2, "whole class includes both students");
    for (const cert of batchResponse.body.data.certificates) {
      const preview = await call(
        "/school-documents/preview",
        admin,
        {
          type: "bonafide",
          studentId: String(cert.studentId),
          certificateId: cert._id,
        },
        "POST",
        main,
      );
      eq(
        preview.status,
        200,
        "each bulk certificate can use real print preview",
      );
      eq(
        preview.body.data.certificate.certificateNumber,
        cert.certificateNumber,
        "preview retains issued certificate number",
      );
    }
    const concurrentInput = { ...bulkInput, requestId: crypto.randomUUID() };
    const countBeforeConcurrent = await CertificateRecord.countDocuments({
      schoolId: main,
    });
    const concurrentResponses = await Promise.all([
      call(
        "/exams/certificates/bulk-issue",
        admin,
        concurrentInput,
        "POST",
        main,
      ),
      call(
        "/exams/certificates/bulk-issue",
        admin,
        concurrentInput,
        "POST",
        main,
      ),
    ]);
    eq(
      concurrentResponses.every((r) => [201, 409].includes(r.status)),
      true,
      "concurrent requests handled safely",
    );
    eq(
      await CertificateRecord.countDocuments({ schoolId: main }),
      countBeforeConcurrent + 2,
      "concurrent batch creates one certificate per student",
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          admin,
          concurrentInput,
          "POST",
          main,
        )
      ).status,
      201,
      "concurrent batch can be retrieved after completion",
    );
    const printBatch = await call(
      "/school-documents/certificates/bulk-preview",
      admin,
      {
        certificateIds: batchResponse.body.data.certificates.map((c) => c._id),
      },
      "POST",
      main,
    );
    eq(
      printBatch.status,
      200,
      "issued batch can be prepared together for print",
    );
    eq(
      printBatch.body.data.documents.length,
      2,
      "both issued documents returned for bulk print",
    );
    eq(
      printBatch.body.data.documents[0].certificate.certificateNumber,
      batchResponse.body.data.certificates[0].certificateNumber,
      "bulk print preserves requested certificate identity",
    );
    eq(
      (
        await call(
          "/school-documents/certificates/bulk-preview",
          admin,
          {
            certificateIds: [
              batchResponse.body.data.certificates[0]._id,
              String(new mongoose.Types.ObjectId()),
            ],
          },
          "POST",
          main,
        )
      ).status,
      404,
      "unavailable certificate rejects whole print batch",
    );
    eq(
      (
        await call(
          "/school-documents/certificates/bulk-preview",
          null,
          {
            certificateIds: batchResponse.body.data.certificates.map(
              (c) => c._id,
            ),
          },
          "POST",
          main,
        )
      ).status,
      401,
      "anonymous bulk certificate print blocked",
    );
    const beforeRollback = await CertificateRecord.countDocuments({
      schoolId: main,
    });
    const auditBeforeRollback = await AuditLog.countDocuments({
      schoolId: main,
      action: "CERTIFICATE_ISSUED",
    });
    await Student.updateOne(
      { _id: secondStudent._id },
      { $unset: { rollNumber: 1 } },
    );
    eq(
      (
        await call(
          "/exams/certificates/bulk-issue",
          admin,
          { ...bulkInput, requestId: crypto.randomUUID() },
          "POST",
          main,
        )
      ).status >= 400,
      true,
      "invalid certificate in batch fails safely",
    );
    eq(
      await CertificateRecord.countDocuments({ schoolId: main }),
      beforeRollback,
      "failed batch rolls back issued certificates",
    );
    eq(
      await AuditLog.countDocuments({
        schoolId: main,
        action: "CERTIFICATE_ISSUED",
      }),
      auditBeforeRollback,
      "failed batch rolls back audit records",
    );
    await Student.updateOne(
      { _id: secondStudent._id },
      { $set: { rollNumber: "CERT-2" } },
    );
    const individualCert = await call(
      "/exams/certificates",
      admin,
      {
        type: "BONAFIDE",
        classId: String(cls._id),
        studentId: sid,
        reason: "Individual fixture",
      },
      "POST",
      main,
    );
    eq(individualCert.status, 201, "existing individual issuance still works");
    eq(
      (
        await call(
          "/school-documents/preview",
          admin,
          {
            type: "bonafide",
            studentId: sid,
            certificateId: individualCert.body.data._id,
          },
          "POST",
          main,
        )
      ).status,
      200,
      "individual issued certificate prints through existing preview",
    );
    for (const [type, certificateType] of Object.entries({
      character: "CHARACTER",
      leaving: "LEAVING",
      bonafide: "BONAFIDE",
      transfer: "TRANSFER",
    })) {
      const cert = await ExamService.issueCertificate(
        main,
        {
          type: certificateType,
          studentId: sid,
          conductRemarks: "Fixture approved remarks",
        },
        "Fixture issuer",
      );
      eq(
        (
          await call(
            "/school-documents/preview",
            admin,
            { type, studentId: sid, certificateId: String(cert._id) },
            "POST",
            main,
          )
        ).status,
        200,
        type + " existing certificate",
      );
    }
    eq(
      (
        await call(
          "/school-documents/preview",
          admin,
          { type: "general-certificate", studentId: sid },
          "POST",
          main,
        )
      ).status,
      400,
      "official statement required",
    );
    eq(
      (
        await call(
          "/school-documents/preview",
          admin,
          {
            type: "general-certificate",
            studentId: sid,
            statement: "Authorized fixture statement",
          },
          "POST",
          main,
        )
      ).status,
      200,
      "authorized general certificate",
    );
    eq(
      (
        await call(
          "/school-documents/preview",
          admin,
          { type: "staff-id", staffId: teacher },
          "POST",
          main,
        )
      ).status,
      200,
      "staff ID actual user",
    );
    eq(
      (
        await call(
          "/school-documents/preview",
          admin,
          {
            type: "experience",
            staffId: teacher,
            statement: "Authorized fixture employment statement",
          },
          "POST",
          main,
        )
      ).status,
      200,
      "experience statement with actual staff",
    );
    eq(
      (
        await call(
          "/school-documents/preview",
          admin,
          {
            type: "report-card",
            studentId: sid,
            examId: crypto.randomBytes(12).toString("hex"),
          },
          "POST",
          main,
        )
      ).status,
      404,
      "missing exam result never fabricated",
    );
    const { Subject } = require("../src/server/models/subject.model.ts");
    const subject = await Subject.create({
      schoolId: main,
      classId: cls._id,
      className: cls.name,
      name: "Mathematics",
      code: "MATH",
      totalMarks: 100,
      passingMarks: 40,
    });
    const exam = await ExamService.createExam(main, {
      title: "Document Mid-Term",
      term: "MID_TERM",
      academicSessionId: String(academic._id),
      classes: [String(cls._id)],
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-15"),
    });
    await ExamService.saveMarksEntry(
      main,
      {
        examId: String(exam._id),
        classId: String(cls._id),
        subjectId: String(subject._id),
        subjectName: subject.name,
        maxMarks: 100,
        passingMarks: 40,
        records: [
          {
            studentId: sid,
            studentName: "Changed student",
            rollNumber: "5-A-1",
            obtainedMarks: 82,
          },
        ],
      },
      "Fixture examiner",
    );
    await ExamService.processResults(
      main,
      String(exam._id),
      String(cls._id),
      "Fixture examiner",
    );
    const report = await call(
      "/school-documents/preview",
      tokens.EXAM_STAFF,
      { type: "report-card", studentId: sid, examId: String(exam._id) },
      "POST",
      main,
    );
    eq(report.status, 200, "examination portal real report");
    eq(
      report.body.data.result.totalObtainedMarks,
      82,
      "processed marks unchanged",
    );
    eq(
      report.body.data.result.percentage,
      82,
      "processed percentage unchanged",
    );
    console.log(
      "PASS: " +
        checks +
        " real HTTP/MongoDB document-style, onboarding, snapshot, storage, audit and role/tenant checks.",
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    for (const filename of fs.readdirSync(provisionDir))
      fs.unlinkSync(path.join(provisionDir, filename));
    fs.rmdirSync(provisionDir);
    if (server) await new Promise((r) => server.close(r));
    if (connected) {
      if (
        mongoose.connection.name !== dbName ||
        !dbName.startsWith("acadivo_workforce_test_")
      )
        throw Error("Unsafe database cleanup");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
})();
