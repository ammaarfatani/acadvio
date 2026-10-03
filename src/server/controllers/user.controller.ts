import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { sendSuccess } from "../utils/response.util";

export class UserController {
  static async getSchoolUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const users = await UserService.getSchoolUsers(schoolId);
      return sendSuccess(res, users, "School staff users retrieved.");
    } catch (error) {
      next(error);
    }
  }

  static async createStaffUser(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const user = await UserService.createStaffUser(schoolId, req.body);
      return sendSuccess(res, user, "Staff user account created successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const result = await UserService.updateUserStatus(schoolId, userId, req.body.status);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async getLoginActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const activity = await UserService.getSchoolLoginActivity(schoolId);
      return sendSuccess(res, activity, "Login activity audit logs retrieved.");
    } catch (error) {
      next(error);
    }
  }
}
