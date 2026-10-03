"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, Pin, AlertTriangle, Calendar, User, Search, CheckCircle2, X } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

interface Announcement {
  _id: string;
  title: string;
  targetAudience: "ALL_SCHOOL" | "TEACHERS_ONLY" | "PARENTS_ONLY" | "CLASS_SPECIFIC";
  priority: "NORMAL" | "HIGH" | "URGENT";
  content: string;
  postedBy: string;
  isPinned: boolean;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      _id: "ann1",
      title: "Mid-Term Examination Schedule Announcement 2026",
      targetAudience: "ALL_SCHOOL",
      priority: "URGENT",
      content: "All teachers, students, and staff members are advised to view the updated Mid-Term examination timetable attached on the portal. Exams start on October 12, 2026.",
      postedBy: "Principal Office",
      isPinned: true,
      createdAt: "2026-09-25",
    },
    {
      _id: "ann2",
      title: "Faculty Staff Meeting - Curriculum Alignment",
      targetAudience: "TEACHERS_ONLY",
      priority: "HIGH",
      content: "All teaching staff are required to attend the syllabus alignment meeting in the Main Auditorium this Friday at 2:30 PM sharp.",
      postedBy: "Academic Coordinator",
      isPinned: false,
      createdAt: "2026-09-26",
    },
    {
      _id: "ann3",
      title: "Annual Sports Day Registration Open",
      targetAudience: "ALL_SCHOOL",
      priority: "NORMAL",
      content: "Students interested in participating in athletics, football, and badminton events for the Annual Sports Gala must submit their entries to sports coaches.",
      postedBy: "Sports Department",
      isPinned: false,
      createdAt: "2026-09-24",
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAudience, setFilterAudience] = useState("ALL");

  // Form State
  const [title, setTitle] = useState("");
  const [targetAudience, setTargetAudience] = useState<"ALL_SCHOOL" | "TEACHERS_ONLY" | "PARENTS_ONLY" | "CLASS_SPECIFIC">("ALL_SCHOOL");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    schoolAdminApi.getAnnouncements()
      .then((res) => {
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          setAnnouncements(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    setPosting(true);
    const newDoc: Announcement = {
      _id: "ann_" + Date.now(),
      title,
      targetAudience,
      priority,
      content,
      postedBy: "School Admin",
      isPinned,
      createdAt: new Date().toISOString().split("T")[0],
    };

    try {
      await schoolAdminApi.createAnnouncement(newDoc);
      setAnnouncements([newDoc, ...announcements]);
      setShowModal(false);
      setTitle("");
      setContent("");
    } catch {
      // The shared API feedback displays the error; keep the form open for correction.
    } finally {
      setPosting(false);
    }
  };

  const filtered = announcements.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
    const matchesAudience = filterAudience === "ALL" || a.targetAudience === filterAudience;
    return matchesSearch && matchesAudience;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-red-600" />
            School Announcements & Circulars
          </h1>
          <p className="text-xs text-zinc-500">Publish school-wide circulars, staff notices, and urgent alerts</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Post New Circular
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {["ALL", "ALL_SCHOOL", "TEACHERS_ONLY", "PARENTS_ONLY"].map((aud) => (
            <button
              key={aud}
              onClick={() => setFilterAudience(aud)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterAudience === aud ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {aud.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search circulars..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border border-zinc-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>
      </div>

      {/* Announcements Feed */}
      <div className="space-y-4">
        {filtered.map((item) => {
          const getPriorityBadge = (p: string) => {
            if (p === "URGENT") return <span className="bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> URGENT</span>;
            if (p === "HIGH") return <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded">HIGH PRIORITY</span>;
            return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded">NORMAL</span>;
          };

          return (
            <div key={item._id} className={`bg-white border rounded-xl p-5 shadow-xs transition-all ${item.isPinned ? "border-l-4 border-l-red-600 border-zinc-200" : "border-zinc-200"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.isPinned && (
                    <span className="bg-zinc-100 text-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <Pin className="h-3 w-3 text-red-600 fill-red-600" /> PINNED TO BOARD
                    </span>
                  )}
                  {getPriorityBadge(item.priority)}
                  <span className="bg-zinc-100 text-zinc-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                    {item.targetAudience.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-zinc-500 font-mono">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {item.postedBy}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {item.createdAt}</span>
                </div>
              </div>

              <h2 className="text-base font-bold text-zinc-950 mb-2">{item.title}</h2>
              <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-line">{item.content}</p>
            </div>
          );
        })}
      </div>

      {/* Post Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">Post New School Announcement</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Notice Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Winter Holiday Schedule Announcement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Target Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e: any) => setTargetAudience(e.target.value)}
                    className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
                  >
                    <option value="ALL_SCHOOL">All School (Teachers & Parents)</option>
                    <option value="TEACHERS_ONLY">Teachers & Faculty Only</option>
                    <option value="PARENTS_ONLY">Parents & Students Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Alert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">Message Body</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter full notice content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full text-xs border border-zinc-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pin"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="pin" className="text-xs font-medium text-zinc-700">Pin this circular to top of notice board</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
                >
                  {posting ? "Publishing..." : "Publish Circular"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
