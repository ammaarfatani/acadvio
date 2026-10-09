import mongoose from "mongoose";
import { School } from "../models/school.model";
import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { Subscription } from "../models/subscription.model";
import { UserType, UserStatus } from "../constants/roles.constant";
import { SubscriptionStatus, SubscriptionPlan } from "../constants/subscription.constant";
import { hashPassword } from "../utils/password.util";
import { RegisterSchoolInput } from "../validators/public.validator";
import { SuperAdminService } from "./superadmin.service";
import { toUrlSlug } from "../utils/slug.util";

export class PublicService {
  static async registerSchoolApplication(input: RegisterSchoolInput) {
    const isTrial = input.registrationType !== "paid";
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


    // School, administrator and subscription are committed together, always pending review.
    const passwordHash = await hashPassword(input.password);
    const session = await mongoose.startSession();
    try { return await session.withTransaction(async () => {
    const [school] = await School.create([{
      name: input.schoolName,
      code,
      slug,
      email: input.schoolEmail.toLowerCase(),
      phone: input.schoolPhone,
      address: input.schoolAddress,
      studentCountRange: input.studentCountRange,
      teacherCount: input.teacherCount,
      plan,
      status: SubscriptionStatus.PENDING_APPROVAL,
      registrationType: isTrial ? "trial" : "paid",
    }], { session });

    // Pending trial administrators receive no session; paid accounts retain billing-only login.
    const [adminUser] = await User.create([{
      schoolId: school._id,
      roleId: adminRole._id,
      userType: UserType.SCHOOL_ADMIN,
      name: input.adminName,
      email: input.adminEmail.toLowerCase(),
      passwordHash,
      status: UserStatus.PENDING_APPROVAL,
      isEmailVerified: false,
    }], { session });

    // Keep one subscription record for the existing school across trial and paid upgrades.
    await Subscription.create([{
      schoolId: school._id,
      plan,
      status: SubscriptionStatus.PENDING_APPROVAL,

      price: isTrial ? 0 : paidPlan!.priceMonthlyPKR,
      billingCycle: "monthly",
      paymentStatus: "UNPAID",
    }], { session });

    return {
      schoolId: school._id,
      schoolName: school.name,
      schoolCode: school.code,
      schoolSlug: school.slug,
      adminName: adminUser.name,
      adminEmail: adminUser.email,
      status: school.status,
      message: isTrial ? "Your school registration has been submitted. Your free trial request is currently under review." : "School account created. Submit your payment screenshot for verification.",
    };
    }); } catch (error: any) {
      if (error.code === 11000) throw { statusCode: 409, message: "A school, administrator email or school identifier is already registered. Please review your details." };
      throw error;
    } finally { await session.endSession(); }
  }
}


