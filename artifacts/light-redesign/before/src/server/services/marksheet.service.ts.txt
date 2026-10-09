import {School} from "../models/school.model";
import {Student} from "../models/student.model";
import {Subject} from "../models/subject.model";
import {ExamSchedule,ProcessedResult,GradingScale} from "../models/exam.model";
export async function annualMarksheet(schoolId:string,studentId:string,publishedOnly=false){
 const student:any=await Student.findOne({_id:studentId,schoolId}).select("name studentId admissionNumber rollNumber classId className sectionId sectionName academicSessionId academicSessionName parentInfo.fatherName").lean();if(!student)throw {statusCode:404,message:"Student not found."};
 const school=await School.findById(schoolId).select("name logoUrl").lean();
 const scale:any=await GradingScale.findOne({schoolId}).lean();
 const grade=(pct:number|null)=>pct===null?"Pending":[...(scale?.rules||[])].sort((a:any,b:any)=>b.minPercentage-a.minPercentage).find((r:any)=>pct>=r.minPercentage)?.grade||"Not configured";
 const subjects=await Subject.find({schoolId,classId:student.classId}).select("name totalMarks").sort({name:1}).lean();
 const exams=await ExamSchedule.find({schoolId,academicSessionId:student.academicSessionId,term:{$in:["MID_TERM","FINAL_TERM"]},classes:{$in:[String(student.classId),student.className]}}).sort({startDate:-1}).lean();
 const results=await ProcessedResult.find({schoolId,studentId,examId:{$in:exams.map(e=>e._id)},...(publishedOnly?{isPublished:true}:{})}).lean();
 const forTerm=(term:string)=>{const exam=exams.find(e=>e.term===term);return {exam,result:results.find(r=>!r.needsProcessing&&String(r.examId)===String(exam?._id))};};
 const mid=forTerm("MID_TERM"),final=forTerm("FINAL_TERM");
 const termScore=(term:any,subject:any)=>{const score=term.result?.subjectScores.find((s:any)=>String(s.subjectId)===String(subject._id));return {obtained:score?.obtainedMarks??null,max:score?.maxMarks??subject.totalMarks??100,status:!term.exam?"Not scheduled":!term.result?(publishedOnly?"Result not published":"Marks pending"):!score||score.obtainedMarks===null?"Marks pending":score.isAbsent||score.grade==="ABSENT"?"Absent":"Entered"};};
 const rows=subjects.map(subject=>{const m=termScore(mid,subject),f=termScore(final,subject),complete=m.obtained!==null&&f.obtained!==null,total=complete?m.obtained!+f.obtained!:null,max=m.max+f.max;return {subjectId:subject._id,name:subject.name,mid:m,final:f,total,max,percentage:total===null?null:Number((total/max*100).toFixed(2)),grade:grade(total===null?null:total/max*100)};});
 const summary=(key:"mid"|"final")=>{const scores=rows.map(r=>r[key]),complete=scores.length>0&&scores.every(s=>s.obtained!==null),max=scores.reduce((n,s)=>n+s.max,0),obtained=complete?scores.reduce((n,s)=>n+s.obtained!,0):null;return {obtained,max,percentage:obtained===null?null:Number((obtained/max*100).toFixed(2))};};
 const midTotal=summary("mid"),finalTotal=summary("final"),complete=midTotal.obtained!==null&&finalTotal.obtained!==null,total=complete?midTotal.obtained!+finalTotal.obtained!:null,max=midTotal.max+finalTotal.max;
 return {school,student,rows,midTotal,finalTotal,overall:{obtained:total,max,grade:grade(total===null?null:total/max*100),percentage:total===null?null:Number((total/max*100).toFixed(2))},terms:{mid:mid.exam?.title,final:final.exam?.title}};
}
