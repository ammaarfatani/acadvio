import { feeMonthVariants } from "../../lib/fee-math";
import { Student } from "../models/student.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
import { FeeChallan, FeePayment, Expense } from "../models/fee.model";
import { documentSettings } from "../services/schoolDocument.service";
import { SchoolService } from "../services/school.service";
import { FinanceService } from "../services/finance.service";
import { z } from "zod";
import { FeeSubmission } from "../models/feeSubmission.model";
import { reviewFee } from "../services/feeSubmission.service";
import { sendSuccess } from "../utils/response.util";
import { Router } from "express";
import { FinanceController } from "../controllers/finance.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import {
  requireUserType,
  requirePermission,
} from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import {
  FeeStructureSchema,
  CollectPaymentSchema,
  VoidReasonSchema,
  FeeBatchSchema,
  ExpenseSchema,
} from "../validators/domain.validator";

const router = Router();

// Protect all finance routes with authentication and strict tenant enforcement
router.use(authenticate, enforceSchoolTenant);

// Restricted to FINANCE, SCHOOL_ADMIN, and SUPER_ADMIN
const allowedRoles = [
  UserType.FINANCE,
  UserType.SCHOOL_ADMIN,
  UserType.SUPER_ADMIN,
];

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
router.get(
  "/payment-requests",
  requireUserType(UserType.FINANCE, UserType.SCHOOL_ADMIN),
  requirePermission("fees.view"),
  async (req, res, next) => {
    try {
      return sendSuccess(
        res,
        await FeeSubmission.find({ schoolId: req.user!.schoolId })
          .populate("studentId", "name className rollNumber")
          .populate("parentId", "name email")
          .populate("challanId", "challanNumber remainingAmountPKR")
          .sort({ submittedAt: -1 })
          .limit(200)
          .lean(),
      );
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/payment-requests/:id/proof",
  requireUserType(UserType.FINANCE, UserType.SCHOOL_ADMIN),
  requirePermission("fees.view"),
  async (req, res, next) => {
    try {
      const row = await FeeSubmission.findOne({
        _id: objectId.parse(req.params.id),
        schoolId: req.user!.schoolId,
      }).select("+screenshot");
      if (!row)
        throw { statusCode: 404, message: "Payment request not found." };
      res.set({
        "Content-Type": row.screenshotMime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return res.send(row.screenshot);
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/payment-requests/:id/review",
  requireUserType(UserType.FINANCE, UserType.SCHOOL_ADMIN),
  requirePermission("fees.collect"),
  async (req, res, next) => {
    try {
      const { tenantSchoolId, ...body } = req.body;
      const input = z
        .object({
          status: z.enum(["APPROVED", "REJECTED"]),
          reason: z.string().trim().max(1000).optional(),
        })
        .strict()
        .parse(body);
      return sendSuccess(
        res,
        await reviewFee(
          req.user!,
          objectId.parse(req.params.id),
          input.status,
          input.reason,
        ),
        "Payment reviewed.",
      );
    } catch (e) {
      next(e);
    }
  },
);

// Dashboard & Metrics
router.get(
  "/dashboard",
  requireUserType(...allowedRoles),
  FinanceController.getDashboard,
);
router.get(
  "/classes",
  requireUserType(...allowedRoles),
  FinanceController.getClasses,
);

// Fee Structures
router.get(
  "/structures",
  requireUserType(...allowedRoles),
  FinanceController.getFeeStructures,
);
router.post(
  "/structures",
  requireUserType(...allowedRoles),
  validate(FeeStructureSchema),
  FinanceController.createFeeStructure,
);

router.get(
  "/challan-candidates",
  requireUserType(UserType.FINANCE, UserType.SCHOOL_ADMIN),
  requirePermission("fees.view"),
  async (req, res, next) => {
    try {
      const q = z
          .object({
            classId: objectId,
            academicSessionId: objectId,
            sectionId: objectId.optional(),
            after: objectId.optional(),
            month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          })
          .strict()
          .parse(req.query),
        schoolId = req.user!.schoolId;
      const session: any = await AcademicSession.findOne({
        _id: q.academicSessionId,
        schoolId,
      })
        .select("name")
        .lean();
      if (!session || !(await ClassModel.exists({ _id: q.classId, schoolId })))
        throw {
          statusCode: 400,
          message: "Choose an authorized class/session.",
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
      const rows: any[] = await Student.find({
        schoolId,
        classId: q.classId,
        academicSessionId: q.academicSessionId,
        status: "ACTIVE",
        ...(q.sectionId ? { sectionId: q.sectionId } : {}),
        ...(q.after ? { _id: { $gt: q.after } } : {}),
      })
        .select(
          "name studentId admissionNumber rollNumber className sectionName photoUrl updatedAt",
        )
        .sort({ _id: 1 })
        .limit(101)
        .lean();
      const students = rows.slice(0, 100),
        ids = students.map((s) => s._id);
      const challans = await FeeChallan.find({
        schoolId,
        studentId: { $in: ids },
        academicSession: session.name,
        month: { $in: feeMonthVariants(q.month) },
        isVoided: { $ne: true },
        status: { $ne: "VOIDED" },
      })
        .sort({ createdAt: 1 })
        .lean();
      if (
        new Set(challans.map((c) => String(c.studentId))).size !==
        challans.length
      )
        throw {
          statusCode: 409,
          message:
            "Duplicate active invoices exist for this period. Review them before printing.",
        };
      res.set("Cache-Control", "private, no-store");
      return sendSuccess(res, {
        students,
        challans,
        next:
          rows.length > 100 ? String(students[students.length - 1]._id) : null,
      });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/report-data",
  requireUserType(UserType.SCHOOL_ADMIN, UserType.FINANCE),
  requirePermission("fees.view"),
  async (req, res, next) => {
    try {
      const q = z
          .object({ sessionId: objectId.optional() })
          .strict()
          .parse(req.query),
        schoolId = req.user!.schoolId;
      const session: any = q.sessionId
        ? await AcademicSession.findOne({ _id: q.sessionId, schoolId }).lean()
        : null;
      if (q.sessionId && !session)
        throw {
          statusCode: 400,
          message: "Choose an authorized academic session.",
        };
      const challans: any[] = await FeeChallan.find({
        schoolId,
        isVoided: { $ne: true },
        status: { $ne: "VOIDED" },
        ...(session ? { academicSession: session.name } : {}),
      })
        .limit(10001)
        .lean();
      const [payments, expenses] = await Promise.all([
        FeePayment.find({
          schoolId,
          ...(session
            ? { challanId: { $in: challans.map((c) => c._id) } }
            : {}),
        })
          .select(
            "studentName className amountPKR paidAt receiptNumber challanId paymentMethod",
          )
          .limit(10001)
          .lean(),
        Expense.find({
          schoolId,
          isVoided: { $ne: true },
          ...(session?.startDate && session?.endDate
            ? {
                expenseDate: { $gte: session.startDate, $lte: session.endDate },
              }
            : {}),
        })
          .limit(10001)
          .lean(),
      ]);
      if ([challans, payments, expenses].some((a) => a.length > 10000))
        throw {
          statusCode: 413,
          message:
            "This finance export exceeds 10,000 records; use filtered Reports & Data Export.",
        };
      res.set("Cache-Control", "private, no-store");
      return sendSuccess(res, {
        challans,
        payments,
        expenses,
        expenseScope:
          session?.startDate && session?.endDate
            ? "Academic session dates"
            : "All recorded dates",
      });
    } catch (e) {
      next(e);
    }
  },
);
// Read-only, cursor-paginated official ledger printing; never issues fees or payments.
router.get(
  "/ledger-print/options",
  requireUserType(UserType.FINANCE, UserType.SCHOOL_ADMIN),
  requirePermission("fees.view"),
  async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const [classes, sections, sessions] = await Promise.all([
        ClassModel.find({ schoolId })
          .select("name")
          .sort({ numericLevel: 1, name: 1 })
          .lean(),
        SectionModel.find({ schoolId }).select("name classId").lean(),
        AcademicSession.find({ schoolId }).select("name isCurrent").lean(),
      ]);
      return sendSuccess(res, { classes, sections, sessions });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/ledger-print",
  requireUserType(UserType.FINANCE, UserType.SCHOOL_ADMIN),
  requirePermission("fees.view"),
  async (req, res, next) => {
    try {
      const q = z
        .object({
          classId: objectId,
          academicSessionId: objectId,
          sectionId: objectId.optional(),
          studentId: objectId.optional(),
          after: objectId.optional(),
          month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        })
        .strict()
        .parse(req.query);
      const schoolId = req.user!.schoolId;
      const [klass, session, config, school]: any[] = await Promise.all([
        ClassModel.findOne({ _id: q.classId, schoolId }).lean(),
        AcademicSession.findOne({ _id: q.academicSessionId, schoolId }).lean(),
        documentSettings(schoolId!),
        SchoolService.getSchoolProfile(schoolId!),
      ]);
      if (!klass || !session)
        throw {
          statusCode: 400,
          message: "Choose an authorized class and academic session.",
        };
      if (
        q.sectionId &&
        !(await SectionModel.exists({
          _id: q.sectionId,
          classId: q.classId,
          schoolId,
        }))
      )
        throw {
          statusCode: 400,
          message: "Section does not belong to this class.",
        };
      const students: any[] = await Student.find({
        schoolId,
        classId: q.classId,
        academicSessionId: q.academicSessionId,
        ...(q.sectionId ? { sectionId: q.sectionId } : {}),
        ...(q.studentId
          ? { _id: q.studentId }
          : q.after
            ? { _id: { $gt: q.after } }
            : {}),
      })
        .select(
          "name admissionNumber studentId rollNumber className sectionName academicSessionName photoUrl updatedAt",
        )
        .sort({ _id: 1 })
        .limit(101)
        .lean();
      const more = students.length > 100,
        batch = students.slice(0, 100),
        ids = batch.map((s) => s._id);
      const [challans, payments] = await Promise.all([
        FeeChallan.find({
          schoolId,
          studentId: { $in: ids },
          academicSession: session.name,
          month: { $in: feeMonthVariants(q.month) },
        })
          .sort({ createdAt: 1 })
          .lean(),
        FeePayment.find({ schoolId, studentId: { $in: ids } })
          .select(
            "studentId challanId amountPKR paidAt receiptNumber paymentMethod",
          )
          .sort({ paidAt: 1 })
          .lean(),
      ]);
      const documents = batch.map((student) => ({
        type: "fee-statement",
        style: config.templates["fee-statement"],
        school: {
          name: school.name,
          logoUrl: school.logoUrl,
          address: school.address,
          phone: school.phone,
          email: school.email,
          ...config.branding,
        },
        student,
        ledger: FinanceService.ledgerData(
          student,
          challans.filter((c) => String(c.studentId) === String(student._id)),
          payments.filter((p) => String(p.studentId) === String(student._id)),
          { month: q.month, academicSession: session.name },
        ),
      }));
      res.set("Cache-Control", "private, no-store");
      return sendSuccess(res, {
        documents,
        next: more ? String(batch[batch.length - 1]._id) : null,
      });
    } catch (e) {
      next(e);
    }
  },
);

// Student Fee Account Ledger
router.get(
  "/challans",
  requireUserType(...allowedRoles),
  FinanceController.getChallans,
);
router.get(
  "/receipts/:challanId",
  requireUserType(...allowedRoles),
  FinanceController.getReceipt,
);
router.get(
  "/ledger/:studentId",
  requireUserType(...allowedRoles),
  requirePermission("fees.view"),
  FinanceController.getStudentLedger,
);

router.get(
  "/payments/:id/receipt",
  requireUserType(...allowedRoles),
  requirePermission("fees.view"),
  async (req, res, next) => {
    try {
      return sendSuccess(
        res,
        await FinanceService.getReceiptById(
          req.user!.schoolId!,
          objectId.parse(req.params.id),
        ),
        "Payment receipt retrieved.",
      );
    } catch (error) {
      next(error);
    }
  },
);

// Payments & Receipts
router.post(
  "/collect-payment",
  requireUserType(...allowedRoles),
  requirePermission("fees.collect"),
  validate(CollectPaymentSchema),
  FinanceController.collectPayment,
);
router.post(
  "/challans/:challanId/void",
  requireUserType(...allowedRoles),
  requirePermission("fees.delete"),
  validate(VoidReasonSchema),
  FinanceController.voidChallan,
);

// Bulk Challan Generation
router.post(
  "/generate-batch",
  requireUserType(...allowedRoles),
  requirePermission("fees.update"),
  validate(FeeBatchSchema),
  FinanceController.generateBulkChallans,
);

// Expenses
router.get(
  "/expenses",
  requireUserType(...allowedRoles),
  FinanceController.getExpenses,
);
router.post(
  "/expenses",
  requireUserType(...allowedRoles),
  validate(ExpenseSchema),
  FinanceController.createExpense,
);
router.post(
  "/expenses/:expenseId/void",
  requireUserType(...allowedRoles),
  requirePermission("fees.delete"),
  validate(VoidReasonSchema),
  FinanceController.voidExpense,
);

export default router;
