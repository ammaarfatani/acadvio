"use client";
import WorkspaceAnalytics from "@/components/WorkspaceAnalytics";

import { useEffect, useState } from "react";
import { DollarSign, CreditCard, FileSpreadsheet, ArrowRight, ShieldCheck, PieChart, BarChart } from "lucide-react";
import Link from "next/link";
import { financeApi } from "@/lib/financeApi";

export default function FinanceDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    financeApi.getDashboardMetrics()
      .then((res) => {
        if (res?.data) setData(res.data);
      })
      .catch((err: any) => {
        setError(err?.message || "Unable to load live dashboard metrics.");
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics || {
    todayCollectionPKR: 0,
    monthlyCollectionPKR: 0,
    pendingFeesPKR: 0,
    overdueFeesPKR: 0,
    totalExpensesPKR: 0,
    netCollectionPKR: 0,
    totalChallansCount: 0,
  };

  const statusCounts = data?.statusCounts || { paid: 0, partial: 0, pending: 0, overdue: 0 };
  const categoryExpenses = data?.categoryExpenses || {};

  const totalStatusChallans = (statusCounts.paid || 0) + (statusCounts.partial || 0) + (statusCounts.pending || 0) + (statusCounts.overdue || 0);
  const paidPct = totalStatusChallans > 0 ? Math.round((statusCounts.paid / totalStatusChallans) * 100) : 0;
  const partialPct = totalStatusChallans > 0 ? Math.round((statusCounts.partial / totalStatusChallans) * 100) : 0;
  const pendingPct = totalStatusChallans > 0 ? Math.round((statusCounts.pending / totalStatusChallans) * 100) : 0;
  const overduePct = totalStatusChallans > 0 ? Math.round((statusCounts.overdue / totalStatusChallans) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white p-6 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-zinc-800">
        <div>
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-red-400" />
            Institutional Accounts & Treasury Console
          </span>
          <h1 className="text-2xl font-black tracking-tight">
            Financial Operations Dashboard
          </h1>
          <p className="text-xs text-zinc-300 mt-1">
            Net Collection Surplus: <span className="font-mono font-black text-red-400 text-sm">PKR {metrics.netCollectionPKR.toLocaleString()}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/finance/collection"
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-2 shrink-0"
          >
            <DollarSign className="h-4 w-4" />
            <span>Collect Fee Payment</span>
          </Link>
          <Link
            href="/finance/expenses"
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 shrink-0"
          >
            <span>Log Expense</span>
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 font-semibold">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase block">Today's Collection</span>
          <p className="text-lg font-black text-zinc-950 mt-1 font-mono">PKR {metrics.todayCollectionPKR.toLocaleString()}</p>
        </div>

        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase block">Monthly Collection</span>
          <p className="text-lg font-black text-zinc-950 mt-1 font-mono">PKR {metrics.monthlyCollectionPKR.toLocaleString()}</p>
        </div>

        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase block">Pending Dues</span>
          <p className="text-lg font-black text-amber-600 mt-1 font-mono">PKR {metrics.pendingFeesPKR.toLocaleString()}</p>
        </div>

        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase block">Overdue Fees</span>
          <p className="text-lg font-black text-red-600 mt-1 font-mono">PKR {metrics.overdueFeesPKR.toLocaleString()}</p>
        </div>

        <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase block">Total Expenses</span>
          <p className="text-lg font-black text-red-700 mt-1 font-mono">PKR {metrics.totalExpensesPKR.toLocaleString()}</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 text-white p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Net Balance</span>
          <p className="text-lg font-black text-red-400 mt-1 font-mono">PKR {metrics.netCollectionPKR.toLocaleString()}</p>
        </div>
      </div>

      {/* Visual Charts & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Fee Collection Status Distribution */}
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <PieChart className="h-5 w-5 text-red-600" />
              Fee Challan Realization Distribution
            </h2>
            <Link href="/finance/challans" className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1">
              Challan Ledger <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Paid</span>
              <span className="text-xl font-black text-emerald-700">{statusCounts.paid}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">Partial</span>
              <span className="text-xl font-black text-blue-700">{statusCounts.partial}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Pending</span>
              <span className="text-xl font-black text-amber-700">{statusCounts.pending}</span>
            </div>
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-red-800 uppercase block">Overdue</span>
              <span className="text-xl font-black text-red-700">{statusCounts.overdue}</span>
            </div>
          </div>

          {/* Progress Bar Representation */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-semibold text-zinc-700">
              <span>Collection Realization Percentage</span>
              <span>{paidPct}% Paid</span>
            </div>
            <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden flex">
              <div className="bg-emerald-600 h-full" style={{ width: `${paidPct}%` }} title="Paid" />
              <div className="bg-blue-500 h-full" style={{ width: `${partialPct}%` }} title="Partial" />
              <div className="bg-amber-500 h-full" style={{ width: `${pendingPct}%` }} title="Pending" />
              <div className="bg-red-600 h-full" style={{ width: `${overduePct}%` }} title="Overdue" />
            </div>
          </div>
        </div>

        {/* Expenses Category Breakdown */}
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <BarChart className="h-5 w-5 text-red-600" />
              Expenses Category Breakdown
            </h2>
            <Link href="/finance/expenses" className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1">
              Expense Log <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {Object.keys(categoryExpenses).length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">No recorded expenses in database.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {Object.entries(categoryExpenses).map(([cat, amt]: [string, any]) => {
                const totalExp = metrics.totalExpensesPKR || 1;
                const pct = Math.round((amt / totalExp) * 100);

                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-zinc-800 font-medium">
                      <span>{cat}</span>
                      <span className="font-mono font-bold">PKR {Number(amt || 0).toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-zinc-900 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    <WorkspaceAnalytics/>
</div>
  );
}


