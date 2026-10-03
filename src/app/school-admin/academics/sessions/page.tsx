"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Calendar, Plus } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function SessionsPage() {
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
      formElement.reset(); setNotice("Academic session created."); await load();
    } catch (e: any) { setError(e?.message || "Unable to create academic session."); }
    finally { setSaving(false); }
  }
  async function setCurrent(id: string) {
    try { await schoolAdminApi.setCurrentAcademicSession(id); setNotice("Current academic session updated."); await load(); }
    catch (e: any) { setError(e?.message || "Unable to update current session."); }
  }

  return <div className="mx-auto max-w-5xl space-y-6 pb-12">
    <header><h1 className="text-2xl font-black text-zinc-950">Academic Sessions</h1><p className="mt-1 text-sm text-zinc-500">Manage this school’s academic calendar. New records use the current session by default.</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <form onSubmit={create} className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      <div className="sm:col-span-2"><h2 className="font-bold">Create session</h2></div>
      <label className="space-y-1 text-sm">Session name *<input name="name" required placeholder="2026-2027" className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      <label className="space-y-1 text-sm">Start date *<input name="startDate" type="date" required className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      <label className="space-y-1 text-sm">End date *<input name="endDate" type="date" required className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      <label className="flex items-center gap-2 text-sm"><input name="isCurrent" type="checkbox" /> Set as current session</label>
      <div><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Plus size={16} />{saving ? "Saving…" : "Add session"}</button></div>
    </form>
    <section className="space-y-3" aria-live="polite">
      {loading ? <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Loading sessions…</p> : sessions.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center"><Calendar className="mx-auto mb-3 text-zinc-400" /><h2 className="font-bold">No academic sessions yet</h2><p className="mt-1 text-sm text-zinc-500">Create your school’s first academic session above.</p></div> : sessions.map((session) => <article key={session._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div><h2 className="font-bold">{session.name}</h2><p className="text-sm text-zinc-500">{new Date(session.startDate).toLocaleDateString()} – {new Date(session.endDate).toLocaleDateString()}</p></div><div className="flex items-center gap-3">{session.isCurrent ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Current</span> : <button onClick={() => void setCurrent(session._id)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold">Set current</button>}</div></article>)}
    </section>
  </div>;
}
