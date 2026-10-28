"use client";
import { profilePhoto } from "@/lib/profile-photo";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParent } from "@/lib/parent-context";
import { defaultDocumentStyle, DocumentType } from "@/lib/document-templates";
import { DocumentPreviewOverlay } from "./SchoolDocumentPreview";
export default function ParentReport({
  record,
  student,
  kind,
  onClose,
}: {
  record: any;
  student: any;
  kind: "result" | "receipt" | "certificate";
  onClose: () => void;
}) {
  const { user } = useAuth(),
    parent = useParent();
  const [photo, setPhoto] = useState("");
  useEffect(() => {
    let active = true;
    setPhoto("");
    void profilePhoto(student).then((image) => {
      if (active) setPhoto(image);
    });
    return () => {
      active = false;
    };
  }, [student._id, student.photoUrl]);
  const types: any = {
    BONAFIDE: "bonafide",
    CHARACTER: "character",
    LEAVING: "leaving",
    TRANSFER: "transfer",
    RESULT: "report-card",
  };
  const type: DocumentType =
    kind === "result"
      ? "report-card"
      : kind === "receipt"
        ? "fee-receipt"
        : types[record.type] || "general-certificate";
  const existing = record.documentSnapshot;
  const school = parent.data?.documentBranding || user?.school;
  const challan =
    kind === "receipt"
      ? parent.data?.fees?.find(
          (c: any) =>
            String(c._id) === String(record.challanId?._id || record.challanId),
        )
      : null;
  const data =
    kind === "certificate" && existing
      ? {
          ...existing,
          type,
          certificate: record,
          generatedAt: record.issueDate,
        }
      : {
          type,
          school,
          student,
          photo,
          style:
            kind === "certificate"
              ? defaultDocumentStyle(type)
              : existing?.documentStyle ||
                (kind === "receipt"
                  ? defaultDocumentStyle(type)
                  : parent.data?.documentStyles?.[type]) ||
                defaultDocumentStyle(type),
          exam: { title: record.examTitle },
          result: kind === "result" ? record : null,
          payment:
            kind === "receipt"
              ? {
                  ...record,
                  challanId: challan || {
                    feeBreakdown: existing?.feeBreakdown,
                    challanNumber: existing?.challanNumber,
                    month: existing?.month,
                  },
                }
              : null,
          certificate: kind === "certificate" ? record : null,
          generatedAt: record.publishedAt || record.paidAt || record.issueDate,
        };
  return <DocumentPreviewOverlay data={data} onClose={onClose} />;
}
