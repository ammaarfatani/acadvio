"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, User, Building2, ArrowRight, Eye, EyeOff } from "lucide-react";
import PublicLogo from "@/components/PublicLogo";
import {ProductFrame} from "@/components/Marketing";
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
      setUser((await authApi.getMe()).data);
      const destinations: Record<string, string> = {
        SUPER_ADMIN: "/super-admin",
        SCHOOL_ADMIN: "/school-admin",
        TEACHER: "/teacher",
        FINANCE: "/finance",
        EXAM_STAFF: "/exam-staff",
        RECEPTIONIST: "/receptionist",
        PARENT: "/parent",
      };
      const scopedPortal: Record<string, string> = { PARENT: "parent", SCHOOL_ADMIN: "admin", TEACHER: "teacher", FINANCE: "finance", RECEPTIONIST: "staff", EXAM_STAFF: "exam-staff" };
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
  return <div className="m-login ac-login-page">
    <div className="m-login-grid">
      <aside className="m-login-visual">
        <div className="m-login-brand"><Link href="/" aria-label="Acadivo home"><PublicLogo className="w-40"/></Link><span><span className="ac-login-status-dot"/>Your school workspace</span></div>
        <div className="m-login-story"><p className="m-eyebrow">ONE SCHOOL. CONNECTED.</p><h2>Less administration.<br/><em>More possibility.</em></h2><p>A focused workspace for the people who keep your school moving. Pick up right where you left off.</p></div>
        <div className="ac-login-preview"><div className="ac-login-preview-label"><span>INSIDE ACADIVO</span><span>School administration</span></div><ProductFrame image="school-admin.jpg" label="School administration" priority/></div>
        <div className="ac-login-modules"><span>Student records</span><span>Attendance</span><span>Fees & examinations</span></div>
        <div className="m-login-trust"><ShieldCheck size={18}/><p>The right access for every role.<span>Your school’s permissions determine the records you can view.</span></p></div>
      </aside>
      <div className="m-login-form"><div className="ac-login-form-heading"><span className="ac-login-lock"><Lock size={20}/></span><span>YOUR SCHOOL PORTAL</span></div><p className="m-eyebrow">WELCOME BACK</p><h1 className="text-2xl font-semibold tracking-tight">{schoolSlug ? "School portal sign in" : "Your school day starts here."}</h1><p className="mt-3 text-sm leading-6 text-zinc-500">{schoolSlug ? `Use your school account for ${schoolSlug.replace(/-/g, " ")}.` : "For school administrators, staff and parents. Use the account provided by your school."}</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {!schoolSlug && <div><label htmlFor="school-code" className="block text-sm font-medium">School code <span className="font-normal text-zinc-500">(optional)</span></label><div className="relative mt-2"><Building2 size={17} className="absolute left-3 top-3.5 text-zinc-400"/><input id="school-code" autoComplete="organization" type="text" value={schoolDomain} onChange={event=>setSchoolDomain(event.target.value)} placeholder="Your school identifier" className={field}/></div></div>}
          <div><label htmlFor="login-email" className="block text-sm font-medium">Account email</label><div className="relative mt-2"><User size={17} className="absolute left-3 top-3.5 text-zinc-400"/><input id="login-email" type="email" autoComplete="username" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@school.edu" className={field}/></div></div>
          <div><label htmlFor="login-password" className="block text-sm font-medium">Password</label><div className="relative mt-2"><Lock size={17} className="absolute left-3 top-3.5 text-zinc-400"/><input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="Enter your password" className={field+" pr-12"}/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} className="absolute right-2 top-1.5 rounded-md p-2 text-zinc-500 hover:bg-zinc-100">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
          {loginMessage && <div role="alert" className={`rounded-lg border p-3 text-sm leading-6 ${feedbackIsError ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{loginMessage}</div>}
          <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? "Signing in…" : "Sign in"}{!isSubmitting && <ArrowRight size={17}/>}</button>
        </form><Link href="/forgot-password" className="ac-login-forgot mt-4 inline-block text-sm text-brand-600">Forgot password?</Link><p className="mt-5 text-xs leading-6 text-zinc-500">Need help accessing your account? Contact your school administrator or <Link href="/contact" className="font-medium text-brand-600 underline">AKTech support</Link>.</p><div className="ac-login-new mt-7 border-t border-zinc-200 pt-6"><p className="text-sm text-zinc-600">New to Acadivo?</p><Link href="/free-trial" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-brand-600">Start your 14-day free trial <ArrowRight size={15}/></Link></div>
      </div>
    </div>
  </div>;
}

