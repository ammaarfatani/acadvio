import { z } from "zod";
import mongoose from "mongoose";
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
import { children } from "./parent.service";
import { authorizeReports, reportFilters } from "./smartReports.service";
import { intelligenceDashboard, intelligenceSettings } from "./schoolIntelligence.service";

export const bridgeInput = z.object({
  tool: z.enum(["students","teachers","finance","pending_fees","attendance","examinations","my_teaching","platform","children","intelligence"]),
  classLevel: z.number().int().min(1).max(20).optional(),
  section: z.string().regex(/^[A-Za-z0-9]{1,12}$/).optional(),
  studentName: z.string().trim().min(2).max(100).optional(),
  admissionNumber: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9/-]+$/).optional(),
  lookupMode: z.enum(["find","summary"]).optional(),
  period: z.enum(["today","month","last_month"]).default("month"),
}).strict();

export function bridgeContextFor(actor: AuthenticatedUser) {
  if (!actor.isSuperAdmin && (!actor.schoolId || !branchContext.getStore())) throw {statusCode:403,message:"A verified school and branch context is required."};
  const tools: string[] = [...availableReports(actor)];
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

export async function executeBridgeTool(actor:AuthenticatedUser, input:z.infer<typeof bridgeInput>) {
  const context=bridgeContextFor(actor);
  if (!context.tools.includes(input.tool)) throw {statusCode:403,message:"This tool is not available for your account."};
  const filtered=input.classLevel !== undefined || input.section !== undefined;
  if(filtered && !["finance","pending_fees","attendance","examinations","students"].includes(input.tool)) throw {statusCode:400,message:"Class filters are not supported for this tool."};
  if(filtered && input.tool === "students" && input.lookupMode !== "find") throw {statusCode:400,message:"Class filters for student records require find mode."};
  if((input.studentName || input.lookupMode === "find" || input.tool === "students" && filtered) && input.tool !== "students") throw {statusCode:400,message:"Student search filters require the student capability."};
  if((input.studentName||input.admissionNumber) && input.lookupMode !== "find") throw {statusCode:400,message:"Student search requires find mode."};
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
    if(!input.studentName&&!input.admissionNumber&&!input.classLevel) return {kind:"student_search",students:[],matchCount:0,needsName:true,note:"Ask the user for a student name before searching."};
    const escaped=input.studentName?.normalize("NFKC").trim().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const matches=await Student.find({...scope,status:{$ne:"ARCHIVED"},...(input.admissionNumber?{admissionNumber:input.admissionNumber}:{}),...(escaped?{$or:[{name:{$regex:escaped,$options:"i"}},{nameUrdu:{$regex:escaped,$options:"i"}}]}:{})})
      .select("name admissionNumber className sectionName status")
      .sort({name:1,admissionNumber:1}).limit(11).maxTimeMS(8000).lean();
    return {kind:"student_search",students:matches.slice(0,10).map((student:any)=>({name:student.name,admissionNumber:student.admissionNumber,className:student.className,sectionName:student.sectionName||null,status:student.status})),matchCount:matches.length>10?">10":matches.length,hasMore:matches.length>10,note:"Search results are limited to 10 authorized, non-archived students. Use the student directory for additional results."};
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
