// Shared human-readable presentation for report previews and every export format.
const headings: Record<string, string> = {
  studentId: "Student ID",
  admissionNumber: "Admission Number",
  classId: "Class",
  className: "Class",
  sectionId: "Section",
  sectionName: "Section",
  subjectId: "Subject",
  subjectName: "Subject",
  teacherId: "Teacher Name",
  teacherUserId: "Teacher Name",
  teacherName: "Teacher Name",
  staffName: "Staff Name",
  employeeId: "Employee ID",
  employeeNumber: "Employee ID",
  academicSessionId: "Academic Session",
  academicSessionName: "Academic Session",
  examId: "Examination",
  examTitle: "Examination",
  rollNumber: "Roll Number",
  dob: "Date of Birth",
  bFormNumber: "B-Form / CRC",
  amountPKR: "Amount (PKR)",
  paidAmountPKR: "Paid Amount (PKR)",
  totalAmountPKR: "Total Fees (PKR)",
  remainingAmountPKR: "Outstanding Balance (PKR)",
  totalMaxMarks: "Total Marks",
  totalObtainedMarks: "Obtained Marks",
  maxMarks: "Total Marks",
  obtainedMarks: "Obtained Marks",
  overallGrade: "Overall Grade",
  isAbsent: "Absent",
  isCurrent: "Current Session",
  isArchived: "Archived",
  checkedInAt: "Check-in Time",
  checkedOutAt: "Check-out Time",
  lateMinutes: "Late Minutes",
  workingMinutes: "Working Minutes",
  userType: "Role",
  snapshotEmployeeName: "Staff Name",
  classTeacherName: "Class Teacher",
  applyingClassName: "Applying Class",
  collectedByUserName: "Collected By",
  roomNumber: "Room",
  room: "Room",
  date: "Date",
  publishedAt: "Published At",
  paidAt: "Paid At",
};
const perReport: Record<string, Record<string, string>> = {
  students: { name: "Student Name" },
  guardians: { name: "Student Name" },
  staff: { name: "Staff Name" },
  sessions: { name: "Academic Session" },
  classes: { name: "Class" },
  sections: { name: "Section" },
  subjects: { name: "Subject" },
  issuedDocuments: { studentId: "Student Name" },
  staffAttendance: { employeeId: "Staff Name" },
  payroll: { employeeId: "Employee ID" },
  employment: { staffName: "Staff Name" },
  attendance: {
    date: "Attendance Date",
    "records.status": "Attendance Status",
  },
  legacyTeacherAttendance: {
    date: "Attendance Date",
    "records.status": "Attendance Status",
  },
};
export function reportColumnLabel(report: string, path: string) {
  if (perReport[report]?.[path]) return perReport[report][path];
  if (path === "snapshot.employee.name") return "Staff Name";
  const key = path.split(".").at(-1)!;
  const title =
    headings[key] ||
    key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  return path.startsWith("parentInfo.")
    ? "Guardian: " + title
    : path.startsWith("emergencyContact.")
      ? "Emergency Contact: " + title
      : title;
}
export function reportFilterLabel(field: string) {
  return (
    (
      {
        employeeId: "Staff Member",
        studentId: "Student",
        classId: "Class",
        sectionId: "Section",
        subjectId: "Subject",
        academicSessionId: "Academic Session",
        examId: "Examination",
        role: "Role",
        department: "Department",
        paymentMethod: "Payment Method",
      } as Record<string, string>
    )[field] || reportColumnLabel("", field)
  );
}
export function reportPathValue(row: any, path: string) {
  return path.split(".").reduce((value, key) => value?.[key], row);
}
const humanCodes: Record<string, string> = {
  MID_TERM: "Mid-Term",
  FINAL_TERM: "Final-Term",
  SCHOOL_ADMIN: "School Administrator",
  EXAM_STAFF: "Examination Staff",
  SUPER_ADMIN: "Super Administrator",
  FINANCE: "Finance",
  RECEPTIONIST: "Receptionist",
  TEACHER: "Teacher",
  PARENT: "Parent",
  MANUAL: "Manual",
  BIOMETRIC: "Biometric",
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};
export function readableReportValue(value: any, path: string): string | number {
  if (value == null || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number")
    return Number.isFinite(value)
      ? /PKR$|percentage/i.test(path)
        ? Number(value.toFixed(2))
        : value
      : "Not recorded";
  if (
    value instanceof Date ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) &&
      /(?:date|At|dob|Date)$/i.test(path))
  ) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Not recorded";
    const justDate =
      (typeof value === "string" && value.length === 10) ||
      /(?:dob|Date|^date|startDate|endDate)$/i.test(path);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(!justDate
        ? { hour: "2-digit", minute: "2-digit", hour12: false }
        : {}),
    }).format(date);
  }
  if (Array.isArray(value))
    return value.map((v) => readableReportValue(v, path)).join("; ");
  if (typeof value === "object") return "Not recorded";
  const string = String(value);
  if (humanCodes[string]) return humanCodes[string];
  if (/^[A-Z]+(?:_[A-Z]+)*$/.test(string))
    return string
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (c) => c.toUpperCase());
  return string;
}
export function displayReportCell(row: any, path: string) {
  const value = readableReportValue(reportPathValue(row, path), path);
  return typeof value === "number" && /PKR$/.test(path)
    ? value.toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : value;
}
