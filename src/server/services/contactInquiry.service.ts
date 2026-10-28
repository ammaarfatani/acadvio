import {createHash} from "node:crypto";
import {z} from "zod";
import {ContactInquiryRecord} from "../models/contactInquiry.model";
import {sendEmailNotification} from "../utils/email.util";
import {company} from "../../lib/company";
const single=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[\r\n\x00]/.test(v));
export const contactSchema=z.object({requestId:z.uuid(),name:single(100),email:z.email().max(150),school:z.string().trim().max(150).default(""),topic:single(150),message:z.string().trim().min(10).max(4000),website:z.literal("").optional()});
export async function submitContact(input:unknown){
 const data=contactSchema.parse(input);
 const digest=createHash("sha256").update(JSON.stringify(data)).digest("hex");
 let record;
 // MongoDB's built-in unique _id index makes the request claim atomic even
 // when automatic application index creation is disabled in production.
 try{record=await ContactInquiryRecord.create({...data,_id:data.requestId,digest,status:"SENDING"});}
 catch(error:any){
  if(error.code!==11000)throw error;
  record=await ContactInquiryRecord.findOne({requestId:data.requestId});
  if(!record||record.digest!==digest)throw {statusCode:409,message:"Please start a new inquiry after changing its details."};
  if(record.status==="SENT")return;
  record=await ContactInquiryRecord.findOneAndUpdate({requestId:data.requestId,status:"FAILED"},{$set:{status:"SENDING"}},{new:true});
  if(!record)throw {statusCode:409,message:"This inquiry is already being processed. Please wait before trying again."};
 }
 const recipient=process.env.CONTACT_INQUIRY_EMAIL||company.email;
 const sent=await sendEmailNotification({to:recipient,replyTo:data.email,subject:`Acadivo contact inquiry — ${data.topic}`,text:`Name: ${data.name}\nEmail: ${data.email}\nSchool: ${data.school||"Not provided"}\nSubject: ${data.topic}\nSubmitted at: ${record.createdAt.toISOString()} (UTC)\n\n${data.message}`});
 await ContactInquiryRecord.updateOne({_id:record._id},{$set:{status:sent?"SENT":"FAILED"}});
 if(!sent)throw {statusCode:503,message:"Your inquiry could not be emailed. Please try again or contact us directly."};
}
