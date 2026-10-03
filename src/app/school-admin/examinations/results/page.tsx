"use client";

import { useEffect, useState } from "react";
import { Award, Trophy, CheckCircle2, RefreshCw, Search, Send, FileText, AlertCircle } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface StudentResult {
  _id: string;
  rank?: number;
  studentId: string;
  rollNumber?: string;
  rollNo?: string;
  studentName?: string;
  name?: string;
  totalMaxMarks?: number;
  totalMarks?: number;
  totalObtainedMarks?: number;
  obtainedMarks?: number;
  percentage: number;
  overallGrade?: string;
  grade?: string;
  status: "PASSED" | "PROMOTED" | "FAILED";
}

export default function ResultsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [error, setError] = useState("");

  const [results, setResults] = useState<StudentResult[]>([]);

  // 1. Initial Load of Exams & Classes
  useEffect(() => {
    async function loadOptions() {
      try {
        const [examRes, classRes] = await Promise.all([
          schoolAdminApi.getExamSchedules(),
          schoolAdminApi.getClasses(),
        ]);
        const examList = examRes?.data || [];
        const classList = classRes?.data || [];

        setExams(examList);
        setClasses(classList);

        if (examList.length > 0) setSelectedExam(examList[0]._id);
        if (classList.length > 0) setSelectedClass(classList[0]._id);
      } catch (err: any) {
        setError(err?.message || "Unable to load examination options.");
      }
    }
    loadOptions();
  }, []);

  // 2. Fetch Results when Selected Exam or Class changes
  const fetchResults = async (examId: string, classId: string) => {
    if (!examId || !classId) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res: any = await schoolAdminApi.getResults(examId, classId);
      const list = res?.data || (Array.isArray(res) ? res : []);
      setResults(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load examination results.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExam && selectedClass) {
      fetchResults(selectedExam, selectedClass);
    }
  }, [selectedExam, selectedClass]);

  const handleRecalculate = async () => {
    if (!selectedExam || !selectedClass) return;
    setCalculating(true);
    setError("");
    try {
      const res: any = await apiFetch("/exams/process", {
        method: "POST",
        body: JSON.stringify({ examId: selectedExam, classId: selectedClass }),
      });
      setNoticeMessage(res?.message || "Results re-calculated and rankings updated.");
      await fetchResults(selectedExam, selectedClass);
    } catch (err: any) {
      setError(err?.message || "Failed to re-calculate exam rankings.");
    } finally {
      setCalculating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedExam || !selectedClass) return;
    setPublishing(true);
    setError("");
    try {
      await apiFetch("/exams/publish", {
        method: "POST",
        body: JSON.stringify({ examId: selectedExam, classId: selectedClass, publish: true }),
      });
      setPublished(true);
      setTimeout(() => setPublished(false), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to publish exam results.");
    } finally {
      setPublishing(false);
    }
  };

  const filteredResults = results.filter((r) => {
    const nameStr = r.name || r.studentName || "";
    const rollStr = r.rollNo || r.rollNumber || "";
    const matchesSearch = nameStr.toLowerCase().includes(search.toLowerCase()) || rollStr.includes(search);
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalStudents = results.length;
  const passedStudents = results.filter((r) => r.status === "PASSED" || r.status === "PROMOTED").length;
  const failedStudents = results.filter((r) => r.status === "FAILED").length;
  const passRate = totalStudents > 0 ? Math.round((passedStudents / totalStudents) * 100) : 0;
  const topScorer = results.find((r) => r.rank === 1) || results[0];

  const currentExamObj = exams.find((e) => e._id === selectedExam);
  const currentClassObj = classes.find((c) => c._id === selectedClass);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Exam Results & Class Rankings
          </h1>
          <p className="text-xs text-zinc-500">Automated grade computation, merit position ranking & result publication</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRecalculate}
            disabled={calculating || !selectedExam || !selectedClass}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-600 ${calculating ? "animate-spin" : ""}`} />
            {calculating ? "Computing..." : "Re-calculate Ranks"}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || results.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            {publishing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {publishing ? "Publishing..." : "Publish Results"}
          </button>
        </div>
      </div>

      {published && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Results for <strong>{currentClassObj?.name} ({currentExamObj?.title})</strong> have been published to marksheets & student transcripts!</span>
        </div>
      )}

      {noticeMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-zinc-200 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Class Strength</span>
          <p className="text-xl font-black text-zinc-950 mt-1">{totalStudents}</p>
        </div>
        <div className="bg-white border border-emerald-200 bg-emerald-50/20 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase">Passed</span>
          <p className="text-xl font-black text-emerald-700 mt-1">{passedStudents}</p>
        </div>
        <div className="bg-white border border-red-200 bg-red-50/20 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-red-700 uppercase">Failed</span>
          <p className="text-xl font-black text-red-700 mt-1">{failedStudents}</p>
        </div>
        <div className="bg-white border border-zinc-200 p-4 rounded-xl">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Pass Rate</span>
          <p className="text-xl font-black text-zinc-950 mt-1">{passRate}%</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-4 rounded-xl shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-amber-200" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100">1st Position</span>
          </div>
          <p className="text-sm font-black truncate mt-1">{topScorer ? topScorer.name || topScorer.studentName : "N/A"}</p>
          <p className="text-[11px] text-amber-100 font-mono">
            {topScorer ? `${topScorer.percentage}% (${topScorer.obtainedMarks || topScorer.totalObtainedMarks || 0}/${topScorer.totalMarks || topScorer.totalMaxMarks || 100})` : ""}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            disabled={exams.length === 0}
            className="text-xs font-semibold border border-zinc-300 rounded-lg p-2 bg-zinc-50 focus:outline-none"
          >
            {exams.length === 0 && <option value="">No exams</option>}
            {exams.map((exam) => (
              <option key={exam._id} value={exam._id}>
                {exam.title}
              </option>
            ))}
          </select>

          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={classes.length === 0}
            className="text-xs font-semibold border border-zinc-300 rounded-lg p-2 bg-zinc-50 focus:outline-none"
          >
            {classes.length === 0 && <option value="">No classes</option>}
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.name}
              </option>
            ))}
          </select>

          <div className="flex bg-zinc-100 p-1 rounded-lg">
            {["ALL", "PASSED", "FAILED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                  statusFilter === st ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search student or roll no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs border border-zinc-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-sm font-semibold text-zinc-500 animate-pulse">
            Loading exam results & class rankings...
          </div>
        ) : filteredResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5 text-center w-16">Rank</th>
                  <th className="p-3.5 w-20 text-center">Roll No</th>
                  <th className="p-3.5">Student Name</th>
                  <th className="p-3.5 text-center">Marks Obtained</th>
                  <th className="p-3.5 text-center">Percentage</th>
                  <th className="p-3.5 text-center">Grade</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredResults.map((r, idx) => {
                  const rankNum = r.rank || idx + 1;
                  const getRankBadge = (rank: number) => {
                    if (rank === 1) return <span className="bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full text-[10px]">🥇 1st</span>;
                    if (rank === 2) return <span className="bg-slate-200 text-slate-800 font-black px-2 py-0.5 rounded-full text-[10px]">🥈 2nd</span>;
                    if (rank === 3) return <span className="bg-amber-700/20 text-amber-900 font-black px-2 py-0.5 rounded-full text-[10px]">🥉 3rd</span>;
                    return <span className="font-mono font-bold text-zinc-600">#{rank}</span>;
                  };

                  const currentGrade = r.grade || r.overallGrade || "F";
                  const getGradeBadge = (grade: string) => {
                    if (grade === "A+") return "bg-emerald-100 text-emerald-800 border-emerald-300";
                    if (grade === "A") return "bg-teal-100 text-teal-800 border-teal-300";
                    if (grade === "B") return "bg-blue-100 text-blue-800 border-blue-300";
                    if (grade === "C") return "bg-amber-100 text-amber-800 border-amber-300";
                    if (grade === "D") return "bg-orange-100 text-orange-800 border-orange-300";
                    return "bg-red-100 text-red-800 border-red-300";
                  };

                  const sName = r.name || r.studentName || "Student";
                  const rNo = r.rollNo || r.rollNumber || "—";
                  const obtMarks = r.obtainedMarks ?? r.totalObtainedMarks ?? 0;
                  const totMarks = r.totalMarks ?? r.totalMaxMarks ?? 100;

                  return (
                    <tr key={r._id || r.studentId || idx} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="p-3.5 text-center">{getRankBadge(rankNum)}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-zinc-600">{rNo}</td>
                      <td className="p-3.5 font-bold text-zinc-950">{sName}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-zinc-800">
                        {obtMarks} <span className="text-zinc-400 font-normal">/ {totMarks}</span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-zinc-950">{r.percentage}%</td>
                      <td className="p-3.5 text-center">
                        <span className={`border px-2 py-0.5 rounded text-[11px] font-black ${getGradeBadge(currentGrade)}`}>
                          {currentGrade}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {r.status === "PASSED" || r.status === "PROMOTED" ? (
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">PASSED</span>
                        ) : (
                          <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]">FAILED</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          href={`/school-admin/examinations/marksheets?studentId=${r.studentId}&examId=${selectedExam}&classId=${selectedClass}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          Marksheet
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-zinc-500">
            <Trophy className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-2 text-sm font-semibold text-zinc-700">No processed results found</p>
            <p className="mt-1 text-xs text-zinc-400">Select a valid exam and class to view or compute student merit rankings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
