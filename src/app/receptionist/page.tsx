"use client";
import {PageHeading} from "@/components/ProductUI";


import WorkspaceAnalytics from "@/components/WorkspaceAnalytics";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Users,
  UserCheck,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  ArrowRight,
  Plus,
  Building2,
  Search,
} from "lucide-react";
import { receptionistApi } from "@/lib/receptionistApi";
import { useAuth } from "@/lib/auth-context";

export default function ReceptionistDashboardPage() {
  const { user } = useAuth();
  const base = user?.school?.slug ? `/${user.school.slug}/staff` : "/receptionist";
  const schoolName = user?.school?.name || "School";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await receptionistApi.getDashboard();
      setData(res?.data || null);
    } catch (err: any) {
      setError(err?.message || "Unable to load receptionist dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const metrics = data?.metrics || {
    todayAdmissions: 0,
    pendingAdmissions: 0,
    totalAdmitted: 0,
    todayVisitors: 0,
    inPremisesVisitors: 0,
    todayAppointments: 0,
    pendingRequests: 0,
    totalStudents: 0,
  };

  return (
    <div className="ui-dashboard ui-dashboard--receptionist space-y-6 pb-12">
      {/* Header */}
      <PageHeading eyebrow="Reception & admissions" title="Your school’s front desk" description={<>Welcome, {user?.name || "Staff Member"}. Admissions, visitors and appointments for {schoolName}.</>} actions={<div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${base}/admissions`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-school-primary text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Admission / Inquiry</span>
          </Link>
          <Link
            href={`${base}/visitors`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Log Visitor</span>
          </Link>
        </div>}/>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </p>
      )}

      {/* METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today&#39;s Inquiries</span>
            <UserPlus className="w-4 h-4 text-school-primary" />
          </div>
          <div className="text-2xl font-black text-zinc-950">
            {loading ? "…" : metrics.todayAdmissions}
          </div>
          <p className="text-[10px] text-zinc-500">New intake inquiries today</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Admissions</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {loading ? "…" : metrics.pendingAdmissions}
          </div>
          <p className="text-[10px] text-zinc-500">Awaiting review or follow-up</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today&#39;s Visitors</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-zinc-950 flex items-baseline gap-2">
            <span>{loading ? "…" : metrics.todayVisitors}</span>
            {metrics.inPremisesVisitors > 0 && (
              <span className="text-xs font-bold text-emerald-600">
                ({metrics.inPremisesVisitors} on campus)
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500">Checked in at front desk</p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today&#39;s Appointments</span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-zinc-950">
            {loading ? "…" : metrics.todayAppointments}
          </div>
          <p className="text-[10px] text-zinc-500">Parent/visitor meetings</p>
        </div>

        {/* Metric 5 */}
        <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Enrolled</span>
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {loading ? "…" : metrics.totalAdmitted}
          </div>
          <p className="text-[10px] text-zinc-500">Successfully enrolled</p>
        </div>

        {/* Metric 6 */}
        <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Students</span>
            <Users className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="text-2xl font-black text-zinc-950">
            {loading ? "…" : metrics.totalStudents}
          </div>
          <p className="text-[10px] text-zinc-500">Current school roster</p>
        </div>

        {/* Metric 7 */}
        <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Front Desk Requests</span>
            <FileText className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-600">
            {loading ? "…" : metrics.pendingRequests}
          </div>
          <p className="text-[10px] text-zinc-500">Pending department routing</p>
        </div>

        {/* Metric 8 - Quick Search */}
        <Link
          href={`${base}/students`}
          className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-xs flex flex-col justify-between group hover:bg-zinc-800 transition-colors text-white"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Student Search</span>
            <Search className="w-4 h-4 text-school-primary" />
          </div>
          <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
            <span>Lookup Roster</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* TWO COLUMN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT INQUIRIES */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="font-bold text-sm text-zinc-950 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-school-primary" />
              Recent Admission Inquiries
            </h2>
            <Link
              href={`${base}/admissions`}
              className="text-xs font-bold text-school-primary hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <p className="p-6 text-center text-xs text-zinc-500">Loading inquiries…</p>
          ) : !data?.recentInquiries?.length ? (
            <p className="p-6 text-center text-xs text-zinc-500">No new admission inquiries today.</p>
          ) : (
            <div className="divide-y divide-zinc-100 text-xs">
              {data.recentInquiries.map((item: any) => (
                <div key={item._id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{item.studentName}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      Guardian: {item.guardianName} · {item.guardianPhone}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-zinc-100 text-zinc-700">
                      {item.applyingClassName}
                    </span>
                    <div className="mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.status === "ADMITTED"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "APPROVED"
                          ? "bg-blue-100 text-blue-800"
                          : item.status === "REJECTED"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TODAY'S UPCOMING APPOINTMENTS */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="font-bold text-sm text-zinc-950 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              Today&#39;s Scheduled Appointments
            </h2>
            <Link
              href={`${base}/appointments`}
              className="text-xs font-bold text-school-primary hover:underline flex items-center gap-1"
            >
              <span>View Desk</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <p className="p-6 text-center text-xs text-zinc-500">Loading appointments…</p>
          ) : !data?.todayUpcomingAppointments?.length ? (
            <p className="p-6 text-center text-xs text-zinc-500">No appointments scheduled for today.</p>
          ) : (
            <div className="divide-y divide-zinc-100 text-xs">
              {data.todayUpcomingAppointments.map((app: any) => (
                <div key={app._id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{app.visitorName}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      Meeting: {app.personToMeet} ({app.department})
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-[11px] text-zinc-800">
                      {app.timeSlot}
                    </span>
                    <div className="mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        app.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : app.status === "CANCELLED"
                          ? "bg-red-100 text-red-800"
                          : "bg-purple-100 text-purple-800"
                      }`}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TODAY'S VISITORS LOG */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="font-bold text-sm text-zinc-950 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Front Desk Visitors Today
            </h2>
            <Link
              href={`${base}/visitors`}
              className="text-xs font-bold text-school-primary hover:underline flex items-center gap-1"
            >
              <span>Manage Visitors</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <p className="p-6 text-center text-xs text-zinc-500">Loading visitor records…</p>
          ) : !data?.recentVisitors?.length ? (
            <p className="p-6 text-center text-xs text-zinc-500">No visitors logged yet today.</p>
          ) : (
            <div className="divide-y divide-zinc-100 text-xs">
              {data.recentVisitors.map((vis: any) => (
                <div key={vis._id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate">{vis.visitorName}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {vis.purpose} · To meet: {vis.personToMeet}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {new Date(vis.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        vis.status === "IN_PREMISES"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-zinc-100 text-zinc-600"
                      }`}>
                        {vis.status === "IN_PREMISES" ? "In Premises" : "Checked Out"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ANNOUNCEMENTS & NOTICES */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="font-bold text-sm text-zinc-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-school-primary" />
              School Notices & Circulars
            </h2>
            <Link
              href={`${base}/notifications`}
              className="text-xs font-bold text-school-primary hover:underline flex items-center gap-1"
            >
              <span>All Notices</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <p className="p-6 text-center text-xs text-zinc-500">Loading notices…</p>
          ) : !data?.announcements?.length ? (
            <p className="p-6 text-center text-xs text-zinc-500">No active circulars posted.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {data.announcements.map((item: any) => (
                <div key={item._id} className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-zinc-900">{item.title}</span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 line-clamp-2">{item.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    <WorkspaceAnalytics/>
</div>
  );
}

