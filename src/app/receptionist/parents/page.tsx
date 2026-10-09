"use client";



import { useEffect, useState, useCallback } from "react";
import { Users, Search, Phone, Mail, MapPin, User, GraduationCap } from "lucide-react";
import { receptionistApi } from "@/lib/receptionistApi";
import { useAuth } from "@/lib/auth-context";

export default function ReceptionistParentsPage() {
  const { user } = useAuth();
  const [parents, setParents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    receptionistApi
      .getClasses()
      .then((res) => setClasses(res?.data || []))
      .catch(() => setClasses([]));
  }, []);

  const loadParents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await receptionistApi.getParents({
        search,
        classId: selectedClassId || undefined,
        page,
        limit: 25,
      });
      setParents(res?.data?.parents || []);
      setTotal(res?.data?.total || 0);
      setPages(res?.data?.pages || 1);
    } catch (err: any) {
      setError(err?.message || "Unable to load parent/guardian records.");
      setParents([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedClassId, page]);

  useEffect(() => {
    void loadParents();
  }, [loadParents]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Users className="h-6 w-6 text-school-primary" />
            Parents & Guardians Directory
          </h1>
          <p className="text-xs text-zinc-500">
            Front-desk directory of parents and legal guardians linked to active enrolled students.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </p>
      )}

      {/* Filter Controls */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Search Parent / Student</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Parent name, contact phone, student name, roll no…"
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
          <label className="block font-bold text-zinc-700 uppercase mb-1">Filter by Student&#39;s Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-semibold focus:outline-none"
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Parents Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Parent / Guardian</th>
                <th className="py-3 px-4">Primary Contact</th>
                <th className="py-3 px-4">Linked Student</th>
                <th className="py-3 px-4">Class & Section</th>
                <th className="py-3 px-4">Residential Address</th>
                <th className="py-3 px-4">Emergency Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Loading parent directory…
                  </td>
                </tr>
              ) : parents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No matching parent records found.
                  </td>
                </tr>
              ) : (
                parents.map((parent, idx) => (
                  <tr key={`${parent._id}-${idx}`} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-zinc-950">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">
                          {parent.guardianName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p>{parent.guardianName}</p>
                          <span className="text-[10px] text-zinc-400 font-normal">
                            Relation: {parent.guardianRelation}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span>{parent.guardianPhone}</span>
                      </div>
                      {parent.guardianEmail && (
                        <span className="text-[10px] text-zinc-400 font-mono block">
                          {parent.guardianEmail}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-school-primary shrink-0" />
                        <span>{parent.studentName}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono block">
                        Roll: #{parent.rollNumber || "—"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700 font-medium">
                      {parent.className}{" "}
                      {parent.sectionName ? `(${parent.sectionName})` : ""}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-600 max-w-xs truncate">
                      {parent.address}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-700">
                      {parent.emergencyContact?.name ? (
                        <div>
                          <p className="font-semibold text-zinc-900">
                            {parent.emergencyContact.name}
                          </p>
                          <p className="text-[10px] font-mono text-zinc-500">
                            {parent.emergencyContact.phone}
                          </p>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
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
            Showing {parents.length} of {total} parent contacts
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
