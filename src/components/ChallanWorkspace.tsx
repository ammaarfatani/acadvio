"use client";
import {RecordFilters,matchesRecordSearch} from "./RecordFilters";
import { challanPrintGroups } from "@/lib/fee-math";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { financeApi } from "@/lib/financeApi";
import { useAuth } from "@/lib/auth-context";
import { confirmAction } from "./ConfirmationHost";
import { StudentAvatar } from "./StudentAvatar";
import { PhotoRecordPicker } from "./PhotoRecordPicker";
import { BulkImportModal } from "./BulkImportModal";
import { FileSpreadsheet } from "lucide-react";
import { Printer, Download } from "lucide-react";
import { ChallanDocumentPreview } from "./ChallanDocumentPreview";
import { printChallanDocument } from "@/lib/print-challan-document";
export default function ChallanWorkspace() {
  const [pdfUrl, setPdfUrl] = useState("");
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { user } = useAuth();
  const [search,setSearch]=useState("");
  const [options, setOptions] = useState<any>({
      classes: [],
      sessions: [],
      sections: [],
    }),
    [form, setForm] = useState({
      classId: "",
      academicSessionId: "",
      sectionId: "",
      month: new Date()
        .toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
        .slice(0, 7),
    }),
    [rows, setRows] = useState<any[]>([]),
    [bills, setBills] = useState<any[]>([]),
    [checked, setChecked] = useState<string[]>([]),
    [student, setStudent] = useState(""),
    [documents, setDocuments] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const challanPreviewRoot = useRef<HTMLDivElement>(null);
  const visibleRows=rows.filter(s=>matchesRecordSearch([s.name,s.admissionNumber,s.studentId,s.rollNumber,s.className,s.sectionName],search));
  const canGenerate = user?.permissions?.includes("fees.update");
  useEffect(() => {
    let live = true;
    apiFetch("/finance/ledger-print/options")
      .then((r) => {
        if (live) {
          setOptions(r.data);
          setForm((f) => ({
            ...f,
            academicSessionId:
              r.data.sessions.find((s: any) => s.isCurrent)?._id || "",
          }));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [user?.branchId]);
  function change(k: string, v: string) {
    setForm({ ...form, [k]: v, ...(k === "classId" ? { sectionId: "" } : {}) });
    setRows([]);
    setBills([]);
    setChecked([]);
    setStudent("");
    setDocuments([]);
    setNotice("");
  }
  async function load() {
    setBusy(true);
    setError("");
    setDocuments([]);
    setPdfUrl("");
    try {
      let after = "",
        all: any[] = [],
        saved: any[] = [];
      do {
        const q = new URLSearchParams(
          Object.entries(form).filter(([, v]) => v),
        );
        if (after) q.set("after", after);
        const r = await apiFetch("/finance/challan-candidates?" + q);
        all.push(...r.data.students);
        saved.push(...r.data.challans);
        after = r.data.next || "";
        setProgress(`Loaded ${all.length} students…`);
      } while (after);
      setRows(all);
      setBills(saved);
      setDocuments([]);
      setChecked(all.map((s) => s._id));
      if (!all.length)
        setNotice("No eligible active students match these filters.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function generate(individual = false) {
    const ids = individual ? [student] : checked;
    if (busy || !ids.length) return;
    const existingSelected = selectedBills(ids);
    if (existingSelected.length === ids.length) {
      setNotice("Challans already exist for all selected students. Existing challans and payments were preserved.");
      return;
    }
    if (
      !(await confirmAction(
        `Generate missing challans for ${ids.length} selected student(s)? Existing invoices and payments will be preserved.`,
        { title: "Generate fee challans", confirmLabel: "Generate" },
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await financeApi.generateBulkChallans({
        ...form,
        sectionId: form.sectionId || undefined,
        studentIds: ids,
      });
      await load();
      setNotice(`${result.data?.message || "Challans saved."} Printing uses saved invoices and creates no payments.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  const selectedBills = (ids: string[]) =>
    ids
      .map((id) => bills.find((b) => String(b.studentId) === id))
      .filter(Boolean);
  async function prepare(individual = false) {
    setError("");
    const ids = individual ? [student] : checked;
    const chosen = selectedBills(ids);
    if (!ids.length || chosen.length !== ids.length) {
      setError(
        "Some selected students have no saved challan for this month/session. Generate missing challans before printing.",
      );
      return;
    }
    setBusy(true);
    setPdfUrl("");
    try {
      challanPrintGroups(chosen);
      const r = await financeApi.downloadBulkChallansPdf({ challanIds: chosen.map(c => c._id) });
      setPdfUrl(URL.createObjectURL(new Blob([Uint8Array.from(atob(r.data.file), c => c.charCodeAt(0))], { type: "application/pdf" })));
      setDocuments(chosen);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function print() {
    if (busy) return;
    setError("");
    try {
      await printChallanDocument(challanPreviewRoot.current);
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <main className="space-y-5">
      {bulkOpen && (
        <BulkImportModal
          entity="feeChallans"
          onClose={() => setBulkOpen(false)}
          onImported={() => {}}
        />
      )}
      <header className="border-l-4 border-red-600 bg-[#f2f0ed] px-5 py-6 sm:px-7 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-700">
          Finance  -  Fee collection
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Fee challans</h1>
        <div>
          <p className="mt-1 text-sm text-zinc-500">
            Individual and class printing · Three official copies per student
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          <FileSpreadsheet size={15} className="text-emerald-600" />
          Bulk Upload Challans
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">
          {notice}
        </p>
      )}
      <section className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
        <div className="border-b border-zinc-100 pb-4">
          <h2 className="font-semibold text-zinc-900">
            01  -  Choose the billing group
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Load a class and month to select students, generate challans or
            print saved invoices.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["academicSessionId", "Academic session", options.sessions],
            ["classId", "Class", options.classes],
            [
              "sectionId",
              "Section",
              options.sections.filter((s: any) => s.classId === form.classId),
            ],
          ].map(([k, label, list]: any) => (
            <label key={k} className="grid gap-1 text-xs font-semibold">
              {label}
              <select
                disabled={busy}
                value={(form as any)[k]}
                onChange={(e) => change(k, e.target.value)}
                className="min-h-11 min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
              >
                <option value="">
                  {k === "sectionId" ? "All sections" : "Choose " + label}
                </option>
                {list.map((r: any) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="grid gap-1 text-xs font-semibold">
            Fee month
            <input
              type="month"
              disabled={busy}
              value={form.month}
              onChange={(e) => change("month", e.target.value)}
              className="min-h-11 min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </label>
        </div>
        <button
          disabled={busy || !form.classId || !form.academicSessionId}
          onClick={() => void load()}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        >
          Load class students & saved challans
        </button>
        {progress && (
          <p role="status" className="text-sm">
            {progress}
          </p>
        )}
        {!!rows.length && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PhotoRecordPicker
                records={rows}
                value={student}
                onChange={setStudent}
              />
              <p className="self-center text-xs text-zinc-600 sm:col-span-2 xl:col-span-3">
                Due dates, discounts, concessions, and late fine rules are taken from each student’s assigned fee structure for the selected fee month.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {canGenerate && (
                <button
                  disabled={busy || !student}
                  onClick={() => void generate(true)}
                  className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                >
                  Generate individual challan
                </button>
              )}
              <button
                disabled={busy || !student}
                onClick={() => prepare(true)}
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              >
                Preview individual challan
              </button>
              <button
                disabled={busy}
                onClick={() => setChecked(v=>Array.from(new Set([...v,...visibleRows.map(s=>s._id)])))}
                className="text-sm underline"
              >
                Select visible
              </button>
              <button
                disabled={busy}
                onClick={() => setChecked([])}
                className="text-sm underline"
              >
                Clear selection
              </button>
            </div>
            <RecordFilters search={search} onSearch={setSearch} placeholder="Search student, admission or roll number" count={visibleRows.length} total={rows.length} onReset={()=>setSearch("")}/>
            <div className="max-h-80 overflow-auto rounded-lg border">
              {visibleRows.map((s) => (
                <label
                  key={s._id}
                  className="flex items-center gap-3 border-b p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={checked.includes(s._id)}
                    onChange={(e) =>
                      setChecked((v) =>
                        e.target.checked
                          ? [...v, s._id]
                          : v.filter((id) => id !== s._id),
                      )
                    }
                  />
                  <StudentAvatar student={s} />
                  <span className="flex-1">
                    {s.name}
                    <small className="block text-zinc-500">
                      {s.admissionNumber || s.studentId} · {s.className} /{" "}
                      {s.sectionName}
                    </small>
                  </span>
                  <span className="text-xs">
                    {bills.some((b) => String(b.studentId) === s._id)
                      ? "Saved challan"
                      : "Not generated"}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {canGenerate && (
                <button
                  disabled={busy || !checked.length}
                  onClick={() => void generate()}
                  className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Generate selected ({checked.length})
                </button>
              )}
              <button
                disabled={busy || !checked.length}
                onClick={() => prepare()}
                className="rounded-lg bg-school-primary px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Prepare bulk print ({checked.length} students)
              </button>
            </div>
          </>
        )}
      </section>
      {!!documents.length && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <strong>
              {documents.length} students · {documents.length * 3} copies
            </strong>
            <button disabled={busy} onClick={() => void print()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm"><Printer size={16}/>Print Challan</button>
          </div>
          {pdfUrl && <a className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm" href={pdfUrl} download="fee-challans.pdf"><Download size={16}/>Download PDF</a>}
          <div ref={challanPreviewRoot} className="challan-print-root max-h-[75vh] overflow-auto rounded border bg-zinc-100 p-4"><ChallanDocumentPreview challans={documents}/></div>

        </section>
      )}
    </main>
  );
}
