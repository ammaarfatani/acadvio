"use client";
import WorkspaceAnalytics from "@/components/WorkspaceAnalytics";

import { useEffect, useState } from "react";
import Link from "next/link";
import { teacherApi } from "@/lib/teacherApi";
import { useAuth } from "@/lib/auth-context";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Megaphone,
  UserCheck,
  Users,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teacherApi
      .getDashboardMetrics()
      .then((response) => setData(response.data))
      .catch((e: any) => setError(e.message || "Could not load teacher dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics || {
    assignedClassesCount: 0,
    assignedSubjectsCount: 0,
    assignedStudentsCount: 0,
    todayClassesCount: 0,
    attendancePending: false,
    pendingAttendanceCount: 0,
    pendingMarksEntries: 0,
    pendingLeaveRequests: 0,
  };

  const base = user?.school?.slug ? `/${user.school.slug}/teacher` : "/teacher";
  const classTeacherAssignments = data?.classTeacherAssignments || [];
  const isClassTeacher = classTeacherAssignments.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300 border border-zinc-700">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Teacher Portal</span>
              {data?.currentSessionName && (
                <>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-200">{data.currentSessionName}</span>
                </>
              )}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {data?.teacher?.name || user?.name || "Teacher"}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {user?.school?.name || "School"} {data?.teacher?.employeeId ? `| Employee ID: ${data.teacher.employeeId}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${base}/attendance`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 transition-colors"
            >
              <UserCheck className="h-4 w-4" />
              Take Attendance
            </Link>
            <Link
              href={`${base}/marks`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              Enter Marks
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to load dashboard data</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* CLASS TEACHER STATUS BANNER */}
      {!loading && (
        <div
          className={`rounded-2xl border p-5 transition-all shadow-sm ${
            isClassTeacher
              ? "border-amber-200 bg-amber-50/70"
              : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`rounded-xl p-2.5 shrink-0 ${
                  isClassTeacher
                    ? "bg-amber-100 text-amber-800"
                    : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {isClassTeacher ? (
                  <GraduationCap className="h-6 w-6 text-amber-700" />
                ) : (
                  <BookOpen className="h-6 w-6 text-zinc-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Class Teacher Duty Status
                  </span>
                  {isClassTeacher && (
                    <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                      Designated Class Teacher
                    </span>
                  )}
                </div>
                {isClassTeacher ? (
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    You are assigned as Class Teacher for:{" "}
                    <span className="font-bold text-amber-900 underline decoration-amber-400">
                      {classTeacherAssignments
                        .map((c: any) => `${c.className} - ${c.sectionName}`)
                        .join(", ")}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-zinc-700">
                    You are not currently designated as Class Teacher for any specific section. You can manage subject teaching, submit marks, and view timetable.
                  </p>
                )}
              </div>
            </div>

            {isClassTeacher && (
              <Link
                href={`${base}/attendance`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 transition-colors shrink-0"
              >
                <UserCheck className="h-4 w-4" />
                Mark Daily Attendance
              </Link>
            )}
          </div>
        </div>
      )}

      {/* METRICS STAT CARDS */}
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                My Classes
              </span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-zinc-900">
              {metrics.assignedClassesCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Assigned grade sections</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                My Subjects
              </span>
              <div className="rounded-xl bg-purple-50 p-2 text-purple-600">
                <BookOpen className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-zinc-900">
              {metrics.assignedSubjectsCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Active teaching subjects</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Total Students
              </span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-zinc-900">
              {metrics.assignedStudentsCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">In assigned classes</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Classes Today
              </span>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-zinc-900">
              {metrics.todayClassesCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {metrics.attendancePending
                ? `${metrics.pendingAttendanceCount} attendance pending`
                : "All attendance up to date"}
            </p>
          </div>
        </div>
      )}

      {/* DASHBOARD SECTIONS */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* TODAY'S TIMETABLE SCHEDULE (2 columns) */}
        <section className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-red-600" />
                Today&apos;s Schedule
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Your period schedule for today
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
              href={`${base}/timetable`}
            >
              Full Timetable
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {data?.todayTimetable?.length ? (
            <div className="mt-4 space-y-3">
              {data.todayTimetable.map((item: any, idx: number) => (
                <div
                  key={item._id || idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 hover:border-zinc-200 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white font-bold text-xs">
                      {item.startTime}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 text-base">
                        {item.subjectName || item.subjectId?.name || "Subject"}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-500">
                        <span className="font-medium text-zinc-700">
                          {item.className || item.classId?.name} - {item.sectionName || item.sectionId?.name || "All Sections"}
                        </span>
                        {item.roomNumber && (
                          <>
                            <span>•</span>
                            <span className="rounded bg-zinc-200/60 px-1.5 py-0.5 text-zinc-700">
                              Room {item.roomNumber}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>{item.startTime} – {item.endTime}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-0 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      Period {item.periodNumber || idx + 1}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 text-center py-8">
              <Clock className="mx-auto h-10 w-10 text-zinc-300" />
              <p className="mt-2 text-sm font-semibold text-zinc-700">No classes scheduled for today</p>
              <p className="mt-1 text-xs text-zinc-500">Enjoy your preparation time or check your full weekly timetable.</p>
            </div>
          )}
        </section>

        {/* SIDE COLUMN: UPCOMING EXAMS & ANNOUNCEMENTS */}
        <div className="space-y-6">
          {/* UPCOMING EXAMS */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-emerald-600" />
                Upcoming Examinations
              </h2>
              <Link
                className="text-xs font-bold text-red-600 hover:text-red-700"
                href={`${base}/marks`}
              >
                Marks Entry
              </Link>
            </div>

            {data?.upcomingExams?.length ? (
              <ul className="mt-4 space-y-3">
                {data.upcomingExams.map((exam: any) => (
                  <li
                    key={exam._id}
                    className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 text-sm"
                  >
                    <p className="font-semibold text-zinc-900">{exam.title}</p>
                    <div className="flex items-center justify-between mt-1 text-xs text-zinc-500">
                      <span>{new Date(exam.startDate).toLocaleDateString()}</span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 uppercase">
                        {exam.status || "SCHEDULED"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-zinc-500 italic py-4 text-center">
                No active or upcoming examinations assigned.
              </p>
            )}
          </section>

          {/* SCHOOL ANNOUNCEMENTS */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amber-600" />
                Announcements
              </h2>
              <Link
                className="text-xs font-bold text-red-600 hover:text-red-700"
                href={`${base}/announcements`}
              >
                View All
              </Link>
            </div>

            {data?.announcements?.length ? (
              <ul className="mt-4 space-y-3">
                {data.announcements.map((item: any) => (
                  <li
                    key={item._id}
                    className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 text-sm"
                  >
                    <p className="font-semibold text-zinc-900">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-600 line-clamp-2">{item.content}</p>
                    <p className="mt-1.5 text-[10px] text-zinc-400 font-medium">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-zinc-500 italic py-4 text-center">
                No school announcements posted yet.
              </p>
            )}
          </section>
        </div>
      </div>
    <WorkspaceAnalytics/>
</div>
  );
}

