

const schoolDayEnd = (value: Date) => new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(value) + "T23:59:59.999+05:00");
const money = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export interface FeeCalculationInput {
  student: {
    _id?: any;
    name: string;
    admissionNumber?: string;
    rollNumber?: string;
    classId?: any;
    className?: string;
    classCategoryName?: string;
    sectionName?: string;
    feeStructureId?: any;
    feeStructureTitle?: string;
    concessionType?: "FIXED" | "PERCENTAGE";
    concessionValue?: number;
    concessionReason?: string;
    parentInfo?: {
      fatherName?: string;
    };
  };
  structure: {
    _id?: any;
    title: string;
    admissionFee?: number;
    tuitionFee?: number;
    examFee?: number;
    transportFee?: number;
    libraryFee?: number;
    computerFee?: number;
    customCharges?: Array<{ label: string; amount: number }>;
    otherCharges?: number;
    defaultDiscount?: number;
    lateFeeFineRate?: number;
    dueDateDay?: number;
    earlyPaymentDiscount?: {
      enabled: boolean;
      type: "FIXED" | "PERCENTAGE";
      amount: number;
      cutoffDaysBeforeDue?: number;
    };
    lateFeeFinePolicy?: {
      model?: "ONE_TIME" | "STAGES" | "RECURRING" | "DISABLED";
      type?: "FIXED" | "PERCENTAGE";
      amount: number;
      graceDays?: number;
      stages?: Array<{ daysAfterDue: number; afterDays?: number; fineAmount: number }>;
      dailyRate?: number;
      maxFineCap?: number;
    };
  };
  schoolPolicy?: {
    earlyDiscountEnabled?: boolean;
    earlyDiscountAmount?: number;
    earlyDiscountType?: "FIXED" | "PERCENTAGE";
    earlyDiscountDaysBeforeDue?: number;
    lateFineModel?: "ONE_TIME" | "STAGES" | "RECURRING" | "DISABLED";
    lateFineAmount?: number;
    lateFineGraceDays?: number;
    lateFineCap?: number;
    lateFineStages?: Array<{ afterDays: number; fineAmount: number }>;
    lateFineDailyRate?: number;
    unpaidBalancesCarryForward?: boolean;
  };
  month: string;
  dueDate: Date;
  previousBalance?: number;
  isFirstChallanForStudent?: boolean;
}

export interface FeeCalculationResult {
  studentId: any;
  studentName: string;
  fatherName: string;
  admissionNumber: string;
  rollNumber: string;
  classId: any;
  className: string;
  classCategoryName?: string;
  sectionName?: string;
  feeStructureId: any;
  feeStructureTitle: string;
  month: string;
  dueDate: Date;
  previousBalance: number;
  feeBreakdown: {
    admissionFee: number;
    tuitionFee: number;
    examFee: number;
    transportFee: number;
    libraryFee: number;
    computerFee: number;
    customCharges?: Array<{ label: string; amount: number }>;
    otherCharges: number;
    arrears: number;
    lateFeeFine: number;
    discount: number;
    scholarship: number;
  };
  originalTotalPKR: number;
  concessionAmount: number;
  concessionReason: string;
  netMonthlyFeePKR: number;
  totalAmountPKR: number;
  earlyPaymentDiscount: number;
  earlyPaymentDeadline?: Date;
  amountPayableWithEarlyDiscount: number;
  lateFinePolicyModel: "ONE_TIME" | "STAGES" | "RECURRING" | "DISABLED";
  lateFineStages: Array<{
    label: string;
    deadlineDate: Date;
    payableAmount: number;
    fineAmount: number;
  }>;
  amountPayableAfterDueDate: number;
}

export class FeeCalculationService {
  /**
   * Calculates a complete fee breakdown for a student based on their assigned structure,
   * individual concessions, and school/structure discount & late fine policies.
   */
  static calculateStudentChallan(input: FeeCalculationInput): FeeCalculationResult {
    const { student, structure, schoolPolicy, month, dueDate, previousBalance = 0, isFirstChallanForStudent = false } = input;

    // 1. Base component charges
    const admissionFee = isFirstChallanForStudent ? Number(structure.admissionFee || 0) : 0;
    const baseTuitionFee = Number(structure.tuitionFee || 0);
    const examFee = Number(structure.examFee || 0);
    const transportFee = Number(structure.transportFee || 0);
    const libraryFee = Number(structure.libraryFee || 0);
    const computerFee = Number(structure.computerFee || 0);
    const customCharges = structure.customCharges || [];
    const customTotal = customCharges.reduce((n, c) => n + Number(c.amount || 0), 0);
    const otherCharges = Number(structure.otherCharges || 0);
    let standardDiscount = Math.min(admissionFee + baseTuitionFee + examFee + transportFee + libraryFee + computerFee + otherCharges + customTotal, Number(structure.defaultDiscount || 0));

    // 2. Individual Student Concession calculation
    let concessionAmount = 0;
    const concessionType = student.concessionType || "FIXED";
    const concessionVal = Number(student.concessionValue || 0);

    if (concessionVal > 0) {
      if (concessionType === "PERCENTAGE") {
        concessionAmount = money((baseTuitionFee * Math.min(100, Math.max(0, concessionVal))) / 100);
      } else {
        concessionAmount = Math.min(baseTuitionFee, Math.max(0, concessionVal));
      }
    }

    standardDiscount = Math.min(standardDiscount, admissionFee + baseTuitionFee + examFee + transportFee + libraryFee + computerFee + otherCharges + customTotal - concessionAmount);
    const netTuitionFee = Math.max(0, baseTuitionFee - concessionAmount);

    // 3. Totals before and after concession
    const originalTotalPKR = admissionFee + baseTuitionFee + examFee + transportFee + libraryFee + computerFee + otherCharges + customTotal;
    const netMonthlyFeePKR = money(Math.max(0, admissionFee + netTuitionFee + examFee + transportFee + libraryFee + computerFee + otherCharges + customTotal - standardDiscount));
    const totalAmountPKR = Math.max(0, netMonthlyFeePKR + (previousBalance > 0 ? previousBalance : 0));

    // 4. Early Payment Discount Policy
    // Structure override takes precedence, fallback to school-wide policy
    const earlyEnabled = structure.earlyPaymentDiscount?.enabled ?? schoolPolicy?.earlyDiscountEnabled ?? false;
    const earlyType = structure.earlyPaymentDiscount?.type || schoolPolicy?.earlyDiscountType || "FIXED";
    const earlyAmountRaw = Number(structure.earlyPaymentDiscount?.amount ?? schoolPolicy?.earlyDiscountAmount ?? 0);
    const earlyDaysOffset = Number(structure.earlyPaymentDiscount?.cutoffDaysBeforeDue ?? schoolPolicy?.earlyDiscountDaysBeforeDue ?? 0);

    let earlyPaymentDiscount = 0;
    let earlyPaymentDeadline: Date | undefined;
    let amountPayableWithEarlyDiscount = totalAmountPKR;

    if (earlyEnabled && earlyAmountRaw > 0) {
      if (earlyType === "PERCENTAGE") {
        earlyPaymentDiscount = money((netMonthlyFeePKR * Math.min(100, earlyAmountRaw)) / 100);
      } else {
        earlyPaymentDiscount = Math.min(totalAmountPKR, earlyAmountRaw);
      }

      earlyPaymentDeadline = new Date(dueDate);
      if (earlyDaysOffset > 0) {
        earlyPaymentDeadline.setDate(earlyPaymentDeadline.getDate() - earlyDaysOffset);
      }

      amountPayableWithEarlyDiscount = Math.max(0, totalAmountPKR - earlyPaymentDiscount);
    }

    // 5. Late Fine Policy & Stages
    // Policy resolution: structure policy > school policy > fallback rate
    const lateModel = structure.lateFeeFinePolicy?.model || schoolPolicy?.lateFineModel || "DISABLED";
    const lateBaseAmount = Number(structure.lateFeeFinePolicy?.amount ?? schoolPolicy?.lateFineAmount ?? structure.lateFeeFineRate ?? 0);
    const graceDays = Number(structure.lateFeeFinePolicy?.graceDays ?? schoolPolicy?.lateFineGraceDays ?? 0);
    const stagesConfig: Array<{ daysAfterDue?: number; afterDays?: number; fineAmount: number }> = structure.lateFeeFinePolicy?.stages || schoolPolicy?.lateFineStages || [];

    const lateFineStages: Array<{
      label: string;
      deadlineDate: Date;
      payableAmount: number;
      fineAmount: number;
    }> = [];

    let amountPayableAfterDueDate = totalAmountPKR;

    if (lateModel === "ONE_TIME") {
      const fine = money(Math.max(0, structure.lateFeeFinePolicy?.type === "PERCENTAGE" ? totalAmountPKR * lateBaseAmount / 100 : lateBaseAmount));
      amountPayableAfterDueDate = totalAmountPKR + fine;

      const graceDeadline = new Date(dueDate);
      if (graceDays > 0) {
        graceDeadline.setDate(graceDeadline.getDate() + graceDays);
      }

      lateFineStages.push({
        label: graceDays > 0 ? `After Grace Period (${graceDays} days)` : "After Due Date",
        deadlineDate: graceDeadline,
        payableAmount: amountPayableAfterDueDate,
        fineAmount: fine,
      });
    } else if (lateModel === "STAGES" && stagesConfig.length > 0) {
      // Model B: Multiple Stages
      // Sort stages by days ascending
      const sortedStages = [...stagesConfig].sort((a, b) => (a.daysAfterDue ?? a.afterDays ?? 0) - (b.daysAfterDue ?? b.afterDays ?? 0));
      let highestPayable = totalAmountPKR;

      for (const st of sortedStages) {
        const stageDate = new Date(dueDate);
        const daysAfterDue = st.daysAfterDue ?? st.afterDays ?? 0;
        stageDate.setDate(stageDate.getDate() + daysAfterDue);
        const stagePayable = totalAmountPKR + Number(st.fineAmount || 0);
        highestPayable = Math.max(highestPayable, stagePayable);

        lateFineStages.push({
          label: `Within ${daysAfterDue} Days After Due Date`,
          deadlineDate: stageDate,
          payableAmount: stagePayable,
          fineAmount: Number(st.fineAmount || 0),
        });
      }
      amountPayableAfterDueDate = highestPayable;
    } else if (lateModel === "RECURRING") {
      // Model C: Recurring (e.g. daily rate up to cap)
      const dailyRate = Math.max(0, Number(structure.lateFeeFinePolicy?.dailyRate ?? schoolPolicy?.lateFineDailyRate ?? 0));
      const cap = Math.max(0, Number(structure.lateFeeFinePolicy?.maxFineCap ?? schoolPolicy?.lateFineCap ?? 0));

      // Recurring fines are evaluated by date; no invented intervals or fixed after-due amount.
      amountPayableAfterDueDate = totalAmountPKR;
    } else {
      // Model D: DISABLED
      amountPayableAfterDueDate = totalAmountPKR;
    }

    // A zero balance has no principal to fine. Keep its future payable and fine stages at zero.
    if (totalAmountPKR <= 0) {
      amountPayableAfterDueDate = 0;
      lateFineStages.length = 0;
      earlyPaymentDiscount = 0;
      earlyPaymentDeadline = undefined;
      amountPayableWithEarlyDiscount = 0;
    }

    return {
      studentId: student._id,
      studentName: student.name,
      fatherName: student.parentInfo?.fatherName || "Not recorded",
      admissionNumber: student.admissionNumber || "",
      rollNumber: student.rollNumber || "",
      classId: student.classId,
      className: student.className || "",
      classCategoryName: student.classCategoryName || "",
      sectionName: student.sectionName || "",
      feeStructureId: structure._id,
      feeStructureTitle: structure.title,
      month,
      dueDate,
      previousBalance,
      feeBreakdown: {
        admissionFee,
        tuitionFee: baseTuitionFee,
        examFee,
        transportFee,
        libraryFee,
        computerFee,
        otherCharges,
        customCharges,
        arrears: previousBalance > 0 ? previousBalance : 0,
        lateFeeFine: 0,
        discount: standardDiscount + concessionAmount,
        scholarship: 0,
      },
      originalTotalPKR,
      concessionAmount,
      concessionReason: student.concessionReason || "",
      netMonthlyFeePKR,
      totalAmountPKR,
      earlyPaymentDiscount,
      earlyPaymentDeadline,
      amountPayableWithEarlyDiscount,
      lateFinePolicyModel: lateModel,
      lateFineStages,
      amountPayableAfterDueDate,
    };
  }

  static applyPayment(challan: any, amount: number, at = new Date()) {
    const current = this.evaluateCurrentPayable(challan, at);
    if (!(amount > 0) || amount > current.payableAmount) throw { statusCode: 400, message: "Payment cannot exceed the date-specific remaining balance." };
    const discount = current.earlyDiscountApplied && amount === current.payableAmount ? Math.min(Number(challan.earlyPaymentDiscount || 0), Number(challan.remainingAmountPKR)) : 0;
    const fine = Math.max(0, current.lateFineApplied - Number(challan.feeBreakdown?.lateFeeFine || 0));
    if (challan.issuedTotalPKR === undefined) challan.issuedTotalPKR = challan.totalAmountPKR;
    if (discount) { challan.earlyDiscountAppliedAt = at; challan.appliedEarlyDiscountPKR = discount; }
    if (fine) { challan.feeBreakdown.lateFeeFine = money(Number(challan.feeBreakdown.lateFeeFine || 0) + fine); challan.lateFeeAppliedAt = at; }
    challan.totalAmountPKR = money(challan.totalAmountPKR + fine - discount);
    challan.paidAmountPKR = money(Number(challan.paidAmountPKR || 0) + amount);
    challan.remainingAmountPKR = money(Math.max(0, challan.totalAmountPKR - challan.paidAmountPKR));
    challan.status = challan.remainingAmountPKR === 0 ? "PAID" : "PARTIAL";
  }

  /**
   * Evaluates the real-time payable amount for a challan given an evaluation date
   * (e.g. today or the actual payment date).
   */
  static evaluateCurrentPayable(
    challan: any,
    evaluationDate: Date = new Date()
  ): {
    payableAmount: number;
    earlyDiscountApplied: boolean;
    lateFineApplied: number;
    statusLabel: string;
  } {
    const remaining = Math.max(0, Number(challan.remainingAmountPKR ?? challan.totalAmountPKR ?? 0));
    if (remaining <= 0 || challan.status === "PAID" || challan.status === "ZERO_BALANCE" || challan.status === "VOIDED") return { payableAmount: 0, earlyDiscountApplied: false, lateFineApplied: 0, statusLabel: Number(challan.totalAmountPKR ?? 0) <= 0 ? "ZERO_BALANCE" : challan.status || "PAID" };
    const dueDate = new Date(challan.dueDate);
    const evalTime = evaluationDate.getTime();

    // 1. Check early payment discount
    if (challan.earlyPaymentDeadline && challan.earlyPaymentDiscount > 0) {
      const deadline = schoolDayEnd(new Date(challan.earlyPaymentDeadline));
      // End of early deadline day

      if (evalTime <= deadline.getTime() && Number(challan.paidAmountPKR || 0) === 0 && !challan.earlyDiscountAppliedAt) {
        return {
          payableAmount: money(Math.max(0, remaining - Math.min(remaining, Number(challan.earlyPaymentDiscount || 0)))),
          earlyDiscountApplied: true,
          lateFineApplied: 0,
          statusLabel: "EARLY_PAYMENT_DISCOUNT",
        };
      }
    }

    // 2. Check if before/on due date (end of day)
    const dueEndOfDay = schoolDayEnd(dueDate);
    if (evalTime <= dueEndOfDay.getTime()) {
      return {
        payableAmount: remaining,
        earlyDiscountApplied: false,
        lateFineApplied: 0,
        statusLabel: "WITHIN_DUE_DATE",
      };
    }

    // 3. Late payment fine evaluation
    let lateFine = 0;
    const stages = challan.lateFineStages || [];

    if (challan.lateFineWaivedAt || challan.lateFineWaived) {
      lateFine = 0;
    } else if (challan.lateFinePolicyModel === "RECURRING") {
      const policy = challan.lateFeeFinePolicy || {};
      const elapsedDays = Math.max(0, Math.ceil((evalTime - dueEndOfDay.getTime()) / 86400000));
      const intervals = Math.max(0, elapsedDays - Number(policy.graceDays || 0));
      const unpaidPrincipal = Math.max(0, remaining - Number(challan.feeBreakdown?.lateFeeFine || 0));
      const intervalFine = policy.type === "PERCENTAGE"
        ? unpaidPrincipal * Math.max(0, Number(policy.dailyRate || 0)) / 100
        : Math.max(0, Number(policy.dailyRate || 0));
      lateFine = money(Math.min(Math.max(0, Number(policy.maxFineCap || 0)), intervalFine * intervals));
    } else if (challan.lateFinePolicyModel === "DISABLED") {
      lateFine = 0;
    } else if (challan.lateFinePolicyModel === "ONE_TIME") {
      const deadline = new Date(stages[0]?.deadlineDate || dueDate);
      if (!stages.length) deadline.setDate(deadline.getDate() + Number(challan.lateFeeFinePolicy?.graceDays || 0));
      if (evalTime > schoolDayEnd(deadline).getTime()) lateFine = Number(stages[0]?.fineAmount ?? challan.lateFeeFinePolicy?.amount ?? challan.lateFeePolicyAmount ?? Math.max(0, Number(challan.amountPayableAfterDueDate || 0) - Number(challan.totalAmountPKR || 0)));
    } else if (stages.length > 0) {
      // Find matching stage
      for (const st of stages) {
        const stageEnd = schoolDayEnd(new Date(st.deadlineDate));
        if (evalTime <= stageEnd.getTime()) {
          lateFine = Number(st.fineAmount || 0);
          break;
        }
        lateFine = Number(st.fineAmount || 0); // Takes highest passed stage
      }
    } else if (challan.amountPayableAfterDueDate && challan.amountPayableAfterDueDate > challan.totalAmountPKR) {
      lateFine = Number(challan.amountPayableAfterDueDate) - Number(challan.totalAmountPKR);
    } else if (challan.lateFinePolicyModel === "ONE_TIME") {
      lateFine = Math.max(0, Number(challan.lateFeeFinePolicy?.amount ?? challan.lateFeePolicyAmount ?? 0));
    }

    return {
      payableAmount: money(remaining + Math.max(0, lateFine - Number(challan.feeBreakdown?.lateFeeFine || 0))),
      earlyDiscountApplied: false,
      lateFineApplied: lateFine,
      statusLabel: lateFine > 0 ? "LATE_FINE_APPLIED" : "OVERDUE",
    };
  }
}
