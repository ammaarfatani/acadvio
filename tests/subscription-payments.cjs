const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
const assert = require("node:assert/strict");
const { matches, apply } = require("./memory-db.cjs");
const { decodePaymentImage } = require("../src/server/services/paymentImage.ts");
const { User } = require("../src/server/models/user.model.ts");
const { School } = require("../src/server/models/school.model.ts");
const { Plan } = require("../src/server/models/plan.model.ts");
const { PublicService } = require("../src/server/services/public.service.ts");
const { Subscription } = require("../src/server/models/subscription.model.ts");
const { SubscriptionPayment: Payment } = require("../src/server/models/subscriptionPayment.model.ts");
const mongoose = require("mongoose");
const { generateAccessToken } = require("../src/server/utils/jwt.util.ts");
const { createApp } = require("../src/server/app.ts");
if (process.env.PAYMENT_TEST_PREVIEW) require("../src/server/config/env.ts").env.FRONTEND_URL = "http://localhost:3001";
const { subscriptionPeriodEnd } = require("../src/server/services/subscriptionPaymentReview.service.ts");
assert.equal(subscriptionPeriodEnd(new Date(2024, 0, 31), "monthly").getDate(), 29);
assert.equal(subscriptionPeriodEnd(new Date(2024, 1, 29), "annual").getDate(), 28);
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1kAAAAASUVORK5CYII=";
assert.equal(decodePaymentImage(png).mime, "image/png");
for (const image of [undefined, "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,aGVsbG8=", "data:image/jpeg;base64,aGVsbG8=", "data:image/png;base64," + Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64")]) assert.throws(() => decodePaymentImage(image));
const schoolId = new mongoose.Types.ObjectId().toString();
const otherSchool = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId().toString();
const superId = new mongoose.Types.ObjectId().toString();
let school = { _id: schoolId, status: "PENDING_APPROVAL", registrationType: "paid" };
let user = { _id: userId, schoolId, status: "PENDING_APPROVAL", userType: "SCHOOL_ADMIN", email: "test@example.invalid" };
const superUser = { _id: superId, status: "ACTIVE", userType: "SUPER_ADMIN" };
let sub = { _id: new mongoose.Types.ObjectId().toString(), schoolId, plan: "PROFESSIONAL", price: 9999, billingCycle: "monthly" };
let payments = [];
const chain = value => ({ exec(){ return Promise.resolve(value); }, populate() { return this; }, select() { return this; }, sort() { return this; }, limit() { return this; }, session() { return this; }, lean() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const catalogue = [
  { code: "STARTER", name: "Starter Plan", priceMonthlyPKR: 4999, priceAnnualPKR: 3999, isActive: true },
  { code: "PROFESSIONAL", name: "Professional Plan", priceMonthlyPKR: 9999, priceAnnualPKR: 7999, isActive: true },
  { code: "ENTERPRISE", name: "Enterprise Plan", priceMonthlyPKR: 19999, priceAnnualPKR: 15999, isActive: true },
];
Plan.find = async () => catalogue;
let registeredInput;
PublicService.registerSchoolApplication = async data => { registeredInput = data; return { schoolId, status: "PENDING_APPROVAL", message: "Application submitted" }; };
const { Branch } = require("../src/server/models/branch.model.ts");
Branch.findOneAndUpdate = async () => ({ _id: schoolId, status: "ACTIVE" });
Branch.findOne = async () => ({ _id: schoolId, status: "ACTIVE" });
User.findOne = () => chain(user);
User.updateOne = async (_filter,update) => { Object.assign(user, update.$set); };
User.findById = id => chain(id === superId ? superUser : user);
School.findById = () => chain(school);
School.updateMany = async (filter, update) => matches(school, filter) ? apply(school, update) : {};
Subscription.updateMany = async (filter, update) => matches(sub, filter) ? apply(sub, update) : {};
Subscription.findOne = () => Promise.resolve(sub);
Subscription.findById = () => chain(sub);
Payment.init = async () => {};
const { AcademicSession } = require("../src/server/models/academicSession.model.ts");
AcademicSession.findOne = () => chain({ isCurrent: true });
Payment.find = filter => chain(payments.filter(p => !filter.schoolId || p.schoolId === filter.schoolId));
Payment.create = async data => {
  if (payments.some(p => p.schoolId === data.schoolId && (p.status === "PENDING" || p.screenshotHash === data.screenshotHash))) throw { code: 11000 };
  const payment = { ...data, _id: new mongoose.Types.ObjectId().toString(), status: "PENDING", submittedAt: new Date() }; payments.push(payment); return payment;
};
Payment.findOne = filter => chain(payments.find(p => matches(p, filter)) || null);
Payment.findOneAndUpdate = async (filter, update) => { const p = payments.find(p => matches(p, filter)); return p ? apply(p, update) : null; };
Payment.updateOne = async (filter, update) => { const p = payments.find(p => matches(p,filter)); if (p) apply(p,update); return { matchedCount: p ? 1 : 0 }; };
Subscription.updateOne = async (filter, update) => { const matched = matches(sub,filter); if (matched) apply(sub, update); return { matchedCount: matched ? 1 : 0 }; };
School.updateOne = async (_filter, update) => { Object.assign(school, update.$set); return { matchedCount: 1 }; };
User.updateMany = async () => { user.status = "ACTIVE"; };
mongoose.startSession = async () => { throw Object.assign(new Error("Transaction numbers are only allowed on a replica set member or mongos"), { code: 20 }); };
delete process.env.SMTP_HOST;
const tokens = { user: generateAccessToken({ userId, userType: "SCHOOL_ADMIN", email: user.email, schoolId }), super: generateAccessToken({ userId: superId, userType: "SUPER_ADMIN", email: "super@example.invalid" }) };
(async () => {
  const server = createApp().listen(process.env.PAYMENT_TEST_PREVIEW ? 5000 : 0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  const call = async (path, actor, method = "GET", body) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(actor ? { Authorization: "Bearer " + tokens[actor] } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
  };
  try {
    const plans = await call("/subscription-payments/plans");
    assert.equal(plans.status, 200); assert.equal(plans.body.data.length, 3);
    for (const plan of catalogue) {
      for (const cycle of ["monthly", "annual"]) {
        const quote = await call("/subscription-payments/quote?plan="+plan.code+"&billingCycle="+cycle);
        assert.equal(quote.status, 200);
        assert.equal(quote.body.data.subscription.price, cycle === "annual" ? plan.priceAnnualPKR*12 : plan.priceMonthlyPKR);
      }
    }
    assert.equal((await call("/subscription-payments/quote?plan=INVALID&billingCycle=monthly")).status, 400);
    assert.equal((await call("/subscription-payments/quote?plan=STARTER&billingCycle=weekly")).status, 400);
    catalogue[0].isActive = false;
    assert.equal((await call("/subscription-payments/quote?plan=STARTER&billingCycle=monthly")).status, 400);
    catalogue[0].isActive = true;
    const signup = await call("/public/register-school", null, "POST", { schoolName: "Test School", schoolEmail: "school@example.invalid", schoolPhone: "03001234567", schoolAddress: "Test Street", adminName: "Test Admin", adminEmail: "admin@example.invalid", password: "TestPassword123", teacherCount: 10, registrationType: "paid", selectedPlan: "PROFESSIONAL" });
    assert.equal(signup.status, 201); assert.equal(registeredInput.selectedPlan, "PROFESSIONAL"); assert.equal(registeredInput.studentCountRange, "201-500");
    assert.equal((await call("/subscription-payments/mine")).status, 401);
    assert.equal((await call("/subscription-payments", "user", "POST", { screenshot: png, plan: "INVALID", billingCycle: "monthly" })).status, 400);
    assert.equal((await call("/subscription-payments/mine", "user")).status, 200);
    assert.equal((await call("/school-admin/profile", "user")).status, 403);
    assert.equal((await call("/subscription-payments", "user", "POST", {})).status, 400);
    const submitted = await call("/subscription-payments", "user", "POST", { screenshot: png, plan: "STARTER", billingCycle: "monthly", schoolId: otherSchool, userId: superId, amount: 1 });
    assert.equal(submitted.status, 200); assert.equal(payments[0].schoolId, schoolId); assert.equal(payments[0].userId, userId); assert.equal(payments[0].amount, 4999); assert.equal(payments[0].plan, "STARTER"); assert.equal(sub.plan, "PROFESSIONAL");
    const id = submitted.body.data.id;
    assert.equal((await call("/subscription-payments", "user", "POST", { screenshot: png })).status, 409);
    assert.equal((await call("/subscription-payments/"+id+"/review", "user", "PATCH", { status: "APPROVED" })).status, 403);
    assert.equal((await call("/subscription-payments/"+id+"/screenshot", "user")).status, 200);
    user.schoolId = otherSchool;
    assert.equal((await call("/subscription-payments/"+id+"/screenshot", "user")).status, 404);
    user.schoolId = schoolId;
    assert.equal((await call("/subscription-payments/"+id+"/review", "super", "PATCH", { status: "REJECTED", rejectionReason: " " })).status, 400);
    assert.equal((await call("/subscription-payments/"+id+"/review", "super", "PATCH", { status: "REJECTED", rejectionReason: "Unreadable reference" })).status, 200);
    assert.equal(payments[0].status, "REJECTED"); assert.equal(school.status, "PENDING_APPROVAL");
    assert.equal((await call("/subscription-payments/mine", "user")).body.data.payments[0].rejectionReason, "Unreadable reference");
    assert.equal((await call("/subscription-payments/"+id+"/review", "super", "PATCH", { status: "APPROVED" })).status, 409);
    const second = await call("/subscription-payments", "user", "POST", { screenshot: png.replace("iVBORw0KGgo", "iVBORw0KGgo") + "" });
    assert.equal(second.status, 409);
    const freshPng = "data:image/png;base64," + Buffer.concat([decodePaymentImage(png).bytes, Buffer.from([0])]).toString("base64");
    const next = await call("/subscription-payments", "user", "POST", { screenshot: freshPng, plan: "ENTERPRISE", billingCycle: "annual", amount: 1 });
    assert.equal(next.status, 200);
    assert.equal((await call("/subscription-payments/"+next.body.data.id+"/review", "super", "PATCH", { status: "APPROVED" })).status, 200);
    assert.equal(payments[1].amount, 15999*12); assert.equal(sub.plan, "ENTERPRISE"); assert.equal(school.plan, "ENTERPRISE"); assert.equal(sub.billingCycle, "annual");
    assert.equal(school.status, "ACTIVE"); assert.equal(user.status, "ACTIVE"); assert.equal(sub.paymentStatus, "PAID"); assert.ok(sub.currentPeriodEnd > new Date());
    // A failed school activation remains visible and resumable, without extending the period twice.
    school.status = "TRIAL_EXPIRED";
    sub.status = "TRIAL_EXPIRED"; sub.plan = "FREE_TRIAL"; sub.price = 0;
    const retryPng = "data:image/png;base64,"+Buffer.concat([decodePaymentImage(png).bytes, Buffer.from([2])]).toString("base64");
    const retryPayment = await call("/subscription-payments", "user", "POST", { screenshot: retryPng, plan: "PROFESSIONAL", billingCycle: "monthly" });
    assert.equal(retryPayment.status, 200);
    const updateSchool = School.updateOne;
    let failOnce = true;
    School.updateOne = async (...args) => { if (failOnce) { failOnce = false; throw new Error("Simulated activation failure"); } return updateSchool(...args); };
    assert.equal((await call("/subscription-payments/"+retryPayment.body.data.id+"/review", "super", "PATCH", { status: "APPROVED" })).status, 500);
    const incomplete = payments[2]; const fixedEnd = +incomplete.approvedPeriodEnd;
    assert.equal(incomplete.status, "APPROVED"); assert.equal(incomplete.activationComplete, false);
    assert.equal(school.status, "TRIAL_EXPIRED");
    assert.equal((await call("/subscription-payments", "user", "POST", { screenshot: retryPng, plan: "STARTER", billingCycle: "monthly" })).status, 409);
    incomplete.reviewLeaseUntil = new Date(Date.now()+60000);
    assert.equal((await call("/subscription-payments/"+retryPayment.body.data.id+"/review", "super", "PATCH", { status: "APPROVED" })).status, 409);
    assert.equal((await call("/subscription-payments/"+retryPayment.body.data.id+"/review", "super", "PATCH", { status: "REJECTED", rejectionReason: "Conflicting decision" })).status, 409);
    delete incomplete.reviewLeaseUntil;
    const completed = await call("/subscription-payments/"+retryPayment.body.data.id+"/review", "super", "PATCH", { status: "APPROVED" });
    assert.equal(completed.status, 200); assert.equal(+sub.currentPeriodEnd, fixedEnd); assert.equal(incomplete.activationComplete, true);
    assert.equal(String(incomplete.schoolId), schoolId); assert.equal(String(incomplete.userId), userId);
    console.log("PASS: monthly/annual catalogue quotes, invalid/inactive plans, existing registration route, selected-plan activation, upload validation, authenticated submission, server-owned amount/tenant, duplicates, screenshot ownership, RBAC, rejection and approval activation (mocked persistence).");
  } finally { if (!process.env.PAYMENT_TEST_PREVIEW) { server.close(); server.closeAllConnections(); } else console.log("Local UI test API running with mocked persistence on port 5000."); }
})().catch(e => { console.error(e); process.exitCode = 1; });







