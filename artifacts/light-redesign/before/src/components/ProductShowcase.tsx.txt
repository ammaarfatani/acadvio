"use client";

import { ScreenshotCapture } from "@/components/ScreenshotCapture";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ArrowRight } from "lucide-react";

const portals = [
  { id: "school-admin", label: "School Admin", title: "A clear overview of your school.", description: "Manage school structure, staff, students and academic operations from one workspace.", tasks: ["Student and staff records", "Sessions, classes and sections", "Attendance, fees and school reports"], image: "school-admin.jpg" },
  { id: "teacher", label: "Teacher", title: "Teaching responsibilities, in one place.", description: "Give teachers a focused workspace for the classes and subjects assigned to them.", tasks: ["Assigned classes and students", "Timetables and attendance", "Marks entry and announcements"], image: "teacher-full.jpg" },
  { id: "examination", label: "Examination", title: "From exam schedules to published results.", description: "Keep candidates, marks verification, results and certificates connected.", tasks: ["Exam schedules and candidates", "Marks entry and review", "Results, marksheets and certificates"], image: "examination.jpg" },
  { id: "finance", label: "Finance", title: "Understand your fee collection.", description: "Work with challans, receipts, balances and expenses using the school's recorded transactions.", tasks: ["Fee structures and collection", "Challans, receipts and expenses", "Outstanding balances and reports"], image: "finance.jpg" },
  { id: "receptionist", label: "Receptionist", title: "A more organized front desk.", description: "Handle admissions, visitor activity, appointments and department requests in a dedicated workspace.", tasks: ["Admission inquiries and enrollment", "Visitors and appointments", "Student lookup and front desk requests"], image: "receptionist.jpg" },
];

export function ProductShowcase({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState(0);
  const portal = portals[selected];
  return <div>
    <div role="tablist" aria-label="Explore school portals" className="flex gap-2 overflow-x-auto pb-3">
      {portals.map((item, index) => <button key={item.id} id={`portal-tab-${item.id}`} role="tab" aria-selected={selected === index} aria-controls="portal-preview" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? portals.length - 1 : (selected + (event.key === "ArrowRight" ? 1 : -1) + portals.length) % portals.length; setSelected(next); document.getElementById(`portal-tab-${portals[next].id}`)?.focus(); } }} className={`shrink-0 rounded-lg border px-4 py-3 text-sm font-semibold ${selected === index ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"}`}>{item.label}</button>)}
    </div>
    <div id="portal-preview" role="tabpanel" aria-labelledby={`portal-tab-${portal.id}`} className={`mt-4 grid items-start gap-7 ${compact ? "" : "lg:grid-cols-[.32fr_1fr]"}`}>
      <div className={compact ? "flex flex-wrap items-start justify-between gap-5" : "pt-4"}>
        <div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{portal.label} workspace</p><h3 className="mt-3 max-w-md text-2xl font-semibold tracking-tight">{portal.title}</h3><p className="mt-4 max-w-lg text-sm leading-6 text-zinc-600">{portal.description}</p></div>
        {!compact && <><ul className="mt-6 space-y-3">{portal.tasks.map(task => <li key={task} className="flex gap-2 text-sm text-zinc-600"><Check size={16} className="mt-0.5 shrink-0 text-brand-600"/>{task}</li>)}</ul><Link href="/free-trial" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">Explore with your own school <ArrowRight size={16}/></Link></>}
      </div>
      <figure className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3"><span className="text-xs font-medium text-zinc-500">Acadivo / {portal.label}</span></div>
        <ScreenshotCapture key={portal.id} image={portal.image} label={portal.label}/>
        <figcaption className="border-t border-zinc-100 px-4 py-3 text-xs leading-5 text-zinc-500">Captured from the working {portal.label.toLowerCase()} portal. Identifying details are redacted for this public preview. Records shown belong to the captured workspace; your dashboard reflects your own school.</figcaption>
      </figure>
    </div>
  </div>;
}



