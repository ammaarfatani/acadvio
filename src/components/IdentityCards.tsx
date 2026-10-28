"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, privateFile, downloadPrivate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useOptionalParent } from "@/lib/parent-context";
import { confirmAction } from "./ConfirmationHost";
const field = "rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm",
  button =
    "rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50";
const labels: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  ISSUED: "Issued",
  NEEDS_CORRECTION: "Needs correction",
  REVOKED: "Revoked",
};
function CardView({
  kind,
  id,
  admin = false,
  onChanged,
}: {
  kind: string;
  id: string;
  admin?: boolean;
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const [card, setCard] = useState<any>(null),
    [images, setImages] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const generation = useRef(0);
  const endpoint = "/id-cards/" + kind + "/" + id;
  const load = useCallback(async () => {
    const version = ++generation.current;
    setCard(null);
    setImages([]);
    setError("");
    try {
      const response = await apiFetch(endpoint);
      if (version === generation.current) setCard(response.data);
    } catch (e: any) {
      if (version === generation.current) setError(e.message);
    }
  }, [endpoint, user?.branchId]);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    setImages([]);
    if (card?.data && (admin || card.status === "ISSUED")) {
      Promise.all(
        ["front.svg", "back.svg"].map(async (file) => {
          const blob = await privateFile(
            endpoint + "/" + file + (admin ? "?preview=1" : ""),
          );
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return url;
        }),
      )
        .then((result) => {
          if (active) setImages(result);
          else urls.forEach(URL.revokeObjectURL);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [card, endpoint, admin]);
  async function action(value: string) {
    if (busy || !card) return;
    if (value !== "issue" && !reason.trim()) {
      setError("Enter a reason before returning or revoking this card.");
      return;
    }
    if (
      !(await confirmAction(
        value === "issue"
          ? "Approve the reviewed profile and issue this ID card?"
          : value === "revoke"
            ? "Revoke this ID card? It will no longer be downloadable."
            : "Return this card for correction?",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(endpoint + "/review", {
        method: "POST",
        body: JSON.stringify({
          action: value,
          revision: card.revision,
          sourceHash: card.sourceHash,
          reason: reason || undefined,
        }),
      });
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function pdf(print = false) {
    const viewer = print ? window.open("about:blank", "_blank") : null;
    if (print && !viewer) {
      setError(
        "Allow the PDF window or use Download PDF, then print the saved file.",
      );
      return;
    }
    if (viewer) viewer.opener = null;
    setBusy(true);
    setError("");
    try {
      if (print) {
        const url = URL.createObjectURL(
          await privateFile(endpoint + "/card.pdf"),
        );
        viewer!.location.replace(url);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else
        await downloadPrivate(
          endpoint + "/card.pdf",
          card.identifier + "-id-card.pdf",
        );
    } catch (e: any) {
      viewer?.close();
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function photo(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5242880
    ) {
      setError("Choose JPG, PNG or WebP up to 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await apiFetch(endpoint + "/photo", {
        method: "PUT",
        body: JSON.stringify({ photo: image }),
      });
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 sm:p-7"
      aria-label="ID card details"
    >
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {!card && !error && <p role="status">Loading ID card…</p>}
      {card && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                {kind === "student" ? "Student" : "Staff"} identity
              </p>
              <h2 className="mt-1 text-xl font-semibold">{card.name}</h2>
              <p className="mt-2 font-mono text-sm">{card.identifier}</p>
            </div>
            <span
              className={
                "rounded-md border px-3 py-1.5 text-xs font-semibold " +
                (card.status === "ISSUED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900")
              }
            >
              {labels[card.status]}
            </span>
            <button
              className={button}
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh card
            </button>
          </div>
          {card.reason && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {card.reason}
            </p>
          )}
          {(!card.data || (!admin && card.status !== "ISSUED")) && (
            <p className="text-sm text-zinc-600">
              Your school administrator must review and issue this card before
              you can view or download it.
            </p>
          )}
          {images.length === 2 && (
            <div className="grid gap-5 xl:grid-cols-2">
              {images.map((url, i) => (
                <figure key={url}>
                  <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {i ? "Back" : "Front"}
                  </figcaption>
                  <img
                    src={url}
                    alt={card.name + " ID card " + (i ? "back" : "front")}
                    className="w-full max-w-[540px] rounded-lg border border-zinc-200"
                  />
                </figure>
              ))}
            </div>
          )}
          {card.status === "ISSUED" && (
            <div className="flex flex-wrap gap-3">
              <button
                disabled={busy}
                className={button}
                onClick={() => void pdf()}
              >
                Download PDF
              </button>
              <button
                disabled={busy}
                className={button}
                onClick={() => void pdf(true)}
              >
                Print / Open PDF
              </button>
              <p className="self-center text-xs text-zinc-500">
                85.6 × 54 mm · Front and back · Print at actual size
              </p>
            </div>
          )}
          {admin && (
            <div className="space-y-4 border-t pt-5">
              {kind === "staff" && (
                <label className="block text-sm font-medium">
                  Staff photograph (optional)
                  <input
                    aria-label="Staff photograph"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    className="mt-2 block max-w-full text-sm"
                    onChange={(e) => {
                      void photo(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {card.data?.photo && (
                    <button
                      type="button"
                      disabled={busy}
                      className="mt-2 text-xs font-semibold text-red-700"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await apiFetch(endpoint + "/photo", {
                            method: "PUT",
                            body: JSON.stringify({ photo: null }),
                          });
                          await load();
                          onChanged?.();
                        } catch (e: any) {
                          setError(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Remove photograph
                    </button>
                  )}
                  <span className="mt-1 block text-xs text-zinc-500">
                    JPG, PNG or WebP · Up to 5 MB. Photo changes require
                    reissue.
                  </span>
                </label>
              )}
              <label className="block text-sm font-medium">
                Correction / revocation reason
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="Describe the details that need correction"
                  className={field + " mt-2 w-full"}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy || images.length !== 2}
                  onClick={() => void action("issue")}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Saving…"
                    : card.version
                      ? "Approve / reissue card"
                      : "Approve & issue"}
                </button>
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => void action("correction")}
                >
                  Return for correction
                </button>
                {card.version > 0 && (
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() => void action("revoke")}
                  >
                    Revoke card
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Preview follows the saved profile. Issued copies are frozen;
                changing a name, photo, class or school branding requires
                administrator review again.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
export function IdentityCardManager() {
  const { user } = useAuth();
  const [kind, setKind] = useState("student"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<any[]>([]),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const [verification, setVerification] = useState(""),
    [verificationResult, setVerificationResult] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false),
    [classId, setClassId] = useState(""),
    [sessionId, setSessionId] = useState(""),
    [bulkOptions, setBulkOptions] = useState<any>({
      classes: [],
      sessions: [],
    });
  useEffect(() => {
    apiFetch("/school-documents/bulk-options?type=admission")
      .then((r) => setBulkOptions(r.data))
      .catch((e) => setError(e.message));
  }, [user?.branchId]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      apiFetch(
        "/id-cards?" +
          new URLSearchParams({
            kind,
            search,
            page: String(page),
            ...(status ? { status } : {}),
            ...(kind === "student"
              ? {
                  ...(classId ? { classId } : {}),
                  ...(sessionId ? { academicSessionId: sessionId } : {}),
                }
              : {}),
          }),
      )
        .then((r) => {
          if (active) {
            setRows(r.data.rows);
            setTotal(r.data.total);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    kind,
    search,
    status,
    page,
    user?.branchId,
    revision,
    classId,
    sessionId,
  ]);
  useEffect(() => {
    setSelected("");
    setChecked([]);
    setPage(1);
  }, [kind, search, status, user?.branchId, classId, sessionId]);
  async function sheet() {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      const cards = checked.map((id) => ({ kind, id }));
      const blob = await privateFile("/id-cards/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "school-id-card-sheet.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBulkBusy(false);
    }
  }
  async function selectIssued() {
    setBulkBusy(true);
    setError("");
    try {
      let all: string[] = [],
        after = "";
      do {
        const q = new URLSearchParams({
          kind,
          search,
          ...(after ? { after } : {}),
          ...(kind === "student"
            ? {
                ...(classId ? { classId } : {}),
                ...(sessionId ? { academicSessionId: sessionId } : {}),
              }
            : {}),
        });
        const r = await apiFetch("/id-cards/bulk-candidates?" + q);
        all.push(...r.data.ids);
        after = r.data.next || "";
        if (all.length > 1000)
          throw Error(
            "More than 1,000 issued cards match. Narrow the class/session selection.",
          );
      } while (after);
      setChecked(all);
      if (!all.length) setError("No issued cards match this selection.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBulkBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <header className="border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
          School identity
        </p>
        <h1 className="mt-2 text-3xl font-semibold">ID Card Management</h1>
        <p className="mt-3 max-w-3xl text-sm text-zinc-600">
          Review profiles, issue branded cards and manage corrections. Permanent
          IDs stay the same when a card is reissued.
        </p>
      </header>
      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <select
          aria-label="Card type"
          className={field}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="student">Student cards</option>
          <option value="staff">Staff cards</option>
        </select>
        <input
          aria-label="Search ID cards"
          className={field + " min-w-0 flex-1"}
          placeholder="Search name, ID, class, section or role"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Card status"
          className={field}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          disabled={bulkBusy || !checked.length}
          className={button}
          onClick={() => void sheet()}
        >
          Download combined sheet ({checked.length})
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {kind === "student" && (
          <>
            <select
              aria-label="Card class"
              className={field}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">All classes</option>
              {bulkOptions.classes.map((c: any) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Card academic session"
              className={field}
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">All sessions</option>
              {bulkOptions.sessions.map((c: any) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          disabled={bulkBusy}
          onClick={() => void selectIssued()}
          className={button}
        >
          {bulkBusy ? "Preparing cards�" : "Select all matching issued cards"}
        </button>
        <button onClick={() => setChecked([])} className={button}>
          Clear selection
        </button>
      </div>
      <form
        className="flex flex-wrap items-center gap-3 rounded-lg border bg-zinc-50 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const reference = verification.trim().replace(/^ACADIVO-CARD:/, "");
            const r = await apiFetch(
              "/id-cards/verify/" + encodeURIComponent(reference),
            );
            setVerificationResult(
              r.data.valid
                ? "Valid issued card"
                : labels[r.data.status] ||
                    "No current card found for this reference",
            );
          } catch (e: any) {
            setVerificationResult(e.message);
          }
        }}
      >
        <label className="min-w-0 flex-1 text-sm">
          Verify scanned QR reference
          <input
            required
            className={field + " mt-1 block w-full"}
            placeholder="Paste ACADIVO-CARD reference"
            value={verification}
            onChange={(e) => {
              setVerification(e.target.value);
              setVerificationResult("");
            }}
          />
        </label>
        <button className={button}>Verify card</button>
        {verificationResult && (
          <p role="status" className="w-full text-sm font-semibold">
            {verificationResult}
          </p>
        )}
      </form>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading identity records…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                {[
                  "Sheet",
                  "Name / permanent ID",
                  "Class / role",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subjectId} className="border-t">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      aria-label={"Select " + r.name + " for sheet"}
                      disabled={
                        r.status !== "ISSUED" ||
                        (!checked.includes(r.subjectId) &&
                          checked.length >= 1000)
                      }
                      checked={checked.includes(r.subjectId)}
                      onChange={(e) =>
                        setChecked((v) =>
                          e.target.checked
                            ? [...v, r.subjectId]
                            : v.filter((x) => x !== r.subjectId),
                        )
                      }
                    />
                  </td>
                  <td className="p-4">
                    <strong>{r.name}</strong>
                    <p className="mt-1 font-mono text-xs text-zinc-500">
                      {r.identifier}
                    </p>
                  </td>
                  <td className="p-4">
                    {[r.className, r.sectionName].filter(Boolean).join(" / ") ||
                      r.role}
                  </td>
                  <td className="p-4">{labels[r.status]}</td>
                  <td className="p-4">
                    <button
                      className="font-semibold text-red-700"
                      onClick={() => setSelected(r.subjectId)}
                    >
                      View ID Card
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-6 text-sm text-zinc-500">
              No matching identity records.
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-4 text-sm">
        <span>
          {total} records · Page {page}
        </span>
        <div className="flex gap-2">
          <button
            className={button}
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button
            className={button}
            disabled={page * 25 >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {selected && (
        <CardView
          key={kind + selected + user?.branchId}
          kind={kind}
          id={selected}
          admin
          onChanged={() => setRevision((v) => v + 1)}
        />
      )}
    </div>
  );
}
export function MyIdentityCard({ parent = false }: { parent?: boolean }) {
  const { user } = useAuth();
  const family = useOptionalParent();
  const id = parent ? family?.selected : user?.id;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
          School identity
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          {parent ? "Child ID Card" : "My ID Card"}
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Approved school identification. Downloads contain only the card
          details.
        </p>
      </header>
      {id ? (
        <CardView
          key={id + user?.branchId}
          kind={parent ? "student" : "staff"}
          id={id}
        />
      ) : (
        <p>Select a linked child to view their ID card status.</p>
      )}
    </div>
  );
}
