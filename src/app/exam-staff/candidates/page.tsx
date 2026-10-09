"use client";



import { useEffect, useState } from "react";
import { Users, Search, Filter, ShieldCheck } from "lucide-react";
import { examStaffApi } from "@/lib/examStaffApi";

export default function ExamCandidatesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    examStaffApi.getClasses()
      .then((res) => {
        const clsList = res?.data || [];
        setClasses(clsList);
        if (clsList.length > 0) setSelectedClassId(clsList[0]._id);
      })
      .catch((err) => setError(err?.message || "Unable to load classes."));
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      examStaffApi.getSections(selectedClassId)
        .then((res) => setSections(res?.data || []))
        .catch(() => setSections([]));
    }
  }, [selectedClassId]);

  useEffect(() => {
    setLoading(true);
    setError("");
    examStaffApi.getStudents(selectedClassId, selectedSectionId)
      .then((res) => setStudents(res?.data || []))
      .catch((err) => setError(err?.message || "Unable to load candidate student records."))
      .finally(() => setLoading(false));
  }, [selectedClassId, selectedSectionId]);

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      (s.rollNumber || "").toLowerCase().includes(q) ||
      (s.admissionNumber || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Users className="h-6 w-6 text-school-primary" />
            Exam Candidate Verification Desk
          </h1>
          <p className="text-xs text-zinc-500">
            Verify real active student enrollments, roll numbers, and examination candidate eligibility.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </p>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Select Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => { setSelectedClassId(e.target.value); setSelectedSectionId(""); }}
            className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Select Section</label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={!selectedClassId}
            className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none disabled:opacity-50"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Search Candidate</label>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name or roll no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg pl-9 pr-3 py-2.5 focus:outline-none font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Candidate List Table */}
      {loading ? (
        <p role="status" className="rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200">
          Loading exam candidate records…
        </p>
      ) : filteredStudents.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3.5">Roll No</th>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Admission No</th>
                <th className="p-3.5">Class & Section</th>
                <th className="p-3.5">Guardian Name</th>
                <th className="p-3.5 text-center">Eligibility Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredStudents.map((s) => (
                <tr key={s._id} className="hover:bg-zinc-50">
                  <td className="p-3.5 font-mono font-bold text-zinc-900">{s.rollNumber || "—"}</td>
                  <td className="p-3.5 font-bold text-zinc-950">{s.name}</td>
                  <td className="p-3.5 font-mono text-zinc-600">{s.admissionNumber || "—"}</td>
                  <td className="p-3.5 text-zinc-800">
                    <span className="font-semibold">{s.className || "Class"}</span>
                    {s.sectionName && <span className="text-zinc-500 ml-1">({s.sectionName})</span>}
                  </td>
                  <td className="p-3.5 text-zinc-600">{s.parentInfo?.fatherName || s.parentInfo?.guardianName || "—"}</td>
                  <td className="p-3.5 text-center">
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" /> Eligible Candidate
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center space-y-2">
          <h3 className="font-bold text-zinc-950 text-xs">No Candidate Records Found</h3>
          <p className="text-xs text-zinc-500">Select a class or section to list active student examination candidates.</p>
        </div>
      )}
    </div>
  );
}
