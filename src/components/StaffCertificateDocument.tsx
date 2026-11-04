"use client";
/* eslint-disable @next/next/no-img-element -- Native images keep certificate print and PDF-preview dimensions exact. */
import { schoolDocumentDate } from "./SchoolDocumentTemplate";

export function StaffCertificateDocument({ snapshot, revoked = false, replaced = false, preview = false }: { snapshot: any; revoked?: boolean; replaced?: boolean; preview?: boolean }) {
  const school = snapshot?.school || {}, staff = snapshot?.staff || {}, style = snapshot?.style || {};
  return <article className={`school-document sd-document staff-certificate-document sd-font-${style.font === "serif" ? "serif" : "sans"}`} data-page-size="A4" data-page-orientation={style.orientation === "portrait" ? "portrait" : "landscape"} data-page-margin="0" data-document-revoked={revoked ? "true" : undefined} style={{ ["--staff-accent" as any]: style.color || "#b20913", backgroundImage: snapshot.background ? `linear-gradient(#ffffffdc,#ffffffdc),url(${snapshot.background})` : undefined, fontFamily: style.font === "serif" ? "Georgia,serif" : "Arial,sans-serif" }}>
    {preview && <div className="staff-cert-preview-label">PREVIEW · NOT ISSUED</div>}
    {revoked && <div className="staff-cert-revoked">REVOKED · NOT A VALID CERTIFICATE</div>}
    {replaced && <div className="staff-cert-revoked">REPLACED · SUPERSEDED BY A NEW CERTIFICATE</div>}
    <div className={`staff-cert-frame staff-cert-border-${style.border || "double"}`}>
      <header className="staff-cert-header">
        {school.logoUrl ? <img src={school.logoUrl} alt={`${school.name || "School"} logo`} /> : <span className="staff-cert-logo-placeholder">School logo</span>}
        <div><h1>{school.name || "School name"}</h1><p>{school.address}</p><p>{[school.phone, school.email, school.website].filter(Boolean).join(" · ")}</p></div>
      </header>
      <div className="staff-cert-rule" />
      <div className="staff-cert-content">
        <p className="staff-cert-eyebrow">OFFICIAL STAFF CERTIFICATE</p>
        <h2>{snapshot.certificateTitle || "Staff Certificate"}</h2>
        <p className="staff-cert-presented">This certificate is respectfully presented to</p>
        <h3>{staff.name || "Staff member"}</h3>
        <p className="staff-cert-meta">{[staff.designation, staff.department, staff.employeeId ? `Employee ID ${staff.employeeId}` : ""].filter(Boolean).join(" · ")}</p>
        <p className="staff-cert-body">{snapshot.body || "Certificate content"}</p>
        <div className="staff-cert-facts">{[["Employee ID",staff.employeeId],["Designation",staff.designation],["Department",staff.department],["Joining date",staff.joiningDate],["Employment status",staff.employmentStatus],["Issue date",schoolDocumentDate(snapshot.issuedAt || snapshot.issueDate)]].filter(([,value])=>!!value).map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{String(value)}</strong></div>)}</div>
      </div>
      <footer className="staff-cert-footer">
        <div className="staff-cert-signatory">{(school.staffSignature || school.signature) && <img className="staff-cert-signature" src={school.staffSignature || school.signature} alt="Authorized signature" />}<span /> <strong>{school.signatoryName || school.principalName || "Authorized signatory"}</strong><small>{school.signatoryDesignation || "School administration"}</small></div>
        {school.stamp && <img className="staff-cert-stamp" src={school.stamp} alt="School stamp" />}
        {snapshot.verificationQr ? <div className="staff-cert-verify"><img src={snapshot.verificationQr} alt="Certificate QR verification"/><small>Scan to verify</small></div> : <div className="staff-cert-number"><span>Certificate number</span><strong>{snapshot.certificateNumber || "Assigned when issued"}</strong></div>}
      </footer>
    </div>
  </article>;
}
