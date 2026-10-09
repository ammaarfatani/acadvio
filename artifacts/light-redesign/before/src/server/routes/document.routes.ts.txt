import {Branch} from "../models/branch.model";
import {Router} from "express";
import {z} from "zod";
import {authenticate} from "../middlewares/auth.middleware";
import {requireExactUserType,requirePermission} from "../middlewares/rbac.middleware";
import {UserType} from "../constants/roles.constant";
import {SchoolDocument} from "../models/schoolDocument.model";
import {parentAudience} from "../services/parentAudience.service";
import {hasFeature} from "../../lib/plan-features";
import {sendSuccess} from "../utils/response.util";
import {decodePaymentImage} from "../services/paymentImage";
import {branchContext} from "../utils/branchScope";
const router=Router();router.use(authenticate);const id=z.string().regex(/^[a-f0-9]{24}$/i);
async function visible(req:any){if(req.user.userType!==UserType.PARENT)return{schoolId:req.user.schoolId};const audience=await parentAudience(req.user.schoolId,req.user.userId,req.query.studentId===undefined?undefined:id.parse(req.query.studentId));const categories=["GENERAL","ADMISSION","PERMISSION",...(hasFeature(req.user.plan,"FINANCE")?["FEES"]:[]),...(hasFeature(req.user.plan,"EXAMINATIONS")?["EXAMINATION"]:[])];return{$and:[{schoolId:req.user.schoolId,status:"PUBLISHED",category:{$in:categories},$or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}]},audience]};}
router.get("/",requireExactUserType(UserType.PARENT,UserType.SCHOOL_ADMIN),async(req,res,next)=>{try{return sendSuccess(res,await SchoolDocument.find(await visible(req)).sort({createdAt:-1}).limit(200).lean());}catch(e){next(e);}});
router.get("/:id/download",requireExactUserType(UserType.PARENT,UserType.SCHOOL_ADMIN),async(req,res,next)=>{try{const row=await SchoolDocument.findOne({$and:[await visible(req),{_id:id.parse(req.params.id)}]}).select("+file");if(!row)throw{statusCode:404,message:"Document unavailable."};res.set({"Content-Type":row.mime,"Content-Disposition":"attachment; filename=\""+row.filename.replace(/[^a-zA-Z0-9._-]/g,"_")+"\"","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});return res.send(row.file);}catch(e){next(e);}});
router.post("/",requireExactUserType(UserType.SCHOOL_ADMIN),requirePermission("settings.update"),async(req,res,next)=>{try{
 const body=z.object({title:z.string().trim().min(3).max(180),description:z.string().max(1000).default(""),category:z.enum(["GENERAL","ADMISSION","FEES","EXAMINATION","PERMISSION"]),status:z.enum(["DRAFT","PUBLISHED","ARCHIVED"]),expiresAt:z.coerce.date().nullable().optional(),targetStudentIds:z.array(id).max(200).default([]),targetClassIds:z.array(id).max(100).default([]),targetSectionIds:z.array(id).max(100).default([]),branchId:id.nullable().optional(),filename:z.string().min(1).max(180),file:z.string().max(7100000)}).strict().parse(req.body);
 if(body.category==="FEES"&&!hasFeature(req.user!.plan,"FINANCE")||body.category==="EXAMINATION"&&!hasFeature(req.user!.plan,"EXAMINATIONS"))throw{statusCode:403,message:"Document category is not included in your subscription."};
 const scope=branchContext.getStore()!;const branchId=scope.owner?body.branchId??scope.branchId:scope.branchId;if(!scope.owner&&body.branchId!==undefined&&body.branchId!==scope.branchId)throw{statusCode:403,message:"Own branch only."};
 if(branchId&&!await Branch.exists({_id:branchId,organizationId:req.user!.schoolId}))throw{statusCode:403,message:"Branch does not belong to your school."};
 let bytes:Buffer,mime:string;if(body.file.startsWith("data:application/pdf;base64,")){const raw=body.file.slice(28);bytes=Buffer.from(raw,"base64");mime="application/pdf";if(bytes.toString("base64")!==raw||bytes.toString("ascii",0,5)!=="%PDF-"||bytes.length>5*1024*1024)throw{statusCode:400,message:"Upload a valid PDF up to 5 MB."};}else{const image=decodePaymentImage(body.file);bytes=image.bytes;mime=image.mime;}
 const saved=await branchContext.run({...scope,branchId},()=>SchoolDocument.create({...body,schoolId:req.user!.schoolId,branchId,createdBy:req.user!.userId,file:bytes,mime}));const publicRow=saved.toObject();delete publicRow.file;return sendSuccess(res,publicRow,"Parent document saved.");
 }catch(e){next(e);}});
router.patch("/:id",requireExactUserType(UserType.SCHOOL_ADMIN),requirePermission("settings.update"),async(req,res,next)=>{try{const input=z.object({status:z.enum(["DRAFT","PUBLISHED","ARCHIVED"])}).strict().parse(req.body);const filter:any={_id:id.parse(req.params.id),schoolId:req.user!.schoolId};if(!req.user!.isOrganizationOwner)filter.branchId=req.user!.branchId;const row=await SchoolDocument.findOneAndUpdate(filter,{$set:input},{new:true});if(!row)throw{statusCode:404,message:"Document not found."};return sendSuccess(res,row,"Document updated.");}catch(e){next(e);}});
export default router;
