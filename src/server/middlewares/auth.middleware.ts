import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JwtPayloadData } from "../utils/jwt.util";
import { User } from "../models/user.model";
import { expireTrials } from "../services/trialLifecycle.service";
import { School } from "../models/school.model";
import { SubscriptionStatus } from "../constants/subscription.constant";
import { Role } from "../models/role.model";
import { UserStatus, UserType } from "../constants/roles.constant";
import { sendError } from "../utils/response.util";

export interface AuthenticatedUser extends JwtPayloadData {
  roleCode?: string;
  isSuperAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, "Authentication required. Please provide a valid token.", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    // Fetch user from DB to ensure status is active
    const user = await User.findById(decoded.userId).populate("roleId");
    if (!user) {
      return sendError(res, "User account no longer exists.", 401);
    }

    const billingRoute = /^\/api\/subscription-payments(?:\/|$)/.test(req.originalUrl.split("?")[0]) || ["/api/auth/me", "/api/auth/logout", "/api/subscriptions/current"].includes(req.originalUrl.split("?")[0]);
    const pendingAdmin = user.userType === UserType.SCHOOL_ADMIN && user.status === UserStatus.PENDING_APPROVAL;
    if (user.status !== UserStatus.ACTIVE && user.userType !== UserType.SUPER_ADMIN && !(pendingAdmin && billingRoute)) {
      return sendError(
        res,
        `Your account status is '${user.status}'. Access is restricted until approved.`,
        403
      );
    }

    if (user.userType !== UserType.SUPER_ADMIN && user.schoolId) {
      await expireTrials(user.schoolId.toString());
      const school = await School.findById(user.schoolId).select("status");
      if (!school) {
        return sendError(res, "Your school account could not be found. Contact your school administrator.", 403);
      }
      if ((![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL].includes(school.status)) && !(billingRoute && user.userType === UserType.SCHOOL_ADMIN) && ![SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED].includes(school.status)) {
        return sendError(
          res,
          school.status === SubscriptionStatus.TRIAL_EXPIRED ? "Your free trial has ended. Upgrade your plan to continue using your School CRM." : "Your school subscription does not currently allow CRM access.",
          403
        );
      }
      if ([SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED].includes(school.status)) {
        return sendError(res, "Your school account is currently restricted. Please contact Acadivo support.", 403);
      }
    }

    let userPermissions: string[] = decoded.permissions || [];
    let roleCode: string | undefined;

    if (user.roleId && typeof user.roleId === "object") {
      const roleObj = user.roleId as any;
      roleCode = roleObj.code;
      if (roleObj.permissions && roleObj.permissions.length > 0) {
        userPermissions = roleObj.permissions;
      }
    }

    req.user = {
      userId: user._id.toString(),
      email: user.email,
      userType: user.userType,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      permissions: userPermissions,
      roleCode,
      isSuperAdmin: user.userType === UserType.SUPER_ADMIN,
    };

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Token expired. Please refresh your session.", 401);
    }
    return sendError(res, "Invalid or corrupted authentication token.", 401);
  }
};



