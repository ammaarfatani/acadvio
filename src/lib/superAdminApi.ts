import { apiFetch } from "./api";

export const superAdminApi = {
  getAnalytics: (period = "month") => apiFetch("/super-admin/analytics?period="+encodeURIComponent(period)),
  getPendingSchools: () => apiFetch("/super-admin/pending-schools"),
  getAllSchools: () => apiFetch("/super-admin/all-schools"),
  getSchoolDetails: (id: string) => apiFetch(`/super-admin/schools/${id}`),
  approveSchool: (schoolId: string) =>
    apiFetch("/super-admin/approve-school", {
      method: "POST",
      body: JSON.stringify({ schoolId }),
    }),
  rejectSchool: (schoolId: string, reason?: string) =>
    apiFetch("/super-admin/reject-school", {
      method: "POST",
      body: JSON.stringify({ schoolId, reason }),
    }),
  extendTrial: (schoolId: string, days: number = 7) =>
    apiFetch("/super-admin/extend-trial", {
      method: "POST",
      body: JSON.stringify({ schoolId, days }),
    }),
  updateSubscriptionStatus: (schoolId: string, status: string, plan?: string) =>
    apiFetch("/super-admin/update-subscription", {
      method: "POST",
      body: JSON.stringify({ schoolId, status, plan }),
    }),
  resetAdminPassword: (userId: string, newPassword?: string) =>
    apiFetch("/super-admin/reset-admin-password", {
      method: "POST",
      body: JSON.stringify({ userId, newPassword }),
    }),
  getAllUsers: (schoolId?: string, role?: string, status?: string) => {
    const params = new URLSearchParams();
    if (schoolId) params.append("schoolId", schoolId);
    if (role) params.append("role", role);
    if (status) params.append("status", status);
    return apiFetch(`/super-admin/all-users?${params.toString()}`);
  },
  getAuditLogs: () => apiFetch("/super-admin/audit-logs"),
  getPlans: () => apiFetch("/super-admin/plans"),
};

