import { SchoolService } from "./school.service";
import { normalizeCardImage } from "./identityCardRender.service";
import { FeeCalculationService } from "./feeCalculation.service";
import { challanGeometry, challanTemplateSchema, defaultChallanTemplate, getFreeChallanLabel, ChallanTemplate } from "../../lib/challan-template";
const PDFDocument = require("pdfkit");
export interface ChallanPrintOptions { template?: ChallanTemplate; }
const money = (n: any) => Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (d: any) => d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }) : "-";

export class ChallanPdfService {
  static generateStudentChallanPdf(schoolId: string, challan: any, options: ChallanPrintOptions = {}): Promise<Buffer> {
    return this.generateClassChallanBatchPdf(schoolId, [challan], options);
  }
  static async generateClassChallanBatchPdf(schoolId: string, challans: any[], options: ChallanPrintOptions = {}): Promise<Buffer> {
    if (!challans.length) throw { statusCode: 400, message: "Select saved challans to print." };
    const profile = challans.every(c => c.documentSnapshot?.school) ? null : await SchoolService.getSchoolProfile(schoolId);
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, info: { Title: "School fee challans" } });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (b: Buffer) => chunks.push(b)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    });
    const images = new Map<string, Buffer | undefined>();
    try {
      for (const c of challans) {
        const school = c.documentSnapshot?.school || profile;
        const savedTemplate = c.documentSnapshot?.challanTemplate || profile?.documentSettings?.challanTemplate;
        const template = options.template || savedTemplate || defaultChallanTemplate();
        const parsedTemplate = challanTemplateSchema.safeParse(template);
        if (!parsedTemplate.success) throw { statusCode: 409, message: `Saved challan template for ${c.challanNumber || "this challan"} is invalid. Review School Admin document template settings before printing.` };
        const style = parsedTemplate.data;
        const g = challanGeometry(style);
        let logo: Buffer | undefined;
        if (school.logoUrl && style.logoPosition !== "hidden") {
          if (!images.has(school.logoUrl)) {
            let bytes: Buffer | undefined;
            try { const url = await normalizeCardImage(school.logoUrl); if (url?.includes("base64,")) bytes = Buffer.from(url.split(",")[1], "base64"); } catch {}
            images.set(school.logoUrl, bytes);
          }
          logo = images.get(school.logoUrl);
          if (logo && (style.monochrome || style.design === "minimal")) logo = await require("sharp")(logo).grayscale().png().toBuffer();
        }
        doc.addPage({ size: [g.width, g.height], margin: 0 });
        const compactHeight = style.arrangement === "stacked" ? this.panelHeightEstimate(school, c, style, logo) : g.panelHeight;
        let nextStackedY = style.arrangement === "stacked"
          ? Math.max(g.margin, (g.height - (compactHeight * 3 + g.gap * 2)) / 2)
          : g.margin;
        for (let i = 0; i < 3; i++) {
          const x = g.margin + (style.arrangement === "columns" ? i * (g.panelWidth + g.gap) : 0);
          const y = style.arrangement === "stacked" ? nextStackedY : g.margin;
          const usedHeight = this.panel(doc, school, c, style, style.copyLabels[i], x, y, g.panelWidth, g.panelHeight, logo);
          if (style.arrangement === "stacked") {
            nextStackedY += usedHeight + g.gap;
            if (i === 2) nextStackedY -= g.gap;
            if (nextStackedY > g.height - g.margin + 0.1) throw { statusCode: 400, message: `Challan ${c.challanNumber || "preview"} needs more space. Choose landscape columns, reduce optional fields or select 7 pt compact spacing. No clipped PDF was generated.` };
          }
          if (i < 2) {
            doc.save().strokeColor("#777777").lineWidth(0.4).dash(3, { space: 3 });
            if (style.arrangement === "stacked") doc.moveTo(x, y + usedHeight + g.gap / 2).lineTo(x + g.panelWidth, y + usedHeight + g.gap / 2).stroke();
            else doc.moveTo(x + g.panelWidth + 4, y).lineTo(x + g.panelWidth + 4, y + g.panelHeight).stroke();
            doc.restore();
          }
        }
      }
      doc.end();
      return await done;
    } catch (error) { doc.end(); await done; throw error; }
  }
  private static panelHeightEstimate(school: any, c: any, s: ChallanTemplate, logo?: Buffer): number {
    const f = s.fontSize, pad = 4, rowH = f + s.spacing + 3;
    const logoW = logo ? Math.min(s.logoSize * 72 / 25.4, rowH * 2.4) : 0;
    const header = rowH + rowH - 1 + Math.max(rowH, logoW) + 2;
    const b = c.feeBreakdown || {};
    const entries = 1 + [b.admissionFee,b.examFee,b.transportFee,b.computerFee,b.libraryFee,b.otherCharges].filter(n => Number(n) > 0).length + (b.customCharges || []).length + (Number(b.discount || c.concessionAmount) > 0 ? 1 : 0) + (Number(b.scholarship) > 0 ? 1 : 0) + (!c.previousBalanceInformational && Number(c.previousBalance || b.arrears) > 0 ? 1 : 0) + (Number(b.lateFeeFine) > 0 ? 1 : 0);
    const columns = challanGeometry(s).panelWidth > 430 && entries > 4 ? 2 : 1;
    let rows = 4 + (s.showStructure && c.feeStructureTitle || c.academicSession ? 1 : 0) + 1 + Math.ceil(entries / columns) + 1;
    if (c.previousBalanceInformational && c.previousBalance > 0) rows++;
    if (c.appliedEarlyDiscountPKR) rows++;
    if (c.paidAmountPKR) rows++;
    if (Number(c.paidAmountPKR) > 0 || c.status === "PARTIAL") rows++;
    if (c.earlyPaymentDiscount > 0 && !c.paidAmountPKR && c.earlyPaymentDeadline) rows++;
    const policy = c.lateFeeFinePolicy || {};
    const policyText = c.lateFinePolicyModel === "RECURRING" || c.lateFinePolicyModel === "STAGES" || c.lateFinePolicyModel === "ONE_TIME";
    const bank = school.bankDetails || c.documentSnapshot?.bank;
    if (s.showSignatures || s.showStamp) rows++;
    const noteRows = (policyText ? rowH + 1 : 0) + (bank?.enabled && (bank.bankName || bank.accountNumber || bank.instructions) ? rowH + 1 : 0);
    return pad * 2 + header + rows * rowH + noteRows;
  }
  private static panel(doc: any, school: any, c: any, s: ChallanTemplate, label: string, x: number, y: number, w: number, h: number, logo?: Buffer): number {
    const f = s.fontSize, pad = 4, ix = x + pad, iw = w - pad * 2;
    const b = c.feeBreakdown || {};
    const freeLabel = getFreeChallanLabel(c);
    const trulyFree = Boolean(freeLabel);
    const ink = "#111111";
    const accent = s.monochrome || s.design === "minimal" ? ink : s.design === "classic" ? ink : s.color;
    const rowH = f + s.spacing + 3;
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthTag = (() => {
      const value = String(c.month || "");
      const iso = /^(\d{4})-(\d{2})/.exec(value);
      if (iso) return months[Number(iso[2]) - 1] || "";
      return value.slice(0, 3).toUpperCase();
    })();
    doc.save();
    if (s.design === "modern" && !s.monochrome) doc.rect(x, y, w, 2.5).fill(s.color);
    const cell = (value: any, tx: number, ty: number, width: number, bold = false, align: "left" | "right" | "center" = "left", size = f) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(ink);
      doc.text(String(value ?? ""), tx, ty + 1.5, { width, height: rowH, align, ellipsis: true, lineBreak: false });
    };
    const hline = (yy: number) => { doc.strokeColor(accent).moveTo(ix, yy).lineTo(ix + iw, yy).stroke(); };
    let cy = y + pad;
    const labelW = Math.min(92, iw * 0.28);
    const logoW = logo ? Math.min(s.logoSize * 72 / 25.4, rowH * 2.4) : 0;
    if (logo && s.logoPosition === "left") { try { doc.image(logo, ix, cy, { fit: [logoW, logoW] }); } catch {} }
    const nameX = ix + (logo && s.logoPosition === "left" ? logoW + 4 : 0);
    const nameW = iw - labelW - 6 - (logo ? logoW + 4 : 0);
    cell(String(school.name || "School").toUpperCase(), nameX, cy, nameW, true, "left", f + 1.5);
    doc.lineWidth(s.borderWidth).strokeColor(accent).rect(ix + iw - labelW, cy, labelW, rowH).stroke();
    cell(label, ix + iw - labelW + 2, cy, labelW - 4, true, "center");
    cy += rowH;
    cell("FEE CHALLAN VOUCHER", nameX, cy, nameW, true);
    if (logo && s.logoPosition === "right") { try { doc.image(logo, ix + iw - logoW, cy, { fit: [logoW, logoW] }); } catch {} }
    cy += rowH - 1;
    cell([school.branchName, school.address, school.phone].filter(Boolean).join("  |  "), nameX, cy, iw - (logo && s.logoPosition === "right" ? logoW + 4 : 0) - (nameX - ix), false, "left", Math.max(6, f - 0.5));
    cy = Math.max(cy + rowH, y + pad + (logo && s.logoPosition === "left" ? logoW : 0)) + 2;
    const classLabel = [s.showCategory && c.classCategoryName, c.className, c.sectionName ? `(${c.sectionName})` : ""].filter(Boolean).join(" ");
    const meta: Array<[string, string, string, string]> = [
      ["Class:", classLabel || "-", "Issue Date:", date(c.createdAt)],
      ["Student:", c.studentName || "-", "ID:", c.admissionNumber || "-"],
      ["Father:", c.fatherName || "-", "Challan:", c.challanNumber || "-"],
      ["Roll No:", c.rollNumber || "-", "Due Date:", date(c.dueDate)],
    ];
    const splits = [0, 0.16, 0.58, 0.76, 1];
    hline(cy);
    for (const fields of meta) {
      for (let i = 0; i < 4; i++) {
        const left = ix + iw * splits[i];
        const width = iw * (splits[i + 1] - splits[i]);
        if (i > 0) doc.moveTo(left, cy).lineTo(left, cy + rowH).stroke();
        cell(i % 2 === 0 ? fields[i] : fields[i], left + 2, cy, width - 4, i % 2 === 1);
      }
      cy += rowH;
      hline(cy);
    }
    if (s.showStructure && c.feeStructureTitle) {
      cell(`Fee structure: ${c.feeStructureTitle}${c.academicSession ? "   Session: " + c.academicSession : ""}`, ix + 2, cy, iw - 4, false);
      cy += rowH;
      hline(cy);
    } else if (c.academicSession) {
      cell(`Session: ${c.academicSession}    Status: ${c.status || "PENDING"}`, ix + 2, cy, iw - 4, false);
      cy += rowH;
      hline(cy);
    }
    if (trulyFree) {
      cell(freeLabel, ix + 2, cy, iw - 4, true, "center");
      cy += rowH;
      hline(cy);
    }
    const headFill = s.design === "minimal" || s.monochrome ? "#ffffff" : s.design === "modern" ? "#f4f7f8" : "#f2f2f2";
    doc.rect(ix, cy, iw, rowH).fill(headFill);
    doc.strokeColor(accent).rect(ix, cy, iw, rowH).stroke();
    cell("Particulars", ix + 3, cy, iw * 0.68, true);
    cell("Amount (PKR)", ix + iw * 0.68, cy, iw * 0.32 - 4, true, "right");
    cy += rowH;
    const entries: Array<[string, number, boolean]> = [
      ["TUITION FEE", Number(b.tuitionFee), true],
      ["ADMISSION FEE", Number(b.admissionFee), false],
      ["EXAMINATION FEE", Number(b.examFee), false],
      ["TRANSPORT FEE", Number(b.transportFee), false],
      ["COMPUTER FEE", Number(b.computerFee), false],
      ["LIBRARY FEE", Number(b.libraryFee), false],
      ["OTHER CHARGES", Number(b.otherCharges), false],
    ].filter(([, n]) => Number(n) > 0) as any;
    if (trulyFree) entries.unshift(["TUITION FEE", Number(b.tuitionFee || 0), true]);
    if (trulyFree) {
      const present = new Set(entries.map((entry) => entry[0]));
      for (const [label, key] of [["ADMISSION FEE", "admissionFee"], ["EXAMINATION FEE", "examFee"], ["TRANSPORT FEE", "transportFee"], ["COMPUTER FEE", "computerFee"], ["LIBRARY FEE", "libraryFee"], ["OTHER CHARGES", "otherCharges"]] as const) {
        if (!present.has(label)) entries.push([label, Number(b[key] || 0), false]);
      }
    }
    for (const item of b.customCharges || []) entries.push([String(item.label), Number(item.amount), false]);
    if (Number(b.discount || c.concessionAmount) > 0) entries.push(["CONCESSION / DISCOUNT", -Number(b.discount || c.concessionAmount), false]);
    if (Number(b.scholarship) > 0) entries.push(["SCHOLARSHIP", -Number(b.scholarship), false]);
    if (!c.previousBalanceInformational && Number(c.previousBalance || b.arrears) > 0) entries.push(["PREVIOUS DUES", Number(c.previousBalance || b.arrears), false]);
    if (Number(b.lateFeeFine) > 0) entries.push(["RECORDED LATE FINE", Number(b.lateFeeFine), false]);
    const drawEntry = (title: string, value: number, withMonth: boolean, left: number, width: number) => {
      doc.strokeColor(accent).rect(left, cy, width, rowH).stroke();
      if (withMonth && monthTag) {
        cell(title, left + 3, cy, width * 0.48, true);
        const badgeX = left + width * 0.5;
        doc.strokeColor(accent).rect(badgeX, cy + 1.5, 28, rowH - 3).stroke();
        cell(monthTag, badgeX, cy, 28, true, "center", Math.max(6, f - 0.5));
      } else cell(title, left + 3, cy, width * 0.62, false);
      cell(money(value), left + width * 0.62, cy, width * 0.38 - 4, true, "right");
    };
    const columns = iw > 430 && entries.length > 4 ? 2 : 1;
    const colW = iw / columns;
    for (let i = 0; i < entries.length; i += columns) {
      for (let j = 0; j < columns; j++) {
        const item = entries[i + j];
        if (!item) continue;
        drawEntry(item[0], item[1], item[2], ix + j * colW, colW);
      }
      cy += rowH;
    }
    const total = (title: string, value: number) => {
      doc.strokeColor(accent).rect(ix, cy, iw, rowH).stroke();
      cell(title, ix + 3, cy, iw * 0.62, true);
      cell(money(value), ix + iw * 0.62, cy, iw * 0.38 - 4, true, "right");
      cy += rowH;
    };
    total(Number(c.paidAmountPKR) > 0 ? "TOTAL CHARGES" : "Total Payable", Number(c.totalAmountPKR));
    if (trulyFree) total("Status: No Payment Required", 0);
    if (c.previousBalanceInformational && c.previousBalance > 0) total("Prior invoices (pay separately)", c.previousBalance);
    if (c.appliedEarlyDiscountPKR) total("Early discount applied", -c.appliedEarlyDiscountPKR);
    if (c.paidAmountPKR) total("Payments recorded", c.paidAmountPKR);
    if (Number(c.paidAmountPKR) > 0 || c.status === "PARTIAL") {
      const payable = FeeCalculationService.evaluateCurrentPayable(c);
      total("Remaining balance", payable.payableAmount);
    }
    if (c.earlyPaymentDiscount > 0 && !c.paidAmountPKR && c.earlyPaymentDeadline) {
      doc.strokeColor(accent).rect(ix, cy, iw, rowH).stroke();
      cell(`Pay till ${date(c.earlyPaymentDeadline)} (-Rs. ${money(c.earlyPaymentDiscount)} Discount)`, ix + 3, cy, iw * 0.68, true);
      cell(`Rs. ${money(c.amountPayableWithEarlyDiscount)}`, ix + iw * 0.68, cy, iw * 0.32 - 4, true, "right");
      cy += rowH;
    }
    const policy = c.lateFeeFinePolicy || {};
    const policyText = trulyFree ? "" : c.lateFinePolicyModel === "RECURRING"
      ? `Late fine: ${policy.dailyRate || 0}${policy.type === "PERCENTAGE" ? "% of unpaid balance" : " PKR"} per day after ${policy.graceDays || 0} grace day(s). Cap PKR ${money(policy.maxFineCap)}.`
      : c.lateFinePolicyModel === "STAGES"
        ? `Late fine by date: ${(c.lateFineStages || []).map((st: any) => `${st.label} PKR ${money(st.fineAmount)} (payable ${money(st.payableAmount)})`).join("; ")}`
        : c.lateFinePolicyModel === "ONE_TIME"
          ? `After ${date(c.lateFineStages?.[0]?.deadlineDate || c.dueDate)} late fine PKR ${money(c.lateFineStages?.[0]?.fineAmount ?? policy.amount ?? Math.max(0, Number(c.amountPayableAfterDueDate || 0) - Number(c.totalAmountPKR || 0)))}. Payable PKR ${money(c.amountPayableAfterDueDate || Number(c.totalAmountPKR) + Number(c.lateFineStages?.[0]?.fineAmount || 0))}.`
          : "";
    if (policyText) {
      cell(policyText, ix + 3, cy + 1, iw - 6, false, "left", Math.max(6, f - 0.5));
      cy += rowH + 1;
    }
    const bank = school.bankDetails || c.documentSnapshot?.bank;
    if (bank?.enabled && (bank.bankName || bank.accountNumber || bank.instructions)) {
      cell([bank.bankName, bank.accountTitle, bank.accountNumber && `A/C ${bank.accountNumber}`, bank.iban && `IBAN ${bank.iban}`, bank.instructions].filter(Boolean).join("  |  "), ix + 3, cy + 1, iw - 6, false, "left", Math.max(6, f - 0.5));
      cy += rowH + 1;
    }
    if (s.showSignatures || s.showStamp) {
      cell([s.showSignatures && "Authorized signature ________", s.showStamp && "Stamp ________"].filter(Boolean).join("      "), ix + 3, cy + 1, iw - 6);
      cy += rowH;
    }
    const contentHeight = cy - y + pad;
    if (contentHeight > h - 2) throw { statusCode: 400, message: `Challan ${c.challanNumber || "preview"} needs more space at this font size. Choose landscape columns or a larger custom sheet, reduce optional fields or select 7 pt compact spacing. No clipped PDF was generated.` };
    doc.lineWidth(s.borderWidth).strokeColor(accent).rect(x, y, w, contentHeight).stroke();
    doc.restore();
    return contentHeight;
  }
}
