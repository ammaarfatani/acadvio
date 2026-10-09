import mongoose from "mongoose";
import { randomUUID, createHash } from "crypto";
import { FeeSubmission } from "../models/feeSubmission.model";
import { FeeChallan, FeePayment } from "../models/fee.model";
import { AuditLog } from "../models/auditLog.model";
import { linkedChild } from "./parent.service";
import { SchoolService } from "./school.service";
import { decodePaymentImage } from "./paymentImage";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
export async function submitFee(actor:AuthenticatedUser,studentId:string,input:any){
 await FeeSubmission.init();
 await linkedChild(actor,studentId);
 const existing=await FeeSubmission.findOne({schoolId:actor.schoolId,parentId:actor.userId,idempotencyKey:input.idempotencyKey});
 if(existing){if(String(existing.studentId)!==studentId||String(existing.challanId)!==input.challanId||existing.amountPKR!==input.amountPKR)throw{statusCode:409,message:"Submission key already used for another payment."};return existing;}
 const school=await SchoolService.getSchoolProfile(actor.schoolId!);const bank=school.bankDetails;
 if(!bank?.enabled||!bank.bankName?.trim()||!bank.accountTitle?.trim()||!bank.accountNumber?.trim())throw{statusCode:400,message:"Your school has not enabled bank payment submissions."};
 const challan=await FeeChallan.findOne({_id:input.challanId,schoolId:actor.schoolId,studentId,isVoided:{$ne:true}});
 if(!challan||challan.status==="VOIDED")throw{statusCode:404,message:"Payable invoice not found."};
 if(input.amountPKR>challan.remainingAmountPKR||challan.remainingAmountPKR<=0)throw{statusCode:400,message:"Payment exceeds the current outstanding balance."};
 const image=decodePaymentImage(input.screenshot),hash=createHash("sha256").update(image.bytes).digest("hex");
 if(await FeeSubmission.exists({schoolId:actor.schoolId,challanId:challan._id,screenshotHash:hash,status:{$in:["PENDING","APPROVED"]}}))throw{statusCode:409,message:"This payment proof has already been submitted."};
 try{const saved=await FeeSubmission.create({schoolId:actor.schoolId,parentId:actor.userId,studentId,challanId:challan._id,amountPKR:input.amountPKR,reference:input.reference,paymentMethod:"Bank Transfer",idempotencyKey:input.idempotencyKey,screenshot:image.bytes,screenshotMime:image.mime,screenshotHash:hash});const publicRow=saved.toObject();delete publicRow.screenshot;return publicRow;}catch(e:any){if(e.code===11000)throw{statusCode:409,message:"A payment is already pending for this invoice. Refresh its status."};throw e;}
}
export async function reviewFee(actor:AuthenticatedUser,id:string,status:"APPROVED"|"REJECTED",reason?:string){
 const session=await mongoose.startSession();let result:any;
 try{await session.withTransaction(async()=>{
 const request=await FeeSubmission.findOne({_id:id,schoolId:actor.schoolId}).session(session);
 if(!request)throw{statusCode:404,message:"Payment request not found."};
 if(request.status!=="PENDING")throw{statusCode:409,message:"Payment was already reviewed."};
 if(status==="REJECTED"&&!reason?.trim())throw{statusCode:400,message:"Rejection reason is required."};
 if(status==="APPROVED"){
 const challan=await FeeChallan.findOne({_id:request.challanId,studentId:request.studentId,schoolId:actor.schoolId,isVoided:{$ne:true}}).session(session);
 if(!challan||challan.status==="VOIDED"||request.amountPKR>challan.remainingAmountPKR)throw{statusCode:409,message:"Invoice balance changed. Reject this request and ask for an updated payment."};
 const receiptNumber="REC-"+new Date().getFullYear()+"-"+randomUUID().slice(0,8).toUpperCase();
 challan.paidAmountPKR+=request.amountPKR;challan.remainingAmountPKR=Math.max(0,challan.totalAmountPKR-challan.paidAmountPKR);challan.status=challan.remainingAmountPKR===0?"PAID":"PARTIAL";challan.paymentMethod="Bank Transfer";challan.paidDate=new Date();challan.receiptNumber=receiptNumber;challan.collectedByUserName=actor.email;await challan.save({session});
 const [payment]=await FeePayment.create([{schoolId:actor.schoolId,challanId:challan._id,studentId:challan.studentId,studentName:challan.studentName,rollNumber:challan.rollNumber,className:challan.className,amountPKR:request.amountPKR,paymentMethod:"Bank Transfer",paidAt:new Date(),receiptNumber,collectedByUserName:actor.email}],{session});request.paymentId=payment._id;request.receiptNumber=receiptNumber;
 }
 request.status=status;request.rejectionReason=status==="REJECTED"?reason?.trim():undefined;request.reviewedBy=actor.userId;request.reviewedAt=new Date();await request.save({session});
 await AuditLog.create([{schoolId:actor.schoolId,action:"PARENT_FEE_"+status,performedByName:actor.email,details:"Payment request "+request._id+" reviewed."}],{session});result=request;
 });return result;}finally{await session.endSession();}
}
