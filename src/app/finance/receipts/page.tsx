"use client";
import { printSchoolDocument } from "@/lib/print-school-document";

import { FeeDocument } from "@/components/SchoolDocuments";
import { useEffect, useState } from "react";
import { Printer, Search, CheckCircle2 } from "lucide-react";
import { financeApi } from "@/lib/financeApi";
import { useAuth } from "@/lib/auth-context";

export default function PrintableReceiptPage() {
  const { user } = useAuth();
  const [payment, setPayment] = useState<any>(null);
  const [paidChallans, setPaidChallans] = useState<any[]>([]);
  const [selectedChallanId, setSelectedChallanId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReceipt = async (cId: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await financeApi.getReceipt(cId);
      setPayment(response.data);
    } catch (e: any) {
      setError(e.message || "Unable to load receipt for selected payment.");
      setPayment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const challanId = new URLSearchParams(window.location.search).get(
      "challanId",
    );
    if (challanId) {
      setSelectedChallanId(challanId);
      void loadReceipt(challanId);
    } else {
      // Load list of paid or partial challans
      financeApi
        .getChallans()
        .then((res) => {
          const paidList = (res?.data || []).filter(
            (c: any) => c.paidAmountPKR > 0,
          );
          setPaidChallans(paidList);
          if (paidList.length > 0) {
            setSelectedChallanId(paidList[0]._id);
            void loadReceipt(paidList[0]._id);
          } else {
            setLoading(false);
          }
        })
        .catch((e) => {
          setError(e.message);
          setLoading(false);
        });
    }
  }, []);

  const handleSelectChallan = (cId: string) => {
    setSelectedChallanId(cId);
    void loadReceipt(cId);
  };

  const challan = payment?.challanId;
  const student = payment?.studentId;
  const feeRows = Object.entries(challan?.feeBreakdown || {})
    .filter(([key, amount]) => key !== "discount" && Number(amount) > 0)
    .map(([key, amount]) => ({ key, amount: Number(amount) }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 pb-12 text-xs">
      <div className="print:hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950">
            Official Fee Payment Receipts
          </h1>
          <p className="text-xs text-zinc-500">
            Verified payment confirmation receipts from recorded transactions
          </p>
        </div>

        <button
          onClick={() =>
            void printSchoolDocument().catch((e) => setError(e.message))
          }
          disabled={!payment}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50"
        >
          <Printer size={16} />
          Print Receipt
        </button>
      </div>

      {paidChallans.length > 0 && (
        <div className="print:hidden bg-white border border-zinc-200 p-4 rounded-xl flex items-center justify-between gap-4">
          <span className="font-bold text-zinc-950">
            Select Paid Transaction ({paidChallans.length} Receipts Available):
          </span>
          <select
            value={selectedChallanId}
            onChange={(e) => handleSelectChallan(e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-1.5 font-mono font-bold bg-zinc-50"
          >
            {paidChallans.map((c) => (
              <option key={c._id} value={c._id}>
                {c.challanNumber} — {c.studentName} (Paid PKR{" "}
                {(c.paidAmountPKR || 0).toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && (
        <p
          role="status"
          className="rounded-xl bg-white p-6 text-center text-zinc-500 border border-zinc-200"
        >
          Loading receipt details...
        </p>
      )}

      {!loading && !payment && !error && (
        <div className="p-12 text-center bg-white border border-dashed border-zinc-300 rounded-2xl">
          <p className="font-bold text-zinc-800 text-sm">
            No Payments Collected Yet
          </p>
          <p className="text-zinc-500 mt-1">
            Receipts will appear here once payments are collected in Fee
            Collection desk.
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 font-semibold"
        >
          {error}
        </p>
      )}

      {payment && <FeeDocument challan={payment.challanId} payment={payment} />}
    </main>
  );
}
