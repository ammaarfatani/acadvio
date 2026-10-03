"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
export default function SchoolLogo({ fallback, className = "h-full w-full rounded-[inherit] object-contain" }: { fallback?: React.ReactNode; className?: string }) {
  const { user } = useAuth();
  const [failedUrl, setFailedUrl] = useState("");
  const logo = user?.school?.logoUrl;
  if (logo && logo !== failedUrl) return <img key={logo} src={logo} alt={(user?.school?.name || "School")+" logo"} className={className} onError={() => setFailedUrl(logo)}/>;
  return <>{fallback || user?.school?.name?.charAt(0) || "S"}</>;
}
