import { z } from "zod";

export const challanTemplateSchema = z.object({
  design: z.enum(["classic", "modern", "minimal"]),
  color: z.string().regex(/^#[a-f0-9]{6}$/i),
  monochrome: z.boolean(),
  fontSize: z.number().min(7).max(9),
  borderWidth: z.number().min(0.4).max(1.5),
  spacing: z.number().min(2).max(5),
  paper: z.enum(["A4", "A5", "Letter", "Custom"]),
  width: z.number().min(148).max(420),
  height: z.number().min(210).max(420),
  orientation: z.enum(["portrait", "landscape"]),
  arrangement: z.enum(["stacked", "columns"]),
  margin: z.number().min(5).max(15),
  copyLabels: z.array(z.string().trim().min(1).max(30)).length(3),
  logoSize: z.number().min(10).max(18),
  logoPosition: z.enum(["left", "right", "hidden"]),
  showStructure: z.boolean(),
  showCategory: z.boolean(),
  showSignatures: z.boolean(),
  showStamp: z.boolean(),
}).strict().superRefine((v, ctx) => {
  const { panelWidth, panelHeight } = challanGeometry(v);
  if (panelWidth < 185 || panelHeight < 245)
    ctx.addIssue({ code: "custom", message: "Three readable copies do not fit this paper and arrangement. Choose A4 portrait stacked or A4 landscape columns with 5 mm margins." });
});
export type ChallanTemplate = z.infer<typeof challanTemplateSchema>;
export function getFreeChallanLabel(challan: any): string | null {
  const breakdown = challan?.feeBreakdown || {};
  const total = Number(challan?.totalAmountPKR ?? 0);
  const balance = Number(challan?.currentPayablePKR ?? challan?.remainingAmountPKR ?? 0);
  const prior = Number(challan?.previousBalance ?? 0);
  const paid = Number(challan?.paidAmountPKR ?? 0);
  const recordedFine = Number(breakdown.lateFeeFine ?? 0);
  if (![total, balance, prior, paid, recordedFine].every(Number.isFinite)) return null;
  if (total !== 0 || balance !== 0 || prior !== 0 || paid !== 0 || recordedFine !== 0) return null;
  const grossCharges = ["tuitionFee", "admissionFee", "examFee", "transportFee", "computerFee", "libraryFee", "otherCharges"].reduce((sum, key) => sum + Number(breakdown[key] || 0), 0)
    + (Array.isArray(breakdown.customCharges) ? breakdown.customCharges.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0) : 0);
  if (/free/i.test(String(challan?.feeStructureTitle || "")) || grossCharges === 0) return "FREE EDUCATION - NO FEE PAYABLE";
  if (/waiv/i.test(String(challan?.feeStructureTitle || "")) || Number(breakdown.discount || 0) > 0 || Number(breakdown.scholarship || 0) > 0 || Number(challan?.concessionAmount || 0) > 0) return "FEE WAIVED - NO PAYMENT REQUIRED";
  return "NO FEE PAYABLE - PKR 0.00";
}
export const defaultChallanTemplate = (): ChallanTemplate => ({
  design: "classic", color: "#243746", monochrome: false, fontSize: 7,
  borderWidth: 0.6, spacing: 2, paper: "A4", width: 210, height: 297,
  orientation: "portrait", arrangement: "stacked", margin: 5,
  copyLabels: ["SCHOOL COPY", "BANK COPY", "STUDENT COPY"],
  logoSize: 10, logoPosition: "left", showStructure: true, showCategory: true,
  showSignatures: false, showStamp: false,
});
export function challanGeometry(v: Omit<ChallanTemplate, never>) {
  const sizes = { A4: [210, 297], A5: [148, 210], Letter: [215.9, 279.4], Custom: [v.width, v.height] };
  const dims = sizes[v.paper];
  const width = (v.orientation === "portrait" ? Math.min(...dims) : Math.max(...dims)) * 72 / 25.4;
  const height = (v.orientation === "portrait" ? Math.max(...dims) : Math.min(...dims)) * 72 / 25.4;
  const margin = v.margin * 72 / 25.4, gap = 8;
  return { width, height, margin, gap,
    panelWidth: v.arrangement === "columns" ? (width - 2 * margin - 2 * gap) / 3 : width - 2 * margin,
    panelHeight: v.arrangement === "stacked" ? (height - 2 * margin - 2 * gap) / 3 : height - 2 * margin };
}
