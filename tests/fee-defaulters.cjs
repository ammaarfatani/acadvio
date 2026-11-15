const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const school='111111111111111111111111', studentId='222222222222222222222222', student2='333333333333333333333333';
const student={_id:studentId,studentId:'STU-001',name:'Ali Ahmed',classId:'444444444444444444444444',className:'Class 5',classCategoryName:'Primary',sectionId:'555555555555555555555555',sectionName:'A',rollNumber:'12',admissionNumber:'ADM-12',academicSessionName:'2025-26',feeStructureTitle:'Standard',parentInfo:{fatherName:'Guardian',fatherPhone:'03000000000'}};
const studentPartial={...student,_id:student2,name:'Sara Example',studentId:'STU-002'};
const challan=(id,sid,month,due,remaining,paid=0,policy={model:'DISABLED',amount:0})=>({_id:id,schoolId:school,studentId:sid,studentName:sid===studentId?'Ali Ahmed':'Sara Example',month,dueDate:new Date(due+'T00:00:00+05:00'),remainingAmountPKR:remaining,totalAmountPKR:remaining+paid,paidAmountPKR:paid,status:paid?'PARTIAL':'PENDING',feeBreakdown:{lateFeeFine:0},lateFinePolicyModel:policy.model,lateFeeFinePolicy:{...policy,graceDays:0},lateFineStages:[]});
const invoices=[
 challan('a1',studentId,'2026-01','2026-01-10',2500,1000,{model:'ONE_TIME',amount:200}),
 challan('a2',studentId,'2026-02','2026-02-10',3500,0,{model:'ONE_TIME',amount:150}),
 {...challan('a3',studentId,'2026-03','2026-03-10',2000,0,{model:'ONE_TIME',amount:500}),lateFineWaivedAt:new Date('2026-03-15T00:00:00Z')},
 challan('a4',studentId,'2026-05','2026-05-10',1000,0),
 {...challan('a0',studentId,'2025-12','2025-12-10',0),status:'ZERO_BALANCE'},
 challan('b1',student2,'2026-03','2026-03-01',1000,500),
];
const query=values=>({sort(){return this},limit(){return this},select(){return this},lean:async()=>values});
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const overrides={
 '../models/fee.model':{FeeChallan:{find:()=>query(invoices),aggregate:async()=>[{amount:1000}]},FeePayment:{aggregate:async pipeline=>pipeline.some(s=>s.$group?._id==='$studentId')?[{_id:studentId,lastPaymentDate:new Date('2026-04-10T00:00:00Z')}]:[{amount:1000}]}},
 '../models/feeFollowUp.model':{FeeFollowUp:{find:()=>query([{_id:'f1',studentId,contactDate:new Date('2026-04-12'),status:'PROMISED',note:'Pay next week'}])}},
 '../models/student.model':{Student:{find:()=>query([student,studentPartial]),exists:async filter=>filter._id!=='777777777777777777777777'}},
 '../models/branch.model':{Branch:{exists:async()=>true}},
 './feeCalculation.service':{FeeCalculationService:require('../src/server/services/feeCalculation.service.ts').FeeCalculationService},
 './school.service':{SchoolService:{}},
};
const loaded={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/server/services/feeDefaulters.service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>overrides[name]||(name.startsWith('.')?{}:require(name)),loaded,loaded.exports);
(async()=>{
 const service=loaded.exports.FeeDefaultersService;
 const result=await service.get(school,{permissions:['students.view']},{asOf:'2026-04-30',limit:25});
 eq(result.rows.length,2);const ali=result.rows.find(r=>r.studentId===studentId),sara=result.rows.find(r=>r.studentId===student2);
 eq(ali.pendingMonths,4);eq(ali.overdueMonths,3);eq(ali.daysOverdue,110);eq(ali.originalOutstanding,9000);eq(ali.applicableLateFine,350);eq(ali.totalOutstanding,9350);eq(ali.guardianContact,'03000000000');eq(ali.followUps[0].status,'PROMISED');
 eq(sara.paymentStatus,'PARTIAL');eq(sara.overdueMonths,1);eq(result.summary.oneOverdueMonth,1);eq(result.summary.multipleOverdueMonths,1);eq(result.summary.partiallyPaidStudents,2);eq(result.summary.totalOverdue,9350);eq(result.summary.collectionsToday,1000);
 const overdue=await service.get(school,{permissions:[]},{asOf:'2026-04-30',status:'OVERDUE',minOverdueDays:90,limit:25});eq(overdue.rows.length,1);eq(overdue.rows[0].studentId,studentId);
 const page=await service.get(school,{permissions:[]},{asOf:'2026-04-30',page:2,limit:1});eq(page.pagination.total,2);eq(page.rows.length,1);
 await assert.rejects(()=>service.addFollowUp(school,{userId:'666666666666666666666666',email:'a@example.invalid'},'777777777777777777777777',{note:'x',status:'OPEN'}),e=>e.statusCode===404);checks++;
 console.log(`PASS: ${checks} defaulter aggregation, partial payment, waived/zero balance, fine, aging, filters, pagination and follow-up assertions.`);
})().catch(e=>{console.error(e);process.exitCode=1});


