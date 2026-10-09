import {hasFeature} from "../../lib/plan-features";
import {sendError} from "../utils/response.util";
import { Router } from "express";
import { SchoolController } from "../controllers/school.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { UserType } from "../constants/roles.constant";
import { requireExactUserType } from "../middlewares/rbac.middleware";
import { requirePermission } from "../middlewares/rbac.middleware";
import { validate } from "../middlewares/validate.middleware";
import { AcademicSessionSchema, BrandingSchema } from "../validators/domain.validator";

const router = Router();

router.use(authenticate, enforceSchoolTenant);

router.put("/logo", requireExactUserType(UserType.SCHOOL_ADMIN), requirePermission("settings.update"), SchoolController.updateLogo);
router.get("/profile", requirePermission("settings.view"), SchoolController.getMySchool);
router.put("/branding", requirePermission("settings.update"), validate(BrandingSchema), (req,res,next)=>{if(req.body.bankDetails!==undefined&&(!hasFeature(req.user!.plan,"FINANCE")||![UserType.SCHOOL_ADMIN,UserType.FINANCE].includes(req.user!.userType)))return sendError(res,"Bank settings require an eligible subscription and School Admin or Finance access.",403);next();}, SchoolController.updateBranding);
router.get("/academic-sessions", requirePermission("settings.view"), SchoolController.getAcademicSessions);
router.post("/academic-sessions", requirePermission("settings.update"), validate(AcademicSessionSchema), SchoolController.createAcademicSession);

export default router;

