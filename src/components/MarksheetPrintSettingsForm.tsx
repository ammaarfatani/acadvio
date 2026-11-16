"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { defaultMarksheetPrintSettings, type MarksheetPrintSettings } from "@/lib/marksheet-print-settings";
import { MarksheetFormat, MarksheetPdfPreview } from "./MarksheetPrintOptions";
import MarksheetAlignmentEditor from "./MarksheetAlignmentEditor";

const input = "rounded border bg-white p-2";
const endpoint = "/school-documents/marksheet-settings";
const sections = {
  studentDetails: "Student details", marksTable: "Marks table", resultSummary: "Result summary",
  teacherComments: "Teacher comments", signatures: "Signature spaces",
} as const;

export default function MarksheetPrintSettingsForm({ canEdit, onFormatChange }: { canEdit: boolean; onFormatChange?: (format: MarksheetPrintSettings["format"]) => void }) {
  const [settings, setSettings] = useState<MarksheetPrintSettings>();
  const [exams, setExams] = useState<{ _id: string; title: string }[]>([]);
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
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch(endpoint, { method: "PUT", body: JSON.stringify(settings) });
      setSettings(res.data);
      onFormatChange?.(res.data.format);
      setMessage("Marksheet settings saved for this branch.");
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  };
  if (!settings) return <p role={error ? "alert" : "status"}>{error || "Loading marksheet settings…"}</p>;
  return <section className="space-y-5 rounded-lg border bg-white p-5">
    <fieldset disabled={busy || !canEdit || !canSave} className="space-y-4">
      <MarksheetFormat value={settings.format} change={format => patch({ format })} />
      {settings.format === "preprinted" && <>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-2 text-sm">Paper size<select className={input} value={settings.customPaper ? "custom" : settings.paper} onChange={e => e.target.value === "custom" ? patch({ customPaper: true }) : patch({ paper: e.target.value as MarksheetPrintSettings["paper"], customPaper: false })}>
            <option>A4</option><option>Legal</option><option>Letter</option><option value="custom">Custom dimensions</option>
          </select></label>
          <label className="grid gap-2 text-sm">Orientation<select className={input} value={settings.orientation} onChange={e => patch({ orientation: e.target.value as MarksheetPrintSettings["orientation"] })}>
            <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
          </select></label>
          <label className="grid gap-2 text-sm">Default examination<select className={input} value={settings.exam} onChange={e => patch({ exam: e.target.value })}>
            <option value="selected">Use the examination selected when printing</option><option value="annual">Annual result</option>
            {!["selected", "annual"].includes(settings.exam) && !exams.some(exam => exam._id === settings.exam) && <option value={settings.exam}>Previously saved examination (unavailable)</option>}
            {exams.map(exam => <option value={exam._id} key={exam._id}>{exam.title}</option>)}
          </select></label>
        </div>
        {settings.customPaper && <div className="grid max-w-md grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs">Paper width (mm)<input className={input} type="number" min="100" max="500" step="0.5" value={settings.pageWidth} onChange={e => patch({ pageWidth: Number(e.target.value), customPaper: true })} /></label>
          <label className="grid gap-1 text-xs">Paper height (mm)<input className={input} type="number" min="100" max="700" step="0.5" value={settings.pageHeight} onChange={e => patch({ pageHeight: Number(e.target.value), customPaper: true })} /></label>
        </div>}
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(sections).map(([key, label]) => <label key={key} className="flex items-center gap-2">
            <input type="checkbox" checked={settings[key as keyof typeof sections]} onChange={e => patch({ [key]: e.target.checked })} /> Include {label.toLowerCase()}
          </label>)}
        </div>
        <MarksheetAlignmentEditor settings={settings} onChange={patch} />
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">This mode prints dynamic values only. Initial coordinates are general starting points, not measurements from a perspective photograph. Upload a flat scan, calibrate fields, and run an alignment test before printing real student records. The scan never appears in the output PDF.</p>
      </>}
      <button type="button" className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void save()}>{busy ? "Saving…" : "Save Settings"}</button>
    </fieldset>
    {!canSave && <p className="text-sm">Select a branch to manage its marksheet settings.</p>}
    {message && <p role="status" className="text-sm text-green-800">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {settings.format === "preprinted" && <MarksheetPdfPreview test paper={settings.paper} orientation={settings.orientation} customPaper={settings.customPaper} pageWidth={settings.pageWidth} pageHeight={settings.pageHeight} endpoint={endpoint + "/test-pdf"} payload={JSON.stringify(settings)} />}
  </section>;
}
