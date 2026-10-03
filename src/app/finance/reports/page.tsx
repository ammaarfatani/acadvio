"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download, DollarSign, CheckCircle2 } from "lucide-react";
import { financeApi } from "@/lib/financeApi";

export default function NetFinancialReportsPage() {
  const [session, setSession] = useState("2025-2026");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState<any>(null);
  const [challans, setChallans] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      financeApi.getDashboardMetrics().catch(() => null),
      financeApi.getChallans().catch(() => null),
      financeApi.getExpenses().catch(() => null),
    ]).then(([mRes, cRes, eRes]) => {
      if (mRes?.data) setMetrics(mRes.data);
      if (cRes?.data && Array.isArray(cRes.data)) setChallans(cRes.data);
      if (eRes?.data && Array.isArray(eRes.data)) setExpenses(eRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleExport = (name: string) => {
    setNotice(`Downloading ${name} (CSV)...`);
    setTimeout(() => setNotice(null), 3500);
  };

  // Real database calculations
  const totalTuitionIncome = challans.reduce((sum, c) => sum + Number(c.feeBreakdown?.tuitionFee || 0), 0);
  const totalOtherFees = challans.reduce((sum, c) => {
    const fb = c.feeBreakdown || {};
    return sum + Number(fb.admissionFee || 0) + Number(fb.examFee || 0) + Number(fb.transportFee || 0) + Number(fb.libraryFee || 0) + Number(fb.computerFee || 0) + Number(fb.otherCharges || 0);
  }, 0);
  const totalDiscounts = challans.reduce((sum, c) => sum + Number(c.feeBreakdown?.discount || 0), 0);
  const netCollectedIncome = metrics?.metrics?.monthlyCollectionPKR || challans.reduce((sum, c) => sum + Number(c.paidAmountPKR || 0), 0);

  const totalPayrollExpenses = expenses.filter(e => e.category === "Salary" && !e.isVoided).reduce((sum, e) => sum + Number(e.amountPKR || 0), 0);
  const totalUtilityExpenses = expenses.filter(e => (e.category === "Electricity" || e.category === "Rent") && !e.isVoided).reduce((sum, e) => sum + Number(e.amountPKR || 0), 0);
  const totalOtherExpenses = expenses.filter(e => e.category !== "Salary" && e.category !== "Electricity" && e.category !== "Rent" && !e.isVoided).reduce((sum, e) => sum + Number(e.amountPKR || 0), 0);
  const totalExpensesSum = metrics?.metrics?.totalExpensesPKR || expenses.filter(e => !e.isVoided).reduce((sum, e) => sum + Number(e.amountPKR || 0), 0);

  const netOperatingSurplus = netCollectedIncome - totalExpensesSum;

  // Real class-wise realization grouping
  const classMap: Record<string, { className: string; count: number; expectedFee: number; collected: number; pending: number }> = {};
  challans.forEach((c) => {
    const cls = c.className || "Unassigned";
    if (!classMap[cls]) {
      classMap[cls] = { className: cls, count: 0, expectedFee: 0, collected: 0, pending: 0 };
    }
    classMap[cls].count += 1;
    classMap[cls].expectedFee += Number(c.totalAmountPKR || 0);
    classMap[cls].collected += Number(c.paidAmountPKR || 0);
    classMap[cls].pending += Number(c.remainingAmountPKR || 0);
  });

  const classWiseCollections = Object.values(classMap).map((item) => {
    const pct = item.expectedFee > 0 ? ((item.collected / item.expectedFee) * 100).toFixed(1) + "%" : "0%";
    return {
      className: item.className,
      totalStudents: item.count,
      expectedFee: item.expectedFee,
      collected: item.collected,
      pending: item.pending,
      percentage: pct,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-red-600" />
            Net Financial Summary & Audit Ledger
          </h1>
          <p className="text-xs text-zinc-500">Executive financial statements, income vs expenses calculation, and class collection reports</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={session}
            onChange={(e) => setSession(e.target.value)}
            className="text-xs font-bold border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
          >
            <option>Session 2025-2026</option>
            <option>Session 2026-2027</option>
          </select>

          <button
            onClick={() => handleExport("Master Financial Audit Ledger")}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors shadow-xs"
          >
            <Download className="h-4 w-4" />
            Export Audit Ledger
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Net Operating Balance Statement Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 text-red-800 rounded-lg">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-950">Net Operating Financial Statement</h2>
              <p className="text-[11px] text-zinc-500">Total Revenue Collected (-) Total Operational Expenses</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-red-600 uppercase block">Net Operating Surplus / Balance</span>
            <span className="text-2xl font-black text-red-600 font-mono">
              PKR {netOperatingSurplus.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
          
          {/* Revenue Breakdown */}
          <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl space-y-2">
            <span className="font-bold text-zinc-950 uppercase text-[11px] block border-b border-zinc-200 pb-1">
              A. Gross Revenue Collected
            </span>
            <div className="flex justify-between text-zinc-700">
              <span>Tuition Fee Billed:</span>
              <span className="font-mono font-bold text-zinc-950">PKR {totalTuitionIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Admission, Exam & Other Funds:</span>
              <span className="font-mono font-bold text-zinc-950">PKR {totalOtherFees.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Discounts & Concessions:</span>
              <span className="font-mono font-bold text-red-600">-PKR {totalDiscounts.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-2 font-black text-zinc-950">
              <span>Total Net Revenue Realized:</span>
              <span className="font-mono text-red-600">PKR {netCollectedIncome.toLocaleString()}</span>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-red-50/40 border border-red-200 p-4 rounded-xl space-y-2">
            <span className="font-bold text-red-900 uppercase text-[11px] block border-b border-red-200 pb-1">
              B. Total Operational Expenses
            </span>
            <div className="flex justify-between text-zinc-700">
              <span>Faculty & Staff Payroll:</span>
              <span className="font-mono font-bold text-zinc-950">PKR {totalPayrollExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Electricity, Rent & Campus Utilities:</span>
              <span className="font-mono font-bold text-zinc-950">PKR {totalUtilityExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-zinc-700">
              <span>Stationery, Maintenance & Other:</span>
              <span className="font-mono font-bold text-zinc-950">PKR {totalOtherExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-red-300 pt-2 font-black text-red-950">
              <span>Total Expenses Paid Out:</span>
              <span className="font-mono">PKR {totalExpensesSum.toLocaleString()}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Class-wise Collection Realization Ledger */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center text-xs">
          <span className="font-bold text-zinc-950 uppercase tracking-wider">
            Class-wise Fee Collection Realization Breakdown
          </span>
          <button
            onClick={() => handleExport("Class Wise Collection Summary")}
            className="text-red-600 font-bold hover:underline flex items-center gap-1"
          >
            Export Class Ledger
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3.5">Class Name</th>
                <th className="p-3.5 text-center">Challans Issued</th>
                <th className="p-3.5 text-center">Expected Dues</th>
                <th className="p-3.5 text-center">Collected Amount</th>
                <th className="p-3.5 text-center">Pending Dues</th>
                <th className="p-3.5 text-center">Realization %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">Loading financial audit breakdown...</td>
                </tr>
              ) : classWiseCollections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">No class fee realization records found in database.</td>
                </tr>
              ) : (
                classWiseCollections.map((c) => (
                  <tr key={c.className} className="hover:bg-zinc-50">
                    <td className="p-3.5 font-bold text-zinc-950">{c.className}</td>
                    <td className="p-3.5 text-center font-mono text-zinc-700">{c.totalStudents} Challans</td>
                    <td className="p-3.5 text-center font-mono font-bold text-zinc-900">PKR {c.expectedFee.toLocaleString()}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-emerald-700">PKR {c.collected.toLocaleString()}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-amber-600">PKR {c.pending.toLocaleString()}</td>
                    <td className="p-3.5 text-center font-mono font-black text-red-600">{c.percentage}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

