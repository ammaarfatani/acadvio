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
  getChallans: (status?: string) => apiFetch(`/finance/challans${status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : ""}`),
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
