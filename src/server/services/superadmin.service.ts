import { platformAnalytics } from "./platformAnalytics.service";
import { School } from "../models/school.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { Subscription } from "../models/subscription.model";
import { AcademicSession } from "../models/academicSession.model";
import { AuditLog } from "../models/auditLog.model";
import { Plan } from "../models/plan.model";
import { UserStatus, UserType } from "../constants/roles.constant";
import { SubscriptionStatus, SubscriptionPlan, PLAN_PRICING_PKR } from "../constants/subscription.constant";
import { hashPassword } from "../utils/password.util";
import { sendEmailNotification } from "../utils/email.util";
import { env } from "../config/env";

export class SuperAdminService {
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
    const school = await School.findById(schoolId);
    if (!school) {
      throw { statusCode: 404, message: "School not found." };
    }

    if (school.status !== SubscriptionStatus.PENDING_APPROVAL || school.trialStartedAt || school.registrationType === "paid") throw { statusCode: 409, message: "This school cannot start another trial. Paid accounts require payment verification." };
    school.plan = SubscriptionPlan.FREE_TRIAL;
    const now = new Date();
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // 1. Update School Status to TRIAL
    school.status = SubscriptionStatus.TRIAL;
    school.trialStartedAt = now;
    school.trialEndsAt = fourteenDaysLater;
    await school.save();

    // 2. Activate School Admin User
    await User.updateMany(
      { schoolId: school._id, status: UserStatus.PENDING_APPROVAL },
      { $set: { status: UserStatus.ACTIVE } }
    );

    // 3. Create / Update Subscription record to TRIAL
    let subscription = await Subscription.findOne({ schoolId: school._id });
    if (subscription) {
      subscription.status = SubscriptionStatus.TRIAL;
      subscription.plan = SubscriptionPlan.FREE_TRIAL;
      subscription.price = 0;
      subscription.trialStartedAt = now;
      subscription.trialEndsAt = fourteenDaysLater;
      await subscription.save();
    } else {
      subscription = await Subscription.create({
        schoolId: school._id,
        plan: SubscriptionPlan.FREE_TRIAL,
        status: SubscriptionStatus.TRIAL,
        price: 0,
        trialStartedAt: now,
        trialEndsAt: fourteenDaysLater,
      });
    }

    // 4. Create default Academic Session
    const existingSession = await AcademicSession.findOne({ schoolId: school._id });
    if (!existingSession) {
      const startYear = now.getFullYear();
      await AcademicSession.create({
        schoolId: school._id,
        name: `${startYear}–${startYear + 1}`,
        startDate: new Date(startYear, 7, 1),
        endDate: new Date(startYear + 1, 5, 30),
        isCurrent: true,
      });
    }

    // 5. Audit Log
    await this.logAudit({
      actorName: actor.name || "Super Admin",
      actorEmail: actor.email || "admin@acadivo.com",
      actorRole: "SUPER_ADMIN",
      action: "SCHOOL_APPROVED",
      schoolName: school.name,
      schoolId: school._id,
      resource: `School:${school._id}`,
      details: "14-Day Free Trial activated and Admin account enabled.",
    });

    console.log("[APPROVAL] School approved successfully");

    const schoolAdmin = await User.findOne({
      schoolId: school._id,
      userType: UserType.SCHOOL_ADMIN,
    }).select("email name");
    const approvalSubject = "School Registration Approved";

    if (schoolAdmin?.email) {
      console.log("[EMAIL] Approval email function called");
      try {
        await sendEmailNotification({
          to: schoolAdmin.email,
          subject: approvalSubject,
          text: `Hello ${schoolAdmin.name || "School Admin"}, your school registration has been approved. Your 14-day trial is now active. Sign in to your school portal: ${env.FRONTEND_URL}/${school.slug || school.code}/login`,
        });
      } catch (error: any) {
        console.error("[EMAIL] Approval email sending failed");
        console.error(`[EMAIL] To: ${schoolAdmin.email}`);
        console.error(`[EMAIL] Error: ${error?.message || String(error)}`);
        if (error?.code) console.error(`[EMAIL] Error code: ${error.code}`);
        if (error?.response) console.error(`[EMAIL] SMTP response: ${error.response}`);
      }
    } else {
      console.error("[EMAIL] Approval email sending failed");
      console.error("[EMAIL] To: unavailable (no school admin email found)");
      console.error("[EMAIL] Error: No registered school admin email is associated with this school");
    }

    return {
      schoolId: school._id,
      schoolName: school.name,
      status: school.status,
      trialStartedAt: school.trialStartedAt,
      trialEndsAt: school.trialEndsAt,
      message: `School '${school.name}' approved. 14-Day Free Trial activated.`,
    };
  }

  static async rejectSchool(schoolId: string, reason?: string, actor: any = { name: "Super Admin", email: "admin@acadivo.com" }) {
    const school = await School.findById(schoolId);
    if (!school) {
      throw { statusCode: 404, message: "School not found." };
    }

    school.status = SubscriptionStatus.SUSPENDED;
    await school.save();

    await User.updateMany({ schoolId: school._id }, { $set: { status: UserStatus.DEACTIVATED } });
    await Subscription.updateOne({ schoolId: school._id }, { $set: { status: SubscriptionStatus.SUSPENDED } });

    await this.logAudit({
      actorName: actor.name || "Super Admin",
      actorEmail: actor.email || "admin@acadivo.com",
      actorRole: "SUPER_ADMIN",
      action: "SCHOOL_REJECTED",
      schoolName: school.name,
      schoolId: school._id,
      resource: `School:${school._id}`,
      details: `Reason: ${reason || "Not specified"}`,
    });

    return {
      schoolId: school._id,
      message: `School '${school.name}' registration rejected.`,
    };
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
    const user = await User.findById(userId).populate("schoolId");
    if (!user) {
      throw { statusCode: 404, message: "User account not found." };
    }

    const tempPassword = newPassword || `Acadivo${Math.floor(100000 + Math.random() * 900000)}!`;
    user.passwordHash = await hashPassword(tempPassword);
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
    return School.find({ status: SubscriptionStatus.PENDING_APPROVAL, isDemo: { $ne: true } }).sort({ createdAt: -1 });
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
        priceMonthlyPKR: 4999,
        priceAnnualPKR: 3999,
        description: "Essential administrative suite for growing single-campus schools.",
        features: ["Student Management", "Teacher Directory", "Classes & Sections", "Subjects", "Attendance Register", "Timetable Allocation", "Basic Overview Dashboard", "Standard Exportable Reports", "School Branding", "Standard Support"],
        isActive: true,
      },
      {
        code: SubscriptionPlan.PROFESSIONAL,
        name: "Professional Plan",
        priceMonthlyPKR: 9999,
        priceAnnualPKR: 7999,
        description: "Complete ERP suite with automated Fee Challans, Exams & Marksheets.",
        features: ["Everything in Starter", "Fee Management", "Automated 3-Part Fee Challans", "Payment Receipts", "Expenses", "Exam Schedules", "Marks Entry", "Professional Marksheets", "Class Position Ranks", "Certificates", "Multiple Staff Roles", "Priority Support"],
        isActive: true,
      },
      {
        code: SubscriptionPlan.ENTERPRISE,
        name: "Enterprise Plan",
        priceMonthlyPKR: 19999,
        priceAnnualPKR: 15999,
        description: "Full-scale ERP for multi-branch school networks & educational groups.",
        features: ["Everything in Professional", "Multi-Branch Centralized Dashboard", "Advanced Ledger Finance", "Staff Payroll", "Library Module", "Transport & Bus Routes", "Asset Inventory", "Executive Analytics", "Custom Roles", "Dedicated Support", "Custom Setup"],
        isActive: true,
      },
    ];

    const dbPlans = await Plan.find();
    if (dbPlans.length === 0) {
      await Plan.insertMany(defaultPlans);
      return Plan.find();
    }

    return dbPlans;
  }

  static async getPlatformAnalytics(period = "month") {
    return platformAnalytics(period);
  }
}

function filterUserType(role?: string) {
  return role && Object.values(UserType).includes(role as any);
}




