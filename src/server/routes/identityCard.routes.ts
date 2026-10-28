import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/auth.middleware";
import { enforceSchoolTenant } from "../middlewares/tenant.middleware";
import {
  requireExactUserType,
  requirePermission,
} from "../middlewares/rbac.middleware";
import { UserType } from "../constants/roles.constant";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { IdentityCard } from "../models/identityCard.model";
import {
  getCard,
  currentCard,
  changeCard,
  cardSubject,
} from "../services/identityCard.service";
import { cardSvg, cardPdf } from "../services/identityCardRender.service";
import { validateStudentPhoto } from "../services/studentPhoto.service";
import { sendSuccess } from "../utils/response.util";
const router = Router(),
  id = z.string().regex(/^[a-f0-9]{24}$/i),
  kind = z.enum(["student", "staff"]);
router.use(authenticate, enforceSchoolTenant, (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});
const admin = [
  requireExactUserType(UserType.SCHOOL_ADMIN),
  requirePermission("users.manage"),
];
router.get("/", ...admin, async (req, res, next) => {
  try {
    const input = z
      .object({
        kind: kind.default("student"),
        search: z.string().max(100).default(""),
        status: z
          .enum(["PENDING_APPROVAL", "ISSUED", "NEEDS_CORRECTION", "REVOKED"])
          .optional(),
        page: z.coerce.number().int().min(1).default(1),
        classId: id.optional(),
        academicSessionId: id.optional(),
      })
      .parse(req.query);
    const escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const fields =
      input.kind === "student"
        ? ["name", "studentId", "className", "sectionName"]
        : ["name", "employeeId", "userType"];
    const filter: any = {
      schoolId: req.user!.schoolId,
      ...(input.kind === "student"
        ? {
            ...(input.classId ? { classId: input.classId } : {}),
            ...(input.academicSessionId
              ? { academicSessionId: input.academicSessionId }
              : {}),
          }
        : {}),
      ...(input.kind === "staff"
        ? { userType: { $nin: ["PARENT", "SUPER_ADMIN"] } }
        : {}),
      ...(escaped
        ? {
            $or: fields.map((f) => ({
              [f]: { $regex: escaped, $options: "i" },
            })),
          }
        : {}),
    };
    const model = input.kind === "student" ? Student : User;
    // Status filters use persisted records plus live fingerprint checks, before pagination.
    const totalPeople = await model.countDocuments(filter);
    const query = model.find(filter).sort({ name: 1, _id: 1 });
    const people = await (
      input.status ? query : query.skip((input.page - 1) * 25).limit(25)
    ).lean();
    const rows: any[] = [];
    for (const person of people) {
      const card = await getCard(req.user!, input.kind, String(person._id));
      if (!input.status || card.status === input.status) rows.push(card);
    }
    return sendSuccess(res, {
      rows: input.status
        ? rows.slice((input.page - 1) * 25, input.page * 25)
        : rows,
      total: input.status ? rows.length : totalPeople,
      page: input.page,
    });
  } catch (e) {
    next(e);
  }
});
router.get("/bulk-candidates", ...admin, async (req, res, next) => {
  try {
    const q = z
      .object({
        kind,
        search: z.string().max(100).default(""),
        classId: id.optional(),
        academicSessionId: id.optional(),
        after: id.optional(),
      })
      .strict()
      .parse(req.query);
    const escaped = q.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      model: any = q.kind === "student" ? Student : User;
    const people: any[] = await model
      .find({
        schoolId: req.user!.schoolId,
        ...(q.kind === "student"
          ? {
              ...(q.classId ? { classId: q.classId } : {}),
              ...(q.academicSessionId
                ? { academicSessionId: q.academicSessionId }
                : {}),
            }
          : { userType: { $nin: ["PARENT", "SUPER_ADMIN"] } }),
        ...(q.after ? { _id: { $gt: q.after } } : {}),
        ...(escaped
          ? {
              $or: (q.kind === "student"
                ? ["name", "studentId", "className"]
                : ["name", "employeeId"]
              ).map((f) => ({ [f]: { $regex: escaped, $options: "i" } })),
            }
          : {}),
      })
      .select("_id")
      .sort({ _id: 1 })
      .limit(26)
      .lean();
    const ids = [];
    for (const p of people.slice(0, 25)) {
      const c = await getCard(req.user!, q.kind, String(p._id));
      if (c.status === "ISSUED") ids.push(String(p._id));
    }
    return sendSuccess(res, {
      ids,
      next: people.length > 25 ? String(people[24]._id) : null,
    });
  } catch (e) {
    next(e);
  }
});
router.get("/self", async (req, res, next) => {
  try {
    if (["PARENT", "SUPER_ADMIN"].includes(req.user!.userType))
      throw { statusCode: 403, message: "Staff account required." };
    return sendSuccess(
      res,
      await getCard(req.user!, "staff", req.user!.userId),
    );
  } catch (e) {
    next(e);
  }
});
router.get("/verify/:reference", ...admin, async (req, res, next) => {
  try {
    const reference = z.string().uuid().parse(req.params.reference);
    const card: any = await IdentityCard.findOne({
      schoolId: req.user!.schoolId,
      reference,
    }).lean();
    if (!card) return sendSuccess(res, { valid: false, status: "NOT_FOUND" });
    const current = await getCard(req.user!, card.kind, String(card.subjectId));
    return sendSuccess(res, {
      valid: current.status === "ISSUED",
      status: current.status,
    });
  } catch (e) {
    next(e);
  }
});
router.post("/sheet", ...admin, async (req, res, next) => {
  try {
    const input = z
      .object({
        cards: z
          .array(z.object({ kind, id }))
          .min(1)
          .max(1000)
          .refine(
            (cards) =>
              new Set(cards.map((c) => c.kind + ":" + c.id)).size ===
              cards.length,
            "Choose unique cards.",
          ),
      })
      .strict()
      .parse(req.body);
    const cards = [];
    for (const item of input.cards) {
      const card = await getCard(req.user!, item.kind, item.id);
      if (card.status !== "ISSUED")
        throw {
          statusCode: 409,
          message: "Printable sheets can contain issued cards only.",
        };
      cards.push(card.data);
    }
    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="school-id-cards.pdf"',
      })
      .send(await cardPdf(cards, true));
  } catch (e) {
    next(e);
  }
});
router.put("/staff/:id/photo", ...admin, async (req, res, next) => {
  try {
    const subjectId = id.parse(req.params.id);
    await cardSubject(req.user!, "staff", subjectId);
    const input = z
      .object({ photo: z.string().max(7100000).nullable() })
      .strict()
      .parse(req.body);
    const bytes = await validateStudentPhoto(input.photo);
    await User.updateOne(
      { _id: subjectId, schoolId: req.user!.schoolId },
      {
        $set: {
          idPhoto: bytes
            ? "data:image/webp;base64," + bytes.toString("base64")
            : null,
        },
      },
    );
    return sendSuccess(
      res,
      await getCard(req.user!, "staff", subjectId, true),
      "Photo saved. Review and reissue the card if required.",
    );
  } catch (e) {
    next(e);
  }
});
router.post("/:kind/:id/review", ...admin, async (req, res, next) => {
  try {
    const input = z
      .object({
        action: z.enum(["issue", "correction", "revoke"]),
        revision: z.number().int().min(0),
        sourceHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        reason: z.string().trim().max(500).optional(),
      })
      .strict()
      .refine(
        (v) => (v.action === "issue" ? !!v.sourceHash : !!v.reason),
        "A reviewed preview or correction/revocation reason is required.",
      )
      .parse(req.body);
    return sendSuccess(
      res,
      await changeCard(
        req.user!,
        kind.parse(req.params.kind),
        id.parse(req.params.id),
        input,
      ),
    );
  } catch (e) {
    next(e);
  }
});
router.get("/:kind/:id", async (req, res, next) => {
  try {
    const k = kind.parse(req.params.kind),
      subject = id.parse(req.params.id),
      isAdmin =
        req.user!.userType === UserType.SCHOOL_ADMIN &&
        req.user!.permissions?.includes("users.manage");
    const card = await getCard(req.user!, k, subject, isAdmin);
    return sendSuccess(res, {
      ...card,
      ...(isAdmin
        ? { sourceHash: (await currentCard(req.user!, k, subject)).sourceHash }
        : {}),
    });
  } catch (e) {
    next(e);
  }
});
router.get("/:kind/:id/:file", async (req, res, next) => {
  try {
    const k = kind.parse(req.params.kind),
      subject = id.parse(req.params.id),
      file = z
        .enum(["front.svg", "back.svg", "card.pdf"])
        .parse(req.params.file),
      preview =
        req.query.preview === "1" &&
        req.user!.userType === UserType.SCHOOL_ADMIN &&
        req.user!.permissions?.includes("users.manage");
    const card = await getCard(req.user!, k, subject, preview);
    if (!card.data || (card.status !== "ISSUED" && !preview))
      throw {
        statusCode: 409,
        message:
          "This card is not issued. Ask your administrator to review it.",
      };
    if (file === "card.pdf")
      return res
        .set({
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="' +
            (card.identifier || "school").replace(/[^a-z0-9-]/gi, "_") +
            '-id-card.pdf"',
        })
        .send(await cardPdf([card.data]));
    return res
      .set({
        "Content-Type": "image/svg+xml",
        "Content-Security-Policy":
          "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      })
      .send(await cardSvg(card.data, file === "back.svg"));
  } catch (e) {
    next(e);
  }
});
export default router;
