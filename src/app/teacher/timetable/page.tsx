"use client";

import { useEffect, useMemo, useState } from "react";
import { teacherApi } from "@/lib/teacherApi";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeOf = (slot: any) => `${slot.startTime} – ${slot.endTime}`;
export default function MyTimetablePage() {
  const [slots, setSlots] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { teacherApi.getTimetable().then((response) => setSlots(response.data || [])).catch((e: any) => setError(e.message || "Unable to load your timetable.")).finally(() => setLoading(false)); }, []);
  const timeRows = useMemo(() => [...new Set(slots.map(timeOf))].sort((a, b) => a.localeCompare(b)), [slots]);
  const at = (day: string, time: string) => slots.filter((slot) => slot.dayOfWeek === day && timeOf(slot) === time);
  return <div className="mx-auto max-w-7xl space-y-6 pb-12"><header className="border-b border-zinc-200 pb-5"><p className="text-xs font-semibold uppercase tracking-wider text-school-primary">Teaching</p><h1 className="mt-1 text-3xl font-black">My Timetable</h1><p className="mt-1 text-sm text-zinc-500">Weekly schedule from the school timetable.</p></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{loading ? <p role="status" className="rounded-2xl bg-white p-6 text-sm text-zinc-500">Loading your timetable…</p> : slots.length ? <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white"><table className="w-full min-w-[1100px] table-fixed text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="w-40 p-3">Time</th>{days.map((day) => <th key={day} className="p-3">{day}</th>)}</tr></thead><tbody>{timeRows.map((time) => <tr key={time} className="border-t align-top"><th className="bg-zinc-50/70 p-3 font-mono text-xs font-semibold">{time}</th>{days.map((day) => <td key={day} className="h-24 border-l p-2">{at(day, time).map((slot) => <article key={slot._id} className="h-full rounded-xl border border-school-primary/20 bg-school-primary/5 p-3"><h2 className="font-bold text-zinc-900">{slot.subjectName || slot.subjectId?.name || "Subject"}</h2><p className="mt-1 text-xs text-zinc-700">{slot.className || slot.classId?.name || "Class"}{(slot.sectionName || slot.sectionId?.name) ? ` · ${slot.sectionName || slot.sectionId?.name}` : ""}</p><p className="mt-1 text-xs text-zinc-500">{slot.roomNumber ? `Room ${slot.roomNumber}` : "Room not set"}</p></article>)}</td>)}</tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center"><h2 className="font-bold">No timetable entries yet</h2><p className="mt-1 text-sm text-zinc-500">Your assigned periods will appear here when the school administrator publishes the timetable.</p></div>}
  </div>;
}
