"use client";
import {WorkspaceDialog,workspacePrimary,workspaceSecondary} from "@/components/WorkspaceDialog";
import {TableScroll} from "@/components/TableScroll";

import { SchoolDocumentTemplate } from "@/components/SchoolDocumentTemplate";
import { printSchoolDocument } from "@/lib/print-school-document";

import { apiFetch } from "@/lib/api";
import { DocumentPreviewOverlay } from "@/components/SchoolDocumentPreview";
import { useEffect, useState, useRef, useCallback } from "react";
import { Award, Printer, Plus, CheckCircle2 } from "lucide-react";
import { examStaffApi } from "@/lib/examStaffApi";
import {confirmAction} from "@/components/ConfirmationHost";
import { useAuth } from "@/lib/auth-context";

export default function IssueCertificatesPage() {
 const [page,setPage]=useState(1),[total,setTotal]=useState(0),[summary,setSummary]=useState<any[]>([]),[filterType,setFilterType]=useState(""),[filterStatus,setFilterStatus]=useState(""),[filterClass,setFilterClass]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[details,setDetails]=useState<any>(null),[action,setAction]=useState<any>(null),[actionBusy,setActionBusy]=useState(false),[issueDate,setIssueDate]=useState(new Date().toISOString().slice(0,10)),[examId,setExamId]=useState(""),[exams,setExams]=useState<any[]>([]);
 const [issueOpen,setIssueOpen]=useState(false),[directorySearch,setDirectorySearch]=useState("");
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
  const [classPrint,setClassPrint]=useState(false),[classPrintId,setClassPrintId]=useState(""),[classPrintType,setClassPrintType]=useState("BONAFIDE");
  async function prepareClassPrint(){try{const r=await apiFetch("/exams/certificates/print-class?"+new URLSearchParams({classId:classPrintId,type:classPrintType,...(printSection?{sectionId:printSection}:{})}));setNotice(r.data.records.length+" eligible certificates; "+r.data.missing+" students have no valid certificate. No new certificates were issued.");await preparePrint(r.data.records);setClassPrint(false)}catch(e:any){setError(e.message)}}
  const [certificates, setCertificates] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [selectedSectionId,setSelectedSectionId]=useState(""),[sections,setSections]=useState<any[]>([]),[printSections,setPrintSections]=useState<any[]>([]),[printSection,setPrintSection]=useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [type, setType] = useState<
    "BONAFIDE" | "CHARACTER" | "LEAVING" | "TRANSFER" | "RESULT"
  >("BONAFIDE");
  const [reason, setReason] = useState("On student/parent request");
  const [conductRemarks, setConductRemarks] = useState(
    "",
  );

  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedCertForPrint, setSelectedCertForPrint] = useState<any>(null);

  const directoryRequest=useRef(0);
  const loadData = useCallback(async () => {
    const request=++directoryRequest.current;
    setLoading(true);
    setError("");
    try {
      const [certsRes, classesRes] = await Promise.all([
        apiFetch("/exams/certificates?"+new URLSearchParams({paged:"1",page:String(page),search:directorySearch,...(filterType?{type:filterType}:{}),...(filterStatus?{status:filterStatus}:{}),...(filterClass?{className:filterClass}:{}),...(from?{from}:{}),...(to?{to}:{})})),
        examStaffApi.getClasses(),
      ]);
      if(request!==directoryRequest.current)return;
      if(!Array.isArray(certsRes.data?.records))throw new Error("The certificate API is out of date. Restart the backend with the updated application code.");
      setCertificates(certsRes.data.records);setTotal(certsRes.data.total);setSummary(certsRes.data.summary||[]);
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
      if(request===directoryRequest.current)setLoading(false);
    }
  }, [page,directorySearch,filterType,filterStatus,filterClass,from,to]);

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
        .getStudents(selectedClassId,selectedSectionId)
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
  }, [selectedClassId,selectedSectionId]);
  useEffect(()=>{let live=true;setSelectedSectionId("");examStaffApi.getSections(selectedClassId).then(r=>{if(live)setSections(r.data)}).catch(e=>setError(e.message));return()=>{live=false}},[selectedClassId]);
  useEffect(()=>{let live=true;setPrintSection("");if(classPrintId)examStaffApi.getSections(classPrintId).then(r=>{if(live)setPrintSections(r.data)}).catch(e=>setError(e.message));return()=>{live=false}},[classPrintId]);

  useEffect(() => {
    setPrintDocuments([]);
  }, [type]);

  useEffect(()=>{const timer=setTimeout(()=>void loadData(),250);return()=>clearTimeout(timer)},[loadData]);
  useEffect(()=>{examStaffApi.getSchedules().then(r=>setExams(r.data)).catch(e=>setError(e.message))},[]);
  async function downloadPdf(cert:any){try{const r=await apiFetch("/exams/certificates/"+cert._id+"/pdf");const bytes=Uint8Array.from(atob(r.data.file),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));const a=document.createElement("a");a.href=url;a.download=r.data.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e:any){setError(e.message)}}
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
    if(!(await confirmAction("Issue "+ids.length+" "+type.toLowerCase()+" certificate(s)? This creates permanent official records.")))return;
    if(issueLock.current)return;
    issueLock.current = true;
    setIssuing(true);
    setError("");
    setNotice(null);
    setPrintDocuments([]);
    try {
      if (mode === "INDIVIDUAL") {
        const signature=JSON.stringify({type,studentId:selectedStudentId,reason,conductRemarks,issueDate,examId});if(!batch.current||batch.current.signature!==signature)batch.current={signature,id:crypto.randomUUID()};
        const r = await examStaffApi.issueCertificate({
          type,issueDate,examId: type==="RESULT"?examId:undefined,issuanceKey:batch.current.id,
          studentId: selectedStudentId,
          classId: selectedClassId,
          reason,
          conductRemarks,
        });
        setNotice(
          `Certificate ${r.data.certificateNumber} issued successfully.`,
        );
        setCheckedCerts([r.data._id]);
        setIssueOpen(false);await loadData();
        setSelectedCertForPrint(await previewCertificate(r.data));
      } else {
        const payload = {
          type,issueDate,...(type==="RESULT"?{examId}:{}),
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
            Certificates
          </h1>
          <p className="text-xs text-zinc-500">
            Issue, manage, track, and print official student certificates.
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

      <div className="flex flex-wrap items-end justify-between gap-3"><label className="grid min-w-0 flex-1 gap-2 text-xs font-semibold">Search issued certificates<input type="search" value={directorySearch} onChange={e=>{setPage(1);setDirectorySearch(e.target.value)}} placeholder="Certificate number, student, class or type" className="min-h-11 rounded-md border px-3"/></label><button type="button" disabled={!canIssue||issuing||printing} className={workspacePrimary} onClick={()=>{setError("");setIssueOpen(true)}}>Issue New Certificate</button></div>
      {issueOpen&&<WorkspaceDialog title="Issue New Certificate" description="Issue to one student, selected students or the complete class using the existing certificate templates." onClose={()=>setIssueOpen(false)} busy={issuing||printing} wide>{error&&<p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}
      {/* Certificate Generator Card */}
      <div className="print:hidden bg-white border border-zinc-200 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-xs font-semibold">Issue date<input type="date" required disabled={issuing||printing} value={issueDate} onChange={e=>setIssueDate(e.target.value)} className="min-h-11 rounded-md border px-3"/></label>{type==="RESULT"&&<label className="grid gap-2 text-xs font-semibold">Published examination<select required value={examId} onChange={e=>setExamId(e.target.value)} className="min-h-11 rounded-md border px-3"><option value="">Select examination</option>{exams.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}</select></label>}</div>
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

            <label className="grid gap-2 text-xs font-semibold">Section<select value={selectedSectionId} onChange={e=>setSelectedSectionId(e.target.value)} className="min-h-11 rounded border px-3"><option value="">All sections</option>{sections.map(sec=><option key={sec._id} value={sec._id}>{sec.name}</option>)}</select></label>
            <label className="grid gap-2 text-xs font-semibold">Find student<input value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Name, admission or roll number" className="min-h-11 rounded border px-3"/></label>
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
                  {students.filter(s=>[s.name,s.rollNumber,s.admissionNumber].join(" ").toLowerCase().includes(studentSearch.toLowerCase())).map((s) => (
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

      </WorkspaceDialog>}
      <div className="print:hidden flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4">
        <button
          disabled={printing || issuing || !checkedCerts.length}
          onClick={() =>
            void preparePrint(
              checkedCerts.map(_id=>({_id})),
            )
          }
          className="min-h-11 rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50"
        >
          Preview / Print Selected ({checkedCerts.length})
        </button>
        <button
          disabled={printing || issuing || !students.length}
          onClick={()=>{setClassPrintId(selectedClassId);setClassPrint(true)}}
          className="min-h-11 rounded border px-4 text-sm disabled:opacity-50"
        >
          Print Class Certificates
        </button>
        <span className="text-xs text-zinc-500">
          Class printing opens a separate class/type selection and prepares only valid existing certificates.
        </span>
        {printing && (
          <p role="status" className="text-sm">
            Preparing certificates...
          </p>
        )}
      </div>
      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{["TOTAL","BONAFIDE","CHARACTER","LEAVING","TRANSFER","REVOKED"].map(t=><div key={t} className="rounded-md border bg-white p-4"><p className="text-xs text-zinc-500">{t}</p><b className="mt-2 block text-xl">{t==="TOTAL"?total:summary.filter(x=>t==="REVOKED"?x._id.status==="REVOKED":x._id.type===t).reduce((n,x)=>n+x.count,0)}</b></div>)}</section>
      <section className="grid items-end gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"><label className="grid gap-2 text-xs">Type<select className="min-h-11 rounded border px-3" value={filterType} onChange={e=>{setPage(1);setFilterType(e.target.value)}}><option value="">All types</option>{["BONAFIDE","CHARACTER","LEAVING","TRANSFER","RESULT"].map(t=><option key={t}>{t}</option>)}</select></label><label className="grid gap-2 text-xs">Status<select className="min-h-11 rounded border px-3" value={filterStatus} onChange={e=>{setPage(1);setFilterStatus(e.target.value)}}><option value="">All statuses</option><option>ISSUED</option><option>REVOKED</option></select></label><label className="grid gap-2 text-xs">Class<select className="min-h-11 rounded border px-3" value={filterClass} onChange={e=>{setPage(1);setFilterClass(e.target.value)}}><option value="">All classes</option>{classes.map(c=><option key={c._id}>{c.name}</option>)}</select></label><label className="grid gap-2 text-xs">From date<input type="date" className="min-h-11 rounded border px-3" value={from} onChange={e=>{setPage(1);setFrom(e.target.value)}}/></label><label className="grid gap-2 text-xs">Through date<input type="date" className="min-h-11 rounded border px-3" value={to} onChange={e=>{setPage(1);setTo(e.target.value)}}/></label><button className={workspaceSecondary} onClick={()=>{setDirectorySearch("");setFilterType("");setFilterStatus("");setFilterClass("");setFrom("");setTo("");setPage(1)}}>Clear filters</button></section>
      {/* Issued Certificates Directory */}
      <div className="print:hidden space-y-4">
        <h2 className="text-sm font-bold text-zinc-950">
          Issued Certificates Directory ({total})
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
            <TableScroll><table className="w-full min-w-[700px] text-left text-xs">
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
                  <th className="p-3.5">Status</th><th className="p-3.5">Issued by / Student ID</th><th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {certificates.filter(cert=>[cert.certificateNumber,cert.studentName,cert.className,cert.type,cert.rollNumber].join(" ").toLowerCase().includes(directorySearch.toLowerCase())).map((cert) => (
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
                      {cert.className} / {cert.documentSnapshot?.student?.sectionName||"—"} · Roll {cert.rollNumber}
                    </td>
                    <td className="p-3.5 text-zinc-800 font-mono">
                      {new Date(cert.issueDate).toLocaleDateString()}
                    </td>
                    <td className="p-3.5">{cert.status||"ISSUED"}</td><td className="p-3.5">{cert.issuedByUserName}<small className="block">{cert.documentSnapshot?.student?.studentId||cert.admissionNumber}</small></td>
                    <td className="p-3.5 text-right"><div className="flex flex-nowrap gap-3"><button onClick={()=>void apiFetch("/exams/certificates/"+cert._id+"/details").then(r=>setDetails(r.data)).catch(e=>setError(e.message))}>Details</button><button onClick={()=>void downloadPdf(cert)}>Download PDF</button>{canIssue&&<><button onClick={()=>setAction({kind:"reissue",cert,reason:"",issueDate:new Date().toISOString().slice(0,10),conductRemarks:"",examId:"",requestId:crypto.randomUUID()})}>Reissue / correct</button><button disabled={cert.status==="REVOKED"} onClick={()=>setAction({kind:"revoke",cert,reason:""})}>Revoke</button></>}
                      <button
                        onClick={() =>
                          void previewCertificate(cert)
                            .then((data) => setSelectedCertForPrint(data))
                            .catch((e) => setError(e.message))
                        }
                        className="rounded-lg border border-zinc-300 p-1.5 text-zinc-700 hover:bg-zinc-100"
                        title="Preview, print or save certificate PDF"
                        aria-label={`Preview certificate ${cert.certificateNumber}`}
                      >
                        <Printer size={15} />
                      </button></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></TableScroll>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-xs text-zinc-500">
            No certificates issued yet.
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm">Page {page} · {total} matching records</span><div className="flex gap-2"><button className={workspaceSecondary} disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><button className={workspaceSecondary} disabled={loading||page*25>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></footer>
      {classPrint&&<WorkspaceDialog title="Print Class Certificates" description="Only valid existing certificates of the selected type are prepared." onClose={()=>setClassPrint(false)} busy={printing}><div className="space-y-4"><label className="grid gap-2 text-sm">Class<select value={classPrintId} onChange={e=>setClassPrintId(e.target.value)} className="min-h-11 rounded border px-3"><option value="">Select class</option>{classes.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}</select></label><label className="grid gap-2 text-sm">Section<select value={printSection} onChange={e=>setPrintSection(e.target.value)} className="min-h-11 rounded border px-3"><option value="">All sections</option>{printSections.map(sec=><option key={sec._id} value={sec._id}>{sec.name}</option>)}</select></label><label className="grid gap-2 text-sm">Certificate type<select value={classPrintType} onChange={e=>setClassPrintType(e.target.value)} className="min-h-11 rounded border px-3">{["BONAFIDE","CHARACTER","LEAVING","TRANSFER","RESULT"].map(t=><option key={t}>{t}</option>)}</select></label>{error&&<p role="alert">{error}</p>}<button disabled={printing||!classPrintId} className={workspacePrimary} onClick={()=>void prepareClassPrint()}>Prepare existing certificates</button></div></WorkspaceDialog>}
      {details&&<WorkspaceDialog title={details.certificateNumber} description="Saved issuance record and lifecycle history" onClose={()=>setDetails(null)} wide><div className="space-y-4"><p>{details.studentName} · {details.className} · {details.status||"ISSUED"}</p><p>Issued by {details.issuedByUserName} · {String(details.issueDate).slice(0,10)}</p>{details.previousCertificateId&&<p>Previous certificate record: {String(details.previousCertificateId)}</p>}<ol className="space-y-3">{(details.history?.length?details.history:[{action:"ISSUED (historical)",at:details.createdAt,by:details.issuedByUserName}]).map((h:any,i:number)=><li key={i} className="rounded border p-3 text-sm"><b>{h.action}</b> · {String(h.at)} · {h.by}<p>{h.reason}</p></li>)}</ol><button className={workspaceSecondary} onClick={()=>void previewCertificate(details).then(d=>{setDetails(null);setSelectedCertForPrint(d)}).catch(e=>setError(e.message))}>View original document snapshot</button></div></WorkspaceDialog>}
      {action&&<WorkspaceDialog title={(action.kind==="revoke"?"Revoke":"Reissue / correct")+" certificate"} description={action.cert.certificateNumber+" · Original records are preserved."} busy={actionBusy} onClose={()=>setAction(null)}><form className="space-y-4" onSubmit={async e=>{e.preventDefault();if(actionBusy)return;setActionBusy(true);try{await apiFetch("/exams/certificates/"+action.cert._id+"/"+action.kind,{method:"POST",body:JSON.stringify({reason:action.reason,...(action.kind==="reissue"?{requestId:action.requestId,issueDate:action.issueDate,...(action.conductRemarks?{conductRemarks:action.conductRemarks}:{}),...(action.examId?{examId:action.examId}:{})}: {})})});setAction(null);setNotice("Certificate lifecycle action saved.");await loadData()}catch(e:any){setError(e.message)}finally{setActionBusy(false)}}}>{action.kind==="reissue"&&<div className="grid gap-4"><p className="text-sm text-zinc-600">A new certificate uses the current student record. The original remains available in history. Revoke the original separately if it must no longer be valid.</p><label className="grid gap-2 text-sm">Replacement issue date<input required type="date" value={action.issueDate} onChange={e=>setAction({...action,issueDate:e.target.value})} className="rounded border p-3"/></label>{action.cert.type==="CHARACTER"&&<label className="grid gap-2 text-sm">Updated conduct remarks (optional)<textarea maxLength={1000} value={action.conductRemarks} onChange={e=>setAction({...action,conductRemarks:e.target.value})} placeholder="Leave blank to preserve the original remarks" className="rounded border p-3"/></label>}{action.cert.type==="RESULT"&&<label className="grid gap-2 text-sm">Replacement examination<select value={action.examId} onChange={e=>setAction({...action,examId:e.target.value})} className="rounded border p-3"><option value="">Use original examination</option>{exams.map((exam:any)=><option key={exam._id} value={exam._id}>{exam.title}</option>)}</select><span className="text-xs text-zinc-500">A complete published result is required.</span></label>}</div>}<label className="grid gap-2 text-sm">Mandatory reason<textarea required minLength={3} maxLength={1000} value={action.reason} onChange={e=>setAction({...action,reason:e.target.value})} className="rounded border p-3"/></label>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<button className={workspacePrimary} disabled={actionBusy}>{actionBusy?"Saving…":"Confirm "+action.kind}</button></form></WorkspaceDialog>}
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
