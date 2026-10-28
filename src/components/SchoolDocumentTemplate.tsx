"use client";
import { DocumentProfilePhoto } from "./DocumentProfilePhoto";
import { CSSProperties } from "react";
import {
  DOCUMENT_LABELS,
  documentStyleVariables,
  DocumentStyle,
  defaultDocumentStyle,
  DocumentType,
} from "@/lib/document-templates";
import { DocumentSignatures } from "./DocumentSignatures";
import { AcademicDocument, FeeDocument } from "./SchoolDocuments";
export const schoolDocumentDate = (value: any) => {
  if (!value) return "Not provided";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Not provided"
    : d.toLocaleDateString("en-GB", {
        timeZone: "Asia/Karachi",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};
const show = (value: any) =>
  value === undefined || value === null || value === ""
    ? "Not provided"
    : String(value);
function Details({ title, rows }: { title: string; rows: any[][] }) {
  const visible = rows.filter(
    ([label, value]) =>
      label === "B-Form / CRC" ||
      (value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== "Not provided"),
  );
  if (!visible.length) return null;
  return (
    <section className="sd-section">
      <h3>{title}</h3>
      <dl>
        {visible.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd dir="auto">{show(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
const money = (n: any) =>
  Number(n || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function SchoolDocumentTemplate({
  data,
  preview = false,
}: {
  data: any;
  preview?: boolean;
}) {
  const type: DocumentType = data.type,
    style: DocumentStyle = { ...defaultDocumentStyle(type), ...data.style },
    school = data.school || {},
    s = data.student || {},
    staff = data.staff || {},
    parent = s.parentInfo || {},
    certificate = data.certificate;
  const certificateType = [
    "character",
    "leaving",
    "bonafide",
    "transfer",
    "experience",
    "general-certificate",
  ].includes(type);
  const card = ["student-id", "staff-id"].includes(type);
  const age = () => {
    if (!s.dob) return undefined;
    const dob = new Date(s.dob),
      now = new Date(data.generatedAt || data.issuedAt || Date.now());
    let age = now.getFullYear() - dob.getFullYear();
    if (
      now.getMonth() < dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
    )
      age--;
    return age >= 0 ? age : undefined;
  };
  const sections: any = {
    student: (
      <Details
        title="Student information"
        rows={[
          ["Full name", s.name],
          ["Student ID", s.studentId],
          ["Name in Urdu", s.nameUrdu],
          ["Date of birth", schoolDocumentDate(s.dob)],
          ["Age", age()],
          ["Gender", s.gender],
          ["B-Form / CRC", s.bFormNumber],
          ["Nationality", s.nationality],
          ["Religion", s.religion],
          ["Blood group", s.bloodGroup],
          ["Place of birth", s.placeOfBirth],
          [
            "Class / section",
            [s.className, s.sectionName].filter(Boolean).join(" / "),
          ],
          ["Roll number", s.rollNumber],
          ["Academic session", s.academicSessionName],
          ["Admission date", schoolDocumentDate(s.admissionDate)],
          ["Status", s.status],
          ["Previous school", s.previousSchool],
          ["Previous class", s.previousClass],
        ]}
      />
    ),
    parents: (
      <Details
        title="Parent / guardian information"
        rows={[
          ["Father's name", parent.fatherName],
          ["Father's occupation", parent.fatherOccupation],
          ["Father's CNIC", parent.fatherCnic],
          ["Father's phone", parent.fatherPhone],
          ["Mother's name", parent.motherName],
          ["Mother's occupation", s.motherOccupation],
          ["Mother's phone", parent.motherPhone],
          ["Guardian", parent.guardianName],
          ["Relationship", parent.guardianRelation],
          ["Primary email", parent.guardianEmail],
          ["Emergency contact", s.emergencyContact?.name],
          ["Emergency phone", s.emergencyContact?.phone],
        ]}
      />
    ),
    addresses: (
      <Details
        title="Address information"
        rows={[
          ["Present / residential address", s.address],
          ["Permanent address", s.permanentAddress],
          ["Billing address", s.billingAddress],
        ]}
      />
    ),
    medical: style.showMedical ? (
      <Details
        title="Medical and support information"
        rows={[
          ["Emergency medical information", s.medicalInformation],
          ["Allergies", s.allergies],
          ["Support requirements", s.supportRequirements],
        ]}
      />
    ) : null,
  };
  const certText =
    type === "character"
      ? `This certificate records the conduct remarks authorized by the school for ${s.name}: ${certificate?.conductRemarks || "Conduct remarks not recorded."}`
      : type === "bonafide"
        ? `This is to certify that ${s.name} is recorded as a student of this institution, admission number ${s.admissionNumber || "not recorded"}, class ${s.className || "not recorded"}, academic session ${s.academicSessionName || "not recorded"}.`
        : type === "leaving"
          ? `This school leaving certificate has been issued for ${s.name}, admission number ${s.admissionNumber || "not recorded"}. The school record status is ${s.status || "not recorded"}.`
          : type === "transfer"
            ? `This transfer certificate records the school particulars of ${s.name}, admission number ${s.admissionNumber || "not recorded"}, class ${s.className || "not recorded"}.`
            : data.statement;
  const theme = {
    ...documentStyleVariables(style),
  } as CSSProperties;
  return (
    <article
      className={`school-document sd-document sd-${style.family} sd-${type} sd-purpose-${data.certificatePurpose || "general"} sd-font-${style.font} sd-spacing-${style.spacing} ${card ? "sd-card" : ""} ${style.orientation === "landscape" && !card ? "sd-landscape" : ""}`}
      data-page-size={card ? "85.6mm 54mm" : style.pageSize || "A4"}
      data-page-orientation={style.orientation}
      data-page-margin={card ? 0 : style.margin}
      data-photo-align={style.photoAlign}
      style={theme}
    >
      {(preview || card) && (
        <div className="sd-preview-label">
          {preview
            ? "SAMPLE PREVIEW — NOT AN ISSUED DOCUMENT"
            : "PREVIEW — NOT ISSUED · ADMIN APPROVAL REQUIRED"}
        </div>
      )}
      <header className="sd-masthead">
        <div className="sd-branding">
          {school.logoUrl && (
            <img src={school.logoUrl} alt={school.name + " logo"} />
          )}
          {!school.logoUrl && preview && (
            <div className="sd-logo-placeholder">School logo</div>
          )}
          <div>
            <h1>{school.name || "School branding preview"}</h1>
            <p>{school.address}</p>
            <p>
              {[school.phone, school.email, school.website || school.domain]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {school.affiliation && <p>{school.affiliation}</p>}
          </div>
        </div>
        <div className="sd-title">
          <span>
            {card
              ? "SCHOOL IDENTIFICATION"
              : certificateType
                ? "OFFICIAL CERTIFICATE"
                : "SCHOOL RECORD"}
          </span>
          <h2>
            {type === "general-certificate" &&
            data.certificatePurpose &&
            data.certificatePurpose !== "general"
              ? (
                  {
                    achievement: "Certificate of Academic Achievement",
                    participation: "Certificate of Participation",
                    appreciation: "Certificate of Appreciation",
                  } as any
                )[data.certificatePurpose]
              : DOCUMENT_LABELS[type]}
          </h2>
          <p>
            {data.reference ||
              certificate?.certificateNumber ||
              s.admissionNumber ||
              "Preview"}
            {data.reference && certificate?.certificateNumber && (
              <>
                <br />
                <small>Certificate: {certificate.certificateNumber}</small>
              </>
            )}
          </p>
        </div>
      </header>
      {card ? (
        <div className="sd-card-body">
          {style.showPhoto &&
            (data.photo ? (
              <img src={data.photo} alt="Student photograph" />
            ) : (
              <div className="sd-photo">
                {(s.name || staff.name || "S").slice(0, 1)}
              </div>
            ))}
          <div>
            <h3>{s.name || staff.name}</h3>
            <p>
              {s.className
                ? [s.className, s.sectionName].filter(Boolean).join(" / ")
                : data.employment?.designation || staff.userType}
            </p>
            <p>
              ID:{" "}
              {s.admissionNumber ||
                data.employment?.employeeId ||
                "Not recorded"}
            </p>
            <p>{s.rollNumber ? "Roll: " + s.rollNumber : staff.email}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="sd-record-band">
            <span>
              {s.academicSessionName || "Academic session not recorded"}
            </span>
            <span>
              Issued:{" "}
              {schoolDocumentDate(
                data.issuedAt || certificate?.issueDate || data.generatedAt,
              )}
            </span>
          </div>
          {["admission", "registration", "student-profile"].includes(type) ? (
            <>
              {style.showPhoto && (
                <div className="sd-portrait-row">
                  <div>
                    <strong>{s.name}</strong>
                    <p>Admission: {show(s.admissionNumber)}</p>
                  </div>
                  {data.photo ? (
                    <img
                      src={data.photo}
                      alt={`${s.name} student photograph`}
                    />
                  ) : (
                    <div className="sd-photo">Student photograph</div>
                  )}
                </div>
              )}
              {style.sectionOrder.map((section) => (
                <div key={section}>{sections[section]}</div>
              ))}
              {style.showDeclaration && type !== "student-profile" && (
                <section className="sd-declaration">
                  <h3>Parent / guardian declaration</h3>
                  <p>
                    I confirm that the information supplied in this application
                    is accurate to the best of my knowledge. I will inform the
                    school of changes to contact, medical and guardian
                    information. Enrollment remains subject to the school’s
                    approved admission procedures.
                  </p>
                </section>
              )}
            </>
          ) : null}
          {type === "report-card" && style.showPhoto && data.photo && (
            <div className="sd-portrait-row">
              <strong>{s.name}</strong>
              <img src={data.photo} alt={`${s.name} student photograph`} />
            </div>
          )}
          {type === "report-card" && (
            <AcademicDocument
              school={school}
              student={s}
              exam={data.exam}
              result={data.result}
              embedded
              documentStyle={style}
            />
          )}
          {type === "transcript" && (
            <>
              {data.results?.length ? (
                data.results.map((r: any) => (
                  <section className="sd-section" key={r._id}>
                    <h3>{r.examId?.title || "Examination"}</h3>
                    <table className="document-table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Maximum</th>
                          <th>Obtained</th>
                          <th>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.subjectScores.map((score: any) => (
                          <tr key={score.subjectId || score.subjectName}>
                            <td>{score.subjectName}</td>
                            <td>{score.maxMarks}</td>
                            <td>
                              {score.isAbsent
                                ? "Absent"
                                : (score.obtainedMarks ?? "Pending")}
                            </td>
                            <td>{score.grade || "Pending"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      Total: {r.totalObtainedMarks ?? "Pending"} /{" "}
                      {r.totalMaxMarks ?? "Not recorded"} · Percentage:{" "}
                      {r.percentage == null ? "Pending" : r.percentage + "%"}
                    </p>
                  </section>
                ))
              ) : (
                <p>No processed results are available.</p>
              )}
            </>
          )}
          {type === "fee-receipt" && (
            <FeeDocument
              schoolBranding={school}
              challan={data.payment?.challanId}
              payment={data.payment}
              embedded
              documentStyle={style}
            />
          )}
          {type === "fee-statement" && (
            <>
              {data.photo ? (
                <div className="sd-portrait-row">
                  <strong>{s.name}</strong>
                  <img src={data.photo} alt={`${s.name} profile photograph`} />
                </div>
              ) : (
                <DocumentProfilePhoto student={s} />
              )}
              <Details
                title="Student account"
                rows={[
                  ["Student", s.name],
                  ["Admission / student ID", s.admissionNumber || s.studentId],
                  [
                    "Class / section",
                    [s.className, s.sectionName].filter(Boolean).join(" / "),
                  ],
                  ["Roll number", s.rollNumber],
                  [
                    "Academic session",
                    data.ledger?.period?.academicSession ||
                      s.academicSessionName,
                  ],
                  [
                    "Fee period",
                    data.ledger?.period?.month || "All recorded periods",
                  ],
                ]}
              />
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Period / challan</th>
                    <th>Tuition</th>
                    <th>Previous / arrears*</th>
                    <th>Discount / scholarship</th>
                    <th>Fine</th>
                    <th>Charged</th>
                    <th>Paid</th>
                    <th>Balance PKR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger?.challans?.length ? (
                    data.ledger.challans.map((c: any) => (
                      <tr key={c._id}>
                        <td>
                          {c.month} � {c.challanNumber}
                          {c.isVoided || c.status === "VOIDED"
                            ? " (Voided)"
                            : ""}
                          <small className="block">
                            {Object.entries(c.feeBreakdown || {})
                              .filter(
                                ([k, v]) =>
                                  ![
                                    "tuitionFee",
                                    "arrears",
                                    "discount",
                                    "scholarship",
                                    "lateFeeFine",
                                  ].includes(k) && Number(v) > 0,
                              )
                              .map(
                                ([k, v]) =>
                                  `${k.replace(/([A-Z])/g, " $1")}: ${money(v)}`,
                              )
                              .join(" � ")}
                          </small>
                        </td>
                        <td>{money(c.feeBreakdown?.tuitionFee)}</td>
                        <td>
                          {money(c.previousBalance || c.feeBreakdown?.arrears)}
                        </td>
                        <td>
                          {money(
                            Number(c.feeBreakdown?.discount || 0) +
                              Number(c.feeBreakdown?.scholarship || 0),
                          )}
                        </td>
                        <td>{money(c.feeBreakdown?.lateFeeFine)}</td>
                        <td>{money(c.totalAmountPKR)}</td>
                        <td>{money(c.paidAmountPKR)}</td>
                        <td>{money(c.remainingAmountPKR)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>
                        No fee invoices recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="document-note no-print">
                *Previous balance / arrears are recorded invoice amounts,
                already included where applicable; they are not added again.
                Voided invoices are excluded from totals.
              </p>
              <Details
                title="Account totals (PKR)"
                rows={[
                  ["Charged", money(data.ledger?.summary?.totalCharged)],
                  ["Payments credited", money(data.ledger?.summary?.totalPaid)],
                  [
                    "Discounts / scholarships",
                    money(data.ledger?.summary?.totalDiscounts),
                  ],
                  [
                    "Outstanding balance",
                    money(data.ledger?.summary?.remainingBalance),
                  ],
                ]}
              />
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Payment date</th>
                    <th>Receipt</th>
                    <th>Method</th>
                    <th>Received PKR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger?.payments?.length ? (
                    data.ledger.payments.map((p: any) => (
                      <tr key={p._id}>
                        <td>{schoolDocumentDate(p.paidAt)}</td>
                        <td>{p.receiptNumber}</td>
                        <td>{p.paymentMethod}</td>
                        <td>{money(p.amountPKR)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>No payment transactions recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
          {type === "attendance" && (
            <>
              <Details
                title="Attendance period"
                rows={[
                  ["Student", s.name],
                  ["From", schoolDocumentDate(data.from)],
                  ["To", schoolDocumentDate(data.to)],
                ]}
              />
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendance?.length ? (
                    data.attendance.map((r: any) => (
                      <tr key={r.date}>
                        <td>{schoolDocumentDate(r.date)}</td>
                        <td>{r.status}</td>
                        <td>{r.remarks || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>
                        No attendance was recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="document-note">
                This report includes recorded attendance days only. Unmarked
                days are not treated as recorded absences.
              </p>
            </>
          )}
          {certificateType && (
            <section className="sd-certificate-text">
              <p className="sd-cert-recipient">{s.name || staff.name}</p>
              <p>{certText}</p>
              {certificate?.reason && (
                <p>Purpose / remarks: {certificate.reason}</p>
              )}
              {["leaving", "transfer"].includes(type) && (
                <Details
                  title="Student particulars"
                  rows={[
                    [
                      "Parent / guardian",
                      parent.fatherName || parent.guardianName,
                    ],
                    ["Date of birth", schoolDocumentDate(s.dob)],
                    ["Admission date", schoolDocumentDate(s.admissionDate)],
                    [
                      "Class / session",
                      [s.className, s.academicSessionName]
                        .filter(Boolean)
                        .join(" / "),
                    ],
                  ]}
                />
              )}{" "}
              {type === "experience" && (
                <Details
                  title="Recorded employment"
                  rows={[
                    ["Employee ID", data.employment?.employeeId],
                    ["Designation", data.employment?.designation],
                    [
                      "Joining date",
                      schoolDocumentDate(data.employment?.joiningDate),
                    ],
                    [
                      "Leaving date",
                      schoolDocumentDate(data.employment?.leavingDate),
                    ],
                  ]}
                />
              )}
            </section>
          )}
          <DocumentSignatures school={school} style={style} />
        </>
      )}
      {style.footer && <p className="sd-footer">{style.footer}</p>}
    </article>
  );
}
