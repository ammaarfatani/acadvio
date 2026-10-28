import mongoose from "mongoose";
const schema=new mongoose.Schema({_id:{type:String,required:true},requestId:{type:String,required:true},digest:{type:String,required:true},status:{type:String,enum:["SENDING","SENT","FAILED"],required:true},name:String,email:String,school:String,topic:String,message:String},{timestamps:true});
export const ContactInquiryRecord=mongoose.models.ContactInquiry||mongoose.model("ContactInquiry",schema);
