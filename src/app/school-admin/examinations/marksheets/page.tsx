"use client";



import {Presence} from "@/components/Motion";
import AnnualMarksheet from "@/components/AnnualMarksheet";
import {apiFetch} from "@/lib/api";
import { useEffect, useState } from "react";
import { Printer, GraduationCap, AlertCircle, Building2 } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { useAuth } from "@/lib/auth-context";
import { useSearchParams } from "next/navigation";

interface ProcessedResultItem {
  _id: string;
  examId: string;
  examTitle: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string;
  subjectScores: Array<{
    subjectId?: string;
    subjectName: string;
    maxMarks: number;
    obtainedMarks: number;
    grade: string;
    remarks?: string;
  }>;
  totalMaxMarks: number;
  totalObtainedMarks: number;
  percentage: number;
  overallGrade: string;
  rank?: number;
  status: "PASSED" | "PROMOTED" | "FAILED";
}

export default function MarksheetsPage() {
  const { user } = useAuth();const [annual,setAnnual]=useState<any>(null);
  const searchParams = useSearchParams();

  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolProfile, setSchoolProfile] = useState<any>(null);

  const [selectedExam, setSelectedExam] = useState<string>(searchParams.get("examId") || "");
  const [selectedClass, setSelectedClass] = useState<string>(searchParams.get("classId") || "");

  const [results, setResults] = useState<ProcessedResultItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(searchParams.get("studentId") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1. Load School Profile, Exams & Classes
  useEffect(() => {
    async function loadOptions() {
      try {
        const [profileRes, examRes, classRes] = await Promise.all([
          schoolAdminApi.getSchoolProfile().catch(() => null),
          schoolAdminApi.getExamSchedules(),
          schoolAdminApi.getClasses(),
        ]);

        if (profileRes?.data) {
          setSchoolProfile(profileRes.data);
        }

        const examList = examRes?.data || [];
        const classList = classRes?.data || [];

        setExams(examList);
        setClasses(classList);

        if (!selectedExam && examList.length > 0) {
          setSelectedExam(examList[0]._id);
        }
        if (!selectedClass && classList.length > 0) {
          setSelectedClass(classList[0]._id);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load options.");
      }
    }
    loadOptions();
  }, []);

  // 2. Fetch Results for Selected Exam & Class
  useEffect(() => {
    if (!selectedExam || !selectedClass) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    schoolAdminApi
      .getResults(selectedExam, selectedClass)
      .then((res: any) => {
        const list = res?.data || (Array.isArray(res) ? res : []);
        setResults(list);
        if (list.length > 0) {
          const queryStudentId = searchParams.get("studentId");
          if (queryStudentId && list.some((r: any) => String(r.studentId) === queryStudentId)) {
            setSelectedStudentId(queryStudentId);
          } else {
            setSelectedStudentId(String(list[0].studentId));
          }
        } else {
          setSelectedStudentId("");
        }
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load examination results for marksheets.");
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [selectedExam, selectedClass]);

  const currentResult = results.find((r) => String(r.studentId) === selectedStudentId) || results[0];

  const handlePrint = () => {
    window.print();
  };

  const schoolName = schoolProfile?.name || user?.school?.name || "School ERP System";
  const logoUrl = schoolProfile?.logoUrl || user?.school?.logoUrl || "";
  const schoolAddress = schoolProfile?.address || user?.school?.address || "";
  const schoolPhone = schoolProfile?.phone || user?.school?.phone || "";

  return (
    <div className="space-y-6 pb-12"><Presence show={Boolean(annual)} kind="modal">{annual&&<AnnualMarksheet data={annual} schoolName={schoolProfile?.name||user?.school?.name} onClose={()=>setAnnual(null)}/>}</Presence><button disabled={!selectedStudentId} className="no-print rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-40" onClick={async()=>{try{setAnnual((await apiFetch("/exams/marksheet/"+selectedStudentId)).data);}catch(e:any){setError(e.message);}}}>Mid-Term & Final Term marksheet</button>
      {/* Action Toolbar */}
      <div className="print:hidden bg-white border border-zinc-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-950 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-red-600" />
            Official Academic Marksheet Generator
          </h1>
          <p className="text-xs text-zinc-500">Generate and print official student transcript certificates from real database records</p>
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

          {results.length > 0 && (
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="text-xs font-bold border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
            >
              {results.map((r) => (
                <option key={String(r.studentId)} value={String(r.studentId)}>
                  {r.studentName} (Roll: {r.rollNumber})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handlePrint}
            disabled={!currentResult}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors shadow-xs shrink-0 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print Marksheet
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm font-semibold text-zinc-500 animate-pulse bg-white border border-zinc-200 rounded-xl">
          Loading real exam results & marksheets...
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900">No Processed Marksheets Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            No processed examination marks are currently available for this exam term and class. Ensure marks are entered in Teacher Marks Entry.
          </p>
        </div>
      ) : (
        currentResult && (
          <div className="bg-white border-2 border-zinc-900 p-8 rounded-none shadow-md max-w-4xl mx-auto space-y-6 font-sans text-zinc-950 print:border-0 print:p-0 print:shadow-none print:m-0">
            {/* Header */}
            <div className="text-center border-b-2 border-zinc-900 pb-4 space-y-1">
              <div className="flex items-center justify-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt={schoolName} className="h-12 w-12 object-contain" />
                ) : (
                  <div className="w-10 h-10 bg-red-600 text-white font-black flex items-center justify-center text-xl rounded">
                    {schoolName.charAt(0)}
                  </div>
                )}
                <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">{schoolName}</h2>
              </div>
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Affiliated & Recognized Educational Institution</p>
              {schoolAddress && <p className="text-[11px] text-zinc-500 font-mono">{schoolAddress} {schoolPhone ? `| Phone: ${schoolPhone}` : ""}</p>}
              
              <div className="pt-2">
                <span className="bg-zinc-950 text-white text-xs font-bold px-4 py-1 uppercase tracking-widest inline-block">
                  Official Statement of Marks & Transcript
                </span>
              </div>
            </div>

            {/* Student Metadata Box */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-zinc-300 p-4 bg-zinc-50/50 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Student Name</span>
                <span className="font-bold text-zinc-950 text-sm">{currentResult.studentName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Roll Number</span>
                <span className="font-mono font-bold text-zinc-950 text-sm">{currentResult.rollNumber}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Admission No</span>
                <span className="font-mono text-zinc-700">{currentResult.admissionNumber || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Class</span>
                <span className="font-semibold text-zinc-800">{currentResult.className}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Exam Term</span>
                <span className="font-semibold text-zinc-800">{currentResult.examTitle}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Class Rank</span>
                <span className="font-black text-amber-600">{currentResult.rank ? `${currentResult.rank} Position` : "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Issue Date</span>
                <span className="font-mono text-zinc-700">{new Date().toLocaleDateString("en-GB")}</span>
              </div>
            </div>

            {/* Subject Marks Table */}
            <table className="w-full text-left text-xs border-collapse border border-zinc-900">
              <thead>
                <tr className="bg-zinc-900 text-white font-bold uppercase text-[10px]">
                  <th className="border border-zinc-900 p-2.5">Subject Description</th>
                  <th className="border border-zinc-900 p-2.5 w-24 text-center">Max Marks</th>
                  <th className="border border-zinc-900 p-2.5 w-24 text-center">Obtained</th>
                  <th className="border border-zinc-900 p-2.5 w-20 text-center">Grade</th>
                  <th className="border border-zinc-900 p-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {currentResult.subjectScores && currentResult.subjectScores.length > 0 ? (
                  currentResult.subjectScores.map((sub, idx) => (
                    <tr key={idx} className="border-b border-zinc-300">
                      <td className="border border-zinc-300 p-2.5 font-bold text-zinc-900">{sub.subjectName}</td>
                      <td className="border border-zinc-300 p-2.5 font-mono text-center text-zinc-600">{sub.maxMarks}</td>
                      <td className="border border-zinc-300 p-2.5 font-mono font-bold text-center text-zinc-950">{sub.obtainedMarks}</td>
                      <td className="border border-zinc-300 p-2.5 text-center font-black">{sub.grade}</td>
                      <td className="border border-zinc-300 p-2.5 text-zinc-600 text-[11px]">{sub.remarks || "Satisfactory"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-zinc-500">No subject score records found.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Aggregate Results Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-2 border-zinc-900 p-4 bg-zinc-100">
              <div className="text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Total Marks</span>
                <span className="text-base font-black font-mono">{currentResult.totalObtainedMarks} / {currentResult.totalMaxMarks}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Percentage</span>
                <span className="text-base font-black font-mono text-red-600">{currentResult.percentage}%</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Final Grade</span>
                <span className="text-base font-black">{currentResult.overallGrade}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Final Result</span>
                <span className={`text-base font-black ${currentResult.status === "PASSED" || currentResult.status === "PROMOTED" ? "text-emerald-700" : "text-red-700"}`}>
                  {currentResult.status}
                </span>
              </div>
            </div>

            {/* Signatures & Seal */}
            <div className="pt-8 grid grid-cols-3 gap-8 items-end text-center text-xs">
              <div className="border-t border-zinc-400 pt-2 font-bold text-zinc-700">
                Class Teacher Signature
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="w-20 h-20 border-2 border-dashed border-red-400 rounded-full flex flex-col items-center justify-center text-[9px] font-bold text-red-600 uppercase tracking-tighter mb-2 p-1 text-center">
                  Official Stamp & Seal
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Exam Controller</span>
              </div>
              <div className="border-t border-zinc-400 pt-2 font-bold text-zinc-700">
                Principal Signature & Seal
              </div>
            </div>

            {/* Digital Verification Footer */}
            <div className="border-t border-zinc-200 pt-3 flex justify-between items-center text-[10px] font-mono text-zinc-400">
              <span>Generated by {schoolName} ERP</span>
              <span>Verification Hash: APX-VERIFY-{currentResult._id ? currentResult._id.slice(-6) : "0000"}</span>
            </div>
          </div>
        )
      )}
    </div>
  );
}
