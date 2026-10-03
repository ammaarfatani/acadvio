"use client";

import { useEffect, useState } from "react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function FeeCollectionPage() {
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    schoolAdminApi.getFeeChallans()
      .then((res: any) => {
        setChallans(res?.data || []);
      })
      .catch((e: any) => setError(e?.message || "Unable to load fee challans."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = statusFilter === "ALL" ? challans : challans.filter((item) => item.status === statusFilter);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950">Fee Realization & Collection Status</h1>
          <p className="mt-1 text-xs text-zinc-500">View real-time fee collection status and payment realizations across all classes.</p>
        </div>

        <div className="flex items-center gap-2">
          {["ALL", "PAID", "PARTIAL", "PENDING", "OVERDUE"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                statusFilter === st ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}

      {loading ? (
        <p role="status" className="rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200">Loading fee collection status...</p>
      ) : filtered.length ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-zinc-950 text-white text-[10px] uppercase font-bold">
              <tr>
                <th className="p-3.5">Challan No</th>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Class / Roll</th>
                <th className="p-3.5 text-center">Month</th>
                <th className="p-3.5 text-center">Total Amount</th>
                <th className="p-3.5 text-center">Paid Amount</th>
                <th className="p-3.5 text-center">Remaining</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filtered.map((item) => (
                <tr key={item._id} className="hover:bg-zinc-50">
                  <td className="p-3.5 font-mono font-bold text-zinc-900">{item.challanNumber}</td>
                  <td className="p-3.5 font-bold text-zinc-950">{item.studentName}</td>
                  <td className="p-3.5 text-zinc-600">{item.className} / {item.rollNumber}</td>
                  <td className="p-3.5 text-center font-mono text-zinc-700">{item.month}</td>
                  <td className="p-3.5 text-center font-mono font-bold text-zinc-900">PKR {Number(item.totalAmountPKR || 0).toLocaleString()}</td>
                  <td className="p-3.5 text-center font-mono font-bold text-emerald-700">PKR {Number(item.paidAmountPKR || 0).toLocaleString()}</td>
                  <td className="p-3.5 text-center font-mono font-bold text-red-600">PKR {Number(item.remainingAmountPKR || 0).toLocaleString()}</td>
                  <td className="p-3.5 text-center">
                    {item.status === "PAID" ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">PAID</span>
                    ) : item.status === "PARTIAL" ? (
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">PARTIAL</span>
                    ) : item.status === "VOIDED" ? (
                      <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded">VOIDED</span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">PENDING</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h3 className="font-bold text-zinc-950 text-xs">No Fee Challans Found</h3>
          <p className="mt-1 text-xs text-zinc-500">Challans generated by Finance department will be tracked here.</p>
        </div>
      )}
    </div>
  );
}

