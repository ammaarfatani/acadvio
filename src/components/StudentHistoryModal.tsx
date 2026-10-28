"use client";

import {StudentAvatar} from "./StudentAvatar";
import { useEffect, useState } from "react";
import { X, User, GraduationCap, Calendar, CheckSquare, Award, Phone, Mail, MapPin, FileText, ShieldCheck, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface StudentHistoryModalProps {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
  portalType?: "admin" | "teacher";
}

export function StudentHistoryModal({ studentId, isOpen, onClose, portalType = "admin" }: StudentHistoryModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "academic" | "exams" | "attendance">("profile");

  useEffect(() => {
    if (!isOpen || !studentId) return;

    async function fetchHistory() {
      setLoading(true);
      try {
        const endpoint = portalType === "teacher" 
          ? `/teacher/students/${studentId}/history` 
          : `/school-admin/students/${studentId}/history`;
        const res = await apiFetch(endpoint);
        setData(res.data);
      } catch (err) {
        console.error("Failed to load student history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [isOpen, studentId, portalType]);

  if (!isOpen) return null;

  const student = data?.student;
  const attendance = data?.attendanceSummary;
  const examResults = data?.examResults || [];
  const lifecycle = data?.lifecycleEvents || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative border border-zinc-200 overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-200 bg-zinc-950 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <StudentAvatar student={student} size={56}/>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {student?.name || "Student History"}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  student?.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-zinc-800 text-zinc-300"
                }`}>
                  {student?.status || "ACTIVE"}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Student ID: {student?.studentId || "Not recorded"} | Admission No: {student?.admissionNumber || "N/A"} | Roll No: {student?.rollNumber || "N/A"} | Class: {student?.className} ({student?.sectionName || "Sec A"})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Header Navigation */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-6 gap-2 text-xs font-bold text-zinc-600 overflow-x-auto">
          <button
            onClick={() => setActiveTab("profile")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "profile" ? "border-red-600 text-zinc-950 font-black" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <User className="w-4 h-4" /> Personal Information
          </button>
          <button
            onClick={() => setActiveTab("academic")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "academic" ? "border-red-600 text-zinc-950 font-black" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <GraduationCap className="w-4 h-4" /> Academic History
          </button>
          <button
            onClick={() => setActiveTab("exams")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "exams" ? "border-red-600 text-zinc-950 font-black" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Award className="w-4 h-4" /> Examination Records ({examResults.length})
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "attendance" ? "border-red-600 text-zinc-950 font-black" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <CheckSquare className="w-4 h-4" /> Attendance Summary
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-zinc-400 animate-pulse space-y-2">
              <div className="w-8 h-8 rounded-full bg-zinc-200 mx-auto" />
              <span>Fetching real student academic records...</span>
            </div>
          ) : !student ? (
            <div className="py-12 text-center text-xs font-medium text-zinc-500">
              No detailed history record found for this student.
            </div>
          ) : (
            <>
              {/* TAB 1: PERSONAL INFORMATION */}
              {activeTab === "profile" && (
                <div className="space-y-6 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Basic Identity</span>
                      <div className="space-y-1 text-zinc-800">
                        <div><strong className="text-zinc-950">B-Form Number:</strong> {student.bFormNumber || "Not provided"}</div>
                        <div><strong className="text-zinc-950">Full Name:</strong> {student.name}</div>
                        <div><strong className="text-zinc-950">Gender:</strong> {student.gender}</div>
                        <div><strong className="text-zinc-950">Date of Birth:</strong> {student.dob ? new Date(student.dob).toLocaleDateString("en-GB") : "N/A"}</div>
                        <div><strong className="text-zinc-950">Admission Date:</strong> {student.admissionDate ? new Date(student.admissionDate).toLocaleDateString("en-GB") : "N/A"}</div>
                      </div>
                    </div>

                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Guardian & Contact</span>
                      <div className="space-y-1 text-zinc-800">
                        <div><strong className="text-zinc-950">Father&#39;s Name:</strong> {student.parentInfo?.fatherName || "N/A"}</div>
                        <div><strong className="text-zinc-950">Father Phone:</strong> {student.parentInfo?.fatherPhone || "N/A"}</div>
                        <div><strong className="text-zinc-950">Emergency Contact:</strong> {student.emergencyContact?.name || student.parentInfo?.fatherName} ({student.emergencyContact?.phone || student.parentInfo?.fatherPhone})</div>
                        <div><strong className="text-zinc-950">Address:</strong> {student.address}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ACADEMIC HISTORY */}
              {activeTab === "academic" && (
                <div className="space-y-6 text-xs">
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3">
                    <h3 className="font-bold text-zinc-900 text-sm">Current Enrollment</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div><span className="text-[10px] text-zinc-400 uppercase block font-bold">Class</span><span className="font-black text-zinc-900">{student.className}</span></div>
                      <div><span className="text-[10px] text-zinc-400 uppercase block font-bold">Section</span><span className="font-black text-zinc-900">{student.sectionName || "Section A"}</span></div>
                      <div><span className="text-[10px] text-zinc-400 uppercase block font-bold">Academic Session</span><span className="font-black text-zinc-900">{student.academicSessionName || "Current Session"}</span></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-zinc-900 text-sm">Lifecycle & Promotion History</h3>
                    {lifecycle.length > 0 ? (
                      <div className="divide-y border rounded-xl overflow-hidden bg-white">
                        {lifecycle.map((event: any) => (
                          <div key={event._id} className="p-3 flex justify-between items-center">
                            <div>
                              <span className="font-bold text-zinc-900 block">{event.eventType}</span>
                              <span className="text-[10px] text-zinc-500">{event.remarks || "Updated by administration"}</span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">{new Date(event.createdAt).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 italic bg-zinc-50 p-4 rounded-xl">No historical transfer or promotion events logged yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: EXAM RECORDS */}
              {activeTab === "exams" && (
                <div className="space-y-6 text-xs">
                  {examResults.length > 0 ? (
                    examResults.map((result: any) => (
                      <div key={result._id} className="border border-zinc-200 rounded-xl p-4 bg-white space-y-3 shadow-xs">
                        <div className="flex justify-between items-center border-b pb-2">
                          <div>
                            <h4 className="font-black text-zinc-950 text-sm">{result.examTitle}</h4>
                            <span className="text-[10px] text-zinc-500 font-mono">Class: {result.className}</span>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              result.status === "PASSED" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            }`}>
                              {result.status}
                            </span>
                            <span className="block text-[11px] font-bold text-zinc-700 mt-0.5">
                              {result.totalObtainedMarks} / {result.totalMaxMarks} ({result.percentage}%) — Grade {result.overallGrade}
                            </span>
                          </div>
                        </div>

                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-zinc-100 text-zinc-700 font-bold text-[10px] uppercase">
                              <th className="p-2 border">Subject</th>
                              <th className="p-2 border text-center">Max Marks</th>
                              <th className="p-2 border text-center">Obtained</th>
                              <th className="p-2 border text-center">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.subjectScores?.map((s: any, idx: number) => (
                              <tr key={idx} className="border-b">
                                <td className="p-2 border font-bold text-zinc-900">{s.subjectName}</td>
                                <td className="p-2 border text-center font-mono text-zinc-600">{s.maxMarks}</td>
                                <td className="p-2 border text-center font-mono font-bold text-zinc-950">{s.obtainedMarks}</td>
                                <td className="p-2 border text-center font-black">{s.grade}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  ) : (
                    <div className="bg-zinc-50 p-8 text-center rounded-xl text-zinc-500 space-y-1">
                      <Award className="w-6 h-6 text-zinc-300 mx-auto" />
                      <p className="font-bold text-zinc-700">No Examination Results Available</p>
                      <p className="text-[11px] text-zinc-400">No official exam marks or processed results exist for this student yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ATTENDANCE SUMMARY */}
              {activeTab === "attendance" && (
                <div className="space-y-6 text-xs">
                  {attendance && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">Present Days</span>
                        <span className="text-xl font-black text-emerald-950">{attendance.presentDays}</span>
                      </div>
                      <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-red-700 uppercase block">Absent Days</span>
                        <span className="text-xl font-black text-red-950">{attendance.absentDays}</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-amber-700 uppercase block">Late Days</span>
                        <span className="text-xl font-black text-amber-950">{attendance.lateDays}</span>
                      </div>
                      <div className="bg-zinc-100 border border-zinc-300 p-3 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase block">Attendance Rate</span>
                        <span className="text-xl font-black text-zinc-950">{attendance.attendancePercentage}%</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h3 className="font-bold text-zinc-900 text-sm">Recent Attendance Logs</h3>
                    {attendance?.recentAttendance?.length > 0 ? (
                      <div className="divide-y border rounded-xl overflow-hidden bg-white max-h-60 overflow-y-auto">
                        {attendance.recentAttendance.map((log: any, idx: number) => (
                          <div key={idx} className="p-3 flex justify-between items-center text-xs">
                            <span className="font-mono font-bold text-zinc-800">{new Date(log.date).toLocaleDateString("en-GB")}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.status === "PRESENT" ? "bg-emerald-100 text-emerald-800" : log.status === "ABSENT" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              {log.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic bg-zinc-50 p-4 rounded-xl">No attendance register entries logged for this student yet.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-zinc-950 text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Close History Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
