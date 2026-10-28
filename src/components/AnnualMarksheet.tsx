"use client";
import {
  documentStyleVariables,
  defaultDocumentStyle,
} from "@/lib/document-templates";
import { DocumentSignatures } from "./DocumentSignatures";
import { printSchoolDocument } from "@/lib/print-school-document";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { downloadPrivate } from "@/lib/api";
import { DocumentHeader } from "./SchoolDocuments";
const percent = (n: any) =>
  n == null ? "Incomplete" : Number(n).toFixed(2) + "%";
const score = (s: any) =>
  !s || s.obtained == null
    ? s?.status || "Incomplete"
    : s.isAbsent
      ? `Absent (0 / ${s.max})`
      : `${s.obtained} / ${s.max}`;
export default function AnnualMarksheet({
  data,
  schoolName = "School",
  onClose,
  inline = false,
  documentId = "annual-marksheet",
}: any) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!data) return null;
  const style = {
    ...defaultDocumentStyle("report-card"),
    ...data.documentStyle,
  };
  const components = data.components || [],
    { student, rows, overall } = data;
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({
        academicSessionId: String(student.academicSessionId),
        classId: String(student.classId),
        view: data.view || "ANNUAL",
        ...(data.sourceHash ? { expectedHash: data.sourceHash } : {}),
        ...(data.anchorExamId || (data.view === "EXAM" && components[0])
          ? { examId: data.anchorExamId || components[0].examId }
          : {}),
      });
      const endpoint =
        user?.userType === "PARENT"
          ? `/parent/children/${student._id}/marksheet/pdf${data.sourceHash ? "?expectedHash=" + data.sourceHash : ""}`
          : `/exams/marksheet/${student._id}/pdf?${q}`;
      await downloadPrivate(
        endpoint,
        `marksheet_${student.studentId || student._id}_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={
        inline
          ? "marksheet-preview min-w-0"
          : "marksheet-overlay fixed inset-0 z-[80] overflow-y-auto bg-black/40 p-2 sm:p-6"
      }
      role={inline ? undefined : "dialog"}
      aria-modal={inline ? undefined : true}
      aria-label="Student marksheet"
    >
      <article
        id={documentId}
        className={`school-document marksheet-document min-w-0 sd-existing sd-${style.family} sd-font-${style.font}`}
        style={documentStyleVariables(style)}
        data-page-size={style.pageSize}
        data-page-margin={style.margin}
        data-page-orientation={style.orientation}
        data-photo-align={style.photoAlign}
      >
        <div className="no-print mb-5 flex flex-wrap gap-3">
          <button
            disabled={busy}
            className="min-h-11 rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={download}
          >
            {busy ? "Generating PDF…" : "Download print-ready PDF"}
          </button>
          <button
            className="min-h-11 rounded border px-4 py-2 text-sm"
            onClick={() =>
              void printSchoolDocument(
                document.getElementById(documentId),
              ).catch((e) => setError(e.message))
            }
          >
            Print
          </button>
          {onClose && (
            <button
              className="min-h-11 rounded border px-4 py-2 text-sm"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="no-print mb-4 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        <DocumentHeader
          school={data.school || { name: schoolName }}
          title={
            data.view === "EXAM" ? "Examination marksheet" : "Annual marksheet"
          }
        />
        <div className="document-band flex-wrap">
          <span>{student.academicSessionName || "Session not recorded"}</span>
          <span>{overall.status || "INCOMPLETE"}</span>
        </div>
        {data.configurationRequired && (
          <p className="no-print mb-4 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            Legacy cumulative summary. The school has not saved an annual
            assessment policy for this class/session. Historical marks are
            preserved; review the policy before official annual use.
          </p>
        )}
        {style.showPhoto && data.photo && (
          <div className="sd-portrait-row">
            <strong>{student.name}</strong>
            <img src={data.photo} alt={student.name + " photograph"} />
          </div>
        )}
        <dl className="document-details break-words">
          {[
            ["Student", student.name],
            ["Student ID", student.studentId || student.admissionNumber],
            [
              "Class / section",
              [student.className, student.sectionName || "Not recorded"].join(
                " / ",
              ),
            ],
            ["Roll number", student.rollNumber],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div
          className="max-w-full overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Subject-wise marks"
        >
          <table
            className="document-table"
            style={{ minWidth: Math.max(540, components.length * 135 + 300) }}
          >
            <thead>
              <tr>
                <th>Subject</th>
                {components.map((c: any) => (
                  <th key={c.examId}>
                    {c.title}
                    <br />
                    {c.weight != null
                      ? c.weight + "% weight"
                      : "Obtained / maximum"}
                  </th>
                ))}
                <th>{data.view === "EXAM" ? "Result" : "Annual result"}</th>
                <th>Grade / status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.subjectId}>
                  <td className="min-w-32 break-words font-medium">{r.name}</td>
                  {components.map((c: any, i: number) => (
                    <td key={c.examId}>{score(r.scores?.[i])}</td>
                  ))}
                  <td>
                    {data.policy?.method !== "WEIGHTED" && (
                      <span className="block">
                        {r.total == null
                          ? "Incomplete"
                          : `${r.total} / ${r.max}`}
                      </span>
                    )}
                    {percent(r.percentage)}
                  </td>
                  <td>
                    {r.grade}
                    <br />
                    {r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="p-4 text-sm text-zinc-500">
            Required subject records are not available. Result is incomplete.
          </p>
        )}
        <div className="document-total">
          <span>
            {overall.complete
              ? "Result summary"
              : "Incomplete — not a completed result"}
          </span>
          <div>
            <b>{percent(overall.percentage)}</b>
            {data.policy?.method !== "WEIGHTED" && (
              <p className="mt-1 text-sm">
                {overall.obtained == null
                  ? "Marks incomplete"
                  : `${overall.obtained} / ${overall.max}`}
              </p>
            )}
            <p className="mt-1 text-sm">
              Grade: {overall.grade} · {overall.status}
            </p>
          </div>
        </div>
        <DocumentSignatures school={data.school} style={style} />
        {style.footer && <p className="sd-footer">{style.footer}</p>}
      </article>
    </div>
  );
}
