export enum UserType {
  SUPER_ADMIN = "SUPER_ADMIN",
  SCHOOL_ADMIN = "SCHOOL_ADMIN",
  TEACHER = "TEACHER",
  FINANCE = "FINANCE",
  EXAM_STAFF = "EXAM_STAFF",
  PARENT = "PARENT",
  RECEPTIONIST = "RECEPTIONIST",
}

export enum UserStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DEACTIVATED = "DEACTIVATED",
}

export const SYSTEM_ROLES = [
  { name: "Parent / Guardian", code: "ROLE_PARENT", userType: UserType.PARENT, description: "Access to linked children and school notices", isSystemRole: true },
  {
    name: "Platform Super Admin",
    code: "ROLE_SUPER_ADMIN",
    userType: UserType.SUPER_ADMIN,
    description: "Full platform management & multi-school cross access",
    isSystemRole: true,
  },
  {
    name: "School Principal / Admin",
    code: "ROLE_SCHOOL_ADMIN",
    userType: UserType.SCHOOL_ADMIN,
    description: "Full administrative access within the school campus",
    isSystemRole: true,
  },
  {
    name: "Subject Teacher",
    code: "ROLE_TEACHER",
    userType: UserType.TEACHER,
    description: "Class attendance marking and exam marks entry",
    isSystemRole: true,
  },
  {
    name: "Finance & Accounts Officer",
    code: "ROLE_FINANCE",
    userType: UserType.FINANCE,
    description: "Fee challans, collection receipts, and expense logs",
    isSystemRole: true,
  },
  {
    name: "Examination Staff",
    code: "ROLE_EXAM_STAFF",
    userType: UserType.EXAM_STAFF,
    description: "Exam date sheets, seating plans, and result processing",
    isSystemRole: true,
  },
  {
    name: "Receptionist / Clerk",
    code: "ROLE_RECEPTIONIST",
    userType: UserType.RECEPTIONIST,
    description: "Student admission records lookup and visitor logs",
    isSystemRole: true,
  },
];
