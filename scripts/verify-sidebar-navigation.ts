import { portalNavigation } from "../src/lib/portal-navigation";
import { connectDB } from "../src/server/config/db";
import { School } from "../src/server/models/school.model";
import { BulkImport } from "../src/server/models/bulkImport.model";
import { UniversalImportService } from "../src/server/services/universalImport.service";
import nextConfig from "../next.config.mjs";

async function verifySidebarNavigation() {
  console.log("================================================================================");
  console.log("  ACADIVO SIDEBAR NAVIGATION & COMPLETE SCHOOL IMPORT VERIFICATION SUITE");
  console.log("================================================================================\n");

  // --------------------------------------------------------------------------
  // TEST 1: Inspect SCHOOL_ADMIN Navigation Configuration
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Inspecting portalNavigation.SCHOOL_ADMIN ---");
  const schoolAdminNav = portalNavigation.SCHOOL_ADMIN;
  if (!schoolAdminNav) {
    throw new Error("portalNavigation.SCHOOL_ADMIN configuration is missing!");
  }

  const groups = schoolAdminNav.groups;

  // 1. Data Management Section
  const dataMgmtGroup = groups.find((g) => g.label.toLowerCase() === "data management");
  if (!dataMgmtGroup) {
    throw new Error("Missing 'Data Management' section in SCHOOL_ADMIN navigation!");
  }

  console.log(`✔ Found 'Data Management' section with ${dataMgmtGroup.items.length} item(s):`);
  dataMgmtGroup.items.forEach((item) => {
    console.log(`   - "${item.label}" -> ${item.path}`);
  });

  if (dataMgmtGroup.items.length !== 1) {
    throw new Error(`Expected exactly 1 item under Data Management, found ${dataMgmtGroup.items.length}!`);
  }

  const singleItem = dataMgmtGroup.items[0];
  if (singleItem.label !== "Complete School Import" || singleItem.path !== "/data-management/complete-school-import") {
    throw new Error(`Unexpected item under Data Management: label="${singleItem.label}", path="${singleItem.path}"`);
  }
  console.log("✔ Verified: Exactly ONE item ('Complete School Import') under DATA MANAGEMENT.");

  // 2. Administration Section
  const adminGroup = groups.find((g) => g.label.toLowerCase() === "administration");
  if (!adminGroup) {
    throw new Error("Missing 'Administration' section in SCHOOL_ADMIN navigation!");
  }

  console.log(`\n✔ Found 'Administration' section with ${adminGroup.items.length} items:`);
  adminGroup.items.forEach((item) => {
    console.log(`   - "${item.label}" -> ${item.path}`);
  });

  const duplicateInAdmin = adminGroup.items.filter(
    (item) =>
      item.label.toLowerCase().includes("import") ||
      item.label.toLowerCase().includes("migration") ||
      item.path.includes("data-management")
  );

  if (duplicateInAdmin.length > 0) {
    throw new Error(`Found disallowed import/migration items in Administration: ${JSON.stringify(duplicateInAdmin)}`);
  }
  console.log("✔ Verified: Zero import/migration items in ADMINISTRATION section.");

  // Check expected items in Administration
  if (adminGroup.items[0].label !== "Announcements") {
    throw new Error(`Expected first item in Administration to be 'Announcements', found '${adminGroup.items[0].label}'`);
  }
  if (adminGroup.items[1].label !== "Notifications") {
    throw new Error(`Expected second item in Administration to be 'Notifications', found '${adminGroup.items[1].label}'`);
  }
  if (!adminGroup.items.some((i) => i.label.toLowerCase().includes("basic report"))) {
    throw new Error("Missing 'Basic reports' in Administration section!");
  }
  console.log("✔ Verified: Administration section contains Announcements, Notifications, Basic Reports, and other admin pages.");

  // 3. Check for any duplicate paths across ALL groups
  console.log("\n--- TEST 2: Checking for Duplicate Paths Across Entire Sidebar ---");
  const seenPaths = new Set<string>();
  const duplicatePaths: string[] = [];

  for (const group of groups) {
    for (const item of group.items) {
      if (!item.path) continue; // skip overview/root
      if (seenPaths.has(item.path)) {
        duplicatePaths.push(`${item.path} (in group '${group.label}')`);
      } else {
        seenPaths.add(item.path);
      }
    }
  }

  if (duplicatePaths.length > 0) {
    throw new Error(`Duplicate paths detected in sidebar navigation: ${duplicatePaths.join(", ")}`);
  }
  console.log(`✔ Verified: Zero duplicate paths detected across all ${groups.length} sidebar groups (${seenPaths.size} unique paths).`);

  // --------------------------------------------------------------------------
  // TEST 3: Check Next.js Redirect Configuration
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Verifying Next.js Redirects for Legacy Routes ---");
  if (typeof nextConfig.redirects !== "function") {
    throw new Error("next.config.mjs does not export async redirects() function!");
  }

  const redirects = await nextConfig.redirects();
  console.log(`✔ Found ${redirects.length} configured redirects in next.config.mjs:`);
  redirects.forEach((r: any) => {
    console.log(`   - ${r.source} -> ${r.destination} (permanent: ${r.permanent})`);
  });

  const migrationRedirect = redirects.find(
    (r: any) =>
      r.source === "/school-admin/data-management/migration" &&
      r.destination === "/school-admin/data-management/complete-school-import"
  );

  if (!migrationRedirect) {
    throw new Error("Missing redirect from /school-admin/data-management/migration to /school-admin/data-management/complete-school-import!");
  }
  console.log("✔ Verified: Legacy migration route redirect correctly configured in next.config.mjs.");

  // --------------------------------------------------------------------------
  // TEST 4: Database & UniversalImportService.history API
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Verifying Import History Backend Functionality ---");
  await connectDB();
  console.log("✔ Connected to MongoDB successfully.");

  const timestamp = Date.now();
  const testSchool = await School.create({
    name: "Nav Verification School",
    code: `nvs-${timestamp.toString().slice(-5)}`,
    slug: `test-nav-school-${timestamp}`,
    email: `nav-${timestamp}@acadivo.test`,
    phone: "042-35111199",
    address: "Lahore, Pakistan",
    plan: "PROFESSIONAL",
    studentCountRange: "301-1500",
    teacherCount: 40,
    status: "ACTIVE",
  });

  // Create mock master import history record
  const mockImport = await BulkImport.create({
    schoolId: testSchool._id,
    actorId: testSchool._id,
    entity: "master",
    isMaster: true,
    filename: "Acadivo-Professional-Example-Data.xlsx",
    status: "COMPLETED",
    rows: [],
    summary: {
      total: 250,
      valid: 250,
      imported: 250,
      invalid: 0,
      duplicate: 0,
      planTier: "PROFESSIONAL",
      planName: "Professional Plan",
    },
    sheets: {
      Students: { total: 100, valid: 100 },
      Teachers: { total: 15, valid: 15 },
    },
    processed: 250,
    expiresAt: new Date(Date.now() + 86400000),
  });

  try {
    const historyList = await UniversalImportService.history(testSchool._id);
    console.log(`✔ Retrieved ${historyList.length} history item(s) from UniversalImportService.history:`);
    console.log(`   - Filename: ${historyList[0]?.filename}`);
    console.log(`   - Status: ${historyList[0]?.status}`);
    console.log(`   - Plan Tier: ${historyList[0]?.planTier}`);
    console.log(`   - Total Rows: ${historyList[0]?.totalRows}`);
    console.log(`   - Created Records: ${historyList[0]?.successRows}`);

    if (historyList.length === 0 || historyList[0].totalRows !== 250) {
      throw new Error("History list verification failed!");
    }
  } finally {
    // Clean up
    console.log("\n--- CLEANUP: Removing verification records ---");
    await BulkImport.deleteMany({ _id: mockImport._id });
    await School.deleteMany({ _id: testSchool._id });
    console.log("✔ Cleanup complete.");
  }

  console.log("\n================================================================================");
  console.log("  ALL SIDEBAR NAVIGATION & REDIRECT TESTS PASSED SUCCESSFULLY!  ");
  console.log("================================================================================");
}

verifySidebarNavigation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Verification Failed:", err);
    process.exit(1);
  });
