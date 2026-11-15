import mongoose from "mongoose";
import { formatNumberedIdentifier, normalizeNumberFormat, parseNumberedIdentifier } from "./identityNumbering.util";
const identityIndexes = new WeakMap<object, Promise<unknown>>();
// This registry deliberately has no branch plugin: identifiers are school-wide,
// including archived/deleted people. Reservations are never deleted or recycled.
export async function permanentIdentity(
  schoolId: any,
  kind: "employee" | "student" | "admission",
  subjectId: any,
  legacy?: string,
): Promise<string> {
  const db = mongoose.connection.db!;
  const registry = db.collection("permanentidentities"),
    counters = db.collection("identitysequences");
  let ready = identityIndexes.get(db);
  if (!ready) {
    ready = Promise.all([
      registry.createIndex(
        { schoolId: 1, kind: 1, value: 1 },
        { unique: true },
      ),
      registry.createIndex(
        { schoolId: 1, kind: 1, subjectId: 1 },
        { unique: true },
      ),
    ]);
    identityIndexes.set(db, ready);
  }
  try {
    await ready;
  } catch (error) {
    identityIndexes.delete(db);
    throw error;
  }
  const school = String(schoolId),
    subject = String(subjectId),
    key = { schoolId: school, kind, subjectId: subject };
  const previous = await registry.findOne(key);
  if (previous) {
    if (legacy && previous.value !== legacy)
      throw { statusCode: 409, message: "Permanent ID cannot be changed." };
    return String(previous.value);
  }
  const schoolConfig = await db.collection("schools").findOne(
    { _id: new mongoose.Types.ObjectId(school) },
    { projection: { "documentSettings.numbering": 1 } },
  );
  const defaults: Record<string, any> = {
    employee: { prefix: "EMPD", startAt: 1, padding: 3 },
    student: { prefix: "STUD", startAt: 1, padding: 3 },
    admission: { prefix: "ADM-", startAt: 1, padding: 6 },
  };
  const format = normalizeNumberFormat(schoolConfig?.documentSettings?.numbering?.[kind] || {}, defaults[kind]);
  const prefix = format.prefix;
  const startAt = format.startAt;
  const counterKey = school + ":" + kind + ":" + prefix;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!(await counters.findOne({ _id: counterKey as any }))) {
    const collections =
      kind === "employee"
        ? ["users", "staffemployments", "teacherprofiles"]
        : ["students"];
    let max = startAt - 1;
    for (const name of collections) {
      const field =
        kind === "employee"
          ? "employeeId"
          : kind === "student"
            ? "studentId"
            : "admissionNumber";
      const rows = await db
        .collection(name)
        .find(
          {
            schoolId: new mongoose.Types.ObjectId(school),
            [field]: { $regex: "^" + escapedPrefix + "[0-9]+$" },
          },
          { projection: { [field]: 1 } },
        )
        .toArray();
      for (const row of rows) {
        const parsed = parseNumberedIdentifier(String(row[field]), prefix);
        if (parsed !== null) max = Math.max(max, parsed);
      }
    }
    try {
      await counters.updateOne(
        { _id: counterKey as any },
        { $max: { value: max } },
        { upsert: true },
      );
    } catch (e: any) {
      if (e.code !== 11000) throw e;
    }
  }
  // A later administrator change may raise the configured starting number.
  await counters.updateOne({ _id: counterKey as any }, { $max: { value: startAt - 1 } }, { upsert: true });
  for (let attempt = 0; attempt < 100; attempt++) {
    let value = legacy;
    if (!value) {
      const count = await counters.findOneAndUpdate(
        { _id: counterKey as any },
        { $inc: { value: 1 } },
        { upsert: true, returnDocument: "after" },
      );
      value = formatNumberedIdentifier(count!.value, format);
    }
    // Includes legacy records not yet backfilled. No scope narrowing is allowed here.
    const collision =
      kind === "employee"
        ? await Promise.all([
            db.collection("users").findOne({
              schoolId: new mongoose.Types.ObjectId(school),
              employeeId: value,
              _id: { $ne: new mongoose.Types.ObjectId(subject) },
            }),
            db.collection("staffemployments").findOne({
              schoolId: new mongoose.Types.ObjectId(school),
              employeeId: value,
              userId: { $ne: new mongoose.Types.ObjectId(subject) },
            }),
            db.collection("teacherprofiles").findOne({
              schoolId: new mongoose.Types.ObjectId(school),
              employeeId: value,
              userId: { $ne: new mongoose.Types.ObjectId(subject) },
            }),
          ])
        : [
            await db.collection("students").findOne({
              schoolId: new mongoose.Types.ObjectId(school),
              [kind === "student" ? "studentId" : "admissionNumber"]: value,
              _id: { $ne: new mongoose.Types.ObjectId(subject) },
            }),
          ];
    if (collision.some(Boolean)) {
      if (legacy)
        throw {
          statusCode: 409,
          message:
            "Duplicate legacy ID requires administrator review before backfill.",
        };
      continue;
    }
    try {
      await registry.insertOne({ ...key, value, createdAt: new Date() });
      const legacySequence = legacy ? parseNumberedIdentifier(legacy, prefix) : null;
      if (legacySequence !== null)
        await counters.updateOne(
          { _id: counterKey as any },
          { $max: { value: legacySequence } },
          { upsert: true },
        );
      return value!;
    } catch (e: any) {
      if (e.code !== 11000) throw e;
      const winner = await registry.findOne(key);
      if (winner) return String(winner.value);
      if (legacy)
        throw {
          statusCode: 409,
          message: "Legacy ID is already reserved for another person.",
        };
    }
  }
  throw {
    statusCode: 503,
    message: "ID allocation is busy. Retry the request.",
  };
}
export async function ensureEmployeeIdentity(user: any) {
  if (!user.schoolId || ["PARENT", "SUPER_ADMIN"].includes(user.userType))
    return undefined;
  const db = mongoose.connection.db!,
    filter = {
      schoolId: new mongoose.Types.ObjectId(String(user.schoolId)),
      userId: new mongoose.Types.ObjectId(String(user._id)),
    };
  const [employment, profile] = await Promise.all([
    db.collection("staffemployments").findOne(filter),
    db.collection("teacherprofiles").findOne(filter),
  ]);
  // Old employment IDs sometimes contain the internal User ID, never print these.
  const values = [
    user.employeeId,
    employment?.employeeId,
    profile?.employeeId,
  ].filter((x: any) => x && x !== String(user._id));
  if (new Set(values).size > 1)
    throw {
      statusCode: 409,
      message: "Conflicting legacy employee IDs require administrator review.",
    };
  const value = await permanentIdentity(
    user.schoolId,
    "employee",
    user._id,
    values[0],
  );
  if (!user.employeeId)
    await db.collection("users").updateOne(
      {
        _id: user._id,
        schoolId: user.schoolId,
        employeeId: { $exists: false },
      },
      { $set: { employeeId: value } },
    );
  await db
    .collection("staffemployments")
    .updateMany(filter, { $set: { employeeId: value } });
  await db
    .collection("teacherprofiles")
    .updateMany(filter, { $set: { employeeId: value } });
  return value;
}
