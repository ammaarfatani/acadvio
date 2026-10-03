import { Request, Response, NextFunction } from "express";
import { UserType } from "../constants/roles.constant";
import { sendError } from "../utils/response.util";

export const enforceSchoolTenant = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendError(res, "Authentication required for tenant context.", 401);
  }

  // SUPER_ADMIN has cross-tenant access capability
  if (req.user.userType === UserType.SUPER_ADMIN) {
    return next();
  }

  if (!req.user.schoolId) {
    return sendError(res, "Tenant context error: User is not assigned to any school.", 403);
  }

  // Attach derived tenant ID to request query/body safely for downstream controllers
  req.query.tenantSchoolId = req.user.schoolId;
  req.body.tenantSchoolId = req.user.schoolId;

  next();
};

export const verifyResourceSchoolOwnership = (resourceSchoolId: string | null | undefined, reqUser: any) => {
  if (!reqUser) return false;
  if (reqUser.userType === UserType.SUPER_ADMIN) return true;
  if (!resourceSchoolId || !reqUser.schoolId) return false;
  return resourceSchoolId.toString() === reqUser.schoolId.toString();
};
