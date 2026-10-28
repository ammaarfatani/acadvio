import { DEFAULT_SUBSCRIPTION_PRICES } from "../../lib/subscription-prices";
import {frontendLink} from "../utils/emailTemplate";
import {randomBytes} from "crypto";
import { PLAN_FEATURE_LABELS, PLAN_FEATURES } from "../../lib/plan-features";
import mongoose from "mongoose";
import { platformAnalytics } from "./platformAnalytics.service";
import { School } from "../models/school.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { Subscription } from "../models/subscription.model";
import { AcademicSession } from "../models/academicSession.model";
import { AuditLog } from "../models/auditLog.model";
import { Plan } from "../models/plan.model";
import { UserStatus, UserType } from "../constants/roles.constant";
import { SubscriptionStatus, SubscriptionPlan, PLAN_PRICING_PKR, STANDARD_TRIAL_DAYS } from "../constants/subscription.constant";
import { hashPassword } from "../utils/password.util";
import { sendEmailNotification } from "../utils/email.util";
import { env } from "../config/env";

export class SuperAdminService {
  static async changeAccountStatus(schoolId:string,input:{status:"ACTIVE"|"DEACTIVATED";expectedRevision:number;reason?:string},actor:{userId:string;email:string}){
    const session=await mongoose.startSession();let result:any;
    try{await session.withTransaction(async()=>{
      const existing=await School.findById(schoolId).session(session);
      if(!existing)throw {statusCode:404,message:"Organization not found."};
      if(existing.status==="PENDING_APPROVAL")throw {statusCode:409,message:"Review this registration through Applications first. Account activation cannot approve a pending school."};
      if((existing.accountRevision||0)!==input.expectedRevision)throw {statusCode:409,message:"Account status changed. Refresh before retrying."};
      if((existing.accountStatus||"ACTIVE")===input.status){result=existing;return;}
      result=await School.findOneAndUpdate({_id:schoolId,$or:[{accountRevision:input.expectedRevision},...(input.expectedRevision===0?[{accountRevision:{$exists:false}}]:[])]},{$set:{accountStatus:input.status,accountStatusReason:input.reason?.trim()||"",accountStatusChangedAt:new Date(),accountStatusChangedBy:actor.userId},$inc:{accountRevision:1}},{session,new:true,runValidators:true});
      if(!result)throw {statusCode:409,message:"Account status changed. Refresh before retrying."};
      await AuditLog.create([{actorName:actor.email,actorEmail:actor.email,actorRole:"SUPER_ADMIN",schoolId:result._id,schoolName:result.name,action:"ORGANIZATION_"+input.status,resource:`School:${result._id}`,details:JSON.stringify({actorId:actor.userId,previous:existing.accountStatus||"ACTIVE",next:input.status,reason:input.reason?.trim()||""})}],{session});
    });}finally{await session.endSession();}
    return {school:result,message:input.status==="ACTIVE"?"Organization activated successfully.":"Organization deactivated successfully."};
  }

  static async logAudit(data: {
    actorName: string;
    actorEmail: string;
    actorRole: string;
    action: string;
    schoolName?: string;
    schoolId?: any;
    resource: string;
    ipAddress?: string;
    details?: string;
  }) {
    return AuditLog.create(data);
  }

  static async approveSchool(schoolId: string, actor: any = { name: "Super Admin", email: "admin@acadivo.com" }) {
    const session = await mongoose.startSession();
    let school: any;
    try {
      await session.withTransaction(async () => {
        const now = new Date(), trialEndsAt = new Date(now.getTime() + STANDARD_TRIAL_DAYS * 86400000);
        school = await School.findOneAndUpdate({ _id: schoolId, status: SubscriptionStatus.PENDING_APPROVAL, registrationType: { $ne: "paid" }, trialStartedAt: null }, { $set: { status: SubscriptionStatus.TRIAL, plan: SubscriptionPlan.FREE_TRIAL, trialStartedAt: now, trialEndsAt } }, { new: true, runValidators: true, session });
        if (!school) throw { statusCode: 409, message: "This application was already reviewed or requires payment verification. Refresh and retry." };
        const admin = await User.findOne({ schoolId: school._id, userType: UserType.SCHOOL_ADMIN }).session(session);
        if (!admin) throw { statusCode: 409, message: "No registered school administrator exists. Approval was not applied." };
        await User.updateMany({ schoolId: school._id, status: UserStatus.PENDING_APPROVAL }, { $set: { status: UserStatus.ACTIVE }, $unset: { refreshTokenHash: 1 } }, { session });
        await Subscription.findOneAndUpdate({ schoolId: school._id }, { $set: { plan: SubscriptionPlan.FREE_TRIAL, status: SubscriptionStatus.TRIAL, price: 0, trialStartedAt: now, trialEndsAt } }, { upsert: true, runValidators: true, session });
        if (!await AcademicSession.exists({ schoolId: school._id }).session(session)) {
          const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
          await AcademicSession.create([{ schoolId: school._id, name: `${year}-${year + 1}`, startDate: new Date(year, 7, 1), endDate: new Date(year + 1, 5, 30), isCurrent: true }], { session });
        }
        await AuditLog.create([{ actorName: actor.name || "Super Admin", actorEmail: actor.email, actorRole: "SUPER_ADMIN", action: "SCHOOL_APPROVED", schoolName: school.name, schoolId: school._id, resource: `School:${school._id}`, details: "Free trial request approved; 14-day trial started and pending users activated." }], { session });
      });
    } finally { await session.endSession(); }
    // Only the winning manual approval sends mail, after the transaction commits.
    const admin = await User.findOne({ schoolId: school._id, userType: UserType.SCHOOL_ADMIN }).select("email name");
    if (admin?.email) await sendEmailNotification({ to: admin.email, subject: "School Registration Approved", greeting: `Hello ${admin.name || "School Admin"},`, text: "Your school registration has been approved. Your 14-day free trial is now active. Sign in using your existing account.", actionLabel:"Log In to Acadivo", actionUrl:frontendLink(env.FRONTEND_URL,`/${school.slug || school.code}/login`,env.NODE_ENV==="production") }).catch(() => console.error("[EMAIL] School approval notification failed."));
    return { schoolId: school._id, schoolName: school.name, status: school.status, trialStartedAt: school.trialStartedAt, trialEndsAt: school.trialEndsAt, message: `School '${school.name}' approved. 14-Day Free Trial activated.` };
  }

  static async rejectSchool(schoolId: string, reason?: string, actor: any = { name: "Super Admin", email: "admin@acadivo.com" }) {
    if (!reason?.trim()) throw { statusCode: 400, message: "A rejection reason is required." };
    const session = await mongoose.startSession();
    let school: any;
    try { await session.withTransaction(async () => {
      school = await School.findOneAndUpdate({ _id: schoolId, status: SubscriptionStatus.PENDING_APPROVAL }, { $set: { status: SubscriptionStatus.SUSPENDED } }, { new: true, runValidators: true, session });
      if (!school) throw { statusCode: 409, message: "This application was already reviewed. Refresh and retry." };
      await User.updateMany({ schoolId: school._id }, { $set: { status: UserStatus.DEACTIVATED }, $unset: { refreshTokenHash: 1 } }, { session });
      await Subscription.updateOne({ schoolId: school._id }, { $set: { status: SubscriptionStatus.SUSPENDED } }, { session });
      await AuditLog.create([{ actorName: actor.name || "Super Admin", actorEmail: actor.email, actorRole: "SUPER_ADMIN", action: "SCHOOL_REJECTED", schoolName: school.name, schoolId: school._id, resource: `School:${school._id}`, details: `Reason: ${reason.trim()}` }], { session });
    }); } finally { await session.endSession(); }
    return { schoolId: school._id, message: `School '${school.name}' registration rejected.` };
  }

  static async extendTrial(schoolId: string, days: number = 7, actor: any = { name: "Super Admin", email: "admin@acadivo.com" }) {
    const school = await School.findById(schoolId);
    if (!school) {
      throw { statusCode: 404, message: "School not found." };
    }

    if (![SubscriptionStatus.TRIAL, SubscriptionStatus.TRIAL_EXPIRED].includes(school.status)) throw { statusCode: 409, message: "Only an existing free trial may be extended." };
    const currentExpiry = school.trialEndsAt && new Date(school.trialEndsAt) > new Date() ? new Date(school.trialEndsAt) : new Date();
    const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);

    school.trialEndsAt = newExpiry;
    school.status = SubscriptionStatus.TRIAL;
    await school.save();

    await Subscription.updateOne(
      { schoolId: school._id },
      { $set: { trialEndsAt: newExpiry, status: SubscriptionStatus.TRIAL } }
    );

    await this.logAudit({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: "SUPER_ADMIN",
      action: "TRIAL_EXTENDED",
      schoolName: school.name,
      schoolId: school._id,
      resource: `School:${school._id}`,
      details: `Extended by ${days} days until ${newExpiry.toISOString().split("T")[0]}.`,
    });

    return {
      schoolId: school._id,
      trialEndsAt: school.trialEndsAt,
      message: `Trial for '${school.name}' extended by ${days} days until ${newExpiry.toISOString().split("T")[0]}.`,
    };
  }

  static async resetAdminPassword(userId: string, newPassword?: string, actor: any = { name: "Super Admin", email: "admin@acadivo.com" }) {
    const user = await User.findById(userId).select("+refreshTokenHash").populate("schoolId");
    if (!user) {
      throw { statusCode: 404, message: "User account not found." };
    }

    const tempPassword = newPassword || randomBytes(24).toString("base64url");
    user.passwordHash = await hashPassword(tempPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshTokenHash = undefined;
    await user.save();

    const schoolName = (user.schoolId as any)?.name || "Platform";

    await this.logAudit({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: "SUPER_ADMIN",
      action: "PASSWORD_RESET_BY_ADMIN",
      schoolName,
      schoolId: user.schoolId ? user.schoolId._id : undefined,
      resource: `User:${user._id}`,
      details: `Admin password reset for ${user.email}.`,
    });

    return {
      userId: user._id,
      email: user.email,
      tempPassword,
      message: `Password reset successfully for ${user.email}. (Temporary password generated safely).`,
    };
  }

  static async getSchoolDetails(schoolId: string) {
    const school = await School.findById(schoolId);
    if (!school) {
      throw { statusCode: 404, message: "School not found." };
    }

    const users = await User.find({ schoolId }).select("-passwordHash -refreshTokenHash").populate("roleId");
    const subscription = await Subscription.findOne({ schoolId });
    const academicSessions = await AcademicSession.find({ schoolId }).sort({ startDate: -1 });
    const auditLogs = await AuditLog.find({ schoolId }).sort({ createdAt: -1 }).limit(20);

    return {
      school,
      users,
      subscription,
      academicSessions,
      auditLogs,
    };
  }

  static async getPendingSchools() {
    const schools = await School.find({ status: SubscriptionStatus.PENDING_APPROVAL, isDemo: { $ne: true } }).sort({ createdAt: -1 }).lean();
    const admins = await User.find({ schoolId: { $in: schools.map(s => s._id) }, userType: UserType.SCHOOL_ADMIN }).select("schoolId name email").lean();
    return schools.map(school => { const admin = admins.find(user => String(user.schoolId) === String(school._id)); return { ...school, adminName: admin?.name, adminEmail: admin?.email }; });
  }

  static async getAllSchools() {
    return School.find().sort({ createdAt: -1 });
  }

  static async getAllUsers(filterSchoolId?: string, filterRole?: string, filterStatus?: string) {
    const query: any = {};
    if (filterSchoolId) query.schoolId = filterSchoolId;
    if (filterUserType(filterRole)) query.userType = filterRole;
    if (filterStatus) query.status = filterStatus;

    return User.find(query).populate("schoolId", "name code").populate("roleId", "name code").select("-passwordHash -refreshTokenHash").sort({ createdAt: -1 });
  }

  static async updateSchoolStatus(schoolId: string, status: SubscriptionStatus, plan?: SubscriptionPlan, actor: any = { name: "Super Admin", email: "admin@acadivo.com" }) {
    const school = await School.findById(schoolId);
    if (!school) {
      throw { statusCode: 404, message: "School not found." };
    }

    if(school.status===SubscriptionStatus.PENDING_APPROVAL&&status!==SubscriptionStatus.PENDING_APPROVAL)throw {statusCode:409,message:"Use Applications or Payment Verification to approve pending schools."};
    school.status = status;
    if (plan) school.plan = plan;
    await school.save();

    await Subscription.updateOne(
      { schoolId: school._id },
      { $set: { status, ...(plan ? { plan, price: PLAN_PRICING_PKR[plan] } : {}) } }
    );

    await this.logAudit({
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: "SUPER_ADMIN",
      action: "SUBSCRIPTION_STATUS_UPDATED",
      schoolName: school.name,
      schoolId: school._id,
      resource: `School:${school._id}`,
      details: `Status set to ${status}${plan ? `, Plan set to ${plan}` : ""}`,
    });

    return {
      schoolId: school._id,
      status: school.status,
      plan: school.plan,
      message: `School '${school.name}' status updated to ${status}.`,
    };
  }

  static async getAuditLogs() {
    return AuditLog.find().sort({ createdAt: -1 }).limit(100);
  }

  static async getPlans() {
    const defaultPlans = [
      {
        code: SubscriptionPlan.STARTER,
        name: "Starter Plan",
        priceMonthlyPKR: DEFAULT_SUBSCRIPTION_PRICES.STARTER.monthly,
        priceAnnualPKR: DEFAULT_SUBSCRIPTION_PRICES.STARTER.annualMonthly,
        description: "Essential administrative suite for growing single-campus schools.",
        features: ["Student Management", "Teacher Directory", "Classes & Sections", "Subjects", "Attendance Register", "Timetable Allocation", "Basic Overview Dashboard", "Standard Exportable Reports", "School Branding", "Standard Support"],
        isActive: true,
      },
      {
        code: SubscriptionPlan.PROFESSIONAL,
        name: "Professional Plan",
        priceMonthlyPKR: DEFAULT_SUBSCRIPTION_PRICES.PROFESSIONAL.monthly,
        priceAnnualPKR: DEFAULT_SUBSCRIPTION_PRICES.PROFESSIONAL.annualMonthly,
        description: "Complete ERP suite with automated Fee Challans, Exams & Marksheets.",
        features: ["Everything in Starter", "Fee Management", "Automated 3-Part Fee Challans", "Payment Receipts", "Expenses", "Exam Schedules", "Marks Entry", "Professional Marksheets", "Class Position Ranks", "Certificates", "Multiple Staff Roles", "Priority Support"],
        isActive: true,
      },
      {
        code: SubscriptionPlan.ENTERPRISE,
        name: "Enterprise Plan",
        priceMonthlyPKR: DEFAULT_SUBSCRIPTION_PRICES.ENTERPRISE.monthly,
        priceAnnualPKR: DEFAULT_SUBSCRIPTION_PRICES.ENTERPRISE.annualMonthly,
        description: "Full-scale ERP for multi-branch school networks & educational groups.",
        features: ["Everything in Professional", "Multi-Branch Centralized Dashboard", "Advanced Ledger Finance", "Staff Payroll", "Library Module", "Transport & Bus Routes", "Asset Inventory", "Executive Analytics", "Custom Roles", "Dedicated Support", "Custom Setup"],
        isActive: true,
      },
    ];

    const dbPlans = await Plan.find();
    if (dbPlans.length === 0) {
      try{await Plan.bulkWrite(defaultPlans.map(plan=>({updateOne:{filter:{code:plan.code},update:{$setOnInsert:plan},upsert:true}})),{ordered:false});}catch(e:any){if(e.code!==11000)throw e;}
      const created = await Plan.find();
      return created.map((p:any)=>({...p.toObject(),features:PLAN_FEATURE_LABELS[p.code]||[],enabledFeatures:PLAN_FEATURES[p.code]||[]}));
    }

    return dbPlans.map((p:any)=>({...(typeof p.toObject === "function" ? p.toObject() : p),features:PLAN_FEATURE_LABELS[p.code]||[],enabledFeatures:PLAN_FEATURES[p.code]||[]}));
  }

  static async getPlatformAnalytics(period = "month") {
    return platformAnalytics(period);
  }
}

function filterUserType(role?: string) {
  return role && Object.values(UserType).includes(role as any);
}




