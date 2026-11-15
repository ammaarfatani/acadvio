import mongoose from "mongoose";
import { FeeChallan, FeePayment } from "../models/fee.model";
import { FeeFollowUp } from "../models/feeFollowUp.model";
import { Student } from "../models/student.model";
import { FeeCalculationService } from "./feeCalculation.service";
import { SchoolService } from "./school.service";
import { Branch } from "../models/branch.model";

const dayStart = (value: string) => new Date(`${value}T00:00:00+05:00`);
const dayEndExclusive = (value: string) => new Date(dayStart(value).getTime() + 86400000);
const startOfPakistanDay = (date: Date) => dayStart(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date));
const daysBetween = (older: Date, newer: Date) => Math.max(0, Math.floor((startOfPakistanDay(newer).getTime() - startOfPakistanDay(older).getTime()) / 86400000));

export type DefaulterFilters = {
  asOf: string; branchId?: string; academicSession?: string; classCategory?: string; classId?: string; sectionId?: string;
  studentId?: string; search?: string; month?: string; from?: string; to?: string; status?: string; minAmount?: number; maxAmount?: number;
  minOverdueDays?: number; pendingMonths?: string; sort?: string; page?: number; limit?: number;
};

export class FeeDefaultersService {
  static async get(schoolId: string, actor: any, filters: DefaulterFilters) {
    if (filters.branchId) {
      if (!(await Branch.exists({ _id: filters.branchId, schoolId }))) throw { statusCode: 400, message: "Select a branch belonging to this school." };
    }
    const asOf = new Date(dayEndExclusive(filters.asOf).getTime() - 1);
    const match: any = { schoolId, isVoided: { $ne: true }, status: { $ne: "VOIDED" }, remainingAmountPKR: { $gt: 0 } };
    if (filters.branchId) match.branchId = filters.branchId;
    if (filters.academicSession) match.academicSession = filters.academicSession;
    if (filters.classCategory) match.classCategoryName = filters.classCategory;
    if (filters.classId) match.classId = filters.classId;
    if (filters.sectionId) {
      const section = await mongoose.model("SectionModel").findOne({ _id: filters.sectionId, schoolId }).select("name classId").lean() as any;
      if (!section || (filters.classId && String(section.classId) !== filters.classId)) throw { statusCode: 400, message: "Select a section in the selected class." };
      match.sectionName = section.name;
    }
    if (filters.studentId) match.studentId = filters.studentId;
    if (filters.month) match.month = filters.month;
    if (filters.from || filters.to) match.dueDate = { ...(filters.from ? { $gte: dayStart(filters.from) } : {}), ...(filters.to ? { $lt: dayEndExclusive(filters.to) } : {}) };
    const invoices: any[] = await FeeChallan.find(match).sort({ dueDate: 1, studentName: 1 }).limit(50001).lean();
    if (invoices.length > 50000) throw { statusCode: 413, message: "This defaulters search matches over 50,000 outstanding challans. Narrow the date, session, class, or branch filters." };
    const studentIds = [...new Set(invoices.map(c => String(c.studentId)))];
    const students: any[] = studentIds.length ? await Student.find({ schoolId, _id: { $in: studentIds } }).select("studentId name classId className classCategoryName sectionId sectionName rollNumber admissionNumber academicSessionName parentInfo feeStructureId feeStructureTitle status branchId").lean() : [];
    const studentMap = new Map(students.map(s => [String(s._id), s]));
    const grouped = new Map<string, any>();
    for (const invoice of invoices) {
      const payable = FeeCalculationService.evaluateCurrentPayable(invoice, asOf);
      if (payable.payableAmount <= 0) continue;
      const student = studentMap.get(String(invoice.studentId));
      if (!student) continue;
      let record = grouped.get(String(invoice.studentId));
      if (!record) {
        record = { student, challans: [], totalOutstanding: 0, originalOutstanding: 0, applicableLateFine: 0, overdueAmount: 0, overdueMonths: new Set<string>(), pendingMonths: new Set<string>(), oldestDueDate: undefined as Date | undefined, daysOverdue: 0, partial: false };
        grouped.set(String(invoice.studentId), record);
      }
      const due = new Date(invoice.dueDate);
      const overdue = due < dayStart(filters.asOf);
      const current = Number(payable.payableAmount || 0);
      record.challans.push({ ...invoice, currentPayablePKR: current, lateFinePKR: Math.max(0, current - Number(invoice.remainingAmountPKR || 0)), isOverdue: overdue, daysOverdue: overdue ? daysBetween(due, asOf) : 0 });
      record.totalOutstanding += current;
      record.originalOutstanding += Number(invoice.remainingAmountPKR || 0);
      record.applicableLateFine += Math.max(0, current - Number(invoice.remainingAmountPKR || 0));
      record.pendingMonths.add(invoice.month);
      if (overdue) { record.overdueAmount += current; record.overdueMonths.add(invoice.month); }
      if (!record.oldestDueDate || due < record.oldestDueDate) record.oldestDueDate = due;
      record.daysOverdue = Math.max(record.daysOverdue, overdue ? daysBetween(due, asOf) : 0);
      record.partial ||= Number(invoice.paidAmountPKR || 0) > 0;
    }
    let rows = [...grouped.values()].map(record => {
      const s = record.student;
      return {
        studentId: String(s._id), permanentStudentId: s.studentId, studentName: s.name, classCategoryName: s.classCategoryName || "",
        classId: String(s.classId || ""), className: s.className || "", sectionId: String(s.sectionId || ""), sectionName: s.sectionName || "",
        rollNumber: s.rollNumber || "", admissionNumber: s.admissionNumber || "", guardianName: s.parentInfo?.guardianName || s.parentInfo?.fatherName || "",
        guardianContact: actor.permissions?.includes("students.view") ? (s.parentInfo?.guardianPhone || s.parentInfo?.fatherPhone || "") : undefined,
        academicSession: s.academicSessionName || record.challans[0]?.academicSession || "", feeStructureId: String(s.feeStructureId || ""), feeStructureTitle: s.feeStructureTitle || "",
        totalOutstanding: Math.round(record.totalOutstanding * 100) / 100, originalOutstanding: Math.round(record.originalOutstanding * 100) / 100,
        overdueAmount: Math.round(record.overdueAmount * 100) / 100, applicableLateFine: Math.round(record.applicableLateFine * 100) / 100,
        pendingMonths: record.pendingMonths.size, overdueMonths: record.overdueMonths.size, oldestDueDate: record.oldestDueDate,
        daysOverdue: record.daysOverdue, paymentStatus: record.partial ? "PARTIAL" : record.overdueMonths.size ? "OVERDUE" : "OUTSTANDING",
        challans: record.challans.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
      };
    });
    if (filters.search?.trim()) {
      const term = filters.search.trim().toLowerCase();
      rows = rows.filter(r => [r.studentName, r.permanentStudentId, r.admissionNumber, r.rollNumber, r.className, r.sectionName, r.guardianName].some(v => String(v || "").toLowerCase().includes(term)));
    }
    rows = rows.filter(r => (!filters.minAmount || r.totalOutstanding >= filters.minAmount) && (filters.maxAmount === undefined || r.totalOutstanding <= filters.maxAmount)
      && (!filters.minOverdueDays || r.daysOverdue >= filters.minOverdueDays)
      && (!filters.pendingMonths || filters.pendingMonths === "ALL" || (filters.pendingMonths === "3+" ? r.pendingMonths >= 3 : filters.pendingMonths === "2+" ? r.pendingMonths >= 2 : r.pendingMonths === Number(filters.pendingMonths)))
      && (!filters.status || filters.status === "ALL" || (filters.status === "OVERDUE" ? r.overdueMonths > 0 : filters.status === "PARTIAL" ? r.paymentStatus === "PARTIAL" : filters.status === "NOT_YET_DUE" ? r.overdueMonths === 0 : true)));
    const overdueOnly = filters.status === "OVERDUE" || filters.status === "1_MONTH" || filters.status === "2_PLUS" || filters.status === "3_PLUS";
    if (overdueOnly) rows = rows.filter(r => r.overdueMonths > 0);
    if (filters.status === "1_MONTH") rows = rows.filter(r => r.overdueMonths === 1);
    if (filters.status === "2_PLUS") rows = rows.filter(r => r.overdueMonths >= 2);
    if (filters.status === "3_PLUS") rows = rows.filter(r => r.overdueMonths >= 3);
    rows.sort(filters.sort === "NAME" ? (a,b) => a.studentName.localeCompare(b.studentName) : filters.sort === "OLDEST" ? (a,b) => new Date(a.oldestDueDate).getTime() - new Date(b.oldestDueDate).getTime() : (a,b) => b.totalOutstanding - a.totalOutstanding);
    const summary = rows.reduce((a, r) => {
      a.studentsWithOutstanding++;
      a.totalOutstanding += r.totalOutstanding;
      a.totalOverdue += r.overdueAmount;
      if (r.overdueMonths === 1) a.oneOverdueMonth++;
      if (r.overdueMonths > 1) a.multipleOverdueMonths++;
      if (r.paymentStatus === "PARTIAL") a.partiallyPaidStudents++;
      if (r.daysOverdue > 90) a.longOverdueStudents++;
      return a;
    }, { studentsWithOutstanding: 0, totalOutstanding: 0, totalOverdue: 0, oneOverdueMonth: 0, multipleOverdueMonths: 0, partiallyPaidStudents: 0, longOverdueStudents: 0, collectionsToday: 0 });
    const paymentsToday = await FeePayment.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), paidAt: { $gte: dayStart(filters.asOf), $lt: dayEndExclusive(filters.asOf) }, ...(filters.branchId ? { branchId: new mongoose.Types.ObjectId(filters.branchId) } : {}) } },
      { $group: { _id: null, amount: { $sum: "$amountPKR" } } },
    ]);
    summary.collectionsToday = paymentsToday[0]?.amount || 0;
    summary.totalOutstanding = Math.round(summary.totalOutstanding * 100) / 100;
    summary.totalOverdue = Math.round(summary.totalOverdue * 100) / 100;
    const total = rows.length, limit = Math.min(100, Math.max(1, filters.limit || 25)), page = Math.max(1, filters.page || 1);
    const pageRows = rows.slice((page - 1) * limit, page * limit);
    const ids = pageRows.map(r => r.studentId);
    const paymentDates = ids.length ? await FeePayment.aggregate([{ $match: { schoolId: new mongoose.Types.ObjectId(schoolId), studentId: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) } } }, { $group: { _id: "$studentId", lastPaymentDate: { $max: "$paidAt" } } }]) : [];
    const followUps = ids.length ? await FeeFollowUp.find({ schoolId, studentId: { $in: ids } }).sort({ contactDate: -1 }).lean() : [];
    const lastPayment = new Map(paymentDates.map((p: any) => [String(p._id), p.lastPaymentDate]));
    const history = new Map<string, any[]>();
    for (const f of followUps) { const key = String(f.studentId); if (!history.has(key)) history.set(key, []); history.get(key)!.push(f); }
    pageRows.forEach(r => { (r as any).lastPaymentDate = lastPayment.get(r.studentId); (r as any).followUps = history.get(r.studentId) || []; });
    return { asOf: filters.asOf, summary, rows: pageRows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
  static async addFollowUp(schoolId: string, actor: any, studentId: string, input: any) {
    if (!(await Student.exists({ _id: studentId, schoolId }))) throw { statusCode: 404, message: "Student not found in this school." };
    return FeeFollowUp.create({ schoolId, studentId, contactDate: input.contactDate || new Date(), nextFollowUpDate: input.nextFollowUpDate || undefined, status: input.status, note: input.note, createdByUserId: actor.userId, createdByName: actor.name || actor.email });
  }
  static async studentStatement(schoolId: string, actor: any, studentId: string, asOf: string) {
    return this.get(schoolId, actor, { asOf, studentId, page: 1, limit: 1 });
  }
}
