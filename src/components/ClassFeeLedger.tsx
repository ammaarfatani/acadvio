"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SchoolDocumentTemplate } from "./SchoolDocumentTemplate";
import { StudentAvatar } from "./StudentAvatar";
import { printSchoolDocument } from "@/lib/print-school-document";
export function ClassFeeLedger() {
  const [options, setOptions] = useState<any>({
      classes: [],
      sections: [],
      sessions: [],
    }),
    [form, setForm] = useState<any>({
      classId: "",
      academicSessionId: "",
      sectionId: "",
      month: new Date()
        .toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
        .slice(0, 7),
    }),
    [docs, setDocs] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    apiFetch("/finance/ledger-print/options")
      .then((r) => {
        if (live) {
          setOptions(r.data);
          setForm((f: any) => ({
            ...f,
            academicSessionId:
              r.data.sessions.find((s: any) => s.isCurrent)?._id || "",
          }));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const change = (key: string, value: string) => {
    setForm({
      ...form,
      [key]: value,
      ...(key === "classId" ? { sectionId: "" } : {}),
    });
    setDocs([]);
    setSelected("");
  };
  async function load() {
    if (busy) return;
    setBusy(true);
    setError("");
    setDocs([]);
    try {
      let after = "",
        all: any[] = [];
      const seen = new Set<string>();
      do {
        const query = new URLSearchParams(
          Object.entries(form).filter(([, v]) => Boolean(v)) as [
            string,
            string,
          ][],
        );
        if (after) query.set("after", after);
        const r = await apiFetch("/finance/ledger-print?" + query);
        for (const doc of r.data.documents) {
          if (seen.has(doc.student._id))
            throw Error("Duplicate student returned; reload before printing.");
          seen.add(doc.student._id);
          all.push(doc);
        }
        after = r.data.next || "";
      } while (after);
      setDocs(all);
      if (!all.length)
        setError("No students match this class, session and section.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function print(individual = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const source = individual
        ? root.current?.querySelector(`[data-ledger-student="${selected}"]`)
        : root.current;
      if (!source) throw Error("Choose a student ledger first.");
      await printSchoolDocument(source);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <header>
        <h2 className="text-lg font-semibold">Class fee ledger</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Print official account statements together, or select one student.
          Printing does not create or change fees.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["academicSessionId", "Academic session", options.sessions],
          ["classId", "Class", options.classes],
          [
            "sectionId",
            "Section (optional)",
            options.sections.filter((s: any) => s.classId === form.classId),
          ],
        ].map(([key, label, items]: any) => (
          <label key={key} className="grid gap-1 text-xs font-semibold">
            {label}
            <select
              value={form[key]}
              disabled={busy}
              onChange={(e) => change(key, e.target.value)}
              className="rounded-lg border px-3 py-2"
            >
              <option value="">
                {key === "sectionId" ? "All sections" : "Choose " + label}
              </option>
              {items.map((i: any) => (
                <option key={i._id} value={i._id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="grid gap-1 text-xs font-semibold">
          Fee month
          <input
            type="month"
            value={form.month}
            disabled={busy}
            onChange={(e) => change("month", e.target.value)}
            className="rounded-lg border px-3 py-2"
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={
          busy || !form.classId || !form.academicSessionId || !form.month
        }
        onClick={() => void load()}
        className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
      >
        {busy ? "Preparing all class ledgers…" : "Load class ledgers"}
      </button>
      {!!docs.length && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <strong className="text-sm">
              {docs.length} student ledgers ready
            </strong>
            <button
              disabled={busy}
              onClick={() => void print()}
              className="rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Print Class Ledger
            </button>
            <button
              disabled={busy || !selected}
              onClick={() => void print(true)}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            >
              Print Individual Ledger
            </button>
          </div>
          <label className="block text-sm">
            Find student
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, admission or roll number"
              className="ml-3 rounded-lg border px-3 py-2"
            />
          </label>
          <div
            role="listbox"
            aria-label="Select individual ledger"
            className="max-h-56 overflow-auto border rounded-lg"
          >
            {docs
              .filter((d) =>
                [
                  d.student.name,
                  d.student.admissionNumber,
                  d.student.rollNumber,
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((d) => (
                <button
                  key={d.student._id}
                  role="option"
                  aria-selected={selected === d.student._id}
                  onClick={() => setSelected(d.student._id)}
                  className={`flex w-full items-center gap-3 border-b p-3 text-left text-sm ${selected === d.student._id ? "bg-red-50" : ""}`}
                >
                  <StudentAvatar student={d.student} />
                  <span>
                    {d.student.name}
                    <small className="block text-zinc-500">
                      {d.student.admissionNumber || d.student.studentId} ·{" "}
                      {d.student.className} / {d.student.sectionName}
                    </small>
                  </span>
                </button>
              ))}
          </div>
          <div className="h-0 overflow-hidden" aria-hidden="true">
            <div ref={root} className="school-document-bulk">
              {docs.map((d) => (
                <div
                  key={d.student._id}
                  data-ledger-student={d.student._id}
                  className="ledger-student-page"
                >
                  <SchoolDocumentTemplate data={d} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
