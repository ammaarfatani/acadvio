import {FeeChallan} from "../models/fee.model";
import {linkedChild} from "./parent.service";
import {SchoolService} from "./school.service";
import {normalizeCardImage} from "./identityCardRender.service";
import {hasFeature} from "../../lib/plan-features";
export async function parentChallanPdf(actor:any,studentId:string,challanId:string){
 if(!hasFeature(actor.plan,"FINANCE"))throw {statusCode:403,message:"Finance is not available for this school."};
 await linkedChild(actor,studentId);const c:any=await FeeChallan.findOne({_id:challanId,studentId,schoolId:actor.schoolId,isVoided:{$ne:true},status:{$ne:"VOIDED"}}).lean();if(!c)throw {statusCode:404,message:"Fee challan not found."};
 const school=await SchoolService.getSchoolProfile(actor.schoolId),bank=school.bankDetails;let logo:Buffer|undefined;if(school.logoUrl){const image=await normalizeCardImage(school.logoUrl);if(image)logo=Buffer.from(image.split(",")[1],"base64");}
 const PDF=require("pdfkit"),doc=new PDF({size:"A4",margin:44}),chunks:Buffer[]=[];const done=new Promise<Buffer>((resolve,reject)=>{doc.on("data",(c:Buffer)=>chunks.push(c));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 const text=(v:any,x:number,y:number,size=10,options:any={})=>doc.font("Helvetica").fontSize(size).fillColor("#20242a").text(String(v??""),x,y,options),money=(v:any)=>"PKR "+Number(v||0).toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2});
 doc.rect(44,36,507,4).fill("#df0010");if(logo)doc.image(logo,44,52,{fit:[76,44]});text(school.name,logo?136:44,54,18,{width:logo?415:507});text([school.address,school.phone,school.email].filter(Boolean).join(" · "),logo?136:44,87,9,{width:logo?415:507});text("FEE CHALLAN",44,126,20);text(c.challanNumber,326,129,10,{width:225,align:"right"});
 doc.roundedRect(44,165,507,84,4).fill("#f3f4f6");text(c.studentName,58,179,13,{width:280});text([c.className,c.sectionName,c.rollNumber].filter(Boolean).join(" · "),58,205,10);text("Month: "+c.month,355,179,10,{width:182});text("Due: "+new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Karachi"}).format(c.dueDate),355,205,10,{width:182});
 let y=274;doc.rect(44,y,507,26).fill("#20242a");doc.fillColor("white").fontSize(10).text("FEE BREAKDOWN",55,y+8);y+=35;for(const [key,value] of Object.entries(c.feeBreakdown||{})){if(!Number(value))continue;text(key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./,s=>s.toUpperCase()),55,y,10,{width:315});text(money(["discount","scholarship"].includes(key)?-Math.abs(Number(value)):value),380,y,10,{width:160,align:"right"});y+=21;}
 y+=12;for(const [label,value] of [["Invoice total",c.totalAmountPKR],["Amount paid",c.paidAmountPKR],["Outstanding",c.remainingAmountPKR]]){text(label,55,y,11);text(money(value),355,y,11,{width:185,align:"right"});y+=26;}
 if(bank?.enabled){y+=14;text("BANK PAYMENT DETAILS",55,y,10);y+=23;for(const [label,value] of [["Bank",bank.bankName],["Account title",bank.accountTitle],["Account number",bank.accountNumber],["IBAN",bank.iban]]){if(value){text(label+": "+value,55,y,10,{width:485});y+=21;}}}
 text("Payment status: "+c.status,44,754,10);text("Use the school payment instructions. Submitting proof does not confirm payment until Finance approves it.",44,780,8,{width:507});doc.end();return {file:(await done).toString("base64"),filename:c.challanNumber+".pdf",mime:"application/pdf"};
}
