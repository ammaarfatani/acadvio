import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import {
  UNIVERSAL_ENTITIES,
  EntityDefinition,
  SubscriptionPlanTier,
  PLAN_ENTITIES,
  PLAN_TIER_DETAILS,
  normalizePlanTier,
  UniversalEntityKey,
} from "../../lib/universal-import-config";

export class UniversalTemplateService {
  /**
   * Generates a plan-specific Blank Migration Template (.xlsx).
   * Contains only the worksheets authorized for that plan tier, with headers,
   * row 1 format instructions, dropdown validations, and empty entry rows.
   */
  static generatePlanBlankTemplate(planTierInput: SubscriptionPlanTier | string = "ENTERPRISE"): Buffer {
    const tier = normalizePlanTier(planTierInput);
    const book = XLSX.utils.book_new();

    // 1. Instructions Sheet
    this.addInstructionsSheet(book, tier, false);

    // 2. Index Sheet
    this.addIndexSheet(book, tier);

    // 3. Plan-specific Entity Sheets (empty entry area)
    const entityKeys = PLAN_ENTITIES[tier];
    for (const key of entityKeys) {
      const def = UNIVERSAL_ENTITIES[key];
      if (def) {
        this.addEntitySheet(book, def, false, []);
      }
    }

    return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  }

  /**
   * Generates a plan-specific Example Data Workbook (.xlsx).
   * Pre-populated with rich, 100% interconnected realistic fictional data
   * tailored to the modules and scale of that subscription plan.
   */
  static generatePlanExampleWorkbook(
    planTierInput: SubscriptionPlanTier | string = "ENTERPRISE",
    studentCountTarget?: number
  ): Buffer {
    const tier = normalizePlanTier(planTierInput);
    const book = XLSX.utils.book_new();

    // 1. Instructions Sheet with Example Notice
    this.addInstructionsSheet(book, tier, true);

    // 2. Index Sheet
    this.addIndexSheet(book, tier);

    // 3. Populate all authorized worksheets with interconnected records
    this.addPopulatedPlanSheets(book, tier, studentCountTarget);

    return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  }

  /**
   * Backwards-compatible Master School Migration Blank Workbook (Enterprise tier, 38 sheets).
   */
  static generateMasterTemplate(): Buffer {
    return this.generatePlanBlankTemplate("ENTERPRISE");
  }

  /**
   * Backwards-compatible Sample Demonstration School (Enterprise tier, 1,000+ students).
   */
  static generateSampleDemonstrationSchool(): Buffer {
    return this.generatePlanExampleWorkbook("ENTERPRISE", 1000);
  }

  /**
   * Generates a blank individual module Excel template.
   */
  static generateModuleTemplate(entityKey: string): Buffer {
    const def = UNIVERSAL_ENTITIES[entityKey];
    if (!def) {
      throw new Error(`Unknown entity: ${entityKey}`);
    }

    const book = XLSX.utils.book_new();
    this.addEntitySheet(book, def, false, []);

    // Instructions sheet specific to this entity
    const instructionsData = [
      ["ACADIVO BULK IMPORT INSTRUCTIONS", ""],
      ["Module", def.label],
      ["Worksheet Name", def.sheetName],
      ["Required Permission", def.permission],
      ["Dependencies", def.dependencies.length ? def.dependencies.join(", ") : "None (Foundation)"],
      ["", ""],
      ["FIELD SPECIFICATIONS", "", "", ""],
      ["Field Label", "Field Key", "Required", "Format & Guidance"],
      ...def.columns.map(c => [c.label, c.key, c.required ? "YES *" : "Optional", c.instruction || "Enter valid data."]),
      ["", ""],
      ["GENERAL IMPORT RULES", ""],
      ["1. Date Format", "Always use YYYY-MM-DD (e.g. 2025-08-15) or native Excel date cells."],
      ["2. Text Numbers", "Format CNIC, B-Form, telephone, and bank account numbers as Text to preserve leading zeros."],
      ["3. Idempotency", "Existing records are checked by their unique identifiers and skipped without duplication."],
      ["4. Blank Rows", "Enter your school records starting on row 2 (underneath the guidance row)."],
    ];

    const instSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    instSheet["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(book, instSheet, "Instructions");

    return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  }

  /**
   * Generates a pre-filled individual module Excel Example File with realistic rows.
   */
  static generateModuleExampleTemplate(entityKey: string): Buffer {
    const def = UNIVERSAL_ENTITIES[entityKey];
    if (!def) {
      throw new Error(`Unknown entity: ${entityKey}`);
    }

    const book = XLSX.utils.book_new();
    const sampleRows = this.getSampleRowsForSingleEntity(entityKey);
    this.addEntitySheet(book, def, false, sampleRows);

    const instructionsData = [
      ["ACADIVO MODULE EXAMPLE DATA GUIDE", ""],
      ["Module", def.label],
      ["Worksheet Name", def.sheetName],
      ["", ""],
      ["IMPORTANT NOTICE", "This workbook contains fictional example data demonstrating the correct layout, required fields, and format. Replace these sample rows with your school's actual data before importing."],
      ["", ""],
      ["FIELD SPECIFICATIONS", "", "", ""],
      ["Field Label", "Field Key", "Required", "Format & Guidance"],
      ...def.columns.map(c => [c.label, c.key, c.required ? "YES *" : "Optional", c.instruction || "Enter valid data."]),
      ["", ""],
      ["GENERAL GUIDELINES", ""],
      ["1. Date Format", "Always use YYYY-MM-DD (e.g. 2025-08-15)."],
      ["2. Phone / CNIC", "Store numbers as Text to retain initial zero digits."],
      ["3. Unique Keys", "Do not duplicate existing student admission numbers, employee IDs, or challan codes."],
    ];

    const instSheet = XLSX.utils.aoa_to_sheet(instructionsData);
    instSheet["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(book, instSheet, "Instructions");

    return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  }

  /**
   * Pre-generates all 6 plan-specific workbooks + legacy aliases and writes to public/templates/
   */
  static saveAllPlanTemplatesToDisk(): { filename: string; sizeKb: number }[] {
    const outputDir = path.resolve(process.cwd(), "public/templates");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filesToGenerate: { filename: string; generate: () => Buffer }[] = [
      // Basic Plan
      {
        filename: "Acadivo-Basic-Example-Data.xlsx",
        generate: () => this.generatePlanExampleWorkbook("BASIC", 50),
      },
      {
        filename: "Acadivo-Basic-Blank-Template.xlsx",
        generate: () => this.generatePlanBlankTemplate("BASIC"),
      },
      // Professional Plan
      {
        filename: "Acadivo-Professional-Example-Data.xlsx",
        generate: () => this.generatePlanExampleWorkbook("PROFESSIONAL", 100),
      },
      {
        filename: "Acadivo-Professional-Blank-Template.xlsx",
        generate: () => this.generatePlanBlankTemplate("PROFESSIONAL"),
      },
      // Enterprise Plan
      {
        filename: "Acadivo-Enterprise-Example-Data.xlsx",
        generate: () => this.generatePlanExampleWorkbook("ENTERPRISE", 250),
      },
      {
        filename: "Acadivo-Enterprise-Blank-Template.xlsx",
        generate: () => this.generatePlanBlankTemplate("ENTERPRISE"),
      },
      // Legacy Aliases for backwards compatibility
      {
        filename: "Acadivo-Complete-School-Migration-Template.xlsx",
        generate: () => this.generatePlanBlankTemplate("ENTERPRISE"),
      },
      {
        filename: "Acadivo-Sample-Demonstration-School.xlsx",
        generate: () => this.generatePlanExampleWorkbook("ENTERPRISE", 1000),
      },
    ];

    const results: { filename: string; sizeKb: number }[] = [];

    for (const item of filesToGenerate) {
      const buf = item.generate();
      const filePath = path.join(outputDir, item.filename);
      fs.writeFileSync(filePath, buf);
      const stat = fs.statSync(filePath);
      results.push({
        filename: item.filename,
        sizeKb: Number((stat.size / 1024).toFixed(1)),
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Internal Sheet Builders
  // --------------------------------------------------------------------------

  private static addInstructionsSheet(book: XLSX.WorkBook, tier: SubscriptionPlanTier, isExample = false) {
    const details = PLAN_TIER_DETAILS[tier];
    const entityKeys = PLAN_ENTITIES[tier];

    const rows: any[][] = [
      [`ACADIVO — ${details.name.toUpperCase()} DATA MIGRATION SYSTEM`],
      [`Authorized Plan: ${details.name} | Total Worksheets: ${details.sheetCount} (Instructions, Index + ${details.entityCount} Operational Modules)`],
      [`Entitlement Limits: ${details.maxStudentsDisplay} | ${details.maxTeachersDisplay} | ${details.branchesDisplay}`],
      [""],
    ];

    if (isExample) {
      rows.push([
        "DEMONSTRATION EXAMPLE NOTICE",
        `This workbook is pre-filled with realistic, 100% interconnected fictional data demonstrating the exact data structure for your ${details.name}. Replace these sample records with your actual school data before final import.`,
      ]);
      rows.push([""]);
    } else {
      rows.push([
        "BLANK MIGRATION TEMPLATE",
        `This is a clean, formatted template containing the correct column headers, format instructions, and dropdown validations for your ${details.name}. Enter your school's records starting on row 2 (underneath the guidance row).`,
      ]);
      rows.push([""]);
    }

    rows.push(
      ["HOW TO MIGRATE YOUR SCHOOL DATA INTO ACADIVO"],
      ["1. Review Worksheets", `Your ${details.name} includes ${details.entityCount} operational entity worksheets mapped to your subscription.`],
      ["2. Fill Applicable Sheets", "You do NOT need to fill every sheet. If your school does not use optional modules, leave them empty; empty sheets are safely skipped."],
      ["3. Topological Order", "Data is imported in dependency order (Foundation -> Classes -> Faculty -> Students -> Modules)."],
      ["4. Reference Keys", "Cross-sheet references use human-readable reference codes (e.g., Student Admission Number, Class Code, Teacher Email). Acadivo automatically resolves these."],
      ["5. Format Numbers as Text", "To preserve leading zeros in Phone Numbers, CNIC, and B-Forms, ensure those cells are formatted as Text in Excel."],
      ["6. Standard Date Format", "Use YYYY-MM-DD (e.g. 2025-09-01) for all date columns."],
      ["7. Duplicate Safety", "Existing records are detected by their unique identifiers and skipped without overwriting existing data."],
      ["8. Error Reports", "If any rows contain invalid data, you can download a line-by-line Excel Error Report detailing the exact row and validation reason."],
      [""],
      ["SUMMARY OF WORKSHEETS INCLUDED IN YOUR PLAN"],
      ["Worksheet Name", "Module Category", "Prerequisite Dependency", "Required Status", "Plan Feature"]
    );

    for (const key of entityKeys) {
      const def = UNIVERSAL_ENTITIES[key];
      if (def) {
        rows.push([
          def.sheetName,
          def.group,
          def.dependencies.length ? def.dependencies.join(", ") : "None",
          ["Branches", "AcademicSessions", "Classes", "Sections", "Students", "Teachers"].includes(def.sheetName) ? "YES" : "Optional",
          def.permission || "CORE_ADMIN",
        ]);
      }
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [{ wch: 32 }, { wch: 80 }, { wch: 30 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(book, sheet, "Instructions");
  }

  private static addIndexSheet(book: XLSX.WorkBook, tier: SubscriptionPlanTier) {
    const entityKeys = PLAN_ENTITIES[tier];

    const headers = [
      "Order",
      "Worksheet Name",
      "Module Category",
      "Module Title",
      "Prerequisite Dependencies",
      "Required Status",
      "Description",
    ];

    const data: any[][] = [headers];
    let orderNum = 1;

    for (const key of entityKeys) {
      const def = UNIVERSAL_ENTITIES[key];
      if (def) {
        data.push([
          orderNum++,
          def.sheetName,
          def.group,
          def.label,
          def.dependencies.length ? def.dependencies.join(", ") : "None",
          ["Branches", "AcademicSessions", "Classes", "Sections", "Students", "Teachers"].includes(def.sheetName) ? "Core Required" : "Optional",
          def.description,
        ]);
      }
    }

    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 22 },
      { wch: 28 },
      { wch: 30 },
      { wch: 18 },
      { wch: 75 },
    ];
    sheet["!autofilter"] = { ref: `A1:G${data.length}` };
    XLSX.utils.book_append_sheet(book, sheet, "Index");
  }

  private static addEntitySheet(
    book: XLSX.WorkBook,
    def: EntityDefinition,
    includeExampleFallback = false,
    customRows?: any[][]
  ) {
    const headerRow = def.columns.map(c => (c.required ? `${c.label} *` : c.label));
    const instructionRow = def.columns.map(c => c.instruction || (c.required ? "Required" : "Optional"));

    const rows: any[][] = [headerRow, instructionRow];

    if (customRows !== undefined) {
      if (customRows.length > 0) {
        rows.push(...customRows);
      }
    } else if (includeExampleFallback) {
      rows.push(def.columns.map(c => c.example));
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);

    sheet["!cols"] = def.columns.map(c => ({
      wch: Math.max(16, Math.min(42, Math.max(c.label.length + 5, (c.example || "").length + 4))),
    }));

    sheet["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_col(def.columns.length - 1)}1`,
    };

    for (const [addr, cell] of Object.entries(sheet)) {
      if (!addr.startsWith("!") && (cell as XLSX.CellObject).t === "s") {
        (cell as XLSX.CellObject).z = "@";
      }
    }

    XLSX.utils.book_append_sheet(book, sheet, def.sheetName);
  }

  // --------------------------------------------------------------------------
  // Plan-Specific Interconnected Data Generator
  // --------------------------------------------------------------------------

  private static addPopulatedPlanSheets(
    book: XLSX.WorkBook,
    tier: SubscriptionPlanTier,
    targetStudents?: number
  ) {
    const isEnterprise = tier === "ENTERPRISE";
    const isProfessionalOrEnterprise = tier === "PROFESSIONAL" || isEnterprise;

    // Determine student population count
    const studentCount = targetStudents || (tier === "BASIC" ? 50 : tier === "PROFESSIONAL" ? 100 : 250);

    // 1. Branches (Enterprise Only)
    const branchesData = [
      ["BR-MAIN", "Beacon Grammar School - Main Campus", "main-campus", "Campus 1, Gulberg III, Lahore", "042-35711111", "main@beaconschool.edu.pk", "Yes", "ACTIVE", "Habib Bank Limited", "Beacon Grammar Main", "01234567890123", "PK36HABB0001234567890123"],
      ["BR-DEF", "Beacon Grammar School - Defence Campus", "defence-campus", "Sector Y, Phase 3, DHA, Lahore", "042-35892222", "defence@beaconschool.edu.pk", "No", "ACTIVE", "Meezan Bank", "Beacon Grammar Defence", "98765432109876", "PK12MEZN0009876543210987"],
      ["BR-JNR", "Beacon Grammar School - Junior Campus", "johar-campus", "Block G, Johar Town, Lahore", "042-35293333", "junior@beaconschool.edu.pk", "No", "ACTIVE", "Muslim Commercial Bank", "Beacon Grammar Junior", "11223344556677", "PK45MCBL0001122334455667"],
    ];
    if (isEnterprise) {
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.branches, false, branchesData);
    }

    // Branch reference used across other sheets (blank/default for single-campus)
    const mainBranchRef = isEnterprise ? "BR-MAIN" : "";

    // 2. Academic Sessions (All Plans)
    const sessionsData = [
      ["SESS-2024-25", "2024-2025", "2024-08-01", "2025-06-30", "No", "Yes", mainBranchRef],
      ["SESS-2025-26", "2025-2026", "2025-08-01", "2026-06-30", "Yes", "No", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.academicSessions, false, sessionsData);

    // 3. Departments (Professional & Enterprise)
    if (isProfessionalOrEnterprise) {
      const departmentsData = [
        ["DEP-ACAD", "Academic Faculty", mainBranchRef],
        ["DEP-ADMIN", "Administration & HR", mainBranchRef],
        ["DEP-FIN", "Accounts & Finance", mainBranchRef],
        ["DEP-SCI", "Science & Computer Labs", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.departments, false, departmentsData);
    }

    // 3.5 Class Categories (All Plans)
    const classCategoriesData = [
      ["CAT-PRI", "Primary", "Grade 1 through Grade 5 foundational primary schooling", 1, "Active", mainBranchRef],
      ["CAT-MID", "Middle School", "Grade 6 through Grade 8 intermediate schooling", 2, "Active", mainBranchRef],
      ["CAT-SEC", "Secondary", "Grade 9 and Grade 10 matriculation and O-levels", 3, "Active", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.classCategories, false, classCategoriesData);

    // 4. Classes (All Plans - Grade 1 through Grade 10)
    const classesData = [
      ["CLS-G1", "CAT-PRI", "Grade 1", "G1", "1", mainBranchRef],
      ["CLS-G2", "CAT-PRI", "Grade 2", "G2", "2", mainBranchRef],
      ["CLS-G3", "CAT-PRI", "Grade 3", "G3", "3", mainBranchRef],
      ["CLS-G4", "CAT-PRI", "Grade 4", "G4", "4", mainBranchRef],
      ["CLS-G5", "CAT-PRI", "Grade 5", "G5", "5", mainBranchRef],
      ["CLS-G6", "CAT-MID", "Grade 6", "G6", "6", mainBranchRef],
      ["CLS-G7", "CAT-MID", "Grade 7", "G7", "7", mainBranchRef],
      ["CLS-G8", "CAT-MID", "Grade 8", "G8", "8", mainBranchRef],
      ["CLS-G9", "CAT-SEC", "Grade 9", "G9", "9", mainBranchRef],
      ["CLS-G10", "CAT-SEC", "Grade 10", "G10", "10", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.classes, false, classesData);

    // 5. Sections (All Plans - Section A & B for each class)
    const sectionsData: any[][] = [];
    for (let g = 1; g <= 10; g++) {
      sectionsData.push([`SEC-G${g}A`, `Grade ${g}`, `Section A`, `Room ${100 + g}`, "40", mainBranchRef]);
      sectionsData.push([`SEC-G${g}B`, `Grade ${g}`, `Section B`, `Room ${200 + g}`, "40", mainBranchRef]);
    }
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.sections, false, sectionsData);

    // 6. Grading Scales (Professional & Enterprise)
    if (isProfessionalOrEnterprise) {
      const gradingData = [
        ["Standard Scale", "A+", "80", "100", "4.0", "Exceptional", "Yes", mainBranchRef],
        ["Standard Scale", "A", "70", "79.99", "3.5", "Excellent", "Yes", mainBranchRef],
        ["Standard Scale", "B", "60", "69.99", "3.0", "Very Good", "Yes", mainBranchRef],
        ["Standard Scale", "C", "50", "59.99", "2.0", "Satisfactory", "Yes", mainBranchRef],
        ["Standard Scale", "D", "33", "49.99", "1.0", "Pass", "Yes", mainBranchRef],
        ["Standard Scale", "F", "0", "32.99", "0.0", "Fail", "Yes", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.gradingScales, false, gradingData);
    }

    // 7. Subjects (All Plans)
    const subjectsData = [
      ["SUB-ENG-G10", "Grade 10", "English Language", "ENG-10", "Core", "100", "33", mainBranchRef],
      ["SUB-URD-G10", "Grade 10", "Urdu Literature", "URD-10", "Core", "100", "33", mainBranchRef],
      ["SUB-MTH-G10", "Grade 10", "Mathematics", "MTH-10", "Core", "100", "33", mainBranchRef],
      ["SUB-PHY-G10", "Grade 10", "Physics", "PHY-10", "Core", "100", "33", mainBranchRef],
      ["SUB-CHM-G10", "Grade 10", "Chemistry", "CHM-10", "Core", "100", "33", mainBranchRef],
      ["SUB-BIO-G10", "Grade 10", "Biology", "BIO-10", "Elective", "100", "33", mainBranchRef],
      ["SUB-CMP-G10", "Grade 10", "Computer Science", "CMP-10", "Elective", "100", "33", mainBranchRef],
      ["SUB-PST-G10", "Grade 10", "Pakistan Studies", "PST-10", "Core", "50", "17", mainBranchRef],
      ["SUB-ISL-G10", "Grade 10", "Islamiat", "ISL-10", "Core", "50", "17", mainBranchRef],
      // Grade 9
      ["SUB-MTH-G9", "Grade 9", "Mathematics", "MTH-9", "Core", "100", "33", mainBranchRef],
      ["SUB-ENG-G9", "Grade 9", "English Language", "ENG-9", "Core", "100", "33", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.subjects, false, subjectsData);

    // 8. Assessment Policies (Professional & Enterprise)
    if (isProfessionalOrEnterprise) {
      const policiesData = [
        ["2025-2026", "Grade 10", "WEIGHTED", "ZERO_FAIL", "Yes", mainBranchRef],
        ["2025-2026", "Grade 9", "WEIGHTED", "ZERO_FAIL", "Yes", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.assessmentPolicies, false, policiesData);
    }

    // 9. Teachers (All Plans: 15 teachers for Basic, 25 for Pro/Enterprise)
    const teacherCount = tier === "BASIC" ? 15 : 25;
    const teachersData: any[][] = [];
    const firstNames = ["Ahmed", "Muhammad", "Tariq", "Zubair", "Bilal", "Usman", "Fatima", "Ayesha", "Zainab", "Maryam", "Sana", "Khadija", "Hassan", "Ali", "Rashid", "Noman", "Farhan", "Saima", "Bushra", "Nadia", "Irfan", "Kamran", "Asad", "Yasir", "Sadia"];
    const lastNames = ["Khan", "Malik", "Chaudhry", "Bhatti", "Qureshi", "Siddiqui", "Abbasi", "Sheikh", "Raza", "Hussain"];

    for (let i = 0; i < teacherCount; i++) {
      const fName = firstNames[i % firstNames.length];
      const lName = lastNames[i % lastNames.length];
      const tEmail = `teacher.${fName.toLowerCase()}.${i + 1}@beacon.edu.pk`;
      const tBranch = isEnterprise && i >= 18 ? "BR-DEF" : isEnterprise && i >= 22 ? "BR-JNR" : mainBranchRef;

      teachersData.push([
        `TCH-${100 + i}`,
        `EMP-20${String(i + 1).padStart(2, "0")}`,
        `${fName} ${lName}`,
        tEmail,
        `TeacherPass2026!`,
        i % 2 === 0 ? "M.Sc. Mathematics, B.Ed." : "M.A. English Literature",
        `0300-${String(1000000 + i * 371).slice(0, 7)}`,
        "ACTIVE",
        tBranch,
      ]);
    }
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.teachers, false, teachersData);

    // 10. Staff (Professional & Enterprise)
    const staffData = [
      ["STF-ADMIN", "EMP-1001", "Nasreen Akhtar", "admin.nasreen@beacon.edu.pk", "AdminSecure2026!", "SCHOOL_ADMIN", "Administration & HR", "Vice Principal", "0300-9871111", "2020-01-01", "", "ACTIVE", "120000", "MONTHLY", mainBranchRef],
      ["STF-FIN1", "EMP-1002", "Tariq Mehmood", "tariq.accounts@beacon.edu.pk", "FinanceSecure2026!", "FINANCE", "Accounts & Finance", "Chief Accountant", "0321-9872222", "2021-03-01", "", "ACTIVE", "85000", "MONTHLY", mainBranchRef],
      ["STF-EXAM1", "EMP-1003", "Zahid Javed", "zahid.exams@beacon.edu.pk", "ExamSecure2026!", "EXAM_STAFF", "Academic Faculty", "Controller of Examinations", "0333-9873333", "2021-06-01", "", "ACTIVE", "90000", "MONTHLY", mainBranchRef],
      ["STF-REC1", "EMP-1004", "Ayesha Siddiqa", "ayesha.frontdesk@beacon.edu.pk", "ReceptionSecure2026!", "RECEPTIONIST", "Administration & HR", "Front Desk Officer", "0345-9874444", "2022-09-01", "", "ACTIVE", "55000", "MONTHLY", mainBranchRef],
    ];
    if (isProfessionalOrEnterprise) {
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.staff, false, staffData);
    }

    // 11. Class Teacher Assignments (All Plans)
    const classTeacherData = [
      ["2025-2026", "Grade 10", "Section A", teachersData[0][3], mainBranchRef],
      ["2025-2026", "Grade 10", "Section B", teachersData[1][3], mainBranchRef],
      ["2025-2026", "Grade 9", "Section A", teachersData[2][3], mainBranchRef],
      ["2025-2026", "Grade 9", "Section B", teachersData[3][3], mainBranchRef],
      ["2025-2026", "Grade 8", "Section A", teachersData[4][3], mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.classTeacherAssignments, false, classTeacherData);

    // 12. Teaching Assignments (All Plans)
    const teachingAssignData = [
      [teachersData[0][3], "2025-2026", "Grade 10", "Section A", "MTH-10", "ACTIVE", mainBranchRef],
      [teachersData[1][3], "2025-2026", "Grade 10", "Section A", "PHY-10", "ACTIVE", mainBranchRef],
      [teachersData[2][3], "2025-2026", "Grade 10", "Section A", "CHM-10", "ACTIVE", mainBranchRef],
      [teachersData[3][3], "2025-2026", "Grade 10", "Section A", "ENG-10", "ACTIVE", mainBranchRef],
      [teachersData[0][3], "2025-2026", "Grade 9", "Section A", "MTH-9", "ACTIVE", mainBranchRef],
      [teachersData[3][3], "2025-2026", "Grade 9", "Section A", "ENG-9", "ACTIVE", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.teachingAssignments, false, teachingAssignData);

    // 13. Timetable (All Plans)
    const timetableData = [
      ["2025-2026", "Grade 10", "Section A", "Monday", "1", "08:00", "08:45", "MTH-10", teachersData[0][3], "Room 201", mainBranchRef],
      ["2025-2026", "Grade 10", "Section A", "Monday", "2", "08:45", "09:30", "PHY-10", teachersData[1][3], "Room 201", mainBranchRef],
      ["2025-2026", "Grade 10", "Section A", "Monday", "3", "09:30", "10:15", "ENG-10", teachersData[3][3], "Room 201", mainBranchRef],
      ["2025-2026", "Grade 10", "Section A", "Tuesday", "1", "08:00", "08:45", "CHM-10", teachersData[2][3], "Room 201", mainBranchRef],
      ["2025-2026", "Grade 9", "Section A", "Monday", "1", "08:00", "08:45", "ENG-9", teachersData[3][3], "Room 109", mainBranchRef],
      ["2025-2026", "Grade 9", "Section A", "Monday", "2", "08:45", "09:30", "MTH-9", teachersData[0][3], "Room 109", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.timetable, false, timetableData);

    // 14. Students Generator (Interconnected)
    const studentsData: any[][] = [];
    const parentAccountsData: any[][] = [];
    const studentAttendanceData: any[][] = [];
    const challansData: any[][] = [];
    const paymentsData: any[][] = [];
    const marksData: any[][] = [];
    const resultsData: any[][] = [];

    const studentFirstNamesMale = ["Muhammad", "Ali", "Hamza", "Bilal", "Usman", "Zain", "Hassan", "Hussein", "Omer", "Abdullah", "Saad", "Daniyal", "Farhan", "Shahzaib", "Rayan", "Talha", "Haris", "Ibrahim", "Subhan", "Mustafa"];
    const studentFirstNamesFemale = ["Fatima", "Ayesha", "Zainab", "Maryam", "Sana", "Khadija", "Hafsa", "Noor", "Hiba", "Eshal", "Anaya", "Alishba", "Laiba", "Dua", "Manahil", "Mehak", "Bisma", "Iqra", "Zoya", "Rameen"];

    for (let i = 1; i <= studentCount; i++) {
      const isMale = i % 2 === 1;
      const fName = isMale
        ? studentFirstNamesMale[(i - 1) % studentFirstNamesMale.length]
        : studentFirstNamesFemale[(i - 1) % studentFirstNamesFemale.length];
      const lName = lastNames[(i - 1) % lastNames.length];
      const fullName = `${fName} ${lName}`;
      const fatherName = `${studentFirstNamesMale[(i + 3) % studentFirstNamesMale.length]} ${lName}`;

      const classIndex = (i - 1) % 20;
      const gradeNum = Math.floor(classIndex / 2) + 1; // 1 to 10
      const className = `Grade ${gradeNum}`;
      const sectionLetter = classIndex % 2 === 0 ? "Section A" : "Section B";
      const rollSeq = Math.floor((i - 1) / 20) + 1;
      const rollNum = `${gradeNum}-${sectionLetter.slice(-1)}-${String(rollSeq).padStart(2, "0")}`;

      const admNo = `ADM-2025-${String(i).padStart(4, "0")}`;
      const stuRef = `STU-${String(i).padStart(4, "0")}`;
      const stuId = `ST-2025-${String(i).padStart(4, "0")}`;

      const bForm = `35201-${String(1000000 + i * 7).slice(0, 7)}-${isMale ? "1" : "2"}`;
      const fatherCnic = `35201-${String(7000000 + i * 3).slice(0, 7)}-1`;
      const fatherPhone = `0300-${String(2000000 + i * 19).slice(0, 7)}`;
      const guardianEmail = `guardian.${stuRef.toLowerCase()}@example.com`;

      const birthYear = 2026 - (gradeNum + 5);
      const dob = `${birthYear}-04-${String((i % 28) + 1).padStart(2, "0")}`;

      const stuBranch = isEnterprise && i > 180 ? "BR-DEF" : isEnterprise && i > 220 ? "BR-JNR" : mainBranchRef;

      studentsData.push([
        stuRef,
        admNo,
        stuId,
        bForm,
        fullName,
        "", // nameUrdu
        dob,
        isMale ? "Male" : "Female",
        "Pakistani",
        "Islam",
        ["A+", "B+", "O+", "AB+"][i % 4],
        "Lahore",
        gradeNum > 1 ? "Beacon Public School" : "",
        gradeNum > 1 ? `Grade ${gradeNum - 1}` : "",
        "2025-2026",
        className,
        sectionLetter,
        rollNum,
        "2025-08-15",
        `House ${i % 250 + 1}, Street ${i % 20 + 1}, Block C, Lahore`,
        "",
        "",
        `0321-${String(1000000 + i * 13).slice(0, 7)}`,
        fatherName,
        fatherPhone,
        fatherCnic,
        "Businessman",
        `Sultana ${lName}`,
        `0301-${String(3000000 + i * 11).slice(0, 7)}`,
        "",
        "",
        guardianEmail,
        "Father",
        fatherName,
        fatherPhone,
        "Father",
        "Normal Health",
        i % 15 === 0 ? "Pollen / Dust" : "None",
        "",
        "ACTIVE",
        stuBranch,
      ]);

      // Linked Parent accounts (for first 25-50 students)
      if (i <= (tier === "BASIC" ? 25 : 50)) {
        parentAccountsData.push([
          `PRNT-${i}`,
          fatherName,
          guardianEmail,
          "ParentPass2026!",
          fatherPhone,
          admNo,
          stuBranch,
        ]);
      }

      // Student Attendance entries
      if (gradeNum === 10 && i <= 30) {
        studentAttendanceData.push([
          "2025-09-01",
          "2025-2026",
          className,
          sectionLetter,
          admNo,
          i % 10 === 0 ? "ABSENT" : i % 15 === 0 ? "LEAVE" : "PRESENT",
          i % 10 === 0 ? "Sick" : "",
          teachersData[0][3],
          stuBranch,
        ]);
        studentAttendanceData.push([
          "2025-09-02",
          "2025-2026",
          className,
          sectionLetter,
          admNo,
          "PRESENT",
          "",
          teachersData[0][3],
          stuBranch,
        ]);
      }

      // Fee Challans & Collection Payments (Professional & Enterprise)
      if (isProfessionalOrEnterprise && gradeNum === 10 && i <= 30) {
        const chNo = `CH-2025-09-${String(i).padStart(4, "0")}`;
        const totalFee = 9500;
        const isPaid = i % 4 !== 0;
        const paidFee = isPaid ? totalFee : 0;
        const remFee = totalFee - paidFee;

        challansData.push([
          chNo,
          admNo,
          className,
          "2025-2026",
          "2025-09",
          "2025-09-10",
          "0",
          "8500",
          "0",
          "0",
          "0",
          "0",
          "1000",
          "0",
          "0",
          "0",
          "0",
          totalFee,
          paidFee,
          remFee,
          isPaid ? "PAID" : "PENDING",
          stuBranch,
        ]);

        if (isPaid) {
          paymentsData.push([
            `REC-2025-09-${String(i).padStart(4, "0")}`,
            chNo,
            admNo,
            paidFee,
            "Bank Transfer",
            "2025-09-06",
            "tariq.accounts@beacon.edu.pk",
            `HBL-TX-${100000 + i}`,
            stuBranch,
          ]);
        }
      }

      // Examination Marks & Results (Professional & Enterprise)
      if (isProfessionalOrEnterprise && gradeNum === 10 && i <= 25) {
        const mathMarks = 55 + (i % 45);
        marksData.push([
          "First Term Mid-Term Examination 2025",
          "Grade 10",
          "MTH-10",
          admNo,
          "100",
          "33",
          mathMarks,
          mathMarks >= 80 ? "A+" : mathMarks >= 70 ? "A" : "B",
          "No",
          "Good performance",
          teachersData[0][3],
          "APPROVED",
          stuBranch,
        ]);

        const totalEarned = mathMarks + 75 + 82 + 68 + 79 + 44;
        const percentage = Number(((totalEarned / 600) * 100).toFixed(1));
        resultsData.push([
          "First Term Mid-Term Examination 2025",
          "Grade 10",
          admNo,
          "600",
          totalEarned,
          percentage,
          percentage >= 80 ? "A+" : percentage >= 70 ? "A" : "B",
          i,
          "PASSED",
          "96.5",
          "Keep up the good progress in science subjects.",
          "Yes",
          stuBranch,
        ]);
      }
    }

    this.addEntitySheet(book, UNIVERSAL_ENTITIES.students, false, studentsData);
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.parents, false, parentAccountsData);
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.studentAttendance, false, studentAttendanceData);

    // 15. Staff Attendance (Professional & Enterprise)
    if (isProfessionalOrEnterprise) {
      const staffAttData = [
        [teachersData[0][3], "2025-09-01", "MANUAL", "2025-09-01 07:50:00", "2025-09-01 14:05:00", "PRESENT", "0", "375", "", mainBranchRef],
        [teachersData[1][3], "2025-09-01", "MANUAL", "2025-09-01 07:55:00", "2025-09-01 14:00:00", "PRESENT", "0", "365", "", mainBranchRef],
        [staffData[1][3], "2025-09-01", "MANUAL", "2025-09-01 08:00:00", "2025-09-01 16:00:00", "PRESENT", "0", "480", "", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.staffAttendance, false, staffAttData);
    }

    // 16. Holidays (All Plans)
    const holidaysData = [
      ["2025-08-14", "Independence Day of Pakistan", "PAID_HOLIDAY", "National Gazetted Holiday", mainBranchRef],
      ["2025-09-06", "Defence Day", "SPECIAL_WORKING", "Special Assembly and Flag Ceremony", mainBranchRef],
      ["2025-11-09", "Iqbal Day", "PAID_HOLIDAY", "Public Holiday", mainBranchRef],
      ["2025-12-25", "Quaid-e-Azam Day / Winter Break", "PAID_HOLIDAY", "National Holiday", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.holidays, false, holidaysData);

    // 17. Leave Requests (Professional & Enterprise)
    if (isProfessionalOrEnterprise) {
      const leavesData = [
        [teachersData[0][3], "Casual", "2025-09-18", "2025-09-18", "1", "Urgent personal work at bank", "APPROVED", "admin.nasreen@beacon.edu.pk", "Approved", "2025-09-17", mainBranchRef],
        [teachersData[1][3], "Sick", "2025-09-22", "2025-09-23", "2", "Viral fever with medical prescription", "APPROVED", "admin.nasreen@beacon.edu.pk", "Approved", "2025-09-22", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.leaveRequests, false, leavesData);
    }

    // 18. Fee Structures & Challans (Professional & Enterprise)
    if (isProfessionalOrEnterprise) {
      const feeStructuresData: any[][] = [];
      for (let g = 1; g <= 10; g++) {
        feeStructuresData.push([
          `FEE-G${g}-2025`,
          `Grade ${g} Standard Fee Structure 2025-2026`,
          "2025-2026",
          `Grade ${g}`,
          "",
          g <= 5 ? "8000" : "10000",
          g <= 5 ? "6000" : "8500",
          "1500",
          "0",
          "500",
          g <= 5 ? "500" : "1000",
          "0",
          g <= 5 ? "8000" : "11000",
          "0",
          "500",
          "10",
          mainBranchRef,
        ]);
      }
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.feeStructures, false, feeStructuresData);
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.feeChallans, false, challansData);
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.feePayments, false, paymentsData);

      // Expenses
      const expensesData = [
        ["EXP-2025-09-01", "LESCO Electricity Bill - September 2025", "Electricity", "142500", "2025-09-05", "Bank Transfer", "LESCO-998821", "Campus monthly utility bill", "tariq.accounts@beacon.edu.pk", "No", mainBranchRef],
        ["EXP-2025-09-02", "Stationery & Examination Paper Procurement", "Stationery", "68000", "2025-09-12", "Cheque", "CHQ-44512", "A4 reams and booklets", "tariq.accounts@beacon.edu.pk", "No", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.expenses, false, expensesData);

      // Exam Schedules & Timetable
      const examSchedData = [
        ["EXAM-2025-MID", "First Term Mid-Term Examination 2025", "MID_TERM", "2025-2026", "Grade 9; Grade 10", "2025-10-15", "2025-10-25", "PUBLISHED", mainBranchRef],
        ["EXAM-2026-FIN", "Annual Final Term Examination 2026", "FINAL_TERM", "2025-2026", "Grade 1; Grade 2; Grade 3; Grade 4; Grade 5; Grade 6; Grade 7; Grade 8; Grade 9; Grade 10", "2026-03-10", "2026-03-25", "SCHEDULED", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.examSchedules, false, examSchedData);

      const examTimetableData = [
        ["First Term Mid-Term Examination 2025", "Grade 10", "Section A", "MTH-10", "2025-10-15", "09:00", "12:00", "Hall A", teachersData[0][3], mainBranchRef],
        ["First Term Mid-Term Examination 2025", "Grade 10", "Section A", "PHY-10", "2025-10-17", "09:00", "12:00", "Hall A", teachersData[1][3], mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.examTimetable, false, examTimetableData);
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.marksEntries, false, marksData);
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.examResults, false, resultsData);

      // Payroll Records & Salary Disbursals
      const payrollData = [
        ["PAY-2025-09-T1", teachersData[0][3], "2025-09", "SLIP-2025-09-001", "PAID", "80000", "5000", "1500", "83500", "Regular salary", "admin.nasreen@beacon.edu.pk", "2025-09-28", "83500", "2025-10-01", "Bank Transfer", "HBL-PAY-881", mainBranchRef],
        ["PAY-2025-09-T2", teachersData[1][3], "2025-09", "SLIP-2025-09-002", "PAID", "75000", "5000", "1500", "78500", "Regular salary", "admin.nasreen@beacon.edu.pk", "2025-09-28", "78500", "2025-10-01", "Bank Transfer", "HBL-PAY-882", mainBranchRef],
        ["PAY-2025-09-S1", staffData[1][3], "2025-09", "SLIP-2025-09-003", "PAID", "85000", "5000", "2000", "88000", "Regular salary", "admin.nasreen@beacon.edu.pk", "2025-09-28", "88000", "2025-10-01", "Bank Transfer", "HBL-PAY-883", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.payrollRecords, false, payrollData);

      const salaryPaymentsData = [
        ["SAL-DISB-2025-0901", "SLIP-2025-09-001", teachersData[0][3], "83500", "2025-10-01", "Bank Transfer", "FT-20251001-881", "Direct HBL transfer", "tariq.accounts@beacon.edu.pk", mainBranchRef],
        ["SAL-DISB-2025-0902", "SLIP-2025-09-002", teachersData[1][3], "78500", "2025-10-01", "Bank Transfer", "FT-20251001-882", "Direct HBL transfer", "tariq.accounts@beacon.edu.pk", mainBranchRef],
        ["SAL-DISB-2025-0903", "SLIP-2025-09-003", staffData[1][3], "88000", "2025-10-01", "Bank Transfer", "FT-20251001-883", "Direct HBL transfer", "tariq.accounts@beacon.edu.pk", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.salaryPayments, false, salaryPaymentsData);

      // Admissions
      const admissionsData = [
        ["APP-2025-0101", "Zubair Hashmi", "Hashmi Aslam", "0300-4411223", "hashmi.aslam@gmail.com", "Lahore Grammar School", "Grade 8", "Grade 9", "2025-2026", "Word of Mouth", "ADMITTED", "2025-07-10", "2025-07-15", "Admission approved upon entry test clearance", "COMPLETE", "ADM-2025-0001", mainBranchRef],
        ["APP-2025-0102", "Rehan Qureshi", "Imtiaz Qureshi", "0321-5522334", "imtiaz.q@hotmail.com", "Army Public School", "Grade 9", "Grade 10", "2025-2026", "Social Media", "APPROVED", "2025-07-12", "2025-07-18", "Offered seat; awaiting fee deposit", "COMPLETE", "", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.admissions, false, admissionsData);

      // Visitors
      const visitorsData = [
        ["Mian Shahid Rasheed", "0300-1122334", "35202-9988771-1", "Fee installment concession request", "Chief Accountant", "Accounts & Finance", "Zubair Shahid", "10-A-04", "2025-09-10 10:15:00", "2025-09-10 10:45:00", "CHECKED_OUT", "Installment plan granted", "Ayesha (Front Desk)", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.visitors, false, visitorsData);

      // Appointments
      const appointmentsData = [
        ["Chaudhry Manzoor", "0300-9988112", "manzoor@gmail.com", "Discuss sports facility upgrade sponsorship", "Vice Principal", "Administration & HR", "2025-09-25", "11:00 AM - 11:30 AM", "COMPLETED", "Agreed to sponsor cricket kit", "Front Desk", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.appointments, false, appointmentsData);

      // Front Desk Requests
      const requestsData = [
        ["REQ-2025-0081", "Tariq Ali Khan", "PARENT", "0300-1234567", "CERTIFICATE", "Muhammad Ali Khan", "10-A-01", "Grade 10", "ADMIN", "Requesting duplicate Bonafide Certificate for Nadra passport renewal", "RESOLVED", "Certificate issued and collected", "Ayesha (Front Desk)", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.frontDeskRequests, false, requestsData);

      // Student Certificates
      const studentCertsData = [
        ["CERT-2025-0012", "BONAFIDE", "ADM-2025-0001", "Grade 10", "2025-2026", "2025-09-15", "Passport Renewal", "Exemplary conduct and punctual attendance", "ISSUED", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.studentCertificates, false, studentCertsData);

      // Staff Certificates
      const staffCertsData = [
        ["SCERT-2025-001", teachersData[0][3], "EXPERIENCE", "Certificate of Senior Teaching Experience", "2025-08-01", "ISSUED", "", mainBranchRef],
      ];
      this.addEntitySheet(book, UNIVERSAL_ENTITIES.staffCertificates, false, staffCertsData);
    }

    // 19. Announcements (All Plans)
    const announcementsData = [
      ["Annual Sports Gala 2025 Dates Announced", "The Annual Inter-House Sports Gala will be held from November 20 to November 22. All houses are encouraged to finalize team rosters.", "General", "PARENT; TEACHER", "Grade 9; Grade 10", "", "HIGH", "PUBLISHED", "2025-10-01", "2025-11-25", mainBranchRef],
      ["First Term Mid-Term Examination Date Sheet", "Mid-term examinations will commence on October 15, 2025. Please review the detailed date sheet posted in the Examinations portal.", "Examination", "PARENT; TEACHER", "Grade 9; Grade 10", "", "URGENT", "PUBLISHED", "2025-09-25", "2025-10-30", mainBranchRef],
    ];
    this.addEntitySheet(book, UNIVERSAL_ENTITIES.announcements, false, announcementsData);
  }

  // --------------------------------------------------------------------------
  // Single Entity Sample Rows Helper
  // --------------------------------------------------------------------------

  private static getSampleRowsForSingleEntity(entityKey: string): any[][] {
    switch (entityKey) {
      case "students":
        return [
          ["STU-0001", "ADM-2025-0001", "ST-2025-0001", "35201-1234567-1", "Muhammad Ali Khan", "", "2010-04-12", "Male", "Pakistani", "Islam", "B+", "Lahore", "Beacon Public School", "Grade 9", "2025-2026", "Grade 10", "Section A", "10-A-01", "2025-08-15", "House 12, Street 4, Block C, Gulberg, Lahore", "", "", "0321-1234567", "Tariq Ali Khan", "0300-1234567", "35201-7654321-1", "Businessman", "Farzana Tariq", "0301-7654321", "", "", "guardian.stu-0001@example.com", "Father", "Tariq Ali Khan", "0300-1234567", "Father", "Normal Health", "None", "", "ACTIVE", ""],
          ["STU-0002", "ADM-2025-0002", "ST-2025-0002", "35201-2345678-2", "Fatima Zahra Malik", "", "2010-08-20", "Female", "Pakistani", "Islam", "O+", "Lahore", "Beacon Public School", "Grade 9", "2025-2026", "Grade 10", "Section A", "10-A-02", "2025-08-15", "House 45, Sector B, DHA Phase 3, Lahore", "", "", "0321-2345678", "Zahid Malik", "0300-2345678", "35201-8765432-1", "Engineer", "Samina Malik", "0301-8765432", "", "", "guardian.stu-0002@example.com", "Father", "Zahid Malik", "0300-2345678", "Father", "Normal Health", "None", "", "ACTIVE", ""],
        ];
      case "teachers":
        return [
          ["TCH-101", "EMP-2001", "Ahmed Khan", "teacher.ahmed.1@beacon.edu.pk", "TeacherPass2026!", "M.Sc. Mathematics, B.Ed.", "0300-1234567", "ACTIVE", ""],
          ["TCH-102", "EMP-2002", "Muhammad Malik", "teacher.muhammad.2@beacon.edu.pk", "TeacherPass2026!", "M.A. English Literature", "0300-2345678", "ACTIVE", ""],
        ];
      case "staff":
        return [
          ["STF-FIN1", "EMP-1002", "Tariq Mehmood", "tariq.accounts@beacon.edu.pk", "FinanceSecure2026!", "FINANCE", "Accounts & Finance", "Chief Accountant", "0321-9872222", "2021-03-01", "", "ACTIVE", "85000", "MONTHLY", ""],
          ["STF-REC1", "EMP-1004", "Ayesha Siddiqa", "ayesha.frontdesk@beacon.edu.pk", "ReceptionSecure2026!", "RECEPTIONIST", "Administration & HR", "Front Desk Officer", "0345-9874444", "2022-09-01", "", "ACTIVE", "55000", "MONTHLY", ""],
        ];
      case "classCategories":
        return [
          ["CAT-PRI", "Primary", "Grade 1 through Grade 5 foundational primary schooling", 1, "Active", ""],
          ["CAT-MID", "Middle School", "Grade 6 through Grade 8 intermediate schooling", 2, "Active", ""],
          ["CAT-SEC", "Secondary", "Grade 9 and Grade 10 matriculation and O-levels", 3, "Active", ""],
        ];
      case "classes":
        return [
          ["CLS-G9", "CAT-SEC", "Grade 9", "G9", "9", ""],
          ["CLS-G10", "CAT-SEC", "Grade 10", "G10", "10", ""],
        ];
      case "sections":
        return [
          ["SEC-G10A", "Grade 10", "Section A", "Room 201", "40", ""],
          ["SEC-G10B", "Grade 10", "Section B", "Room 202", "40", ""],
        ];
      case "subjects":
        return [
          ["SUB-MTH-G10", "Grade 10", "Mathematics", "MTH-10", "Core", "100", "33", ""],
          ["SUB-ENG-G10", "Grade 10", "English Language", "ENG-10", "Core", "100", "33", ""],
        ];
      case "feeStructures":
        return [
          ["FEE-G10-2025", "Grade 10 Standard Fee Structure 2025-2026", "2025-2026", "Grade 10", "", "10000", "8500", "1500", "0", "500", "1000", "0", "11000", "0", "500", "10", ""],
        ];
      case "feeChallans":
        return [
          ["CH-2025-09-0001", "ADM-2025-0001", "Grade 10", "2025-2026", "2025-09", "2025-09-10", "0", "8500", "0", "0", "0", "0", "1000", "0", "0", "0", "0", "9500", "9500", "0", "PAID", ""],
        ];
      case "expenses":
        return [
          ["EXP-2025-09-01", "LESCO Electricity Bill - September 2025", "Electricity", "142500", "2025-09-05", "Bank Transfer", "LESCO-998821", "Campus utility bill", "tariq.accounts@beacon.edu.pk", "No", ""],
        ];
      case "branches":
        return [
          ["BR-MAIN", "Beacon Grammar School - Main Campus", "main-campus", "Campus 1, Gulberg III, Lahore", "042-35711111", "main@beaconschool.edu.pk", "Yes", "ACTIVE", "Habib Bank Limited", "Beacon Grammar Main", "01234567890123", "PK36HABB0001234567890123"],
          ["BR-DEF", "Beacon Grammar School - Defence Campus", "defence-campus", "Sector Y, Phase 3, DHA, Lahore", "042-35892222", "defence@beaconschool.edu.pk", "No", "ACTIVE", "Meezan Bank", "Beacon Grammar Defence", "98765432109876", "PK12MEZN0009876543210987"],
        ];
      default: {
        const def = UNIVERSAL_ENTITIES[entityKey];
        return def ? [def.columns.map(c => c.example)] : [];
      }
    }
  }
}
