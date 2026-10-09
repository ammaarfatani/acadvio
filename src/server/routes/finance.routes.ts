import { z } from "zod";
import { FeeSubmission } from "../models/feeSubmission.model";
import { reviewFee } from "../services/feeSubmission.service";
import { sendSuccess } from "../utils/response.util";
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

const objectId=z.string().regex(/^[a-f0-9]{24}$/i);
router.get("/payment-requests",requireUserType(UserType.FINANCE,UserType.SCHOOL_ADMIN),requirePermission("fees.view"),async(req,res,next)=>{try{return sendSuccess(res,await FeeSubmission.find({schoolId:req.user!.schoolId}).populate("studentId","name className rollNumber").populate("parentId","name email").populate("challanId","challanNumber remainingAmountPKR").sort({submittedAt:-1}).limit(200).lean());}catch(e){next(e);}});
router.get("/payment-requests/:id/proof",requireUserType(UserType.FINANCE,UserType.SCHOOL_ADMIN),requirePermission("fees.view"),async(req,res,next)=>{try{const row=await FeeSubmission.findOne({_id:objectId.parse(req.params.id),schoolId:req.user!.schoolId}).select("+screenshot");if(!row)throw{statusCode:404,message:"Payment request not found."};res.set({"Content-Type":row.screenshotMime,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});return res.send(row.screenshot);}catch(e){next(e);}});
router.post("/payment-requests/:id/review",requireUserType(UserType.FINANCE,UserType.SCHOOL_ADMIN),requirePermission("fees.collect"),async(req,res,next)=>{try{const {tenantSchoolId,...body}=req.body;const input=z.object({status:z.enum(["APPROVED","REJECTED"]),reason:z.string().trim().max(1000).optional()}).strict().parse(body);return sendSuccess(res,await reviewFee(req.user!,objectId.parse(req.params.id),input.status,input.reason),"Payment reviewed.");}catch(e){next(e);}});

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
