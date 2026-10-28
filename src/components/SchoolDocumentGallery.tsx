"use client";
import { BulkDocumentPrint } from "./BulkDocumentPrint";
import { PhotoRecordPicker } from "./PhotoRecordPicker";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  documentLibraryTypesForRole,
  DOCUMENT_LABELS,
  DocumentType,
} from "@/lib/document-templates";
import { DocumentPreviewOverlay } from "./SchoolDocumentPreview";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { confirmAction } from "./ConfirmationHost";
export default function SchoolDocumentGallery() {
  const { user } = useAuth();
  const pathname = usePathname();
  const portalRoot = pathname.replace(/\/documents\/?$/, "");
  const isAdmin = user?.userType === "SCHOOL_ADMIN";
  const certificatesHref =
    portalRoot + (isAdmin ? "/examinations/certificates" : "/certificates");
  const marksheetsHref =
    portalRoot + (isAdmin ? "/examinations/marksheets" : "/marksheets");
  const field =
    "min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-normal focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";
  const needBranch = !!user?.isOrganizationOwner && !user.branchId;
  const categories = documentLibraryTypesForRole(
    user?.userType || "SCHOOL_ADMIN",
  );
  const [type, setType] = useState<DocumentType>(categories[0] || "admission"),
    [choices, setChoices] = useState<any>({}),
    [records, setRecords] = useState<any[]>([]),
    [form, setForm] = useState<any>({}),
    [search, setSearch] = useState(""),
    [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [bulkBusy, setBulkBusy] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef("");
  useEffect(() => {
    if (categories.length && !categories.includes(type)) setType(categories[0]);
  }, [categories.join(","), type]);
  async function refreshChoices() {
    const response = await apiFetch("/school-documents/choices?type=" + type);
    setChoices(response.data);
  }
  useEffect(() => {
    let active = true;
    setForm({});
    setChoices({});
    setError("");
    apiFetch("/school-documents/choices?type=" + type)
      .then((r) => {
        if (active) setChoices(r.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [type]);
  useEffect(() => {
    requestId.current = "";
  }, [type, form]);
  useEffect(() => {
    let active = true;
    apiFetch(
      "/school-documents/issued?type=" +
        type +
        "&search=" +
        encodeURIComponent(search),
    )
      .then((r) => {
        if (active) setRecords(r.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [type, search]);
  async function preview() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/school-documents/preview", {
        method: "POST",
        body: JSON.stringify({ type, ...form }),
      });
      setData(r.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function issue() {
    if (busy) return;
    if (
      !(await confirmAction(
        "Archive this document using the selected real records and current school style? Changes to templates will not alter the archived copy.",
        { title: "Archive school document", confirmLabel: "Archive document" },
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const r = await apiFetch("/school-documents/issue", {
        method: "POST",
        body: JSON.stringify({ type, ...form, requestId: requestId.current }),
      });
      const saved = await apiFetch("/school-documents/issued/" + r.data._id);
      setData({
        ...saved.data.snapshot,
        reference: saved.data.reference,
        issuedAt: saved.data.issuedAt,
      });
      const list = await apiFetch("/school-documents/issued?type=" + type);
      setRecords(list.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/school-documents/issued/" + id);
      setData({
        ...r.data.snapshot,
        reference: r.data.reference,
        issuedAt: r.data.issuedAt,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const staff = ["staff-id", "experience"].includes(type),
    certificate = ["character", "leaving", "bonafide", "transfer"].includes(
      type,
    );
  return (
    <main className="document-library min-w-0 space-y-5 pb-10">
      <header className="border-l-4 border-red-600 bg-[#f2f0ed] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
          School document library
        </p>
        <h1 className="mt-2 text-2xl font-semibold">School Document Library</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Prepare student forms and school documents individually or for a
          complete class. Print directly, or save an archived copy when you need
          a permanent record.
        </p>
      </header>
      {isAdmin && (
        <section
          className="grid gap-3 md:grid-cols-3"
          aria-label="Document workflows"
        >
          <div className="rounded-lg border bg-white p-4">
            <h2 className="font-semibold">Forms & information sheets</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Choose a student for one document, or prepare a class below. No
              certificate issuance is needed.
            </p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h2 className="font-semibold">Official certificates</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Certificates receive an official number when issued. Issue missing
              class certificates below, or manage individual and bulk issuance
              in Examinations.
            </p>
            <Link
              className="mt-2 inline-block text-sm font-semibold text-red-700"
              href={certificatesHref}
            >
              Open Certificates
            </Link>
          </div>
          <div className="rounded-lg border bg-zinc-900 p-4 text-white">
            <h2 className="font-semibold">Dedicated print desks</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Marksheets and fee receipts stay with their examination and
              finance records.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
              <Link href={marksheetsHref}>Marksheets</Link>
              <Link href={portalRoot + "/finance/receipts"}>Fee receipts</Link>
              <Link href={portalRoot + "/id-cards"}>ID Card Management</Link>
            </div>
          </div>
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {needBranch && (
        <p className="rounded-lg border bg-amber-50 p-3 text-xs">
          Choose a specific branch in the header before archiving a document.
          Preview remains available.
        </p>
      )}
      <fieldset
        disabled={busy || bulkBusy}
        className="document-library-form grid min-w-0 items-start gap-5 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6"
      >
        <label className="grid min-w-0 content-start gap-1 text-xs font-semibold">
          Document category
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className={field}
          >
            {categories.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <PhotoRecordPicker
          label={staff ? "Staff member" : "Student"}
          kind={staff ? "staff" : "student"}
          records={(staff ? choices.staff : choices.students) || []}
          value={form[staff ? "staffId" : "studentId"] || ""}
          onChange={(id) => {
            const latest = certificate
              ? choices.certificates?.find(
                  (r: any) =>
                    String(r.studentId) === id && r.type === type.toUpperCase(),
                )
              : null;
            setForm({
              [staff ? "staffId" : "studentId"]: id,
              ...(latest ? { certificateId: latest._id } : {}),
            });
          }}
        />

        {type === "report-card" && (
          <label className="grid min-w-0 content-start gap-1 text-xs font-semibold">
            Examination
            <select
              value={form.examId || ""}
              onChange={(e) => setForm({ ...form, examId: e.target.value })}
              className={field}
            >
              <option value="">Select examination</option>
              {choices.exams?.map((r: any) => (
                <option key={r._id} value={r._id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {type === "fee-receipt" && (
          <label className="grid min-w-0 content-start gap-1 text-xs font-semibold">
            Recorded payment
            <select
              value={form.paymentId || ""}
              onChange={(e) => setForm({ ...form, paymentId: e.target.value })}
              className={field}
            >
              <option value="">Select payment</option>
              {choices.payments
                ?.filter((r: any) => String(r.studentId) === form.studentId)
                .map((r: any) => (
                  <option key={r._id} value={r._id}>
                    {r.receiptNumber} · PKR {r.amountPKR}
                  </option>
                ))}
            </select>
          </label>
        )}
        {certificate && (
          <label className="grid min-w-0 content-start gap-1 text-xs font-semibold">
            Existing issued certificate
            <select
              value={form.certificateId || ""}
              onChange={(e) =>
                setForm({ ...form, certificateId: e.target.value })
              }
              className={field}
            >
              <option value="">Select certificate</option>
              {choices.certificates
                ?.filter(
                  (r: any) =>
                    String(r.studentId) === form.studentId &&
                    r.type === type.toUpperCase(),
                )
                .map((r: any) => (
                  <option key={r._id} value={r._id}>
                    {r.certificateNumber} · {r.type}
                  </option>
                ))}
            </select>
            <span className="font-normal text-zinc-500">
              For one student, select an issued certificate. For a class, use
              the batch section below to issue missing certificates together.
            </span>
          </label>
        )}
        {type === "general-certificate" && (
          <label className="grid min-w-0 content-start gap-1 text-xs font-semibold">
            Certificate purpose
            <select
              value={form.certificatePurpose || "general"}
              onChange={(e) =>
                setForm({ ...form, certificatePurpose: e.target.value })
              }
              className={field}
            >
              <option value="general">General school certificate</option>
              <option value="achievement">Academic achievement</option>
              <option value="participation">Participation</option>
              <option value="appreciation">Appreciation</option>
            </select>
          </label>
        )}
        {["experience", "general-certificate"].includes(type) && (
          <label className="grid min-w-0 content-start gap-1 text-xs font-semibold sm:col-span-2">
            Authorized statement
            <textarea
              maxLength={4000}
              value={form.statement || ""}
              onChange={(e) => setForm({ ...form, statement: e.target.value })}
              placeholder="Enter only verified, authorized facts"
              className={field}
            />
          </label>
        )}
        {type === "attendance" &&
          ["from", "to"].map((key) => (
            <label
              key={key}
              className="grid gap-1 text-xs font-semibold capitalize"
            >
              {key}
              <input
                type="date"
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className={field}
              />
            </label>
          ))}
        <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3">
          <button
            disabled={
              busy ||
              !form[staff ? "staffId" : "studentId"] ||
              (certificate && !form.certificateId)
            }
            onClick={() => void preview()}
            className="rounded border px-4 py-2 text-sm"
          >
            {busy ? "Loading…" : "Preview document"}
          </button>
          <button
            disabled={
              busy ||
              needBranch ||
              !form[staff ? "staffId" : "studentId"] ||
              (certificate && !form.certificateId) ||
              ["student-id", "staff-id"].includes(type)
            }
            onClick={() => void issue()}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {["student-id", "staff-id"].includes(type)
              ? "Issue through ID Card Management"
              : "Save archived copy (optional)"}
          </button>
        </div>
      </fieldset>
      {isAdmin && type === "student-id" && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          ID cards use the reviewed card records in{" "}
          <Link
            className="font-semibold underline"
            href={portalRoot + "/id-cards"}
          >
            ID Card Management
          </Link>
          . Open that page to issue and print a complete class of cards.
        </p>
      )}
      {!["student-id", "staff-id", "fee-receipt"].includes(type) && (
        <BulkDocumentPrint
          key={type}
          type={type}
          form={form}
          onBusyChange={setBulkBusy}
          onIssued={() =>
            void refreshChoices().catch((e) => setError(e.message))
          }
        />
      )}
      <section className="rounded-lg border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Previously archived documents</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or reference"
            aria-label="Search issued documents"
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm sm:w-72"
          />
        </div>
        <p className="my-3 text-xs text-zinc-500">
          Latest 100 records for the selected category.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">Reference</th>
                <th className="p-3">Student / staff</th>
                <th className="p-3">Issue date</th>
                <th className="p-3">Preview</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="p-3 font-mono text-xs">{r.reference}</td>
                  <td className="p-3">
                    {r.snapshot?.student?.name || r.snapshot?.staff?.name}
                  </td>
                  <td className="p-3">
                    {new Date(r.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <button
                      disabled={busy}
                      onClick={() => void open(r._id)}
                      className="text-red-700"
                    >
                      Open / print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && (
            <p className="p-6 text-sm text-zinc-500">
              No archived documents for this category.
            </p>
          )}
        </div>
      </section>
      {data && (
        <DocumentPreviewOverlay data={data} onClose={() => setData(null)} />
      )}
    </main>
  );
}
