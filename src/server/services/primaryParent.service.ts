import {UserType} from "../constants/roles.constant";
import crypto from "node:crypto";
import {ClientSession} from "mongoose";
import {User} from "../models/user.model";
import {ParentProfile} from "../models/parentProfile.model";
import {UserService} from "./user.service";
import {withoutBranchScope,branchContext} from "../utils/branchScope";
export async function linkPrimaryParent(schoolId:string,student:any,password:string|undefined,session:ClientSession){
 const email=String(student.parentInfo?.guardianEmail||"").trim().toLowerCase();if(!email)return null;
 const existing=await withoutBranchScope(()=>User.findOne({email}).session(session).exec());
 const branchId=branchContext.getStore()?.branchId||schoolId;
 if(existing&&(String(existing.schoolId)!==schoolId||existing.userType!=="PARENT"||String(existing.branchId||schoolId)!==branchId))throw {statusCode:409,message:"This parent email belongs to another account or branch. Use the correct primary parent email."};
 let userId=existing?._id;let initialPassword:string|undefined;
 if(!existing){initialPassword=password||crypto.randomBytes(18).toString("base64url");const user=await UserService.createStaffUser(schoolId,{name:student.parentInfo.guardianName||student.parentInfo.fatherName,email,password:initialPassword,userType:UserType.PARENT},session);userId=user.id;}
 await ParentProfile.findOneAndUpdate({schoolId,userId},{$addToSet:{studentIds:student._id},$setOnInsert:{schoolId,userId}},{upsert:true,new:true,session,runValidators:true});
 return {email,created:!existing,...(initialPassword?{initialPassword}:{})};
}
