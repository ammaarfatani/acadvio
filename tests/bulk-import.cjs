/* Real MongoDB integration in a separate disposable verification database. */
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
const mongoose=require('mongoose'),XLSX=require('xlsx');
const {env}=require('../src/server/config/env.ts');
const {BulkImportService,parseImportFile}=require('../src/server/services/bulkImport.service.ts');
const {SchoolAdminService}=require('../src/server/services/schoolAdmin.service.ts');
const {IMPORT_COLUMNS}=require('../src/lib/bulk-import.ts');
const {BulkImport}=require('../src/server/models/bulkImport.model.ts');
const {School}=require('../src/server/models/school.model.ts');
const {Student}=require('../src/server/models/student.model.ts');
const {User}=require('../src/server/models/user.model.ts');
const {Role}=require('../src/server/models/role.model.ts');
const {ClassModel,SectionModel}=require('../src/server/models/classSection.model.ts');
const {AcademicSession}=require('../src/server/models/academicSession.model.ts');
const {Subject}=require('../src/server/models/subject.model.ts');
const {TeacherProfile,TeachingAssignment}=require('../src/server/models/teacherProfile.model.ts');
const {AuditLog}=require('../src/server/models/auditLog.model.ts');
const {generateAccessToken}=require('../src/server/utils/jwt.util.ts');
const {comparePassword,hashPassword}=require('../src/server/utils/password.util.ts');
const {createApp}=require('../src/server/app.ts');
const dbName='acadivo_import_test_'+crypto.randomBytes(5).toString('hex');
let server,connected=false;
const password=crypto.randomBytes(16).toString('hex');
function file(entity,records,bookType='xlsx') {
 const columns=IMPORT_COLUMNS[entity],book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([columns.map(c=>c.label),...records.map(r=>columns.map(c=>r[c.key]??''))]),entity==='students'?'Students':'Teachers');
 return XLSX.write(book,{type:'buffer',bookType}).toString('base64');
}
async function wait(id) {for(let n=0;n<180;n++){const j=await BulkImport.findById(id).lean();if(['COMPLETED','FAILED'].includes(j.status))return j;await new Promise(r=>setTimeout(r,500));}throw Error('Import timeout');}
async function fixture(suffix) {
 const school=await School.create({name:'Bulk Import Verification '+suffix,code:'verify-'+suffix,email:suffix+'@example.com',phone:'03001234567',address:'Isolated verification database',studentCountRange:'1000+',teacherCount:0,plan:'ENTERPRISE',status:'ACTIVE'});
 const role=await Role.create({schoolId:school._id,name:'Verification admin',code:'ADMIN',userType:'SCHOOL_ADMIN',permissions:['students.create','students.view','teachers.create','teachers.view','settings.view']});
 const actor=await User.create({schoolId:school._id,roleId:role._id,userType:'SCHOOL_ADMIN',name:'Verification Admin',email:'admin-'+suffix+'@example.com',passwordHash:await hashPassword(password),status:'ACTIVE',isEmailVerified:true});
 const cls=await ClassModel.create({schoolId:school._id,name:'Grade 10',code:'G10',numericLevel:10});
 const section=await SectionModel.create({schoolId:school._id,classId:cls._id,className:cls.name,name:'A'});
 const session=await AcademicSession.create({schoolId:school._id,name:'2026-2027',startDate:new Date('2026-04-01'),endDate:new Date('2027-03-31'),isCurrent:true});
 const subject=await Subject.create({schoolId:school._id,classId:cls._id,className:cls.name,name:'Mathematics',code:'MATH'});
 return {school,role,actor,cls,section,session,subject};
}
function student(i,overrides={}) {return {bFormNumber:i===0?'00123-4567890-1':undefined,name:'Verification Student '+i,studentId:'ST-'+i,admissionNumber:'ADM-'+i,dob:'2012-04-15',gender:'Male',academicSession:'2026-2027',class:'G10',section:'A',address:'Isolated verification address',fatherName:'Verification Parent',fatherPhone:'03001234567',emergencyName:'Verification Parent',emergencyPhone:'03001234567',emergencyRelation:'Father',...overrides};}
function teacher(i,overrides={}) {return {name:'Verification Teacher '+i,email:'teacher-'+i+'@example.com',password,employeeId:'EMP-'+i,qualification:'B.Ed',class:'G10',section:'A',subject:'MATH',academicSession:'2026-2027',...overrides};}
(async()=>{
 try {
  await mongoose.connect(env.MONGODB_URI,{dbName,serverSelectionTimeoutMS:15000});connected=true;
  const hello=await mongoose.connection.db.admin().command({hello:1});assert(hello.setName||hello.msg==='isdbgrid','Verification MongoDB must support transactions');
  await Promise.all([BulkImport,School,Student,User,Role,ClassModel,SectionModel,AcademicSession,Subject,TeacherProfile,TeachingAssignment,AuditLog].map(m=>m.init()));
  const legacyColumns=IMPORT_COLUMNS.students.filter(c=>c.key!=='bFormNumber'),legacyBook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(legacyBook,XLSX.utils.aoa_to_sheet([legacyColumns.map(c=>c.label),legacyColumns.map(c=>student(9999)[c.key]??'')]),'Students');assert.equal(parseImportFile('students','legacy.xlsx',XLSX.write(legacyBook,{type:'buffer',bookType:'xlsx'}).toString('base64')).length,1,'old template without B-Form still accepted');
  const a=await fixture('a'),b=await fixture('b'),sid=String(a.school._id),aid=String(a.actor._id);
  server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api';
  const token=(f,type='SCHOOL_ADMIN')=>generateAccessToken({userId:String(f.actor._id),schoolId:String(f.school._id),email:f.actor.email,userType:type});
  async function request(path,body,auth=token(a)){const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};}
  for(const entity of ['students','teachers']) {const buffer=await BulkImportService.template(sid,entity),book=XLSX.read(buffer);assert(book.SheetNames.includes('Example (do not import)'));assert.equal(XLSX.utils.sheet_to_json(book.Sheets[entity==='students'?'Students':'Teachers']).length,0);assert.throws(()=>parseImportFile(entity,'template.xlsx',buffer.toString('base64')),/./);}
  for(const format of ['xlsx','xls','csv']) assert.equal(parseImportFile('students','valid.'+format,file('students',[student(0)],format)).length,1);
  assert.throws(()=>parseImportFile('students','bad.xlsx','AA=='));
  const data=Array.from({length:1001},(_,i)=>student(i));
  const p=await request('/school-admin/students/bulk-import/preview',{filename:'students.xlsx',base64:file('students',data),schoolId:String(b.school._id)});assert.equal(p.status,200);assert.equal(p.body.data.summary.ready,1001);const id=p.body.data.id;
  assert.equal(await Student.countDocuments({schoolId:sid}),0,'Preview must never insert students');
  const cross=await request('/school-admin/students/bulk-import/'+id,undefined,token(b));assert.equal(cross.status,404);
  const commits=await Promise.all([request('/school-admin/students/bulk-import/'+id+'/commit',{skipDuplicates:true}),request('/school-admin/students/bulk-import/'+id+'/commit',{skipDuplicates:true})]);assert(commits.every(r=>r.status===202));
  const completed=await wait(id);assert.equal(completed.status,'COMPLETED',completed.message);assert.equal(completed.summary.imported,1001);assert.equal(await Student.countDocuments({schoolId:sid}),1001);assert.equal(await Student.countDocuments({schoolId:b.school._id}),0);
  await request('/school-admin/students/bulk-import/'+id+'/commit',{skipDuplicates:true});assert.equal(await Student.countDocuments({schoolId:sid}),1001);
  assert.equal((await request('/school-admin/students/bulk-import/'+id+'?page=21')).body.data.rows.length,1);
  assert.equal((await Student.findOne({schoolId:sid,studentId:'ST-0'})).bFormNumber,'00123-4567890-1');
  console.log('PASS: 1,001 real MongoDB student inserts, transactions, replay prevention, tenant isolation and pagination');
  const mixed=[student(0),student(2000,{name:''}),student(2001,{class:'Unknown'}),student(2002,{section:'Unknown'}),student(2003,{dob:'2026-02-30'}),student(2004,{guardianEmail:'invalid'}),student(2005),student(2005),student(2006,{class:String(b.cls._id)})];
  const issues=await BulkImportService.preview(sid,aid,'students','errors.xlsx',file('students',mixed));assert.equal(issues.summary.duplicate,3);assert.equal(issues.summary.invalid,6);assert.equal(issues.summary.ready,0);
  const errors=XLSX.read(await BulkImportService.errorReport(sid,aid,issues.id));assert.equal(XLSX.utils.sheet_to_json(errors.Sheets['Import errors']).length,9);
  const manual=await request('/school-admin/students',{name:'Manual Regression Student',dob:'2012-04-15',gender:'Male',classId:String(a.cls._id),className:a.cls.name,sectionId:String(a.section._id),academicSessionId:String(a.session._id),address:'Manual regression address',parentInfo:{fatherName:'Parent',fatherPhone:'03001234567'},emergencyContact:{name:'Parent',phone:'03001234567',relation:'Father'}});assert.equal(manual.status,201,JSON.stringify(manual.body));
  const directory=await request('/school-admin/students');assert(directory.body.data.some(s=>s.name==='Manual Regression Student'));
  console.log('PASS: missing fields, invalid dates/email/class/section, cross-tenant references, duplicate IDs and error report; manual student API preserved');
  const teachers=[teacher(1),teacher(2,{class:'',section:'',subject:''}),teacher(3,{email:'invalid'}),teacher(4,{subject:'Unknown'}),teacher(5),teacher(5)];
  const tp=await BulkImportService.preview(sid,aid,'teachers','teachers.xlsx',file('teachers',teachers));assert.equal(tp.summary.ready,2);assert.equal(tp.summary.invalid,2);assert.equal(tp.summary.duplicate,2);assert(!JSON.stringify(tp).includes(password));
  const staged=await BulkImport.findById(tp.id).select('+rows').lean();assert(!JSON.stringify(staged).includes(password),'Never store plaintext initial passwords');
  await BulkImportService.start(sid,aid,tp.id,true);const tj=await wait(tp.id);assert.equal(tj.summary.imported,2,tj.message);assert.equal(await TeacherProfile.countDocuments({schoolId:sid}),2);assert.equal(await TeachingAssignment.countDocuments({schoolId:sid}),1);
  const imported=await User.findOne({email:'teacher-1@example.com'});assert(await comparePassword(password,imported.passwordHash));assert.equal(imported.userType,'TEACHER');
  const teacherReport=XLSX.read(await BulkImportService.errorReport(sid,aid,tp.id));assert(!JSON.stringify(XLSX.utils.sheet_to_json(teacherReport.Sheets['Import errors'])).includes(password));
  assert(/^EMPD\d+$/.test(imported.employeeId),'Imported staff must have automatic IDs');assert.equal((await TeacherProfile.findOne({userId:imported._id})).employeeId,imported.employeeId);const importedSecond=await User.findOne({email:'teacher-2@example.com'});
  const teacherDup=await BulkImportService.preview(sid,aid,'teachers','duplicate.xlsx',file('teachers',[teacher(1),teacher(9,{employeeId:importedSecond.employeeId}),teacher(10,{email:b.actor.email})]));assert.equal(teacherDup.summary.duplicate,3);
  const race=await BulkImportService.preview(sid,aid,'teachers','race.xlsx',file('teachers',[teacher(20)]));
  const manualTeacher=await request('/school-admin/teachers',{name:'Manual Regression Teacher',email:'teacher-20@example.com',password,employeeId:'EMP-20',assignments:[{academicSessionId:String(a.session._id),classId:String(a.cls._id),sectionId:String(a.section._id),subjectId:String(a.subject._id)}]});assert.equal(manualTeacher.status,201,JSON.stringify(manualTeacher.body));
  await BulkImportService.start(sid,aid,race.id,true);assert.equal((await wait(race.id)).summary.duplicate,1);
  const teacherDirectory=await request('/school-admin/teachers');assert(teacherDirectory.body.data.some(t=>t.name==='Manual Regression Teacher'));
  const denied=await request('/school-admin/students/bulk-import/template',undefined,generateAccessToken({userId:String(imported._id),schoolId:sid,email:imported.email,userType:'TEACHER'}));assert.equal(denied.status,403);
  console.log('PASS: teacher user/profile/assignment imports, password protection and real login hash, duplicate accounts, post-preview revalidation, manual teacher API and role restrictions');
  const bad=await BulkImportService.preview(sid,aid,'teachers','rollback.xlsx',file('teachers',[teacher(30)]));const original=TeacherProfile.insertMany;TeacherProfile.insertMany=async()=>{const e=new Error('Fault injection');e.name='ValidationError';throw e;};
  try {await BulkImportService.start(sid,aid,bad.id,true);const result=await wait(bad.id);assert.equal(result.summary.failed,1);assert.equal(await User.countDocuments({email:'teacher-30@example.com'}),0,'Failed profile must roll back user');}finally{TeacherProfile.insertMany=original;}
  assert(await AuditLog.countDocuments({schoolId:sid,action:'BULK_IMPORT'})>=3);
  console.log('PASS: transaction rollback leaves no orphan teacher login; audit records persisted');
  const expired=await BulkImportService.preview(sid,aid,'students','expiry.xlsx',file('students',[student(4000)]));await BulkImport.updateOne({_id:expired.id},{$set:{expiresAt:new Date(Date.now()-1000)}});await assert.rejects(BulkImportService.get(sid,aid,expired.id));
  await School.updateOne({_id:sid},{$set:{plan:'STARTER'}});const quota=await BulkImportService.preview(sid,aid,'students','capacity.xlsx',file('students',[student(5000)]));assert.equal(quota.summary.ready,0);
  console.log('PASS: expiry and subscription capacity checks');
  await School.updateOne({_id:sid},{$set:{plan:'ENTERPRISE'}});
  const recovery=await BulkImportService.preview(sid,aid,'students','recovery.xlsx',file('students',[student(6000),student(6001)]));
  const stored=await BulkImport.findById(recovery.id).select('+rows').lean();const committed=stored.rows[0];
  await Student.create({...committed.data,_id:new mongoose.Types.ObjectId(committed.recordId),schoolId:sid,status:'ACTIVE'});
  await BulkImport.updateOne({_id:recovery.id},{$set:{status:'PROCESSING',leaseToken:'expired-worker',leaseUntil:new Date(Date.now()-1000),'rows.0.status':'IMPORTED','rows.0.data':null}});
  const competing=await BulkImportService.preview(sid,aid,'students','competing.xlsx',file('students',[student(6002)]));
  await assert.rejects(BulkImportService.start(sid,aid,competing.id,true),e=>e.statusCode===409);
  await BulkImportService.resume();const resumed=await wait(recovery.id);assert.equal(resumed.summary.imported,2);assert.equal(await Student.countDocuments({schoolId:sid,studentId:{$in:['ST-6000','ST-6001']}}),2);
  console.log('PASS: expired worker lease recovery preserves committed rows and serializes competing school imports');

  console.log('All bulk import integration checks passed. Production school records were never used or changed.');
 } finally {
  if(server) await new Promise(r=>server.close(r));
  if(connected){assert(mongoose.connection.name===dbName&&dbName.startsWith('acadivo_import_test_'));await mongoose.connection.dropDatabase();}
  await mongoose.disconnect();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
