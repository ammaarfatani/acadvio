import { z } from "zod";
import mongoose from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthenticatedUser } from "../middlewares/auth.middleware";
import { branchContext } from "../utils/branchScope";
import { availableReports, fetchAuthorizedReport } from "./assistant.service";
import { portalNavigation, PortalRole } from "../../lib/portal-navigation";
import { hasFeature, routeFeature } from "../../lib/plan-features";
import { ClassModel, SectionModel } from "../models/classSection.model";
import { FeeChallan, FeePayment } from "../models/fee.model";
import { FeeCalculationService } from "./feeCalculation.service";
import { StudentAttendance } from "../models/attendance.model";
import { Student } from "../models/student.model";
import { ProcessedResult } from "../models/exam.model";
import { StudentLifecycleEvent } from "../models/studentLifecycleEvent.model";
import { children } from "./parent.service";
import { authorizeReports, reportFilters } from "./smartReports.service";
import { intelligenceDashboard, intelligenceSettings } from "./schoolIntelligence.service";

export const bridgeInput = z.object({
  tool: z.enum(["students","student_history","teachers","finance","pending_fees","attendance","examinations","my_teaching","platform","children","intelligence"]),
  classLevel: z.number().int().min(1).max(20).optional(),
  section: z.string().regex(/^[A-Za-z0-9]{1,12}$/).optional(),
  studentName: z.string().trim().min(2).max(100).optional(),
  admissionNumber: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9/-]+$/).optional(),
  studentIdentifier: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9/-]+$/).optional(),
  cursor: z.string().min(20).max(700).optional(),
  lookupMode: z.enum(["find","summary"]).optional(),
  period: z.enum(["today","month","last_month"]).default("month"),
}).strict();

export function bridgeContextFor(actor: AuthenticatedUser) {
  if (!actor.isSuperAdmin && (!actor.schoolId || !branchContext.getStore())) throw {statusCode:403,message:"A verified school and branch context is required."};
  const tools: string[] = [...availableReports(actor)];
  if(actor.userType === "SCHOOL_ADMIN" && actor.permissions?.includes("students.view")) tools.push("student_history");
  if(tools.includes("finance")) tools.push("pending_fees");
  if (actor.userType === "PARENT" && actor.permissions?.includes("children.view")) tools.push("children");
  try { authorizeReports(actor); tools.push("intelligence"); } catch { /* unavailable */ }
  const portal = portalNavigation[actor.userType as PortalRole];
  const navigation = portal ? portal.groups.flatMap(group => group.items.map(item => ({label:item.label,path:portal.root+item.path,permission:item.permission,group:group.label}))).filter(item => {
    const feature = routeFeature(item.path);
    return (!item.permission || actor.permissions?.includes(item.permission)) && (actor.isSuperAdmin || !feature || hasFeature(actor.plan,feature));
  }) : [];
  return {userId:actor.userId,schoolId:actor.schoolId || null,branchId:actor.branchId || null,role:actor.userType,tools,navigation};
}

// Pakistan civil calendar; end is exclusive. No server-local timezone dependency.
export function aiePeriod(period:string, now = new Date()) {
  const local = new Date(now.getTime()+5*3600000);
  const y=local.getUTCFullYear(), m=local.getUTCMonth(), d=local.getUTCDate();
  const civil=(year:number,month:number,day:number)=>new Date(Date.UTC(year,month,day)-5*3600000);
  return period === "today" ? {start:civil(y,m,d),end:now} : period === "last_month" ? {start:civil(y,m-1,1),end:civil(y,m,1)} : {start:civil(y,m,1),end:now};
}
function encodeStudentCursor(value:Record<string,unknown>) {
  const body=Buffer.from(JSON.stringify(value)).toString("base64url"), secret=process.env.JWT_ACCESS_SECRET;
  if(!secret)throw {statusCode:500,message:"Student pagination is temporarily unavailable."};
  const sig=createHmac("sha256",secret).update(body).digest("base64url");return `${body}.${sig}`;
}
function decodeStudentCursor(token:string,expected:Record<string,unknown>) {
  try {const [body,sig]=token.split("."),secret=process.env.JWT_ACCESS_SECRET;if(!body||!sig||!secret)throw 0;const actual=createHmac("sha256",secret).update(body).digest();const supplied=Buffer.from(sig,"base64url");if(actual.length!==supplied.length||!timingSafeEqual(actual,supplied))throw 0;const payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));if(payload.exp<Date.now()||Object.entries(expected).some(([k,v])=>payload[k]!==v)||typeof payload.name!=="string"||typeof payload.admissionNumber!=="string")throw 0;return payload;}catch{throw {statusCode:400,message:"The student search cursor is invalid or expired. Start the search again."};}
}
// Permit common Romanized spelling variants (repeated letters and vowel
// transliterations such as Muhammad/Mohammad) inside the authorized CRM query.
function studentNameRegex(value:string) {
  const normalized=value.normalize("NFKC").trim();
  const escaped=normalized.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const tolerant=/^[\p{L} .'-]+$/u.test(normalized) && /^[\x00-\x7F]*$/.test(normalized)
    ? normalized.split(/( +)/).map(part=>/^ +$/.test(part)?"\\s+":Array.from(part).map(char=>/[aeiou]/i.test(char)?"[aeiou]+":/[A-Za-z]/.test(char)?`${char}+`:char.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("")).join("")
    : escaped;
  return new RegExp(tolerant,"i");
}

export async function executeBridgeTool(actor:AuthenticatedUser, input:z.infer<typeof bridgeInput>) {
  const context=bridgeContextFor(actor);
  if (!context.tools.includes(input.tool)) throw {statusCode:403,message:"This tool is not available for your account."};
  const filtered=input.classLevel !== undefined || input.section !== undefined;
  if(filtered && !["finance","pending_fees","attendance","examinations","students","student_history"].includes(input.tool)) throw {statusCode:400,message:"Class filters are not supported for this tool."};
  if(filtered && input.tool === "students" && input.lookupMode !== "find") throw {statusCode:400,message:"Class filters for student records require find mode."};
  if((input.studentName || input.studentIdentifier || input.admissionNumber || input.lookupMode === "find" || input.tool === "students" && filtered) && !["students","student_history"].includes(input.tool)) throw {statusCode:400,message:"Student search filters require the student capability."};
  if((input.studentName||input.admissionNumber||input.studentIdentifier||input.cursor) && input.lookupMode !== "find" && input.tool !== "student_history") throw {statusCode:400,message:"Student search requires find mode."};
  if(input.section && !input.classLevel) throw {statusCode:400,message:"Specify a class before a section."};
    if(input.section && input.tool === "examinations") throw {statusCode:400,message:"Published results do not store section identity. Use a class filter."};
  const scope:any={schoolId:actor.schoolId ? new mongoose.Types.ObjectId(actor.schoolId) : undefined};
  if(input.classLevel) {
    const classes=await ClassModel.find({schoolId:actor.schoolId,numericLevel:input.classLevel}).select("_id name").limit(3).maxTimeMS(5000).lean();
    if(classes.length!==1) throw {statusCode:422,message:classes.length ? "More than one class matches. Select a branch or use the portal class selector." : "No authorized class matches that level."};
    scope.classId=classes[0]._id;
    if(input.section) {
      const sections=await SectionModel.find({schoolId:actor.schoolId,classId:scope.classId,name:{$regex:`^(?:Section )?${input.section}$`,$options:"i"}}).select("_id name").limit(2).maxTimeMS(5000).lean();
      if(sections.length!==1) throw {statusCode:422,message:"Section is missing or ambiguous. Use its exact portal label."};
      // Challans have sectionName, not sectionId.
      if(["finance","pending_fees"].includes(input.tool)) scope.sectionName=sections[0].name; else scope.sectionId=sections[0]._id;
    }
  }
  const {start,end}=aiePeriod(input.period);
  const aggregate=(model:any,pipeline:any[])=>model.aggregate(pipeline).option({maxTimeMS:8000});
  if(input.tool === "students" && input.lookupMode === "find") {
    if(!input.studentName&&!input.admissionNumber&&!input.studentIdentifier&&!input.classLevel) return {kind:"student_search",students:[],totalMatches:0,matchCount:0,needsName:true,note:"Ask the user for a student name before searching."};
    const namePattern=input.studentName?studentNameRegex(input.studentName):undefined;
    const identifier=input.studentIdentifier||input.admissionNumber;
    const exact=identifier?new RegExp(`^${identifier.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")}$`,"i"):undefined;
    const filter:any={...scope,...(identifier?{$or:[{rollNumber:exact},{admissionNumber:exact},{studentId:exact}]}:{}),...(namePattern?{$or:[...(identifier?[{rollNumber:exact},{admissionNumber:exact},{studentId:exact}]:[]),{name:{$regex:namePattern}},{nameUrdu:{$regex:namePattern}}]}:{})};
    const totalMatches=await Student.countDocuments(filter).maxTimeMS(8000);
    const pageSize=25;
    const cursorScope={schoolId:String(actor.schoolId),branchId:String(actor.branchId||""),filter:JSON.stringify([input.studentName?.normalize("NFKC").trim().toLowerCase()||"",identifier?.toLowerCase()||"",input.classLevel||null,input.section?.toLowerCase()||""])};
    const after=input.cursor?decodeStudentCursor(input.cursor,cursorScope):undefined;
    if(after) filter.$and=[...(filter.$and||[]),{$or:[{name:{$gt:after.name}},{name:after.name,admissionNumber:{$gt:after.admissionNumber}}]}];
    const matches=await Student.find(filter).select("name studentId admissionNumber rollNumber className sectionName status academicSessionName admissionDate")
      .sort({name:1,admissionNumber:1}).limit(pageSize+1).maxTimeMS(8000).lean();
    const hasMore=matches.length>pageSize, page=matches.slice(0,pageSize), last=page[page.length-1];
    const nextCursor=hasMore&&last?encodeStudentCursor({...cursorScope,name:last.name,admissionNumber:last.admissionNumber,exp:Date.now()+15*60*1000}):undefined;
    return {kind:"student_search",students:page.map((student:any)=>({name:student.name,studentCode:student.studentId,admissionNumber:student.admissionNumber,rollNumber:student.rollNumber,className:student.className,sectionName:student.sectionName||null,status:student.status,academicSessionName:student.academicSessionName||null,admissionDate:student.admissionDate||null})),totalMatches,matchCount:totalMatches,hasMore,nextCursor,note:"Search covers all matching authorized records, including historical statuses. Results are returned 25 at a time."};
  }
  if(input.tool === "student_history") {
    if(actor.userType!=="SCHOOL_ADMIN" || !actor.permissions?.includes("students.view")) throw {statusCode:403,message:"Student history is not available for this account."};
    const identifier=input.studentIdentifier||input.admissionNumber;
    const namePattern=input.studentName?studentNameRegex(input.studentName):undefined;
    const safeIdentifier=identifier?.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const filter:any={...scope,...(identifier?{$or:[{rollNumber:new RegExp(`^${safeIdentifier}$`,"i")},{admissionNumber:new RegExp(`^${safeIdentifier}$`,"i")},{studentId:new RegExp(`^${safeIdentifier}$`,"i")}]}:{}),...(namePattern?{$or:[...(identifier?[{rollNumber:new RegExp(`^${safeIdentifier}$`,"i")},{admissionNumber:new RegExp(`^${safeIdentifier}$`,"i")},{studentId:new RegExp(`^${safeIdentifier}$`,"i")}]:[]),{name:{$regex:namePattern}},{nameUrdu:{$regex:namePattern}}]}:{})};
    const matches=await Student.find(filter).select("_id name studentId admissionNumber rollNumber className sectionName status academicSessionName admissionDate").limit(2).maxTimeMS(8000).lean();
    if(matches.length!==1) return {kind:"student_search",students:matches.map((s:any)=>({name:s.name,studentCode:s.studentId,admissionNumber:s.admissionNumber,rollNumber:s.rollNumber,className:s.className,sectionName:s.sectionName,status:s.status})),totalMatches:matches.length,needsName:matches.length===0,ambiguous:matches.length>1,note:matches.length>1?"Several students match; refine the name or use an exact identifier.":"No authorized student matches this history request."};
    const s:any=matches[0], sid=String(s._id);
    const attendanceAllowed=actor.permissions?.includes("attendance.view")===true;
    const resultsAllowed=actor.permissions?.includes("results.view")===true&&hasFeature(actor.plan,"EXAMINATIONS");
    const [attendanceDocs,results,lifecycle,feeDocs,payments]=await Promise.all([
      attendanceAllowed?StudentAttendance.find({...scope,"records.studentId":s._id}).select("date className sectionName records").sort({date:-1}).limit(100).maxTimeMS(8000).lean():[],
      resultsAllowed?ProcessedResult.find({...scope,studentId:s._id,isPublished:true,needsProcessing:{$ne:true}}).select("examTitle className percentage status grade publishedAt createdAt").sort({publishedAt:-1}).limit(100).maxTimeMS(8000).lean():[],
      StudentLifecycleEvent.find({...scope,studentId:s._id}).select("eventType description createdAt metadata").sort({createdAt:-1}).limit(100).maxTimeMS(8000).lean(),
      actor.permissions?.includes("fees.view")?FeeChallan.find({...scope,studentId:s._id,isVoided:{$ne:true},status:{$ne:"VOIDED"}}).select("challanNumber totalAmountPKR paidAmountPKR remainingAmountPKR dueDate status feeBreakdown").sort({createdAt:-1}).limit(50).maxTimeMS(8000).lean():[],
      actor.permissions?.includes("fees.view")?FeePayment.find({...scope,studentId:s._id}).select("amountPKR paidAt paymentMethod receiptNumber").sort({paidAt:-1}).limit(50).maxTimeMS(8000).lean():[],
    ]);
    const attendance=attendanceAllowed?attendanceDocs.map((doc:any)=>{const r=doc.records.find((x:any)=>String(x.studentId)===sid);return r?{date:doc.date,className:doc.className,sectionName:doc.sectionName,status:r.status}:null;}).filter(Boolean):undefined;
    return {kind:"student_history",profile:{name:s.name,studentCode:s.studentId,admissionNumber:s.admissionNumber,rollNumber:s.rollNumber,className:s.className,sectionName:s.sectionName,academicSessionName:s.academicSessionName,status:s.status,admissionDate:s.admissionDate},enrollmentHistory:lifecycle,attendance:attendanceAllowed?{records:attendance,totalReturned:attendance?.length||0}:undefined,feeHistory:actor.permissions?.includes("fees.view")?{invoices:feeDocs,payments,totalOutstanding:feeDocs.reduce((n:number,x:any)=>n+Number(x.remainingAmountPKR||0),0)}:undefined,examResults:resultsAllowed?results:undefined,unavailable:[...(!attendanceAllowed?["Attendance: your account lacks attendance.view."]:[]),...(!actor.permissions?.includes("fees.view")?["Fees and payments: your account lacks fees.view."]:[]),...(!resultsAllowed?["Examination results: your account lacks results.view or the examinations feature."]:[]),"Certificates: not connected to this assistant tool."]};
  }
  if(input.tool === "pending_fees") {
    const evaluatedAt=new Date();
    const invoices=await FeeChallan.find({...scope,isVoided:{$ne:true},status:{$ne:"VOIDED"},remainingAmountPKR:{$gt:0}})
      .select("className sectionName remainingAmountPKR totalAmountPKR paidAmountPKR status dueDate earlyPaymentDeadline earlyPaymentDiscount earlyDiscountAppliedAt lateFineWaivedAt lateFineWaived lateFinePolicyModel lateFeeFinePolicy lateFineStages lateFeePolicyAmount amountPayableAfterDueDate feeBreakdown.lateFeeFine")
      .limit(10001).maxTimeMS(8000).lean();
    if(invoices.length>10000)throw {statusCode:413,message:"More than 10,000 outstanding invoices match. Select a class, section or branch."};
    const grouped=new Map<string,{class:string;section:string;outstanding:number;storedBalance:number;challans:number}>();
    for(const invoice of invoices) {
      if(!invoice.dueDate || !Number.isFinite(new Date(invoice.dueDate).getTime()))throw {statusCode:422,message:"A matching invoice has no valid due date. Review invoice dates in the finance portal before calculating current payable fees."};
      const key=JSON.stringify([invoice.className,invoice.sectionName]);
      const row=grouped.get(key)||{class:invoice.className||"Unspecified",section:invoice.sectionName||"Unspecified",outstanding:0,storedBalance:0,challans:0};
      row.outstanding+=FeeCalculationService.evaluateCurrentPayable(invoice,evaluatedAt).payableAmount;
      row.storedBalance+=Number(invoice.remainingAmountPKR||0);row.challans++;grouped.set(key,row);
    }
    const rows=[...grouped.values()].sort((a,b)=>a.class.localeCompare(b.class)||a.section.localeCompare(b.section)).map(row=>({...row,outstanding:Math.round(row.outstanding*100)/100,storedBalance:Math.round(row.storedBalance*100)/100}));
    return {currency:"PKR",rows:rows.slice(0,100),totalGroups:rows.length,totalPayable:Math.round(rows.reduce((sum,row)=>sum+row.outstanding,0)*100)/100,evaluatedAt,note:"Current payable amounts use the existing fee calculator, including applicable early discounts and late fines. Stored balances are shown separately. Up to 100 groups are displayed; totalPayable covers every matched invoice. No historical balance is inferred."};
  }
  if(input.tool === "finance") {
    // Collection records do not safely support class/section filters here.
    const paymentStages:any[]=[{$match:{schoolId:scope.schoolId,paidAt:{$gte:start,$lt:end}}}];
    if(filtered) throw {statusCode:422,message:"Use pending fees for class filters through the portal. Collection records cannot safely apply this class/section filter."};
    const [balances,collections]=await Promise.all([
      aggregate(FeeChallan,[{$match:{...scope,isVoided:{$ne:true},status:{$ne:"VOIDED"}}},{$group:{_id:null,billed:{$sum:"$totalAmountPKR"},paid:{$sum:"$paidAmountPKR"},outstanding:{$sum:"$remainingAmountPKR"},invoices:{$sum:1}}}]),
      aggregate(FeePayment,[...paymentStages,{$group:{_id:null,collected:{$sum:"$amountPKR"},payments:{$sum:1}}}]),
    ]);
    return {currency:"PKR",balances:balances[0]||null,collection:collections[0]||null,period:{start,end},note:"Balances are stored ledger amounts across non-voided invoices. Use pending fees for current payable amounts including applicable discounts/fines. Collections are dated ledger entries, not bank reconciliation. No records is not evidence of complete reporting."};
  }
  if(input.tool === "attendance") return {rows:await aggregate(StudentAttendance,[{$match:{...scope,date:{$gte:start,$lt:end}}},{$unwind:"$records"},{$group:{_id:"$records.status",count:{$sum:1}}}]),period:{start,end},note:"Recorded entries only. PRESENT and LATE count as attended; missing registers are not absences."};
  if(input.tool === "examinations") return {rows:await aggregate(ProcessedResult,[{$match:{...scope,isPublished:true,needsProcessing:{$ne:true},status:{$ne:"PENDING"},percentage:{$type:"number"}}},{$group:{_id:{examId:"$examId",exam:"$examTitle",class:"$className"},average:{$avg:"$percentage"},count:{$sum:1},failed:{$sum:{$cond:[{$eq:["$status","FAILED"]},1,0]}}}},{$sort:{"_id.examId":1}},{$limit:50}]),note:"Up to 50 published exam/class groups, all publication dates. Different exams are not assumed comparable."};
  if(input.tool === "children") return {children:(await children(actor)).map((c:any)=>({name:c.name,className:c.className,sectionName:c.sectionName,status:c.status})),note:"Only children explicitly linked to this authenticated parent."};
  if(input.tool === "intelligence") {
    authorizeReports(actor);
    const date=(d:Date)=>new Date(d.getTime()+5*3600000).toISOString().slice(0,10);
    const {aiAvailable: _legacyProviderAvailable,...dashboard}=await intelligenceDashboard(actor,reportFilters.parse({from:date(start),to:date(new Date(end.getTime()-1))}),intelligenceSettings.parse({}));
    return dashboard;
  }
  return fetchAuthorizedReport(actor,{report:input.tool as any});
}
