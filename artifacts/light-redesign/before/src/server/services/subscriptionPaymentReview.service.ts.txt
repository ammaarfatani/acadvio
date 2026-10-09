import crypto from "crypto";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";
import { School } from "../models/school.model";
import { Subscription } from "../models/subscription.model";
import { User } from "../models/user.model";
import { AcademicSession } from "../models/academicSession.model";
import { UserStatus } from "../constants/roles.constant";

export function subscriptionPeriodEnd(start: Date, cycle: string) {
  const end = new Date(start), day = end.getDate();
  end.setDate(1);
  if (cycle === "annual") end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
  end.setDate(Math.min(day, new Date(end.getFullYear(), end.getMonth()+1, 0).getDate()));
  return end;
}

// A durable review lease and fixed period make retries safe on standalone MongoDB.
// Payment is verified before school access is enabled; academic records are never replaced.
export async function reviewSubscriptionPayment(id: string, status: "APPROVED" | "REJECTED", actorId: string, reason?: string) {
  const now = new Date();
  if (status === "REJECTED") {
    if (!reason?.trim()) throw { statusCode: 400, message: "Rejection reason is required." };
    const payment = await SubscriptionPayment.findOneAndUpdate(
      { _id: id, status: "PENDING", reviewDecision: { $exists: false } },
      { $set: { status, rejectionReason: reason.trim(), reviewedAt: now, reviewedBy: actorId } }, { new: true, runValidators: true }
    );
    if (!payment) throw { statusCode: 409, message: "Payment was already reviewed or an approval is being completed." };
    return payment;
  }
  const operationId = crypto.randomUUID();
  let payment = await SubscriptionPayment.findOneAndUpdate({
    _id: id,
    $and: [
      { $or: [{ status: "PENDING" }, { status: "APPROVED", activationComplete: false }] },
      { $or: [{ reviewLeaseUntil: { $exists: false } }, { reviewLeaseUntil: { $lte: now } }] },
    ],
  }, { $set: { reviewDecision: "APPROVED", reviewOperationId: operationId, reviewLeaseUntil: new Date(now.getTime()+5*60000), activationComplete: false } }, { new: true });
  if (!payment) throw { statusCode: 409, message: "Payment was already completed, does not exist, or is being reviewed. Refresh and retry." };
  try {
    const [school, subscription] = await Promise.all([
      School.findById(payment.schoolId),
      Subscription.findOne({ _id: payment.subscriptionId, schoolId: payment.schoolId }),
    ]);
    if (!school || !subscription) throw { statusCode: 409, message: "The payment's existing school or subscription no longer exists." };
    if (!payment.approvedPeriodEnd) {
      const start = subscription.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
      payment = await SubscriptionPayment.findOneAndUpdate({ _id: id, reviewOperationId: operationId }, { $set: { approvedPeriodStart: now, approvedPeriodEnd: subscriptionPeriodEnd(start, payment.billingCycle) } }, { new: true });
      if (!payment) throw { statusCode: 409, message: "The review lock changed. Refresh and retry." };
    }
    const subscriptionUpdate = await Subscription.updateOne(
      { _id: payment.subscriptionId, schoolId: payment.schoolId },
      { $set: { status: "ACTIVE", paymentStatus: "PAID", plan: payment.plan, price: payment.amount, billingCycle: payment.billingCycle, currentPeriodStart: payment.approvedPeriodStart, currentPeriodEnd: payment.approvedPeriodEnd, cancelAtPeriodEnd: false } },
      { runValidators: true }
    );
    if (!subscriptionUpdate.matchedCount) throw { statusCode: 409, message: "Subscription no longer exists." };
    // Pending registrations are activated; independently disabled users stay disabled.
    await User.updateMany({ schoolId: payment.schoolId, status: UserStatus.PENDING_APPROVAL }, { $set: { status: UserStatus.ACTIVE } });
    const academicSession = await AcademicSession.findOne({ schoolId: payment.schoolId });
    if (!academicSession) {
      const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear()-1;
      await AcademicSession.updateOne({ schoolId: payment.schoolId, name: year+"-"+(year+1) }, { $setOnInsert: { startDate: new Date(year,7,1), endDate: new Date(year+1,5,30), isCurrent: true } }, { upsert: true });
    }
    if (payment.status !== "APPROVED") {
      payment = await SubscriptionPayment.findOneAndUpdate({ _id: id, reviewOperationId: operationId }, { $set: { status: "APPROVED", reviewedAt: now, reviewedBy: actorId }, $unset: { rejectionReason: 1 } }, { new: true });
      if (!payment) throw { statusCode: 409, message: "The review lock changed. Refresh and retry." };
    }
    const activated = await School.updateOne({ _id: payment.schoolId }, { $set: { status: "ACTIVE", plan: payment.plan } }, { runValidators: true });
    if (!activated.matchedCount) throw { statusCode: 409, message: "School no longer exists." };
    const complete = await SubscriptionPayment.findOneAndUpdate({ _id: id, reviewOperationId: operationId }, { $set: { activationComplete: true }, $unset: { reviewOperationId: 1, reviewLeaseUntil: 1 } }, { new: true });
    if (!complete) throw { statusCode: 409, message: "The review lock changed. Refresh and retry." };
    return complete;
  } catch (error) {
    // Keep the chosen period and decision so a retry repairs partial updates without charging/extending twice.
    await SubscriptionPayment.updateOne({ _id: id, reviewOperationId: operationId }, { $unset: { reviewOperationId: 1, reviewLeaseUntil: 1 } }).catch(() => {});
    throw error;
  }
}
