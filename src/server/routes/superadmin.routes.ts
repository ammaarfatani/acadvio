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
