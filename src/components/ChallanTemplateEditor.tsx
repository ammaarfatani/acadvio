"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ChallanTemplate, challanTemplateSchema, defaultChallanTemplate } from "@/lib/challan-template";
import { ChallanDocumentPreview } from "./ChallanDocumentPreview";
import { printChallanDocument } from "@/lib/print-challan-document";
import { Download, Printer } from "lucide-react";
export default function ChallanTemplateEditor({ onBack }: { onBack: () => void }) {
  const [style, setStyle] = useState<ChallanTemplate>(defaultChallanTemplate);
  const [revision, setRevision] = useState<number | null>(null);
  const [preview, setPreview] = useState("");
  const [sample, setSample] = useState<any>(null);
  const previewRoot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { apiFetch("/school-documents/settings").then(r => { setStyle(r.data.challanTemplate); setRevision(r.data.revision); }).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (revision === null) return;
    let active = true, url = "";
    const timer = setTimeout(async () => {
      const parsed = challanTemplateSchema.safeParse(style);
      if (!parsed.success) { setError(parsed.error.issues[0].message); setPreview(""); return; }
      try {
        const r = await apiFetch("/school-documents/challan-preview", { method: "POST", body: JSON.stringify(parsed.data) });
        if (!active) return;
        url = URL.createObjectURL(new Blob([Uint8Array.from(atob(r.data.file), c => c.charCodeAt(0))], { type: "application/pdf" }));
        setPreview(url); setSample(r.data.challan); setError("");
      } catch (e: any) { if (active) { setError(e.message); setPreview(""); setSample(null); } }
    }, 500);
    return () => { active = false; clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [style, revision]);
  const change = (key: keyof ChallanTemplate, value: any) => { setStyle(v => ({ ...v, [key]: value })); setNotice(""); };
  async function save() {
    setBusy(true); setError("");
    try {
      const parsed = challanTemplateSchema.parse(style);
      const r = await apiFetch("/school-documents/settings", { method: "PUT", body: JSON.stringify({ revision, challanTemplate: parsed }) });
      setRevision(r.data.revision); setNotice("Default saved. New challans in both finance portals use this design. Issued challans retain their saved design.");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function printPreview() { try { await printChallanDocument(previewRoot.current); } catch (e: any) { setError(e.message); } }
  return <main className="space-y-5">
    <button onClick={onBack} className="text-sm underline">All document templates</button>
    <header><h1 className="text-2xl font-semibold">Fee challan templates</h1><p className="mt-2 text-sm text-zinc-600">One student, one A4 sheet, three copies. The in-page preview uses fictional student data and your school branding.</p></header>
    {error && <p role="alert" className="rounded border border-red-300 p-3 text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded border border-green-300 p-3">{notice}</p>}
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]"><fieldset disabled={busy || revision === null} className="space-y-4 rounded border bg-white p-4">
      <label className="grid gap-1 text-sm">Template<select className="border p-2" value={style.design} onChange={e => change("design", e.target.value)}><option value="classic">Classic School Challan</option><option value="modern">Modern School Challan</option><option value="minimal">Minimal Black & White</option></select></label>
      <label className="grid gap-1 text-sm">Brand color<input type="color" value={style.color} onChange={e => change("color", e.target.value)} /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={style.monochrome} onChange={e => change("monochrome", e.target.checked)} />Black & white / ink-saving preview and print</label>
      <label className="grid gap-1 text-sm">Paper<select className="border p-2" value={style.paper} onChange={e => change("paper", e.target.value)}>{["A4", "A5", "Letter", "Custom"].map(v => <option key={v}>{v}</option>)}</select></label>
      <p className="text-xs text-zinc-500">A5 cannot fit three readable copies. Use A4 portrait stacked or landscape columns; unsupported sizes show a validation message.</p>
      <label className="grid gap-1 text-sm">Orientation<select className="border p-2" value={style.orientation} onChange={e => change("orientation", e.target.value)}><option>portrait</option><option>landscape</option></select></label>
      <label className="grid gap-1 text-sm">Copy arrangement<select className="border p-2" value={style.arrangement} onChange={e => change("arrangement", e.target.value)}><option value="stacked">Stacked panels</option><option value="columns">Side-by-side columns</option></select></label>
      <button className="text-sm underline" type="button" onClick={() => setStyle(v => ({ ...v, paper: "A4", orientation: "portrait", arrangement: "stacked", margin: 5, fontSize: 7, spacing: 2 }))}>Use compatible A4 preset</button>
      {([["fontSize", "Font size (pt)", 7, 9], ["borderWidth", "Border width (pt)", 0.4, 1.5], ["spacing", "Row spacing (pt)", 2, 5], ["margin", "Margin (mm)", 5, 15], ["logoSize", "Logo size (mm)", 10, 18], ...(style.paper === "Custom" ? [["width", "Paper width (mm)", 148, 420], ["height", "Paper height (mm)", 210, 420]] : [])] as any[]).map(([key, label, min, max]) => <label key={key} className="grid gap-1 text-sm">{label}<input className="border p-2" type="number" step="0.1" min={min} max={max} value={(style as any)[key]} onChange={e => change(key, Number(e.target.value))} /></label>)}
      <label className="grid gap-1 text-sm">Logo position<select className="border p-2" value={style.logoPosition} onChange={e => change("logoPosition", e.target.value)}><option>left</option><option>right</option><option>hidden</option></select></label>
      {style.copyLabels.map((v, i) => <label className="grid gap-1 text-sm" key={i}>Copy {i + 1} label<input className="border p-2" maxLength={30} value={v} onChange={e => change("copyLabels", style.copyLabels.map((label, j) => i === j ? e.target.value : label))} /></label>)}
      {([["showStructure", "Fee structure name"], ["showCategory", "Class category"], ["showSignatures", "Signature area"], ["showStamp", "Stamp area"]] as const).map(([key, label]) => <label className="flex gap-2 text-sm" key={key}><input type="checkbox" checked={style[key]} onChange={e => change(key, e.target.checked)} />{label}</label>)}
      <button type="button" className="block text-sm underline" onClick={() => setStyle(defaultChallanTemplate())}>Restore defaults</button>
      <button type="button" disabled={!challanTemplateSchema.safeParse(style).success || !preview} onClick={() => void save()} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : "Save as school default"}</button>
    </fieldset><section className="min-w-0 space-y-3"><p className="text-sm">School logo and contact details come from School Settings. No bank details are invented.</p>{preview && sample && <><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void printPreview()} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><Printer size={16}/>Print Challan</button><a href={preview} download="challan-template-preview.pdf" className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><Download size={16}/>Download PDF</a></div><div ref={previewRoot} className="challan-print-root max-h-[75vh] overflow-auto rounded border bg-zinc-100 p-4"><ChallanDocumentPreview challans={[sample]} template={style}/></div></>}</section></div>
  </main>;
}
