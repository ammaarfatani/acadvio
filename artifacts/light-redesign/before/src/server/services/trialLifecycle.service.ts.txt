import { School } from "../models/school.model";
import { Subscription } from "../models/subscription.model";

// Conditional state changes only; academic and user data are never removed.
export async function expireTrials(schoolId?: string, now = new Date()) {
  const scope = schoolId ? { _id: schoolId } : {};
  await School.updateMany({ ...scope, status: "TRIAL", trialEndsAt: { $lte: now } }, { $set: { status: "TRIAL_EXPIRED" } });
  await Subscription.updateMany({ ...(schoolId ? { schoolId } : {}), status: "TRIAL", trialEndsAt: { $lte: now } }, { $set: { status: "TRIAL_EXPIRED" } });
}
