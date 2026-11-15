"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CompleteSchoolImportPage from "../complete-school-import/page";

/**
 * Legacy Migration Route: /school-admin/data-management/migration
 *
 * Automatically redirects to the canonical route:
 * /school-admin/data-management/complete-school-import
 *
 * Renders CompleteSchoolImportPage directly so any existing bookmark or link
 * remains 100% functional without breaking or flashing.
 */
export default function LegacyMigrationPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/school-admin/data-management/complete-school-import");
  }, [router]);

  return <CompleteSchoolImportPage />;
}
