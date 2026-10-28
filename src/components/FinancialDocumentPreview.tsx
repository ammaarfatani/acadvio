"use client";
import { useEffect, useRef, useState } from "react";
import { printSchoolDocument } from "@/lib/print-school-document";
import { createPortal } from "react-dom";
import { FeeDocument } from "./SchoolDocuments";
export default function FinancialDocumentPreview({
  challan,
  payment,
  onClose,
}: {
  challan: any;
  payment?: any;
  onClose: () => void;
}) {
  const [printError, setPrintError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const buttons =
          dialogRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="financial-preview-overlay">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={payment ? "Payment receipt preview" : "Fee challan preview"}
        className="financial-preview-dialog"
      >
        <div className="financial-preview-actions">
          <strong>
            {payment ? "Recorded payment receipt" : "Fee challan"}
          </strong>
          <button
            onClick={() =>
              void printSchoolDocument(
                dialogRef.current?.querySelector(".school-document"),
              ).catch((e) => setPrintError(e.message))
            }
          >
            Print / Save PDF
          </button>
          <button ref={closeRef} onClick={onClose}>
            Close
          </button>
        </div>
        {printError && <p role="alert">{printError}</p>}
        <FeeDocument challan={challan} payment={payment} />
      </div>
    </div>,
    document.body,
  );
}
