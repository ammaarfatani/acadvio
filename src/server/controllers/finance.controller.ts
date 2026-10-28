import { Request, Response, NextFunction } from "express";
import { FinanceService } from "../services/finance.service";
import { sendSuccess } from "../utils/response.util";

export class FinanceController {
  static async getChallans(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId)
        throw { statusCode: 400, message: "No school tenant context." };
      return sendSuccess(
        res,
        await FinanceService.getChallans(schoolId, req.query.status as string),
        "Fee challans retrieved.",
      );
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
      } = req.body;

      const challan = await FinanceService.collectPayment(
        schoolId,
        challanId,
        { amountPKR, paymentMethod, requestId, transactionReference },
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

      const { classId, month, dueDate, lateFeeFine } = req.body;
      const result = await FinanceService.generateBulkChallans(
        schoolId,
        classId,
        month,
        dueDate,
        lateFeeFine,
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
