import { z } from "zod";
import { SuperAdminService } from "../services/superadmin.service";
import { sendSuccess } from "../utils/response.util";
import { Router } from "express";
import { SuperAdminController } from "../controllers/superadmin.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireSuperAdmin } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  ApproveSchoolSchema,
  RejectSchoolSchema,
  UpdateSchoolSubscriptionSchema,
  ExtendTrialSchema,
  ResetAdminPasswordSchema,
} from "../validators/superadmin.validator";

const router = Router();

// Require Super Admin authentication for all routes in this file
router.use(authenticate, requireSuperAdmin);

router.patch("/schools/:schoolId/account-status",async(req,res,next)=>{try{
  const id=z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.schoolId);
  const input=z.object({status:z.enum(["ACTIVE","DEACTIVATED"]),expectedRevision:z.number().int().min(0),reason:z.string().trim().max(1000).optional()}).strict().parse(req.body);
  const result=await SuperAdminService.changeAccountStatus(id,input,{userId:req.user!.userId,email:req.user!.email});return sendSuccess(res,result.school,result.message);
}catch(e){next(e);}});
router.get("/pending-schools", SuperAdminController.getPendingSchools);
router.get("/all-schools", SuperAdminController.getAllSchools);
router.get("/schools/:schoolId", SuperAdminController.getSchoolDetails);
router.get("/all-users", SuperAdminController.getAllUsers);
router.get("/audit-logs", SuperAdminController.getAuditLogs);
router.get("/plans", SuperAdminController.getPlans);
router.get("/analytics", SuperAdminController.getAnalytics);

router.post("/approve-school", validate(ApproveSchoolSchema), SuperAdminController.approveSchool);
router.post("/reject-school", validate(RejectSchoolSchema), SuperAdminController.rejectSchool);
router.post("/extend-trial", validate(ExtendTrialSchema), SuperAdminController.extendTrial);
router.post("/reset-admin-password", validate(ResetAdminPasswordSchema), SuperAdminController.resetAdminPassword);
router.post(
  "/update-subscription",
  validate(UpdateSchoolSubscriptionSchema),
  SuperAdminController.updateSubscriptionStatus
);

export default router;
