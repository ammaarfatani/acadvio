import { Router } from "express";
import mongoose from "mongoose";
import crypto from "crypto";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware";
import { requireExactUserType, requireSuperAdmin } from "../middlewares/rbac.middleware";
import { UserType, UserStatus } from "../constants/roles.constant";
import { Subscription } from "../models/subscription.model";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";
import { School } from "../models/school.model";
import { User } from "../models/user.model";
import { reviewSubscriptionPayment } from "../services/subscriptionPaymentReview.service";
import { sendSuccess } from "../utils/response.util";
import { sendEmailNotification } from "../utils/email.util";
import { SuperAdminService } from "../services/superadmin.service";
import { decodePaymentImage } from "../services/paymentImage";

const router = Router();

export const paymentBank = () => ({ Bank: process.env.PAYMENT_BANK_NAME || "UBL (United Bank Limited)", "Account Title": process.env.PAYMENT_ACCOUNT_TITLE || "Ammar Afzal", "Account Number": process.env.PAYMENT_ACCOUNT_NUMBER || "2139402047933", IBAN: process.env.PAYMENT_IBAN || "PK22UNIL0109000402047933" });
async function quoteSelection(plan: unknown, billingCycle: unknown) {
  const selection = z.object({ plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]), billingCycle: z.enum(["monthly", "annual"]) }).safeParse({ plan, billingCycle });
  if (!selection.success) throw { statusCode: 400, message: "Select a valid plan and monthly or annual billing." };
  const catalogue = await SuperAdminService.getPlans();
  const chosen = catalogue.find((item: any) => item.code === selection.data.plan && item.isActive);
  if (!chosen) throw { statusCode: 400, message: "This subscription plan is not available." };
  const monthlyPrice = selection.data.billingCycle === "annual" ? chosen.priceAnnualPKR : chosen.priceMonthlyPKR;
  const price = selection.data.billingCycle === "annual" ? monthlyPrice * 12 : monthlyPrice;
  if (!Number.isSafeInteger(price) || price <= 0) throw { statusCode: 400, message: "The selected plan does not have a valid price. Contact support." };
  return { plan: chosen.code, name: chosen.name, price, monthlyPrice, billingCycle: selection.data.billingCycle, durationMonths: selection.data.billingCycle === "annual" ? 12 : 1 };
}
router.get("/plans", async (_req, res, next) => {
  try {
    const plans = await SuperAdminService.getPlans();
    return sendSuccess(res, plans.filter((p: any) => p.isActive).map((p: any) => ({ code: p.code, name: p.name, priceMonthlyPKR: p.priceMonthlyPKR, priceAnnualPKR: p.priceAnnualPKR })));
  } catch (e) { next(e); }
});
router.get("/quote", async (req, res, next) => {
  try { return sendSuccess(res, { subscription: await quoteSelection(req.query.plan, req.query.billingCycle), bank: paymentBank() }); } catch (e) { next(e); }
});
router.use(authenticate);
const schoolOnly = requireExactUserType(UserType.SCHOOL_ADMIN);
router.get("/mine", schoolOnly, async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ schoolId: req.user!.schoolId });
    const payments = await SubscriptionPayment.find({ schoolId: req.user!.schoolId }).sort({ submittedAt: -1 }).limit(100).lean();
    const selected = req.query.plan !== undefined || req.query.billingCycle !== undefined ? await quoteSelection(req.query.plan, req.query.billingCycle) : subscription;
    return sendSuccess(res, { bank: paymentBank(), subscription: selected, payments });
  } catch (e) { next(e); }
});
router.post("/", schoolOnly, async (req, res, next) => {
  try {
    const input = z.object({ screenshot: z.string(), reference: z.string().trim().max(160).optional(), plan: z.string().optional(), billingCycle: z.string().optional() }).parse(req.body);
    const image = decodePaymentImage(input.screenshot);
    const sub = await Subscription.findOne({ schoolId: req.user!.schoolId });
    if (!sub) throw { statusCode: 400, message: "A valid subscription is required before payment." };
    const selected = input.plan !== undefined || input.billingCycle !== undefined ? await quoteSelection(input.plan, input.billingCycle) : sub;
    if (!(selected.price > 0) || selected.plan === "FREE_TRIAL") throw { statusCode: 400, message: "Select a paid plan from Pricing before submitting payment." };
    const incomplete = await SubscriptionPayment.findOne({ schoolId: req.user!.schoolId, status: "APPROVED", activationComplete: false });
    if (incomplete) throw { statusCode: 409, message: "Your approved payment activation is being completed. Please contact support." };
    await SubscriptionPayment.init();
    const payment = await SubscriptionPayment.create({ schoolId: req.user!.schoolId, userId: req.user!.userId, subscriptionId: sub._id, amount: selected.price, plan: selected.plan, billingCycle: selected.billingCycle, reference: input.reference, account: paymentBank().IBAN, screenshot: image.bytes, screenshotMime: image.mime, screenshotHash: crypto.createHash("sha256").update(image.bytes).digest("hex") });
    return sendSuccess(res, { id: payment._id, status: payment.status }, "Payment submitted successfully. Your payment will be reviewed within 24 hours. Once your payment is confirmed, your CRM access will be approved.");
  } catch (e: any) { next(e.code === 11000 ? { statusCode: 409, message: "A payment is already pending or this screenshot has already been submitted." } : e.name === "ZodError" ? { statusCode: 400, message: "Screenshot is required and reference must be under 160 characters." } : e); }
});
router.get("/", requireSuperAdmin, async (_req, res, next) => {
  try { return sendSuccess(res, await SubscriptionPayment.find().populate("schoolId", "name").populate("userId", "name email").sort({ submittedAt: -1 }).limit(200).lean()); } catch (e) { next(e); }
});
router.get("/:id/screenshot", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw { statusCode: 404, message: "Screenshot not found." };
    if (!req.user!.isSuperAdmin && req.user!.userType !== UserType.SCHOOL_ADMIN) throw { statusCode: 403, message: "Access denied." };
    const filter = req.user!.isSuperAdmin ? { _id: req.params.id } : { _id: req.params.id, schoolId: req.user!.schoolId };
    const payment = await SubscriptionPayment.findOne(filter).select("+screenshot");
    if (!payment) throw { statusCode: 404, message: "Screenshot not found." };
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    return sendSuccess(res, { image: `data:${payment.screenshotMime};base64,${payment.screenshot.toString("base64")}` });
  } catch (e) { next(e); }
});
router.patch("/:id/review", requireSuperAdmin, async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(["APPROVED", "REJECTED"]), rejectionReason: z.string().trim().max(1000).optional() }).parse(req.body);
    if (!mongoose.isValidObjectId(req.params.id)) throw { statusCode: 404, message: "Payment not found." };
    const reviewed = await reviewSubscriptionPayment(String(req.params.id), input.status, req.user!.userId, input.rejectionReason);
    let notified = false;
    try {
      const user = await User.findById(reviewed.userId).select("email");
      if (user) notified = await sendEmailNotification({ to: user.email, subject: "Subscription payment "+input.status.toLowerCase(), text: input.status === "APPROVED" ? "Your payment is approved and your existing school CRM account is active. Sign in with your existing credentials." : "Your payment was rejected: "+input.rejectionReason+". Sign in to submit new payment proof." });
    } catch { console.error("[Payment review] Notification delivery unavailable; review remains saved."); }
    return sendSuccess(res, { status: input.status, emailSent: notified }, "Payment "+input.status.toLowerCase()+"."+ (notified ? " Notification sent." : " Email delivery unavailable; status is visible on the payment page."));
  } catch (e: any) {
    console.error("[Payment review]", { paymentId: req.params.id, code: e.code, message: e.statusCode ? e.message : e.name });
    next(e.name === "ZodError" ? { statusCode: 400, message: "Enter a valid review status and rejection reason." } : e);
  }
});
export default router;
