"use client";



import {Presence} from "@/components/Motion";
import { useEffect, useState, useCallback, FormEvent } from "react";
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Building2,
  AlertCircle,
  Tag,
  Filter,
} from "lucide-react";
import { receptionistApi } from "@/lib/receptionistApi";

export default function ReceptionistRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showLogForm, setShowLogForm] = useState(false);
  const [form, setForm] = useState({
    requesterName: "",
    requesterType: "PARENT",
    phone: "",
    requestType: "GENERAL",
    studentName: "",
    studentRollNo: "",
    className: "",
    assignedDepartment: "ADMIN",
    details: "",
  });

  const [resolvingRequest, setResolvingRequest] = useState<any>(null);
  const [resolutionStatus, setResolutionStatus] = useState("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await receptionistApi.getRequests({
        search,
        status: statusFilter,
        department: departmentFilter,
        requestType: typeFilter,
        page,
        limit: 25,
      });
      setRequests(res?.data?.requests || []);
      setTotal(res?.data?.total || 0);
      setPages(res?.data?.pages || 1);
    } catch (err: any) {
      setError(err?.message || "Unable to load requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, departmentFilter, typeFilter, page]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleCreateRequest = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await receptionistApi.createRequest(form);
      setNotice(`Request ${res?.data?.requestNumber || ""} successfully recorded and assigned to ${form.assignedDepartment}.`);
      setForm({
        requesterName: "",
        requesterType: "PARENT",
        phone: "",
        requestType: "GENERAL",
        studentName: "",
        studentRollNo: "",
        className: "",
        assignedDepartment: "ADMIN",
        details: "",
      });
      setShowLogForm(false);
      setPage(1);
      await loadRequests();
      setTimeout(() => setNotice(""), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to record request.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!resolvingRequest) return;
    setSaving(true);
    setError("");
    try {
      await receptionistApi.updateRequest(resolvingRequest._id, {
        status: resolutionStatus,
        resolutionNotes,
      });
      setNotice(`Request ${resolvingRequest.requestNumber} status updated.`);
      setResolvingRequest(null);
      setResolutionNotes("");
      await loadRequests();
      setTimeout(() => setNotice(""), 3500);
    } catch (err: any) {
      setError(err?.message || "Failed to update request status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <FileText className="h-6 w-6 text-school-primary" />
            Front Desk Requests & Inquiries Intake
          </h1>
          <p className="text-xs text-zinc-500">
            Intake student/parent front-desk requests, route to administration wings, and track resolution progress.
          </p>
        </div>

        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-school-primary text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-90 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showLogForm ? "Close Form" : "Log New Request"}</span>
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

      {/* CREATE FORM */}
      {showLogForm && (
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-zinc-950 border-b border-zinc-100 pb-2">
            Log Student or Parent Front-Desk Request
          </h2>

          <form onSubmit={handleCreateRequest} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Requester Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Kamran Shafi"
                value={form.requesterName}
                onChange={(e) => setForm({ ...form, requesterName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Requester Type</label>
              <select
                value={form.requesterType}
                onChange={(e: any) => setForm({ ...form, requesterType: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              >
                <option value="PARENT">Parent / Guardian</option>
                <option value="STUDENT">Student</option>
                <option value="VISITOR">Visitor</option>
                <option value="STAFF">Staff Member</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Contact Phone *</label>
              <input
                type="text"
                required
                placeholder="e.g. 0333-1234567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Request Nature</label>
              <select
                value={form.requestType}
                onChange={(e: any) => setForm({ ...form, requestType: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              >
                <option value="CERTIFICATE">Certificate / Transcript Request</option>
                <option value="STUDENT_RECORD">Student Record Update</option>
                <option value="DOCUMENT_SUBMISSION">Document Submission</option>
                <option value="FEE_QUERY">Fee / Payment Query</option>
                <option value="ADMISSION_QUERY">Admission Inquiries</option>
                <option value="GENERAL">General Request / Complaint</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Assign to Department Wing</label>
              <select
                value={form.assignedDepartment}
                onChange={(e: any) => setForm({ ...form, assignedDepartment: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-semibold"
              >
                <option value="ADMIN">Principal & School Admin</option>
                <option value="FINANCE">Finance & Accounts</option>
                <option value="EXAM">Examination Department</option>
                <option value="ACADEMIC">Academic Coordination</option>
                <option value="RECEPTION">Front Desk / Reception</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Related Student Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Bilal Kamran"
                value={form.studentName}
                onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Roll No (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 10-A-12"
                value={form.studentRollNo}
                onChange={(e) => setForm({ ...form, studentRollNo: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Class (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Class 10"
                value={form.className}
                onChange={(e) => setForm({ ...form, className: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block font-bold text-zinc-700 uppercase mb-1">Request Details *</label>
              <textarea
                required
                rows={2}
                placeholder="Describe the requester's question, document needed, or message for the department…"
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
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
                {saving ? "Saving Request…" : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & SEARCH */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Search Requests</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Requester name, request no, phone, details…"
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
            <option value="PENDING">Pending Action</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved / Complete</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Department Filter</label>
          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-semibold focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            <option value="ADMIN">School Admin</option>
            <option value="FINANCE">Finance & Accounts</option>
            <option value="EXAM">Examination</option>
            <option value="ACADEMIC">Academic Coordination</option>
            <option value="RECEPTION">Front Desk</option>
          </select>
        </div>
      </div>

      {/* REQUESTS TABLE */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[950px]">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Request No.</th>
                <th className="py-3 px-4">Requester & Contact</th>
                <th className="py-3 px-4">Request Type</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Details & Notes</th>
                <th className="py-3 px-4">Date Logged</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    Loading requests…
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No front-desk requests logged for this criteria.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r._id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-900">
                      {r.requestNumber}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-zinc-900">
                      <p>{r.requesterName}</p>
                      <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 text-zinc-400" />
                        <span>{r.phone}</span>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">
                          ({r.requesterType})
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-800">
                      <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                        {r.requestType.replace("_", " ")}
                      </span>
                      {r.studentName && (
                        <div className="text-[10px] text-zinc-500 mt-1">
                          Student: {r.studentName} {r.className ? `(${r.className})` : ""}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-zinc-800 text-[11px]">
                        {r.assignedDepartment}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700 max-w-xs">
                      <p className="line-clamp-2">{r.details}</p>
                      {r.resolutionNotes && (
                        <p className="text-[10px] text-emerald-700 font-medium mt-1">
                          Resolution: {r.resolutionNotes}
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-zinc-600 text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          r.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "IN_PROGRESS"
                            ? "bg-blue-100 text-blue-800"
                            : r.status === "REJECTED"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setResolvingRequest(r);
                          setResolutionStatus(r.status);
                          setResolutionNotes(r.resolutionNotes || "");
                        }}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold rounded-lg transition-colors text-[11px]"
                      >
                        Update
                      </button>
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
            Showing {requests.length} of {total} requests
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

      {/* RESOLUTION MODAL */}
      <Presence show={Boolean(resolvingRequest)} kind="modal">{resolvingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleUpdateRequest}
            className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4 text-xs"
          >
            <div>
              <h2 className="text-base font-bold text-zinc-950">
                Update Request #{resolvingRequest.requestNumber}
              </h2>
              <p className="text-zinc-500 text-[11px]">
                {resolvingRequest.requesterName} ({resolvingRequest.requestType})
              </p>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">Status</label>
              <select
                value={resolutionStatus}
                onChange={(e) => setResolutionStatus(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-semibold focus:outline-none"
              >
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">
                Resolution / Response Notes
              </label>
              <textarea
                rows={3}
                placeholder="Enter actions taken or communication with the parent…"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setResolvingRequest(null)}
                className="px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-school-primary text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Status"}
              </button>
            </div>
          </form>
        </div>
      )}</Presence>
    </div>
  );
}
