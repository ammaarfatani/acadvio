import { School } from "../models/school.model";
import { Subscription } from "../models/subscription.model";

// Conditional state changes only; academic and user data are never removed.
export async function expireTrials(schoolId?: string, now = new Date()) {
  const scope = schoolId ? { _id: schoolId } : {};
  await School.updateMany({ ...scope, status: "TRIAL", trialEndsAt: { $lte: now } }, { $set: { status: "TRIAL_EXPIRED" } });
  await Subscription.updateMany({ ...(schoolId ? { schoolId } : {}), status: "TRIAL", trialEndsAt: { $lte: now } }, { $set: { status: "TRIAL_EXPIRED" } });
  const expired = await Subscription.find({...(schoolId?{schoolId}:{}),status:"ACTIVE",currentPeriodEnd:{$lte:now}}).select("schoolId currentPeriodEnd").lean();
  for(const subscription of expired){
    const previous:any=await School.findById(subscription.schoolId).select("status updatedAt").lean();
    const changed=await Subscription.updateOne({_id:subscription._id,status:"ACTIVE",currentPeriodEnd:{$lte:now}},{$set:{status:"EXPIRED"}});
    if(changed.modifiedCount&&previous&&await Subscription.exists({_id:subscription._id,status:"EXPIRED",currentPeriodEnd:subscription.currentPeriodEnd}))await School.updateOne({_id:subscription.schoolId,status:"ACTIVE",updatedAt:previous.updatedAt},{$set:{status:"EXPIRED"}});
  }
}

  // Paid periods are authoritative; missing legacy end dates are not invented.
