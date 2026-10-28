import {Subscription} from "../models/subscription.model";
import {School} from "../models/school.model";
import {User} from "../models/user.model";
import {sendEmailNotification} from "../utils/email.util";
import {frontendLink} from "../utils/emailTemplate";
import {env} from "../config/env";
export async function sendExpiryReminders(now=new Date()){
 if(process.env.SUBSCRIPTION_REMINDERS_ENABLED!=="true")return {sent:0};
 const rows=await Subscription.find({status:{$in:["TRIAL","ACTIVE","TRIAL_EXPIRED","EXPIRED"]},$or:[{trialEndsAt:{$lte:new Date(now.getTime()+7*86400000)}},{currentPeriodEnd:{$lte:new Date(now.getTime()+7*86400000)}}]}).lean();let sent=0;
 for(const row of rows){
  const trial=["TRIAL","TRIAL_EXPIRED"].includes(row.status),end=trial?row.trialEndsAt:row.currentPeriodEnd;
  if(!end)continue;const days=Math.max(0,Math.ceil((new Date(end).getTime()-now.getTime())/86400000));if(days>7)continue;
  const threshold=days===0?0:days<=1?1:days<=3?3:7,key=new Date(end).toISOString()+":"+threshold;
  const admin=await User.findOne({schoolId:row.schoolId,userType:"SCHOOL_ADMIN",status:"ACTIVE",isOrganizationOwner:{$ne:false}}).select("name email");if(!admin)continue;
  const school=await School.findById(row.schoolId).select("name slug code status");if(!school||school.status==="PENDING_APPROVAL")continue;
  const claim=await Subscription.updateOne({_id:row._id,[trial?"trialEndsAt":"currentPeriodEnd"]:end,expiryReminderClaims:{$ne:key}},{$addToSet:{expiryReminderClaims:key}});if(!claim.modifiedCount)continue;
  let delivered=false;try{delivered=await sendEmailNotification({to:admin.email,subject:days===0?"Your Acadivo subscription has expired":"Your Acadivo subscription expires soon",greeting:"Hello "+admin.name+",",text:days===0?"Your subscription has expired. Your school records remain saved. Renew your plan to restore subscription-restricted features.":`Your ${trial?"free trial":"subscription"} expires in ${days} days. Expiry: ${new Date(end).toLocaleString("en-PK",{timeZone:"Asia/Karachi"})} (Asia/Karachi).`,actionLabel:days===0?"Renew Subscription":"View Subscription",actionUrl:frontendLink(env.FRONTEND_URL,`/${school.slug||school.code}/admin/subscription`,env.NODE_ENV==="production")});}catch{}
  if(delivered)sent++;else await Subscription.updateOne({_id:row._id},{$pull:{expiryReminderClaims:key}});
 }
 return {sent};
}
