import {normalizeCardImage} from "./identityCardRender.service";
import {createHash} from "node:crypto";

import {z} from "zod";

import {PayrollRecord,SalaryPayment} from "../models/workforce.model";

import {TeacherNotification} from "../models/teacherNotification.model";

import {transaction,employee,audit} from "./workforce.service";

import {decodePaymentImage} from "./paymentImage";

import {money} from "./workforceMath";

export const salaryPaymentInput=z.object({requestId:z.string().uuid(),amount:z.number().positive().max(1e9).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001,"Use at most two decimal places"),paidAt:z.string().date(),method:z.enum(["Bank Transfer / Online","Cash"]),reference:z.string().trim().max(150).default(""),notes:z.string().trim().max(1000).default(""),proof:z.string().max(8_000_000).optional()}).strict().refine(v=>v.method==="Cash"||v.reference.length>0,{message:"Transaction reference is required for bank transfer or online payment",path:["reference"]});

export function salaryBalance(r:any){const net=money(Math.max(0,r.snapshot.netSalary+Number(r.allowance||0)-Number(r.otherDeduction||0)));const paid=r.status==="PAID"&&!(r.paidAmount>0)?net:Number(r.paidAmount||0);return {net,paid,remaining:money(Math.max(0,net-paid))};}

export async function paySalary(actor:any,id:string,raw:any){
 const mayPayFinance=actor.userType==="FINANCE"&&actor.permissions?.includes("payroll.pay");
 const mayPayAdmin=actor.userType==="SCHOOL_ADMIN"&&actor.permissions?.includes("payroll.manage");
 if(!mayPayFinance&&!mayPayAdmin)throw {statusCode:403,message:"Payroll payment permission required. Finance users need Payroll Payment access; School Admins need payroll management access."};

 const input=salaryPaymentInput.parse(raw),referenceKey=input.reference?createHash("sha256").update(id.toLowerCase()+":"+input.method+":"+input.reference.toUpperCase()).digest("hex"):undefined,image=input.proof?decodePaymentImage(input.proof):null;

 if(input.paidAt>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()))throw {statusCode:400,message:"Payment date cannot be in the future."};

 await SalaryPayment.init();

 return transaction(async session=>{

  const record=await PayrollRecord.findOne({_id:id,schoolId:actor.schoolId}).session(session);if(!record)throw {statusCode:404,message:"Payroll not found."};

  const prior=await SalaryPayment.findOne({schoolId:actor.schoolId,requestId:input.requestId}).session(session);

  if(prior){if(String(prior.payrollId)!==id||prior.amount!==input.amount||prior.method!==input.method||prior.reference!==input.reference||prior.paidAt.toISOString().slice(0,10)!==input.paidAt)throw {statusCode:409,message:"Payment request already used for different details."};return record;}

  if(referenceKey&&await SalaryPayment.exists({schoolId:actor.schoolId,referenceKey}).session(session))throw {statusCode:409,message:"This transaction reference is already recorded for this payroll."};
  if(String(record.employeeId)===actor.userId)throw {statusCode:403,message:"You cannot record your own salary payment. Another authorized Finance employee must do this."};

  if(!["APPROVED","PARTIALLY_PAID"].includes(record.status))throw {statusCode:409,message:"Only approved outstanding payroll can be paid."};

  const balance=salaryBalance(record);if(input.amount>balance.remaining)throw {statusCode:409,message:"Payment exceeds the remaining salary balance."};

  const payer=await employee(actor,actor.userId),before=record.toObject();

  const [payment]=await SalaryPayment.create([{schoolId:actor.schoolId,payrollId:record._id,employeeId:record.employeeId,requestId:input.requestId,amount:input.amount,paidAt:new Date(input.paidAt+"T12:00:00Z"),method:input.method,reference:input.reference,...(referenceKey?{referenceKey}:{}),notes:input.notes,paidBy:actor.userId,paidByName:payer.name,...(image?{proof:image.bytes,proofMime:image.mime,hasProof:true}:{})}],{session});

  record.paidAmount=money(balance.paid+input.amount);record.status=record.paidAmount===balance.net?"PAID":"PARTIALLY_PAID";record.paidAt=payment.paidAt;record.paidBy=actor.userId;record.paidByName=payer.name;record.paymentMethod=input.method;record.paymentReference=input.reference;record.revision++;await record.save({session});

  const recipient=await employee(actor,String(record.employeeId));const portal=({TEACHER:"teacher",FINANCE:"finance",EXAM_STAFF:"exam-staff",RECEPTIONIST:"receptionist",SCHOOL_ADMIN:"school-admin"} as any)[recipient.userType];

  await TeacherNotification.create([{schoolId:actor.schoolId,teacherUserId:record.employeeId,dedupeKey:"salary-payment:"+payment._id,title:record.status==="PAID"?"Salary paid · "+record.month:"Partial salary payment · "+record.month,message:`PKR ${input.amount.toLocaleString()} recorded for ${record.month}. Remaining: PKR ${money(balance.net-record.paidAmount).toLocaleString()}. View payment details and payslip in My Salary.`,href:`/${portal}/salary?payrollId=${record._id}`}],{session});

  await audit(actor,"SALARY_PAYMENT_RECORDED","SalaryPayment",payment._id,before,{payrollId:id,amount:input.amount,method:input.method,reference:input.reference,status:record.status},session);return record;

 });

}

export async function salaryPayments(actor:any,id:string){const record:any=await PayrollRecord.findOne({_id:id,schoolId:actor.schoolId}).lean();if(!record)throw {statusCode:404,message:"Payroll not found."};if(String(record.employeeId)!==actor.userId&&(!["FINANCE","SCHOOL_ADMIN"].includes(actor.userType)||!actor.permissions.includes("payroll.view")))throw {statusCode:403,message:"Only your own salary is available."};return SalaryPayment.find({schoolId:actor.schoolId,payrollId:id}).sort({paidAt:-1,createdAt:-1}).lean();}




export async function salaryPdf(actor:any,id:string){
 const payments:any[]=await salaryPayments(actor,id);
 const record:any=await PayrollRecord.findOne({_id:id,schoolId:actor.schoolId}).lean();
 return renderSalaryPdf(record,payments);
}
export async function renderSalaryPdf(record:any,payments:any[]){
 const id=String(record._id),s=record.snapshot,balance=salaryBalance(record);
 let logo:Buffer|undefined;
 if(s.school?.logoUrl){const image=await normalizeCardImage(s.school.logoUrl);if(!image)throw {statusCode:422,message:"The saved school logo cannot be rendered. Ask the school administrator to update it."};logo=Buffer.from(image.split(",")[1],"base64");}
 const PDF=require("pdfkit"),doc=new PDF({size:"A4",margin:44,bufferPages:true}),chunks:Buffer[]=[];
 const done=new Promise<Buffer>((resolve,reject)=>{doc.on("data",(c:Buffer)=>chunks.push(c));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 const ink="#20242a",muted="#657080",red="#df0010",line="#dfe3e8",width=507;
 const text=(value:any,x:number,y:number,size=10,options:any={})=>doc.fillColor(ink).font("Helvetica").fontSize(size).text(String(value??"Not recorded"),x,y,options);
 const amount=(value:any)=>"PKR "+Number(value||0).toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2});
 doc.rect(44,36,width,4).fill(red);
 if(logo)doc.image(logo,44,54,{fit:[76,44]});
 text(s.school?.name||"School",logo?136:44,54,18,{width:logo?415:507});
 text([s.school?.address,s.school?.phone,s.school?.email].filter(Boolean).join(" · "),logo?136:44,82,9,{width:logo?415:507});
 text("SALARY PAYSLIP",44,119,19);text(record.month,410,120,15,{width:141,align:"right"});
 text(record.reference,44,146,9);text(record.status.replaceAll("_"," "),352,146,10,{width:199,align:"right"});
 doc.roundedRect(44,174,width,103,4).fill("#f3f4f6");
 text("EMPLOYEE",58,188,8);text(s.employee.name,58,204,12,{width:265});
 text([s.employee.employeeId,s.employee.designation||s.employee.role].filter(Boolean).join(" · "),58,227,10,{width:265});
 text("DEPARTMENT",345,188,8);text(s.employee.department||"Not configured",345,204,11,{width:192});
 text("Payable days: "+s.payableDays+" · Worked: "+s.workedDays,58,253,9,{width:265});
 text("Paid / unpaid leave: "+s.paidLeave+" / "+s.unpaidLeave,345,253,9,{width:192});
 const table=(x:number,title:string,rows:any[])=>{doc.rect(x,299,245,26).fill("#20242a");doc.fillColor("white").font("Helvetica-Bold").fontSize(9).text(title,x+10,308);rows.forEach(([label,value],i)=>{const y=325+i*25;doc.rect(x,y,245,25).fill(i%2?"#f5f6f8":"#ffffff");text(label,x+10,y+8,9,{width:129});text(amount(value),x+137,y+8,9,{width:98,align:"right"});});};
 table(44,"EARNINGS",[["Base salary",s.baseSalary],["Allowances / bonuses",record.allowance],["Gross earnings",s.grossSalary+Number(record.allowance||0)]]);
 table(306,"DEDUCTIONS",[["Late arrival",s.lateDeduction],["Absence",s.absenceDeduction],["Unpaid leave",s.unpaidLeaveDeduction],["Other deductions",record.otherDeduction]]);
 [["NET PAYABLE",balance.net],["AMOUNT PAID",balance.paid],["OUTSTANDING",balance.remaining]].forEach(([label,value],i)=>{const x=44+i*173;doc.roundedRect(x,448,161,65,4).fill(i===2&&balance.remaining>0?"#fff3e5":"#f2f4f6");text(label,x+12,461,8);text(amount(value),x+12,482,13,{width:137});});
 text("PAYMENT HISTORY",44,541,11);doc.moveTo(44,561).lineTo(551,561).strokeColor(line).stroke();
 const historyLabels=(y:number)=>{text("DATE",44,y,8);text("METHOD",126,y,8);text("REFERENCE",236,y,8);text("AMOUNT",401,y,8,{width:150,align:"right"});};
 historyLabels(574);let y=595;for(const payment of payments){doc.font("Helvetica").fontSize(9);const height=Math.max(29,doc.heightOfString(payment.reference||"No reference",{width:155})+10);if(y+height>729){doc.addPage();text("PAYMENT HISTORY · "+record.month,44,44,12);historyLabels(72);y=92;}text(payment.paidAt.toISOString().slice(0,10),44,y,9,{width:72});text(payment.method,126,y,9,{width:100});text(payment.reference||"No reference",236,y,9,{width:155});text(amount(payment.amount),401,y,9,{width:150,align:"right"});y+=height;}
 if(!payments.length){text(record.status==="PAID"?"Historical payment: "+(record.paymentReference||"Reference unavailable"):"No payment recorded.",44,y,9,{width});y+=29;}
 if(y>680){doc.addPage();y=50;}
 y=Math.max(y+40,713);doc.moveTo(44,y).lineTo(244,y).strokeColor(line).stroke();text("AUTHORIZED SIGNATURE",44,y+10,8);text(record.approvedByName||"School administration",44,y+25,9);
 text("This slip records salary calculations and payments saved by the school. Acadivo does not transfer funds.",44,780,8,{width});
 doc.end();return {file:(await done).toString("base64"),filename:"payslip-"+record.month+"-"+record._id+".pdf",mime:"application/pdf"};
}
