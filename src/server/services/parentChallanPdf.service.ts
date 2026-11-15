import { FeeChallan } from "../models/fee.model";
import { linkedChild } from "./parent.service";
import { hasFeature } from "../../lib/plan-features";
import { ChallanPdfService } from "./challanPdf.service";

export async function parentChallanPdf(actor: any, studentId: string, challanId: string) {
  if (!hasFeature(actor.plan, "FINANCE")) {
    throw { statusCode: 403, message: "Finance is not available for this school." };
  }
  await linkedChild(actor, studentId);
  const c: any = await FeeChallan.findOne({
    _id: challanId,
    studentId,
    schoolId: actor.schoolId,
    isVoided: { $ne: true },
    status: { $ne: "VOIDED" },
  }).lean();
  if (!c) throw { statusCode: 404, message: "Fee challan not found." };

  const pdfBuffer = await ChallanPdfService.generateStudentChallanPdf(actor.schoolId, c);

  return {
    file: pdfBuffer.toString("base64"),
    filename: `${c.challanNumber}-3copies.pdf`,
    mime: "application/pdf",
  };
}
