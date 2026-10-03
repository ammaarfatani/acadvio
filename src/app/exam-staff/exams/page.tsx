"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  FileCheck2,
  Trophy,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { examStaffApi } from "@/lib/examStaffApi";
import { useAuth } from "@/lib/auth-context";

export default function ExamSchedulesPage() {
  const { user } = useAuth();
  const base = user?.school?.slug ? `/${user.school.slug}/exam-staff` : "/exam-staff";

  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [examsRes, classesRes, sessionsRes] = await Promise.all([
        examStaffApi.getSchedules(),
        examStaffApi.getClasses(),
        examStaffApi.getSessions(),
      ]);

      setExams(examsRes?.data || []);
      setClasses(classesRes?.data || []);
      const sessList = sessionsRes?.data || [];
      setSessions(sessList);
      if (sessList.length > 0) {
        const current = sessList.find((s: any) => s.isCurrent) || sessList[0];
        setSessionId(current._id);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load examination schedules.");
    } fontally: {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      examStaffApi.getSubjects(selectedClassId)
        .then((res) => setSubjects(res?.data || []))
        .catch(() => setSubjects([]));
    } else {
      setSubjects([]);
    }
  }, [selectedClassId]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedClassId || !selectedSubjectId || !startDate || !endDate) return;

    setSaving(true);
    setError("");
    try {
      const targetClass = classes.find((c) => c._id === selectedClassId);
      const targetSubject = subjects.find((s) => s._id === selectedSubjectId);
      const targetSession = sessions.find((s) => s._id === sessionId);

      await examStaffApi.createExam({
        title,
        academicSessionId: sessionId,
        academicSessionName: targetSession?.name || "Current Session",
        classes: [targetClass?.name || "Class"],
        subjects: [targetSubject?.name || "Subject"],
        startDate,
        endDate,
      });

      setShowCreateModal(false);
      setTitle("");
      setSelectedClassId("");
      setSelectedSubjectId("");
      setStartDate("");
      setEndDate("");

      setNotice(`Examination "${title}" created successfully!`);
      setTimeout(() => setNotice(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to create examination schedule.");
    } finally {
      setSaving(false);
    }
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch = exam.title.toLowerCase().includes(search.toLowerCase()) ||
      (exam.classes || []).some((c: string) => c.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || exam.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-school-primary" />
            Examinations & Schedule Directory
          </h1>
          <p className="text-xs text-zinc-500">
            Configure examination terms, manage date sheets, subjects, and candidate eligibility.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-school-primary text-white rounded-xl shadow-xs hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create New Examination
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </p>
      )}

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search exam title or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border border-zinc-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="font-bold text-zinc-700 shrink-0">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 bg-zinc-50 font-semibold focus:outline-none w-full sm:w-44"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PROCESSED">Processed</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <p role="status" className="rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200">
          Loading examinations directory…
        </p>
      ) : filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExams.map((exam) => (
            <div key={exam._id} className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-zinc-950 line-clamp-1">{exam.title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 uppercase ${
                    exam.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800" :
                    exam.status === "PROCESSED" ? "bg-blue-100 text-blue-800" :
                    exam.status === "IN_PROGRESS" ? "bg-purple-100 text-purple-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {exam.status}
                  </span>
                </div>

                <p className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  {new Date(exam.startDate).toLocaleDateString()} — {new Date(exam.endDate).toLocaleDateString()}
                </p>

                <div className="space-y-1 text-xs pt-2 border-t border-zinc-100">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Academic Session:</span>
                    <strong className="text-zinc-800 font-medium">{exam.academicSessionName || "Current"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Classes Included:</span>
                    <strong className="text-zinc-800 font-medium truncate max-w-[150px]">
                      {(exam.classes || []).map((value: string) => classes.find((item: any) => item._id === value)?.name || value).join(", ") || "All Classes"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-100 flex items-center gap-2 text-xs">
                <Link
                  href={`${base}/marks?examId=${exam._id}`}
                  className="flex-1 text-center py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Marks Entry
                </Link>
                <Link
                  href={`${base}/results?examId=${exam._id}`}
                  className="flex-1 text-center py-2 px-3 bg-school-primary/10 hover:bg-school-primary/20 text-school-primary font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Results
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center space-y-2">
          <BookOpen className="h-8 w-8 text-zinc-400 mx-auto" />
          <h3 className="font-bold text-zinc-950 text-sm">No Examinations Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            No examination schedules match your search filters. Click above to create a new exam schedule.
          </p>
        </div>
      )}

      {/* Create Exam Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">Create New Examination Schedule</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-zinc-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Exam Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-Term Examination 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 focus:outline-none font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Academic Session *</label>
                  <select
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
                  >
                    {sessions.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}{s.isCurrent ? " (Current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Target Class *</label>
                  <select
                    required
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Target Subject *</label>
                <select
                  required
                  disabled={!selectedClassId}
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none disabled:opacity-50"
                >
                  <option value="">{selectedClassId ? "Select Subject" : "Select Class First"}</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-lg font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedClassId || !selectedSubjectId}
                  className="px-5 py-2 bg-school-primary text-white font-bold rounded-lg shadow-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? "Saving Exam..." : "Save Examination"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

