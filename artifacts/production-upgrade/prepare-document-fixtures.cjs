// Local practice fixtures only. Does not read the project's connection configuration.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), mongoose = require('mongoose');
const root = path.resolve(__dirname, '../..');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const load = relative => require(path.join(root, relative));
const { School } = load('src/server/models/school.model.ts');
const { User } = load('src/server/models/user.model.ts');
const { Role } = load('src/server/models/role.model.ts');
const { Branch } = load('src/server/models/branch.model.ts');
const { StaffEmployment } = load('src/server/models/workforce.model.ts');
const { ROLE_PERMISSION_MAP } = load('src/server/constants/permissions.constant.ts');
const { DEFAULT_POLICY } = load('src/lib/workforce-math.ts');
const bcrypt = require('bcryptjs');
const database = 'acadivo_biometric_practice';
Object.assign(process.env,{NODE_ENV:'test',MONGODB_URI:'mongodb://127.0.0.1:27018/acadivo_biometric_practice?replicaSet=acadivoDemo',JWT_ACCESS_SECRET:require('node:crypto').randomBytes(48).toString('hex'),JWT_REFRESH_SECRET:require('node:crypto').randomBytes(48).toString('hex')});
const {Subscription}=load('src/server/models/subscription.model.ts');
const {ClassModel}=load('src/server/models/classSection.model.ts');
const {AcademicSession}=load('src/server/models/academicSession.model.ts');
const {Student}=load('src/server/models/student.model.ts');
const {Subject}=load('src/server/models/subject.model.ts');
const {ExamSchedule,MarksEntry,GradingScale,ProcessedResult}=load('src/server/models/exam.model.ts');
const {FeeChallan,FeePayment}=load('src/server/models/fee.model.ts');
const {ParentProfile}=load('src/server/models/parentProfile.model.ts');
const {ExamService}=load('src/server/services/exam.service.ts');
const {FinanceService}=load('src/server/services/finance.service.ts');
(async()=>{try{
 await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});if(mongoose.connection.name!=='acadivo_biometric_practice')throw Error('Unexpected database');
 await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
 const school=await School.findOne({code:'biometric-practice'});if(!school)throw Error('Create the local practice school first.');const id=school._id;
 await School.updateOne({_id:id},{$set:{logoUrl:'/logo.png'}});
 await Subscription.findOneAndUpdate({schoolId:id},{$setOnInsert:{plan:'ENTERPRISE',status:'ACTIVE',price:19999,billingCycle:'monthly',paymentStatus:'UNPAID',currentPeriodStart:new Date(),currentPeriodEnd:new Date(Date.now()+5*86400000)}},{upsert:true,runValidators:true});
 const session=await AcademicSession.findOneAndUpdate({schoolId:id,name:'2026-2027'},{$setOnInsert:{startDate:new Date('2026-08-01'),endDate:new Date('2027-06-30'),isCurrent:true}},{upsert:true,new:true,runValidators:true});
 const cls=await ClassModel.findOneAndUpdate({schoolId:id,code:'demo-grade5'},{$setOnInsert:{name:'Demo Grade 5',numericLevel:5}},{upsert:true,new:true,runValidators:true});
 const student=await Student.findOneAndUpdate({schoolId:id,studentId:'DEMO-STUDENT-1'},{$setOnInsert:{name:'Demo Student',admissionNumber:'DEMO-ADM-1',rollNumber:'1',dob:new Date('2015-01-01'),gender:'Male',classId:cls._id,className:cls.name,academicSessionId:session._id,academicSessionName:session.name,address:'Local practice only',parentInfo:{fatherName:'Demo Parent',fatherPhone:'03000000000'},emergencyContact:{name:'Demo Parent',phone:'03000000000',relation:'Parent'}}},{upsert:true,new:true,runValidators:true});
 const hash=await bcrypt.hash('LocalDemo2026!Pass',12);
 for(const type of ['EXAM_STAFF','RECEPTIONIST','PARENT','SUPER_ADMIN']){
  const role=await Role.findOneAndUpdate({schoolId:null,code:'ROLE_'+type},{$setOnInsert:{name:type,userType:type,permissions:ROLE_PERMISSION_MAP[type],isSystemRole:true}},{upsert:true,new:true});
  const email=type.toLowerCase()+'@biometric.example.invalid';
  const user=await User.findOneAndUpdate({email},{$setOnInsert:{schoolId:type==='SUPER_ADMIN'?null:id,roleId:role._id,name:'Demo '+type.replaceAll('_',' '),userType:type,status:'ACTIVE',isEmailVerified:true,passwordHash:hash}},{upsert:true,new:true,runValidators:true});
  if(type==='PARENT')await ParentProfile.findOneAndUpdate({schoolId:id,userId:user._id},{$setOnInsert:{studentIds:[student._id]}},{upsert:true,runValidators:true});
 }
 const teacher=await User.findOne({schoolId:id,userType:'TEACHER'});
 const subjects=[];for(const [name,code]of [['Mathematics','DEMO-MATH'],['Science','DEMO-SCI']])subjects.push(await Subject.findOneAndUpdate({schoolId:id,code,classId:cls._id},{$setOnInsert:{name,className:cls.name,totalMarks:100,passingMarks:33,teacherId:teacher._id,teacherName:teacher.name}},{upsert:true,new:true,runValidators:true}));
 await GradingScale.findOneAndUpdate({schoolId:id},{$setOnInsert:{title:'Demo grading scale',rules:[{grade:'A',minPercentage:80,maxPercentage:100},{grade:'B',minPercentage:60,maxPercentage:79.99},{grade:'C',minPercentage:40,maxPercentage:59.99},{grade:'F',minPercentage:0,maxPercentage:39.99}],isDefault:true}},{upsert:true,runValidators:true});
 const exam=await ExamSchedule.findOneAndUpdate({schoolId:id,title:'DEMO Mid-Term Examination'},{$setOnInsert:{term:'MID_TERM',academicSessionId:session._id,academicSessionName:session.name,classes:[String(cls._id)],subjects:subjects.map(s=>s.name),startDate:new Date('2026-10-01'),endDate:new Date('2026-10-05'),status:'PROCESSED'}},{upsert:true,new:true,runValidators:true});
 for(let i=0;i<subjects.length;i++)await MarksEntry.findOneAndUpdate({schoolId:id,examId:exam._id,subjectId:subjects[i]._id,classId:cls._id},{$setOnInsert:{examTitle:exam.title,className:cls.name,subjectName:subjects[i].name,maxMarks:100,passingMarks:33,enteredByTeacherId:teacher._id,enteredByTeacherName:teacher.name,status:'APPROVED',records:[{studentId:student._id,studentName:student.name,rollNumber:'1',obtainedMarks:i?90:85,isAbsent:false}]}},{upsert:true,runValidators:true});
 await ExamService.processResults(String(id),String(exam._id),String(cls._id),'Local QA fixture');
 const challan=await FeeChallan.findOneAndUpdate({schoolId:id,challanNumber:'DEMO-DOC-001'},{$setOnInsert:{studentId:student._id,studentName:student.name,rollNumber:'1',admissionNumber:student.admissionNumber,classId:cls._id,className:cls.name,academicSession:session.name,month:'October 2026',dueDate:new Date('2026-10-31'),feeBreakdown:{tuitionFee:2000,discount:200},totalAmountPKR:1800,paidAmountPKR:0,remainingAmountPKR:1800,status:'PENDING',documentSnapshot:{school:{name:school.name,address:school.address,phone:school.phone,email:school.email,logoUrl:'/logo.png'},student:{parentInfo:{fatherName:'Demo Parent'}},bank:null}}},{upsert:true,new:true,runValidators:true});
 await FinanceService.collectPayment(String(id),String(challan._id),{amountPKR:600,paymentMethod:'Cash',requestId:'00000000-0000-4000-8000-000000000101'},'Local QA fixture');
 const payment=await FeePayment.findOne({schoolId:id,challanId:challan._id}).populate('challanId').populate('studentId').lean();
 const result=await ProcessedResult.findOne({schoolId:id,examId:exam._id,studentId:student._id}).lean();
 require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {FeeDocument,AcademicDocument}=load('src/components/SchoolDocuments.tsx');
 const css=fs.readFileSync(path.join(root,'src/app/documents.css'),'utf8');
 const output=path.join(root,'artifacts/production-upgrade/documents');fs.mkdirSync(output,{recursive:true});
 for(const [name,element]of [['challan',React.createElement(FeeDocument,{challan:await FeeChallan.findById(challan._id).lean()})],['receipt',React.createElement(FeeDocument,{challan:payment.challanId,payment})],['report-card',React.createElement(AcademicDocument,{school:{...school.toObject(),logoUrl:'/logo.png'},student:student.toObject(),exam:exam.toObject(),result})]]){
  fs.writeFileSync(path.join(output,name+'.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local DEMO document proof</title><style>'+css+'@page{size:A4;margin:15mm}body{margin:0;background:#f4f5f6;padding:20px}</style></head><body>'+renderToStaticMarkup(element)+'</body></html>');
 }
 console.log('SUCCESS: Persisted local practice records and actual-component HTML document proofs are ready.');
}finally{await mongoose.disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
