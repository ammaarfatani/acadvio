import { ParentProfile } from "../models/parentProfile.model";
import { Student } from "../models/student.model";
export function audienceFor(students:any[]){
 const fields=["targetStudentIds","targetClassIds","targetSectionIds"];
 const empty={$and:fields.map(field=>({$or:[{[field]:{$exists:false}},{[field]:{$size:0}}]}))};
 return {$or:students.length?students.map(student=>({$and:[["targetStudentIds",student._id],["targetClassIds",student.classId],["targetSectionIds",student.sectionId]].map(([field,value])=>({$or:[{[field as string]:{$exists:false}},{[field as string]:{$size:0}},{[field as string]:{$in:value?[value?._id||value]:[]}}]}))})):[empty]};
}
export async function parentAudience(schoolId:string,userId:string,studentId?:string){
 if(studentId&&!/^[a-f0-9]{24}$/i.test(studentId))throw{statusCode:400,message:"Invalid child selection."};
 const profile:any=await ParentProfile.findOne({schoolId,userId}).select("studentIds").lean();
 if(studentId&&!profile?.studentIds?.some((id:any)=>String(id)===studentId))throw{statusCode:404,message:"Child not found or not linked to your account."};
 const students=profile?await Student.find({schoolId,_id:{$in:studentId?[studentId]:profile.studentIds}}).select("_id classId sectionId sectionName academicSessionId").lean():[];
 if(studentId&&students.length!==1)throw{statusCode:404,message:"Child not found or not linked to your account."};
 const {studentPlacement}=await import("./studentPlacement.service");
 return audienceFor(await Promise.all(students.map(async (s:any)=>(await studentPlacement(schoolId,s)).student)));
}
export async function teacherAudience(schoolId:string,userId:string){
 const {TeacherService}=await import("./teacher.service");
 return audienceFor(await TeacherService.getTeacherStudents(schoolId,userId));
}
