import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { decodePaymentImage } from "../services/paymentImage";
import { SchoolService } from "../services/school.service";
import { sendSuccess } from "../utils/response.util";

export class SchoolController {
  static async updateLogo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.schoolId) throw { statusCode: 403, message: "School context is required." };
      const parsed = z.object({ image: z.string().nullable() }).safeParse(req.body);
      if (!parsed.success) throw { statusCode: 400, message: "Choose a logo image, or remove the current logo." };
      let logoUrl = "";
      if (parsed.data.image !== null) {
        const image = decodePaymentImage(parsed.data.image, 1024*1024);
        logoUrl = "data:"+image.mime+";base64,"+image.bytes.toString("base64");
      }
      const school = await SchoolService.updateSchoolBranding(req.user.schoolId, { logoUrl });
      return sendSuccess(res, { logoUrl: school.logoUrl }, parsed.data.image === null ? "School logo removed." : "School logo updated.");
    } catch (e) { next(e); }
  }
  static async getMySchool(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const school = await SchoolService.getSchoolProfile(schoolId);
      return sendSuccess(res, school, "School profile retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async updateBranding(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const updated = await SchoolService.updateSchoolBranding(schoolId, req.body);
      return sendSuccess(res, updated, "School branding & details updated.");
    } catch (error) {
      next(error);
    }
  }

  static async getAcademicSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const sessions = await SchoolService.getAcademicSessions(schoolId);
      return sendSuccess(res, sessions, "Academic sessions retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createAcademicSession(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const session = await SchoolService.createAcademicSession(schoolId, req.body);
      return sendSuccess(res, session, "Academic session created.", 201);
    } catch (error) {
      next(error);
    }
  }
}

