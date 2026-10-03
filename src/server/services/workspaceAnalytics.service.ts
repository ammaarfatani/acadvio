import mongoose from "mongoose";
import {AuthenticatedUser} from "../middlewares/auth.middleware";
import {Student} from "../models/student.model";
import {StudentAttendance,TeacherAttendance} from "../models/attendance.model";
import {FeePayment,FeeChallan} from "../models/fee.model";
import {ProcessedResult} from "../models/exam.model";
import {Admission} from "../models/admission.model";
import {availableReports} from "./assistant.service";
import {analyticsPeriodStart} from "./platformAnalytics.service";

export type Series = {label:string;value:number}[];
export async function workspaceAnalytics(actor:AuthenticatedUser) {
  if(!actor.schoolId || actor.isSuperAdmin)throw {statusCode:403,message:"School analytics require an authenticated school account."};
  const schoolId=new mongoose.Types.ObjectId(actor.schoolId),scope={schoolId};
  const month=analyticsPeriodStart("month"),start=new Date(month);start.setUTCMonth(start.getUTCMonth()-5);
  const reports=availableReports(actor);
  const output:{title:string;kind:"line"|"bar"|"donut";unit?:string;data:Series;description:string}[]=[];
  const series=(rows:any[]) => rows.map(row=>({label:String(row._id),value:Number(row.value || 0)}));
  if(reports.includes("students")) {
    const [byClass,byStatus,growth]=await Promise.all([
      Student.aggregate([{$match:{...scope,status:"ACTIVE"}},{$group:{_id:"$className",value:{$sum:1}}},{$sort:{_id:1}},{$limit:30}]),
      Student.aggregate([{$match:scope},{$group:{_id:"$status",value:{$sum:1}}},{$sort:{_id:1}}]),
      Student.aggregate([{$match:{...scope,admissionDate:{$gte:start,$lte:new Date()}}},{$group:{_id:{$dateToString:{date:"$admissionDate",format:"%Y-%m",timezone:"Asia/Karachi"}},value:{$sum:1}}},{$sort:{_id:1}}]),
    ]);
    output.push({title:"Students by class",kind:"bar",data:series(byClass),description:"Active student records grouped by class."},{title:"Student status",kind:"donut",data:series(byStatus),description:"Status of all recorded students."},{title:"New admissions",kind:"line",data:series(growth),description:"Recorded admissions by month, over the last six calendar months."});
  }
  if(reports.includes("finance")) {
    const [collections,balances]=await Promise.all([
      FeePayment.aggregate([{$match:{...scope,paidAt:{$gte:start,$lte:new Date()}}},{$group:{_id:{$dateToString:{date:"$paidAt",format:"%Y-%m",timezone:"Asia/Karachi"}},value:{$sum:"$amountPKR"}}},{$sort:{_id:1}}]),
      FeeChallan.aggregate([{$match:{...scope,isVoided:{$ne:true}}},{$group:{_id:null,paid:{$sum:"$paidAmountPKR"},pending:{$sum:"$remainingAmountPKR"}}}]),
    ]);
    output.push({title:"Fee collection trend",kind:"line",unit:"PKR",data:series(collections),description:"Actual fee payment ledger, grouped by month."},{title:"Collected & outstanding fees",kind:"donut",unit:"PKR",data:[{label:"Paid",value:balances[0]?.paid || 0},{label:"Outstanding",value:balances[0]?.pending || 0}],description:"Amounts on non-voided challans; balances are not subscription revenue."});
  }
  if(reports.includes("attendance")) {
    const rows=await StudentAttendance.aggregate([{$match:{...scope,date:{$gte:month,$lte:new Date()}}},{$unwind:"$records"},{$group:{_id:"$records.status",value:{$sum:1}}}]);
    output.push({title:"Attendance this month",kind:"donut",data:series(rows),description:"Recorded attendance entries; unmarked registers are excluded."});
  }
  if(reports.includes("examinations")) {
    const [performance,status,subjects]=await Promise.all([
      ProcessedResult.aggregate([{$match:{...scope,isPublished:true}},{$group:{_id:"$examTitle",value:{$avg:"$percentage"}}},{$sort:{_id:1}},{$limit:20}]),
      ProcessedResult.aggregate([{$match:{...scope,isPublished:true}},{$group:{_id:"$status",value:{$sum:1}}}]),
      ProcessedResult.aggregate([{$match:{...scope,isPublished:true}},{$unwind:"$subjectScores"},{$match:{"subjectScores.maxMarks":{$gt:0}}},{$group:{_id:"$subjectScores.subjectName",value:{$avg:{$multiply:[{$divide:["$subjectScores.obtainedMarks","$subjectScores.maxMarks"]},100]}}}},{$sort:{_id:1}},{$limit:20}]),
    ]);
    output.push({title:"Published examination averages",kind:"bar",unit:"%",data:series(performance),description:"Average percentage across published results for each exam."},{title:"Published result status",kind:"donut",data:series(status),description:"Passed, promoted and failed published result records."},{title:"Subject performance",kind:"bar",unit:"%",data:series(subjects),description:"Average subject percentage across published examination results."});
  }
  if(actor.userType === "TEACHER") {
    const rows=await TeacherAttendance.aggregate([{$match:{...scope,date:{$gte:month,$lte:new Date()}}},{$unwind:"$records"},{$match:{"records.teacherUserId":new mongoose.Types.ObjectId(actor.userId)}},{$group:{_id:"$records.status",value:{$sum:1}}}]);
    output.push({title:"My attendance this month",kind:"donut",data:series(rows),description:"Only your own teacher attendance records are included."});
  }
  if(actor.userType === "RECEPTIONIST") {
    const rows=await Admission.aggregate([{$match:{...scope,createdAt:{$gte:start,$lte:new Date()}}},{$group:{_id:{$dateToString:{date:"$createdAt",format:"%Y-%m",timezone:"Asia/Karachi"}},value:{$sum:1}}},{$sort:{_id:1}}]);
    output.push({title:"Admission inquiries",kind:"line",data:series(rows),description:"Actual admission inquiries recorded by month."});
  }
  return {charts:output,generatedAt:new Date(),timezone:"Asia/Karachi"};
}

