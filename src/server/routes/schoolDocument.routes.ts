import { SchoolService } from "../services/school.service";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
import mongoose from "mongoose";
import { withoutBranchScope } from "../utils/branchScope";
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import {
  requireExactUserType,
  requirePermission,
} from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { School } from "../models/school.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { ExamSchedule, CertificateRecord } from "../models/exam.model";
import { FeePayment } from "../models/fee.model";
import { IssuedSchoolDocument } from "../models/issuedSchoolDocument.model";
import { AuditLog } from "../models/auditLog.model";
import {
  documentSettings,
  documentData,
  hydrateDocumentPhoto,
  issueDocument,
  documentPermission,
  documentIssuePermission,
  checkDocumentRole,
} from "../services/schoolDocument.service";
import { validateStudentPhoto } from "../services/studentPhoto.service";
import { DOCUMENT_TYPES } from "../../lib/document-templates";
import { sendSuccess } from "../utils/response.util";
const router = Router();
router.use(authenticate, enforceSchoolTenant);
router.get(
  "/style",
  requireExactUserType(
    UserType.SCHOOL_ADMIN,
    UserType.FINANCE,
    UserType.EXAM_STAFF,
    UserType.RECEPTIONIST,
    UserType.PARENT,
    UserType.TEACHER,
  ),
  async (req, res, next) => {
    try {
      const t = z.enum(DOCUMENT_TYPES).parse(req.query.type);
      return requirePermission(
        req.user!.userType === "PARENT"
          ? "children.view"
          : documentPermission(t),
      )(req, res, async () => {
        try {
          const config = await documentSettings(req.user!.schoolId!);
          return sendSuccess(res, {
            style: config.templates[t],
            branding: config.branding,
          });
        } catch (e) {
          next(e);
        }
      });
    } catch (e) {
      next(e);
    }
  },
);
router.use(
  requireExactUserType(
    UserType.SCHOOL_ADMIN,
    UserType.FINANCE,
    UserType.EXAM_STAFF,
    UserType.RECEPTIONIST,
  ),
);
const id = z.string().regex(/^[a-f0-9]{24}$/i);
const type = z.enum(DOCUMENT_TYPES);
const input = z
  .object({
    type,
    studentId: id.optional(),
    staffId: id.optional(),
    examId: id.optional(),
    paymentId: id.optional(),
    certificateId: id.optional(),
    certificatePurpose: z
      .enum(["general", "achievement", "participation", "appreciation"])
      .optional(),
    statement: z.string().trim().max(4000).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) =>
          !Number.isNaN(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v,
        "Enter a valid calendar date.",
      )
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) =>
          !Number.isNaN(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v,
        "Enter a valid calendar date.",
      )
      .optional(),
    requestId: z.string().uuid().optional(),
  })
  .strict();
router.get(
  "/settings",
  requireExactUserType(UserType.SCHOOL_ADMIN),
  requirePermission("settings.view"),
  async (req, res, next) => {
    try {
      return sendSuccess(res, await documentSettings(req.user!.schoolId!));
    } catch (e) {
      next(e);
    }
  },
);
router.put(
  "/settings",
  requireExactUserType(UserType.SCHOOL_ADMIN),
  requirePermission("settings.update"),
  async (req, res, next) => {
    try {
      if (
        !req.user!.isOrganizationOwner &&
        req.user!.branchId !== req.user!.schoolId
      )
        throw {
          statusCode: 403,
          message:
            "Only the organization owner or main school administrator can change school-wide document styles.",
        };
      const style = z
        .object({
          pageSize: z.enum(["A4", "A5", "Letter"]).optional(),
          photoWidth: z.number().min(15).max(60).optional(),
          photoHeight: z.number().min(15).max(70).optional(),
          photoAlign: z.enum(["left", "right"]).optional(),
          signatureWidth: z.number().min(15).max(60).optional(),
          signatureHeight: z.number().min(8).max(30).optional(),
          stampSize: z.number().min(10).max(35).optional(),
          family: z.enum(["modern", "classic", "institutional"]),
          color: z.string().regex(/^#[a-f0-9]{6}$/i),
          font: z.enum(["sans", "serif"]),
          margin: z.number().int().min(8).max(24),
          orientation: z.enum(["portrait", "landscape"]),
          showPhoto: z.boolean(),
          showMedical: z.boolean(),
          showDeclaration: z.boolean(),
          showSignatures: z.boolean(),
          spacing: z.enum(["compact", "comfortable"]),
          footer: z.string().max(300),
          signatureLabels: z.array(z.string().max(80)).min(1).max(3),
          sectionOrder: z
            .array(z.enum(["student", "parents", "addresses", "medical"]))
            .length(4)
            .refine((v) => new Set(v).size === 4),
        })
        .partial()
        .strict();
      const branding = z
        .object({
          website: z.string().url().or(z.literal("")).optional(),
          principalName: z.string().max(100).optional(),
          signatoryName: z.string().max(100).optional(),
          signatoryDesignation: z.string().max(100).optional(),
          affiliation: z.string().max(200).optional(),
          signature: z.string().max(400000).optional(),
          stamp: z.string().max(400000).optional(),
          teacherSignature: z.string().max(400000).optional(),
          staffSignature: z.string().max(400000).optional(),
        })
        .strict();
      const body = z
        .object({
          revision: z.number().int().nonnegative(),
          type: type.optional(),
          style: style.optional(),
          branding: branding.optional(),
          complete: z.boolean().optional(),
        })
        .strict()
        .parse(req.body);
      if (!!body.type !== !!body.style)
        throw { statusCode: 400, message: "Select a category and its style." };
      if (body.branding)
        for (const key of [
          "signature",
          "stamp",
          "teacherSignature",
          "staffSignature",
        ] as const) {
          const value = body.branding[key];
          if (value) {
            const bytes = await validateStudentPhoto(value);
            body.branding[key] =
              "data:image/webp;base64," + bytes!.toString("base64");
          }
        }
      const changes: any = {};
      if (body.type && body.style)
        for (const [key, value] of Object.entries(body.style))
          if (value !== undefined)
            changes["documentSettings.templates." + body.type + "." + key] =
              value;
      if (body.branding)
        for (const [key, value] of Object.entries(body.branding))
          if (value !== undefined)
            changes["documentSettings.branding." + key] = value;
      if (body.complete) changes.documentSetupCompletedAt = new Date();
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const school = await School.findOneAndUpdate(
            {
              _id: req.user!.schoolId,
              $or: [
                { documentSettingsRevision: body.revision },
                ...(body.revision === 0
                  ? [{ documentSettingsRevision: { $exists: false } }]
                  : []),
              ],
            },
            { $set: changes, $inc: { documentSettingsRevision: 1 } },
            { new: true, session },
          );
          if (!school)
            throw {
              statusCode: 409,
              message: "Document settings changed. Reload before saving.",
            };
          await withoutBranchScope(() =>
            AuditLog.create(
              [
                {
                  schoolId: req.user!.schoolId,
                  organizationId: req.user!.schoolId,
                  branchId: req.user!.schoolId,
                  actorUserId: req.user!.userId,
                  actorEmail: req.user!.email,
                  actorRole: req.user!.userType,
                  action: "DOCUMENT_STYLE_UPDATED",
                  resource: "School",
                  entityId: req.user!.schoolId,
                  details: body.type
                    ? `Updated ${body.type} document settings.`
                    : "Completed document setup.",
                },
              ],
              { session },
            ),
          );
        });
      } finally {
        await session.endSession();
      }
      return sendSuccess(
        res,
        await documentSettings(req.user!.schoolId!),
        "Document settings saved.",
      );
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/choices",
  (req, res, next) => {
    try {
      checkDocumentRole(req.user!, type.parse(req.query.type || "admission"));
      return requirePermission(
        documentPermission(type.parse(req.query.type || "admission")),
      )(req, res, next);
    } catch (e) {
      next(e);
    }
  },
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId,
        t = type.parse(req.query.type || "admission");
      const [students, staff, exams, certificates, payments] =
        await Promise.all([
          !["staff-id", "experience"].includes(t)
            ? Student.find({ schoolId })
                .select("name admissionNumber className")
                .sort({ name: 1 })
                .lean()
            : [],
          ["staff-id", "experience"].includes(t)
            ? User.find({
                schoolId,
                userType: { $nin: ["PARENT", "SUPER_ADMIN"] },
              })
                .select("name userType")
                .lean()
            : [],
          t === "report-card"
            ? ExamSchedule.find({ schoolId }).select("title").lean()
            : [],
          ["character", "leaving", "bonafide", "transfer"].includes(t)
            ? CertificateRecord.find({ schoolId, type: t.toUpperCase() })
                .sort({ issueDate: -1, _id: -1 })
                .select("studentId certificateNumber type issueDate")
                .lean()
            : [],
          t === "fee-receipt"
            ? FeePayment.find({ schoolId })
                .select("studentId receiptNumber amountPKR")
                .lean()
            : [],
        ]);
      return sendSuccess(res, {
        students,
        staff,
        exams,
        certificates,
        payments,
      });
    } catch (e) {
      next(e);
    }
  },
);
router.get("/bulk-options", async (req, res, next) => {
  try {
    const t = type.parse(req.query.type);
    checkDocumentRole(req.user!, t);
    return requirePermission(documentPermission(t))(req, res, async () => {
      try {
        const schoolId = req.user!.schoolId;
        const [classes, sections, sessions] = await Promise.all([
          ClassModel.find({ schoolId }).select("name").lean(),
          SectionModel.find({ schoolId }).select("name classId").lean(),
          AcademicSession.find({ schoolId }).select("name isCurrent").lean(),
        ]);
        return sendSuccess(res, { classes, sections, sessions });
      } catch (e) {
        next(e);
      }
    });
  } catch (e) {
    next(e);
  }
});
router.post("/bulk-preview", async (req, res, next) => {
  try {
    const q = z
      .object({
        document: input.omit({
          studentId: true,
          staffId: true,
          certificateId: true,
          requestId: true,
        }),
        classId: id.optional(),
        academicSessionId: id.optional(),
        sectionId: id.optional(),
        after: id.optional(),
      })
      .strict()
      .parse(req.body);
    const t = q.document.type;
    checkDocumentRole(req.user!, t);
    if (["student-id", "staff-id", "fee-receipt"].includes(t))
      throw {
        statusCode: 400,
        message:
          "Use the existing issued ID card or recorded receipt workflow for this document.",
      };
    return requirePermission(documentPermission(t))(req, res, async () => {
      try {
        const schoolId = req.user!.schoolId,
          staff = t === "experience";
        if (
          !staff &&
          (!q.classId ||
            !q.academicSessionId ||
            !(await ClassModel.exists({ _id: q.classId, schoolId })) ||
            !(await AcademicSession.exists({
              _id: q.academicSessionId,
              schoolId,
            })))
        )
          throw {
            statusCode: 400,
            message: "Select an authorized class and academic session.",
          };
        if (
          q.sectionId &&
          !(await SectionModel.exists({
            _id: q.sectionId,
            classId: q.classId,
            schoolId,
          }))
        )
          throw { statusCode: 400, message: "Choose a valid class section." };
        const model: any = staff ? User : Student;
        const rows: any[] = await model
          .find({
            schoolId,
            ...(staff
              ? { userType: { $nin: ["PARENT", "SUPER_ADMIN"] } }
              : {
                  classId: q.classId,
                  academicSessionId: q.academicSessionId,
                  ...(q.sectionId ? { sectionId: q.sectionId } : {}),
                }),
            ...(q.after ? { _id: { $gt: q.after } } : {}),
          })
          .select("name")
          .sort({ _id: 1 })
          .limit(21)
          .lean();
        const [sharedSchool, sharedSettings] = await Promise.all([
          SchoolService.getSchoolProfile(schoolId!),
          documentSettings(schoolId!),
        ]);
        const documents = [],
          skipped = [];
        for (const person of rows.slice(0, 20)) {
          const request: any = {
            ...q.document,
            [staff ? "staffId" : "studentId"]: String(person._id),
          };
          const certTypes: any = {
            character: "CHARACTER",
            leaving: "LEAVING",
            bonafide: "BONAFIDE",
            transfer: "TRANSFER",
          };
          if (certTypes[t]) {
            const certificate = (await CertificateRecord.findOne({
              schoolId,
              studentId: person._id,
              type: certTypes[t],
            })
              .sort({ issueDate: -1, _id: -1 })
              .select("_id")
              .lean()) as any;
            if (!certificate) {
              skipped.push({
                studentId: String(person._id),
                name: person.name,
                reason: "Certificate has not been issued yet.",
              });
              continue;
            }
            request.certificateId = String(certificate._id);
          }
          try {
            documents.push(
              await hydrateDocumentPhoto(
                await documentData(req.user!, request, {
                  schoolId: schoolId!,
                  school: sharedSchool,
                  settings: sharedSettings,
                }),
              ),
            );
          } catch (e: any) {
            if (e.statusCode === 404) {
              skipped.push({
                studentId: String(person._id),
                name: person.name,
                reason: e.message,
              });
            } else throw e;
          }
        }
        res.set("Cache-Control", "private, no-store");
        return sendSuccess(res, {
          documents,
          skipped,
          next: rows.length > 20 ? String(rows[19]._id) : null,
        });
      } catch (e) {
        next(e);
      }
    });
  } catch (e) {
    next(e);
  }
});
router.post(
  "/certificates/bulk-preview",
  requirePermission("results.view"),
  async (req, res, next) => {
    try {
      const { certificateIds } = z
        .object({
          certificateIds: z
            .array(id)
            .min(1)
            .max(20)
            .refine((ids) => new Set(ids).size === ids.length),
        })
        .strict()
        .parse(req.body);
      const records = await CertificateRecord.find({
        _id: { $in: certificateIds },
        schoolId: req.user!.schoolId,
      }).lean();
      if (records.length !== certificateIds.length)
        throw {
          statusCode: 404,
          message:
            "One or more issued certificates are unavailable in this school.",
        };
      const documents = [];
      for (const certId of certificateIds) {
        const cert: any = records.find((c) => String(c._id) === certId)!;
        const type = (
          {
            BONAFIDE: "bonafide",
            CHARACTER: "character",
            LEAVING: "leaving",
            TRANSFER: "transfer",
            RESULT: "report-card",
          } as const
        )[
          cert.type as
            | "BONAFIDE"
            | "CHARACTER"
            | "LEAVING"
            | "TRANSFER"
            | "RESULT"
        ];
        documents.push(
          await hydrateDocumentPhoto(
            await documentData(req.user!, {
              type,
              studentId: String(cert.studentId),
              certificateId: certId,
            }),
          ),
        );
      }
      res.set("Cache-Control", "private, no-store");
      return sendSuccess(res, { documents });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/preview", async (req, res, next) => {
  try {
    const body = input.parse(req.body);
    return requirePermission(documentPermission(body.type))(
      req,
      res,
      async () => {
        try {
          return sendSuccess(
            res,
            await hydrateDocumentPhoto(await documentData(req.user!, body)),
          );
        } catch (e) {
          next(e);
        }
      },
    );
  } catch (e) {
    next(e);
  }
});
router.post("/issue", async (req, res, next) => {
  try {
    const body = input.extend({ requestId: z.string().uuid() }).parse(req.body);
    checkDocumentRole(req.user!, body.type);
    return requirePermission(documentIssuePermission(body.type))(
      req,
      res,
      async () => {
        try {
          return sendSuccess(
            res,
            await issueDocument(req.user!, body),
            "Document archived.",
          );
        } catch (e) {
          next(e);
        }
      },
    );
  } catch (e) {
    next(e);
  }
});
router.get(
  "/issued",
  (req, res, next) => {
    try {
      checkDocumentRole(req.user!, type.parse(req.query.type || "admission"));
      return requirePermission(
        documentPermission(type.parse(req.query.type || "admission")),
      )(req, res, next);
    } catch (e) {
      next(e);
    }
  },
  async (req, res, next) => {
    try {
      const q = z
          .string()
          .trim()
          .max(100)
          .parse(req.query.search || ""),
        t = type.parse(req.query.type || "admission");
      const rows = await IssuedSchoolDocument.find({
        "snapshot.identityCard": { $ne: true },
        schoolId: req.user!.schoolId,
        type: t,
      })
        .select(
          "type reference issuedAt studentId staffId issuedBy snapshot.student.name snapshot.staff.name",
        )
        .sort({ issuedAt: -1 })
        .limit(100)
        .lean();
      return sendSuccess(
        res,
        q
          ? rows.filter((r: any) =>
              [
                r.reference,
                r.snapshot?.student?.name,
                r.snapshot?.staff?.name,
              ].some((v) =>
                String(v || "")
                  .toLowerCase()
                  .includes(q.toLowerCase()),
              ),
            )
          : rows,
      );
    } catch (e) {
      next(e);
    }
  },
);
router.get("/issued/:id", async (req, res, next) => {
  try {
    const record: any = await IssuedSchoolDocument.findOne({
      _id: id.parse(req.params.id),
      "snapshot.identityCard": { $ne: true },
      schoolId: req.user!.schoolId,
    }).lean();
    if (!record) throw { statusCode: 404, message: "Document not found." };
    checkDocumentRole(req.user!, record.type);
    return requirePermission(documentPermission(record.type))(
      req,
      res,
      async () => {
        try {
          return sendSuccess(res, {
            ...record,
            snapshot: await hydrateDocumentPhoto(record.snapshot),
          });
        } catch (e) {
          next(e);
        }
      },
    );
  } catch (e) {
    next(e);
  }
});
export default router;
