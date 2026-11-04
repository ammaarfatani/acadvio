import {z} from "zod";
import {Student} from "../models/student.model";
import {ClassModel,SectionModel} from "../models/classSection.model";

const id=z.string().regex(/^[a-f0-9]{24}$/i);
export async function studentLookup(schoolId:string,query:any,parentDetails=false){
 const input=z.object({search:z.string().trim().max(100).default(""),classId:id.optional(),sectionId:id.optional(),page:z.coerce.number().int().min(1).max(100000).default(1)}).parse(query);
 const match:any={schoolId,...(input.classId?{classId:input.classId}:{}),...(input.sectionId?{sectionId:input.sectionId}:{})};
 if(input.search){const term=input.search.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");match.$or=["name","studentId","admissionNumber","rollNumber"].map(k=>({[k]:{$regex:term,$options:"i"}}));}
 const pageSize=20;const [students,total,classes,sections]=await Promise.all([Student.find(match).select("name classId className sectionId sectionName studentId admissionNumber rollNumber"+(parentDetails?" parentInfo":"")).sort({name:1,_id:1}).skip((input.page-1)*pageSize).limit(pageSize).lean(),Student.countDocuments(match),ClassModel.find({schoolId}).select("name").sort({numericLevel:1,name:1}).lean(),SectionModel.find({schoolId}).select("name classId").sort({name:1}).lean()]);
 return {students,total,classes,sections,page:input.page,pageSize};
}
