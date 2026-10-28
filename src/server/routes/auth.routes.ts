import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AuthService } from "../services/auth.service";
import { sendSuccess } from "../utils/response.util";
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
// Narrower than the global API limit; failed authentication attempts consume the budget.
const authLimiter = rateLimit({windowMs:15*60*1000,max:10,skipSuccessfulRequests:true,standardHeaders:true,legacyHeaders:false,message:{success:false,message:"Too many sign-in attempts. Please wait before trying again.",errors:["Sign-in rate limit exceeded."]}});
const recoveryLimiter = rateLimit({windowMs:15*60*1000,max:5,standardHeaders:true,legacyHeaders:false,message:{success:false,message:"Too many account recovery requests. Please wait before trying again.",errors:["Recovery rate limit exceeded."]}});


router.post("/login", authLimiter, validate(LoginSchema), AuthController.login);
router.post("/refresh-token", validate(RefreshTokenSchema), AuthController.refreshToken);
router.post("/logout", authenticate, AuthController.logout);
router.post("/forgot-password", recoveryLimiter, validate(ForgotPasswordSchema), AuthController.forgotPassword);
router.post("/reset-password", recoveryLimiter, validate(ResetPasswordSchema), AuthController.resetPassword);
router.post("/change-password", authenticate, validate(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(72).refine(v=>Buffer.byteLength(v,"utf8")<=72,"Password must be at most 72 bytes."), confirmPassword: z.string().min(10).max(72) }).strict().refine(v => v.newPassword === v.confirmPassword, "Passwords must match.")), async (req,res,next) => { try { const result = await AuthService.changePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword); res.clearCookie("refreshToken"); return sendSuccess(res, null, result.message); } catch(e) { next(e); } });
router.get("/me", authenticate, AuthController.getMe);

export default router;
