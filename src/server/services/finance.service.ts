import { studentFeeAssignment, feeStructureEligible } from "../../lib/student-fee-assignment";
import { defaultChallanTemplate } from "../../lib/challan-template";
import { FeeCalculationService } from "./feeCalculation.service";
import { ChallanPdfService } from "./challanPdf.service";
import {notifyFeeEvent} from "./financeReminder.service";
import {SalaryPayment,PayrollRecord} from "../models/workforce.model";
import {dateKey} from "./workforceMath";
import {salaryBalance} from "./salaryPayment.service";
import { feeMonth, feeMonthVariants } from "../../lib/fee-math";
import { billingDateAsUtcMidnight, normalizeBillingDate } from "../../lib/billing-date";
import { defaultDocumentStyle } from "../../lib/document-templates";
import { SchoolService } from "./school.service";
import mongoose from "mongoose";
import { analyticsPeriodStart } from "./platformAnalytics.service";
import { branchContext, withoutBranchScope } from "../utils/branchScope";
import { createHash, randomUUID } from "crypto";
import {
  FeeStructure,
  FeeChallan,
  FeePayment,
  Expense,
} from "../models/fee.model";
import { Student } from "../models/student.model";
import { AuditLog } from "../models/auditLog.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
import { Branch } from "../models/branch.model";

const lateModels = new Set(["DISABLED", "ONE_TIME", "STAGES", "RECURRING"]);
function dueDateForFeeMonth(month: string, configuredDay: any, structureTitle: string, studentName: string) {
  const day = configuredDay === undefined || configuredDay === null ? 10 : Number(configuredDay);
  if (!Number.isInteger(day) || day < 1 || day > 31)
    throw { statusCode: 400, message: `Fee structure '${structureTitle}' has an invalid due day for ${studentName}. Set a due day from 1 to 31 and retry.` };
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return billingDateAsUtcMidnight(`${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`);
}
function normalizeLateFinePolicy(raw: any, source: string, legacyAmount = 0) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "string") {
    const original = raw.trim(), legacy = original.toUpperCase();
    if (legacy.startsWith("{")) {
      try { raw = JSON.parse(original); }
      catch { throw { statusCode: 400, message: `${source} has an unreadable legacy late fine policy. Review that fee structure before generating challans.` }; }
    } else if (["NONE", "NO_FINE", "DISABLED"].includes(legacy)) {
      raw = { model: "DISABLED", type: "FIXED", amount: 0 };
    } else if (legacy === "ONE_TIME") {
      raw = { model: "ONE_TIME", type: "FIXED", amount: legacyAmount };
    } else if (["FIXED", "PERCENTAGE"].includes(legacy)) {
      raw = { model: legacyAmount > 0 ? "ONE_TIME" : "DISABLED", type: legacy, amount: legacyAmount };
    } else {
      throw { statusCode: 400, message: `${source} has an incomplete legacy late fine policy. Reconfigure it in the fee structure before generating challans.` };
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw) || typeof raw.toHexString === "function")
    throw { statusCode: 400, message: `${source} has an invalid late fine policy. Edit that policy or choose another late fine option.` };
  const model = raw.model || "DISABLED", type = raw.type || "FIXED";
  const amount = Number(raw.amount ?? 0), graceDays = Number(raw.graceDays ?? 0);
  const dailyRate = Number(raw.dailyRate ?? 0), maxFineCap = Number(raw.maxFineCap ?? 0);
  const stages = Array.isArray(raw.stages) ? raw.stages.map((stage: any) => ({
    daysAfterDue: Number(stage?.daysAfterDue ?? stage?.afterDays),
    fineAmount: Number(stage?.fineAmount),
  })) : [];
  if (!lateModels.has(model) || !["FIXED", "PERCENTAGE"].includes(type) ||
      ![amount, graceDays, dailyRate, maxFineCap].every(Number.isFinite) ||
      [amount, graceDays, dailyRate, maxFineCap].some(value => value < 0) ||
      stages.some((stage: any) => !Number.isFinite(stage.daysAfterDue) || stage.daysAfterDue < 1 || !Number.isFinite(stage.fineAmount) || stage.fineAmount < 0) ||
      (model === "STAGES" && (stages.length === 0 || stages.some((stage: any) => !Number.isFinite(stage.daysAfterDue) || !Number.isFinite(stage.fineAmount)))) ||
      (model === "RECURRING" && dailyRate <= 0))
    throw { statusCode: 400, message: `${source} has an invalid late fine policy. Edit that policy or choose another late fine option.` };
  return { model, type, amount, graceDays, dailyRate, maxFineCap, stages };
}

export class FinanceService {
  static async getSchoolClasses(schoolId: string) {
    return ClassModel.find({ schoolId })
      .sort({ numericLevel: 1, name: 1 })
      .select("name code numericLevel");
  }

  // 1. FINANCE DASHBOARD
  static async getFinanceDashboard(schoolId: string) {
    const now = new Date();
    const today = analyticsPeriodStart("today", now),
      monthStart = analyticsPeriodStart("month", now);
    const scope = { schoolId: new mongoose.Types.ObjectId(schoolId) };
    const [collections, challans, expenses, categories] = await Promise.all([
      FeePayment.aggregate([
        { $match: { ...scope, paidAt: { $gte: monthStart, $lte: now } } },
        {
          $group: {
            _id: null,
            monthly: { $sum: "$amountPKR" },
            today: {
              $sum: { $cond: [{ $gte: ["$paidAt", today] }, "$amountPKR", 0] },
            },
          },
        },
      ]),
      FeeChallan.aggregate([
        { $match: { ...scope, isVoided: { $ne: true } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            pendingAmount: { $sum: "$remainingAmountPKR" },
            overdueAmount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$remainingAmountPKR", 0] },
                      { $lt: ["$dueDate", now] },
                    ],
                  },
                  "$remainingAmountPKR",
                  0,
                ],
              },
            },
            paid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
            partial: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "PARTIAL"] },
                      { $gte: ["$dueDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            pending: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", "PENDING"] },
                      { $gte: ["$dueDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$remainingAmountPKR", 0] },
                      { $lt: ["$dueDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            ...scope,
            isVoided: { $ne: true },
            expenseDate: { $gte: monthStart, $lte: now },
          },
        },
        { $group: { _id: null, amount: { $sum: "$amountPKR" } } },
      ]),
      Expense.aggregate([
        {
          $match: {
            ...scope,
            isVoided: { $ne: true },
            expenseDate: { $gte: monthStart, $lte: now },
          },
        },
        { $group: { _id: "$category", amount: { $sum: "$amountPKR" } } },
      ]),
    ]);
    const [salaryRows,payrollRows]=await Promise.all([SalaryPayment.find({schoolId,paidAt:{$gte:monthStart,$lte:new Date(dateKey(now,"Asia/Karachi")+"T23:59:59.999+05:00")}}).select("amount").lean(),PayrollRecord.find({schoolId,month:{$lte:now.toLocaleDateString("en-CA",{timeZone:"Asia/Karachi"}).slice(0,7)}}).lean()]);
    const salaryPaid=salaryRows.reduce((sum:number,p:any)=>sum+p.amount,0),salaryPending=payrollRows.reduce((sum:number,p:any)=>sum+salaryBalance(p).remaining,0);
    const legacySalary=categories.find((r:any)=>r._id==="Salary")?.amount||0;
    const c = collections[0] || {},
      b = challans[0] || {},
      expenseAmount = expenses[0]?.amount || 0;
    const unpaid: any[] = await FeeChallan.find({ schoolId, isVoided: { $ne: true }, status: { $ne: "VOIDED" }, remainingAmountPKR: { $gt: 0 } }).lean();
    b.pendingAmount = unpaid.reduce((sum, row) => sum + FeeCalculationService.evaluateCurrentPayable(row, now).payableAmount, 0);
    b.overdueAmount = unpaid.filter(row => new Date(row.dueDate) < now).reduce((sum, row) => sum + FeeCalculationService.evaluateCurrentPayable(row, now).payableAmount, 0);
    return {
      metrics: {
        todayCollectionPKR: c.today || 0,
        monthlyCollectionPKR: c.monthly || 0,
        pendingFeesPKR: b.pendingAmount || 0,
        overdueFeesPKR: b.overdueAmount || 0,
        operationalExpensesPKR:expenseAmount-legacySalary,
        legacySalaryExpensesPKR:legacySalary,
        payrollPaidPKR:salaryPaid,
        payrollPendingPKR:salaryPending,
        totalExpensesPKR: expenseAmount+salaryPaid,
        netCollectionPKR: (c.monthly || 0) - expenseAmount-salaryPaid,
        totalChallansCount: b.count || 0,
      },
      statusCounts: {
        paid: b.paid || 0,
        partial: b.partial || 0,
        pending: b.pending || 0,
        overdue: b.overdue || 0,
      },
      categoryExpenses: Object.fromEntries(
        categories.map((row: any) => [row._id, row.amount]),
      ),
    };
  }
  // 2. FEE STRUCTURES
  static async getFeeStructures(schoolId: string) {
    return FeeStructure.find({ schoolId }).sort({ className: 1 });
  }

  static async createFeeStructure(schoolId: string, data: any, structureId?: string) {
    const classScope = data.classScope || "SPECIFIC";
    const linkedClass = classScope === "ALL" ? null : await ClassModel.findOne({ _id: data.classId, schoolId }).select("name");
    const session = await AcademicSession.findOne({
      schoolId,
      ...(data.academicSession ? { name: data.academicSession } : { isCurrent: true }),
    }).select("name");
    if (classScope !== "ALL" && !linkedClass)
      throw {
        statusCode: 400,
        message: "Select a class belonging to this school.",
      };
    if (!session)
      throw {
        statusCode: 400,
        message: "Select a current academic session first.",
      };
    if (
      classScope !== "ALL" &&
      data.sectionId &&
      !(await SectionModel.exists({
        _id: data.sectionId,
        schoolId,
      classId: data.classId,
      }))
    )
      throw {
        statusCode: 400,
        message: "Select a section belonging to this class and school.",
      };
    const tuitionFee = data.tuitionFee || 0;
    const admissionFee = data.admissionFee || 0;
    const examFee = data.examFee || 0;
    const transportFee = data.transportFee || 0;
    const libraryFee = data.libraryFee || 0;
    const computerFee = data.computerFee || 0;
    const otherCharges = data.otherCharges || 0;

    const totalMonthlyFee =
      tuitionFee +
      examFee +
      transportFee +
      libraryFee +
      computerFee +
      otherCharges;

    const record = {
      ...data,
      schoolId,
      classScope,
      ...(classScope === "ALL" ? { classId: undefined, className: "All Classes", sectionId: undefined } : { className: linkedClass!.name }),
      academicSession: session.name,
      admissionFee,
      tuitionFee,
      examFee,
      transportFee,
      libraryFee,
      computerFee,
      otherCharges,
      totalMonthlyFee: Math.max(0, totalMonthlyFee + (data.customCharges || []).reduce((n: number, c: any) => n + c.amount, 0) - Number(data.defaultDiscount || 0)),
    };
    if (structureId) {
      const updated = await FeeStructure.findOneAndUpdate({ _id: structureId, schoolId }, { $set: record, ...(classScope === "ALL" ? { $unset: { classId: 1, sectionId: 1 } } : {}) }, { new: true, runValidators: true });
      if (!updated) throw { statusCode: 404, message: "Fee structure not found." };
      return updated;
    }
    return FeeStructure.create(record);
  }

  // 3. STUDENT ACCOUNT LEDGER
  static async getStudentLedger(schoolId: string, studentId: string) {
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student)
      throw { statusCode: 404, message: "Student record not found." };

    const challans = await FeeChallan.find({ schoolId, studentId })
      .sort({ createdAt: -1 })
      .lean();
    const payments = await FeePayment.find({ schoolId, studentId })
      .sort({ paidAt: 1 })
      .lean();
    return FinanceService.ledgerData(student, challans, payments);
  }

  // Shared by individual and class printing. Stored invoice balances remain authoritative;
  // carried arrears are already part of an invoice and are never added a second time.
  static ledgerData(
    student: any,
    all: any[],
    payments: any[],
    period?: { month: string; academicSession: string },
  ) {
    const challans = all.filter(
      (c) =>
        !period ||
        (feeMonthVariants(period.month).includes(c.month) &&
          c.academicSession === period.academicSession),
    );
    const payable = challans.filter(
      (c) => !c.isVoided && c.status !== "VOIDED",
    );
    const sum = (field: string) =>
      Math.round(payable.reduce((n, c) => n + Number(c[field] || 0), 0) * 100) /
      100;
    const ids = new Set(payable.map((c) => String(c._id)));
    return {
      student,
      period,
      challans,
      payments: payments.filter((p) => ids.has(String(p.challanId))),
      summary: {
        totalCharged: sum("totalAmountPKR"),
        totalPaid: sum("paidAmountPKR"),
        remainingBalance: Math.round(payable.reduce((n, c) => n + FeeCalculationService.evaluateCurrentPayable(c).payableAmount, 0) * 100) / 100,
        totalDiscounts: payable.reduce(
          (n, c) =>
            n +
            Number(c.feeBreakdown?.discount || 0) +
            Number(c.feeBreakdown?.scholarship || 0),
          0,
        ),
        challansCount: challans.length,
      },
    };
  }

  static async getChallans(
    schoolId: string,
    filter?:
      | string
      | {
          status?: string;
          branchId?: string;
          classId?: string;
          classCategoryId?: string;
          sectionId?: string;
          month?: string;
          search?: string;
          limit?: number;
          skip?: number;
        },
  ) {
    const query: any = { schoolId };
    let statusFilter: string | undefined;
    let classId: string | undefined;
    let classCategoryId: string | undefined;
    let sectionId: string | undefined;
    let month: string | undefined;
    let search: string | undefined;
    let limit = 500;
    let skip = 0;

    if (typeof filter === "string") {
      statusFilter = filter;
    } else if (filter) {
      statusFilter = filter.status;
      classId = filter.classId;
      classCategoryId = filter.classCategoryId;
      sectionId = filter.sectionId;
      month = filter.month;
      search = filter.search;
      if ((filter as any).branchId) query.branchId = (filter as any).branchId;
      if (filter.limit) limit = Math.min(1000, Math.max(1, filter.limit));
      if (filter.skip) skip = Math.max(0, filter.skip);
    }

    if (statusFilter && statusFilter !== "ALL") query.status = statusFilter;
    if (classId) query.classId = classId;
    if (sectionId) query.sectionName = sectionId;
    if (month && month !== "ALL") {
      query.month = { $in: feeMonthVariants(month) };
    }
    if (classCategoryId) {
      const classIds = await ClassModel.find({ schoolId, classCategoryId }).distinct("_id");
      query.classId = { $in: classIds };
    }
    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { studentName: { $regex: q, $options: "i" } },
        { challanNumber: { $regex: q, $options: "i" } },
        { rollNumber: { $regex: q, $options: "i" } },
        { admissionNumber: { $regex: q, $options: "i" } },
      ];
    }

    const context = branchContext.getStore();
    const readRows = () => FeeChallan.find(query)
      .sort({ dueDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    let rows: any[];
    if (typeof filter === "object" && filter?.branchId && context?.owner) {
      const branch = await withoutBranchScope(() => Branch.findOne({ _id: filter.branchId, organizationId: schoolId }).select("_id").lean().exec());
      if (!branch) throw { statusCode: 400, message: "Choose a branch belonging to this school." };
      rows = await withoutBranchScope(() => FeeChallan.find({ ...query, schoolId, organizationId: schoolId, branchId: filter.branchId }).sort({ dueDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean().exec());
    } else {
      if (typeof filter === "object" && filter?.branchId && context && filter.branchId !== context.branchId)
        throw { statusCode: 403, message: "You can only view fee collection for your assigned branch." };
      rows = await readRows();
    }
    const profile = await SchoolService.getSchoolProfile(schoolId);
    return rows.map((row) => ({
      ...row,
      currentPayablePKR: FeeCalculationService.evaluateCurrentPayable(row).payableAmount,
      documentSnapshot: row.documentSnapshot || {
        school: {
          name: profile.name,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
          logoUrl: profile.logoUrl,
        },
        bank: profile.bankDetails,
        legacy: true,
      },
    }));
  }

  static async getChallanPdf(schoolId: string, challanId: string): Promise<Buffer> {
    const challan: any = await FeeChallan.findOne({ _id: challanId, schoolId, isVoided: { $ne: true }, status: { $ne: "VOIDED" } }).lean();
    if (!challan) throw { statusCode: 404, message: "Fee Challan not found." };

    const pdf = await ChallanPdfService.generateStudentChallanPdf(schoolId, challan);
    await FeeChallan.updateOne({ _id: challanId, schoolId }, { $inc: { copiesPrintedCount: 1 } });
    return pdf;
  }

  static async getBulkChallansPdf(
    schoolId: string,
    filter: {
      challanIds?: string[];
      classId?: string;
      sectionId?: string;
      month?: string;
      academicSession?: string;
    },
  ): Promise<Buffer> {
    const query: any = { schoolId, isVoided: { $ne: true }, status: { $ne: "VOIDED" } };
    if (filter.challanIds && filter.challanIds.length > 0) {
      query._id = { $in: filter.challanIds };
    } else {
      if (filter.classId) query.classId = filter.classId;
      if (filter.sectionId) {
        const section: any = await SectionModel.findOne({ _id: filter.sectionId, schoolId, ...(filter.classId ? { classId: filter.classId } : {}) }).lean();
        if (!section) throw { statusCode: 400, message: "Choose a valid class section." };
        query.sectionName = section.name;
      }
      if (filter.month) query.month = { $in: feeMonthVariants(filter.month) };
      if (filter.academicSession) query.academicSession = filter.academicSession;
    }

    const challans = await FeeChallan.find(query)
      .sort({ className: 1, rollNumber: 1, studentName: 1 })
      .lean();
    if (!challans || challans.length === 0) {
      throw { statusCode: 404, message: "No matching fee challans found to generate PDF." };
    }

    if (filter.challanIds && challans.length !== new Set(filter.challanIds).size) throw { statusCode: 404, message: "One or more selected challans are unavailable." };
    if (new Set(challans.map((c: any) => String(c.studentId))).size !== challans.length) throw { statusCode: 400, message: "Choose one saved challan per student and fee month." };
    const pdf = await ChallanPdfService.generateClassChallanBatchPdf(schoolId, challans);
    const ids = challans.map((c) => c._id);
    await FeeChallan.updateMany({ _id: { $in: ids }, schoolId }, { $inc: { copiesPrintedCount: 1 } });

    return pdf;
  }

  static async getReceiptForChallan(schoolId: string, challanId: string) {
    const payment = await FeePayment.findOne({ schoolId, challanId })
      .sort({ paidAt: -1 })
      .populate(
        "studentId",
        "name parentInfo rollNumber admissionNumber className sectionName",
      )
      .populate("challanId")
      .lean();
    if (!payment)
      throw {
        statusCode: 404,
        message: "No payment receipt exists for this challan.",
      };
    const profile = await SchoolService.getSchoolProfile(schoolId);
    return {
      ...payment,
      challanId: (payment as any).documentSnapshot?.challan || (payment as any).challanId,
      documentSnapshot: (payment as any).documentSnapshot || {
        school: {
          name: profile.name,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
          logoUrl: profile.logoUrl,
        },
        legacy: true,
      },
    };
  }

  static async getReceiptById(schoolId: string, paymentId: string) {
    const payment = await FeePayment.findOne({ _id: paymentId, schoolId })
      .populate(
        "studentId",
        "name parentInfo rollNumber admissionNumber className sectionName",
      )
      .populate("challanId")
      .lean();
    if (!payment)
      throw { statusCode: 404, message: "Payment receipt not found." };
    const profile = await SchoolService.getSchoolProfile(schoolId);
    return {
      ...payment,
      challanId: (payment as any).documentSnapshot?.challan || (payment as any).challanId,
      documentSnapshot: (payment as any).documentSnapshot || {
        school: {
          name: profile.name,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
          logoUrl: profile.logoUrl,
        },
        legacy: true,
      },
    };
  }

  // 4. PAYMENT COLLECTION & RECEIPT
  static async collectPayment(
    schoolId: string,
    challanId: string,
    input: {
      amountPKR: number;
      paymentMethod: "Cash" | "Bank Transfer" | "Online" | "Cheque" | "Other";
      requestId?: string;
      transactionReference?: string;
      paymentDate?: string;
    },
    collectorName: string,
  ) {
    if (
      !Number.isFinite(input.amountPKR) ||
      input.amountPKR <= 0 ||
      Math.abs(input.amountPKR * 100 - Math.round(input.amountPKR * 100)) >
        0.000001
    )
      throw {
        statusCode: 400,
        message:
          "Enter a positive payment amount with at most two decimal places.",
      };
    const session = await mongoose.startSession();
    let result: any;
    try {
      let paidAt: Date;
      try {
        const paymentDateKey = input.paymentDate
          ? normalizeBillingDate(input.paymentDate)
          : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
        const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
        if (paymentDateKey > todayKey) throw new Error("Payment date cannot be in the future.");
        paidAt = billingDateAsUtcMidnight(paymentDateKey);
      } catch (error: any) {
        throw { statusCode: 400, message: error?.message || "Enter a valid payment date." };
      }
      await session.withTransaction(async () => {
        if (input.requestId) {
          const previous: any = await FeePayment.findOne({
            schoolId,
            paymentRequestId: input.requestId,
          }).session(session);
          if (previous) {
            if (
              String(previous.challanId) !== challanId ||
              previous.amountPKR !== input.amountPKR ||
              previous.paymentMethod !== input.paymentMethod ||
              (input.paymentDate !== undefined && normalizeBillingDate(previous.paidAt) !== normalizeBillingDate(paidAt)) ||
              String(previous.transactionReference || "") !== String(input.transactionReference || "")
            )
              throw {
                statusCode: 409,
                message:
                  "This payment request ID belongs to a different payment.",
              };
            result = await FeeChallan.findOne({
              _id: challanId,
              schoolId,
            }).session(session);
            return;
          }
        }
        const challan = await FeeChallan.findOne({
          _id: challanId,
          schoolId,
        }).session(session);
        if (!challan)
          throw { statusCode: 404, message: "Fee Challan not found." };
        if (challan.isVoided || challan.status === "VOIDED")
          throw {
            statusCode: 400,
            message: "Cannot collect payment on a voided challan.",
          };
        if (input.amountPKR > FeeCalculationService.evaluateCurrentPayable(challan).payableAmount)
          throw {
            statusCode: 400,
            message: "Payment cannot exceed the remaining balance.",
          };
        const profile = await SchoolService.getSchoolProfile(schoolId);
        const studentProfile: any = await Student.findOne({
          _id: challan.studentId,
          schoolId,
        })
          .select("parentInfo sectionName admissionNumber")
          .session(session)
          .lean();
        const documentSnapshot: any = {
          documentStyle:
            profile.documentSettings?.templates?.["fee-receipt"] ||
            defaultDocumentStyle("fee-receipt"),
          school: {
            name: profile.name,
            address: profile.address,
            phone: profile.phone,
            email: profile.email,
            logoUrl: profile.logoUrl,
            ...profile.documentSettings?.branding,
          },
          student: {
            name: challan.studentName,
            rollNumber: challan.rollNumber,
            className: challan.className,
            admissionNumber:
              challan.admissionNumber || studentProfile?.admissionNumber,
            sectionName: studentProfile?.sectionName,
            parentInfo: studentProfile?.parentInfo,
          },
          feeBreakdown: challan.feeBreakdown,
          month: challan.month,
          challanNumber: challan.challanNumber,
        };
        const receiptNumber = `REC-${paidAt.getUTCFullYear()}-${randomUUID().replace(/-/g, "").toUpperCase()}`;
        FeeCalculationService.applyPayment(challan, input.amountPKR, paidAt);
        documentSnapshot.challan = { challanNumber: challan.challanNumber, month: challan.month, dueDate: challan.dueDate, feeBreakdown: JSON.parse(JSON.stringify(challan.feeBreakdown)), totalAmountPKR: challan.totalAmountPKR, paidAmountPKR: challan.paidAmountPKR, remainingAmountPKR: challan.remainingAmountPKR, appliedEarlyDiscountPKR: challan.appliedEarlyDiscountPKR, status: challan.status };
        challan.paymentMethod = input.paymentMethod;
        challan.paidDate = paidAt;
        challan.receiptNumber = receiptNumber;
        challan.collectedByUserName = collectorName;
        await challan.save({ session });
        const [savedPayment]=await FeePayment.create(
          [
            {
              schoolId,
              challanId: challan._id,
              studentId: challan.studentId,
              studentName: challan.studentName,
              rollNumber: challan.rollNumber,
              className: challan.className,
              amountPKR: input.amountPKR,
              paymentMethod: input.paymentMethod,
              paidAt,
              receiptNumber,
              collectedByUserName: collectorName,
              paymentRequestId: input.requestId,
              transactionReference: input.transactionReference,
              balanceAfterPKR: challan.remainingAmountPKR,
              documentSnapshot,
            },
          ],
          { session },
        );
        await notifyFeeEvent(challan,"payment",savedPayment,session);
        await AuditLog.create(
          [
            {
              schoolId,
              action: "FEE_PAYMENT_COLLECTED",
              performedByName: collectorName,
              details: `Collected PKR ${input.amountPKR}. Receipt ${receiptNumber}.`,
            },
          ],
          { session },
        );
        result = challan;
      });
      return result;
    } catch (e: any) {
      if (
        e.code === 20 ||
        /Transaction numbers are only allowed/.test(e.message || "")
      )
        throw {
          statusCode: 503,
          message:
            "Payment collection requires MongoDB transaction support. Configure a replica set before recording payments.",
        };
      throw e;
    } finally {
      await session.endSession();
    }
  }

  // 5. VOID CHALLAN / REVERSAL
  static async voidChallan(
    schoolId: string,
    challanId: string,
    voidReason: string,
    userName: string,
  ) {
    const challan = await FeeChallan.findOne({ _id: challanId, schoolId });
    if (!challan) throw { statusCode: 404, message: "Challan not found." };

    if (challan.paidAmountPKR > 0)
      throw {
        statusCode: 409,
        message:
          "A paid or partially paid challan cannot be voided. Financial history must be preserved; contact accounts for an adjustment.",
      };
    challan.isVoided = true;
    challan.status = "VOIDED";
    challan.voidReason = voidReason;
    challan.voidedAt = new Date();
    await challan.save();

    await AuditLog.create({
      schoolId,
      action: "FEE_CHALLAN_VOIDED",
      performedByName: userName,
      details: `Voided Challan ${challan.challanNumber} (${challan.studentName}). Reason: ${voidReason}`,
    });

    return challan;
  }

  // 6. BULK CHALLAN GENERATOR
  static async generateBulkChallans(
    schoolId: string,
    classId: string,
    month: string,
    options: {
      academicSessionId?: string;
      sectionId?: string;
      studentIds?: string[];
    } = {},
  ) {
    try {
      month = feeMonth(month);
    } catch {
      throw { statusCode: 400, message: "Choose a valid fee month." };
    }
    const months = feeMonthVariants(month);
    const linkedClass = await ClassModel.findOne({
      _id: classId,
      schoolId,
    }).select("name");
    if (!linkedClass)
      throw {
        statusCode: 400,
        message: "Select a class belonging to this school.",
      };
    const session = await AcademicSession.findOne({
      schoolId,
      ...(options.academicSessionId
        ? { _id: options.academicSessionId }
        : { isCurrent: true }),
    }).select("name _id");
    if (!session)
      throw {
        statusCode: 400,
        message:
          "Select a current academic session before generating fee challans.",
      };
    if (
      options.sectionId &&
      !(await SectionModel.exists({
        _id: options.sectionId,
        classId,
        schoolId,
      }))
    )
      throw {
        statusCode: 400,
        message: "Choose a section belonging to this class.",
      };
    const students = await Student.find({
      schoolId,
      classId,
      academicSessionId: session._id,
      status: "ACTIVE",
      ...(options.sectionId ? { sectionId: options.sectionId } : {}),
      ...(options.studentIds ? { _id: { $in: options.studentIds } } : {}),
    }).lean();
    if (options.studentIds && students.length !== options.studentIds.length)
      throw {
        statusCode: 400,
        message:
          "One or more selected students do not belong to this active class/session.",
      };
    if (!students || students.length === 0) {
      throw {
        statusCode: 400,
        message: `No active students found in ${linkedClass.name}.`,
      };
    }
    const activeForPeriod: any[] = await FeeChallan.find({
      schoolId,
      studentId: { $in: students.map((student: any) => student._id) },
      month: { $in: months },
      academicSession: session.name,
      isVoided: { $ne: true },
      status: { $ne: "VOIDED" },
    }).lean();
    const activeByStudent = new Map<string, any>();
    for (const challan of activeForPeriod) {
      const key = String(challan.studentId);
      if (activeByStudent.has(key)) throw { statusCode: 409, message: `Duplicate active challans exist for ${challan.studentName || key} in ${month}. Review existing invoices before retrying.` };
      activeByStudent.set(key, challan);
    }

    const assignedFeeStructureIds = students.flatMap((s: any) => [s.feeStructureId, ...(s.feeStructureHistory || []).flatMap((entry: any) => [entry.newFeeStructureId, entry.previousFeeStructureId])]).filter(Boolean);
    const structures: any[] = await FeeStructure.find({
      schoolId,
      $or: [
        { classId, $or: [{ academicSession: { $exists: false } }, { academicSession: session.name }] },
        { classScope: "ALL", $or: [{ academicSession: { $exists: false } }, { academicSession: session.name }] },
        ...(assignedFeeStructureIds.length ? [{ _id: { $in: assignedFeeStructureIds } }] : []),
        { classId: { $in: [null, undefined] } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const structureMap = new Map<string, any>();
    structures.forEach((st) => structureMap.set(String(st._id), st));

    const targetMonth = feeMonth(month);

    const resolveStudentStructure = (s: any) => {
      const assignment = studentFeeAssignment(s, targetMonth, targetMonth);
      const structure = structureMap.get(String(assignment.feeStructureId));
      return feeStructureEligible(structure, { ...s, academicSessionName: session.name }) ? { structure, assignment } : undefined;
    };

    const unassigned = students.filter((s) => !activeByStudent.has(String(s._id)) && !resolveStudentStructure(s));
    if (unassigned.length) {
      throw {
        statusCode: 400,
        message: `Assign an eligible fee structure before generating challans: ${unassigned.map((s) => `${s.name} (${s.admissionNumber || s.rollNumber || s._id})`).join(", ")}`,
      };
    }

    const history: any[] = await FeeChallan.find({
      schoolId,
      studentId: { $in: students.map((s) => s._id) },
    })
      .select(
        "studentId month academicSession isVoided status remainingAmountPKR",
      )
      .lean();
    const profile = await SchoolService.getSchoolProfile(schoolId);
    const documentSnapshot: any = {
      challanTemplate: profile.documentSettings?.challanTemplate || defaultChallanTemplate(),
      school: {
        name: profile.name,
        branchName: profile.branchName,
        address: profile.address,
        phone: profile.phone,
        email: profile.email,
        logoUrl: profile.logoUrl,
        bankDetails: profile.bankDetails,
      },
      bank: profile.bankDetails,
    };
    const generated: any[] = [];
    let existingCount = 0;
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const existing = activeByStudent.get(String(s._id));
      if (existing) {
        generated.push(existing);
        existingCount++;
        continue;
      }
      const resolvedAssignment = resolveStudentStructure(s);
      const feeStructure = resolvedAssignment?.structure;

      const dueDate = dueDateForFeeMonth(month, feeStructure.dueDateDay, feeStructure.title, s.name);
      let latePolicy: any = normalizeLateFinePolicy(feeStructure.lateFeeFinePolicy, `Fee structure '${feeStructure.title}'`, Number(feeStructure.lateFeeFineRate) || 0);
      if (!latePolicy && profile.feePolicy?.lateFineModel)
        latePolicy = normalizeLateFinePolicy({ model: profile.feePolicy.lateFineModel, type: profile.feePolicy.lateFineType || "FIXED", amount: profile.feePolicy.lateFineAmount, graceDays: profile.feePolicy.lateFineGraceDays, dailyRate: profile.feePolicy.lateFineDailyRate, maxFineCap: profile.feePolicy.lateFineCap, stages: profile.feePolicy.lateFineStages }, "School settings");
      if (!latePolicy && Number(feeStructure.lateFeeFineRate) > 0)
        latePolicy = normalizeLateFinePolicy({ model: "ONE_TIME", type: "FIXED", amount: feeStructure.lateFeeFineRate }, `Fee structure '${feeStructure.title}'`);
      latePolicy ||= { model: "DISABLED", type: "FIXED", amount: 0, graceDays: 0, dailyRate: 0, maxFineCap: 0, stages: [] };
      const effectiveFeeStructure = { ...feeStructure, lateFeeFinePolicy: latePolicy, lateFeeFineRate: latePolicy.amount };

      const prior = history.filter(
        (c) => String(c.studentId) === String(s._id),
      );
      const isFirstChallanForStudent = !prior.some(
        (c) => !c.isVoided && c.status !== "VOIDED",
      );
      const voided = prior.filter(
        (c) =>
          (c.isVoided || c.status === "VOIDED") &&
          c.academicSession === session.name &&
          months.includes(c.month),
      ).length;
      const previousBalance =
        Math.round(
          prior
            .filter(
              (c) =>
                !c.isVoided &&
                c.status !== "VOIDED" &&
                (() => {
                  try {
                    return feeMonth(c.month) < month;
                  } catch {
                    return false;
                  }
                })(),
            )
            .reduce((n, c) => n + Number(c.remainingAmountPKR || 0), 0) * 100,
        ) / 100;
      const reference = createHash("sha256")
        .update([schoolId, s._id, month, session.name, voided].join("|"))
        .digest("hex")
        .slice(0, 24)
        .toUpperCase();
      const challanNumber = `CH-${reference}`;

      // Smart centralized calculation
      const calcResult = FeeCalculationService.calculateStudentChallan({
        student: {
          _id: s._id,
          name: s.name,
          admissionNumber: s.admissionNumber,
          rollNumber: s.rollNumber,
          classId: s.classId,
          className: linkedClass.name,
          classCategoryName: s.classCategoryName || (linkedClass as any).classCategoryName,
          sectionName: s.sectionName,
          feeStructureId: feeStructure._id,
          feeStructureTitle: feeStructure.title,
          concessionType: resolvedAssignment?.assignment?.concessionType || s.concessionType,
          concessionValue: resolvedAssignment?.assignment?.concessionValue ?? s.concessionValue,
          concessionReason: resolvedAssignment?.assignment?.concessionReason || s.concessionReason,
          parentInfo: s.parentInfo,
        },
        structure: effectiveFeeStructure,
        schoolPolicy: profile.feePolicy,
        month,
        dueDate,
        previousBalance: 0, // Prior invoices remain separately collectible; never duplicate their principal.
        isFirstChallanForStudent,
      });

      const totalAmountPKR = calcResult.totalAmountPKR;

      let challan: any;
      try {
        challan = await FeeChallan.findOneAndUpdate(
          {
            schoolId,
            studentId: s._id,
            month: { $in: months },
            academicSession: session.name,
            isVoided: { $ne: true },
            status: { $ne: "VOIDED" },
          },
          {
            $setOnInsert: {
              schoolId,
              challanNumber,
              studentId: s._id,
              studentName: s.name,
              fatherName: s.parentInfo?.fatherName || "",
              feeStructureId: feeStructure._id,
              feeStructureTitle: feeStructure.title,
              rollNumber: s.rollNumber,
              admissionNumber: s.admissionNumber,
              classId: s.classId,
              className: linkedClass.name,
              classCategoryName: s.classCategoryName || (linkedClass as any).classCategoryName,
              academicSession: session.name,
              sectionName: s.sectionName,
              month,
              previousBalance,
              previousBalanceInformational: true,
              dueDate,
              documentSnapshot,
              concessionAmount: calcResult.concessionAmount,
              concessionReason: calcResult.concessionReason,
              earlyPaymentDiscount: calcResult.earlyPaymentDiscount,
              earlyPaymentDeadline: calcResult.earlyPaymentDeadline,
              amountPayableWithEarlyDiscount: calcResult.amountPayableWithEarlyDiscount,
              lateFinePolicyModel: calcResult.lateFinePolicyModel,
              lateFineStages: calcResult.lateFineStages,
              amountPayableAfterDueDate: calcResult.amountPayableAfterDueDate,
              lateFeePolicyAmount: Math.max(0, Number(latePolicy.amount) || 0),
              lateFeeFinePolicy: latePolicy,
              feeBreakdown: calcResult.feeBreakdown,
              totalAmountPKR,
              paidAmountPKR: 0,
              remainingAmountPKR: totalAmountPKR,
              status: totalAmountPKR === 0 ? "ZERO_BALANCE" : "PENDING",
            },
          },
          { upsert: true, new: true },
        );
      } catch (e: any) {
        if (e.code !== 11000) throw e;
        challan = await FeeChallan.findOne({
          schoolId,
          studentId: s._id,
          month,
          academicSession: session.name,
          isVoided: { $ne: true },
          status: { $ne: "VOIDED" },
        });
        if (!challan) throw e;
        existingCount++;
      }
      await notifyFeeEvent(challan, "generated", null, null).catch(() =>
        console.error("[Fees] Portal notification pending; reminder worker will retry."),
      );
      generated.push(challan);
    }

    return {
      count: generated.length,
      challanIds: generated.map((c) => String(c._id)),
      existingCount,
      createdCount: generated.length - existingCount,
      zeroBalanceCount: generated.filter((c) => Number(c.totalAmountPKR) === 0 && Number(c.remainingAmountPKR) === 0).length,
      message: existingCount === generated.length
        ? `Challans already exist for ${linkedClass.name} (${month}). No duplicates were created.`
        : `Prepared ${generated.length} challans for ${linkedClass.name} (${month}); ${existingCount} already existed and ${generated.length - existingCount} were newly created.`,
    };
  }

  // 7. EXPENSES MANAGEMENT
  static async getExpenses(schoolId: string, categoryFilter?: string) {
    const query: any = { schoolId, isVoided: { $ne: true },category:{$ne:"Salary"} };
    if(categoryFilter==="Salary")return [];
    if (categoryFilter && categoryFilter !== "ALL")
      query.category = categoryFilter;
    return Expense.find(query).sort({ expenseDate: -1 });
  }

  static async createExpense(schoolId: string, data: any, userName: string) {
    if(data.category==="Salary")throw {statusCode:400,message:"Record salary payments through approved payroll, not operational expenses."};
    const expense = await Expense.create({
      ...data,
      schoolId,
      loggedByName: userName,
    });

    await AuditLog.create({
      schoolId,
      action: "EXPENSE_CREATED",
      performedByName: userName,
      details: `Created expense: ${expense.title} (PKR ${expense.amountPKR}) under category ${expense.category}.`,
    });

    return expense;
  }

  static async voidExpense(
    schoolId: string,
    expenseId: string,
    voidReason: string,
    userName: string,
  ) {
    const expense = await Expense.findOne({ _id: expenseId, schoolId });
    if (!expense)
      throw { statusCode: 404, message: "Expense entry not found." };

    expense.isVoided = true;
    expense.voidReason = voidReason;
    await expense.save();

    await AuditLog.create({
      schoolId,
      action: "EXPENSE_VOIDED",
      performedByName: userName,
      details: `Voided expense: ${expense.title} (PKR ${expense.amountPKR}). Reason: ${voidReason}`,
    });

    return expense;
  }
}
