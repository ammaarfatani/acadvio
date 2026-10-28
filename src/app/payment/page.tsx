import {Suspense} from "react";
import Link from "next/link";
import {ArrowLeft,ShieldCheck} from "lucide-react";
import PaymentCheckout from "@/components/PaymentCheckout";
export const metadata={title:"Subscription Payment — Acadivo"};
export default function Page(){return <div className="m-checkout m-section ac-checkout-page"><div className="m-wrap"><Link href="/pricing" className="ac-checkout-back"><ArrowLeft size={14}/> Back to plans</Link><header className="m-checkout-header"><div><p className="m-eyebrow">YOUR ACADIVO SUBSCRIPTION</p><h1>Your plan.<br/><em>A clear next step.</em></h1></div><p className="ac-checkout-intro">Review your subscription and the payment options available for your region.<span><ShieldCheck size={16}/> School access begins after approval.</span></p></header><div className="m-checkout-content"><Suspense fallback={<p role="status">Loading your selected plan…</p>}><PaymentCheckout/></Suspense></div></div></div>;}
