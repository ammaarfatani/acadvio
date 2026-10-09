import { apiFetch } from "./api";

export const teacherApi = {
  getDashboardMetrics: () => apiFetch("/teacher/dashboard"),
  getTeacherClasses: () => apiFetch("/teacher/my-classes"),
  getTimetable: () => apiFetch("/teacher/timetable"),
  getAttendanceRoster: (classId: string, sectionId: string, date: string) => { const params = new URLSearchParams({ classId, sectionId, date }); return apiFetch(`/teacher/attendance?${params.toString()}`); },
  getMyAttendance: (from?: string, to?: string) => { const params = new URLSearchParams(); if (from) params.set("from", from); if (to) params.set("to", to); return apiFetch(`/teacher/attendance/self?${params.toString()}`); },
  checkIn: () => apiFetch("/teacher/attendance/self/check-in", { method: "POST" }),
  checkOut: () => apiFetch("/teacher/attendance/self/check-out", { method: "POST" }),
  getClassTeacherSections: () => apiFetch("/teacher/class-teacher-sections"),
  getAttendanceReport: (filters: { from?: string; to?: string; classId?: string; sectionId?: string } = {}) => { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => value && params.set(key, value)); return apiFetch(`/teacher/attendance/reports?${params.toString()}`); },
  getMarksContexts: () => apiFetch("/teacher/marks/options"),
  getNotifications: () => apiFetch("/teacher/notifications"),
  markNotificationRead: (id: string) => apiFetch(`/teacher/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => apiFetch("/teacher/notifications/read-all", { method: "PATCH" }),
  getAssignedStudents: (classId?: string, search?: string, sectionId?: string, subjectId?: string) => {
    const params = new URLSearchParams();
    if (classId) params.append("classId", classId);
    if (search) params.append("search", search);
    if (sectionId) params.append("sectionId", sectionId);
    if (subjectId) params.append("subjectId", subjectId);
    return apiFetch(`/teacher/students?${params.toString()}`);
  },
  getStudentHistory: (studentId: string) => apiFetch(`/teacher/students/${studentId}/history`),
  saveAttendance: (attendanceData: any) =>
    apiFetch("/teacher/attendance", {
      method: "POST",
      body: JSON.stringify(attendanceData),
    }),
  saveMarks: (marksData: any) =>
    apiFetch("/teacher/marks", {
      method: "POST",
      body: JSON.stringify(marksData),
    }),
  applyLeave: (leaveData: any) =>
    apiFetch("/teacher/leave", {
      method: "POST",
      body: JSON.stringify(leaveData),
    }),
  getLeaves: () => apiFetch("/teacher/leave"),
  getSchoolLeaveRequests: (status?: string) => apiFetch(`/teacher/leave-requests${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  reviewLeaveRequest: (leaveId: string, status: "APPROVED" | "REJECTED", comment?: string) => apiFetch(`/teacher/leave-requests/${leaveId}`, { method: "PATCH", body: JSON.stringify({ status, comment }) }),
};
