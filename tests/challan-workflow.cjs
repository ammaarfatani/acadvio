const fs = require('fs'), path = require('path'), ts = require('typescript'), assert = require('assert/strict');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const { FeeCalculationService: calc } = require('../src/server/services/feeCalculation.service.ts');
const { studentFeeAssignment, feeStructureEligible } = require('../src/lib/student-fee-assignment.ts');
const { challanTemplateSchema, defaultChallanTemplate } = require('../src/lib/challan-template.ts');
const { FeeStructureSchema, FeeBatchSchema, CollectPaymentSchema } = require('../src/server/validators/domain.validator.ts');
const { normalizeBillingDate } = require('../src/lib/billing-date.ts');
let checks=0; const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const school='111111111111111111111111', classId='222222222222222222222222', sessionId='333333333333333333333333';
const basic={_id:'444444444444444444444444',schoolId:school,classId,title:'Basic Fee',tuitionFee:3500,academicSession:'2026-27',dueDateDay:15,lateFeeFinePolicy:{model:'ONE_TIME',type:'FIXED',amount:25,graceDays:2,stages:[]}};
const concession={...basic,_id:'555555555555555555555555',title:'Concession Fee',tuitionFee:2500,dueDateDay:20,lateFeeFinePolicy:{model:'ONE_TIME',type:'FIXED',amount:40,graceDays:3,stages:[]}};
const allClasses={...basic,_id:'666666666666666666666666',classId:undefined,className:'All Classes',classScope:'ALL'};
const free={...allClasses,_id:'999999999999999999999999',title:'Free Education',tuitionFee:0,examFee:0,admissionFee:0,transportFee:0,libraryFee:0,computerFee:0,otherCharges:0,totalMonthlyFee:0,lateFeeFinePolicy:{model:'ONE_TIME',type:'FIXED',amount:500,graceDays:0,stages:[]}};
const datePayload={classId,month:'2026-11',dueDate:'2026-11-20'};
eq(FeeBatchSchema.safeParse(datePayload).success,true);eq(Object.hasOwn(FeeBatchSchema.parse(datePayload),'dueDate'),false);eq(Object.hasOwn(FeeBatchSchema.parse({...datePayload,lateFeeFine:10}),'lateFeeFine'),false);
const paymentPayload={challanId:'444444444444444444444444',amountPKR:500,paymentMethod:'Bank Transfer',requestId:'77777777-7777-4777-8777-777777777777',paymentDate:'2026-11-13',transactionReference:'BANK-REF-123'};
eq(CollectPaymentSchema.safeParse(paymentPayload).success,true);eq(CollectPaymentSchema.safeParse({...paymentPayload,paymentDate:'2026-02-30'}).success,false);eq(CollectPaymentSchema.safeParse({...paymentPayload,transactionReference:'x'.repeat(161)}).success,false);
eq(normalizeBillingDate('2026-11'),'2026-11-01');eq(normalizeBillingDate('2026-11-01'),'2026-11-01');eq(normalizeBillingDate(new Date('2026-11-01T00:00:00.000Z')),'2026-11-01');eq(normalizeBillingDate('2026-12-31T23:30:00.000Z'),'2026-12-31');eq(normalizeBillingDate(undefined,'2027-01'),'2027-01-01');
assert.throws(()=>normalizeBillingDate('2026-02-30'));checks++;assert.throws(()=>normalizeBillingDate(123));checks++;
eq(FeeStructureSchema.safeParse({title:'Free Education',classScope:'ALL',tuitionFee:0,admissionFee:0,examFee:0,transportFee:0,libraryFee:0,computerFee:0,otherCharges:0,totalMonthlyFee:0}).success,true);
eq(FeeStructureSchema.safeParse({title:'Invalid Negative Fee',classScope:'ALL',tuitionFee:-0.01}).success,false);
const anotherClass='888888888888888888888888';
eq(feeStructureEligible(allClasses,{classId:anotherClass,academicSessionName:'2026-27'}),true);
eq(feeStructureEligible(allClasses,{classId:anotherClass,academicSessionName:'2027-28'}),false);
eq(feeStructureEligible(basic,{classId:anotherClass,academicSessionName:'2026-27'}),false);
eq(feeStructureEligible({...basic,classId:undefined},{classId:anotherClass,academicSessionName:'2026-27'}),false);
const students=Array.from({length:6},(_,i)=>({_id:String(i+1).padStart(24,'0'),schoolId:school,classId,name:'Fictional Student '+(i+1),feeStructureId:i<3?basic._id:i<5?concession._id:free._id,academicSessionId:sessionId,academicSessionName:'2026-27',status:'ACTIVE'}));
let saved=[];
const query=value=>({select(){return this},sort(){return this},session(){return this},lean:async()=>value,then:(yes,no)=>Promise.resolve(value).then(yes,no)});
const profile={name:'Fictional Academy',address:'12 Sample Street',phone:'0300 0000000',documentSettings:{challanTemplate:defaultChallanTemplate()}};
const mocks={
 './financeReminder.service':{notifyFeeEvent:async()=>{}},
 '../models/fee.model':{FeeStructure:{find:()=>query([basic,concession,free])},FeeChallan:{find:filter=>query(filter.month?saved.filter(c=>filter.month.$in.includes(c.month)&&c.academicSession===filter.academicSession):saved),findOne:filter=>query(saved.find(c=>String(c.studentId)===String(filter.studentId))),findOneAndUpdate:async(filter,update)=>{const row={...update.$setOnInsert,_id:String(saved.length+10).padStart(24,'0')};saved.push(row);return row}}},
 '../models/student.model':{Student:{find:filter=>query(filter._id?.$in?students.filter(s=>filter._id.$in.includes(s._id)):students)}},
 '../models/classSection.model':{ClassModel:{findOne:()=>query({_id:classId,name:'Class 2'})},SectionModel:{}},
 '../models/academicSession.model':{AcademicSession:{findOne:()=>query({_id:sessionId,name:'2026-27'})}},
 './school.service':{SchoolService:{getSchoolProfile:async()=>profile}},
 './feeCalculation.service':{FeeCalculationService:calc},
 '../../lib/student-fee-assignment':require('../src/lib/student-fee-assignment.ts'),
 '../../lib/billing-date':require('../src/lib/billing-date.ts'),
 '../../lib/fee-math':require('../src/lib/fee-math.ts'),
 '../../lib/document-templates':require('../src/lib/document-templates.ts'),
 '../../lib/challan-template':require('../src/lib/challan-template.ts'),
 '../models/auditLog.model':{AuditLog:{create:async()=>({})}},
};
function load(file,overrides){const out={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>overrides[name]||(name.startsWith('.')?{}:require(name)),out,out.exports);return out.exports;}
(async()=>{
 const {FinanceService}=load('src/server/services/finance.service.ts',mocks);
 const generation=await FinanceService.generateBulkChallans(school,classId,'2026-11',{academicSessionId:sessionId});
 eq(generation.count,6);eq(generation.createdCount,6);eq(generation.existingCount,0);eq(generation.zeroBalanceCount,1);
 eq(saved.map(c=>c.totalAmountPKR),[3500,3500,3500,2500,2500,0]);eq(saved.every(c=>c.month==='2026-11'),true);eq(saved.slice(0,3).every(c=>c.dueDate.toISOString()==='2026-11-15T00:00:00.000Z'),true);eq(saved.slice(3,5).every(c=>c.dueDate.toISOString()==='2026-11-20T00:00:00.000Z'),true);eq(saved[0].lateFeeFinePolicy.amount,25);eq(saved[3].lateFeeFinePolicy.amount,40);eq(saved.at(-1).remainingAmountPKR,0);eq(saved.at(-1).status,'ZERO_BALANCE');eq(saved.at(-1).paidAmountPKR,0);eq(saved.every(c=>c.documentSnapshot.challanTemplate.design==='classic'),true);
 const repeat=await FinanceService.generateBulkChallans(school,classId,'2026-11',{academicSessionId:sessionId});eq(saved.length,6);eq(repeat.count,6);eq(repeat.createdCount,0);eq(repeat.existingCount,6);
 const savedPolicy=basic.lateFeeFinePolicy;basic.lateFeeFinePolicy={model:'DISABLED',type:'FIXED',amount:0,graceDays:0,stages:[]};const none=await FinanceService.generateBulkChallans(school,classId,'2027-02',{academicSessionId:sessionId,studentIds:[students[0]._id]});eq(none.createdCount,1);eq(saved.at(-1).lateFinePolicyModel,'DISABLED');eq(saved.at(-1).lateFeeFinePolicy.amount,0);eq(saved.at(-1).amountPayableAfterDueDate,3500);basic.lateFeeFinePolicy=savedPolicy;
 basic.lateFeeFinePolicy={model:'ONE_TIME',type:'FIXED',amount:10,graceDays:0,stages:[]};const fixedFromStructure=await FinanceService.generateBulkChallans(school,classId,'2027-03',{academicSessionId:sessionId,studentIds:[students[0]._id]});eq(fixedFromStructure.createdCount,1);eq(saved.at(-1).lateFeeFinePolicy.amount,10);eq(saved.at(-1).amountPayableAfterDueDate,3510);basic.lateFeeFinePolicy=savedPolicy;
 basic.lateFeeFinePolicy='legacy-invalid-policy-id';await assert.rejects(()=>FinanceService.generateBulkChallans(school,classId,'2027-05',{academicSessionId:sessionId,studentIds:[students[0]._id]}),e=>e.statusCode===400&&/incomplete legacy late fine policy/i.test(e.message));checks++;basic.lateFeeFinePolicy=savedPolicy;
 const negativePolicy=basic.lateFeeFinePolicy;basic.lateFeeFinePolicy={model:'ONE_TIME',type:'FIXED',amount:-1};await assert.rejects(()=>FinanceService.generateBulkChallans(school,classId,'2027-04',{academicSessionId:sessionId}),e=>e.statusCode===400&&/invalid late fine policy/i.test(e.message));checks++;basic.lateFeeFinePolicy=negativePolicy;
 const before=JSON.stringify(saved.filter(c=>c.month==='2026-11'));students[0].feeStructureHistory=[{previousFeeStructureId:basic._id,newFeeStructureId:concession._id,effectiveDate:'2026-12-01',newConcessionValue:100,newConcessionType:'FIXED'}];
 const individual=await FinanceService.generateBulkChallans(school,classId,'2026-12',{academicSessionId:sessionId,studentIds:[students[0]._id]});
 eq(individual.count,1);eq(individual.createdCount,1);eq(saved.filter(c=>c.month==='2026-12').map(c=>String(c.studentId)),[students[0]._id]);
 const assignmentBeforeRetry=students[0].feeStructureId,historyBeforeRetry=students[0].feeStructureHistory;students[0].feeStructureId=undefined;students[0].feeStructureHistory=[];
 const existingWithoutAssignment=await FinanceService.generateBulkChallans(school,classId,'2026-12',{academicSessionId:sessionId,studentIds:[students[0]._id]});
 eq(existingWithoutAssignment.existingCount,1);eq(existingWithoutAssignment.createdCount,0);students[0].feeStructureId=assignmentBeforeRetry;students[0].feeStructureHistory=historyBeforeRetry;
 eq(studentFeeAssignment(students[0],'2026-11','2026-11-20').feeStructureId,basic._id);
 eq(studentFeeAssignment(students[0],'2026-12','2026-12-20').feeStructureId,concession._id);eq(JSON.stringify(saved.filter(c=>c.month==='2026-11')),before);
 const old=students[4].feeStructureId;students[4].feeStructureId=undefined;
 await assert.rejects(()=>FinanceService.generateBulkChallans(school,classId,'2026-12',{academicSessionId:sessionId}),e=>e.statusCode===400&&/Assign an eligible/.test(e.message));checks++;students[4].feeStructureId=old;
 eq(feeStructureEligible({...basic,sectionId:'other'},{classId,sectionId:'ours',academicSessionName:'2026-27'}),false);
 eq(challanTemplateSchema.safeParse({...defaultChallanTemplate(),paper:'A5'}).success,false);
 eq(challanTemplateSchema.safeParse({...defaultChallanTemplate(),orientation:'landscape',arrangement:'columns'}).success,true);
 const c=calc.calculateStudentChallan({student:{name:'Sample',concessionType:'FIXED',concessionValue:500},structure:{...basic,customCharges:[{label:'Annual charge',amount:1000}],defaultDiscount:100,earlyPaymentDiscount:{enabled:true,type:'FIXED',amount:50,cutoffDaysBeforeDue:10},lateFeeFinePolicy:{model:'ONE_TIME',amount:100,graceDays:2}},month:'2026-11',dueDate:new Date(2026,10,20),previousBalance:750});
 eq(c.totalAmountPKR,4650);eq(c.amountPayableWithEarlyDiscount,4600);
 eq(calc.evaluateCurrentPayable(c,new Date(2026,10,21)).lateFineApplied,0);eq(calc.evaluateCurrentPayable(c,new Date(2026,10,23)).lateFineApplied,100);
 const paid={...c,feeBreakdown:{...c.feeBreakdown},remainingAmountPKR:c.totalAmountPKR,paidAmountPKR:0};calc.applyPayment(paid,4600,new Date(2026,10,9));eq(paid.status,'PAID');eq(calc.evaluateCurrentPayable(paid,new Date(2027,0,1)).payableAmount,0);
 const partial={...c,feeBreakdown:{...c.feeBreakdown},remainingAmountPKR:c.totalAmountPKR,paidAmountPKR:0};calc.applyPayment(partial,1000,new Date(2026,10,23));eq(partial.remainingAmountPKR,3750);eq(calc.evaluateCurrentPayable(partial,new Date(2026,10,24)).payableAmount,3750);
 calc.applyPayment(partial,3750,new Date(2026,10,24));eq(partial.status,'PAID');eq(partial.totalAmountPKR,4750);
 const {getFreeChallanLabel}=require('../src/lib/challan-template.ts');
 const freeChallan=calc.calculateStudentChallan({student:{name:'Free Student'},structure:free,month:'2026-11',dueDate:new Date(2026,10,1),previousBalance:0});
 eq(freeChallan.totalAmountPKR,0);eq(freeChallan.amountPayableAfterDueDate,0);eq(freeChallan.lateFineStages.length,0);
 eq(getFreeChallanLabel({...freeChallan,feeStructureTitle:'Free Education',remainingAmountPKR:0,paidAmountPKR:0}),'FREE EDUCATION - NO FEE PAYABLE');
 eq(getFreeChallanLabel({...freeChallan,feeStructureTitle:'Tuition Waiver',remainingAmountPKR:0,previousBalance:100,paidAmountPKR:0}),null);
 const freePayable=calc.evaluateCurrentPayable({totalAmountPKR:0,remainingAmountPKR:0,status:'ZERO_BALANCE',dueDate:new Date(2026,9,1),lateFinePolicyModel:'ONE_TIME',lateFeeFinePolicy:{model:'ONE_TIME',amount:500}},new Date(2026,10,12));
 eq(freePayable.payableAmount,0);eq(freePayable.lateFineApplied,0);eq(freePayable.statusLabel,'ZERO_BALANCE');
 // Exercise actual updateStudent service with a persistence boundary mock, including permission and history.
 const student={...students[1],updatedAt:new Date(),concessionType:'FIXED',concessionValue:0,feeStructureHistory:[]};
 const updateMocks={...mocks,'../models/student.model':{Student:{findOne:()=>query(student),findOneAndUpdate:async(filter,update)=>{eq(filter.schoolId,school);Object.assign(student,update.$set);return student;}}},'../models/fee.model':{FeeStructure:{findOne:()=>query(concession)}},'./studentPhoto.service':{validateStudentPhoto:async()=>undefined}};
 const {SchoolAdminService}=load('src/server/services/schoolAdmin.service.ts',updateMocks);
 await assert.rejects(()=>SchoolAdminService.updateStudent(school,student._id,{feeStructureId:concession._id},{permissions:[]}),e=>e.statusCode===403);checks++;
 await SchoolAdminService.updateStudent(school,student._id,{feeStructureId:concession._id,concessionValue:100,feeEffectiveDate:'2027-01-01'},{userId:'666666666666666666666666',email:'sample@example.invalid',permissions:['fees.update']});
 eq(student.feeStructureId,basic._id);eq(student.feeStructureHistory.length,1);eq(studentFeeAssignment(student,'2027-01','2027-01-20').feeStructureId,concession._id);
 // Initial admission uses the same service and persists the chosen structure and effective history.
 let createdStudent;
 const creationMocks={...updateMocks,
  '../models/student.model':{Student:{create:async data=>{createdStudent=structuredClone(data);return data;}}},
  '../models/classSection.model':{ClassModel:{findOne:()=>query({_id:classId,name:'Class 2'})},SectionModel:{findOne:()=>query({_id:'777777777777777777777777',name:'A'})}},
  './subscriptionEntitlement.service':{SubscriptionEntitlementService:{checkCapacityLimit:async()=>{}}},
  './permanentIdentity.service':{permanentIdentity:async(_,kind)=>'SAMPLE-'+kind},
 };
 const {SchoolAdminService: admissions}=load('src/server/services/schoolAdmin.service.ts',creationMocks);
 admissions.getNextStudentRollNumber=async()=> '14';
 await admissions.createStudent(school,{name:'Fictional New Student',classId,sectionId:'777777777777777777777777',academicSessionId:sessionId,feeStructureId:concession._id,concessionType:'PERCENTAGE',concessionValue:10,feeEffectiveDate:'2026-11-01'},undefined,false);
 eq(createdStudent.feeStructureId,concession._id);eq(createdStudent.feeStructureHistory[0].newConcessionValue,10);eq(createdStudent.feeStructureTitle,'Concession Fee');
 eq(studentFeeAssignment(createdStudent,'2026-11','2026-11-20').feeStructureId,concession._id);
 const allClassesAdmissions=load('src/server/services/schoolAdmin.service.ts',{...creationMocks,'../models/fee.model':{FeeStructure:{findOne:()=>query(free)}}}).SchoolAdminService;
 allClassesAdmissions.getNextStudentRollNumber=async()=> '15';
 await allClassesAdmissions.createStudent(school,{name:'Fictional All Classes Student',classId,sectionId:'777777777777777777777777',academicSessionId:sessionId,feeStructureId:allClasses._id},undefined,false);
 eq(createdStudent.feeStructureId,free._id);eq(createdStudent.feeStructureTitle,'Free Education');
 fs.writeFileSync('artifacts/fee-verification/five-student-fixtures.json',JSON.stringify(saved,null,2));
 console.log(`PASS: ${checks} service, assignment, tenant-filter, policy, payment and template assertions (mock persistence; no live database).`);
})().catch(e=>{console.error(e);process.exitCode=1});
