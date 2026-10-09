"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { ImportEntity, ImportPreview, IMPORT_COLUMNS } from "@/lib/bulk-import";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
function saveFile(data: {
    base64: string;
    filename: string;
    mime: string;
}) { const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: data.mime })); const link = document.createElement("a"); link.href = url; link.download = data.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function readFile(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error("Could not read this file.")); reader.readAsDataURL(file); }); }
export function BulkImportModal({ entity, onClose, onImported }: {
    entity: ImportEntity;
    onClose: () => void;
    onImported: () => void | Promise<void>;
}) {
    const { user } = useAuth();
    const storageKey = `acadivo-import:${user?.id || ""}:${user?.school?._id || ""}:${entity}`;
    const callback = useRef(onImported);
    callback.current = onImported;
    const [job, setJob] = useState<ImportPreview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [skip, setSkip] = useState(true), [confirm, setConfirm] = useState(false), [dragging, setDragging] = useState(false), [filter, setFilter] = useState("ALL");
    const input = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDivElement>(null), locked = useRef(false), mounted = useRef(true), page = useRef(1), notified = useRef(false), previousFocus = useRef<HTMLElement | null>(null);
    const title = entity === "students" ? "Student" : "Teacher", plural = entity === "students" ? "Students" : "Teachers", processing = job?.status === "PROCESSING", jobId = job?.id;
    useEffect(() => { mounted.current = true; previousFocus.current = document.activeElement as HTMLElement; dialog.current?.focus(); const old = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { mounted.current = false; document.body.style.overflow = old; previousFocus.current?.focus(); }; }, []);
    useEffect(() => { if (!job)
        return; if (["COMPLETED", "FAILED"].includes(job.status) && !notified.current) {
        notified.current = true;
        void callback.current();
    } }, [job]);
    useEffect(() => { if (!user?.id)
        return; let active = true; let saved: string | null = null; try {
        saved = sessionStorage.getItem(storageKey);
    }
    catch { } if (saved)
        void schoolAdminApi.getBulkImport(entity, saved).then(result => { if (active && !locked.current)
            setJob(result.data); }).catch(() => { try {
            sessionStorage.removeItem(storageKey);
        }
        catch { } }); return () => { active = false; }; }, [entity, storageKey, user?.id]);
    useEffect(() => { if (!job || !user?.id)
        return; try {
        if (job.status === "PREVIEW" || job.status === "PROCESSING")
            sessionStorage.setItem(storageKey, job.id);
        else
            sessionStorage.removeItem(storageKey);
    }
    catch { } }, [job, storageKey, user?.id]);
    useEffect(() => {
        if (!processing || !jobId)
            return;
        let active = true;
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => { try {
            const result = await schoolAdminApi.getBulkImport(entity, jobId, page.current);
            if (active) {
                setJob(result.data);
                setError("");
            }
        }
        catch (e: any) {
            if (active)
                setError(`${e.message} Your import may still be running. Keep this window open to retry status.`);
        }
        finally {
            if (active)
                timer = setTimeout(poll, 5000);
        } };
        timer = setTimeout(poll, 1000);
        return () => { active = false; clearTimeout(timer); };
    }, [processing, jobId, entity]);
    async function action(fn: () => Promise<void>) { if (locked.current)
        return; locked.current = true; setBusy(true); setError(""); try {
        await fn();
    }
    catch (e: any) {
        if (mounted.current)
            setError(e.message || "Unable to complete this action.");
    }
    finally {
        locked.current = false;
        if (mounted.current)
            setBusy(false);
    } }
    async function upload(file?: File) {
        if (!file || processing)
            return;
        if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size > 5 * 1024 * 1024 || !file.size) {
            setError("Choose a non-empty XLSX, XLS or CSV file under 5 MB.");
            return;
        }
        await action(async () => { const encoded = await readFile(file); const result = await schoolAdminApi.previewBulkImport(entity, { filename: file.name, base64: encoded }); if (mounted.current) {
            setJob(result.data);
            setConfirm(false);
            setFilter("ALL");
            page.current = 1;
            notified.current = false;
        } });
    }
    async function changePage(n: number) { if (!job)
        return; await action(async () => { const result = await schoolAdminApi.getBulkImport(entity, job.id, n); page.current = n; setJob(result.data); }); }
    const columns = IMPORT_COLUMNS[entity].filter(c => c.key !== "password"), shown = job?.rows.filter(r => filter === "ALL" || r.status === filter) || [], finished = job && ["COMPLETED", "FAILED"].includes(job.status);
    function close() { if (busy || processing)
        return; onClose(); }
    function keys(event: React.KeyboardEvent) { if (event.key === "Escape") {
        event.preventDefault();
        close();
    } if (event.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]');
        if (!items?.length)
            return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    } }
    return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/45 p-2 sm:p-6">
  <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="bulk-import-title" tabIndex={-1} onKeyDown={keys} className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-xl outline-none">
   <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5"><div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-school-primary"><FileSpreadsheet size={16}/>School data import</div><h2 id="bulk-import-title" className="text-xl font-bold">Bulk Upload {plural}</h2><p className="mt-1 text-sm text-zinc-500">{entity === "students" ? "Have many students to add? Upload them all at once using an Excel file." : "Import your existing teaching staff instead of adding them one by one."}</p></div><button type="button" aria-label="Close bulk upload" disabled={busy || processing} onClick={close} className="rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-30"><X size={20}/></button></header>
   <div className="space-y-5 overflow-y-auto p-5">
    <ol className="grid grid-cols-3 gap-2 text-xs font-semibold"><li className="rounded-lg bg-zinc-100 p-3">1. Download & fill</li><li className={`rounded-lg p-3 ${job ? "bg-red-50 text-red-700" : "bg-zinc-100"}`}>2. Upload & preview</li><li className={`rounded-lg p-3 ${confirm || processing || finished ? "bg-red-50 text-red-700" : "bg-zinc-100"}`}>3. Confirm & import</li></ol>
    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={18} className="shrink-0"/>{error}</p>}
    {!processing && !finished && <><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"><div><h3 className="text-sm font-semibold">Start with your school’s template</h3><p className="mt-1 text-xs text-zinc-500">Includes supported fields, a separate example, instructions and your school’s reference records.</p></div><button disabled={busy} onClick={() => action(async () => saveFile((await schoolAdminApi.getBulkTemplate(entity)).data))} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Download size={16}/>Download {title} Excel Template</button></div>
    <div onDragOver={e => { e.preventDefault(); if (!busy)
            setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy)
            void upload(e.dataTransfer.files[0]); }} className={`rounded-xl border-2 border-dashed p-6 text-center ${dragging ? "border-school-primary bg-red-50" : "border-zinc-300 bg-white"}`}><Upload size={25} className="mx-auto mb-2 text-zinc-400"/><p className="text-sm font-semibold">{job ? "Replace the file after fixing errors" : "Drop your filled spreadsheet here"}</p><p className="my-2 text-xs text-zinc-500">XLSX, XLS or CSV · 5 MB maximum · 5,000 rows · No records are saved during preview.</p><button disabled={busy} onClick={() => input.current?.click()} className="rounded-xl bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Choose File</button><input ref={input} type="file" aria-label="Choose import spreadsheet" accept=".xlsx,.xls,.csv" className="sr-only" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }}/>{busy && <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin"/>Validating your file on the server…</p>}</div>
    <p className="text-xs text-zinc-500">Fill only the {plural} data sheet; the example and reference sheets are not imported. {entity === "students" ? "Academic session, class and section must belong to this school. Blank identifiers and roll numbers are generated safely." : "Teachers need a unique login email and initial password (8+ characters). Passwords are hidden from previews and reports. Optional teaching assignments must use existing paired class, section and subject records."}</p></>}
    {job && <><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{finished ? (job.status === "FAILED" ? "Import Stopped" : "Import Completed") : processing ? "Import in progress" : `${job.summary.total} ${plural} Found`}</h3><span className="max-w-full truncate text-xs text-zinc-500">{job.filename}</span></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Total rows", job.summary.total], ["Valid", job.summary.valid], ["Invalid", job.summary.invalid], ["Duplicates", job.summary.duplicate], [finished ? "Imported" : "Ready to import", finished ? job.summary.imported : job.summary.ready]].map(([label, n]) => <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold">{n}</p></div>)}</div>
    {processing && <div role="status" className="rounded-xl border border-red-100 bg-red-50 p-4"><p className="mb-2 text-sm font-semibold">{job.processed} of {job.summary.total} rows processed</p><progress value={job.processed} max={job.summary.total} className="h-2 w-full accent-red-600"/><p className="mt-2 text-xs text-zinc-600">Imports are saved in transactions and batches. Reopen Bulk Upload to resume progress after refreshing this page.</p></div>}
    {finished && <div role="status" className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4"><CheckCircle2 size={22} className="shrink-0 text-emerald-600"/><div><p className="font-semibold">{job.summary.imported} {entity} successfully imported.</p><p className="mt-1 text-sm text-zinc-600">{job.summary.invalid + job.summary.failed} rows failed validation/import. {job.summary.duplicate} duplicate records skipped.</p>{job.message && <p className="mt-2 text-sm text-red-700">{job.message}</p>}</div></div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-xs font-semibold">Show rows <select aria-label="Filter import preview" value={filter} onChange={e => setFilter(e.target.value)} className="ml-2 rounded-lg border border-zinc-200 bg-white p-2"><option value="ALL">All statuses</option>{["VALID", "INVALID", "DUPLICATE", "IMPORTED", "FAILED"].map(s => <option key={s}>{s}</option>)}</select></label><button disabled={busy || processing} onClick={() => action(async () => saveFile((await schoolAdminApi.getBulkImportErrors(entity, job.id)).data))} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold disabled:opacity-40"><Download size={14}/>Download Error Report</button></div>
    <div className="max-h-80 overflow-auto rounded-xl border border-zinc-200"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 z-10 bg-zinc-100"><tr>{["Excel row", "Status", "Issues", ...columns.map(c => c.label)].map(h => <th key={h} className="whitespace-nowrap p-3 font-semibold">{h}</th>)}</tr></thead><tbody>{shown.map(r => <tr key={r.rowNumber} className="border-t border-zinc-100"><td className="p-3 font-mono">{r.rowNumber}</td><td className="p-3 font-semibold">{r.status}</td><td className="min-w-72 p-3 text-red-700">{r.issues.join(" · ") || "Ready"}</td>{columns.map(c => <td key={c.key} className="min-w-28 max-w-64 break-words p-3">{r.values[c.key] || "—"}</td>)}</tr>)}</tbody></table>{!shown.length && <p className="p-5 text-sm text-zinc-500">No matching rows on this page.</p>}</div>
    <div className="flex items-center justify-between text-xs text-zinc-500"><button disabled={job.page <= 1 || busy} onClick={() => changePage(job.page - 1)} className="rounded-lg border p-2 disabled:opacity-40">Previous 50</button><span>Page {job.page} of {job.pages} · Filter applies to this page</span><button disabled={job.page >= job.pages || busy} onClick={() => changePage(job.page + 1)} className="rounded-lg border p-2 disabled:opacity-40">Next 50</button></div>
    {job.status === "PREVIEW" && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skip} onChange={e => { setSkip(e.target.checked); setConfirm(false); }}/>Skip Duplicate Records</label><p className="text-xs text-zinc-500">Invalid rows will not be inserted. Existing records are never overwritten. The backend rechecks references, duplicates and plan capacity when importing.</p>{confirm && <div className="rounded-xl border border-red-200 bg-red-50 p-4"><h3 className="font-semibold">Ready to Import</h3><p className="mt-1 text-sm">{job.summary.ready} {entity} are ready to be added to your school. Confirm below to save these records.</p></div>}</>}
    </>}
   </div>
   <footer className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 bg-zinc-50 p-4"><button disabled={busy || processing} onClick={close} className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40">{finished ? "Done" : "Cancel"}</button>{job?.status === "PREVIEW" && <button disabled={busy || !job.summary.ready || (job.summary.duplicate > 0 && !skip)} onClick={() => { if (!confirm) {
        setConfirm(true);
        return;
    } void action(async () => { const result = await schoolAdminApi.commitBulkImport(entity, job.id, skip); setJob(result.data); }); }} className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin"/>}{confirm ? `Import ${job.summary.ready} ${plural}` : "Review Import"}</button>}</footer>
  </div>
 </div>;
}
