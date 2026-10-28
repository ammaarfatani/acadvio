import { Request, Response, NextFunction } from "express";
import { canManageSchoolBilling } from "../../lib/billing-access";
export function requireSchoolBillingOwner(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!canManageSchoolBilling(req.user))
    return next({
      statusCode: 403,
      message:
        "Subscription billing is available only to the school's main administrator.",
    });
  next();
}
