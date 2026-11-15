"use client";
import {WorkspaceDialog,workspacePrimary,workspaceSecondary} from "@/components/WorkspaceDialog";
import { StaffAvatar } from "@/components/StudentAvatar";
import { confirmAction } from "@/components/ConfirmationHost";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { BulkImportModal } from "@/components/BulkImportModal";
import { FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  Text,
  Select,
  Table,
  roleLabel,
  card,
  button,
} from "@/components/WorkforceUI";
const blank = {
  name: "",
  email: "",
  password: "",
  employeeId: "",
  phone: "",
  userType: "FINANCE",
  department: "",
  joiningDate: "",
  salary: "",
};
export default function StaffPage() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const { user } = useAuth();
  const [createOpen,setCreateOpen]=useState(false),[departmentOpen,setDepartmentOpen]=useState(false);
  const [users, setUsers] = useState<any[]>([]),
    [departments, setDepartments] = useState<any[]>([]),
    [form, setForm] = useState(blank),
    [departmentName, setDepartmentName] = useState(""),
    [search, setSearch] = useState(""),
    [role, setRole] = useState(""),
    [dept, setDept] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [financePayrollAccess,setFinancePayrollAccess]=useState<{enabled:boolean;financeAccounts:number}|null>(null),[accessBusy,setAccessBusy]=useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d, e] = await Promise.all([
        schoolAdminApi.getSchoolUsers(),
        apiFetch("/workforce/departments"),
        apiFetch("/workforce/employees"),
      ]);
      setDepartments(d.data.length?d.data:(await apiFetch("/workforce/departments/initialize",{method:"POST",body:"{}"})).data);
      if(user?.permissions?.includes("payroll.manage")){
        try{const access=await apiFetch("/users/finance-payroll-access");setFinancePayrollAccess(access.data)}catch{setFinancePayrollAccess(null)}
      }
      setError("");
      setUsers(
        u.data
          .filter((u: any) => !["PARENT", "SUPER_ADMIN"].includes(u.userType))
          .map((u: any) => ({
            ...u,
            employment: e.data.find((e: any) => e._id === u._id)?.employment,
          })),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.permissions]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-6 pb-12">
      {bulkOpen && (
        <BulkImportModal
          entity="staff"
          onClose={() => setBulkOpen(false)}
          onImported={load}
        />
      )}
      <header>
        <h1 className="text-2xl font-bold">Staff & roles</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Staff accounts, departments and employment details. Role selection
          determines each employee&apos;s portal access.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50"><FileSpreadsheet size={15} className="text-emerald-600" />Bulk Upload Staff</button><button className={workspacePrimary} onClick={()=>{setError("");setCreateOpen(true)}}>Create Staff Account</button><button className={workspaceSecondary} onClick={()=>{setError("");setDepartmentOpen(true)}}>Add Department</button></div>
      {user?.permissions?.includes("payroll.manage")&&<section className={card+" grid gap-5 border-l-4 border-red-600 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"}>
        <div><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">Finance salary payments</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${financePayrollAccess?.enabled?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-900"}`}>{financePayrollAccess?.enabled?"Enabled":"Review only"}</span></div><p className="mt-2 max-w-3xl text-sm text-zinc-600">{financePayrollAccess?.enabled?`Authorized Finance accounts can record approved salary payments, attach proof and notify each employee. ${financePayrollAccess.financeAccounts} Finance account(s) are covered across this school.`:"Finance can review payroll but cannot record salary payments yet. Enable this for Finance staff responsible for disbursements."}</p><p className="mt-2 text-xs leading-5 text-zinc-500">School Admins can also record payments from Monthly Payroll. Only approved payroll can be paid. Bank transfers require a reference; cash payments do not. Finance users should refresh their portal after access changes.</p>{!financePayrollAccess?.financeAccounts&&<p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">No Finance account exists yet. This permission will also apply to Finance accounts created later.</p>}</div>
        <div className="flex flex-col items-start gap-2 sm:items-end">{user?.features?.includes("MULTI_BRANCH")&&user?.isOrganizationOwner===false?<p className="max-w-56 text-sm text-zinc-600">Only the organization owner can change this school-wide setting.</p>:<button type="button" role="switch" aria-checked={!!financePayrollAccess?.enabled} disabled={accessBusy||!financePayrollAccess} className={`inline-flex min-h-11 items-center gap-3 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${financePayrollAccess?.enabled?"border-emerald-300 bg-emerald-50 text-emerald-900":"border-zinc-300 bg-white text-zinc-800"}`} onClick={async()=>{if(!financePayrollAccess)return;setAccessBusy(true);setError("");setNotice("");try{const result=await apiFetch("/users/finance-payroll-access",{method:"PATCH",body:JSON.stringify({enabled:!financePayrollAccess.enabled})});setFinancePayrollAccess({...financePayrollAccess,...result.data});setNotice(result.data.enabled?"Finance payroll payments enabled for this school. Refresh the Finance portal to load the new access.":"Finance payroll payment access disabled for this school.")}catch(e:any){setError(e.message||"Could not update Finance payroll access.")}finally{setAccessBusy(false)}}}><span aria-hidden="true" className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${financePayrollAccess?.enabled?"bg-emerald-600":"bg-zinc-300"}`}><span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${financePayrollAccess?.enabled?"translate-x-4":"translate-x-0"}`}/></span>{accessBusy?"Saving…":financePayrollAccess?.enabled?"Allow Finance to pay salaries":"Allow salary payments"}</button>}<span className="text-xs text-zinc-500">School-wide permission · server-checked</span></div>
      </section>}
      {createOpen&&<WorkspaceDialog title="Create staff account" description="Create an employee account using the existing role and department permissions." onClose={()=>{setCreateOpen(false);setForm(blank)}} busy={busy} wide>{error&&<p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}<form
        className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const created = await schoolAdminApi.createStaffUser({
              ...form,
              employeeId: undefined,
              salary: form.salary === "" ? undefined : Number(form.salary),
            });
            setCreateOpen(false);
            setForm(blank);
            setNotice(
              "Staff account created. Employee ID: " +
                (created.data?.employeeId || "View staff details"),
            );
            await load();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          ["name", "Full name", "text", "Enter full name"],
          ["email", "Work email", "email", "employee@school.com"],
          ["phone", "Phone number", "tel", "03XX-XXXXXXX"],
          ["password", "Initial password", "password", "At least 8 characters"],
          ["joiningDate", "Joining date", "date", ""],
        ].map(([k, l, t, p]) => (
          <Text
            key={k}
            label={l}
            type={t}
            minLength={k==="password"?8:k==="name"?2:undefined}
            maxLength={k==="password"?128:k==="email"?254:undefined}
            placeholder={p}
            value={form[k as keyof typeof form]}
            onChange={(v: string) => setForm({ ...form, [k]: v })}
          />
        ))}
        <Select
          label="Role / portal"
          required
          value={form.userType}
          options={["TEACHER", "FINANCE", "EXAM_STAFF", "RECEPTIONIST"]}
          onChange={(userType: string) => setForm({ ...form, userType })}
        />
        <Select
          label="Department"
          required
          value={form.department}
          options={departments.map((d) => d.name)}
          onChange={(department: string) => setForm({ ...form, department })}
        />
        <Text
          label="Monthly salary (PKR, optional)"
          required={false}
          min="0"
          type="number"
          placeholder="Enter monthly salary"
          value={form.salary}
          onChange={(salary: string) => setForm({ ...form, salary })}
        />
        <p className="text-xs text-zinc-500 sm:col-span-2 lg:col-span-3">
          New accounts are active employees. Assign teacher classes from the
          Teachers directory. Branch administrators are created through
          Organization management.
        </p>
        <footer className="flex justify-end gap-3 border-t pt-4 sm:col-span-2 lg:col-span-3"><button type="button" disabled={busy} className={workspaceSecondary} onClick={()=>{setCreateOpen(false);setForm(blank)}}>Cancel</button><button disabled={busy} className={workspacePrimary}>{busy?"Creating…":"Create staff"}</button></footer>
      </form></WorkspaceDialog>}
      <section className={card+" space-y-3"}><h2 className="font-semibold">Departments</h2><p className="text-sm text-zinc-500">Use departments to group employees and filter attendance, leave and payroll.</p><div className="flex flex-wrap gap-2">{departments.map(d=><span key={d._id} className="rounded-md border bg-zinc-50 px-3 py-2 text-sm">{d.name}</span>)}</div></section>
      {departmentOpen&&<WorkspaceDialog title="Add department" onClose={()=>setDepartmentOpen(false)} busy={busy} description="Create one department name. Existing departments are preserved."><form className="space-y-5" onSubmit={async e=>{e.preventDefault();if(busy)return;const name=departmentName.trim();if(name.length<2||name.length>100){setError("Use a department name between 2 and 100 characters.");return}if(departments.some(d=>d.name.toLocaleLowerCase()===name.toLocaleLowerCase())){setError("This department already exists. Choose it from the department list.");return}setBusy(true);setError("");try{await apiFetch("/workforce/departments",{method:"POST",body:JSON.stringify({name})});setDepartmentOpen(false);setDepartmentName("");setNotice("Department added.");await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>{error&&<p role="alert" className="text-sm text-red-800">{error}</p>}<Text label="Department name" value={departmentName} minLength={2} maxLength={100} placeholder="e.g. Student Affairs" onChange={setDepartmentName}/><footer className="flex justify-end gap-3"><button type="button" disabled={busy} className={workspaceSecondary} onClick={()=>setDepartmentOpen(false)}>Cancel</button><button disabled={busy} className={workspacePrimary}>{busy?"Adding…":"Add department"}</button></footer></form></WorkspaceDialog>}
      <div className={card + " grid gap-4 sm:grid-cols-2 lg:grid-cols-4"}>
        <Text
          label="Search staff"
          required={false}
          value={search}
          placeholder="Name, email or employee ID"
          onChange={setSearch}
        />
        <Select
          label="Role"
          empty="All roles"
          value={role}
          options={[
            "TEACHER",
            "FINANCE",
            "EXAM_STAFF",
            "RECEPTIONIST",
            "SCHOOL_ADMIN",
          ]}
          onChange={setRole}
        />
        <Select
          label="Department"
          empty="All departments"
          value={dept}
          options={departments.map((d) => d.name)}
          onChange={setDept}
        />
        <Select
          label="Account status"
          empty="All statuses"
          value={status}
          options={["ACTIVE", "INACTIVE", "DEACTIVATED"]}
          onChange={setStatus}
        />
      </div>
      {loading ? (
        <p role="status">Loading staff directory…</p>
      ) : (
        <Table searchable={false}
          headers={[
            "Employee",
            "Contact",
            "Role",
            "Department",
            "Joining date",
            "Status",
            "Action",
          ]}
          rows={users
            .filter(
              (u) =>
                (!role || u.userType === role) &&
                (!dept || u.employment?.department === dept) &&
                (!status || u.status === status) &&
                [u.name, u.email, u.employment?.employeeId]
                  .join(" ")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((u) => [
              <div key={u._id}>
                <span className="inline-flex items-center gap-2">
                  <StaffAvatar staff={u} />
                  <b>{u.name}</b>
                </span>
                <p className="text-xs text-zinc-500">
                  {u.employeeId ||
                    u.employment?.employeeId ||
                    "Assigned automatically"}
                </p>
              </div>,
              u.email + (u.employment?.phone ? " · " + u.employment.phone : ""),
              roleLabel(u.userType),
              u.employment?.department || "Not configured",
              u.employment?.joiningDate || "Not recorded",
              u.status,
              u.userType === "SCHOOL_ADMIN" ? (
                "Organization administrator"
              ) : (
                <button
                  key={u._id}
                  className="text-red-600"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !(await confirmAction(
                        (u.status === "ACTIVE" ? "Deactivate " : "Activate ") +
                          u.name +
                          "?",
                      ))
                    )
                      return;
                    try {
                      await schoolAdminApi.updateUserStatus(
                        u._id,
                        u.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE",
                      );
                      await load();
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
              ),
            ])}
        />
      )}
    </div>
  );
}
