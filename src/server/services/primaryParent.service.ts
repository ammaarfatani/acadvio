import {UserType} from "../constants/roles.constant";
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
 let userId=existing?._id;
 if(!existing&&(!password||password.length<8||password.length>128))throw {statusCode:400,message:"Enter a parent portal password (8–128 characters) to create a new parent account. For an existing parent, leave the password blank."};
 if(!existing){const user=await UserService.createStaffUser(schoolId,{name:student.parentInfo.guardianName||student.parentInfo.fatherName,email,password:password!,userType:UserType.PARENT},session);userId=user.id;}
 await ParentProfile.findOneAndUpdate({schoolId,userId},{$addToSet:{studentIds:student._id},$setOnInsert:{schoolId,userId}},{upsert:true,new:true,session,runValidators:true});
 return {email,created:!existing};
}
