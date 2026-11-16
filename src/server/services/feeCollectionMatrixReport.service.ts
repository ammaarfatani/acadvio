import * as XLSX from "xlsx";
import { Student } from "../models/student.model";
import { FeeChallan, FeePayment } from "../models/fee.model";
import { AcademicSession } from "../models/academicSession.model";
import { ClassCategory } from "../models/classCategory.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { Branch } from "../models/branch.model";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { branchContext } from "../utils/branchScope";
import { SchoolService } from "./school.service";
import { normalizeCardImage } from "./identityCardRender.service";
import { feeMonthFromRecord } from "../../lib/fee-math";

const PDFDocument = require("pdfkit");
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const CENT = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const dateBoundary = (date: string, end = false) => new Date(`${date}T${end ? "23:59:59.999" : "00:00:00.000"}+05:00`);
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() + 1 === month && candidate.getUTCDate() === day;
};
const billingMonthNumber = (month: unknown, dueDate?: unknown) => {
  const normalized = feeMonthFromRecord(month, dueDate);
  if (!normalized) return 0;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(normalized);
  return match ? Number(match[2]) : 0;
};
const money = (value: unknown) => CENT(Number(value) || 0);

export type FeeCollectionMatrixInput = {
  academicSessionId: string; fromDate: string; toDate: string;
  branchId?: string; classCategoryId?: string; classId?: string; sectionId?: string;
};

const columns = ["discount", "admission", "annual", "late", "lab", "other", ...MONTHS.map(m => m.toLowerCase()), "unallocatedMonth", "unallocatedComponents", "total"] as const;
type Values = Record<(typeof columns)[number], number>;
const blankValues = (): Values => Object.fromEntries(columns.map(key => [key, 0])) as Values;
const sumValues = (into: Values, from: Partial<Values>) => { for (const key of columns) into[key] = CENT(into[key] + money(from[key])); };

function explicitPaymentAllocations(payment: any): Partial<Values> | null {
  const source = payment?.documentSnapshot?.paymentAllocation || payment?.documentSnapshot?.allocations;
  if (!source) return null;
  const entries = Array.isArray(source)
    ? source.map((row: any) => [row?.category || row?.component || row?.label, row?.amountPKR ?? row?.amount])
    : Object.entries(source);
  const result: Partial<Values> = {};
  for (const [rawKey, rawAmount] of entries) {
    const label = String(rawKey || "").toLowerCase().replace(/[^a-z]/g, "");
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const key = label.includes("admission") ? "admission" : label.includes("annual") ? "annual" : label.includes("late") || label.includes("fine") ? "late" : label.includes("lab") ? "lab" : label === "other" || label.includes("misc") ? "other" : null;
    if (key) result[key] = money((result[key] || 0) + amount);
  }
  return Object.keys(result).length ? result : null;
}

export function buildFeeCollectionMatrix(input: {
  school: any; session: any; branchScope: string; generatedAt: string;
  students: any[]; classes: any[]; categories: any[]; challans: any[]; payments: any[];
  fromDate?: string; toDate?: string; filters?: Record<string, string>;
}) {
  const studentById = new Map(input.students.map(student => [String(student._id), student]));
  const classById = new Map(input.classes.map(cls => [String(cls._id), cls]));
  const categoryById = new Map(input.categories.map(category => [String(category._id), category.name]));
  const challanById = new Map(input.challans.map(challan => [String(challan._id), challan]));
  const categoryRows = new Map<string, any>();
  const rowByKey = new Map<string, any>();
  const uniquePayments: any[] = [];
  const seenPaymentIds = new Set<string>();
  let skippedPaymentRecords = 0, duplicatePaymentRecords = 0;

  for (const payment of input.payments) {
    const paymentKey = payment.receiptNumber ? `receipt:${payment.receiptNumber}` : String(payment._id || `${payment.challanId}:${payment.paidAt}:${payment.amountPKR}`);
    if (seenPaymentIds.has(paymentKey)) { duplicatePaymentRecords++; continue; }
    seenPaymentIds.add(paymentKey);
    uniquePayments.push(payment);
  }
  const ledgerTotalPKR = CENT(uniquePayments.reduce((sum, payment) => sum + money(payment.amountPKR), 0));
  for (const payment of uniquePayments) {
    const challan = challanById.get(String(payment.challanId));
    if (!challan || challan.isVoided || challan.status === "VOIDED") { skippedPaymentRecords++; continue; }
    const student = studentById.get(String(payment.studentId));
    const cls = classById.get(String(challan.classId || student?.classId));
    const categoryId = String(cls?.classCategoryId || challan.classCategoryName || cls?.classCategoryName || "uncategorized");
    const categoryName = categoryById.get(categoryId) || categoryId;
    const sectionName = String(challan.sectionName || student?.sectionName || "-");
    const rowKey = [String(payment.studentId), String(challan.classId || student?.classId || ""), sectionName].join(":");
    if (!categoryRows.has(categoryId)) categoryRows.set(categoryId, { id: categoryId, name: categoryName, studentKeys: new Set<string>(), rows: [], totals: blankValues() });
    const category = categoryRows.get(categoryId);
    let row = rowByKey.get(rowKey);
    if (!row) {
      row = {
        key: rowKey, studentId: String(payment.studentId), id: String(student?.studentId || "-"),
        rollNumber: String(student?.rollNumber || payment.rollNumber || "-"),
        name: String(student?.name || payment.studentName || "Unmatched student"),
        className: String(challan.className || student?.className || "-"), sectionName,
        values: blankValues(), challanIds: new Set<string>(),
      };
      rowByKey.set(rowKey, row); category.rows.push(row); category.studentKeys.add(String(payment.studentId));
    }
    const amount = money(payment.amountPKR);
    const allocation = explicitPaymentAllocations(payment);
    if (allocation) {
      const componentKeys = ["admission", "annual", "late", "lab", "other"] as const;
      const allocatedTotal = CENT(componentKeys.reduce((sum, key) => sum + money(allocation[key]), 0));
      const scale = allocatedTotal > amount && allocatedTotal > 0 ? amount / allocatedTotal : 1;
      let distributed = 0;
      componentKeys.forEach((key, index) => {
        const share = index === componentKeys.length - 1 ? Math.min(amount - distributed, money(allocation[key]) * scale) : money(money(allocation[key]) * scale);
        row.values[key] = CENT(row.values[key] + share); distributed = CENT(distributed + share);
      });
      row.values.unallocatedComponents = CENT(row.values.unallocatedComponents + Math.max(0, amount - distributed));
    } else row.values.unallocatedComponents = CENT(row.values.unallocatedComponents + amount);

    // The persisted challan period is authoritative; the receipt snapshot is a
    // persisted fallback for legacy challans. A linked due date may recover a
    // legacy month-name year. Receipt dates are never used as a billing period.
    const snapshotChallan = payment.documentSnapshot?.challan;
    const month = [
      billingMonthNumber(challan.month, challan.dueDate),
      billingMonthNumber(snapshotChallan?.month ?? payment.documentSnapshot?.month, challan.dueDate ?? snapshotChallan?.dueDate),
    ].find(value => value > 0) || 0;
    const monthKey = month >= 4 ? MONTHS[month - 4].toLowerCase() : month >= 1 && month <= 3 ? MONTHS[month + 8].toLowerCase() : "";
    if (monthKey) row.values[monthKey] = CENT(row.values[monthKey] + amount);
    else row.values.unallocatedMonth = CENT(row.values.unallocatedMonth + amount);
    row.values.total = CENT(row.values.total + amount);

    const challanId = String(challan._id);
    if (!row.challanIds.has(challanId)) {
      row.challanIds.add(challanId);
      const breakdown = challan.feeBreakdown || {};
      row.values.discount = CENT(row.values.discount + Math.max(0, money(breakdown.discount) + money(breakdown.scholarship)));
    }
  }

  const categoryOrder = new Map(input.categories.map((category, index) => [String(category._id), index]));
  const categories = [...categoryRows.values()].sort((a, b) => (categoryOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)).map(category => {
    category.rows.sort((a: any, b: any) => a.className.localeCompare(b.className) || a.sectionName.localeCompare(b.sectionName) || a.name.localeCompare(b.name));
    for (const row of category.rows) sumValues(category.totals, row.values);
    category.totalStudents = category.studentKeys.size;
    delete category.studentKeys;
    return category;
  });
  const totals = blankValues();
  for (const category of categories) sumValues(totals, category.totals);
  const monthTotal = CENT([...MONTHS.map(m => totals[m.toLowerCase() as keyof Values]), totals.unallocatedMonth].reduce((sum, value) => sum + value, 0));
  const componentTotal = CENT([totals.admission, totals.annual, totals.late, totals.lab, totals.other, totals.unallocatedComponents].reduce((sum, value) => sum + value, 0));
  const unallocatedMonthPKR = totals.unallocatedMonth;
  const unallocatedComponentPKR = totals.unallocatedComponents;
  return {
    school: { name: input.school.name || "School", logoUrl: input.school.logoUrl || input.school.documentSettings?.branding?.logoUrl || "", address: input.school.address || "", phone: input.school.phone || "" },
    session: input.session.name, branchScope: input.branchScope, fromDate: input.fromDate || "", toDate: input.toDate || "", filters: input.filters || {},
    generatedAt: input.generatedAt, categories, totals,
    grandTotalPKR: ledgerTotalPKR, ledgerTotalPKR, matrixTotalPKR: monthTotal,
    componentTotalPKR: componentTotal,
    componentReconciliationDifferencePKR: CENT(ledgerTotalPKR - componentTotal),
    reconciliationDifferencePKR: CENT(ledgerTotalPKR - monthTotal), skippedPaymentRecords, duplicatePaymentRecords,
    notes: [
      "Billing months come from each linked challan's saved month, with the saved receipt snapshot as a legacy fallback. Legacy month-only labels may use the linked challan due date to recover the year. Receipt dates only determine which payments are included; they are never used to invent a billing month.",
      "Monthly and component tables are two separate classifications of the same receipts. Do not add their totals together. Every receipt is counted once in each view, and the views reconcile independently to the ledger.",
      "Unallocated Billing Month means the linked challan has no usable saved billing month or due-date year. Unallocated Component means the receipt has no persisted fee-line allocation. Neither amount is guessed.",
      "Acadivo's payment ledger records receipts against challans, but does not persist payment-to-fee-line allocations. Admission, annual, late, lab and other columns use an explicit saved allocation when present; otherwise the receipt remains Unallocated Component.",
      "Discount shows applied invoice concessions for challans with receipts in the selected period. It is informational and excluded from collection totals.",
      "The current fee ledger does not store refund or reversal entries. Voided challans are excluded; the finance service blocks voiding paid challans.",
    ],
    unallocatedMonthPKR, unallocatedComponentPKR,
  };
}

export async function feeCollectionMatrixReport(actor: AuthenticatedUser, input: FeeCollectionMatrixInput) {
  if (!validDate(input.fromDate) || !validDate(input.toDate) || input.fromDate > input.toDate || dateBoundary(input.toDate, true).getTime() - dateBoundary(input.fromDate).getTime() > 731 * 86400000)
    throw { statusCode: 400, message: "Choose a valid receipt date range of no more than 731 days." };
  const session: any = await AcademicSession.findOne({ _id: input.academicSessionId, schoolId: actor.schoolId }).lean();
  if (!session) throw { statusCode: 400, message: "Choose an authorized academic session." };
  const context = branchContext.getStore();
  if (context?.branchId && input.branchId && String(context.branchId) !== input.branchId) throw { statusCode: 403, message: "You can only report on your assigned branch." };
  const branchId = context?.branchId || input.branchId;
  if (input.branchId && !await Branch.exists({ _id: input.branchId, organizationId: actor.schoolId })) throw { statusCode: 400, message: "Choose an authorized branch." };
  const category: any = input.classCategoryId ? await ClassCategory.findOne({ _id: input.classCategoryId, schoolId: actor.schoolId }).select("name").lean() : null;
  if (input.classCategoryId && !category) throw { statusCode: 400, message: "Choose an authorized class category." };
  const cls: any = input.classId ? await ClassModel.findOne({ _id: input.classId, schoolId: actor.schoolId, ...(input.classCategoryId ? { classCategoryId: input.classCategoryId } : {}) }).select("_id name").lean() : null;
  if (input.classId && !cls) throw { statusCode: 400, message: "Choose a class in the selected category." };
  if (input.sectionId && !input.classId) throw { statusCode: 400, message: "Choose a class before filtering by section." };
  const section: any = input.sectionId ? await SectionModel.findOne({ _id: input.sectionId, schoolId: actor.schoolId, ...(input.classId ? { classId: input.classId } : {}) }).select("_id name classId").lean() : null;
  if (input.sectionId && !section) throw { statusCode: 400, message: "Choose a section in the selected class." };
  const classIds = input.classCategoryId && !input.classId ? (await ClassModel.find({ schoolId: actor.schoolId, classCategoryId: input.classCategoryId }).select("_id").lean()).map((item: any) => item._id) : undefined;
  const [school, classes, categories, challans] = await Promise.all([
    SchoolService.getSchoolProfile(actor.schoolId!),
    ClassModel.find({ schoolId: actor.schoolId }).select("_id name classCategoryId classCategoryName").lean(),
    ClassCategory.find({ schoolId: actor.schoolId }).sort({ displayOrder: 1, name: 1 }).select("_id name displayOrder").lean(),
    FeeChallan.find({ schoolId: actor.schoolId, academicSession: session.name, isVoided: { $ne: true }, status: { $ne: "VOIDED" }, ...(branchId ? { branchId } : {}), ...(input.classId ? { classId: input.classId } : classIds ? { classId: { $in: classIds } } : {}), ...(section ? { sectionName: section.name } : {}) }).select("_id studentId classId className classCategoryName sectionName month dueDate feeBreakdown status isVoided").limit(50001).lean(),
  ]);
  if (challans.length > 50000) throw { statusCode: 413, message: "This report matches over 50,000 challans. Narrow the date range or class filters." };
  const challanIds = challans.map((item: any) => item._id);
  const payments: any[] = challanIds.length ? await FeePayment.find({ schoolId: actor.schoolId, challanId: { $in: challanIds }, amountPKR: { $gt: 0 }, paidAt: { $gte: dateBoundary(input.fromDate), $lte: dateBoundary(input.toDate, true) }, ...(branchId ? { branchId } : {}) }).select("_id studentId challanId amountPKR paidAt receiptNumber rollNumber studentName documentSnapshot").sort({ paidAt: 1, _id: 1 }).limit(50001).lean() : [];
  if (payments.length > 50000) throw { statusCode: 413, message: "This report matches over 50,000 receipts. Narrow the date range or class filters." };
  const studentIds = [...new Set(payments.map(payment => String(payment.studentId)))];
  const students: any[] = studentIds.length ? await Student.find({ schoolId: actor.schoolId, _id: { $in: studentIds } }).select("_id studentId name rollNumber classId className sectionName").lean() : [];
  const scope = branchContext.getStore();
  const selectedBranch: any = branchId ? await Branch.findOne({ _id: branchId, organizationId: actor.schoolId }).select("name").lean() : null;
  const branchScope = selectedBranch?.name || (scope?.branchId ? "Authorized branch" : "All authorized branches");
  const report = buildFeeCollectionMatrix({ school, session, branchScope, generatedAt: new Date().toISOString(), students, classes, categories, challans, payments,
    fromDate: input.fromDate, toDate: input.toDate, filters: { branchId: branchId || "", classCategory: category?.name || "All categories", className: cls?.name || "All classes", sectionName: section?.name || "All sections" } });
  return report;
}

export async function feeCollectionMatrixExcel(report: any) {
  const workbook = XLSX.utils.book_new();
  const identityHeaders = ["#", "Student ID", "Roll Number", "Student Name", "Class", "Section"];
  const common = [[report.school.name], ["Fee Collection Report - Monthly Matrix"], ["Academic Session", report.session], ["Receipt Date Range", `${report.fromDate} to ${report.toDate}`], ["Branch", report.branchScope], ["Generated", report.generatedAt]];
  const appendView = (sheetName: string, title: string, headers: string[], rowValues: (row: any, index: number) => any[], totalsFor: (values: Values) => number[]) => {
    const rows: any[][] = [...common, [title], [], [...identityHeaders, ...headers]];
    for (const category of report.categories) {
      rows.push([category.name, `Students: ${category.totalStudents}`]);
      category.rows.forEach((row: any, index: number) => rows.push([index + 1, row.id, row.rollNumber, row.name, row.className, row.sectionName, ...rowValues(row, index + 1)]));
      rows.push([`${category.name} Subtotal`, "", "", "", "", "", ...totalsFor(category.totals)]);
    }
    rows.push(["GRAND TOTAL", "", "", "", "", "", ...totalsFor(report.totals)]);
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [7, 16, 14, 30, 20, 13, ...Array(headers.length).fill(15)].map(wch => ({ wch }));
    for (const [address, cell] of Object.entries(sheet) as any) if (/^[A-Z]+\d+$/.test(address) && cell?.t === "n") cell.z = "#,##0.00;[Red](#,##0.00);-";
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  };
  appendView("By Billing Month", "COLLECTIONS BY BILLING MONTH", [...MONTHS.map(month => `${month} (PKR)`), "Unallocated Billing Month (PKR)", "Total (PKR)"],
    (row) => [...MONTHS.map(m => row.values[m.toLowerCase()]), row.values.unallocatedMonth, row.values.total],
    (values) => [...MONTHS.map(m => values[m.toLowerCase() as keyof Values]), values.unallocatedMonth, values.total]);
  appendView("By Component", "COLLECTIONS BY COMPONENT", ["Discount (PKR, info)", "Admission (PKR)", "Annual (PKR)", "Late Fine (PKR)", "Lab (PKR)", "Other (PKR)", "Unallocated Component (PKR)", "Total (PKR)"],
    (row) => [row.values.discount, row.values.admission, row.values.annual, row.values.late, row.values.lab, row.values.other, row.values.unallocatedComponents, row.values.total],
    (values) => [values.discount, values.admission, values.annual, values.late, values.lab, values.other, values.unallocatedComponents, values.total]);
  const notes = [["Calculation Notes"], ...report.notes.map((note: string) => [note]), ["Billing month reconciliation", `Recorded receipt total PKR ${report.ledgerTotalPKR.toFixed(2)}; monthly view PKR ${report.matrixTotalPKR.toFixed(2)}; difference PKR ${report.reconciliationDifferencePKR.toFixed(2)}.`], ["Component reconciliation", `Recorded receipt total PKR ${report.ledgerTotalPKR.toFixed(2)}; component view PKR ${report.componentTotalPKR.toFixed(2)}; difference PKR ${report.componentReconciliationDifferencePKR.toFixed(2)}.`], ["Important", "The Billing Month and Component worksheets are separate classifications of the same receipts; do not add their totals together."], ["Unallocated Billing Month", `PKR ${report.unallocatedMonthPKR.toFixed(2)} is linked to challans without a usable billing month.`], ["Unallocated Component", `PKR ${report.unallocatedComponentPKR.toFixed(2)} has no saved payment-to-component allocation.`]];
  const noteSheet = XLSX.utils.aoa_to_sheet(notes); noteSheet["!cols"] = [{ wch: 120 }]; XLSX.utils.book_append_sheet(workbook, noteSheet, "Notes");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function feeCollectionMatrixPdf(report: any) {
  const doc = new PDFDocument({ size: "A3", layout: "landscape", margin: 30, bufferPages: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const image = await normalizeCardImage(report.school.logoUrl).catch(() => null);
  const RED = "#b91c1c", DARK = "#111827", PALE_RED = "#fef2f2", GRID = "#d1d5db";
  const pageWidth = doc.page.width, contentWidth = pageWidth - 60, pageBottom = doc.page.height - 48;
  const identity = ["#", "Student ID", "Roll No.", "Student Name", "Class", "Section"];
  const monthWidths = [24, 72, 48, 152, 74, 42, ...Array(12).fill(46), 88, 74];
  const monthLabels = [...identity, ...MONTHS.map(month => `${month} PKR`), "Unallocated\nBilling Month", "Total PKR"];
  const componentWidths = [24, 72, 48, 152, 74, 42, 72, 82, 70, 62, 62, 66, 106, 74];
  const componentLabels = [...identity, "Discount\n(PKR, info)", "Admission\n(PKR)", "Annual\n(PKR)", "Late Fine\n(PKR)", "Lab\n(PKR)", "Other\n(PKR)", "Unallocated\nComponent (PKR)", "Total PKR"];
  const moneyText = (value: number) => `PKR ${money(value).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const header = (sectionTitle: string, labels: string[], widths: number[]) => {
    const x0 = Math.max(30, (pageWidth - widths.reduce((sum, value) => sum + value, 0)) / 2);
    doc.rect(0, 0, pageWidth, 8).fill(RED);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(DARK).text(report.school.name, 30, 20, { width: contentWidth - (image ? 72 : 0), lineBreak: false });
    if (image) doc.image(Buffer.from(image.split(",")[1], "base64"), pageWidth - 70, 17, { fit: [40, 34] });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(RED).text("Fee Collection Report - Monthly Matrix", 30, 42);
    doc.font("Helvetica").fontSize(8).fillColor(DARK).text(`Academic Session: ${report.session}   |   Receipt dates: ${report.fromDate} to ${report.toDate}   |   Branch: ${report.branchScope}`, 30, 58, { width: contentWidth, lineBreak: false });
    doc.fontSize(7.5).text(`Category: ${report.filters?.classCategory || "All categories"}   |   Class: ${report.filters?.className || "All classes"}   |   Section: ${report.filters?.sectionName || "All sections"}   |   Generated: ${new Date(report.generatedAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`, 30, 72, { width: contentWidth, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(RED).text(`Receipts ${moneyText(report.ledgerTotalPKR)}   |   Billing-month difference ${moneyText(report.reconciliationDifferencePKR)}   |   Component difference ${moneyText(report.componentReconciliationDifferencePKR)}   |   Unallocated Billing Month ${moneyText(report.unallocatedMonthPKR)}   |   Unallocated Component ${moneyText(report.unallocatedComponentPKR)}`, 30, 86, { width: contentWidth, lineBreak: false });
    doc.font("Helvetica").fontSize(6.7).fillColor(DARK).text("Monthly and component tables are separate classifications of the same receipts; do not add them together. Unallocated Billing Month means no usable linked challan/snapshot period; Unallocated Component means no saved payment-to-fee-line allocation.", 30, 98, { width: contentWidth, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text(sectionTitle, x0, 115);
    let x = x0, y = 135;
    labels.forEach((label, index) => {
      const w = widths[index];
      doc.rect(x, y, w, 28).fillAndStroke(RED, "#991b1b");
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff").text(label, x + 3, y + (label.includes("\n") ? 5 : 9), { width: w - 6, height: 20, align: index >= 6 ? "right" : "left", lineBreak: true });
      x += w;
    });
    return { x0, y: y + 28, widths, labelWidth: widths.slice(0, 6).reduce((sum, value) => sum + value, 0), labels, sectionTitle };
  };
  const addPage = (state: any, continuedCategory?: string) => {
    doc.addPage({ size: "A3", layout: "landscape", margin: 30 });
    const next = header(state.sectionTitle, state.labels, state.widths);
    if (continuedCategory) {
      doc.rect(next.x0, next.y, state.widths.reduce((sum: number, value: number) => sum + value, 0), 19).fill(RED);
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text(`${continuedCategory} (continued)`, next.x0 + 5, next.y + 5);
      next.y += 19;
    }
    return next;
  };
  const row = (state: any, values: any[], mode: "normal" | "subtotal" | "grand" | "category" = "normal") => {
    const height = mode === "category" ? 20 : 19;
    const totalWidth = state.widths.reduce((sum: number, value: number) => sum + value, 0);
    if (mode === "category") {
      doc.rect(state.x0, state.y, totalWidth, height).fill(RED);
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff").text(String(values[0]), state.x0 + 5, state.y + 5, { lineBreak: false });
      state.y += height;
      return;
    }
    const fill = mode === "grand" ? RED : mode === "subtotal" ? PALE_RED : "#ffffff";
    const ink = mode === "grand" ? "#ffffff" : DARK;
    const amountStart = mode === "normal" ? 0 : 6;
    let x = state.x0;
    if (mode !== "normal") {
      doc.rect(x, state.y, state.labelWidth, height).fillAndStroke(fill, mode === "grand" ? RED : GRID);
      const label = String(values[0] ?? "");
      doc.font("Helvetica-Bold").fontSize(8).fillColor(ink).text(label, x + 4, state.y + 5, { width: state.labelWidth - 8, lineBreak: false });
      x += state.labelWidth;
    }
    values.slice(amountStart).forEach((value: any, visibleIndex: number) => {
      const index = mode === "normal" ? visibleIndex : visibleIndex + 6;
      const w = state.widths[index];
      doc.rect(x, state.y, w, height).fillAndStroke(fill, mode === "grand" ? RED : GRID);
      const text = typeof value === "number" ? (index >= 6 ? money(value).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value)) : String(value ?? "");
      const bold = mode !== "normal";
      let size = index === 3 ? 8 : 7.6;
      const minSize = index === 1 ? 6 : index === 3 ? 6.5 : 6.2;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      while (size > minSize && doc.widthOfString(text, { font: bold ? "Helvetica-Bold" : "Helvetica", size }) > w - 7) size = Math.max(minSize, size - 0.25);
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(ink).text(text, x + 3, state.y + 5, { width: w - 7, align: index >= 6 ? "right" : "left", lineBreak: false });
      x += w;
    });
    state.y += height;
  };
  const renderView = (title: string, labels: string[], widths: number[], rowValues: (row: any, index: number) => any[], summaryValues: (totals: Values) => number[]) => {
    const state = header(title, labels, widths);
    for (const category of report.categories) {
      if (state.y + 20 + 19 * 2 > pageBottom) Object.assign(state, addPage(state));
      row(state, [`${category.name}  |  Students with receipts: ${category.totalStudents}`], "category");
      for (let index = 0; index < category.rows.length; index++) {
        if (state.y + 19 > pageBottom) Object.assign(state, addPage(state, category.name));
        row(state, rowValues(category.rows[index], index + 1));
      }
      if (state.y + 19 > pageBottom) Object.assign(state, addPage(state, category.name));
      row(state, [`${category.name} SUBTOTAL`, "", "", "", "", "", ...summaryValues(category.totals)], "subtotal");
    }
    if (state.y + 19 > pageBottom) Object.assign(state, addPage(state));
    row(state, ["GRAND TOTAL", "", "", "", "", "", ...summaryValues(report.totals)], "grand");
    return state;
  };
  const monthRow = (student: any, index: number) => [index, student.id, student.rollNumber, student.name, student.className, student.sectionName, ...MONTHS.map(month => student.values[month.toLowerCase()]), student.values.unallocatedMonth, student.values.total];
  const monthTotals = (values: Values) => [...MONTHS.map(month => values[month.toLowerCase() as keyof Values]), values.unallocatedMonth, values.total];
  const componentRow = (student: any, index: number) => [index, student.id, student.rollNumber, student.name, student.className, student.sectionName, student.values.discount, student.values.admission, student.values.annual, student.values.late, student.values.lab, student.values.other, student.values.unallocatedComponents, student.values.total];
  const componentTotals = (values: Values) => [values.discount, values.admission, values.annual, values.late, values.lab, values.other, values.unallocatedComponents, values.total];
  renderView("COLLECTIONS BY BILLING MONTH", monthLabels, monthWidths, monthRow, monthTotals);
  doc.addPage({ size: "A3", layout: "landscape", margin: 30 });
  renderView("COLLECTIONS BY COMPONENT", componentLabels, componentWidths, componentRow, componentTotals);
  const pageRange = doc.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index++) {
    doc.switchToPage(index);
    doc.rect(30, doc.page.height - 48, contentWidth, 1).fill(RED);
    doc.font("Helvetica").fontSize(7).fillColor(DARK).text("Acadivo  |  Confidential school finance report", 30, doc.page.height - 40, { width: contentWidth / 2, lineBreak: false, height: 8 });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(RED).text(`Page ${index + 1} of ${pageRange.count}`, 30, doc.page.height - 40, { width: contentWidth, align: "right", lineBreak: false, height: 8 });
  }
  doc.end(); return done;
}
