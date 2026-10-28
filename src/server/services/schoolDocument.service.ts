import mongoose from "mongoose";
import { AuditLog } from "../models/auditLog.model";
import { randomUUID, createHash } from "crypto";
import { School } from "../models/school.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { StaffEmployment } from "../models/workforce.model";
import {
  ExamSchedule,
  ProcessedResult,
  CertificateRecord,
} from "../models/exam.model";
import { StudentAttendance } from "../models/attendance.model";
import { IssuedSchoolDocument } from "../models/issuedSchoolDocument.model";
import { SchoolService } from "./school.service";
import { FinanceService } from "./finance.service";
import {
  readStudentPhoto,
  storeStudentPhoto,
  deleteStudentPhoto,
} from "./studentPhoto.service";
import {
  DocumentType,
  DOCUMENT_TYPES,
  documentTypesForRole,
  defaultDocumentStyle,
} from "../../lib/document-templates";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
export function checkDocumentRole(
  actor: AuthenticatedUser,
  type: DocumentType,
) {
  if (!documentTypesForRole(actor.userType).includes(type))
    throw {
      statusCode: 403,
      message: "Your portal cannot generate this document category.",
    };
}
export const documentIssuePermission = (type: DocumentType) =>
  ["fee-receipt", "fee-statement"].includes(type)
    ? "fees.collect"
    : [
          "report-card",
          "transcript",
          "character",
          "leaving",
          "bonafide",
          "transfer",
          "general-certificate",
        ].includes(type)
      ? "results.publish"
      : ["staff-id", "experience"].includes(type)
        ? "users.manage"
        : type === "attendance"
          ? "attendance.manage"
          : "students.create";
export const documentPermission = (type: DocumentType) =>
  ["fee-receipt", "fee-statement"].includes(type)
    ? "fees.view"
    : [
          "report-card",
          "transcript",
          "character",
          "leaving",
          "bonafide",
          "transfer",
        ].includes(type)
      ? "results.view"
      : ["staff-id", "experience"].includes(type)
        ? "users.view"
        : type === "attendance"
          ? "attendance.view"
          : "students.view";
export async function documentSettings(schoolId: string) {
  const school: any = await School.findById(schoolId).lean();
  if (!school) throw { statusCode: 404, message: "School not found." };
  return {
    revision: school.documentSettingsRevision || 0,
    completedAt: school.documentSetupCompletedAt,
    branding: school.documentSettings?.branding || {},
    templates: Object.fromEntries(
      DOCUMENT_TYPES.map((type) => [
        type,
        {
          ...defaultDocumentStyle(type),
          ...school.documentSettings?.templates?.[type],
        },
      ]),
    ),
  };
}
export async function documentData(
  actor: AuthenticatedUser,
  input: {
    type: DocumentType;
    studentId?: string;
    staffId?: string;
    examId?: string;
    paymentId?: string;
    certificateId?: string;
    certificatePurpose?: string;
    statement?: string;
    from?: string;
    to?: string;
  },
  context?: { schoolId: string; school: any; settings: any },
) {
  if (context && context.schoolId !== actor.schoolId)
    throw { statusCode: 403, message: "Document school context mismatch." };
  checkDocumentRole(actor, input.type);
  if (input.certificateId) {
    const issued: any = await CertificateRecord.findOne({
      _id: input.certificateId,
      schoolId: actor.schoolId,
      ...(input.studentId ? { studentId: input.studentId } : {}),
    }).lean();
    const expected = (
      {
        BONAFIDE: "bonafide",
        CHARACTER: "character",
        LEAVING: "leaving",
        TRANSFER: "transfer",
        RESULT: "report-card",
      } as any
    )[issued?.type];
    if (!issued || expected !== input.type)
      throw {
        statusCode: 404,
        message:
          "Issued certificate not found for this school, student and category.",
      };
    if (issued.documentSnapshot) {
      const { documentSnapshot, ...certificate } = issued;
      return {
        ...documentSnapshot,
        type: input.type,
        certificate,
        generatedAt: issued.issueDate,
      };
    }
  }
  if (
    ["staff-id", "experience"].includes(input.type)
      ? !input.staffId
      : !input.studentId
  )
    throw { statusCode: 400, message: "Choose the student or staff record." };
  if (
    (input.type === "report-card" && !input.examId) ||
    (input.type === "fee-receipt" && !input.paymentId)
  )
    throw {
      statusCode: 400,
      message: "Select the related examination or payment.",
    };
  if (
    ["character", "leaving", "bonafide", "transfer"].includes(input.type) &&
    !input.certificateId
  )
    throw { statusCode: 400, message: "Select an already issued certificate." };
  if (
    input.type === "attendance" &&
    (!input.from ||
      !input.to ||
      Number.isNaN(Date.parse(input.from)) ||
      Number.isNaN(Date.parse(input.to)) ||
      input.from > input.to)
  )
    throw { statusCode: 400, message: "Choose a valid attendance date range." };
  const school: any =
    context?.school || (await SchoolService.getSchoolProfile(actor.schoolId!));
  const settings =
    context?.settings || (await documentSettings(actor.schoolId!));
  const branding = settings.branding;
  const style = settings.templates[input.type];
  let student: any,
    staff: any,
    employment: any,
    result: any,
    exam: any,
    certificate: any,
    payment: any,
    ledger: any,
    results: any,
    attendance: any;
  if (["staff-id", "experience"].includes(input.type)) {
    staff = await User.findOne({
      _id: input.staffId,
      schoolId: actor.schoolId,
      userType: { $nin: ["PARENT", "SUPER_ADMIN"] },
    })
      .select("name email userType idPhoto")
      .lean();
    if (!staff) throw { statusCode: 404, message: "Staff member not found." };
    employment = await StaffEmployment.findOne({
      schoolId: actor.schoolId,
      userId: staff._id,
    })
      .select(
        "employeeId designation department joiningDate leavingDate status",
      )
      .lean();
    if (input.type === "experience" && !input.statement?.trim())
      throw {
        statusCode: 400,
        message:
          "Enter an approved experience statement. Employment dates are not invented.",
      };
  } else {
    student = await Student.findOne({
      _id: input.studentId,
      schoolId: actor.schoolId,
    })
      .select("+photoStorageId")
      .lean();
    if (!student) throw { statusCode: 404, message: "Student not found." };
  }
  if (input.type === "report-card") {
    exam = await ExamSchedule.findOne({
      _id: input.examId,
      schoolId: actor.schoolId,
    }).lean();
    result = await ProcessedResult.findOne({
      schoolId: actor.schoolId,
      studentId: student._id,
      examId: input.examId,
    }).lean();
    if (!exam || !result)
      throw {
        statusCode: 404,
        message:
          "No processed examination result exists for this student and examination.",
      };
  }
  if (input.type === "transcript")
    results = await ProcessedResult.find({
      schoolId: actor.schoolId,
      studentId: student._id,
    })
      .populate("examId", "title academicSessionName")
      .sort({ createdAt: 1 })
      .lean();
  if (["character", "leaving", "bonafide", "transfer"].includes(input.type)) {
    const types: any = {
      character: "CHARACTER",
      leaving: "LEAVING",
      bonafide: "BONAFIDE",
      transfer: "TRANSFER",
    };
    certificate = await CertificateRecord.findOne({
      _id: input.certificateId,
      schoolId: actor.schoolId,
      studentId: student._id,
      type: types[input.type],
    }).lean();
    if (!certificate)
      throw {
        statusCode: 404,
        message:
          "Select an existing issued certificate of this type for the student.",
      };
  }
  if (input.type === "general-certificate" && !input.statement?.trim())
    throw {
      statusCode: 400,
      message: "Enter the authorized certificate statement.",
    };
  if (input.type === "fee-receipt") {
    payment = await FinanceService.getReceiptById(
      actor.schoolId!,
      input.paymentId!,
    );
    if (String(payment.studentId?._id) !== String(student._id))
      throw {
        statusCode: 404,
        message: "This receipt does not belong to the selected student.",
      };
  }
  if (input.type === "fee-statement")
    ledger = await FinanceService.getStudentLedger(
      actor.schoolId!,
      String(student._id),
    );
  if (input.type === "attendance") {
    if (!input.from || !input.to)
      throw { statusCode: 400, message: "Choose a report date range." };
    const docs = await StudentAttendance.find({
      schoolId: actor.schoolId,
      date: {
        $gte: new Date(input.from + "T00:00:00+05:00"),
        $lte: new Date(input.to + "T23:59:59.999+05:00"),
      },
      "records.studentId": student._id,
    })
      .sort({ date: 1 })
      .lean();
    attendance = docs.map((d: any) => ({
      date: d.date,
      ...d.records.find(
        (r: any) => String(r.studentId) === String(student._id),
      ),
    }));
  }
  if (certificate?.documentSnapshot) {
    const saved = certificate.documentSnapshot;
    return {
      ...saved,
      certificate,
      type: input.type,
      generatedAt: certificate.issueDate,
    };
  }
  const photoStorageId = student?.photoStorageId;
  if (student) {
    delete student.photoStorageId;
    delete student.documents;
  }
  return {
    type: input.type,
    style,
    school: {
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
      logoUrl: school.logoUrl,
      domain: school.domain,
      ...branding,
    },
    student,
    staff,
    employment,
    result,
    exam,
    certificate,
    payment,
    ledger,
    results,
    attendance,
    statement: input.statement,
    certificatePurpose: input.certificatePurpose,
    from: input.from,
    to: input.to,
    photo: staff?.idPhoto,
    photoStorageId,
    photoStudentId: student?._id,
    photoSchoolId: actor.schoolId,
    generatedAt: new Date(),
  };
}
export async function hydrateDocumentPhoto(snapshot: any) {
  if (snapshot.photoStorageId) {
    try {
      return {
        ...snapshot,
        photo: await readStudentPhoto({
          _id: snapshot.photoStudentId,
          schoolId: snapshot.photoSchoolId,
          photoStorageId: snapshot.photoStorageId,
        }),
      };
    } catch {
      return snapshot;
    }
  }
  return snapshot;
}
export async function issueDocument(actor: AuthenticatedUser, input: any) {
  if (["student-id", "staff-id"].includes(input.type))
    throw {
      statusCode: 409,
      message:
        "Issue ID cards through ID Card Management after administrator review.",
    };
  checkDocumentRole(actor, input.type);
  const sourceHash = createHash("sha256")
    .update(JSON.stringify({ ...input, requestId: undefined }))
    .digest("hex");
  const prior = await IssuedSchoolDocument.findOne({
    schoolId: actor.schoolId,
    requestId: input.requestId,
  });
  if (prior) {
    if (prior.sourceHash !== sourceHash)
      throw {
        statusCode: 409,
        message: "This request ID belongs to a different document request.",
      };
    return prior;
  }
  const snapshot = await documentData(actor, input);
  let archivedPhotoId: string | undefined;
  if (snapshot.photoStorageId) {
    const image = await readStudentPhoto({
      _id: snapshot.photoStudentId,
      schoolId: snapshot.photoSchoolId,
      photoStorageId: snapshot.photoStorageId,
    });
    archivedPhotoId = await storeStudentPhoto(
      {
        _id: snapshot.photoStudentId,
        schoolId: snapshot.photoSchoolId,
        branchId: actor.branchId,
      },
      Buffer.from(image.split(",")[1], "base64"),
    );
    snapshot.photoStorageId = archivedPhotoId;
  }
  const reference = `DOC-${input.type.toUpperCase()}-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
  const session = await mongoose.startSession();
  let saved: any;
  try {
    await session.withTransaction(async () => {
      const again = await IssuedSchoolDocument.findOne({
        schoolId: actor.schoolId,
        requestId: input.requestId,
      }).session(session);
      if (again) {
        if (again.sourceHash !== sourceHash)
          throw {
            statusCode: 409,
            message: "Request ID belongs to a different document.",
          };
        saved = again;
        return;
      }
      saved = (
        await IssuedSchoolDocument.create(
          [
            {
              schoolId: actor.schoolId,
              studentId: input.studentId,
              staffId: input.staffId,
              type: input.type,
              reference,
              requestId: input.requestId,
              sourceHash,
              issuedBy: actor.userId,
              snapshot,
            },
          ],
          { session },
        )
      )[0];
      await AuditLog.create(
        [
          {
            schoolId: actor.schoolId,
            actorUserId: actor.userId,
            actorEmail: actor.email,
            actorRole: actor.userType,
            action: "SCHOOL_DOCUMENT_ARCHIVED",
            resource: "IssuedSchoolDocument",
            entityId: String(saved._id),
            details: `Archived ${input.type} document ${reference}.`,
          },
        ],
        { session },
      );
    });
    return saved;
  } catch (error: any) {
    if (error.code === 11000) {
      const existing = await IssuedSchoolDocument.findOne({
        schoolId: actor.schoolId,
        requestId: input.requestId,
      });
      if (existing?.sourceHash === sourceHash) return existing;
    }
    throw error;
  } finally {
    await session.endSession();
    if (archivedPhotoId)
      await deleteStudentPhoto(archivedPhotoId).catch(() => {});
  }
}
