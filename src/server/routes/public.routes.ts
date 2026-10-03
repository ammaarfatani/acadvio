import { Router } from "express";
import { PublicController } from "../controllers/public.controller";
import { validate } from "../middlewares/validate.middleware";
import { RegisterSchoolSchema } from "../validators/public.validator";

const router = Router();

router.get("/health", PublicController.healthCheck);
router.post("/register-school", validate(RegisterSchoolSchema), PublicController.registerSchool);

export default router;
