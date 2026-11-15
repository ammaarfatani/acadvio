"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { SessionUser } from "@/lib/auth-context";

export type AssistantBrand = { name?: string; logoUrl?: string; scope: string };

export function useAssistantBrand(user: SessionUser | null): AssistantBrand {
  const school = user?.school;
  const schoolId = school?._id;
  const branchId = user?.branchId;
  const scope = JSON.stringify([user?.id, schoolId, branchId, school?.name, school?.logoUrl]);
  // The settings endpoint supplies branch overrides only to roles that already have access.
  const canReadBranch = Boolean(schoolId && branchId && branchId !== schoolId &&
    user?.permissions?.includes("settings.view"));
  const [branchBrand, setBranchBrand] = useState<AssistantBrand>();

  useEffect(() => {
    if (!canReadBranch) return;
    const controller = new AbortController();
    void apiFetch("/schools/profile", { signal: controller.signal, cache: "no-store" })
      .then(({ data }) => {
        if (!controller.signal.aborted && data?._id === schoolId) {
          setBranchBrand({ scope, name: data.name, logoUrl: data.logoUrl });
        }
      })
      .catch(() => { /* The authenticated school profile remains available. */ });
    return () => controller.abort();
  }, [canReadBranch, schoolId, scope]);

  if (canReadBranch && branchBrand?.scope === scope) return branchBrand;
  return { scope, name: school?.name, logoUrl: school?.logoUrl };
}

const platformLogo = "/acadivo-icon.png";
const sizes = {
  compact: "size-7 p-1",
  avatar: "size-9 p-1",
  header: "size-11 p-1.5 sm:size-12",
  welcome: "size-16 p-2.5 sm:size-[72px]",
  launcher: "size-14 p-2",
};

function LogoImage({ src, alt, decorative }: { src?: string; alt: string; decorative: boolean }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const showSchool = Boolean(src) && status === "loaded";
  const showFallback = !src || status !== "loaded";
  return (
    <span className="relative block size-full" aria-hidden={decorative || undefined}>
      {showFallback && (
        <img src={platformLogo} alt={decorative ? "" : "Acadivo logo"} className="absolute inset-0 size-full object-contain" />
      )}
      {src && status !== "failed" && (
        <img
          src={src}
          alt={decorative ? "" : alt}
          aria-hidden={!showSchool || undefined}
          className={`absolute inset-0 size-full object-contain motion-safe:transition-opacity ${showSchool ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
        />
      )}
    </span>
  );
}

export function AssistantLogo({ brand, size, decorative = false }: {
  brand: AssistantBrand;
  size: keyof typeof sizes;
  decorative?: boolean;
}) {
  return (
    <span className={`inline-flex shrink-0 rounded-full border border-slate-200 bg-white shadow-sm ${sizes[size]}`}>
      <LogoImage
        key={JSON.stringify([brand.scope, brand.logoUrl])}
        src={brand.logoUrl}
        alt={`${brand.name || "School"} logo`}
        decorative={decorative}
      />
    </span>
  );
}
