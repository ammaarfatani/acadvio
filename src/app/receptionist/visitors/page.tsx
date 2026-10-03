"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import {
  UserCheck,
  Plus,
  Search,
  Clock,
  Phone,
  LogOut,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { receptionistApi } from "@/lib/receptionistApi";

export default function ReceptionistVisitorsPage() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split("T")[0]);

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showLogForm, setShowLogForm] = useState(false);
  const [form, setForm] = useState({
    visitorName: "",
    phone: "",
    cnicOrId: "",
    purpose: "",
    personToMeet: "",
    department: "Admin",
    studentName: "",
    studentRollNo: "",
    notes: "",
  });

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await receptionistApi.getVisitors({
        search,
        status: statusFilter,
        date: dateFilter || undefined,
        page,
        limit: 25,
      });
      setVisitors(res?.data?.visitors || []);
      setTotal(res?.data?.total || 0);
      setPages(res?.data?.pages || 1);
    } catch (err: any) {
      setError(err?.message || "Unable to load visitor logs.");
      setVisitors([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFilter, page]);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  const handleCreateVisitor = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await receptionistApi.createVisitor(form);
      setNotice(`Visitor ${form.visitorName} successfully logged into premises.`);
      setForm({
        visitorName: "",
        phone: "",
        cnicOrId: "",
        purpose: "",
        personToMeet: "",
        department: "Admin",
        studentName: "",
        studentRollNo: "",
        notes: "",
      });
      setShowLogForm(false);
      setPage(1);
      await loadVisitors();
      setTimeout(() => setNotice(""), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to log visitor.");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckout = async (visitorId: string) => {
    setError("");
    try {
      await receptionistApi.checkoutVisitor(visitorId);
      setNotice("Visitor check-out recorded.");
      await loadVisitors();
      setTimeout(() => setNotice(""), 3500);
    } catch (err: any) {
      setError(err?.message || "Failed to check out visitor.");
    }
  };

  const inPremisesCount = visitors.filter((v) => v.status === "IN_PREMISES").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-school-primary" />
            Visitor Front Desk Management
          </h1>
          <p className="text-xs text-zinc-500">
            Log visitor arrivals, record destination departments, monitor campus entry, and track check-out timestamps.
          </p>
        </div>

        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-school-primary text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-90 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showLogForm ? "Close Form" : "Log New Visitor"}</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </p>
      )}

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* NEW VISITOR FORM */}
      {showLogForm && (
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-zinc-950 border-b border-zinc-100 pb-2">
            Record Front-Desk Visitor Arrival
          </h2>

          <form onSubmit={handleCreateVisitor} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Visitor Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tariq Mehmood"
                value={form.visitorName}
                onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Contact Phone *</label>
              <input
                type="text"
                required
                placeholder="e.g. 0300-1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">CNIC / National ID</label>
              <input
                type="text"
                placeholder="e.g. 42101-1234567-1"
                value={form.cnicOrId}
                onChange={(e) => setForm({ ...form, cnicOrId: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Purpose of Visit *</label>
              <input
                type="text"
                required
                placeholder="e.g. Admission inquiry, Fee payment, Meeting"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Person to Meet *</label>
              <input
                type="text"
                required
                placeholder="e.g. Principal / Mr. Ahmed"
                value={form.personToMeet}
                onChange={(e) => setForm({ ...form, personToMeet: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Department</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              >
                <option value="Admin">Administration</option>
                <option value="Principal">Principal Office</option>
                <option value="Academic">Academic Wing</option>
                <option value="Finance">Accounts & Fee</option>
                <option value="Examination">Examination Wing</option>
                <option value="Other">General Front Desk</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Related Student (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Mustafa Kamal"
                value={form.studentName}
                onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Student Roll No (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 10-A-04"
                value={form.studentRollNo}
                onChange={(e) => setForm({ ...form, studentRollNo: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block font-bold text-zinc-700 uppercase mb-1">Notes / Remarks</label>
              <input
                type="text"
                placeholder="Security check notes, badge no…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowLogForm(false)}
                className="px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-school-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Logging Visitor…" : "Log Entry"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & SEARCH */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Search Visitors</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Visitor name, phone, purpose, person to meet…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
            />
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-3" />
          </div>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Status Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-semibold focus:outline-none"
          >
            <option value="ALL">All Visitors</option>
            <option value="IN_PREMISES">In Premises (Currently On Campus)</option>
            <option value="CHECKED_OUT">Checked Out</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Date Filter</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-semibold focus:outline-none"
          />
        </div>
      </div>

      {/* VISITORS TABLE */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Visitor</th>
                <th className="py-3 px-4">Contact & ID</th>
                <th className="py-3 px-4">Purpose & Meeting With</th>
                <th className="py-3 px-4">Related Student</th>
                <th className="py-3 px-4">Check-In Time</th>
                <th className="py-3 px-4">Check-Out Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Loading visitor records…
                  </td>
                </tr>
              ) : visitors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No visitor logs recorded for this criteria.
                  </td>
                </tr>
              ) : (
                visitors.map((v) => (
                  <tr key={v._id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-950">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-school-primary/10 text-school-primary font-bold flex items-center justify-center shrink-0">
                          {v.visitorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{v.visitorName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700">
                      <div className="font-mono font-semibold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-zinc-400" />
                        <span>{v.phone}</span>
                      </div>
                      {v.cnicOrId && (
                        <span className="text-[10px] text-zinc-400 font-mono block">
                          ID: {v.cnicOrId}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-800">
                      <div className="font-semibold text-zinc-900">{v.purpose}</div>
                      <div className="text-[11px] text-zinc-500">
                        To meet: <span className="font-bold text-zinc-700">{v.personToMeet}</span> ({v.department})
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700">
                      {v.studentName ? (
                        <div>
                          <p className="font-semibold text-zinc-900">{v.studentName}</p>
                          {v.studentRollNo && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Roll: #{v.studentRollNo}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-zinc-700">
                      {new Date(v.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      <div className="text-[10px] text-zinc-400">
                        {new Date(v.checkInTime).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-zinc-700">
                      {v.checkOutTime ? (
                        <>
                          {new Date(v.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          <div className="text-[10px] text-zinc-400">
                            {new Date(v.checkOutTime).toLocaleDateString()}
                          </div>
                        </>
                      ) : (
                        <span className="text-zinc-400">Still in premises</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          v.status === "IN_PREMISES"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {v.status === "IN_PREMISES" ? "In Premises" : "Checked Out"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {v.status === "IN_PREMISES" ? (
                        <button
                          onClick={() => handleCheckout(v._id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg border border-amber-200 transition-colors text-[11px]"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Check Out</span>
                        </button>
                      ) : (
                        <span className="text-zinc-400 text-[11px] font-semibold">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <span>
            Showing {visitors.length} of {total} visitor logs ({inPremisesCount} on campus right now)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 font-semibold"
            >
              Previous
            </button>
            <span className="font-bold text-zinc-800">
              Page {page} of {Math.max(1, pages)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
