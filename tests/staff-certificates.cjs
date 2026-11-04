// Staff certificate service integration checks. Never run against online MongoDB.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);

const uri = process.env.MONGODB_URI || "";
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\//.test(uri)) throw new Error("Set MONGODB_URI to a local test MongoDB instance. Online database connections are blocked.");
const mongoose = require("mongoose");
const { env } = require("../src/server/config/env.ts");
const { School } = require("../src/server/models/school.model.ts");
const { User } = require("../src/server/models/user.model.ts");
const { StaffEmployment, StaffDepartment } = require("../src/server/models/workforce.model.ts");
const { StaffCertificate } = require("../src/server/models/staffCertificate.model.ts");
const { AuditLog } = require("../src/server/models/auditLog.model.ts");
const service = require("../src/server/services/staffCertificate.service.ts");
const { staffCertificatePdf } = require("../src/server/services/staffCertificatePdf.service.ts");
const dbName = `acadivo_staff_certificates_test_${crypto.randomBytes(6).toString("hex")}`;
let connected = false;
let server;
let checks = 0;
function ok(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
async function rejectsStatus(promise, status, message) { await assert.rejects(promise, (error) => error?.statusCode === status, message); checks++; }

(async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, { dbName, serverSelectionTimeoutMS: 10000 });
    connected = true;
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    const school = await School.create({ name: "Disposable staff certificate school", code: "staff-cert-test", slug: `staff-cert-${dbName.slice(-6)}`, email: "school@example.invalid", phone: "03000000000", address: "Disposable test fixture", plan: "ENTERPRISE", status: "ACTIVE", teacherCount: 0, studentCountRange: "1-200", documentSettings: { branding: { signatoryName: "Test Principal" } }, documentSettingsRevision: 0 });
    const schoolId = String(school._id);
    const admin = { userId: new mongoose.Types.ObjectId(), name: "Test Admin", email: "admin@example.invalid", userType: "SCHOOL_ADMIN", schoolId, branchId: schoolId, isOrganizationOwner: true };
    const staff = await User.create({ schoolId, name: "Sample Teacher", email: "teacher@example.invalid", passwordHash: "unused-test-hash", userType: "TEACHER", status: "ACTIVE", employeeId: "T-001" });
    await StaffEmployment.create({ schoolId, userId: staff._id, employeeId: "T-001", department: "Science", designation: "Biology Teacher", joiningDate: "2022-08-01", status: "ACTIVE" });
    await StaffDepartment.create({ schoolId, name: "Science" });
    let templates = await service.listStaffCertificateTemplates(admin);
    equal(templates.types.length > 0, true, "template manager exposes certificate types");
    const templateInput = { name: "Employment verification", certificateType: "EMPLOYMENT_VERIFICATION", title: "Certificate of Employment", body: "This is to certify that {{staff.name}} ({{staff.employeeId}}) serves as {{staff.designation}} at {{school.name}}. {{details.reason}}", requiredFields: ["reason"], style: { family: "classic", color: "#b20913", font: "serif", orientation: "landscape", border: "double" } };
    let saved = await service.createStaffCertificateTemplate(admin, templates.revision, templateInput);
    const templateId = saved.template.id;
    saved = await service.transitionStaffCertificateTemplate(admin, templateId, saved.revision, "submit");
    saved = await service.transitionStaffCertificateTemplate(admin, templateId, saved.revision, "approve");
    const choices = await service.staffCertificateChoices(admin);
    equal(choices.templates.find((item) => item.id === templateId).status, "APPROVED", "approved template appears in issuance choices");
    equal(choices.departments.includes("Science"), true, "department choices come from real staff department records");
    equal(choices.designations.includes("Biology Teacher"), true, "designation choices come from real staff employment records");
    const versionTwo = await service.createStaffCertificateTemplate(admin, choices.revision, { ...templateInput, name: "Employment verification · v2", basedOnId: templateId });
    equal(versionTwo.template.version, 2, "copying an approved template advances the version");
    const filteredStaff = await service.searchStaffCertificatesStaff(admin, { search: "Sample", department: "Science", page: 1 });
    equal(filteredStaff.total, 1, "server-side staff search and department filter");
    const combinedStaff = await service.searchStaffCertificatesStaff(admin, { employeeId: "T-001", department: "Science", designation: "Biology Teacher", staffType: "TEACHING", employmentStatus: "ACTIVE", page: 1 });
    equal(combinedStaff.total, 1, "combined employee ID, department, designation, staff type and employment status filters");
    const unmatchedStaff = await service.searchStaffCertificatesStaff(admin, { department: "Science", designation: "Chemistry Teacher", page: 1 });
    equal(unmatchedStaff.total, 0, "combined employee filters narrow to no matches when values conflict");
    const issuanceKey = crypto.randomUUID();
    const issueInput = { staffId: String(staff._id), templateId, issueDate: "2026-10-12", issuanceKey, details: { reason: "Employment verification" } };
    const issued = await service.issueStaffCertificate(admin, issueInput);
    equal(issued.status, "ISSUED", "certificate issued");
    equal(issued.snapshot.staff.employeeId, "T-001", "real employee record snapshotted");
    equal(issued.snapshot.school.name, school.name, "school branding snapshotted");
    equal((await service.issueStaffCertificate(admin, issueInput))._id.toString(), issued._id.toString(), "same issuance request is idempotent");
    await rejectsStatus(service.issueStaffCertificate(admin, { ...issueInput, details: { reason: "Different content" } }), 409, "issuance key cannot be reused with different data");
    const verified = await service.publicStaffCertificateVerification(issued.verificationId);
    equal(verified.valid, true, "public QR verification returns valid state");
    equal(Object.hasOwn(verified, "email"), false, "public verification omits private account details");
    const pdf = await staffCertificatePdf(issued.snapshot);
    equal(pdf.subarray(0, 5).toString(), "%PDF-", "dedicated certificate PDF generated");
    const register = await service.listStaffCertificates(admin, { search: "Sample", page: 1 });
    equal(register.total, 1, "certificate register server-side search");
    const filteredRegister = await service.listStaffCertificates(admin, { employeeSearch: "T-001", certificateNumber: issued.certificateNumber.slice(0, 10), certificateType: "EMPLOYMENT_VERIFICATION", department: "Science", designation: "Biology Teacher", staffType: "TEACHING", status: "ISSUED", from: "2026-10-12", to: "2026-10-12", page: 1 });
    equal(filteredRegister.total, 1, "combined certificate history filters include employee, number, category, department, designation, type, status and date range");
    const outsideDateRegister = await service.listStaffCertificates(admin, { from: "2026-10-13", to: "2026-10-14", page: 1 });
    equal(outsideDateRegister.total, 0, "history date range excludes certificates outside selected dates");
    const reissueInput = { reason: "Corrected employment period", issuanceKey: crypto.randomUUID(), body: "This is the corrected certificate statement for the staff member." };
    const replacement = await service.reissueStaffCertificate(admin, String(issued._id), reissueInput);
    equal((await service.reissueStaffCertificate(admin, String(issued._id), reissueInput))._id.toString(), replacement._id.toString(), "same reissue request is idempotent");
    equal(replacement.status, "ISSUED", "replacement certificate issued");
    equal((await StaffCertificate.findById(issued._id)).status, "REPLACED", "original record preserved and marked replaced");
    equal((await service.publicStaffCertificateVerification(issued.verificationId)).valid, false, "old QR is no longer current after replacement");
    await service.revokeStaffCertificate(admin, String(replacement._id), "Employment verification withdrawn after review");
    equal((await service.publicStaffCertificateVerification(replacement.verificationId)).valid, false, "revoked certificate fails public validity check");
    await rejectsStatus(service.revokeStaffCertificate(admin, String(replacement._id), "Repeated revocation"), 409, "duplicate revocation rejected");
    await rejectsStatus(service.issueStaffCertificate({ ...admin, userType: "FINANCE" }, issueInput), 403, "non-admin cannot issue certificates");
    equal(await AuditLog.countDocuments({ schoolId, resource: "StaffCertificate" }), 3, "issuance, replacement and revocation are audited");
    equal(await StaffCertificate.countDocuments({ schoolId }), 2, "original and replacement records are both preserved");
    const { createApp } = require("../src/server/app.ts");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const api = `http://127.0.0.1:${server.address().port}/api/staff-certificates`;
    const publicResponse = await fetch(`${api}/verify/${replacement.verificationId}`);
    equal(publicResponse.status, 200, "public HTTP verification endpoint responds");
    const publicData = (await publicResponse.json()).data;
    equal(publicData.status, "REVOKED", "public HTTP response reports revoked status");
    equal(Object.hasOwn(publicData, "email"), false, "public HTTP response excludes private account details");
    const protectedResponse = await fetch(`${api}/choices`);
    equal(protectedResponse.status, 401, "template and staff APIs require authentication");
    console.log(`PASS: ${checks} staff certificate service/MongoDB lifecycle checks.`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connected) {
      if (mongoose.connection.name !== dbName || !dbName.startsWith("acadivo_staff_certificates_test_")) throw new Error("Unsafe staff certificate test database cleanup.");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
})();
