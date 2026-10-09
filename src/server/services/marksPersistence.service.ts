import mongoose from "mongoose";
import {School} from "../models/school.model";
import {MarksEntry,ProcessedResult} from "../models/exam.model";
// Serialize academic writes across sections; never replace another section's marks.
export async function persistMarks(schoolId:string, metadata:any, records:any[], replaceStudentIds?:string[]){
 const session=await mongoose.startSession();let result:any;
 try{await session.withTransaction(async()=>{
  await School.updateOne({_id:schoolId},{$inc:{academicRevision:1}},{session});
  const key={schoolId,examId:metadata.examId,classId:metadata.classId,subjectId:metadata.subjectId};
  const previous=await MarksEntry.findOne(key).session(session);
  const replaced=new Set((replaceStudentIds||records.map(r=>String(r.studentId))).map(String));
  const merged=[...(previous?.records||[]).filter((r:any)=>!replaced.has(String(r.studentId))),...records];
  result=await MarksEntry.findOneAndUpdate(key,{$set:{...metadata,schoolId,records:merged}},{new:true,upsert:true,runValidators:true,session});
  // Changed marks must be processed and explicitly published again.
  const affected=previous&&previous.maxMarks!==metadata.maxMarks?{}:{studentId:{$in:[...replaced]}};
  await ProcessedResult.updateMany({schoolId,examId:metadata.examId,classId:metadata.classId,...affected},{$set:{isPublished:false,needsProcessing:true,status:"PENDING",percentage:null,overallGrade:"Pending"},$unset:{rank:1}},{session});
 });return result;}finally{await session.endSession();}
}
