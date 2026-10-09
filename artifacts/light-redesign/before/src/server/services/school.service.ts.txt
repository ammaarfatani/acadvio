import { Branch } from "../models/branch.model";
import { branchContext } from "../utils/branchScope";
import { hasFeature } from "../../lib/plan-features";
import { School } from "../models/school.model";
import { AcademicSession } from "../models/academicSession.model";

export class SchoolService {
  static async getSchoolProfile(schoolId: string) {
    const school = await School.findById(schoolId);
    if (!school) {
      throw { statusCode: 404, message: "School profile not found." };
    }
    const scope = branchContext.getStore();
    if (scope?.branchId && hasFeature(school.plan, "MULTI_BRANCH")) {
      const branch = await Branch.findOne({ _id: scope.branchId, organizationId:schoolId }).lean();
      const profile = school.toObject();
      if (branch) for (const key of ["name","phone","address","logoUrl","currency","dateFormat","bankDetails"]) if ((branch as any)[key] && (key!=="bankDetails" || (branch as any).bankDetailsConfigured || ["bankName","accountTitle","accountNumber","iban","branch","instructions"].some(field=>(branch as any).bankDetails?.[field]) || (branch as any).bankDetails?.enabled===true)) profile[key] = (branch as any)[key];
      delete profile.theme;
      return profile;
    }
    const profile = school.toObject(); delete profile.theme; return profile;
  }

  static async updateSchoolBranding(schoolId: string, data: {
    name?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
    domain?: string;
    currency?: string;
    dateFormat?: string;
    bankDetails?: {
      bankName: string;
      accountTitle: string;
      accountNumber: string;
      iban?: string;
      branch?: string;
      instructions?: string;
      enabled?: boolean;
    };
  }) {
    const scope = branchContext.getStore();
    const current = await School.findById(schoolId);
    if (scope?.branchId && hasFeature(current?.plan, "MULTI_BRANCH")) {
      const branch = await Branch.findOneAndUpdate({ _id:scope.branchId, organizationId:schoolId }, { $set:{...data,...(data.bankDetails?{bankDetailsConfigured:true}:{})} }, { new:true,runValidators:true });
      if (!branch) throw { statusCode:404,message:"Branch not found." };
      return this.getSchoolProfile(schoolId);
    }
    const school = await School.findByIdAndUpdate(schoolId, { $set: data }, { new: true, runValidators: true });
    if (!school) {
      throw { statusCode: 404, message: "School profile not found." };
    }
    return school;
  }

  static async getAcademicSessions(schoolId: string) {
    return AcademicSession.find({ schoolId }).sort({ startDate: -1 });
  }

  static async createAcademicSession(schoolId: string, data: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean }) {
    if (data.isCurrent) {
      await AcademicSession.updateMany({ schoolId }, { $set: { isCurrent: false } });
    }

    const session = await AcademicSession.create({
      schoolId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      isCurrent: !!data.isCurrent,
    });

    return session;
  }
}

