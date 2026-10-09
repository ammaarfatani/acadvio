export interface PermissionDefinition {
  code: string;
  module: string;
  description: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  {code:"staff-attendance.self",module:"Attendance",description:"Own check-in, attendance and payroll"},
  {code:"staff-attendance.manage",module:"Attendance",description:"Manage employee attendance, policy and calendar"},
  {code:"biometric.manage",module:"Attendance",description:"Manage biometric devices and mappings"},
  {code:"payroll.view",module:"Payroll",description:"View branch employee payroll"},
  {code:"payroll.manage",module:"Payroll",description:"Manage salaries, calculate and approve payroll"},
  {code:"payroll.pay",module:"Payroll",description:"Explicitly record approved salary payment"},
  { code: "notices.view", module: "Notices", description: "Read notices for assigned audience" },
  { code: "notices.manage", module: "Notices", description: "Create and manage school notices" },
  { code: "organization.manage", module: "Organization", description: "Manage branches and branch administrators" },
  { code: "children.view", module: "Parents", description: "View explicitly linked children" },

  { code: "students.view", module: "Students", description: "View student directory records" },
  { code: "students.create", module: "Students", description: "Register new student records" },
  { code: "students.update", module: "Students", description: "Update student profiles" },
  { code: "students.delete", module: "Students", description: "Archive or delete student records" },


  { code: "teachers.view", module: "Teachers", description: "View teacher directory & specialization" },
  { code: "teachers.create", module: "Teachers", description: "Add new teaching staff records" },
  { code: "teachers.update", module: "Teachers", description: "Update teacher assignments & details" },


  { code: "attendance.view", module: "Attendance", description: "View daily attendance registers" },
  { code: "attendance.manage", module: "Attendance", description: "Mark and edit student & staff attendance" },


  { code: "fees.view", module: "Fees", description: "View fee structures, challans, & receipts" },
  { code: "fees.collect", module: "Fees", description: "Log fee payments & print receipts" },
  { code: "fees.update", module: "Fees", description: "Modify fee challans & structures" },
  { code: "fees.delete", module: "Fees", description: "Void fee receipts or challans" },


  { code: "exams.view", module: "Exams", description: "View exam schedules & paper list" },
  { code: "exams.manage", module: "Exams", description: "Create & edit term exam schedules" },


  { code: "results.view", module: "Results", description: "View result sheets & marksheets" },
  { code: "results.enter", module: "Results", description: "Enter paper marks for assigned classes" },
  { code: "results.publish", module: "Results", description: "Approve & publish term results" },


  { code: "settings.view", module: "Settings", description: "View school settings & branding" },
  { code: "settings.update", module: "Settings", description: "Update school logo, address, & bank info" },


  { code: "users.view", module: "Users", description: "View school staff user accounts" },
  { code: "users.manage", module: "Users", description: "Create, edit, & deactivate staff users" },


  { code: "admissions.view", module: "Reception", description: "View admission inquiries and registers" },
  { code: "admissions.manage", module: "Reception", description: "Create and process admission inquiries and enrollment" },
  { code: "visitors.manage", module: "Reception", description: "Log and manage front-desk visitors and appointments" },

  { code: "reports.view", module: "Reports", description: "Generate & export executive reports" },
];

export const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.code),
  SCHOOL_ADMIN: PERMISSIONS.map((p) => p.code),
  PARENT: ["children.view", "notices.view"],
  TEACHER: ["staff-attendance.self","notices.view","attendance.view", "attendance.manage", "results.view", "results.enter", "students.view", "exams.view"],
  FINANCE: ["staff-attendance.self","payroll.view","notices.view","fees.view", "fees.collect", "fees.update", "fees.delete", "reports.view", "students.view", "settings.view", "settings.update"],
  EXAM_STAFF: ["staff-attendance.self","notices.view","exams.view", "exams.manage", "results.view", "results.enter", "results.publish", "students.view", "settings.view", "settings.update"],
  RECEPTIONIST: ["staff-attendance.self","notices.view",
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
