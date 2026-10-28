"use client";

import { PageHeading } from "./ProductUI";
import { Search, RefreshCw, Inbox } from "lucide-react";
import { Presence } from "@/components/Motion";
import { useEffect, useState } from "react";
import { apiFetch, downloadPrivate } from "@/lib/api";
import ParentReport from "./ParentReport";
import { useAuth } from "@/lib/auth-context";
import { useParent } from "@/lib/parent-context";
const categories: Record<string, string> = {
  GENERAL: "Other documents",
  ADMISSION: "Admission documents",
  PERMISSION: "Permission forms",
  FEES: "Fee documents",
  EXAMINATION: "Academic documents",
};
export default function ParentResources({
  kind,
}: {
  kind: "documents" | "notices" | "notifications";
}) {
  const { user } = useAuth();
  const { selected, data } = useParent();
  const [report, setReport] = useState<any>(null);
  useEffect(() => setReport(null), [selected]);
  const [result, setResult] = useState<{ id: string; rows: any[] }>({
      id: "",
      rows: [],
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [category, setCategory] = useState("All"),
    [search, setSearch] = useState("");
  useEffect(() => {
    if (!selected) {
      setLoading(false);
      return;
    }
    let live = true;
    const endpoint =
      kind === "documents"
        ? "/documents"
        : kind === "notices"
          ? "/notices"
          : "/workspace/notifications";
    const load = async () => {
      try {
        const r = await apiFetch(endpoint + "?studentId=" + selected);
        if (live) {
          setResult({
            id: selected,
            rows: kind === "notifications" ? r.data.items : r.data,
          });
          setError("");
        }
      } catch (e: any) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    };
    setLoading(true);
    setError("");
    setCategory("All");
    setSearch("");
    void load();
    const focus = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", focus);
    const timer = setInterval(focus, 30000);
    return () => {
      live = false;
      window.removeEventListener("focus", focus);
      clearInterval(timer);
    };
  }, [selected, kind, revision]);
  const rows = result.id === selected ? result.rows : [];
  const visibleRows = rows.filter(
    (r) =>
      (kind !== "documents" || category === "All" || r.category === category) &&
      [r.title, r.description, r.content]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const title =
    kind === "documents"
      ? "Documents"
      : kind === "notices"
        ? "Announcements"
        : "Notifications";
  return (
    <div className="communication-page parent-resources space-y-5">
      <Presence show={Boolean(report && data)} kind="modal">
        {report && data && (
          <ParentReport
            record={report.record}
            kind={report.kind}
            student={data.student}
            onClose={() => setReport(null)}
          />
        )}
      </Presence>
      <PageHeading
        eyebrow="Family workspace"
        title={title}
        description={
          kind === "documents"
            ? "School files, issued certificates and published records for your selected child."
            : kind === "notices"
              ? "Messages from your school, shared with your child's class and family."
              : "Stay informed about school notices, fees and your child's account updates."
        }
        detail={data?.student?.name}
        actions={
          <button
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
            className="workspace-secondary-button"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        }
      />
      <div className="communication-toolbar">
        <label className="workspace-search">
          <Search size={16} />
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            placeholder={`Search ${title.toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="text-xs text-zinc-500">
          {visibleRows.length} {kind === "documents" ? "files" : "updates"}
        </span>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
          <button
            className="ml-3 underline"
            onClick={() => setRevision((v) => v + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {loading ? (
        <p role="status" className="rounded-xl border bg-white p-6">
          Loading {title.toLowerCase()}...
        </p>
      ) : !selected ? (
        <p className="rounded-xl border bg-white p-6">
          Link a child through your school administrator to access school
          records.
        </p>
      ) : (
        <>
          {kind === "documents" && rows.length > 0 && (
            <nav
              className="flex flex-wrap gap-2"
              aria-label="Document categories"
            >
              {["All", ...Array.from(new Set(rows.map((r) => r.category)))].map(
                (c) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={
                      "rounded-lg border px-3 py-2 text-sm " +
                      (category === c ? "bg-red-600 text-white" : "bg-white")
                    }
                  >
                    {categories[c] || c}
                  </button>
                ),
              )}
            </nav>
          )}
          <div className="parent-resource-grid grid gap-4 lg:grid-cols-2">
            {visibleRows.map((r) => (
              <article
                key={r._id || r.id}
                className="notice-card"
                data-priority={r.priority}
              >
                <p className="mb-2 text-xs font-medium text-red-600">
                  {categories[r.category] || r.priority || "School update"}
                </p>
                <h2 className="font-semibold">{r.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                  {r.description || r.content}
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  {r.publishAt || r.createdAt
                    ? new Date(r.publishAt || r.createdAt).toLocaleDateString(
                        "en-GB",
                      )
                    : "Date not recorded"}
                </p>
                {kind === "documents" && (
                  <p className="family-file-meta">
                    {r.filename || r.title} &middot;{" "}
                    {r.mime === "application/pdf"
                      ? "PDF document"
                      : r.mime?.startsWith("image/")
                        ? "Image file"
                        : "School file"}
                  </p>
                )}
                {kind === "documents" ? (
                  <button
                    onClick={() =>
                      downloadPrivate(
                        "/documents/" +
                          r._id +
                          "/download?studentId=" +
                          selected,
                        r.filename,
                      ).catch((e) => setError(e.message))
                    }
                    className="mt-4 rounded-lg border px-3 py-2 text-sm"
                  >
                    Download {r.mime === "application/pdf" ? "PDF" : "file"}:{" "}
                    {r.title}
                  </button>
                ) : (
                  !r.isRead &&
                  (kind === "notices" || r.canMarkRead) && (
                    <button
                      onClick={async () => {
                        try {
                          await apiFetch(
                            kind === "notices"
                              ? "/notices/" + r._id + "/read"
                              : "/workspace/notifications/" + r.id + "/read",
                            { method: "PATCH" },
                          );
                          setRevision((v) => v + 1);
                        } catch (e: any) {
                          setError(e.message);
                        }
                      }}
                      className="mt-4 text-sm text-red-600"
                    >
                      Mark as read
                    </button>
                  )
                )}
              </article>
            ))}
          </div>
          {!visibleRows.length && !error && (
            <p className="communication-empty">
              {rows.length
                ? "No matching updates. Try another search or category."
                : kind === "documents"
                  ? "Your school has not published any documents for this child yet."
                  : kind === "notices"
                    ? "No current announcements for this child."
                    : "No current notifications for this child."}
            </p>
          )}
          {kind === "documents" && data && (
            <>
              {user?.features?.includes("EXAMINATIONS") && (
                <section className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold">Published marksheets</h2>
                  {data.results.length ? (
                    data.results.map((r: any) => (
                      <article key={r._id} className="family-document-row">
                        <h3 className="font-semibold">
                          {r.examTitle} · {r.percentage}% · Grade{" "}
                          {r.overallGrade}
                        </h3>
                        <p className="mt-3">
                          {data.student.name} · {data.student.className}
                        </p>
                        {r.subjectScores.map((s: any) => (
                          <p
                            key={s.subjectId || s.subjectName}
                            className="mt-2"
                          >
                            {s.subjectName}: {s.obtainedMarks}/{s.maxMarks} ·{" "}
                            {s.grade}
                          </p>
                        ))}
                        <button
                          onClick={() =>
                            setReport({ kind: "result", record: r })
                          }
                          className="mt-4 rounded-lg border px-3 py-2"
                        >
                          View / print marksheet
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">
                      Results have not been published yet.
                    </p>
                  )}
                </section>
              )}
              {user?.features?.includes("FINANCE") && (
                <section className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold">Fee receipts</h2>
                  {data.payments.length ? (
                    data.payments.map((p: any) => (
                      <article key={p._id} className="family-document-row">
                        <h3 className="font-semibold">
                          {p.receiptNumber} · PKR{" "}
                          {Number(p.amountPKR).toLocaleString("en-PK")}
                        </h3>
                        <p className="mt-3">
                          {data.student.name} · {p.paymentMethod} ·{" "}
                          {new Date(p.paidAt).toLocaleDateString("en-GB")}
                        </p>
                        <p className="mt-2 text-zinc-500">
                          Verified by school Finance. Open Fees & payments for
                          the full transaction history.
                        </p>
                        <button
                          onClick={() =>
                            setReport({ kind: "receipt", record: p })
                          }
                          className="mt-4 rounded-lg border px-3 py-2"
                        >
                          View / print receipt
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">
                      No verified fee receipts for this child.
                    </p>
                  )}
                </section>
              )}
              {user?.features?.includes("EXAMINATIONS") && (
                <section className="rounded-xl border bg-white p-5">
                  <h2 className="font-semibold">Issued certificates</h2>
                  {data.certificates?.length ? (
                    data.certificates.map((c: any) => (
                      <article className="family-document-row" key={c._id}>
                        <div><h3>{String(c.type || "Certificate").replaceAll("_", " ")}</h3><p className="mt-2 text-xs text-zinc-500">{c.certificateNumber}</p></div>
                        <span className="family-status">Issued {new Date(c.issueDate).toLocaleDateString("en-GB")}</span>
                        <button onClick={() => setReport({ kind: "certificate", record: c })} className="workspace-secondary-button">View / print certificate</button>
                      </article>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">
                      No certificates have been issued for this child.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
