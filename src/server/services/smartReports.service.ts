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
export const reportFilters = z
  .object({
    from: date,
    to: date,
    classId: id.optional(),
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
export function reportPipeline(
  actor: AuthenticatedUser,
  key: string,
  filters: Filters,
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
  for (const [key, value] of Object.entries(filters)) {
    if (key === "from" || key === "to" || value === undefined) continue;
    const field = spec.filters[key];
    if (!field)
      throw {
        statusCode: 400,
        message: `${key} is not supported by ${spec.title}. Remove this filter or select compatible reports.`,
      };
    const target =
      spec.unwind && field.startsWith(spec.unwind + ".") ? after : match;
    target[field] = key.endsWith("Id")
      ? new mongoose.Types.ObjectId(value)
      : value;
  }
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
  const pipeline = reportPipeline(actor, selection.report, effectiveFilters);
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
  return {
    report: selection.report,
    title: spec.title,
    columns: selection.columns,
    rows: await resolveReportRelations(
      actor,
      selection.report,
      selection.columns,
      result.rows,
    ),
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
  return (
    "\ufeff" +
    [
      report.columns
        .map((c) => quote(reportColumnLabel(report.report, c)))
        .join(","),
      ...report.rows.map((row: any) =>
        report.columns.map((c) => quote(cellValue(row, c))).join(","),
      ),
    ].join("\r\n")
  );
}
