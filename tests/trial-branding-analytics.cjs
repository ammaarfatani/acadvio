const fs = require("node:fs"), ts = require("typescript"), assert = require("node:assert/strict");
require.extensions[".ts"] = (module,file) => module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText,file);
const mongoose = require("mongoose");
const { matches, apply } = require("./memory-db.cjs");
const { School } = require("../src/server/models/school.model.ts");
const { User } = require("../src/server/models/user.model.ts");
const { Role } = require("../src/server/models/role.model.ts");
const { Subscription } = require("../src/server/models/subscription.model.ts");
const { Student } = require("../src/server/models/student.model.ts");
const { SubscriptionPayment: Payment } = require("../src/server/models/subscriptionPayment.model.ts");
const { AcademicSession } = require("../src/server/models/academicSession.model.ts");
const { LoginActivity } = require("../src/server/models/loginActivity.model.ts");
const { PublicService } = require("../src/server/services/public.service.ts");
const { RegisterSchoolSchema } = require("../src/server/validators/public.validator.ts");
const { expireTrials } = require("../src/server/services/trialLifecycle.service.ts");
const { platformAnalytics, analyticsPeriodStart } = require("../src/server/services/platformAnalytics.service.ts");
const { generateAccessToken } = require("../src/server/utils/jwt.util.ts");
const { createApp } = require("../src/server/app.ts");
const schools = [], users = [], subscriptions = [], students = [], sessions = [], payments = [];
const role = { _id: new mongoose.Types.ObjectId(), permissions: ["settings.view","settings.update"] };
function query(record, userQuery = false) {
  let value = record;
  const q = {
    populate(key) {
      if (value && userQuery) {
        if (!value.toObject) value = { ...value };
        else value = { ...value.toObject(), save: async function() { Object.assign(record,{ refreshTokenHash: this.refreshTokenHash, lastLogin: this.lastLogin }); } };
        if (key === "roleId") value.roleId = role;
        if (key === "schoolId") value.schoolId = schools.find(s => String(s._id) === String(record.schoolId));
      }
      return q;
    },
    select() { return q; },
    then(resolve,reject) { return Promise.resolve(value).then(resolve,reject); },
  };
  return q;
}
function create(Model, records, data) {
  const doc = new Model(data), error = doc.validateSync();
  if (error) throw error;
  doc.save = async () => doc;
  records.push(doc);
  return doc;
}
School.findOne = filter => query(schools.find(s => matches(s,filter)) || null);
School.findById = id => query(schools.find(s => String(s._id) === String(id)) || null);
School.create = async data => create(School, schools, data);
School.findByIdAndUpdate = async (id, update) => { const doc = schools.find(s => String(s._id) === String(id)); if (doc) apply(doc,update); return doc; };
School.updateMany = async (filter,update) => schools.filter(s => matches(s,filter)).forEach(s => apply(s,update));
Subscription.updateMany = async (filter,update) => subscriptions.filter(s => matches(s,filter)).forEach(s => apply(s,update));
Subscription.create = async data => create(Subscription,subscriptions,data);
User.findOne = filter => query(users.find(u => matches(u,filter)) || null,true);
User.findById = id => query(users.find(u => String(u._id) === String(id)) || null,true);
User.create = async data => create(User,users,data);
Role.findOne = () => query(role);
AcademicSession.create = async data => { sessions.push(data); return data; };
LoginActivity.create = async () => ({});
School.distinct = async (_field,filter) => schools.filter(s => matches(s,filter)).map(s => s._id);
School.aggregate = async pipeline => {
  const groups = {};
  schools.filter(s => matches(s,pipeline[0].$match)).forEach(s => groups[s.status] = (groups[s.status] || 0)+1);
  return Object.entries(groups).map(([_id,count]) => ({ _id,count }));
};
User.countDocuments = async filter => users.filter(u => matches(u,filter)).length;
Student.countDocuments = async filter => students.filter(s => matches(s,filter)).length;
Subscription.countDocuments = async filter => subscriptions.filter(s => matches(s,filter)).length;
Payment.aggregate = async pipeline => {
  const rows = payments.filter(p => matches(p,pipeline[0].$match));
  if (!rows.length) return [];
  const group = pipeline[1].$group;
  if (group._id === null) return [{ _id: null, amount: rows.reduce((sum,p) => sum+p.amount,0), count: rows.length }];
  const groups = {};
  rows.forEach(p => {
    const date = new Date(+p.reviewedAt+5*3600000).toISOString();
    const format = group._id.$dateToString.format;
    const key = format === "%Y-%m" ? date.slice(0,7) : format.includes("%H") ? date.slice(0,13).replace("T"," ")+":00" : date.slice(0,10);
    const entry = groups[key] ||= { _id:key, amount:0, payments:0 }; entry.amount += p.amount; entry.payments++;
  });
  return Object.values(groups).sort((a,b) => a._id.localeCompare(b._id));
};
for (const Model of [School,User,Student,Subscription,AcademicSession]) for (const method of ["deleteMany","deleteOne","findByIdAndDelete"]) Model[method] = () => { throw new Error("Destructive operation attempted on "+Model.modelName); };
(async () => {
  const input = RegisterSchoolSchema.parse({ schoolName:"Lifecycle Test School", schoolEmail:"school@example.invalid", schoolPhone:"03001234567", schoolAddress:"Test Street", adminName:"Test Principal", adminEmail:"principal@example.invalid", password:"TestPassword123", teacherCount:0, selectedPlan:"ENTERPRISE" });
  assert.equal(input.registrationType,"trial"); assert.equal(input.selectedPlan,undefined);
  assert.equal(RegisterSchoolSchema.safeParse({ ...input, registrationType:"paid" }).success,false);
  const registered = await PublicService.registerSchoolApplication(input);
  const school = schools[0], admin = users[0], sub = subscriptions[0];
  assert.equal(school.plan,"FREE_TRIAL"); assert.equal(school.status,"TRIAL"); assert.equal(sub.price,0); assert.equal(sub.plan,"FREE_TRIAL"); assert.equal(admin.status,"ACTIVE");
  assert.equal(+school.trialEndsAt-+school.trialStartedAt,14*86400000); assert.equal(sessions.length,1);
  students.push({ _id:new mongoose.Types.ObjectId(), schoolId:school._id, name:"Existing student" });
  const preserved = JSON.stringify({ students, sessions, adminId:admin._id, schoolId:school._id });
  school.trialEndsAt = new Date(Date.now()-1000); sub.trialEndsAt = school.trialEndsAt;
  await expireTrials(String(school._id));
  assert.equal(school.status,"TRIAL_EXPIRED"); assert.equal(sub.status,"TRIAL_EXPIRED");
  assert.equal(JSON.stringify({ students, sessions, adminId:admin._id, schoolId:school._id }),preserved);
  const other = create(School,schools,{ name:"Other School", code:"other", email:"other@example.invalid", phone:"03001234567", address:"Other Street", studentCountRange:"1-200", plan:"FREE_TRIAL", status:"TRIAL" });
  const teacher = create(User,users,{ name:"Test Teacher", email:"teacher@example.invalid", passwordHash:admin.passwordHash, schoolId:school._id, userType:"TEACHER", status:"ACTIVE", roleId:role._id });
  const token = id => generateAccessToken({ userId:String(id), email:"test@example.invalid", userType:"SCHOOL_ADMIN", schoolId:String(other._id) });
  const server = createApp().listen(0,"127.0.0.1");
  await new Promise(resolve => server.once("listening",resolve));
  const base = "http://127.0.0.1:"+server.address().port+"/api";
  const call = async (path, id=admin._id, method="GET", body) => {
    const res = await fetch(base+path,{ method, headers:{"Content-Type":"application/json",Authorization:"Bearer "+token(id)}, ...(body ? { body:JSON.stringify(body) } : {}) });
    return { status:res.status, data:await res.json() };
  };
  try {
    const me = await call("/auth/me");
    assert.equal(me.status,200); assert.equal(me.data.data.school.status,"TRIAL_EXPIRED"); assert.equal(String(me.data.data.school._id),String(registered.schoolId));
    assert.equal((await call("/school-admin/students")).status,403);
    assert.equal((await call("/auth/me",teacher._id)).status,403);
    const login = await fetch(base+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ email:input.adminEmail,password:input.password })});
    assert.equal(login.status,200);
    const loginData = await login.json(); assert.equal(loginData.data.user.school.status,"TRIAL_EXPIRED");
    assert.equal(users.length,2); assert.equal(schools.length,2);
    school.status = "ACTIVE"; sub.status = "ACTIVE";
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1kAAAAASUVORK5CYII=";
    const uploaded = await call("/schools/logo",admin._id,"PUT",{ image:png,schoolId:String(other._id) });
    assert.equal(uploaded.status,200); assert.equal(school.logoUrl,png); assert.equal(other.logoUrl,undefined);
    assert.equal((await call("/auth/me",teacher._id)).data.data.school.logoUrl,png);
    assert.equal((await call("/schools/logo",teacher._id,"PUT",{image:null})).status,403);
    assert.equal((await call("/schools/logo",admin._id,"PUT",{image:"data:image/svg+xml;base64,PHN2Zz4="})).status,400);
    assert.equal((await call("/schools/logo",admin._id,"PUT",{image:"data:image/png;base64,"+Buffer.alloc(1024*1024+1).toString("base64")})).status,400);
    assert.equal((await call("/schools/logo",admin._id,"PUT",{image:null})).status,200);
    assert.equal(school.logoUrl,""); assert.equal(other.logoUrl,undefined);
  } finally { server.close(); server.closeAllConnections(); }
  const now = new Date("2026-10-02T10:00:00Z");
  const demo = create(School,schools,{name:"Fixture School",code:"fixture",email:"fixture@example.invalid",phone:"03001234567",address:"Fixture Street",studentCountRange:"1-200",status:"ACTIVE",plan:"PROFESSIONAL",isDemo:true});
  payments.push(
    { schoolId:school._id,status:"APPROVED",amount:5000,reviewedAt:new Date("2026-10-02T09:00:00Z") },
    { schoolId:school._id,status:"APPROVED",amount:3000,reviewedAt:new Date("2026-10-01T18:00:00Z") },
    { schoolId:school._id,status:"PENDING",amount:999999,reviewedAt:now },
    { schoolId:school._id,status:"REJECTED",amount:999999,reviewedAt:now },
    { schoolId:demo._id,status:"APPROVED",amount:999999,reviewedAt:now },
  );
  const today = await platformAnalytics("today",now), month = await platformAnalytics("month",now);
  assert.equal(today.revenuePKR,5000); assert.equal(month.revenuePKR,8000); assert.equal(month.totalRevenuePKR,8000);
  assert.equal(month.totalSchools,2); assert.equal(month.totalStudents,1); assert.equal(month.totalTeachers,1);
  assert.equal(today.revenueSeries.length,1); assert.equal(+analyticsPeriodStart("today",now),+new Date("2026-10-01T19:00:00Z"));
  await assert.rejects(() => platformAnalytics("invalid",now), error => error.statusCode===400);
  payments.length=0; schools.length=0; users.length=0; subscriptions.length=0; students.length=0;
  const empty = await platformAnalytics("year",now);
  assert.equal(empty.revenuePKR,0); assert.equal(empty.totalSchools,0); assert.equal(empty.totalTeachers,0); assert.deepEqual(empty.revenueSeries,[]);
  console.log("PASS: single standard trial, existing-account login after expiry, preserved records, tenant-owned logo upload/removal and role checks, approved-only revenue, Karachi date filters and empty database zeros (mocked persistence).");
})().catch(error => { console.error(error); process.exitCode=1; });
