import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { Announcement } from "../models/announcement.model";
import { TeacherNotification } from "../models/teacherNotification.model";
import { SubscriptionPayment } from "../models/subscriptionPayment.model";
import { School } from "../models/school.model";

export async function workspaceNotifications(actor: AuthenticatedUser) {
  if(actor.isSuperAdmin) {
    const [payments,unreadCount] = await Promise.all([SubscriptionPayment.find({status:"PENDING"}).populate("schoolId","name").select("schoolId submittedAt amount plan").sort({submittedAt:-1}).limit(20).lean(),SubscriptionPayment.countDocuments({status:"PENDING"})]);
    return {unreadCount,items:payments.map((payment:any) => ({id:String(payment._id),title:"Payment awaiting verification",content:(payment.schoolId?.name || "School")+" · "+payment.plan+" · PKR "+payment.amount.toLocaleString(),createdAt:payment.submittedAt,canMarkRead:false}))};
  }
  if(!actor.schoolId) throw {statusCode:403,message:"School context required."};
  const [announcements,personal] = await Promise.all([
    Announcement.find({schoolId:actor.schoolId,isPublished:true,$or:[{targetRoles:{$size:0}},{targetRoles:{$exists:false}},{targetRoles:actor.userType}]}).select("title content createdAt").sort({createdAt:-1}).limit(20).lean(),
    actor.userType === "TEACHER" ? TeacherNotification.find({schoolId:actor.schoolId,teacherUserId:actor.userId}).sort({createdAt:-1}).limit(20).lean() : Promise.resolve([]),
  ]);
  const unreadCount = actor.userType === "TEACHER" ? await TeacherNotification.countDocuments({schoolId:actor.schoolId,teacherUserId:actor.userId,isRead:false}) : 0;
  return {unreadCount,items:[...announcements.map((row:any) => ({id:"announcement:"+row._id,title:row.title,content:row.content,createdAt:row.createdAt,canMarkRead:false})),...personal.map((row:any) => ({id:String(row._id),title:row.title,content:row.message || row.content,createdAt:row.createdAt,isRead:row.isRead,canMarkRead:true}))].sort((a,b) => +new Date(b.createdAt)-+new Date(a.createdAt)).slice(0,30)};
}

export async function markWorkspaceNotificationRead(actor:AuthenticatedUser,id:string) {
  if(actor.userType !== "TEACHER" || !actor.schoolId) throw {statusCode:403,message:"This notification cannot be marked read by your account."};
  const row=await TeacherNotification.findOneAndUpdate({_id:id,schoolId:actor.schoolId,teacherUserId:actor.userId},{$set:{isRead:true,readAt:new Date()}},{new:true});
  if(!row) throw {statusCode:404,message:"Notification not found."};
  return {isRead:true};
}
