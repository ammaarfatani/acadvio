"use client";

import { useCallback, useEffect, useState } from "react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

const staffTypes = ["FINANCE", "EXAM_STAFF", "RECEPTIONIST"];

export default function StaffPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", userType: "FINANCE" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await schoolAdminApi.getSchoolUsers(); setUsers((response.data || []).filter((u: any) => staffTypes.includes(u.userType))); setError(""); }
    catch (e: any) { setUsers([]); setError(e.message || "Could not load staff."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await schoolAdminApi.createStaffUser(form); setForm({ name: "", email: "", password: "", userType: "FINANCE" }); await load(); }
    catch (e: any) { setError(e.message || "Could not create staff account."); }
    finally { setSaving(false); }
  };
  const updateStatus = async (user: any) => {
    const status = user.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    try { await schoolAdminApi.updateUserStatus(user._id, status); await load(); }
    catch (e: any) { setError(e.message || "Could not update staff status."); }
  };
  return <div className="space-y-6 pb-12">
    <header className="border-b border-zinc-200 pb-4"><h1 className="text-2xl font-black">School Staff</h1><p className="text-sm text-zinc-500">Manage finance, examination and reception accounts for this school.</p></header>
    <form onSubmit={create} className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="rounded border px-3 py-2" />
      <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Work email" className="rounded border px-3 py-2" />
      <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Initial password" className="rounded border px-3 py-2" />
      <select value={form.userType} onChange={(e) => setForm({ ...form, userType: e.target.value })} className="rounded border px-3 py-2">{staffTypes.map((role) => <option key={role} value={role}>{role.replace("_", " ")}</option>)}</select>
      <button disabled={saving} className="rounded bg-red-600 px-4 py-2 font-semibold text-white">{saving ? "Saving…" : "Create staff account"}</button>
    </form>
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {loading ? <p role="status">Loading staff…</p> : users.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-8 text-center"><h2 className="font-semibold">No staff yet.</h2><p className="mt-1 text-sm text-zinc-500">Create your first staff account.</p></div> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-zinc-100"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{users.map((user) => <tr key={user._id} className="border-t"><td className="p-3 font-semibold">{user.name}</td><td className="p-3">{user.email}</td><td className="p-3">{user.userType.replace("_", " ")}</td><td className="p-3">{user.status}</td><td className="p-3"><button onClick={() => void updateStatus(user)} className="rounded border px-3 py-1 text-xs">{user.status === "ACTIVE" ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div>}
  </div>;
}
