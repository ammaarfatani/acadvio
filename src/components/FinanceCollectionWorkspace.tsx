"use client";
import {TableScroll} from "@/components/TableScroll";

import {RecordFilters,matchesRecordSearch} from "@/components/RecordFilters";
import { useRecordRefresh } from "@/lib/use-record-refresh";
import { invoiceTotals } from "@/lib/fee-math";
import { StudentAvatar } from "@/components/StudentAvatar";

import { Presence } from "@/components/Motion";
import { confirmAction, requestReason } from "@/components/ConfirmationHost";
import { useCallback, useEffect, useRef, useState } from "react";
import { DollarSign, Search, CheckCircle2, Printer, X } from "lucide-react";
import { financeApi } from "@/lib/financeApi";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { feeMonthFromRecord, feeMonthLabel } from "@/lib/fee-math";
import FinancialDocumentPreview from "@/components/FinancialDocumentPreview";

interface ChallanRecord {
  id: string;
  challanNo: string;
  studentName: string;
  studentId: string;
  rollNo: string;
  admissionNo: string;
  className: string;
  feeStructureTitle?: string;
  classCategoryName?: string;
  sectionName?: string;
  academicSession?: string;
  month: string;
  monthKey?: string;
  dueDate: string;
  previousBalance: number;
  currentCharges: number;
  discount: number;
  lateFee: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "PAID" | "PENDING" | "PARTIAL" | "OVERDUE" | "ZERO_BALANCE" | "VOIDED";
}
const formatPKR = (value: number) => Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FinanceCollectionWorkspace() {
  const requestId = useRef("");
  const [search, setSearch] = useState("");
  const [filterClass,setFilterClass]=useState(""),[filterMonth,setFilterMonth]=useState(""),[filterSection,setFilterSection]=useState(""),[filterCategory,setFilterCategory]=useState(""),[filterSession,setFilterSession]=useState("");
  const [filterOptions,setFilterOptions]=useState<any>({classes:[],sections:[],categories:[],sessions:[]});
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState<string | null>(null);
  const [challans, setChallans] = useState<ChallanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [receipt, setReceipt] = useState<any>(null);
  const [openingReceipt, setOpeningReceipt] = useState(false);
  const [ledger, setLedger] = useState<any>(null);
  const [openingLedger, setOpeningLedger] = useState(false);

  const loadChallans = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const allRows: any[] = [];
      let skip = 0;
      while (true) {
        const response = await financeApi.getChallans({ limit: 1000, skip });
        const page = response.data || [];
        allRows.push(...page);
        if (page.length < 1000) break;
        skip += page.length;
      }
      setChallans(
        allRows.map((item: any) => ({
          id: String(item._id),
          studentId: String(item.studentId?._id || item.studentId),
          challanNo: item.challanNumber,
          studentName: item.studentName,
          rollNo: item.rollNumber,
          admissionNo: item.admissionNumber || "",
          className: item.className,
          feeStructureTitle: item.feeStructureTitle,
          classCategoryName: item.classCategoryName,
          sectionName: item.sectionName,
          academicSession: item.academicSession,
          month: feeMonthFromRecord(item.month, item.dueDate) ? feeMonthLabel(feeMonthFromRecord(item.month, item.dueDate)!) : typeof item.month === "string" && /^[A-Za-z]+$/.test(item.month.trim()) ? `${item.month.trim()} (year unavailable)` : "Unrecognized billing month",
          monthKey: feeMonthFromRecord(item.month, item.dueDate),
          dueDate: item.dueDate,
          previousBalance: item.previousBalance || 0,
          currentCharges: ["admissionFee", "tuitionFee", "examFee", "transportFee", "libraryFee", "computerFee", "otherCharges"].reduce((sum: number, key) => sum + Number(item.feeBreakdown?.[key] || 0), 0) + (Array.isArray(item.feeBreakdown?.customCharges) ? item.feeBreakdown.customCharges.reduce((sum: number, charge: any) => sum + Number(charge.amount || 0), 0) : 0),
          discount:
            Number(item.feeBreakdown?.discount || 0) +
            Number(item.feeBreakdown?.scholarship || 0),
          lateFee: item.feeBreakdown?.lateFeeFine || 0,
          totalAmount: item.totalAmountPKR,
          paidAmount: item.paidAmountPKR,
          remainingAmount: item.currentPayablePKR ?? item.remainingAmountPKR,
          status: ["PAID", "VOIDED"].includes(item.status) ? item.status : (item.currentPayablePKR ?? item.remainingAmountPKR) <= 0 ? "ZERO_BALANCE" : item.paidAmountPKR > 0 ? "PARTIAL" : new Date(item.dueDate).getTime() < new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()) + "T00:00:00").getTime() ? "OVERDUE" : item.status,
        })),
      );
    } catch (error: any) {
      setLoadError(error?.message || "Unable to load fee challans.");
      setChallans([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadChallans();
  }, [loadChallans]);

  useEffect(() => {
    let live = true;
    Promise.allSettled([
      schoolAdminApi.getClasses(), schoolAdminApi.getClassCategories({ status: "ACTIVE" }), schoolAdminApi.getAcademicSessions(), schoolAdminApi.getSections(),
    ]).then(([classes, categories, sessions, sections]) => {
      if (!live) return;
      setFilterOptions({
        classes: classes.status === "fulfilled" ? classes.value.data || [] : [],
        categories: categories.status === "fulfilled" ? categories.value.data || [] : [],
        sessions: sessions.status === "fulfilled" ? sessions.value.data || [] : [],
        sections: sections.status === "fulfilled" ? sections.value.data || [] : [],
      });
    });
    return () => { live = false; };
  }, []);

  useRecordRefresh(loadChallans, ["finance"]);
  // Modal Collect State
  const [selectedChallan, setSelectedChallan] = useState<ChallanRecord | null>(
    null,
  );
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<
    "Cash" | "Bank Transfer" | "Online" | "Cheque" | "Other"
  >("Cash");
  const [paymentDate, setPaymentDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()));
  const [paymentReference, setPaymentReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpenCollect = (c: ChallanRecord) => {
    requestId.current = "";
    setSelectedChallan(c);
    setPayAmount(c.remainingAmount);
    setPaymentDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()));
    setPaymentReference("");
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallan || payAmount <= 0 || submitting) return;

    // Confirmation dialog check
    const confirmChoice = await confirmAction(
      `Confirm collecting PKR ${payAmount.toLocaleString()} via ${payMethod} for ${selectedChallan.studentName}?`,
    );
    if (!confirmChoice) return;

    setSubmitting(true);
    try {
      requestId.current ||= crypto.randomUUID();
      await financeApi.collectPayment({
        requestId: requestId.current,
        challanId: selectedChallan.id,
        amountPKR: payAmount,
        paymentMethod: payMethod,
        paymentDate,
        transactionReference: paymentReference.trim() || undefined,
      });
      await loadChallans();
      setSelectedChallan(null);
      requestId.current = "";
      setNotice(
        `Payment of PKR ${payAmount.toLocaleString()} collected successfully! Official receipt generated.`,
      );
      setTimeout(() => setNotice(null), 4000);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidChallan = async (c: ChallanRecord) => {
    const reason = await requestReason(
      `Enter the reason for voiding challan ${c.challanNo}.`,
      "Void fee challan",
    );
    if (!reason) return;

    try {
      await financeApi.voidChallan(c.id, reason);
    } catch {
      return;
    }

    await loadChallans();
    setNotice(`Challan ${c.challanNo} voided and audit log recorded.`);
    setTimeout(() => setNotice(null), 3500);
  };

  const openReceipt = async (challanId: string) => {
    if (openingReceipt) return;
    setOpeningReceipt(true);
    setLoadError("");
    try {
      const response = await financeApi.getReceipt(challanId);
      setReceipt(response.data);
    } catch (error: any) {
      setLoadError(error?.message || "Unable to load the payment receipt.");
    } finally {
      setOpeningReceipt(false);
    }
  };

  const openLedger = async (studentId: string) => {
    if (openingLedger) return;
    setOpeningLedger(true);
    setLoadError("");
    try {
      const response = await financeApi.getStudentLedger(studentId);
      setLedger(response.data);
    } catch (error: any) {
      setLoadError(error?.message || "Unable to load the student ledger.");
    } finally {
      setOpeningLedger(false);
    }
  };

  const filtered = challans.filter((c) => {
    const matchesSearch = matchesRecordSearch([c.studentName,c.rollNo,c.admissionNo,c.challanNo,c.className,c.month,c.status],search);
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus && (!filterClass||c.className===filterClass) && (!filterMonth||c.monthKey===filterMonth) && (!filterSection||c.sectionName===filterSection) && (!filterCategory||c.classCategoryName===filterCategory) && (!filterSession||c.academicSession===filterSession);
  });

  const totals = invoiceTotals(
    filtered.map((c) => ({
      totalAmountPKR: c.totalAmount,
      paidAmountPKR: c.paidAmount,
      remainingAmountPKR: c.remainingAmount,
      status: c.status,
    })),
  );
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-red-600" />
            Fee Collection & Student Ledger Desk
          </h1>
          <p className="text-xs text-zinc-500">
            Collect payments, generate instant receipts, manage student fee
            accounts and void records
          </p>
        </div>
      </div>

      {loadError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {loadError}
        </p>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total fees", totals.charged],
          ["Collected", totals.paid],
          ["Pending", totals.pending],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-white p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <strong className="mt-2 block text-xl">
              PKR{" "}
              {Number(value).toLocaleString("en-PK", {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Totals follow the search and status filters; voided invoices are
        excluded.
      </p>
      {/* Search & Filter Bar */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {["ALL", "PENDING", "PARTIAL", "PAID", "OVERDUE", "ZERO_BALANCE", "VOIDED"].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === st
                    ? "bg-red-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {st}
              </button>
            ),
          )}
        </div>


      </div>

      <RecordFilters responsiveGrid search={search} onSearch={setSearch} placeholder="Search name, admission, roll, class or challan" count={filtered.length} total={challans.length} filters={[
        {label:"Academic session",value:filterSession,onChange:setFilterSession,options:filterOptions.sessions.map((row:any)=>row.name)},
        {label:"Class category",value:filterCategory,onChange:setFilterCategory,options:filterOptions.categories.map((row:any)=>row.name)},
        {label:"Class",value:filterClass,onChange:setFilterClass,options:filterOptions.classes.filter((row:any)=>!filterCategory||row.classCategoryName===filterCategory).map((row:any)=>row.name)},
        {label:"Section",value:filterSection,onChange:setFilterSection,options:filterOptions.sections.filter((row:any)=>!filterClass||String(row.classId)===String(filterOptions.classes.find((c:any)=>c.name===filterClass)?._id)).map((row:any)=>row.name)},
        {label:"Month",value:filterMonth,onChange:setFilterMonth,options:Array.from(new Set(challans.map(c=>c.monthKey).filter((value): value is string => Boolean(value)))).sort().reverse().map((value)=>({value,label:feeMonthLabel(value)}))}
      ]} onReset={()=>{setSearch("");setStatusFilter("ALL");setFilterSession("");setFilterCategory("");setFilterClass("");setFilterSection("");setFilterMonth("")}}/>
      {/* Ledger Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <TableScroll><table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3.5">Challan No</th>
                <th className="p-3.5">Student Info</th>
                <th className="p-3.5 text-center">Month</th>
                <th className="p-3.5 text-center">Due date</th>
                <th className="p-3.5 text-center">Prev. Bal</th>
                <th className="p-3.5 text-center">Charges</th>
                <th className="p-3.5 text-center">Discount</th>
                <th className="p-3.5 text-center">Late fine</th>
                <th className="p-3.5 text-center">Total Dues</th>
                <th className="p-3.5 text-center">Paid</th>
                <th className="p-3.5 text-center">Remaining</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-zinc-500">
                    Loading fee challans…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-zinc-500">
                    No fee challans found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="p-3.5 font-mono font-bold text-zinc-800">
                      {c.challanNo}
                    </td>
                    <td className="p-3.5">
                      <span className="flex items-center gap-2 font-bold text-zinc-950">
                        <StudentAvatar
                          student={{ _id: c.studentId, name: c.studentName }}
                        />
                        {c.studentName}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Roll: {c.rollNo} ({c.className}{c.sectionName ? ` · ${c.sectionName}` : ""}){c.feeStructureTitle ? ` · ${c.feeStructureTitle}` : ""}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-mono text-zinc-700 text-[11px]">
                      {c.month}
                    </td>
                    <td className="p-3.5 text-center text-zinc-600">{new Date(c.dueDate).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</td>
                    <td className="p-3.5 text-center font-mono text-zinc-500">
                      PKR {c.previousBalance}
                    </td>
                    <td className="p-3.5 text-center font-mono text-zinc-800 font-semibold">
                      PKR {formatPKR(c.currentCharges)}
                    </td>
                    <td className="p-3.5 text-center font-mono text-emerald-700 font-semibold">
                      -PKR {formatPKR(c.discount)}
                    </td>
                    <td className="p-3.5 text-center font-mono text-amber-700 font-semibold">PKR {formatPKR(c.lateFee)}</td>
                    <td className="p-3.5 text-center font-mono font-bold text-zinc-950">
                      PKR {formatPKR(c.totalAmount)}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-emerald-700">
                      PKR {formatPKR(c.paidAmount)}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-red-600">
                      PKR {formatPKR(c.remainingAmount)}
                    </td>
                    <td className="p-3.5 text-center">
                      {c.status === "PAID" ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          PAID
                        </span>
                      ) : c.status === "PARTIAL" ? (
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          PARTIAL
                        </span>
                      ) : c.status === "VOIDED" ? (
                        <span className="bg-zinc-100 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded">
                          VOIDED
                        </span>
                      ) : c.status === "ZERO_BALANCE" ? (
                        <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded">ZERO BALANCE</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      <button disabled={openingLedger} onClick={() => void openLedger(c.studentId)} className="px-2.5 py-1 text-[11px] font-bold border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-60">Ledger</button>
                      {c.status !== "PAID" && c.status !== "ZERO_BALANCE" && c.status !== "VOIDED" && (
                        <button
                          onClick={() => handleOpenCollect(c)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                          Collect
                        </button>
                      )}
                      {c.paidAmount > 0 && (
                        <button disabled={openingReceipt} onClick={() => void openReceipt(c.id)} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-zinc-900 text-white rounded hover:bg-zinc-800 disabled:opacity-60">
                          <Printer className="h-3 w-3" /> Receipt
                        </button>
                      )}
                      {c.status !== "VOIDED" && (
                        <button
                          onClick={() => handleVoidChallan(c)}
                          className="px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded"
                          title="Void Challan"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></TableScroll>
        </div>
      </div>

      {/* Collect Payment Modal */}
      <Presence show={Boolean(selectedChallan)} kind="modal">
        {selectedChallan && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
                <h3 className="text-lg font-bold text-zinc-950">
                  Collect Fee Payment
                </h3>
                <button
                  onClick={() => setSelectedChallan(null)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl text-xs space-y-1">
                <div>
                  Student:{" "}
                  <strong className="text-zinc-950">
                    {selectedChallan.studentName}
                  </strong>{" "}
                  (Roll {selectedChallan.rollNo})
                </div>
                <div>
                  Challan #:{" "}
                  <span className="font-mono text-zinc-700">
                    {selectedChallan.challanNo}
                  </span>
                </div>
                <div>
                  Remaining Dues:{" "}
                  <strong className="font-mono text-red-600">
                    PKR {selectedChallan.remainingAmount.toLocaleString()}
                  </strong>
                </div>
              </div>

              <form
                onSubmit={handleCollectSubmit}
                className="space-y-4 text-xs"
              >
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Payment Date</label>
                  <input type="date" required value={paymentDate} max={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date())} onChange={e => setPaymentDate(e.target.value)} className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">
                    Payment Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => setPayMethod(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none font-bold text-zinc-900"
                  >
                    <option value="Cash">Cash Counter Collection</option>
                    <option value="Bank Transfer">Bank Online Transfer</option>
                    <option value="Online">Credit/Debit Card Online</option>
                    <option value="Cheque">Bank Cheque / Pay Order</option>
                    <option value="Other">Other Gateway</option>
                  </select>
                </div>

                {payMethod !== "Cash" && <div><label className="block font-bold text-zinc-700 uppercase mb-1">Payment Reference (optional)</label><input maxLength={160} value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50" placeholder="Bank / cheque / transaction reference" /></div>}

                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">
                    Amount to Collect (PKR)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedChallan.remainingAmount}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 font-mono font-black text-base focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
                  <button
                    type="button"
                    onClick={() => setSelectedChallan(null)}
                    className="px-4 py-2 font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
                  >
                    {submitting ? "Processing..." : "Confirm & Collect Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Presence>
      {receipt && <FinancialDocumentPreview challan={receipt.challanId} payment={receipt} onClose={() => setReceipt(null)} />}
      <Presence show={Boolean(ledger)} kind="modal">
        {ledger && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-label="Student fee ledger" className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3 border-b pb-3"><div><h2 className="text-lg font-bold">Student fee ledger</h2><p className="text-sm text-zinc-500">{ledger.student?.name} · {ledger.student?.className} · Roll {ledger.student?.rollNumber}</p></div><button onClick={()=>setLedger(null)} className="rounded-lg border px-3 py-2 text-sm">Close</button></div><div className="my-4 grid gap-3 sm:grid-cols-3">{[["Charged",ledger.summary?.totalCharged],["Paid",ledger.summary?.totalPaid],["Outstanding",ledger.summary?.remainingBalance]].map(([label,value])=><div key={String(label)} className="rounded-lg border p-3"><p className="text-xs text-zinc-500">{label}</p><strong>PKR {formatPKR(Number(value||0))}</strong></div>)}</div><h3 className="mb-2 font-semibold">Payment history</h3><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-zinc-50"><tr>{["Date","Receipt","Challan","Method / reference","Amount PKR"].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{(ledger.payments||[]).map((payment:any)=><tr className="border-t" key={payment._id}><td className="p-2">{new Date(payment.paidAt).toLocaleDateString()}</td><td className="p-2 font-mono">{payment.receiptNumber}</td><td className="p-2 font-mono">{ledger.challans?.find((row:any)=>String(row._id)===String(payment.challanId))?.challanNumber}</td><td className="p-2">{payment.paymentMethod}{payment.transactionReference?` · ${payment.transactionReference}`:""}</td><td className="p-2 font-semibold">PKR {formatPKR(payment.amountPKR)}</td></tr>)}</tbody></table></div>{!(ledger.payments||[]).length&&<p className="py-5 text-sm text-zinc-500">No payments recorded for this student yet.</p>}</section></div>}
      </Presence>
    </div>
  );
}

