import { Suspense } from "react";
import PaymentCheckout from "@/components/PaymentCheckout";
export const metadata = { title: "Subscription Payment — Acadivo" };
export default function Page() { return <main className="bg-zinc-100 px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto max-w-6xl"><Suspense fallback={<p role="status">Loading subscription…</p>}><PaymentCheckout/></Suspense></div></main>; }
