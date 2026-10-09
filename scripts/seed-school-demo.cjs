/* Explicitly requested, additive demo dataset. Run --preflight first, --apply to write.
   Only the named existing school is targeted. No email, real transfer or record deletion. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),crypto=require('node:crypto'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const mongoose=require('mongoose'),{env}=require('../src/server/config/env.ts');
const {School}=require('../src/server/models/school.model.ts'),{User}=require('../src/server/models/user.model.ts'),{Student}=require('../src/server/models/student.model.ts'),{ClassModel,SectionModel}=require('../src/server/models/classSection.model.ts'),{AcademicSession}=require('../src/server/models/academicSession.model.ts'),{Subject,TimetableSlot}=require('../src/server/models/subject.model.ts'),{ClassTeacherAssignment}=require('../src/server/models/classTeacherAssignment.model.ts'),{TeachingAssignment}=require('../src/server/models/teacherProfile.model.ts'),{ExamSchedule,ExamTimetable,MarksEntry,ProcessedResult}=require('../src/server/models/exam.model.ts'),{ParentProfile}=require('../src/server/models/parentProfile.model.ts'),{FeeStructure,FeeChallan,FeePayment}=require('../src/server/models/fee.model.ts'),{StudentAttendance}=require('../src/server/models/attendance.model.ts'),{StaffEmployment,StaffDepartment,StaffAttendance,PayrollRecord}=require('../src/server/models/workforce.model.ts'),{LeaveRequest}=require('../src/server/models/leaveRequest.model.ts');
const {SchoolAdminService}=require('../src/server/services/schoolAdmin.service.ts'),{ExamService}=require('../src/server/services/exam.service.ts'),{FinanceService}=require('../src/server/services/finance.service.ts'),{saveExamTimetable}=require('../src/server/services/examTimetable.service.ts'),w=require('../src/server/services/workforce.service.ts'),{branchContext}=require('../src/server/utils/branchScope.ts'),{ROLE_PERMISSION_MAP}=require('../src/server/constants/permissions.constant.ts'),{attendanceValues,monthDates,workingDay}=require('../src/server/services/workforceMath.ts');
const root=path.resolve(__dirname,'../artifacts/school-audit'),privatePath=path.join(root,'demo-credentials.private.json'),tag='APTECH-DEMO-2026',apply=process.argv.includes('--apply');
let manifest={version:1,tag,accounts:{},stages:{},ownership:{}};
function save(){fs.mkdirSync(root,{recursive:true});fs.writeFileSync(privatePath,JSON.stringify(manifest,null,2));}
function credentials(key,role,name,index){if(!manifest.accounts[key]){manifest.accounts[key]={role,name,email:`${role.toLowerCase()}${String(index).padStart(3,'0')}@aptech-demo.example.invalid`,password:crypto.randomBytes(18).toString('base64url')};save();}return manifest.accounts[key];}
const teacherNames=['Sana Ahmed','Bilal Khan','Ayesha Siddiqui','Hamza Ali','Zainab Iqbal','Usman Raza','Fatima Noor','Hassan Shah','Maryam Tariq','Danish Farooq'];
const firstNames=['Ali','Aisha','Ahmed','Sana','Bilal','Zainab','Hamza','Maryam','Usman','Fatima','Hassan','Hira','Zain','Iqra','Saad','Anaya','Omar','Maham','Talha','Noor','Huzaifa','Alina','Abdullah','Hania','Daniyal','Eman','Yusuf','Maira','Rayyan','Hafsa','Musa','Areeba','Ibrahim','Laiba','Arham','Minahil','Mustafa','Saira','Ayan','Mehwish','Salman','Rida','Fahad','Amna','Shayan','Nimra','Haris','Alishba','Asad','Sadia'];
const surnames=['Ahmed','Khan','Siddiqui','Ali','Iqbal','Raza','Shah','Tariq','Farooq','Hussain'];
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const ensure=async(model,query,data)=>{let r=await model.findOne(query);if(!r)r=await model.create(data);return r;};
(async()=>{try{
 await mongoose.connect(env.MONGODB_URI,{serverSelectionTimeoutMS:15000});
 const admin=await User.findOne({email:'fataniammar188@gmail.com',userType:'SCHOOL_ADMIN',status:'ACTIVE'});assert(admin,'Requested existing administrator not found');
 const school=await School.findById(admin.schoolId);assert(school&&school.name==='Aptech International Institute','School identity mismatch');assert(['ACTIVE','TRIAL'].includes(school.status),'School is not approved');
 const schoolId=String(school._id);if(fs.existsSync(privatePath)){manifest=JSON.parse(fs.readFileSync(privatePath,'utf8'));assert(manifest.tag===tag&&manifest.schoolId===schoolId,'Demo manifest identity mismatch');}
 manifest.schoolId=schoolId;manifest.schoolName=school.name;
 const before={students:await Student.countDocuments({schoolId}),teachers:await User.countDocuments({schoolId,userType:'TEACHER'}),parents:await User.countDocuments({schoolId,userType:'PARENT'})};
 if(!apply){console.log(JSON.stringify({mode:'READ ONLY',school:school.name,existing:before,requested:{students:50,teachers:10,primaryParents:50,classes:10,sections:20,subjects:80},writeCommand:'node scripts/seed-school-demo.cjs --apply'},null,2));return;}
 assert(fs.readFileSync(path.resolve(__dirname,'../.gitignore'),'utf8').includes('/artifacts/school-audit/*.private.json'),'Private manifest must be ignored');
 if(!manifest.before)manifest.before=before;save();await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
 const scope={organizationId:schoolId,branchId:schoolId,mainBranchId:schoolId,owner:true,userId:String(admin._id),userType:'SCHOOL_ADMIN',plan:school.status==='TRIAL'?'FREE_TRIAL':school.plan,referenceCache:new Map()};
 await branchContext.run(scope,async()=>{
 const actor={schoolId,userId:String(admin._id),userType:'SCHOOL_ADMIN',email:admin.email,plan:scope.plan,permissions:ROLE_PERMISSION_MAP.SCHOOL_ADMIN};
 const session=await AcademicSession.findOne({schoolId,isCurrent:true});assert(session,'Current academic session required');assert(session.startDate<=new Date('2026-09-01')&&session.endDate>=new Date('2026-09-30'),'Demo periods must belong to the existing session');manifest.sessionId=String(session._id);save();
 await ensure(StaffDepartment,{schoolId,name:'Teaching'},{schoolId,name:'Teaching'});
 const teachers=[];
 for(let i=0;i<10;i++){
  const account=credentials('teacher'+i,'TEACHER',teacherNames[i],i+1);let teacher=await User.findOne({email:account.email});
  if(teacher){assert(String(teacher.schoolId)===schoolId&&teacher.userType==='TEACHER','Demo teacher identity mismatch');}else{const result=await SchoolAdminService.createSchoolTeacher(schoolId,{name:account.name,email:account.email,password:account.password,employeeId:`DEMO-T${String(i+1).padStart(3,'0')}`,phone:'00000000000',qualification:'Demo teaching staff',department:'Teaching',joiningDate:'2026-08-01',salary:45000+i*2500,classAssignments:[]});teacher=await User.findById(result._id);}
  account.userId=String(teacher._id);teachers.push(teacher);save();
 }
 console.log('10 demo teacher accounts ready.');
 const classes=[],sections=[],subjects=[];
 for(let c=0;c<10;c++){
  const name='Class '+(c+1),code=`DEMO-C${String(c+1).padStart(2,'0')}`;let cls=await ClassModel.findOne({schoolId,name});if(cls)assert(cls.code===code,'Existing non-demo class name conflict: '+name);else cls=await ClassModel.create({schoolId,name,code,numericLevel:c+1});classes.push(cls);
  sections[c]=[];subjects[c]=[];
  for(const name of ['A','B'])sections[c].push(await ensure(SectionModel,{schoolId,classId:cls._id,name},{schoolId,classId:cls._id,className:cls.name,name,roomNumber:`DEMO-${c+1}${name}`,capacity:30}));
  const names=c<3?['English','Urdu','Mathematics','General Knowledge','Islamiat','Computer Studies','Art','Physical Education']:c<8?['English','Urdu','Mathematics','General Science','Social Studies','Islamiat','Computer Studies','Physical Education']:['English','Urdu','Mathematics','Physics','Chemistry','Biology','Islamiat','Pakistan Studies'];
  for(let s=0;s<8;s++)subjects[c].push(await ensure(Subject,{schoolId,classId:cls._id,name:names[s]},{schoolId,classId:cls._id,className:cls.name,name:names[s],code:`DEMO-C${c+1}-S${s+1}`,type:'Core',totalMarks:100,passingMarks:33}));
  for(const section of sections[c])await ensure(ClassTeacherAssignment,{schoolId,academicSessionId:session._id,sectionId:section._id},{schoolId,academicSessionId:session._id,classId:cls._id,sectionId:section._id,teacherUserId:teachers[c]._id,teacherName:teachers[c].name});
 }
 manifest.ownership.classes=classes.map(c=>String(c._id));save();console.log('Classes 1-10, A/B sections and 80 class subjects ready.');
 const slots=[],assignmentKeys=new Set(),days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 for(let c=0;c<10;c++)for(let sec=0;sec<2;sec++)for(let d=0;d<6;d++)for(let p=0;p<8;p++){
  const ti=(c+d+p)%10,si=ti%8,subject=subjects[c][si],teacher=teachers[ti],section=sections[c][sec],start=(sec===0?480:750)+p*30;
  const assignmentKey=[c,sec,si,ti].join(':');if(!assignmentKeys.has(assignmentKey)){assignmentKeys.add(assignmentKey);await ensure(TeachingAssignment,{schoolId,academicSessionId:session._id,classId:classes[c]._id,sectionId:section._id,subjectId:subject._id,teacherUserId:teacher._id,status:'ACTIVE'},{schoolId,academicSessionId:session._id,classId:classes[c]._id,sectionId:section._id,subjectId:subject._id,teacherUserId:teacher._id,status:'ACTIVE'});}
  slots.push({schoolId,academicSessionId:session._id,classId:classes[c]._id,sectionId:section._id,dayOfWeek:days[d],periodNumber:p+1,startTime:clock(start),endTime:clock(start+30),subjectId:subject._id,subjectName:subject.name,teacherId:teacher._id,teacherName:teacher.name,roomNumber:section.roomNumber});
 }
 const occupied=new Set();for(const s of slots)for(const k of ['teacherId','sectionId','roomNumber']){const key=[s.dayOfWeek,s.startTime,k,String(s[k])].join(':');assert(!occupied.has(key),'Generated timetable conflict');occupied.add(key);}
 const existingSlots=await TimetableSlot.find({schoolId,academicSessionId:session._id,classId:{$in:classes.map(c=>c._id)}}).lean();const slotKeys=new Set(existingSlots.map(s=>[s.classId,s.sectionId,s.dayOfWeek,s.periodNumber].join(':')));
 const missing=slots.filter(s=>!slotKeys.has([s.classId,s.sectionId,s.dayOfWeek,s.periodNumber].join(':')));if(missing.length)await TimetableSlot.insertMany(missing);console.log('960 conflict-checked weekly lessons ready.');
 const students=[];
 for(let i=0;i<50;i++){
  const c=Math.floor(i/5),section=sections[c][i%5<3?0:1],father=`${surnames[i%10]} Family ${i+1}`,name=firstNames[i]+' '+surnames[i%10],account=credentials('parent'+i,'PARENT',father,i+1),admissionNumber=`DEMO-ADM-${String(i+1).padStart(3,'0')}`;
  let student=await Student.findOne({schoolId,admissionNumber});if(!student)student=await SchoolAdminService.createStudent(schoolId,{name,studentId:`DEMO-STU-${String(i+1).padStart(3,'0')}`,admissionNumber,dob:`${2020-c}-03-${String(5+i%20).padStart(2,'0')}`,gender:i%2?'Female':'Male',classId:String(classes[c]._id),sectionId:String(section._id),academicSessionId:String(session._id),admissionDate:'2026-08-01',address:'Synthetic demo record — Karachi, Pakistan',parentInfo:{fatherName:father,fatherPhone:'00000000000',motherName:'Demo mother '+(i+1),motherPhone:'00000000000',guardianName:father,guardianPhone:'00000000000',guardianEmail:account.email,guardianRelation:'Father'},parentAccount:{password:account.password},emergencyContact:{name:father,phone:'00000000000',relation:'Father'}},undefined,false);
  const parent=await User.findOne({schoolId,email:account.email,userType:'PARENT'});assert(parent,'Automatic parent account missing');assert(await ParentProfile.exists({schoolId,userId:parent._id,studentIds:student._id}),'Primary parent link missing');account.userId=String(parent._id);account.studentId=String(student._id);students.push(student);save();if(i%10===9)console.log((i+1)+' / 50 admissions with primary parents ready.');
 }
 manifest.ownership.students=students.map(s=>String(s._id));save();
 for(let c=0;c<10;c++)for(let sec=0;sec<2;sec++)for(const [di,date] of ['2026-10-01','2026-10-02','2026-10-05','2026-10-06'].entries()){
  const section=sections[c][sec],roster=students.filter(s=>String(s.sectionId)===String(section._id));await ensure(StudentAttendance,{schoolId,classId:classes[c]._id,sectionId:section._id,date:new Date(date+'T00:00:00Z')},{schoolId,classId:classes[c]._id,className:classes[c].name,sectionId:section._id,sectionName:section.name,academicSessionId:session._id,date:new Date(date+'T00:00:00Z'),records:roster.map((s,i)=>({studentId:s._id,studentName:s.name,rollNumber:s.rollNumber,status:(i+di+c)%9===0?'ABSENT':(i+di+c)%11===0?'LATE':'PRESENT'})),markedByUserId:teachers[c]._id,markedByName:teachers[c].name});
 }
 const termConfigs=[{title:'DEMO Mid-Term 2026',term:'MID_TERM',startDate:'2026-09-01',endDate:'2026-09-10',dates:['01','02','03','04','05','07','08','09']},{title:'DEMO Final Term 2026',term:'FINAL_TERM',startDate:'2026-09-14',endDate:'2026-09-24',dates:['14','15','16','17','18','19','21','22']}];
 for(const term of termConfigs){
  let exam=await ExamSchedule.findOne({schoolId,title:term.title});if(!exam)exam=await ExamService.createExam(schoolId,{...term,academicSessionId:String(session._id),classes:classes.map(c=>String(c._id))});
  for(let c=0;c<10;c++){
   for(let s=0;s<8;s++){
    for(let sec=0;sec<2;sec++){const section=sections[c][sec];if(!await ExamTimetable.exists({schoolId,examId:exam._id,sectionId:section._id,subjectId:subjects[c][s]._id}))await saveExamTimetable(schoolId,{examId:String(exam._id),classId:String(classes[c]._id),sectionId:String(section._id),subjectId:String(subjects[c][s]._id),date:'2026-09-'+term.dates[s],startTime:sec===0?'09:00':'11:00',endTime:sec===0?'10:30':'12:30',room:section.roomNumber,supervisorId:String(teachers[c]._id)});}
    if(!manifest.stages[term.term+'-marks-'+c+'-'+s]){
     const roster=students.slice(c*5,c*5+5),records=roster.flatMap((student,k)=>{if(term.term==='FINAL_TERM'&&k===4&&s>=6)return [];const absent=(c+k+s)%17===0;return [{studentId:String(student._id),obtainedMarks:absent?0:45+(c*7+k*9+s*5)%51,isAbsent:absent,remarks:absent?'Absent — demo examination record':'Demo examination record'}];});
     await ExamService.saveMarksEntry(schoolId,{examId:String(exam._id),classId:String(classes[c]._id),subjectId:String(subjects[c][s]._id),maxMarks:100,passingMarks:33,records},'Demo dataset');manifest.stages[term.term+'-marks-'+c+'-'+s]=true;save();
    }
   }
   if(!manifest.stages[term.term+'-processed-'+c]){await ExamService.processResults(schoolId,String(exam._id),String(classes[c]._id),'Demo dataset');if(c<8)await ExamService.publishResults(schoolId,String(exam._id),String(classes[c]._id),true,'Demo dataset');manifest.stages[term.term+'-processed-'+c]=true;save();}console.log(term.term+' Class '+(c+1)+' papers and mixed results ready.');
  }
 }
 for(let c=0;c<10;c++)await ensure(FeeStructure,{schoolId,title:'DEMO Class '+(c+1)+' monthly fees'},{schoolId,title:'DEMO Class '+(c+1)+' monthly fees',academicSession:session.name,classId:classes[c]._id,className:classes[c].name,tuitionFee:2500+c*500,computerFee:200,totalMonthlyFee:2700+c*500,admissionFee:0,examFee:0,transportFee:0,libraryFee:0,otherCharges:0});
 for(let i=0;i<50;i++){
  if(i%6===5)continue;const student=students[i],amount=2700+Math.floor(i/5)*500,number=`DEMO-CH-2026-${String(i+1).padStart(3,'0')}`;
  const challan=await ensure(FeeChallan,{schoolId,challanNumber:number},{schoolId,challanNumber:number,studentId:student._id,studentName:student.name,admissionNumber:student.admissionNumber,rollNumber:student.rollNumber,classId:student.classId,className:student.className,sectionName:student.sectionName,academicSession:session.name,month:'October',dueDate:new Date(i%6===4?'2026-10-01':'2026-10-15'),feeBreakdown:{tuitionFee:amount-200,computerFee:200},totalAmountPKR:amount,paidAmountPKR:0,remainingAmountPKR:amount,status:i%6===4?'OVERDUE':'PENDING'});
  if(i%6<=2&&!await FeePayment.exists({schoolId,challanId:challan._id}))await FinanceService.collectPayment(schoolId,String(challan._id),{amountPKR:i%6===2?Math.floor(amount/2):amount,paymentMethod:i%6===1?'Bank Transfer':'Cash'},'DEMO — synthetic collection');
 }
 console.log('Mixed paid, partial, unpaid, overdue and no-invoice fee records ready.');
 const config=await w.settings(actor);
 for(let i=0;i<10;i++){
  const teacher=teachers[i];let employment=await StaffEmployment.findOne({schoolId,userId:teacher._id});if(!manifest.stages['employment-'+i]){employment.schedule={startTime:'08:00',endTime:'16:30',workingMinutes:510,teacherStart:'SHIFT'};await employment.save();manifest.stages['employment-'+i]=true;save();}
  const policy={...config.policy,...employment.schedule};
  for(const [di,date] of [...monthDates('2026-09'),...['2026-10-01','2026-10-02','2026-10-05','2026-10-06']].entries()){
   if(!workingDay(date,policy,[]).payable)continue;if(await StaffAttendance.exists({schoolId,employeeId:teacher._id,date}))continue;
   const leave=di===8&&i%3===0,absent=di===12&&i%4===0,late=(di+i)%7===0;
   const ci=absent||leave?undefined:new Date(date+'T'+(late?clock(480+policy.graceMinutes+5):'08:00')+':00+05:00'),co=ci?new Date(date+'T16:30:00+05:00'):undefined;
   await StaffAttendance.create({schoolId,employeeId:teacher._id,date,source:'MANUAL',...attendanceValues(date,ci,co,policy),checkedInAt:ci,checkedOutAt:co,status:leave?'LEAVE':absent?'ABSENT':attendanceValues(date,ci,co,policy).status,corrected:true,correctionReason:'Explicitly requested synthetic demo attendance'});
   if(leave)await ensure(LeaveRequest,{schoolId,teacherId:teacher._id,startDate:new Date(date+'T00:00:00Z')},{schoolId,teacherId:teacher._id,teacherName:teacher.name,leaveType:'Casual',startDate:date,endDate:date,totalDays:1,reason:'Demo approved personal leave',status:'APPROVED',reviewComment:'Approved demo leave',reviewedByUserName:'Demo dataset'});
  }
 }
 if(!manifest.stages.payroll){await w.calculate(actor,'2026-09',teachers.map(t=>String(t._id)));manifest.stages.payroll=true;save();}
 for(let i=0;i<10;i++){
  let record=await PayrollRecord.findOne({schoolId,employeeId:teachers[i]._id,month:'2026-09'});assert(record,'Demo payroll missing');
  if(i<8&&record.status==='CALCULATED')record=await w.payrollAction(actor,String(record._id),{action:'SUBMIT'});
  if(i<6&&record.status==='PENDING')record=await w.payrollAction(actor,String(record._id),{action:'APPROVE'});
  if(i<4&&record.status==='APPROVED')record=await w.payrollAction(actor,String(record._id),{action:'PAY',method:i%2?'Bank transfer':'Cash',reference:`DEMO-SALARY-${i+1} — synthetic, no transfer`});
 }
 manifest.completedAt=new Date().toISOString();save();
 const counts={students:students.length,parents:50,teachers:10,classes:classes.length,sections:20,subjects:80,timetableLessons:slots.length,examPapers:await ExamTimetable.countDocuments({schoolId,classId:{$in:classes.map(c=>c._id)}}),feeInvoices:await FeeChallan.countDocuments({schoolId,challanNumber:/^DEMO-/}),feePayments:await FeePayment.countDocuments({schoolId,collectedByUserName:'DEMO — synthetic collection'}),payroll:await PayrollRecord.countDocuments({schoolId,employeeId:{$in:teachers.map(t=>t._id)}})};
 fs.writeFileSync(path.join(root,'demo-dataset-report.json'),JSON.stringify({tag,school:school.name,completedAt:manifest.completedAt,counts,synthetic:true,realMoneyTransferred:false,emailsSent:0,privateCredentialsFile:'demo-credentials.private.json',note:'Compressed synthetic examination cycle for demo; no official curriculum claim. Existing records preserved.'},null,2));console.log('DEMO DATASET COMPLETE: '+JSON.stringify(counts));
 });
 }catch(e){console.error(e.message||'Demo dataset stopped safely');process.exitCode=1;}finally{await mongoose.disconnect();}
})();
