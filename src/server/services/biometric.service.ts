import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { School } from "../models/school.model";
import {
  BiometricDevice,
  BiometricPunch,
  StaffAttendance,
} from "../models/workforce.model";
import { branchContext } from "../utils/branchScope";
import {
  audit,
  employee,
  policyFor,
  transaction,
  periodLock,
  unlocked,
  settings,
} from "./workforce.service";
import { attendanceValues, dateKey, scheduledDate } from "./workforceMath";
import { expireTrials } from "./trialLifecycle.service";
function encrypt(secret: string) {
  const key = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw {
      statusCode: 503,
      message:
        "Server BIOMETRIC_ENCRYPTION_KEY must be configured for device credentials.",
    };
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(".");
}
export function decrypt(secret: string) {
  const key = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw { statusCode: 503, message: "Device encryption key unavailable." };
  const [iv, tag, data] = secret.split(".");
  const cipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "base64"),
  );
  cipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    cipher.update(Buffer.from(data, "base64")),
    cipher.final(),
  ]).toString("utf8");
}
export function readiness() {
  const directory = process.env.BIOMETRIC_PROVISION_DIR;
  const resolved = directory ? path.resolve(directory) : "";
  const publicDirectory = path.resolve(process.cwd(), "public");
  return {
    credentialStorageConfigured:
      !!directory &&
      path.isAbsolute(directory) &&
      resolved !== publicDirectory &&
      !resolved.startsWith(publicDirectory + path.sep),
    credentialEncryptionConfigured: /^[a-f0-9]{64}$/i.test(
      process.env.BIOMETRIC_ENCRYPTION_KEY || "",
    ),
  };
}
export async function list(actor: any) {
  const rows: any[] = await BiometricDevice.find({
    schoolId: actor.schoolId,
    demoOnly: { $ne: true },
  }).lean();
  return rows.map((r) => ({
    ...r,
    connectionStatus: !r.enabled
      ? "DISABLED"
      : !r.lastDeviceSuccessAt
        ? "NOT_CONNECTED"
        : Date.now() - r.lastDeviceSuccessAt.getTime() > 180000
          ? "OFFLINE"
          : "ONLINE",
  }));
}
export async function save(actor: any, input: any, id?: string) {
  const config = await settings(actor);
  if (config.mode !== "BIOMETRIC")
    throw {
      statusCode: 409,
      message: "Select biometric mode before configuring a device.",
    };
  await BiometricDevice.init();
  return transaction(async (session) => {
    const previous = id
      ? await BiometricDevice.findOne({
          _id: id,
          schoolId: actor.schoolId,
        }).session(session)
      : null;
    if (id && !previous)
      throw { statusCode: 404, message: "Device not found." };
    if (previous?.demoOnly)
      throw {
        statusCode: 410,
        message:
          "This retired device cannot be used for attendance. Configure a real device.",
      };
    const before = previous ? previous.toObject() : null;
    const { credentials, ...fields } = input;
    const device =
      previous || new BiometricDevice({ schoolId: actor.schoolId, ...fields });
    Object.assign(device, fields);
    if (credentials !== undefined)
      device.credentialsCipher = credentials ? encrypt(credentials) : undefined;
    await device.save({ session });
    await audit(
      actor,
      id ? "DEVICE_UPDATE" : "DEVICE_CREATED",
      "BiometricDevice",
      device._id,
      before,
      { ...fields, credentialsChanged: credentials !== undefined },
      session,
    );
    const row = device.toObject();
    delete row.credentialsCipher;
    delete row.tokenHash;
    return row;
  });
}
export async function rotate(
  actor: any,
  id: string,
  deliver?: (token: string) => Promise<void>,
) {
  return transaction(async (session) => {
    const device = await BiometricDevice.findOne({
      _id: id,
      schoolId: actor.schoolId,
    }).session(session);
    if (!device) throw { statusCode: 404, message: "Device not found." };
    if (device.demoOnly)
      throw {
        statusCode: 409,
        message: "Testing-only devices cannot receive connector credentials.",
      };
    const token = crypto.randomBytes(32).toString("base64url");
    device.tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await device.save({ session });
    if (deliver) await deliver(token);
    await audit(
      actor,
      "DEVICE_CREDENTIAL_ROTATED",
      "BiometricDevice",
      id,
      null,
      { rotated: true },
      session,
    );
    return {
      token,
      deviceId: id,
      message: "Save this token securely. It is only shown once.",
    };
  });
}
export async function mapping(actor: any, id: string, mappings: any[]) {
  const seen = new Set();
  for (const row of mappings) {
    if (seen.has(row.biometricUserId))
      throw { statusCode: 400, message: "Biometric user IDs must be unique." };
    seen.add(row.biometricUserId);
    await employee(actor, row.employeeId);
  }
  const mappingDevice = await BiometricDevice.findOne({
    _id: id,
    schoolId: actor.schoolId,
  }).select("demoOnly");
  if (mappingDevice?.demoOnly)
    throw {
      statusCode: 410,
      message: "This retired device cannot be mapped to employees.",
    };
  const device = await transaction(async (session) => {
    const previous = await BiometricDevice.findOne({
      _id: id,
      schoolId: actor.schoolId,
    }).session(session);
    if (!previous) throw { statusCode: 404, message: "Device not found." };
    const before = previous.mappings.map((x: any) => ({
      biometricUserId: x.biometricUserId,
      employeeId: String(x.employeeId),
    }));
    previous.mappings = mappings;
    await previous.save({ session });
    await audit(
      actor,
      "BIOMETRIC_MAPPING",
      "BiometricDevice",
      id,
      before,
      mappings,
      session,
    );
    return previous;
  });
  const pending = await BiometricPunch.find({
    schoolId: actor.schoolId,
    device: id,
    isDemo: { $ne: true },
    processedAt: { $exists: false },
  })
    .sort({ timestamp: 1 })
    .limit(500);
  let processed = 0;
  for (const punch of pending) {
    try {
      if (await processPunch(device, punch)) processed++;
    } catch (e: any) {
      punch.error = String(e.message || "Processing failed").slice(0, 300);
      await punch.save();
    }
  }
  return { device, reprocessed: processed };
}
export async function command(actor: any, id: string, action: string) {
  return transaction(async (session) => {
    const device = await BiometricDevice.findOne({
      _id: id,
      schoolId: actor.schoolId,
      enabled: true,
    }).session(session);
    if (!device)
      throw { statusCode: 404, message: "Enabled device not found." };
    if (device.demoOnly)
      throw {
        statusCode: 409,
        message: "Testing-only devices cannot test or sync real hardware.",
      };
    if (device.connectionType === "PUSH_JSON")
      return {
        status: "AWAITING_PUSH",
        message:
          "Send an authenticated transaction/heartbeat from the device integration to verify its connection.",
      };
    device.command = action;
    device.commandId = crypto.randomUUID();
    await device.save({ session });
    await audit(
      actor,
      "DEVICE_" + action,
      "BiometricDevice",
      id,
      null,
      { commandId: device.commandId },
      session,
    );
    return {
      status: "QUEUED",
      message:
        "Requested from connector; connection is only confirmed after its response.",
    };
  });
}
export async function deviceContext(
  id: string,
  token: string,
  work: (device: any, actor: any) => Promise<any>,
) {
  const device = await BiometricDevice.findById(id).select(
    "+tokenHash +credentialsCipher",
  );
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  if (
    !device ||
    device.demoOnly ||
    !device.enabled ||
    !device.tokenHash ||
    device.tokenHash.length !== hash.length ||
    !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(device.tokenHash))
  )
    throw { statusCode: 401, message: "Invalid device authentication." };
  await expireTrials(String(device.schoolId));
  const school = await School.findById(device.schoolId);
  if (
    !school ||
    !["ACTIVE", "TRIAL"].includes(school.status) ||
    school.attendanceMode !== "BIOMETRIC"
  )
    throw {
      statusCode: 403,
      message: "School biometric attendance is not active.",
    };
  const actor = {
    schoolId: String(school._id),
    userType: "CONNECTOR",
    email: "connector",
    userId: undefined,
  };
  return branchContext.run(
    {
      organizationId: String(school._id),
      branchId: String(device.branchId || school._id),
      mainBranchId: String(school._id),
      owner: false,
      userType: "CONNECTOR",
    },
    () => work(device, actor),
  );
}
// First authenticated punch is check-in; the last distinct punch is check-out.
export function mergePunch(
  date: string,
  timestamp: Date,
  current: any,
  policy: any,
) {
  const ci =
    current?.checkedInAt && new Date(current.checkedInAt) < timestamp
      ? new Date(current.checkedInAt)
      : timestamp;
  const previous = current?.checkedOutAt || current?.checkedInAt;
  const co =
    previous && new Date(previous) > timestamp ? new Date(previous) : timestamp;
  return {
    date,
    source: "BIOMETRIC",
    checkedInAt: ci,
    checkedOutAt: co > ci ? co : null,
    ...attendanceValues(
      date,
      ci,
      co > ci ? co : undefined,
      current?.policySnapshot || policy,
    ),
  };
}
async function processPunch(device: any, punch: any) {
  await expireTrials(String(device.schoolId));
  if (punch.isDemo === true || device.demoOnly)
    throw {
      statusCode: 410,
      message: "Archived testing records cannot become genuine attendance.",
    };
  const mapping = device.mappings.find(
    (m: any) => m.biometricUserId === punch.biometricUserId,
  );
  if (!mapping)
    throw { statusCode: 422, message: "Unmapped biometric user ID." };
  const actor = { schoolId: String(device.schoolId), userType: "CONNECTOR" },
    id = String(mapping.employeeId);
  const config = await settings(actor);
  const preliminary = await policyFor(
    actor,
    id,
    dateKey(punch.timestamp, config.policy.timezone),
  );
  const date = scheduledDate(punch.timestamp, preliminary.p);
  const resolved =
    date === dateKey(punch.timestamp, config.policy.timezone)
      ? preliminary
      : await policyFor(actor, id, date);
  if (
    resolved.user.status !== "ACTIVE" &&
    (!resolved.employment?.leavingDate ||
      date > resolved.employment.leavingDate)
  )
    throw {
      statusCode: 422,
      message: "Employee is inactive for this transaction.",
    };
  if (
    (resolved.employment?.joiningDate &&
      date < resolved.employment.joiningDate) ||
    (resolved.employment?.leavingDate && date > resolved.employment.leavingDate)
  )
    throw { statusCode: 422, message: "Punch is outside employment dates." };
  return transaction(async (session) => {
    const liveSchool = await School.findById(actor.schoolId).session(session);
    const liveDevice = await BiometricDevice.findOne({
      _id: device._id,
      schoolId: actor.schoolId,
      enabled: true,
    }).session(session);
    if (
      !liveSchool ||
      liveSchool.accountStatus === "DEACTIVATED" ||
      !["ACTIVE", "TRIAL"].includes(liveSchool.status) ||
      !liveDevice ||
      liveDevice.demoOnly ||
      liveSchool.attendanceMode !== "BIOMETRIC" ||
      !liveDevice.mappings.some(
        (m: any) =>
          m.biometricUserId === punch.biometricUserId &&
          String(m.employeeId) === id,
      )
    )
      throw {
        statusCode: 409,
        message:
          "Mode, device or mapping changed; raw transaction retained for review.",
      };
    await periodLock(actor, date.slice(0, 7), session);
    await unlocked(actor, id, date, session);
    const current = await StaffAttendance.findOne({
      schoolId: device.schoolId,
      employeeId: id,
      date,
    }).session(session);
    if (current && current.source !== "BIOMETRIC")
      throw {
        statusCode: 409,
        message:
          "Attendance from the previous mode is preserved; admin review required.",
      };
    if (current?.corrected)
      throw {
        statusCode: 409,
        message: "Admin correction retained; raw punch needs review.",
      };
    const stored = await BiometricPunch.findOne({
      _id: punch._id,
      schoolId: actor.schoolId,
    }).session(session);
    if (stored?.processedAt) return false;
    const values = mergePunch(date, punch.timestamp, current, resolved.p);
    await StaffAttendance.findOneAndUpdate(
      { schoolId: device.schoolId, employeeId: id, date },
      { $set: values, $inc: { revision: 1 } },
      { upsert: true, new: true, session },
    );
    punch.employeeId = id;
    punch.processedAt = new Date();
    punch.error = undefined;
    await punch.save({ session });
    return true;
  });
}
export async function ingest(device: any, events: any[]) {
  if (device.demoOnly)
    throw {
      statusCode: 410,
      message: "Biometric simulation is no longer available.",
    };
  if (
    events.some(
      (e) =>
        e.eventId.startsWith("DEMO/") ||
        String(e.verificationMethod || "").toUpperCase() === "DEMO",
    )
  )
    throw {
      statusCode: 400,
      message:
        "Retired testing event IDs are not accepted by the device integration.",
    };
  await BiometricPunch.init();
  await StaffAttendance.init();
  let received = 0,
    duplicates = 0,
    processed = 0;
  const errors: any[] = [];
  for (const event of events) {
    let punch = await BiometricPunch.findOne({
      device: device._id,
      eventId: event.eventId,
    });
    if (punch) {
      if (
        String(punch.biometricUserId) !== event.biometricUserId ||
        punch.timestamp.getTime() !== new Date(event.timestamp).getTime()
      )
        throw {
          statusCode: 409,
          message: "Event ID reused with different transaction data.",
        };
      duplicates++;
    } else {
      try {
        punch = await BiometricPunch.create({
          schoolId: device.schoolId,
          device: device._id,
          ...event,
        });
        received++;
      } catch (e: any) {
        if (e.code !== 11000) throw e;
        punch = await BiometricPunch.findOne({
          device: device._id,
          eventId: event.eventId,
        });
        duplicates++;
      }
    }
    if (
      punch.isDemo === true ||
      String(punch.biometricUserId) !== event.biometricUserId ||
      punch.timestamp.getTime() !== new Date(event.timestamp).getTime()
    )
      throw {
        statusCode: 409,
        message: "Duplicate event has different data or source.",
      };
    if (!punch.processedAt) {
      try {
        if (await processPunch(device, punch)) processed++;
      } catch (e: any) {
        punch.error = String(
          e.statusCode
            ? e.message
            : "Attendance processing failed; contact your administrator.",
        ).slice(0, 300);
        await punch.save();
        errors.push({ eventId: event.eventId, message: punch.error });
      }
    }
  }
  await BiometricDevice.updateOne(
    { _id: device._id },
    {
      $set: {
        lastSeenAt: new Date(),
        lastDeviceSuccessAt: new Date(),
        lastSyncAt: new Date(),
        ...(events.length
          ? {
              lastTransactionAt: new Date(
                Math.max(...events.map((e) => Date.parse(e.timestamp))),
              ),
            }
          : {}),
        lastError: errors.length ? errors[0].message : "",
      },
      $push: {
        syncLogs: {
          $each: [
            {
              at: new Date(),
              ok: !errors.length,
              message: errors.length
                ? "Transactions stored; some require mapping/review."
                : "Transactions synchronized.",
              count: received,
            },
          ],
          $slice: -50,
        },
      },
    },
  );
  return { received, duplicates, processed, errors, stored: true };
}
export async function heartbeat(device: any, input: any) {
  await BiometricDevice.updateOne(
    { _id: device._id },
    {
      $set: {
        lastSeenAt: new Date(),
        pendingQueue: input.pendingQueue,
        lastError: input.error
          ? "Connector reported an error. Check its private local status."
          : "",
        ...(input.deviceConnected ? { lastDeviceSuccessAt: new Date() } : {}),
        ...(input.commandCompletedId === device.commandId
          ? { command: "NONE", commandCompletedAt: new Date() }
          : {}),
      },
      ...(input.commandCompletedId
        ? {
            $push: {
              syncLogs: {
                $each: [
                  {
                    at: new Date(),
                    ok: !input.error,
                    message: input.error
                      ? "Connector operation failed."
                      : "Connector operation completed.",
                    count: 0,
                  },
                ],
                $slice: -50,
              },
            },
          }
        : {}),
    },
  );
  return {
    command: device.command,
    commandId: device.commandId,
    configuration:
      device.connectionType === "CONNECTOR_HTTP_JSON"
        ? {
            host: device.host,
            port: device.port,
            transactionPath: device.transactionPath,
            username: device.username,
            credentials: device.credentialsCipher
              ? decrypt(device.credentialsCipher)
              : "",
            timezone: device.timezone,
          }
        : undefined,
  };
}

// No token is returned through a browser API. The operator transfers this private server file securely.
export async function provision(actor: any, id: string) {
  const configured = process.env.BIOMETRIC_PROVISION_DIR;
  if (!configured || !path.isAbsolute(configured))
    throw {
      statusCode: 409,
      message:
        "Configure an absolute private BIOMETRIC_PROVISION_DIR on the backend before provisioning connector credentials.",
    };
  const directory = path.resolve(configured),
    publicDirectory = path.resolve(process.cwd(), "public");
  if (
    directory === publicDirectory ||
    directory.startsWith(publicDirectory + path.sep)
  )
    throw {
      statusCode: 409,
      message: "Credential provisioning directory must not be publicly served.",
    };
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = "acadivo-connector-" + crypto.randomUUID() + ".env",
    destination = path.join(directory, filename);
  const file = await fs.open(destination, "wx", 0o600);
  try {
    await rotate(actor, id, async (token) => {
      await file.truncate(0);
      const content = Buffer.from(
        "ACADIVO_DEVICE_ID=" + id + "\nACADIVO_DEVICE_TOKEN=" + token + "\n",
      );
      await file.write(content, 0, content.length, 0);
      await file.sync();
    });
  } catch (e: any) {
    await file.close();
    await fs.unlink(destination).catch(() => {});
    if (e.statusCode === 404 || e.statusCode === 409) throw e;
    throw {
      statusCode: 409,
      message:
        "Credential provisioning failed. Check the private server directory and database connection.",
    };
  }
  await file.close();
  return {
    deviceId: id,
    credentialFile: filename,
    message:
      "Credentials provisioned to a private backend file. Transfer securely to the connector host; no secret is displayed in the browser.",
  };
}
