import mongoose from "mongoose";
import {randomUUID} from "node:crypto";
import {FeeChallan,FeePayment} from "../models/fee.model";
import {PayrollRecord} from "../models/workforce.model";
import {TeacherNotification} from "../models/teacherNotification.model";
import {ParentProfile} from "../models/parentProfile.model";
import {School} from "../models/school.model";
import {User} from "../models/user.model";
import {branchContext,withoutBranchScope} from "../utils/branchScope";
import {hasFeature} from "../../lib/plan-features";
import {dateKey,money} from "./workforceMath";
import {salaryBalance} from "./salaryPayment.service";
const leaseSchema=new mongoose.Schema({_id:String,owner:String,until:Date},{versionKey:false});
export const FinanceJobLease=mongoose.models.FinanceJobLease||mongoose.model("FinanceJobLease",leaseSchema);
async function notify(row:any,userId:any,key:string,title:string,message:string,href:string,session:any,studentId?:any){await TeacherNotification.updateOne({schoolId:row.schoolId,teacherUserId:userId,dedupeKey:key},{$setOnInsert:{schoolId:row.schoolId,teacherUserId:userId,dedupeKey:key,title,message,href,...(studentId?{studentId}:{}),isRead:false}},{upsert:true,session});}
async function scoped(row:any,work:()=>Promise<void>){try{return await branchContext.run({organizationId:String(row.schoolId),branchId:String(row.branchId||row.schoolId),mainBranchId:String(row.branchId||row.schoolId),owner:false},work);}catch{console.error("[Finance reminders] A record could not be processed; it will be retried on the next run.");}}
// Exposed to isolated tests for controlled dates; never an unauthenticated HTTP endpoint.
export async function runFinanceReminders(now=new Date()){
 return withoutBranchScope(async()=>{
  await TeacherNotification.init();const owner=randomUUID();const until=new Date(Date.now()+120000);
  try{const lease=await FinanceJobLease.findOneAndUpdate({_id:"finance-reminders",$or:[{until:{$lte:new Date()}},{until:{$exists:false}}]},{$set:{owner,until}},{upsert:true,new:true});if(lease?.owner!==owner)return {skipped:true};}catch(e:any){if(e.code===11000)return {skipped:true};throw e;}
  let visited=0;const renew=async()=>{const r=await FinanceJobLease.updateOne({_id:"finance-reminders",owner},{$set:{until:new Date(Date.now()+120000)}});if(!r.matchedCount)throw new Error("Finance reminder lease lost");};
  try{
   for await(const item of FeeChallan.find({isVoided:{$ne:true},status:{$nin:["VOIDED","WAIVED"]},$or:[{remainingAmountPKR:{$gt:0}},{updatedAt:{$gte:new Date(now.getTime()-7*86400000)}}]}).lean().cursor()){
    await renew();await scoped(item,async()=>{const session=await mongoose.startSession();try{await session.withTransaction(async()=>{
     const c:any=await FeeChallan.findOne({_id:item._id,schoolId:item.schoolId,isVoided:{$ne:true},status:{$ne:"VOIDED"}}).session(session);if(!c)return;
     const school:any=await School.findById(c.schoolId).select("attendancePolicy financeReminderDays plan").session(session).lean();if(!school||!hasFeature(school.plan,"FINANCE"))return;const today=dateKey(now,school?.attendancePolicy?.timezone||"Asia/Karachi"),due=dateKey(c.dueDate,school?.attendancePolicy?.timezone||"Asia/Karachi"),delta=Math.round((Date.parse(due)-Date.parse(today))/86400000);
     const interval=Math.max(1,Math.min(90,Number(school?.financeReminderDays)||7));
     const parents:any[]=await ParentProfile.find({schoolId:c.schoolId,studentIds:c.studentId}).session(session).lean();
     if(c.remainingAmountPKR>0&&delta<0){if(!c.lateFeeAppliedAt&&Number(c.lateFeePolicyAmount)>0&&!(Number(c.feeBreakdown?.lateFeeFine)>0)){const fine=money(c.lateFeePolicyAmount);c.feeBreakdown.lateFeeFine=fine;c.totalAmountPKR=money(c.totalAmountPKR+fine);c.remainingAmountPKR=money(c.remainingAmountPKR+fine);c.lateFeeAppliedAt=now;}c.status="OVERDUE";}
     // Writing the balance document serializes reminders against concurrent payment/void transactions.
     if(c.remainingAmountPKR>0)await c.save({session});
     const open=c.remainingAmountPKR>0;const text=`${c.studentName} · ${c.challanNumber} · Due ${due}. Outstanding PKR ${c.remainingAmountPKR.toLocaleString()}; late charges PKR ${Number(c.feeBreakdown?.lateFeeFine||0).toLocaleString()}.`;
     for(const p of parents){const href=`/parent/fees?studentId=${c.studentId}&challanId=${c._id}`;
      if(open)await notify(c,p.userId,`challan-created:${c._id}`,"Fee challan generated",text,href,session,c.studentId);
      if(open&&delta>0&&delta<=7)await notify(c,p.userId,`fee-seven:${c._id}:${due}`,delta===7?"Fee due in seven days":"Upcoming school fee",text,href,session,c.studentId);
      if(open&&delta===0)await notify(c,p.userId,`fee-due:${c._id}:${due}`,"School fee due today",text,href,session,c.studentId);
      if(open&&delta<0)await notify(c,p.userId,`fee-overdue:${c._id}:${due}:${Math.floor((-delta-1)/interval)}`,"School fee overdue",text,href,session,c.studentId);
      const payments:any[]=await FeePayment.find({schoolId:c.schoolId,challanId:c._id}).session(session).lean();for(const payment of payments)await notify(c,p.userId,`fee-paid:${payment._id}`,"Fee payment received",`PKR ${payment.amountPKR.toLocaleString()} received for ${c.studentName}, ${c.challanNumber}. Remaining PKR ${(payment.balanceAfterPKR??c.remainingAmountPKR).toLocaleString()}.`,href,session,c.studentId);
     }
    });}finally{await session.endSession()}});visited++;
   }
   const today=dateKey(now,"Asia/Karachi"),d=new Date(today.slice(0,7)+"-01T12:00:00Z");d.setUTCMonth(d.getUTCMonth()-1);const month=d.toISOString().slice(0,7);
   for await(const row of PayrollRecord.find({month,status:{$ne:"PAID"}}).lean().cursor()){await renew();await scoped(row,async()=>{const session=await mongoose.startSession();try{await session.withTransaction(async()=>{const r:any=await PayrollRecord.findOne({_id:row._id,schoolId:row.schoolId,status:{$ne:"PAID"}}).session(session);if(!r||salaryBalance(r).remaining<=0)return;r.revision++;await r.save({session});const u:any=await User.findOne({_id:r.employeeId,schoolId:r.schoolId}).session(session).lean();if(!u)return;const portal=({TEACHER:"teacher",FINANCE:"finance",EXAM_STAFF:"exam-staff",RECEPTIONIST:"receptionist",SCHOOL_ADMIN:"school-admin"} as any)[u.userType];if(portal)await notify(r,r.employeeId,`salary-pending:${r._id}:${today.slice(0,7)}`,"Salary pending · "+month,`Your salary for ${month} is pending. Outstanding PKR ${salaryBalance(r).remaining.toLocaleString()}. Check My Salary for details.`,`/${portal}/salary?payrollId=${r._id}`,session);});}finally{await session.endSession()}});}
   return {visited};
  }finally{await FinanceJobLease.updateOne({_id:"finance-reminders",owner},{$set:{until:new Date(0)}})}
 });
}
export function startFinanceReminders(){const run=()=>void runFinanceReminders().catch(()=>console.error("[Finance reminders] Processing failed; saved notifications are deduplicated and the next run retries."));run();const timer=setInterval(run,60000);timer.unref();return timer;}
export async function notifyFeeEvent(c:any,kind:"generated"|"payment",payment:any,session:any){const parents:any[]=await ParentProfile.find({schoolId:c.schoolId,studentIds:c.studentId}).session(session||null).lean();for(const p of parents)await notify(c,p.userId,kind==="generated"?`challan-created:${c._id}`:`fee-paid:${payment._id}`,kind==="generated"?"Fee challan generated":"Fee payment received",kind==="generated"?`${c.studentName} · ${c.challanNumber} · Amount PKR ${c.totalAmountPKR.toLocaleString()}. Due ${dateKey(c.dueDate,"Asia/Karachi")}.`:`PKR ${payment.amountPKR.toLocaleString()} received for ${c.studentName}, ${c.challanNumber}. Remaining PKR ${c.remainingAmountPKR.toLocaleString()}.`,`/parent/fees?studentId=${c.studentId}&challanId=${c._id}`,session,c.studentId);}
