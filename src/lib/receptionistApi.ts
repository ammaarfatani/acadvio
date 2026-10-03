import { apiFetch } from "@/lib/api";

export const receptionistApi = {
  // 1. Dashboard
  getDashboard: () => apiFetch("/receptionist/dashboard"),

  // 2. Admissions
  getClasses: () => apiFetch("/receptionist/classes"),
  getSections: (classId: string) => apiFetch(`/receptionist/classes/${encodeURIComponent(classId)}/sections`),
  getAcademicSessions: () => apiFetch("/receptionist/academic-sessions"),
  getAdmissions: (
    filters: {
      search?: string;
      status?: string;
      classId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiFetch(`/receptionist/admissions?${params.toString()}`);
  },
  createAdmission: (data: any) =>
    apiFetch("/receptionist/admissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAdmission: (id: string, data: any) =>
    apiFetch(`/receptionist/admissions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  admitStudent: (id: string, data: any) =>
    apiFetch(`/receptionist/admissions/${encodeURIComponent(id)}/admit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // 3. Students & Parents Directory
  getStudents: (
    filters: {
      search?: string;
      classId?: string;
      sectionId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiFetch(`/receptionist/students?${params.toString()}`);
  },
  getStudentById: (id: string) => apiFetch(`/receptionist/students/${encodeURIComponent(id)}`),
  getParents: (
    filters: {
      search?: string;
      classId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiFetch(`/receptionist/parents?${params.toString()}`);
  },

  // 4. Visitors Desk
  getVisitors: (
    filters: {
      search?: string;
      status?: string;
      date?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiFetch(`/receptionist/visitors?${params.toString()}`);
  },
  createVisitor: (data: any) =>
    apiFetch("/receptionist/visitors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkoutVisitor: (id: string) =>
    apiFetch(`/receptionist/visitors/${encodeURIComponent(id)}/checkout`, {
      method: "PATCH",
    }),

  // 5. Appointments Desk
  getAppointments: (
    filters: {
      search?: string;
      status?: string;
      department?: string;
      date?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiFetch(`/receptionist/appointments?${params.toString()}`);
  },
  createAppointment: (data: any) =>
    apiFetch("/receptionist/appointments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAppointment: (id: string, data: any) =>
    apiFetch(`/receptionist/appointments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // 6. Front Desk Requests
  getRequests: (
    filters: {
      search?: string;
      status?: string;
      requestType?: string;
      department?: string;
      page?: number;
      limit?: number;
    } = {}
  ) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    return apiFetch(`/receptionist/requests?${params.toString()}`);
  },
  createRequest: (data: any) =>
    apiFetch("/receptionist/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRequest: (id: string, data: any) =>
    apiFetch(`/receptionist/requests/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // 7. Notifications
  getNotifications: () => apiFetch("/receptionist/notifications"),

  // 8. Theme & Settings
  getSchoolProfile: () => apiFetch("/schools/profile"),
  updateSchoolBranding: (brandingData: any) =>
    apiFetch("/schools/branding", {
      method: "PUT",
      body: JSON.stringify(brandingData),
    }),
};
