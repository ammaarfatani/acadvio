"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { UploadCloud, X } from "lucide-react";
import PaymentBankDetails from "@/components/PaymentBankDetails";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const card = "rounded-2xl border border-zinc-200 bg-white p-5";
const button = "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50";
type Payment = { _id: string; schoolId?: { name: string }; userId?: { name: string; email: string }; amount: number; plan: string; billingCycle: string; activationComplete?: boolean; reviewDecision?: string; reference?: string; account: string; submittedAt: string; status: string; rejectionReason?: string };
export default function SubscriptionPayments({ review = false, selection }: { review?: boolean; selection?: { plan: string; billingCycle: string } }) {
  const { refreshUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [image, setImage] = useState("");
  const [view, setView] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<Payment | null>(null);
  const [reason, setReason] = useState("");
  const load = async () => {
    const result = await apiFetch(review ? "/subscription-payments" : "/subscription-payments/mine"+(selection ? "?plan="+encodeURIComponent(selection.plan)+"&billingCycle="+encodeURIComponent(selection.billingCycle) : ""));
    if (review) setPayments(result.data); else { setData(result.data); setPayments(result.data.payments); }
  };
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [review, selection?.plan, selection?.billingCycle]);
  async function choose(file?: File) {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) { setError("Choose a JPG, JPEG, PNG or WebP screenshot."); return; }
    if (!file.size || file.size > 5 * 1024 * 1024) { setError("Screenshot must be under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.onerror = () => setError("Unable to read this screenshot.");
    reader.readAsDataURL(file);
  }
  async function submit() {
    if (lock.current) return;
    if (!image) { setError("Upload a payment screenshot before submitting."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await apiFetch("/subscription-payments", { method: "POST", body: JSON.stringify({ screenshot: image, reference, ...(selection || {}) }) });
      setNotice(result.message); setImage(""); setReference(""); await load();
    } catch (e: any) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  }
  async function decide(payment: Payment, status: "APPROVED" | "REJECTED") {
    if (lock.current) return;
    if (status === "REJECTED" && !reason.trim()) { setError("Enter a rejection reason."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await apiFetch('/subscription-payments/'+payment._id+'/review', { method: "PATCH", body: JSON.stringify({ status, rejectionReason: reason }) });
      setNotice(result.message); setTarget(null); setReason(""); await load();
    } catch (e: any) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  }
  const pending = payments.some(p => p.status === "PENDING");
  return <div className="mx-auto max-w-6xl space-y-6 pb-12">
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-black">{review ? "Payment Verification" : "Subscription Payment"}</h1><p className="mt-1 text-sm text-zinc-500">{review ? "Review bank payments and activate school subscriptions." : "Transfer your subscription payment, then submit proof for review."}</p></div><button className={button} disabled={busy} onClick={() => { setError(""); load().then(() => review ? undefined : refreshUser()).catch(e => setError(e.message)); }}>Refresh status</button></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p role="status">Loading payments…</p> : <>
    {!review && data && <>
      <section className={card}><h2 className="font-bold">Selected Plan</h2><p className="mt-2 text-lg font-bold">{data.subscription?.name || data.subscription?.plan}</p><p className="mt-1 text-sm text-zinc-600">PKR {Number(data.subscription?.price || 0).toLocaleString()} · {data.subscription?.billingCycle === "annual" ? "12 months, billed annually" : "1 month, billed monthly"}</p><p className="mt-2 text-sm text-zinc-500">Paid subscription starts after approval. Existing access stays subject to its current subscription.</p></section>
      <section className={card}><h2 className="font-bold">Payment Information</h2><p className="mt-2 text-sm text-zinc-500">Use the IBAN for your UBL bank transfer. Payment submission requires manual approval.</p><PaymentBankDetails bank={data.bank}/><p className="mt-4 text-sm font-semibold">{data.subscription?.plan} · {data.subscription?.billingCycle} · PKR {Number(data.subscription?.price || 0).toLocaleString()}</p></section>
      {!(data.subscription?.price > 0) && <Link href="/pricing" className="block rounded-xl border border-zinc-200 bg-white p-5 font-semibold text-red-600">Select a paid plan to upgrade your free trial</Link>}
      {pending ? <p className={card}>Your payment is PENDING. Please wait for review before submitting again.</p> : <form className={card} onSubmit={e => { e.preventDefault(); void submit(); }}>
        <h2 className="font-bold">Upload Payment Screenshot</h2>
        <div className="mt-4 rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void choose(e.dataTransfer.files[0]); }}>
          <UploadCloud className="mx-auto text-zinc-400" size={28}/><p className="my-3 text-sm text-zinc-500">Drag & drop your screenshot · JPG, JPEG, PNG, WebP · Maximum 5 MB</p>
          <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" disabled={busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }}/>
          <button className={button} type="button" disabled={busy} onClick={() => input.current?.click()}>{image ? "Replace Screenshot" : "Choose Screenshot"}</button>
          {image && <div className="mt-4"><img src={image} alt="Selected payment screenshot" className="mx-auto max-h-72 max-w-full rounded-lg"/><button type="button" className={button+" mt-3"} disabled={busy} onClick={() => setImage("")}>Remove Screenshot</button></div>}
        </div>
        <label className="mt-4 block text-sm font-semibold">Transfer reference (optional)<input className="mt-2 block w-full rounded-lg border border-zinc-300 p-3" maxLength={160} value={reference} disabled={busy} onChange={e => setReference(e.target.value)}/></label>
        {!image && <p className="mt-3 text-sm text-zinc-500">A screenshot is required before submission.</p>}
        <button className="mt-4 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !data.subscription || !(data.subscription.price > 0)}>{busy ? "Submitting…" : "Submit Payment for Verification"}</button>
      </form>}
      <aside className={card}><h2 className="font-bold">24-Hour Verification Notice</h2><p className="mt-2 text-sm text-zinc-600">Your payment will be reviewed within 24 hours. After successful verification, your CRM access/login will be approved.</p><p className="mt-2 text-sm text-zinc-600">Submitting payment does not automatically approve access.</p></aside>
    </>}
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"><h2 className="border-b p-4 font-bold">{review ? "Subscription payments" : "Your payment history"}</h2><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>{[...(review ? ["School", "Admin / User"] : []), "Selected Plan", "Amount", "Account / Reference", "Screenshot", "Submitted At", "Status", "Actions"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{payments.map(p => <tr key={p._id} className="border-t">{review && <><td className="p-3">{p.schoolId?.name || "Deleted school"}</td><td className="p-3">{p.userId?.name}<div className="text-xs text-zinc-500">{p.userId?.email}</div></td></>}<td className="p-3 font-semibold">{p.plan}<div className="text-xs font-normal text-zinc-500">{p.billingCycle}</div></td><td className="p-3">PKR {p.amount.toLocaleString()}</td><td className="p-3 break-all">{p.account}<div className="text-xs text-zinc-500">{p.reference || "No reference"}</div></td><td className="p-3"><button className={button} onClick={() => apiFetch('/subscription-payments/'+p._id+'/screenshot').then(r => setView(r.data.image)).catch(e => setError(e.message))}>View Screenshot</button></td><td className="p-3">{new Date(p.submittedAt).toLocaleString()}</td><td className="p-3"><span className={"rounded-md px-2 py-1 text-xs font-bold "+(p.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : p.status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{p.status}</span>{p.rejectionReason && <p className="mt-2 text-xs text-red-700">{p.rejectionReason}</p>}</td><td className="p-3">{review && (p.status === "PENDING" || (p.status === "APPROVED" && p.activationComplete === false)) && <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void decide(p, "APPROVED")}>{p.status === "APPROVED" || p.reviewDecision ? "Complete Activation" : "Approve Payment"}</button>{p.status === "PENDING" && !p.reviewDecision && <button className={button} disabled={busy} onClick={() => { setTarget(p); setReason(""); }}>Reject Payment</button>}</div>}</td></tr>)}</tbody></table></div>{!payments.length && <p className="p-8 text-center text-sm text-zinc-500">No payments submitted yet.</p>}</section></>}
    {(view || target) && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={view ? "Payment screenshot" : "Reject payment"}><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5"><button className="float-right rounded-lg p-2" aria-label="Close dialog" disabled={busy} onClick={() => { setView(""); setTarget(null); }}><X/></button>{view ? <img alt="Payment proof" src={view} className="mt-8 max-h-[75vh] w-full object-contain"/> : <><h2 className="font-bold">Rejection reason</h2>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<textarea aria-label="Rejection reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="my-4 w-full rounded-lg border p-3"/><button className={button} disabled={busy || !reason.trim()} onClick={() => target && void decide(target, "REJECTED")}>Confirm Rejection</button></>}</div></div>}
  </div>;
}



