import { School } from "../models/school.model";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { Subscription } from "../models/subscription.model";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";
import { expireTrials } from "./trialLifecycle.service";

export function analyticsPeriodStart(period: string, now = new Date()) {
  const local = new Date(now.getTime()+5*3600000);
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  const midnight = (year: number, month: number, day: number) => new Date(Date.UTC(year,month,day)-5*3600000);
  if (period === "today") return midnight(y,m,d);
  if (period === "week") return midnight(y,m,d-((local.getUTCDay()+6)%7));
  if (period === "year") return midnight(y,0,1);
  return midnight(y,m,1);
}
export async function platformAnalytics(period = "month", now = new Date()) {
  if (!["today","week","month","year"].includes(period)) throw { statusCode: 400, message: "Select Today, This Week, This Month or This Year." };
  await expireTrials(undefined, now);
  const schoolIds = await School.distinct("_id", { isDemo: { $ne: true } });
  const scope = { schoolId: { $in: schoolIds } };
  const start = analyticsPeriodStart(period, now), monthStart = analyticsPeriodStart("month", now);
  const chartFormat = period === "today" ? "%Y-%m-%d %H:00" : period === "year" ? "%Y-%m" : "%Y-%m-%d";
  const [schoolCounts, totalUsers, totalTeachers, totalStudents, activeSubscriptions, revenue, monthlyRevenue, totalRevenue, revenueSeries] = await Promise.all([
    School.aggregate([{ $match: { isDemo: { $ne: true } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    User.countDocuments({ $or: [{ schoolId: null }, scope] }),
    User.countDocuments({ ...scope, userType: "TEACHER" }),
    Student.countDocuments(scope),
    Subscription.countDocuments({ ...scope, status: "ACTIVE", $or: [{ currentPeriodEnd: { $gt: now } }, { currentPeriodEnd: { $exists: false } }] }),
    SubscriptionPayment.aggregate([{ $match: { ...scope, status: "APPROVED", reviewedAt: { $gte: start, $lte: now } } }, { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    SubscriptionPayment.aggregate([{ $match: { ...scope, status: "APPROVED", reviewedAt: { $gte: monthStart, $lte: now } } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
    SubscriptionPayment.aggregate([{ $match: { ...scope, status: "APPROVED" } }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
    SubscriptionPayment.aggregate([{ $match: { ...scope, status: "APPROVED", reviewedAt: { $gte: start, $lte: now } } }, { $group: { _id: { $dateToString: { date: "$reviewedAt", format: chartFormat, timezone: "Asia/Karachi" } }, amount: { $sum: "$amount" }, payments: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  const counts = Object.fromEntries(schoolCounts.map((item: any) => [item._id, item.count]));
  return {
    totalSchools: schoolCounts.reduce((sum: number, item: any) => sum+item.count, 0),
    pendingSchools: counts.PENDING_APPROVAL || 0, trialSchools: counts.TRIAL || 0,
    activeSchools: counts.ACTIVE || 0, suspendedSchools: counts.SUSPENDED || 0,
    expiredTrials: counts.TRIAL_EXPIRED || 0, expiredSchools: (counts.EXPIRED || 0)+(counts.TRIAL_EXPIRED || 0),
    totalUsers, totalStudents, totalTeachers, activeSubscriptions,
    monthlyRevenuePKR: monthlyRevenue[0]?.amount || 0, revenuePKR: revenue[0]?.amount || 0,
    approvedPayments: revenue[0]?.count || 0, totalRevenuePKR: totalRevenue[0]?.amount || 0,
    revenueSeries: revenueSeries.map((item: any) => ({ period: item._id, amount: item.amount, payments: item.payments })),
    period, periodStart: start, timezone: "Asia/Karachi",
  };
}
