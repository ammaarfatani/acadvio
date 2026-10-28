"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
export function DocumentStyleSetupNotice({ base }: { base: string }) {
  const { user } = useAuth();
  const [pending, setPending] = useState(false),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load=()=>{if (
      user?.userType === "SCHOOL_ADMIN" &&
      user?.permissions?.includes("settings.view")
    )
      apiFetch("/school-documents/settings")
        .then((r) => {
          if (active) {
            setPending(!r.data.completedAt);
            setRevision(r.data.revision);
          }
        })
        .catch(() => {});};load();window.addEventListener("acadivo:document-settings-changed",load);
    return () => {
      active = false;window.removeEventListener("acadivo:document-settings-changed",load);
    };
  }, [user?.id]);
  async function skip() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/school-documents/settings", {
        method: "PUT",
        body: JSON.stringify({ revision, complete: true }),
      });
      setPending(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!pending) return null;
  return (
    <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm">
      <div>
        <strong>Choose your school document style</strong>
        <p className="mt-1 text-xs text-zinc-600">
          Personalize admission forms, report cards, certificates, receipts and
          ID cards.
        </p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Link
          href={base + "/settings/document-templates"}
          className="rounded bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
        >
          Choose styles
        </Link>
        <button
          disabled={busy}
          onClick={() => void skip()}
          className="text-xs font-semibold"
        >
          {busy ? "Saving…" : "Skip · use defaults"}
        </button>
      </div>
    </section>
  );
}
