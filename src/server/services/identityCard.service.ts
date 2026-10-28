import mongoose from "mongoose";
import { normalizeCardImage } from "./identityCardRender.service";
import { createHash, randomUUID } from "node:crypto";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { StaffEmployment } from "../models/workforce.model";
import { IdentityCard } from "../models/identityCard.model";
import { IssuedSchoolDocument } from "../models/issuedSchoolDocument.model";
import { AuditLog } from "../models/auditLog.model";
import { School } from "../models/school.model";
import { branchContext } from "../utils/branchScope";
import { SchoolService } from "./school.service";
import { documentSettings } from "./schoolDocument.service";
import {
  ensureEmployeeIdentity,
  permanentIdentity,
} from "./permanentIdentity.service";
import { readStudentPhoto } from "./studentPhoto.service";
import { linkedChild } from "./parent.service";
export async function cardSubject(actor: any, kind: string, id: string) {
  if (
    actor.userType === "SCHOOL_ADMIN" &&
    !(actor.permissions || []).includes("users.manage") &&
    !(kind === "staff" && id === actor.userId)
  )
    throw {
      statusCode: 403,
      message: "ID card management permission required.",
    };
  if (kind === "student") {
    if (actor.userType === "PARENT") await linkedChild(actor, id);
    else if (actor.userType !== "SCHOOL_ADMIN")
      throw {
        statusCode: 403,
        message:
          "Only linked parents and school administrators can access student cards.",
      };
  } else if (actor.userType !== "SCHOOL_ADMIN" && id !== actor.userId)
    throw {
      statusCode: 403,
      message: "You can only access your own staff card.",
    };
  const subject =
    kind === "student"
      ? await Student.findOne({ _id: id, schoolId: actor.schoolId }).select(
          "+photoStorageId",
        )
      : await User.findOne({
          _id: id,
          schoolId: actor.schoolId,
          userType: { $nin: ["PARENT", "SUPER_ADMIN"] },
        }).select(
          "name email userType employeeId branchId schoolId status +idPhoto",
        );
  if (!subject)
    throw {
      statusCode: 404,
      message: "Record not found in this school branch.",
    };
  return subject;
}
export async function currentCard(actor: any, kind: string, id: string) {
  const subject: any = await cardSubject(actor, kind, id);
  const scope = branchContext.getStore();
  const school: any =
    scope && subject.branchId
      ? await branchContext.run(
          { ...scope, branchId: String(subject.branchId) },
          () => SchoolService.getSchoolProfile(actor.schoolId),
        )
      : await SchoolService.getSchoolProfile(actor.schoolId);
  const organization: any = await School.findById(actor.schoolId)
    .select("name")
    .lean();
  const config = await documentSettings(actor.schoolId);
  const employment: any =
    kind === "staff"
      ? await StaffEmployment.findOne({
          schoolId: actor.schoolId,
          userId: id,
        }).lean()
      : null;
  const identifier =
    kind === "staff"
      ? await ensureEmployeeIdentity(subject)
      : await permanentIdentity(
          actor.schoolId,
          "student",
          id,
          subject.studentId || undefined,
        );
  let photo = kind === "staff" ? subject.idPhoto : undefined;
  if (kind === "student" && subject.photoStorageId)
    photo = await readStudentPhoto(subject);
  const data = {
    kind,
    recordStatus: subject.status,
    identifier,
    name: subject.name,
    role:
      kind === "staff"
        ? employment?.designation || subject.userType.replaceAll("_", " ")
        : undefined,
    department: employment?.department || undefined,
    className: subject.className,
    sectionName: subject.sectionName,
    academicYear: subject.academicSessionName,
    guardian:
      subject.parentInfo?.guardianName || subject.parentInfo?.fatherName,
    branch: school.name,
    school: {
      name: organization?.name || school.name,
      logoUrl: await normalizeCardImage(school.logoUrl),
      address: school.address,
      phone: school.phone,
      email: school.email,
      ...config.branding,
    },
    photo,
    style: config.templates[kind === "student" ? "student-id" : "staff-id"],
  };
  const sourceHash = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  return { subject, data, sourceHash };
}
export async function getCard(
  actor: any,
  kind: string,
  id: string,
  adminPreview = false,
) {
  const current = await currentCard(actor, kind, id);
  let card: any = await IdentityCard.findOne({
    schoolId: actor.schoolId,
    kind,
    subjectId: id,
  }).lean();
  const stale =
    card?.status === "ISSUED" && card.sourceHash !== current.sourceHash;
  const status = stale
    ? "NEEDS_CORRECTION"
    : card?.status || "PENDING_APPROVAL";
  if (stale && actor.branchId) {
    const updated = await IdentityCard.updateOne(
      { _id: card._id, status: "ISSUED", sourceHash: card.sourceHash },
      {
        $set: {
          status: "NEEDS_CORRECTION",
          reason: "Profile or branding changed. Reapproval required.",
        },
        $inc: { revision: 1 },
      },
    );
    if (updated.modifiedCount) {
      await AuditLog.create({
        schoolId: actor.schoolId,
        actorUserId: actor.userId,
        actorRole: actor.userType,
        action: "ID_CARD_PROFILE_CHANGED",
        resource: "IdentityCard",
        entityId: String(card._id),
        newValue: { status: "NEEDS_CORRECTION" },
      });
      card.revision++;
    }
  }

  const issued = status === "ISSUED";
  return {
    subjectId: id,
    kind,
    identifier: current.data.identifier,
    name: current.data.name,
    role: current.data.role,
    className: current.data.className,
    sectionName: current.data.sectionName,
    status,
    reason: stale
      ? "Profile, photograph or branding changed. Administrator review and reissue are required."
      : card?.reason,
    revision: card?.revision || 0,
    version: card?.version || 0,
    reference: issued ? card.reference : undefined,
    data: issued
      ? card.snapshot
      : adminPreview
        ? { ...current.data, preview: true }
        : undefined,
  };
}
export async function changeCard(
  actor: any,
  kind: string,
  id: string,
  input: any,
) {
  const current = await currentCard(actor, kind, id);
  if (!actor.branchId)
    throw {
      statusCode: 400,
      message: "Choose a specific branch before changing cards.",
    };
  await IdentityCard.init();
  let seed: any = await IdentityCard.findOne({
    schoolId: actor.schoolId,
    kind,
    subjectId: id,
  });
  if (!seed) {
    try {
      seed = await IdentityCard.create({
        schoolId: actor.schoolId,
        kind,
        subjectId: id,
      });
    } catch (e: any) {
      if (e.code !== 11000) throw e;
      seed = await IdentityCard.findOne({
        schoolId: actor.schoolId,
        kind,
        subjectId: id,
      });
    }
  }
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const previous: any = await IdentityCard.findOne({
        _id: seed._id,
        revision: input.revision,
      }).session(session);
      if (!previous)
        throw {
          statusCode: 409,
          message: "Card changed. Refresh before reviewing it again.",
        };
      const status =
        input.action === "issue"
          ? "ISSUED"
          : input.action === "revoke"
            ? "REVOKED"
            : "NEEDS_CORRECTION";
      if (
        input.action === "issue" &&
        previous.status === "ISSUED" &&
        previous.sourceHash === current.sourceHash
      )
        throw {
          statusCode: 409,
          message: "This profile already has an issued card.",
        };
      // Re-read inside the transaction: refuse approval of a stale browser preview.
      const fresh = await currentCard(actor, kind, id);
      if (input.action === "issue" && input.sourceHash !== fresh.sourceHash)
        throw {
          statusCode: 409,
          message:
            "Profile changed since preview. Open and review the latest preview before issuing.",
        };
      const update: any = { status, reason: input.reason || "" };
      if (status === "ISSUED") {
        const reference = randomUUID(),
          snapshot = {
            ...fresh.data,
            reference,
            issuedAt: new Date().toISOString(),
            version: (previous.version || 0) + 1,
          };
        const [document] = await IssuedSchoolDocument.create(
          [
            {
              schoolId: actor.schoolId,
              ...(kind === "student" ? { studentId: id } : { staffId: id }),
              type: kind === "student" ? "student-id" : "staff-id",
              reference: "CARD-" + reference,
              requestId: reference,
              sourceHash: fresh.sourceHash,
              issuedAt: new Date(),
              issuedBy: actor.userId,
              snapshot: { ...snapshot, identityCard: true },
            },
          ],
          { session },
        );
        Object.assign(update, {
          reference,
          sourceHash: fresh.sourceHash,
          snapshot,
          issuedDocumentId: document._id,
          approvedAt: new Date(),
          approvedBy: actor.userId,
          version: (previous.version || 0) + 1,
        });
      }
      result = await IdentityCard.findOneAndUpdate(
        { _id: previous._id, revision: input.revision },
        { $set: update, $inc: { revision: 1 } },
        { new: true, session },
      );
      await AuditLog.create(
        [
          {
            schoolId: actor.schoolId,
            actorUserId: actor.userId,
            actorEmail: actor.email,
            actorRole: actor.userType,
            action: "ID_CARD_" + status,
            resource: "IdentityCard",
            entityId: String(previous._id),
            previousValue: {
              status: previous.status,
              reference: previous.reference,
            },
            newValue: {
              status,
              reference: update.reference,
              reason: input.reason,
            },
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return getCard(actor, kind, id, true);
}
