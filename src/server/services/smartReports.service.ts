import {
  reportColumnLabel,
  reportPathValue,
  readableReportValue,
} from "../../lib/report-presentation";
import mongoose from "mongoose";
import { z } from "zod";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { FeePayment, FeeChallan, Expense } from "../models/fee.model";
import {
  StudentAttendance,
  TeacherAttendance,
} from "../models/attendance.model";
import {
  StaffAttendance,
  StaffEmployment,
  PayrollRecord,
} from "../models/workforce.model";
import { ProcessedResult } from "../models/exam.model";
import { Admission } from "../models/admission.model";
import { hasFeature, permissionFeature } from "../../lib/plan-features";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { Subject, TimetableSlot } from "../models/subject.model";
import { LeaveRequest } from "../models/leaveRequest.model";
import { TeachingAssignment } from "../models/teacherProfile.model";
import { ExamSchedule } from "../models/exam.model";
import { Announcement } from "../models/announcement.model";
import { IssuedSchoolDocument } from "../models/issuedSchoolDocument.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassCategory } from "../models/classCategory.model";

type Definition = {
  title: string;
  category: string;
  permission: string;
  model: any;
  date: string;
  columns: string[];
  fixed?: any;
  computed?: any;
  filters: Record<string, string>;
  unwind?: string;
  stringDate?: boolean;
  note: string;
};
const common = {
  classId: "classId",
  sectionId: "sectionId",
  academicSessionId: "academicSessionId",
};
export const reportDefinitions: Record<string, Definition> = {
  sessions: {
    title: "Academic sessions",
    category: "Academics",
    permission: "students.view",
    model: AcademicSession,
    date: "startDate",
    columns: ["name", "startDate", "endDate", "isCurrent", "isArchived"],
    filters: { academicSessionId: "_id" },
    note: "Saved academic session dates and current/archive state.",
  },
  subjectResults: {
    title: "Published subject marks",
    category: "Academics",
    permission: "results.view",
    model: ProcessedResult,
    date: "publishedAt",
    unwind: "subjectScores",
    fixed: {
      isPublished: true,
      needsProcessing: { $ne: true },
      status: { $ne: "PENDING" },
      percentage: { $type: "number" },
    },
    columns: [
      "examTitle",
      "studentName",
      "rollNumber",
      "className",
      "subjectScores.subjectName",
      "subjectScores.maxMarks",
      "subjectScores.obtainedMarks",
      "subjectScores.isAbsent",
      "subjectScores.grade",
    ],
    filters: {
      classId: "classId",
      studentId: "studentId",
      examId: "examId",
      status: "status",
    },
    note: "Actual subject rows from processed published results. Missing scores stay blank and absent flags remain explicit; no marks are inferred.",
  },
  legacyTeacherAttendance: {
    title: "Legacy teacher attendance registers",
    category: "Attendance",
    permission: "attendance.view",
    model: TeacherAttendance,
    date: "date",
    unwind: "records",
    columns: [
      "date",
      "records.teacherName",
      "records.status",
      "records.arrivalTime",
      "records.checkedInAt",
      "records.checkedOutAt",
    ],
    filters: { employeeId: "records.teacherUserId", status: "records.status" },
    note: "Original teacher register entries. Kept separate from newer workforce records; do not add both registers together because an employee/day can appear in both.",
  },
  guardians: {
    title: "Guardian & emergency contacts",
    category: "Students",
    permission: "students.view",
    model: Student,
    date: "admissionDate",
    columns: [
      "studentId",
      "name",
      "parentInfo.fatherName",
      "parentInfo.fatherPhone",
      "parentInfo.fatherOccupation",
      "parentInfo.motherName",
      "parentInfo.motherPhone",
      "parentInfo.guardianName",
      "parentInfo.guardianPhone",
      "parentInfo.guardianEmail",
      "parentInfo.guardianRelation",
      "emergencyContact.name",
      "emergencyContact.phone",
      "emergencyContact.relation",
    ],
    filters: { ...common, studentId: "_id", status: "status" },
    note: "Recorded family contacts only. Cohort dates apply unless a single student is selected. Passwords and parent portal credentials are never exported.",
  },
  issuedDocuments: {
    title: "Issued student documents",
    category: "Students",
    permission: "students.view",
    model: IssuedSchoolDocument,
    date: "issuedAt",
    fixed: {
      studentId: { $ne: null },
      type: {
        $in: [
          "admission",
          "registration",
          "student-profile",
          "student-id",
          "character",
          "leaving",
          "bonafide",
          "transfer",
          "general-certificate",
        ],
      },
    },
    columns: ["studentId", "type", "reference", "issuedAt"],
    filters: { studentId: "studentId" },
    note: "Issued student document references, not private attachments or financial/academic snapshots. Missing document requirements cannot be inferred from issuance.",
  },
  announcements: {
    title: "Announcement register",
    category: "Operations",
    permission: "notices.view",
    model: Announcement,
    date: "publishAt",
    columns: [
      "title",
      "category",
      "status",
      "priority",
      "publishAt",
      "expiresAt",
      "postedByName",
    ],
    filters: { status: "status" },
    note: "Recorded notices by publication date; this does not infer who read a notice.",
  },
  classes: {
    title: "Class register",
    category: "Operations",
    permission: "students.view",
    model: ClassModel,
    date: "createdAt",
    columns: ["name", "code", "numericLevel", "classTeacherName", "createdAt"],
    filters: { classId: "_id" },
    note: "Classes created in the selected period. Capacity is not estimated.",
  },
  sections: {
    title: "Section register",
    category: "Operations",
    permission: "students.view",
    model: SectionModel,
    date: "createdAt",
    columns: ["name", "className", "roomNumber", "capacity", "createdAt"],
    filters: { classId: "classId", sectionId: "_id" },
    note: "Recorded sections created in the selected period.",
  },
  subjects: {
    title: "Subject register",
    category: "Academics",
    permission: "teachers.view",
    model: Subject,
    date: "createdAt",
    columns: [
      "name",
      "code",
      "className",
      "type",
      "totalMarks",
      "passingMarks",
      "teacherName",
    ],
    filters: { classId: "classId", employeeId: "teacherId" },
    note: "Existing subject configuration, not examination results.",
  },
  timetable: {
    title: "Teaching timetable",
    category: "Academics",
    permission: "teachers.view",
    model: TimetableSlot,
    date: "createdAt",
    columns: [
      "dayOfWeek",
      "periodNumber",
      "startTime",
      "endTime",
      "subjectName",
      "teacherName",
      "roomNumber",
    ],
    filters: { ...common, employeeId: "teacherId" },
    note: "Timetable records created in the period; scheduled workload is not measured teaching time.",
  },
  assignments: {
    title: "Teaching assignments",
    category: "Employees",
    permission: "teachers.view",
    model: TeachingAssignment,
    date: "assignedAt",
    columns: [
      "teacherUserId",
      "classId",
      "sectionId",
      "subjectId",
      "status",
      "assignedAt",
      "endedAt",
    ],
    filters: { ...common, employeeId: "teacherUserId", status: "status" },
    note: "Recorded assignment references and dates. Ended assignments are retained; no inferred workload hours.",
  },
  leave: {
    title: "Employee leave requests",
    category: "Employees",
    permission: "teachers.view",
    model: LeaveRequest,
    date: "startDate",
    columns: [
      "teacherName",
      "employeeId",
      "leaveType",
      "startDate",
      "endDate",
      "totalDays",
      "status",
      "reviewedAt",
    ],
    filters: { employeeId: "teacherId", status: "status" },
    note: "Requests whose leave starts in the period. Sensitive medical reasons are excluded.",
  },
  exams: {
    title: "Examination schedules",
    category: "Academics",
    permission: "exams.view",
    model: ExamSchedule,
    date: "startDate",
    columns: [
      "title",
      "term",
      "academicSessionName",
      "startDate",
      "endDate",
      "status",
    ],
    filters: {
      academicSessionId: "academicSessionId",
      examId: "_id",
      status: "status",
    },
    note: "Exam cycles starting in the selected period. Subject schedules remain in the existing examinations module.",
  },
  students: {
    title: "Student directory",
    category: "Students",
    permission: "students.view",
    model: Student,
    date: "admissionDate",
    columns: [
      "studentId",
      "admissionNumber",
      "name",
      "className",
      "sectionName",
      "rollNumber",
      "status",
      "admissionDate",
      "dob",
      "gender",
      "bFormNumber",
      "address",
      "phone",
      "parentInfo.fatherName",
      "parentInfo.guardianEmail",
      "parentInfo.fatherPhone",
    ],
    filters: { ...common, studentId: "_id", status: "status" },
    note: "Admission dates select the cohort. Status is the current recorded status; historical withdrawals cannot be inferred.",
  },
  staff: {
    title: "Staff directory",
    category: "Employees",
    permission: "users.view",
    model: User,
    date: "createdAt",
    columns: ["employeeId", "name", "email", "userType", "status", "createdAt"],
    fixed: { userType: { $nin: ["PARENT", "SUPER_ADMIN"] } },
    filters: { employeeId: "_id", role: "userType", status: "status" },
    note: "Staff account creation dates; no passwords or authentication fields are included.",
  },
  employment: {
    title: "Employment register",
    category: "Employees",
    permission: "users.manage",
    model: StaffEmployment,
    date: "createdAt",
    columns: [
      "employeeId",
      "designation",
      "department",
      "joiningDate",
      "leavingDate",
      "status",
    ],
    filters: {
      employeeId: "userId",
      department: "department",
      status: "status",
    },
    note: "Employment configuration. Salary history is excluded; payroll has a separate permission.",
  },
  attendance: {
    title: "Student attendance",
    category: "Attendance",
    permission: "attendance.view",
    model: StudentAttendance,
    date: "date",
    unwind: "records",
    columns: [
      "date",
      "className",
      "sectionName",
      "records.studentName",
      "records.rollNumber",
      "records.status",
    ],
    filters: {
      ...common,
      studentId: "records.studentId",
      status: "records.status",
    },
    note: "Marked entries only. Missing registers are unknown, not absent. Late counts as attended for the attendance rate.",
  },
  staffAttendance: {
    title: "Staff attendance",
    category: "Attendance",
    permission: "staff-attendance.manage",
    model: StaffAttendance,
    date: "date",
    stringDate: true,
    columns: [
      "employeeId",
      "date",
      "source",
      "status",
      "checkedInAt",
      "checkedOutAt",
      "lateMinutes",
      "workingMinutes",
    ],
    filters: { employeeId: "employeeId", status: "status" },
    note: "Real workforce attendance only. Biometric simulator punches are in a separate collection and are excluded. Legacy teacher registers are not merged into this report.",
  },
  collections: {
    title: "Fee collections",
    category: "Finance",
    permission: "fees.view",
    model: FeePayment,
    date: "paidAt",
    columns: [
      "receiptNumber",
      "studentName",
      "rollNumber",
      "className",
      "amountPKR",
      "paymentMethod",
      "paidAt",
      "collectedByUserName",
    ],
    filters: { studentId: "studentId", paymentMethod: "paymentMethod" },
    note: "Actual received payments, not billed invoices or unapproved parent submissions.",
  },
  invoices: {
    title: "Fee invoices & balances",
    category: "Finance",
    permission: "fees.view",
    model: FeeChallan,
    date: "createdAt",
    fixed: { isVoided: { $ne: true } },
    columns: [
      "challanNumber",
      "studentName",
      "className",
      "sectionName",
      "month",
      "dueDate",
      "totalAmountPKR",
      "paidAmountPKR",
      "remainingAmountPKR",
      "feeBreakdown.discount",
      "feeBreakdown.scholarship",
      "status",
    ],
    filters: { studentId: "studentId", classId: "classId", status: "status" },
    note: "Non-voided invoices created in the period; balances are current, not a historical balance reconstruction.",
  },
  expenses: {
    title: "Expense ledger",
    category: "Finance",
    permission: "fees.view",
    model: Expense,
    date: "expenseDate",
    fixed: { isVoided: { $ne: true } },
    columns: [
      "title",
      "category",
      "amountPKR",
      "expenseDate",
      "paymentMethod",
      "receiptRef",
    ],
    filters: { category: "category", paymentMethod: "paymentMethod" },
    note: "Recorded non-voided expenses. Net recorded balance is collections minus this ledger; payroll is not subtracted a second time.",
  },
  payroll: {
    title: "Payroll payments",
    category: "Finance",
    permission: "payroll.view",
    model: PayrollRecord,
    date: "paidAt",
    fixed: { status: "PAID" },
    computed: {
      paidAmountPKR: {
        $max: [
          0,
          {
            $subtract: [
              "$snapshot.netSalary",
              { $ifNull: ["$otherDeduction", 0] },
            ],
          },
        ],
      },
    },
    columns: [
      "employeeId",
      "snapshot.employee.name",
      "reference",
      "month",
      "paidAmountPKR",
      "status",
      "paidAt",
      "paymentMethod",
    ],
    filters: { employeeId: "employeeId", paymentMethod: "paymentMethod" },
    note: "Paid records only. Amount is the frozen net salary less the approved adjustment. Payroll and expense ledgers are not automatically reconciled; do not add their totals together.",
  },
  results: {
    title: "Published examination results",
    category: "Academics",
    permission: "results.view",
    model: ProcessedResult,
    date: "publishedAt",
    fixed: {
      isPublished: true,
      needsProcessing: { $ne: true },
      status: { $ne: "PENDING" },
      percentage: { $type: "number" },
    },
    columns: [
      "examTitle",
      "studentName",
      "rollNumber",
      "className",
      "totalMaxMarks",
      "totalObtainedMarks",
      "percentage",
      "overallGrade",
      "status",
      "publishedAt",
    ],
    filters: {
      classId: "classId",
      studentId: "studentId",
      examId: "examId",
      status: "status",
    },
    note: "Published, processed results with a numeric percentage only. Different examinations are not assumed comparable.",
  },
  admissions: {
    title: "Admission applications",
    category: "Admissions",
    permission: "students.view",
    model: Admission,
    date: "inquiryDate",
    columns: [
      "applicationNumber",
      "studentName",
      "guardianName",
      "guardianPhone",
      "applyingClassName",
      "academicSessionName",
      "inquiryDate",
      "followUpDate",
      "documentsStatus",
      "status",
    ],
    filters: {
      classId: "applyingClassId",
      academicSessionId: "academicSessionId",
      studentId: "studentId",
      status: "status",
    },
    note: "Inquiries and their current application/document status; not a school capacity estimate.",
  },
};
for (const key of ["results", "subjectResults"]) {
  Object.assign(reportDefinitions[key].filters, {
    academicSessionId: "@examSession",
    term: "@examTerm",
    subjectId: "subjectScores.subjectId",
  });
}
reportDefinitions.subjects.filters.subjectId = "_id";
reportDefinitions.timetable.filters.subjectId = "subjectId";
reportDefinitions.assignments.filters.subjectId = "subjectId";
const id = z.string().regex(/^[a-f0-9]{24}$/i);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
for (const [key, columns] of Object.entries({
  assignments: ["employeeNumber", "academicSessionName"],
  employment: ["staffName"],
  staffAttendance: ["employeeNumber", "designation", "department"],
  timetable: ["className", "sectionName", "academicSessionName"],
  students: ["academicSessionName"],
}))
  for (const c of columns)
    if (!reportDefinitions[key].columns.includes(c))
      reportDefinitions[key].columns.push(c);
const categoryReportKeys = [
  "students", "guardians", "issuedDocuments", "attendance", "collections",
  "invoices", "results", "subjectResults", "admissions",
];
for (const key of categoryReportKeys) {
  reportDefinitions[key].filters.classCategoryId = "classCategoryId";
  if (key !== "admissions") {
    reportDefinitions[key].filters.classId ||= "classId";
    reportDefinitions[key].filters.sectionId ||= "sectionId";
    reportDefinitions[key].filters.academicSessionId ||= "academicSessionId";
  }
}
export const reportFilters = z
  .object({
    from: date,
    to: date,
    classId: id.optional(),
    classCategoryId: id.optional(),
    sectionId: id.optional(),
    academicSessionId: id.optional(),
    studentId: id.optional(),
    employeeId: id.optional(),
    examId: id.optional(),
    subjectId: id.optional(),
    term: z.enum(["MID_TERM", "FINAL_TERM"]).optional(),
    status: z.string().trim().max(30).optional(),
    department: z.string().trim().max(100).optional(),
    role: z
      .enum([
        "SCHOOL_ADMIN",
        "TEACHER",
        "FINANCE",
        "EXAM_STAFF",
        "RECEPTIONIST",
      ])
      .optional(),
    category: z
      .enum([
        "Salary",
        "Rent",
        "Electricity",
        "Stationery",
        "Maintenance",
        "Transport",
        "Other",
      ])
      .optional(),
    paymentMethod: z
      .enum(["Cash", "Bank Transfer", "Online", "Cheque", "Other"])
      .optional(),
  })
  .strict()
  .superRefine((v, c) => {
    const days = (Date.parse(v.to) - Date.parse(v.from)) / 86400000;
    if (days < 0 || days > 730)
      c.addIssue({
        code: "custom",
        message: "Choose an ordered date range of up to 731 days.",
      });
  });
export const reportSelection = z
  .object({
    report: z.string().max(30),
    columns: z.array(z.string().max(80)).min(1).max(20),
  })
  .strict();
export const reportRequest = z
  .object({
    filters: reportFilters,
    selections: z
      .array(reportSelection)
      .min(1)
      .max(24)
      .refine(
        (v) => new Set(v.map((s) => s.report)).size === v.length,
        "Select each report only once.",
      ),
  })
  .strict();
export type Filters = z.infer<typeof reportFilters>;
export async function validateReportReferences(
  actor: AuthenticatedUser,
  filters: Filters,
  reportKey?: string,
) {
  const descriptions: Record<string, string> = {};
  const lookups: any = {
    classCategoryId: ClassCategory,
    classId: ClassModel,
    sectionId: SectionModel,
    academicSessionId: AcademicSession,
    studentId: Student,
    employeeId: User,
    examId: ExamSchedule,
    subjectId: Subject,
  };
  for (const [field, model] of Object.entries(lookups) as [string, any][]) {
    const value = (filters as any)[field];
    if (!value) continue;
    const ref: any = await model
      .findOne({ _id: value, schoolId: actor.schoolId })
      .lean();
    if (!ref)
      throw {
        statusCode: 400,
        message: `Choose an authorized ${field.replace("Id", "")}.`,
      };
    descriptions[field] =
      [
        ref.name || ref.title,
        field === "studentId"
          ? ref.studentId || ref.admissionNumber
          : field === "employeeId"
            ? ref.employeeId
            : undefined,
      ]
        .filter(Boolean)
        .join(" · ") || "Selected school record";
    if (
      field === "employeeId" &&
      ["PARENT", "SUPER_ADMIN"].includes(ref.userType)
    )
      throw { statusCode: 400, message: "Choose a staff employee." };
    if (
      field === "classId" && filters.classCategoryId &&
      String(ref.classCategoryId || "") !== filters.classCategoryId
    )
      throw { statusCode: 400, message: "The selected class does not belong to the selected category." };
    if (
      field === "subjectId" &&
      filters.classId &&
      String(ref.classId) !== filters.classId
    )
      throw {
        statusCode: 400,
        message: "Subject does not belong to the selected class.",
      };
    if (
      field === "examId" &&
      filters.academicSessionId &&
      String(ref.academicSessionId) !== filters.academicSessionId
    )
      throw {
        statusCode: 400,
        message: "Examination does not belong to the selected session.",
      };
    if (
      field === "sectionId" &&
      filters.classId &&
      String(ref.classId) !== filters.classId
    )
      throw {
        statusCode: 400,
        message: "The section does not belong to the selected class.",
      };
    if (
      field === "sectionId" && filters.classCategoryId &&
      !(await ClassModel.exists({ _id: ref.classId, schoolId: actor.schoolId, classCategoryId: filters.classCategoryId }))
    )
      throw { statusCode: 400, message: "The selected section does not belong to the selected category." };
    if (
      field === "studentId" &&
      (!reportKey || ["students", "guardians"].includes(reportKey)) &&
      ((filters.classId && String(ref.classId) !== filters.classId) ||
        (filters.sectionId && String(ref.sectionId) !== filters.sectionId) ||
        (filters.academicSessionId &&
          String(ref.academicSessionId) !== filters.academicSessionId))
    )
      throw {
        statusCode: 400,
        message:
          "The selected student does not match the class, section or session.",
      };
  }
  return descriptions;
}
export function authorizeReports(actor: AuthenticatedUser) {
  if (
    !actor.schoolId ||
    actor.userType !== "SCHOOL_ADMIN" ||
    !actor.permissions?.includes("reports.view") ||
    !hasFeature(actor.plan, "ADVANCED_REPORTS")
  )
    throw {
      statusCode: 403,
      message:
        "School administrator reports permission and Advanced Reports subscription are required.",
    };
}
export function reportCatalogue(actor: AuthenticatedUser) {
  authorizeReports(actor);
  return Object.entries(reportDefinitions)
    .filter(
      ([, v]) =>
        actor.permissions?.includes(v.permission) &&
        (!permissionFeature(v.permission) ||
          hasFeature(actor.plan, permissionFeature(v.permission)!)),
    )
    .map(([key, v]) => ({
      key,
      title: v.title,
      category: v.category,
      columns: v.columns,
      columnLabels: Object.fromEntries(
        v.columns.map((c) => [c, reportColumnLabel(key, c)]),
      ),
      filters: Object.keys(v.filters),
      values: Object.fromEntries(
        Object.entries(v.filters).map(([key, path]) => [
          key,
          key === "term"
            ? ["MID_TERM", "FINAL_TERM"]
            : v.model.schema.path(path)?.enumValues || [],
        ]),
      ),
      note: v.note,
    }));
}
export function reportSpec(
  actor: AuthenticatedUser,
  key: string,
  columns: string[],
) {
  if (!reportCatalogue(actor).some((v) => v.key === key))
    throw {
      statusCode: 403,
      message:
        "This report is unavailable for your permissions or subscription.",
    };
  const spec = reportDefinitions[key];
  if (
    new Set(columns).size !== columns.length ||
    columns.some((v) => !spec.columns.includes(v))
  )
    throw { statusCode: 400, message: "Select valid, unique report columns." };
  return spec;
}
export function periodBounds(filters: Filters) {
  return {
    start: new Date(filters.from + "T00:00:00+05:00"),
    end: new Date(
      new Date(filters.to + "T00:00:00+05:00").getTime() + 86400000,
    ),
  };
}
async function categoryFilter(actor: AuthenticatedUser, key: string, filters: Filters) {
  if (!filters.classCategoryId) return undefined;
  if (key === "collections") return undefined;
  const category: any = await ClassCategory.findOne({ _id: filters.classCategoryId, schoolId: actor.schoolId }).select("name displayOrder").lean();
  if (!category) throw { statusCode: 400, message: "Choose an authorized class category." };
  const classes: any[] = await ClassModel.find({ schoolId: actor.schoolId, classCategoryId: filters.classCategoryId, ...(filters.classId ? { _id: filters.classId } : {}) }).select("_id").limit(50001).lean();
  const classIds = classes.map((c) => c._id);
  const schema = reportDefinitions[key].model.schema;
  if (schema.path("applyingClassId")) {
    const alternatives: any[] = [{ applyingClassId: { $in: classIds } }];
    if (!filters.classId && schema.path("applyingClassCategoryName")) alternatives.push({ applyingClassCategoryName: category.name });
    return { $or: alternatives };
  }
  if (schema.path("classId")) {
    const alternatives: any[] = [{ classId: { $in: classIds } }];
    if (!filters.classId && schema.path("classCategoryName")) alternatives.push({ classCategoryName: category.name });
    return { $or: alternatives };
  }
  if (schema.path("classCategoryName")) return { classCategoryName: category.name };
  if (schema.path("studentId")) {
    const students: any[] = await Student.find({ schoolId: actor.schoolId, classId: { $in: classIds } }).select("_id").limit(50001).lean();
    if (students.length > 50000) throw { statusCode: 413, message: "This category contains too many student links for a single report. Narrow the date range or class." };
    return { studentId: { $in: students.map((s) => s._id) } };
  }
  return { _id: { $exists: false } };
}
async function feeCollectionPlacementFilter(actor: AuthenticatedUser, key: string, filters: Filters) {
  if (key !== "collections" || !(filters.classCategoryId || filters.classId || filters.sectionId || filters.academicSessionId)) return undefined;
  const match: any = { schoolId: actor.schoolId };
  if (filters.classId) match.classId = filters.classId;
  if (filters.sectionId) {
    const section: any = await SectionModel.findOne({ _id: filters.sectionId, schoolId: actor.schoolId }).select("name classId").lean();
    if (!section) throw { statusCode: 400, message: "Choose an authorized section." };
    match.sectionName = section.name;
    if (!filters.classId) match.classId = section.classId;
  }
  if (filters.academicSessionId) {
    const session: any = await AcademicSession.findOne({ _id: filters.academicSessionId, schoolId: actor.schoolId }).select("name").lean();
    if (!session) throw { statusCode: 400, message: "Choose an authorized academic session." };
    match.academicSession = session.name;
  }
  if (filters.classCategoryId) {
    const category: any = await ClassCategory.findOne({ _id: filters.classCategoryId, schoolId: actor.schoolId }).select("name").lean();
    if (!category) throw { statusCode: 400, message: "Choose an authorized class category." };
    const classes: any[] = await ClassModel.find({ schoolId: actor.schoolId, classCategoryId: filters.classCategoryId, ...(filters.classId ? { _id: filters.classId } : {}) }).select("_id").limit(50001).lean();
    const categoryIds = classes.map((c) => c._id);
    match.$or = [{ classId: { $in: categoryIds } }, ...(!filters.classId ? [{ classCategoryName: category.name }] : [])];
  }
  const challans: any[] = await FeeChallan.find(match).select("_id").limit(50001).lean();
  if (challans.length > 50000) throw { statusCode: 413, message: "This fee collection filter matches over 50,000 challans. Narrow the date range or class." };
  return { challanId: { $in: challans.map((c) => c._id) } };
}
async function studentPlacementFilter(actor: AuthenticatedUser, key: string, filters: Filters) {
  const spec = reportDefinitions[key];
  if (!spec.model.schema.path("studentId") || spec.model.schema.path("challanId")) return undefined;
  const placement: any = { schoolId: actor.schoolId };
  let needed = false;
  for (const field of ["classId", "sectionId", "academicSessionId"] as const) {
    const value = filters[field];
    if (!value || spec.model.schema.path(spec.filters[field] || field)) continue;
    placement[field] = value;
    needed = true;
  }
  if (!needed) return undefined;
  const students: any[] = await Student.find(placement).select("_id").limit(50001).lean();
  if (students.length > 50000) throw { statusCode: 413, message: "This student placement filter matches over 50,000 students. Narrow the report filters." };
  return { studentId: { $in: students.map((s) => s._id) } };
}
export function reportPipeline(
  actor: AuthenticatedUser,
  key: string,
  filters: Filters,
  categoryCondition?: any,
) {
  const spec = reportDefinitions[key],
    { start, end } = periodBounds(filters);
  const match: any = {
    schoolId: new mongoose.Types.ObjectId(actor.schoolId!),
    ...(spec.fixed ? { $and: [spec.fixed] } : {}),
    [spec.date]: spec.stringDate
      ? { $gte: filters.from, $lte: filters.to }
      : { $gte: start, $lt: end },
  };
  if (["students", "guardians"].includes(key) && filters.studentId)
    delete match[spec.date];
  const after: any = {};
  for (const [filterKey, value] of Object.entries(filters)) {
    if (filterKey === "from" || filterKey === "to" || filterKey === "classCategoryId" || value === undefined) continue;
    const field = spec.filters[filterKey];
    if (!field)
      throw {
        statusCode: 400,
        message: `${filterKey} is not supported by ${spec.title}. Remove this filter or select compatible reports.`,
      };
    if (categoryReportKeys.includes(key) && ["classId", "sectionId", "academicSessionId"].includes(filterKey) && !spec.model.schema.path(field)) continue;
    const target =
      spec.unwind && field.startsWith(spec.unwind + ".") ? after : match;
    target[field] = filterKey.endsWith("Id")
      ? new mongoose.Types.ObjectId(value)
      : value;
  }
  if (categoryCondition) (match.$and ||= []).push(categoryCondition);
  const pipeline: any[] = [{ $match: match }];
  if (spec.unwind)
    pipeline.push({
      $unwind: { path: "$" + spec.unwind, includeArrayIndex: "_reportRow" },
    });
  if (Object.keys(after).length) pipeline.push({ $match: after });
  if (spec.computed) pipeline.push({ $addFields: spec.computed });
  return pipeline;
}
type ReportRelation = {
  source: string;
  target: string;
  kind: string;
  value?: string;
  replace?: boolean;
};
const relationshipModels: any = {
  student: Student,
  user: User,
  class: ClassModel,
  section: SectionModel,
  subject: Subject,
  session: AcademicSession,
  exam: ExamSchedule,
  employment: StaffEmployment,
};
function reportRelations(key: string): ReportRelation[] {
  const rel = (
    source: string,
    target: string,
    kind: string,
    value = "name",
    replace = false,
  ) => ({ source, target, kind, value, replace });
  const placement = [
    rel("classId", "className", "class"),
    rel("sectionId", "sectionName", "section"),
    rel("academicSessionId", "academicSessionName", "session"),
  ];
  const staff = (source: string) => [
    rel(source, "employeeNumber", "employment", "employeeId"),
    rel(source, "designation", "employment", "designation"),
    rel(source, "department", "employment", "department"),
  ];
  const map: Record<string, ReportRelation[]> = {
    assignments: [
      rel("teacherUserId", "teacherUserId", "user", "name", true),
      rel("classId", "classId", "class", "name", true),
      rel("sectionId", "sectionId", "section", "name", true),
      rel("subjectId", "subjectId", "subject", "name", true),
      rel("academicSessionId", "academicSessionName", "session"),
      ...staff("teacherUserId"),
    ],
    issuedDocuments: [rel("studentId", "studentId", "student", "name", true)],
    staffAttendance: [
      rel("employeeId", "employeeId", "user", "name", true),
      ...staff("employeeId"),
    ],
    payroll: [
      rel("employeeId", "employeeId", "employment", "employeeId", true),
      rel("employeeId", "snapshot.employee.name", "user"),
    ],
    employment: [rel("userId", "staffName", "user")],
    staff: [rel("_id", "employeeId", "employment", "employeeId")],
    classes: [rel("classTeacherId", "classTeacherName", "user")],
    sections: placement,
    students: placement,
    guardians: placement,
    subjects: [...placement, rel("teacherId", "teacherName", "user")],
    timetable: [
      ...placement,
      rel("subjectId", "subjectName", "subject"),
      rel("teacherId", "teacherName", "user"),
    ],
    exams: [rel("academicSessionId", "academicSessionName", "session")],
    leave: [
      rel("teacherId", "teacherName", "user"),
      rel("teacherId", "employeeId", "employment", "employeeId"),
    ],
    attendance: [
      ...placement,
      rel("records.studentId", "records.studentName", "student"),
    ],
    legacyTeacherAttendance: [
      rel("records.teacherUserId", "records.teacherName", "user"),
    ],
    collections: [
      rel("studentId", "studentName", "student"),
      rel("collectedByUserId", "collectedByUserName", "user"),
      ...placement,
    ],
    invoices: [rel("studentId", "studentName", "student"), ...placement],
    results: [
      ...placement,
      rel("studentId", "studentName", "student"),
      rel("examId", "examTitle", "exam", "title"),
    ],
    subjectResults: [
      ...placement,
      rel("studentId", "studentName", "student"),
      rel("examId", "examTitle", "exam", "title"),
      rel("subjectScores.subjectId", "subjectScores.subjectName", "subject"),
    ],
    admissions: [
      rel("applyingClassId", "applyingClassName", "class"),
      rel("academicSessionId", "academicSessionName", "session"),
    ],
  };
  return map[key] || [];
}
function setReportPath(row: any, path: string, value: any) {
  const parts = path.split(".");
  let at = row;
  for (const key of parts.slice(0, -1)) at = at[key] || (at[key] = {});
  at[parts.at(-1)!] = value;
}
async function reportCategories(actor: AuthenticatedUser, key: string, rows: any[]) {
  const classIds = new Set<string>(), studentIds = new Set<string>(), challanIds = new Set<string>();
  for (const row of rows) {
    const classId = row.classId || row.applyingClassId;
    const studentId = row.studentId || row.records?.studentId;
    if (row.challanId) challanIds.add(String(row.challanId));
    if (classId) classIds.add(String(classId));
    if (studentId) studentIds.add(String(studentId));
  }
  const [classes, students, challans] = await Promise.all([
    classIds.size ? ClassModel.find({ schoolId: actor.schoolId, _id: { $in: [...classIds] } }).select("classCategoryId classCategoryName").lean() : [],
    !classIds.size && studentIds.size ? Student.find({ schoolId: actor.schoolId, _id: { $in: [...studentIds] } }).select("classId classCategoryName").lean() : [],
    challanIds.size ? FeeChallan.find({ schoolId: actor.schoolId, _id: { $in: [...challanIds] } }).select("classId classCategoryName").lean() : [],
  ]);
  const challanMap = new Map((challans as any[]).map((challan) => [String(challan._id), challan]));
  for (const challan of challans as any[]) { if (challan.classId) classIds.add(String(challan.classId)); }
  const allClasses: any[] = [...classes];
  const loadedClasses = new Set(allClasses.map((c: any) => String(c._id)));
  const extraClassIds = [...new Set([...students.map((s: any) => String(s.classId || "")), ...(challans as any[]).map((c: any) => String(c.classId || ""))])].filter((id) => id && !loadedClasses.has(id));
  if (extraClassIds.length) allClasses.push(...await ClassModel.find({ schoolId: actor.schoolId, _id: { $in: extraClassIds } }).select("_id classCategoryId classCategoryName").lean());
  const categoryIds = [...new Set(allClasses.map((c: any) => String(c.classCategoryId || "")).filter(Boolean))];
  const categoryDocs: any[] = categoryIds.length ? await ClassCategory.find({ schoolId: actor.schoolId, _id: { $in: categoryIds } }).select("name displayOrder").lean() : [];
  const byId = new Map(categoryDocs.map((c: any) => [String(c._id), c.name]));
  const classMap = new Map(allClasses.map((c: any) => [String(c._id), byId.get(String(c.classCategoryId || "")) || c.classCategoryName || ""]));
  const studentMap = new Map(students.map((s: any) => [String(s._id), s]));
  const categoryNames = rows.map((row) => {
    const snapshot = row.classCategoryName || row.applyingClassCategoryName || challanMap.get(String(row.challanId))?.classCategoryName;
    if (snapshot) return String(snapshot);
    const classId = row.classId || row.applyingClassId || studentMap.get(String(row.studentId || row.records?.studentId))?.classId;
    return classMap.get(String(classId || "")) || "Uncategorized";
  });
  const displayOrder = new Map(categoryDocs.map((c: any) => [c.name, Number(c.displayOrder || 0)]));
  const groups = new Map<string, number[]>();
  rows.forEach((row, index) => { const name = categoryNames[index] || "Uncategorized"; if (!groups.has(name)) groups.set(name, []); groups.get(name)!.push(index); });
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return (displayOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (displayOrder.get(b) ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b);
  }).map(([category, indexes]) => ({ category, count: indexes.length, indexes }));
}
async function resolveReportRelations(
  actor: AuthenticatedUser,
  key: string,
  columns: string[],
  rows: any[],
) {
  const relations = reportRelations(key).filter((r) =>
    columns.includes(r.target),
  );
  const sources = rows.map((row) =>
    relations.map((r) => String(reportPathValue(row, r.source) || "")),
  );
  const groups: Record<string, Set<string>> = {};
  relations.forEach((r, i) => {
    for (const [j, row] of rows.entries()) {
      const value = reportPathValue(row, r.target);
      if (!r.replace && value !== undefined && value !== null && value !== "")
        continue;
      const id = sources[j][i];
      if (/^[a-f0-9]{24}$/i.test(id)) (groups[r.kind] ||= new Set()).add(id);
    }
  });
  const lookups: Record<string, Map<string, any>> = {};
  await Promise.all(
    Object.entries(groups).map(async ([kind, ids]) => {
      const lookupKey = kind === "employment" ? "userId" : "_id";
      const docs = await relationshipModels[kind]
        .find({
          schoolId: actor.schoolId,
          [lookupKey]: { $in: [...ids] },
          ...(kind === "user"
            ? { userType: { $nin: ["PARENT", "SUPER_ADMIN"] } }
            : {}),
        })
        .select(
          "name title employeeId admissionNumber studentId userId designation department",
        )
        .lean();
      lookups[kind] = new Map(docs.map((d: any) => [String(d[lookupKey]), d]));
    }),
  );
  return rows.map((row, j) => {
    relations.forEach((r, i) => {
      const current = reportPathValue(row, r.target);
      if (
        !r.replace &&
        current !== undefined &&
        current !== null &&
        current !== ""
      )
        return;
      const doc = lookups[r.kind]?.get(sources[j][i]);
      setReportPath(
        row,
        r.target,
        doc?.[r.value || "name"] ||
          (r.replace && current ? "Related record unavailable" : ""),
      );
    });
    const out: any = {};
    for (const c of columns) setReportPath(out, c, reportPathValue(row, c));
    return out;
  });
}
export async function reportRows(
  actor: AuthenticatedUser,
  selection: z.infer<typeof reportSelection>,
  filters: Filters,
  page = 1,
  exporting = false,
) {
  const spec = reportSpec(actor, selection.report, selection.columns),
    effectiveFilters = { ...filters };
  const examRelated = ["results", "subjectResults"].includes(selection.report);
  if (examRelated) {
    delete effectiveFilters.academicSessionId;
    delete effectiveFilters.term;
  }
  const categoryCondition = await categoryFilter(actor, selection.report, effectiveFilters);
  const placementCondition = categoryReportKeys.includes(selection.report) ? await studentPlacementFilter(actor, selection.report, effectiveFilters) : undefined;
  const feeCollectionCondition = await feeCollectionPlacementFilter(actor, selection.report, effectiveFilters);
  const conditions = [categoryCondition, placementCondition, feeCollectionCondition].filter(Boolean);
  const pipeline = reportPipeline(actor, selection.report, effectiveFilters, conditions.length > 1 ? { $and: conditions } : conditions[0]);
  const filterLabels = await validateReportReferences(
    actor,
    filters,
    selection.report,
  );
  if (examRelated && (filters.academicSessionId || filters.term)) {
    const exams = await ExamSchedule.find({
      schoolId: actor.schoolId,
      ...(filters.academicSessionId
        ? { academicSessionId: filters.academicSessionId }
        : {}),
      ...(filters.term ? { term: filters.term } : {}),
    })
      .select("_id")
      .limit(1001)
      .lean();
    if (exams.length > 1000)
      throw {
        statusCode: 413,
        message: "Narrow the academic session or examination filter.",
      };
    pipeline.push({ $match: { examId: { $in: exams.map((e) => e._id) } } });
  }
  const projection = Object.fromEntries(
    [
      ...selection.columns,
      ...(categoryReportKeys.includes(selection.report) ? ["classId", "applyingClassId", "studentId", "challanId", "records.studentId", "classCategoryName", "applyingClassCategoryName"] : []),
      ...reportRelations(selection.report)
        .filter((r) => selection.columns.includes(r.target))
        .map((r) => r.source),
    ].map((c) => [c, 1]),
  );
  const aggregate = spec.model
    .aggregate([
      ...pipeline,
      { $sort: { [spec.date]: -1, _id: 1, _reportRow: 1 } },
      {
        $facet: {
          rows: [
            { $skip: exporting ? 0 : (page - 1) * 25 },
            { $limit: exporting ? 5001 : 25 },
            { $project: { ...projection, _id: projection._id ? 1 : 0 } },
          ],
          count: [{ $count: "value" }],
        },
      },
    ])
    .option({ maxTimeMS: 10000 });
  const [result] = await aggregate;
  if (exporting && result.count[0]?.value > 5000)
    throw {
      statusCode: 413,
      message:
        "This report exceeds 5,000 rows. Narrow the dates or filters before exporting.",
    };
  const resolvedRows = await resolveReportRelations(
    actor,
    selection.report,
    selection.columns,
    result.rows,
  );
  const groups = categoryReportKeys.includes(selection.report)
    ? (await reportCategories(actor, selection.report, result.rows)).map((group) => {
        const groupRows = group.indexes.map((i: number) => resolvedRows[i]);
        const subtotalColumns = selection.columns.filter((c) => /(?:AmountPKR|amountPKR|totalAmountPKR|remainingAmountPKR)$/.test(c));
        return { category: group.category, count: group.count, rows: groupRows, subtotals: Object.fromEntries(subtotalColumns.map((c) => [c, groupRows.reduce((sum: number, row: any) => sum + (typeof reportPathValue(row, c) === "number" ? reportPathValue(row, c) : 0), 0)])) };
      })
    : undefined;
  return {
    report: selection.report,
    title: spec.title,
    columns: selection.columns,
    rows: resolvedRows,
    groups,
    columnLabels: Object.fromEntries(
      selection.columns.map((c) => [c, reportColumnLabel(selection.report, c)]),
    ),
    total: result.count[0]?.value || 0,
    page,
    note: spec.note,
    filterLabels,
  };
}
export function cellValue(row: any, path: string): string | number {
  return readableReportValue(reportPathValue(row, path), path);
}
export function safeSpreadsheet(value: string | number) {
  return typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(value)
    ? "'" + value
    : value;
}
export function csvReport(report: Awaited<ReturnType<typeof reportRows>>) {
  const quote = (v: string | number) =>
    '"' + String(safeSpreadsheet(v)).replace(/"/g, '""') + '"';
  const groups: any[] = report.groups?.length ? report.groups : [{ category: "", rows: report.rows, count: report.rows.length, subtotals: {} }];
  const columns = report.groups?.length ? report.columns.filter((c) => !["classCategoryName", "applyingClassCategoryName"].includes(c)) : report.columns;
  const lines = [columns.map((c) => quote(reportColumnLabel(report.report, c))).join(",")];
  const summable = columns.filter((c) => /(?:AmountPKR|amountPKR|totalAmountPKR|remainingAmountPKR)$/.test(c));
  for (const group of groups) {
    if (group.category) lines.push(quote(`${group.category} — ${report.title}`));
    lines.push(...group.rows.map((row: any) => columns.map((c) => quote(cellValue(row, c))).join(",")));
    if (group.category) lines.push(columns.map((c, i) => quote(summable.includes(c) ? Number(group.subtotals?.[c] || 0) : i === 0 ? `${group.category} subtotal (${group.count} records)` : "")).join(","));
  }
  if (report.groups?.length) lines.push(columns.map((c, i) => quote(summable.includes(c) ? report.groups!.reduce((sum: number, g: any) => sum + Number(g.subtotals?.[c] || 0), 0) : i === 0 ? `GRAND TOTAL (${report.total} records)` : "")).join(","));
  return (
    "\ufeff" +
    lines.join("\r\n")
  );
}
