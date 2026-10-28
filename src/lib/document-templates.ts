export const DOCUMENT_TYPES = [
  "admission",
  "registration",
  "student-profile",
  "student-id",
  "report-card",
  "transcript",
  "character",
  "leaving",
  "bonafide",
  "transfer",
  "fee-receipt",
  "fee-statement",
  "attendance",
  "staff-id",
  "experience",
  "general-certificate",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  admission: "Student Admission Application Form",
  registration: "Student Registration Form",
  "student-profile": "Student Information Sheet",
  "student-id": "Student ID Card",
  "report-card": "Examination Report Card",
  transcript: "Academic Transcript",
  character: "Character Certificate",
  leaving: "School Leaving Certificate",
  bonafide: "Bonafide Certificate",
  transfer: "Transfer Certificate",
  "fee-receipt": "Fee Receipt",
  "fee-statement": "Outstanding Dues Statement",
  attendance: "Student Attendance Report",
  "staff-id": "Staff ID Card",
  experience: "Teacher Experience Certificate",
  "general-certificate": "General School Certificate",
};
export const DOCUMENT_FAMILIES = [
  {
    id: "modern",
    name: "Modern Premium",
    description: "Brand band, clear sections and structured details.",
  },
  {
    id: "classic",
    name: "Classic Academic",
    description: "Formal centered masthead, serif titles and ruled fields.",
  },
  {
    id: "institutional",
    name: "Elegant Institutional",
    description:
      "Crest-style masthead, framed page and strong section divisions.",
  },
] as const;
export type DocumentStyle = {
  pageSize?: "A4" | "A5" | "Letter";
  photoWidth?: number;
  photoHeight?: number;
  photoAlign?: "left" | "right";
  signatureWidth?: number;
  signatureHeight?: number;
  stampSize?: number;
  family: "modern" | "classic" | "institutional";
  color: string;
  font: "sans" | "serif";
  margin: number;
  orientation: "portrait" | "landscape";
  showPhoto: boolean;
  showMedical: boolean;
  showDeclaration: boolean;
  showSignatures: boolean;
  spacing: "compact" | "comfortable";
  footer: string;
  signatureLabels: string[];
  sectionOrder: string[];
};
export function defaultDocumentStyle(type: DocumentType): DocumentStyle {
  return {
    pageSize: "A4",
    photoWidth: 32,
    photoHeight: 40,
    photoAlign: "right",
    signatureWidth: 36,
    signatureHeight: 16,
    stampSize: 22,
    family:
      type.includes("certificate") ||
      ["character", "leaving", "bonafide", "transfer"].includes(type)
        ? "classic"
        : "modern",
    color: "#b20913",
    font: "sans",
    margin: 12,
    orientation: "portrait",
    showPhoto: true,
    showMedical: false,
    showDeclaration: true,
    showSignatures: true,
    spacing: "compact",
    footer: "",
    signatureLabels: ["report-card", "transcript"].includes(type)
      ? ["Class teacher", "Examination department", "Principal / school stamp"]
      : ["fee-receipt", "fee-statement"].includes(type)
        ? ["Accounts officer", "Payer / parent", "Authorized signatory"]
        : type === "attendance"
          ? ["Class teacher", "Attendance in-charge", "School administrator"]
          : type === "experience"
            ? [
                "HR / administration",
                "Authorized signatory",
                "Principal / school stamp",
              ]
            : [
                  "character",
                  "leaving",
                  "bonafide",
                  "transfer",
                  "general-certificate",
                ].includes(type)
              ? [
                  "Prepared by",
                  "Authorized signatory",
                  "Principal / school stamp",
                ]
              : [
                  "Parent / guardian",
                  "Admission officer",
                  "Principal / school stamp",
                ],
    sectionOrder: ["student", "parents", "addresses", "medical"],
  };
}
export const OPTIONAL_STUDENT_FIELDS = [
  ["nameUrdu", "Name in Urdu"],
  ["nationality", "Nationality"],
  ["religion", "Religion"],
  ["bloodGroup", "Blood group"],
  ["placeOfBirth", "Place of birth"],
  ["previousSchool", "Previous school"],
  ["previousClass", "Previous class"],
  ["permanentAddress", "Permanent address"],
  ["billingAddress", "Billing address"],
  ["motherOccupation", "Mother's occupation"],
  ["medicalInformation", "Emergency medical information"],
  ["allergies", "Allergies"],
  ["supportRequirements", "Support requirements"],
] as const;

export function documentTypesForRole(role: string): readonly DocumentType[] {
  return role === "SCHOOL_ADMIN"
    ? DOCUMENT_TYPES
    : role === "FINANCE"
      ? ["fee-receipt", "fee-statement"]
      : role === "EXAM_STAFF"
        ? [
            "report-card",
            "transcript",
            "character",
            "leaving",
            "bonafide",
            "transfer",
            "general-certificate",
          ]
        : role === "RECEPTIONIST"
          ? ["admission", "registration", "student-profile", "student-id"]
          : [];
}
// The school library contains student forms and official school documents.
// Finance and examination results retain their dedicated, permission-controlled workspaces.
export function documentLibraryTypesForRole(
  role: string,
): readonly DocumentType[] {
  const hidden: readonly DocumentType[] =
    role === "SCHOOL_ADMIN"
      ? [
          "fee-receipt",
          "fee-statement",
          "report-card",
          "transcript",
          "staff-id",
          "experience",
        ]
      : role === "EXAM_STAFF"
        ? ["report-card", "transcript"]
        : [];
  return documentTypesForRole(role).filter((type) => !hidden.includes(type));
}

export function documentStyleVariables(
  style: Partial<DocumentStyle> = {},
): Record<string, string> {
  return {
    "--sd-brand": style.color || "#b20913",
    "--sd-margin": (style.margin ?? 12) + "mm",
    "--sd-photo-width": (style.photoWidth ?? 32) + "mm",
    "--sd-photo-height": (style.photoHeight ?? 40) + "mm",
    "--sd-sign-width": (style.signatureWidth ?? 36) + "mm",
    "--sd-sign-height": (style.signatureHeight ?? 16) + "mm",
    "--sd-stamp-size": (style.stampSize ?? 22) + "mm",
  };
}
