"use client";
import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
export default function SchoolLogoEditor({logoUrl,onSaved}:{logoUrl?:string;onSaved?:()=>void}={}) {
  const { user, refreshUser } = useAuth();
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const logo = preview || (logoUrl!==undefined?logoUrl:user?.school?.logoUrl);
  async function save(image: string | null) {
    setBusy(true); setError(""); setNotice("");
    try { const result = await apiFetch("/schools/logo", { method: "PUT", body: JSON.stringify({ image }) }); await refreshUser(); setPreview(""); setNotice(result.message);onSaved?.(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  function choose(file?: File) {
    setError("");
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || !/\.(png|jpe?g|webp)$/i.test(file.name)) { setError("Choose a JPG, JPEG, PNG or WebP logo."); return; }
    if (!file.size || file.size > 1024*1024) { setError("Logo must be under 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.onerror = () => setError("Could not read the logo image.");
    reader.readAsDataURL(file);
  }
  return <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6"><h2 className="font-bold">School Logo</h2><p className="text-xs text-zinc-500">Your logo is shared across your school admin, teacher, finance, receptionist and examination portals. JPG, JPEG, PNG or WebP · Maximum 1 MB.</p>{logo ? <img src={logo} alt="School logo preview" className="h-28 w-28 rounded-xl border bg-zinc-50 p-2 object-contain"/> : <div className="grid h-28 w-28 place-items-center rounded-xl bg-zinc-100 text-3xl font-bold">{user?.school?.name?.charAt(0) || "S"}</div>}<input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" disabled={busy} onChange={e => { choose(e.target.files?.[0]); e.target.value = ""; }}/><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-lg border px-4 py-2 text-sm font-semibold">{logo ? "Replace Logo" : "Upload Logo"}</button>{preview && <><button type="button" disabled={busy} onClick={() => void save(preview)} className="rounded-lg bg-school-primary px-4 py-2 text-sm font-bold text-white">{busy ? "Saving…" : "Save Logo"}</button><button type="button" disabled={busy} onClick={() => setPreview("")} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></>}{user?.school?.logoUrl && <button type="button" disabled={busy} onClick={() => void save(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-red-700">Remove Logo</button>}</div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}</section>;
}
