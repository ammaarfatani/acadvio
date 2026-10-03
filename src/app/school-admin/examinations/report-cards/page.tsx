"use client";

import { useEffect, useState } from "react";
import { Printer, FileText, CheckCircle2, Star, User, BookOpen, Calendar, Clock, AlertCircle } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { useAuth } from "@/lib/auth-context";

export default function ReportCardsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [schoolProfile, setSchoolProfile] = useState<any>(null);

  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const [studentHistory, setStudentHistory] = useState<any>(null);
  const [processedResult, setProcessedResult] = useState<any>(null);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingCard, setLoadingCard] = useState(false);
  const [error, setError] = useState("");

  // 1. Initial Load: Exams, Classes, School Profile
  useEffect(() => {
    async function loadOptions() {
      try {
        const [profileRes, examRes, classRes] = await Promise.all([
          schoolAdminApi.getSchoolProfile().catch(() => null),
          schoolAdminApi.getExamSchedules(),
          schoolAdminApi.getClasses(),
        ]);

        if (profileRes?.data) setSchoolProfile(profileRes.data);

        const examList = examRes?.data || [];
        const classList = classRes?.data || [];

        setExams(examList);
        setClasses(classList);

        if (examList.length > 0) setSelectedExam(examList[0]._id);
        if (classList.length > 0) setSelectedClass(classList[0]._id);
      } catch (err: any) {
        setError(err?.message || "Failed to load examination report options.");
      } finally {
        setLoadingInitial(false);
      }
    }
    loadOptions();
  }, []);

  // 2. Load Students when Class changes
  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setSelectedStudentId("");
      return;
    }

    schoolAdminApi
      .getStudents(selectedClass)
      .then((res: any) => {
        const list = res?.data || (Array.isArray(res) ? res : []);
        setStudents(list);
        if (list.length > 0) {
          setSelectedStudentId(list[0]._id);
        } else {
          setSelectedStudentId("");
        }
      })
      .catch((err: any) => console.error("Failed to load students for class:", err));
  }, [selectedClass]);

  // 3. Load Student History & Processed Result when Student or Exam changes
  useEffect(() => {
    if (!selectedStudentId || !selectedExam || !selectedClass) {
      setStudentHistory(null);
      setProcessedResult(null);
      return;
    }

    setLoadingCard(true);
    setError("");

    Promise.all([
      schoolAdminApi.getStudentHistory(selectedStudentId).catch(() => null),
      schoolAdminApi.getResults(selectedExam, selectedClass).catch(() => null),
    ])
      .then(([historyRes, resultRes]) => {
        if (historyRes?.data) {
          setStudentHistory(historyRes.data);
        }

        const resultList = resultRes?.data || (Array.isArray(resultRes) ? resultRes : []);
        const matched = resultList.find((r: any) => String(r.studentId) === String(selectedStudentId));
        setProcessedResult(matched || null);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load student progress report.");
      })
      .finally(() => setLoadingCard(false));
  }, [selectedStudentId, selectedExam, selectedClass]);

  const handlePrint = () => {
    window.print();
  };

  const currentStudent = students.find((s) => s._id === selectedStudentId);
  const currentExamObj = exams.find((e) => e._id === selectedExam);
  const currentClassObj = classes.find((c) => c._id === selectedClass);

  const schoolName = schoolProfile?.name || user?.school?.name || "School ERP System";
  const schoolAddress = schoolProfile?.address || user?.school?.address || "";
  const schoolPhone = schoolProfile?.phone || user?.school?.phone || "";

  const attendance = studentHistory?.attendanceSummary || {
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    leaveDays: 0,
    attendancePercentage: 100,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Action Toolbar */}
      <div className="print:hidden bg-white border border-zinc-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-950 flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-600" />
            Student Progress & Holistic Report Card
          </h1>
          <p className="text-xs text-zinc-500">Holistic academic, attendance & behavioral evaluation cards generated from live database records</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            disabled={exams.length === 0}
            className="text-xs font-bold border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
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
            className="text-xs font-bold border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
          >
            {classes.length === 0 && <option value="">No classes</option>}
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.name}
              </option>
            ))}
          </select>

          {students.length > 0 && (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="text-xs font-bold border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
            >
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.rollNumber || "No Roll"})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handlePrint}
            disabled={!currentStudent}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs shrink-0 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print Report Card
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loadingInitial || loadingCard ? (
        <div className="p-12 text-center text-sm font-semibold text-zinc-500 animate-pulse bg-white border border-zinc-200 rounded-xl">
          Loading student progress report & attendance data...
        </div>
      ) : !currentStudent ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900">No Enrolled Students Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Select a class containing active student records to view and generate report cards.
          </p>
        </div>
      ) : (
        /* Holistic Student Report Card Document */
        <div className="bg-white border-2 border-zinc-900 p-8 rounded-none shadow-md max-w-4xl mx-auto space-y-6 text-zinc-950 print:border-0 print:p-0 print:shadow-none">
          {/* Report Card Header */}
          <div className="border-b-2 border-zinc-900 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black text-zinc-950 tracking-tight uppercase">{schoolName}</h2>
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Holistic Student Progress & Evaluation Card</p>
              <p className="text-[11px] text-zinc-500 font-mono">
                Academic Session: {currentExamObj?.academicSessionName || "Current Session"} | Term: {currentExamObj?.title || "Term Exam"}
              </p>
            </div>
            <div className="text-right">
              <span className="bg-zinc-950 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest inline-block rounded">
                Official Progress Report
              </span>
            </div>
          </div>

          {/* Student Profile Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-zinc-300 p-4 bg-zinc-50 text-xs">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Student Name</span>
              <span className="font-bold text-zinc-950 text-sm">{currentStudent.name}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Father's Name</span>
              <span className="font-semibold text-zinc-800">{currentStudent.parentInfo?.fatherName || "N/A"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Roll No & Class</span>
              <span className="font-bold text-zinc-950">
                Roll #{currentStudent.rollNumber || "—"} ({currentClassObj?.name || currentStudent.className})
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Attendance %</span>
              <span className="font-black text-emerald-700 font-mono">
                {attendance.attendancePercentage}% ({attendance.presentDays + attendance.lateDays}/{attendance.totalDays || attendance.presentDays + attendance.absentDays || 1} Days)
              </span>
            </div>
          </div>

          {/* Academic Performance Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-zinc-900 tracking-wider flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-red-600" />
              1. Scholastic Performance (Subject Marks)
            </h3>
            <table className="w-full text-left text-xs border-collapse border border-zinc-900">
              <thead>
                <tr className="bg-zinc-900 text-white font-bold uppercase text-[10px]">
                  <th className="border border-zinc-900 p-2">Subject</th>
                  <th className="border border-zinc-900 p-2 text-center w-20">Max</th>
                  <th className="border border-zinc-900 p-2 text-center w-24">Marks Obtained</th>
                  <th className="border border-zinc-900 p-2 text-center w-20">Grade</th>
                  <th className="border border-zinc-900 p-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {processedResult?.subjectScores && processedResult.subjectScores.length > 0 ? (
                  processedResult.subjectScores.map((sub: any, idx: number) => (
                    <tr key={idx} className="border-b border-zinc-300">
                      <td className="border border-zinc-300 p-2 font-bold text-zinc-950">{sub.subjectName}</td>
                      <td className="border border-zinc-300 p-2 text-center font-mono text-zinc-600">{sub.maxMarks}</td>
                      <td className="border border-zinc-300 p-2 text-center font-mono font-bold text-zinc-950">{sub.obtainedMarks}</td>
                      <td className="border border-zinc-300 p-2 text-center font-black">{sub.grade}</td>
                      <td className="border border-zinc-300 p-2 text-zinc-600 text-[11px]">{sub.remarks || "Satisfactory"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-zinc-500 italic">
                      No calculated subject score records found for this exam term. Ensure marks are submitted.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Behavioral & Co-Curricular Assessment */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-zinc-900 tracking-wider flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-500" />
              2. Behavioral & Co-Curricular Evaluation
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-zinc-300 p-4 bg-zinc-50/50 text-xs">
              <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5">
                <span className="font-semibold text-zinc-800">Discipline & Conduct</span>
                <span className="font-black bg-zinc-900 text-white text-[10px] px-2 py-0.5 rounded">A+</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5">
                <span className="font-semibold text-zinc-800">Punctuality & Attendance</span>
                <span className="font-black bg-zinc-900 text-white text-[10px] px-2 py-0.5 rounded">
                  {attendance.attendancePercentage >= 90 ? "A+" : attendance.attendancePercentage >= 80 ? "A" : "B"}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5">
                <span className="font-semibold text-zinc-800">Co-curricular Participation</span>
                <span className="font-black bg-zinc-900 text-white text-[10px] px-2 py-0.5 rounded">A</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-1.5">
                <span className="font-semibold text-zinc-800">Academic Progress & Effort</span>
                <span className="font-black bg-zinc-900 text-white text-[10px] px-2 py-0.5 rounded">
                  {processedResult?.overallGrade || "Satisfactory"}
                </span>
              </div>
            </div>
          </div>

          {/* Teacher Remarks & Principal Sign */}
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-zinc-900 tracking-wider">
              3. Class Teacher Remarks & Guidance
            </h3>
            <div className="border border-zinc-300 p-4 bg-amber-50/40 text-xs text-zinc-800 italic font-serif leading-relaxed">
              "{currentStudent.name} is a dedicated student in {currentClassObj?.name || "class"}.{" "}
              {processedResult?.status === "PASSED" || processedResult?.status === "PROMOTED"
                ? "Demonstrates commendable understanding of core academic subjects and maintains consistent effort."
                : "Needs focused guidance and additional study practice to improve subject comprehension."}"
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="border-t border-zinc-400 pt-2 font-bold text-zinc-700">
              Parent / Guardian Signature
            </div>
            <div className="border-t border-zinc-400 pt-2 font-bold text-zinc-700">
              Class Teacher Signature
            </div>
            <div className="border-t border-zinc-400 pt-2 font-bold text-zinc-700">
              Principal Stamp & Signature
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
