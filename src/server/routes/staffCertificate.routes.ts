import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import { requireExactUserType, requirePermission } from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { sendSuccess } from "../utils/response.util";
import { staffCertificatePdf } from "../services/staffCertificatePdf.service";
import {
  createStaffCertificateTemplate,
  issueStaffCertificate,
  listStaffCertificateTemplates,
  listStaffCertificates,
  publicStaffCertificateVerification,
  revokeStaffCertificate,
  reissueStaffCertificate,
  searchStaffCertificatesStaff,
  staffCertificateChoices,
  staffCertificateDetail,
  staffCertificateOverview,
  transitionStaffCertificateTemplate,
  updateStaffCertificateTemplate,
} from "../services/staffCertificate.service";

const router = Router();
const id = z.string().regex(/^[a-f0-9]{24}$/i);
const revision = z.number().int().nonnegative();

// Public verification returns only the safe certificate summary.
router.get("/verify/:token", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
  try { res.set("Cache-Control", "no-store"); return sendSuccess(res, await publicStaffCertificateVerification(String(req.params.token))); }
  catch (e) { next(e); }
});

router.use(authenticate, enforceSchoolTenant, requireExactUserType(UserType.SCHOOL_ADMIN));

router.get("/overview", requirePermission("users.view"), async (req: any, res, next) => {
  try { return sendSuccess(res, await staffCertificateOverview(req.user)); } catch (e) { next(e); }
});
router.get("/choices", requirePermission("users.view"), async (req: any, res, next) => {
  try { return sendSuccess(res, await staffCertificateChoices(req.user)); } catch (e) { next(e); }
});
router.get("/templates", requirePermission("settings.view"), async (req: any, res, next) => {
  try { return sendSuccess(res, await listStaffCertificateTemplates(req.user)); } catch (e) { next(e); }
});
router.post("/templates", requirePermission("settings.update"), async (req: any, res, next) => {
  try { const body = z.object({ revision, template: z.record(z.string(), z.unknown()) }).strict().parse(req.body); return sendSuccess(res, await createStaffCertificateTemplate(req.user, body.revision, body.template), "Draft staff certificate template saved.", 201); } catch (e) { next(e); }
});
router.put("/templates/:id", requirePermission("settings.update"), async (req: any, res, next) => {
  try { const body = z.object({ revision, template: z.record(z.string(), z.unknown()) }).strict().parse(req.body); return sendSuccess(res, await updateStaffCertificateTemplate(req.user, id.parse(req.params.id), body.revision, body.template), "Staff certificate template updated."); } catch (e) { next(e); }
});
router.post("/templates/:id/:action", requirePermission("settings.update"), async (req: any, res, next) => {
  try {
    const action = z.enum(["submit", "approve", "reject", "archive"]).parse(req.params.action);
    const body = z.object({ revision, reason: z.string().trim().max(1000).optional() }).strict().parse(req.body);
    return sendSuccess(res, await transitionStaffCertificateTemplate(req.user, id.parse(req.params.id), body.revision, action, body.reason), `Template ${action} complete.`);
  } catch (e) { next(e); }
});

router.get("/staff", requirePermission("users.view"), async (req: any, res, next) => {
  try { return sendSuccess(res, await searchStaffCertificatesStaff(req.user, req.query)); } catch (e) { next(e); }
});
router.get("/", requirePermission("users.view"), async (req: any, res, next) => {
  try { return sendSuccess(res, await listStaffCertificates(req.user, req.query)); } catch (e) { next(e); }
});
router.post("/", requirePermission("users.manage"), async (req: any, res, next) => {
  try { return sendSuccess(res, await issueStaffCertificate(req.user, req.body), "Staff certificate issued and archived.", 201); } catch (e) { next(e); }
});
router.get("/:id/pdf", requirePermission("users.view"), async (req: any, res, next) => {
  try {
    const row: any = await staffCertificateDetail(req.user, id.parse(req.params.id));
    const bytes = await staffCertificatePdf({ ...row.snapshot, revoked: row.status === "REVOKED", replaced: row.status === "REPLACED" });
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    return sendSuccess(res, { file: bytes.toString("base64"), filename: `${row.certificateNumber}.pdf`, mime: "application/pdf" });
  } catch (e) { next(e); }
});
router.get("/:id", requirePermission("users.view"), async (req: any, res, next) => {
  try { return sendSuccess(res, await staffCertificateDetail(req.user, id.parse(req.params.id))); } catch (e) { next(e); }
});
router.post("/:id/revoke", requirePermission("users.manage"), async (req: any, res, next) => {
  try { const body = z.object({ reason: z.string().trim().min(3).max(1000) }).strict().parse(req.body); return sendSuccess(res, await revokeStaffCertificate(req.user, id.parse(req.params.id), body.reason), "Certificate revoked. Original record and history preserved."); } catch (e) { next(e); }
});
router.post("/:id/reissue", requirePermission("users.manage"), async (req: any, res, next) => {
  try { return sendSuccess(res, await reissueStaffCertificate(req.user, id.parse(req.params.id), req.body), "Replacement certificate issued. Original record preserved.", 201); } catch (e) { next(e); }
});

export default router;
