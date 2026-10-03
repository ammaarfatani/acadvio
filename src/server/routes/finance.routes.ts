import { Router } from "express";
import { FinanceController } from "../controllers/finance.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requireUserType, requirePermission } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { validate } from "../middlewares/validate.middleware";
import { FeeStructureSchema, CollectPaymentSchema, VoidReasonSchema, FeeBatchSchema, ExpenseSchema } from "../validators/domain.validator";

const router = Router();

// Protect all finance routes with authentication and strict tenant enforcement
router.use(authenticate, enforceSchoolTenant);

// Restricted to FINANCE, SCHOOL_ADMIN, and SUPER_ADMIN
const allowedRoles = [UserType.FINANCE, UserType.SCHOOL_ADMIN, UserType.SUPER_ADMIN];

// Dashboard & Metrics
router.get("/dashboard", requireUserType(...allowedRoles), FinanceController.getDashboard);
router.get("/classes", requireUserType(...allowedRoles), FinanceController.getClasses);

// Fee Structures
router.get("/structures", requireUserType(...allowedRoles), FinanceController.getFeeStructures);
router.post("/structures", requireUserType(...allowedRoles), validate(FeeStructureSchema), FinanceController.createFeeStructure);

// Student Fee Account Ledger
router.get("/challans", requireUserType(...allowedRoles), FinanceController.getChallans);
router.get("/receipts/:challanId", requireUserType(...allowedRoles), FinanceController.getReceipt);
router.get("/ledger/:studentId", requireUserType(...allowedRoles), FinanceController.getStudentLedger);

// Payments & Receipts
router.post("/collect-payment", requireUserType(...allowedRoles), validate(CollectPaymentSchema), FinanceController.collectPayment);
router.post("/challans/:challanId/void", requireUserType(...allowedRoles), validate(VoidReasonSchema), FinanceController.voidChallan);

// Bulk Challan Generation
router.post("/generate-batch", requireUserType(...allowedRoles), validate(FeeBatchSchema), FinanceController.generateBulkChallans);

// Expenses
router.get("/expenses", requireUserType(...allowedRoles), FinanceController.getExpenses);
router.post("/expenses", requireUserType(...allowedRoles), validate(ExpenseSchema), FinanceController.createExpense);
router.post("/expenses/:expenseId/void", requireUserType(...allowedRoles), validate(VoidReasonSchema), FinanceController.voidExpense);

export default router;
