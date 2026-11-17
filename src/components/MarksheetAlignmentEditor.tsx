"use client";

import { useMemo, useRef, useState } from "react";
import { alignmentFields, defaultAlignmentFields, getPageSize, type AlignmentField, type AlignmentFieldSettings, type MarksheetPrintSettings } from "@/lib/marksheet-print-settings";

const labels: Record<AlignmentField, string> = {
  studentName: "Student name", fatherName: "Father's name", className: "Class", sectionName: "Section", grNumber: "G.R. number",
  examinationName: "Examination name", academicSession: "Academic session", serialNumber: "Serial number", subjectName: "Subject",
  examTitle0: "Exam column 1 heading", exam0Max: "Exam 1 maximum", exam0Obtained: "Exam 1 obtained",
  examTitle1: "Exam column 2 heading", exam1Max: "Exam 2 maximum", exam1Obtained: "Exam 2 obtained",
  examTitle2: "Exam column 3 heading", exam2Max: "Exam 3 maximum", exam2Obtained: "Exam 3 obtained",
  examTitle3: "Exam column 4 heading", exam3Max: "Exam 4 maximum", exam3Obtained: "Exam 4 obtained",
  grandMax: "Grand total maximum", grandObtained: "Grand total obtained", status: "Subject status", totalMarks: "Total marks",
  percentage: "Percentage", grade: "Grade", rank: "Rank", attendance: "Attendance", teacherComments: "Teacher comments",
  classTeacherSignature: "Teacher signature", principalSignature: "Principal signature", stamp: "School stamp",
};
const rowFields = new Set<AlignmentField>(["serialNumber", "subjectName", "exam0Max", "exam0Obtained", "exam1Max", "exam1Obtained", "exam2Max", "exam2Obtained", "exam3Max", "exam3Obtained", "grandMax", "grandObtained", "status"]);

type Props = { settings: MarksheetPrintSettings; onChange: (next: Partial<MarksheetPrintSettings>) => void };
export default function MarksheetAlignmentEditor({ settings, onChange }: Props) {
  const [selected, setSelected] = useState<AlignmentField>("studentName");
  const [zoom, setZoom] = useState(0.72);
  const [templateName, setTemplateName] = useState("");
  const page = useRef<HTMLDivElement>(null);
  const drag = useRef<{ field: AlignmentField; pointerId: number } | null>(null);
  const [pageWidth, pageHeight] = getPageSize(settings);
  const scale = 3.4 * zoom;
  const fieldConfig = settings.fields[selected] || defaultAlignmentFields[selected];
  const fields = useMemo(() => settings.fields || defaultAlignmentFields, [settings.fields]);

  const updateField = (field: AlignmentField, patch: Partial<AlignmentFieldSettings>) => {
    onChange({ fields: { ...fields, [field]: { ...defaultAlignmentFields[field], ...fields[field], ...patch } } as MarksheetPrintSettings["fields"] });
  };
  const moveToPointer = (event: React.PointerEvent) => {
    if (!drag.current || !page.current) return;
    const rect = page.current.getBoundingClientRect();
    const current = fields[drag.current.field] || defaultAlignmentFields[drag.current.field];
    const x = Math.max(0, Math.min(pageWidth - current.width, (event.clientX - rect.left) / rect.width * pageWidth));
    const pointerY = (event.clientY - rect.top) / rect.height * pageHeight;
    const y = Math.max(0, Math.min(pageHeight - current.height,
      rowFields.has(drag.current.field) ? pointerY - settings.rowStartY : pointerY));
    updateField(drag.current.field, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };
  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const template = { id, name, fields, rowStartY: settings.rowStartY, rowHeight: settings.rowHeight,
      calibrationX: settings.offsetX, calibrationY: settings.offsetY, paper: settings.paper,
      orientation: settings.orientation, customPaper: settings.customPaper, pageWidth: settings.pageWidth, pageHeight: settings.pageHeight };
    onChange({ templates: [...settings.templates, template], activeTemplateId: id });
    setTemplateName("");
  };
  const selectTemplate = (id: string) => {
    const template = settings.templates.find(item => item.id === id);
    if (!template) { onChange({ activeTemplateId: null }); return; }
    onChange({ fields: template.fields, rowStartY: template.rowStartY, rowHeight: template.rowHeight,
      offsetX: template.calibrationX, offsetY: template.calibrationY, paper: template.paper,
      orientation: template.orientation, customPaper: template.customPaper, pageWidth: template.pageWidth,
      pageHeight: template.pageHeight, activeTemplateId: id });
  };
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
    <section className="space-y-3 rounded border bg-zinc-50 p-3" aria-label="Stationery alignment preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Optional scan calibration</p>
        <label className="text-xs">Zoom<select className="ml-1 rounded border bg-white p-1" value={zoom} onChange={event => setZoom(Number(event.target.value))}><option value={0.5}>50%</option><option value={0.72}>72%</option><option value={1}>100%</option><option value={1.25}>125%</option></select></label>
      </div>
      <p className="text-xs text-zinc-600">Drag any field to move it. The scan and guides are for calibration only and are never embedded in the print PDF. Calibrate against a flat scan and confirm with an alignment test print.</p>
      <div className="max-h-[75vh] overflow-auto rounded border bg-[#d8dadd] p-4">
        <div ref={page} onPointerMove={moveToPointer} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}
          className="relative mx-auto touch-none overflow-hidden bg-white shadow"
          style={{ width: `${pageWidth * scale}px`, height: `${pageHeight * scale}px`, backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined, backgroundSize: "100% 100%", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(to right, #9ca3af 1px, transparent 1px),linear-gradient(to bottom, #9ca3af 1px, transparent 1px)", backgroundSize: `${10 * scale}px ${10 * scale}px` }} />
          {alignmentFields.map(field => {
            const config = fields[field] || defaultAlignmentFields[field];
            const previewY = rowFields.has(field) ? settings.rowStartY + config.y : config.y;
            return <button key={field} type="button" onClick={() => setSelected(field)} onPointerDown={event => {
              event.preventDefault(); setSelected(field); drag.current = { field, pointerId: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId);
            }} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}
              className={`absolute z-10 overflow-hidden border px-0.5 text-left leading-none ${selected === field ? "border-blue-700 bg-blue-100/80 ring-1 ring-blue-500" : "border-red-500/60 bg-white/40"}`}
              style={{ left: `${config.x / pageWidth * 100}%`, top: `${previewY / pageHeight * 100}%`, width: `${config.width / pageWidth * 100}%`, height: `${config.height / pageHeight * 100}%`, fontSize: `${Math.max(7, config.fontSize * 0.72 * zoom)}px`, fontWeight: config.bold ? 700 : 400, textAlign: config.align }} title={`${labels[field]} · ${config.x.toFixed(1)}, ${previewY.toFixed(1)} mm`}>{labels[field]}</button>;
          })}
        </div>
      </div>
    </section>
    <aside className="space-y-4 rounded border bg-white p-4">
      <label className="grid gap-1 text-sm">Selected field<select className="rounded border p-2" value={selected} onChange={event => setSelected(event.target.value as AlignmentField)}>{alignmentFields.map(field => <option key={field} value={field}>{labels[field]}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        {([["x", "X (mm)"], ["y", rowFields.has(selected) ? "Y offset (mm)" : "Y (mm)"], ["width", "Width (mm)"], ["height", "Height (mm)"], ["fontSize", "Font size"]] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-xs">{label}<input className="w-full rounded border p-2" type="number" step="0.5" value={fieldConfig[key]} onChange={event => updateField(selected, { [key]: Number(event.target.value) })} /></label>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fieldConfig.bold} onChange={event => updateField(selected, { bold: event.target.checked })} /> Bold</label>
      <label className="grid gap-1 text-xs">Text alignment<select className="rounded border p-2" value={fieldConfig.align} onChange={event => updateField(selected, { align: event.target.value as "left" | "center" | "right" })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      <label className="grid gap-1 text-xs">Line height<input className="rounded border p-2" type="number" min="0.8" max="3" step="0.1" value={fieldConfig.lineHeight} onChange={event => updateField(selected, { lineHeight: Number(event.target.value) })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs">Subject rows start Y (mm)<input className="rounded border p-2" type="number" step="0.5" value={settings.rowStartY} onChange={event => onChange({ rowStartY: Number(event.target.value) })} /></label>
        <label className="grid gap-1 text-xs">Subject row height (mm)<input className="rounded border p-2" type="number" min="3" max="30" step="0.5" value={settings.rowHeight} onChange={event => onChange({ rowHeight: Number(event.target.value) })} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs">Printer X offset (mm)<input className="rounded border p-2" type="number" min="-20" max="20" step="0.5" value={settings.offsetX} onChange={event => onChange({ offsetX: Number(event.target.value) })} /></label>
        <label className="grid gap-1 text-xs">Printer Y offset (mm)<input className="rounded border p-2" type="number" min="-20" max="20" step="0.5" value={settings.offsetY} onChange={event => onChange({ offsetY: Number(event.target.value) })} /></label>
      </div>
      <div className="space-y-2 border-t pt-3"><label className="grid gap-1 text-xs">Reusable template<select className="rounded border p-2" value={settings.activeTemplateId || ""} onChange={event => selectTemplate(event.target.value)}><option value="">Current unsaved layout</option>{settings.templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <div className="flex gap-2"><input className="min-w-0 flex-1 rounded border p-2 text-sm" maxLength={60} value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Template name" /><button type="button" disabled={!templateName.trim() || settings.templates.length >= 20} className="rounded bg-zinc-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" onClick={saveTemplate}>Save template</button></div>
        <p className="text-xs text-zinc-500">Save Settings stores this layout with the branch. Template limit: 20.</p>
      </div>
    </aside>
  </div>;
}
