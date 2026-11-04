"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function VerifyStaffCertificatePage() {
  const params = useParams<{ token: string }>();
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/staff-certificates/verify/${encodeURIComponent(params.token)}`)
      .then((response) => { if (active) setRecord(response.data); })
      .catch(() => { if (active) setError("We could not verify this certificate. Check the QR code or certificate reference with the issuing school."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.token]);

  return <main className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-900 sm:px-6">
    <section className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="border-t-4 border-red-700 px-6 py-6 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">Acadivo · document verification</p>
        <h1 className="mt-2 text-2xl font-semibold">Staff certificate verification</h1>
        <p className="mt-2 text-sm text-zinc-600">This page confirms the issue status of a certificate. It does not display private staff records.</p>
      </header>
      <div className="border-t border-zinc-200 p-6 sm:p-8">
        {loading ? <p role="status" className="text-sm text-zinc-600">Checking the certificate reference…</p> : error ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div> : record && <>
          <div className={`rounded-lg border p-4 ${record.valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className={`font-semibold ${record.valid ? "text-emerald-900" : "text-red-900"}`}>{record.valid ? "Valid certificate" : record.status === "REPLACED" ? "Replaced certificate · no longer current" : "Revoked certificate · not valid"}</p><p className="mt-1 text-sm">Status: {record.status}</p></div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Issuing school</dt><dd className="mt-1 font-medium">{record.schoolName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Certificate number</dt><dd className="mt-1 font-mono text-sm">{record.certificateNumber}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Certificate</dt><dd className="mt-1 font-medium">{record.certificateTitle}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Issued to</dt><dd className="mt-1 font-medium">{record.staffName}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Issue date</dt><dd className="mt-1">{new Date(record.issueDate).toLocaleDateString()}</dd></div>
          </dl>
        </>}
      </div>
      <footer className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 text-xs leading-5 text-zinc-500 sm:px-8">For confirmation of the original signed document, contact the issuing school. This public check does not reveal employee contact details, account information or employment files.</footer>
    </section>
  </main>;
}
