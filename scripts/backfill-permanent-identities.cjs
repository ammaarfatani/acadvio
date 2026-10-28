// Explicit opt-in migration. Does not read .env and never changes existing real IDs.
const fs = require("fs"),
  ts = require("typescript"),
  mongoose = require("mongoose");
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
if (
  !process.env.MIGRATION_MONGODB_URI ||
  !mongoose.isValidObjectId(process.env.MIGRATION_SCHOOL_ID)
)
  throw Error(
    "Set MIGRATION_MONGODB_URI and MIGRATION_SCHOOL_ID explicitly. The project .env is not loaded.",
  );
const apply = process.argv.includes("--apply"),
  schoolId = new mongoose.Types.ObjectId(process.env.MIGRATION_SCHOOL_ID);
(async () => {
  try {
    await mongoose.connect(process.env.MIGRATION_MONGODB_URI);
    const {
      permanentIdentity,
      ensureEmployeeIdentity,
    } = require("../src/server/services/permanentIdentity.service.ts");
    const db = mongoose.connection.db;
    const people = await db
        .collection("users")
        .find(
          { schoolId, userType: { $nin: ["PARENT", "SUPER_ADMIN"] } },
          { projection: { _id: 1, schoolId: 1, userType: 1, employeeId: 1 } },
        )
        .toArray(),
      students = await db
        .collection("students")
        .find(
          { schoolId },
          { projection: { _id: 1, studentId: 1, admissionNumber: 1 } },
        )
        .toArray();
    const conflicts = [];
    let changed = 0;
    // Preflight all legacy collisions before any writes, including employment/profile IDs.
    const seen = new Map();
    for (const person of people) {
      const ids = [];
      if (person.employeeId) ids.push(person.employeeId);
      for (const collection of ["staffemployments", "teacherprofiles"]) {
        const row = await db
          .collection(collection)
          .findOne({ schoolId, userId: person._id });
        if (row?.employeeId && row.employeeId !== String(person._id))
          ids.push(row.employeeId);
      }
      const values = [...new Set(ids)];
      if (values.length > 1)
        conflicts.push({
          record: String(person._id),
          problem: "Conflicting employee IDs",
        });
      for (const value of values) {
        const key = "employee:" + value;
        if (seen.has(key) && seen.get(key) !== String(person._id))
          conflicts.push({
            record: String(person._id),
            problem: "Duplicate employee ID",
          });
        seen.set(key, String(person._id));
      }
    }
    for (const person of students) {
      for (const field of ["studentId", "admissionNumber"]) {
        if (!person[field]) continue;
        const key = field + ":" + person[field];
        if (seen.has(key))
          conflicts.push({
            record: String(person._id),
            problem: "Duplicate " + field,
          });
        seen.set(key, String(person._id));
      }
    }
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          employees: people.length,
          students: students.length,
          missingEmployeeIds: people.filter((p) => !p.employeeId).length,
          missingStudentIds: students.filter((p) => !p.studentId).length,
          conflicts,
        },
        null,
        2,
      ),
    );
    if (conflicts.length)
      throw Error(
        "Resolve reported conflicts before applying. No records were changed.",
      );
    if (apply) {
      for (const person of people) {
        await ensureEmployeeIdentity(person);
        changed++;
      }
      for (const person of students) {
        const studentId = await permanentIdentity(
            schoolId,
            "student",
            person._id,
            person.studentId || undefined,
          ),
          admissionNumber = await permanentIdentity(
            schoolId,
            "admission",
            person._id,
            person.admissionNumber || undefined,
          );
        await db
          .collection("students")
          .updateOne(
            { _id: person._id, schoolId },
            { $set: { studentId, admissionNumber } },
          );
        changed++;
      }
      console.log(
        "Applied identity reservations/backfill for " +
          changed +
          " records. Existing real identifiers preserved.",
      );
    }
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
