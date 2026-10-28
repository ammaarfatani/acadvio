"use client";
import { StaffAvatar } from "@/components/StudentAvatar";
import { confirmAction } from "@/components/ConfirmationHost";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
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
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d, e] = await Promise.all([
        schoolAdminApi.getSchoolUsers(),
        apiFetch("/workforce/departments/initialize", {
          method: "POST",
          body: "{}",
        }),
        apiFetch("/workforce/employees"),
      ]);
      setDepartments(d.data);
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
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-6 pb-12">
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
      <form
        className={card + " grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}
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
        <h2 className="text-lg font-semibold sm:col-span-2 lg:col-span-3">
          Create staff account
        </h2>
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
        <button disabled={busy} className={button}>
          {busy ? "Saving…" : "Create staff account"}
        </button>
      </form>
      <details className={card}>
        <summary className="cursor-pointer text-sm font-semibold">
          Manage departments
        </summary>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiFetch("/workforce/departments", {
                method: "POST",
                body: JSON.stringify({ name: departmentName }),
              });
              setDepartmentName("");
              await load();
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <Text
            label="New department name"
            value={departmentName}
            placeholder="e.g. Student Affairs"
            onChange={setDepartmentName}
          />
          <button className={button}>Add department</button>
        </form>
      </details>
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
        <Table
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
