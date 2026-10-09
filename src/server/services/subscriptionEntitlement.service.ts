import { withoutBranchScope } from "../utils/branchScope";
import { hasFeature, PLAN_FEATURES } from "../../lib/plan-features";
import { expireTrials } from "./trialLifecycle.service";
import { School } from "../models/school.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { UserType } from "../constants/roles.constant";

export interface PlanLimits {
  name: string;
  pricePKR: number;
  maxStudents: number;
  maxTeachers: number;
  features: {
    customBranding: boolean;
    advancedReports: boolean;
    certificates: boolean;
    smsGateway: boolean;
  };
}

export const PLAN_CONFIGS: Record<string, PlanLimits> = {
  FREE_TRIAL: {
    name: "14-Day Free Trial", pricePKR: 0, maxStudents: 1500, maxTeachers: 75,
    features: { customBranding: true, advancedReports: true, certificates: true, smsGateway: false },
  },
  STARTER: {
    name: "Starter Plan",
    pricePKR: 4999,
    maxStudents: 300,
    maxTeachers: 15,
    features: {
      customBranding: true,
      advancedReports: false,
      certificates: false,
      smsGateway: false,
    },
  },
  PROFESSIONAL: {
    name: "Professional Plan",
    pricePKR: 9999,
    maxStudents: 1500,
    maxTeachers: 75,
    features: {
      customBranding: true,
      advancedReports: true,
      certificates: true,
      smsGateway: false,
    },
  },
  ENTERPRISE: {
    name: "Enterprise Plan",
    pricePKR: 19999,
    maxStudents: 999999,
    maxTeachers: 999999,
    features: {
      customBranding: true,
      advancedReports: true,
      certificates: true,
      smsGateway: false,
    },
  },
};

export class SubscriptionEntitlementService {
  // Check trial expiration and update status if trial period ended
  static async evaluateSchoolSubscription(schoolId: string) {
    await expireTrials(schoolId);
    const school = await School.findById(schoolId);
    if (!school) throw { statusCode: 404, message: "School tenant not found." };

    const now = new Date();

    const trialDaysRemaining =
      school.status === "TRIAL" && school.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(school.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

    const code = ["TRIAL", "TRIAL_EXPIRED"].includes(school.status) ? "FREE_TRIAL" : school.plan;
    const configured = PLAN_CONFIGS[code] || PLAN_CONFIGS.STARTER;
    const plan = { ...configured, features: { customBranding: hasFeature(code, "CORE_ADMIN"), advancedReports: hasFeature(code, "ADVANCED_REPORTS"), certificates: hasFeature(code, "EXAMINATIONS"), smsGateway: false } };

    return {
      schoolId: school._id,
      schoolName: school.name,
      status: school.status,
      plan: school.plan,
      planName: plan.name,
      trialDaysRemaining,
      isTrialExpired: school.status === "TRIAL_EXPIRED",
      isActive: school.status === "ACTIVE" || school.status === "TRIAL",
      limits: plan,
      enabledFeatures: PLAN_FEATURES[school.status === "TRIAL" ? "FREE_TRIAL" : school.plan] || [],
    };
  }

  // Check if school exceeds plan student / teacher capacity limits
  static async checkCapacityLimit(schoolId: string, resourceType: "students" | "teachers") {
    await expireTrials(schoolId);
    const school = await School.findById(schoolId);
    if (!school) throw { statusCode: 404, message: "School tenant not found." };

    const code = ["TRIAL", "TRIAL_EXPIRED"].includes(school.status) ? "FREE_TRIAL" : school.plan;
    const configured = PLAN_CONFIGS[code] || PLAN_CONFIGS.STARTER;
    const plan = { ...configured, features: { customBranding: hasFeature(code, "CORE_ADMIN"), advancedReports: hasFeature(code, "ADVANCED_REPORTS"), certificates: hasFeature(code, "EXAMINATIONS"), smsGateway: false } };

    if (resourceType === "students") {
      const currentCount = await withoutBranchScope(() => Student.countDocuments({ schoolId, status: "ACTIVE" }).exec());
      if (currentCount >= plan.maxStudents) {
        throw {
          statusCode: 403,
          message: `Your ${plan.name} plan allows up to ${plan.maxStudents} students. Upgrade your plan or contact Acadivo support to add more students.`,
        };
      }
    } else if (resourceType === "teachers") {
      const currentCount = await withoutBranchScope(() => User.countDocuments({ schoolId, userType: UserType.TEACHER, status: "ACTIVE" }).exec());
      if (currentCount >= plan.maxTeachers) {
        throw {
          statusCode: 403,
          message: `Your ${plan.name} plan allows up to ${plan.maxTeachers} teachers. Upgrade your plan or contact Acadivo support to add more teachers.`,
        };
      }
    }
  }
}

