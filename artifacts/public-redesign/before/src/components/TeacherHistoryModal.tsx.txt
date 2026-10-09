"use client";

import { useEffect, useState } from "react";
import { X, User, GraduationCap, Calendar, Clock, CheckSquare, ShieldCheck, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface TeacherHistoryModalProps {
  teacherId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TeacherHistoryModal({ teacherId, isOpen, onClose }: TeacherHistoryModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "assignments" | "timetable" | "attendance">("profile");

  useEffect(() => {
    if (!isOpen || !teacherId) return;

    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await apiFetch(`/school-admin/teachers/${teacherId}/history`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to load teacher history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [isOpen, teacherId]);

  if (!isOpen) return null;

  const teacher = data?.teacher;
  const profile = data?.profile;
  const teachingAssignments = data?.teachingAssignments || [];
  const classTeacherAssignments = data?.classTeacherAssignments || [];
  const timetableSlots = data?.timetableSlots || [];
  const attendanceLogs = data?.attendanceLogs || [];
  const leaveRequests = data?.leaveRequests || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl relative border border-zinc-200 overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-200 bg-zinc-950 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-600 text-white font-black flex items-center justify-center text-xl shadow-inner">
              {teacher?.name?.charAt(0) || "T"}
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {teacher?.name || "Faculty Profile"}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  teacher?.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-zinc-800 text-zinc-300"
                }`}>
                  {teacher?.status || "ACTIVE"}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                {teacher?.email} | Employee ID: {profile?.employeeId || "N/A"}
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
            <User className="w-4 h-4" /> Profile & Details
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "assignments" ? "border-red-600 text-zinc-950 font-black" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <GraduationCap className="w-4 h-4" /> Classes & Subjects ({teachingAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab("timetable")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "timetable" ? "border-red-600 text-zinc-950 font-black" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Calendar className="w-4 h-4" /> Weekly Schedule ({timetableSlots.length})
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "attendance" ? "border-red-600 text-zinc-950 font-black" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Clock className="w-4 h-4" /> Self Attendance & Leaves
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-zinc-400 animate-pulse space-y-2">
              <div className="w-8 h-8 rounded-full bg-zinc-200 mx-auto" />
              <span>Loading faculty member history...</span>
            </div>
          ) : !teacher ? (
            <div className="py-12 text-center text-xs font-medium text-zinc-500">
              No record found for this faculty member.
            </div>
          ) : (
            <>
              {/* TAB 1: PROFILE */}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Credentials</span>
                      <div className="space-y-1 text-zinc-800">
                        <div><strong className="text-zinc-950">Name:</strong> {teacher.name}</div>
                        <div><strong className="text-zinc-950">Email:</strong> {teacher.email}</div>
                        <div><strong className="text-zinc-950">Employee ID:</strong> {profile?.employeeId || "N/A"}</div>
                        <div><strong className="text-zinc-950">Qualification:</strong> {profile?.qualification || "N/A"}</div>
                        <div><strong className="text-zinc-950">Phone:</strong> {profile?.phone || "N/A"}</div>
                      </div>
                    </div>

                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Class Teacher Status</span>
                      {classTeacherAssignments.length > 0 ? (
                        <div className="space-y-1.5">
                          {classTeacherAssignments.map((cta: any) => (
                            <div key={cta._id} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-bold flex items-center justify-between">
                              <span>{cta.classId?.name || "Class"} — {cta.sectionId?.name || "Section"}</span>
                              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black uppercase">Class Teacher</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-zinc-500 italic">Not assigned as Class Teacher for any section.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ASSIGNMENTS */}
              {activeTab === "assignments" && (
                <div className="space-y-4">
                  <h3 className="font-bold text-zinc-900 text-sm">Assigned Teaching Subjects & Sections</h3>
                  {teachingAssignments.length > 0 ? (
                    <div className="divide-y border rounded-xl overflow-hidden bg-white">
                      {teachingAssignments.map((ta: any) => (
                        <div key={ta._id} className="p-3.5 flex justify-between items-center bg-white hover:bg-zinc-50">
                          <div>
                            <span className="font-bold text-zinc-950 block">{ta.subjectId?.name} ({ta.subjectId?.code || "CORE"})</span>
                            <span className="text-[11px] text-zinc-500">Class: {ta.classId?.name} — {ta.sectionId?.name}</span>
                          </div>
                          <span className="text-[10px] font-bold bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-lg border border-zinc-200">
                            {ta.academicSessionId?.name || "Active Session"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 italic bg-zinc-50 p-4 rounded-xl">No active subject teaching assignments found.</p>
                  )}
                </div>
              )}

              {/* TAB 3: TIMETABLE */}
              {activeTab === "timetable" && (
                <div className="space-y-4">
                  <h3 className="font-bold text-zinc-900 text-sm">Weekly Timetable Schedule</h3>
                  {timetableSlots.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {timetableSlots.map((slot: any) => (
                        <div key={slot._id} className="p-3 border border-zinc-200 rounded-xl bg-zinc-50 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-zinc-900">{slot.dayOfWeek} · Period {slot.periodNumber}</span>
                            <span className="text-[10px] font-mono bg-zinc-200 px-2 py-0.5 rounded text-zinc-800">{slot.startTime} - {slot.endTime}</span>
                          </div>
                          <p className="text-xs text-zinc-700 font-semibold">{slot.subjectName}</p>
                          <p className="text-[10px] text-zinc-500">{slot.classId?.name || "Class"} — Room {slot.roomNumber || "101"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 italic bg-zinc-50 p-4 rounded-xl">No timetable schedule slots defined.</p>
                  )}
                </div>
              )}

              {/* TAB 4: ATTENDANCE & LEAVES */}
              {activeTab === "attendance" && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="font-bold text-zinc-900 text-sm">Recent Self-Attendance Logs</h3>
                    {attendanceLogs.length > 0 ? (
                      <div className="divide-y border rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                        {attendanceLogs.map((log: any, idx: number) => (
                          <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                            <span className="font-mono font-bold text-zinc-800">{new Date(log.date).toLocaleDateString("en-GB")}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[10px] text-zinc-500">In: {log.arrivalTime || "08:00 AM"}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                log.status === "PRESENT" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}>
                                {log.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-400 italic bg-zinc-50 p-4 rounded-xl">No self attendance logs recorded.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-zinc-900 text-sm">Submitted Leave Requests</h3>
                    {leaveRequests.length > 0 ? (
                      <div className="divide-y border rounded-xl overflow-hidden bg-white">
                        {leaveRequests.map((req: any) => (
                          <div key={req._id} className="p-3 flex justify-between items-center">
                            <div>
                              <span className="font-bold text-zinc-950 block">{req.leaveType} Leave ({req.totalDays} days)</span>
                              <span className="text-[10px] text-zinc-500">{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase ${
                              req.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : req.status === "PENDING" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                            }`}>
                              {req.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-400 italic bg-zinc-50 p-4 rounded-xl">No leave requests submitted.</p>
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
            Close Faculty History
          </button>
        </div>
      </div>
    </div>
  );
}
