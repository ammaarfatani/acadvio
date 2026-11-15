import { apiFetch } from "./api";

import type { ImportEntity } from "./bulk-import";

export const schoolAdminApi = {
  // Universal Module & Master Bulk Import
  getBulkTemplate: (entity: ImportEntity) => apiFetch(`/school-admin/universal-import/${entity}/template`),
  previewBulkImport: (entity: ImportEntity, data: { filename: string; base64: string }) =>
    apiFetch(`/school-admin/universal-import/${entity}/preview`, { method: "POST", body: JSON.stringify(data) }),
  getBulkImport: (entity: ImportEntity, id: string, page = 1) =>
    apiFetch(`/school-admin/universal-import/${entity}/${id}?page=${page}`),
  commitBulkImport: (entity: ImportEntity, id: string, skipDuplicates: boolean) =>
    apiFetch(`/school-admin/universal-import/${entity}/${id}/commit`, { method: "POST", body: JSON.stringify({ skipDuplicates }) }),
  getBulkImportErrors: (entity: ImportEntity, id: string) =>
    apiFetch(`/school-admin/universal-import/${entity}/${id}/errors`),
  getModuleTemplate: (entity: string, type: "blank" | "example" = "blank") =>
    apiFetch(`/school-admin/universal-import/${entity}/template?type=${type}`),

  // Complete School Migration Master Endpoints
  getMigrationPlanInfo: () => apiFetch("/school-admin/universal-import/plan-info"),
  getMasterTemplate: (plan?: string, type: "blank" | "example" = "blank") => {
    const q = new URLSearchParams();
    if (plan) q.set("plan", plan);
    if (type) q.set("type", type);
    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiFetch(`/school-admin/universal-import/master/template${queryStr}`);
  },
  getMasterSample: (plan?: string) => {
    const queryStr = plan ? `?plan=${plan}&type=example` : "?type=example";
    return apiFetch(`/school-admin/universal-import/master/sample${queryStr}`);
  },
  previewMasterImport: (data: { filename: string; base64: string }) =>
    apiFetch("/school-admin/universal-import/master/preview", { method: "POST", body: JSON.stringify(data) }),
  getMasterImport: (id: string, page = 1) =>
    apiFetch(`/school-admin/universal-import/master/${id}?page=${page}`),
  commitMasterImport: (id: string, skipDuplicates: boolean) =>
    apiFetch(`/school-admin/universal-import/master/${id}/commit`, { method: "POST", body: JSON.stringify({ skipDuplicates }) }),
  getMasterImportErrors: (id: string) =>
    apiFetch(`/school-admin/universal-import/master/${id}/errors`),
  getMigrationHistory: () =>
    apiFetch("/school-admin/universal-import/master/history"),

  getDashboardMetrics: () => apiFetch("/school-admin/dashboard"),
  getAcademicSessions: () => apiFetch("/school-admin/academic-sessions"),
  createAcademicSession: (data: any) => apiFetch("/school-admin/academic-sessions", { method: "POST", body: JSON.stringify(data) }),
  setCurrentAcademicSession: (id: string) => apiFetch(`/school-admin/academic-sessions/${id}/current`, { method: "PATCH" }),
  getTimetable: (filters: { academicSessionId?: string; classId?: string; sectionId?: string; dayOfWeek?: string } = {}) => {
    const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return apiFetch(`/school-admin/timetable?${params.toString()}`);
  },
  createTimetableSlot: (data: any) => apiFetch("/school-admin/timetable", { method: "POST", body: JSON.stringify(data) }),
  getAttendanceReports: (filters: { from?: string; to?: string; classId?: string; sectionId?: string } = {}) => {
    const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    return apiFetch(`/school-admin/attendance/reports?${params.toString()}`);
  },
  getClassTeacherAssignments: () => apiFetch("/school-admin/class-teacher-assignments"),
  setClassTeacherAssignment: (data: { classId: string; sectionId: string; teacherUserId: string }) => apiFetch("/school-admin/class-teacher-assignments", { method: "PUT", body: JSON.stringify(data) }),
  getFinanceSummary: () => apiFetch("/school-admin/finance/summary"),
  
  // Students
  getStudents: (classId?: string, search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (classId) params.append("classId", classId);
    if (search) params.append("search", search);
    if (status) params.append("status", status);
    return apiFetch(`/school-admin/students?${params.toString()}`);
  },
  getNextStudentRollNumber: (classId: string, sectionId?: string, academicSessionId?: string) => {
    const params = new URLSearchParams({ classId }); if (sectionId) params.set("sectionId", sectionId); if (academicSessionId) params.set("academicSessionId", academicSessionId);
    return apiFetch(`/school-admin/students/next-roll-number?${params.toString()}`);
  },
  createStudent: (studentData: any) =>
    apiFetch("/school-admin/students", {
      method: "POST",
      body: JSON.stringify(studentData),
    }),
  updateStudent: (studentId: string, studentData: any) =>
    apiFetch(`/school-admin/students/${studentId}`, {
      method: "PUT",
      body: JSON.stringify(studentData),
    }),
  getStudentHistory: (studentId: string) => apiFetch(`/school-admin/students/${studentId}/history`),
  getStudentFeeHistory: (studentId: string) => apiFetch(`/school-admin/students/${studentId}/fee-history`),
  changeStudentFeeStructure: (studentId: string, data: any) =>
    apiFetch(`/school-admin/students/${studentId}/fee-structure`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Class Categories
  getClassCategories: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.status) query.append("status", params.status);
    const qs = query.toString();
    return apiFetch(`/school-admin/classes/categories${qs ? `?${qs}` : ""}`);
  },
  createClassCategory: (categoryData: any) =>
    apiFetch("/school-admin/classes/categories", {
      method: "POST",
      body: JSON.stringify(categoryData),
    }),
  updateClassCategory: (categoryId: string, categoryData: any) =>
    apiFetch(`/school-admin/classes/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(categoryData),
    }),
  deleteClassCategory: (categoryId: string) =>
    apiFetch(`/school-admin/classes/categories/${categoryId}`, {
      method: "DELETE",
    }),
  bulkAssignCategoryToClasses: (data: { classIds: string[]; classCategoryId: string }) =>
    apiFetch("/school-admin/classes/bulk-assign-category", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Classes & Sections
  getClasses: () => apiFetch("/school-admin/classes"),
  createClass: (classData: any) =>
    apiFetch("/school-admin/classes", {
      method: "POST",
      body: JSON.stringify(classData),
    }),
  updateClass: (classId: string, classData: any) =>
    apiFetch(`/school-admin/classes/${classId}`, {
      method: "PUT",
      body: JSON.stringify(classData),
    }),
  deleteClass: (classId: string) =>
    apiFetch(`/school-admin/classes/${classId}`, {
      method: "DELETE",
    }),
  getSections: (classId?: string) => {
    const params = new URLSearchParams();
    if (classId) params.append("classId", classId);
    return apiFetch(`/school-admin/sections?${params.toString()}`);
  },
  createSection: (sectionData: any) =>
    apiFetch("/school-admin/sections", {
      method: "POST",
      body: JSON.stringify(sectionData),
    }),

  // Subjects
  getSubjects: (classId?: string) => {
    const params = new URLSearchParams();
    if (classId) params.append("classId", classId);
    return apiFetch(`/school-admin/subjects?${params.toString()}`);
  },
  createSubject: (subjectData: any) =>
    apiFetch("/school-admin/subjects", {
      method: "POST",
      body: JSON.stringify(subjectData),
    }),

  // Finance
  getFeeStructures: () => apiFetch("/school-admin/fees/structures"),
  createFeeStructure: (feeData: any) =>
    apiFetch("/school-admin/fees/structures", {
      method: "POST",
      body: JSON.stringify(feeData),
    }),
  generateChallansBatch: (batchData: any) =>
    apiFetch("/school-admin/fees/generate-batch", {
      method: "POST",
      body: JSON.stringify(batchData),
    }),
  getFeeChallans: (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    return apiFetch(`/school-admin/fees/challans?${params.toString()}`);
  },
  collectPayment: (paymentData: any) =>
    apiFetch("/school-admin/fees/collect-payment", {
      method: "POST",
      body: JSON.stringify(paymentData),
    }),
  getExpenses: () => apiFetch("/school-admin/expenses"),
  createExpense: (expenseData: any) =>
    apiFetch("/school-admin/expenses", {
      method: "POST",
      body: JSON.stringify(expenseData),
    }),

  // Exams & Marks
  getExamSchedules: () => apiFetch("/school-admin/exams"),
  createExamSchedule: (examData: any) =>
    apiFetch("/school-admin/exams", {
      method: "POST",
      body: JSON.stringify(examData),
    }),
  getMarks: (examId?: string, classId?: string, subjectId?: string, sectionId?: string) => {
    const params = new URLSearchParams();
    if (examId) params.append("examId", examId);
    if (classId) params.append("classId", classId);
    if (subjectId) params.append("subjectId", subjectId);
    if (sectionId) params.append("sectionId", sectionId);
    return apiFetch(`/school-admin/exams/marks?${params.toString()}`);
  },
  saveMarks: (marksData: any) =>
    apiFetch("/school-admin/exams/marks", {
      method: "POST",
      body: JSON.stringify(marksData),
    }),
  getResults: (examId?: string, classId?: string) => {
    const params = new URLSearchParams();
    if (examId) params.append("examId", examId);
    if (classId) params.append("classId", classId);
    return apiFetch(`/school-admin/exams/results?${params.toString()}`);
  },

  // Announcements & Notifications
  getAnnouncements: () => apiFetch("/school-admin/announcements"),
  createAnnouncement: (announcementData: any) =>
    apiFetch("/school-admin/announcements", {
      method: "POST",
      body: JSON.stringify(announcementData),
    }),
  getNotifications: () => apiFetch("/school-admin/notifications"),
  sendBroadcast: (broadcastData: any) =>
    apiFetch("/school-admin/notifications/broadcast", {
      method: "POST",
      body: JSON.stringify(broadcastData),
    }),

  // Reports
  getReportsSummary: () => apiFetch("/school-admin/reports/summary"),

  // School Settings & Branding
  getSchoolProfile: () => apiFetch("/schools/profile"),
  updateSchoolBranding: (brandingData: any) =>
    apiFetch("/schools/branding", {
      method: "PUT",
      body: JSON.stringify(brandingData),
    }),
  updateNumberingSettings: (numbering: any) =>
    apiFetch("/school-admin/numbering-settings", { method: "PUT", body: JSON.stringify(numbering) }),

  // Users & Staff
  getSchoolUsers: () => apiFetch("/users"),
  createStaffUser: (userData: any) =>
    apiFetch("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    }),
  getTeachers: () => apiFetch("/school-admin/teachers"),
  createTeacher: (teacherData: any) => apiFetch("/school-admin/teachers", { method: "POST", body: JSON.stringify(teacherData) }),
  updateTeacher: (teacherId: string, teacherData: any) => apiFetch(`/school-admin/teachers/${teacherId}`, { method: "PUT", body: JSON.stringify(teacherData) }),
  updateUserStatus: (userId: string, status: string) =>
    apiFetch(`/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
