import { ExamService } from "../services/exam.service";
import { date } from "../validators/workforce.validator";
import { User } from "../models/user.model";
import { annualMarksheet } from "../services/marksheet.service";
import { AssessmentPolicy } from "../models/assessmentPolicy.model";
import { ExamSchedule } from "../models/exam.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { Student } from "../models/student.model";
import { ProcessedResult } from "../models/exam.model";
import { AuditLog } from "../models/auditLog.model";
import { calculateAssessment } from "../services/assessmentMath";
import {
  marksheetPdf,
  bulkMarksheetPdf,
} from "../services/marksheetPdf.service";
import { z } from "zod";
import {
  examTimetable,
  saveExamTimetable,
} from "../services/examTimetable.service";
import { sendSuccess } from "../utils/response.util";
import { Router } from "express";
import { ExamController } from "../controllers/exam.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import {
  requireUserType,
  requirePermission,
} from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import {
  ExamScheduleSchema,
  GradingScaleSchema,
  MarksEntrySchema,
  ProcessResultsSchema,
  PublishResultsSchema,
  CertificateSchema,
} from "../validators/domain.validator";

const router = Router();

// Protect all exam routes with authentication and strict tenant enforcement
router.use(authenticate, enforceSchoolTenant);

// Restricted to EXAM_STAFF, TEACHER, SCHOOL_ADMIN, and SUPER_ADMIN
const allowedRoles = [
  UserType.EXAM_STAFF,
  UserType.SCHOOL_ADMIN,
  UserType.SUPER_ADMIN,
];

// Dashboard Metrics
router.get(
  "/dashboard",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getDashboard,
);

// Exam Schedules
router.get(
  "/schedules",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getExams,
);
router.post(
  "/schedules",
  requireUserType(
    UserType.EXAM_STAFF,
    UserType.SCHOOL_ADMIN,
    UserType.SUPER_ADMIN,
  ),
  requirePermission("exams.manage"),
  validate(ExamScheduleSchema),
  ExamController.createExam,
);

// Lookups for Dropdowns & Candidate Management
router.get(
  "/classes",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getClasses,
);
router.get(
  "/sections",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getSections,
);
router.get(
  "/subjects",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getSubjects,
);
router.get(
  "/sessions",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getSessions,
);
router.get(
  "/students",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getStudents,
);

router.get(
  "/teachers",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  async (req, res, next) => {
    try {
      return sendSuccess(
        res,
        await User.find({
          schoolId: req.user!.schoolId,
          userType: "TEACHER",
          status: "ACTIVE",
        })
          .select("name")
          .sort({ name: 1 })
          .lean(),
      );
    } catch (e) {
      next(e);
    }
  },
);
// Configurable Grading Scale
router.get(
  "/grading-scale",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  ExamController.getGradingScale,
);
router.put(
  "/grading-scale",
  requireUserType(
    UserType.EXAM_STAFF,
    UserType.SCHOOL_ADMIN,
    UserType.SUPER_ADMIN,
  ),
  requirePermission("exams.manage"),
  validate(GradingScaleSchema),
  ExamController.updateGradingScale,
);

// Marks Entry & Lookup
router.get(
  "/marks",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  ExamController.getMarks,
);
router.post(
  "/marks",
  requireUserType(...allowedRoles),
  requirePermission("results.enter"),
  validate(MarksEntrySchema),
  ExamController.saveMarksEntry,
);

// Result Processing & Publishing
router.get(
  "/results",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  ExamController.getResults,
);
router.post(
  "/process",
  requireUserType(
    UserType.EXAM_STAFF,
    UserType.SCHOOL_ADMIN,
    UserType.SUPER_ADMIN,
  ),
  requirePermission("exams.manage"),
  validate(ProcessResultsSchema),
  ExamController.processResults,
);
router.post(
  "/publish",
  requireUserType(
    UserType.EXAM_STAFF,
    UserType.SCHOOL_ADMIN,
    UserType.SUPER_ADMIN,
  ),
  requirePermission("results.publish"),
  validate(PublishResultsSchema),
  ExamController.publishResults,
);

// Reports & Analytics
router.get(
  "/reports/tabulation",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  ExamController.getTabulationSheet,
);
router.get(
  "/reports/analytics",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  ExamController.getAnalytics,
);

// Certificates
router.get(
  "/certificates",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  ExamController.getCertificates,
);
router.post(
  "/certificates",
  requireUserType(
    UserType.EXAM_STAFF,
    UserType.SCHOOL_ADMIN,
    UserType.SUPER_ADMIN,
  ),
  requirePermission("results.publish"),
  validate(CertificateSchema),
  ExamController.issueCertificate,
);

router.post(
  "/certificates/bulk-issue",
  requireUserType(...allowedRoles),
  requirePermission("results.publish"),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          classId: z.string().regex(/^[a-f0-9]{24}$/i),
          studentIds: z
            .array(z.string().regex(/^[a-f0-9]{24}$/i))
            .min(1)
            .max(500)
            .refine((v) => new Set(v).size === v.length)
            .optional(),
          type: z.enum([
            "BONAFIDE",
            "CHARACTER",
            "LEAVING",
            "TRANSFER",
            "RESULT",
          ]),
          reason: z.string().trim().max(1000).optional(),
          conductRemarks: z.string().trim().max(1000).optional(),
          requestId: z.string().uuid(),
          onlyIfMissing: z.boolean().optional(),
        })
        .strict()
        .parse(req.body);
      const certificates = await ExamService.issueClassCertificates(
        req.user!.schoolId!,
        input,
        req.user!.email || "Exam Officer",
      );
      res.set("Cache-Control", "private, no-store");
      return sendSuccess(
        res,
        { certificates, count: certificates.length },
        "Certificates issued successfully.",
        201,
      );
    } catch (error) {
      next(error);
    }
  },
);

const objectId = z.string().regex(/^[a-f0-9]{24}$/i),
  clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
router.get(
  "/timetable",
  requireUserType(...allowedRoles),
  requirePermission("exams.view"),
  async (req, res, next) => {
    try {
      return sendSuccess(
        res,
        await examTimetable(
          req.user!.schoolId!,
          req.query.examId ? objectId.parse(req.query.examId) : undefined,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/timetable",
  requireUserType(...allowedRoles),
  requirePermission("exams.manage"),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          examId: objectId,
          classId: objectId,
          sectionId: objectId,
          subjectId: objectId,
          supervisorId: objectId.optional(),
          date,
          startTime: clock,
          endTime: clock,
          room: z.string().trim().max(80).optional(),
        })
        .strict()
        .refine(
          (s) => s.endTime > s.startTime,
          "End time must be after start time.",
        )
        .parse(req.body);
      return sendSuccess(
        res,
        await saveExamTimetable(req.user!.schoolId!, input),
        "Exam timetable saved.",
      );
    } catch (e) {
      next(e);
    }
  },
);
const sheetQuery = z
  .object({
    academicSessionId: objectId.optional(),
    classId: objectId.optional(),
    examId: objectId.optional(),
    view: z.enum(["ANNUAL", "EXAM"]).optional(),
    expectedHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();
router.get(
  "/marksheet-candidates",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  async (req, res, next) => {
    try {
      const input = z
          .object({
            academicSessionId: objectId,
            classId: objectId,
            sectionId: objectId.optional(),
            search: z.string().max(100).default(""),
            after: objectId.optional(),
          })
          .strict()
          .parse(req.query),
        schoolId = req.user!.schoolId;
      if (
        !(await AcademicSession.exists({
          _id: input.academicSessionId,
          schoolId,
        })) ||
        !(await ClassModel.exists({ _id: input.classId, schoolId }))
      )
        throw {
          statusCode: 400,
          message: "Choose an authorized class and academic session.",
        };
      if (
        input.sectionId &&
        !(await SectionModel.exists({
          _id: input.sectionId,
          classId: input.classId,
          schoolId,
        }))
      )
        throw {
          statusCode: 400,
          message: "Section does not belong to the selected class.",
        };
      const exams = await ExamSchedule.find({
        schoolId,
        academicSessionId: input.academicSessionId,
      })
        .select("_id")
        .limit(1000)
        .lean();
      const past = await ProcessedResult.find({
        schoolId,
        classId: input.classId,
        examId: { $in: exams.map((e) => e._id) },
      })
        .select("studentId")
        .limit(5001)
        .lean();
      if (past.length > 5000)
        throw {
          statusCode: 413,
          message: "Narrow the class/session selection.",
        };
      const escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        students = await Student.find({
          schoolId,
          ...(input.after ? { _id: { $gt: input.after } } : {}),
          $and: [
            {
              $or: [
                {
                  classId: input.classId,
                  academicSessionId: input.academicSessionId,
                },
                { _id: { $in: past.map((r) => r.studentId) } },
              ],
            },
            ...(escaped
              ? [
                  {
                    $or: ["name", "studentId", "rollNumber"].map((f) => ({
                      [f]: { $regex: escaped, $options: "i" },
                    })),
                  },
                ]
              : []),
          ],
          ...(input.sectionId ? { sectionId: input.sectionId } : {}),
        })
          .select("name studentId rollNumber sectionName")
          .sort({ _id: 1 })
          .limit(51)
          .lean();
      return sendSuccess(res, {
        students: students.slice(0, 50),
        hasMore: students.length > 50,
        next: students.length > 50 ? String(students[49]._id) : null,
      });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/marksheets/bulk-preview",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  async (req, res, next) => {
    try {
      const q = z
        .object({
          studentIds: z
            .array(objectId)
            .min(1)
            .max(20)
            .refine((v) => new Set(v).size === v.length),
          query: sheetQuery,
        })
        .strict()
        .parse(req.body);
      const documents = [];
      for (const id of q.studentIds)
        documents.push(
          await annualMarksheet(req.user!.schoolId!, id, false, q.query),
        );
      res.set("Cache-Control", "private, no-store");
      return sendSuccess(res, { documents });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/marksheets/bulk-pdf",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  async (req, res, next) => {
    try {
      const q = z
        .object({
          studentIds: z
            .array(objectId)
            .min(1)
            .max(500)
            .refine((v) => new Set(v).size === v.length),
          query: sheetQuery,
          sourceHashes: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).optional(),
        })
        .strict()
        .parse(req.body);
      const documents = [];
      for (const id of q.studentIds) {
        const data = await annualMarksheet(
          req.user!.schoolId!,
          id,
          false,
          q.query,
        );
        if (q.sourceHashes?.[id] && q.sourceHashes[id] !== data.sourceHash)
          throw {
            statusCode: 409,
            message:
              "Results changed. Prepare class marksheets again before exporting.",
          };
        documents.push(data);
      }
      const pdf = await bulkMarksheetPdf(documents);
      res.set("Cache-Control", "private, no-store");
      res.type("application/pdf");
      res.set(
        "Content-Disposition",
        'attachment; filename="class-marksheets.pdf"',
      );
      return res.send(pdf);
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/marksheet/:studentId",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  async (req, res, next) => {
    try {
      return sendSuccess(
        res,
        await annualMarksheet(
          req.user!.schoolId!,
          objectId.parse(req.params.studentId),
          false,
          sheetQuery.parse(req.query),
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/marksheet/:studentId/pdf",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  async (req, res, next) => {
    try {
      const studentId = objectId.parse(req.params.studentId),
        query = sheetQuery.parse(req.query),
        data = await annualMarksheet(
          req.user!.schoolId!,
          studentId,
          false,
          query,
        );
      if (query.expectedHash && query.expectedHash !== data.sourceHash)
        throw {
          statusCode: 409,
          message:
            "Marks, grading or assessment policy changed. Reload the preview before downloading.",
        };
      res.set({
        "Cache-Control": "private, no-store",
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="marksheet_${studentId}_${new Date().toISOString().slice(0, 10)}.pdf"`,
      });
      return res.send(await marksheetPdf(data));
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/assessment-policy",
  requireUserType(...allowedRoles),
  requirePermission("results.view"),
  async (req, res, next) => {
    try {
      const input = z
        .object({ academicSessionId: objectId, classId: objectId })
        .strict()
        .parse(req.query);
      return sendSuccess(
        res,
        await AssessmentPolicy.findOne({
          schoolId: req.user!.schoolId,
          ...input,
        }).lean(),
      );
    } catch (e) {
      next(e);
    }
  },
);
router.put(
  "/assessment-policy",
  requireUserType(UserType.SCHOOL_ADMIN, UserType.EXAM_STAFF),
  requirePermission("exams.manage"),
  async (req, res, next) => {
    try {
      const input = z
          .object({
            academicSessionId: objectId,
            classId: objectId,
            method: z.enum(["WEIGHTED", "CUMULATIVE", "FINAL_ONLY"]),
            components: z
              .array(
                z
                  .object({
                    examId: objectId,
                    weight: z.number().positive().max(100).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(12),
            absence: z.enum(["ZERO_FAIL", "INCOMPLETE"]),
            revision: z.number().int().min(0),
          })
          .strict()
          .parse(req.body),
        schoolId = req.user!.schoolId!;
      if (
        !(await AcademicSession.exists({
          _id: input.academicSessionId,
          schoolId,
        })) ||
        !(await ClassModel.exists({ _id: input.classId, schoolId }))
      )
        throw {
          statusCode: 404,
          message: "Class or academic session not found.",
        };
      const exams = await ExamSchedule.find({
        schoolId,
        academicSessionId: input.academicSessionId,
        _id: { $in: input.components.map((c) => c.examId) },
        classes: {
          $in: [
            input.classId,
            (
              (await ClassModel.findById(input.classId)
                .select("name")
                .lean()) as any
            )?.name,
          ],
        },
      }).lean();
      if (
        exams.length !== input.components.length ||
        (input.method === "FINAL_ONLY" && exams[0]?.term !== "FINAL_TERM")
      )
        throw {
          statusCode: 400,
          message:
            "Select distinct assessments from this class/session. Final-only requires a final-term examination.",
        };
      calculateAssessment({ ...input, requireAllSubjects: true }, [], [], []);
      const old: any = await AssessmentPolicy.findOne({
        schoolId,
        academicSessionId: input.academicSessionId,
        classId: input.classId,
      });
      if ((old?.revision || 0) !== input.revision)
        throw {
          statusCode: 409,
          message: "Assessment policy changed. Reload before saving.",
        };
      const { revision, ...values } = input;
      const policy = await AssessmentPolicy.findOneAndUpdate(
        {
          schoolId,
          academicSessionId: input.academicSessionId,
          classId: input.classId,
          ...(old ? { revision } : {}),
        },
        {
          $set: {
            ...values,
            updatedBy: req.user!.userId,
            requireAllSubjects: true,
          },
          $inc: { revision: 1 },
        },
        { upsert: !old, new: true, runValidators: true },
      );
      if (!policy)
        throw {
          statusCode: 409,
          message: "Assessment policy changed. Reload before saving.",
        };
      await AuditLog.create({
        schoolId,
        actorUserId: req.user!.userId,
        actorEmail: req.user!.email,
        actorRole: req.user!.userType,
        action: "ASSESSMENT_POLICY_UPDATED",
        resource: "AssessmentPolicy",
        entityId: String(policy._id),
        details: JSON.stringify({
          method: input.method,
          revision: policy.revision,
          examIds: input.components.map((c) => c.examId),
        }),
      });
      return sendSuccess(
        res,
        policy,
        "Assessment policy saved. Historical examination marks were preserved.",
      );
    } catch (e) {
      next(e);
    }
  },
);
export default router;
