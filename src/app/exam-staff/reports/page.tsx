"use client";
import { printSchoolDocument } from "@/lib/print-school-document";

import { AcademicDocument } from "@/components/SchoolDocuments";
import { useEffect, useState } from "react";
import {
  FileText,
  Printer,
  FileSpreadsheet,
  BarChart3,
  Search,
  CheckCircle2,
  RefreshCw,
  Award,
} from "lucide-react";
import { examStaffApi } from "@/lib/examStaffApi";
import { useAuth } from "@/lib/auth-context";

export default function ExamReportsDeskPage() {
  const { user } = useAuth();
  const schoolName = user?.school?.name || "School ERP";
  const schoolLogo = user?.school?.logoUrl || "";

  const [activeReportTab, setActiveReportTab] = useState<
    "MARKSHEET" | "TABULATION" | "ANALYSIS"
  >("MARKSHEET");

  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const [results, setResults] = useState<any[]>([]);
  const [tabulationData, setTabulationData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([examStaffApi.getSchedules(), examStaffApi.getClasses()])
      .then(([examRes, classRes]) => {
        const exList = examRes?.data || [];
        const clsList = classRes?.data || [];
        setExams(exList);
        setClasses(clsList);
        if (exList.length > 0) setSelectedExamId(exList[0]._id);
        if (clsList.length > 0) setSelectedClassId(clsList[0]._id);
      })
      .catch((err) =>
        setError(err?.message || "Unable to load report selections."),
      );
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      examStaffApi
        .getStudents(selectedClassId)
        .then((res) => {
          const stuList = res?.data || [];
          setStudents(stuList);
          if (stuList.length > 0) setSelectedStudentId(stuList[0]._id);
        })
        .catch(() => setStudents([]));
    }
  }, [selectedClassId]);

  const loadReportData = async () => {
    if (!selectedExamId || !selectedClassId) return;

    setLoading(true);
    setError("");
    try {
      if (activeReportTab === "MARKSHEET") {
        const res = await examStaffApi.getResults(
          selectedExamId,
          selectedClassId,
        );
        setResults(res?.data || []);
      } else if (activeReportTab === "TABULATION") {
        const res = await examStaffApi.getTabulationSheet(
          selectedExamId,
          selectedClassId,
        );
        setTabulationData(res?.data || null);
      } else if (activeReportTab === "ANALYSIS") {
        const res = await examStaffApi.getAnalytics(
          selectedExamId,
          selectedClassId,
        );
        setAnalyticsData(res?.data || null);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData();
  }, [selectedExamId, selectedClassId, activeReportTab]);

  const activeStudentResult =
    results.find((r) => String(r.studentId) === String(selectedStudentId)) ||
    results[0] ||
    null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Print Toolbar */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <FileText className="h-6 w-6 text-school-primary" />
            Official Marksheets & Tabulation Reports Desk
          </h1>
          <p className="text-xs text-zinc-500">
            Generate printable student marksheets, class tabulation sheets, and
            examination performance analytics.
          </p>
        </div>

        <button
          onClick={() =>
            void printSchoolDocument().catch((e) => window.alert(e.message))
          }
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-school-primary text-white rounded-xl shadow-xs hover:opacity-90 transition-opacity shrink-0"
        >
          <Printer className="h-4 w-4" />
          Print Official Document
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="print:hidden rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800"
        >
          {error}
        </p>
      )}

      {/* Report Sub-Tab Navigation */}
      <div className="print:hidden bg-white border border-zinc-200 p-2 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setActiveReportTab("MARKSHEET")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-colors ${activeReportTab === "MARKSHEET" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            <FileText className="h-3.5 w-3.5" />
            Student Marksheet
          </button>
          <button
            onClick={() => setActiveReportTab("TABULATION")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-colors ${activeReportTab === "TABULATION" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Class Tabulation Sheet
          </button>
          <button
            onClick={() => setActiveReportTab("ANALYSIS")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-colors ${activeReportTab === "ANALYSIS" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Result Analytics
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-zinc-50 font-semibold focus:outline-none"
          >
            {exams.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.title}
              </option>
            ))}
          </select>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-zinc-50 font-semibold focus:outline-none"
          >
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {activeReportTab === "MARKSHEET" && (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="border border-zinc-300 rounded-lg px-2.5 py-1.5 bg-zinc-50 font-semibold focus:outline-none"
            >
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.rollNumber})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* REPORT CONTENT AREA */}
      {loading ? (
        <p
          role="status"
          className="print:hidden rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200"
        >
          Loading report sheet data…
        </p>
      ) : activeReportTab === "MARKSHEET" ? (
        activeStudentResult ? (
          <AcademicDocument
            school={user?.school}
            student={{
              ...students.find((s) => String(s._id) === selectedStudentId),
              name: activeStudentResult.studentName,
              rollNumber: activeStudentResult.rollNumber,
              className: activeStudentResult.className,
            }}
            exam={{ title: activeStudentResult.examTitle }}
            result={activeStudentResult}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center space-y-2">
            <h3 className="font-bold text-zinc-950 text-xs">
              No Marksheet Available
            </h3>
            <p className="text-xs text-zinc-500">
              Select an exam, class, and student to render official marksheet.
            </p>
          </div>
        )
      ) : activeReportTab === "TABULATION" ? (
        tabulationData ? (
          /* CLASS TABULATION SHEET MATRIX */
          <div data-page-size={(tabulationData.subjects||[]).length>8?"A3":"A4"} data-page-orientation="landscape" className="school-document bg-white border-2 border-zinc-900 p-6 font-sans text-xs text-zinc-950 space-y-4 print:border-0 print:p-0">
            <div className="text-center border-b-2 border-zinc-900 pb-3">
              <h2 className="font-black text-base uppercase">{schoolName}</h2>
              <h3 className="font-bold text-xs text-school-primary uppercase">
                Class Result Tabulation Sheet Matrix
              </h3>
              <p className="text-[10px] font-mono text-zinc-500">
                {tabulationData.examTitle} — {tabulationData.className}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-zinc-900 text-[11px]">
                <thead className="bg-zinc-950 text-white uppercase text-[9px] font-bold">
                  <tr>
                    <th className="border border-zinc-900 p-2">Roll</th>
                    <th className="border border-zinc-900 p-2">Student Name</th>
                    {(tabulationData.subjects || []).map((sub: any) => (
                      <th
                        key={sub._id}
                        className="border border-zinc-900 p-2 text-center"
                      >
                        {sub.name}
                      </th>
                    ))}
                    <th className="border border-zinc-900 p-2 text-center">
                      Total
                    </th>
                    <th className="border border-zinc-900 p-2 text-center">
                      %
                    </th>
                    <th className="border border-zinc-900 p-2 text-center">
                      Grade
                    </th>
                    <th className="border border-zinc-900 p-2 text-center">
                      Rank
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-300 font-mono">
                  {(tabulationData.rows || []).map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-zinc-50">
                      <td className="border border-zinc-300 p-2 font-bold">
                        {row.rollNumber}
                      </td>
                      <td className="border border-zinc-300 p-2 font-sans font-bold">
                        {row.studentName}
                      </td>
                      {(tabulationData.subjects || []).map((sub: any) => {
                        const score = row.subjectMarks?.[sub._id];
                        return (
                          <td
                            key={sub._id}
                            className="border border-zinc-300 p-2 text-center"
                          >
                            {score ? `${score.obtained}/${score.max}` : "—"}
                          </td>
                        );
                      })}
                      <td className="border border-zinc-300 p-2 text-center font-bold text-school-primary">
                        {row.totalObtained} / {row.totalMax}
                      </td>
                      <td className="border border-zinc-300 p-2 text-center font-bold">
                        {row.percentage}%
                      </td>
                      <td className="border border-zinc-300 p-2 text-center font-bold">
                        {row.grade}
                      </td>
                      <td className="border border-zinc-300 p-2 text-center font-bold">
                        #{row.rank}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-xs text-zinc-500">
            No tabulation sheet data available for this class selection.
          </div>
        )
      ) : (
        analyticsData && (
          /* RESULT PERFORMANCE ANALYTICS */
          <div className="school-document bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-6"><h2 className="text-lg font-bold">{schoolName}</h2>
            <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-3">
              <BarChart3 className="h-5 w-5 text-school-primary" />
              Class Examination Performance Analytics
            </h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">
                  Pass Percentage
                </span>
                <p className="text-2xl font-black text-emerald-700">
                  {analyticsData.passPercentage}%
                </p>
              </div>

              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">
                  Class Average Score
                </span>
                <p className="text-2xl font-black text-school-primary">
                  {analyticsData.classAverage}%
                </p>
              </div>

              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">
                  Highest Obtained Marks
                </span>
                <p className="text-2xl font-black text-zinc-950">
                  {analyticsData.highestMarks}
                </p>
              </div>

              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">
                  Lowest Obtained Marks
                </span>
                <p className="text-2xl font-black text-red-600">
                  {analyticsData.lowestMarks}
                </p>
              </div>
            </div>

            {/* Grade Distribution Breakdown */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-xs uppercase text-zinc-700">
                Overall Grade Breakdown
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                {Object.entries(analyticsData.gradeDistribution || {}).map(
                  ([grade, count]) => (
                    <div
                      key={grade}
                      className="p-3 bg-zinc-100 rounded-xl text-center border border-zinc-200"
                    >
                      <span className="font-black text-sm text-zinc-950 block">
                        {grade}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-bold">
                        {Number(count)} Students
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
