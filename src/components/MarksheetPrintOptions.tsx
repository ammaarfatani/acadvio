"use client";

import { useEffect, useState } from "react";
import { privateFile } from "@/lib/api";
import { defaultMarksheetPrintSettings, getPageSize, type MarksheetPrintSettings } from "@/lib/marksheet-print-settings";

const button = "rounded border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50";
export const marksheetFormatNames = { default: "Acadivo Default Marksheet", preprinted: "Pre-Printed Marksheet" };
export function MarksheetFormat({ value, change }: {
  value: MarksheetPrintSettings["format"]; change: (value: MarksheetPrintSettings["format"]) => void;
}) {
  return <label className="grid max-w-md gap-2 text-sm font-semibold">Marksheet format
    <select className="rounded border bg-white p-2" value={value} onChange={e => change(e.target.value as typeof value)}>
      {Object.entries(marksheetFormatNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  </label>;
}

export function MarksheetPdfPreview({ endpoint, payload, paper = defaultMarksheetPrintSettings.paper, orientation = "portrait", customPaper = false, pageWidth = 210, pageHeight = 297, test = false, auto = false }: {
  endpoint: string; payload: string; paper?: MarksheetPrintSettings["paper"]; orientation?: "portrait" | "landscape"; customPaper?: boolean; pageWidth?: number; pageHeight?: number; test?: boolean; auto?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [readyPayload, setReadyPayload] = useState("");
  const [request, setRequest] = useState(auto ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = !!url && readyPayload === payload;
  useEffect(() => {
    if (!request) return;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const file = await privateFile(endpoint, { method: "POST", body: payload, signal: abort.signal });
        if (!abort.signal.aborted) {
          setUrl(URL.createObjectURL(file));
          setReadyPayload(payload);
        }
      } catch (error: any) {
        if (!abort.signal.aborted) setError(error.message || "Unable to prepare the marksheet.");
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, test ? 250 : 0);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [endpoint, payload, request, test]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const [width, height] = getPageSize({ paper, orientation, customPaper, pageWidth, pageHeight });
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={button} disabled={busy} onClick={() => setRequest(value => value + 1)}>Preview</button>
      {ready && <a className={button} href={url} target="_blank" rel="noreferrer">{test ? "Alignment Test Print" : "Actual Student Print"}</a>}
      {ready && !test && <a className={button} href={url} download="preprinted-marksheets.pdf">Download PDF</a>}
    </div>
    {busy && <p role="status" className="text-sm">Preparing preview…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <p className="text-xs text-zinc-600">Use the PDF viewer’s print controls. Select Actual Size (100%) and use the matching paper size.</p>
    {ready && <iframe className="w-full max-w-[650px] rounded border bg-white" style={{ aspectRatio: width + "/" + height }} title={test ? "Alignment test print preview" : "Pre-printed marksheet preview"} src={url} />}
  </div>;
}
