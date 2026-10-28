"use client";
import { SchoolDocumentTemplate } from "@/components/SchoolDocumentTemplate";
import { printSchoolDocument } from "@/lib/print-school-document";

import { apiFetch } from "@/lib/api";
import { DocumentPreviewOverlay } from "@/components/SchoolDocumentPreview";
import { useEffect, useState, useRef } from "react";
import { Award, Printer, Plus, CheckCircle2 } from "lucide-react";
import { examStaffApi } from "@/lib/examStaffApi";
import { useAuth } from "@/lib/auth-context";

export default function IssueCertificatesPage() {
  const { user } = useAuth();
  const canIssue =
    user?.userType === "SUPER_ADMIN" ||
    !!user?.permissions?.includes("results.publish");
  const [mode, setMode] = useState("INDIVIDUAL"),
    [picked, setPicked] = useState<string[]>([]),
    [checkedCerts, setCheckedCerts] = useState<string[]>([]),
    [printDocuments, setPrintDocuments] = useState<any[]>([]),
    [printing, setPrinting] = useState(false),
    [studentSearch, setStudentSearch] = useState("");
  const batch = useRef<{ signature: string; id: string } | null>(null);
  const issueLock = useRef(false),
    printRoot = useRef<HTMLDivElement>(null);
  const category = (value: string) =>
    (
      ({
        BONAFIDE: "bonafide",
        CHARACTER: "character",
        LEAVING: "leaving",
        TRANSFER: "transfer",
        RESULT: "report-card",
      }) as Record<string, string>
    )[value];
  const previewCertificate = async (cert: any) =>
    (
      await apiFetch("/school-documents/preview", {
        method: "POST",
        body: JSON.stringify({
          type: category(cert.type),
          studentId: String(cert.studentId?._id || cert.studentId),
          certificateId: cert._id,
        }),
      })
    ).data;
  async function preparePrint(records: any[]) {
    if (!records.length) {
      setError(
        "No issued certificates for this selection. Issue certificates first.",
      );
      return;
    }
    setPrinting(true);
    setError("");
    setPrintDocuments([]);
    try {
      const documents = [];
      for (let start = 0; start < records.length; start += 20) {
        const response = await apiFetch(
          "/school-documents/certificates/bulk-preview",
          {
            method: "POST",
            body: JSON.stringify({
              certificateIds: records
                .slice(start, start + 20)
                .map((c) => c._id),
            }),
          },
        );
        documents.push(...response.data.documents);
      }
      setPrintDocuments(documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPrinting(false);
    }
  }
  function prepareClassPrint() {
    const classStudents = new Set(students.map((s) => String(s._id)));
    const latest = new Map<string, any>();
    [...certificates]
      .sort(
        (a, b) =>
          new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
      )
      .forEach((cert) => {
        const id = String(cert.studentId?._id || cert.studentId);
        if (cert.type === type && classStudents.has(id) && !latest.has(id))
          latest.set(id, cert);
      });
    setNotice(
      `${latest.size} issued certificates available for ${students.length} students in this class. ${students.length - latest.size} students have no issued ${type.toLowerCase()} certificate.`,
    );
    void preparePrint([...latest.values()]);
  }

  const [certificates, setCertificates] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [type, setType] = useState<
    "BONAFIDE" | "CHARACTER" | "LEAVING" | "TRANSFER" | "RESULT"
  >("BONAFIDE");
  const [reason, setReason] = useState("On student/parent request");
  const [conductRemarks, setConductRemarks] = useState(
    "Satisfactory conduct and moral character",
  );

  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedCertForPrint, setSelectedCertForPrint] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [certsRes, classesRes] = await Promise.all([
        examStaffApi.getCertificates(),
        examStaffApi.getClasses(),
      ]);
      setCertificates(certsRes?.data || []);
      const clsList = classesRes?.data || [];
      setClasses(clsList);
      if (clsList.length > 0)
        setSelectedClassId((previous) =>
          clsList.some((c: any) => c._id === previous)
            ? previous
            : clsList[0]._id,
        );
    } catch (err: any) {
      setError(err?.message || "Unable to load certificate records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    let active = true;
    setStudents([]);
    setSelectedStudentId("");
    setPicked([]);
    setStudentSearch("");
    setPrintDocuments([]);
    batch.current = null;
    if (selectedClassId)
      examStaffApi
        .getStudents(selectedClassId)
        .then((res) => {
          if (!active) return;
          const list = res?.data || [];
          setStudents(list);
          setSelectedStudentId(list[0]?._id || "");
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [selectedClassId]);

  useEffect(() => {
    setPrintDocuments([]);
  }, [type]);

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (issueLock.current || !canIssue) return;
    const ids =
      mode === "INDIVIDUAL"
        ? [selectedStudentId]
        : mode === "CLASS"
          ? students.map((s) => s._id)
          : picked;
    if (!ids.length || !ids[0]) {
      setError("Select at least one student.");
      return;
    }
    issueLock.current = true;
    setIssuing(true);
    setError("");
    setNotice(null);
    setPrintDocuments([]);
    try {
      if (mode === "INDIVIDUAL") {
        const r = await examStaffApi.issueCertificate({
          type,
          studentId: selectedStudentId,
          classId: selectedClassId,
          reason,
          conductRemarks,
        });
        setNotice(
          `Certificate ${r.data.certificateNumber} issued successfully.`,
        );
        setCheckedCerts([r.data._id]);
        await loadData();
        setSelectedCertForPrint(await previewCertificate(r.data));
      } else {
        const payload = {
          type,
          classId: selectedClassId,
          studentIds: ids,
          reason,
          conductRemarks,
        };
        const signature = JSON.stringify(payload);
        if (!batch.current || batch.current.signature !== signature)
          batch.current = { signature, id: crypto.randomUUID() };
        const r = await apiFetch("/exams/certificates/bulk-issue", {
          method: "POST",
          body: JSON.stringify({ ...payload, requestId: batch.current.id }),
        });
        const issued = r.data.certificates;
        setCheckedCerts(issued.map((c: any) => c._id));
        setNotice(
          `${issued.length} certificates issued. Use Prepare selected for print to print this batch together.`,
        );
        batch.current = null;
        await loadData();
      }
    } catch (err: any) {
      setError(
        err.message ||
          "Unable to issue certificates. Retry to check this batch safely.",
      );
    } finally {
      issueLock.current = false;
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <Award className="h-6 w-6 text-school-primary" />
            Certificate Issuance & Printing Desk
          </h1>
          <p className="text-xs text-zinc-500">
            Issue Bonafide, Character, Leaving, Transfer, and Result
            certificates with unique certificate IDs.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="print:hidden rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800"
        >
          {error}
        </p>
      )}

      {notice && (
        <div className="print:hidden bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Certificate Generator Card */}
      <div className="print:hidden bg-white border border-zinc-200 p-5 rounded-2xl shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-zinc-950 border-b border-zinc-100 pb-2">
          Issue New Official Certificate
        </h2>

        <fieldset
          disabled={issuing || printing}
          className="min-w-0 space-y-4 disabled:opacity-60"
        >
          {!canIssue && (
            <p className="text-sm text-zinc-500">
              Certificate issuance requires publishing permission.
            </p>
          )}
          <label className="block text-xs font-semibold">
            Issue for
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="ml-3 min-h-11 rounded border bg-white px-3"
            >
              <option value="INDIVIDUAL">Individual student</option>
              <option value="SELECTED">Selected students</option>
              <option value="CLASS">Whole class</option>
            </select>
          </label>
          <form
            onSubmit={handleIssueCertificate}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs"
          >
            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">
                Certificate Type *
              </label>
              <select
                value={type}
                onChange={(e: any) => setType(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-bold focus:outline-none"
              >
                <option value="BONAFIDE">Bonafide Student Certificate</option>
                <option value="CHARACTER">Character Certificate</option>
                <option value="LEAVING">School Leaving Certificate</option>
                <option value="TRANSFER">Transfer Certificate</option>
                <option value="RESULT">Exam Result Certificate</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 uppercase mb-1">
                Select Class *
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {mode === "INDIVIDUAL" ? (
              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">
                  Select Student *
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  disabled={students.length === 0 || mode !== "INDIVIDUAL"}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none disabled:opacity-50"
                >
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.rollNumber})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <span className="font-semibold text-zinc-500">Recipients</span>
                <strong className="mt-1 text-lg">
                  {mode === "CLASS" ? students.length : picked.length} students
                </strong>
              </div>
            )}

            <div className="flex items-end">
              <button
                type="submit"
                disabled={
                  issuing ||
                  !canIssue ||
                  !selectedClassId ||
                  (mode === "INDIVIDUAL"
                    ? !selectedStudentId
                    : mode === "CLASS"
                      ? !students.length
                      : !picked.length)
                }
                className="w-full py-2.5 bg-school-primary text-white font-bold rounded-lg shadow-xs hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {issuing
                  ? "Issuing..."
                  : mode === "INDIVIDUAL"
                    ? "Issue Certificate"
                    : `Issue ${mode === "CLASS" ? students.length : picked.length} Certificates`}
              </button>
            </div>
            <label className="sm:col-span-2 grid gap-1 font-semibold">
              Reason
              <input
                value={reason}
                maxLength={1000}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-11 rounded border px-3 font-normal"
                placeholder="Reason for issuing"
              />
            </label>
            <label className="sm:col-span-2 grid gap-1 font-semibold">
              Conduct / remarks
              <input
                value={conductRemarks}
                maxLength={1000}
                onChange={(e) => setConductRemarks(e.target.value)}
                className="min-h-11 rounded border px-3 font-normal"
                placeholder="Remarks for the selected certificates"
              />
            </label>
            {mode === "CLASS" && (
              <p className="sm:col-span-4 text-sm text-zinc-600">
                All {students.length} current students in the selected class
                will receive a {type.toLowerCase()} certificate.
              </p>
            )}
            {mode === "SELECTED" && (
              <div className="sm:col-span-4 space-y-3 rounded border bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    aria-label="Search students"
                    placeholder="Find by name or roll number"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="min-h-11 rounded border bg-white px-3"
                  />
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => setPicked(students.map((s) => s._id))}
                  >
                    Select class
                  </button>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => setPicked([])}
                  >
                    Clear
                  </button>
                  <span>{picked.length} selected</span>
                </div>
                <div className="grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">
                  {students
                    .filter((s) =>
                      (s.name + " " + s.rollNumber)
                        .toLowerCase()
                        .includes(studentSearch.toLowerCase()),
                    )
                    .map((s) => (
                      <label
                        key={s._id}
                        className="flex items-center gap-3 rounded border bg-white p-3"
                      >
                        <input
                          type="checkbox"
                          checked={picked.includes(s._id)}
                          onChange={(e) =>
                            setPicked((previous) =>
                              e.target.checked
                                ? [...previous, s._id]
                                : previous.filter((id) => id !== s._id),
                            )
                          }
                        />
                        <span>
                          {s.name}
                          <small className="ml-2 text-zinc-500">
                            {s.rollNumber}
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </form>
        </fieldset>
      </div>

      <div className="print:hidden flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4">
        <button
          disabled={printing || issuing || !checkedCerts.length}
          onClick={() =>
            void preparePrint(
              certificates.filter((c) => checkedCerts.includes(c._id)),
            )
          }
          className="min-h-11 rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50"
        >
          Prepare selected for print ({checkedCerts.length})
        </button>
        <button
          disabled={printing || issuing || !students.length}
          onClick={prepareClassPrint}
          className="min-h-11 rounded border px-4 text-sm disabled:opacity-50"
        >
          Prepare whole class for print
        </button>
        <span className="text-xs text-zinc-500">
          Class print uses the latest issued {type.toLowerCase()} certificate
          for each student.
        </span>
        {printing && (
          <p role="status" className="text-sm">
            Preparing certificates...
          </p>
        )}
      </div>
      {/* Issued Certificates Directory */}
      <div className="print:hidden space-y-4">
        <h2 className="text-sm font-bold text-zinc-950">
          Issued Certificates Directory ({certificates.length})
        </h2>

        {loading ? (
          <p
            role="status"
            className="rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200"
          >
            Loading certificates log…
          </p>
        ) : certificates.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3.5">
                    <input
                      aria-label="Select all issued certificates"
                      type="checkbox"
                      checked={
                        certificates.length > 0 &&
                        certificates.every((c) => checkedCerts.includes(c._id))
                      }
                      onChange={(e) =>
                        setCheckedCerts(
                          e.target.checked
                            ? certificates.map((c) => c._id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th className="p-3.5">Cert Number</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Student Name</th>
                  <th className="p-3.5">Class / Roll</th>
                  <th className="p-3.5">Issue Date</th>
                  <th className="p-3.5 text-right">Print Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {certificates.map((cert) => (
                  <tr key={cert._id} className="hover:bg-zinc-50">
                    <td className="p-3.5">
                      <input
                        type="checkbox"
                        aria-label={`Select certificate ${cert.certificateNumber}`}
                        checked={checkedCerts.includes(cert._id)}
                        onChange={(e) =>
                          setCheckedCerts((previous) =>
                            e.target.checked
                              ? [...previous, cert._id]
                              : previous.filter((id) => id !== cert._id),
                          )
                        }
                      />
                    </td>
                    <td className="p-3.5 font-mono font-bold text-zinc-900">
                      {cert.certificateNumber}
                    </td>
                    <td className="p-3.5 font-bold text-school-primary">
                      {cert.type}
                    </td>
                    <td className="p-3.5 font-bold text-zinc-950">
                      {cert.studentName}
                    </td>
                    <td className="p-3.5 text-zinc-600">
                      {cert.className} / Roll {cert.rollNumber}
                    </td>
                    <td className="p-3.5 text-zinc-800 font-mono">
                      {new Date(cert.issueDate).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() =>
                          void previewCertificate(cert)
                            .then((data) => setSelectedCertForPrint(data))
                            .catch((e) => setError(e.message))
                        }
                        className="rounded-lg border border-zinc-300 p-1.5 text-zinc-700 hover:bg-zinc-100"
                        title="Print Certificate"
                      >
                        <Printer size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-xs text-zinc-500">
            No certificates issued yet.
          </div>
        )}
      </div>

      {!!printDocuments.length && (
        <section className="space-y-4 rounded border bg-zinc-100 p-4">
          <button
            disabled={printing || issuing}
            className="min-h-11 rounded bg-school-primary px-4 text-sm text-white"
            onClick={() => {
              setPrinting(true);
              void printSchoolDocument(printRoot.current)
                .catch((e) => setError(e.message))
                .finally(() => setPrinting(false));
            }}
          >
            Print {printDocuments.length} certificates / Save PDF
          </button>
          <div className="max-h-[65vh] overflow-auto">
            <div ref={printRoot} className="school-document-bulk">
              {printDocuments.map((data, i) => (
                <div
                  className="ledger-student-page"
                  key={data.certificate?._id || i}
                >
                  <SchoolDocumentTemplate data={data} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {selectedCertForPrint && (
        <DocumentPreviewOverlay
          data={selectedCertForPrint}
          onClose={() => setSelectedCertForPrint(null)}
        />
      )}
    </div>
  );
}
