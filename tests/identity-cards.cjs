if (
  !/^mongodb:\/\/(127\.0\.0\.1|localhost):27018\//.test(
    process.env.MONGODB_URI || "",
  )
)
  throw Error("Only isolated local MongoDB port 27018 is permitted.");
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
    ClassModel,
    SectionModel,
  } = require("../src/server/models/classSection.model.ts"),
  {
    AcademicSession,
  } = require("../src/server/models/academicSession.model.ts"),
  { ParentProfile } = require("../src/server/models/parentProfile.model.ts"),
  { IdentityCard } = require("../src/server/models/identityCard.model.ts"),
  { AuditLog } = require("../src/server/models/auditLog.model.ts"),
  {
    ROLE_PERMISSION_MAP,
  } = require("../src/server/constants/permissions.constant.ts"),
  { hashPassword } = require("../src/server/utils/password.util.ts"),
  {
    migrateBranchScopes,
  } = require("../src/server/services/branchMigration.service.ts");
let checks = 0,
  server;
const eq = (a, b, label) => {
  assert.equal(a, b, label);
  checks++;
};
const password = crypto.randomBytes(12).toString("hex"),
  dbName = "acadivo_identity_test_" + crypto.randomBytes(6).toString("hex");
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName });
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    const roles = {};
    for (const type of Object.keys(ROLE_PERMISSION_MAP))
      roles[type] = await Role.create({
        name: type,
        code: "ROLE_" + type,
        userType: type,
        permissions: ROLE_PERMISSION_MAP[type],
        isSystemRole: true,
      });
    const hash = await hashPassword(password),
      schools = [];
    for (let i = 0; i < 2; i++)
      schools.push(
        await School.create({
          name: "Disposable Identity School " + i,
          code: "identity" + i,
          slug: "identity" + i,
          email: "school" + i + "@example.invalid",
          phone: "03000000000",
          address: "Local only",
          plan: "ENTERPRISE",
          status: "ACTIVE",
          studentCountRange: "1-200",
          teacherCount: 0,
        }),
      );
    const users = {};
    for (const type of [
      "SCHOOL_ADMIN",
      "TEACHER",
      "FINANCE",
      "RECEPTIONIST",
      "EXAM_STAFF",
      "PARENT",
    ])
      users[type] = await User.create({
        schoolId: schools[0]._id,
        name: "Demo " + type,
        email: type.toLowerCase() + "@example.invalid",
        passwordHash: hash,
        userType: type,
        roleId: roles[type]._id,
        status: "ACTIVE",
      });
    const other = await User.create({
      schoolId: schools[1]._id,
      name: "Other admin",
      email: "other@example.invalid",
      passwordHash: hash,
      userType: "SCHOOL_ADMIN",
      roleId: roles.SCHOOL_ADMIN._id,
      status: "ACTIVE",
    });
    await migrateBranchScopes();
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = "http://127.0.0.1:" + server.address().port + "/api";
    const call = async (path, token, body, method) => {
      const response = await fetch(base + path, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
          "X-Acadivo-Branch": String(schools[0]._id),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      let data;
      try {
        data = JSON.parse(raw);
      } catch {}
      return { status: response.status, data: data?.data, body: data, raw };
    };
    const tokens = {};
    for (const [role, user] of Object.entries({ ...users, other })) {
      const login = await call("/auth/login", null, {
        email: user.email,
        password,
      });
      eq(login.status, 200, "login " + role);
      tokens[role] = login.data.accessToken;
    }
    const admin = tokens.SCHOOL_ADMIN,
      teacher = String(users.TEACHER._id);
    eq(
      /^EMPD\d{3,}$/.test(users.TEACHER.employeeId),
      true,
      "automatic staff ID",
    );
    eq(
      new Set(
        Object.values(users)
          .filter((u) => u.userType !== "PARENT")
          .map((u) => u.employeeId),
      ).size,
      5,
      "all roles unique",
    );
    const parallel = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        call("/users", admin, {
          name: "Concurrent Staff " + i,
          email: "concurrent" + i + "@example.invalid",
          password,
          userType: ["TEACHER", "FINANCE", "RECEPTIONIST", "EXAM_STAFF"][i % 4],
        }),
      ),
    );
    parallel.forEach((r) =>
      eq(r.status, 201, "concurrent HTTP staff creation"),
    );
    eq(
      new Set(parallel.map((r) => r.data.employeeId)).size,
      12,
      "concurrent IDs unique",
    );
    const removed = parallel[0].data;
    await User.deleteOne({ _id: removed.id });
    const replacement = await call("/users", admin, {
      name: "Replacement Teacher",
      email: "replacement@example.invalid",
      password,
      userType: "TEACHER",
    });
    eq(
      replacement.data.employeeId !== removed.employeeId,
      true,
      "deleted ID never reused",
    );
    const cls = await ClassModel.create({
        schoolId: schools[0]._id,
        name: "Class 5",
        code: "G5",
        numericLevel: 5,
      }),
      section = await SectionModel.create({
        schoolId: schools[0]._id,
        classId: cls._id,
        className: "Class 5",
        name: "A",
      }),
      session = await AcademicSession.create({
        schoolId: schools[0]._id,
        name: "2026–2027",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true,
      });
    const studentBody = {
      name: "Demo Student",
      dob: "2015-01-01",
      gender: "Male",
      className: "Class 5",
      classId: String(cls._id),
      sectionId: String(section._id),
      academicSessionId: String(session._id),
      admissionDate: "2026-10-01",
      address: "Local practice only",
      parentInfo: { fatherName: "Demo Parent", fatherPhone: "03000000000" },
      emergencyContact: {
        name: "Demo Parent",
        phone: "03000000000",
        relation: "Father",
      },
    };
    const students = [];
    for (let i = 0; i < 3; i++) {
      const r = await call("/school-admin/students", admin, {
        ...studentBody,
        name: "Demo Student " + i,
      });
      eq(r.status, 201, "create student " + i);
      students.push(r.data);
    }
    eq(new Set(students.map((s) => s.studentId)).size, 3, "student IDs unique");
    const concurrentStudents = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        call("/school-admin/students", admin, {
          ...studentBody,
          name: "Parallel Student " + i,
        }),
      ),
    );
    concurrentStudents.forEach((r) =>
      eq(r.status, 201, "parallel student admission"),
    );
    eq(
      new Set(concurrentStudents.map((r) => r.data.studentId)).size,
      6,
      "parallel student IDs unique",
    );
    eq(
      new Set(concurrentStudents.map((r) => r.data.rollNumber)).size,
      6,
      "parallel roll numbers unique",
    );
    const child = String(students[0]._id);
    await ParentProfile.create({
      schoolId: schools[0]._id,
      userId: users.PARENT._id,
      studentIds: [child],
    });
    let r = await call("/id-cards/staff/" + teacher, admin);
    eq(r.status, 200, "admin preview");
    eq(r.data.status, "PENDING_APPROVAL", "initial pending");
    let preview = r.data;
    eq(
      (await call("/id-cards/staff/" + teacher + "/card.pdf", tokens.TEACHER))
        .status,
      409,
      "pending download denied",
    );
    eq(
      (await call("/id-cards/staff/" + users.FINANCE._id, tokens.TEACHER))
        .status,
      403,
      "staff cannot read another card",
    );
    eq(
      (
        await call("/id-cards/staff/" + teacher + "/review", tokens.FINANCE, {
          action: "issue",
          revision: 0,
          sourceHash: preview.sourceHash,
        })
      ).status,
      403,
      "staff cannot approve",
    );
    r = await call("/id-cards/staff/" + teacher + "/review", admin, {
      action: "issue",
      revision: preview.revision,
      sourceHash: preview.sourceHash,
    });
    eq(r.status, 200, "issue teacher");
    eq(r.data.status, "ISSUED", "issued");
    eq(
      (await call("/id-cards/self", tokens.TEACHER)).data.identifier,
      users.TEACHER.employeeId,
      "own card identifier",
    );
    eq(
      (
        await call(
          "/id-cards/staff/" + teacher + "/photo",
          admin,
          { photo: "data:image/png;base64,YmFk" },
          "PUT",
        )
      ).status,
      400,
      "invalid photo rejected",
    );
    const front = await call(
      "/id-cards/staff/" + teacher + "/front.svg",
      tokens.TEACHER,
    );
    eq(front.status, 200, "private SVG");
    eq(
      front.raw.toString().includes(teacher),
      false,
      "no internal user ID on card",
    );
    eq(
      front.raw.toString().includes("password"),
      false,
      "no credentials on card",
    );
    const pdf = await call(
      "/id-cards/staff/" + teacher + "/card.pdf",
      tokens.TEACHER,
    );
    eq(pdf.status, 200, "own PDF");
    eq(pdf.raw.subarray(0, 4).toString(), "%PDF", "real PDF bytes");
    fs.mkdirSync("artifacts/id-cards", { recursive: true });
    fs.writeFileSync("artifacts/id-cards/staff-card.pdf", pdf.raw);
    fs.writeFileSync("artifacts/id-cards/staff-front.svg", front.raw);
    fs.writeFileSync(
      "artifacts/id-cards/staff-back.svg",
      (await call("/id-cards/staff/" + teacher + "/back.svg", tokens.TEACHER))
        .raw,
    );
    eq(
      (await call("/id-cards/student/" + students[1]._id, tokens.PARENT))
        .status,
      404,
      "unlinked child denied",
    );
    eq(
      (await call("/id-cards/student/" + child, tokens.PARENT)).data.status,
      "PENDING_APPROVAL",
      "linked pending child",
    );
    const childPreview = (await call("/id-cards/student/" + child, admin)).data;
    eq(
      (
        await call("/id-cards/student/" + child + "/review", admin, {
          action: "issue",
          revision: 0,
          sourceHash: childPreview.sourceHash,
        })
      ).status,
      200,
      "issue student",
    );
    const childPdf = await call(
      "/id-cards/student/" + child + "/card.pdf",
      tokens.PARENT,
    );
    eq(childPdf.status, 200, "linked parent download");
    fs.writeFileSync("artifacts/id-cards/student-card.pdf", childPdf.raw);
    eq(
      (await call("/id-cards/student/" + child + "/card.pdf", tokens.other))
        .status,
      403,
      "other school rejected",
    );
    eq(
      (await call("/id-cards/staff/" + teacher + "/card.pdf", null)).status,
      401,
      "anonymous denied",
    );
    eq(
      (
        await call("/id-cards/staff/" + teacher + "/review", admin, {
          action: "revoke",
          revision: 1,
        })
      ).status,
      400,
      "reason required",
    );
    await User.updateOne(
      { _id: teacher },
      { $set: { name: "Updated Demo Teacher" } },
    );
    r = await call("/id-cards/self", tokens.TEACHER);
    eq(r.data.status, "NEEDS_CORRECTION", "profile change invalidates card");
    eq(
      (await call("/id-cards/staff/" + teacher + "/card.pdf", tokens.TEACHER))
        .status,
      409,
      "stale PDF blocked",
    );
    preview = (await call("/id-cards/staff/" + teacher, admin)).data;
    eq(
      (
        await call("/id-cards/staff/" + teacher + "/review", admin, {
          action: "issue",
          revision: preview.revision,
          sourceHash: "a".repeat(64),
        })
      ).status,
      409,
      "stale preview rejected",
    );
    r = await call("/id-cards/staff/" + teacher + "/review", admin, {
      action: "issue",
      revision: preview.revision,
      sourceHash: preview.sourceHash,
    });
    eq(r.data.version, 2, "reissue version");
    eq(r.data.identifier, users.TEACHER.employeeId, "permanent ID preserved");
    const sharp = require("sharp"),
      photo =
        "data:image/png;base64," +
        (
          await sharp({
            create: {
              width: 30,
              height: 40,
              channels: 3,
              background: "#888888",
            },
          })
            .png()
            .toBuffer()
        ).toString("base64");
    eq(
      (
        await call(
          "/id-cards/staff/" + teacher + "/photo",
          tokens.TEACHER,
          { photo },
          "PUT",
        )
      ).status,
      403,
      "staff cannot alter approved photo",
    );
    eq(
      (
        await call(
          "/id-cards/staff/" + teacher + "/photo",
          admin,
          { photo },
          "PUT",
        )
      ).status,
      200,
      "valid photo saved",
    );
    eq(
      (await call("/id-cards/self", tokens.TEACHER)).data.status,
      "NEEDS_CORRECTION",
      "photo change requires review",
    );
    preview = (await call("/id-cards/staff/" + teacher, admin)).data;
    r = await call("/id-cards/staff/" + teacher + "/review", admin, {
      action: "issue",
      revision: preview.revision,
      sourceHash: preview.sourceHash,
    });
    eq(r.data.version, 3, "photo reissue");
    const rev = r.data.revision;
    eq(
      (
        await call("/id-cards/staff/" + teacher + "/review", admin, {
          action: "revoke",
          revision: rev,
          reason: "Lost card",
        })
      ).data.status,
      "REVOKED",
      "revoke",
    );
    eq(
      (await call("/id-cards/staff/" + teacher + "/card.pdf", tokens.TEACHER))
        .status,
      409,
      "revoked download denied",
    );
    const sheet = await call("/id-cards/sheet", admin, {
      cards: [{ kind: "student", id: child }],
    });
    eq(sheet.status, 200, "printable sheet");
    eq(
      (
        await call("/id-cards/sheet", admin, {
          cards: [
            { kind: "student", id: child },
            { kind: "student", id: child },
          ],
        })
      ).status,
      400,
      "duplicate cards rejected",
    );
    const candidates = await call(
      "/id-cards/bulk-candidates?kind=student&search=",
      admin,
    );
    eq(candidates.status, 200, "bounded issued-card bulk candidates");
    eq(
      candidates.json?.data?.ids?.every((id) => typeof id === "string") ??
        candidates.data?.ids?.every((id) => typeof id === "string") ??
        false,
      true,
      "bulk candidates are validated person references",
    );
    fs.writeFileSync("artifacts/id-cards/card-sheet.pdf", sheet.raw);
    eq(
      (
        await call("/school-documents/issue", admin, {
          type: "student-id",
          studentId: child,
          requestId: crypto.randomUUID(),
        })
      ).status,
      409,
      "no alternate issuance bypass",
    );
    eq(
      await AuditLog.countDocuments({ action: "ID_CARD_ISSUED" }),
      4,
      "issue audits",
    );
    const financeId = String(users.FINANCE._id),
      financePreview = (await call("/id-cards/staff/" + financeId, admin)).data;
    const concurrentReview = await Promise.all(
      [1, 2].map(() =>
        call("/id-cards/staff/" + financeId + "/review", admin, {
          action: "issue",
          revision: financePreview.revision,
          sourceHash: financePreview.sourceHash,
        }),
      ),
    );
    eq(
      concurrentReview.filter((r) => r.status === 200).length,
      1,
      "only one concurrent approval commits",
    );
    eq(
      concurrentReview.filter((r) => r.status === 409).length,
      1,
      "stale approval rejected",
    );
    const financeCard = (await call("/id-cards/self", tokens.FINANCE)).data;
    eq(financeCard.status, "ISSUED", "finance sees own issued card");
    eq(
      (await call("/id-cards/verify/" + financeCard.reference, admin)).data
        .valid,
      true,
      "QR verification issued",
    );
    eq(
      (await call("/id-cards/verify/" + financeCard.reference, tokens.PARENT))
        .status,
      403,
      "QR verifier permission enforced",
    );
    const revokedCard = await IdentityCard.findOne({ subjectId: teacher });
    eq(
      (await call("/id-cards/verify/" + revokedCard.reference, admin)).data
        .valid,
      false,
      "revoked QR not valid",
    );
    eq(
      (
        await call("/id-cards/staff/" + teacher + "/review", admin, {
          action: "correction",
          revision: revokedCard.revision,
          reason: "Update the details",
        })
      ).data.status,
      "NEEDS_CORRECTION",
      "return for correction",
    );
    const permanent = students[0].studentId;
    await call(
      "/school-admin/students/" + child,
      admin,
      { studentId: "STOLEN-ID", name: "Corrected Student" },
      "PUT",
    );
    eq(
      (await Student.findById(child)).studentId,
      permanent,
      "student identity immutable on edit",
    );
    eq(
      (await call("/id-cards/student/" + child, tokens.PARENT)).data.status,
      "NEEDS_CORRECTION",
      "child profile edit requires reissue",
    );
    const {
      ensureEmployeeIdentity,
    } = require("../src/server/services/permanentIdentity.service.ts");
    const legacyId = new mongoose.Types.ObjectId();
    await mongoose.connection.db.collection("users").insertOne({
      _id: legacyId,
      schoolId: schools[0]._id,
      branchId: schools[0]._id,
      organizationId: schools[0]._id,
      name: "Legacy Staff",
      email: "legacy@example.invalid",
      userType: "TEACHER",
      status: "ACTIVE",
      passwordHash: hash,
      roleId: roles.TEACHER._id,
    });
    await require("../src/server/models/workforce.model.ts").StaffEmployment.create(
      {
        schoolId: schools[0]._id,
        userId: legacyId,
        employeeId: "LEGACY-901",
        status: "ACTIVE",
      },
    );
    eq(
      await ensureEmployeeIdentity(await User.findById(legacyId)),
      "LEGACY-901",
      "legacy employment ID preserved",
    );
    eq(
      (await User.findById(legacyId)).employeeId,
      "LEGACY-901",
      "legacy ID persisted to user",
    );
    const legacyStudent = await Student.findById(students[1]._id);
    await mongoose.connection.db
      .collection("students")
      .updateOne(
        { _id: legacyStudent._id },
        { $set: { studentId: "LEGACY-STUDENT-55" } },
      );
    const {
      permanentIdentity,
    } = require("../src/server/services/permanentIdentity.service.ts");
    let conflict = false;
    try {
      await permanentIdentity(
        schools[0]._id,
        "student",
        legacyStudent._id,
        "CHANGED-ID",
      );
    } catch (e) {
      conflict = e.statusCode === 409;
    }
    eq(conflict, true, "reserved identity cannot be changed");
    eq(
      (await call("/id-cards?kind=staff&search=Concurrent%20Staff%201", admin))
        .status,
      200,
      "directory search",
    );
    for (const role of ["RECEPTIONIST", "EXAM_STAFF", "SCHOOL_ADMIN"]) {
      const self = (await call("/id-cards/self", tokens[role])).data;
      eq(self.status, "PENDING_APPROVAL", role + " own pending card");
      const p = (await call("/id-cards/staff/" + users[role]._id, admin)).data;
      eq(
        (
          await call("/id-cards/staff/" + users[role]._id + "/review", admin, {
            action: "issue",
            revision: p.revision,
            sourceHash: p.sourceHash,
          })
        ).status,
        200,
        role + " approved card",
      );
      eq(
        (
          await call(
            "/id-cards/staff/" + users[role]._id + "/card.pdf",
            tokens[role],
          )
        ).status,
        200,
        role + " own PDF",
      );
    }
    const {
      normalizeCardImage,
    } = require("../src/server/services/identityCardRender.service.ts");
    eq(
      (await normalizeCardImage("/logo.png")).startsWith(
        "data:image/png;base64,",
      ),
      true,
      "existing local logo supported",
    );
    eq(
      await normalizeCardImage("/../package.json"),
      "",
      "local traversal blocked",
    );
    eq(
      await normalizeCardImage("http://127.0.0.1/private.png"),
      "",
      "remote logo fetches blocked",
    );
    const { Branch } = require("../src/server/models/branch.model.ts");
    const newBranch = await Branch.create({
      organizationId: schools[0]._id,
      name: "Second Practice Branch",
      code: "second",
      address: "Local test branch",
      phone: "03000000000",
      status: "ACTIVE",
    });
    const moving = await User.create({
      schoolId: schools[0]._id,
      isOrganizationOwner: false,
      name: "Moving branch admin",
      email: "moving@example.invalid",
      passwordHash: hash,
      userType: "SCHOOL_ADMIN",
      roleId: roles.SCHOOL_ADMIN._id,
      status: "ACTIVE",
    });
    const movingId = moving.employeeId;
    eq(
      (
        await call(
          "/organization/branches/" + newBranch._id + "/admins/" + moving._id,
          admin,
          {},
          "PATCH",
        )
      ).status,
      200,
      "owner can transfer branch administrator",
    );
    eq(
      (await User.findById(moving._id)).employeeId,
      movingId,
      "branch transfer preserves employee ID",
    );
    const transferred = await IdentityCard.findOne({ subjectId: moving._id });
    eq(
      String(transferred.branchId),
      String(newBranch._id),
      "card follows authorized branch transfer",
    );
    eq(
      transferred.status,
      "NEEDS_CORRECTION",
      "new branch must review transferred card",
    );
    eq(
      (await call("/id-cards/staff/" + moving._id, admin)).status,
      404,
      "previous branch cannot read transferred card",
    );
    eq(
      (
        await call(
          "/workforce/employees/" + users.PARENT._id,
          admin,
          {
            department: "Test",
            designation: "Parent",
            joiningDate: "2026-01-01",
            status: "ACTIVE",
          },
          "PUT",
        )
      ).status,
      404,
      "parent cannot become a payroll employee",
    );
    console.log(
      "PASS: " +
        checks +
        " real HTTP/MongoDB identity, concurrency, approval, authorization, PDF and reissue checks.",
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((r) => server.close(r));
    if (mongoose.connection.readyState) {
      if (!mongoose.connection.name.startsWith("acadivo_identity_test_"))
        throw Error("Unsafe cleanup blocked");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
})();
