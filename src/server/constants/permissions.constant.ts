export interface PermissionDefinition {
  code: string;
  module: string;
  description: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  // Students
  { code: "students.view", module: "Students", description: "View student directory records" },
  { code: "students.create", module: "Students", description: "Register new student records" },
  { code: "students.update", module: "Students", description: "Update student profiles" },
  { code: "students.delete", module: "Students", description: "Archive or delete student records" },

  // Teachers
  { code: "teachers.view", module: "Teachers", description: "View teacher directory & specialization" },
  { code: "teachers.create", module: "Teachers", description: "Add new teaching staff records" },
  { code: "teachers.update", module: "Teachers", description: "Update teacher assignments & details" },

  // Attendance
  { code: "attendance.view", module: "Attendance", description: "View daily attendance registers" },
  { code: "attendance.manage", module: "Attendance", description: "Mark and edit student & staff attendance" },

  // Fees & Finance
  { code: "fees.view", module: "Fees", description: "View fee structures, challans, & receipts" },
  { code: "fees.collect", module: "Fees", description: "Log fee payments & print receipts" },
  { code: "fees.update", module: "Fees", description: "Modify fee challans & structures" },
  { code: "fees.delete", module: "Fees", description: "Void fee receipts or challans" },

  // Exams
  { code: "exams.view", module: "Exams", description: "View exam schedules & paper list" },
  { code: "exams.manage", module: "Exams", description: "Create & edit term exam schedules" },

  // Results & Grading
  { code: "results.view", module: "Results", description: "View result sheets & marksheets" },
  { code: "results.enter", module: "Results", description: "Enter paper marks for assigned classes" },
  { code: "results.publish", module: "Results", description: "Approve & publish term results" },

  // School Settings & Branding
  { code: "settings.view", module: "Settings", description: "View school settings & branding" },
  { code: "settings.update", module: "Settings", description: "Update school logo, address, & bank info" },

  // Users & Staff
  { code: "users.view", module: "Users", description: "View school staff user accounts" },
  { code: "users.manage", module: "Users", description: "Create, edit, & deactivate staff users" },

  // Reception & Admissions
  { code: "admissions.view", module: "Reception", description: "View admission inquiries and registers" },
  { code: "admissions.manage", module: "Reception", description: "Create and process admission inquiries and enrollment" },
  { code: "visitors.manage", module: "Reception", description: "Log and manage front-desk visitors and appointments" },

  // Reports
  { code: "reports.view", module: "Reports", description: "Generate & export executive reports" },
];

export const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.code),
  SCHOOL_ADMIN: PERMISSIONS.map((p) => p.code),
  TEACHER: ["attendance.view", "attendance.manage", "results.view", "results.enter", "students.view", "exams.view"],
  FINANCE: ["fees.view", "fees.collect", "fees.update", "fees.delete", "reports.view", "students.view", "settings.view", "settings.update"],
  EXAM_STAFF: ["exams.view", "exams.manage", "results.view", "results.enter", "results.publish", "students.view", "settings.view", "settings.update"],
  RECEPTIONIST: [
    "students.view",
    "students.create",
    "attendance.view",
    "teachers.view",
    "admissions.view",
    "admissions.manage",
    "visitors.manage",
    "settings.view",
    "settings.update",
  ],
};
