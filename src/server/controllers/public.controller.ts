import { Request, Response, NextFunction } from "express";
import { PublicService } from "../services/public.service";
import { sendSuccess } from "../utils/response.util";

export class PublicController {
  static async registerSchool(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PublicService.registerSchoolApplication(req.body);
      return sendSuccess(res, result, result.message, 201);
    } catch (error) {
      next(error);
    }
  }

  static async healthCheck(req: Request, res: Response) {
    return sendSuccess(res, { status: "ONLINE", timestamp: new Date() }, "Acadivo ERP API Server Operational");
  }
}
