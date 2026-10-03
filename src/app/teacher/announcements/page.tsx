"use client";

import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { teacherApi } from "@/lib/teacherApi";

export default function TeacherNoticeboardPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { teacherApi.getDashboardMetrics().then((response) => setAnnouncements(response.data?.announcements || [])).catch((e: any) => setError(e.message || "Unable to load school announcements.")).finally(() => setLoading(false)); }, []);
  return <div className="mx-auto max-w-6xl space-y-6 pb-12"><header className="border-b border-zinc-200 pb-5"><p className="text-xs font-semibold uppercase tracking-wider text-school-primary">School updates</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-black"><Megaphone className="text-school-primary" />Announcements</h1><p className="mt-1 text-sm text-zinc-500">Published announcements for your school and teacher role.</p></header>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{loading ? <p role="status" className="rounded-2xl bg-white p-6 text-sm text-zinc-500">Loading announcements…</p> : announcements.length ? <div className="space-y-3">{announcements.map((item) => <article key={item._id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-xs text-zinc-500">{item.category || "General"} · {item.postedByName || "School administration"}</p></div><time className="text-xs text-zinc-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</time></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{item.content}</p></article>)}</div> : <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center"><h2 className="font-bold">No announcements yet</h2><p className="mt-1 text-sm text-zinc-500">Published school notices for teachers will appear here.</p></div>}</div>;
}
