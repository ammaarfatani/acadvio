import {children,linkedChild} from "./parent.service";
import {FeeChallan} from "../models/fee.model";
import {FeeSubmission} from "../models/feeSubmission.model";
import {hasFeature} from "../../lib/plan-features";
import { listNotices, readNotice } from "./notice.service";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { TeacherNotification } from "../models/teacherNotification.model";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";

export async function workspaceNotifications(actor: AuthenticatedUser, studentId?:string) {
  if(actor.isSuperAdmin) {
    const [payments,unreadCount] = await Promise.all([SubscriptionPayment.find({status:"PENDING"}).populate("schoolId","name").select("schoolId submittedAt amount plan").sort({submittedAt:-1}).limit(20).lean(),SubscriptionPayment.countDocuments({status:"PENDING"})]);
    return {unreadCount,items:payments.map((payment:any) => ({id:String(payment._id),title:"Payment awaiting verification",content:(payment.schoolId?.name || "School")+" · "+payment.plan+" · PKR "+payment.amount.toLocaleString(),createdAt:payment.submittedAt,canMarkRead:false}))};
  }
  if(!actor.schoolId) throw {statusCode:403,message:"School context required."};
  const [announcements,personal]:[any[],any[]] = await Promise.all([
    listNotices(actor,false,undefined,studentId),
    ["TEACHER","FINANCE","EXAM_STAFF","RECEPTIONIST"].includes(actor.userType) ? TeacherNotification.find({schoolId:actor.schoolId,teacherUserId:actor.userId}).sort({createdAt:-1}).limit(20).lean() : Promise.resolve([]),
  ]);
  if(actor.userType==="PARENT"&&hasFeature(actor.plan,"FINANCE")){
    const linked=studentId?[await linkedChild(actor,studentId)]:await children(actor),ids=linked.map((s:any)=>s._id);
    const [dues,reviews]=await Promise.all([FeeChallan.find({schoolId:actor.schoolId,studentId:{$in:ids},isVoided:{$ne:true},remainingAmountPKR:{$gt:0},dueDate:{$lte:new Date(Date.now()+7*86400000)}}).sort({dueDate:1}).limit(10).lean(),FeeSubmission.find({schoolId:actor.schoolId,studentId:{$in:ids},parentId:actor.userId,status:{$in:["APPROVED","REJECTED"]}}).sort({reviewedAt:-1}).limit(10).lean()]);
    personal.push(...dues.map((d:any)=>({_id:"fee:"+d._id,title:"Fee due · "+d.studentName,message:d.challanNumber+" · PKR "+d.remainingAmountPKR.toLocaleString()+" · Due "+new Date(d.dueDate).toLocaleDateString(),createdAt:d.dueDate,isRead:true,canMarkRead:false})),...reviews.map((r:any)=>({_id:"payment:"+r._id,title:"Payment "+r.status.toLowerCase(),message:"PKR "+r.amountPKR.toLocaleString()+(r.rejectionReason?" · "+r.rejectionReason:""),createdAt:r.reviewedAt,isRead:true,canMarkRead:false})));
  }
  let pendingFees=0;
  if(["FINANCE","SCHOOL_ADMIN"].includes(actor.userType)&&hasFeature(actor.plan,"FINANCE")){
    const pending=await FeeSubmission.find({schoolId:actor.schoolId,status:"PENDING"}).populate("studentId","name").sort({submittedAt:-1}).limit(20).lean();pendingFees=await FeeSubmission.countDocuments({schoolId:actor.schoolId,status:"PENDING"});
    personal.push(...pending.map((r:any)=>({_id:"fee-review:"+r._id,title:"Parent fee payment awaiting verification",message:(r.studentId?.name||"Student")+" · PKR "+r.amountPKR.toLocaleString(),createdAt:r.submittedAt,isRead:false,canMarkRead:false})));
  }
  const unreadCount = ["TEACHER","FINANCE","EXAM_STAFF","RECEPTIONIST"].includes(actor.userType) ? await TeacherNotification.countDocuments({schoolId:actor.schoolId,teacherUserId:actor.userId,isRead:false}) : 0;
  return {unreadCount:pendingFees+unreadCount+announcements.filter((row:any)=>!row.isRead).length,items:[...announcements.map((row:any) => ({id:"announcement:"+row._id,title:row.title,content:row.content,createdAt:row.createdAt,isRead:row.isRead,canMarkRead:true})),...personal.map((row:any) => ({id:String(row._id),title:row.title,content:row.message || row.content,createdAt:row.createdAt,isRead:row.isRead,canMarkRead:row.canMarkRead!==false}))].sort((a,b) => +new Date(b.createdAt)-+new Date(a.createdAt)).slice(0,30)};
}

export async function markWorkspaceNotificationRead(actor:AuthenticatedUser,id:string) {
  if(id.startsWith("announcement:")) return readNotice(actor,id.slice(13));
  if(!["TEACHER","FINANCE","EXAM_STAFF","RECEPTIONIST"].includes(actor.userType) || !actor.schoolId) throw {statusCode:403,message:"This notification cannot be marked read by your account."};
  const row=await TeacherNotification.findOneAndUpdate({_id:id,schoolId:actor.schoolId,teacherUserId:actor.userId},{$set:{isRead:true,readAt:new Date()}},{new:true});
  if(!row) throw {statusCode:404,message:"Notification not found."};
  return {isRead:true};
}
