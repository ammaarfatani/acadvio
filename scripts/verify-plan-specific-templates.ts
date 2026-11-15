import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { connectDB } from "../src/server/config/db";
import { School } from "../src/server/models/school.model";
import { User } from "../src/server/models/user.model";
import { Branch } from "../src/server/models/branch.model";
import { BulkImport } from "../src/server/models/bulkImport.model";
import { UniversalImportService } from "../src/server/services/universalImport.service";
import { UniversalTemplateService } from "../src/server/services/universalTemplate.service";
import {
  PLAN_TIER_DETAILS,
  PLAN_ENTITIES,
  UNIVERSAL_ENTITIES,
  SubscriptionPlanTier,
} from "../src/lib/universal-import-config";

async function runVerification() {
  console.log("================================================================================");
  console.log("  ACADIVO PLAN-SPECIFIC EXCEL TEMPLATES & EXAMPLE DATA VERIFICATION SUITE");
  console.log("================================================================================\n");

  const templatesDir = path.resolve(process.cwd(), "public/templates");

  // --------------------------------------------------------------------------
  // TEST 1: Physical File Verification on Disk
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Verifying All 6 Plan-Specific Workbooks on Disk ---");

  const tiers: SubscriptionPlanTier[] = ["BASIC", "PROFESSIONAL", "ENTERPRISE"];

  for (const tier of tiers) {
    const meta = PLAN_TIER_DETAILS[tier];

    // 1. Example File
    const examplePath = path.join(templatesDir, meta.exampleFilename);
    if (!fs.existsSync(examplePath)) {
      throw new Error(`Missing example file on disk: ${meta.exampleFilename}`);
    }
    const exampleStat = fs.statSync(examplePath);
    const exampleWb = XLSX.readFile(examplePath);
    console.log(`✔ [${tier}] Example File: ${meta.exampleFilename} (${(exampleStat.size / 1024).toFixed(1)} KB)`);
    console.log(`   Sheets (${exampleWb.SheetNames.length}): ${exampleWb.SheetNames.slice(0, 6).join(", ")} ...`);

    if (exampleWb.SheetNames.length !== meta.sheetCount) {
      throw new Error(`Expected ${meta.sheetCount} sheets for ${tier} example, got ${exampleWb.SheetNames.length}`);
    }

    // 2. Blank File
    const blankPath = path.join(templatesDir, meta.blankFilename);
    if (!fs.existsSync(blankPath)) {
      throw new Error(`Missing blank file on disk: ${meta.blankFilename}`);
    }
    const blankStat = fs.statSync(blankPath);
    const blankWb = XLSX.readFile(blankPath);
    console.log(`✔ [${tier}] Blank File: ${meta.blankFilename} (${(blankStat.size / 1024).toFixed(1)} KB)`);
    console.log(`   Sheets (${blankWb.SheetNames.length}): ${blankWb.SheetNames.slice(0, 6).join(", ")} ...`);

    if (blankWb.SheetNames.length !== meta.sheetCount) {
      throw new Error(`Expected ${meta.sheetCount} sheets for ${tier} blank, got ${blankWb.SheetNames.length}`);
    }

    // Verify row structure in blank template (Headers in row 0, instruction row in row 1, zero data rows)
    const testSheetName = UNIVERSAL_ENTITIES["students"].sheetName;
    const testSheet = blankWb.Sheets[testSheetName];
    if (testSheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(testSheet);
      // Row 1 is the instruction row, so rows.length is at most 1
      if (rows.length > 1) {
        throw new Error(`Blank template sheet ${testSheetName} contains data rows! Found ${rows.length}`);
      }
      console.log(`   ✔ Clean blank rows confirmed on sheet: ${testSheetName}`);
    }
  }

  console.log("\n--- TEST 2: Checking Specific Tier Inclusions & Exclusions ---");

  // BASIC checks
  const basicWb = XLSX.readFile(path.join(templatesDir, PLAN_TIER_DETAILS.BASIC.exampleFilename));
  if (basicWb.SheetNames.includes("Branches")) {
    throw new Error("BASIC plan example should NOT include 'Branches' sheet!");
  }
  if (basicWb.SheetNames.includes("FeeChallans")) {
    throw new Error("BASIC plan example should NOT include 'FeeChallans' sheet!");
  }
  if (basicWb.SheetNames.includes("ExamSchedules")) {
    throw new Error("BASIC plan example should NOT include 'ExamSchedules' sheet!");
  }
  console.log("✔ BASIC plan correctly excludes Branches, FeeChallans, and ExamSchedules.");

  // PROFESSIONAL checks
  const profWb = XLSX.readFile(path.join(templatesDir, PLAN_TIER_DETAILS.PROFESSIONAL.exampleFilename));
  if (profWb.SheetNames.includes("Branches")) {
    throw new Error("PROFESSIONAL plan example should NOT include 'Branches' sheet (single campus)!");
  }
  if (!profWb.SheetNames.includes("FeeChallans") || !profWb.SheetNames.includes("ExamSchedules")) {
    throw new Error("PROFESSIONAL plan example MUST include FeeChallans and ExamSchedules!");
  }
  console.log("✔ PROFESSIONAL plan correctly includes FeeChallans & ExamSchedules, and excludes Branches.");

  // ENTERPRISE checks
  const entWb = XLSX.readFile(path.join(templatesDir, PLAN_TIER_DETAILS.ENTERPRISE.exampleFilename));
  if (!entWb.SheetNames.includes("Branches")) {
    throw new Error("ENTERPRISE plan example MUST include 'Branches' sheet!");
  }
  console.log("✔ ENTERPRISE plan correctly includes multi-branch 'Branches' sheet.");

  // --------------------------------------------------------------------------
  // TEST 3: Database & UniversalImportService Plan Enforcement
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Database & Entitlement Enforcement Testing ---");
  await connectDB();
  console.log("✔ Connected to MongoDB successfully.");

  const timestamp = Date.now();

  // Create isolated test schools for each plan
  const basicSchool = await School.create({
    name: "Verification Basic School",
    code: `vb-${timestamp.toString().slice(-5)}`,
    slug: `test-basic-school-${timestamp}`,
    email: `basic-${timestamp}@acadivo.test`,
    phone: "042-35111111",
    address: "Lahore, Pakistan",
    plan: "STARTER",
    studentCountRange: "1-300",
    teacherCount: 15,
    status: "ACTIVE",
  });

  const profSchool = await School.create({
    name: "Verification Professional School",
    code: `vp-${timestamp.toString().slice(-5)}`,
    slug: `test-prof-school-${timestamp}`,
    email: `prof-${timestamp}@acadivo.test`,
    phone: "042-35222222",
    address: "Islamabad, Pakistan",
    plan: "PROFESSIONAL",
    studentCountRange: "301-1500",
    teacherCount: 50,
    status: "ACTIVE",
  });

  const entSchool = await School.create({
    name: "Verification Enterprise School",
    code: `ve-${timestamp.toString().slice(-5)}`,
    slug: `test-ent-school-${timestamp}`,
    email: `ent-${timestamp}@acadivo.test`,
    phone: "042-35333333",
    address: "Karachi, Pakistan",
    plan: "ENTERPRISE",
    studentCountRange: "1500+",
    teacherCount: 100,
    status: "ACTIVE",
  });

  const testUser = await User.create({
    schoolId: basicSchool._id,
    name: "Verification Admin",
    email: `admin-v-${timestamp}@acadivo.test`,
    userType: "SCHOOL_ADMIN",
    status: "ACTIVE",
    passwordHash: "test_verification_hash",
  });

  try {
    // 1. Test getPlanInfo
    console.log("--- Testing UniversalImportService.getPlanInfo(...) ---");
    const basicInfo = await UniversalImportService.getPlanInfo(basicSchool._id);
    console.log(`✔ Basic School planInfo: tier=${basicInfo.planTier}, sheets=${basicInfo.sheetCount}, entities=${basicInfo.allowedEntities.length}`);
    if (basicInfo.planTier !== "BASIC" || basicInfo.sheetCount !== 15 || basicInfo.allowedEntities.length !== 13) {
      throw new Error(`Basic planInfo mismatch!`);
    }

    const profInfo = await UniversalImportService.getPlanInfo(profSchool._id);
    console.log(`✔ Prof School planInfo: tier=${profInfo.planTier}, sheets=${profInfo.sheetCount}, entities=${profInfo.allowedEntities.length}`);
    if (profInfo.planTier !== "PROFESSIONAL" || profInfo.sheetCount !== 37 || profInfo.allowedEntities.length !== 35) {
      throw new Error(`Prof planInfo mismatch!`);
    }

    const entInfo = await UniversalImportService.getPlanInfo(entSchool._id);
    console.log(`✔ Enterprise School planInfo: tier=${entInfo.planTier}, sheets=${entInfo.sheetCount}, entities=${entInfo.allowedEntities.length}`);
    if (entInfo.planTier !== "ENTERPRISE" || entInfo.sheetCount !== 38 || entInfo.allowedEntities.length !== 36) {
      throw new Error(`Enterprise planInfo mismatch!`);
    }

    // 2. Test Basic School uploading Basic Example Data
    console.log("\n--- Testing Preview for Basic School with Basic Example Data ---");
    const basicExampleBuffer = fs.readFileSync(path.join(templatesDir, PLAN_TIER_DETAILS.BASIC.exampleFilename));
    const basicPreview = await UniversalImportService.preview(
      basicSchool._id,
      testUser._id,
      "master",
      PLAN_TIER_DETAILS.BASIC.exampleFilename,
      basicExampleBuffer.toString("base64")
    );
    console.log(`✔ Basic preview created: valid=${basicPreview.validRows}, invalid=${basicPreview.invalidRows}, planTier=${basicPreview.planTier}`);
    console.log(`✔ Demo Notice detected: "${basicPreview.demoNotice?.slice(0, 50)}..."`);
    if (!basicPreview.demoNotice) {
      throw new Error("Expected demo notice on example data preview!");
    }
    if (basicPreview.validRows === 0) {
      throw new Error("Basic example data should produce valid rows!");
    }

    // 3. Test Basic School uploading Enterprise Example Data (Unauthorized sheets should be rejected)
    console.log("\n--- Testing Unauthorized Sheet Rejection for Basic School ---");
    const entExampleBuffer = fs.readFileSync(path.join(templatesDir, PLAN_TIER_DETAILS.ENTERPRISE.exampleFilename));
    const unauthorizedPreview = await UniversalImportService.preview(
      basicSchool._id,
      testUser._id,
      "master",
      PLAN_TIER_DETAILS.ENTERPRISE.exampleFilename,
      entExampleBuffer.toString("base64")
    );

    const unauthorizedRows = (unauthorizedPreview.rows || []).filter((r: any) =>
      r.issues?.some((iss: string) => iss.includes("requires the") || iss.includes("not authorized")) ||
      r.message?.includes("not authorized")
    );
    console.log(`✔ Unauthorized sheets properly intercepted! Flagged ${unauthorizedRows.length} rows with tier warnings.`);
    if (unauthorizedRows.length === 0) {
      throw new Error("Enterprise sheets (e.g. Branches, FeeChallans) should be flagged as unauthorized on Basic plan!");
    }

    // 4. Test In-Memory Dynamic Generation Service
    console.log("\n--- Testing In-Memory Template Generation Methods ---");
    const dynamicBasic = UniversalTemplateService.generatePlanBlankTemplate("BASIC");
    const dynBasicWb = XLSX.read(dynamicBasic, { type: "buffer" });
    console.log(`✔ UniversalTemplateService.generatePlanBlankTemplate("BASIC") generated ${dynBasicWb.SheetNames.length} sheets.`);
    if (dynBasicWb.SheetNames.length !== 15) {
      throw new Error(`Expected 15 sheets from dynamic BASIC blank generation, got ${dynBasicWb.SheetNames.length}`);
    }

    const dynamicProf = UniversalTemplateService.generatePlanBlankTemplate("PROFESSIONAL");
    const dynProfWb = XLSX.read(dynamicProf, { type: "buffer" });
    console.log(`✔ UniversalTemplateService.generatePlanBlankTemplate("PROFESSIONAL") generated ${dynProfWb.SheetNames.length} sheets.`);
    if (dynProfWb.SheetNames.length !== 37) {
      throw new Error(`Expected 37 sheets from dynamic PROFESSIONAL blank generation, got ${dynProfWb.SheetNames.length}`);
    }

    const dynamicEnt = UniversalTemplateService.generatePlanBlankTemplate("ENTERPRISE");
    const dynEntWb = XLSX.read(dynamicEnt, { type: "buffer" });
    console.log(`✔ UniversalTemplateService.generatePlanBlankTemplate("ENTERPRISE") generated ${dynEntWb.SheetNames.length} sheets.`);
    if (dynEntWb.SheetNames.length !== 38) {
      throw new Error(`Expected 38 sheets from dynamic ENTERPRISE blank generation, got ${dynEntWb.SheetNames.length}`);
    }

    const singleStudentBlank = UniversalTemplateService.generateModuleTemplate("students");
    const studentBlankWb = XLSX.read(singleStudentBlank, { type: "buffer" });
    console.log(`✔ Single Module Blank Template ("students") generated sheet: ${studentBlankWb.SheetNames.join(", ")}`);

    const singleStudentExample = UniversalTemplateService.generateModuleExampleTemplate("students");
    const studentExampleWb = XLSX.read(singleStudentExample, { type: "buffer" });
    const exampleStudentRows = XLSX.utils.sheet_to_json(studentExampleWb.Sheets[studentExampleWb.SheetNames[0]]);
    console.log(`✔ Single Module Example Template ("students") generated with ${exampleStudentRows.length} populated rows.`);

  } finally {
    // Cleanup
    console.log("\n--- CLEANUP: Removing verification test entities ---");
    await School.deleteMany({ _id: { $in: [basicSchool._id, profSchool._id, entSchool._id] } });
    await User.deleteMany({ _id: testUser._id });
    await BulkImport.deleteMany({ school: { $in: [basicSchool._id, profSchool._id, entSchool._id] } });
    console.log("✔ Cleanup complete.");
  }

  console.log("\n================================================================================");
  console.log("  ALL PLAN-SPECIFIC TEMPLATE & IMPORT ENGINE TESTS PASSED SUCCESSFULLY!  ");
  console.log("================================================================================");
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Verification Failed:", err);
    process.exit(1);
  });
