"use client";
import { useEffect, useState, useRef } from "react";
import { printSchoolDocument } from "@/lib/print-school-document";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import { SchoolDocumentTemplate } from "./SchoolDocumentTemplate";
export function SchoolDocumentPreview({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch("/school-documents/preview", {
      method: "POST",
      body: JSON.stringify({ type: "admission", studentId }),
    })
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [studentId]);
  return <DocumentPreviewOverlay data={data} error={error} onClose={onClose} />;
}
export function DocumentPreviewOverlay({
  data,
  error,
  onClose,
}: {
  data: any;
  error?: string;
  onClose: () => void;
}) {
  const [printError, setPrintError] = useState("");
  const ref = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const origin = document.activeElement as HTMLElement;
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      origin?.focus();
    };
  }, []);
  const card = ["student-id", "staff-id"].includes(data?.type);
  return createPortal(
    <div className="financial-preview-overlay">
      <div
        ref={dialog}
        className="financial-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="School document preview"
      >
        <div className="financial-preview-actions">
          <strong>School document preview</strong>
          <button
            disabled={!data}
            onClick={() =>
              void printSchoolDocument(
                dialog.current?.querySelector(".school-document"),
              ).catch((e) => setPrintError(e.message))
            }
          >
            Print / Save PDF
          </button>
          <button ref={ref} onClick={onClose}>
            Close
          </button>
        </div>
        {error || printError ? (
          <p role="alert" className="text-red-700">
            {error || printError}
          </p>
        ) : data ? (
          <>
            <style>{`@media print{@page{size:${card ? "85.6mm 54mm" : "A4 " + (data.style?.orientation || "portrait")};margin:${card ? 0 : data.style?.margin || 12}mm;}}`}</style>
            <SchoolDocumentTemplate data={data} />
          </>
        ) : (
          <p role="status">Loading school document…</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
