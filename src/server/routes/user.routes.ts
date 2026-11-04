import { Router } from "express";
import { z } from "zod";
import { UserController } from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { CreateUserSchema, UpdateUserStatusSchema } from "../validators/user.validator";
import { getFinancePayrollAccess, setFinancePayrollAccess } from "../services/financePayrollAccess.service";
import { sendSuccess } from "../utils/response.util";

const router = Router();

router.use(authenticate, enforceSchoolTenant);

router.get("/", requirePermission("users.view"), UserController.getSchoolUsers);
router.post("/", requirePermission("users.manage"), validate(CreateUserSchema), UserController.createStaffUser);
router.patch(
  "/:userId/status",
  requirePermission("users.manage"),
  validate(UpdateUserStatusSchema),
  UserController.updateUserStatus
);
router.get("/login-activity", requirePermission("users.view"), UserController.getLoginActivity);
router.get("/finance-payroll-access", requirePermission("payroll.manage"), async (req: any, res, next) => {
  try { return sendSuccess(res, await getFinancePayrollAccess(req.user)); } catch (error) { next(error); }
});
router.patch("/finance-payroll-access", requirePermission("payroll.manage"), async (req: any, res, next) => {
  try {
    const body = z.object({ enabled: z.boolean() }).strict().parse(req.body);
    return sendSuccess(res, await setFinancePayrollAccess(req.user, body.enabled), "Finance payroll payment access updated.");
  } catch (error) { next(error); }
});

export default router;
