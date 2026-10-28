import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { sendSuccess, sendError } from "../utils/response.util";
import * as w from "../services/workforce.service";
import * as b from "../services/biometric.service";
import * as v from "../validators/workforce.validator";
import { User } from "../models/user.model";
import {
  StaffDepartment,
  StaffEmployment,
  SchoolCalendar,
  PayrollRecord,
  BiometricPunch,
} from "../models/workforce.model";
import { AuditLog } from "../models/auditLog.model";
import { LeaveRequest } from "../models/leaveRequest.model";
import { hasFeature } from "../../lib/plan-features";
import { dateKey } from "../services/workforceMath";
const router = Router(),
  handle = (fn: any) => async (req: any, res: any, next: any) => {
    try {
      sendSuccess(res, await fn(req));
    } catch (e) {
      next(e);
    }
  };
// Separate machine authentication: no user token, no client-supplied tenant/branch.
const machine = async (req: any, work: any) => {
  const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
  return b.deviceContext(v.id.parse(req.params.id), token, work);
};
router.post(
  "/biometric/:id/transactions",
  handle((r: any) =>
    machine(r, (device: any) =>
      b.ingest(
        device,
        z
          .object({ events: z.array(v.punch).max(500) })
          .strict()
          .parse(r.body).events,
      ),
    ),
  ),
);
router.post(
  "/biometric/:id/heartbeat",
  handle((r: any) =>
    machine(r, (device: any) =>
      b.heartbeat(
        device,
        z
          .object({
            pendingQueue: z.number().int().min(0).max(10000000),
            deviceConnected: z.boolean(),
            error: z.string().max(300).optional(),
            commandCompletedId: z.string().uuid().optional(),
          })
          .strict()
          .parse(r.body),
      ),
    ),
  ),
);
router.use(authenticate, (req, res, next) => {
  try {
    w.employeeActor(req.user);
    next();
  } catch (e) {
    next(e);
  }
});
const admin = (req: any, res: any, next: any) =>
  req.user.userType === "SCHOOL_ADMIN"
    ? next()
    : sendError(res, "School Admin access required.", 403);
const payroll = (req: any, res: any, next: any) =>
  hasFeature(req.user.plan, "FINANCE")
    ? next()
    : sendError(
        res,
        "Your subscription does not include payroll finance.",
        403,
      );
router.get(
  "/settings",
  handle((r: any) => w.settings(r.user)),
);
router.put(
  "/settings",
  admin,
  requirePermission("staff-attendance.manage"),
  handle((r: any) =>
    w.saveSettings(
      r.user,
      z
        .object({
          mode: z.enum(["MANUAL", "BIOMETRIC"]),
          policy: v.policy,
          confirmModeChange: z.boolean().optional(),
          complete: z.boolean().optional(),
        })
        .strict()
        .parse(r.body),
    ),
  ),
);
router.get(
  "/self",
  requirePermission("staff-attendance.self"),
  handle(async (r: any) => {
    const config = await w.settings(r.user);
    const month = v.month.parse(
      r.query.month || dateKey(new Date(), config.policy.timezone).slice(0, 7),
    );
    const result = await w.selfSummary(r.user, month);
    if (!hasFeature(r.user.plan, "FINANCE")) {
      result.payroll = [];
      if (result.employment)
        result.employment = { ...result.employment, salaryHistory: undefined };
    }
    return result;
  }),
);
for (const action of ["in", "out"] as const)
  router.post(
    "/self/check-" + action,
    requirePermission("staff-attendance.self"),
    handle((r: any) => {
      z.object({})
        .strict()
        .parse(r.body || {});
      return w.manual(r.user, action, {
        ipAddress: r.ip,
        userAgent: String(r.get("User-Agent") || "").slice(0, 300),
      });
    }),
  );
router.get(
  "/attendance",
  admin,
  requirePermission("staff-attendance.manage"),
  handle((r: any) =>
    w.overview(
      r.user,
      z
        .object({
          date: v.date.optional(),
          month: v.month.optional(),
          employeeId: v.id.optional(),
          role: z.string().max(40).optional(),
          department: z.string().max(100).optional(),
          status: z
            .enum(["PRESENT", "LATE", "ABSENT", "LEAVE", "OFF"])
            .optional(),
          source: z.enum(["MANUAL", "BIOMETRIC"]).optional(),
        })
        .strict()
        .parse(r.query),
    ),
  ),
);
router.post(
  "/attendance/correct",
  admin,
  requirePermission("staff-attendance.manage"),
  handle((r: any) =>
    w.correction(
      r.user,
      z
        .object({
          employeeId: v.id,
          date: v.date,
          status: z.enum(["PRESENT", "LATE", "ABSENT", "LEAVE"]),
          checkedInAt: z.string().datetime({ offset: true }).optional(),
          checkedOutAt: z.string().datetime({ offset: true }).optional(),
          reason: z.string().trim().min(3).max(1000),
        })
        .strict()
        .parse(r.body),
    ),
  ),
);
router.get(
  "/employees",
  admin,
  requirePermission("staff-attendance.manage"),
  handle(async (r: any) => {
    const users = await User.find({
      schoolId: r.user.schoolId,
      userType: { $nin: ["PARENT", "SUPER_ADMIN"] },
    })
      .select("name email userType status")
      .lean();
    const jobs: any[] = await StaffEmployment.find({
      schoolId: r.user.schoolId,
    }).lean();
    return users.map((u) => ({
      ...u,
      employment: jobs
        .filter((e) => String(e.userId) === String(u._id))
        .map((e) =>
          hasFeature(r.user.plan, "FINANCE")
            ? e
            : { ...e, salaryHistory: undefined },
        )[0],
    }));
  }),
);
router.get(
  "/departments",
  admin,
  requirePermission("users.view"),
  handle((r: any) =>
    StaffDepartment.find({ schoolId: r.user.schoolId })
      .sort({ name: 1 })
      .lean(),
  ),
);
router.post(
  "/departments/initialize",
  admin,
  requirePermission("users.manage"),
  handle(async (r: any) => {
    z.object({})
      .strict()
      .parse(r.body || {});
    const existing = await StaffEmployment.distinct("department", {
      schoolId: r.user.schoolId,
    });
    for (const name of new Set([
      "Teaching",
      "Finance",
      "Examinations",
      "Reception",
      "Administration",
      ...existing.filter(Boolean),
    ]))
      await StaffDepartment.updateOne(
        { schoolId: r.user.schoolId, name },
        { $setOnInsert: { schoolId: r.user.schoolId, name } },
        { upsert: true },
      );
    return StaffDepartment.find({ schoolId: r.user.schoolId })
      .sort({ name: 1 })
      .lean();
  }),
);
router.post(
  "/departments",
  admin,
  requirePermission("users.manage"),
  handle(async (r: any) => {
    const { name } = z
      .object({ name: z.string().trim().min(2).max(100) })
      .strict()
      .parse(r.body);
    return StaffDepartment.findOneAndUpdate(
      { schoolId: r.user.schoolId, name },
      { $setOnInsert: { schoolId: r.user.schoolId, name } },
      { upsert: true, new: true, runValidators: true },
    );
  }),
);
router.put(
  "/employees/:id",
  admin,
  payroll,
  requirePermission("payroll.manage"),
  handle((r: any) =>
    w.saveEmployment(
      r.user,
      v.id.parse(r.params.id),
      v.employment.parse(r.body),
    ),
  ),
);
router.get(
  "/calendar",
  admin,
  requirePermission("staff-attendance.manage"),
  handle((r: any) =>
    SchoolCalendar.find({
      schoolId: r.user.schoolId,
      ...(r.query.month
        ? {
            date: {
              $gte: v.month.parse(r.query.month) + "-01",
              $lte: v.month.parse(r.query.month) + "-31",
            },
          }
        : {}),
    })
      .sort({ date: -1 })
      .limit(1000)
      .lean(),
  ),
);
router.post(
  "/calendar",
  admin,
  requirePermission("staff-attendance.manage"),
  handle(async (r: any) => {
    const input = z
      .object({
        date: v.date,
        title: z.string().trim().min(2).max(150),
        kind: z.enum([
          "PAID_HOLIDAY",
          "UNPAID_HOLIDAY",
          "CLOSURE",
          "SPECIAL_WORKING",
        ]),
        reason: z.string().max(500).optional(),
      })
      .strict()
      .parse(r.body);
    return w.transaction(async (session) => {
      await w.periodLock(r.user, input.date.slice(0, 7), session);
      if (
        await PayrollRecord.exists({
          schoolId: r.user.schoolId,
          month: input.date.slice(0, 7),
          status: { $in: ["APPROVED", "PAID"] },
        }).session(session)
      )
        throw {
          statusCode: 409,
          message: "Calendar for approved payroll is locked.",
        };
      const before = await SchoolCalendar.findOne({
        schoolId: r.user.schoolId,
        date: input.date,
      })
        .session(session)
        .lean();
      const row = await SchoolCalendar.findOneAndUpdate(
        { schoolId: r.user.schoolId, date: input.date },
        { $set: input },
        { upsert: true, new: true, session },
      );
      await w.audit(
        r.user,
        "CALENDAR_SAVE",
        "SchoolCalendar",
        row._id,
        before,
        input,
        session,
      );
      return row;
    });
  }),
);
router.delete(
  "/calendar/:id",
  admin,
  requirePermission("staff-attendance.manage"),
  handle(async (r: any) =>
    w.transaction(async (session) => {
      const row = await SchoolCalendar.findOne({
        _id: v.id.parse(r.params.id),
        schoolId: r.user.schoolId,
      }).session(session);
      if (!row) throw { statusCode: 404, message: "Calendar entry not found." };
      await w.periodLock(r.user, row.date.slice(0, 7), session);
      if (
        await PayrollRecord.exists({
          schoolId: r.user.schoolId,
          month: row.date.slice(0, 7),
          status: { $in: ["APPROVED", "PAID"] },
        }).session(session)
      )
        throw {
          statusCode: 409,
          message: "Approved payroll calendar is locked.",
        };
      await row.deleteOne({ session });
      await w.audit(
        r.user,
        "CALENDAR_DELETE",
        "SchoolCalendar",
        row._id,
        row.toObject(),
        null,
        session,
      );
      return { deleted: true };
    }),
  ),
);
router.get(
  "/audit",
  admin,
  requirePermission("staff-attendance.manage"),
  handle((r: any) =>
    AuditLog.find({
      schoolId: r.user.schoolId,
      resource: {
        $in: hasFeature(r.user.plan, "FINANCE")
          ? [
              "StaffAttendance",
              "StaffEmployment",
              "PayrollRecord",
              "SchoolCalendar",
              "BiometricDevice",
              "LeaveRequest",
              "School",
            ]
          : [
              "StaffAttendance",
              "SchoolCalendar",
              "BiometricDevice",
              "LeaveRequest",
              "School",
            ],
      },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
  ),
);
router.get(
  "/devices/readiness",
  admin,
  requirePermission("biometric.manage"),
  handle(() => b.readiness()),
);
router.get(
  "/devices",
  admin,
  requirePermission("biometric.manage"),
  handle((r: any) => b.list(r.user)),
);
router.post(
  "/devices",
  admin,
  requirePermission("biometric.manage"),
  handle((r: any) => b.save(r.user, v.device.parse(r.body))),
);
router.put(
  "/devices/:id",
  admin,
  requirePermission("biometric.manage"),
  handle((r: any) =>
    b.save(r.user, v.device.parse(r.body), v.id.parse(r.params.id)),
  ),
);
router.post(
  "/devices/:id/token",
  admin,
  requirePermission("biometric.manage"),
  handle((r: any) => b.provision(r.user, v.id.parse(r.params.id))),
);
router.put(
  "/devices/:id/mappings",
  admin,
  requirePermission("biometric.manage"),
  handle((r: any) =>
    b.mapping(
      r.user,
      v.id.parse(r.params.id),
      z
        .object({
          mappings: z
            .array(
              z
                .object({
                  biometricUserId: z.string().min(1).max(100),
                  employeeId: v.id,
                })
                .strict(),
            )
            .max(2000),
        })
        .strict()
        .parse(r.body).mappings,
    ),
  ),
);
router.post(
  "/devices/:id/command",
  admin,
  requirePermission("biometric.manage"),
  handle((r: any) =>
    b.command(
      r.user,
      v.id.parse(r.params.id),
      z
        .object({ action: z.enum(["TEST", "SYNC"]) })
        .strict()
        .parse(r.body).action,
    ),
  ),
);
router.get(
  "/devices/:id/punches",
  admin,
  requirePermission("biometric.manage"),
  handle((r: any) =>
    BiometricPunch.find({
      schoolId: r.user.schoolId,
      device: v.id.parse(r.params.id),
      isDemo: { $ne: true },
    })
      .sort({ timestamp: -1 })
      .limit(500)
      .lean(),
  ),
);
router.get(
  "/leave",
  requirePermission("staff-attendance.self"),
  handle((r: any) =>
    LeaveRequest.find({ schoolId: r.user.schoolId, teacherId: r.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ),
);
router.post(
  "/leave",
  requirePermission("staff-attendance.self"),
  handle(async (r: any) => {
    const input = z
      .object({
        leaveType: z.enum(["Casual", "Sick", "Earned", "Maternity", "Unpaid"]),
        startDate: v.date,
        endDate: v.date,
        reason: z.string().trim().min(5).max(1000),
      })
      .strict()
      .refine(
        (x) =>
          x.endDate >= x.startDate &&
          Date.parse(x.endDate) - Date.parse(x.startDate) <= 366 * 86400000,
        "Invalid leave range",
      )
      .parse(r.body);
    await w.selfEmployee(r.user);
    const user = await w.employee(r.user, r.user.userId);
    return LeaveRequest.create({
      schoolId: r.user.schoolId,
      teacherId: r.user.userId,
      teacherName: user.name,
      ...input,
      totalDays:
        1 +
        Math.round(
          (Date.parse(input.endDate) - Date.parse(input.startDate)) / 86400000,
        ),
    });
  }),
);
router.get(
  "/payroll",
  payroll,
  handle((r: any) => {
    const query = z
      .object({
        month: v.month.optional(),
        employeeId: v.id.optional(),
        status: z
          .enum(["CALCULATED", "PENDING", "APPROVED", "PAID"])
          .optional(),
        role: z.string().max(50).optional(),
        department: z.string().max(100).optional(),
      })
      .strict()
      .parse(r.query);
    const own =
      !r.user.permissions.includes("payroll.view") ||
      !["SCHOOL_ADMIN", "FINANCE"].includes(r.user.userType);
    return PayrollRecord.find({
      schoolId: r.user.schoolId,
      ...(own
        ? { employeeId: r.user.userId }
        : query.employeeId
          ? { employeeId: query.employeeId }
          : {}),
      ...(query.month ? { month: query.month } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { "snapshot.employee.role": query.role } : {}),
      ...(query.department
        ? { "snapshot.employee.department": query.department }
        : {}),
    })
      .sort({ month: -1 })
      .limit(1000)
      .lean();
  }),
);
router.post(
  "/payroll/calculate",
  admin,
  payroll,
  requirePermission("payroll.manage"),
  handle((r: any) =>
    w.calculate(
      r.user,
      z.object({ month: v.month }).strict().parse(r.body).month,
    ),
  ),
);
router.post(
  "/payroll/:id/action",
  payroll,
  handle(async (r: any) => {
    const input = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("ADJUST"),
            amount: z.number().min(0).max(1e9),
            reason: z.string().trim().min(3).max(1000),
          })
          .strict(),
        z.object({ action: z.literal("SUBMIT") }).strict(),
        z.object({ action: z.literal("APPROVE") }).strict(),
        z
          .object({
            action: z.literal("PAY"),
            method: z.string().trim().min(2).max(80),
            reference: z.string().trim().min(1).max(150),
          })
          .strict(),
      ])
      .parse(r.body);
    const code = input.action === "PAY" ? "payroll.pay" : "payroll.manage";
    if (
      !r.user.permissions.includes(code) ||
      (input.action !== "PAY" && r.user.userType !== "SCHOOL_ADMIN") ||
      !["SCHOOL_ADMIN", "FINANCE"].includes(r.user.userType)
    )
      throw { statusCode: 403, message: "Payroll action permission required." };
    return w.payrollAction(r.user, v.id.parse(r.params.id), input);
  }),
);
export default router;
