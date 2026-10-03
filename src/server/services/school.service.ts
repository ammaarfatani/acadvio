import { School } from "../models/school.model";
import { AcademicSession } from "../models/academicSession.model";

export class SchoolService {
  static async getSchoolProfile(schoolId: string) {
    const school = await School.findById(schoolId);
    if (!school) {
      throw { statusCode: 404, message: "School profile not found." };
    }
    return school;
  }

  static async updateSchoolBranding(schoolId: string, data: {
    name?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
    domain?: string;
    theme?: string;
    currency?: string;
    dateFormat?: string;
    bankDetails?: {
      bankName: string;
      accountTitle: string;
      accountNumber: string;
      iban?: string;
    };
  }) {
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

