import { Router } from "express";
import { requireSchoolBillingOwner } from "../middlewares/billing.middleware";
import { SubscriptionController } from "../controllers/subscription.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";

const router = Router();

router.use(authenticate, enforceSchoolTenant);

router.get("/current", requireSchoolBillingOwner, SubscriptionController.getMySubscription);

export default router;
