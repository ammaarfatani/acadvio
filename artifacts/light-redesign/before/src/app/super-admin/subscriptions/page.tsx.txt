"use client";



import { useEffect, useState } from "react";
import { CreditCard, Clock, CheckCircle2, ShieldAlert, RefreshCw, Sparkles, Plus, AlertCircle } from "lucide-react";
import { superAdminApi } from "@/lib/superAdminApi";

export default function SubscriptionsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getAllSchools();
      if (res?.data) setSchools(res.data);
    } catch (e) { console.error("Unable to load subscriptions:", e); setSchools([]); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleExtendTrial = async (schoolId: string, schoolName: string, days: number = 7) => {
    try {
      await superAdminApi.extendTrial(schoolId, days);
      setNotice(`Extended trial for '${schoolName}' by ${days} days.`);
      fetchSubscriptions();
    } catch (err: any) {
      setNotice(err.message || `Could not extend the trial for '${schoolName}'. Please try again.`);
      fetchSubscriptions();
    }
  };

  const handleActivateSub = async (schoolId: string, schoolName: string, plan: string) => {
    try {
      await superAdminApi.updateSubscriptionStatus(schoolId, "ACTIVE", plan);
      setNotice(`Activated paid ${plan} subscription for '${schoolName}'.`);
      fetchSubscriptions();
    } catch (err: any) {
      setNotice(err.message || `Could not activate the ${plan} subscription for '${schoolName}'. Please try again.`);
      fetchSubscriptions();
    }
  };

  const calculateDaysRemaining = (trialEndsAt?: string) => {
    if (!trialEndsAt) return 0;
    const diffMs = new Date(trialEndsAt).getTime() - new Date().getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Trial & Subscription Ledger Management
          </h1>
          <p className="text-xs text-zinc-500">Monitor active 14-day free trials, extend durations, and convert paid subscriptions</p>
        </div>
        <button
          onClick={fetchSubscriptions}
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

      {/* Subscriptions Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="p-3.5">School Name</th>
                <th className="p-3.5">SaaS Plan</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Trial Start</th>
                <th className="p-3.5">Trial Expiry</th>
                <th className="p-3.5">Days Left</th>
                <th className="p-3.5 text-right">Subscription Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {schools.map((s) => {
                const daysRemaining = calculateDaysRemaining(s.trialEndsAt);
                return (
                  <tr key={s._id} className="hover:bg-zinc-50">
                    <td className="p-3.5 font-bold text-zinc-950">{s.name}</td>
                    <td className="p-3.5">
                      <span className="bg-zinc-100 text-zinc-900 border border-zinc-200 px-2.5 py-0.5 rounded text-[10px] font-extrabold">
                        {s.plan}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.status === "TRIAL"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : s.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-red-100 text-red-700 border border-red-200"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-zinc-600">
                      {s.trialStartedAt ? new Date(s.trialStartedAt).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="p-3.5 font-mono text-zinc-600">
                      {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {daysRemaining} Days
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleExtendTrial(s._id, s.name, 7)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold"
                        >
                          + 7 Days
                        </button>
                        <button
                          onClick={() => handleActivateSub(s._id, s.name, s.plan)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs"
                        >
                          Activate Paid Sub
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
