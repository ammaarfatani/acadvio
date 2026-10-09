import crypto from "node:crypto";
import { School } from "../models/school.model";
import { BiometricDevice, BiometricPunch, StaffAttendance } from "../models/workforce.model";
import { branchContext } from "../utils/branchScope";
import { audit, employee, policyFor, transaction, periodLock, unlocked, settings } from "./workforce.service";
import { attendanceValues, dateKey, scheduledDate } from "./workforceMath";
import { expireTrials } from "./trialLifecycle.service";
function encrypt(secret: string) { const key = process.env.BIOMETRIC_ENCRYPTION_KEY; if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw { statusCode: 503, message: "Server BIOMETRIC_ENCRYPTION_KEY must be configured for device credentials." }; const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv); const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]); return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join("."); }
export function decrypt(secret: string) { const key = process.env.BIOMETRIC_ENCRYPTION_KEY; if (!key || !/^[a-f0-9]{64}$/i.test(key))
    throw { statusCode: 503, message: "Device encryption key unavailable." }; const [iv, tag, data] = secret.split("."); const cipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(iv, "base64")); cipher.setAuthTag(Buffer.from(tag, "base64")); return Buffer.concat([cipher.update(Buffer.from(data, "base64")), cipher.final()]).toString("utf8"); }
export async function list(actor: any) { const rows: any[] = await BiometricDevice.find({ schoolId: actor.schoolId }).lean(); return rows.map(r => ({ ...r, connectionStatus: !r.enabled ? "DISABLED" : !r.lastDeviceSuccessAt ? "NOT_CONNECTED" : Date.now() - r.lastDeviceSuccessAt.getTime() > 180000 ? "OFFLINE" : "ONLINE" })); }
export async function save(actor: any, input: any, id?: string) { const config = await settings(actor); if (config.mode !== "BIOMETRIC")
    throw { statusCode: 409, message: "Select biometric mode before configuring a device." }; await BiometricDevice.init(); return transaction(async (session) => { const previous = id ? await BiometricDevice.findOne({ _id: id, schoolId: actor.schoolId }).session(session) : null; if (id && !previous)
    throw { statusCode: 404, message: "Device not found." }; const previousValue = previous ? previous.toObject() : null; const { credentials, ...fields } = input; const device = previous || new BiometricDevice({ schoolId: actor.schoolId, ...fields }); Object.assign(device, fields); if (credentials !== undefined)
    device.credentialsCipher = credentials ? encrypt(credentials) : undefined; await device.save({ session }); await audit(actor, id ? "DEVICE_UPDATE" : "DEVICE_CREATED", "BiometricDevice", device._id, previousValue, { ...fields, credentialsChanged: credentials !== undefined }, session); const publicRow = device.toObject(); delete publicRow.credentialsCipher; delete publicRow.tokenHash; return publicRow; }); }
export async function rotate(actor: any, id: string) { return transaction(async (session) => { const device = await BiometricDevice.findOne({ _id: id, schoolId: actor.schoolId }).session(session); if (!device)
    throw { statusCode: 404, message: "Device not found." }; const token = crypto.randomBytes(32).toString("base64url"); device.tokenHash = crypto.createHash("sha256").update(token).digest("hex"); await device.save({ session }); await audit(actor, "DEVICE_CREDENTIAL_ROTATED", "BiometricDevice", id, null, { rotated: true }, session); return { token, deviceId: id, message: "Save this token securely. It is only shown once." }; }); }
export async function mapping(actor: any, id: string, mappings: any[]) { const seen = new Set(); for (const row of mappings) {
    if (seen.has(row.biometricUserId))
        throw { statusCode: 400, message: "Biometric user IDs must be unique." };
    seen.add(row.biometricUserId);
    await employee(actor, row.employeeId);
} const device = await transaction(async (session) => { const previous = await BiometricDevice.findOne({ _id: id, schoolId: actor.schoolId }).session(session); if (!previous)
    throw { statusCode: 404, message: "Device not found." }; const before = previous.mappings.map((x: any) => ({ biometricUserId: x.biometricUserId, employeeId: String(x.employeeId) })); previous.mappings = mappings; await previous.save({ session }); await audit(actor, "BIOMETRIC_MAPPING", "BiometricDevice", id, before, mappings, session); return previous; }); const pending = await BiometricPunch.find({ schoolId: actor.schoolId, device: id, processedAt: { $exists: false } }).sort({ timestamp: 1 }).limit(500); let processed = 0; for (const punch of pending) {
    try {
        await processPunch(device, punch);
        processed++;
    }
    catch (e: any) {
        punch.error = String(e.message || "Processing failed").slice(0, 300);
        await punch.save();
    }
} return { device, reprocessed: processed }; }
export async function command(actor: any, id: string, action: string) { return transaction(async (session) => { const device = await BiometricDevice.findOne({ _id: id, schoolId: actor.schoolId, enabled: true }).session(session); if (!device)
    throw { statusCode: 404, message: "Enabled device not found." }; if (device.connectionType === "PUSH_JSON")
    return { status: "AWAITING_PUSH", message: "Send an authenticated transaction/heartbeat from the device integration to verify its connection." }; device.command = action; device.commandId = crypto.randomUUID(); await device.save({ session }); await audit(actor, "DEVICE_" + action, "BiometricDevice", id, null, { commandId: device.commandId }, session); return { status: "QUEUED", message: "Requested from connector; connection is only confirmed after its response." }; }); }
export async function deviceContext(id: string, token: string, work: (device: any, actor: any) => Promise<any>) { const device = await BiometricDevice.findById(id).select("+tokenHash +credentialsCipher"); const hash = crypto.createHash("sha256").update(token).digest("hex"); if (!device || !device.enabled || !device.tokenHash || device.tokenHash.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(device.tokenHash)))
    throw { statusCode: 401, message: "Invalid device authentication." }; await expireTrials(String(device.schoolId)); const school = await School.findById(device.schoolId); if (!school || !["ACTIVE", "TRIAL"].includes(school.status) || school.attendanceMode !== "BIOMETRIC")
    throw { statusCode: 403, message: "School biometric attendance is not active." }; const actor = { schoolId: String(school._id), userType: "CONNECTOR", email: "connector", userId: undefined }; return branchContext.run({ organizationId: String(school._id), branchId: String(device.branchId || school._id), mainBranchId: String(school._id), owner: false, userType: "CONNECTOR" }, () => work(device, actor)); }
async function processPunch(device: any, punch: any) { const mapping = device.mappings.find((m: any) => m.biometricUserId === punch.biometricUserId); if (!mapping)
    throw { statusCode: 422, message: "Unmapped biometric user ID." }; const actor = { schoolId: String(device.schoolId), userType: "CONNECTOR" }; const id = String(mapping.employeeId); const resolved = await policyFor(actor, id, dateKey(punch.timestamp, (await settings(actor)).policy.timezone)); const date = scheduledDate(punch.timestamp, resolved.p); if (resolved.user.status !== "ACTIVE" && (!resolved.employment?.leavingDate || date > resolved.employment.leavingDate))
    throw { statusCode: 422, message: "Employee is inactive for this transaction." }; if (resolved.employment?.joiningDate && date < resolved.employment.joiningDate || resolved.employment?.leavingDate && date > resolved.employment.leavingDate)
    throw { statusCode: 422, message: "Punch is outside employment dates." }; return transaction(async (session) => { const liveSchool = await School.findById(actor.schoolId).session(session);
        const liveDevice = await BiometricDevice.findOne({_id:device._id,enabled:true}).session(session);
        if (liveSchool?.attendanceMode !== "BIOMETRIC" || !liveDevice || !liveDevice.mappings.some((m:any)=>m.biometricUserId===punch.biometricUserId&&String(m.employeeId)===id)) throw {statusCode:409,message:"Mode, device or mapping changed; raw transaction retained for review."};
        await periodLock(actor, date.slice(0, 7), session); await unlocked(actor, id, date, session); const current = await StaffAttendance.findOne({ schoolId: device.schoolId, employeeId: id, date }).session(session); if (current && current.source !== "BIOMETRIC")
    throw { statusCode: 409, message: "Attendance from the previous mode is preserved; admin review required." }; if (current?.corrected)
    throw { statusCode: 409, message: "Admin correction retained; raw punch needs review." }; const ci = current?.checkedInAt && current.checkedInAt < punch.timestamp ? current.checkedInAt : punch.timestamp; const last = current?.checkedOutAt || current?.checkedInAt; const co = last && last > punch.timestamp ? last : punch.timestamp; const p = current?.policySnapshot || resolved.p; await StaffAttendance.findOneAndUpdate({ schoolId: device.schoolId, employeeId: id, date }, { $set: { source: "BIOMETRIC", checkedInAt: ci, checkedOutAt: co > ci ? co : null, ...attendanceValues(date, ci, co > ci ? co : undefined, p) }, $inc: { revision: 1 } }, { upsert: true, new: true, session }); punch.employeeId = id; punch.processedAt = new Date(); punch.error = undefined; await punch.save({ session }); }); }
export async function ingest(device: any, events: any[]) {
    await BiometricPunch.init();
    await StaffAttendance.init();
    let received = 0, duplicates = 0, processed = 0;
    const errors: any[] = [];
    for (const event of events) {
        let punch = await BiometricPunch.findOne({ device: device._id, eventId: event.eventId });
        if (punch) {
            if (String(punch.biometricUserId) !== event.biometricUserId || punch.timestamp.getTime() !== new Date(event.timestamp).getTime())
                throw { statusCode: 409, message: "Event ID reused with different transaction data." };
            duplicates++;
        }
        else {
            try {
                punch = await BiometricPunch.create({ schoolId: device.schoolId, device: device._id, ...event });
                received++;
            }
            catch (e: any) {
                if (e.code !== 11000)
                    throw e;
                punch = await BiometricPunch.findOne({ device: device._id, eventId: event.eventId });
                duplicates++;
            }
        }
        if (String(punch.biometricUserId) !== event.biometricUserId || punch.timestamp.getTime() !== new Date(event.timestamp).getTime())
            throw { statusCode: 409, message: "Duplicate event has different data." };
        if (!punch.processedAt) {
            try {
                await processPunch(device, punch);
                processed++;
            }
            catch (e: any) {
                punch.error = String(e.message || "Punch processing failed").slice(0, 300);
                await punch.save();
                errors.push({ eventId: event.eventId, message: punch.error });
            }
        }
    }
    await BiometricDevice.updateOne({ _id: device._id }, { $set: { lastSeenAt: new Date(), lastDeviceSuccessAt: new Date(), lastSyncAt: new Date(), ...(events.length ? { lastTransactionAt: new Date(Math.max(...events.map(e => Date.parse(e.timestamp)))) } : {}), lastError: errors.length ? errors[0].message : "" }, $push: { syncLogs: { $each: [{ at: new Date(), ok: !errors.length, message: errors.length ? "Transactions stored; some require mapping/review." : "Transactions synchronized.", count: received }], $slice: -50 } } });
    return { received, duplicates, processed, errors, stored: true };
}
export async function heartbeat(device: any, input: any) { await BiometricDevice.updateOne({ _id: device._id }, { $set: { lastSeenAt: new Date(), pendingQueue: input.pendingQueue, lastError: input.error || "", ...(input.deviceConnected ? { lastDeviceSuccessAt: new Date() } : {}), ...(input.commandCompletedId === device.commandId ? { command: "NONE", commandCompletedAt: new Date() } : {}) }, ...(input.commandCompletedId ? { $push: { syncLogs: { $each: [{ at: new Date(), ok: !input.error, message: input.error ? "Connector operation failed." : "Connector operation completed.", count: 0 }], $slice: -50 } } } : {}) }); return { command: device.command, commandId: device.commandId, configuration: device.connectionType === "CONNECTOR_HTTP_JSON" ? { host: device.host, port: device.port, transactionPath: device.transactionPath, username: device.username, credentials: device.credentialsCipher ? decrypt(device.credentialsCipher) : "", timezone: device.timezone } : undefined }; }
