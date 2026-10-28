"use client";



import OrganizationAccountControl from "@/components/OrganizationAccountControl";
import {apiFetch} from "@/lib/api";
import {Presence} from "@/components/Motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Key,
  Calendar,
  MoreVertical,
  Plus,
  Eye,
  Edit,
  ShieldAlert,
  UserCheck,
  RefreshCw,
  X
} from "lucide-react";
import { superAdminApi } from "@/lib/superAdminApi";

export default function SuperAdminSchoolsPage() {
  const [actionBusy,setActionBusy]=useState(false);
  const [actionError,setActionError]=useState("");
  const [catalogue,setCatalogue]=useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [modalType, setModalType] = useState<"extendTrial" | "changePlan" | "resetPassword" | "suspend" | null>(null);
  const [modalInput, setModalInput] = useState<any>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getAllSchools();
      if (res?.data) setSchools(res.data);
    } catch (e:any) { setActionError(e.message||"Unable to load schools. Retry."); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
    apiFetch("/subscription-payments/plans").then(r=>setCatalogue(r.data)).catch(e=>setActionError(e.message));
  }, []);

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool||actionBusy) return;
    setActionBusy(true);setActionError("");

    try {
      if (modalType === "extendTrial") {
        await superAdminApi.extendTrial(selectedSchool._id, parseInt(modalInput.days || 7, 10));
        setActionNotice(`Trial extended by ${modalInput.days || 7} days for '${selectedSchool.name}'.`);
      } else if (modalType === "changePlan") {
        await superAdminApi.updateSubscriptionStatus(selectedSchool._id, selectedSchool.status, modalInput.plan);
        setActionNotice(`Plan updated to ${modalInput.plan} for '${selectedSchool.name}'.`);
      } else if (modalType === "suspend") {
        await apiFetch("/super-admin/schools/"+selectedSchool._id+"/account-status",{method:"PATCH",body:JSON.stringify({status:"DEACTIVATED",expectedRevision:selectedSchool.accountRevision||0})});
        setActionNotice(`School '${selectedSchool.name}' suspended.`);
      } else if (modalType === "resetPassword") {
        const details=await superAdminApi.getSchoolDetails(selectedSchool._id);
        const admin=details.data.users.find((u:any)=>u.userType==="SCHOOL_ADMIN");
        if(!admin)throw new Error("No school administrator found.");
        await apiFetch("/auth/forgot-password",{method:"POST",body:JSON.stringify({email:admin.email})});
        setActionNotice("Password reset instructions requested. No password was exposed or changed by this action.");
      }
      await fetchSchools();setModalType(null);setSelectedSchool(null);
    } catch (err: any) { setActionError(err.message||"The action could not be completed. Please retry."); }
    finally {setActionBusy(false);}
  };

  const filteredSchools = schools.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {actionError&&<p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            School Directory & Tenant Control
          </h1>
          <p className="text-xs text-zinc-500">Manage school statuses, plans, trials, and admin access cross-platform</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSchools}
            className="p-2.5 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 rounded-xl hover:bg-zinc-50 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-emerald-700 font-bold">Dismiss</button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search school name, email, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs text-zinc-500 font-semibold shrink-0">Filter Status:</span>
          {["ALL", "TRIAL", "ACTIVE", "PENDING_APPROVAL", "SUSPENDED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                statusFilter === st
                  ? "bg-zinc-950 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Schools Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="p-3.5">School Name & Code</th>
                <th className="p-3.5">Contact Email</th>
                <th className="p-3.5">Plan</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Scale</th>
                <th className="p-3.5">Trial / Expiry</th>
                <th className="p-3.5">Account access</th><th className="p-3.5 text-right">Tenant Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    No schools matching criteria.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s) => (
                  <tr key={s._id} className="hover:bg-zinc-50/80">
                    <td className="p-3.5">
                      <div className="font-bold text-zinc-950 text-sm">{s.name}</div>
                      <div className="text-[11px] font-mono text-zinc-500">Domain: {s.code}.acadivo.com</div>
                    </td>

                    <td className="p-3.5 font-mono text-zinc-600">{s.email}</td>

                    <td className="p-3.5">
                      <span className="bg-zinc-100 text-zinc-900 border border-zinc-200 px-2 py-0.5 rounded text-[10px] font-bold">
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
                            : s.status === "PENDING_APPROVAL"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : "bg-zinc-200 text-zinc-800"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="font-semibold text-zinc-800">{s.studentCountRange || "Not configured"} Students</div>
                      <div className="text-[10px] text-zinc-500">{s.teacherCount ?? 0} Teachers</div>
                    </td>

                    <td className="p-3.5 font-mono text-zinc-600">
                      {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : "N/A"}
                    </td>

                    <td className="p-3.5"><OrganizationAccountControl school={s} onChanged={fetchSchools}/></td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/super-admin/schools/${s._id}`}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg"
                          title="View Full School Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        
                        <button
                          onClick={() => { setSelectedSchool(s); setModalType("extendTrial"); setModalInput({ days: 7 }); }}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold"
                        >
                          + Trial
                        </button>

                        <button
                          onClick={() => { setSelectedSchool(s); setModalType("changePlan"); setModalInput({ plan: s.plan }); }}
                          className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 rounded text-[11px] font-semibold"
                        >
                          Plan
                        </button>

                        <button
                          onClick={() => { setSelectedSchool(s); setModalType("resetPassword"); }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Reset Admin Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => { setSelectedSchool(s); setModalType("suspend"); }}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg"
                          title="Deactivate organization"
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DIALOG FOR ACTIONS */}
      <Presence show={Boolean(modalType && selectedSchool)} kind="modal">{modalType && selectedSchool && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">
                {modalType === "extendTrial" && `Extend Trial for ${selectedSchool.name}`}
                {modalType === "changePlan" && `Change Plan for ${selectedSchool.name}`}
                {modalType === "resetPassword" && `Reset Admin Password for ${selectedSchool.name}`}
                {modalType === "suspend" && `Confirm Suspension of ${selectedSchool.name}`}
              </h3>
              <button onClick={() => setModalType(null)} className="text-zinc-400 hover:text-zinc-950">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form aria-label="School account action" onSubmit={handleActionSubmit} className="space-y-4">
              
              {modalType === "extendTrial" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Select Days to Add</label>
                  <select
                    value={modalInput.days || 7}
                    onChange={(e) => setModalInput({ ...modalInput, days: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold"
                  >
                    <option value={7}>Add 7 Days</option>
                    <option value={14}>Add 14 Days</option>
                    <option value={30}>Add 30 Days</option>
                  </select>
                </div>
              )}

              {modalType === "changePlan" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Select SaaS Plan</label>
                  <select
                    value={modalInput.plan || selectedSchool.plan}
                    onChange={(e) => setModalInput({ ...modalInput, plan: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold"
                  >
                    {catalogue.map(p=><option value={p.code} key={p.code}>{p.name} (PKR {p.priceMonthlyPKR.toLocaleString()}/mo)</option>)}
                  </select>
                </div>
              )}

              {modalType === "resetPassword" && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-600">
                    Request password reset instructions for <strong>{selectedSchool.email}</strong>. An expiring reset link will be emailed to the registered school administrator.
                  </p>

                </div>
              )}

              {modalType === "suspend" && (
                <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold">Deactivate organization</div>
                  <p>Deactivation preserves all data and subscription dates. Staff access is restricted; administrator billing remains available.</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={actionBusy}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  {actionBusy?"Saving...":"Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</Presence>

    </div>
  );
}
