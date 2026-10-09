"use client";


import {Presence} from "@/components/Motion";
import Link from "next/link";

import { useEffect, useState } from "react";
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  School,
  User,
  Mail,
  Phone,
  Calendar,
  X
} from "lucide-react";
import { superAdminApi } from "@/lib/superAdminApi";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingApp, setRejectingApp] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getPendingSchools();
      if (res?.data) setApplications(res.data);
    } catch (e) { console.error("Unable to load pending applications:", e); setApplications([]); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    const timer = window.setInterval(fetchPending, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const handleApprove = async (schoolId: string, schoolName: string) => {
    try {
      await superAdminApi.approveSchool(schoolId);
      setNotice(`School '${schoolName}' approved successfully! 14-Day Free Trial activated.`);
      fetchPending();
    } catch (err: any) {
      setNotice(err.message || `Could not approve '${schoolName}'. Please try again.`);
      fetchPending();
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingApp) return;

    try {
      await superAdminApi.rejectSchool(rejectingApp._id, rejectReason);
      setNotice(`Application for '${rejectingApp.name}' rejected.`);
      fetchPending();
    } catch (err: any) {
      setNotice(err.message || `Could not reject '${rejectingApp.name}'. Please try again.`);
      fetchPending();
    } finally {
      setRejectingApp(null);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Pending Institutional Applications
          </h1>
          <p className="text-xs text-zinc-500">Review public trial registrations and activate 14-day free trials</p>
        </div>
        <button
          onClick={fetchPending}
          className="p-2.5 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 rounded-xl hover:bg-zinc-50 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-700 font-bold">Dismiss</button>
        </div>
      )}

      {/* Cards List for Applications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {applications.length === 0 ? (
          <div className="col-span-2 bg-white border border-zinc-200 p-12 rounded-2xl text-center text-zinc-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <div className="text-base font-bold text-zinc-950">Zero Pending Applications</div>
            <p className="text-xs">All school trial requests have been reviewed and approved!</p>
          </div>
        ) : (
          applications.map((app) => (
            <div
              key={app._id}
              className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-950">{app.name}</h3>
                    <span className="text-[11px] text-zinc-500 font-mono">Applied: {new Date(app.createdAt).toLocaleString()}</span>
                  </div>
                  <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-extrabold uppercase">
                    {app.plan === "FREE_TRIAL" ? "14-Day Free Trial" : app.plan+" Plan"}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-zinc-700 font-medium">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-red-500 shrink-0" /><span>{app.adminName || "Admin not available"}</span></div>
                  {app.adminEmail && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-red-500 shrink-0" /><span className="font-mono">{app.adminEmail}</span></div>}
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-red-500 shrink-0" /><span>Pending approval</span></div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="font-mono">{app.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="font-mono">{app.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{app.address || "Address provided"}</span>
                  </div>
                  <div className="pt-2 flex justify-between text-zinc-600 border-t border-zinc-100">
                    <span>Student Scale: <strong>{app.studentCountRange || "Not provided"}</strong></span>
                    <span>Teachers: <strong>{app.teacherCount ?? 0}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-zinc-100">
                {app.registrationType === "paid" ? <Link href="/super-admin/payments" className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-center text-xs font-bold text-white">Review Payment</Link> : <button
                  onClick={() => handleApprove(app._id, app.name)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Start 14-Day Trial</span>
                </button>}
                <button
                  onClick={() => setRejectingApp(app)}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-red-50 text-zinc-700 hover:text-red-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* REJECT MODAL */}
      <Presence show={Boolean(rejectingApp)} kind="modal">{rejectingApp && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">Reject Application for {rejectingApp.name}</h3>
              <button onClick={() => setRejectingApp(null)} className="text-zinc-400 hover:text-zinc-950">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Reason for Rejection</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Incomplete school verification documents..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-red-600"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingApp(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</Presence>

    </div>
  );
}

