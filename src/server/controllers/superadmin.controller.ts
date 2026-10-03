import { Request, Response, NextFunction } from "express";
import { SuperAdminService } from "../services/superadmin.service";
import { sendSuccess } from "../utils/response.util";

export class SuperAdminController {
  static async approveSchool(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = { name: req.user?.email || "Super Admin", email: req.user?.email || "admin@acadivo.com" };
      const result = await SuperAdminService.approveSchool(req.body.schoolId, actor);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async rejectSchool(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = { name: req.user?.email || "Super Admin", email: req.user?.email || "admin@acadivo.com" };
      const result = await SuperAdminService.rejectSchool(req.body.schoolId, req.body.reason, actor);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async extendTrial(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = { name: req.user?.email || "Super Admin", email: req.user?.email || "admin@acadivo.com" };
      const result = await SuperAdminService.extendTrial(req.body.schoolId, req.body.days || 7, actor);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async resetAdminPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = { name: req.user?.email || "Super Admin", email: req.user?.email || "admin@acadivo.com" };
      const result = await SuperAdminService.resetAdminPassword(req.body.userId, req.body.newPassword, actor);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getSchoolDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.params.schoolId as string;
      const details = await SuperAdminService.getSchoolDetails(schoolId);
      return sendSuccess(res, details, "School tenant details retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getPendingSchools(req: Request, res: Response, next: NextFunction) {
    try {
      const schools = await SuperAdminService.getPendingSchools();
      return sendSuccess(res, schools, "Pending school registrations retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getAllSchools(req: Request, res: Response, next: NextFunction) {
    try {
      const schools = await SuperAdminService.getAllSchools();
      return sendSuccess(res, schools, "All platform schools retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.query.schoolId as string | undefined;
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;

      const users = await SuperAdminService.getAllUsers(schoolId, role, status);
      return sendSuccess(res, users, "Cross-platform users retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async updateSubscriptionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = { name: req.user?.email || "Super Admin", email: req.user?.email || "admin@acadivo.com" };
      const result = await SuperAdminService.updateSchoolStatus(
        req.body.schoolId,
        req.body.status,
        req.body.plan,
        actor
      );
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await SuperAdminService.getAuditLogs();
      return sendSuccess(res, logs, "Platform audit logs retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await SuperAdminService.getPlans();
      return sendSuccess(res, plans, "Platform plans retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const analytics = await SuperAdminService.getPlatformAnalytics(typeof req.query.period === "string" ? req.query.period : "month");
      return sendSuccess(res, analytics, "Platform analytics retrieved.");
    } catch (error) {
      next(error);
    }
  }
}

