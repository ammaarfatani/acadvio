"use client";
import { TableScroll } from "@/components/TableScroll";
import { useEffect, useRef, useState } from "react";
import { Download, Upload, FileSpreadsheet, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { ImportEntity, ImportPreview, IMPORT_COLUMNS } from "@/lib/bulk-import";
import { UNIVERSAL_ENTITIES } from "@/lib/universal-import-config";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

function saveFile(data: { base64: string; filename: string; mime: string }) {
  const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: data.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

export function BulkImportModal({
  entity,
  onClose,
  onImported,
}: {
  entity: ImportEntity;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const storageKey = `acadivo-import:${user?.id || ""}:${user?.school?._id || ""}:${entity}`;
  const callback = useRef(onImported);
  callback.current = onImported;

  const def = UNIVERSAL_ENTITIES[entity];
  const isMaster = entity === "master";

  const title = isMaster ? "Complete School" : def?.title || entity;
  const plural = isMaster ? "All School Data" : def?.label || entity;

  const [job, setJob] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [sheetFilter, setSheetFilter] = useState("ALL");

  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const mounted = useRef(true);
  const page = useRef(1);
  const notified = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  const processing = job?.status === "PROCESSING";
  const jobId = job?.id;

  useEffect(() => {
    mounted.current = true;
    previousFocus.current = document.activeElement as HTMLElement;
    dialog.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      mounted.current = false;
      document.body.style.overflow = old;
      previousFocus.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!job) return;
    if (["COMPLETED", "FAILED"].includes(job.status) && !notified.current) {
      notified.current = true;
      void callback.current();
    }
  }, [job]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {}
    if (saved) {
      void schoolAdminApi
        .getBulkImport(entity, saved)
        .then(result => {
          if (active && !locked.current) setJob(result.data);
        })
        .catch(() => {
          try {
            sessionStorage.removeItem(storageKey);
          } catch {}
        });
    }
    return () => {
      active = false;
    };
  }, [entity, storageKey, user?.id]);

  useEffect(() => {
    if (!job || !user?.id) return;
    try {
      if (job.status === "PREVIEW" || job.status === "PROCESSING") {
        sessionStorage.setItem(storageKey, job.id);
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {}
  }, [job, storageKey, user?.id]);

  useEffect(() => {
    if (!processing || !jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await schoolAdminApi.getBulkImport(entity, jobId, page.current);
        if (active) {
          setJob(result.data);
          setError("");
        }
      } catch (e: any) {
        if (active) {
          setError(`${e.message} Import may still be in progress. Keep this window open to resume status.`);
        }
      } finally {
        if (active) {
          timer = setTimeout(poll, 4000);
        }
      }
    };
    timer = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [processing, jobId, entity]);

  async function action(fn: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      if (mounted.current) {
        setError(e.message || "Unable to complete this action.");
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function upload(file?: File) {
    if (!file || processing) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name) || file.size > 25 * 1024 * 1024 || !file.size) {
      setError("Choose a non-empty XLSX, XLS or CSV file under 25 MB.");
      return;
    }
    await action(async () => {
      const encoded = await readFile(file);
      const result = await schoolAdminApi.previewBulkImport(entity, { filename: file.name, base64: encoded });
      if (mounted.current) {
        setJob(result.data);
        setConfirm(false);
        setFilter("ALL");
        setSheetFilter("ALL");
        page.current = 1;
        notified.current = false;
      }
    });
  }

  async function changePage(n: number) {
    if (!job) return;
    await action(async () => {
      const result = await schoolAdminApi.getBulkImport(entity, job.id, n);
      page.current = n;
      setJob(result.data);
    });
  }

  const columns = (def?.columns || IMPORT_COLUMNS[entity] || []).filter(c => c.key !== "password" && c.key !== "initialPassword");
  const shown =
    job?.rows.filter(
      r => (filter === "ALL" || r.status === filter) && (sheetFilter === "ALL" || r.sheet === sheetFilter)
    ) || [];
  const finished = job && ["COMPLETED", "FAILED"].includes(job.status);

  // Unique sheets detected in job
  const detectedSheets = job?.sheets ? Object.keys(job.sheets) : [];

  function close() {
    if (busy || processing) return;
    onClose();
  }

  function keys(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/45 p-2 sm:p-6">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
        tabIndex={-1}
        onKeyDown={keys}
        className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-school-primary">
              <FileSpreadsheet size={16} />
              {isMaster ? "Universal School Migration Center" : "Module Data Import"}
            </div>
            <h2 id="bulk-import-title" className="text-xl font-bold">
              Bulk Upload {plural}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {isMaster
                ? "Migrate your complete existing operational and historical school data using a single Master Excel workbook."
                : def?.description || `Import your existing ${plural.toLowerCase()} data instead of creating records one by one.`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close bulk upload"
            disabled={busy || processing}
            onClick={close}
            className="rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </header>

        <div className="space-y-5 overflow-y-auto p-5">
          <ol className="grid grid-cols-3 gap-2 text-xs font-semibold">
            <li className="rounded-lg bg-zinc-100 p-3">1. Download & fill template</li>
            <li className={`rounded-lg p-3 ${job ? "bg-red-50 text-red-700" : "bg-zinc-100"}`}>2. Upload & preview</li>
            <li className={`rounded-lg p-3 ${confirm || processing || finished ? "bg-red-50 text-red-700" : "bg-zinc-100"}`}>
              3. Confirm & import
            </li>
          </ol>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </p>
          )}

          {!processing && !finished && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    {isMaster ? "Download Acadivo Master Excel Migration Template" : `Download ${title} Excel Template`}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {isMaster
                      ? "Contains 38 comprehensive worksheets with formatting instructions, validation rules, and sample entries."
                      : "Includes all supported schema columns, human-readable labels, and instructions."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() => action(async () => saveFile((await schoolAdminApi.getBulkTemplate(entity)).data))}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50"
                  >
                    <Download size={15} />
                    Download Blank Template
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        if (isMaster) {
                          saveFile((await schoolAdminApi.getMasterSample()).data);
                        } else {
                          saveFile((await schoolAdminApi.getModuleTemplate(entity, "example")).data);
                        }
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Download size={15} />
                    Download Example File
                  </button>
                </div>
              </div>

              <div
                onDragOver={e => {
                  e.preventDefault();
                  if (!busy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragging(false);
                  if (!busy) void upload(e.dataTransfer.files[0]);
                }}
                className={`rounded-xl border-2 border-dashed p-6 text-center ${
                  dragging ? "border-school-primary bg-red-50" : "border-zinc-300 bg-white"
                }`}
              >
                <Upload size={26} className="mx-auto mb-2 text-zinc-400" />
                <p className="text-sm font-semibold">{job ? "Replace spreadsheet file" : "Drop your filled Excel spreadsheet here"}</p>
                <p className="my-2 text-xs text-zinc-500">
                  XLSX, XLS or CSV · Up to 25 MB · Topological dependency resolution · No records are committed during preview.
                </p>
                <button
                  disabled={busy}
                  onClick={() => input.current?.click()}
                  className="rounded-xl bg-school-primary px-4 py-2 text-sm font-semibold text-white hover:bg-school-primary/90 disabled:opacity-50"
                >
                  Choose File
                </button>
                <input
                  ref={input}
                  type="file"
                  aria-label="Choose import spreadsheet"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  disabled={busy}
                  onChange={e => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {busy && (
                  <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-700">
                    <Loader2 size={16} className="animate-spin text-school-primary" />
                    Validating your spreadsheet structure and relational dependencies…
                  </p>
                )}
              </div>
            </>
          )}

          {job && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                  {finished
                    ? job.status === "FAILED"
                      ? "Import Interrupted"
                      : "Import Completed Successfully"
                    : processing
                    ? "Import Processing in Progress"
                    : `${job.summary.total} Records Found Across Spreadsheet`}
                </h3>
                <span className="max-w-full truncate rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                  {job.filename}
                </span>
              </div>

              {/* Overall Summary Stats */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["Total rows", job.summary.total],
                  ["Valid", job.summary.valid],
                  ["Invalid", job.summary.invalid],
                  ["Duplicates", job.summary.duplicate],
                  [finished ? "Imported" : "Ready to import", finished ? job.summary.imported : job.summary.ready],
                ].map(([lbl, n]) => (
                  <div key={lbl} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="text-xs text-zinc-500">{lbl}</p>
                    <p className="mt-1 text-xl font-bold">{n}</p>
                  </div>
                ))}
              </div>

              {/* Sheet-by-sheet breakdowns for Master Imports */}
              {detectedSheets.length > 1 && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Worksheet Coverage Breakdown ({detectedSheets.length} Sheets Detected)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detectedSheets.map(sName => {
                      const sStat = Array.isArray(job.sheets) ? job.sheets.find((s: any) => s.sheet === sName) : (job.sheets as any)?.[sName] || (job.summary?.sheets as any)?.[sName];
                      return (
                        <div key={sName} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs">
                          <span className="font-semibold">{sName}:</span>
                          <span className="text-emerald-700">{sStat?.valid || sStat?.imported || 0} valid</span>
                          {(sStat?.invalid || 0) > 0 && <span className="text-red-700">· {sStat?.invalid} invalid</span>}
                          {(sStat?.duplicate || 0) > 0 && <span className="text-amber-700">· {sStat?.duplicate} dup</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {processing && (
                <div role="status" className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="mb-2 text-sm font-semibold">
                    {job.processed} of {job.summary.total} rows committed
                  </p>
                  <progress value={job.processed} max={job.summary.total} className="h-2 w-full accent-school-primary" />
                  <p className="mt-2 text-xs text-zinc-600">
                    Records are committed in topological dependency order. Refreshing or reopening will resume seamlessly.
                  </p>
                </div>
              )}

              {finished && (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <CheckCircle2 size={22} className="shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-semibold">{job.summary.imported} records successfully migrated into Acadivo.</p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {job.summary.invalid + job.summary.failed} rows failed validation. {job.summary.duplicate} duplicate records skipped safely.
                    </p>
                    {job.message && <p className="mt-2 text-sm text-red-700">{job.message}</p>}
                  </div>
                </div>
              )}

              {/* Filtering Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-semibold">
                    Status:
                    <select
                      aria-label="Filter status"
                      value={filter}
                      onChange={e => setFilter(e.target.value)}
                      className="ml-1.5 rounded-lg border border-zinc-200 bg-white p-1.5 text-xs"
                    >
                      <option value="ALL">All statuses</option>
                      {["VALID", "INVALID", "DUPLICATE", "IMPORTED", "FAILED"].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>

                  {detectedSheets.length > 1 && (
                    <label className="text-xs font-semibold">
                      Worksheet:
                      <select
                        aria-label="Filter sheet"
                        value={sheetFilter}
                        onChange={e => setSheetFilter(e.target.value)}
                        className="ml-1.5 rounded-lg border border-zinc-200 bg-white p-1.5 text-xs"
                      >
                        <option value="ALL">All Worksheets</option>
                        {detectedSheets.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <button
                  disabled={busy || processing}
                  onClick={() => action(async () => saveFile((await schoolAdminApi.getBulkImportErrors(entity, job.id)).data))}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-40"
                >
                  <Download size={14} />
                  Download Error Report
                </button>
              </div>

              {/* Preview Table */}
              <div className="max-h-80 overflow-auto rounded-xl border border-zinc-200">
                <TableScroll>
                  <table className="w-full min-w-[1000px] text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-zinc-100">
                      <tr>
                        {["Sheet", "Row", "Status", "Validation Issues", ...columns.slice(0, 8).map(c => c.label)].map(h => (
                          <th key={h} className="whitespace-nowrap p-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map(r => (
                        <tr key={`${r.sheet}-${r.rowNumber}`} className="border-t border-zinc-100">
                          <td className="p-3 font-semibold text-zinc-600">{r.sheet || entity}</td>
                          <td className="p-3 font-mono">{r.rowNumber}</td>
                          <td className="p-3 font-semibold">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                r.status === "VALID" || r.status === "IMPORTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : r.status === "DUPLICATE"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="min-w-64 p-3 text-red-700">{r.issues?.join(" · ") || r.message || "Ready"}</td>
                          {columns.slice(0, 8).map(c => (
                            <td key={c.key} className="min-w-24 max-w-56 break-words p-3 text-zinc-700">
                              {r.values?.[c.key] || (r.data as any)?.[c.key] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
                {!shown.length && <p className="p-5 text-sm text-zinc-500">No matching records on this page.</p>}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <button
                  disabled={job.page <= 1 || busy}
                  onClick={() => changePage(job.page - 1)}
                  className="rounded-lg border p-2 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous 50
                </button>
                <span>
                  Page {job.page} of {job.pages}
                </span>
                <button
                  disabled={job.page >= job.pages || busy}
                  onClick={() => changePage(job.page + 1)}
                  className="rounded-lg border p-2 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next 50
                </button>
              </div>

              {job.status === "PREVIEW" && (
                <>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={skip}
                      onChange={e => {
                        setSkip(e.target.checked);
                        setConfirm(false);
                      }}
                      className="rounded border-zinc-300 accent-school-primary"
                    />
                    Skip Duplicate Records (Existing records in Acadivo are never modified or overwritten)
                  </label>
                  {confirm && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <h3 className="font-semibold text-red-900">Ready to Commit Migration</h3>
                      <p className="mt-1 text-sm text-red-700">
                        {job.summary.ready} verified records will be created in your school. Please confirm below to proceed.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-zinc-200 bg-zinc-50 p-4">
          <button
            disabled={busy || processing}
            onClick={close}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-40"
          >
            {finished ? "Close" : "Cancel"}
          </button>
          {job?.status === "PREVIEW" && (
            <button
              disabled={busy || !job.summary.ready || (job.summary.duplicate > 0 && !skip)}
              onClick={() => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                void action(async () => {
                  const result = await schoolAdminApi.commitBulkImport(entity, job.id, skip);
                  setJob(result.data);
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-school-primary/90 disabled:opacity-40"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {confirm ? `Import ${job.summary.ready} Verified Records` : "Review & Proceed"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
