import {hydrateDocumentPhoto} from "./schoolDocument.service";
import {defaultDocumentStyle} from "../../lib/document-templates";
import {TeachingAssignment} from "../models/teacherProfile.model";
import {annualMarksheet} from "./marksheet.service";
import mongoose from "mongoose";
import { ParentProfile } from "../models/parentProfile.model";
import { Student } from "../models/student.model";
import { StudentAttendance } from "../models/attendance.model";
import { Subject, TimetableSlot } from "../models/subject.model";
import { SchoolService } from "./school.service";
import { FeeSubmission } from "../models/feeSubmission.model";
import { FeeChallan, FeePayment, FeeStructure } from "../models/fee.model";
import { ClassModel } from "../models/classSection.model";
import { studentPlacement } from "./studentPlacement.service";
import { ProcessedResult, ExamSchedule, ExamTimetable, CertificateRecord } from "../models/exam.model";
import { UserService } from "./user.service";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { hasFeature } from "../../lib/plan-features";
export async function children(actor: AuthenticatedUser) {
  const profile = await ParentProfile.findOne({ schoolId: actor.schoolId, userId: actor.userId });
  return profile ? Student.find({ schoolId: actor.schoolId, _id: { $in: profile.studentIds } }).select("name className sectionName rollNumber status photoUrl updatedAt").lean() : [];
}
export async function linkedChild(actor: AuthenticatedUser,id:string){
 const profile=await ParentProfile.findOne({schoolId:actor.schoolId,userId:actor.userId,studentIds:id});
 const student=profile&&await Student.findOne({_id:id,schoolId:actor.schoolId}).select("name dob gender photoUrl admissionNumber admissionDate classId sectionId className sectionName academicSessionId academicSessionName rollNumber status address phone").lean();
 if(!student)throw{statusCode:404,message:"Child not found or not linked to your account."};return student;
}
export async function childDetails(actor: AuthenticatedUser, id: string) {
 const placement=await studentPlacement(actor.schoolId!,await linkedChild(actor,id)); const student=placement.student;const finance=hasFeature(actor.plan,"FINANCE"),exams=hasFeature(actor.plan,"EXAMINATIONS");
 const [attendance,fees,results,payments,structures,submissions,subjects,timetable,profile,classInfo,examSchedules]=await Promise.all([
 StudentAttendance.find({schoolId:actor.schoolId,"records.studentId":id}).sort({date:-1,updatedAt:-1}).select({date:1,records:{$elemMatch:{studentId:new mongoose.Types.ObjectId(id)}}}).lean(),
 finance?FeeChallan.find({schoolId:actor.schoolId,studentId:id,isVoided:{$ne:true}}).sort({createdAt:-1}).lean():[],
 exams?ProcessedResult.find({schoolId:actor.schoolId,studentId:id,isPublished:true}).select("examTitle subjectScores totalMaxMarks totalObtainedMarks percentage overallGrade status publishedAt rank attendancePercentage teacherRemarks").sort({publishedAt:-1}).lean():[],
 finance?FeePayment.find({schoolId:actor.schoolId,studentId:id}).sort({paidAt:-1}).lean():[],
 finance?FeeStructure.find({schoolId:actor.schoolId,classId:student.classId,...(student.sectionId?{$or:[{sectionId:student.sectionId},{sectionId:null}]}:{sectionId:null})}).lean():[],
 finance?FeeSubmission.find({schoolId:actor.schoolId,studentId:id,parentId:actor.userId}).sort({submittedAt:-1}).lean():[],
 Subject.find({schoolId:actor.schoolId,classId:student.classId}).select("name code type teacherId teacherName totalMarks passingMarks").populate({path:"teacherId",select:"name",match:{schoolId:actor.schoolId}}).lean(),
 TimetableSlot.find({schoolId:actor.schoolId,classId:student.classId,...(student.sectionId?{$or:[{sectionId:student.sectionId},{sectionId:null}]}:{sectionId:null}),...(student.academicSessionId?{$and:[{$or:[{academicSessionId:student.academicSessionId},{academicSessionId:null}]}]}:{academicSessionId:null})}).select("academicSessionId sectionId dayOfWeek periodNumber startTime endTime subjectId subjectName teacherId teacherName roomNumber").sort({dayOfWeek:1,periodNumber:1}).populate({path:"teacherId",select:"name",match:{schoolId:actor.schoolId}}).populate({path:"subjectId",select:"name",match:{schoolId:actor.schoolId}}).lean(),
 finance?SchoolService.getSchoolProfile(actor.schoolId!):null,
 ClassModel.findOne({_id:student.classId,schoolId:actor.schoolId}).select("name classTeacherName").lean(),
 exams?ExamSchedule.find({schoolId:actor.schoolId,classes:{$in:[String(student.classId),student.className]},status:{$in:["SCHEDULED","IN_PROGRESS","PROCESSED","PUBLISHED"]}}).select("title subjects startDate endDate status academicSessionName").sort({startDate:-1}).lean():[]
 ]);
 const days=new Map<string,any>();
 for(const a of attendance as any[]){const dateKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi"}).format(new Date(a.date));if(!days.has(dateKey))days.set(dateKey,{date:a.date,...a.records.find((r:any)=>String(r.studentId)===id)});}
 const history=[...days.values()];
 const bySlot=new Map<string,any>();
 for(const slot of timetable as any[]){const key=slot.dayOfWeek+":"+slot.periodNumber;const previous=bySlot.get(key);const priority=(s:any)=>(s.sectionId?2:0)+(s.academicSessionId?1:0);if(!previous||priority(slot)>priority(previous))bySlot.set(key,{...slot,subjectName:slot.subjectId?.name||slot.subjectName,teacherName:slot.teacherId?.name||slot.teacherName});}
 const duties:any[]=student.sectionId?await TeachingAssignment.find({schoolId:actor.schoolId,classId:student.classId,sectionId:student.sectionId,academicSessionId:student.academicSessionId,status:"ACTIVE"}).select("subjectId teacherUserId").populate({path:"teacherUserId",select:"name",match:{schoolId:actor.schoolId,status:"ACTIVE"}}).lean():[];
 const subjectTeachers=(subject:any)=>Array.from(new Set(duties.filter(d=>String(d.subjectId)===String(subject._id)&&d.teacherUserId?.name).map(d=>d.teacherUserId.name))).join(" / ")||subject.teacherId?.name||subject.teacherName;
 const bank=profile?.bankDetails;
 const examIds=(examSchedules as any[]).map(e=>e._id);
 const examTimetable=exams&&student.sectionId?await ExamTimetable.find({schoolId:actor.schoolId,examId:{$in:examIds},classId:student.classId,sectionId:student.sectionId}).populate({path:"subjectId",select:"name",match:{schoolId:actor.schoolId}}).sort({date:1,startTime:1}).lean():[];
 const certificates=exams?await CertificateRecord.find({schoolId:actor.schoolId,studentId:id}).select("certificateNumber type studentName admissionNumber rollNumber session issueDate className conductRemarks reason documentSnapshot").sort({issueDate:-1}).lean():[];
 for(const certificate of certificates as any[])if(certificate.documentSnapshot)certificate.documentSnapshot=await hydrateDocumentPhoto(certificate.documentSnapshot);
 const marksheet=exams?await annualMarksheet(actor.schoolId!,id,true):null;
 return{documentBranding:profile?{name:profile.name,address:profile.address,phone:profile.phone,email:profile.email,logoUrl:profile.logoUrl,...profile.documentSettings?.branding}:null,documentStyles:profile?Object.fromEntries(["report-card","fee-receipt","character","leaving","bonafide","transfer"].map(type=>[type,profile.documentSettings?.templates?.[type]||defaultDocumentStyle(type as any)])):null,student,classInfo,marksheet,placementWarning:placement.placementWarning,certificates,examTimetable,examSchedules:examSchedules.map((e:any)=>({...e,subjects:subjects.map((s:any)=>s.name)})),attendance:history,attendanceSummary:{total:history.length,present:history.filter((a:any)=>["PRESENT","LATE"].includes(a.status)).length},fees,results,payments:payments.map((p:any)=>({...p,reference:(submissions as any[]).find(s=>String(s.paymentId)===String(p._id))?.reference||null})),structures,submissions,subjects:subjects.map((s:any)=>({...s,teacherName:subjectTeachers(s)})),timetable:[...bySlot.values()].sort((a:any,b:any)=>["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].indexOf(a.dayOfWeek)-["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].indexOf(b.dayOfWeek)||a.periodNumber-b.periodNumber),bankDetails:bank?.enabled&&bank.bankName?.trim()&&bank.accountTitle?.trim()&&bank.accountNumber?.trim()?bank:null};
}
export async function createParent(schoolId: string, input: any) {
  const ids = [...new Set(input.studentIds)];
  if (await Student.countDocuments({ schoolId, _id: { $in: ids } }) !== ids.length) throw { statusCode: 403, message: "Children must belong to your selected branch." };
  // Account creation and child linking commit together, including duplicate-email protection.
  const session = await mongoose.startSession(); let result: any;
  try { await session.withTransaction(async () => { result = await UserService.createStaffUser(schoolId, { ...input, userType: "PARENT" }, session); await ParentProfile.create([{ schoolId, userId: result.id, studentIds: ids }], { session }); }); return result; } finally { await session.endSession(); }
}
