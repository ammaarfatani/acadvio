"use client";



import { useCallback, useEffect, useState } from "react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const [subjectResponse, classResponse, teacherResponse] = await Promise.all([schoolAdminApi.getSubjects(), schoolAdminApi.getClasses(), schoolAdminApi.getTeachers()]); setSubjects(subjectResponse.data || []); setClasses(classResponse.data || []); setTeachers((teacherResponse.data || []).filter((teacher: any) => teacher.status === "ACTIVE")); setError(""); }
    catch (e: any) { setError(e.message || "Could not load subjects."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedClass = classes.find((item) => item._id === classId);
    if (!selectedClass) { setError("Create or select a class before adding a subject."); return; }
    setSaving(true); setError("");
    const selectedTeacher = teachers.find((item) => item._id === teacherId);
    try { await schoolAdminApi.createSubject({ name, code: code || undefined, classId, className: selectedClass.name, teacherId: teacherId || undefined, teacherName: selectedTeacher?.name }); setName(""); setCode(""); setTeacherId(""); await load(); }
    catch (e: any) { setError(e.message || "Could not create subject."); }
    finally { setSaving(false); }
  };
  return <div className="space-y-6 pb-12">
    <header className="border-b border-zinc-200 pb-4"><h1 className="text-2xl font-black text-zinc-950">Subjects</h1><p className="text-sm text-zinc-500">Subjects belong to a class in your school.</p></header>
    <form onSubmit={submit} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
      <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold">Subject name *<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mathematics" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" /></label>
      <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold">Subject code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional · auto-generated if blank" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" /><span className="font-normal text-zinc-500">Optional short code used to identify this subject.</span></label>
      <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold">Class *<select required value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <label className="grid min-w-48 flex-1 gap-1 text-xs font-semibold">Responsible teacher<select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"><option value="">Unassigned</option>{teachers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <button disabled={saving || classes.length === 0} className="self-start rounded-xl bg-school-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add subject"}</button>
    </form>
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {loading ? <p role="status" className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Loading subjects…</p> : subjects.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center"><h2 className="font-semibold">No subjects yet</h2><p className="mt-1 text-sm text-zinc-500">Add a subject after creating a class.</p></div> : <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="p-3">Subject</th><th className="p-3">Code</th><th className="p-3">Class</th><th className="p-3">Teacher</th></tr></thead><tbody>{subjects.map((item) => <tr key={item._id} className="border-t border-zinc-100 hover:bg-zinc-50"><td className="p-3 font-semibold">{item.name}</td><td className="p-3">{item.code}</td><td className="p-3">{item.className}</td><td className="p-3">{item.teacherName || "Unassigned"}</td></tr>)}</tbody></table></div>}
  </div>;
}
