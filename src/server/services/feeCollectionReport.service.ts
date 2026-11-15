import * as XLSX from "xlsx";
import { Student } from "../models/student.model";
import { FeeChallan, FeePayment, FeeStructure } from "../models/fee.model";
import { ClassCategory } from "../models/classCategory.model";
import { ClassModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
import { Branch } from "../models/branch.model";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { SchoolService } from "./school.service";
import { normalizeCardImage } from "./identityCardRender.service";
import { branchContext } from "../utils/branchScope";
const PDFDocument = require("pdfkit");

const monthKey = (value: any) => {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (match) return value;
    const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit" }).format(parsed);
};
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const feeReportMonthKeys = (from: string, to: string) => {
  const result: string[] = [];
  let [year, month] = from.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    if (++month === 13) { month = 1; year++; }
  }
  return result;
};
export function feeReportMonthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid fee report month.");
  return new Date(Date.UTC(year, monthNumber, 1) - 5 * 60 * 60 * 1000 - 1);
}
function components(breakdown: any) {
  const values: Record<string, number> = {};
  for (const key of ["tuitionFee", "examFee", "transportFee", "libraryFee", "computerFee", "admissionFee", "otherCharges", "annualFee", "labFee", "laboratoryFee"]) {
    const value = Number(breakdown?.[key]);
    if (Number.isFinite(value) && value !== 0) values[key] = (values[key] || 0) + value;
  }
  const arrears = Number(breakdown?.arrears);
  if (Number.isFinite(arrears) && arrears !== 0) values.previousBalance = arrears;
  const fine = Number(breakdown?.lateFeeFine);
  if (Number.isFinite(fine) && fine !== 0) values.lateFeeFine = fine;
  for (const item of breakdown?.customCharges || []) {
    const name = String(item?.label || "Custom charge").trim() || "Custom charge";
    const key = `custom:${name}`;
    const value = Number(item?.amount);
    if (Number.isFinite(value) && value !== 0) values[key] = (values[key] || 0) + value;
  }
  const discount = Number(breakdown?.discount || 0) + Number(breakdown?.scholarship || 0);
  if (discount) values.discount = -discount;
  const sum = Object.values(values).reduce((a, b) => a + b, 0);
  // Challan total is the financial source of truth. Any difference (for example
  // carried dues or a snapshot adjustment) stays visible as a separate line.
  const total = Number(sum.toFixed(2));
  return { values, total };
}
const componentLabel = (key: string) => key.startsWith("custom:") ? key.slice(7) : key === "previousBalance" ? "Carried Arrears" : key === "lateFeeFine" ? "Late Fee Fine" : key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
export function allocateFeePayments(billed: number, componentAmounts: Record<string, number>, paidThrough: number, paidInPeriod: number) {
  const entries = Object.entries(componentAmounts);
  const totalWeight = entries.reduce((n, [, amount]) => n + Math.abs(Number(amount) || 0), 0);
  return entries.map(([key, rawAmount]) => {
    const amount = Number(rawAmount) || 0;
    const share = totalWeight ? Math.abs(amount) / totalWeight : 0;
    return { key, amount, received: (Number(paidInPeriod) || 0) * share, outstanding: Math.max(0, (Number(billed) || 0) * share - (Number(paidThrough) || 0) * share) };
  });
}
export function isFreeAssignedStructure(structure: any) {
  if (!structure) return false;
  const fixed = ["tuitionFee", "admissionFee", "examFee", "transportFee", "libraryFee", "computerFee", "otherCharges", "totalMonthlyFee"];
  return fixed.every(key => Number(structure[key] || 0) === 0) &&
    (structure.customCharges || []).every((item: any) => Number(item?.amount || 0) === 0);
}

export async function feeCollectionReport(actor: AuthenticatedUser, input: { academicSessionId: string; period: "month" | "range" | "session"; month?: string; fromMonth?: string; toMonth?: string }) {
  const session: any = await AcademicSession.findOne({ _id: input.academicSessionId, schoolId: actor.schoolId }).lean();
  if (!session) throw { statusCode: 400, message: "Choose an authorized academic session." };
  const sessionStart = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit" }).format(session.startDate);
  const sessionEnd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit" }).format(session.endDate);
  const from = input.period === "session" ? sessionStart : input.period === "month" ? input.month : input.fromMonth;
  const to = input.period === "session" ? sessionEnd : input.period === "month" ? input.month : input.toMonth;
  if (!from || !to || !/^\d{4}-(0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(to) || from > to || from < sessionStart || to > sessionEnd)
    throw { statusCode: 400, message: "Select a valid month or month range within the academic session." };
  const months = feeReportMonthKeys(from, to), monthSet = new Set(months);
  const [school, cats, students, structures, challans] = await Promise.all([
    SchoolService.getSchoolProfile(actor.schoolId!),
    ClassCategory.find({ schoolId: actor.schoolId }).sort({ displayOrder: 1, name: 1 }).select("name displayOrder").lean(),
    Student.find({ schoolId: actor.schoolId, $or: [{ academicSessionId: session._id }, { academicSessionName: session.name }], status: { $nin: ["LEFT", "GRADUATED", "TRANSFERRED", "ARCHIVED"] } }).select("studentId classId classCategoryName academicSessionId academicSessionName feeStructureId feeStructureHistory").lean(),
    FeeStructure.find({ schoolId: actor.schoolId }).select("_id title tuitionFee admissionFee examFee transportFee libraryFee computerFee otherCharges customCharges totalMonthlyFee").lean(),
    FeeChallan.find({ schoolId: actor.schoolId, isVoided: { $ne: true }, academicSession: session.name }).lean(),
  ]);
  const structuresById = new Map(structures.map((v: any) => [String(v._id), v]));
  const studentsByClass = new Map<string, any[]>();
  for (const student of students as any[]) {
    const list = studentsByClass.get(String(student.classId)) || [];
    list.push(student); studentsByClass.set(String(student.classId), list);
  }
  const classes: any[] = await ClassModel.find({ schoolId: actor.schoolId }).select("_id classCategoryId classCategoryName").lean();
  const categoryByClass = new Map(classes.map((v: any) => [String(v._id), v.classCategoryName || ""]));
  const categories: any[] = (cats as any[]).map((category: any) => ({ id: String(category._id), name: category.name, strength: 0, ffs: 0, nonFfs: 0, sections: [] as any[] }));
  const knownCategoryNames = new Set(categories.map(c => c.name));
  for (const name of new Set([...classes.map((c: any) => c.classCategoryName), ...(challans as any[]).map((c: any) => c.classCategoryName)].filter((v: any) => typeof v === "string" && v.trim()))) {
    if (!knownCategoryNames.has(name)) { categories.push({ id: `legacy:${name}`, name, strength: 0, ffs: 0, nonFfs: 0, sections: [] }); knownCategoryNames.add(name); }
  }
  const categoryClassesFor = (category: any) => classes.filter((c: any) => String(c.classCategoryId) === category.id || ((!c.classCategoryId || category.id.startsWith("legacy:")) && c.classCategoryName === category.name));
  const freeStudent = (student: any) => {
    const history = [...(student.feeStructureHistory || [])].sort((a: any, b: any) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
    const effective = history.filter((entry: any) => monthKey(entry.effectiveDate) <= from).at(-1);
    const structureId = effective?.newFeeStructureId || effective?.previousFeeStructureId || student.feeStructureId;
    return isFreeAssignedStructure(structuresById.get(String(structureId || "")));
  };
  for (const category of categories) {
    const categoryStudents = categoryClassesFor(category).flatMap((c: any) => studentsByClass.get(String(c._id)) || []);
    category.strength = categoryStudents.length;
    category.ffs = categoryStudents.filter(freeStudent).length;
    category.nonFfs = category.strength - category.ffs;
  }
  const matchedClassIds = new Set(categories.flatMap(category => categoryClassesFor(category).map((c: any) => String(c._id))));
  const uncategorizedClassIds = new Set(classes.filter((c: any) => !matchedClassIds.has(String(c._id)) && studentsByClass.has(String(c._id))).map((c: any) => String(c._id)));
  const uncategorizedStudents = (students as any[]).filter(student => !matchedClassIds.has(String(student.classId)));
  if (uncategorizedStudents.length) categories.push({ id: "uncategorized", name: "Uncategorized", strength: uncategorizedStudents.length, ffs: uncategorizedStudents.filter(freeStudent).length, nonFfs: uncategorizedStudents.filter((student: any) => !freeStudent(student)).length, sections: [] });
  const visibleChallans = (challans as any[]).filter((c: any) => monthKey(c.month) && monthKey(c.month) <= to);
  const challanIds = visibleChallans.map((c: any) => c._id);
  const endInstant = feeReportMonthEnd(to);
  const periodStart = new Date(`${from}-01T00:00:00+05:00`);
  const payments: any[] = challanIds.length ? await FeePayment.find({ schoolId: actor.schoolId, challanId: { $in: challanIds }, paidAt: { $lte: endInstant } }).select("challanId amountPKR paidAt").lean() : [];
  const paymentsByChallan = new Map<string, any[]>();
  for (const payment of payments) { const list = paymentsByChallan.get(String(payment.challanId)) || []; list.push(payment); paymentsByChallan.set(String(payment.challanId), list); }
  const sectionMap = new Map<string, Map<string, any>>();
  // Seed sections from fee structures currently assigned to students. A zero
  // component stays visible, including a fully free education structure.
  for (const category of categories) {
    const categoryClasses = category.id === "uncategorized" ? classes.filter((c: any) => uncategorizedClassIds.has(String(c._id))) : categoryClassesFor(category);
    const assignedIds = new Set<string>();
    for (const cls of categoryClasses) for (const student of studentsByClass.get(String(cls._id)) || []) {
      const history = [...(student.feeStructureHistory || [])].sort((a: any, b: any) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
      const effective = history.filter((entry: any) => monthKey(entry.effectiveDate) <= from).at(-1);
      const structureId = effective?.newFeeStructureId || effective?.previousFeeStructureId || student.feeStructureId;
      if (structureId) assignedIds.add(String(structureId));
    }
    const sections = new Map<string, any>();
    for (const structureId of assignedIds) {
      const structure: any = structuresById.get(structureId); if (!structure) continue;
      const values = components({ ...structure, customCharges: structure.customCharges });
      const keys = new Set([...Object.keys(values.values), ...["tuitionFee", "examFee", "transportFee", "libraryFee", "computerFee", "admissionFee", "otherCharges"].filter(key => key in structure)]);
      for (const item of structure.customCharges || []) keys.add(`custom:${String(item?.label || "Custom charge").trim() || "Custom charge"}`);
      for (const key of keys) sections.set(key, { key, title: componentLabel(key), previousPKR: 0, currentPKR: 0, totalPKR: 0, receivedPKR: 0, outstandingPKR: 0, months: Object.fromEntries(months.map(m => [m, { billedPKR: 0, receivedPKR: 0, outstandingPKR: 0 }])) });
    }
    sectionMap.set(category.id, sections);
  }
  const monthBreakdown = new Map<string, any>();
  for (const month of months) monthBreakdown.set(month, { month, billedPKR: 0, receivedPKR: 0, outstandingPKR: 0 });
  for (const challan of visibleChallans) {
    const billingMonth = monthKey(challan.month);
    const componentsData = components(challan.feeBreakdown);
    const billed = Number(challan.totalAmountPKR || 0);
    const componentTotal = componentsData.total;
    const residual = round(billed - componentTotal);
    if (residual) componentsData.values.adjustments = (componentsData.values.adjustments || 0) + residual;
    const rows = Object.entries(componentsData.values);
    if (!rows.length && billed !== 0) rows.push(["adjustments", billed]);
    const key = String(challan.classCategoryName || categoryByClass.get(String(challan.classId)) || "Uncategorized");
    const category = categories.find(c => c.name === key) || categories.find(c => c.id === key);
    const categoryId = category?.id || key;
    let sections = sectionMap.get(categoryId); if (!sections) { sections = new Map(); sectionMap.set(categoryId, sections); }
    const receivedAll = (paymentsByChallan.get(String(challan._id)) || []).reduce((n, p) => n + Number(p.amountPKR || 0), 0);
    const receivedInPeriod = (paymentsByChallan.get(String(challan._id)) || []).filter(p => p.paidAt >= periodStart && p.paidAt <= endInstant).reduce((n, p) => n + Number(p.amountPKR || 0), 0);
    const allocated = allocateFeePayments(billed, Object.fromEntries(rows), receivedAll, receivedInPeriod);
    for (const { key: component, amount, received: allocatedPeriodPaid, outstanding: allocatedOutstanding } of allocated) {
      if (!sections.has(component)) sections.set(component, { key: component, title: componentLabel(component), previousPKR: 0, currentPKR: 0, totalPKR: 0, receivedPKR: 0, outstandingPKR: 0, months: Object.fromEntries(months.map(m => [m, { billedPKR: 0, receivedPKR: 0, outstandingPKR: 0 }])) });
      const section = sections.get(component)!;
      section.totalPKR += amount;
      if (billingMonth < from) section.previousPKR += amount; else if (monthSet.has(billingMonth)) section.currentPKR += amount;
      section.receivedPKR += allocatedPeriodPaid;
      section.outstandingPKR += allocatedOutstanding;
      if (monthSet.has(billingMonth)) {
        const m = section.months[billingMonth]; m.billedPKR += amount; m.receivedPKR += allocatedPeriodPaid; m.outstandingPKR += allocatedOutstanding;
      }
      const monthRow = monthBreakdown.get(billingMonth);
      if (monthRow) { monthRow.billedPKR += amount; monthRow.outstandingPKR += allocatedOutstanding; }
    }
    for (const payment of paymentsByChallan.get(String(challan._id)) || []) {
      const paidMonth = monthKey(payment.paidAt), monthRow = monthBreakdown.get(paidMonth);
      if (monthRow) monthRow.receivedPKR += Number(payment.amountPKR || 0);
    }
  }
  for (const category of categories) {
    const sections = sectionMap.get(category.id);
    category.sections = sections ? [...sections.values()].map(section => Object.fromEntries(Object.entries(section).map(([k, v]) => [k, typeof v === "number" ? round(v) : v]))) : [];
  }
  const totals = categories.reduce((t, category) => {
    t.strength += category.strength; t.ffs += category.ffs; t.nonFfs += category.nonFfs;
    for (const section of category.sections) {
      const row = t.sections.get(section.key) || { key: section.key, title: section.title, previousPKR: 0, currentPKR: 0, totalPKR: 0, receivedPKR: 0, outstandingPKR: 0 };
      for (const k of ["previousPKR", "currentPKR", "totalPKR", "receivedPKR", "outstandingPKR"]) row[k] += section[k];
      t.sections.set(section.key, row);
    }
    return t;
  }, { strength: 0, ffs: 0, nonFfs: 0, sections: new Map<string, any>() });
  const logo = school.logoUrl || school.documentSettings?.branding?.logoUrl || "";
  const scope = branchContext.getStore();
  const selectedBranch: any = scope?.branchId ? await Branch.findOne({ _id: scope.branchId, organizationId: actor.schoolId }).select("name").lean() : null;
  const branchLabel = selectedBranch?.name || (scope?.branchId ? "Authorized branch" : "All authorized branches");
  return { school: { name: school.name || "School", logoUrl: logo, address: school.address || "", phone: school.phone || "" }, branchScope: branchLabel, session: { id: String(session._id), name: session.name, startMonth: sessionStart, endMonth: sessionEnd }, period: { from, to, months }, generatedAt: new Date().toISOString(), categories, totals: { strength: totals.strength, ffs: totals.ffs, nonFfs: totals.nonFfs, sections: [...totals.sections.values()].map((s: any) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "number" ? round(v) : v]))) }, months: [...monthBreakdown.values()].map((m: any) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === "number" ? round(v) : v]))) };
}

export async function feeCollectionExcel(report: any) {
  const wb = XLSX.utils.book_new();
  const strength: any[][] = [[report.school.name], ["Students Fee Collection Report"], ["Academic Session", report.session.name], ["Period", `${report.period.from} to ${report.period.to}`], ["Generated", report.generatedAt], ["Branch scope", report.branchScope], [], ["Category", "Total Students", "FFS", "Non-FFS"]];
  for (const c of report.categories) strength.push([c.name, c.strength, c.ffs, c.nonFfs]);
  strength.push(["SCHOOL TOTAL", report.totals.strength, report.totals.ffs, report.totals.nonFfs]);
  const s1 = XLSX.utils.aoa_to_sheet(strength); s1["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 16 }]; XLSX.utils.book_append_sheet(wb, s1, "Strength");
  const fees: any[][] = [["Category", "Fee Component", "Previous", "Current", "Total", "Received in Period", "Remaining as of Period End"]];
  for (const c of report.categories) for (const s of c.sections) fees.push([c.name, s.title, s.previousPKR, s.currentPKR, s.totalPKR, s.receivedPKR, s.outstandingPKR]);
  fees.push(["SCHOOL TOTAL", "", "", "", "", "", ""]);
  for (const s of report.totals.sections) fees.push(["SCHOOL TOTAL", s.title, s.previousPKR, s.currentPKR, s.totalPKR, s.receivedPKR, s.outstandingPKR]);
  const s2 = XLSX.utils.aoa_to_sheet(fees); s2["!cols"] = [{ wch: 24 }, { wch: 28 }, ...Array(5).fill({ wch: 22 })];
  for (let r = 1; r < fees.length; r++) for (let c = 2; c < 7; c++) { const cell = s2[XLSX.utils.encode_cell({ r, c })]; if (cell?.t === "n") cell.z = "#,##0.00"; }
  XLSX.utils.book_append_sheet(wb, s2, "Fee Status");
  const monthRows: any[][] = [["Billing Month", "Billed PKR", "Received in Period PKR", "Outstanding at Period End PKR"], ...report.months.map((m: any) => [m.month, m.billedPKR, m.receivedPKR, m.outstandingPKR])];
  const s3 = XLSX.utils.aoa_to_sheet(monthRows); s3["!cols"] = [{ wch: 20 }, ...Array(3).fill({ wch: 30 })];
  for (let r = 1; r < monthRows.length; r++) for (let c = 1; c < 4; c++) { const cell = s3[XLSX.utils.encode_cell({ r, c })]; if (cell?.t === "n") cell.z = "#,##0.00"; }
  XLSX.utils.book_append_sheet(wb, s3, "Month Breakdown");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function feeCollectionPdf(report: any) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28, bufferPages: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const logo = await normalizeCardImage(report.school.logoUrl).catch(() => null);
  const width = doc.page.width - 56;
  const heading = () => {
    doc.font("Helvetica-Bold").fontSize(15).text(report.school.name, 28, 22, { width: width - 70, ellipsis: true });
    if (logo) doc.image(Buffer.from(logo.split(",")[1], "base64"), doc.page.width - 68, 20, { fit: [38, 32] });
    doc.font("Helvetica-Bold").fontSize(11).text("Students Fee Collection Report", 28, 43);
    doc.font("Helvetica").fontSize(8).text(`Academic session: ${report.session.name} · Period: ${report.period.from} to ${report.period.to} · Generated: ${new Date(report.generatedAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`, 28, 59, { width });
    doc.text(`Branch: ${report.branchScope} · Strength: ${report.totals.strength} | FFS: ${report.totals.ffs} | Non-FFS: ${report.totals.nonFfs}`, 28, 71, { width });
    doc.y = 90;
  };
  heading();
  const categories = report.categories;
  const colWidth = width / Math.max(1, categories.length);
  const line = (text: string, x: number, y: number, w: number, bold = false) => { doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(7).text(text, x + 3, y + 3, { width: w - 6, ellipsis: true }); };
  const drawTableHeader = (x: number, y: number, w: number) => { const cw = w / 4; ["Previous", "Current", "Total", "Remaining"].forEach((v, i) => { doc.rect(x + i * cw, y, cw, 17).stroke("#555"); line(v, x + i * cw, y, cw, true); }); };
  const categoryHeight = (c: any) => 45 + c.sections.reduce((n: number, s: any) => n + 40, 0);
  let y = doc.y;
  if (categories.length > 3 || categories.some((c: any) => categoryHeight(c) > 420)) {
    for (const c of categories) {
      if (doc.y > doc.page.height - 110) { doc.addPage(); heading(); }
      doc.font("Helvetica-Bold").fontSize(10).text(`${c.name} · Students ${c.strength} · FFS ${c.ffs} · Non-FFS ${c.nonFfs}`, 28, doc.y, { width }); doc.moveDown(.35);
      for (const s of c.sections) {
        if (doc.y > doc.page.height - 85) { doc.addPage(); heading(); }
        doc.font("Helvetica-Bold").fontSize(8).text(s.title, 28, doc.y, { width }); doc.moveDown(.3);
        const y = doc.y, cw = width / 4; drawTableHeader(28, y, width); doc.y = y + 17;
        [s.previousPKR, s.currentPKR, s.totalPKR, s.outstandingPKR].forEach((v, i) => { doc.rect(28 + i*cw, doc.y, cw, 16).stroke("#777"); line(`PKR ${Number(v).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 28+i*cw, doc.y, cw); }); doc.y += 20;
        doc.font("Helvetica").fontSize(7).text(`Total Received Fee: PKR ${Number(s.receivedPKR).toLocaleString("en-PK", { minimumFractionDigits: 2 })} · Total Outstanding Fee: PKR ${Number(s.outstandingPKR).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 28, doc.y, { width }); doc.moveDown(.65);
      }
    }
    y = doc.y;
  } else {
    const xPositions = categories.map((_: any, i: number) => 28 + i * colWidth);
    const starts = xPositions.map((x: number) => x);
    categories.forEach((c: any, index: number) => { const x = starts[index]; doc.rect(x, y, colWidth, 34).stroke("#333"); line(`${c.name} · ${c.strength} students`, x, y, colWidth, true); line(`FFS ${c.ffs} · Non-FFS ${c.nonFfs}`, x, y+16, colWidth, true); }); y += 34;
    const sectionKeys = [...new Set(categories.flatMap((c: any) => c.sections.map((s: any) => s.key)))];
    for (const key of sectionKeys) {
      const title = categories.flatMap((c: any) => c.sections).find((s: any) => s.key === key)?.title || key;
      if (y > doc.page.height - 105) { doc.addPage(); heading(); y = doc.y; }
      doc.rect(28, y, width, 16).stroke("#444"); line(title, 28, y, width, true); y += 16;
      categories.forEach((c: any, index: number) => {
        const x = starts[index], s = c.sections.find((row: any) => row.key === key), cw = colWidth / 4;
        drawTableHeader(x, y, colWidth);
        const vals = s ? [s.previousPKR, s.currentPKR, s.totalPKR, s.outstandingPKR] : [0,0,0,0];
        vals.forEach((v: number, i: number) => { doc.rect(x + i*cw, y+17, cw, 18).stroke("#777"); line(Number(v).toLocaleString("en-PK", { minimumFractionDigits: 2 }), x+i*cw, y+17, cw); });
        doc.font("Helvetica").fontSize(6.5).text(`Received PKR ${Number(s?.receivedPKR || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })} · Outstanding PKR ${Number(s?.outstandingPKR || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, x + 2, y + 36, { width: colWidth - 4, ellipsis: true });
      }); y += 38;
      y += 13;
      const received = categories.reduce((n: number, c: any) => n + Number(c.sections.find((s: any) => s.key === key)?.receivedPKR || 0), 0);
      const outstanding = categories.reduce((n: number, c: any) => n + Number(c.sections.find((s: any) => s.key === key)?.outstandingPKR || 0), 0);
      doc.font("Helvetica-Bold").fontSize(7).text(`Total Received Fee: PKR ${received.toLocaleString("en-PK", { minimumFractionDigits: 2 })} · Total Outstanding Fee: PKR ${outstanding.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 28, y, { width }); y += 14;
    }
  }
  if (report.months?.length > 1) {
    if (y > doc.page.height - 115) { doc.addPage(); heading(); y = doc.y; }
    doc.font("Helvetica-Bold").fontSize(9).text("Month-wise breakdown", 28, y, { width }); y += 16;
    const cols = ["Billing Month", "Billed PKR", "Received PKR", "Outstanding PKR"], widths = [width * .25, width * .25, width * .25, width * .25];
    const drawRow = (values: string[], bold = false) => {
      let x = 28; const h = 17;
      values.forEach((value, i) => { doc.rect(x, y, widths[i], h).stroke("#555"); line(value, x, y, widths[i], bold); x += widths[i]; });
      y += h;
    };
    drawRow(cols, true);
    for (const item of report.months) {
      if (y > doc.page.height - 65) { doc.addPage(); heading(); y = doc.y; drawRow(cols, true); }
      drawRow([item.month, ...[item.billedPKR, item.receivedPKR, item.outstandingPKR].map((v: number) => Number(v).toLocaleString("en-PK", { minimumFractionDigits: 2 }))]);
    }
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) { doc.switchToPage(i); doc.font("Helvetica").fontSize(7).text(`Page ${i + 1} of ${range.count}`, 28, doc.page.height - 45, { width, align: "right" }); }
  doc.end(); return done;
}
