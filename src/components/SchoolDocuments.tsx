"use client";
import {
  defaultDocumentStyle,
  documentStyleVariables,
} from "@/lib/document-templates";
import { useDocumentStyle } from "./useDocumentStyle";
import { DocumentProfilePhoto } from "./DocumentProfilePhoto";
import { DocumentSignatures } from "./DocumentSignatures";
import { CSSProperties } from "react";
const amount = (n: any) =>
  Number(n || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const date = (value: any) =>
  value
    ? new Date(value).toLocaleDateString("en-PK", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "Not recorded";
export function DocumentHeader({
  school,
  title,
  reference,
}: {
  school: any;
  title: string;
  reference?: string;
}) {
  return (
    <header className="document-header">
      <div className="document-school">
        {school?.logoUrl && (
          <img src={school.logoUrl} alt={school.name + " logo"} />
        )}
        <div>
          <h2>{school?.name || "School"}</h2>
          {school?.address && <p>{school.address}</p>}
          <p>{[school?.phone, school?.email].filter(Boolean).join(" | ")}</p>
        </div>
      </div>
      <div className="document-title">
        <span>OFFICIAL SCHOOL DOCUMENT</span>
        <h3>{title}</h3>
        {reference && <p>{reference}</p>}
      </div>
    </header>
  );
}
export function FeeDocument({
  challan,
  payment,
  documentStyle,
  embedded = false,
  schoolBranding,
}: {
  challan: any;
  payment?: any;
  documentStyle?: any;
  embedded?: boolean;
  schoolBranding?: any;
}) {
  const config = useDocumentStyle(
    payment ? "fee-receipt" : "fee-statement",
    payment?.documentSnapshot?.documentStyle ||
      (!payment ? challan?.documentSnapshot?.documentStyle : undefined) ||
      documentStyle,
  );
  if (
    !challan ||
    (payment && !(payment.amountPKR > 0 && payment.receiptNumber))
  )
    return null;
  const snapshot = payment?.documentSnapshot || challan.documentSnapshot,
    school = { ...snapshot?.school, ...config.branding, ...schoolBranding },
    bank = !payment && snapshot?.bank;
  const student = snapshot?.student || payment?.studentId || challan;
  const rows = Object.entries(
    snapshot?.feeBreakdown || challan.feeBreakdown || {},
  ).filter(
    ([key, value]) =>
      !["discount", "scholarship"].includes(key) && Number(value) > 0,
  );
  return (
    <article
      className={`school-document sd-existing sd-${config.style.family} sd-font-${config.style.font}`}
      data-document-ready={!config.loading}
      data-document-error={config.error || undefined}
      data-page-size={config.style.pageSize}
      data-page-margin={config.style.margin}
      data-page-orientation={config.style.orientation}
      style={documentStyleVariables(config.style) as CSSProperties}
    >
      <DocumentHeader
        school={school}
        title={payment ? "Payment receipt" : "Fee challan"}
        reference={payment?.receiptNumber || challan.challanNumber}
      />
      <div className="document-band">
        {payment ? "RECORDED PAYMENT" : "PAYMENT REQUEST - NOT A RECEIPT"}
        <span>{snapshot?.month || challan.month}</span>
      </div>
      {config.style.showPhoto && (
        <DocumentProfilePhoto
          student={{
            ...student,
            _id:
              typeof payment?.studentId === "object"
                ? payment.studentId._id
                : challan.studentId,
            name: payment?.studentName || challan.studentName,
          }}
        />
      )}
      <dl className="document-details">
        {[
          ["Student", payment?.studentName || challan.studentName],
          [
            "Admission / ID",
            student.admissionNumber ||
              challan.admissionNumber ||
              "Not recorded",
          ],
          [
            "Class / section",
            [payment?.className || challan.className, student.sectionName]
              .filter(Boolean)
              .join(" / "),
          ],
          ["Roll number", payment?.rollNumber || challan.rollNumber],
          ...(!payment && Number(challan.previousBalance) > 0
            ? [
                [
                  "Prior invoices outstanding (PKR)",
                  amount(challan.previousBalance),
                ],
              ]
            : []),
          [
            "Parent / guardian",
            student.parentInfo?.fatherName ||
              student.parentInfo?.motherName ||
              "Not recorded",
          ],
          [
            payment ? "Payment date" : "Issue date",
            date(payment?.paidAt || challan.createdAt),
          ],
          ["Fee period", snapshot?.month || challan.month],
          [
            payment ? "Payment method" : "Due date",
            payment?.paymentMethod || date(challan.dueDate),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <table className="document-table">
        <thead>
          <tr>
            <th>
              {payment
                ? "Challan fee components (not payment allocation)"
                : "Fee particulars"}
            </th>
            <th>PKR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key}>
              <td>
                {key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (c) => c.toUpperCase())}
              </td>
              <td>{amount(value)}</td>
            </tr>
          ))}
          {Number(challan.feeBreakdown?.discount) > 0 && (
            <tr>
              <td>Discount / concession</td>
              <td>-{amount(challan.feeBreakdown.discount)}</td>
            </tr>
          )}
          {Number(challan.feeBreakdown?.scholarship) > 0 && (
            <tr>
              <td>Scholarship</td>
              <td>-{amount(challan.feeBreakdown.scholarship)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="document-total">
        <span>
          {payment ? "Amount paid in this transaction" : "Total payable"}
        </span>
        <b>PKR {amount(payment?.amountPKR ?? challan.totalAmountPKR)}</b>
      </div>
      <div className="document-balance">
        <span>
          {payment ? "Balance after this payment" : "Outstanding balance"}
        </span>
        <b>
          PKR {amount(payment?.balanceAfterPKR ?? challan.remainingAmountPKR)}
        </b>
      </div>
      {payment?.transactionReference && (
        <p className="document-note">
          Transaction reference: {payment.transactionReference}
        </p>
      )}
      {bank?.enabled &&
      bank.bankName &&
      bank.accountTitle &&
      bank.accountNumber ? (
        <section className="document-bank">
          <h4>Bank payment details</h4>
          <p>
            <b>{bank.bankName}</b> &middot; {bank.accountTitle}
          </p>
          <p>
            Account: {bank.accountNumber}
            {bank.iban && <> &middot; IBAN: {bank.iban}</>}
          </p>
          <p>
            Use challan reference <b>{challan.challanNumber}</b>.
          </p>
          {bank.instructions && <p>{bank.instructions}</p>}
        </section>
      ) : (
        !payment && (
          <p className="document-note">
            Bank payment details are not configured. Contact the school accounts
            office for payment instructions.
          </p>
        )
      )}
      {snapshot?.legacy && (
        <p className="document-note">
          Legacy document: historical branding was not captured. Current
          configured details are shown.
          {payment && payment.balanceAfterPKR === undefined
            ? " Remaining balance is the current challan balance, not a historical snapshot."
            : ""}
        </p>
      )}
      {!embedded && <DocumentSignatures school={school} style={config.style} />}
      {!embedded && config.style.footer && (
        <p className="document-note">{config.style.footer}</p>
      )}
    </article>
  );
}
export function AcademicDocument({
  school,
  student,
  exam,
  result,
  attendance,
  documentStyle,
  embedded = false,
}: any) {
  const config = useDocumentStyle("report-card", documentStyle);
  school = { ...school, ...config.branding };
  const incomplete =
    !result ||
    result.needsProcessing ||
    result.status === "PENDING" ||
    result.subjectScores?.some(
      (s: any) =>
        !s.isAbsent && s.grade !== "ABSENT" && s.obtainedMarks == null,
    );
  return (
    <article
      className={`school-document sd-existing sd-${config.style.family} sd-font-${config.style.font}`}
      data-document-ready={!config.loading}
      data-document-error={config.error || undefined}
      data-page-size={config.style.pageSize}
      data-page-margin={config.style.margin}
      data-page-orientation={config.style.orientation}
      style={documentStyleVariables(config.style) as CSSProperties}
    >
      <DocumentHeader
        school={school}
        title="Student progress report"
        reference={result ? String(result._id) : undefined}
      />
      <div className="document-band">
        {exam?.title || "Examination"}
        <span>
          {exam?.academicSessionName ||
            student.academicSessionName ||
            "Session not recorded"}
        </span>
      </div>
      {!embedded && config.style.showPhoto && (
        <DocumentProfilePhoto student={student} />
      )}
      <dl className="document-details">
        {[
          ["Student", student.name],
          ["Admission / ID", student.admissionNumber || student.studentId],
          [
            "Class / section",
            [student.className, student.sectionName]
              .filter(Boolean)
              .join(" / "),
          ],
          ["Roll number", student.rollNumber],
          [
            "Parent / guardian",
            student.parentInfo?.fatherName ||
              student.parentInfo?.motherName ||
              "Not recorded",
          ],
          ["Issued", date(new Date())],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "Not recorded"}</dd>
          </div>
        ))}
      </dl>
      <table className="document-table">
        <thead>
          <tr>
            {["Subject", "Maximum", "Obtained", "Percentage", "Grade"].map(
              (h) => (
                <th key={h}>{h}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {result?.subjectScores?.length ? (
            result.subjectScores.map((s: any) => (
              <tr key={s.subjectId || s.subjectName}>
                <td>{s.subjectName}</td>
                <td>{s.maxMarks}</td>
                <td>
                  {s.isAbsent || s.grade === "ABSENT"
                    ? "Absent"
                    : s.obtainedMarks == null
                      ? "Pending"
                      : s.obtainedMarks}
                </td>
                <td>
                  {s.isAbsent || s.grade === "ABSENT"
                    ? "—"
                    : s.obtainedMarks == null
                      ? "Pending"
                      : s.maxMarks > 0
                        ? ((s.obtainedMarks / s.maxMarks) * 100).toFixed(1) +
                          "%"
                        : "—"}
                </td>
                <td>{s.grade || "Pending"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>
                Marks have not been processed for this student.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="document-total">
        <span>Overall result</span>
        <b>
          {incomplete
            ? "Incomplete / pending"
            : `${result.totalObtainedMarks} / ${result.totalMaxMarks} (${result.percentage}%)`}
        </b>
      </div>
      {!incomplete && Number.isFinite(result?.percentage) && (
        <div
          className="document-performance"
          aria-label={`Overall performance ${result.percentage}%`}
        >
          <span
            style={{
              width: Math.max(0, Math.min(100, result.percentage)) + "%",
            }}
          />
        </div>
      )}
      <p className="document-note">
        Result status: {result?.status || "Pending"}
        {result?.attendancePercentage != null
          ? ` · Recorded attendance: ${result.attendancePercentage}%`
          : ""}
      </p>
      <p className="document-note">
        Grade:{" "}
        {incomplete ? "Pending" : result.overallGrade || "Not configured"}{" "}
        &middot; Remarks:{" "}
        {incomplete
          ? "Awaiting complete marks"
          : result.teacherRemarks || "Not recorded"}
      </p>
      {attendance && (
        <p className="document-note">
          Attendance:{" "}
          {attendance.presentDays ?? attendance.present ?? "Not recorded"}{" "}
          present / {attendance.totalDays ?? attendance.total ?? "Not recorded"}{" "}
          recorded days. This is the available history, not an invented term
          summary.
        </p>
      )}
      <p className="document-note">
        Missing or unprocessed marks are not presented as zero. Grades and
        totals come from the school&apos;s processed results.
      </p>
      {!embedded && <DocumentSignatures school={school} style={config.style} />}
      {!embedded && config.style.footer && (
        <p className="document-note">{config.style.footer}</p>
      )}
    </article>
  );
}
