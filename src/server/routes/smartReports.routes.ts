import { documentSettings } from "../services/schoolDocument.service";
import {
  reportFilterLabel,
  readableReportValue,
} from "../../lib/report-presentation";
import { Branch } from "../models/branch.model";
import { Router } from "express";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  authenticate,
  AuthenticatedUser,
} from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { sendSuccess, sendError } from "../utils/response.util";
import {
  authorizeReports,
  reportCatalogue,
  reportRequest,
  reportRows,
  reportDefinitions,
  reportFilters,
} from "../services/smartReports.service";
import {
  csvReport,
  workbookExport,
  pdfExport,
  zipExport,
} from "../services/reportExport.service";
import {
  intelligenceDashboard,
  intelligenceSettings,
  interpretIntelligence,
} from "../services/schoolIntelligence.service";
import {
  ReportPreset,
  ImprovementAction,
} from "../models/reportWorkspace.model";
import { AuditLog } from "../models/auditLog.model";
import { Student } from "../models/student.model";
import { SchoolService } from "../services/school.service";
import { branchContext } from "../utils/branchScope";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
import { ExamSchedule } from "../models/exam.model";
import { User } from "../models/user.model";
import { StaffEmployment } from "../models/workforce.model";
import { Subject } from "../models/subject.model";
const router = Router(),
  id = z.string().regex(/^[a-f0-9]{24}$/i);
const handle =
  (fn: (req: any, res: any) => Promise<any>) =>
  async (req: any, res: any, next: any) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      next(
        e?.code === 50
          ? {
              statusCode: 413,
              message:
                "This report took too long. Narrow the date range or filters.",
            }
          : e,
      );
    }
  };
router.use(authenticate, enforceSchoolTenant);
router.use((req, res, next) => {
  try {
    authorizeReports(req.user!);
    res.set("Cache-Control", "private, no-store");
    next();
  } catch (e) {
    next(e);
  }
});
async function audit(actor: AuthenticatedUser, action: string, details: any) {
  const context = branchContext.getStore();
  const write = () =>
    AuditLog.create({
      schoolId: actor.schoolId,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.userType,
      action,
      resource: "School Reports",
      details: JSON.stringify({
        ...details,
        scopeBranch: context?.branchId || "ALL_AUTHORIZED_BRANCHES",
      }),
    });
  // An owner consolidated read is audited in the main branch; no data query leaves its authorized scope.
  return context && !context.branchId
    ? branchContext.run({ ...context, branchId: context.mainBranchId }, write)
    : write();
}
router.get(
  "/catalogue",
  handle(async (req, res) =>
    sendSuccess(res, {
      reports: reportCatalogue(req.user),
      limits: {
        rowsPerReport: 5000,
        totalRows: 10000,
        previewPageSize: 25,
        maxDays: 731,
      },
      unavailable: [
        "Transport operations",
        "Inventory",
        "Historical capacity",
        "Historical outstanding-balance comparisons",
      ],
    }),
  ),
);
router.get(
  "/options",
  handle(async (req, res) => {
    const input = z
      .object({
        field: z.enum([
          "studentId",
          "employeeId",
          "classId",
          "sectionId",
          "academicSessionId",
          "examId",
          "department",
          "subjectId",
        ]),
        search: z.string().trim().max(80).default(""),
        classId: id.optional(),
        academicSessionId: id.optional(),
        sectionId: id.optional(),
      })
      .strict()
      .parse(req.query);
    const permission =
      input.field === "department"
        ? "users.manage"
        : input.field === "employeeId"
          ? "users.view"
          : input.field === "examId"
            ? "results.view"
            : "students.view";
    if (!req.user.permissions.includes(permission))
      throw {
        statusCode: 403,
        message: "This filter requires directory access.",
      };
    const models: any = {
        studentId: Student,
        employeeId: User,
        classId: ClassModel,
        sectionId: SectionModel,
        academicSessionId: AcademicSession,
        examId: ExamSchedule,
        subjectId: Subject,
      },
      escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (input.field === "department") {
      const rows = await StaffEmployment.aggregate([
        {
          $match: {
            schoolId: new mongoose.Types.ObjectId(req.user.schoolId),
            department: { $type: "string", $regex: escaped, $options: "i" },
          },
        },
        { $group: { _id: "$department" } },
        { $sort: { _id: 1 } },
        { $limit: 51 },
      ]).option({ maxTimeMS: 5000 });
      return sendSuccess(res, {
        options: rows
          .slice(0, 50)
          .map((r: any) => ({ value: r._id, label: r._id })),
        hasMore: rows.length > 50,
      });
    }
    if (
      input.academicSessionId &&
      !(await AcademicSession.exists({
        _id: input.academicSessionId,
        schoolId: req.user.schoolId,
      }))
    )
      throw { statusCode: 400, message: "Academic session not found." };
    if (
      input.sectionId &&
      !(await SectionModel.exists({
        _id: input.sectionId,
        schoolId: req.user.schoolId,
        ...(input.classId ? { classId: input.classId } : {}),
      }))
    )
      throw {
        statusCode: 400,
        message: "Section does not match the selected class.",
      };
    const filter: any = { schoolId: req.user.schoolId };
    if (input.classId) {
      if (
        !(await ClassModel.exists({
          _id: input.classId,
          schoolId: req.user.schoolId,
        }))
      )
        throw { statusCode: 400, message: "Class not found." };
      if (["studentId", "sectionId", "subjectId"].includes(input.field))
        filter.classId = input.classId;
      if (input.field === "examId")
        filter.classes = {
          $in: [
            input.classId,
            (
              (await ClassModel.findById(input.classId)
                .select("name")
                .lean()) as any
            )?.name,
          ],
        };
    }
    if (
      input.academicSessionId &&
      ["studentId", "examId"].includes(input.field)
    )
      filter.academicSessionId = input.academicSessionId;
    if (input.sectionId && input.field === "studentId")
      filter.sectionId = input.sectionId;
    if (input.field === "employeeId")
      filter.userType = { $nin: ["PARENT", "SUPER_ADMIN"] };
    if (escaped)
      filter[input.field === "examId" ? "title" : "name"] = {
        $regex: escaped,
        $options: "i",
      };
    const rows = await models[input.field]
      .find(filter)
      .select("name title studentId employeeId className sectionName")
      .sort({ name: 1, _id: 1 })
      .limit(51)
      .lean();
    return sendSuccess(res, {
      options: rows.slice(0, 50).map((r: any) => ({
        value: String(r._id),
        label: [
          r.name || r.title,
          r.studentId || r.employeeId,
          r.className,
          r.sectionName,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      hasMore: rows.length > 50,
    });
  }),
);
router.post(
  "/preview",
  handle(async (req, res) => {
    const input = reportRequest
      .extend({ page: z.number().int().min(1).max(2000).default(1) })
      .parse(req.body);
    const reports = [];
    for (const selection of input.selections)
      reports.push(
        await reportRows(req.user, selection, input.filters, input.page),
      );
    await audit(req.user, "REPORT_PREVIEW", {
      reports: input.selections.map((v) => v.report),
      filters: input.filters,
      outcome: "SUCCESS",
    });
    return sendSuccess(res, { reports });
  }),
);
const exportInput = reportRequest.extend({
  formats: z
    .array(z.enum(["csv", "xlsx", "pdf"]))
    .min(1)
    .max(3),
});
async function exportReports(
  req: any,
  res: any,
  input: z.infer<typeof exportInput>,
) {
  try {
    const reports = [];
    let rows = 0;
    for (const selection of input.selections) {
      const report = await reportRows(
        req.user,
        selection,
        input.filters,
        1,
        true,
      );
      rows += report.total;
      if (rows > 10000)
        throw {
          statusCode: 413,
          message: "Combined export exceeds 10,000 rows. Narrow the filters.",
        };
      reports.push(report);
    }
    const branchId = branchContext.getStore()?.branchId;
    const branch = branchId
      ? ((await Branch.findOne({
          _id: branchId,
          organizationId: req.user.schoolId,
        })
          .select("name")
          .lean()) as any)
      : null;
    const labels = Object.assign({}, ...reports.map((r) => r.filterLabels));
    const filterSummary = Object.entries(input.filters)
      .filter(
        ([key, value]) =>
          !["from", "to"].includes(key) && value !== undefined && value !== "",
      )
      .map(
        ([key, value]) =>
          `${reportFilterLabel(key)}: ${labels[key] || (key.endsWith("Id") ? "Selected school record" : readableReportValue(value, key))}`,
      )
      .join(" / ");
    const metadata = `${readableReportValue(input.filters.from, "date")} to ${readableReportValue(input.filters.to, "date")} / Asia/Karachi / ${branch?.name || (branchId ? "Selected authorized branch" : "All authorized branches")}${filterSummary ? " / " + filterSummary : ""}`;
    if (!rows)
      throw {
        statusCode: 404,
        message:
          "No matching recorded data. Change the report filters before downloading.",
      };
    const files: { name: string; data: Buffer }[] = [];
    if (input.formats.includes("csv"))
      for (const report of reports)
        files.push({
          name: report.report + ".csv",
          data: Buffer.from(csvReport(report)),
        });
    if (input.formats.includes("xlsx"))
      files.push({
        name: "school-reports.xlsx",
        data: workbookExport(reports, metadata),
      });
    if (input.formats.includes("pdf")) {
      if (rows > 1000)
        throw {
          statusCode: 413,
          message:
            "PDF exports are limited to 1,000 total rows for readability. Narrow filters or choose XLSX/CSV.",
        };
      const school = await SchoolService.getSchoolProfile(req.user.schoolId);
      files.push({
        name: "school-reports.pdf",
        data: await pdfExport(reports, metadata, school.name, {
          ...(await documentSettings(req.user.schoolId)),
          school,
        }),
      });
    }
    const multiple = files.length > 1,
      output = multiple ? zipExport(files) : files[0].data,
      name = `${input.selections.length === 1 ? input.selections[0].report : "school-reports"}_${input.filters.from}_${input.filters.to}_${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}.${multiple ? "zip" : files[0].name.split(".").pop()}`;
    if (output.length > 20 * 1024 * 1024)
      throw {
        statusCode: 413,
        message: "Export exceeds 20 MB. Narrow the filters.",
      };
    await audit(req.user, "REPORT_EXPORT", {
      reports: input.selections.map((v) => v.report),
      filters: input.filters,
      formats: input.formats,
      rows,
      outcome: "SUCCESS",
    });
    res.set(
      "Content-Type",
      multiple
        ? "application/zip"
        : name.endsWith(".pdf")
          ? "application/pdf"
          : name.endsWith(".xlsx")
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv; charset=utf-8",
    );
    res.set("Content-Disposition", `attachment; filename="${name}"`);
    res.set("X-Report-Records", String(rows));
    return res.send(output);
  } catch (e: any) {
    console.error("[Report export failed]", {
      reports: input.selections.map((v) => v.report),
      format: input.formats,
      code: e?.code || e?.statusCode || "GENERATION_FAILED",
      errorType: e?.name || "ReportError",
    });
    await audit(req.user, "REPORT_EXPORT", {
      reports: input.selections.map((v) => v.report),
      formats: input.formats,
      outcome: "FAILED",
    });
    throw e;
  }
}
router.post(
  "/export",
  rateLimit({
    windowMs: 60000,
    max: 5,
    keyGenerator: (req) => req.user!.userId,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  handle(async (req, res) =>
    exportReports(req, res, exportInput.parse(req.body)),
  ),
);
router.post(
  "/student/:id/export",
  rateLimit({
    windowMs: 60000,
    max: 5,
    keyGenerator: (req) => req.user!.userId,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  handle(async (req, res) => {
    const studentId = id.parse(req.params.id);
    if (
      !(await Student.exists({ _id: studentId, schoolId: req.user.schoolId }))
    )
      throw { statusCode: 404, message: "Student not found in this branch." };
    const input = exportInput.parse(req.body);
    if (
      input.selections.some(
        (s) => !reportDefinitions[s.report]?.filters.studentId,
      )
    )
      throw {
        statusCode: 400,
        message: "Choose only student-specific report sections.",
      };
    input.filters.studentId = studentId;
    return exportReports(req, res, input);
  }),
);
router.get(
  "/presets",
  handle(async (req, res) =>
    sendSuccess(
      res,
      await ReportPreset.find({
        schoolId: req.user.schoolId,
        userId: req.user.userId,
      })
        .sort({ name: 1 })
        .limit(50)
        .lean(),
    ),
  ),
);
router.post(
  "/presets",
  handle(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(1).max(80),
        configuration: reportRequest,
      })
      .strict()
      .parse(req.body);
    if (
      (await ReportPreset.countDocuments({
        schoolId: req.user.schoolId,
        userId: req.user.userId,
      })) >= 50 &&
      !(await ReportPreset.exists({
        schoolId: req.user.schoolId,
        userId: req.user.userId,
        name: input.name,
      }))
    )
      throw {
        statusCode: 409,
        message: "Remove an old preset before adding another (maximum 50).",
      };
    for (const selection of input.configuration.selections)
      await reportRows(req.user, selection, input.configuration.filters, 1);
    const preset = await ReportPreset.findOneAndUpdate(
      {
        schoolId: req.user.schoolId,
        userId: req.user.userId,
        name: input.name,
      },
      { $set: { configuration: input.configuration } },
      { upsert: true, new: true, runValidators: true },
    );
    await audit(req.user, "REPORT_PRESET_SAVED", {
      presetId: String(preset._id),
    });
    return sendSuccess(res, preset);
  }),
);
router.delete(
  "/presets/:id",
  handle(async (req, res) => {
    await ReportPreset.deleteOne({
      _id: id.parse(req.params.id),
      schoolId: req.user.schoolId,
      userId: req.user.userId,
    });
    return sendSuccess(res, { deleted: true });
  }),
);
const dashboardInput = z
  .object({
    filters: reportFilters,
    settings: intelligenceSettings.prefault({}),
  })
  .strict();
router.post(
  "/intelligence",
  handle(async (req, res) => {
    const input = dashboardInput.parse(req.body);
    return sendSuccess(
      res,
      await intelligenceDashboard(req.user, input.filters, input.settings),
    );
  }),
);
router.post(
  "/intelligence/interpret",
  rateLimit({
    windowMs: 15 * 60000,
    max: 10,
    keyGenerator: (req) => req.user!.userId,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  handle(async (req, res) => {
    const input = dashboardInput.parse(req.body),
      dashboard = await intelligenceDashboard(
        req.user,
        input.filters,
        input.settings,
      );
    try {
      const result = await interpretIntelligence(req.user, dashboard);
      await audit(req.user, "INTELLIGENCE_AI_INTERPRETATION", {
        filters: input.filters,
        outcome: "SUCCESS",
      });
      return sendSuccess(res, result);
    } catch (e: any) {
      await audit(req.user, "INTELLIGENCE_AI_INTERPRETATION", {
        filters: input.filters,
        outcome: "FAILED",
      });
      return sendError(
        res,
        "AI interpretation is unavailable or invalid. Your calculated metrics and rule-based insights remain available.",
        e?.statusCode === 503 ? 503 : 502,
      );
    }
  }),
);
router.get(
  "/actions",
  handle(async (req, res) =>
    sendSuccess(
      res,
      await ImprovementAction.find({ schoolId: req.user.schoolId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean(),
    ),
  ),
);
router.put(
  "/actions/:rule",
  handle(async (req, res) => {
    const rule = z
        .enum([
          "low-attendance",
          "attendance-positive",
          "stale-admissions",
          "expense-increase",
        ])
        .parse(req.params.rule),
      input = z
        .object({
          status: z.enum(["NEW", "IN_PROGRESS", "COMPLETED", "DISMISSED"]),
          notes: z.string().max(2000).default(""),
          reviewDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .refine(
              (v) =>
                !isNaN(Date.parse(v)) &&
                new Date(v).toISOString().slice(0, 10) === v,
              "Choose a valid review date.",
            )
            .nullable()
            .optional(),
        })
        .strict()
        .parse(req.body);
    const record = await ImprovementAction.findOneAndUpdate(
      { schoolId: req.user.schoolId, rule },
      { $set: { ...input, updatedBy: req.user.userId } },
      { upsert: true, new: true, runValidators: true },
    );
    await audit(req.user, "IMPROVEMENT_ACTION_UPDATED", {
      rule,
      status: input.status,
    });
    return sendSuccess(res, record);
  }),
);
export default router;
