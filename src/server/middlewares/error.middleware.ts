import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.util";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err?.name === "ZodError") return sendError(res, "Please review the submitted information.", 400, err.issues.map((issue: any) => issue.message));
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500 && err?.code !== 11000) {
    console.error("[Central Error Handler]", {name:err?.name || "Error",code:err?.code || "UNEXPECTED"});
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const labels: Record<string, string> = {
      admissionNumber: "Admission number",
      studentId: "Student ID",
      rollNumber: "Roll number",
      email: "Email address",
      code: "Code",
      name: "Name",
      challanNumber: "Challan number",
    };
    const label = labels[field] || "This value";
    const message = `${label} already exists. Please use a different ${label.toLowerCase()}.`;
    return sendError(res, message, 409, [message]);
  }

  if (err?.type === "entity.parse.failed") {
    return sendError(res, "Please submit valid form data.", 400, ["The request body must contain valid JSON."]);
  }

  if (err?.name === "CastError") {
    const field = String(err.path || "record").replace(/([A-Z])/g, " $1").toLowerCase();
    const message = `Please select a valid ${field}.`;
    return sendError(res, message, 400, [message]);
  }

  const isExpected = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500;
  const message = isExpected
    ? (err.message || "The request could not be completed.")
    : "Something went wrong on our side. Please try again.";
  const errors = isExpected && Array.isArray(err.errors) ? err.errors : [message];

  return sendError(res, message, statusCode, errors);
};
