"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { confirmAction } from "./ConfirmationHost";
import { apiFetch } from "@/lib/api";
import { printSchoolDocument } from "@/lib/print-school-document";
import { SchoolDocumentTemplate } from "./SchoolDocumentTemplate";
export function BulkDocumentPrint({
  type,
  form = {},
  onIssued,
  onBusyChange,
}: {
  type: string;
  form?: any;
  onIssued?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [options, setOptions] = useState<any>({
      classes: [],
      sections: [],
      sessions: [],
    }),
    [scope, setScope] = useState({
      classId: "",
      academicSessionId: "",
      sectionId: "",
    }),
    [documents, setDocuments] = useState<any[]>([]),
    [skipped, setSkipped] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const batchIds = useRef<string[]>([]),
    issueLock = useRef(false);
  const certificateType = (
    {
      character: "CHARACTER",
      leaving: "LEAVING",
      bonafide: "BONAFIDE",
      transfer: "TRANSFER",
    } as Record<string, string>
  )[type];
  const canIssue =
    (user?.userType === "SUPER_ADMIN" ||
      !!user?.permissions?.includes("results.publish")) &&
    (!user?.isOrganizationOwner || !!user?.branchId);
  const missing = skipped.filter(
    (row) =>
      row.studentId && row.reason === "Certificate has not been issued yet.",
  );
  const staff = type === "experience";
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    let live = true;
    setDocuments([]);
    setSkipped([]);
    apiFetch("/school-documents/bulk-options?type=" + type)
      .then((r) => {
        if (live) {
          setOptions(r.data);
          setScope({
            classId: "",
            sectionId: "",
            academicSessionId:
              r.data.sessions.find((s: any) => s.isCurrent)?._id || "",
          });
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [type]);
  useEffect(() => {
    setDocuments([]);
    setSkipped([]);
    setProgress("");
    setError("");
    batchIds.current = [];
  }, [
    JSON.stringify(form),
    scope.classId,
    scope.academicSessionId,
    scope.sectionId,
  ]);
  async function load() {
    setBusy(true);
    setError("");
    setDocuments([]);
    setSkipped([]);
    try {
      const { studentId, staffId, certificateId, requestId, ...document } =
        form;
      let after = "",
        all: any[] = [],
        omitted: any[] = [];
      do {
        const r = await apiFetch("/school-documents/bulk-preview", {
          method: "POST",
          body: JSON.stringify({
            document: { ...document, type },
            ...(staff
              ? {}
              : Object.fromEntries(Object.entries(scope).filter(([, v]) => v))),
            ...(after ? { after } : {}),
          }),
        });
        all.push(...r.data.documents);
        omitted.push(...r.data.skipped);
        after = r.data.next || "";
        setProgress(
          `Prepared ${all.length} documents · ${omitted.length} unavailable`,
        );
      } while (after);
      setDocuments(all);
      setSkipped(omitted);
      if (!all.length && !omitted.length)
        setError(
          "No students found in this class and academic session. Check the selected session, class and section.",
        );
      else if (!all.length && !certificateType)
        setError(
          "Documents could not be prepared. See the student details below for the missing records.",
        );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function issueMissing() {
    if (issueLock.current || busy || !missing.length || !canIssue) return;
    if (
      !(await confirmAction(
        `Issue ${missing.length} ${type} certificates for the selected class? Each student receives an official certificate number. Existing certificates will be kept.`,
        {
          title: "Issue class certificates",
          confirmLabel: "Issue missing certificates",
        },
      ))
    )
      return;
    issueLock.current = true;
    setBusy(true);
    setError("");
    try {
      for (let start = 0; start < missing.length; start += 500) {
        const index = Math.floor(start / 500);
        if (!batchIds.current[index])
          batchIds.current[index] = crypto.randomUUID();
        await apiFetch("/exams/certificates/bulk-issue", {
          method: "POST",
          body: JSON.stringify({
            classId: scope.classId,
            studentIds: missing
              .slice(start, start + 500)
              .map((r) => r.studentId),
            type: certificateType,
            reason: "School document library class issuance",
            requestId: batchIds.current[index],
            onlyIfMissing: true,
          }),
        });
        setProgress(
          `Issued certificates for ${Math.min(start + 500, missing.length)} / ${missing.length} students`,
        );
      }
      onIssued?.();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      issueLock.current = false;
      setBusy(false);
    }
  }
  async function print() {
    setBusy(true);
    setError("");
    try {
      await printSchoolDocument(root.current);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      open
      className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6"
    >
      <summary className="cursor-pointer font-semibold">
        {staff
          ? "Bulk staff documents"
          : "Class documents - prepare and print together"}
      </summary>
      <div className="mt-4 space-y-3">
        {!staff && (
          <div className="grid items-start gap-4 sm:grid-cols-3">
            {[
              ["academicSessionId", "Academic session", options.sessions],
              ["classId", "Class", options.classes],
              [
                "sectionId",
                "Section",
                options.sections.filter(
                  (s: any) => s.classId === scope.classId,
                ),
              ],
            ].map(([key, label, list]: any) => (
              <label
                className="grid content-start gap-1 text-xs font-semibold"
                key={key}
              >
                {label}
                <select
                  disabled={busy}
                  value={(scope as any)[key]}
                  onChange={(e) => {
                    setScope({
                      ...scope,
                      [key]: e.target.value,
                      ...(key === "classId" ? { sectionId: "" } : {}),
                    });
                    setDocuments([]);
                    setSkipped([]);
                  }}
                  className="min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    {key === "sectionId" ? "All sections" : "Choose " + label}
                  </option>
                  {list.map((r: any) => (
                    <option key={r._id} value={r._id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <p className="text-sm leading-6 text-zinc-600">
          {certificateType
            ? "Prepare the class to find issued certificates. If any are missing, issue them together below, then print the complete class."
            : "Select a class and session, then prepare all documents together. Forms and information sheets can be printed directly; saving an archived copy is optional."}
        </p>
        {!!missing.length && (
          <div
            role="status"
            className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4"
          >
            <p className="text-sm text-amber-950">
              {missing.length} students do not have an issued {type} certificate
              yet.{" "}
              {documents.length
                ? `${documents.length} existing certificates are ready.`
                : "You can issue the missing certificates in one batch."}
            </p>
            {canIssue ? (
              <button
                disabled={busy}
                onClick={() => void issueMissing()}
                className="min-h-11 rounded bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Issue {missing.length} missing certificates and prepare class
              </button>
            ) : (
              <p className="text-sm">
                An administrator with certificate publishing permission must
                issue these certificates.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {progress && (
          <p role="status" className="text-sm">
            {progress}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={
              busy || (!staff && (!scope.classId || !scope.academicSessionId))
            }
            onClick={() => void load()}
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            Prepare {staff ? "staff" : "class"} documents
          </button>
          {!!documents.length && (
            <button
              disabled={busy}
              onClick={() => void print()}
              className="rounded bg-school-primary px-4 py-2 text-sm text-white"
            >
              Print {documents.length} documents / Save PDF
            </button>
          )}
        </div>
        {!!skipped.length && (
          <details>
            <summary className="text-sm">
              {skipped.length} students need attention
            </summary>
            <ul className="max-h-40 overflow-auto text-xs">
              {skipped.map((r, i) => (
                <li key={i}>
                  {r.name}: {r.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
        {!!documents.length && (
          <div className="max-h-[65vh] overflow-auto border bg-zinc-100 p-3">
            <div ref={root} className="school-document-bulk">
              {documents.map((d, i) => (
                <div
                  key={d.student?._id || d.staff?._id || i}
                  className="ledger-student-page"
                >
                  <SchoolDocumentTemplate data={d} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
