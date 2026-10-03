import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { CreateUserSchema, UpdateUserStatusSchema } from "../validators/user.validator";

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

export default router;
