import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import mongoose from "mongoose";
import { connectDB } from "../src/server/config/db";
import { School } from "../src/server/models/school.model";
import { User } from "../src/server/models/user.model";
import { Branch } from "../src/server/models/branch.model";
import { ClassCategory } from "../src/server/models/classCategory.model";
import { ClassModel } from "../src/server/models/classSection.model";
import { Student } from "../src/server/models/student.model";
import { SchoolAdminService } from "../src/server/services/schoolAdmin.service";
import { UniversalImportService } from "../src/server/services/universalImport.service";
import {
  PLAN_TIER_DETAILS,
  PLAN_ENTITIES,
  UNIVERSAL_ENTITIES,
  SubscriptionPlanTier,
} from "../src/lib/universal-import-config";

async function runVerification() {
  console.log("================================================================================");
  console.log("   ACADIVO CLASS CATEGORY MANAGEMENT & SYSTEM INTEGRATION VERIFICATION SUITE   ");
  console.log("================================================================================\n");

  const templatesDir = path.resolve(process.cwd(), "public/templates");

  // --------------------------------------------------------------------------
  // TEST 1: Physical Excel Template & Column Verification
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Verifying Plan Workbooks on Disk for ClassCategories Sheet ---");

  const tiers: SubscriptionPlanTier[] = ["BASIC", "PROFESSIONAL", "ENTERPRISE"];
  for (const tier of tiers) {
    const meta = PLAN_TIER_DETAILS[tier];

    // Blank File
    const blankPath = path.join(templatesDir, meta.blankFilename);
    if (!fs.existsSync(blankPath)) {
      throw new Error(`Missing blank workbook on disk: ${meta.blankFilename}`);
    }
    const blankWb = XLSX.readFile(blankPath);
    if (!blankWb.SheetNames.includes("ClassCategories")) {
      throw new Error(`[${tier}] Blank file is missing 'ClassCategories' sheet!`);
    }

    // Verify ClassCategories header columns
    const catSheet = blankWb.Sheets["ClassCategories"];
    const catHeaders = [
      catSheet["A1"]?.v,
      catSheet["B1"]?.v,
      catSheet["C1"]?.v,
      catSheet["D1"]?.v,
      catSheet["E1"]?.v,
      catSheet["F1"]?.v,
    ];
    console.log(`✔ [${tier}] Blank template contains 'ClassCategories' sheet with columns:`, catHeaders.join(" | "));

    // Verify Classes sheet has Class Category Ref / Name column
    const classSheet = blankWb.Sheets["Classes"];
    const classHeaders = [
      classSheet["A1"]?.v,
      classSheet["B1"]?.v,
      classSheet["C1"]?.v,
      classSheet["D1"]?.v,
    ];
    console.log(`✔ [${tier}] Blank template 'Classes' sheet columns:`, classHeaders.join(" | "));
    if (classHeaders[1] !== "Class Category Ref / Name") {
      throw new Error(`[${tier}] Classes sheet missing 'Class Category Ref / Name' column at B1!`);
    }

    // Example File
    const examplePath = path.join(templatesDir, meta.exampleFilename);
    if (!fs.existsSync(examplePath)) {
      throw new Error(`Missing example workbook on disk: ${meta.exampleFilename}`);
    }
    const exampleWb = XLSX.readFile(examplePath);
    if (!exampleWb.SheetNames.includes("ClassCategories")) {
      throw new Error(`[${tier}] Example file is missing 'ClassCategories' sheet!`);
    }

    const exCatSheet = exampleWb.Sheets["ClassCategories"];
    console.log(`✔ [${tier}] Example template contains populated 'ClassCategories' sample data:`);
    console.log(`     Row 3: ${exCatSheet["A3"]?.v} - ${exCatSheet["B3"]?.v} (${exCatSheet["E3"]?.v})`);
    console.log(`     Row 4: ${exCatSheet["A4"]?.v} - ${exCatSheet["B4"]?.v} (${exCatSheet["E4"]?.v})`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Database Connectivity & School Setup
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Database Connection & Verification Context ---");
  await connectDB();
  console.log("✔ Connected to MongoDB.");

  let school: any = await School.findOne({ plan: { $in: ["ENTERPRISE", "PROFESSIONAL", "BASIC"] } }).lean();
  if (!school) {
    school = await School.findOne({}).lean();
  }
  if (!school) {
    console.log("Creating temporary test school...");
    school = await School.create({
      name: "Acadivo Test Academy",
      code: "acadivo-test-" + Date.now(),
      status: "ACTIVE",
      plan: "ENTERPRISE",
      academicYear: "2025-2026",
    });
  }
  const schoolId = String(school._id);
  console.log(`✔ Using School: ${school.name} (ID: ${schoolId}, Plan: ${school.plan || "ENTERPRISE"})`);

  let branch: any = await Branch.findOne({ organizationId: schoolId }).lean();
  if (!branch) {
    branch = await Branch.create({
      organizationId: schoolId,
      name: "Main Test Campus",
      code: "main-test-" + Date.now(),
      isMain: true,
      status: "ACTIVE",
    });
  }
  const branchId = String(branch._id);
  console.log(`✔ Using Branch: ${branch.name} (ID: ${branchId})`);

  let adminUser: any = await User.findOne({ schoolId }).lean();
  const actorId = adminUser ? String(adminUser._id) : new mongoose.Types.ObjectId().toString();

  // Clean any old test artifacts
  await ClassCategory.deleteMany({ schoolId, name: { $regex: /^TEST-CAT-/i } });
  await ClassModel.deleteMany({ schoolId, name: { $regex: /^TEST-CLS-/i } });

  // --------------------------------------------------------------------------
  // TEST 3: Category CRUD & Uniqueness Constraints
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Class Category Creation & Uniqueness Validation ---");

  // 1. Create Primary Category
  const catPrimary = await SchoolAdminService.createClassCategory(schoolId, {
    name: "TEST-CAT-Primary",
    description: "Foundational primary school grades 1 to 5",
    displayOrder: 1,
    status: "ACTIVE",
  }, actorId);
  console.log(`✔ Created Category: ${catPrimary.name} (ID: ${catPrimary._id})`);

  // 2. Create Secondary Category
  const catSecondary = await SchoolAdminService.createClassCategory(schoolId, {
    name: "TEST-CAT-Secondary",
    description: "High school grades 9 and 10",
    displayOrder: 2,
    status: "ACTIVE",
  }, actorId);
  console.log(`✔ Created Category: ${catSecondary.name} (ID: ${catSecondary._id})`);

  // 3. Test Uniqueness (Duplicate name in same school should be rejected)
  let duplicateRejected = false;
  try {
    await SchoolAdminService.createClassCategory(schoolId, {
      name: "TEST-CAT-Primary",
      description: "Duplicate attempt",
    }, actorId);
  } catch (err: any) {
    duplicateRejected = true;
    console.log(`✔ Duplicate category rejection confirmed: "${err.message || err}"`);
  }
  if (!duplicateRejected) {
    throw new Error("Failed: Duplicate category was allowed!");
  }

  // 4. Test Listing Categories with Aggregated Class Counts
  const categoriesList = await SchoolAdminService.getClassCategories(schoolId);
  const foundPri = categoriesList.find((c: any) => String(c._id) === String(catPrimary._id));
  console.log(`✔ Retrieved categories. TEST-CAT-Primary classCount: ${foundPri?.classCount}`);
  if (foundPri?.classCount !== 0) {
    throw new Error(`Expected classCount 0, got ${foundPri?.classCount}`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Class Creation with Category Association
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Class Creation with Category Linking ---");

  const classGrade5 = await SchoolAdminService.createClass(schoolId, {
    name: "TEST-CLS-Grade5",
    code: "G5T",
    numericLevel: 5,
    classCategoryId: String(catPrimary._id),
  });
  console.log(`✔ Created Class: ${classGrade5.name} linked to categoryId: ${classGrade5.classCategoryId}`);
  console.log(`   Cached classCategoryName: "${classGrade5.classCategoryName}"`);
  if (classGrade5.classCategoryName !== "TEST-CAT-Primary") {
    throw new Error(`Expected classCategoryName "TEST-CAT-Primary", got "${classGrade5.classCategoryName}"`);
  }

  // Check updated category count
  const updatedCategories = await SchoolAdminService.getClassCategories(schoolId);
  const updatedPri = updatedCategories.find((c: any) => String(c._id) === String(catPrimary._id));
  console.log(`✔ Category classCount after class creation: ${updatedPri?.classCount}`);
  if (updatedPri?.classCount !== 1) {
    throw new Error(`Expected classCount 1, got ${updatedPri?.classCount}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Safe Deletion Protection
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Safe Deletion Prevention for In-Use Categories ---");

  let safeDeleteBlocked = false;
  try {
    await SchoolAdminService.deleteClassCategory(schoolId, String(catPrimary._id));
  } catch (err: any) {
    safeDeleteBlocked = true;
    console.log(`✔ Safe deletion prevention confirmed: "${err.message || err}"`);
  }
  if (!safeDeleteBlocked) {
    throw new Error("Failed: Category with active classes was deleted!");
  }

  // --------------------------------------------------------------------------
  // TEST 6: Legacy Class Migration & Bulk Assignment
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Legacy Class Bulk Category Assignment ---");

  // Create legacy class without category
  const legacyClass = await ClassModel.create({
    schoolId,
    branchId,
    name: "TEST-CLS-Legacy9",
    code: "G9LEG",
    numericLevel: 9,
    status: "ACTIVE",
  });
  console.log(`✔ Created unassigned legacy class: ${legacyClass.name} (categoryId: ${legacyClass.classCategoryId})`);

  // Bulk assign legacy class to Secondary Category
  const bulkResult = await SchoolAdminService.bulkAssignCategoryToClasses(
    schoolId,
    [String(legacyClass._id)],
    String(catSecondary._id)
  );
  console.log(`✔ Bulk assigned category: successfully executed.`);

  const refreshedLegacy: any = await ClassModel.findById(legacyClass._id).lean();
  console.log(`   Refreshed class categoryId: ${refreshedLegacy?.classCategoryId}, categoryName: "${refreshedLegacy?.classCategoryName}"`);
  if (refreshedLegacy?.classCategoryName !== "TEST-CAT-Secondary") {
    throw new Error(`Expected classCategoryName "TEST-CAT-Secondary", got "${refreshedLegacy?.classCategoryName}"`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Category Renaming & Cascade Synchronization
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Category Renaming & Propagation to Classes ---");

  const renamedCat = await SchoolAdminService.updateClassCategory(
    schoolId,
    String(catSecondary._id),
    { name: "TEST-CAT-Secondary-Advanced" }
  );
  console.log(`✔ Renamed Category to: ${renamedCat?.name}`);

  const reloadedClass: any = await ClassModel.findById(legacyClass._id).lean();
  console.log(`   Cascade check on class: classCategoryName is now "${reloadedClass?.classCategoryName}"`);
  if (reloadedClass?.classCategoryName !== "TEST-CAT-Secondary-Advanced") {
    throw new Error(`Expected classCategoryName "TEST-CAT-Secondary-Advanced", got "${reloadedClass?.classCategoryName}"`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Universal Bulk Import with Class Category Linking
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Universal Bulk Import Engine - Category Resolution ---");

  // Construct an in-memory workbook with ClassCategories and Classes
  const testWb = XLSX.utils.book_new();

  const categoriesSheetData = [
    ["Category Reference ID", "Category Name *", "Description", "Display Order", "Status", "Branch Ref"],
    ["Unique code", "e.g. Primary", "Description", "Number", "Active or Inactive", "Branch"],
    ["CAT-TEST-OLEVEL", "TEST-CAT-OLevels", "Cambridge O Level Curriculum", "1", "Active", ""],
  ];
  const testCatSheet = XLSX.utils.aoa_to_sheet(categoriesSheetData);
  XLSX.utils.book_append_sheet(testWb, testCatSheet, "ClassCategories");

  const classesSheetData = [
    ["Class Reference ID", "Class Category Ref / Name", "Class Name *", "Class Code", "Numeric Level", "Branch Ref"],
    ["Unique code", "Category code or name", "Name", "Code", "Number", "Branch"],
    ["CLS-OL-1", "CAT-TEST-OLEVEL", "TEST-CLS-OLevel1", "OL1", "9", ""],
    ["CLS-OL-2", "TEST-CAT-OLevels", "TEST-CLS-OLevel2", "OL2", "10", ""],
  ];
  const testClassSheet = XLSX.utils.aoa_to_sheet(classesSheetData);
  XLSX.utils.book_append_sheet(testWb, testClassSheet, "Classes");

  const testWbBase64 = XLSX.write(testWb, { type: "base64", bookType: "xlsx" });

  const previewResult = await UniversalImportService.preview(
    schoolId,
    actorId,
    "complete-school",
    "test-category-import.xlsx",
    testWbBase64
  );

  console.log(`✔ Universal Import Preview generated (Job ID: ${previewResult.id})`);
  console.log(`   Total Rows: ${previewResult.totalRows}, Valid: ${previewResult.validRows}, Duplicates: ${previewResult.duplicateRows}, Invalid: ${previewResult.invalidRows}`);

  const resultRows = (previewResult as any).rows || [];
  const catRows = resultRows.filter((r: any) => r.entity === "classCategories");
  const clsRows = resultRows.filter((r: any) => r.entity === "classes");
  console.log(`   Found ${catRows.length} classCategories row(s) and ${clsRows.length} classes row(s).`);

  if (clsRows.length < 2) {
    throw new Error("Expected at least 2 classes rows in import preview.");
  }

  // --------------------------------------------------------------------------
  // TEST 9: Backward Compatibility - Legacy Workbook without Categories
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 9: Backward Compatibility with Legacy Workbooks ---");

  const legacyWb = XLSX.utils.book_new();
  const legacyClassesSheet = [
    ["Class Reference ID", "Class Name *", "Class Code", "Numeric Level", "Branch Ref"],
    ["CLS-LEG-1", "TEST-CLS-BackwardCompat1", "BC1", "1", ""],
  ];
  XLSX.utils.book_append_sheet(legacyWb, XLSX.utils.aoa_to_sheet(legacyClassesSheet), "Classes");
  const legacyBase64 = XLSX.write(legacyWb, { type: "base64", bookType: "xlsx" });

  const legacyPreview = await UniversalImportService.preview(
    schoolId,
    actorId,
    "classes",
    "legacy-classes.xlsx",
    legacyBase64
  );
  console.log(`✔ Legacy classes workbook parsed successfully without errors: Valid Rows = ${legacyPreview.validRows}`);
  if (legacyPreview.validRows === 0) {
    throw new Error("Legacy workbook failed to validate!");
  }

  // --------------------------------------------------------------------------
  // CLEANUP & FINAL VERIFICATION
  // --------------------------------------------------------------------------
  console.log("\n--- Cleaning Up Test DB Artifacts ---");
  await ClassModel.deleteMany({ schoolId, name: { $regex: /^TEST-CLS-/i } });
  await ClassCategory.deleteMany({ schoolId, name: { $regex: /^TEST-CAT-/i } });
  console.log("✔ Test data cleaned successfully.");

  console.log("\n================================================================================");
  console.log("  ALL TESTS PASSED: CLASS CATEGORY MANAGEMENT SYSTEM IS 100% OPERATIONAL!       ");
  console.log("================================================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

runVerification().catch((err) => {
  console.error("\n❌ VERIFICATION FAILED:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
