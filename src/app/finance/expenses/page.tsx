"use client";



import {Presence} from "@/components/Motion";
import { useEffect, useState } from "react";
import { Receipt, Plus, Search, CheckCircle2, X } from "lucide-react";
import { financeApi } from "@/lib/financeApi";

interface ExpenseItem {
  _id: string;
  id?: string;
  title: string;
  category: "Salary" | "Rent" | "Electricity" | "Stationery" | "Maintenance" | "Transport" | "Other";
  amountPKR: number;
  expenseDate: string;
  paymentMethod: string;
  description: string;
  loggedByName?: string;
  isVoided?: boolean;
  status?: "ACTIVE" | "VOIDED";
}

export default function ExpenseManagementPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"Salary" | "Rent" | "Electricity" | "Stationery" | "Maintenance" | "Transport" | "Other">("Stationery");
  const [amountPKR, setAmountPKR] = useState(0);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getExpenses();
      if (res?.data && Array.isArray(res.data)) {
        setExpenses(res.data);
      } else {
        setExpenses([]);
      }
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || amountPKR <= 0) return;

    setSubmitting(true);
    const newExp = {
      title,
      category,
      amountPKR,
      expenseDate,
      paymentMethod,
      description,
    };

    try {
      await financeApi.createExpense(newExp);
      await loadExpenses();
      setShowModal(false);
      setNotice(`Expense '${title}' logged successfully!`);
      setTimeout(() => setNotice(null), 3500);
      setTitle("");
      setDescription("");
      setAmountPKR(0);
    } catch {
      // The shared API feedback displays the error; keep the form open for correction.
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidExpense = async (exp: ExpenseItem) => {
    const confirmVoid = window.confirm(`Are you sure you want to VOID expense '${exp.title}' (PKR ${exp.amountPKR.toLocaleString()})?`);
    if (!confirmVoid) return;

    const reason = prompt("Enter reason for voiding expense:", "Duplicate billing entry");
    if (!reason) return;

    try {
      await financeApi.voidExpense(exp._id || exp.id!, reason);
      await loadExpenses();
      setNotice(`Expense '${exp.title}' voided and audit log recorded.`);
      setTimeout(() => setNotice(null), 3500);
    } catch {
      return;
    }
  };

  const filtered = expenses.filter((e) => {
    const matchesCategory = categoryFilter === "ALL" || e.category === categoryFilter;
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) || (e.description || "").toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalExpenseSum = expenses.filter((e) => !e.isVoided && e.status !== "VOIDED").reduce((sum, e) => sum + (e.amountPKR || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-red-600" />
            Institutional Expense Log & Category Audit
          </h1>
          <p className="text-xs text-zinc-500">Record operational expenses across salaries, utilities, rent, maintenance, and supplies</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Log New Expense
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "Salary", "Rent", "Electricity", "Stationery", "Maintenance", "Transport", "Other"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                categoryFilter === cat ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border border-zinc-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center text-xs">
          <span className="font-bold text-zinc-950 uppercase tracking-wider">Expense Vouchers Log</span>
          <span className="font-bold text-red-700 font-mono">Active Total Expenses: PKR {totalExpenseSum.toLocaleString()}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3.5">Expense Title</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-center">Date</th>
                <th className="p-3.5 text-center">Payment Mode</th>
                <th className="p-3.5 text-right">Amount (PKR)</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">Loading expense logs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">No expense records found.</td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const isVoided = e.isVoided || e.status === "VOIDED";
                  return (
                    <tr key={e._id || e.id} className="hover:bg-zinc-50">
                      <td className="p-3.5">
                        <span className="font-bold text-zinc-950 block">{e.title}</span>
                        <span className="text-[10px] text-zinc-500">{e.description}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="bg-zinc-100 text-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          {e.category}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-zinc-700 text-[11px]">
                        {new Date(e.expenseDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-center font-semibold text-zinc-800">{e.paymentMethod}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-red-700">
                        PKR {(e.amountPKR || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center">
                        {!isVoided ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">ACTIVE</span>
                        ) : (
                          <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded">VOIDED</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {!isVoided && (
                          <button
                            onClick={() => handleVoidExpense(e)}
                            className="px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded"
                          >
                            Void Voucher
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Modal */}
      <Presence show={Boolean(showModal)} kind="modal">{showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">Log New Operational Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Expense Title / Particulars</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical generator diesel refilling"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 focus:outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
                  >
                    <option value="Salary">Salary Payroll</option>
                    <option value="Rent">Building Rent</option>
                    <option value="Electricity">Electricity & Utilities</option>
                    <option value="Stationery">Stationery & Printing</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Transport">Transport Fuel</option>
                    <option value="Other">Other Expenses</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amountPKR}
                    onChange={(e) => setAmountPKR(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 font-mono font-bold focus:outline-none text-red-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
                  >
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Cheque</option>
                    <option>Online</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Description / Bill Ref</label>
                <textarea
                  rows={3}
                  placeholder="Enter invoice or bill reference details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
                >
                  {submitting ? "Logging..." : "Log Expense Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</Presence>
    </div>
  );
}

