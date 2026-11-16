"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { apiFetch, privateFile } from "@/lib/api";
import { buildFeeCollectionMatrixRequest } from "@/lib/fee-collection-matrix-request";

const input = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm";
const button = "rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-40";
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const amount = (value: unknown) => Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const schoolDate = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const identityHeaders = ["#", "Student ID", "Roll No.", "Student Name", "Class", "Section"];
const monthHeaders = [...identityHeaders, ...MONTHS, "Unallocated Billing Month", "Total (PKR)"];
const componentHeaders = [...identityHeaders, "Discount (Info)", "Admission", "Annual", "Late Fine", "Lab", "Other", "Unallocated Component", "Total (PKR)"];

export default function FeeCollectionMatrixReport() {
  const [sessions, setSessions] = useState<any[]>([]), [sessionId, setSessionId] = useState("");
  const [options, setOptions] = useState<any>({ branches: [], categories: [], classes: [], sections: [], branchLocked: false, branchId: "" });
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", branchId: "", classCategoryId: "", classId: "", sectionId: "" });
  const [report, setReport] = useState<any>(null), [busy, setBusy] = useState(""), [error, setError] = useState("");
  const loadOptions = (categoryId: string, classId: string) => {
    const query = new URLSearchParams();
    if (categoryId) query.set("classCategoryId", categoryId);
    if (classId) query.set("classId", classId);
    return apiFetch("/smart-reports/fee-collection/matrix-filters?" + query.toString()).then(result => setOptions(result.data));
  };
  useEffect(() => {
    let alive = true;
    Promise.all([apiFetch("/smart-reports/fee-collection/sessions"), loadOptions("", "")]).then(([result]) => {
      if (!alive) return;
      const rows = result.data.sessions || [];
      setSessions(rows);
      const chosen = rows.find((session: any) => session.isCurrent) || rows[0];
      if (chosen) {
        setSessionId(chosen._id);
        const start = schoolDate(chosen.startDate), end = schoolDate(chosen.endDate), now = schoolDate(new Date());
        setFilters(current => ({ ...current, fromDate: start, toDate: now >= start && now <= end ? now : end }));
      }
    }).catch((e: any) => { if (alive) setError(e.message || "Report filters could not be loaded."); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { void loadOptions(filters.classCategoryId, filters.classId).catch((e: any) => setError(e.message)); }, [filters.classCategoryId, filters.classId]);
  const change = (key: keyof typeof filters, value: string) => {
    setReport(null); setError("");
    setFilters(current => {
      if (key === "classCategoryId") return { ...current, classCategoryId: value, classId: "", sectionId: "" };
      if (key === "classId") return { ...current, classId: value, sectionId: "" };
      return { ...current, [key]: value };
    });
  };
  const payload = useMemo(() => buildFeeCollectionMatrixRequest({
    academicSessionId: sessionId,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    branchId: options.branchLocked ? undefined : filters.branchId,
    classCategoryId: filters.classCategoryId,
    classId: filters.classId,
    sectionId: filters.sectionId,
  }), [sessionId, filters, options.branchLocked]);
  const preview = async () => {
    setBusy("Preparing report…"); setError("");
    try { const result = await apiFetch("/smart-reports/fee-collection/matrix", { method: "POST", body: JSON.stringify(payload) }); setReport(result.data.report); }
    catch (e: any) { setError(e.message || "The fee collection report could not be generated."); }
    finally { setBusy(""); }
  };
  const download = async (format: "pdf" | "xlsx") => {
    setBusy(format === "pdf" ? "Preparing PDF…" : "Preparing Excel…"); setError("");
    try {
      const file = await privateFile("/smart-reports/fee-collection/matrix", { method: "POST", body: JSON.stringify({ ...payload, format }) });
      const url = URL.createObjectURL(file), link = document.createElement("a"); link.href = url;
      link.download = `fee-collection-monthly-matrix-${filters.fromDate}-${filters.toDate}.${format}`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e: any) { setError(e.message || `Could not export ${format.toUpperCase()}.`); }
    finally { setBusy(""); }
  };
  const formatCell = (value: unknown, index: number) => typeof value === "number" ? amount(value) : String(value ?? "");
  const filtersReady = !!sessionId && !!filters.fromDate && !!filters.toDate;
  const collectionTable = (title: string, visibleHeaders: string[], rowValues: (row: any, index: number) => any[], totals: (values: any) => number[], minWidth: string, extraClass = "") => <section className={`fee-matrix-view space-y-2 ${extraClass}`}>
    <h4 className="border-l-4 border-red-700 pl-3 text-sm font-bold uppercase tracking-wide text-zinc-900">{title}</h4>
    <div className="overflow-x-auto rounded border border-zinc-300">
      <table className="w-full border-collapse text-xs" style={{ minWidth }}>
        <thead><tr>{visibleHeaders.map((header, index) => <th key={header} className={`border border-red-900 bg-red-700 px-1.5 py-2 text-white ${index >= 6 ? "text-right" : "text-left"}`}>{header}{index >= 6 && !header.includes("PKR") ? " (PKR)" : ""}</th>)}</tr></thead>
        <tbody>
          {report.categories.map((category: any) => <Fragment key={`${title}-${category.id}`}>
            <tr><th colSpan={visibleHeaders.length} className="border border-red-900 bg-red-900 px-2 py-1.5 text-left text-white">{category.name} · Students: {category.totalStudents}</th></tr>
            {category.rows.map((row: any, index: number) => <tr key={row.key}>{rowValues(row, index + 1).map((value, cellIndex) => <td key={cellIndex} className={`border border-zinc-300 px-1.5 py-1.5 ${cellIndex >= 6 ? "text-right tabular-nums" : ""}`}>{formatCell(value, cellIndex)}</td>)}</tr>)}
            <tr className="bg-red-50 font-semibold"><td colSpan={6} className="border border-red-300 px-1.5 py-1.5 text-red-900">{category.name} Subtotal</td>{totals(category.totals).map((value, index) => <td key={index} className="border border-red-300 px-1.5 py-1.5 text-right tabular-nums text-red-900">{amount(value)}</td>)}</tr>
          </Fragment>)}
          {!report.categories.length && <tr><td colSpan={visibleHeaders.length} className="border p-5 text-center text-zinc-500">No recorded receipts match these filters.</td></tr>}
          <tr className="bg-zinc-900 font-bold text-white"><td colSpan={6} className="border border-zinc-900 px-1.5 py-2">GRAND TOTAL</td>{totals(report.totals).map((value, index) => <td key={index} className="border border-zinc-700 px-1.5 py-2 text-right tabular-nums">{amount(value)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  </section>;

  return <div className="space-y-4">
    <section className="grid gap-3 rounded-md border bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
      <label className="text-xs font-semibold">Academic Session<select className={input + " mt-1"} value={sessionId} onChange={e => { const value = e.target.value; setSessionId(value); setReport(null); const row = sessions.find(session => session._id === value); if (row) { const start = schoolDate(row.startDate), end = schoolDate(row.endDate), now = schoolDate(new Date()); setFilters(current => ({ ...current, fromDate: start, toDate: now >= start && now <= end ? now : end })); } }}><option value="">Choose session</option>{sessions.map(session => <option key={session._id} value={session._id}>{session.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Receipt Date From<input className={input + " mt-1"} type="date" value={filters.fromDate} onChange={e => change("fromDate", e.target.value)} /></label>
      <label className="text-xs font-semibold">Receipt Date Through<input className={input + " mt-1"} type="date" value={filters.toDate} onChange={e => change("toDate", e.target.value)} /></label>
      <label className="text-xs font-semibold">Branch<select className={input + " mt-1"} value={options.branchLocked ? options.branchId : filters.branchId} disabled={options.branchLocked} onChange={e => change("branchId", e.target.value)}><option value="">All authorized branches</option>{options.branches.map((row: any) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Class Category<select className={input + " mt-1"} value={filters.classCategoryId} onChange={e => change("classCategoryId", e.target.value)}><option value="">All categories</option>{options.categories.map((row: any) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Class<select className={input + " mt-1"} value={filters.classId} onChange={e => change("classId", e.target.value)}><option value="">All classes</option>{options.classes.map((row: any) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
      <label className="text-xs font-semibold">Section<select className={input + " mt-1"} value={filters.sectionId} disabled={!filters.classId} onChange={e => change("sectionId", e.target.value)}><option value="">All sections</option>{options.sections.map((row: any) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
      <div className="flex items-end"><button className={button + " w-full bg-red-700 text-white"} disabled={!filtersReady || !!busy || filters.fromDate > filters.toDate} onClick={() => void preview()}>{busy || "Preview Report"}</button></div>
    </section>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {report && <>
      <div className="flex flex-wrap items-center gap-3 print:hidden"><button className={button} disabled={!!busy} onClick={() => void download("pdf")}>Download PDF</button><button className={button} disabled={!!busy} onClick={() => void download("xlsx")}>Export Excel</button><button className={button} disabled={!!busy} onClick={() => window.print()}>Print Report</button><span className="text-xs text-zinc-500">PDF uses A3 landscape for the full monthly matrix.</span></div>
      <div id="fee-matrix-print-area" className="space-y-5 border border-zinc-300 bg-white p-4 text-black print:border-0 print:p-0">
        <header className="flex items-center gap-3 border-b-2 border-red-700 pb-3"><div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{report.school.name}</h2><p className="text-xs">{report.school.address} {report.school.phone && `· ${report.school.phone}`}</p><h3 className="mt-1 text-sm font-bold text-red-700">Fee Collection Report — Monthly Matrix</h3><p className="text-xs">Academic Session: {report.session} · Receipt Date Range: {report.fromDate} to {report.toDate} · Branch: {report.branchScope}</p></div>{report.school.logoUrl && <img src={report.school.logoUrl} alt="School logo" className="max-h-14 max-w-20 object-contain" />}</header>
        <div className={`border-l-4 p-3 text-sm font-semibold ${report.reconciliationDifferencePKR === 0 && report.componentReconciliationDifferencePKR === 0 && !report.duplicatePaymentRecords && !report.skippedPaymentRecords ? "border-emerald-700 bg-emerald-50" : "border-red-700 bg-red-50"}`}>{report.reconciliationDifferencePKR === 0 && report.componentReconciliationDifferencePKR === 0 && !report.duplicatePaymentRecords && !report.skippedPaymentRecords ? "RECONCILED" : "RECONCILIATION CHECK REQUIRED"} · Receipts {`PKR ${amount(report.ledgerTotalPKR)}`} · Billing-month difference {`PKR ${amount(report.reconciliationDifferencePKR)}`} · Component difference {`PKR ${amount(report.componentReconciliationDifferencePKR)}`} {report.duplicatePaymentRecords ? `· Duplicate receipts excluded: ${report.duplicatePaymentRecords}` : ""} {report.skippedPaymentRecords ? `· Unmatched/voided receipt records excluded: ${report.skippedPaymentRecords}` : ""}</div>
        {collectionTable("Collections by billing month", monthHeaders, (row, index) => [index, row.id, row.rollNumber, row.name, row.className, row.sectionName, ...MONTHS.map(month => row.values[month.toLowerCase()]), row.values.unallocatedMonth, row.values.total], (values) => [...MONTHS.map(month => values[month.toLowerCase()]), values.unallocatedMonth, values.total], "1400px")}
        {collectionTable("Collections by component", componentHeaders, (row, index) => [index, row.id, row.rollNumber, row.name, row.className, row.sectionName, row.values.discount, row.values.admission, row.values.annual, row.values.late, row.values.lab, row.values.other, row.values.unallocatedComponents, row.values.total], (values) => [values.discount, values.admission, values.annual, values.late, values.lab, values.other, values.unallocatedComponents, values.total], "1100px", "fee-matrix-component-view")}
        <p className="border-t border-zinc-200 pt-3 text-xs leading-5">The billing-month and component tables are separate classifications of the same receipts. Do not add their totals together. Billing month comes from the linked challan&apos;s saved period; receipt date only determines inclusion. Unallocated Billing Month means no usable challan month was saved. Unallocated Component means no payment-to-fee-line allocation was saved. Neither is guessed. Discount is informational and excluded from collection totals.</p>
        <section className="space-y-1 border-t pt-2 text-xs"><h4 className="font-bold">Calculation notes</h4>{report.notes.map((note: string, index: number) => <p key={index}>{note}</p>)}</section>
      </div>
    </>}
    {!report && !error && <p className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Choose the reporting filters, then preview to see student collections and totals.</p>}
    <style jsx global>{`@media print { @page fee-matrix-page { size: A3 landscape; margin: 7mm; } body * { visibility: hidden !important; } #fee-matrix-print-area, #fee-matrix-print-area * { visibility: visible !important; } #fee-matrix-print-area { position: absolute; inset: 0 auto auto 0; width: 100%; page: fee-matrix-page; break-inside: auto; border: 0 !important; padding: 0 !important; } #fee-matrix-print-area thead { display: table-header-group; } #fee-matrix-print-area tr { break-inside: avoid; } #fee-matrix-print-area .overflow-x-auto { overflow: visible !important; } #fee-matrix-print-area table { min-width: 0 !important; width: 100% !important; font-size: 7pt !important; table-layout: fixed; } #fee-matrix-print-area th, #fee-matrix-print-area td { padding: 2px !important; overflow-wrap: anywhere; } .fee-matrix-component-view { break-before: page; } }`}</style>
  </div>;
}
