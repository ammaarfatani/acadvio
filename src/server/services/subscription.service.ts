import { Subscription } from "../models/subscription.model";
import { School } from "../models/school.model";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";
import { expireTrials } from "./trialLifecycle.service";
import { SuperAdminService } from "./superadmin.service";
import { PLAN_CAPACITY, capacityMetric } from "../../lib/plan-capacity";
import { withoutBranchScope } from "../utils/branchScope";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { Branch } from "../models/branch.model";
import { PLAN_FEATURE_LABELS } from "../../lib/plan-features";
export async function subscriptionUsage(schoolId:string, school:any) {
  const code = ["TRIAL","TRIAL_EXPIRED"].includes(school.status) ? "FREE_TRIAL" : school.plan;
  const limits = PLAN_CAPACITY[code] || PLAN_CAPACITY.STARTER;
  const [students,teachers,staff,branches] = await withoutBranchScope(()=>Promise.all([
    Student.countDocuments({schoolId,status:"ACTIVE"}).exec(),
    User.countDocuments({schoolId,userType:"TEACHER",status:"ACTIVE"}).exec(),
    User.countDocuments({schoolId,userType:{$in:["FINANCE","EXAM_STAFF","RECEPTIONIST"]},status:"ACTIVE"}).exec(),
    Branch.countDocuments({organizationId:schoolId,isMain:{$ne:true}}).exec(),
  ]));
  return {scope:"All branches in your organization",students:capacityMetric(students,limits.students),teachers:capacityMetric(teachers,limits.teachers),staff:capacityMetric(staff,code==="STARTER"?0:null),additionalBranches:capacityMetric(branches,limits.additionalBranches),includedFeatures:PLAN_FEATURE_LABELS[code]||[]};
}
export function subscriptionOverview(school:any,sub:any,now=new Date()){
  const trial=["TRIAL","TRIAL_EXPIRED"].includes(sub?.status||school.status);
  const end=trial?(sub?.trialEndsAt||school.trialEndsAt):sub?.currentPeriodEnd;
  const remaining=end?Math.max(0,new Date(end).getTime()-now.getTime()):null;
  const expired=remaining===0||["EXPIRED","TRIAL_EXPIRED","PAST_DUE"].includes(sub?.status||school.status);
  return {serverNow:now.toISOString(),timezone:"Asia/Karachi",plan:sub?.plan||school.plan,status:sub?.status||school.status,
    displayStatus:["SUSPENDED","CANCELLED","PENDING_APPROVAL"].includes(sub?.status||school.status)?(sub?.status||school.status):expired?"Expired":remaining!==null&&remaining<=7*86400000?"Expiring Soon":trial?"Trial":"Active",
    accountStatus:school.accountStatus||"ACTIVE",accountReason:school.accountStatusReason||null,
    startsAt:trial?(sub?.trialStartedAt||school.trialStartedAt||null):(sub?.currentPeriodStart||null),expiresAt:end||null,
    remainingMilliseconds:remaining,daysRemaining:remaining===null?null:Math.ceil(remaining/86400000),
    nextBillingAt:!trial&&!sub?.cancelAtPeriodEnd?end||null:null,paymentStatus:sub?.paymentStatus||"UNPAID",isTrial:trial,isExpired:expired,
    message:(sub?.status||school.status)==="PENDING_APPROVAL"?"Your registration is pending approval. Complete the existing payment verification or trial review process.":expired?"Your subscription has expired. Renew your plan to restore access to subscription-restricted features.":!end?"No expiry date is configured. Contact support to confirm your subscription period.":trial?`Your free trial expires in ${Math.ceil((remaining||0)/86400000)} days.`:`Your subscription expires in ${Math.ceil((remaining||0)/86400000)} days.`};
}
export class SubscriptionService {
 static async getSchoolSubscription(schoolId:string,includePayments=false){
   await expireTrials(schoolId);
   const [school,sub,plans]=await Promise.all([School.findById(schoolId).lean(),Subscription.findOne({schoolId}).lean(),SuperAdminService.getPlans()]);
   if(!school)throw {statusCode:404,message:"School account not found."};
   const payments=includePayments?await SubscriptionPayment.find({schoolId}).sort({submittedAt:-1}).limit(100).lean():[];
   return {...(sub||{}),overview:subscriptionOverview(school,sub),usage:await subscriptionUsage(schoolId,school),plans:plans.filter((p:any)=>p.isActive),payments,latestSuccessfulPayment:payments.find((p:any)=>p.status==="APPROVED"&&p.activationComplete!==false)||null};
 }
}
