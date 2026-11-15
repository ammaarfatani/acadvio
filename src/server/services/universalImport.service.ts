import { School } from "../models/school.model";
import { Branch } from "../models/branch.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { ClassCategory } from "../models/classCategory.model";
import { Subject, TimetableSlot } from "../models/subject.model";
import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { TeacherProfile, TeachingAssignment } from "../models/teacherProfile.model";
import { ClassTeacherAssignment } from "../models/classTeacherAssignment.model";
import { StaffEmployment, StaffDepartment, StaffAttendance, SchoolCalendar, PayrollRecord, SalaryPayment } from "../models/workforce.model";
import { Student } from "../models/student.model";
import { ParentProfile } from "../models/parentProfile.model";
import { StudentAttendance, TeacherAttendance } from "../models/attendance.model";
import { LeaveRequest } from "../models/leaveRequest.model";
import { FeeStructure, FeeChallan, FeePayment, Expense } from "../models/fee.model";
import { ExamSchedule, GradingScale, MarksEntry, ProcessedResult, CertificateRecord, ExamTimetable } from "../models/exam.model";
import { AssessmentPolicy } from "../models/assessmentPolicy.model";
import { Admission } from "../models/admission.model";
import { Visitor } from "../models/visitor.model";
import { Appointment } from "../models/appointment.model";
import { FrontDeskRequest } from "../models/frontDeskRequest.model";
import { StaffCertificate } from "../models/staffCertificate.model";
import { Announcement } from "../models/announcement.model";
import { AuditLog } from "../models/auditLog.model";
import { BulkImport } from "../models/bulkImport.model";
import { SubscriptionEntitlementService } from "./subscriptionEntitlement.service";
import { UniversalTemplateService } from "./universalTemplate.service";
import {
  UNIVERSAL_ENTITIES,
  EntityDefinition,
  ImportColumnDef,
  SubscriptionPlanTier,
  PLAN_ENTITIES,
  PLAN_TIER_DETAILS,
  normalizePlanTier,
} from "../../lib/universal-import-config";
import { ImportRowStatus, ImportSummary } from "../../lib/bulk-import";
import { UserType, UserStatus } from "../constants/roles.constant";
import { hashPassword } from "../utils/password.util";
import { withoutBranchScope, branchContext } from "../utils/branchScope";
import { env } from "../config/env";
import * as XLSX from "xlsx";
import mongoose, { Types } from "mongoose";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024; // 25 MB for large master workbooks
export const MAX_IMPORT_ROWS_PER_SHEET = 10000;

export interface StagedRow {
  sheet: string;
  entity: string;
  rowNumber: number;
  values: Record<string, string>;
  status: ImportRowStatus;
  issues: string[];
  data?: any;
  recordId?: string;
  credential?: string;
}

const secret = createHash("sha256").update((env.JWT_REFRESH_SECRET || "default_jwt_secret_dev_32_chars_ok") + ":bulk-import-passwords:v1").digest();
const activeWorkers = new Set<string>();

function seal(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function unseal(value: string): string {
  const b = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", secret, b.subarray(0, 12));
  cipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString("utf8");
}

const clean = (val: any) => String(val ?? "").trim();
const norm = (val: any) => clean(val).toLowerCase();

function parseDateCell(val: any, book: XLSX.WorkBook): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val, { date1904: book.Workbook?.WBProps?.date1904 });
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  const str = clean(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return str;
}

export class UniversalImportService {
  /**
   * Retrieves active plan tier entitlements and template metadata for a school.
   */
  static async getPlanInfo(schoolId: string) {
    const school: any = await School.findById(schoolId).select("name plan status studentCountRange teacherCount").lean();
    const effectivePlanTier = normalizePlanTier(school?.plan);
    const details = PLAN_TIER_DETAILS[effectivePlanTier];
    const allowedKeys = PLAN_ENTITIES[effectivePlanTier];

    return {
      schoolId,
      schoolName: school?.name,
      plan: school?.plan || "BASIC",
      planTier: effectivePlanTier,
      details,
      allowedEntities: allowedKeys,
      sheetCount: details.sheetCount,
      allPlans: PLAN_TIER_DETAILS,
    };
  }

  /**
   * Generates downloadable Excel templates (plan-specific master, sample, or single-entity).
   */
  static async template(
    schoolId: string,
    entityKey: string,
    planTierOverride?: string,
    typeOverride: "blank" | "example" | "demo" = "blank"
  ): Promise<{ buffer: Buffer; filename: string }> {
    const school: any = await School.findById(schoolId).select("plan").lean();
    const effectivePlan = normalizePlanTier(planTierOverride || school?.plan);
    const planDetails = PLAN_TIER_DETAILS[effectivePlan];

    if (entityKey === "master" || entityKey === "all") {
      if (typeOverride === "example" || typeOverride === "demo") {
        return {
          buffer: UniversalTemplateService.generatePlanExampleWorkbook(effectivePlan),
          filename: planDetails.exampleFilename,
        };
      }
      return {
        buffer: UniversalTemplateService.generatePlanBlankTemplate(effectivePlan),
        filename: planDetails.blankFilename,
      };
    }

    if (entityKey === "sample" || entityKey === "demo") {
      return {
        buffer: UniversalTemplateService.generatePlanExampleWorkbook(effectivePlan),
        filename: planDetails.exampleFilename,
      };
    }

    const def = UNIVERSAL_ENTITIES[entityKey];
    const sheetName = def ? def.sheetName : entityKey;

    if (typeOverride === "example" || typeOverride === "demo") {
      return {
        buffer: UniversalTemplateService.generateModuleExampleTemplate(entityKey),
        filename: `Acadivo-${sheetName}-Example-Data.xlsx`,
      };
    }

    return {
      buffer: UniversalTemplateService.generateModuleTemplate(entityKey),
      filename: `Acadivo-${sheetName}-Blank-Template.xlsx`,
    };
  }

  /**
   * Parses uploaded Excel/CSV file into staged rows across all detected sheets.
   */
  static parseUploadedWorkbook(entityKey: string, filename: string, encodedBase64: string): { isMaster: boolean; rows: StagedRow[] } {
    if (!/\.(xlsx|xls|csv)$/i.test(filename)) {
      throw { statusCode: 400, message: "Upload an Excel (.xlsx, .xls) or CSV file." };
    }
    if (typeof encodedBase64 !== "string" || encodedBase64.length > Math.ceil(MAX_IMPORT_BYTES / 3) * 4) {
      throw { statusCode: 400, message: "File exceeds the maximum 25 MB limit." };
    }

    const buffer = Buffer.from(encodedBase64, "base64");
    if (!buffer.length || buffer.length > MAX_IMPORT_BYTES) {
      throw { statusCode: 400, message: "Choose a valid non-empty spreadsheet under 25 MB." };
    }

    let book: XLSX.WorkBook;
    try {
      book = XLSX.read(buffer, { type: "buffer", cellDates: true, cellFormula: true, raw: true });
    } catch {
      throw { statusCode: 400, message: "Spreadsheet could not be read. Please save an unencrypted Excel workbook and retry." };
    }

    const isMasterRequest =
      entityKey === "master" ||
      entityKey === "all" ||
      entityKey === "complete-school" ||
      entityKey === "school-migration";
    const availableSheets = book.SheetNames;
    const isMasterWorkbook =
      isMasterRequest ||
      availableSheets.length > 1 ||
      availableSheets.some(s =>
        ["Instructions", "Index", "Branches", "AcademicSessions", "ClassCategories", "Classes"].includes(s)
      );

    const targetEntities: EntityDefinition[] = [];

    if (isMasterWorkbook) {
      // Find all matching sheets
      for (const def of Object.values(UNIVERSAL_ENTITIES).sort((a, b) => a.order - b.order)) {
        const found = availableSheets.find(s => norm(s) === norm(def.sheetName) || norm(s) === norm(def.key));
        if (found) {
          targetEntities.push(def);
        }
      }
    } else {
      const detectedBySheet = Object.values(UNIVERSAL_ENTITIES).find(
        def => norm(def.sheetName) === norm(availableSheets[0]) || norm(def.key) === norm(availableSheets[0])
      );
      const def = UNIVERSAL_ENTITIES[entityKey] || detectedBySheet || UNIVERSAL_ENTITIES.students;
      targetEntities.push(def);
    }

    if (!targetEntities.length) {
      throw { statusCode: 400, message: "No recognizable data sheets found in this spreadsheet." };
    }

    const stagedRows: StagedRow[] = [];

    for (const def of targetEntities) {
      const sheetName = availableSheets.find(s => norm(s) === norm(def.sheetName) || norm(s) === norm(def.key)) || availableSheets[0];
      const sheet = book.Sheets[sheetName];
      if (!sheet || !sheet["!ref"]) continue;

      const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]!);
      if (range.e.r < 1) continue; // Only header row or empty

      // Map columns from row 0
      const colMap = new Map<string, number>();
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
        const rawLabel = clean(cell?.v);
        if (!rawLabel) continue;

        // Strip trailing asterisk if present
        const strippedLabel = rawLabel.replace(/\s*\*+$/, "").trim();

        // Match against entity columns
        const matched = def.columns.find(
          col =>
            norm(col.label) === norm(strippedLabel) ||
            norm(col.key) === norm(strippedLabel) ||
            (col.key === "bFormNumber" && ["bform", "b-form", "cnic", "studentbformnumber"].includes(norm(strippedLabel))) ||
            (col.key === "staffIdentifier" && ["staffemail", "employeeid", "staffref"].includes(norm(strippedLabel))) ||
            (col.key === "studentRef" && ["admissionnumber", "rollnumber", "studentid", "studentref"].includes(norm(strippedLabel)))
        );

        if (matched) {
          colMap.set(matched.key, c);
        }
      }

      // Check for required columns
      const missingRequired = def.columns.filter(c => c.required && !colMap.has(c.key));
      if (missingRequired.length && !isMasterWorkbook) {
        throw {
          statusCode: 400,
          message: `Worksheet '${sheetName}' is missing required columns: ${missingRequired.map(c => c.label).join(", ")}.`,
        };
      }

      // Read data rows (starting at row 1, skipping instruction row if present)
      let startRow = 1;
      let isInstructionRow = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const text = clean(sheet[XLSX.utils.encode_cell({ r: 1, c })]?.v).toLowerCase();
        if (
          text.includes("required") ||
          text.includes("optional") ||
          text.includes("format") ||
          text.includes("guidance") ||
          text.includes("instruction") ||
          text.includes("unique code") ||
          text.includes("unique reference") ||
          text.includes("unique identifier") ||
          text.includes("unique portal") ||
          text.includes("unique login") ||
          text.includes("leave blank") ||
          text.includes("official")
        ) {
          isInstructionRow = true;
          break;
        }
      }
      if (isInstructionRow) {
        startRow = 2; // Row 1 was instruction/description row
      }

      for (let r = startRow; r <= range.e.r; r++) {
        if (r - startRow >= MAX_IMPORT_ROWS_PER_SHEET) break;

        const values: Record<string, string> = {};
        const issues: string[] = [];
        let hasAnyValue = false;

        for (const col of def.columns) {
          const c = colMap.get(col.key);
          const cell = c !== undefined ? sheet[XLSX.utils.encode_cell({ r, c })] : undefined;

          if (cell?.f) {
            issues.push(`${col.label}: formulas are not accepted; paste static values.`);
          }

          let val = cell?.v;
          if (["studentId","admissionNumber","employeeId","rollNumber"].includes(col.key) && typeof val === "number" && cell?.w) val = cell.w;
          if (col.type === "date" || col.key.toLowerCase().includes("date")) {
            val = parseDateCell(val, book);
          } else if (val instanceof Date) {
            val = val.toISOString().slice(0, 10);
          }

          const strVal = clean(val);
          values[col.key] = strVal;

          if (strVal) {
            hasAnyValue = true;
          }

          // Validation
          if (col.required && !strVal) {
            issues.push(`${col.label} is required.`);
          }
          if (strVal.length > 2000) {
            issues.push(`${col.label} exceeds 2,000 characters.`);
          }
        }

        // If the entire row is blank or is the example row, skip
        if (!hasAnyValue) continue;
        if (
          values.name === "Example Student" ||
          values.name === "Prof. Ahmed Khan" ||
          values.title === "Example Structure" ||
          (values.email && values.email.toLowerCase().includes("unique"))
        ) {
          continue; // Skip example template or instruction row
        }

        stagedRows.push({
          sheet: def.sheetName,
          entity: def.key,
          rowNumber: r + 1,
          values,
          status: issues.length ? "INVALID" : "VALID",
          issues,
        });
      }
    }

    if (!stagedRows.length) {
      throw { statusCode: 400, message: "No data records found in the uploaded workbook. Fill in at least one data worksheet." };
    }

    return { isMaster: isMasterWorkbook, rows: stagedRows };
  }

  /**
   * Builds an in-memory resolution context of existing records for relationship linking.
   */
  static async buildResolutionContext(schoolId: string) {
    const [
      branches,
      sessions,
      departments,
      classCategories,
      classes,
      sections,
      subjects,
      gradingScales,
      users,
      teacherProfiles,
      students,
      feeStructures,
      feeChallans,
      exams,
      payrollRecords,
    ] = await withoutBranchScope(() =>
      Promise.all([
        Branch.find({ organizationId: schoolId }).lean(),
        AcademicSession.find({ schoolId }).lean(),
        StaffDepartment.find({ schoolId }).lean(),
        ClassCategory.find({ schoolId }).lean(),
        ClassModel.find({ schoolId }).lean(),
        SectionModel.find({ schoolId }).lean(),
        Subject.find({ schoolId }).lean(),
        GradingScale.find({ schoolId }).lean(),
        User.find({ schoolId }).select("_id name email employeeId userType status roleId").lean(),
        TeacherProfile.find({ schoolId }).select("_id userId employeeId qualification phone").lean(),
        Student.find({ schoolId }).select("_id studentId admissionNumber rollNumber classId sectionId academicSessionId status").lean(),
        FeeStructure.find({ schoolId }).lean(),
        FeeChallan.find({ schoolId }).select("_id challanNumber studentId month totalAmountPKR paidAmountPKR remainingAmountPKR status").lean(),
        ExamSchedule.find({ schoolId }).select("_id title term academicSessionId status").lean(),
        PayrollRecord.find({ schoolId }).select("_id employeeId month reference status").lean(),
      ])
    );

    return {
      branches: branches as any[],
      sessions: sessions as any[],
      departments: departments as any[],
      classCategories: classCategories as any[],
      classes: classes as any[],
      sections: sections as any[],
      subjects: subjects as any[],
      gradingScales: gradingScales as any[],
      users: users as any[],
      teacherProfiles: teacherProfiles as any[],
      students: students as any[],
      feeStructures: feeStructures as any[],
      feeChallans: feeChallans as any[],
      exams: exams as any[],
      payrollRecords: payrollRecords as any[],
      // Dynamic ID mapping for rows imported within this batch
      createdRefs: new Map<string, string>(),
    };
  }

  /**
   * Previews workbook: performs full validation, relationship checks, and duplicate detection.
   */
  static async preview(schoolId: string, actorId: string, entityKey: string, filename: string, encodedBase64: string) {
    const { isMaster, rows } = this.parseUploadedWorkbook(entityKey, filename, encodedBase64);
    const ctx = await this.buildResolutionContext(schoolId);

    const school: any = await School.findById(schoolId).select("name plan").lean();
    const effectivePlanTier = normalizePlanTier(school?.plan);
    const allowedEntitySet = new Set(PLAN_ENTITIES[effectivePlanTier]);
    const planDetails = PLAN_TIER_DETAILS[effectivePlanTier];
    let hasDemoDataWarning = false;

    const duplicateCheck = new Map<string, StagedRow[]>();
    const markDuplicate = (keyStr: string, row: StagedRow) => {
      const existing = duplicateCheck.get(keyStr) || [];
      existing.push(row);
      duplicateCheck.set(keyStr, existing);
    };

    // Pre-populate existing unique keys
    const existingKeys = new Set<string>();
    ctx.branches.forEach((b: any) => existingKeys.add(`branch:${norm(b.code)}`));
    ctx.sessions.forEach((s: any) => existingKeys.add(`session:${norm(s.name)}`));
    ctx.classCategories.forEach((cat: any) => existingKeys.add(`category:${norm(cat.name)}`));
    ctx.classes.forEach((c: any) => existingKeys.add(`class:${norm(c.name)}`));
    ctx.users.forEach((u: any) => {
      existingKeys.add(`email:${norm(u.email)}`);
      if (u.employeeId) existingKeys.add(`employeeId:${norm(u.employeeId)}`);
    });
    ctx.teacherProfiles.forEach((p: any) => {
      if (p.employeeId) existingKeys.add(`employeeId:${norm(p.employeeId)}`);
    });
    ctx.students.forEach((s: any) => {
      existingKeys.add(`adm:${norm(s.admissionNumber)}`);
      existingKeys.add(`stuId:${norm(s.studentId)}`);
      if (s.rollNumber && s.academicSessionId && s.classId) {
        existingKeys.add(`roll:${s.academicSessionId}:${s.classId}:${s.sectionId || ""}:${norm(s.rollNumber)}`);
      }
    });
    ctx.feeChallans.forEach((c: any) => existingKeys.add(`challan:${norm(c.challanNumber)}`));

    // Validate each row
    for (const row of rows) {
      if (row.status === "INVALID") continue;

      // Plan entitlement authorization check
      if (!allowedEntitySet.has(row.entity as any)) {
        row.status = "INVALID";
        const requiredPlan = row.entity === "branches" ? "Enterprise" : "Professional or Enterprise";
        row.issues.push(
          `Module '${row.sheet || row.entity}' requires the ${requiredPlan} plan. This worksheet is not authorized under your active ${planDetails.name}.`
        );
        continue;
      }

      if (
        row.values?.email?.includes("@example.com") ||
        row.values?.email?.includes("@beacon.edu.pk") ||
        row.values?.guardianEmail?.includes("@example.com")
      ) {
        hasDemoDataWarning = true;
      }

      const v = row.values;
      row.recordId = new Types.ObjectId().toString();

      try {
        switch (row.entity) {
          case "branches": {
            const k = `branch:${norm(v.code)}`;
            if (existingKeys.has(k)) {
              row.status = "DUPLICATE";
              row.issues.push(`Branch code '${v.code}' already exists.`);
            }
            markDuplicate(k, row);
            row.data = {
              organizationId: schoolId,
              name: v.name,
              code: norm(v.code),
              address: v.address,
              phone: v.phone,
              email: v.email ? norm(v.email) : undefined,
              isMain: ["yes", "true", "1"].includes(norm(v.isMain)),
              status: norm(v.status) === "inactive" ? "INACTIVE" : "ACTIVE",
              bankDetails: v.bankName ? { bankName: v.bankName, accountTitle: v.accountTitle, accountNumber: v.accountNumber, iban: v.iban, enabled: true } : undefined,
              bankDetailsConfigured: Boolean(v.bankName),
            };
            break;
          }

          case "academicSessions": {
            const k = `session:${norm(v.name)}`;
            if (existingKeys.has(k)) {
              row.status = "DUPLICATE";
              row.issues.push(`Academic session '${v.name}' already exists.`);
            }
            markDuplicate(k, row);
            row.data = {
              schoolId,
              name: v.name,
              startDate: new Date(v.startDate),
              endDate: new Date(v.endDate),
              isCurrent: ["yes", "true", "1"].includes(norm(v.isCurrent)),
              isArchived: ["yes", "true", "1"].includes(norm(v.isArchived)),
            };
            break;
          }

          case "departments": {
            row.data = {
              schoolId,
              name: v.name,
            };
            break;
          }

          case "classCategories": {
            const k = `category:${norm(v.name)}`;
            if (existingKeys.has(k)) {
              row.status = "DUPLICATE";
              row.issues.push(`Class category '${v.name}' already exists.`);
            }
            markDuplicate(k, row);
            row.data = {
              schoolId,
              name: v.name,
              description: v.description || undefined,
              displayOrder: Number(v.displayOrder) || 0,
              status: norm(v.status) === "inactive" ? "Inactive" : "Active",
              categoryRef: v.categoryRef || undefined,
            };
            break;
          }

          case "classes": {
            const k = `class:${norm(v.name)}`;
            if (existingKeys.has(k)) {
              row.status = "DUPLICATE";
              row.issues.push(`Class '${v.name}' already exists.`);
            }
            markDuplicate(k, row);
            row.data = {
              schoolId,
              name: v.name,
              code: v.code || v.name.slice(0, 4).toUpperCase(),
              numericLevel: Number(v.numericLevel) || 1,
              categoryRef: v.categoryRef || undefined,
            };
            break;
          }

          case "sections": {
            row.data = {
              schoolId,
              className: v.classRef,
              name: v.name,
              roomNumber: v.roomNumber || undefined,
              capacity: Number(v.capacity) || 40,
            };
            break;
          }

          case "gradingScales": {
            row.data = {
              schoolId,
              title: v.scaleTitle || "Standard School Grading Scale",
              rules: [{
                grade: v.grade,
                minPercentage: Number(v.minPercentage),
                maxPercentage: Number(v.maxPercentage),
                gradePoint: Number(v.gradePoint) || 0,
                remarks: v.remarks,
              }],
              isDefault: ["yes", "true", "1"].includes(norm(v.isDefault)),
            };
            break;
          }

          case "subjects": {
            row.data = {
              schoolId,
              className: v.classRef,
              name: v.name,
              code: v.code,
              type: ["Core", "Elective", "Practical"].includes(v.type) ? v.type : "Core",
              totalMarks: Number(v.totalMarks) || 100,
              passingMarks: Number(v.passingMarks) || 33,
            };
            break;
          }

          case "teachers": {
            const kEmail = `email:${norm(v.email)}`;
            if (existingKeys.has(kEmail)) {
              row.status = "DUPLICATE";
              row.issues.push(`Email '${v.email}' is already registered in Acadivo.`);
            }
            markDuplicate(kEmail, row);

            if (v.employeeId) {
              const kEmp = `employeeId:${norm(v.employeeId)}`;
              if (existingKeys.has(kEmp)) {
                row.status = "DUPLICATE";
                row.issues.push(`Employee ID '${v.employeeId}' already exists.`);
              }
              markDuplicate(kEmp, row);
            }

            row.credential = seal(v.initialPassword || "TeacherPass2026!");
            row.data = {
              name: v.name,
              email: norm(v.email),
              employeeId: v.employeeId || undefined,
              qualification: v.qualification || undefined,
              phone: v.phone || undefined,
              status: norm(v.status) === "inactive" ? UserStatus.INACTIVE : UserStatus.ACTIVE,
            };
            row.values.initialPassword = "[Hidden]";
            break;
          }

          case "staff": {
            const kEmail = `email:${norm(v.email)}`;
            if (existingKeys.has(kEmail)) {
              row.status = "DUPLICATE";
              row.issues.push(`Email '${v.email}' already exists.`);
            }
            markDuplicate(kEmail, row);

            row.credential = seal(v.initialPassword || "StaffSecure2026!");
            row.data = {
              name: v.name,
              email: norm(v.email),
              userType: Object.values(UserType).includes(v.userType as any) ? v.userType : UserType.SCHOOL_ADMIN,
              employeeId: v.employeeId || undefined,
              department: v.department || undefined,
              designation: v.designation || undefined,
              phone: v.phone || undefined,
              joiningDate: v.joiningDate || undefined,
              leavingDate: v.leavingDate || undefined,
              status: norm(v.status) === "ended" ? "ENDED" : "ACTIVE",
              salaryAmount: Number(v.salaryAmount) || 0,
              salaryBasis: ["MONTHLY", "DAILY", "HOURLY"].includes(v.salaryBasis) ? v.salaryBasis : "MONTHLY",
            };
            row.values.initialPassword = "[Hidden]";
            break;
          }

          case "students": {
            const admNo = v.admissionNumber || `ADM-${new Date().getFullYear()}-${randomUUID().slice(0, 8)}`;
            const stuId = v.studentId || `STU-${randomUUID().slice(0, 8)}`;

            const kAdm = `adm:${norm(admNo)}`;
            if (existingKeys.has(kAdm)) {
              row.status = "DUPLICATE";
              row.issues.push(`Admission number '${admNo}' already exists.`);
            }
            markDuplicate(kAdm, row);

            row.data = {
              schoolId,
              name: v.name,
              nameUrdu: v.nameUrdu || undefined,
              dob: new Date(v.dob),
              gender: ["Male", "Female", "Other"].includes(v.gender) ? v.gender : "Male",
              admissionNumber: admNo,
              studentId: stuId,
              bFormNumber: v.bFormNumber || undefined,
              nationality: v.nationality || "Pakistani",
              religion: v.religion || "Islam",
              bloodGroup: v.bloodGroup || undefined,
              placeOfBirth: v.placeOfBirth || undefined,
              previousSchool: v.previousSchool || undefined,
              previousClass: v.previousClass || undefined,
              className: v.classRef,
              sectionName: v.sectionRef || undefined,
              academicSessionName: v.sessionRef || undefined,
              rollNumber: v.rollNumber || undefined,
              admissionDate: v.admissionDate ? new Date(v.admissionDate) : new Date(),
              address: v.address || "Address on file",
              permanentAddress: v.permanentAddress || undefined,
              billingAddress: v.billingAddress || undefined,
              phone: v.phone || undefined,
              parentInfo: {
                fatherName: v.fatherName || "Father",
                fatherPhone: v.fatherPhone || "03001234567",
                fatherCnic: v.fatherCnic || undefined,
                fatherOccupation: v.fatherOccupation || undefined,
                motherName: v.motherName || undefined,
                motherPhone: v.motherPhone || undefined,
                guardianName: v.guardianName || undefined,
                guardianPhone: v.guardianPhone || undefined,
                guardianEmail: v.guardianEmail || undefined,
                guardianRelation: v.guardianRelation || undefined,
              },
              emergencyContact: {
                name: v.emergencyName || v.fatherName || "Emergency Contact",
                phone: v.emergencyPhone || v.fatherPhone || "03001234567",
                relation: v.emergencyRelation || "Father",
              },
              medicalInformation: v.medicalInformation || undefined,
              allergies: v.allergies || undefined,
              supportRequirements: v.supportRequirements || undefined,
              status: ["ACTIVE", "INACTIVE", "LEFT", "GRADUATED", "TRANSFERRED", "ARCHIVED"].includes(v.status) ? v.status : "ACTIVE",
              feeStructureRef: v.feeStructureRef || undefined,
              concessionType: ["FIXED", "PERCENTAGE"].includes(v.concessionType) ? v.concessionType : undefined,
              concessionValue: v.concessionValue !== undefined && v.concessionValue !== "" ? Number(v.concessionValue) || 0 : undefined,
              concessionReason: v.concessionReason || undefined,
            };
            break;
          }

          case "parents": {
            const kEmail = `email:${norm(v.email)}`;
            if (existingKeys.has(kEmail)) {
              row.status = "DUPLICATE";
              row.issues.push(`Parent email '${v.email}' already exists.`);
            }
            markDuplicate(kEmail, row);

            row.credential = seal(v.initialPassword || "ParentPass2026!");
            row.data = {
              name: v.name,
              email: norm(v.email),
              phone: v.phone || undefined,
              linkedStudentRefs: v.linkedStudentAdmissionNos.split(";").map(s => clean(s)).filter(Boolean),
            };
            row.values.initialPassword = "[Hidden]";
            break;
          }

          case "feeChallans": {
            const kChallan = `challan:${norm(v.challanNumber)}`;
            if (existingKeys.has(kChallan)) {
              row.status = "DUPLICATE";
              row.issues.push(`Challan number '${v.challanNumber}' already exists.`);
            }
            markDuplicate(kChallan, row);

            const total = Number(v.totalAmountPKR) || 0;
            const paid = Number(v.paidAmountPKR) || 0;
            const rem = v.remainingAmountPKR !== undefined && v.remainingAmountPKR !== "" ? Number(v.remainingAmountPKR) : Math.max(0, total - paid);
            const feeAmounts = ["totalAmountPKR", "paidAmountPKR", "remainingAmountPKR", "previousBalance", "tuitionFee", "admissionFee", "examFee", "transportFee", "libraryFee", "computerFee", "otherCharges", "lateFeeFine", "discount", "scholarship"];
            for (const key of feeAmounts) if (v[key] !== undefined && v[key] !== "" && (!Number.isFinite(Number(v[key])) || Number(v[key]) < 0)) throw new Error(`${key} must be a non-negative amount.`);
            if (paid > total) throw new Error("paidAmountPKR cannot exceed totalAmountPKR.");

            row.data = {
              schoolId,
              challanNumber: v.challanNumber,
              studentRef: v.studentRef,
              className: v.classRef || "",
              academicSession: v.sessionRef || "",
              month: v.month,
              dueDate: new Date(v.dueDate),
              previousBalance: Number(v.previousBalance) || 0,
              feeBreakdown: {
                tuitionFee: Number(v.tuitionFee) || 0,
                admissionFee: Number(v.admissionFee) || 0,
                examFee: Number(v.examFee) || 0,
                transportFee: Number(v.transportFee) || 0,
                libraryFee: Number(v.libraryFee) || 0,
                computerFee: Number(v.computerFee) || 0,
                otherCharges: Number(v.otherCharges) || 0,
                lateFeeFine: Number(v.lateFeeFine) || 0,
                discount: Number(v.discount) || 0,
                scholarship: Number(v.scholarship) || 0,
              },
              totalAmountPKR: total,
              paidAmountPKR: paid,
              remainingAmountPKR: rem,
              status: v.status === "VOIDED" ? "VOIDED" : total === 0 && paid === 0 ? "ZERO_BALANCE" : ["PAID", "PENDING", "OVERDUE", "PARTIAL", "ZERO_BALANCE"].includes(v.status) ? v.status : paid >= total ? "PAID" : "PENDING",
            };
            break;
          }

          case "feePayments": {
            row.data = {
              schoolId,
              receiptNumber: v.receiptNumber,
              challanNumber: v.challanNumber,
              studentRef: v.studentRef,
              amountPKR: Number(v.amountPKR),
              paymentMethod: ["Cash", "Bank Transfer", "Online", "Cheque", "Other"].includes(v.paymentMethod) ? v.paymentMethod : "Bank Transfer",
              paidAt: new Date(v.paidAt),
              collectedByEmail: v.collectedByEmail,
              transactionReference: v.transactionReference,
            };
            break;
          }

          case "expenses": {
            row.data = {
              schoolId,
              title: v.title,
              category: ["Salary", "Water", "Rent", "Electricity", "Stationery", "Maintenance", "Transport", "Other"].includes(v.category) ? v.category : "Other",
              amountPKR: Number(v.amountPKR),
              expenseDate: new Date(v.expenseDate),
              paymentMethod: ["Cash", "Bank Transfer", "Cheque", "Online", "Other"].includes(v.paymentMethod) ? v.paymentMethod : "Cash",
              receiptRef: v.receiptRef || undefined,
              description: v.description || undefined,
              loggedByName: v.loggedByEmail || "Finance Officer",
              isVoided: ["yes", "true", "1"].includes(norm(v.isVoided)),
            };
            break;
          }

          case "studentAttendance": {
            row.data = {
              schoolId,
              date: new Date(v.date),
              className: v.classRef,
              sectionName: v.sectionRef,
              sessionName: v.sessionRef,
              studentRef: v.studentRef,
              status: ["PRESENT", "ABSENT", "LEAVE", "LATE"].includes(v.status) ? v.status : "PRESENT",
              remarks: v.remarks,
              markedByEmail: v.markedByEmail,
            };
            break;
          }

          case "staffAttendance": {
            row.data = {
              schoolId,
              staffIdentifier: v.staffIdentifier,
              date: v.date,
              source: ["MANUAL", "BIOMETRIC"].includes(v.source) ? v.source : "MANUAL",
              checkedInAt: v.checkedInAt ? new Date(v.checkedInAt) : undefined,
              checkedOutAt: v.checkedOutAt ? new Date(v.checkedOutAt) : undefined,
              status: ["PRESENT", "LATE", "ABSENT", "LEAVE"].includes(v.status) ? v.status : "PRESENT",
              lateMinutes: Number(v.lateMinutes) || 0,
              workingMinutes: Number(v.workingMinutes) || 0,
              correctionReason: v.correctionReason,
            };
            break;
          }

          case "holidays": {
            row.data = {
              schoolId,
              date: v.date,
              title: v.title,
              kind: ["PAID_HOLIDAY", "UNPAID_HOLIDAY", "CLOSURE", "SPECIAL_WORKING"].includes(v.kind) ? v.kind : "PAID_HOLIDAY",
              reason: v.reason,
            };
            break;
          }

          case "leaveRequests": {
            row.data = {
              schoolId,
              staffIdentifier: v.staffIdentifier,
              leaveType: ["Casual", "Sick", "Earned", "Maternity", "Unpaid"].includes(v.leaveType) ? v.leaveType : "Casual",
              startDate: new Date(v.startDate),
              endDate: new Date(v.endDate),
              totalDays: Number(v.totalDays) || 1,
              reason: v.reason,
              status: ["PENDING", "APPROVED", "REJECTED"].includes(v.status) ? v.status : "APPROVED",
              reviewedByUserName: v.reviewedByEmail,
              reviewComment: v.reviewComment,
              reviewedAt: v.reviewedAt ? new Date(v.reviewedAt) : undefined,
            };
            break;
          }

          case "feeStructures": {
            const feeAmountFields = ["admissionFee", "tuitionFee", "examFee", "transportFee", "libraryFee", "computerFee", "otherCharges", "totalMonthlyFee", "defaultDiscount", "lateFeeFineRate", "earlyDiscountAmount", "lateFineAmount", "lateFineDailyRate", "lateFineCap"];
            for (const key of feeAmountFields) if (v[key] !== undefined && v[key] !== "" && (!Number.isFinite(Number(v[key])) || Number(v[key]) < 0)) throw new Error(`${key} must be a non-negative amount.`);
            let lateFineStages: Array<{ daysAfterDue: number; fineAmount: number }> = [];
            if (v.lateFineStagesJson) {
              try {
                const parsed = JSON.parse(v.lateFineStagesJson);
                if (!Array.isArray(parsed) || parsed.length > 20 || parsed.some((stage: any) => !Number.isFinite(Number(stage.daysAfterDue)) || Number(stage.daysAfterDue) < 0 || !Number.isFinite(Number(stage.fineAmount)) || Number(stage.fineAmount) < 0)) throw new Error("invalid stages");
                lateFineStages = parsed.map((stage: any) => ({ daysAfterDue: Number(stage.daysAfterDue), fineAmount: Number(stage.fineAmount) }));
              } catch {
                row.issues.push("Late Fine Stages JSON must be an array of up to 20 non-negative daysAfterDue/fineAmount entries.");
              }
            }
            row.data = {
              schoolId,
              title: v.title,
              academicSession: v.sessionRef,
              className: v.classRef,
              sectionName: v.sectionRef,
              admissionFee: Number(v.admissionFee) || 0,
              tuitionFee: Number(v.tuitionFee) || 0,
              examFee: Number(v.examFee) || 0,
              transportFee: Number(v.transportFee) || 0,
              libraryFee: Number(v.libraryFee) || 0,
              computerFee: Number(v.computerFee) || 0,
              otherCharges: Number(v.otherCharges) || 0,
              totalMonthlyFee: Number(v.totalMonthlyFee) || 0,
              defaultDiscount: Number(v.defaultDiscount) || 0,
              lateFeeFineRate: Number(v.lateFeeFineRate) || 0,
              dueDateDay: Number(v.dueDateDay) || 10,
              earlyPaymentDiscount: {
                enabled: [true, "true", 1, "1", "yes"].includes(typeof v.earlyDiscountEnabled === "string" ? v.earlyDiscountEnabled.toLowerCase() : v.earlyDiscountEnabled),
                type: v.earlyDiscountType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
                amount: Math.max(0, Number(v.earlyDiscountAmount) || 0),
                cutoffDaysBeforeDue: Math.max(0, Number(v.earlyDiscountDaysBeforeDue) || 0),
              },
              lateFeeFinePolicy: {
                model: ["ONE_TIME", "STAGES", "RECURRING", "DISABLED"].includes(v.lateFineModel) ? v.lateFineModel : "DISABLED",
                type: v.lateFineRateType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
                amount: Math.max(0, Number(v.lateFineAmount) || 0),
                graceDays: Math.max(0, Number(v.lateFineGraceDays) || 0),
                dailyRate: Math.max(0, Number(v.lateFineDailyRate) || 0),
                maxFineCap: Math.max(0, Number(v.lateFineCap) || 0),
                stages: lateFineStages,
              },
            };
            break;
          }

          case "examSchedules": {
            row.data = {
              schoolId,
              title: v.title,
              term: ["MID_TERM", "FINAL_TERM"].includes(v.term) ? v.term : "MID_TERM",
              academicSessionName: v.sessionRef,
              classes: (v.classes || "").split(";").map(s => clean(s)).filter(Boolean),
              startDate: new Date(v.startDate),
              endDate: new Date(v.endDate),
              status: ["DRAFT", "SCHEDULED", "IN_PROGRESS", "PROCESSED", "PUBLISHED"].includes(v.status) ? v.status : "PUBLISHED",
            };
            break;
          }

          case "examTimetable": {
            row.data = {
              schoolId,
              examTitle: v.examRef,
              className: v.classRef,
              sectionName: v.sectionRef,
              subjectCode: v.subjectRef,
              date: v.date,
              startTime: v.startTime,
              endTime: v.endTime,
              room: v.room,
              supervisorEmail: v.supervisorEmail,
            };
            break;
          }

          case "marksEntries": {
            row.data = {
              schoolId,
              examTitle: v.examRef,
              className: v.classRef,
              subjectCode: v.subjectRef,
              studentRef: v.studentRef,
              maxMarks: Number(v.maxMarks) || 100,
              passingMarks: Number(v.passingMarks) || 33,
              obtainedMarks: Number(v.obtainedMarks) || 0,
              grade: v.grade,
              isAbsent: ["yes", "true", "1"].includes(norm(v.isAbsent)),
              remarks: v.remarks,
              enteredByEmail: v.enteredByEmail,
              status: ["DRAFT", "SUBMITTED", "APPROVED"].includes(v.status) ? v.status : "APPROVED",
            };
            break;
          }

          case "examResults": {
            row.data = {
              schoolId,
              examTitle: v.examRef,
              className: v.classRef,
              studentRef: v.studentRef,
              totalMaxMarks: Number(v.totalMaxMarks) || 600,
              totalObtainedMarks: Number(v.totalObtainedMarks) || 0,
              percentage: Number(v.percentage) || null,
              overallGrade: v.overallGrade || "A",
              rank: v.rank ? Number(v.rank) : undefined,
              status: ["PASSED", "PROMOTED", "FAILED", "PENDING"].includes(v.status) ? v.status : "PASSED",
              attendancePercentage: v.attendancePercentage ? Number(v.attendancePercentage) : undefined,
              teacherRemarks: v.teacherRemarks,
              isPublished: ["yes", "true", "1"].includes(norm(v.isPublished)),
            };
            break;
          }

          case "payrollRecords": {
            row.data = {
              schoolId,
              staffIdentifier: v.staffIdentifier,
              month: v.month,
              reference: v.reference,
              status: ["CALCULATED", "PENDING", "APPROVED", "PARTIALLY_PAID", "PAID"].includes(v.status) ? v.status : "PAID",
              allowance: Number(v.allowance) || 0,
              otherDeduction: Number(v.otherDeduction) || 0,
              adjustmentReason: v.adjustmentReason,
              approvedByName: v.approvedByEmail,
              approvedAt: v.approvedAt ? new Date(v.approvedAt) : undefined,
              paidAmount: Number(v.paidAmount) || 0,
              paidAt: v.paidAt ? new Date(v.paidAt) : undefined,
              paymentMethod: v.paymentMethod,
              paymentReference: v.paymentReference,
              snapshot: { basicSalary: Number(v.basicSalary) || 0, netSalary: Number(v.netSalary) || 0 },
            };
            break;
          }

          case "salaryPayments": {
            row.data = {
              schoolId,
              requestId: v.requestId,
              payrollReference: v.payrollRef,
              staffIdentifier: v.staffIdentifier,
              amount: Number(v.amount),
              paidAt: new Date(v.paidAt),
              method: v.method,
              reference: v.reference,
              notes: v.notes,
              paidByName: v.paidByEmail,
            };
            break;
          }

          case "admissions": {
            row.data = {
              schoolId,
              applicationNumber: v.applicationNumber,
              studentName: v.studentName,
              guardianName: v.guardianName,
              guardianPhone: v.guardianPhone,
              guardianEmail: v.guardianEmail,
              previousSchool: v.previousSchool,
              previousClass: v.previousClass,
              applyingClassName: v.applyingClassRef,
              academicSessionName: v.sessionRef,
              admissionSource: v.admissionSource,
              status: ["NEW", "CONTACTED", "FOLLOW_UP", "APPLIED", "APPROVED", "ADMITTED", "REJECTED", "CANCELLED"].includes(v.status) ? v.status : "NEW",
              inquiryDate: v.inquiryDate ? new Date(v.inquiryDate) : new Date(),
              followUpDate: v.followUpDate ? new Date(v.followUpDate) : undefined,
              notes: v.notes,
              documentsStatus: ["PENDING", "PARTIAL", "COMPLETE"].includes(v.documentsStatus) ? v.documentsStatus : "PENDING",
              admissionNumber: v.admissionNumber,
            };
            break;
          }

          case "visitors": {
            row.data = {
              schoolId,
              visitorName: v.visitorName,
              phone: v.phone,
              cnicOrId: v.cnicOrId,
              purpose: v.purpose,
              personToMeet: v.personToMeet,
              department: v.department || "Admin",
              studentName: v.studentName,
              studentRollNo: v.studentRollNo,
              checkInTime: new Date(v.checkInTime),
              checkOutTime: v.checkOutTime ? new Date(v.checkOutTime) : undefined,
              status: ["IN_PREMISES", "CHECKED_OUT"].includes(v.status) ? v.status : "CHECKED_OUT",
              notes: v.notes,
              recordedBy: v.recordedBy,
            };
            break;
          }

          case "appointments": {
            row.data = {
              schoolId,
              visitorName: v.visitorName,
              phone: v.phone,
              email: v.email,
              purpose: v.purpose,
              personToMeet: v.personToMeet,
              department: v.department || "Principal",
              appointmentDate: new Date(v.appointmentDate),
              timeSlot: v.timeSlot,
              status: ["SCHEDULED", "COMPLETED", "CANCELLED", "RESCHEDULED"].includes(v.status) ? v.status : "COMPLETED",
              notes: v.notes,
              bookedBy: v.bookedBy,
            };
            break;
          }

          case "frontDeskRequests": {
            row.data = {
              schoolId,
              requestNumber: v.requestNumber,
              requesterName: v.requesterName,
              requesterType: ["STUDENT", "PARENT", "VISITOR", "STAFF"].includes(v.requesterType) ? v.requesterType : "PARENT",
              phone: v.phone,
              requestType: ["CERTIFICATE", "STUDENT_RECORD", "DOCUMENT_SUBMISSION", "FEE_QUERY", "ADMISSION_QUERY", "GENERAL"].includes(v.requestType) ? v.requestType : "GENERAL",
              studentName: v.studentName,
              studentRollNo: v.studentRollNo,
              className: v.className,
              assignedDepartment: ["ADMIN", "FINANCE", "EXAM", "ACADEMIC", "RECEPTION"].includes(v.assignedDepartment) ? v.assignedDepartment : "RECEPTION",
              details: v.details,
              status: ["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(v.status) ? v.status : "PENDING",
              resolutionNotes: v.resolutionNotes,
              recordedBy: v.recordedBy,
            };
            break;
          }

          case "studentCertificates": {
            row.data = {
              schoolId,
              certificateNumber: v.certificateNumber,
              type: ["BONAFIDE", "CHARACTER", "LEAVING", "TRANSFER", "RESULT"].includes(v.type) ? v.type : "BONAFIDE",
              studentRef: v.studentRef,
              className: v.classRef,
              session: v.sessionRef,
              issueDate: v.issueDate ? new Date(v.issueDate) : new Date(),
              reason: v.reason,
              conductRemarks: v.conductRemarks,
              status: ["ISSUED", "REVOKED"].includes(v.status) ? v.status : "ISSUED",
              issuedByUserName: "Principal Office",
            };
            break;
          }

          case "staffCertificates": {
            row.data = {
              schoolId,
              certificateNumber: v.certificateNumber,
              staffIdentifier: v.staffIdentifier,
              certificateType: v.certificateType || "EXPERIENCE",
              certificateTitle: v.certificateTitle || "Certificate of Experience",
              issueDate: v.issueDate ? new Date(v.issueDate) : new Date(),
              status: ["ISSUED", "REVOKED", "REPLACED"].includes(v.status) ? v.status : "ISSUED",
              reissueReason: v.reissueReason,
              templateId: "tpl-default-staff",
              templateVersion: 1,
              verificationId: randomUUID().replace(/-/g, ""),
              snapshot: { title: v.certificateTitle },
              issuedBy: new Types.ObjectId(actorId),
              issuedByName: "School Administration",
            };
            break;
          }

          case "announcements": {
            row.data = {
              schoolId,
              title: v.title,
              content: v.content,
              category: ["General", "Academic", "Examination", "Holiday", "Urgent"].includes(v.category) ? v.category : "General",
              targetRoles: (v.targetRoles || "").split(";").map(s => clean(s)).filter(Boolean),
              targetClassRefs: (v.targetClassRefs || "").split(";").map(s => clean(s)).filter(Boolean),
              targetSectionRefs: (v.targetSectionRefs || "").split(";").map(s => clean(s)).filter(Boolean),
              priority: ["NORMAL", "HIGH", "URGENT"].includes(v.priority) ? v.priority : "NORMAL",
              status: ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(v.status) ? v.status : "PUBLISHED",
              publishAt: v.publishAt ? new Date(v.publishAt) : new Date(),
              expiresAt: v.expiresAt ? new Date(v.expiresAt) : undefined,
              postedByName: "School Administration",
              isPublished: true,
            };
            break;
          }

          default:
            row.data = { ...v, schoolId };
            break;
        }
      } catch (err: any) {
        row.status = "INVALID";
        row.issues.push(err.message || "Record validation failed.");
      }
    }

    // Intra-file duplicates detection
    for (const [k, dupList] of duplicateCheck) {
      if (dupList.length > 1) {
        for (const row of dupList) {
          row.status = "DUPLICATE";
          row.issues.push(`${k.split(":")[0]} is repeated in spreadsheet row ${row.rowNumber}.`);
        }
      }
    }

    // Evaluate subscription capacity
    try {
      const entitlement = await SubscriptionEntitlementService.evaluateSchoolSubscription(schoolId);
      const studentRows = rows.filter(r => r.entity === "students" && r.status === "VALID");
      const currentStudents = await withoutBranchScope(() => Student.countDocuments({ schoolId, status: "ACTIVE" }).exec());
      const studentCapacity = Math.max(0, entitlement.limits.maxStudents - currentStudents);

      let allowedStudents = 0;
      for (const r of studentRows) {
        if (++allowedStudents > studentCapacity) {
          r.status = "INVALID";
          r.issues.push(`School's ${entitlement.planName} plan limit (${entitlement.limits.maxStudents} students) reached.`);
        }
      }
    } catch {
      // Non-blocking in isolated or custom environments
    }

    // Clean up sensitive fields before saving staging document
    for (const r of rows) {
      if (r.status !== "VALID") {
        delete r.data;
        delete r.credential;
      }
    }

    // Summary calculation
    const summary = this.computeSummary(rows);
    summary.planTier = effectivePlanTier;
    summary.planName = planDetails.name;
    if (hasDemoDataWarning) {
      summary.demoNotice =
        "Demonstration sample records detected (e.g. @example.com or @beacon.edu.pk). Please ensure you replace all sample entries with your school's actual data before committing.";
    }

    const job = await BulkImport.create({
      schoolId,
      actorId,
      entity: entityKey,
      isMaster,
      filename: filename.replace(/[\\/]/g, "_").slice(0, 150),
      rows,
      summary,
      sheets: summary.sheets,
      expiresAt: new Date(Date.now() + 86400000), // 24-hour lease
    });

    return this.publicJob(job, 1);
  }

  /**
   * Starts processing the staged import job.
   */
  static async start(schoolId: string, actorId: string, importId: string, skipDuplicates: boolean) {
    if (!Types.ObjectId.isValid(importId)) {
      throw { statusCode: 404, message: "Import job not found." };
    }

    const existing: any = await BulkImport.findOne({ _id: importId, schoolId, actorId, expiresAt: { $gt: new Date() } }).select("+rows").lean();
    if (!existing) {
      throw { statusCode: 404, message: "Import expired or not found. Please upload again." };
    }
    if (existing.status !== "PREVIEW") {
      return this.publicJob(existing, 1);
    }
    if (existing.summary.duplicate && !skipDuplicates) {
      throw { statusCode: 400, message: "Review duplicate rows or enable 'Skip Duplicate Records'." };
    }
    if (!existing.summary.ready && (!skipDuplicates || !existing.summary.duplicate)) {
      throw { statusCode: 400, message: "There are no valid records ready to import." };
    }
    if (!existing.summary.ready && existing.summary.duplicate && skipDuplicates) {
      const completed = await BulkImport.findOneAndUpdate(
        { _id: importId, schoolId, status: "PREVIEW" },
        { $set: { status: "COMPLETED", processed: existing.rows?.length || existing.summary.total } },
        { new: true }
      ).select("+rows").lean();
      return this.publicJob(completed || existing, 1);
    }

    const leaseToken = randomUUID();
    const claimed = await BulkImport.findOneAndUpdate(
      { _id: importId, schoolId, status: "PREVIEW" },
      { $set: { status: "PROCESSING", heartbeatAt: new Date(), leaseUntil: new Date(Date.now() + 600000), leaseToken } },
      { new: true }
    ).select("+rows").lean();

    if (!claimed) {
      throw { statusCode: 409, message: "Another import process is already active. Please wait for it to complete." };
    }

    // Run execution worker asynchronously
    void this.executeJob(importId, leaseToken).catch(err => {
      console.error("[UniversalImport] Async import worker failure:", err);
    });

    return this.publicJob(claimed, 1);
  }

  /**
   * Resumes any interrupted imports across server restarts.
   */
  static async resume() {
    const pending = await BulkImport.find({ status: "PROCESSING", expiresAt: { $gt: new Date() } }).select("_id").lean();
    for (const j of pending) {
      void this.executeJob(String(j._id)).catch(err => {
        console.error("[UniversalImport] Worker resume failure:", err);
      });
    }
  }

  /**
   * Execution worker processing all sheets topologically with atomic batching.
   */
  public static async executeJob(importId: string, initialLeaseToken?: string) {
    if (activeWorkers.has(importId)) return;
    activeWorkers.add(importId);

    const leaseToken = initialLeaseToken || randomUUID();
    try {
      let job: any;
      if (initialLeaseToken) {
        job = await BulkImport.findOne({ _id: importId, status: "PROCESSING", leaseToken }).select("+rows").lean();
      } else {
        job = await BulkImport.findOneAndUpdate(
          { _id: importId, status: "PROCESSING", $or: [{ leaseUntil: { $lt: new Date() } }, { leaseUntil: { $exists: false } }] },
          { $set: { leaseToken, leaseUntil: new Date(Date.now() + 600000) } },
          { new: true }
        ).select("+rows").lean();
      }

      if (!job) return;

      const schoolId = String(job.schoolId);
      const rows: StagedRow[] = job.rows;

      // Group rows by entity and process in topological dependency order
      const entityOrder = Object.values(UNIVERSAL_ENTITIES)
        .sort((a, b) => a.order - b.order)
        .map(e => e.key);

      const ctx = await this.buildResolutionContext(schoolId);

      // Process entities in order
      for (const currentEntity of entityOrder) {
        const entityRows = rows.map((r, index) => ({ r, index })).filter(item => item.r.entity === currentEntity && item.r.status === "VALID");
        if (!entityRows.length) continue;

        // Process in chunks of 50
        for (let i = 0; i < entityRows.length; i += 50) {
          const chunk = entityRows.slice(i, i + 50);
          await this.commitEntityChunk(schoolId, currentEntity, chunk, ctx, job._id, leaseToken);
        }
      }

      // Finalize job
      const summary = this.computeSummary(rows);
      await BulkImport.updateOne(
        { _id: importId },
        { $set: { status: "COMPLETED", summary, sheets: summary.sheets, processed: rows.length }, $unset: { leaseUntil: 1, leaseToken: 1 } }
      );

      // Audit log entry
      const actor: any = await User.findById(job.actorId).select("name email").lean();
      await AuditLog.create({
        actorName: actor?.name || "School Administrator",
        actorEmail: actor?.email || "admin@acadivo.com",
        actorRole: UserType.SCHOOL_ADMIN,
        schoolId,
        action: "UNIVERSAL_BULK_IMPORT",
        resource: job.entity,
        details: JSON.stringify({ importId, summary }),
      }).catch(() => {});

    } catch (e: any) {
      console.error("[UniversalImport] Job stopped:", e);
      const job: any = await BulkImport.findById(importId).select("+rows").lean();
      if (job && job.status === "PROCESSING") {
        job.rows.forEach((r: StagedRow) => {
          if (r.status === "VALID") {
            r.status = "FAILED";
            r.issues.push("Import interrupted before saving this row. Re-upload remaining records.");
          }
        });
        await BulkImport.updateOne(
          { _id: importId },
          { $set: { status: "FAILED", rows: job.rows, summary: this.computeSummary(job.rows), message: e.message || "Import stopped safely." }, $unset: { leaseUntil: 1, leaseToken: 1 } }
        );
      }
    } finally {
      await BulkImport.updateOne({ _id: importId }, { $unset: { leaseUntil: 1, leaseToken: 1 } }).catch(() => {});
      activeWorkers.delete(importId);
    }
  }

  /**
   * Inserts an atomic chunk of records for a specific entity and updates resolution context.
   */
  private static async commitEntityChunk(
    schoolId: string,
    entity: string,
    chunk: { r: StagedRow; index: number }[],
    ctx: any,
    jobId: any,
    leaseToken: string
  ) {
    const readyItems = chunk.filter(item => item.r.data);
    if (!readyItems.length) return;

    // Resolve foreign keys before insertion
    for (const item of readyItems) {
      const d = item.r.data;
      const v = item.r.values;

      if (v.branchRef && ctx.branches.length) {
        const matchedBranch = ctx.branches.find((b: any) => norm(b.code) === norm(v.branchRef) || norm(b.name) === norm(v.branchRef));
        if (matchedBranch) d.branchId = matchedBranch._id;
      }

      // Category resolution for classes
      const catRefVal = d.categoryRef || v.categoryRef;
      if (catRefVal && !d.classCategoryId && ctx.classCategories?.length) {
        const matchedCat = ctx.classCategories.find(
          (c: any) =>
            norm(c.name) === norm(catRefVal) ||
            (c._id && String(c._id) === String(catRefVal)) ||
            (c.categoryRef && norm(c.categoryRef) === norm(catRefVal))
        );
        if (matchedCat) {
          d.classCategoryId = matchedCat._id;
          d.classCategoryName = matchedCat.name;
        }
      }

      // Class resolution
      const classRefVal = d.className || d.classRef || v.classRef || v.applyingClassRef;
      if (classRefVal && !d.classId) {
        const matchedClass = ctx.classes.find((c: any) => norm(c.name) === norm(classRefVal) || norm(c.code) === norm(classRefVal));
        if (matchedClass) {
          d.classId = matchedClass._id;
          d.className = matchedClass.name;
          if (matchedClass.classCategoryName && !d.classCategoryName) {
            d.classCategoryName = matchedClass.classCategoryName;
          }
        }
      }

      // Section resolution
      const secRefVal = d.sectionName || d.sectionRef || v.sectionRef;
      if (secRefVal && d.classId && !d.sectionId) {
        const matchedSection = ctx.sections.find((s: any) => String(s.classId) === String(d.classId) && norm(s.name) === norm(secRefVal));
        if (matchedSection) {
          d.sectionId = matchedSection._id;
          d.sectionName = matchedSection.name;
        }
      }

      // Session resolution
      const sessRefVal = d.academicSessionName || d.sessionRef || d.academicSession || d.session || v.sessionRef;
      if (sessRefVal && !d.academicSessionId) {
        const matchedSession = ctx.sessions.find((s: any) => norm(s.name) === norm(sessRefVal));
        if (matchedSession) {
          d.academicSessionId = matchedSession._id;
          d.academicSessionName = matchedSession.name;
          d.academicSession = matchedSession.name;
          d.session = matchedSession.name;
        } else {
          const current = ctx.sessions.find((s: any) => s.isCurrent);
          if (current) {
            d.academicSessionId = current._id;
            d.academicSessionName = current.name;
            d.academicSession = current.name;
            d.session = current.name;
          }
        }
      }

      // Subject resolution
      const subjRefVal = d.subjectCode || d.subjectRef || v.subjectRef;
      if (subjRefVal && !d.subjectId) {
        const matchedSubj = ctx.subjects.find((s: any) =>
          (d.classId ? String(s.classId) === String(d.classId) : true) &&
          (norm(s.code) === norm(subjRefVal) || norm(s.name) === norm(subjRefVal))
        );
        if (matchedSubj) {
          d.subjectId = matchedSubj._id;
          d.subjectName = matchedSubj.name;
        }
      }

      // Student resolution
      const stuRefVal = d.studentRef || v.studentRef || v.admissionNumber || v.studentId;
      if (stuRefVal && !d.studentId) {
        const matchedStudent = ctx.students.find(
          (s: any) => norm(s.admissionNumber) === norm(stuRefVal) || norm(s.studentId) === norm(stuRefVal) || String(s._id) === String(stuRefVal)
        );
        if (matchedStudent) {
          d.studentId = matchedStudent._id;
          d.studentName = matchedStudent.name;
          d.rollNumber = matchedStudent.rollNumber || "1";
          d.admissionNumber = matchedStudent.admissionNumber;
          d.className = d.className || matchedStudent.className;
          d.classId = d.classId || matchedStudent.classId;
          d.sectionName = d.sectionName || matchedStudent.sectionName;
          d.sectionId = d.sectionId || matchedStudent.sectionId;
          d.session = d.session || matchedStudent.academicSessionName || "2025-2026";
        }
      }

      // Teacher / Staff resolution
      const staffIdent = d.staffIdentifier || d.teacherEmail || v.teacherEmail || v.staffIdentifier || v.supervisorEmail;
      if (staffIdent && (!d.teacherUserId || !d.staffId)) {
        const matchedUser = ctx.users.find((u: any) => norm(u.email) === norm(staffIdent) || (u.employeeId && norm(u.employeeId) === norm(staffIdent)));
        if (matchedUser) {
          d.staffId = matchedUser._id;
          d.teacherUserId = matchedUser._id;
          d.teacherId = matchedUser._id;
          d.supervisorId = matchedUser._id;
          d.teacherName = matchedUser.name;
          d.staffName = matchedUser.name;
          d.employeeId = matchedUser.employeeId || "EMP-001";
          d.staffType = matchedUser.userType || "TEACHER";
        }
      }

      // Challan resolution
      const chNo = d.challanNumber || v.challanNumber;
      if (chNo && !d.challanId) {
        const matchedChallan = ctx.feeChallans.find((c: any) => norm(c.challanNumber) === norm(chNo));
        if (matchedChallan) {
          d.challanId = matchedChallan._id;
          d.studentId = d.studentId || matchedChallan.studentId;
          d.studentName = d.studentName || matchedChallan.studentName;
          d.rollNumber = d.rollNumber || matchedChallan.rollNumber;
          d.className = d.className || matchedChallan.className;
          d.classId = d.classId || matchedChallan.classId;
        }
      }

      // Payroll record resolution
      const payRef = d.payrollReference || d.payrollRef || v.payrollRef;
      if (payRef && !d.payrollId) {
        const matchedPayroll = ctx.payrollRecords.find((p: any) => norm(p.reference) === norm(payRef));
        if (matchedPayroll) {
          d.payrollId = matchedPayroll._id;
          d.employeeId = d.employeeId || matchedPayroll.employeeId;
        }
      }

      // Exam resolution
      const examRefVal = d.examTitle || d.examRef || v.examRef;
      if (examRefVal && !d.examId) {
        const matchedExam = ctx.exams.find((e: any) => norm(e.title) === norm(examRefVal) || String(e._id) === String(examRefVal));
        if (matchedExam) {
          d.examId = matchedExam._id;
          d.examTitle = matchedExam.title;
        }
      }

      // Fee structure resolution for student
      const fsRefVal = d.feeStructureRef || v.feeStructureRef;
      if (fsRefVal && !d.feeStructureId && ctx.feeStructures?.length) {
        const matchedFs = ctx.feeStructures.find(
          (f: any) =>
            norm(f.title) === norm(fsRefVal) ||
            (f.name && norm(f.name) === norm(fsRefVal)) ||
            (f._id && String(f._id) === String(fsRefVal))
        );
        if (matchedFs) {
          d.feeStructureId = matchedFs._id;
          d.feeStructureTitle = matchedFs.title;
        }
      } else if (!d.feeStructureId && d.classId && ctx.feeStructures?.length) {
        const defaultFs =
          ctx.feeStructures.find((f: any) => String(f.classId) === String(d.classId) && f.isDefault) ||
          ctx.feeStructures.find((f: any) => String(f.classId) === String(d.classId));
        if (defaultFs) {
          d.feeStructureId = defaultFs._id;
          d.feeStructureTitle = defaultFs.title;
        }
      }
    }

    // Attempt insertion (with replica-set transaction if available, fallback to ordered batch if standalone)
    try {
      const documentsToInsert = readyItems.map(item => ({
        ...item.r.data,
        _id: new Types.ObjectId(item.r.recordId),
        schoolId,
      }));

      // Model mapping
      switch (entity) {
        case "branches":
          await Branch.insertMany(documentsToInsert, { ordered: false });
          ctx.branches.push(...documentsToInsert);
          break;

        case "academicSessions":
          await AcademicSession.insertMany(documentsToInsert, { ordered: false });
          ctx.sessions.push(...documentsToInsert);
          break;

        case "departments":
          await StaffDepartment.insertMany(documentsToInsert, { ordered: false });
          ctx.departments.push(...documentsToInsert);
          break;

        case "classCategories":
          await ClassCategory.insertMany(documentsToInsert, { ordered: false });
          ctx.classCategories.push(...documentsToInsert);
          break;

        case "classes":
          await ClassModel.insertMany(documentsToInsert, { ordered: false });
          ctx.classes.push(...documentsToInsert);
          break;

        case "sections":
          await SectionModel.insertMany(documentsToInsert, { ordered: false });
          ctx.sections.push(...documentsToInsert);
          break;

        case "gradingScales":
          await GradingScale.insertMany(documentsToInsert, { ordered: false });
          ctx.gradingScales.push(...documentsToInsert);
          break;

        case "subjects":
          await Subject.insertMany(documentsToInsert, { ordered: false });
          ctx.subjects.push(...documentsToInsert);
          break;

        case "assessmentPolicies":
          await AssessmentPolicy.insertMany(documentsToInsert, { ordered: false });
          break;

        case "teachers": {
          let role = await Role.findOne({ schoolId, userType: UserType.TEACHER }).lean();
          if (!role) {
            role = await Role.findOne({ schoolId: null, userType: UserType.TEACHER }).lean();
          }

          for (const item of readyItems) {
            try {
              const d = item.r.data;
              if (!d.email || !d.email.includes("@")) continue;

              let userDoc: any = await User.findOne({ email: d.email });
              if (!userDoc) {
                const {permanentIdentity}=await import("./permanentIdentity.service");
                d.employeeId=await permanentIdentity(schoolId,"employee",item.r.recordId,String(item.r.values?.employeeId||"").trim()||undefined);
                const plainPass = item.r.credential ? unseal(item.r.credential) : "TeacherPass2026!";
                const passwordHash = await hashPassword(plainPass);

                userDoc = await User.create({
                  _id: new Types.ObjectId(item.r.recordId),
                  schoolId,
                  roleId: (role as any)?._id,
                  userType: UserType.TEACHER,
                  employeeId: d.employeeId,
                  name: d.name,
                  email: d.email,
                  passwordHash,
                  status: UserStatus.ACTIVE,
                  isEmailVerified: true,
                });

                await TeacherProfile.create({
                  schoolId,
                  userId: userDoc._id,
                  employeeId: d.employeeId,
                  qualification: d.qualification,
                  phone: d.phone,
                });
              }

              ctx.users.push(userDoc);
            } catch (err: any) {
              console.warn(`[UniversalImport] Teacher insert warning on ${item.r.values?.email}:`, err.message);
            }
          }
          break;
        }

        case "staff": {
          for (const item of readyItems) {
            try {
              const d = item.r.data;
              if (!d.email || !d.email.includes("@")) continue;

              let userDoc: any = await User.findOne({ email: d.email });
              if (!userDoc) {
                const {permanentIdentity}=await import("./permanentIdentity.service");
                d.employeeId=await permanentIdentity(schoolId,"employee",item.r.recordId,String(item.r.values?.employeeId||"").trim()||undefined);
                let role = await Role.findOne({ schoolId, userType: d.userType }).lean();
                if (!role) {
                  role = await Role.findOne({ schoolId: null, userType: d.userType }).lean();
                }

                const plainPass = item.r.credential ? unseal(item.r.credential) : "StaffSecure2026!";
                const passwordHash = await hashPassword(plainPass);

                userDoc = await User.create({
                  _id: new Types.ObjectId(item.r.recordId),
                  schoolId,
                  roleId: (role as any)?._id,
                  userType: d.userType,
                  employeeId: d.employeeId,
                  name: d.name,
                  email: d.email,
                  passwordHash,
                  status: UserStatus.ACTIVE,
                  isEmailVerified: true,
                });

                await StaffEmployment.create({
                  schoolId,
                  userId: userDoc._id,
                  employeeId: d.employeeId,
                  department: d.department,
                  designation: d.designation,
                  phone: d.phone,
                  joiningDate: d.joiningDate,
                  leavingDate: d.leavingDate,
                  status: d.status || "ACTIVE",
                  salaryHistory: d.salaryAmount ? [{ effectiveDate: d.joiningDate || new Date().toISOString().slice(0, 10), amount: d.salaryAmount, basis: d.salaryBasis || "MONTHLY" }] : [],
                });
              }

              ctx.users.push(userDoc);
            } catch (err: any) {
              console.warn(`[UniversalImport] Staff insert warning on ${item.r.values?.email}:`, err.message);
            }
          }
          break;
        }

        case "classTeacherAssignments":
          for (const doc of documentsToInsert) {
            if (!doc.academicSessionId && ctx.sessions.length) doc.academicSessionId = ctx.sessions[0]._id;
            if (!doc.classId && ctx.classes.length) doc.classId = ctx.classes[0]._id;
            if (!doc.sectionId && ctx.sections.length) doc.sectionId = ctx.sections[0]._id;
            if (!doc.teacherUserId && ctx.users.length) doc.teacherUserId = ctx.users[0]._id;
            if (!doc.teacherName) doc.teacherName = "Teacher";
          }
          await ClassTeacherAssignment.insertMany(documentsToInsert, { ordered: false });
          break;

        case "teachingAssignments":
          for (const doc of documentsToInsert) {
            if (!doc.academicSessionId && ctx.sessions.length) doc.academicSessionId = ctx.sessions[0]._id;
            if (!doc.classId && ctx.classes.length) doc.classId = ctx.classes[0]._id;
            if (!doc.sectionId && ctx.sections.length) doc.sectionId = ctx.sections[0]._id;
            if (!doc.subjectId && ctx.subjects.length) doc.subjectId = ctx.subjects[0]._id;
            if (!doc.teacherUserId && ctx.users.length) doc.teacherUserId = ctx.users[0]._id;
            if (!doc.status) doc.status = "ACTIVE";
            if (!doc.assignedAt) doc.assignedAt = new Date();
          }
          await TeachingAssignment.insertMany(documentsToInsert, { ordered: false });
          break;

        case "timetable":
          for (const doc of documentsToInsert) {
            if (!doc.classId && ctx.classes.length) doc.classId = ctx.classes[0]._id;
            if (!doc.subjectId && ctx.subjects.length) doc.subjectId = ctx.subjects[0]._id;
            if (!doc.subjectName) doc.subjectName = "Subject";
            if (!doc.dayOfWeek) doc.dayOfWeek = "Monday";
            if (!doc.periodNumber) doc.periodNumber = 1;
            if (!doc.startTime) doc.startTime = "08:00";
            if (!doc.endTime) doc.endTime = "08:45";
          }
          await TimetableSlot.insertMany(documentsToInsert, { ordered: false });
          break;

        case "students":
          {
          const {permanentIdentity}=await import("./permanentIdentity.service");
          for(let i=0;i<documentsToInsert.length;i++){
            const item=readyItems[i],doc=documentsToInsert[i];
            doc.studentId=await permanentIdentity(schoolId,"student",doc._id,String(item.r.values?.studentId||"").trim()||undefined);
            doc.admissionNumber=await permanentIdentity(schoolId,"admission",doc._id,String(item.r.values?.admissionNumber||"").trim()||undefined);
          }
          await Student.insertMany(documentsToInsert, { ordered: false });
          ctx.students.push(...documentsToInsert);
          break;
          }

        case "parents": {
          let parentRole = await Role.findOne({ code: "ROLE_PARENT" }).lean();
          for (const item of readyItems) {
            try {
              const d = item.r.data;
              if (!d.email || !d.email.includes("@")) continue;

              let userDoc: any = await User.findOne({ email: d.email });
              if (!userDoc) {
                const plainPass = item.r.credential ? unseal(item.r.credential) : "ParentPass2026!";
                const passwordHash = await hashPassword(plainPass);

                userDoc = await User.create({
                  _id: new Types.ObjectId(item.r.recordId),
                  schoolId,
                  roleId: (parentRole as any)?._id,
                  userType: UserType.PARENT,
                  name: d.name,
                  email: d.email,
                  passwordHash,
                  status: UserStatus.ACTIVE,
                  isEmailVerified: true,
                });
              }

              // Find linked student ObjectIds
              const linkedIds: any[] = [];
              for (const ref of d.linkedStudentRefs || []) {
                const st = ctx.students.find((s: any) => norm(s.admissionNumber) === norm(ref) || norm(s.studentId) === norm(ref));
                if (st) linkedIds.push(st._id);
              }

              await ParentProfile.findOneAndUpdate(
                { schoolId, userId: userDoc._id },
                { $set: { studentIds: linkedIds } },
                { upsert: true }
              );

              ctx.users.push(userDoc);
            } catch (err: any) {
              console.warn(`[UniversalImport] Parent insert warning on ${item.r.values?.email}:`, err.message);
            }
          }
          break;
        }

        case "feeStructures":
          await FeeStructure.insertMany(documentsToInsert, { ordered: false });
          break;

        case "feeChallans":
          for (const doc of documentsToInsert) {
            if (!doc.studentName) doc.studentName = "Student";
            if (!doc.rollNumber) doc.rollNumber = "1";
            if (!doc.className) doc.className = "Class";
            if (!doc.classId && ctx.classes.length) doc.classId = ctx.classes[0]._id;
            if (!doc.month) doc.month = "2025-09";
            if (!doc.dueDate) doc.dueDate = new Date();
          }
          await FeeChallan.insertMany(documentsToInsert, { ordered: false });
          ctx.feeChallans.push(...documentsToInsert);
          break;

        case "feePayments": {
          for (const doc of documentsToInsert) {
            if (!doc.studentName) doc.studentName = "Student";
            if (!doc.rollNumber) doc.rollNumber = "1";
            if (!doc.className) doc.className = "Class";
            if (!doc.receiptNumber) doc.receiptNumber = `REC-${randomUUID().slice(0, 8).toUpperCase()}`;
            if (!doc.collectedByUserName) doc.collectedByUserName = "Accounts Office";
            if (!doc.paymentMethod) doc.paymentMethod = "Bank Transfer";
          }
          await FeePayment.insertMany(documentsToInsert, { ordered: false });
          // Update corresponding challan balance
          for (const doc of documentsToInsert) {
            if (doc.challanId) {
              const ch: any = await FeeChallan.findById(doc.challanId);
              if (ch) {
                ch.paidAmountPKR = (ch.paidAmountPKR || 0) + doc.amountPKR;
                ch.remainingAmountPKR = Math.max(0, ch.totalAmountPKR - ch.paidAmountPKR);
                if (ch.remainingAmountPKR === 0) ch.status = "PAID";
                else if (ch.paidAmountPKR > 0) ch.status = "PARTIAL";
                await ch.save();
              }
            }
          }
          break;
        }

        case "expenses":
          await Expense.insertMany(documentsToInsert, { ordered: false });
          break;

        case "studentAttendance":
          // Consolidate into class daily registers
          for (const doc of documentsToInsert) {
            await StudentAttendance.updateOne(
              { schoolId, classId: doc.classId, date: doc.date },
              {
                $setOnInsert: { className: doc.className, markedByUserId: ctx.users[0]?._id, markedByName: "System Migration" },
                $push: {
                  records: {
                    studentId: doc.studentId,
                    studentName: doc.studentName || "Student",
                    rollNumber: doc.rollNumber || "1",
                    status: doc.status,
                    remarks: doc.remarks,
                  },
                },
              },
              { upsert: true }
            );
          }
          break;

        case "staffAttendance":
          for (const doc of documentsToInsert) {
            if (doc.staffId) {
              await StaffAttendance.updateOne(
                { schoolId, employeeId: doc.staffId, date: doc.date },
                {
                  $set: {
                    source: doc.source,
                    checkedInAt: doc.checkedInAt,
                    checkedOutAt: doc.checkedOutAt,
                    status: doc.status,
                    lateMinutes: doc.lateMinutes,
                    workingMinutes: doc.workingMinutes,
                    correctionReason: doc.correctionReason,
                  },
                },
                { upsert: true }
              );
            }
          }
          break;

        case "holidays":
          await SchoolCalendar.insertMany(documentsToInsert, { ordered: false });
          break;

        case "leaveRequests":
          await LeaveRequest.insertMany(documentsToInsert, { ordered: false });
          break;

        case "examSchedules":
          await ExamSchedule.insertMany(documentsToInsert, { ordered: false });
          ctx.exams.push(...documentsToInsert);
          break;

        case "examTimetable":
          for (const doc of documentsToInsert) {
            if (!doc.examId && ctx.exams.length) doc.examId = ctx.exams[0]._id;
            if (!doc.classId && ctx.classes.length) doc.classId = ctx.classes[0]._id;
            if (!doc.sectionId && ctx.sections.length) doc.sectionId = ctx.sections[0]._id;
            if (!doc.subjectId && ctx.subjects.length) doc.subjectId = ctx.subjects[0]._id;
            if (!doc.date) doc.date = "2025-10-15";
            if (!doc.startTime) doc.startTime = "09:00";
            if (!doc.endTime) doc.endTime = "12:00";
          }
          await ExamTimetable.insertMany(documentsToInsert, { ordered: false });
          break;

        case "marksEntries":
          for (const doc of documentsToInsert) {
            if (!doc.examId && ctx.exams.length) doc.examId = ctx.exams[0]._id;
            if (!doc.classId && ctx.classes.length) doc.classId = ctx.classes[0]._id;
            if (!doc.subjectId && ctx.subjects.length) doc.subjectId = ctx.subjects[0]._id;
            if (doc.examId && doc.classId && doc.subjectId && doc.studentId) {
              await MarksEntry.updateOne(
                { schoolId, examId: doc.examId, classId: doc.classId, subjectId: doc.subjectId },
                {
                  $setOnInsert: {
                    examTitle: doc.examTitle || "Examination",
                    className: doc.className || "Class",
                    subjectName: doc.subjectName || "Subject",
                    maxMarks: doc.maxMarks || 100,
                    passingMarks: doc.passingMarks || 33,
                    enteredByTeacherName: doc.enteredByTeacherName || "System Migration",
                    status: doc.status || "APPROVED",
                  },
                  $push: {
                    records: {
                      studentId: doc.studentId,
                      studentName: doc.studentName || "Student",
                      rollNumber: doc.rollNumber || "1",
                      obtainedMarks: doc.obtainedMarks || 0,
                      grade: doc.grade,
                      remarks: doc.remarks,
                      isAbsent: doc.isAbsent || false,
                    },
                  },
                },
                { upsert: true }
              );
            }
          }
          break;

        case "examResults":
          for (const doc of documentsToInsert) {
            if (!doc.examId && ctx.exams.length) doc.examId = ctx.exams[0]._id;
            if (!doc.classId && ctx.classes.length) doc.classId = ctx.classes[0]._id;
            if (!doc.subjectScores) doc.subjectScores = [];
            if (!doc.overallGrade) doc.overallGrade = "A";
            if (!doc.status) doc.status = "PASSED";
            if (!doc.studentName) doc.studentName = "Student";
            if (!doc.rollNumber) doc.rollNumber = "1";
            if (!doc.totalMaxMarks) doc.totalMaxMarks = 600;
            if (doc.totalObtainedMarks === undefined) doc.totalObtainedMarks = 0;
          }
          await ProcessedResult.insertMany(documentsToInsert, { ordered: false });
          break;

        case "payrollRecords":
          for (const doc of documentsToInsert) {
            if (!doc.employeeId && ctx.users.length) doc.employeeId = ctx.users[0]._id;
            if (!doc.snapshot) doc.snapshot = { basicSalary: doc.basicSalary || 50000, netSalary: doc.netSalary || 50000 };
            if (!doc.reference) doc.reference = `PAY-${randomUUID().slice(0, 8).toUpperCase()}`;
          }
          await PayrollRecord.insertMany(documentsToInsert, { ordered: false });
          ctx.payrollRecords.push(...documentsToInsert);
          break;

        case "salaryPayments":
          for (const doc of documentsToInsert) {
            if (!doc.payrollId && ctx.payrollRecords.length) doc.payrollId = ctx.payrollRecords[0]._id;
            if (!doc.employeeId && ctx.users.length) doc.employeeId = ctx.users[0]._id;
            if (!doc.paidBy && ctx.users.length) doc.paidBy = ctx.users[0]._id;
            if (!doc.paidByName) doc.paidByName = "Accounts Office";
            if (!doc.method) doc.method = "Bank Transfer";
            if (!doc.requestId) doc.requestId = `REQ-${randomUUID().slice(0, 8).toUpperCase()}`;
          }
          await SalaryPayment.insertMany(documentsToInsert, { ordered: false });
          break;

        case "admissions":
          await Admission.insertMany(documentsToInsert, { ordered: false });
          break;

        case "visitors":
          await Visitor.insertMany(documentsToInsert, { ordered: false });
          break;

        case "appointments":
          await Appointment.insertMany(documentsToInsert, { ordered: false });
          break;

        case "frontDeskRequests":
          await FrontDeskRequest.insertMany(documentsToInsert, { ordered: false });
          break;

        case "studentCertificates":
          for (const doc of documentsToInsert) {
            if (!doc.studentName) doc.studentName = "Student";
            if (!doc.rollNumber) doc.rollNumber = "1";
            if (!doc.className) doc.className = "Class";
            if (!doc.session) doc.session = "2025-2026";
            if (!doc.issuedByUserName) doc.issuedByUserName = "Principal Office";
            if (!doc.type) doc.type = "BONAFIDE";
          }
          await CertificateRecord.insertMany(documentsToInsert, { ordered: false });
          break;

        case "staffCertificates":
          for (const doc of documentsToInsert) {
            if (!doc.staffId && ctx.users.length) doc.staffId = ctx.users[0]._id;
            if (!doc.employeeId) doc.employeeId = "EMP-001";
            if (!doc.staffName) doc.staffName = "Staff Member";
            if (!doc.staffType) doc.staffType = "TEACHER";
            if (!doc.issuedBy && ctx.users.length) doc.issuedBy = ctx.users[0]._id;
            if (!doc.issuedByName) doc.issuedByName = "School Administration";
            if (!doc.templateId) doc.templateId = "tpl-default-staff";
            if (!doc.templateVersion) doc.templateVersion = 1;
            if (!doc.verificationId) doc.verificationId = randomUUID().replace(/-/g, "");
            if (!doc.snapshot) doc.snapshot = { title: doc.certificateTitle || "Experience Certificate" };
          }
          await StaffCertificate.insertMany(documentsToInsert, { ordered: false });
          break;

        case "announcements":
          await Announcement.insertMany(documentsToInsert, { ordered: false });
          break;
      }

      // Mark items as IMPORTED in staging state
      const updateSet: Record<string, any> = { heartbeatAt: new Date() };
      for (const item of readyItems) {
        item.r.status = "IMPORTED";
        updateSet[`rows.${item.index}.status`] = "IMPORTED";
        updateSet[`rows.${item.index}.data`] = null;
        updateSet[`rows.${item.index}.credential`] = null;
      }

      await BulkImport.updateOne({ _id: jobId, leaseToken }, { $set: updateSet });
    } catch (err: any) {
      console.warn(`[UniversalImport] Chunk insert warning on ${entity}:`, err.message);
      for (const item of readyItems) {
        if (item.r.status !== "IMPORTED") {
          item.r.status = "FAILED";
          item.r.issues.push(err.message || "Database insert failed.");
        }
      }
    }
  }

  /**
   * Generates line-by-line Excel Error Report.
   */
  static async errorReport(schoolId: string, actorId: string, importId: string): Promise<Buffer> {
    const job: any = await BulkImport.findOne({ _id: importId, schoolId, actorId }).select("+rows").lean();
    if (!job) {
      throw { statusCode: 404, message: "Import not found." };
    }

    const failedRows = (job.rows as StagedRow[]).filter(r => ["INVALID", "DUPLICATE", "FAILED"].includes(r.status));
    const book = XLSX.utils.book_new();

    const reportRows = [
      ["Sheet / Entity", "Excel Row", "Status", "Reason / Issues", "Row Values (JSON)"],
      ...failedRows.map(r => [
        r.sheet || r.entity,
        r.rowNumber,
        r.status,
        r.issues.join("; "),
        JSON.stringify(r.values),
      ]),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(reportRows);
    sheet["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 80 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(book, sheet, "Import Errors");

    return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  }

  /**
   * Retrieves paginated public job state.
   */
  static async getJob(schoolId: string, actorId: string, importId: string, page = 1) {
    if (!Types.ObjectId.isValid(importId)) {
      throw { statusCode: 404, message: "Import not found." };
    }

    const job: any = await BulkImport.findOne({ _id: importId, schoolId, actorId, expiresAt: { $gt: new Date() } }).select("+rows").lean();
    if (!job) {
      throw { statusCode: 404, message: "Import not found or expired. Please upload the file again." };
    }

    // Auto-resume if stalled
    if (job.status === "PROCESSING" && !activeWorkers.has(importId)) {
      void this.executeJob(importId).catch(() => {});
    }

    return this.publicJob(job, page);
  }

  /**
   * Retrieves past master school migration jobs for the school.
   */
  static async history(schoolId: string) {
    const jobs = await BulkImport.find({ schoolId, entity: "master" })
      .select("filename status summary sheets processed createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return jobs.map((j: any) => ({
      id: String(j._id),
      filename: j.filename,
      status: j.status,
      planTier: j.summary?.planTier,
      totalRows: j.summary?.total || 0,
      validRows: j.summary?.valid || 0,
      successRows: j.summary?.imported || j.summary?.created || 0,
      errorRows: (j.summary?.invalid || 0) + (j.summary?.failed || 0),
      sheetsCount: j.sheets ? Object.keys(j.sheets).length : 0,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));
  }

  private static computeSummary(rows: StagedRow[]): ImportSummary {
    const count = (status: string) => rows.filter(r => r.status === status).length;
    const sheetsMap: Record<string, any> = {};

    for (const r of rows) {
      const sheetKey = r.sheet || r.entity;
      if (!sheetsMap[sheetKey]) {
        sheetsMap[sheetKey] = { total: 0, valid: 0, invalid: 0, duplicate: 0, imported: 0, failed: 0 };
      }
      sheetsMap[sheetKey].total++;
      if (r.status === "VALID") sheetsMap[sheetKey].valid++;
      if (r.status === "INVALID") sheetsMap[sheetKey].invalid++;
      if (r.status === "DUPLICATE") sheetsMap[sheetKey].duplicate++;
      if (r.status === "IMPORTED") sheetsMap[sheetKey].imported++;
      if (r.status === "FAILED") sheetsMap[sheetKey].failed++;
    }

    return {
      total: rows.length,
      valid: count("VALID") + count("IMPORTED"),
      invalid: count("INVALID"),
      duplicate: count("DUPLICATE"),
      imported: count("IMPORTED"),
      failed: count("FAILED"),
      ready: count("VALID"),
      sheets: sheetsMap,
    };
  }

  private static publicJob(job: any, page = 1) {
    const rows: StagedRow[] = job.rows || [];
    const pageSize = 50;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(pages, Math.max(1, Math.floor(page) || 1));

    const sliced = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

    return {
      id: String(job._id),
      entity: job.entity,
      isMaster: Boolean(job.isMaster),
      filename: job.filename,
      status: job.status,
      summary: job.summary,
      planTier: job.summary?.planTier,
      planName: job.summary?.planName,
      demoNotice: job.summary?.demoNotice,
      sheets: job.sheets || job.summary?.sheets,
      totalRows: job.summary?.total ?? 0,
      validRows: job.summary?.valid ?? 0,
      duplicateRows: job.summary?.duplicate ?? 0,
      invalidRows: job.summary?.invalid ?? 0,
      processedRows: job.processed ?? 0,
      successRows: job.summary?.imported ?? 0,
      errorRows: (job.summary?.invalid ?? 0) + (job.summary?.failed ?? 0),
      processed: job.processed || 0,
      message: job.message,
      expiresAt: job.expiresAt,
      page: safePage,
      pages,
      rows: sliced.map(r => ({
        sheet: r.sheet,
        entity: r.entity,
        rowNumber: r.rowNumber,
        values: r.values,
        status: r.status,
        issues: r.issues,
      })),
    };
  }
}
