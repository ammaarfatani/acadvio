import { z } from "zod";

const text = (label: string, min = 1) =>
  z
    .string()
    .trim()
    .min(
      min,
      `${label} must be at least ${min} character${min === 1 ? "" : "s"}.`,
    );
const amount = z.coerce
  .number()
  .finite("Enter a valid number.")
  .nonnegative("Amount cannot be negative.");
const positive = z.coerce
  .number()
  .finite("Enter a valid number.")
  .positive("Enter an amount greater than zero.");
const date = z.coerce.date({ error: "Enter a valid date." });
const id = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid record.");

export const StudentCreateSchema = z.object({
  nameUrdu: z.string().trim().max(2000).optional(),
  nationality: z.string().trim().max(2000).optional(),
  religion: z.string().trim().max(2000).optional(),
  bloodGroup: z.string().trim().max(2000).optional(),
  placeOfBirth: z.string().trim().max(2000).optional(),
  previousSchool: z.string().trim().max(2000).optional(),
  previousClass: z.string().trim().max(2000).optional(),
  permanentAddress: z.string().trim().max(2000).optional(),
  billingAddress: z.string().trim().max(2000).optional(),
  motherOccupation: z.string().trim().max(2000).optional(),
  medicalInformation: z.string().trim().max(2000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  supportRequirements: z.string().trim().max(2000).optional(),
  name: text("Student name", 2),
  dob: date,
  gender: z.enum(["Male", "Female", "Other"]),
  classId: id,
  className: text("Class"),
  rollNumber: z.string().optional(),
  admissionNumber: z.string().optional(),
  studentId: z.string().optional(),
  sectionId: id,
  sectionName: z.string().optional(),
  admissionDate: date.optional(),
  academicSessionId: id,
  academicSessionName: z.string().optional(),
  address: text("Address", 5),
  phone: z.string().optional(),
  photoUrl: z.string().optional(),
  bFormNumber: z.string().trim().max(32).optional(),
  photoData: z.string().max(7000000).nullable().optional(),
  parentInfo: z.object({
    fatherName: text("Father name"),
    fatherPhone: text("Father phone"),
    fatherCnic: z.string().optional(),
    fatherOccupation: z.string().optional(),
    motherName: z.string().optional(),
    motherPhone: z.string().optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianEmail: z
      .string()
      .email("Enter a valid guardian email.")
      .optional()
      .or(z.literal("")),
    guardianRelation: z.string().optional(),
  }),
  parentAccount: z.object({ password: z.string().min(8).max(128) }).optional(),
  emergencyContact: z.object({
    name: text("Emergency contact name"),
    phone: text("Emergency contact phone"),
    relation: text("Emergency contact relation"),
  }),
});

export const StudentUpdateSchema = StudentCreateSchema.partial()
  .extend({
    status: z
      .enum([
        "ACTIVE",
        "INACTIVE",
        "LEFT",
        "GRADUATED",
        "TRANSFERRED",
        "ARCHIVED",
      ])
      .optional(),
    lifecycleReason: z.string().trim().optional(),
    effectiveDate: date.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one student field to update.",
  );
export const AdmissionCreateSchema = z.object({
  studentName: text("Student name", 2),
  guardianName: text("Guardian name", 2),
  guardianPhone: text("Guardian phone", 7),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  previousSchool: z.string().trim().optional(),
  previousClass: z.string().trim().optional(),
  applyingClassId: id,
  academicSessionId: id,
  admissionSource: z.string().trim().optional(),
  followUpDate: date.optional(),
  notes: z.string().trim().optional(),
});
export const AdmissionUpdateSchema = z
  .object({
    status: z
      .enum([
        "NEW",
        "CONTACTED",
        "FOLLOW_UP",
        "APPLIED",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
      ])
      .optional(),
    followUpDate: date.nullable().optional(),
    notes: z.string().trim().optional(),
    documentsStatus: z.enum(["PENDING", "PARTIAL", "COMPLETE"]).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one admission field to update.",
  );
export const AdmissionAdmitSchema = z.object({
  nameUrdu: z.string().trim().max(2000).optional(),
  nationality: z.string().trim().max(2000).optional(),
  religion: z.string().trim().max(2000).optional(),
  bloodGroup: z.string().trim().max(2000).optional(),
  placeOfBirth: z.string().trim().max(2000).optional(),
  previousSchool: z.string().trim().max(2000).optional(),
  previousClass: z.string().trim().max(2000).optional(),
  permanentAddress: z.string().trim().max(2000).optional(),
  billingAddress: z.string().trim().max(2000).optional(),
  motherOccupation: z.string().trim().max(2000).optional(),
  medicalInformation: z.string().trim().max(2000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  supportRequirements: z.string().trim().max(2000).optional(),
  parentPassword: z.string().min(8).max(128).optional(),
  dob: date,
  gender: z.enum(["Male", "Female", "Other"]),
  sectionId: id,
  address: text("Address", 5),
  phone: z.string().optional(),
  photoUrl: z.string().optional(),
  bFormNumber: z.string().trim().max(32).optional(),
  photoData: z.string().max(7000000).nullable().optional(),
  fatherCnic: z.string().optional(),
  fatherOccupation: z.string().optional(),
  motherName: z.string().optional(),
  motherPhone: z.string().optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  guardianRelation: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRelation: z.string().optional(),
});
export const ClassCreateSchema = z.object({
  name: text("Class name"),
  code: text("Class code"),
  numericLevel: z.coerce.number().int().positive().optional(),
  classTeacherId: z.string().optional(),
  classTeacherName: z.string().optional(),
});
export const SectionCreateSchema = z.object({
  classId: id,
  className: text("Class name"),
  name: text("Section name"),
  roomNumber: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
});
export const SubjectCreateSchema = z
  .object({
    name: text("Subject name"),
    code: z.string().trim().optional(),
    type: z.enum(["Core", "Elective", "Practical"]).optional(),
    classId: id,
    className: text("Class name"),
    totalMarks: positive.optional(),
    passingMarks: amount.optional(),
    teacherId: id.optional(),
    teacherName: z.string().optional(),
  })
  .refine(
    (value) =>
      value.passingMarks === undefined ||
      value.totalMarks === undefined ||
      value.passingMarks <= value.totalMarks,
    {
      message: "Passing marks cannot exceed total marks.",
      path: ["passingMarks"],
    },
  );

const attendanceRecord = z.object({
  studentId: id,
  studentName: z.string().optional(),
  rollNumber: z.string().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LEAVE", "LATE"]),
  remarks: z.string().optional(),
});
export const StudentAttendanceSchema = z.object({
  date,
  classId: id,
  className: text("Class name"),
  sectionId: z.string().optional(),
  sectionName: z.string().optional(),
  records: z
    .array(attendanceRecord)
    .min(1, "Add at least one student attendance record."),
});
export const TeacherClassAttendanceSchema = z.object({
  date,
  classId: id,
  sectionId: z.string().optional(),
  records: z
    .array(attendanceRecord)
    .min(1, "Add at least one student attendance record."),
});
export const TeacherAttendanceSchema = z.object({
  date,
  records: z
    .array(
      z.object({
        teacherUserId: id,
        teacherName: text("Teacher name"),
        status: z.enum(["PRESENT", "ABSENT", "LEAVE", "LATE"]),
        arrivalTime: z.string().optional(),
        remarks: z.string().optional(),
      }),
    )
    .min(1, "Add at least one teacher attendance record."),
});

const feeAmounts = {
  admissionFee: amount.optional(),
  tuitionFee: amount.default(0),
  examFee: amount.optional(),
  transportFee: amount.optional(),
  libraryFee: amount.optional(),
  computerFee: amount.optional(),
  otherCharges: amount.optional(),
  defaultDiscount: amount.optional(),
  lateFeeFineRate: amount.optional(),
  dueDateDay: z.coerce.number().int().min(1).max(31).optional(),
};
export const FeeStructureSchema = z.object({
  title: text("Fee structure title"),
  academicSession: z.string().optional(),
  classId: id,
  className: text("Class name"),
  sectionId: z.string().optional(),
  sectionName: z.string().optional(),
  ...feeAmounts,
});
export const FeeBatchSchema = z.object({
  classId: id,
  className: z.string().optional(),
  month: text("Fee month"),
  dueDate: date,
  lateFeeFine: amount.optional(),
  academicSessionId: id.optional(),
  sectionId: id.optional(),
  studentIds: z
    .array(id)
    .min(1)
    .max(5000)
    .refine((v) => new Set(v).size === v.length, "Choose unique students.")
    .optional(),
});
export const CollectPaymentSchema = z.object({
  requestId: z.string().uuid().optional(),
  transactionReference: z.string().trim().max(160).optional(),
  challanId: id,
  amountPKR: positive,
  paymentMethod: z.enum(["Cash", "Bank Transfer", "Online", "Cheque", "Other"]),
});
export const VoidReasonSchema = z.object({ reason: text("Reason", 3) });
export const ExpenseSchema = z.object({
  title: text("Expense title"),
  category: z.enum([
    "Salary",
    "Rent",
    "Electricity",
    "Stationery",
    "Maintenance",
    "Transport",
    "Other",
  ]),
  amountPKR: positive,
  expenseDate: date.optional(),
  description: z.string().optional(),
  paymentMethod: z.enum(["Cash", "Bank Transfer", "Cheque", "Online", "Other"]),
  receiptRef: z.string().optional(),
});

export const ExamScheduleSchema = z
  .object({
    title: text("Exam title"),
    term: z.enum(["MID_TERM", "FINAL_TERM"]).optional(),
    academicSessionId: z.string().optional(),
    academicSessionName: z.string().optional(),
    classes: z.array(z.string()).min(1, "Select at least one class."),
    subjects: z.array(z.string()).optional(),
    startDate: date,
    endDate: date,
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });
export const MarksEntrySchema = z
  .object({
    examId: id,
    classId: id,
    subjectId: id,
    subjectName: text("Subject name"),
    maxMarks: positive,
    passingMarks: amount.optional(),
    records: z
      .array(
        z.object({
          studentId: id,
          studentName: text("Student name"),
          rollNumber: text("Roll number"),
          obtainedMarks: amount.optional(),
          isAbsent: z.boolean().optional(),
          remarks: z.string().optional(),
        }),
      )
      .min(1, "Add at least one student's marks."),
  })
  .superRefine((value, ctx) => {
    if ((value.passingMarks ?? 0) > value.maxMarks)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passingMarks"],
        message: "Passing marks cannot exceed maximum marks.",
      });
    value.records.forEach((record, index) => {
      if (!record.isAbsent && record.obtainedMarks === undefined)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["records", index, "obtainedMarks"],
          message: "Enter marks or mark the student absent.",
        });
      if (
        record.obtainedMarks !== undefined &&
        record.obtainedMarks > value.maxMarks
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["records", index, "obtainedMarks"],
          message: "Obtained marks cannot exceed maximum marks.",
        });
    });
  });
export const GradingScaleSchema = z.object({
  rules: z
    .array(
      z.object({
        grade: text("Grade"),
        minPercentage: z.coerce.number().min(0).max(100),
        maxPercentage: z.coerce.number().min(0).max(100),
        gradePoint: amount.optional(),
        remarks: z.string().optional(),
      }),
    )
    .min(1, "Add at least one grading rule."),
});
export const ProcessResultsSchema = z.object({ examId: id, classId: id });
export const PublishResultsSchema = ProcessResultsSchema.extend({
  publish: z.boolean(),
});
export const CertificateSchema = z.object({
  type: z.enum(["BONAFIDE", "CHARACTER", "LEAVING", "TRANSFER", "RESULT"]),
  studentId: id,
  classId: id.optional(),
  studentName: z.string().trim().optional(),
  rollNumber: z.string().trim().optional(),
  admissionNumber: z.string().optional(),
  className: z.string().trim().optional(),
  session: z.string().trim().optional(),
  issueDate: date.optional(),
  reason: z.string().optional(),
  conductRemarks: z.string().optional(),
});
export const AnnouncementSchema = z.object({
  title: text("Announcement title", 3),
  content: text("Announcement message", 3),
  category: z
    .enum(["General", "Academic", "Examination", "Holiday", "Urgent"])
    .optional(),
  targetRoles: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
});
export const AcademicSessionSchema = z
  .object({
    name: text("Academic session name"),
    startDate: date,
    endDate: date,
    isCurrent: z.boolean().optional(),
  })
  .refine((value) => value.endDate > value.startDate, {
    message: "End date must be after the start date.",
    path: ["endDate"],
  });
export const TeacherAdminCreateSchema = z.object({
  name: text("Teacher name", 2),
  email: z.string().email(),
  password: z.string().min(8),
  qualification: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  department: z.string().trim().min(2).max(100).optional(),
  joiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  salary: z.number().finite().min(0).max(1e9).optional(),
  classAssignments: z
    .array(z.object({ academicSessionId: id, classId: id, sectionId: id }))
    .optional(),
  assignments: z
    .array(
      z.object({
        academicSessionId: id,
        classId: id,
        sectionId: id,
        subjectId: id,
      }),
    )
    .default([]),
});
export const TeacherAdminUpdateSchema = TeacherAdminCreateSchema.omit({
  email: true,
  password: true,
})
  .partial()
  .extend({ assignments: TeacherAdminCreateSchema.shape.assignments.unwrap().optional(), status: z.enum(["ACTIVE", "INACTIVE", "DEACTIVATED"]).optional() })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one teacher field to update.",
  );
export const BrandingSchema = z
  .object({
    name: text("School name", 3).optional(),
    phone: z
      .string()
      .min(7, "Enter a valid phone number.")
      .max(25, "Phone number is too long.")
      .optional(),
    address: text("Address", 5).optional(),
    domain: z.string().optional(),
    currency: z.enum(["PKR"]).optional(),
    dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional(),
    bankDetails: z
      .object({
        bankName: z.string().optional(),
        accountTitle: z.string().optional(),
        accountNumber: z.string().optional(),
        iban: z.string().max(50).optional(),
        branch: z.string().max(150).optional(),
        instructions: z.string().max(2000).optional(),
        enabled: z.boolean().optional(),
      })
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Provide at least one setting to update.",
  );
export const TimetableSlotSchema = z
  .object({
    academicSessionId: id.optional(),
    classId: id,
    sectionId: id.optional(),
    dayOfWeek: z.enum([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]),
    periodNumber: z.coerce.number().int().positive(),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid start time."),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid end time."),
    subjectId: id,
    subjectName: text("Subject name"),
    teacherId: id.optional(),
    teacherName: z.string().optional(),
    roomNumber: z.string().optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });
export const LeaveRequestSchema = z
  .object({
    leaveType: z.enum(["Casual", "Sick", "Earned", "Maternity", "Unpaid"]),
    startDate: date,
    endDate: date,
    reason: text("Reason", 3),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });
export const LeaveReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});
export const TeacherMarksSchema = z.object({
  examId: id,
  classId: id,
  subjectId: id,
  marksRecords: z
    .array(
      z
        .object({
          studentId: id,
          obtainedMarks: amount.optional(),
          isAbsent: z.boolean().optional(),
          remarks: z.string().optional(),
        })
        .refine(
          (r) => r.isAbsent || r.obtainedMarks !== undefined,
          "Enter marks or mark the student absent.",
        ),
    )
    .min(1, "Add at least one student's marks."),
});
