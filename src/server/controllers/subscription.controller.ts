import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscription.service";
import { sendSuccess } from "../utils/response.util";

export class SubscriptionController {
  static async getMySubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const schoolId = req.user?.schoolId;
      if (!schoolId) {
        throw { statusCode: 400, message: "No school context assigned to user." };
      }
      const sub = await SubscriptionService.getSchoolSubscription(schoolId);
      return sendSuccess(res, sub, "School subscription details retrieved.");
    } catch (error) {
      next(error);
    }
  }
}
