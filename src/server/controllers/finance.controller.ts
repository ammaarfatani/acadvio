import { Request, Response, NextFunction } from "express";
import { FinanceService } from "../services/finance.service";
import { sendSuccess } from "../utils/response.util";
import { FeeDefaultersService } from "../services/feeDefaulters.service";
import { workbookExport, pdfExport } from "../services/reportExport.service";
import { SchoolService } from "../services/school.service";
import { z } from "zod";

const defaulterQuery = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), branchId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  academicSession: z.string().max(80).optional(), classCategory: z.string().max(100).optional(), classId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  sectionId: z.string().regex(/^[a-f\d]{24}$/i).optional(), studentId: z.string().regex(/^[a-f\d]{24}$/i).optional(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["ALL", "OUTSTANDING", "OVERDUE", "1_MONTH", "2_PLUS", "3_PLUS", "PARTIAL", "NOT_YET_DUE", "HIGHEST"]).optional(),
  minAmount: z.coerce.number().min(0).optional(), maxAmount: z.coerce.number().min(0).optional(), minOverdueDays: z.coerce.number().int().min(0).optional(),
  pendingMonths: z.enum(["ALL", "1", "2", "2+", "3+"]).optional(), sort: z.enum(["HIGHEST", "OLDEST", "NAME"]).optional(),
  page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export class FinanceController {
  static async getFeeDefaulters(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const parsed = defaulterQuery.parse(req.query);
      const asOf = parsed.asOf || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
      const result = await FeeDefaultersService.get(schoolId, req.user, { ...parsed, asOf } as any);
      return sendSuccess(res, result, "Fee defaulters retrieved.");
    } catch (error) { next(error); }
  }

  static async addFeeDefaulterFollowUp(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const record = await FeeDefaultersService.addFollowUp(schoolId, req.user, req.params.studentId as string, req.body);
      return sendSuccess(res, record, "Follow-up recorded.", 201);
    } catch (error) { next(error); }
  }

  static async exportFeeDefaulters(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const parsed = defaulterQuery.parse(req.query);
      const asOf = parsed.asOf || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
      const first = await FeeDefaultersService.get(schoolId, req.user, { ...parsed, asOf, page: 1, limit: 100 } as any);
      if (first.pagination.total > 5000) throw { statusCode: 413, message: "Narrow this export to 5,000 students or fewer." };
      const data = first;
      for (let page = 2; page <= first.pagination.pages; page++) {
        const next = await FeeDefaultersService.get(schoolId, req.user, { ...parsed, asOf, page, limit: 100 } as any);
        data.rows.push(...next.rows);
      }
      const columns = ["studentName", "permanentStudentId", "className", "sectionName", "rollNumber", "guardianName", ...(req.user?.permissions?.includes("students.view") ? ["guardianContact"] : []), "academicSession", "lastPaymentDate", "pendingMonths", "oldestDueDate", "daysOverdue", "originalOutstandingPKR", "applicableLateFinePKR", "totalOutstandingPKR", "paymentStatus"];
      const exportRows = data.rows.map((row: any) => ({ ...row, originalOutstandingPKR: Number(row.originalOutstanding || 0), applicableLateFinePKR: Number(row.applicableLateFine || 0), totalOutstandingPKR: Number(row.totalOutstanding || 0) }));
      const groups = [...new Set(exportRows.map((r: any) => r.classCategoryName || "Uncategorized"))].sort((a: any, b: any) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b)).map((category: any) => {
        const rows = exportRows.filter((r: any) => (r.classCategoryName || "Uncategorized") === category);
        return { category, count: rows.length, rows, subtotals: Object.fromEntries(["originalOutstandingPKR", "applicableLateFinePKR", "totalOutstandingPKR"].map((key) => [key, rows.reduce((sum: number, r: any) => sum + Number(r[key] || 0), 0)])) };
      });
      const activeFilters = Object.entries(parsed).filter(([key, value]) => !["page", "limit", "sort", "asOf"].includes(key) && value !== undefined && value !== "");
      const filterDescription = activeFilters.map(([key, value]) => `${key}: ${value}`).join(" · ");
      const report = { report: "fee-defaulters", title: "Fee Defaulters Report", note: `As of ${asOf} · Outstanding: PKR ${Number(data.summary.totalOutstanding || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })} · ${filterDescription || "All accessible students"}. Voided and zero-balance challans are excluded.`, columns, rows: exportRows, groups, total: data.pagination.total } as any;
      const profile = await SchoolService.getSchoolProfile(schoolId);
      const format = req.query.format === "xlsx" ? "xlsx" : "pdf";
      const file = format === "xlsx" ? workbookExport([report], `As of ${asOf}`) : await pdfExport([report], `As of ${asOf}`, profile.name || "Acadivo School", { school: profile, branding: profile, templates: profile.documentSettings?.templates });
      res.setHeader("Content-Type", format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="fee-defaulters-${asOf}.${format}"`);
      return res.send(file);
    } catch (error) { next(error); }
  }

  static async getChallans(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId)
        throw { statusCode: 400, message: "No school tenant context." };
      return sendSuccess(
        res,
        await FinanceService.getChallans(schoolId, {
          status: req.query.status as string,
          branchId: req.query.branchId as string,
          classId: req.query.classId as string,
          classCategoryId: req.query.classCategoryId as string,
          sectionId: req.query.sectionId as string,
          month: req.query.month as string,
          search: req.query.search as string,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          skip: req.query.skip ? Number(req.query.skip) : undefined,
        }),
        "Fee challans retrieved.",
      );
    } catch (error) {
      next(error);
    }
  }

  static async getChallanPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };
      const challanId = req.params.challanId as string;
      const pdfBuffer = await FinanceService.getChallanPdf(schoolId, challanId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="challan-${challanId}.pdf"`,
      );
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  static async updateFeeStructure(req: Request, res: Response, next: NextFunction) {
    try { return sendSuccess(res, await FinanceService.createFeeStructure(req.user!.schoolId!, req.body, req.params.structureId as string)); } catch (e) { next(e); }
  }
  static async getBulkChallansPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No school tenant context." };

      const body = req.body || {};
      const wantsBase64 = body.response === "base64";
      const pdfBuffer = await FinanceService.getBulkChallansPdf(schoolId, {
        challanIds: body.challanIds || (req.query.challanIds ? (req.query.challanIds as string).split(",") : undefined),
        classId: body.classId || (req.query.classId as string),
        sectionId: body.sectionId || (req.query.sectionId as string),
        month: body.month || (req.query.month as string),
        academicSession: body.academicSession || (req.query.academicSession as string),
      });

      if (wantsBase64) return sendSuccess(res, { file: pdfBuffer.toString("base64"), mime: "application/pdf" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="fee-challans-batch.pdf"`,
      );
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
  static async getReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId)
        throw { statusCode: 400, message: "No school tenant context." };
      return sendSuccess(
        res,
        await FinanceService.getReceiptForChallan(
          schoolId,
          req.params.challanId as string,
        ),
        "Payment receipt retrieved.",
      );
    } catch (error) {
      next(error);
    }
  }
  static async getClasses(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId)
        throw { statusCode: 400, message: "No school tenant context." };
      const classes = await FinanceService.getSchoolClasses(schoolId);
      return sendSuccess(res, classes, "School classes retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Dashboard Metrics
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const data = await FinanceService.getFinanceDashboard(schoolId);
      return sendSuccess(res, data, "Finance dashboard metrics retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Fee Structures
  static async getFeeStructures(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const structures = await FinanceService.getFeeStructures(schoolId);
      return sendSuccess(res, structures, "Fee structures list retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createFeeStructure(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const structure = await FinanceService.createFeeStructure(
        schoolId,
        req.body,
      );
      return sendSuccess(
        res,
        structure,
        "Fee structure created successfully.",
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  // Student Account Ledger
  static async getStudentLedger(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const studentId = req.params.studentId as string;
      const ledger = await FinanceService.getStudentLedger(schoolId, studentId);
      return sendSuccess(res, ledger, "Student fee account ledger retrieved.");
    } catch (error) {
      next(error);
    }
  }

  // Collect Payment
  static async collectPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const collectorName = req.user?.email || "Finance Officer";
      const {
        challanId,
        amountPKR,
        paymentMethod,
        requestId,
        transactionReference,
        paymentDate,
      } = req.body;

      const challan = await FinanceService.collectPayment(
        schoolId,
        challanId,
        { amountPKR, paymentMethod, requestId, transactionReference, paymentDate },
        collectorName,
      );
      return sendSuccess(
        res,
        challan,
        "Payment collected and receipt generated.",
      );
    } catch (error) {
      next(error);
    }
  }

  // Void Challan
  static async voidChallan(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const userName = req.user?.email || "Finance Officer";
      const challanId = req.params.challanId as string;
      const { reason } = req.body;

      const challan = await FinanceService.voidChallan(
        schoolId,
        challanId,
        reason || "Voided by finance officer",
        userName,
      );
      return sendSuccess(res, challan, "Fee challan voided successfully.");
    } catch (error) {
      next(error);
    }
  }

  // Generate Bulk Challans
  static async generateBulkChallans(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const { classId, month } = req.body;
      const result = await FinanceService.generateBulkChallans(
        schoolId,
        classId,
        month,
        req.body,
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // Expenses
  static async getExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const category = req.query.category as string | undefined;
      const expenses = await FinanceService.getExpenses(schoolId, category);
      return sendSuccess(res, expenses, "Expense log retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const userName = req.user?.email || "Finance Officer";
      const expense = await FinanceService.createExpense(
        schoolId,
        req.body,
        userName,
      );
      return sendSuccess(res, expense, "Expense logged successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async voidExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) throw { statusCode: 400, message: "No tenant context." };

      const userName = req.user?.email || "Finance Officer";
      const expenseId = req.params.expenseId as string;
      const { reason } = req.body;

      const expense = await FinanceService.voidExpense(
        schoolId,
        expenseId,
        reason || "Voided by finance officer",
        userName,
      );
      return sendSuccess(res, expense, "Expense voided successfully.");
    } catch (error) {
      next(error);
    }
  }
}
