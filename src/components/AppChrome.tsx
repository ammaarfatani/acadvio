"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WebsiteGuide } from "@/components/WebsiteGuide";
import { useAuth } from "@/lib/auth-context";

const roleHome: Record<string, string> = {
  SUPER_ADMIN: "/super-admin",
  SCHOOL_ADMIN: "/school-admin",
  TEACHER: "/teacher",
  FINANCE: "/finance",
  EXAM_STAFF: "/exam-staff",
  RECEPTIONIST: "/receptionist",
};

function isPortalPath(path: string) {
  return ["/super-admin", "/school-admin", "/teacher", "/finance", "/exam-staff", "/receptionist"].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  ) || /^\/[^/]+\/(admin|teacher|staff|finance|exam-staff)(\/|$)/.test(path);
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
  return false;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const portal = isPortalPath(pathname);
  const { user, loading, clearSession } = useAuth();
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    const onFeedback = (event: Event) => {
      const detail = (event as CustomEvent<{ type: "error" | "success"; message: string }>).detail;
      if (detail?.message) setFeedback(detail);
      window.setTimeout(() => setFeedback(null), 5000);
    };
    window.addEventListener("acadivo:feedback", onFeedback);
    return () => window.removeEventListener("acadivo:feedback", onFeedback);
  }, []);

  useEffect(() => {
    if (!portal) return;
    if (loading) return;
    if (!user) {
      const match = pathname.match(/^\/([^/]+)\/(?:admin|teacher|staff|finance|exam-staff)/);
      router.replace(match ? `/${match[1]}/login?reason=session` : "/login?reason=session");
      return;
    }
    const staticAliases: Record<string, string> = {
      "/school-admin": "admin",
      "/teacher": "teacher",
      "/finance": "finance",
      "/exam-staff": "exam-staff",
      "/receptionist": "staff",
    };
    if (user.school?.slug) {
      const legacyPrefix = Object.keys(staticAliases).find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      if (legacyPrefix) {
        const rest = pathname.slice(legacyPrefix.length);
        router.replace(`/${user.school.slug}/${staticAliases[legacyPrefix]}${rest}`);
        return;
      }
    }
    const billingOnly = user.userType === "SCHOOL_ADMIN" && (user.status === "PENDING_APPROVAL" || (user.school?.status && !["ACTIVE", "TRIAL"].includes(user.school.status)));
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
    const scoped = parts.length > 1 && !["super-admin", "school-admin", "teacher", "finance", "exam-staff", "receptionist"].includes(parts[0]);
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
    if (loading || !user) {
      return (
        <main className="min-h-screen grid place-items-center bg-zinc-100 text-sm text-zinc-600" role="status">
          {loading ? "Restoring your session…" : "Redirecting to sign in…"}
        </main>
      );
    }
    return <>{children}{feedback && <div className={`fixed bottom-4 right-4 z-[100] max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl ${feedback.type === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} role="status">{feedback.message}</div>}</>;
  }

  return (
    <>
      <Navbar />
      <main className="flex-grow">{children}</main>
      <Footer />
      <WebsiteGuide />
      {feedback && <div className={`fixed bottom-4 right-4 z-[100] max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl ${feedback.type === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} role="status">{feedback.message}</div>}
    </>
  );
}



