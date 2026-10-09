import {School} from "../models/school.model";
import mongoose from "mongoose";
import {ExamSchedule,ExamTimetable} from "../models/exam.model";
import {SectionModel} from "../models/classSection.model";
import {Subject} from "../models/subject.model";
import {User} from "../models/user.model";
export async function saveExamTimetable(schoolId:string,input:any){
 const exam=await ExamSchedule.findOne({_id:input.examId,schoolId});
 if(!exam)throw {statusCode:404,message:"Exam not found."};
 const [section,subject,supervisor]=await Promise.all([SectionModel.findOne({_id:input.sectionId,classId:input.classId,schoolId}),Subject.findOne({_id:input.subjectId,classId:input.classId,schoolId}),input.supervisorId?User.findOne({_id:input.supervisorId,schoolId,userType:"TEACHER",status:"ACTIVE"}):Promise.resolve(true)]);
 if(!section||!subject||!supervisor||!exam.classes.includes(input.classId))throw {statusCode:400,message:"Choose an included class, its section and subject, and a teacher from this school."};
 const first=exam.startDate.toISOString().slice(0,10),last=exam.endDate.toISOString().slice(0,10);
 if(input.date<first||input.date>last)throw {statusCode:400,message:"Exam lesson must fall within the examination period."};
 const session=await mongoose.startSession();let result:any;try{await session.withTransaction(async()=>{
  await School.updateOne({_id:schoolId},{$inc:{academicRevision:1}},{session});
  const overlap:any={schoolId,date:input.date,startTime:{$lt:input.endTime},endTime:{$gt:input.startTime},$or:[{sectionId:input.sectionId},...(input.supervisorId?[{supervisorId:input.supervisorId}]:[]),...(input.room?[{room:input.room}]:[])],$nor:[{examId:input.examId,sectionId:input.sectionId,subjectId:input.subjectId}]};
  if(await ExamTimetable.exists(overlap).session(session))throw {statusCode:409,message:"This time conflicts with the class, supervisor or room schedule."};
  result=await ExamTimetable.findOneAndUpdate({schoolId,examId:input.examId,sectionId:input.sectionId,subjectId:input.subjectId},{$set:{...input,schoolId}},{new:true,upsert:true,runValidators:true,session});
 });return result;}finally{await session.endSession();}
}
export async function examTimetable(schoolId:string,examId?:string){return ExamTimetable.find({schoolId,...(examId?{examId}:{})}).populate({path:"examId",select:"title status",match:{schoolId}}).populate({path:"classId",select:"name",match:{schoolId}}).populate({path:"sectionId",select:"name",match:{schoolId}}).populate({path:"subjectId",select:"name",match:{schoolId}}).populate({path:"supervisorId",select:"name",match:{schoolId}}).sort({date:1,startTime:1}).lean();}
