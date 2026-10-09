import Link from "next/link";
import {ArrowRight} from "lucide-react";
export function CTASection(){return <section className="m-cta"><div className="m-wrap"><div><p className="m-eyebrow">Your next school day</p><h2>Bring your school<br/>into the picture.</h2><p>Request a 14-day trial or choose a paid subscription. School access starts after approval.</p></div><div className="m-actions"><Link className="m-button m-button-white" href="/free-trial">Try Free Now <ArrowRight size={17}/></Link><Link className="m-button m-button-outline" href="/pricing">View plans</Link></div></div></section>;}
