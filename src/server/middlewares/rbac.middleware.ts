import { Request, Response, NextFunction } from "express";
import { UserType } from "../constants/roles.constant";
import { sendError } from "../utils/response.util";

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.userType !== UserType.SUPER_ADMIN) {
    return sendError(res, "Access denied. Platform Super Admin privileges required.", 403);
  }
  next();
};

export const requireUserType = (...allowedTypes: UserType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required.", 401);
    }

    if (req.user.userType === UserType.SUPER_ADMIN || allowedTypes.includes(req.user.userType)) {
      return next();
    }

    return sendError(
      res,
      `Access denied. Role '${req.user.userType}' is not authorized for this action.`,
      403
    );
  };
};

export const requireExactUserType = (...allowedTypes: UserType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return sendError(res, "Authentication required.", 401);
    if (!allowedTypes.includes(req.user.userType)) {
      return sendError(res, "Access denied. Your account role does not have access to this portal.", 403);
    }
    next();
  };
};

export const requirePermission = (permissionCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required.", 401);
    }

    // Super admin overrides permission check
    if (req.user.userType === UserType.SUPER_ADMIN) {
      return next();
    }

    const hasPerm = req.user.permissions && req.user.permissions.includes(permissionCode);
    if (!hasPerm) {
      return sendError(
        res,
        `Forbidden. Missing required permission '${permissionCode}'.`,
        403
      );
    }

    next();
  };
};
