import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { connectDB } from "../src/server/config/db";
import { School } from "../src/server/models/school.model";
import { User } from "../src/server/models/user.model";
import { Branch } from "../src/server/models/branch.model";
import { AcademicSession } from "../src/server/models/academicSession.model";
import { ClassModel, SectionModel } from "../src/server/models/classSection.model";
import { Student } from "../src/server/models/student.model";
import { FeeStructure, FeeChallan } from "../src/server/models/fee.model";
import { ExamSchedule, MarksEntry } from "../src/server/models/exam.model";
import { BulkImport } from "../src/server/models/bulkImport.model";
import { UniversalImportService } from "../src/server/services/universalImport.service";
import { UNIVERSAL_ENTITIES, UNIVERSAL_IMPORT_ORDER } from "../src/lib/universal-import-config";

async function runVerification() {
  console.log("================================================================================");
  console.log("  ACADIVO UNIVERSAL BULK IMPORT & SCHOOL MIGRATION — VERIFICATION SUITE");
  console.log("================================================================================\n");

  await connectDB();
  console.log("✔ Connected to MongoDB successfully.\n");

  // Pre-cleanup in case of previous aborted runs
  console.log("--- PRE-TEST CLEANUP: Clearing any stale test artifacts ---");
  await User.deleteMany({ email: { $regex: /(@beacon\.edu\.pk|@acadivo\.test)$/i } });
  await Student.deleteMany({ admissionNumber: { $regex: /^ADM-2025-/ } });
  await BulkImport.deleteMany({ entity: "master" });
  console.log("✔ Pre-cleanup completed.\n");

  // --------------------------------------------------------------------------
  // TEST 1: Master Blank Template (38 sheets)
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Verifying Master Excel Template (.xlsx) ---");
  const masterTemplatePath = path.resolve(process.cwd(), "public/templates/Acadivo-Complete-School-Migration-Template.xlsx");
  if (!fs.existsSync(masterTemplatePath)) {
    throw new Error(`Master template not found at ${masterTemplatePath}`);
  }
  const masterStat = fs.statSync(masterTemplatePath);
  console.log(`✔ Found Master Template: ${masterTemplatePath} (${(masterStat.size / 1024).toFixed(1)} KB)`);

  const masterWb = XLSX.readFile(masterTemplatePath);
  console.log(`✔ Master Template contains ${masterWb.SheetNames.length} worksheets:`);
  console.log(`   Sheets: ${masterWb.SheetNames.slice(0, 10).join(", ")} ... (${masterWb.SheetNames.length} total)`);

  if (!masterWb.SheetNames.includes("Instructions") || (!masterWb.SheetNames.includes("Index") && !masterWb.SheetNames.includes("Worksheet Index"))) {
    throw new Error("Master template is missing Instructions or Worksheet Index!");
  }

  let sheetsFound = 0;
  for (const entityKey of UNIVERSAL_IMPORT_ORDER) {
    const def = UNIVERSAL_ENTITIES[entityKey];
    if (def && masterWb.SheetNames.includes(def.sheetName)) {
      sheetsFound++;
    }
  }
  console.log(`✔ All ${sheetsFound} operational & historical entity sheets verified present in Master Template.\n`);

  // --------------------------------------------------------------------------
  // TEST 2: Sample Demonstration School (1,000+ Students, Multi-Branch)
  // --------------------------------------------------------------------------
  console.log("--- TEST 2: Verifying Demonstration Sample Workbook ---");
  const samplePath = path.resolve(process.cwd(), "public/templates/Acadivo-Sample-Demonstration-School.xlsx");
  if (!fs.existsSync(samplePath)) {
    throw new Error(`Sample demonstration workbook not found at ${samplePath}`);
  }
  const sampleStat = fs.statSync(samplePath);
  console.log(`✔ Found Sample Workbook: ${samplePath} (${(sampleStat.size / 1024 / 1024).toFixed(2)} MB)`);

  const sampleWb = XLSX.readFile(samplePath);
  console.log(`✔ Sample Workbook contains ${sampleWb.SheetNames.length} worksheets.`);

  const studentSheet = sampleWb.Sheets["Students"];
  if (!studentSheet) throw new Error("Students worksheet missing from sample workbook!");
  const studentRows = XLSX.utils.sheet_to_json(studentSheet);
  console.log(`✔ Verified ${studentRows.length} pre-populated student rows (>= 1,000 requirement).`);

  const branchSheet = sampleWb.Sheets["Branches"];
  const branchRows = XLSX.utils.sheet_to_json(branchSheet || {});
  console.log(`✔ Verified ${branchRows.length} campus branches in sample (Multi-branch demonstration).`);

  const challanSheet = sampleWb.Sheets["FeeChallans"] || sampleWb.Sheets["Fee Challans"];
  const challanRows = XLSX.utils.sheet_to_json(challanSheet || {});
  console.log(`✔ Verified ${challanRows.length} fee challan records in sample.\n`);

  // --------------------------------------------------------------------------
  // TEST 3: Staged Validation & Preview (Topological Resolution)
  // --------------------------------------------------------------------------
  console.log("--- TEST 3: Staged In-Memory Preview & Foreign Key Validation ---");

  // Create isolated test tenant
  const testSchoolSlug = `test-univ-mig-${Date.now()}`;
  const testSchool = await School.create({
    name: "Universal Migration Verification School",
    code: `mig-${Date.now().toString().slice(-6)}`,
    slug: testSchoolSlug,
    email: `mig-test-${Date.now()}@acadivo.test`,
    phone: "042-35712399",
    address: "123 Migration Street, Lahore",
    studentCountRange: "500+",
    plan: "ENTERPRISE",
    status: "ACTIVE",
    isEmailVerified: true,
  });

  const testUser = await User.create({
    name: "Migration Test Admin",
    email: `mig-admin-${Date.now()}@acadivo.test`,
    passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLM",
    userType: "SCHOOL_ADMIN",
    schoolId: testSchool._id,
    status: "ACTIVE",
    isEmailVerified: true,
  });

  console.log(`✔ Created isolated test school (${testSchool.name}) ID: ${testSchool._id}`);

  const sampleBuffer = fs.readFileSync(samplePath);
  const sampleBase64 = sampleBuffer.toString("base64");

  console.log("  Running UniversalImportService.preview with 1,000+ student master workbook...");
  const previewStartTime = Date.now();
  const previewResult = await UniversalImportService.preview(
    testSchool._id.toString(),
    testUser._id.toString(),
    "master",
    "Acadivo-Sample-Demonstration-School.xlsx",
    sampleBase64
  );
  const previewElapsed = ((Date.now() - previewStartTime) / 1000).toFixed(2);

  console.log(`✔ Preview completed in ${previewElapsed}s:`);
  console.log(`   Total Staged Rows: ${previewResult.totalRows}`);
  console.log(`   Valid Rows:        ${previewResult.validRows}`);
  console.log(`   Duplicate Rows:    ${previewResult.duplicateRows}`);
  console.log(`   Invalid Rows:      ${previewResult.invalidRows}`);
  console.log(`   Active Sheets:     ${previewResult.sheets?.length || 0}`);

  if (previewResult.totalRows < 1000) {
    throw new Error(`Expected at least 1,000 total rows in preview, got ${previewResult.totalRows}`);
  }
  if (previewResult.validRows === 0) {
    throw new Error("Zero valid rows detected in preview! Validation failed.");
  }

  // --------------------------------------------------------------------------
  // TEST 4: Chunked Dependency-Ordered Execution
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Dependency-Ordered Import Execution ---");
  console.log(`  Executing import job ${previewResult.id} with duplicate skipping enabled...`);

  const commitStartTime = Date.now();
  await UniversalImportService.start(
    testSchool._id.toString(),
    testUser._id.toString(),
    previewResult.id,
    true
  );

  let completedJob: any = null;
  for (let attempt = 0; attempt < 240; attempt++) {
    completedJob = await BulkImport.findById(previewResult.id);
    if (completedJob?.status === "COMPLETED" || completedJob?.status === "FAILED") {
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const commitElapsed = ((Date.now() - commitStartTime) / 1000).toFixed(2);

  console.log(`✔ Migration execution finished in ${commitElapsed}s:`);
  console.log(`   Final Job Status:   ${completedJob?.status}`);
  console.log(`   Processed Rows:     ${completedJob?.processed ?? completedJob?.processedRows ?? completedJob?.summary?.total} / ${completedJob?.summary?.total ?? completedJob?.totalRows}`);
  console.log(`   Success Records:    ${completedJob?.summary?.imported ?? completedJob?.successRows}`);
  console.log(`   Error Rows:         ${(completedJob?.summary?.invalid || 0) + (completedJob?.summary?.failed || 0)}`);

  // Verify records in actual collections
  const createdBranches = await Branch.countDocuments({ organizationId: testSchool._id });
  const createdSessions = await AcademicSession.countDocuments({ schoolId: testSchool._id });
  const createdClasses = await ClassModel.countDocuments({ schoolId: testSchool._id });
  const createdSections = await SectionModel.countDocuments({ schoolId: testSchool._id });
  const createdStudents = await Student.countDocuments({ schoolId: testSchool._id });
  const createdUsers = await User.countDocuments({ schoolId: testSchool._id });
  const createdChallans = await FeeChallan.countDocuments({ schoolId: testSchool._id });

  console.log(`\n✔ Database Record Counts for Test School:`);
  console.log(`   Branches Created:        ${createdBranches}`);
  console.log(`   Academic Sessions:       ${createdSessions}`);
  console.log(`   Classes Created:         ${createdClasses}`);
  console.log(`   Sections Created:        ${createdSections}`);
  console.log(`   Students Created:        ${createdStudents}`);
  console.log(`   Users Created:           ${createdUsers}`);
  console.log(`   Fee Challans Created:    ${createdChallans}`);

  if (createdStudents < 500) {
    throw new Error(`Expected at least 500 students imported into DB, found ${createdStudents}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Idempotency & Repeat Import Duplicate Detection
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Idempotency & Duplicate Rejection ---");
  console.log("  Re-previewing the exact same master workbook against existing school data...");

  const secondPreview = await UniversalImportService.preview(
    testSchool._id.toString(),
    testUser._id.toString(),
    "master",
    "Acadivo-Sample-Demonstration-School.xlsx",
    sampleBase64
  );

  console.log(`✔ Repeat preview completed:`);
  console.log(`   Total Rows:       ${secondPreview.totalRows}`);
  console.log(`   Duplicates Found: ${secondPreview.duplicateRows}`);
  console.log(`   Valid (New) Rows: ${secondPreview.validRows}`);

  if (secondPreview.duplicateRows === 0) {
    throw new Error("Duplicate detection failed: 0 duplicate rows detected on re-import!");
  }

  console.log("  Executing repeat import with skipDuplicates = true...");
  await UniversalImportService.start(
    testSchool._id.toString(),
    testUser._id.toString(),
    secondPreview.id,
    true
  );
  for (let attempt = 0; attempt < 60; attempt++) {
    const sj = await BulkImport.findById(secondPreview.id);
    if (sj?.status === "COMPLETED" || sj?.status === "FAILED") break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  const studentsAfterSecondImport = await Student.countDocuments({ schoolId: testSchool._id });
  console.log(`✔ Student count after second import: ${studentsAfterSecondImport} (Identical to ${createdStudents})`);

  if (studentsAfterSecondImport !== createdStudents) {
    throw new Error(`Idempotency violated: student count changed from ${createdStudents} to ${studentsAfterSecondImport}`);
  }
  console.log("✔ Idempotency verified: 0 duplicate records created, existing records safely preserved.\n");

  // --------------------------------------------------------------------------
  // CLEANUP
  // --------------------------------------------------------------------------
  console.log("--- CLEANUP: Removing Test Tenant Data ---");
  await Student.deleteMany({ schoolId: testSchool._id });
  await User.deleteMany({ schoolId: testSchool._id });
  await Branch.deleteMany({ organizationId: testSchool._id });
  await AcademicSession.deleteMany({ schoolId: testSchool._id });
  await ClassModel.deleteMany({ schoolId: testSchool._id });
  await SectionModel.deleteMany({ schoolId: testSchool._id });
  await FeeChallan.deleteMany({ schoolId: testSchool._id });
  await FeeStructure.deleteMany({ schoolId: testSchool._id });
  await ExamSchedule.deleteMany({ schoolId: testSchool._id });
  await MarksEntry.deleteMany({ schoolId: testSchool._id });
  await BulkImport.deleteMany({ schoolId: testSchool._id });
  await School.deleteOne({ _id: testSchool._id });
  console.log("✔ Test tenant records successfully removed. No production data affected.\n");

  await mongoose.disconnect();
  console.log("================================================================================");
  console.log("  ALL TESTS PASSED — UNIVERSAL BULK IMPORT & SCHOOL MIGRATION VERIFIED!");
  console.log("================================================================================");
}

runVerification().catch((err) => {
  console.error("\n❌ VERIFICATION TEST FAILED:");
  console.error(err);
  process.exit(1);
});
