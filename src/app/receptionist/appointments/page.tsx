"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import {
  Calendar,
  Plus,
  Search,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Building2,
  User,
} from "lucide-react";
import { receptionistApi } from "@/lib/receptionistApi";

export default function ReceptionistAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [form, setForm] = useState({
    visitorName: "",
    phone: "",
    email: "",
    purpose: "",
    personToMeet: "",
    department: "Principal",
    appointmentDate: () => new Date().toISOString().split("T")[0],
    timeSlot: "10:00 AM - 10:30 AM",
    notes: "",
  });

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await receptionistApi.getAppointments({
        search,
        status: statusFilter,
        department: departmentFilter,
        date: dateFilter || undefined,
        page,
        limit: 25,
      });
      setAppointments(res?.data?.appointments || []);
      setTotal(res?.data?.total || 0);
      setPages(res?.data?.pages || 1);
    } catch (err: any) {
      setError(err?.message || "Unable to load appointments.");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, dateFilter, page]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const handleCreateAppointment = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await receptionistApi.createAppointment({
        ...form,
        appointmentDate: new Date(form.appointmentDate as any),
      });
      setNotice(`Appointment for ${form.visitorName} successfully booked.`);
      setForm({
        visitorName: "",
        phone: "",
        email: "",
        purpose: "",
        personToMeet: "",
        department: "Principal",
        appointmentDate: () => new Date().toISOString().split("T")[0],
        timeSlot: "10:00 AM - 10:30 AM",
        notes: "",
      });
      setShowScheduleForm(false);
      setPage(1);
      await loadAppointments();
      setTimeout(() => setNotice(""), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to schedule appointment.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (appointmentId: string, status: string) => {
    setError("");
    try {
      await receptionistApi.updateAppointment(appointmentId, { status });
      setNotice(`Appointment marked as ${status.toLowerCase()}.`);
      await loadAppointments();
      setTimeout(() => setNotice(""), 3500);
    } catch (err: any) {
      setError(err?.message || "Failed to update appointment status.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-school-primary" />
            Front Desk Appointments Desk
          </h1>
          <p className="text-xs text-zinc-500">
            Schedule and manage parent-teacher conferences, principal meetings, and external visitor appointments.
          </p>
        </div>

        <button
          onClick={() => setShowScheduleForm(!showScheduleForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-school-primary text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-90 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showScheduleForm ? "Close Form" : "Book New Appointment"}</span>
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

      {/* SCHEDULE FORM */}
      {showScheduleForm && (
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-zinc-950 border-b border-zinc-100 pb-2">
            Schedule New Meeting or Appointment
          </h2>

          <form onSubmit={handleCreateAppointment} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Visitor / Parent Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Asad Ullah"
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
                placeholder="e.g. 0321-7654321"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. asad@gmail.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Meeting Purpose *</label>
              <input
                type="text"
                required
                placeholder="e.g. Discuss grade 10 progress, Fee concession"
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
                placeholder="e.g. Principal / Mrs. Farhana"
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
                <option value="Principal">Principal Office</option>
                <option value="Vice Principal">Vice Principal</option>
                <option value="Academic Coordinator">Academic Coordinator</option>
                <option value="Finance Officer">Accounts / Finance</option>
                <option value="Teacher">Subject Teacher</option>
                <option value="Other">General Administration</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Appointment Date *</label>
              <input
                type="date"
                required
                value={form.appointmentDate as any}
                onChange={(e) => setForm({ ...form, appointmentDate: e.target.value as any })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Time Slot *</label>
              <select
                value={form.timeSlot}
                onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              >
                <option value="09:00 AM - 09:30 AM">09:00 AM - 09:30 AM</option>
                <option value="09:30 AM - 10:00 AM">09:30 AM - 10:00 AM</option>
                <option value="10:00 AM - 10:30 AM">10:00 AM - 10:30 AM</option>
                <option value="10:30 AM - 11:00 AM">10:30 AM - 11:00 AM</option>
                <option value="11:00 AM - 11:30 AM">11:00 AM - 11:30 AM</option>
                <option value="11:30 AM - 12:00 PM">11:30 AM - 12:00 PM</option>
                <option value="12:00 PM - 12:30 PM">12:00 PM - 12:30 PM</option>
                <option value="01:30 PM - 02:00 PM">01:30 PM - 02:00 PM</option>
                <option value="02:00 PM - 02:30 PM">02:00 PM - 02:30 PM</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Notes / Instructions</label>
              <input
                type="text"
                placeholder="Documents to bring, agenda…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowScheduleForm(false)}
                className="px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-school-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Scheduling…" : "Confirm Appointment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & SEARCH */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Search Appointments</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Visitor name, phone, purpose, person…"
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
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="RESCHEDULED">Rescheduled</option>
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

      {/* APPOINTMENTS TABLE */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Visitor / Parent</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Meeting With & Department</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4">Scheduled Date & Slot</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Loading appointments…
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No appointments scheduled for this selection.
                  </td>
                </tr>
              ) : (
                appointments.map((app) => (
                  <tr key={app._id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-950">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0">
                          {app.visitorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{app.visitorName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700">
                      <div className="font-mono font-semibold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-zinc-400" />
                        <span>{app.phone}</span>
                      </div>
                      {app.email && (
                        <span className="text-[10px] text-zinc-400 font-mono block">
                          {app.email}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-800">
                      <div className="font-bold text-zinc-900">{app.personToMeet}</div>
                      <span className="text-[11px] text-zinc-500 font-medium">
                        {app.department}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700 max-w-xs truncate">
                      {app.purpose}
                      {app.notes && (
                        <span className="text-[10px] text-zinc-400 block truncate">
                          Note: {app.notes}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-zinc-800">
                      <div className="font-bold">
                        {new Date(app.appointmentDate).toLocaleDateString()}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-semibold block">
                        {app.timeSlot}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          app.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : app.status === "CANCELLED"
                            ? "bg-red-100 text-red-800"
                            : app.status === "RESCHEDULED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {app.status === "SCHEDULED" ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateStatus(app._id, "COMPLETED")}
                            title="Mark Completed"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app._id, "CANCELLED")}
                            title="Cancel Appointment"
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-semibold">Archived</span>
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
            Showing {appointments.length} of {total} appointments
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
