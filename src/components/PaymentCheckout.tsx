"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FreeTrialForm } from "@/components/FreeTrialForm";
import SubscriptionPayments from "@/components/SubscriptionPayments";
import PaymentBankDetails from "@/components/PaymentBankDetails";
import {ArrowRight,ArrowLeft,Globe2,CreditCard,ShieldCheck,Check} from "lucide-react";
import {money} from "@/lib/market-pricing";

export default function PaymentCheckout() {
  const params = useSearchParams();
  const plan = params.get("plan") || "";
  const billingCycle = params.get("billingCycle") || "monthly";
  const market=params.get("market")||"PK";
  const { user, loading, refreshUser } = useAuth();
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setQuote(null); setError("");
    apiFetch("/subscription-payments/quote?plan="+encodeURIComponent(plan)+"&billingCycle="+encodeURIComponent(billingCycle)+"&market="+encodeURIComponent(market)).then(r => { if (live) setQuote(r.data); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [plan, billingCycle,market]);
  const next = "/payment?plan="+encodeURIComponent(plan)+"&billingCycle="+encodeURIComponent(billingCycle)+"&market="+encodeURIComponent(market);
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6"><p role="alert" className="text-red-800">{error}</p><Link href="/pricing" className="mt-3 inline-block font-semibold underline">Choose a subscription plan</Link></div>;
  if (loading || !quote) return <p role="status" className="py-12 text-center text-sm text-zinc-500">Loading selected subscription…</p>;
  if(quote.subscription.checkoutAvailable===false){
    const selected=quote.subscription;
    return <div className="ac-quote-layout">
      <aside className="ac-quote-summary" aria-label="Selected subscription">
        <div className="ac-quote-summary-top"><span>YOUR SELECTED PLAN</span><span className="ac-quote-currency">{selected.currency}</span></div>
        <h2>{selected.name}</h2>
        <p className="ac-quote-price">{money(selected.price,selected.currency)}<span>/{billingCycle==="annual"?"year":"month"}</span></p>
        <p className="ac-quote-billing-note">{billingCycle==="annual"?"12 months of access, billed as 10 monthly payments.":"Monthly subscription · One month of access."}</p>
        <dl><div><dt><Globe2 size={15}/>Pricing region</dt><dd>{selected.country}</dd></div><div><dt>Billing cycle</dt><dd>{billingCycle==="annual"?"Annual":"Monthly"}</dd></div><div><dt>Subscription period</dt><dd>{selected.durationMonths} {selected.durationMonths===1?"month":"months"}</dd></div></dl>
        <div className="ac-quote-included"><Check size={16}/><span>Portal guides & onboarding guidance included.</span></div>
        {selected.converted&&<p className="ac-quote-rate">Converted estimate · Updated {new Date(selected.rateUpdatedAt).toLocaleDateString("en-GB",{timeZone:"UTC"})}<br/><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates By Exchange Rate API</a></p>}
        <Link className="ac-quote-change" href="/pricing"><ArrowLeft size={14}/> Change country or plan</Link>
      </aside>
      <section className="ac-quote-next" aria-labelledby="quote-next-title">
        <div className="ac-quote-icon"><CreditCard size={23}/></div><p className="ac-quote-eyebrow">PAYMENT OPTIONS</p>
        <h2 id="quote-next-title">A little help with<br/>your next step.</h2>
        <p className="ac-quote-lead">Online checkout in {selected.currency} is not available yet. Talk to our team about supported payment options for this plan.</p>
        <div className="ac-quote-status" role="status"><span aria-hidden="true"/>Payment arrangement required</div>
        <ol className="ac-quote-steps"><li><span>01</span><div><h3>Share your selected plan</h3><p>Send this regional quote to our team through the contact form.</p></div></li><li><span>02</span><div><h3>Confirm the payment options</h3><p>Arrange a supported method before making any transfer.</p></div></li></ol>
        <Link className="ac-quote-primary" href={"/contact?plan="+encodeURIComponent(plan)+"&market="+encodeURIComponent(market)+"&billingCycle="+encodeURIComponent(billingCycle)}>Discuss this quote <ArrowRight size={17}/></Link>
        <p className="ac-quote-assurance"><ShieldCheck size={17}/><span>No payment has been taken. Your subscription starts only after payment is confirmed.</span></p>
      </section>
    </div>;
  }
  if (user && user.userType !== "SCHOOL_ADMIN") return <div className="rounded-2xl border bg-white p-6"><h1 className="text-xl font-bold">School administrator account required</h1><p className="mt-2 text-sm text-zinc-600">Only a school administrator can submit subscription payments for their school.</p></div>;
  if (user) return <SubscriptionPayments key={plan+":"+billingCycle} selection={{ plan, billingCycle }}/>;
  return <div className="mx-auto max-w-3xl space-y-6"><header><h1 className="text-2xl font-black">Subscription Payment</h1><p className="mt-2 text-sm text-zinc-600">Register your school or sign in, then upload your payment screenshot.</p></header><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-bold">Selected Plan</h2><p className="mt-2 text-lg font-bold">{quote.subscription.name}</p><p className="mt-1 text-sm">{money(quote.subscription.price,quote.subscription.currency)} · {quote.subscription.durationMonths} {quote.subscription.durationMonths === 1 ? "month" : "months"} · {quote.subscription.billingCycle} billing</p>{billingCycle === "annual" && <p className="mt-2 text-xs text-zinc-500">{money(quote.subscription.monthlyPrice,quote.subscription.currency)} per month, billed as one annual payment.</p>}<p className="mt-3 text-sm text-zinc-600">Your paid subscription starts after payment approval. To request a free trial, use Try Free Now in the top bar.</p></section><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-bold">Payment Information</h2><p className="mt-2 text-sm text-zinc-600">Transfer the selected plan amount to UBL and keep your payment screenshot.</p><PaymentBankDetails bank={quote.bank}/></section><section className="rounded-xl border border-zinc-200 bg-white p-5 text-sm"><p>Already registered? <Link href={"/login?next="+encodeURIComponent(next)} className="font-semibold text-red-600 underline">Sign in to submit payment</Link></p></section><FreeTrialForm key={plan+":"+billingCycle} checkout selectedPlan={plan} onRegistered={async () => { await refreshUser(); }}/><aside className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">Your payment will be reviewed within 24 hours. After successful verification, your CRM access/login will be approved. Submitting payment does not automatically approve access.</aside></div>;
}

