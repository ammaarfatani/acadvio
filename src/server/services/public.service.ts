import { School } from "../models/school.model";
import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { Subscription } from "../models/subscription.model";
import { UserType, UserStatus } from "../constants/roles.constant";
import { SubscriptionStatus, SubscriptionPlan, STANDARD_TRIAL_DAYS } from "../constants/subscription.constant";
import { hashPassword } from "../utils/password.util";
import { RegisterSchoolInput } from "../validators/public.validator";
import { AcademicSession } from "../models/academicSession.model";
import { SuperAdminService } from "./superadmin.service";
import { toUrlSlug } from "../utils/slug.util";

export class PublicService {
  static async registerSchoolApplication(input: RegisterSchoolInput) {
    const isTrial = input.registrationType !== "paid";
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + STANDARD_TRIAL_DAYS * 86400000);
    const paidPlans = isTrial ? [] : await SuperAdminService.getPlans();
    const paidPlan = paidPlans.find((plan: any) => plan.code === input.selectedPlan && plan.isActive);
    if (!isTrial && !paidPlan) throw { statusCode: 400, message: "Select an available paid subscription plan." };
    const plan = isTrial ? SubscriptionPlan.FREE_TRIAL : input.selectedPlan!;
    // 1. Check if email already registered
    const existingSchool = await School.findOne({ email: input.schoolEmail.toLowerCase() });
    if (existingSchool) {
      throw { statusCode: 400, message: "A school with this email is already registered or pending approval." };
    }

    const existingUser = await User.findOne({ email: input.adminEmail.toLowerCase() });
    if (existingUser) {
      throw { statusCode: 400, message: "An admin user with this email address already exists." };
    }

    // 2. Generate unique school code and URL-safe slug
    let baseCode = input.schoolName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (baseCode.length < 3) baseCode = `sch${baseCode}`;
    let code = baseCode;
    let counter = 1;
    while (await School.findOne({ code })) {
      code = `${baseCode}${counter}`;
      counter++;
    }

    const slugBase = toUrlSlug(input.schoolName);
    let slug = slugBase;
    let slugCounter = 1;
    while (await School.findOne({ slug })) {
      slugCounter += 1;
      slug = `${slugBase}-${slugCounter}`;
    }

    // Trial onboarding starts the standard trial; paid onboarding stays pending verification.
    const school = await School.create({
      name: input.schoolName,
      code,
      slug,
      email: input.schoolEmail.toLowerCase(),
      phone: input.schoolPhone,
      address: input.schoolAddress,
      studentCountRange: input.studentCountRange,
      teacherCount: input.teacherCount,
      plan,
      status: isTrial ? SubscriptionStatus.TRIAL : SubscriptionStatus.PENDING_APPROVAL,
      registrationType: isTrial ? "trial" : "paid",
      ...(isTrial ? { trialStartedAt: now, trialEndsAt } : {}),
    });

    // 4. Find or assign SCHOOL_ADMIN system role
    let adminRole = await Role.findOne({ code: "ROLE_SCHOOL_ADMIN" });
    if (!adminRole) {
      adminRole = await Role.create({
        schoolId: null,
        name: "School Principal / Admin",
        code: "ROLE_SCHOOL_ADMIN",
        userType: UserType.SCHOOL_ADMIN,
        description: "Full administrative access within the school campus",
        permissions: ["students.view", "students.create", "students.update", "students.delete", "teachers.view", "teachers.create", "teachers.update", "attendance.view", "attendance.manage", "fees.view", "fees.collect", "fees.update", "fees.delete", "exams.view", "exams.manage", "results.view", "results.enter", "results.publish", "settings.view", "settings.update", "users.view", "users.manage", "reports.view"],
        isSystemRole: true,
      });
    }

    // Activate the trial administrator; paid registrations have billing-only access.
    const passwordHash = await hashPassword(input.password);
    const adminUser = await User.create({
      schoolId: school._id,
      roleId: adminRole._id,
      userType: UserType.SCHOOL_ADMIN,
      name: input.adminName,
      email: input.adminEmail.toLowerCase(),
      passwordHash,
      status: isTrial ? UserStatus.ACTIVE : UserStatus.PENDING_APPROVAL,
      isEmailVerified: false,
    });

    // Keep one subscription record for the existing school across trial and paid upgrades.
    await Subscription.create({
      schoolId: school._id,
      plan,
      status: isTrial ? SubscriptionStatus.TRIAL : SubscriptionStatus.PENDING_APPROVAL,
      ...(isTrial ? { trialStartedAt: now, trialEndsAt } : {}),
      price: isTrial ? 0 : paidPlan!.priceMonthlyPKR,
      billingCycle: "monthly",
      paymentStatus: "UNPAID",
    });

    if (isTrial) {
      const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
      await AcademicSession.create({ schoolId: school._id, name: year+"-"+(year+1), startDate: new Date(year, 7, 1), endDate: new Date(year+1, 5, 30), isCurrent: true });
    }
    return {
      schoolId: school._id,
      schoolName: school.name,
      schoolCode: school.code,
      schoolSlug: school.slug,
      adminName: adminUser.name,
      adminEmail: adminUser.email,
      status: school.status,
      trialEndsAt: isTrial ? trialEndsAt : undefined,
      message: isTrial ? "Your standard 14-day free trial is active. Sign in with your existing credentials." : "School account created. Submit your payment screenshot for verification.",
    };
  }
}


