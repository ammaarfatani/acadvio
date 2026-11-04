import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response.util";

// Controllers accept scalar URL filters, never MongoDB operators or nested objects.
export function requestSafety(req: Request, res: Response, next: NextFunction) {
  const query = Object.entries(req.query);
  if (query.length > 100 || query.some(([key, value]) =>
    !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key) || typeof value !== "string" || value.length > 8192
  )) return sendError(res, "Use a single text value for each request filter.", 400);
  let nodes = 0;
  function safe(value: unknown, depth = 0): boolean {
    if (!value || typeof value !== "object") return true;
    if (depth > 32 || ++nodes > 50000) return false;
    return Object.entries(value).every(([key, child]) =>
      !["__proto__", "constructor", "prototype"].includes(key) &&
      !key.includes("$") && !key.includes(".") && safe(child, depth + 1)
    );
  }
  if (!safe(req.body)) return sendError(res, "The submitted information contains invalid fields or is too complex.", 400);
  next();
}
