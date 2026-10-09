import { apiFetch } from "@/lib/api";

export const examStaffApi = {
  getDashboard: () => apiFetch("/exams/dashboard"),
  getSchedules: () => apiFetch("/exams/schedules"),
  createExam: (data: any) =>
    apiFetch("/exams/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getClasses: () => apiFetch("/exams/classes"),
  getSections: (classId?: string) => apiFetch(`/exams/sections${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`),
  getSubjects: (classId?: string) => apiFetch(`/exams/subjects${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`),
  getSessions: () => apiFetch("/exams/sessions"),
  getStudents: (classId?: string, sectionId?: string) => {
    const params = new URLSearchParams();
    if (classId) params.append("classId", classId);
    if (sectionId) params.append("sectionId", sectionId);
    return apiFetch(`/exams/students?${params.toString()}`);
  },
  getGradingScale: () => apiFetch("/exams/grading-scale"),
  updateGradingScale: (rules: any[]) =>
    apiFetch("/exams/grading-scale", {
      method: "PUT",
      body: JSON.stringify({ rules }),
    }),
  getMarks: (examId?: string, classId?: string, subjectId?: string, sectionId?: string) => {
    const params = new URLSearchParams();
    if (examId) params.append("examId", examId);
    if (classId) params.append("classId", classId);
    if (subjectId) params.append("subjectId", subjectId);
    if (sectionId) params.append("sectionId", sectionId);
    return apiFetch(`/exams/marks?${params.toString()}`);
  },
  saveMarks: (data: any) =>
    apiFetch("/exams/marks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getResults: (examId?: string, classId?: string) => {
    const params = new URLSearchParams();
    if (examId) params.append("examId", examId);
    if (classId) params.append("classId", classId);
    return apiFetch(`/exams/results?${params.toString()}`);
  },
  processResults: (data: { examId: string; classId: string }) =>
    apiFetch("/exams/process", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  publishResults: (data: { examId: string; classId: string; publish: boolean }) =>
    apiFetch("/exams/publish", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTabulationSheet: (examId: string, classId: string) =>
    apiFetch(`/exams/reports/tabulation?examId=${encodeURIComponent(examId)}&classId=${encodeURIComponent(classId)}`),
  getAnalytics: (examId?: string, classId?: string) => {
    const params = new URLSearchParams();
    if (examId) params.append("examId", examId);
    if (classId) params.append("classId", classId);
    return apiFetch(`/exams/reports/analytics?${params.toString()}`);
  },
  getCertificates: () => apiFetch("/exams/certificates"),
  issueCertificate: (data: any) =>
    apiFetch("/exams/certificates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
