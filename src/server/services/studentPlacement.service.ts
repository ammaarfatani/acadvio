import { ClassModel, SectionModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
// Resolve incomplete legacy records only where one authoritative match exists.
// This is read-only; ambiguous sections never expand a parent's audience.
export async function studentPlacement(schoolId: string, student: any) {
 const classInfo = student.classId ? await ClassModel.findOne({_id:student.classId,schoolId}).select("name classTeacherName").lean() : null;
 let section: any = null;
 if (classInfo) {
  if(student.sectionId) section=await SectionModel.findOne({_id:student.sectionId,classId:student.classId,schoolId}).lean();
  else { const matches=await SectionModel.find({schoolId,classId:student.classId,...(student.sectionName?{name:student.sectionName}:{})}).limit(2).lean(); if(matches.length===1)section=matches[0]; }
 }
 const session:any=student.academicSessionId?await AcademicSession.findOne({_id:student.academicSessionId,schoolId}).select("name").lean():await AcademicSession.findOne({schoolId,isCurrent:true}).select("name").lean();
 return {classInfo,student:{...student,className:(classInfo as any)?.name||student.className,sectionId:section?._id,sectionName:section?.name,academicSessionId:session?._id,academicSessionName:(session as any)?.name||student.academicSessionName},placementWarning:!section?"Your school has not assigned an unambiguous section. Section-specific records are hidden until the school updates this placement.":null};
}
