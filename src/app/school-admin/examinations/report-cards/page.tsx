"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Keep old bookmarks working without retaining a second report-card workflow.
export default function RetiredReportCardsPage() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    router.replace(pathname.replace(/\/report-cards\/?$/, "/marksheets"));
  }, [pathname, router]);
  return null;
}
