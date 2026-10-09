"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FreeTrialForm } from "@/components/FreeTrialForm";
import SubscriptionPayments from "@/components/SubscriptionPayments";
import PaymentBankDetails from "@/components/PaymentBankDetails";

export default function PaymentCheckout() {
  const params = useSearchParams();
  const plan = params.get("plan") || "";
  const billingCycle = params.get("billingCycle") || "monthly";
  const { user, loading, refreshUser } = useAuth();
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setQuote(null); setError("");
    apiFetch("/subscription-payments/quote?plan="+encodeURIComponent(plan)+"&billingCycle="+encodeURIComponent(billingCycle)).then(r => { if (live) setQuote(r.data); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [plan, billingCycle]);
  const next = "/payment?plan="+encodeURIComponent(plan)+"&billingCycle="+encodeURIComponent(billingCycle);
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6"><p role="alert" className="text-red-800">{error}</p><Link href="/pricing" className="mt-3 inline-block font-semibold underline">Choose a subscription plan</Link></div>;
  if (loading || !quote) return <p role="status" className="py-12 text-center text-sm text-zinc-500">Loading selected subscription…</p>;
  if (user && user.userType !== "SCHOOL_ADMIN") return <div className="rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">School administrator account required</h1><p className="mt-2 text-sm text-zinc-600">Only a school administrator can submit subscription payments for their school.</p></div>;
  if (user) return <SubscriptionPayments key={plan+":"+billingCycle} selection={{ plan, billingCycle }}/>;
  return <div className="mx-auto max-w-3xl space-y-6"><header><h1 className="text-2xl font-black">Subscription Payment</h1><p className="mt-2 text-sm text-zinc-600">Register your school or sign in, then upload your payment screenshot.</p></header><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-bold">Selected Plan</h2><p className="mt-2 text-lg font-bold">{quote.subscription.name}</p><p className="mt-1 text-sm">PKR {quote.subscription.price.toLocaleString()} · {quote.subscription.durationMonths} {quote.subscription.durationMonths === 1 ? "month" : "months"} · {quote.subscription.billingCycle} billing</p>{billingCycle === "annual" && <p className="mt-2 text-xs text-zinc-500">PKR {quote.subscription.monthlyPrice.toLocaleString()} per month, billed as one annual payment.</p>}<p className="mt-3 text-sm text-zinc-600">Your paid subscription starts after payment approval. To request a free trial, use Try Free Now in the top bar.</p></section><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-bold">Payment Information</h2><p className="mt-2 text-sm text-zinc-600">Transfer the selected plan amount to UBL and keep your payment screenshot.</p><PaymentBankDetails bank={quote.bank}/></section><section className="rounded-xl border border-zinc-200 bg-white p-5 text-sm"><p>Already registered? <Link href={"/login?next="+encodeURIComponent(next)} className="font-semibold text-red-600 underline">Sign in to submit payment</Link></p></section><FreeTrialForm key={plan+":"+billingCycle} checkout selectedPlan={plan} onRegistered={async () => { await refreshUser(); }}/><aside className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">Your payment will be reviewed within 24 hours. After successful verification, your CRM access/login will be approved. Submitting payment does not automatically approve access.</aside></div>;
}
