import { resolveBranchContext } from "./branchContext.service";
import { School } from "../models/school.model";
import { branchContext, withoutBranchScope } from "../utils/branchScope";
import mongoose, { Types } from "mongoose";
import * as XLSX from "xlsx";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import { IMPORT_COLUMNS, ImportEntity, ImportSummary } from "../../lib/bulk-import";
import { StudentCreateSchema, TeacherAdminCreateSchema } from "../validators/domain.validator";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
import { Subject } from "../models/subject.model";
import { TeacherProfile, TeachingAssignment } from "../models/teacherProfile.model";
import { TeacherNotification } from "../models/teacherNotification.model";
import { AuditLog } from "../models/auditLog.model";
import { BulkImport } from "../models/bulkImport.model";
import { SubscriptionEntitlementService } from "./subscriptionEntitlement.service";
import { UserType, UserStatus } from "../constants/roles.constant";
import { hashPassword } from "../utils/password.util";
import { env } from "../config/env";
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
type Row = {
    rowNumber: number;
    values: Record<string, string>;
    status: string;
    issues: string[];
    data?: any;
    recordId?: string;
    credential?: string;
};
const fail = (message: string, statusCode = 400): never => { throw { statusCode, message }; };
const key = (v: any) => String(v ?? "").trim().toLowerCase();
const secret = createHash("sha256").update(env.JWT_REFRESH_SECRET + ":bulk-import-passwords:v1").digest();
const workers = new Set<string>();
function seal(value: string) { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", secret, iv); const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64"); }
function unseal(value: string) { const b = Buffer.from(value, "base64"), cipher = createDecipheriv("aes-256-gcm", secret, b.subarray(0, 12)); cipher.setAuthTag(b.subarray(12, 28)); return Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString("utf8"); }
export function summarize(rows: Row[]): ImportSummary {
    const count = (status: string) => rows.filter(r => r.status === status).length;
    return { total: rows.length, valid: count("VALID") + count("IMPORTED"), invalid: count("INVALID"), duplicate: count("DUPLICATE"), imported: count("IMPORTED"), failed: count("FAILED"), ready: count("VALID") };
}
function publicJob(job: any, page = 1) {
    const rows: Row[] = job.rows || [], pages = Math.max(1, Math.ceil(rows.length / 50));
    page = Math.min(pages, Math.max(1, Math.floor(page) || 1));
    return { id: String(job._id), entity: job.entity, filename: job.filename, status: job.status, summary: job.summary, processed: job.processed || 0, message: job.message, expiresAt: job.expiresAt, page, pages, rows: rows.slice((page - 1) * 50, page * 50).map(({ rowNumber, values, status, issues }) => ({ rowNumber, values, status, issues })) };
}
export function parseImportFile(entity: ImportEntity, filename: string, encoded: string): Row[] {
    if (!/\.(xlsx|xls|csv)$/i.test(filename))
        fail("Choose an XLSX, XLS or CSV file.");
    if (typeof encoded !== "string" || encoded.length > Math.ceil(MAX_IMPORT_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
        fail("The upload is invalid or exceeds the 5 MB limit.");
    const buffer = Buffer.from(encoded, "base64");
    if (!buffer.length || buffer.length > MAX_IMPORT_BYTES)
        fail("Choose a non-empty file under 5 MB.");
    // Bound ZIP expansion before SheetJS reads XLSX shared strings and XML.
    if (buffer.length >= 2 && buffer.readUInt16LE(0) === 0x4b50) {
        let expanded = 0;
        for (let i = 0; i + 46 < buffer.length; i++)
            if (buffer.readUInt32LE(i) === 0x02014b50) {
                expanded += buffer.readUInt32LE(i + 24);
                if (expanded > 40 * 1024 * 1024)
                    fail("This workbook expands beyond the safe 40 MB limit. Split it into smaller files.");
                i += 45 + buffer.readUInt16LE(i + 28) + buffer.readUInt16LE(i + 30) + buffer.readUInt16LE(i + 32);
            }
    }
    let book: XLSX.WorkBook;
    try {
        book = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: true, sheetRows: MAX_IMPORT_ROWS + 2, raw: true });
    }
    catch {
        return fail("This spreadsheet could not be read. Save an unencrypted Excel workbook or UTF-8 CSV and try again.");
    }
    const sheet = book.Sheets[book.SheetNames.find(n => key(n) === entity) || book.SheetNames[0]];
    if (!sheet?.["!ref"])
        fail("The spreadsheet has no data sheet.");
    const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]!);
    if (range.e.r > MAX_IMPORT_ROWS || range.e.c > 99)
        fail("Use at most 5,000 rows and 100 columns per file.");
    const columns = IMPORT_COLUMNS[entity], header = new Map<string, number>();
    for (let c = 0; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })], label = String(cell?.v ?? "").trim();
        if (!label)
            continue;
        const column = columns.find(v => key(v.label) === key(label));
        if (!column)
            return fail(`Unsupported column '${label}'. Use the ${entity} template.`);
        if (header.has(column.key))
            fail(`Column '${label}' occurs more than once.`);
        header.set(column.key, c);
    }
    const missing = columns.filter(c => c.required && !header.has(c.key));
    if (missing.length)
        fail(`Missing required columns: ${missing.map(c => c.label).join(", ")}.`);
    const rows: Row[] = [];
    for (let r = 1; r <= range.e.r; r++) {
        const values: Record<string, string> = {}, issues: string[] = [];
        for (const column of columns) {
            const c = header.get(column.key), cell = c === undefined ? undefined : sheet[XLSX.utils.encode_cell({ r, c })];
            let value = cell?.v ?? "";
            if (cell?.f)
                issues.push(`${column.label}: formulas are not accepted; paste values instead.`);
            if (value instanceof Date)
                value = value.toISOString().slice(0, 10);
            if (["dob", "admissionDate"].includes(column.key) && typeof value === "number") {
                const d = XLSX.SSF.parse_date_code(value, { date1904: book.Workbook?.WBProps?.date1904 });
                value = d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : "Invalid date";
            }
            values[column.key] = String(value).trim();
            if (values[column.key].length > 2000)
                issues.push(`${column.label}: maximum 2,000 characters per cell.`);
        }
        if (Object.values(values).some(Boolean) || issues.length)
            rows.push({ rowNumber: r + 1, values, status: issues.length ? "INVALID" : "VALID", issues });
    }
    if (!rows.length)
        fail("No records found. Fill the data sheet, leaving the header row unchanged.");
    return rows;
}
async function context(schoolId: string, entity: ImportEntity, includeRecords = true) {
    const [classes, sections, sessions, subjects, students, profiles] = await Promise.all([
        ClassModel.find({ schoolId }).lean(), SectionModel.find({ schoolId }).lean(), AcademicSession.find({ schoolId }).lean(), Subject.find({ schoolId }).lean(),
        includeRecords && entity === "students" ? Student.find({ schoolId }).select("studentId admissionNumber rollNumber classId sectionId academicSessionId").lean() : [],
        includeRecords && entity === "teachers" ? TeacherProfile.find({ schoolId }).select("employeeId").lean() : [],
    ]);
    return { classes, sections, sessions, subjects, students, profiles };
}
function resolve(list: any[], value: string, label: string, scope: Record<string, string> = {}, fallback?: any) {
    if (!value && fallback)
        return fallback;
    const matches = list.filter(v => Object.entries(scope).every(([k, id]) => String(v[k]) === id) && [v._id, v.name, v.code].some(x => x != null && key(x) === key(value)));
    if (matches.length !== 1)
        throw new Error(`${label} '${value || "(blank)"}' ${matches.length > 1 ? "is ambiguous; use its ID" : "does not exist in this school's selected structure"}.`);
    return matches[0];
}
function strictDate(value: string, label: string, optional = false) {
    if (!value && optional)
        return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
        throw new Error(`${label}: use a valid YYYY-MM-DD date or Excel date cell.`);
    return new Date(value);
}
function rollPrefix(cls: any, section: any) { return `${String(cls.name.match(/\d+/)?.[0] || cls.numericLevel || cls.name).trim().replace(/\s+/g, "-")}-${String(section.name).replace(/^section\s*/i, "").trim().replace(/\s+/g, "-")}-`; }
function rowData(entity: ImportEntity, row: Row, ctx: Awaited<ReturnType<typeof context>>, reserved: Map<string, number>) {
    const v = row.values, current = ctx.sessions.find((s: any) => s.isCurrent);
    if (entity === "students") {
        const cls = resolve(ctx.classes, v.class, "Class"), section = resolve(ctx.sections, v.section, "Section", { classId: String(cls._id) }), session = resolve(ctx.sessions, v.academicSession, "Academic session", {}, current);
        const group = [session._id, cls._id, section._id].join(":"), prefix = rollPrefix(cls, section);
        if (!reserved.has(group))
            reserved.set(group, ctx.students.filter((s: any) => [s.academicSessionId, s.classId, s.sectionId].join(":") === group).reduce((max: number, s: any) => { const suffix = String(s.rollNumber).startsWith(prefix) ? String(s.rollNumber).slice(prefix.length) : ""; return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max; }, 0));
        if (v.rollNumber?.startsWith(prefix) && /^\d+$/.test(v.rollNumber.slice(prefix.length)))
            reserved.set(group, Math.max(reserved.get(group)!, Number(v.rollNumber.slice(prefix.length))));
        const rollNumber = v.rollNumber || `${prefix}${reserved.get(group)! + 1}`;
        if (!v.rollNumber)
            reserved.set(group, reserved.get(group)! + 1);
        return StudentCreateSchema.parse({ name: v.name, dob: strictDate(v.dob, "Date of Birth"), gender: v.gender, classId: String(cls._id), className: cls.name, sectionId: String(section._id), sectionName: section.name, academicSessionId: String(session._id), academicSessionName: session.name, rollNumber, studentId: v.studentId || `STU-${randomUUID()}`, admissionNumber: v.admissionNumber || `ADM-${new Date().getFullYear()}-${randomUUID().slice(0, 12)}`, admissionDate: strictDate(v.admissionDate, "Admission Date", true) || new Date(), address: v.address, phone: v.phone || undefined, parentInfo: { fatherName: v.fatherName, fatherPhone: v.fatherPhone, fatherCnic: v.fatherCnic, fatherOccupation: v.fatherOccupation, motherName: v.motherName, motherPhone: v.motherPhone, guardianName: v.guardianName, guardianPhone: v.guardianPhone, guardianEmail: v.guardianEmail, guardianRelation: v.guardianRelation }, emergencyContact: { name: v.emergencyName, phone: v.emergencyPhone, relation: v.emergencyRelation } });
    }
    const assignments: any[] = [];
    if (v.class || v.section || v.subject) {
        const split = (s: string) => s.split(";").map(x => x.trim()), classes = split(v.class), sections = split(v.section), subjects = split(v.subject), sessions = split(v.academicSession);
        if (!v.class || !v.section || !v.subject || classes.length !== sections.length || classes.length !== subjects.length || ![1, classes.length].includes(sessions.length))
            throw new Error("Assignments need paired Classes, Sections and Subjects separated by semicolons; use one session or one per assignment.");
        classes.forEach((name, i) => { const cls = resolve(ctx.classes, name, "Class"), section = resolve(ctx.sections, sections[i], "Section", { classId: String(cls._id) }), subject = resolve(ctx.subjects, subjects[i], "Subject", { classId: String(cls._id) }), session = resolve(ctx.sessions, sessions.length === 1 ? sessions[0] : sessions[i], "Academic session", {}, current); assignments.push({ academicSessionId: String(session._id), classId: String(cls._id), sectionId: String(section._id), subjectId: String(subject._id) }); });
        if (new Set(assignments.map(a => Object.values(a).join(":"))).size !== assignments.length)
            throw new Error("The same teaching assignment occurs more than once.");
    }
    return TeacherAdminCreateSchema.parse({ name: v.name, email: v.email.toLowerCase(), password: v.password, employeeId: v.employeeId || undefined, qualification: v.qualification || undefined, phone: v.phone || undefined, assignments });
}
function duplicateKeys(entity: ImportEntity, data: any) { return entity === "students" ? [`Admission Number:${key(data.admissionNumber)}`, `Student ID:${key(data.studentId)}`, `Roll Number:${[data.academicSessionId, data.classId, data.sectionId, key(data.rollNumber)].join(":")}`] : [`Email:${key(data.email)}`, ...(data.employeeId ? [`Employee ID:${key(data.employeeId)}`] : [])]; }
function validationIssues(error: any) { return error.issues ? error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`) : [error.message || "Record could not be validated."]; }
export class BulkImportService {
    static async template(schoolId: string, entity: ImportEntity) {
        const ctx = await context(schoolId, entity, false), columns = IMPORT_COLUMNS[entity], book = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet([columns.map(c => c.label)]);
        sheet["!cols"] = columns.map(c => ({ wch: Math.min(36, Math.max(20, c.label.length + 4)) }));
        sheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(columns.length - 1)}1` };
        XLSX.utils.book_append_sheet(book, sheet, entity === "students" ? "Students" : "Teachers");
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Field", "Required", "Instructions"], ...columns.map(c => [c.label, c.required ? "Yes" : "No", c.instruction || "Enter the existing record's value."]), ["Workflow", "", "Fill the data sheet only. Examples and reference sheets are never imported. Preview performs no record creation. Duplicates are skipped, never overwritten."], ["Limit", "", "5 MB; 5,000 rows. Dates YYYY-MM-DD. Keep IDs and phone numbers as text."], ["Unsupported fields", "", entity === "students" ? "Student email, previous school and blood group are not student schema fields." : "DOB, gender, address, CNIC, department and joining date are not teacher schema fields."]]), "Instructions");
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([columns.map(c => c.label), columns.map(c => c.example)]), "Example (do not import)");
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Class", "Class Code", "Section", "Class ID", "Section ID"], ...ctx.sections.map((s: any) => { const c = ctx.classes.find((c: any) => String(c._id) === String(s.classId)); return [c?.name, c?.code, s.name, String(s.classId), String(s._id)]; })]), "School classes and sections");
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Session", "Current", "ID"], ...ctx.sessions.map((s: any) => [s.name, s.isCurrent ? "Yes" : "No", String(s._id)])]), "Academic sessions");
        if (entity === "teachers")
            XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Class", "Subject", "Code", "ID"], ...ctx.subjects.map((s: any) => [s.className, s.name, s.code, String(s._id)])]), "School subjects");
        for (const s of Object.values(book.Sheets)) {
            s["!cols"] ??= Array.from({ length: XLSX.utils.decode_range(s["!ref"] || "A1").e.c + 1 }, () => ({ wch: 32 }));
            for (const [addr, cell] of Object.entries(s))
                if (!addr.startsWith("!") && (cell as XLSX.CellObject).t === "s")
                    (cell as XLSX.CellObject).z = "@";
        }
        return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    }
    static async preview(schoolId: string, actorId: string, entity: ImportEntity, filename: string, encoded: string) {
        const rows = parseImportFile(entity, filename, encoded), ctx = await context(schoolId, entity), reserved = new Map<string, number>(), seen = new Map<string, Row[]>();
        const existing = new Set<string>();
        if (entity === "students")
            ctx.students.forEach((s: any) => duplicateKeys(entity, s).forEach(k => existing.add(k)));
        else {
            ctx.profiles.filter((p: any) => p.employeeId).forEach((p: any) => existing.add(`Employee ID:${key(p.employeeId)}`));
            const emails = rows.map(r => key(r.values.email));
            const users = await User.find({ email: { $in: emails } }).select("email").lean();
            users.forEach((u: any) => existing.add(`Email:${key(u.email)}`));
        }
        for (const row of rows) {
            try {
                if (row.issues.length)
                    continue;
                row.data = rowData(entity, row, ctx, reserved);
                row.recordId = new Types.ObjectId().toString();
                for (const k of duplicateKeys(entity, row.data)) {
                    if (existing.has(k)) {
                        row.status = "DUPLICATE";
                        row.issues.push(`${k.split(":")[0]} already exists. Existing records will not be overwritten.`);
                    }
                    const list = seen.get(k) || [];
                    list.push(row);
                    seen.set(k, list);
                }
            }
            catch (e: any) {
                row.status = "INVALID";
                row.issues.push(...validationIssues(e));
            }
        }
        for (const [k, list] of seen)
            if (list.length > 1)
                for (const row of list) {
                    row.status = "DUPLICATE";
                    row.issues.push(`${k.split(":")[0]} is repeated in spreadsheet rows ${list.slice(0, 10).map(r => r.rowNumber).join(", ") + (list.length > 10 ? ` and ${list.length - 10} more` : "")}.`);
                }
        const entitlement = await SubscriptionEntitlementService.evaluateSchoolSubscription(schoolId);
        const currentCount = entity === "students" ? await Student.countDocuments({ schoolId, status: "ACTIVE" }) : await User.countDocuments({ schoolId, userType: UserType.TEACHER, status: "ACTIVE" });
        const capacity = (entity === "students" ? entitlement.limits.maxStudents : entitlement.limits.maxTeachers) - currentCount;
        let ready = 0;
        for (const row of rows) {
            if (row.status === "VALID" && ++ready > capacity) {
                row.status = "INVALID";
                row.issues.push(`Your ${entitlement.planName} plan has no remaining ${entity} capacity for this row.`);
            }
            if (entity === "teachers") {
                if (row.status === "VALID") {
                    row.credential = seal(row.data.password);
                    delete row.data.password;
                }
                row.values.password = row.values.password ? "[Hidden]" : "";
            }
            if (row.status !== "VALID") {
                delete row.data;
                delete row.credential;
            }
        }
        if (Buffer.byteLength(JSON.stringify(rows), "utf8") > 12 * 1024 * 1024) fail("This file contains too much record data for one import. Split it into smaller files.");
        const job = await BulkImport.create({ schoolId, actorId, entity, filename: filename.replace(/[\\/]/g, "_").slice(0, 150), rows, summary: summarize(rows), expiresAt: new Date(Date.now() + 86400000) });
        return publicJob(job);
    }
    static async get(schoolId: string, actorId: string, id: string, page = 1) { const job = await this.owned(schoolId, actorId, id); if (job.status === "PROCESSING" && !workers.has(id))
        void this.run(id).catch(() => console.error("[BulkImport] Worker interrupted; recovery will retry.")); return publicJob(job, page); }
    private static async owned(schoolId: string, actorId: string, id: string) { if (!Types.ObjectId.isValid(id))
        fail("Import not found.", 404); const job = await BulkImport.findOne({ _id: id, schoolId, actorId, expiresAt: { $gt: new Date() } }).select("+rows").lean(); if (!job)
        fail("Import not found or expired. Upload the file again.", 404); return job as any; }
    static async start(schoolId: string, actorId: string, id: string, skipDuplicates: boolean) {
        const existing = await this.owned(schoolId, actorId, id);
        if (existing.status !== "PREVIEW")
            return publicJob(existing);
        if (existing.summary.duplicate && !skipDuplicates)
            fail("Choose Skip Duplicate Records, or upload a corrected file.");
        if (!existing.summary.ready)
            fail("There are no valid rows to import.");
        // Claim once; a database partial unique index serializes imports per tenant/entity.
        try {
            const claimed = await BulkImport.findOneAndUpdate({ _id: id, schoolId, actorId, status: "PREVIEW" }, { $set: { status: "PROCESSING", heartbeatAt: new Date(), expiresAt: new Date(Date.now() + 86400000) } }, { new: true }).select("+rows").lean();
            if (claimed) {
                void this.run(id).catch(() => console.error("[BulkImport] Worker interrupted; recovery will retry."));
                return publicJob(claimed);
            }
        }
        catch (e: any) {
            if (e.code === 11000)
                fail("Another import for this school is running. Wait for it to finish.", 409);
            throw e;
        }
        return publicJob(await this.owned(schoolId, actorId, id));
    }
    static async resume() { const pending = await BulkImport.find({ status: "PROCESSING", expiresAt: { $gt: new Date() } }).select("_id").lean(); pending.forEach((j: any) => { void this.run(String(j._id)).catch(() => console.error("[BulkImport] Worker interrupted; recovery will retry.")); }); }
    static async run(id: string) {
        const job: any = await withoutBranchScope(() => BulkImport.findById(id).lean().exec());
        if (!job) return;
        return branchContext.run({ organizationId: String(job.schoolId), branchId: String(job.branchId || job.schoolId), mainBranchId: String(job.schoolId), owner: false, userId: String(job.actorId), userType: "SCHOOL_ADMIN" }, () => this.executeRun(id));
    }
    private static async executeRun(id: string) {
        if (workers.has(id))
            return;
        workers.add(id);
        const leaseToken = randomUUID();
        try {
            const job: any = await BulkImport.findOneAndUpdate({ _id: id, status: "PROCESSING", $or: [{ leaseUntil: { $lt: new Date() } }, { leaseUntil: { $exists: false } }] }, { $set: { leaseToken, leaseUntil: new Date(Date.now() + 300000) } }, { new: true }).select("+rows").lean();
            if (!job)
                return;
            const rows: Row[] = job.rows, schoolId = String(job.schoolId), entity: ImportEntity = job.entity;
            const pending = rows.map((row, index) => ({ row, index })).filter(x => x.row.status === "VALID");
            for (let start = 0; start < pending.length; start += 100) {
                const entitlement = await SubscriptionEntitlementService.evaluateSchoolSubscription(schoolId);
                if (!entitlement.isActive)
                    throw new Error("School subscription no longer permits imports.");
                await BulkImport.updateOne({ _id: id, leaseToken }, { $set: { leaseUntil: new Date(Date.now() + 300000) } });
                const [actor, school] = await withoutBranchScope(() => Promise.all([User.findById(job.actorId).populate("roleId").exec(), School.findById(schoolId).exec()]));
                if (!actor || actor.status !== "ACTIVE" || actor.userType !== "SCHOOL_ADMIN" || !actor.roleId?.permissions?.includes(`${entity}.create`) || !school) throw new Error("Import authorization is no longer valid.");
                await resolveBranchContext(actor, school, String(job.branchId || schoolId));
                const batch = pending.slice(start, start + 100), ctx = await context(schoolId, entity);
                const existing = new Set<string>();
                if (entity === "students")
                    ctx.students.forEach((s: any) => duplicateKeys(entity, s).forEach(k => existing.add(k)));
                else {
                    ctx.profiles.filter((p: any) => p.employeeId).forEach((p: any) => existing.add(`Employee ID:${key(p.employeeId)}`));
                    const users = await User.find({ email: { $in: batch.map(x => x.row.data.email) } }).select("email").lean();
                    users.forEach((u: any) => existing.add(`Email:${key(u.email)}`));
                }
                const count = await withoutBranchScope(() => entity === "students" ? Student.countDocuments({ schoolId, status: "ACTIVE" }).exec() : User.countDocuments({ schoolId, userType: UserType.TEACHER, status: "ACTIVE" }).exec());
                let available = (entity === "students" ? entitlement.limits.maxStudents : entitlement.limits.maxTeachers) - count;
                const valid: typeof batch = [];
                for (const item of batch) {
                    const r = item.row;
                    try {
                        const d = r.data;
                        resolve(ctx.classes, String(d.classId || d.assignments?.[0]?.classId || ""), "Class", {}, entity === "teachers" && !d.assignments?.length ? {} : undefined);
                        if (entity === "students") {
                            resolve(ctx.sections, String(d.sectionId), "Section", { classId: String(d.classId) });
                            resolve(ctx.sessions, String(d.academicSessionId), "Academic session");
                            StudentCreateSchema.parse(d);
                        }
                        else {
                            for (const a of d.assignments) {
                                resolve(ctx.classes, a.classId, "Class");
                                resolve(ctx.sections, a.sectionId, "Section", { classId: a.classId });
                                resolve(ctx.subjects, a.subjectId, "Subject", { classId: a.classId });
                                resolve(ctx.sessions, a.academicSessionId, "Academic session");
                            }
                            TeacherAdminCreateSchema.parse({ ...d, password: unseal(r.credential!) });
                        }
                        if (duplicateKeys(entity, d).some(k => existing.has(k))) {
                            r.status = "DUPLICATE";
                            r.issues.push("A matching record was created after preview. Skipped without overwriting.");
                            continue;
                        }
                        if (available-- <= 0)
                            throw new Error("The school's subscription capacity was reached before this row could be imported.");
                        if (entity === "teachers") {
                            d.passwordHash = await hashPassword(unseal(r.credential!));
                            await BulkImport.updateOne({ _id: id, leaseToken }, { $set: { leaseUntil: new Date(Date.now() + 300000) } });
                        }
                        valid.push(item);
                    }
                    catch (e: any) {
                        r.status = "FAILED";
                        r.issues.push(...validationIssues(e));
                    }
                }
                let role: any;
                if (entity === "teachers" && valid.length) {
                    role = await Role.findOne({ schoolId, userType: UserType.TEACHER }) || await Role.findOne({ schoolId: null, userType: UserType.TEACHER });
                    if (!role)
                        role = await Role.create({ schoolId, name: "TEACHER Staff Role", code: "ROLE_TEACHER", userType: UserType.TEACHER, permissions: [], isSystemRole: false });
                }
                const write = async (items: typeof valid): Promise<void> => {
                    if (!items.length)
                        return;
                    const session = await mongoose.startSession();
                    try {
                        await session.withTransaction(async () => {
                            if (entity === "students")
                                await Student.insertMany(items.map(({ row: r }) => ({ ...r.data, _id: new Types.ObjectId(r.recordId), schoolId, status: "ACTIVE" })), { session, ordered: true });
                            else {
                                await User.insertMany(items.map(({ row: r }) => ({ _id: new Types.ObjectId(r.recordId), schoolId, roleId: role._id, userType: UserType.TEACHER, name: r.data.name, email: r.data.email, passwordHash: r.data.passwordHash, status: UserStatus.ACTIVE, isEmailVerified: true })), { session });
                                await TeacherProfile.insertMany(items.map(({ row: r }) => ({ schoolId, userId: r.recordId, qualification: r.data.qualification, employeeId: r.data.employeeId, phone: r.data.phone })), { session });
                                const assignments = items.flatMap(({ row: r }) => r.data.assignments.map((a: any) => ({ ...a, schoolId, teacherUserId: r.recordId, status: "ACTIVE" })));
                                if (assignments.length)
                                    await TeachingAssignment.insertMany(assignments, { session });
                            }
                            const updates: Record<string, any> = { heartbeatAt: new Date() };
                            items.forEach(({ index }) => { updates[`rows.${index}.status`] = "IMPORTED"; updates[`rows.${index}.data`] = null; updates[`rows.${index}.credential`] = null; });
                            const saved = await BulkImport.updateOne({ _id: id, schoolId, status: "PROCESSING", leaseToken }, { $set: updates }, { session });
                            if (saved.matchedCount !== 1)
                                throw new Error("Import worker lease expired.");
                        });
                        items.forEach(({ row }) => { row.status = "IMPORTED"; });
                    }
                    catch (e: any) {
                        if (e.code === 11000 || e.name === "ValidationError") {
                            if (items.length > 1) {
                                const half = Math.ceil(items.length / 2);
                                await write(items.slice(0, half));
                                await write(items.slice(half));
                            }
                            else {
                                items[0].row.status = e.code === 11000 ? "DUPLICATE" : "FAILED";
                                items[0].row.issues.push(e.code === 11000 ? "A unique identifier is already in use. Record skipped." : "Database record validation failed.");
                            }
                        }
                        else
                            throw e;
                    }
                    finally {
                        await session.endSession();
                    }
                };
                await write(valid);
                const updates: Record<string, any> = { summary: summarize(rows), processed: rows.filter(r => r.status !== "VALID").length, heartbeatAt: new Date() };
                batch.forEach(({ row, index }) => { updates[`rows.${index}.status`] = row.status; updates[`rows.${index}.issues`] = row.issues; updates[`rows.${index}.data`] = null; updates[`rows.${index}.credential`] = null; });
                await BulkImport.updateOne({ _id: id, leaseToken }, { $set: updates });
                const imported = valid.filter(({ row }) => row.status === "IMPORTED");
                if (entity === "students" && imported.length) {
                    const groups = new Map<string, typeof imported>();
                    imported.forEach(item => { const d = item.row.data, k = [d.academicSessionId, d.classId, d.sectionId].join(":"); groups.set(k, [...(groups.get(k) || []), item]); });
                    for (const group of groups.values()) {
                        const d = group[0].row.data, teachers = await TeachingAssignment.find({ schoolId, academicSessionId: d.academicSessionId, classId: d.classId, sectionId: d.sectionId, status: "ACTIVE" }).distinct("teacherUserId");
                        if (teachers.length)
                            await TeacherNotification.insertMany(teachers.map(teacherUserId => ({ schoolId, teacherUserId, title: "Students added to your class", message: `${group.length} students were imported into ${d.className} / ${d.sectionName}.`, href: "/teacher/students" }))).catch(() => console.warn("[BulkImport] Student assignment notifications could not be recorded."));
                    }
                }
                if (entity === "teachers" && imported.length)
                    await TeacherNotification.insertMany(imported.map(({ row }) => ({ schoolId, teacherUserId: row.recordId, title: "Teacher account imported", message: "Your school administrator created your teaching account and assignments.", href: "/teacher/subjects" }))).catch(() => console.warn("[BulkImport] Teacher notifications could not be recorded."));
            }
            const summary = summarize(rows);
            const actor = await User.findById(job.actorId).select("name email"), completion = await mongoose.startSession();
            try {
                await completion.withTransaction(async () => { const finished = await BulkImport.updateOne({ _id: id, leaseToken, status: "PROCESSING" }, { $set: { status: "COMPLETED", summary, processed: rows.length } }, { session: completion }); if (finished.matchedCount !== 1)
                    throw new Error("Import worker lease expired."); await AuditLog.create([{ actorName: actor?.name, actorEmail: actor?.email, actorRole: UserType.SCHOOL_ADMIN, schoolId, action: "BULK_IMPORT", resource: entity, details: JSON.stringify({ importId: id, ...summary }) }], { session: completion }); });
            }
            finally {
                await completion.endSession();
            }
        }
        catch (e: any) {
            console.error("[BulkImport] Import worker stopped:", e.code || e.name || "operation failed");
            const job: any = await BulkImport.findById(id).select("+rows").lean();
            if (job && job.status === "PROCESSING" && job.leaseToken === leaseToken) {
                const rows: Row[] = job.rows;
                rows.forEach(r => { if (r.status === "VALID") {
                    r.status = "FAILED";
                    r.issues.push("Import stopped before this record was saved. Review the report and upload remaining rows again.");
                } r.data = null; r.credential = undefined; });
                await BulkImport.updateOne({ _id: id }, { $set: { status: "FAILED", rows, summary: summarize(rows), message: e.code === 20 ? "Bulk imports require MongoDB replica-set transactions. Configure a replica set or MongoDB Atlas, then retry." : "Import stopped safely. Previously committed rows remain saved; remaining rows are in the error report.", processed: rows.length } });
            }
        }
        finally {
            await BulkImport.updateOne({ _id: id, leaseToken }, { $unset: { leaseUntil: 1, leaseToken: 1 } }).catch(() => { });
            workers.delete(id);
        }
    }
    static async errorReport(schoolId: string, actorId: string, id: string) { const job = await this.owned(schoolId, actorId, id), columns = IMPORT_COLUMNS[job.entity as ImportEntity].filter(c => c.key !== "password"), rows = (job.rows as Row[]).filter(r => ["INVALID", "DUPLICATE", "FAILED"].includes(r.status)); const book = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([["Excel Row", "Status", "Reason", ...columns.map(c => c.label)], ...rows.map(r => [r.rowNumber, r.status, r.issues.join("; "), ...columns.map(c => r.values[c.key] || "")])]); sheet["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 80 }, ...columns.map(() => ({ wch: 24 }))]; XLSX.utils.book_append_sheet(book, sheet, "Import errors"); return XLSX.write(book, { type: "buffer", bookType: "xlsx" }); }
}
