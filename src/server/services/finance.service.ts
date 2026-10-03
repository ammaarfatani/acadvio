import mongoose from "mongoose";
import { analyticsPeriodStart } from "./platformAnalytics.service";
import { randomUUID } from "crypto";
import { FeeStructure, FeeChallan, FeePayment, Expense } from "../models/fee.model";
import { Student } from "../models/student.model";
import { AuditLog } from "../models/auditLog.model";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";

export class FinanceService {
  static async getSchoolClasses(schoolId: string) {
    return ClassModel.find({ schoolId }).sort({ numericLevel: 1, name: 1 }).select("name code numericLevel");
  }

  // 1. FINANCE DASHBOARD
  static async getFinanceDashboard(schoolId: string) {
    const now = new Date();
    const today = analyticsPeriodStart("today", now), monthStart = analyticsPeriodStart("month", now);
    const scope = { schoolId: new mongoose.Types.ObjectId(schoolId) };
    const [collections, challans, expenses, categories] = await Promise.all([
      FeePayment.aggregate([{ $match: { ...scope, paidAt: { $gte: monthStart, $lte: now } } }, { $group: { _id: null, monthly: { $sum: "$amountPKR" }, today: { $sum: { $cond: [{ $gte: ["$paidAt", today] }, "$amountPKR", 0] } } } }]),
      FeeChallan.aggregate([{ $match: { ...scope, isVoided: { $ne: true } } }, { $group: { _id: null, count: { $sum: 1 }, pendingAmount: { $sum: "$remainingAmountPKR" }, overdueAmount: { $sum: { $cond: [{ $and: [{ $gt: ["$remainingAmountPKR", 0] }, { $lt: ["$dueDate", now] }] }, "$remainingAmountPKR", 0] } }, paid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } }, partial: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "PARTIAL"] }, { $gte: ["$dueDate", now] }] }, 1, 0] } }, pending: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "PENDING"] }, { $gte: ["$dueDate", now] }] }, 1, 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $gt: ["$remainingAmountPKR", 0] }, { $lt: ["$dueDate", now] }] }, 1, 0] } } } }]),
      Expense.aggregate([{ $match: { ...scope, isVoided: { $ne: true }, expenseDate: { $gte: monthStart, $lte: now } } }, { $group: { _id: null, amount: { $sum: "$amountPKR" } } }]),
      Expense.aggregate([{ $match: { ...scope, isVoided: { $ne: true }, expenseDate: { $gte: monthStart, $lte: now } } }, { $group: { _id: "$category", amount: { $sum: "$amountPKR" } } }]),
    ]);
    const c = collections[0] || {}, b = challans[0] || {}, expenseAmount = expenses[0]?.amount || 0;
    return { metrics: { todayCollectionPKR: c.today || 0, monthlyCollectionPKR: c.monthly || 0, pendingFeesPKR: b.pendingAmount || 0, overdueFeesPKR: b.overdueAmount || 0, totalExpensesPKR: expenseAmount, netCollectionPKR: (c.monthly || 0)-expenseAmount, totalChallansCount: b.count || 0 }, statusCounts: { paid:b.paid || 0, partial:b.partial || 0, pending:b.pending || 0, overdue:b.overdue || 0 }, categoryExpenses: Object.fromEntries(categories.map((row:any) => [row._id,row.amount])) };
  }
  // 2. FEE STRUCTURES
  static async getFeeStructures(schoolId: string) {
    return FeeStructure.find({ schoolId }).sort({ className: 1 });
  }

  static async createFeeStructure(schoolId: string, data: any) {
    const linkedClass = await ClassModel.findOne({ _id: data.classId, schoolId }).select("name");
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("name");
    if (!linkedClass) throw { statusCode: 400, message: "Select a class belonging to this school." };
    if (!session) throw { statusCode: 400, message: "Select a current academic session first." };
    if (data.sectionId && !await SectionModel.exists({ _id: data.sectionId, schoolId, classId: data.classId })) throw { statusCode: 400, message: "Select a section belonging to this class and school." };
    const tuitionFee = data.tuitionFee || 0;
    const admissionFee = data.admissionFee || 0;
    const examFee = data.examFee || 0;
    const transportFee = data.transportFee || 0;
    const libraryFee = data.libraryFee || 0;
    const computerFee = data.computerFee || 0;
    const otherCharges = data.otherCharges || 0;

    const totalMonthlyFee = tuitionFee + examFee + transportFee + libraryFee + computerFee + otherCharges;

    return FeeStructure.create({
      ...data,
      schoolId,
      className: linkedClass.name,
      academicSession: session.name,
      admissionFee,
      tuitionFee,
      examFee,
      transportFee,
      libraryFee,
      computerFee,
      otherCharges,
      totalMonthlyFee,
    });
  }

  // 3. STUDENT ACCOUNT LEDGER
  static async getStudentLedger(schoolId: string, studentId: string) {
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) throw { statusCode: 404, message: "Student record not found." };

    const challans = await FeeChallan.find({ schoolId, studentId }).sort({ createdAt: -1 });

    const totalCharged = challans.reduce((sum, c) => sum + (c.totalAmountPKR || 0), 0);
    const totalPaid = challans.reduce((sum, c) => sum + (c.paidAmountPKR || 0), 0);
    const remainingBalance = totalCharged - totalPaid;
    const totalDiscounts = challans.reduce((sum, c) => sum + (c.feeBreakdown?.discount || 0), 0);

    return {
      student,
      summary: {
        totalCharged,
        totalPaid,
        remainingBalance,
        totalDiscounts,
        challansCount: challans.length,
      },
      challans,
    };
  }

  static async getChallans(schoolId: string, status?: string) {
    const query: any = { schoolId };
    if (status && status !== "ALL") query.status = status;
    return FeeChallan.find(query).sort({ dueDate: -1, createdAt: -1 }).lean();
  }

  static async getReceiptForChallan(schoolId: string, challanId: string) {
    const payment = await FeePayment.findOne({ schoolId, challanId }).sort({ paidAt: -1 }).populate("studentId", "name parentInfo rollNumber admissionNumber className sectionName").populate("challanId").lean();
    if (!payment) throw { statusCode: 404, message: "No payment receipt exists for this challan." };
    return payment;
  }

  // 4. PAYMENT COLLECTION & RECEIPT
  static async collectPayment(schoolId: string, challanId: string, paymentData: {
    amountPKR: number;
    paymentMethod: "Cash" | "Bank Transfer" | "Online" | "Cheque" | "Other";
  }, collectorName: string) {
    if (!Number.isFinite(paymentData.amountPKR) || paymentData.amountPKR <= 0) throw { statusCode: 400, message: "Enter a payment amount greater than zero." };
    // 1. Try transaction execution if MongoDB Replica Set is active
    try {
      const session = await mongoose.startSession();
      try {
        let txResult: any = null;
        await session.withTransaction(async () => {
          const challan = await FeeChallan.findOne({ _id: challanId, schoolId }).session(session);
          if (!challan) throw { statusCode: 404, message: "Fee Challan not found." };
          if (challan.isVoided || challan.status === "VOIDED") throw { statusCode: 400, message: "Cannot collect payment on a voided challan." };
          if (paymentData.amountPKR > challan.remainingAmountPKR) throw { statusCode: 400, message: `Payment (PKR ${paymentData.amountPKR}) cannot exceed remaining balance (PKR ${challan.remainingAmountPKR}).` };

          const paidAt = new Date();
          const receiptNumber = `REC-${paidAt.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

          challan.paidAmountPKR += paymentData.amountPKR;
          challan.remainingAmountPKR = Math.max(0, challan.totalAmountPKR - challan.paidAmountPKR);
          challan.status = challan.remainingAmountPKR === 0 ? "PAID" : "PARTIAL";
          challan.paymentMethod = paymentData.paymentMethod;
          challan.paidDate = paidAt;
          challan.receiptNumber = receiptNumber;
          challan.collectedByUserName = collectorName;
          await challan.save({ session });

          await FeePayment.create([{
            schoolId, challanId: challan._id, studentId: challan.studentId, studentName: challan.studentName,
            rollNumber: challan.rollNumber, className: challan.className, amountPKR: paymentData.amountPKR,
            paymentMethod: paymentData.paymentMethod, paidAt, receiptNumber, collectedByUserName: collectorName,
          }], { session });

          await AuditLog.create([{
            schoolId, action: "FEE_PAYMENT_COLLECTED", performedByName: collectorName,
            details: `Collected PKR ${paymentData.amountPKR} via ${paymentData.paymentMethod} for Challan ${challan.challanNumber} (${challan.studentName}). Receipt: ${receiptNumber}`,
          }], { session });

          txResult = challan;
        });
        return txResult;
      } finally {
        await session.endSession();
      }
    } catch (txnErr: any) {
      if (txnErr?.statusCode) throw txnErr;

      // 2. Fallback for standalone MongoDB (no replica set)
      const challan = await FeeChallan.findOne({ _id: challanId, schoolId });
      if (!challan) throw { statusCode: 404, message: "Fee Challan not found." };
      if (challan.isVoided || challan.status === "VOIDED") throw { statusCode: 400, message: "Cannot collect payment on a voided challan." };
      if (paymentData.amountPKR > challan.remainingAmountPKR) throw { statusCode: 400, message: `Payment (PKR ${paymentData.amountPKR}) cannot exceed remaining balance (PKR ${challan.remainingAmountPKR}).` };

      const paidAt = new Date();
      const receiptNumber = `REC-${paidAt.getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

      challan.paidAmountPKR += paymentData.amountPKR;
      challan.remainingAmountPKR = Math.max(0, challan.totalAmountPKR - challan.paidAmountPKR);
      challan.status = challan.remainingAmountPKR === 0 ? "PAID" : "PARTIAL";
      challan.paymentMethod = paymentData.paymentMethod;
      challan.paidDate = paidAt;
      challan.receiptNumber = receiptNumber;
      challan.collectedByUserName = collectorName;
      await challan.save();

      await FeePayment.create({
        schoolId, challanId: challan._id, studentId: challan.studentId, studentName: challan.studentName,
        rollNumber: challan.rollNumber, className: challan.className, amountPKR: paymentData.amountPKR,
        paymentMethod: paymentData.paymentMethod, paidAt, receiptNumber, collectedByUserName: collectorName,
      });

      await AuditLog.create({
        schoolId, action: "FEE_PAYMENT_COLLECTED", performedByName: collectorName,
        details: `Collected PKR ${paymentData.amountPKR} via ${paymentData.paymentMethod} for Challan ${challan.challanNumber} (${challan.studentName}). Receipt: ${receiptNumber}`,
      });

      return challan;
    }
  }

  // 5. VOID CHALLAN / REVERSAL
  static async voidChallan(schoolId: string, challanId: string, voidReason: string, userName: string) {
    const challan = await FeeChallan.findOne({ _id: challanId, schoolId });
    if (!challan) throw { statusCode: 404, message: "Challan not found." };

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
  static async generateBulkChallans(schoolId: string, classId: string, month: string, dueDateStr: string, lateFeeFine: number = 0) {
    const linkedClass = await ClassModel.findOne({ _id: classId, schoolId }).select("name");
    if (!linkedClass) throw { statusCode: 400, message: "Select a class belonging to this school." };
    const session = await AcademicSession.findOne({ schoolId, isCurrent: true }).select("name _id");
    if (!session) throw { statusCode: 400, message: "Select a current academic session before generating fee challans." };
    let students = await Student.find({ schoolId, classId, academicSessionId: session._id, status: "ACTIVE" });
    if (!students || students.length === 0) {
      students = await Student.find({ schoolId, classId, status: "ACTIVE" });
    }
    if (!students || students.length === 0) {
      throw { statusCode: 400, message: `No active students found in ${linkedClass.name}.` };
    }

    let feeStructure = await FeeStructure.findOne({ schoolId, classId, academicSession: session.name });
    if (!feeStructure) {
      feeStructure = await FeeStructure.findOne({ schoolId, classId }).sort({ createdAt: -1 });
    }
    if (!feeStructure) throw { statusCode: 400, message: `Create a fee structure for ${linkedClass.name} first.` };

    const tuitionFee = feeStructure.tuitionFee;
    const admissionFee = feeStructure.admissionFee || 0;
    const examFee = feeStructure.examFee || 0;
    const transportFee = feeStructure.transportFee || 0;
    const libraryFee = feeStructure.libraryFee || 0;
    const computerFee = feeStructure.computerFee || 0;
    const otherCharges = feeStructure.otherCharges || 0;
    const dueDate = new Date(dueDateStr);

    const generated: any[] = [];
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const challanNumber = `CH-${new Date().getFullYear()}-${month.substring(0, 3).toUpperCase()}-${String(classId).slice(-5)}-${String(s._id).slice(-5)}`;

      const totalAmountPKR = tuitionFee + admissionFee + examFee + transportFee + libraryFee + computerFee + otherCharges;

      const existing = await FeeChallan.findOne({ schoolId, studentId: s._id, month, academicSession: session.name, isVoided: { $ne: true } });
      if (existing) { generated.push(existing); continue; }
      const challan = await FeeChallan.findOneAndUpdate(
        { schoolId, studentId: s._id, month, academicSession: session.name, isVoided: { $ne: true } },
        {
          $set: {
            schoolId,
            challanNumber,
            studentId: s._id,
            studentName: s.name,
            rollNumber: s.rollNumber,
            admissionNumber: s.admissionNumber,
            classId: s.classId,
            className: linkedClass.name,
            academicSession: session.name,
            sectionName: s.sectionName,
            month,
            dueDate,
            feeBreakdown: {
              tuitionFee,
              admissionFee,
              examFee,
              transportFee,
              libraryFee,
              computerFee,
              otherCharges,
              lateFeeFine,
            },
            totalAmountPKR,
            paidAmountPKR: 0,
            remainingAmountPKR: totalAmountPKR,
            status: "PENDING",
          },
        },
        { upsert: true, new: true }
      );
      generated.push(challan);
    }

    return { count: generated.length, message: `Generated ${generated.length} fee challans for ${linkedClass.name} (${month}).` };
  }

  // 7. EXPENSES MANAGEMENT
  static async getExpenses(schoolId: string, categoryFilter?: string) {
    const query: any = { schoolId, isVoided: { $ne: true } };
    if (categoryFilter && categoryFilter !== "ALL") query.category = categoryFilter;
    return Expense.find(query).sort({ expenseDate: -1 });
  }

  static async createExpense(schoolId: string, data: any, userName: string) {
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

  static async voidExpense(schoolId: string, expenseId: string, voidReason: string, userName: string) {
    const expense = await Expense.findOne({ _id: expenseId, schoolId });
    if (!expense) throw { statusCode: 404, message: "Expense entry not found." };

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

