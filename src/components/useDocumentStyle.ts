"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { defaultDocumentStyle, DocumentType } from "@/lib/document-templates";
import { useAuth } from "@/lib/auth-context";
export function useDocumentStyle(
  type: DocumentType,
  snapshotStyle?: any,
  snapshotBranding?: any,
) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(!snapshotStyle),
    [error, setError] = useState("");
  const [config, setConfig] = useState<any>({
    style: defaultDocumentStyle(type),
    branding: {},
  });
  useEffect(() => {
    let active = true;
    const load = () => {
      if (snapshotStyle) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      if (
        !snapshotStyle &&
        [
          "SCHOOL_ADMIN",
          "FINANCE",
          "EXAM_STAFF",
          "RECEPTIONIST",
          "PARENT",
          "TEACHER",
        ].includes(user?.userType || "")
      )
        apiFetch("/school-documents/style?type=" + type)
          .then((r) => {
            if (active)
              setConfig({
                ...r.data,
                style: { ...defaultDocumentStyle(type), ...r.data.style },
              });
          })
          .catch((e) => {
            if (active) setError(e.message);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      else setLoading(false);
    };
    load();
    window.addEventListener("acadivo:document-settings-changed", load);
    return () => {
      active = false;
      window.removeEventListener("acadivo:document-settings-changed", load);
    };
  }, [
    type,
    snapshotStyle,
    user?.id,
    user?.userType,
    user?.branchId,
    user?.school?._id,
  ]);
  return {
    ...config,
    loading,
    error,
    branding: snapshotBranding || config.branding,
    style: {
      ...defaultDocumentStyle(type),
      ...(snapshotStyle || config.style),
    },
  };
}
