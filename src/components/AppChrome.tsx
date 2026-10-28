"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { routeFeature } from "@/lib/plan-features";
import { Presence, RouteMotion } from "./Motion";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WebsiteGuide } from "@/components/WebsiteGuide";
import { canManageSchoolBilling } from "@/lib/billing-access";
import { useAuth } from "@/lib/auth-context";

const roleHome: Record<string, string> = {
  SUPER_ADMIN: "/super-admin",
  SCHOOL_ADMIN: "/school-admin",
  TEACHER: "/teacher",
  FINANCE: "/finance",
  EXAM_STAFF: "/exam-staff",
  RECEPTIONIST: "/receptionist",
  PARENT: "/parent",
};

function isPortalPath(path: string) {
  return ["/super-admin", "/school-admin", "/teacher", "/finance", "/exam-staff", "/receptionist", "/parent"].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  ) || /^\/[^/]+\/(admin|teacher|staff|finance|exam-staff|parent)(\/|$)/.test(path);
}

function canAccessPortal(path: string, userType: string) {
  if (path === "/super-admin" || path.startsWith("/super-admin/")) return userType === "SUPER_ADMIN";
  if (path === "/school-admin" || path.startsWith("/school-admin/")) {
    return userType === "SCHOOL_ADMIN";
  }
  if (path === "/teacher" || path.startsWith("/teacher/")) return userType === "TEACHER";
  if (path === "/finance" || path.startsWith("/finance/")) return userType === "FINANCE";
  if (path === "/exam-staff" || path.startsWith("/exam-staff/")) return userType === "EXAM_STAFF";
  if (path === "/receptionist" || path.startsWith("/receptionist/")) return userType === "RECEPTIONIST";
  if (path === "/parent" || path.startsWith("/parent/")) return userType === "PARENT";
  return false;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const portal = isPortalPath(pathname);
  const { user, loading, clearSession } = useAuth();
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(()=>{setFeedback(null);},[user?.id,pathname]);
  const feedbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(() => {
    const onFeedback = (event: Event) => {
      const detail = (event as CustomEvent<{ type: "error" | "success"; message: string }>).detail;
      if (detail?.message) setFeedback(detail);
      if(feedbackTimer.current)clearTimeout(feedbackTimer.current);
      if(detail.type!=="error")feedbackTimer.current=setTimeout(()=>setFeedback(null),5000);
    };
    window.addEventListener("acadivo:feedback", onFeedback);
    return () => {window.removeEventListener("acadivo:feedback", onFeedback);if(feedbackTimer.current)clearTimeout(feedbackTimer.current);};
  }, []);

  useEffect(() => {
    if (!portal) return;
    if (loading) return;
    if (!user) {
      const match = pathname.match(/^\/([^/]+)\/(?:admin|teacher|staff|finance|exam-staff|parent)/);
      router.replace(match ? `/${match[1]}/login?reason=session` : "/login?reason=session");
      return;
    }
    if (user.school?.status === "PENDING_APPROVAL" && user.school.registrationType !== "paid") {
      clearSession();
      router.replace("/login?reason=pending");
      return;
    }
    const staticAliases: Record<string, string> = {
      "/school-admin": "admin",
      "/teacher": "teacher",
      "/finance": "finance",
      "/exam-staff": "exam-staff",
      "/receptionist": "staff",
      "/parent": "parent",
    };
    if (user.school?.slug) {
      const legacyPrefix = Object.keys(staticAliases).find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      if (legacyPrefix) {
        const rest = pathname.slice(legacyPrefix.length);
        router.replace(`/${user.school.slug}/${staticAliases[legacyPrefix]}${rest}`);
        return;
      }
    }
    if (/\/(subscription|payments)$/.test(pathname) && user.userType !== "SUPER_ADMIN" && !canManageSchoolBilling(user)) {
      router.replace(user.school?.slug ? `/${user.school.slug}/${({SCHOOL_ADMIN:"admin",RECEPTIONIST:"staff"} as Record<string,string>)[user.userType] || user.userType.toLowerCase().replace("_","-")}` : roleHome[user.userType]);
      return;
    }
    if (user.userType === "SCHOOL_ADMIN" && !canManageSchoolBilling(user) && (user.school?.accountStatus === "DEACTIVATED" || (user.school?.status && !["ACTIVE", "TRIAL"].includes(user.school.status)))) return;
    const billingOnly = user.userType === "SCHOOL_ADMIN" && (user.school?.accountStatus === "DEACTIVATED" || user.status === "PENDING_APPROVAL" || (user.school?.status && !["ACTIVE", "TRIAL"].includes(user.school.status)));
    if (billingOnly && !pathname.endsWith("/payments") && !pathname.endsWith("/subscription")) {
      const destination = user.school?.status === "TRIAL_EXPIRED" ? "subscription" : "payments";
      router.replace((user.school?.slug ? "/"+user.school.slug+"/admin/" : "/school-admin/")+destination);
      return;
    }
    if (user.status && user.status !== "ACTIVE" && !billingOnly) {
      clearSession();
      router.replace("/login?reason=session");
      return;
    }
    const parts = pathname.split("/").filter(Boolean);
    const scoped = parts.length > 1 && !["super-admin", "school-admin", "teacher", "finance", "exam-staff", "receptionist", "parent"].includes(parts[0]);
    const slug = scoped ? parts[0] : null;
    if (slug && user.school?.slug !== slug) {
      router.replace(roleHome[user.userType] || "/login?reason=portal");
      return;
    }
    const route = scoped ? `/${parts[1] === "admin" ? "school-admin" : parts[1] === "staff" ? "receptionist" : parts[1]}${parts.length > 2 ? `/${parts.slice(2).join("/")}` : ""}` : pathname;
    if (!canAccessPortal(route, user.userType)) {
      const destination = roleHome[user.userType];
      router.replace(destination && user.school?.slug ? `/${user.school.slug}/${user.userType === "SCHOOL_ADMIN" ? "admin" : user.userType === "RECEPTIONIST" ? "staff" : user.userType === "FINANCE" ? "finance" : user.userType.toLowerCase().replace("_", "-")}` : destination || "/login?reason=portal");
    }
  }, [pathname, portal, loading, user, router, clearSession]);

  if (portal) {
    if (loading || !user || (user.school?.status === "PENDING_APPROVAL" && user.school.registrationType !== "paid")) {
      return (
        <main className="min-h-screen grid place-items-center bg-zinc-100 text-sm text-zinc-600" role="status">
          {loading ? "Restoring your session…" : "Redirecting to sign in…"}
        </main>
      );
    }
    const parts = pathname.split("/").filter(Boolean);
    const root = parts[1] === "admin" ? "school-admin" : parts[1] === "staff" ? "receptionist" : parts[1];
    const normalized = roleHome[parts[0].toUpperCase().replace("-", "_")] ? pathname : `/${root}${parts.length > 2 ? "/"+parts.slice(2).join("/") : ""}`;
    if (!canAccessPortal(normalized, user.userType)) return <main className="grid min-h-screen place-items-center bg-zinc-100 text-sm text-zinc-500">Redirecting to your portal…</main>;
    if (/\/(subscription|payments)$/.test(pathname) && user.userType !== "SUPER_ADMIN" && !canManageSchoolBilling(user)) return null;
    if (user.userType === "SCHOOL_ADMIN" && !canManageSchoolBilling(user) && (user.school?.accountStatus === "DEACTIVATED" || (user.school?.status && !["ACTIVE", "TRIAL"].includes(user.school.status)))) return <main className="grid min-h-screen place-items-center bg-zinc-100 p-6"><div className="max-w-md rounded-lg border bg-white p-6"><h1 className="font-semibold">School workspace unavailable</h1><p className="mt-3 text-sm text-zinc-600">Please contact your main school administrator to review the school&apos;s access status.</p></div></main>;
    const feature = routeFeature(pathname);
    if (user.userType !== "SUPER_ADMIN" && feature && !user.features?.includes(feature)) return <main className="grid min-h-screen place-items-center bg-zinc-100 p-6"><div className="rounded-xl border bg-white p-6"><h1 className="font-bold">Feature unavailable on your plan</h1><p className="mt-2 text-sm text-zinc-500">Contact your school administrator to upgrade the subscription.</p><button onClick={()=>router.replace(roleHome[user.userType] || "/login")} className="mt-4 rounded bg-red-600 px-4 py-2 text-sm text-white">Return to your portal</button></div></main>;
    return <>{children}<Presence show={!!feedback} kind="toast">{feedback && <div className={`fixed bottom-4 right-4 z-[100] max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl ${feedback.type === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} role="status">{feedback.message}<button aria-label="Dismiss notification" className="ml-4 shrink-0 font-bold" onClick={()=>setFeedback(null)}>×</button></div>}</Presence></>;
  }

  return (
    <div className="marketing-site">
      <Navbar />
      <main className="flex-grow"><RouteMotion>{children}</RouteMotion></main>
      <Footer />
      <WebsiteGuide />
      <Presence show={!!feedback} kind="toast">{feedback && <div className={`fixed bottom-4 right-4 z-[100] max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl ${feedback.type === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} role="status">{feedback.message}<button aria-label="Dismiss notification" className="ml-4 shrink-0 font-bold" onClick={()=>setFeedback(null)}>×</button></div>}</Presence>
    </div>
  );
}



