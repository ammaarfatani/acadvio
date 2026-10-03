"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, User, Building2, ArrowRight, Eye, EyeOff } from "lucide-react";
import PublicLogo from "@/components/PublicLogo";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [schoolSlug, setSchoolSlug] = useState<string | null>(null);
  const [schoolDomain, setSchoolDomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [feedbackIsError, setFeedbackIsError] = useState(false);

  useEffect(() => {
    setSchoolSlug(new URLSearchParams(window.location.search).get("schoolSlug"));
    const reason = new URLSearchParams(window.location.search).get("reason");
    const messages: Record<string, string> = {
      session: "Please sign in to access that portal.",
      expired: "Your session expired. Please sign in again.",
      pending: "Your school is still awaiting approval. You will receive an email once approval is complete.",
      portal: "A portal is not currently configured for your role. Please contact your school administrator.",
    };
    if (reason && messages[reason]) {
      setLoginMessage(messages[reason]);
      setFeedbackIsError(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginMessage(null);
    setFeedbackIsError(false);

    try {
      const { authApi } = await import("@/lib/api");
      const response = await authApi.login({
        email,
        password,
        ...(schoolSlug ? { schoolSlug } : schoolDomain ? { schoolCode: schoolDomain } : {}),
      });
      setUser(response.data.user);
      const destinations: Record<string, string> = {
        SUPER_ADMIN: "/super-admin",
        SCHOOL_ADMIN: "/school-admin",
        TEACHER: "/teacher",
        FINANCE: "/finance",
        EXAM_STAFF: "/exam-staff",
        RECEPTIONIST: "/receptionist",
      };
      const scopedPortal: Record<string, string> = { SCHOOL_ADMIN: "admin", TEACHER: "teacher", FINANCE: "finance", RECEPTIONIST: "staff", EXAM_STAFF: "exam-staff" };
      const destination = schoolSlug && scopedPortal[response.data.user.userType]
        ? `/${schoolSlug}/${scopedPortal[response.data.user.userType]}`
        : destinations[response.data.user.userType];
      const returnTo = new URLSearchParams(window.location.search).get("next");
      let paymentReturn: string | null = null;
      if (returnTo && response.data.user.userType === "SCHOOL_ADMIN") {
        try { const target = new URL(returnTo, window.location.origin); if (target.origin === window.location.origin && target.pathname === "/payment") paymentReturn = target.pathname+target.search; } catch { /* Use the normal role portal. */ }
      }
      if (paymentReturn || destination) router.replace(paymentReturn || destination);
      else {
        setFeedbackIsError(true);
        setLoginMessage("A portal is not currently configured for your role. Please contact your school administrator.");
      }
    } catch (err: any) {
      setFeedbackIsError(true);
      setLoginMessage(err.message || "Unable to sign in. Please check your credentials and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = "w-full rounded-lg border border-zinc-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-red-100";
  return <div className="bg-zinc-50 px-4 py-12 sm:px-6 sm:py-20">
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-b border-zinc-200 bg-[#f7f7f8] lg:flex p-7 sm:p-10 lg:border-b-0 lg:border-r">
        <div><Link href="/" aria-label="Acadivo home"><PublicLogo className="w-40"/></Link><p className="mt-10 text-xs font-semibold uppercase tracking-[.15em] text-brand-600">Your school workspace</p><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Welcome back.<br/><span className="text-zinc-400">Let’s get to work.</span></h2><p className="mt-5 max-w-sm text-sm leading-7 text-zinc-600">Students, teaching, attendance, examinations and finance — connected around your school.</p></div>
        <div className="mt-10"><div className="flex gap-3 border-t border-zinc-200 pt-6"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600"/><p className="text-sm leading-6 text-zinc-600">Sign in with your staff account. Your role determines which school workspace you can access.</p></div><Link href="/demo" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">Explore the portals <ArrowRight size={15}/></Link></div>
      </div>
      <div className="p-7 sm:p-10"><h1 className="text-2xl font-semibold tracking-tight">{schoolSlug ? "School portal sign in" : "Sign in to Acadivo"}</h1><p className="mt-3 text-sm leading-6 text-zinc-500">{schoolSlug ? `Use your staff account for ${schoolSlug.replace(/-/g, " ")}.` : "Use the email and password provided by your school."}</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {!schoolSlug && <div><label htmlFor="school-code" className="block text-sm font-medium">School code <span className="font-normal text-zinc-500">(optional)</span></label><div className="relative mt-2"><Building2 size={17} className="absolute left-3 top-3.5 text-zinc-400"/><input id="school-code" autoComplete="organization" type="text" value={schoolDomain} onChange={event=>setSchoolDomain(event.target.value)} placeholder="Your school identifier" className={field}/></div></div>}
          <div><label htmlFor="login-email" className="block text-sm font-medium">Staff email</label><div className="relative mt-2"><User size={17} className="absolute left-3 top-3.5 text-zinc-400"/><input id="login-email" type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@school.edu" className={field}/></div></div>
          <div><label htmlFor="login-password" className="block text-sm font-medium">Password</label><div className="relative mt-2"><Lock size={17} className="absolute left-3 top-3.5 text-zinc-400"/><input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} className={field+" pr-12"}/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-1.5 rounded-md p-2 text-zinc-500 hover:bg-zinc-100">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
          {loginMessage && <div role="alert" className={`rounded-lg border p-3 text-sm leading-6 ${feedbackIsError ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{loginMessage}</div>}
          <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Signing in…" : "Sign in"}{!isSubmitting && <ArrowRight size={17}/>}</button>
        </form><p className="mt-5 text-xs leading-6 text-zinc-500">Need help accessing your account? Contact your school administrator or <Link href="/contact" className="font-medium text-brand-600 underline">AKTech support</Link>.</p><div className="mt-7 border-t border-zinc-200 pt-6"><p className="text-sm text-zinc-600">New to Acadivo?</p><Link href="/free-trial" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">Start your 14-day free trial <ArrowRight size={15}/></Link></div>
      </div>
    </div>
  </div>;
}

