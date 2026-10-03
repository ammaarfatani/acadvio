import { Response } from "express";

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = "Operation successful",
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string = "Internal server error",
  statusCode: number = 500,
  errors: any[] = []
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : [message],
  });
};
