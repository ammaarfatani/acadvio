import { apiFetch } from "./api";

export const financeApi = {
  getClasses: () => apiFetch("/finance/classes"),
  getDashboardMetrics: () => apiFetch("/finance/dashboard"),
  getFeeStructures: () => apiFetch("/finance/structures"),
  createFeeStructure: (data: any) =>
    apiFetch("/finance/structures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getStudentLedger: (studentId: string) => apiFetch(`/finance/ledger/${studentId}`),
  getChallans: (filter?: string | { status?: string; branchId?: string; classId?: string; classCategoryId?: string; sectionId?: string; month?: string; search?: string; limit?: number; skip?: number }) => {
    if (typeof filter === "string") {
      return apiFetch(`/finance/challans${filter && filter !== "ALL" ? `?status=${encodeURIComponent(filter)}` : ""}`);
    }
    const params = new URLSearchParams();
    if (filter?.status && filter.status !== "ALL") params.append("status", filter.status);
    if (filter?.branchId) params.append("branchId", filter.branchId);
    if (filter?.classId) params.append("classId", filter.classId);
    if (filter?.classCategoryId) params.append("classCategoryId", filter.classCategoryId);
    if (filter?.sectionId) params.append("sectionId", filter.sectionId);
    if (filter?.month && filter.month !== "ALL") params.append("month", filter.month);
    if (filter?.search) params.append("search", filter.search);
    if (filter?.limit) params.append("limit", String(filter.limit));
    if (filter?.skip) params.append("skip", String(filter.skip));
    const qs = params.toString();
    return apiFetch(`/finance/challans${qs ? `?${qs}` : ""}`);
  },
  getChallanPdfUrl: (challanId: string) => `/api/v1/finance/challans/${encodeURIComponent(challanId)}/pdf`,
  downloadBulkChallansPdf: (filter: { challanIds?: string[]; classId?: string; sectionId?: string; month?: string; academicSession?: string }) =>
    apiFetch("/finance/challans/bulk-pdf", {
      method: "POST",
      body: JSON.stringify({ ...filter, response: "base64" }),
    }),
  getReceiptById: (id: string) => apiFetch(`/finance/payments/${encodeURIComponent(id)}/receipt`),
  getReceipt: (challanId: string) => apiFetch(`/finance/receipts/${encodeURIComponent(challanId)}`),
  collectPayment: (paymentData: any) =>
    apiFetch("/finance/collect-payment", {
      method: "POST",
      body: JSON.stringify(paymentData),
    }),
  voidChallan: (challanId: string, reason: string) =>
    apiFetch(`/finance/challans/${challanId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  generateBulkChallans: (batchData: any) =>
    apiFetch("/finance/generate-batch", {
      method: "POST",
      body: JSON.stringify(batchData),
    }),
  getExpenses: (category?: string) => {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    return apiFetch(`/finance/expenses?${params.toString()}`);
  },
  createExpense: (expenseData: any) =>
    apiFetch("/finance/expenses", {
      method: "POST",
      body: JSON.stringify(expenseData),
    }),
  voidExpense: (expenseId: string, reason: string) =>
    apiFetch(`/finance/expenses/${expenseId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getSchoolProfile: () => apiFetch("/schools/profile"),
  updateSchoolBranding: (brandingData: any) =>
    apiFetch("/schools/branding", {
      method: "PUT",
      body: JSON.stringify(brandingData),
    }),
};
