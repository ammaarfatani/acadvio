"use client";



import { useCallback, useEffect, useState } from "react";
import { Printer, Search } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function FeeChallansPage() {
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const c = await schoolAdminApi.getFeeChallans();
      setChallans(c?.data || []);
    } catch (e: any) {
      setError(e?.message || "Unable to load fee challans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = challans.filter(
    (item) =>
      item.studentName.toLowerCase().includes(search.toLowerCase()) ||
      item.challanNumber.toLowerCase().includes(search.toLowerCase()) ||
      item.className.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950">Issued Bank Challans Ledger</h1>
          <p className="mt-1 text-xs text-zinc-500">Monitor and print all student fee challans generated across academic classes.</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search student or challan no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border border-zinc-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none"
          />
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}

      {loading ? (
        <p role="status" className="rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200">Loading fee challans...</p>
      ) : filtered.length ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3.5">Challan Number</th>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Class / Roll</th>
                <th className="p-3.5">Month / Due Date</th>
                <th className="p-3.5 text-center">Total Amount</th>
                <th className="p-3.5 text-center">Remaining</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Print Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filtered.map((item) => (
                <tr key={item._id} className="hover:bg-zinc-50">
                  <td className="p-3.5 font-mono font-bold text-zinc-900">{item.challanNumber}</td>
                  <td className="p-3.5 font-bold text-zinc-950">{item.studentName}</td>
                  <td className="p-3.5 text-zinc-600">{item.className} / Roll {item.rollNumber}</td>
                  <td className="p-3.5 text-zinc-800">
                    <span className="font-semibold block">{item.month}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Due {new Date(item.dueDate).toLocaleDateString()}</span>
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold text-zinc-900">PKR {Number(item.totalAmountPKR || 0).toLocaleString()}</td>
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
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => window.print()}
                      aria-label={`Print challan ${item.challanNumber}`}
                      className="rounded-lg border border-zinc-300 p-1.5 text-zinc-700 hover:bg-zinc-100"
                    >
                      <Printer size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h3 className="font-bold text-zinc-950 text-xs">No Fee Challans Available</h3>
          <p className="mt-1 text-xs text-zinc-500">Challans generated by Finance department will be listed here.</p>
        </div>
      )}
    </div>
  );
}

