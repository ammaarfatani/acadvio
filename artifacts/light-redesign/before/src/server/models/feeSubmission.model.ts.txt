import mongoose, { Schema } from "mongoose";
import { branchScoped } from "../utils/branchScope";
const schema = new Schema({
 schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true}, parentId:{type:Schema.Types.ObjectId,ref:"User",required:true}, studentId:{type:Schema.Types.ObjectId,ref:"Student",required:true}, challanId:{type:Schema.Types.ObjectId,ref:"FeeChallan",required:true}, amountPKR:{type:Number,required:true,min:0.01}, reference:{type:String,maxlength:160}, paymentMethod:{type:String,default:"Bank Transfer"}, idempotencyKey:{type:String,required:true}, screenshot:{type:Buffer,required:true,select:false}, screenshotMime:{type:String,required:true}, screenshotHash:{type:String,required:true}, status:{type:String,enum:["PENDING","APPROVED","REJECTED"],default:"PENDING"}, rejectionReason:String, reviewedAt:Date, reviewedBy:{type:Schema.Types.ObjectId,ref:"User"}, receiptNumber:String, paymentId:{type:Schema.Types.ObjectId,ref:"FeePayment"}, submittedAt:{type:Date,default:Date.now}
},{timestamps:true});
schema.index({schoolId:1,challanId:1},{unique:true,partialFilterExpression:{status:"PENDING"}});
schema.index({schoolId:1,parentId:1,idempotencyKey:1},{unique:true});
schema.index({schoolId:1,branchId:1,status:1,submittedAt:-1});schema.plugin(branchScoped);
export const FeeSubmission=mongoose.models.FeeSubmission||mongoose.model("FeeSubmission",schema);
