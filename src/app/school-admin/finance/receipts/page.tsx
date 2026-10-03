"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function PaymentReceiptsPage() {
  const [receipts, setReceipts] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { schoolAdminApi.getFinanceSummary().then((res: any) => setReceipts(res?.data?.receipts || [])).catch((e: any) => setError(e?.message || "Unable to load payment receipts.")).finally(() => setLoading(false)); }, []);
  return <div className="mx-auto max-w-6xl space-y-6 pb-12"><header><h1 className="text-2xl font-black">Payment Receipts</h1><p className="mt-1 text-sm text-zinc-500">Receipts are generated from recorded payments.</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="rounded-xl bg-white p-6 text-sm text-zinc-500">Loading receipts…</p> : receipts.length ? <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="p-3">Receipt</th><th className="p-3">Challan</th><th className="p-3">Student</th><th className="p-3">Paid date</th><th className="p-3">Method</th><th className="p-3">Amount</th><th className="p-3">Action</th></tr></thead><tbody>{receipts.map((item) => <tr key={item._id} className="border-t"><td className="p-3 font-mono">{item.receiptNumber}</td><td className="p-3 font-mono">{item.challanId?.challanNumber || String(item.challanId).slice(-8)}</td><td className="p-3">{item.studentName}<div className="text-xs text-zinc-500">{item.className} · {item.rollNumber}</div></td><td className="p-3">{new Date(item.paidAt).toLocaleDateString()}</td><td className="p-3">{item.paymentMethod}</td><td className="p-3 font-semibold">PKR {Number(item.amountPKR || 0).toLocaleString()}</td><td className="p-3"><button onClick={() => window.print()} aria-label={`Print receipt ${item.receiptNumber}`} className="rounded-lg border p-2"><Printer size={16} /></button></td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center"><h2 className="font-bold">No payment receipts yet</h2><p className="mt-1 text-sm text-zinc-500">A receipt will appear here after a payment is recorded.</p></div>}
  </div>;
}
