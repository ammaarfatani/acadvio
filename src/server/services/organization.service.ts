import { analyticsPeriodStart } from "./platformAnalytics.service";
import mongoose from "mongoose";
import { Branch } from "../models/branch.model";
import { School } from "../models/school.model";
import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { Student } from "../models/student.model";
import { StudentAttendance, TeacherAttendance } from "../models/attendance.model";
import { FeePayment, FeeChallan, Expense } from "../models/fee.model";
import { ExamSchedule, ProcessedResult } from "../models/exam.model";
import { Admission } from "../models/admission.model";
import { branchContext, withoutBranchScope } from "../utils/branchScope";
import { hashPassword } from "../utils/password.util";
import { mainBranch } from "./branchContext.service";
import { listNotices } from "./notice.service";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
export async function organizationBranches(schoolId: string) {
  const school = await School.findById(schoolId); if (!school) throw {statusCode:404,message:"Organization not found."};
  await mainBranch(school); return Branch.find({ organizationId: schoolId }).sort({ isMain: -1, name: 1 }).lean();
}
export async function saveBranch(schoolId: string, input: any, id?: string) {
  if (!id) return Branch.create({ ...input, organizationId: schoolId, isMain: false });
  const branch = await Branch.findOne({ _id:id, organizationId:schoolId }); if (!branch) throw {statusCode:404,message:"Branch not found."};
  if (branch.isMain && input.status === "INACTIVE") throw {statusCode:400,message:"The main branch cannot be deactivated."};
  Object.assign(branch,input); await branch.save(); return branch;
}
export async function branchAdministrator(actor: AuthenticatedUser, branchId: string, input: any) {
  const branch = await Branch.findOne({ _id:branchId, organizationId:actor.schoolId }); if (!branch || branch.status !== "ACTIVE") throw {statusCode:404,message:"Active branch not found."};
  const role = await Role.findOne({ schoolId:null, userType:"SCHOOL_ADMIN" }); if (!role) throw {statusCode:503,message:"School Admin role is not configured."};
  const passwordHash = await hashPassword(input.password);
  const user = await withoutBranchScope(() => User.create({ schoolId:actor.schoolId, organizationId:actor.schoolId, branchId, isOrganizationOwner:false, roleId:role._id, userType:"SCHOOL_ADMIN", name:input.name, email:input.email.toLowerCase(), passwordHash, status:"ACTIVE", isEmailVerified:true }));
  return { id:user._id,name:user.name,email:user.email,branchId:user.branchId };
}
export async function assignAdministrator(actor: AuthenticatedUser, branchId: string, userId: string) {
  if (!await Branch.exists({_id:branchId,organizationId:actor.schoolId,status:"ACTIVE"})) throw {statusCode:404,message:"Active branch not found."};
  return withoutBranchScope(async () => { const user=await User.findOne({_id:userId,schoolId:actor.schoolId,userType:"SCHOOL_ADMIN",isOrganizationOwner:false}); if(!user)throw{statusCode:404,message:"Branch administrator not found."}; user.branchId=branchId;user.organizationId=actor.schoolId;await user.save();return{id:user._id,branchId}; });
}
export async function branchDirectory(actor: AuthenticatedUser, branchId: string) {
  if (!await Branch.exists({_id:branchId,organizationId:actor.schoolId}))throw{statusCode:404,message:"Branch not found."};
  return branchContext.run({...branchContext.getStore()!,branchId},async()=>{
    const [users,students]=await Promise.all([User.find({schoolId:actor.schoolId}).select("name email userType status branchId").sort({name:1}).limit(200).lean(),Student.find({schoolId:actor.schoolId}).select("name className sectionName rollNumber status").sort({name:1}).limit(200).lean()]);return{users,students};
  });
}
export async function organizationReport(actor: AuthenticatedUser, input: any) {
  const branches = await organizationBranches(actor.schoolId!);
  const scope = branchContext.getStore()!;
  const branchId = input.branchId || scope.branchId;
  if (branchId && !branches.some((b:any)=>String(b._id)===branchId))throw{statusCode:403,message:"Branch does not belong to this organization."};
  return branchContext.run({...scope,branchId:branchId || null},async()=>{
    const base:any={schoolId:new mongoose.Types.ObjectId(actor.schoolId!)};
    const academic:any={...base}; for(const field of ["classId","sectionId","academicSessionId"])if(input[field])academic[field]=new mongoose.Types.ObjectId(input[field]);
    const range:any={};if(input.from){const start=new Date(input.from);range.$gte=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate())-5*3600000);}if(input.to){const end=new Date(input.to);range.$lte=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate()+1)-5*3600000-1);}
    const grouped=(extra:any,fields:any)=>[{$match:extra},{$group:{_id:{$ifNull:["$branchId","$schoolId"]},...fields}}];
    const today=analyticsPeriodStart("today");
    const studentFilters = input.classId || input.sectionId || input.academicSessionId;
    const childIds = studentFilters ? (await Student.find(academic).select("_id").lean()).map((s:any)=>s._id) : undefined;
    const paymentsFilter = {...base,...(childIds ? {studentId:{$in:childIds}} : {})};
    const resultFilter = {...paymentsFilter,isPublished:true};
    const examsFilter = {...base,...(input.classId ? {classes:input.classId} : {}),...(input.academicSessionId ? {academicSessionId:new mongoose.Types.ObjectId(input.academicSessionId)} : {})};
    const admissionsFilter = {...base,...(input.classId ? {applyingClassId:new mongoose.Types.ObjectId(input.classId)} : {}),...(input.academicSessionId ? {academicSessionId:new mongoose.Types.ObjectId(input.academicSessionId)} : {})};
    const [students,users,attendance,payments,balances,performance,exams,recentAdmissions,notices]=await Promise.all([
      Student.aggregate(grouped({...academic,...(Object.keys(range).length?{admissionDate:range}:{})},{total:{$sum:1},active:{$sum:{$cond:[{$eq:["$status","ACTIVE"]},1,0]}}})),
      User.aggregate([...grouped({...base,...(input.department?{userType:input.department}:{})},{teachers:{$sum:{$cond:[{$eq:["$userType","TEACHER"]},1,0]}},parents:{$sum:{$cond:[{$eq:["$userType","PARENT"]},1,0]}},staff:{$sum:{$cond:[{$in:["$userType",["FINANCE","EXAM_STAFF","RECEPTIONIST","SCHOOL_ADMIN"]]},1,0]}}})]),
      StudentAttendance.aggregate([{$match:{...academic,...(Object.keys(range).length?{date:range}:{})}},{$unwind:"$records"},...grouped({}, {marked:{$sum:1},present:{$sum:{$cond:[{$in:["$records.status",["PRESENT","LATE"]]},1,0]}},today:{$sum:{$cond:[{$and:[{$gte:["$date",today]},{$lt:["$date",new Date(+today+86400000)]}]},1,0]}}})]),
      FeePayment.aggregate(grouped({...paymentsFilter,...(Object.keys(range).length?{paidAt:range}:{})},{collection:{$sum:"$amountPKR"}})),
      FeeChallan.aggregate(grouped({...paymentsFilter,isVoided:{$ne:true},...(Object.keys(range).length?{dueDate:range}:{})},{outstanding:{$sum:"$remainingAmountPKR"}})),
      ProcessedResult.aggregate(grouped({...resultFilter,...(Object.keys(range).length?{publishedAt:range}:{})},{average:{$avg:"$percentage"},results:{$sum:1}})),
      ExamSchedule.aggregate(grouped({...examsFilter,...(Object.keys(range).length?{startDate:range}:{})},{exams:{$sum:1}})),
      Admission.find({...admissionsFilter,...(Object.keys(range).length?{createdAt:range}:{})}).select("studentName applyingClassName status createdAt branchId").sort({createdAt:-1}).limit(10).lean(),listNotices(actor)
    ]);
    const time=(field:string)=>Object.keys(range).length?{[field]:range}:{};
    const chart=(match:any,group:any,value:any):mongoose.PipelineStage[]=>[{$match:match},{$group:{_id:group,value}},{$sort:{_id:1}},{$project:{_id:0,label:"$_id",value:1}}];
    const month=(field:string)=>({$dateToString:{format:"%Y-%m",date:"$"+field,timezone:"Asia/Karachi"}});
    const [expenseTotals,expenseCategories,expenseTrend,feeTrend,staffRoles,studentsByClass,feeStatus,attendanceTrend,staffAttendance,resultStatus,subjectPerformance]=await Promise.all([
      Expense.aggregate([{$match:{...base,isVoided:{$ne:true},...time("expenseDate")}},{$group:{_id:null,total:{$sum:"$amountPKR"}}}]),
      Expense.aggregate(chart({...base,isVoided:{$ne:true},...time("expenseDate")},"$category",{$sum:"$amountPKR"})),
      Expense.aggregate(chart({...base,isVoided:{$ne:true},...time("expenseDate")},month("expenseDate"),{$sum:"$amountPKR"})),
      FeePayment.aggregate(chart({...paymentsFilter,...time("paidAt")},month("paidAt"),{$sum:"$amountPKR"})),
      User.aggregate(chart({...base,...(input.department?{userType:input.department}:{})},"$userType",{$sum:1})),
      Student.aggregate(chart({...academic,...time("admissionDate")},{$concat:["$className"," · ",{$ifNull:["$sectionName",""]}]},{$sum:1})),
      FeeChallan.aggregate(chart({...paymentsFilter,isVoided:{$ne:true},...time("dueDate")},{$cond:[{$and:[{$gt:["$remainingAmountPKR",0]},{$lt:["$dueDate",new Date()]}]},"OVERDUE","$status"]},{$sum:1})),
      StudentAttendance.aggregate([{$match:{...academic,...time("date")}},{$unwind:"$records"},...chart({},month("date"),{$avg:{$cond:[{$in:["$records.status",["PRESENT","LATE"]]},100,0]}})]),
      TeacherAttendance.aggregate([{$match:{...base,...time("date")}},{$unwind:"$records"},...chart({},"$records.status",{$sum:1})]),
      ProcessedResult.aggregate(chart({...resultFilter,...time("publishedAt")},"$status",{$sum:1})),
      ProcessedResult.aggregate([{$match:{...resultFilter,...time("publishedAt")}},{$unwind:"$subjectScores"},...chart({},"$subjectScores.subjectName",{$avg:{$cond:[{$gt:["$subjectScores.maxMarks",0]},{$multiply:[{$divide:["$subjectScores.obtainedMarks","$subjectScores.maxMarks"]},100]},null]}})])
    ]);
    const charts={expenseCategories,expenseTrend,feeTrend,staffRoles,studentsByClass,feeStatus,attendanceTrend,staffAttendance,resultStatus,subjectPerformance};
    const indexed=(rows:any[])=>new Map(rows.map(row=>[String(row._id),row]));const maps=[students,users,attendance,payments,balances,performance,exams].map(indexed);
    const rows=branches.filter((b:any)=>!branchId||String(b._id)===branchId).map((b:any)=>({branch:b,...Object.assign({},...maps.map(map=>map.get(String(b._id))||{})),_id:b._id}));
    const totals:any={};for(const row of rows)for(const key of ["total","active","teachers","parents","staff","marked","present","today","collection","outstanding","results","exams"])totals[key]=(totals[key]||0)+(row[key]||0);
    const resultCount=totals.results;totals.average=resultCount?rows.reduce((s:number,r:any)=>s+(r.average||0)*(r.results||0),0)/resultCount:null;
    totals.expenses=expenseTotals[0]?.total||0;totals.netCollection=totals.collection-totals.expenses;
    return{charts,branchId:branchId||"all",totalBranches:rows.length,totals,branches:rows,recentAdmissions,notices:notices.slice(0,8),timezone:"Asia/Karachi",generatedAt:new Date()};
  });
}
