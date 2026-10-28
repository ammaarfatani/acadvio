"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch, privateFile } from "@/lib/api";
import { printSchoolDocument } from "@/lib/print-school-document";
import AnnualMarksheet from "./AnnualMarksheet";
export function BulkMarksheetPrint({
  session,
  classId,
  section,
  exam,
  view,
}: {
  session: string;
  classId: string;
  section: string;
  exam: string;
  view: string;
}) {
  const [documents, setDocuments] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setDocuments([]);
    setError("");
    setProgress("");
  }, [session, classId, section, exam, view]);
  async function load() {
    const run = ++generation.current;
    setBusy(true);
    setError("");
    setDocuments([]);
    try {
      let after = "",
        people: any[] = [];
      do {
        const q = new URLSearchParams({
          academicSessionId: session,
          classId,
          ...(section ? { sectionId: section } : {}),
          ...(after ? { after } : {}),
        });
        const r = await apiFetch("/exams/marksheet-candidates?" + q);
        if (run !== generation.current) return;
        people.push(...r.data.students);
        after = r.data.next || "";
      } while (after);
      let all: any[] = [];
      for (let i = 0; i < people.length; i += 20) {
        const r = await apiFetch("/exams/marksheets/bulk-preview", {
          method: "POST",
          body: JSON.stringify({
            studentIds: people.slice(i, i + 20).map((s) => s._id),
            query: {
              academicSessionId: session,
              classId,
              view,
              ...(exam ? { examId: exam } : {}),
            },
          }),
        });
        if (run !== generation.current) return;
        all.push(...r.data.documents);
        setProgress(`Prepared ${all.length} / ${people.length} marksheets`);
      }
      setDocuments(all);
      if (!all.length) setError("No eligible students for this class/session.");
    } catch (e: any) {
      if (run === generation.current) setError(e.message);
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      if (documents.length > 500)
        throw new Error(
          "Select a section to export up to 500 students per PDF.",
        );
      const blob = await privateFile("/exams/marksheets/bulk-pdf", {
        method: "POST",
        body: JSON.stringify({
          studentIds: documents.map((d) => d.student._id),
          query: {
            academicSessionId: session,
            classId,
            view,
            ...(exam ? { examId: exam } : {}),
          },
          sourceHashes: Object.fromEntries(
            documents
              .filter((d) => d.sourceHash)
              .map((d) => [d.student._id, d.sourceHash]),
          ),
        }),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "class-marksheets.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function print() {
    setBusy(true);
    try {
      await printSchoolDocument(root.current);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-700">
            Class export
          </p>
          <h2 className="text-lg font-semibold text-zinc-900">
            Print the complete class
          </h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Uses the session, class and result selected above. Prepare the
            class, then download one PDF for clean printing.
          </p>
        </div>
        {!!documents.length && (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {documents.length} ready
          </span>
        )}
      </div>
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
          disabled={busy || !session || !classId || (view === "EXAM" && !exam)}
          onClick={() => void load()}
          className="rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          Prepare class marksheets
        </button>
        {!!documents.length && (
          <button
            disabled={busy}
            onClick={() => void print()}
            className="rounded bg-school-primary px-4 py-2 text-sm text-white"
          >
            Print preview ({documents.length})
          </button>
        )}
        {!!documents.length && (
          <button
            disabled={busy}
            onClick={() => void download()}
            className="min-h-11 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Please wait..." : "Download class PDF"}
          </button>
        )}
      </div>
      {!!documents.length && (
        <div className="max-h-[65vh] overflow-auto border bg-zinc-100 p-2">
          <div ref={root} className="school-document-bulk">
            {documents.map((d) => (
              <div className="ledger-student-page" key={d.student._id}>
                <AnnualMarksheet
                  data={d}
                  inline
                  documentId={"bulk-marksheet-" + d.student._id}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
