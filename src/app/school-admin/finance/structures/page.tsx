"use client";
import {RecordFilters, matchesRecordSearch} from "@/components/RecordFilters";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Plus, X } from "lucide-react";
import { financeApi } from "@/lib/financeApi";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { BulkImportModal } from "@/components/BulkImportModal";

export default function FeeStructuresPage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<any>(null);
  const [customCharges, setCustomCharges] = useState<Array<{ label: string; amount: number }>>([]);
  const [policy, setPolicy] = useState<any>({ model: "DISABLED", type: "FIXED", amount: 0, dailyRate: 0, graceDays: 0, maxFineCap: 0, stages: [] });
  const [early, setEarly] = useState<any>({ enabled: false, type: "FIXED", amount: 0, cutoffDaysBeforeDue: 0 });
  const [search,setSearch]=useState(""),[filterClass,setFilterClass]=useState(""),[filterSession,setFilterSession]=useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [structures, setStructures] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [classScope, setClassScope] = useState<"SPECIFIC" | "ALL">("SPECIFIC");
  const [formDirty, setFormDirty] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    schoolAdminApi.getAcademicSessions().then((r: any) => setSessions(r.data || [])).catch(() => setSessions([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [structureRes, classRes] = await Promise.all([
        financeApi.getFeeStructures(),
        financeApi.getClasses(),
      ]);
      setStructures(structureRes?.data || []);
      setClasses(classRes?.data || []);
    } catch (e: any) {
      setError(e?.message || "Unable to load fee structures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    const linkedClass = classes.find((c) => c._id === form.get("classId"));
    try {
      const payload = {
        customCharges, lateFeeFinePolicy: policy, earlyPaymentDiscount: early,
        admissionFee: Number(form.get("admissionFee") || 0),
        defaultDiscount: Number(form.get("defaultDiscount") || 0),
        academicSession: String(form.get("academicSession") || ""),
        title: form.get("title"),
        classScope,
        ...(classScope === "ALL" ? {} : { classId: linkedClass?._id, className: linkedClass?.name }),
        dueDateDay: form.get("dueDateDay") ? Number(form.get("dueDateDay")) : undefined,
        tuitionFee: Number(form.get("tuitionFee")),
        examFee: Number(form.get("examFee") || 0),
        transportFee: Number(form.get("transportFee") || 0),
        libraryFee: Number(form.get("libraryFee") || 0),
        computerFee: Number(form.get("computerFee") || 0),
        otherCharges: Number(form.get("otherCharges") || 0),
      };
      if (editing) await apiFetch(`/finance/structures/${editing._id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await financeApi.createFeeStructure(payload);
      formElement.reset(); setEditing(null); setCustomCharges([]); setClassScope("SPECIFIC"); setModalOpen(false); setFormDirty(false);
      setNotice("Fee structure saved. Issued challans retain their original amounts.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Unable to create fee structure.");
    } finally {
      setSaving(false);
    }
  }

  const filteredStructures=structures.filter(s=>matchesRecordSearch([s.title,s.className,s.sectionName,s.academicSession],search)&&(!filterClass||s.className===filterClass)&&(!filterSession||s.academicSession===filterSession));
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {bulkOpen && (
        <BulkImportModal
          entity="feeStructures"
          onClose={() => setBulkOpen(false)}
          onImported={load}
        />
      )}

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black">Fee Structures</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create named fee structures and assign them to individual students.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.permissions?.includes("fees.update") && <button type="button" onClick={() => { setEditing(null); setCustomCharges([]); setPolicy({ model: "DISABLED", type: "FIXED", amount: 0, dailyRate: 0, graceDays: 0, maxFineCap: 0, stages: [] }); setEarly({ enabled: false, type: "FIXED", amount: 0, cutoffDaysBeforeDue: 0 }); setClassScope("SPECIFIC"); setFormDirty(false); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"><Plus size={16} />Create Fee Structure</button>}
          <button type="button" onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50"><FileSpreadsheet size={15} className="text-emerald-600" />Bulk Upload Structures</button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {modalOpen && user?.permissions?.includes("fees.update") && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); if (!formDirty || window.confirm("Discard unsaved fee structure changes?")) { setModalOpen(false); setEditing(null); setFormDirty(false); } } }} onMouseDown={(e) => { if (e.target === e.currentTarget && (!formDirty || window.confirm("Discard unsaved fee structure changes?"))) { setModalOpen(false); setEditing(null); setFormDirty(false); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="fee-structure-modal-title" className="flex max-h-[95dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <header className="flex items-start justify-between border-b px-5 py-4 sm:px-7"><div><h2 id="fee-structure-modal-title" className="text-lg font-bold text-zinc-900">{editing ? "Edit Fee Structure" : "Create Fee Structure"}</h2><p className="mt-1 text-sm text-zinc-500">Define the class coverage, fee amounts, and payment policies.</p></div><button type="button" aria-label="Close dialog" onClick={() => { if (!formDirty || window.confirm("Discard unsaved fee structure changes?")) { setModalOpen(false); setEditing(null); setFormDirty(false); } }} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"><X size={18} /></button></header>
      {editing && <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900 sm:px-7">Changes apply to future assignments and challans. Previously issued challans and collection records keep their saved amounts and details.</p>}
      <form
        key={editing?._id || "new"}
        onSubmit={create}
        onChange={() => setFormDirty(true)}
        className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-7"
      >
        {error && <p role="alert" className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <h3 className="sm:col-span-2 text-sm font-bold text-zinc-800">Basic Information</h3>
        <label className="grid gap-1 text-sm font-semibold">
          Fee Structure Name *
          <input
            defaultValue={editing?.title || ""}
            name="title"
            required
            placeholder="e.g., Standard Fee, Concession Fee"
            className="rounded-lg border px-3 py-2 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Academic Session *
          <select
            defaultValue={editing?.academicSession || ""}
            name="academicSession"
            required
            className="rounded-lg border px-3 py-2 font-normal"
          >
            <option value="">Select academic session</option>
            {sessions.map((s) => <option key={s._id} value={s.name}>{s.name}{s.isCurrent ? " · Current" : ""}</option>)}
          </select>
        </label>
        <div className="sm:col-span-2 rounded-xl border border-zinc-200 p-4"><h3 className="text-sm font-bold text-zinc-800">Class Applicability</h3><p className="mt-1 text-xs text-zinc-500">Choose which classes can use this structure. Student assignments remain explicit.</p><div className="mt-3 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="classScope" checked={classScope === "SPECIFIC"} onChange={() => { setClassScope("SPECIFIC"); setFormDirty(true); }} />Specific Class</label><label className="flex items-center gap-2"><input type="radio" name="classScope" checked={classScope === "ALL"} onChange={() => { setClassScope("ALL"); setFormDirty(true); }} />All Classes</label></div>{classScope === "ALL" ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">This fee structure will be available for students in all eligible classes.</p> : <label className="mt-3 grid gap-1 text-sm font-semibold">Class *<select required defaultValue={editing?.classScope === "ALL" ? "" : editing?.classId || ""} name="classId" className="rounded-lg border px-3 py-2 font-normal"><option value="">Select class</option>{classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>}</div>
        <h3 className="sm:col-span-2 text-sm font-bold text-zinc-800">Fee Components <span className="font-normal text-zinc-500">(PKR)</span></h3>
        {[
          ["admissionFee", "Admission fee (first challan)"],
          ["defaultDiscount", "Standard discount"],
          ["tuitionFee", "Tuition fee *", true],
          ["examFee", "Exam fee"],
          ["transportFee", "Transport"],
          ["libraryFee", "Library"],
          ["computerFee", "Computer"],
          ["otherCharges", "Other charges"],
        ].map(([name, label, required]) => (
          <label
            key={String(name)}
            className="grid gap-1 text-xs font-semibold"
          >
            {String(label)}
            <input
              name={String(name)}
              type="number"
              min="0"
              step="0.01"
              required={Boolean(required)}
              defaultValue={editing?.[String(name)] ?? (required ? undefined : 0)}
              placeholder={String(name) === "tuitionFee" ? "Enter monthly tuition fee" : "0.00"}
              className="rounded-lg border px-3 py-2"
            />
          </label>
        ))}
        <div className="sm:col-span-2"><h3 className="text-sm font-bold text-zinc-800">Discounts and Due Dates</h3><label className="mt-3 grid max-w-sm gap-1 text-sm font-semibold">Due day of month<input name="dueDateDay" type="number" min="1" max="31" defaultValue={editing?.dueDateDay ?? ""} placeholder="Uses school policy" className="rounded-lg border px-3 py-2 font-normal" /><span className="text-xs font-normal text-zinc-500">Leave blank to use the school’s configured due date.</span></label></div>
        <fieldset className="space-y-2 sm:col-span-2 lg:col-span-4"><legend>Custom charges</legend>{customCharges.map((c, i) => <div key={i} className="flex gap-2"><input aria-label="Charge name" className="border p-2" required maxLength={60} value={c.label} onChange={e => setCustomCharges(v => v.map((x,j) => j === i ? { ...x, label: e.target.value } : x))} /><input aria-label="Charge amount" className="border p-2" required type="number" min={0} step="0.01" value={c.amount} onChange={e => setCustomCharges(v => v.map((x,j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} /><button type="button" onClick={() => setCustomCharges(v => v.filter((_,j) => i !== j))}>Remove</button></div>)}<button type="button" disabled={customCharges.length >= 12} onClick={() => setCustomCharges(v => [...v, { label: "", amount: 0 }])}>+ Add custom charge</button></fieldset>
        <fieldset className="space-y-2 sm:col-span-2"><legend>Early payment discount</legend><label className="flex gap-2"><input type="checkbox" checked={early.enabled} onChange={e => setEarly({ ...early, enabled: e.target.checked })} />Enable</label><select aria-label="Early discount type" value={early.type} onChange={e => setEarly({ ...early, type: e.target.value })}><option>FIXED</option><option>PERCENTAGE</option></select>{[["amount", "Amount"], ["cutoffDaysBeforeDue", "Days before due date"]].map(([key,label]) => <label key={key} className="grid text-xs">{label}<input className="border p-2" type="number" min={0} value={early[key]} onChange={e => setEarly({ ...early, [key]: Number(e.target.value) })} /></label>)}</fieldset>
        <fieldset className="space-y-2 sm:col-span-2"><legend>Late payment policy</legend><select aria-label="Late fine model" value={policy.model} onChange={e => setPolicy({ ...policy, model: e.target.value })}>{["DISABLED", "ONE_TIME", "RECURRING", "STAGES"].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Late fine type" value={policy.type} onChange={e => setPolicy({ ...policy, type: e.target.value })}><option>FIXED</option><option>PERCENTAGE</option></select>{[["amount", "One-time amount"], ["dailyRate", "Daily rate"], ["graceDays", "Grace days"], ["maxFineCap", "Maximum recurring fine (PKR)"]].map(([key,label]) => <label key={key} className="grid text-xs">{label}<input className="border p-2" type="number" min={0} value={policy[key] || 0} onChange={e => setPolicy({ ...policy, [key]: Number(e.target.value) })} /></label>)}{policy.model === "STAGES" && <><p className="text-xs">Each fine applies through the specified number of days after due. The final fine continues thereafter.</p>{(policy.stages || []).map((st:any,i:number) => <div key={i} className="flex gap-2"><input aria-label="Stage through days" type="number" min={1} value={st.daysAfterDue} onChange={e => setPolicy({ ...policy, stages: policy.stages.map((v:any,j:number) => i === j ? { ...v, daysAfterDue: Number(e.target.value) } : v) })} /><input aria-label="Stage fine PKR" type="number" min={0} value={st.fineAmount} onChange={e => setPolicy({ ...policy, stages: policy.stages.map((v:any,j:number) => i === j ? { ...v, fineAmount: Number(e.target.value) } : v) })} /><button type="button" onClick={() => setPolicy({ ...policy, stages: policy.stages.filter((_:any,j:number) => i !== j) })}>Remove</button></div>)}<button type="button" onClick={() => setPolicy({ ...policy, stages: [...(policy.stages || []), { daysAfterDue: 5, fineAmount: 0 }] })}>Add stage</button></>}</fieldset>
        <footer className="sticky bottom-0 -mx-5 mt-2 flex justify-end gap-2 border-t bg-white px-5 py-4 sm:col-span-2 sm:-mx-7 sm:px-7"><button type="button" disabled={saving} onClick={() => { if (!formDirty || window.confirm("Discard unsaved fee structure changes?")) { setModalOpen(false); setEditing(null); setFormDirty(false); } }} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving || (classScope === "SPECIFIC" && !classes.length)} className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : editing ? "Save Changes" : "Create Fee Structure"}</button></footer>
      </form></section></div>}
      <RecordFilters search={search} onSearch={setSearch} placeholder="Search structure, class or session" count={filteredStructures.length} total={structures.length} filters={[{label:"Class",value:filterClass,onChange:setFilterClass,options:Array.from(new Set(structures.map(s=>s.className).filter(Boolean)))},{label:"Session",value:filterSession,onChange:setFilterSession,options:Array.from(new Set(structures.map(s=>s.academicSession).filter(Boolean)))}]} onReset={()=>{setSearch("");setFilterClass("");setFilterSession("")}}/>
      {loading ? (
        <p
          role="status"
          className="rounded-xl bg-white p-6 text-sm text-zinc-500"
        >
          Loading fee structures…
        </p>
      ) : filteredStructures.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredStructures.map((item) => (
            <article
              key={item._id}
              className="rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex justify-between gap-2">
                <h2 className="font-bold">{item.title}</h2>{user?.permissions?.includes("fees.update") && <button className="text-sm underline" onClick={() => { setEditing(item); setClassScope(item.classScope === "ALL" ? "ALL" : "SPECIFIC"); setCustomCharges(item.customCharges || []); setPolicy(item.lateFeeFinePolicy || { model: "DISABLED", type: "FIXED", amount: 0, stages: [] }); setEarly(item.earlyPaymentDiscount || { enabled: false, type: "FIXED", amount: 0, cutoffDaysBeforeDue: 0 }); setFormDirty(false); setModalOpen(true); }}>Edit</button>}
                <span className="text-right text-sm font-semibold text-school-primary">
                  {item.classScope === "ALL" ? "All Classes" : item.className}
                  <span className="block text-xs font-normal text-zinc-500">{item.academicSession || "Current session"}</span>
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Tuition", item.tuitionFee],
                  ["Exam", item.examFee],
                  ["Transport", item.transportFee],
                  ["Library", item.libraryFee],
                  ["Computer", item.computerFee],
                  ["Other", item.otherCharges],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between gap-2"
                  >
                    <dt className="text-zinc-500">{label}</dt>
                    <dd>PKR {Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t pt-3 text-right font-bold">
                Monthly total PKR{" "}
                {Number(item.totalMonthlyFee || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="font-bold">No fee structures yet</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Add a structure before generating challans.
          </p>
        </div>
      )}
    </div>
  );
}
