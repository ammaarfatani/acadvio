"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, UploadCloud, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type BankDetails = { bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string; branch?: string; instructions?: string };
export default function ParentFeePayment({ studentId, invoice, bank, onSubmitted, onClose }: {
  studentId: string; invoice: { _id: string; challanNumber: string; month: string; remainingAmountPKR: number };
  bank: BankDetails; onSubmitted: () => Promise<void>; onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(invoice.remainingAmountPKR));
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState("");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  const fileVersion = useRef(0);
  const idempotencyKey = useRef("");
  useEffect(() => { active.current = true; idempotencyKey.current = crypto.randomUUID(); return () => { active.current = false; fileVersion.current++; }; }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 2400); return () => clearTimeout(timer); }, [notice]);
  function remove() { fileVersion.current++; setProof(""); setFilename(""); if (fileInput.current) fileInput.current.value = ""; }
  function choose(file?: File) {
    if (!file || submitting.current) return;
    remove(); setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) { setError("Choose a JPG, JPEG, PNG or WebP screenshot up to 5 MB."); return; }
    const version = fileVersion.current;
    const reader = new FileReader();
    reader.onload = () => { if (active.current && version === fileVersion.current) { setProof(String(reader.result)); setFilename(file.name); } };
    reader.onerror = () => { if (active.current && version === fileVersion.current) setError("The screenshot could not be read. Please choose it again."); };
    reader.readAsDataURL(file);
  }
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setNotice("Copied to clipboard"); } catch { setError("Clipboard access is unavailable. Select and copy the account detail manually."); } }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    const paid = Number(amount);
    if (!proof) { setError("Payment screenshot is required."); return; }
    if (!Number.isFinite(paid) || paid <= 0 || paid > invoice.remainingAmountPKR || Math.abs(paid * 100 - Math.round(paid * 100)) > 0.000001) { setError("Enter a valid amount within the outstanding balance, with at most two decimal places."); return; }
    submitting.current = true; setBusy(true); setError("");
    try {
      await apiFetch(`/parent/children/${studentId}/payments`, { method: "POST", body: JSON.stringify({ challanId: invoice._id, amountPKR: paid, reference, idempotencyKey: idempotencyKey.current, screenshot: proof }) });
      if (active.current) await onSubmitted();
    } catch (e: any) { if (active.current) setError(e.message || "Payment could not be submitted. Please try again."); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  const input = "mt-2 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 disabled:bg-zinc-50";
  return <form onSubmit={submit} className="rounded-2xl border border-red-100 bg-white p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-red-600">Bank transfer payment</p><h2 className="mt-2 text-xl font-bold">Pay your child’s school fee</h2><p className="mt-2 text-sm text-zinc-500">Invoice {invoice.challanNumber} · {invoice.month}</p></div><button type="button" disabled={busy} aria-label="Close payment form" onClick={onClose} className="rounded-lg border p-2 disabled:opacity-50"><X size={18}/></button></div>
    <p className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm">Outstanding balance <strong className="ml-2">PKR {invoice.remainingAmountPKR.toLocaleString()}</strong></p>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <h3 className="mt-6 font-semibold">School bank account</h3><p className="mt-1 text-sm text-zinc-500">Transfer your payment using the school’s account details below, then upload your receipt.</p>
    <dl className="mt-4 divide-y rounded-xl border px-4">{[["Bank", bank.bankName], ["Account title", bank.accountTitle], ["Account number", bank.accountNumber], ["IBAN", bank.iban], ["Branch", bank.branch]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 break-all text-sm font-medium">{value}</dd></div><button type="button" onClick={() => void copy(value!)} aria-label={`Copy ${label}`} className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs"><Copy size={14}/>Copy</button></div>)}</dl>
    {bank.instructions && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">{bank.instructions}</p>}
    <fieldset disabled={busy} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Amount transferred (PKR)<input required type="number" min="0.01" step="0.01" max={invoice.remainingAmountPKR} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter transferred amount" className={input}/></label><label className="text-sm font-medium">Transaction reference <span className="font-normal text-zinc-500">(optional)</span><input maxLength={160} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. bank transaction or receipt ID" className={input}/></label></fieldset>
    <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); choose(e.dataTransfer.files[0]); }} className="mt-5 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-5 text-center"><UploadCloud className="mx-auto text-red-600" size={26}/><h3 className="mt-2 text-sm font-semibold">Upload payment screenshot</h3><p className="mt-1 text-xs text-zinc-500">Drag and drop your receipt · JPG, JPEG, PNG or WebP · Up to 5 MB</p><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose payment screenshot" disabled={busy} onChange={e => choose(e.target.files?.[0])} className="sr-only"/><button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="mt-3 rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50">{proof ? "Replace screenshot" : "Choose screenshot"}</button>{proof && <div className="mt-4"><img src={proof} alt="Payment screenshot preview" className="mx-auto max-h-64 max-w-full rounded-lg object-contain"/><p className="mt-2 break-all text-xs text-zinc-500">{filename}</p><button type="button" disabled={busy} onClick={remove} className="mt-2 rounded-lg px-3 py-2 text-sm text-red-600">Remove screenshot</button></div>}</div>
    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your submission stays pending until Finance verifies it. Only an approved payment reduces the outstanding fee. A rejected submission will show the reason and can be submitted again.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy || !proof} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting payment…" : "Submit payment for verification"}</button><button type="button" disabled={busy} onClick={onClose} className="rounded-xl border px-5 py-3 text-sm">Cancel</button></div>
  </form>;
}
