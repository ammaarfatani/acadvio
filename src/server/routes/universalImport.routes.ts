import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requireExactUserType } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { UniversalImportController } from "../controllers/universalImport.controller";
import rateLimit from "express-rate-limit";

const router = Router();

// Protect all routes with authentication, School Admin access, and strict tenant isolation
router.use(authenticate, requireExactUserType(UserType.SCHOOL_ADMIN), enforceSchoolTenant);

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many upload requests. Please wait a few minutes before trying again." },
});

// 1. Master School Migration Endpoints
router.get("/plan-info", UniversalImportController.planInfo);
router.get("/master/template", UniversalImportController.masterTemplate);
router.get("/master/sample", UniversalImportController.masterSample);
router.get("/master/history", UniversalImportController.history);
router.post("/master/preview", importLimiter, UniversalImportController.preview);
router.get("/master/:importId", UniversalImportController.status);
router.post("/master/:importId/commit", UniversalImportController.commit);
router.get("/master/:importId/errors", UniversalImportController.errorReport);

// 2. Universal Single-Entity Module Bulk Import Endpoints
router.get("/:entity/template", UniversalImportController.moduleTemplate);
router.post("/:entity/preview", importLimiter, UniversalImportController.preview);
router.get("/:entity/:importId", UniversalImportController.status);
router.post("/:entity/:importId/commit", UniversalImportController.commit);
router.get("/:entity/:importId/errors", UniversalImportController.errorReport);

export default router;
