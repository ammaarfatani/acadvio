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
    console.error("[Central Error Handler]", {
      method: req.method,
      route: req.route?.path || req.path,
      requestId: req.headers["x-request-id"] || req.headers["x-correlation-id"] || undefined,
      name: err?.name || "Error",
      code: err?.code || "UNEXPECTED",
      message: typeof err?.message === "string" ? err.message.slice(0, 500) : "Unexpected server error",
    });
  }

  if (err?.code === 11000 && /challanNumber/i.test(Object.keys(err.keyPattern || err.keyValue || {}).join(" "))) {
    const message = "A challan number conflict occurred. Existing challans were preserved; refresh the list and try again.";
    return sendError(res, message, 409, [message]);
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

  if (err?.name === "ValidationError" && err?.errors && typeof err.errors === "object") {
    const messages = Object.values(err.errors).map((issue: any) => issue?.message).filter(Boolean);
    const message = "The challan could not be saved because one or more fee details are invalid.";
    return sendError(res, message, 400, messages.length ? messages : [message]);
  }

  if (err?.name === "CastError") {
    const field = String(err.path || "record").replace(/([A-Z])/g, " $1").toLowerCase();
    const message = String(err.path || "").toLowerCase() === "latefeefinepolicy"
      ? "The assigned fee structure has an invalid late fine configuration. Correct its saved policy and try again."
      : `Please select a valid ${field}.`;
    return sendError(res, message, 400, [message]);
  }

  const isExpected = Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500;
  const isChallanGeneration = /(?:^|\/)generate-batch$/.test(req.path);
  const message = isExpected
    ? (err.message || "The request could not be completed.")
    : isChallanGeneration
      ? "Unable to complete challan generation. Refresh the list; any challans already saved remain available, and retrying will not create duplicates."
      : "Something went wrong on our side. Please try again.";
  const errors = isExpected && Array.isArray(err.errors) ? err.errors : [message];

  return sendError(res, message, statusCode, errors);
};
