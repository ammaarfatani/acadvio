const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const schoolPath=require.resolve('../src/server/services/school.service.ts'), imagePath=require.resolve('../src/server/services/identityCardRender.service.ts');
require.cache[schoolPath]={id:schoolPath,filename:schoolPath,loaded:true,exports:{SchoolService:{getSchoolProfile:async()=>({name:'Fictional Academy',address:'Sample Street',phone:'0300 0000000'})}}};
require.cache[imagePath]={id:imagePath,filename:imagePath,loaded:true,exports:{normalizeCardImage:async url=>url}};
const {ChallanPdfService}=require('../src/server/services/challanPdf.service.ts'),{defaultChallanTemplate}=require('../src/lib/challan-template.ts');
(async()=>{
 const fixture=JSON.parse(fs.readFileSync('artifacts/fee-verification/five-student-fixtures.json'));
 fixture.forEach((c,i)=>Object.assign(c,{createdAt:'2026-11-01',fatherName:'Sample Guardian',rollNumber:String(i+1),admissionNumber:'SAMPLE-'+(i+1),academicSession:'2026-27',sectionName:'A'}));
 const sharp=require('sharp');const png=await sharp({create:{width:100,height:100,channels:3,background:'#243746'}}).png().toBuffer();
 const logo='data:image/png;base64,'+png.toString('base64');
 const stress={...fixture[0],studentName:'Ayesha Example With An Exceptionally Long Student Name',fatherName:'Sample Guardian With A Long Recorded Name',feeStructureTitle:'Sample Custom Arrangement',previousBalance:750,previousBalanceInformational:true,
 feeBreakdown:{tuitionFee:3500,admissionFee:1000,examFee:250,transportFee:800,libraryFee:100,computerFee:250,otherCharges:150,discount:500,customCharges:[{label:'Annual charge',amount:400}]},totalAmountPKR:5950,remainingAmountPKR:4950,paidAmountPKR:1000,status:'PARTIAL',lateFinePolicyModel:'RECURRING',lateFeeFinePolicy:{type:'FIXED',dailyRate:10,graceDays:2,maxFineCap:100},
 documentSnapshot:{school:{name:'Fictional Academy',logoUrl:logo,address:'12 Sample Street, Karachi',phone:'0300 0000000',bankDetails:{enabled:true,bankName:'Fictional Bank',accountTitle:'Fictional Academy',accountNumber:'SAMPLE-0001',iban:'SAMPLE-IBAN',instructions:'Fictional preview. Present this voucher with payment.'}},challanTemplate:defaultChallanTemplate()}};
 const dir='artifacts/fee-verification/';
 for(const design of ['classic','modern','minimal']){
 const c={...stress,documentSnapshot:{...stress.documentSnapshot,challanTemplate:{...defaultChallanTemplate(),design,color:'#16605c',showSignatures:true,showStamp:true}}};
 fs.writeFileSync(dir+design+'-verified.pdf',await ChallanPdfService.generateStudentChallanPdf('sample',c));
 }
 fs.writeFileSync(dir+'five-students-verified.pdf',await ChallanPdfService.generateClassChallanBatchPdf('sample',fixture));
 fs.writeFileSync(dir+'columns-verified.pdf',await ChallanPdfService.generateStudentChallanPdf('sample',fixture[0],{template:{...defaultChallanTemplate(),orientation:'landscape',arrangement:'columns'}}));
 const zeroBalance={...fixture.find(c=>Number(c.totalAmountPKR)===0),feeStructureTitle:'Free Education',status:'ZERO_BALANCE',remainingAmountPKR:0,paidAmountPKR:0};
 assert.ok(zeroBalance);fs.writeFileSync(dir+'zero-balance-verified.pdf',await ChallanPdfService.generateStudentChallanPdf('sample',zeroBalance));
 await assert.rejects(()=>ChallanPdfService.generateStudentChallanPdf('sample',stress,{template:{...defaultChallanTemplate(),paper:'A5'}}));
 const snapshotBefore=JSON.stringify(fixture[0]);await ChallanPdfService.generateStudentChallanPdf('sample',fixture[0]);assert.equal(JSON.stringify(fixture[0]),snapshotBefore);
 console.log('PASS: generated Classic, Modern, Minimal, landscape columns, mixed-fee batch and zero-balance PDFs; A5 rejected; historical input unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1});
