import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  LoginSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/login", validate(LoginSchema), AuthController.login);
router.post("/refresh-token", validate(RefreshTokenSchema), AuthController.refreshToken);
router.post("/logout", authenticate, AuthController.logout);
router.post("/forgot-password", validate(ForgotPasswordSchema), AuthController.forgotPassword);
router.post("/reset-password", validate(ResetPasswordSchema), AuthController.resetPassword);
router.get("/me", authenticate, AuthController.getMe);

export default router;
