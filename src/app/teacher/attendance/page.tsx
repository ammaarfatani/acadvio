"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { teacherApi } from "@/lib/teacherApi";

type AttendanceStudent = { studentId: string; name: string; rollNumber: string; status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE"; remarks: string };
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const refId = (value: any) => String(value?._id || value || "");

export default function StudentAttendancePage() {
  const [assignments, setAssignments] = useState<any[]>([]); const [classId, setClassId] = useState(""); const [sectionId, setSectionId] = useState(""); const [date, setDate] = useState(today());
  const [students, setStudents] = useState<AttendanceStudent[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { teacherApi.getClassTeacherSections().then((response) => { const active = response.data || []; setAssignments(active); const first = active[0]; if (first) { setClassId(refId(first.classId)); setSectionId(refId(first.sectionId)); } }).catch((e: any) => setError(e.message || "Could not load your Class Teacher assignments.")).finally(() => setLoading(false)); }, []);
  const choices = useMemo(() => [...new Map(assignments.map((a) => { const key = `${refId(a.classId)}:${refId(a.sectionId)}`; return [key, { key, classId: refId(a.classId), sectionId: refId(a.sectionId), label: `${a.classId?.name || "Class"} · ${a.sectionId?.name || "Section"}` }]; }))].map((item: any) => item[1]), [assignments]);
  const selected = choices.find((item: any) => item.classId === classId && item.sectionId === sectionId);
  const loadRoster = useCallback(async () => {
    if (!classId || !sectionId) { setStudents([]); return; }
    setLoading(true); setError("");
    try { const response = await teacherApi.getAttendanceRoster(classId, sectionId, date); setStudents(response.data?.students || []); }
    catch (e: any) { setStudents([]); setError(e.message || "Unable to load your assigned student roster."); }
    finally { setLoading(false); }
  }, [classId, sectionId, date]);
  useEffect(() => { void loadRoster(); }, [loadRoster]);
  const update = (studentId: string, changes: Partial<AttendanceStudent>) => setStudents((items) => items.map((item) => item.studentId === studentId ? { ...item, ...changes } : item));
  const save = async () => {
    setSaving(true); setError(""); setNotice("");
    try { const response = await teacherApi.saveAttendance({ classId, sectionId, date, records: students.map((student) => ({ studentId: student.studentId, status: student.status, remarks: student.remarks || undefined })) }); setNotice(response.message || "Attendance saved successfully."); await loadRoster(); }
    catch (e: any) { setError(e.message || "Unable to save attendance."); }
    finally { setSaving(false); }
  };
  const count = (status: string) => students.filter((student) => student.status === status).length;
  return <div className="mx-auto max-w-6xl space-y-6 pb-12">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-school-primary">Attendance</p><h1 className="mt-1 text-3xl font-black tracking-tight">Student Attendance</h1><p className="mt-1 text-sm text-zinc-500">Mark attendance for your assigned class sections.</p></div><button onClick={() => void save()} disabled={saving || !students.length} className="inline-flex items-center gap-2 rounded-xl bg-school-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save size={16} />{saving ? "Saving…" : "Save attendance"}</button></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 size={16} />{notice}</p>}
    <section className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Assigned class and section<select value={selected?.key || ""} onChange={(event) => { const item: any = choices.find((choice: any) => choice.key === event.target.value); setClassId(item?.classId || ""); setSectionId(item?.sectionId || ""); }} className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5" disabled={!choices.length}><option value="">{choices.length ? "Select class section" : "No assigned sections"}</option>{choices.map((item: any) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold">Attendance date<input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5" /></label></section>
    {!loading && students.length > 0 && <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Students", students.length],["Present",count("PRESENT")],["Absent",count("ABSENT")],["Late",count("LATE")]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</section>}
    {loading ? <p role="status" className="rounded-2xl border bg-white p-8 text-sm text-zinc-500">Loading your assigned students…</p> : students.length ? <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="p-3">Roll number</th><th className="p-3">Student</th><th className="p-3">Status</th><th className="p-3">Remark</th></tr></thead><tbody>{students.map((student) => <tr key={student.studentId} className="border-t hover:bg-zinc-50"><td className="p-3 font-mono">{student.rollNumber}</td><td className="p-3 font-semibold">{student.name}</td><td className="p-3"><select value={student.status} onChange={(event) => update(student.studentId, { status: event.target.value as AttendanceStudent["status"] })} className="rounded-lg border px-3 py-2"><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="LATE">Late</option><option value="LEAVE">Leave</option></select></td><td className="p-3"><input value={student.remarks} onChange={(event) => update(student.studentId, { remarks: event.target.value })} placeholder="Optional" className="w-full rounded-lg border px-3 py-2" /></td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center"><h2 className="font-bold">{choices.length ? "No active students in this section" : "No Class Teacher assignment found."}</h2><p className="mt-1 text-sm text-zinc-500">{choices.length ? "There are no student records to mark for this date." : "Ask your school administrator to assign you to a class section for the current academic session."}</p></div>}
  </div>;
}
