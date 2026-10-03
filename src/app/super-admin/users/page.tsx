"use client";

import { useEffect, useState } from "react";
import { Users, Search, Key, ShieldAlert, CheckCircle2, UserCheck, RefreshCw, Filter, X } from "lucide-react";
import { superAdminApi } from "@/lib/superAdminApi";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getAllUsers(undefined, roleFilter !== "ALL" ? roleFilter : undefined, statusFilter !== "ALL" ? statusFilter : undefined);
      if (res?.data) setUsers(res.data);
    } catch (e) { console.error("Unable to load platform users:", e); setUsers([]); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleResetPassword = async (userId: string, email: string) => {
    try {
      const res = await superAdminApi.resetAdminPassword(userId);
      setNotice(`Password reset for ${email}. Temporary password: ${res.data?.tempPassword || "Generated successfully"}`);
      fetchUsers();
    } catch (err: any) {
      setNotice(err.message || `Could not reset the password for ${email}. Please try again.`);
      fetchUsers();
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.schoolId?.name && u.schoolId.name.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            Cross-Platform User Directory
          </h1>
          <p className="text-xs text-zinc-500">Manage user accounts, roles, and status across all school tenants</p>
        </div>
        <button
          onClick={fetchUsers}
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

      {/* Filters Bar */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, email, or school..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
          />
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
              <option value="TEACHER">TEACHER</option>
              <option value="FINANCE">FINANCE</option>
              <option value="EXAM_STAFF">EXAM_STAFF</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-white uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="p-3.5">User Name & Email</th>
                <th className="p-3.5">Assigned School Tenant</th>
                <th className="p-3.5">User Role Type</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Last Active</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {filteredUsers.map((u) => (
                <tr key={u._id} className="hover:bg-zinc-50">
                  <td className="p-3.5">
                    <div className="font-bold text-zinc-950">{u.name}</div>
                    <div className="text-[11px] font-mono text-zinc-500">{u.email}</div>
                  </td>
                  <td className="p-3.5">
                    {u.schoolId?.name ? (
                      <span className="font-semibold text-zinc-900">{u.schoolId.name}</span>
                    ) : (
                      <span className="text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">
                        Global Platform
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span className="bg-zinc-100 text-zinc-900 border border-zinc-200 px-2.5 py-0.5 rounded text-[10px] font-bold">
                      {u.userType}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : u.status === "PENDING_APPROVAL"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-zinc-200 text-zinc-800"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-zinc-500">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => handleResetPassword(u._id, u.email)}
                      className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 ml-auto"
                    >
                      <Key className="w-3.5 h-3.5 text-red-600" />
                      <span>Reset Password</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
