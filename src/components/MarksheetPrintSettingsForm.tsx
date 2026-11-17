"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { defaultMarksheetPrintSettings, type MarksheetPrintSettings } from "@/lib/marksheet-print-settings";
import { MarksheetFormat, MarksheetPdfPreview } from "./MarksheetPrintOptions";
import MarksheetAlignmentEditor from "./MarksheetAlignmentEditor";
import PreprintedMarksheetPreview from "./PreprintedMarksheetPreview";

const endpoint = "/school-documents/marksheet-settings";
const input = "min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-100";
type ExamOption = { _id: string; title: string; term?: string; academicSessionId?: string; academicSessionName?: string };

export default function MarksheetPrintSettingsForm({ canEdit, onFormatChange }: { canEdit: boolean; onFormatChange?: (format: MarksheetPrintSettings["format"]) => void }) {
  const [settings, setSettings] = useState<MarksheetPrintSettings>();
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [canSave, setCanSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch(endpoint).then(({ data }) => {
      if (!active) return;
      setSettings(data.settings);
      onFormatChange?.(data.settings.format);
      setExams(data.exams);
      setCanSave(data.canSave);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [onFormatChange]);
  const patch = (values: Partial<MarksheetPrintSettings>) => {
    setSettings(previous => ({ ...(previous || defaultMarksheetPrintSettings), ...values }));
    if (values.format) onFormatChange?.(values.format);
    setMessage("");
  };
  const save = async () => {
    if (!settings) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await apiFetch(endpoint, { method: "PUT", body: JSON.stringify(settings) });
      setSettings(result.data);
      onFormatChange?.(result.data.format);
      setMessage("Settings saved for this branch.");
    } catch (failure: any) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const loadScan = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 500_000) {
      setError("Choose a PNG, JPG, or WebP flat scan under 500 KB."); return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ backgroundImage: String(reader.result) });
    reader.onerror = () => setError("Unable to read that stationery scan.");
    reader.readAsDataURL(file);
  };
  const nudge = (axis: "offsetX" | "offsetY", delta: number) => patch({ [axis]: Math.max(-20, Math.min(20, Math.round((settings![axis] + delta) * 10) / 10)) });

  if (!settings) return <p role={error ? "alert" : "status"}>{error || "Loading marksheet settings…"}</p>;
  return <section className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
    <MarksheetFormat value={settings.format} change={format => patch({ format })} />
    {settings.format === "preprinted" && <>
      <fieldset disabled={busy || !canEdit || !canSave} className="grid min-w-0 gap-5 xl:grid-cols-[minmax(270px,320px)_minmax(0,1fr)]">
        <div className="space-y-5 rounded-xl border border-zinc-200 bg-[#faf9f7] p-4 sm:p-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900">Paper settings</h3>
            <label className="grid gap-1.5 text-xs font-medium text-zinc-700">Paper size
              <select className={input} value={settings.customPaper ? "custom" : settings.paper} onChange={event => event.target.value === "custom" ? patch({ customPaper: true }) : patch({ paper: event.target.value as MarksheetPrintSettings["paper"], customPaper: false })}>
                <option>A4</option><option>Legal</option><option>Letter</option><option value="custom">Custom (Advanced)</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-zinc-700">Orientation
              <select className={input} value={settings.orientation} onChange={event => patch({ orientation: event.target.value as MarksheetPrintSettings["orientation"] })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-zinc-700">Optional stationery scan
              <input className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-200 file:px-2 file:py-1.5" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => loadScan(event.target.files?.[0])} />
            </label>
            {settings.backgroundImage && <button type="button" className="text-left text-xs font-medium text-red-700 underline" onClick={() => patch({ backgroundImage: undefined })}>Remove uploaded scan</button>}
            <p className="text-[11px] leading-relaxed text-zinc-500">Used only behind the preview to help position values. It is never sent to the printer.</p>
          </section>
          <section className="space-y-3 border-t border-zinc-200 pt-4">
            <h3 className="text-sm font-semibold text-zinc-900">Print mode</h3>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-white p-3 text-sm"><input className="mt-0.5 accent-red-700" type="radio" name="marksheet-print-mode" checked={settings.mode === "values"} onChange={() => patch({ mode: "values" })} /><span><b className="block">Values Only</b><span className="text-xs text-zinc-500">Print dynamic values into existing stationery boxes.</span></span></label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-white p-3 text-sm"><input className="mt-0.5 accent-red-700" type="radio" name="marksheet-print-mode" checked={settings.mode === "table"} onChange={() => patch({ mode: "table" })} /><span><b className="block">Complete Table With Borders</b><span className="text-xs text-zinc-500">Print student details, exam columns, table, and result summary.</span></span></label>
          </section>
          <section className="space-y-3 border-t border-zinc-200 pt-4">
            <h3 className="text-sm font-semibold text-zinc-900">Alignment</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-white p-3"><p className="mb-2 text-xs text-zinc-600">Left / right</p><div className="flex items-center justify-between"><button type="button" aria-label="Move content left" className="h-9 w-10 rounded border text-lg hover:bg-zinc-100" onClick={() => nudge("offsetX", -0.5)}>←</button><span className="text-xs tabular-nums">{settings.offsetX.toFixed(1)} mm</span><button type="button" aria-label="Move content right" className="h-9 w-10 rounded border text-lg hover:bg-zinc-100" onClick={() => nudge("offsetX", 0.5)}>→</button></div></div>
              <div className="rounded-md border bg-white p-3"><p className="mb-2 text-xs text-zinc-600">Up / down</p><div className="flex items-center justify-between"><button type="button" aria-label="Move content up" className="h-9 w-10 rounded border text-lg hover:bg-zinc-100" onClick={() => nudge("offsetY", -0.5)}>↑</button><span className="text-xs tabular-nums">{settings.offsetY.toFixed(1)} mm</span><button type="button" aria-label="Move content down" className="h-9 w-10 rounded border text-lg hover:bg-zinc-100" onClick={() => nudge("offsetY", 0.5)}>↓</button></div></div>
            </div>
          </section>
          <button type="button" className="w-full rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void save()}>{busy ? "Saving…" : "Save Settings"}</button>
          <MarksheetPdfPreview test paper={settings.paper} orientation={settings.orientation} customPaper={settings.customPaper} pageWidth={settings.pageWidth} pageHeight={settings.pageHeight} endpoint={endpoint + "/test-pdf"} payload={JSON.stringify(settings)} />
          {!canSave && <p className="text-xs text-amber-800">Select a branch to manage its marksheet settings.</p>}
        </div>
        <PreprintedMarksheetPreview settings={settings} exams={exams} />
      </fieldset>
      {canEdit && canSave && <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Advanced calibration (optional)</summary>
        <div className="space-y-5 border-t p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Default examination<select className={input} value={settings.exam} onChange={event => patch({ exam: event.target.value })}><option value="selected">Use the examination selected when printing</option><option value="annual">Annual result</option>{!["selected", "annual"].includes(settings.exam) && !exams.some(exam => exam._id === settings.exam) && <option value={settings.exam}>Previously saved examination (unavailable)</option>}{exams.map(exam => <option key={exam._id} value={exam._id}>{exam.title}</option>)}</select></label>
            {settings.customPaper && <><label className="grid gap-1 text-xs">Paper width (mm)<input className={input} type="number" min="100" max="500" step="0.5" value={settings.pageWidth} onChange={event => patch({ pageWidth: Number(event.target.value) })} /></label><label className="grid gap-1 text-xs">Paper height (mm)<input className={input} type="number" min="100" max="700" step="0.5" value={settings.pageHeight} onChange={event => patch({ pageHeight: Number(event.target.value) })} /></label></>}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">{([["studentDetails", "Student details"], ["marksTable", "Marks table"], ["resultSummary", "Result summary"], ["teacherComments", "Teacher comments"], ["signatures", "Signature spaces"]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={settings[key]} onChange={event => patch({ [key]: event.target.checked })} /> Include {label.toLowerCase()}</label>)}</div>
          <MarksheetAlignmentEditor settings={settings} onChange={patch} />
          <button type="button" className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void save()}>{busy ? "Saving…" : "Save Settings"}</button>
        </div>
      </details>}
    </>}
    {settings.format === "default" && <button type="button" disabled={busy || !canEdit || !canSave} className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void save()}>{busy ? "Saving…" : "Save Settings"}</button>}
    {message && <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
