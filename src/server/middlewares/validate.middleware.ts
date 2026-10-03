import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { sendError } from "../utils/response.util";

export const validate =
  (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`.replace(/^: /, ""));
        return sendError(res, errorMessages[0] || "Please review the submitted information.", 400, errorMessages);
      }
      return sendError(res, "Invalid request payload", 400);
    }
  };
