from pathlib import Path
p=Path('src/server/services/smartReports.service.ts');s=p.read_text(encoding='utf-8');s='import {reportColumnLabel,reportPathValue,readableReportValue} from "../../lib/report-presentation";\n'+s
# Add useful human context without invalidating existing saved column selections.
pos=s.index('export const reportFilters')
s=s[:pos]+'''for(const [key,columns] of Object.entries({assignments:["employeeNumber","academicSessionName"],employment:["staffName"],staffAttendance:["employeeNumber","designation","department"],timetable:["className","sectionName","academicSessionName"],students:["academicSessionName"],payroll:["employeeNumber"]}))for(const c of columns)if(!reportDefinitions[key].columns.includes(c))reportDefinitions[key].columns.push(c);
'''+s[pos:]
s=s.replace('      columns: v.columns,','      columns: v.columns,\n      columnLabels:Object.fromEntries(v.columns.map(c=>[c,reportColumnLabel(key,c)])),')
# Scoped, bounded, batched relationship resolution shared by preview and download.
pos=s.index('export async function reportRows(')
helper='''type ReportRelation={source:string;target:string;kind:string;value?:string;replace?:boolean};
const relationshipModels:any={student:Student,user:User,class:ClassModel,section:SectionModel,subject:Subject,session:AcademicSession,exam:ExamSchedule,employment:StaffEmployment};
function reportRelations(key:string):ReportRelation[]{
 const rel=(source:string,target:string,kind:string,value="name",replace=false)=>({source,target,kind,value,replace});
 const placement=[rel("classId","className","class"),rel("sectionId","sectionName","section"),rel("academicSessionId","academicSessionName","session")];
 const staff=(source:string)=>[rel(source,"employeeNumber","employment","employeeId"),rel(source,"designation","employment","designation"),rel(source,"department","employment","department")];
 const map:Record<string,ReportRelation[]>={
 assignments:[rel("teacherUserId","teacherUserId","user","name",true),rel("classId","classId","class","name",true),rel("sectionId","sectionId","section","name",true),rel("subjectId","subjectId","subject","name",true),rel("academicSessionId","academicSessionName","session"),...staff("teacherUserId")],
 issuedDocuments:[rel("studentId","studentId","student","name",true)],
 staffAttendance:[rel("employeeId","employeeId","user","name",true),...staff("employeeId")],
 payroll:[rel("employeeId","employeeId","user","name",true),rel("employeeId","snapshot.employee.name","user"),...staff("employeeId")],
 employment:[rel("userId","staffName","user")],
 staff:[rel("_id","employeeId","employment","employeeId")],
 classes:[rel("classTeacherId","classTeacherName","user")],
 sections:placement,students:placement,guardians:placement,
 subjects:[...placement,rel("teacherId","teacherName","user")],
 timetable:[...placement,rel("subjectId","subjectName","subject"),rel("teacherId","teacherName","user")],
 exams:[rel("academicSessionId","academicSessionName","session")],
 leave:[rel("teacherId","teacherName","user"),rel("teacherId","employeeId","employment","employeeId")],
 attendance:[...placement,rel("records.studentId","records.studentName","student")],
 legacyTeacherAttendance:[rel("records.teacherUserId","records.teacherName","user")],
 collections:[rel("studentId","studentName","student"),rel("collectedByUserId","collectedByUserName","user"),...placement],
 invoices:[rel("studentId","studentName","student"),...placement],
 results:[...placement,rel("studentId","studentName","student"),rel("examId","examTitle","exam","title")],
 subjectResults:[...placement,rel("studentId","studentName","student"),rel("examId","examTitle","exam","title"),rel("subjectScores.subjectId","subjectScores.subjectName","subject")],
 admissions:[rel("applyingClassId","applyingClassName","class"),rel("academicSessionId","academicSessionName","session")]
 };
 return map[key]||[];
}
function setReportPath(row:any,path:string,value:any){const parts=path.split('.');let at=row;for(const key of parts.slice(0,-1))at=at[key]||(at[key]={});at[parts.at(-1)!]=value;}
async function resolveReportRelations(actor:AuthenticatedUser,key:string,columns:string[],rows:any[]){
 const relations=reportRelations(key).filter(r=>columns.includes(r.target));
 const sources=rows.map(row=>relations.map(r=>String(reportPathValue(row,r.source)||"")));
 const groups:Record<string,Set<string>>={};relations.forEach((r,i)=>{for(const [j,row] of rows.entries()){const value=reportPathValue(row,r.target);if(!r.replace&&value!==undefined&&value!==null&&value!=="")continue;const id=sources[j][i];if(/^[a-f0-9]{24}$/i.test(id))(groups[r.kind]||=(new Set())).add(id);}});
 const lookups:Record<string,Map<string,any>>={};
 await Promise.all(Object.entries(groups).map(async([kind,ids])=>{const lookupKey=kind==="employment"?"userId":"_id";const docs=await relationshipModels[kind].find({schoolId:actor.schoolId,[lookupKey]:{$in:[...ids]},...(kind==="user"?{userType:{$nin:["PARENT","SUPER_ADMIN"]}}:{})}).select("name title employeeId admissionNumber studentId userId designation department").lean();lookups[kind]=new Map(docs.map((d:any)=>[String(d[lookupKey]),d]));}));
 return rows.map((row,j)=>{relations.forEach((r,i)=>{const current=reportPathValue(row,r.target);if(!r.replace&&current!==undefined&&current!==null&&current!=="")return;const doc=lookups[r.kind]?.get(sources[j][i]);setReportPath(row,r.target,doc?.[r.value||"name"]||(r.replace&&current?"Related record unavailable":""));});const out:any={};for(const c of columns)setReportPath(out,c,reportPathValue(row,c));return out;});
}
'''
s=s[:pos]+helper+s[pos:]
s=s.replace('  const projection = Object.fromEntries(selection.columns.map((c) => [c, 1]));','''  const projection = Object.fromEntries([...selection.columns,...reportRelations(selection.report).filter(r=>selection.columns.includes(r.target)).map(r=>r.source)].map(c=>[c,1]));''')
s=s.replace('{ $project: { ...projection, _id: 0 } }','{ $project: { ...projection, _id: projection._id?1:0 } }')
s=s.replace('    rows: result.rows,','    rows: await resolveReportRelations(actor,selection.report,selection.columns,result.rows),\n    columnLabels:Object.fromEntries(selection.columns.map(c=>[c,reportColumnLabel(selection.report,c)])),')
a=s.index('export function cellValue(');b=s.index('export function safeSpreadsheet',a);s=s[:a]+'''export function cellValue(row:any,path:string):string|number{return readableReportValue(reportPathValue(row,path),path);}
'''+s[b:]
s=s.replace('report.columns.map(quote).join(",")','report.columns.map(c=>quote(reportColumnLabel(report.report,c))).join(",")')
p.write_text(s,encoding='utf-8')
p=Path('src/server/services/reportExport.service.ts');s=p.read_text(encoding='utf-8');s='import {reportColumnLabel} from "../../lib/report-presentation";\n'+s;s=s.replace('      report.columns,','      report.columns.map(c=>reportColumnLabel(report.report,c)),',1);s=s.replace('Math.max(18, c.length + 3)','Math.max(18, reportColumnLabel(report.report,c).length + 3)');s=s.replace('.text(c, margin + 6 + i * columnWidth', '.text(reportColumnLabel(report.report,c), margin + 6 + i * columnWidth');p.write_text(s,encoding='utf-8')
p=Path('src/components/SchoolReportCenter.tsx');s=p.read_text(encoding='utf-8');s=s.replace('import DataChart', 'import {reportColumnLabel,reportFilterLabel,displayReportCell} from "@/lib/report-presentation";\nimport DataChart');s=s.replace('{label(c)}','{reportColumnLabel(report.key||report.report,c)}');s=s.replace('''{String(
                                c.split(".").reduce((v, k) => v?.[k], row) ?? "—",
                              )}''','{displayReportCell(row,c)}');s=s.replace('{label(f)}','{reportFilterLabel(f)}');p.write_text(s,encoding='utf-8')
