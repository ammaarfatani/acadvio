"use client";

import { PageHeading } from "./ProductUI";
import { Megaphone, Plus, Search, RefreshCw } from "lucide-react";
import { AudiencePicker, StudentAudiencePicker } from "./AudiencePicker";

import { useCallback, useEffect, useState, useRef } from "react";

import { apiFetch } from "@/lib/api";

import { useAuth } from "@/lib/auth-context";

function localDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

const blank = {
  title: "",
  content: "",
  category: "General",
  priority: "NORMAL",
  status: "PUBLISHED",
  targetStudentIds: [] as string[],
  targetClassIds: [] as string[],
  targetSectionIds: [] as string[],
  targetRoles: [] as string[],
  branchId: "",
  publishAt: "",
  expiresAt: "",
};

export default function NoticeBoard() {
  const { user } = useAuth();
  const superAdmin = user?.userType === "SUPER_ADMIN",
    manage = superAdmin || !!user?.permissions?.includes("notices.manage");

  const [schools, setSchools] = useState<any[]>([]),
    [schoolId, setSchoolId] = useState(""),
    [meta, setMeta] = useState<any>({ roles: [], branches: [] }),
    [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [open, setOpen] = useState(false),
    [form, setForm] = useState(blank);

  const [query, setQuery] = useState(""),
    [priorityFilter, setPriorityFilter] = useState("ALL");
  const generation = useRef(0);
  const visibleRows = rows.filter(
    (row) =>
      (priorityFilter === "ALL" || row.priority === priorityFilter) &&
      [row.title, row.content]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (superAdmin)
      apiFetch("/super-admin/schools?limit=100")
        .then((r) =>
          setSchools(r.data?.schools || r.data?.items || r.data || []),
        )
        .catch((e) => setError(e.message));
  }, [superAdmin]);

  const load = useCallback(async () => {
    const version = ++generation.current;
    if (superAdmin && !schoolId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setRows([]);
    try {
      const query = superAdmin ? "&schoolId=" + schoolId : "";
      const [notices, metadata] = await Promise.all([
        apiFetch("/notices?manage=" + manage + query),
        apiFetch("/notices/meta?" + (superAdmin ? "schoolId=" + schoolId : "")),
      ]);
      if (version !== generation.current) return;
      setRows(notices.data);
      setMeta(metadata.data);
      setError("");
    } catch (e: any) {
      if (version === generation.current) setError(e.message);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [manage, schoolId, superAdmin, user?.branchId]);

  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        ...(superAdmin ? { schoolId } : {}),
        branchId:
          form.branchId ||
          (!superAdmin && !user?.isOrganizationOwner ? user?.branchId : null),
        publishAt: form.publishAt
          ? new Date(form.publishAt).toISOString()
          : undefined,
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt).toISOString()
          : null,
      };
      await apiFetch("/notices" + (editing ? "/" + editing : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setOpen(false);
      setEditing(null);
      setForm(blank);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function edit(row: any) {
    setEditing(row._id);
    setForm({
      title: row.title,
      content: row.content,
      category: row.category || "General",
      priority: row.priority || "NORMAL",
      status: row.status || "PUBLISHED",
      targetStudentIds: row.targetStudentIds || [],
      targetClassIds: row.targetClassIds || [],
      targetSectionIds: row.targetSectionIds || [],
      targetRoles: row.targetRoles || [],
      branchId: row.branchId || "",
      publishAt: row.publishAt ? localDateTime(row.publishAt) : "",
      expiresAt: row.expiresAt ? localDateTime(row.expiresAt) : "",
    });
    setOpen(true);
  }

  return (
    <div className="communication-page notice-board space-y-5 pb-10">
      <PageHeading
        eyebrow="School communications"
        title={manage ? "Announcements & Notice Board" : "School announcements"}
        description={manage ? "Publish clear updates for the right classes, families and staff." : "Updates shared by your school, organized in one place."}
        detail={
          <>
            <Megaphone size={14} />
            {rows.length} notices in this workspace
          </>
        }
        actions={
          <>
            <button
              disabled={loading}
              onClick={() => void load()}
              className="workspace-secondary-button"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
            {manage && (!superAdmin || schoolId) && (
              <button
                className="workspace-primary-button"
                onClick={() => {
                  setForm({
                    ...blank,
                    branchId:
                      !superAdmin && !user?.isOrganizationOwner
                        ? user?.branchId || ""
                        : "",
                  });
                  setEditing(null);
                  setOpen(!open);
                }}
              >
                <Plus size={16} />
                {open ? "Close editor" : "Create announcement"}
              </button>
            )}
          </>
        }
      />

      {superAdmin && (
        <label className="block text-sm">
          School
          <select
            value={schoolId}
            onChange={(e) => {
              setSchoolId(e.target.value);
              setOpen(false);
            }}
            className="ml-3 rounded-lg border p-2"
          >
            <option value="">Select school</option>
            {Array.isArray(schools) &&
              schools.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {open && (
        <form
          onSubmit={save}
          className="notice-editor space-y-5 rounded-lg border bg-white p-5 sm:p-6"
        >
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold">
              {editing ? "Edit announcement" : "New announcement"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Write the message, choose who should receive it, and set when it
              appears.
            </p>
          </div>
          <label className="block text-sm">
            Title
            <input
              required
              maxLength={180}
              minLength={3}
              placeholder="Enter a clear title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 block w-full rounded-lg border p-2"
            />
          </label>
          <label className="block text-sm">
            Content
            <textarea
              required
              minLength={3}
              maxLength={10000}
              rows={4}
              placeholder="Write the announcement for your selected audience"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-1 block w-full rounded-lg border p-2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Priority
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="mt-1 block w-full rounded-lg border p-2"
              >
                {["NORMAL", "HIGH", "URGENT"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 block w-full rounded-lg border p-2"
              >
                {["DRAFT", "PUBLISHED", "ARCHIVED"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Branch
              <select
                disabled={
                  (!superAdmin && !user?.isOrganizationOwner) || !!editing
                }
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="mt-1 block w-full rounded-lg border p-2"
              >
                {(superAdmin || user?.isOrganizationOwner) && (
                  <option value="">Organization-wide</option>
                )}
                {!meta.branches.length && user?.branchId && (
                  <option value={user.branchId}>Main branch</option>
                )}
                {meta.branches.map((b: any) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">
              Target audience{" "}
              <span className="font-normal text-zinc-500">
                (leave empty for all roles)
              </span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {meta.roles.map((r: string) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.targetRoles.includes(r)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetRoles: e.target.checked
                          ? [...form.targetRoles, r]
                          : form.targetRoles.filter((v) => v !== r),
                      })
                    }
                  />
                  {r.replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["targetStudentIds", "students", "Students"],
              ["targetClassIds", "classes", "Classes"],
              ["targetSectionIds", "sections", "Sections"],
            ].map(([key, source, label]) =>
              key === "targetStudentIds" ? (
                <div key={key} className="sm:col-span-3">
                  <StudentAudiencePicker
                    meta={meta}
                    schoolId={schoolId}
                    value={form.targetStudentIds}
                    onChange={(targetStudentIds: string[]) =>
                      setForm({ ...form, targetStudentIds })
                    }
                    onError={setError}
                  />
                </div>
              ) : (
                <AudiencePicker
                  key={key}
                  label={label}
                  options={(meta[source] || []).filter(
                    (r: any) =>
                      !form.branchId || String(r.branchId) === form.branchId,
                  )}
                  value={form[key as "targetStudentIds"]}
                  onChange={(ids: string[]) => setForm({ ...form, [key]: ids })}
                />
              ),
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Parent targeting is checked against linked children. Leave empty for
            all families in the chosen role and branch.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Publish date
              <input
                type="datetime-local"
                value={form.publishAt}
                onChange={(e) =>
                  setForm({ ...form, publishAt: e.target.value })
                }
                className="mt-1 block w-full rounded-lg border p-2"
              />
            </label>
            <label className="text-sm">
              Expiry date (optional)
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm({ ...form, expiresAt: e.target.value })
                }
                className="mt-1 block w-full rounded-lg border p-2"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <button
              disabled={saving}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {saving ? "Saving…" : "Save notice"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section
        className="communication-toolbar"
        aria-label="Announcement filters"
      >
        <label className="workspace-search">
          <Search size={16} />
          <input
            aria-label="Search announcements"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search announcements"
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-zinc-600">
          Priority
          <select
            aria-label="Filter announcement priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded border bg-white px-3 py-2"
          >
            <option value="ALL">All priorities</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
      </section>
      {loading ? (
        <p role="status" className="p-6 text-sm text-zinc-500">
          Loading notices…
        </p>
      ) : visibleRows.length ? (
        <div className="space-y-3">
          {visibleRows.map((row) => (
            <article
              key={row._id}
              className="notice-card"
              data-priority={row.priority}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-bold">{row.title}</h2>
                <span
                  className={
                    "rounded border px-3 py-1 text-xs " +
                    (row.priority === "URGENT"
                      ? "bg-red-50 text-red-700"
                      : "bg-zinc-100 text-zinc-600")
                  }
                >
                  {row.priority || "NORMAL"}
                  {manage
                    ? " · " + (row.status || "PUBLISHED")
                    : row.isRead
                      ? " · Read"
                      : " · Unread"}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {new Date(row.publishAt || row.createdAt).toLocaleString()} ·{" "}
                {row.targetRoles?.length
                  ? row.targetRoles.join(", ").replaceAll("_", " ")
                  : "All roles"}{" "}
                ·{" "}
                {row.branchId
                  ? meta.branches.find((b: any) => b._id === row.branchId)
                      ?.name || "Your branch"
                  : "Organization-wide"}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                {row.content}
              </p>
              <div className="mt-3 flex gap-4">
                {manage &&
                  (superAdmin ||
                    user?.isOrganizationOwner ||
                    String(row.branchId) === String(user?.branchId)) && (
                    <button
                      onClick={() => edit(row)}
                      className="text-xs font-semibold text-red-600"
                    >
                      Edit notice
                    </button>
                  )}
                {!superAdmin && !row.isRead && row.status !== "DRAFT" && (
                  <button
                    className="text-xs font-semibold text-red-600"
                    onClick={async () => {
                      try {
                        await apiFetch("/notices/" + row._id + "/read", {
                          method: "PATCH",
                        });
                        await load();
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-zinc-500">
          {superAdmin && !schoolId
            ? "Select a school to manage notices."
            : rows.length
              ? "No announcements match this search. Try another keyword or priority."
              : "No announcements yet. School updates will appear here when published."}
        </p>
      )}
    </div>
  );
}
