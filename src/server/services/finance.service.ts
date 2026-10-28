import { feeMonth, feeMonthVariants } from "../../lib/fee-math";
import { defaultDocumentStyle } from "../../lib/document-templates";
import { SchoolService } from "./school.service";
import mongoose from "mongoose";
import { analyticsPeriodStart } from "./platformAnalytics.service";
import { branchContext } from "../utils/branchScope";
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
    const c = collections[0] || {},
      b = challans[0] || {},
      expenseAmount = expenses[0]?.amount || 0;
    return {
      metrics: {
        todayCollectionPKR: c.today || 0,
        monthlyCollectionPKR: c.monthly || 0,
        pendingFeesPKR: b.pendingAmount || 0,
        overdueFeesPKR: b.overdueAmount || 0,
        totalExpensesPKR: expenseAmount,
        netCollectionPKR: (c.monthly || 0) - expenseAmount,
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

  static async createFeeStructure(schoolId: string, data: any) {
    const linkedClass = await ClassModel.findOne({
      _id: data.classId,
      schoolId,
    }).select("name");
    const session = await AcademicSession.findOne({
      schoolId,
      isCurrent: true,
    }).select("name");
    if (!linkedClass)
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
        remainingBalance: sum("remainingAmountPKR"),
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

  static async getChallans(schoolId: string, status?: string) {
    const query: any = { schoolId };
    if (status && status !== "ALL") query.status = status;
    const rows: any[] = await FeeChallan.find(query)
      .sort({ dueDate: -1, createdAt: -1 })
      .lean();
    const profile = await SchoolService.getSchoolProfile(schoolId);
    return rows.map((row) => ({
      ...row,
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
              previous.paymentMethod !== input.paymentMethod
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
        if (input.amountPKR > challan.remainingAmountPKR)
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
        const documentSnapshot = {
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
        const paidAt = new Date(),
          receiptNumber = `REC-${paidAt.getUTCFullYear()}-${randomUUID().replace(/-/g, "").toUpperCase()}`;
        challan.paidAmountPKR =
          Math.round((challan.paidAmountPKR + input.amountPKR) * 100) / 100;
        challan.remainingAmountPKR =
          Math.round((challan.totalAmountPKR - challan.paidAmountPKR) * 100) /
          100;
        challan.status = challan.remainingAmountPKR === 0 ? "PAID" : "PARTIAL";
        challan.paymentMethod = input.paymentMethod;
        challan.paidDate = paidAt;
        challan.receiptNumber = receiptNumber;
        challan.collectedByUserName = collectorName;
        await challan.save({ session });
        await FeePayment.create(
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
    dueDateStr: string,
    lateFeeFine: number = 0,
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

    const structures: any[] = await FeeStructure.find({
      schoolId,
      classId,
      $or: [
        { academicSession: session.name },
        { academicSession: { $in: [null, ""] } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
    structures.sort(
      (a, b) =>
        Number(b.academicSession === session.name) -
        Number(a.academicSession === session.name),
    );
    const selectedStructure = (s: any) =>
      structures.find(
        (f) => f.sectionId && String(f.sectionId) === String(s.sectionId),
      ) || structures.find((f) => !f.sectionId);
    if (students.some((s) => !selectedStructure(s)))
      throw {
        statusCode: 400,
        message:
          "Create a fee structure for every selected class/section in this academic session first.",
      };
    const history: any[] = await FeeChallan.find({
      schoolId,
      studentId: { $in: students.map((s) => s._id) },
    })
      .select(
        "studentId month academicSession isVoided status remainingAmountPKR",
      )
      .lean();
    const dueDate = new Date(dueDateStr);

    const profile = await SchoolService.getSchoolProfile(schoolId);
    const documentSnapshot = {
      documentStyle:
        profile.documentSettings?.templates?.["fee-statement"] ||
        defaultDocumentStyle("fee-statement"),
      school: {
        name: profile.name,
        address: profile.address,
        phone: profile.phone,
        email: profile.email,
        logoUrl: profile.logoUrl,
      },
      bank: profile.bankDetails,
    };
    const generated: any[] = [];
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const feeStructure = selectedStructure(s),
        tuitionFee = feeStructure.tuitionFee || 0,
        admissionFee = history.some(
          (c) =>
            String(c.studentId) === String(s._id) &&
            !c.isVoided &&
            c.status !== "VOIDED",
        )
          ? 0
          : feeStructure.admissionFee || 0,
        examFee = feeStructure.examFee || 0,
        transportFee = feeStructure.transportFee || 0,
        libraryFee = feeStructure.libraryFee || 0,
        computerFee = feeStructure.computerFee || 0,
        otherCharges = feeStructure.otherCharges || 0;
      const prior = history.filter(
        (c) => String(c.studentId) === String(s._id),
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

      const gross =
        tuitionFee +
        admissionFee +
        examFee +
        transportFee +
        libraryFee +
        computerFee +
        otherCharges;
      const discount = Math.min(
        gross,
        Math.max(0, feeStructure.defaultDiscount || 0),
      );
      const totalAmountPKR =
        Math.round((gross - discount + lateFeeFine) * 100) / 100;

      const existing = await FeeChallan.findOne({
        schoolId,
        studentId: s._id,
        month: { $in: months },
        academicSession: session.name,
        isVoided: { $ne: true },
        status: { $ne: "VOIDED" },
      });
      if (existing) {
        generated.push(existing);
        continue;
      }
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
              rollNumber: s.rollNumber,
              admissionNumber: s.admissionNumber,
              classId: s.classId,
              className: linkedClass.name,
              academicSession: session.name,
              sectionName: s.sectionName,
              month,
              previousBalance,
              dueDate,
              documentSnapshot,
              feeBreakdown: {
                discount,
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
      }
      generated.push(challan);
    }

    return {
      count: generated.length,
      challanIds: generated.map((c) => String(c._id)),
      message: `Generated ${generated.length} fee challans for ${linkedClass.name} (${month}).`,
    };
  }

  // 7. EXPENSES MANAGEMENT
  static async getExpenses(schoolId: string, categoryFilter?: string) {
    const query: any = { schoolId, isVoided: { $ne: true } };
    if (categoryFilter && categoryFilter !== "ALL")
      query.category = categoryFilter;
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
