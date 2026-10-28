import { hasFeature } from "../../lib/plan-features";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { School } from "../models/school.model";
import { User } from "../models/user.model";
import { StaffEmployment, StaffAttendance, SchoolCalendar, PayrollRecord, WorkforcePeriod } from "../models/workforce.model";
import { TeacherAttendance } from "../models/attendance.model";
import { LeaveRequest } from "../models/leaveRequest.model";
import { TimetableSlot } from "../models/subject.model";
import { AcademicSession } from "../models/academicSession.model";
import { AuditLog } from "../models/auditLog.model";
import { branchContext, withoutBranchScope } from "../utils/branchScope";
import { DEFAULT_POLICY, dateKey, localTime, scheduledDate, attendanceValues, monthDates, calculatePayroll, money, workingDay } from "./workforceMath";
export const STAFF_TYPES = ["SCHOOL_ADMIN", "TEACHER", "FINANCE", "EXAM_STAFF", "RECEPTIONIST"];
export function employeeActor(actor: any) { if (!actor?.schoolId || ["PARENT", "SUPER_ADMIN"].includes(actor.userType))
    throw { statusCode: 403, message: "Employee account required." }; }
export async function selfEmployee(actor:any){employeeActor(actor);if(actor.userType==="SCHOOL_ADMIN"&&!await StaffEmployment.exists({schoolId:actor.schoolId,userId:actor.userId,status:"ACTIVE"}))throw {statusCode:403,message:"Personal attendance requires an active employee record. Manage staff attendance from the administration workspace."};}
export async function employee(actor: any, id: string) { const user = await User.findOne({ _id: id, schoolId: actor.schoolId, userType: { $nin: ["PARENT", "SUPER_ADMIN"] } }).select("name email userType status"); if (!user)
    throw { statusCode: 404, message: "Employee not found in this branch." }; return user; }
export async function audit(actor: any, action: string, resource: string, id: any, previous: any, value: any, session?: any) { await AuditLog.create([{ schoolId: actor.schoolId, actorUserId: actor.userId, actorEmail: actor.email, actorRole: actor.userType, action, resource, entityId: String(id), previousValue: previous, newValue: value }], session ? { session } : {}); }
export async function transaction<T>(work: (session: mongoose.ClientSession) => Promise<T>, options: {demo?: boolean} = {}): Promise<T> { const session = await mongoose.startSession(); try {
    let result: T;
    await session.withTransaction(async () => { const schoolId = branchContext.getStore()?.organizationId; if (schoolId && !options.demo)
        await School.updateOne({ _id: schoolId }, { $inc: { workforceRevision: 1 } }, { session }); result = await work(session); });
    return result!;
}
finally {
    await session.endSession();
} }
export async function periodLock(actor: any, month: string, session: any) { await WorkforcePeriod.init(); await WorkforcePeriod.findOneAndUpdate({ schoolId: actor.schoolId, month }, { $inc: { revision: 1 } }, { upsert: true, new: true, session }); }
export async function unlocked(actor: any, id: string, date: string, session?: any) { if (await PayrollRecord.findOne({ schoolId: actor.schoolId, employeeId: id, month: date.slice(0, 7), status: { $in: ["APPROVED", "PAID"] } }).session(session || null))
    throw { statusCode: 409, message: "Approved/paid payroll locks attendance for this month." }; }
export async function settings(actor: any) { const school = await School.findById(actor.schoolId).select("attendanceMode attendanceSetupCompletedAt attendancePolicy").lean(); if (!school)
    throw { statusCode: 404, message: "School not found." }; return { mode: (school as any).attendanceMode || null, setupCompletedAt: (school as any).attendanceSetupCompletedAt || null, policy: { ...DEFAULT_POLICY, ...(school as any).attendancePolicy } }; }
export async function policyFor(actor: any, id: string, date: string, preloaded?: {config:any;employment:any;user:any}) {
    const config = preloaded?.config || await settings(actor), employment: any = preloaded ? preloaded.employment : await StaffEmployment.findOne({ schoolId: actor.schoolId, userId: id }).lean();
    const p = { ...config.policy, ...(employment as any)?.schedule };
    const user = preloaded?.user || await employee(actor, id);
    if (user.userType === "TEACHER" && p.teacherStart === "FIRST_CLASS") {
        const day = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        const current = await AcademicSession.findOne({ schoolId: actor.schoolId, isCurrent: true });
        const slot = current ? await TimetableSlot.findOne({ schoolId: actor.schoolId, teacherId: id, academicSessionId: current._id, dayOfWeek: day }).sort({ startTime: 1 }) : null;
        if (slot)
            p.startTime = slot.startTime;
    }
    return { config, p, employment, user };
}
export async function selfSummary(actor: any, month: string) { await selfEmployee(actor); const config = await settings(actor); const records = await history(actor, actor.userId, month); const employment: any = await StaffEmployment.findOne({ schoolId: actor.schoolId, userId: actor.userId }).lean(); const payroll = await PayrollRecord.find({ schoolId: actor.schoolId, employeeId: actor.userId }).sort({ month: -1 }).limit(36).lean(); const leaveRequests=await LeaveRequest.find({schoolId:actor.schoolId,teacherId:actor.userId}).sort({createdAt:-1}).limit(100).lean();return { ...config, today: dateKey(new Date(), config.policy.timezone), records, employment, payroll,leaveRequests }; }
export async function history(actor: any, id: string, month: string, session?: any) { const rows: any[] = await StaffAttendance.find({ schoolId: actor.schoolId, employeeId: id, date: { $gte: month + "-01", $lte: month + "-31" } }).session(session || null).sort({ date: -1 }).lean(); const legacy = await TeacherAttendance.find({ schoolId: actor.schoolId, "records.teacherUserId": id, date: { $gte: new Date(month + "-01T00:00:00Z"), $lt: new Date(monthDates(month).at(-1)! + "T23:59:59.999Z") } }).session(session || null).lean(); const config = await settings(actor); for (const day of legacy as any[]) {
    const date = dateKey(day.date, config.policy.timezone);
    if (rows.some(r => r.date === date))
        continue;
    const r = day.records.find((x: any) => String(x.teacherUserId) === id);
    if (r) {
        const checkIn = r.checkedInAt;
        rows.push({ ...attendanceValues(date, checkIn, r.checkedOutAt, config.policy), ...r, date, employeeId: id, source: "MANUAL", legacy: true });
    }
} return rows.sort((a, b) => b.date.localeCompare(a.date)); }
export async function manual(actor: any, action: "in" | "out", metadata: any = {}) { await selfEmployee(actor); const now = new Date(), config = await settings(actor); if (config.mode !== "MANUAL" || !config.setupCompletedAt)
    throw { statusCode: 409, message: "Manual attendance is not enabled. Contact School Admin." }; const preliminary = await policyFor(actor, actor.userId, dateKey(now, config.policy.timezone)); const date = scheduledDate(now, preliminary.p), resolved = await policyFor(actor, actor.userId, date); if (resolved.user.status !== "ACTIVE" || resolved.employment?.leavingDate && date > resolved.employment.leavingDate || resolved.employment?.joiningDate && date < resolved.employment.joiningDate)
    throw { statusCode: 403, message: "Employment is not active for today." }; await StaffAttendance.init(); return transaction(async (session) => { await periodLock(actor, date.slice(0, 7), session); const currentMode = await settings(actor); if (currentMode.mode !== "MANUAL")
    throw { statusCode: 409, message: "Attendance mode changed. Refresh your portal." }; await unlocked(actor, actor.userId, date, session); const row = await StaffAttendance.findOne({ schoolId: actor.schoolId, employeeId: actor.userId, date }).session(session); if (row && row.source !== "MANUAL")
    throw { statusCode: 409, message: "Existing attendance came from a different mode; request an admin correction." }; if (action === "in") {
    if (row?.checkedInAt)
        throw { statusCode: 409, message: "Already checked in today." };
    if (row?.corrected)
        throw { statusCode: 409, message: "Today's attendance was finalized by an administrator." };
    const values = attendanceValues(date, now, undefined, resolved.p);
    const record = await StaffAttendance.create([{ schoolId: actor.schoolId, employeeId: actor.userId, date, source: "MANUAL", checkedInAt: now, ...values, ...metadata }], { session });
    return record[0];
} if (!row?.checkedInAt)
    throw { statusCode: 409, message: "Check in before checking out." }; if (row.checkedOutAt)
    throw { statusCode: 409, message: "Already checked out today." }; const values = attendanceValues(date, row.checkedInAt, now, row.policySnapshot || resolved.p); Object.assign(row, values, { checkedOutAt: now }); await row.save({ session }); return row; }); }
export async function correction(actor: any, input: any) { const { p } = await policyFor(actor, input.employeeId, input.date); if (input.date > dateKey(new Date(), p.timezone))
    throw { statusCode: 400, message: "Future attendance corrections are not allowed." }; const ci = input.checkedInAt ? new Date(input.checkedInAt) : undefined, co = input.checkedOutAt ? new Date(input.checkedOutAt) : undefined; if (co && (!ci || co < ci) || ci && scheduledDate(ci, p) !== input.date)
    throw { statusCode: 400, message: "Check-in/check-out must belong to the scheduled working day." }; if (input.status === "PRESENT" || input.status === "LATE") {
    if (!ci)
        throw { statusCode: 400, message: "Present attendance requires check-in." };
}
else if (ci || co)
    throw { statusCode: 400, message: "Absent/leave records cannot contain punches." }; return transaction(async (session) => { await periodLock(actor, input.date.slice(0, 7), session); await unlocked(actor, input.employeeId, input.date, session); const previous: any = await StaffAttendance.findOne({ schoolId: actor.schoolId, employeeId: input.employeeId, date: input.date }).session(session).lean(); const values = attendanceValues(input.date, ci, co, p); const next = await StaffAttendance.findOneAndUpdate({ schoolId: actor.schoolId, employeeId: input.employeeId, date: input.date }, { $set: { ...values, status: ci ? values.status : input.status, source: previous?.source || "MANUAL", checkedInAt: ci || null, checkedOutAt: co || null, corrected: true, correctionReason: input.reason }, $inc: { revision: 1 } }, { new: true, upsert: true, session }); await audit(actor, "ATTENDANCE_CORRECTION", "StaffAttendance", next._id, previous, next.toObject(), session); return next; }); }
export async function saveEmployment(actor: any, id: string, input: any) {
    const target=await User.findOne({_id:id,schoolId:actor.schoolId,userType:{$nin:["PARENT","SUPER_ADMIN"]}});if(!target)throw {statusCode:404,message:"Employee not found."};
    const {ensureEmployeeIdentity}=await import("./permanentIdentity.service");const permanentId=await ensureEmployeeIdentity(target);
    input={...input,employeeId:permanentId};
    return transaction(async (session) => {
        const previous = await StaffEmployment.findOne({ schoolId: actor.schoolId, userId: id }).session(session);
        const history: any[] = [...(previous?.salaryHistory || [])].map((x: any) => x.toObject ? x.toObject() : x);
        if (input.salary) {
            const lastLocked = await PayrollRecord.findOne({ schoolId: actor.schoolId, employeeId: id, status: { $in: ["APPROVED", "PAID"] } }).sort({ month: -1 }).session(session);
            if (lastLocked && input.salary.effectiveDate.slice(0, 7) <= lastLocked.month)
                throw { statusCode: 409, message: "Cannot change salary history covered by approved payroll." };
            const index = history.findIndex(x => x.effectiveDate === input.salary.effectiveDate);
            const row = { ...input.salary, changedBy: actor.userId };
            if (index >= 0)
                history[index] = row;
            else
                history.push(row);
        }
        const { salary, ...fields } = input;
        const result = await StaffEmployment.findOneAndUpdate({ schoolId: actor.schoolId, userId: id }, { $set: { ...fields, salaryHistory: history.sort((a: any, b: any) => a.effectiveDate.localeCompare(b.effectiveDate)) } }, { upsert: true, new: true, session, runValidators: true });
        await audit(actor, "EMPLOYMENT_SALARY_UPDATE", "StaffEmployment", result._id, previous?.toObject(), result.toObject(), session);
        return result;
    });
}
export async function saveSettings(actor: any, input: any) {
    if (!actor.isOrganizationOwner && actor.branchId !== actor.schoolId)
        throw { statusCode: 403, message: "Only the school owner/main administrator can change tenant attendance mode." };
    const previous = await settings(actor);
    if (previous.mode && input.mode !== previous.mode && !input.confirmModeChange)
        throw { statusCode: 400, message: "Confirm attendance mode change. History will remain unchanged." };
    if (input.complete && input.mode === "BIOMETRIC") {
        const { BiometricDevice } = await import("../models/workforce.model");
        const connected = await BiometricDevice.findOne({ schoolId: actor.schoolId, enabled: true, demoOnly: {$ne:true}, lastDeviceSuccessAt: { $gt: new Date(Date.now() - 10 * 60000) }, "mappings.0": { $exists: true } });
        if (!connected)
            throw { statusCode: 409, message: "Connect a device and map at least one employee before completing biometric setup." };
    }
    return withoutBranchScope(() => transaction(async (session) => { const updated = await School.findByIdAndUpdate(actor.schoolId, { $set: { attendanceMode: input.mode, attendancePolicy: input.policy, ...(input.complete ? { attendanceSetupCompletedAt: new Date() } : {}) } }, { new: true, session }); await audit({ ...actor, branchId: actor.schoolId }, "ATTENDANCE_MODE_POLICY_UPDATE", "School", actor.schoolId, previous, { mode: input.mode, policy: input.policy, complete: input.complete }, session); return { mode: updated.attendanceMode, policy: updated.attendancePolicy, setupCompletedAt: updated.attendanceSetupCompletedAt }; }));
}
export async function overview(actor: any, input: any) {
    const config = await settings(actor), date = input.date || dateKey(new Date(), config.policy.timezone), month = input.month || date.slice(0, 7);
    const users = await User.find({ schoolId: actor.schoolId, userType: { $nin: ["PARENT", "SUPER_ADMIN"] }, ...(input.role ? { userType: input.role } : {}), ...(input.employeeId ? { _id: input.employeeId } : {}) }).select("name email userType status").lean();
    const employment: any[] = await StaffEmployment.find({ schoolId: actor.schoolId, userId: { $in: users.map(u => u._id) } }).lean();
    const calendar: any[] = await SchoolCalendar.find({ schoolId: actor.schoolId, date: { $gte: month + "-01", $lte: month + "-31" } }).lean();
    const leaves: any[] = await LeaveRequest.find({ schoolId: actor.schoolId, status: "APPROVED", startDate: { $lte: new Date(month + "-31T23:59:59Z") }, endDate: { $gte: new Date(month + "-01T00:00:00Z") } }).lean();
    const rows: any[] = [];
    for (const u of users) {
        const e = employment.find(x => String(x.userId) === String(u._id));
        if(u.userType==="SCHOOL_ADMIN"&&!e)continue;
        if (input.department && e?.department !== input.department)
            continue;
        const records = await history(actor, String(u._id), month);
        const dates = input.month ? monthDates(month) : [date];
        for (const day of dates) {
            if (day === dateKey(new Date(), config.policy.timezone) && u.status !== "ACTIVE" || day > dateKey(new Date(), config.policy.timezone) || e?.joiningDate && day < e.joiningDate || e?.leavingDate && day > e.leavingDate)
                continue;
            const p = { ...config.policy, ...e?.schedule };
            const r = records.find(x => x.date === day), leave = leaves.find(x => String(x.teacherId) === String(u._id) && x.startDate.toISOString().slice(0, 10) <= day && x.endDate.toISOString().slice(0, 10) >= day);
            const work = workingDay(day, p, calendar);
            const status = r?.status || (leave ? "LEAVE" : work.payable ? "ABSENT" : "OFF");
            const daily = e?.salaryHistory?.filter((x: any) => x.effectiveDate <= day).sort((a: any, b: any) => a.effectiveDate.localeCompare(b.effectiveDate)).at(-1);
            const denominator = monthDates(month).filter(d => workingDay(d, p, calendar).payable).length;
            const rate = daily ? (daily.basis === "MONTHLY" ? daily.amount / (denominator || 1) : daily.basis === "HOURLY" ? daily.amount * p.workingMinutes / 60 : daily.amount) : 0;
            const deduction = status === "ABSENT" && p.absenceDeduction ? rate : status === "LEAVE" ? (leave?.leaveType === "Unpaid" || !p.paidLeave) && p.unpaidLeaveDeduction ? rate : 0 : r?.lateMinutes && p.lateEnabled ? Math.min(rate, r.lateMinutes * rate / (r.policySnapshot?.workingMinutes || p.workingMinutes)) : 0;
            const row = { employee: u, department: e?.department, date: day, ...(r || attendanceValues(day, undefined, undefined, p)), status, dailyDeduction: hasFeature(actor.plan, "FINANCE") ? money(deduction) : undefined, source: r?.source || null };
            if (input.status && row.status !== input.status || input.source && row.source !== input.source)
                continue;
            rows.push(row);
        }
    }
    return { mode: config.mode, rows, summary: { totalStaff: new Set(rows.map(r => String(r.employee._id))).size, present: rows.filter(r => ["PRESENT", "LATE"].includes(r.status)).length, absent: rows.filter(r => r.status === "ABSENT").length, late: rows.filter(r => r.lateMinutes > 0).length, onLeave: rows.filter(r => r.status === "LEAVE").length, notCheckedOut: rows.filter(r => r.checkedInAt && !r.checkedOutAt).length, currentlyCheckedIn: rows.filter(r => r.date === dateKey(new Date(), config.policy.timezone) && r.checkedInAt && !r.checkedOutAt).length, lateMinutes: rows.reduce((s, r) => s + (r.lateMinutes || 0), 0) } };
}
export async function calculate(actor: any, month: string, employeeIds?: string[]) { const config = await settings(actor); if (month > dateKey(new Date(), config.policy.timezone).slice(0, 7))
    throw { statusCode: 400, message: "Cannot calculate a future payroll month." }; await PayrollRecord.init(); return transaction(async (session) => { await periodLock(actor, month, session); const staff: any[] = await StaffEmployment.find({ schoolId: actor.schoolId, ...(employeeIds?{userId:{$in:employeeIds}}:{}), joiningDate: { $lte: month + "-31" }, $or: [{ leavingDate: { $exists: false } }, { leavingDate: null }, { leavingDate: "" }, { leavingDate: { $gte: month + "-01" } }] }).session(session).lean(); const calendar: any[] = await SchoolCalendar.find({ schoolId: actor.schoolId, date: { $gte: month + "-01", $lte: month + "-31" } }).session(session).lean(); let count = 0; for (const e of staff) {
    if (!e.salaryHistory?.length)
        continue;
    const user = await employee(actor, String(e.userId));
    const existing = await PayrollRecord.findOne({ schoolId: actor.schoolId, employeeId: e.userId, month }).session(session);
    if (existing && ["APPROVED", "PAID"].includes(existing.status))
        continue;
    const rows = await history(actor, String(e.userId), month, session);
    const leave: any[] = await LeaveRequest.find({ schoolId: actor.schoolId, teacherId: e.userId, status: "APPROVED" }).session(session).lean();
    const activeConfig = await settings(actor);
    const snapshot: any = calculatePayroll(month, user, e, activeConfig.policy, calendar, rows, leave, month === dateKey(new Date(), activeConfig.policy.timezone).slice(0, 7) ? dateKey(new Date(), activeConfig.policy.timezone) : undefined);
    snapshot.inputHash = crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    snapshot.school = await School.findById(actor.schoolId).select("name address phone").session(session).lean();
    snapshot.calculatedAt = new Date();
    snapshot.provisional = month === dateKey(new Date(), config.policy.timezone).slice(0, 7);
    const record = await PayrollRecord.findOneAndUpdate({ schoolId: actor.schoolId, employeeId: e.userId, month }, { $set: { snapshot, status: "CALCULATED", otherDeduction: 0, reference: `PAY-${month}-${e.employeeId}` }, $inc: { revision: 1 } }, { new: true, upsert: true, session });
    await audit(actor, "PAYROLL_CALCULATED", "PayrollRecord", record._id, existing?.toObject(), record.toObject(), session);
    count++;
} return { calculated: count }; }); }
export async function payrollAction(actor: any, id: string, input: any) {
    return transaction(async (session) => {
        const record = await PayrollRecord.findOne({ _id: id, schoolId: actor.schoolId }).session(session);
        if (!record)
            throw { statusCode: 404, message: "Payroll not found." };
        await periodLock(actor, record.month, session);
        const previous = record.toObject();
        if (input.action === "ADJUST") {
            if (!["CALCULATED", "PENDING"].includes(record.status))
                throw { statusCode: 409, message: "Approved/paid payroll is immutable." };
            if (input.amount > record.snapshot.netSalary)
                throw { statusCode: 400, message: "Deduction exceeds payable salary." };
            record.otherDeduction = input.amount;
            record.adjustmentReason = input.reason;
        }
        else if (input.action === "SUBMIT") {
            if (record.status !== "CALCULATED")
                throw { statusCode: 409, message: "Payroll must be calculated first." };
            record.status = "PENDING";
        }
        else if (input.action === "APPROVE") {
            if (record.status !== "PENDING")
                throw { statusCode: 409, message: "Only pending payroll can be approved." };
            const config = await settings(actor);
            if (record.month >= dateKey(new Date(), config.policy.timezone).slice(0, 7))
                throw { statusCode: 409, message: "Approve after the payroll month ends; current calculations are provisional." };
            const employment: any = await StaffEmployment.findOne({ schoolId: actor.schoolId, userId: record.employeeId }).session(session).lean();
            if (!employment)
                throw { statusCode: 409, message: "Employment configuration changed. Recalculate payroll." };
            const currentUser = await employee(actor, String(record.employeeId));
            const calendar: any[] = await SchoolCalendar.find({ schoolId: actor.schoolId, date: { $gte: record.month + "-01", $lte: record.month + "-31" } }).session(session).lean();
            const rows = await history(actor, String(record.employeeId), record.month, session);
            const leaves: any[] = await LeaveRequest.find({ schoolId: actor.schoolId, teacherId: record.employeeId, status: "APPROVED" }).session(session).lean();
            const calculation = calculatePayroll(record.month, currentUser, employment, config.policy, calendar, rows, leaves);
            if (crypto.createHash("sha256").update(JSON.stringify(calculation)).digest("hex") !== record.snapshot.inputHash)
                throw { statusCode: 409, message: "Attendance, salary, calendar or policy changed. Recalculate payroll before approval." };
            record.status = "APPROVED";
            record.approvedAt = new Date();
            record.approvedBy = actor.userId;
            record.approvedByName = (await employee(actor,actor.userId)).name;
        }
        else {
            if (record.status !== "APPROVED")
                throw { statusCode: 409, message: "Only approved payroll can be paid once." };
            record.status = "PAID";
            record.paidAt = new Date();
            record.paidBy = actor.userId;
            record.paidByName = (await employee(actor,actor.userId)).name;
            record.paymentMethod = input.method;
            record.paymentReference = input.reference;
        }
        record.revision++;
        await record.save({ session });
        await audit(actor, "PAYROLL_" + input.action, "PayrollRecord", record._id, previous, record.toObject(), session);
        return record;
    });
}
export async function reviewLeave(actor: any, id: string, status: string, reviewer: string, comment?: string) { return transaction(async (session) => { const leave = await LeaveRequest.findOne({ _id: id, schoolId: actor.schoolId }).session(session); if (!leave)
    throw { statusCode: 404, message: "Leave not found." }; if (leave.status !== "PENDING")
    throw { statusCode: 409, message: "Leave already reviewed." }; for (let month = leave.startDate.toISOString().slice(0, 7); month <= leave.endDate.toISOString().slice(0, 7);) {
    await periodLock(actor, month, session);
    await unlocked(actor, String(leave.teacherId), month + "-01", session);
    const d = new Date(month + "-01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    month = d.toISOString().slice(0, 7);
} const previous = leave.toObject(); leave.status = status; leave.reviewedByUserName = reviewer; leave.reviewComment = comment || ""; leave.reviewedAt = new Date(); await leave.save({ session }); await audit(actor, "LEAVE_REVIEW", "LeaveRequest", id, previous, leave.toObject(), session); return leave; }); }
// Compatibility projection for existing teacher dashboards/reports. No second attendance engine or dual-write ledger.
export async function teacherBatches(schoolId: string, from?: string, to?: string, teacherId?: string) { const config = await settings({ schoolId }); const filter: any = { schoolId, ...(teacherId ? { employeeId: teacherId } : {}) }; if (from || to)
    filter.date = { ...(from ? { $gte: from.slice(0, 10) } : {}), ...(to ? { $lte: to.slice(0, 10) } : {}) }; const rows: any[] = await StaffAttendance.find(filter).populate("employeeId", "name userType").sort({ date: -1 }).lean(); const groups = new Map<string, any>(); for (const r of rows) {
    if (r.employeeId?.userType !== "TEACHER")
        continue;
    let batch = groups.get(r.date);
    if (!batch) {
        batch = { date: new Date(r.date + "T00:00:00Z"), dateKey: r.date, timezone: config.policy.timezone, records: [] };
        groups.set(r.date, batch);
    }
    batch.records.push({ teacherUserId: r.employeeId._id, teacherName: r.employeeId.name, status: r.status, arrivalTime: r.checkedInAt ? localTime(r.checkedInAt, config.policy.timezone) : undefined, checkedInAt: r.checkedInAt, checkedOutAt: r.checkedOutAt, lateMinutes: r.lateMinutes, source: r.source });
} return [...groups.values()]; }
export function mergeTeacherBatches(legacy: any[], fresh: any[]) { const batches = new Map<string, any>(); for (const batch of [...legacy, ...fresh]) {
    const key = batch.dateKey || dateKey(new Date(batch.date), fresh[0]?.timezone || DEFAULT_POLICY.timezone);
    const row = batches.get(key) || { date: batch.date, records: [] };
    for (const record of batch.records) {
        const idx = row.records.findIndex((x: any) => String(x.teacherUserId) === String(record.teacherUserId));
        if (idx >= 0)
            row.records[idx] = record;
        else
            row.records.push(record);
    }
    batches.set(key, row);
} return [...batches.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); }
