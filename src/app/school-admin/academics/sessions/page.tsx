"use client";
import {WorkspaceDialog,workspacePrimary} from "@/components/WorkspaceDialog";
import {RecordFilters,matchesRecordSearch} from "@/components/RecordFilters";



import {Presence} from "@/components/Motion";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Calendar, Plus, FileSpreadsheet } from "lucide-react";
import { BulkImportModal } from "@/components/BulkImportModal";
import {apiFetch} from "@/lib/api";
import {Text,card,button} from "@/components/WorkforceUI";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function SessionsPage() {
  const [showCreate,setShowCreate]=useState(false),[bulkOpen,setBulkOpen]=useState(false),[query,setQuery]=useState(""),[filterClass,setFilterClass]=useState(""),[filterStatus,setFilterStatus]=useState("");
  const [editing,setEditing]=useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await schoolAdminApi.getAcademicSessions(); setSessions(response?.data || []); }
    catch (e: any) { setError(e?.message || "Unable to load academic sessions."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await schoolAdminApi.createAcademicSession({ name: form.get("name"), startDate: form.get("startDate"), endDate: form.get("endDate"), isCurrent: form.get("isCurrent") === "on" });
      formElement.reset(); setShowCreate(false); setNotice("Academic session created."); await load();
    } catch (e: any) { setError(e?.message || "Unable to create academic session."); }
    finally { setSaving(false); }
  }
  async function setCurrent(id: string) {
    try { await schoolAdminApi.setCurrentAcademicSession(id); setNotice("Current academic session updated."); await load(); }
    catch (e: any) { setError(e?.message || "Unable to update current session."); }
  }

  const [fromDate,setFromDate]=useState(""),[toDate,setToDate]=useState("");
  const filteredSessions=sessions.filter(c=>matchesRecordSearch([c.name,c.startDate,c.endDate],query)&&(!filterStatus||(filterStatus==="Current"?c.isCurrent:filterStatus==="Archived"?c.isArchived:!c.isCurrent&&!c.isArchived))&&(!fromDate||c.endDate.slice(0,10)>=fromDate)&&(!toDate||c.startDate.slice(0,10)<=toDate));
  return <div className="mx-auto max-w-5xl space-y-6 pb-12">
    <header><h1 className="text-2xl font-black text-zinc-950">Academic Sessions</h1><p className="mt-1 text-sm text-zinc-500">Manage this school’s academic calendar. New records use the current session by default.</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {bulkOpen && (
      <BulkImportModal
        entity="academicSessions"
        onClose={() => setBulkOpen(false)}
        onImported={load}
      />
    )}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-zinc-500">Browse records below. Use the button to add a new record.</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          <FileSpreadsheet size={15} className="text-emerald-600" />
          Bulk Upload Sessions
        </button>
        <button className={workspacePrimary} onClick={() => setShowCreate(true)}>Create academic session</button>
      </div>
    </div>
 {showCreate&&<WorkspaceDialog title="Create academic session" description="Set the academic year and date range. The current session is used for new records." busy={saving} onClose={()=>setShowCreate(false)} wide>{error&&<p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}    <form onSubmit={create} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      <div className="sm:col-span-2"><h2 className="font-bold">Create session</h2></div>
      <label className="space-y-1 text-sm">Session name *<input name="name" required placeholder="2026-2027" className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      <label className="space-y-1 text-sm">Start date *<input name="startDate" type="date" required className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      <label className="space-y-1 text-sm">End date *<input name="endDate" type="date" required className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      <label className="flex items-center gap-2 text-sm"><input name="isCurrent" type="checkbox" /> Set as current session</label>
      <div><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Plus size={16} />{saving ? "Saving…" : "Add session"}</button></div>
    </form></WorkspaceDialog>}

{editing&&<WorkspaceDialog title="Edit academic session" onClose={()=>setEditing(null)} busy={saving} description="Update the name and dates. Current and archived session rules remain unchanged.">{error&&<p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<form className={card+" mx-auto max-w-lg space-y-4"} onSubmit={async e=>{e.preventDefault();setSaving(true);try{await apiFetch("/school-admin/academic-sessions/"+editing._id,{method:"PUT",body:JSON.stringify({name:editing.name,startDate:editing.startDate,endDate:editing.endDate})});setEditing(null);await load();}catch(e:any){setError(e.message);}finally{setSaving(false);}}}><h2 className="text-xl font-semibold">Edit academic session</h2><Text label="Session name" placeholder="2026–2027" value={editing.name} onChange={(name:string)=>setEditing({...editing,name})}/><Text label="Start date" type="date" value={editing.startDate} onChange={(startDate:string)=>setEditing({...editing,startDate})}/><Text label="End date" type="date" min={editing.startDate} value={editing.endDate} onChange={(endDate:string)=>setEditing({...editing,endDate})}/><div className="flex justify-end gap-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={()=>setEditing(null)}>Cancel</button><button disabled={saving} className={button}>Save session</button></div></form></WorkspaceDialog>}
<RecordFilters search={query} onSearch={setQuery} placeholder="Search sessions, names or identifiers" count={filteredSessions.length} total={sessions.length} filters={[{label:"Status",value:filterStatus,onChange:setFilterStatus,options:["Current","Archived","Other"]}]} onReset={()=>{setQuery("");setFilterClass("");setFilterStatus("");setFromDate("");setToDate("")}}/>
<div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2"><label className="grid gap-2 text-xs font-semibold">Overlaps dates from<input type="date" value={fromDate} max={toDate||undefined} onChange={e=>setFromDate(e.target.value)} className="min-h-11 rounded-md border px-3"/></label><label className="grid gap-2 text-xs font-semibold">Through date<input type="date" value={toDate} min={fromDate||undefined} onChange={e=>setToDate(e.target.value)} className="min-h-11 rounded-md border px-3"/></label></div>    <section className="space-y-3" aria-live="polite">
      {loading ? <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Loading sessions…</p> : sessions.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center"><Calendar className="mx-auto mb-3 text-zinc-400" /><h2 className="font-bold">No academic sessions yet</h2><p className="mt-1 text-sm text-zinc-500">Create your school’s first academic session above.</p></div> : filteredSessions.map((session) => <article key={session._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div><h2 className="font-bold">{session.name}</h2><p className="text-sm text-zinc-500">{new Date(session.startDate).toLocaleDateString()} – {new Date(session.endDate).toLocaleDateString()}</p></div><div className="flex items-center gap-3">{session.isArchived&&<span className="rounded-full bg-zinc-100 px-3 py-1 text-xs">Archived</span>}<button className="min-h-11 w-full min-w-0 rounded-md border px-3 py-2 text-sm" onClick={()=>setEditing({...session,startDate:session.startDate.slice(0,10),endDate:session.endDate.slice(0,10)})}>Edit</button>{!session.isCurrent&&<button className="min-h-11 w-full min-w-0 rounded-md border px-3 py-2 text-sm" onClick={async()=>{try{await apiFetch("/school-admin/academic-sessions/"+session._id+"/archive",{method:"PATCH",body:JSON.stringify({archived:!session.isArchived})});await load();}catch(e:any){setError(e.message);}}}>{session.isArchived?"Restore":"Archive"}</button>}{session.isCurrent ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Current</span> : <button disabled={session.isArchived} onClick={() => void setCurrent(session._id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold">Set current</button>}</div></article>)}
    </section>
  </div>;
}
