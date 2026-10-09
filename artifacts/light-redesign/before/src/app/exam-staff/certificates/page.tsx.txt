"use client";



import { useEffect, useState } from "react";
import { Award, Printer, Plus, CheckCircle2, Search } from "lucide-react";
import { examStaffApi } from "@/lib/examStaffApi";
import { useAuth } from "@/lib/auth-context";

export default function IssueCertificatesPage() {
  const { user } = useAuth();
  const schoolName = user?.school?.name || "School ERP";
  const schoolLogo = user?.school?.logoUrl || "";

  const [certificates, setCertificates] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [type, setType] = useState<"BONAFIDE" | "CHARACTER" | "LEAVING" | "TRANSFER" | "RESULT">("BONAFIDE");
  const [reason, setReason] = useState("On student/parent request");
  const [conductRemarks, setConductRemarks] = useState("Satisfactory conduct and moral character");

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
      if (clsList.length > 0) setSelectedClassId(clsList[0]._id);
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
    if (selectedClassId) {
      examStaffApi.getStudents(selectedClassId)
        .then((res) => {
          const stuList = res?.data || [];
          setStudents(stuList);
          if (stuList.length > 0) setSelectedStudentId(stuList[0]._id);
        })
        .catch(() => setStudents([]));
    }
  }, [selectedClassId]);

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    setIssuing(true);
    setError("");
    try {
      const certRes = await examStaffApi.issueCertificate({
        type,
        studentId: selectedStudentId,
        classId: selectedClassId,
        reason,
        conductRemarks,
      });

      setNotice(`Certificate ${certRes?.data?.certificateNumber || ""} issued successfully!`);
      setTimeout(() => setNotice(null), 4000);
      setSelectedCertForPrint(certRes?.data || null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Unable to issue certificate.");
    } finally {
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
            Issue Bonafide, Character, Leaving, Transfer, and Result certificates with unique certificate IDs.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="print:hidden rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
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

        <form onSubmit={handleIssueCertificate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block font-bold text-zinc-700 uppercase mb-1">Certificate Type *</label>
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
            <label className="block font-bold text-zinc-700 uppercase mb-1">Select Class *</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 uppercase mb-1">Select Student *</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={students.length === 0}
              className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none disabled:opacity-50"
            >
              {students.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.rollNumber})</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={issuing || !selectedStudentId}
              className="w-full py-2.5 bg-school-primary text-white font-bold rounded-lg shadow-xs hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {issuing ? "Issuing..." : "Issue Certificate"}
            </button>
          </div>
        </form>
      </div>

      {/* Issued Certificates Directory */}
      <div className="print:hidden space-y-4">
        <h2 className="text-sm font-bold text-zinc-950">Issued Certificates Directory ({certificates.length})</h2>

        {loading ? (
          <p role="status" className="rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200">
            Loading certificates log…
          </p>
        ) : certificates.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
                <tr>
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
                    <td className="p-3.5 font-mono font-bold text-zinc-900">{cert.certificateNumber}</td>
                    <td className="p-3.5 font-bold text-school-primary">{cert.type}</td>
                    <td className="p-3.5 font-bold text-zinc-950">{cert.studentName}</td>
                    <td className="p-3.5 text-zinc-600">{cert.className} / Roll {cert.rollNumber}</td>
                    <td className="p-3.5 text-zinc-800 font-mono">
                      {new Date(cert.issueDate).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => { setSelectedCertForPrint(cert); setTimeout(() => window.print(), 200); }}
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

      {/* PRINTABLE CERTIFICATE VIEW */}
      {selectedCertForPrint && (
        <div className="hidden print:block bg-white p-12 border-4 border-zinc-900 font-serif text-center text-zinc-950 space-y-8 min-h-[700px] flex flex-col justify-between">
          <div className="space-y-3">
            {schoolLogo && <img src={schoolLogo} alt="Logo" className="h-16 mx-auto object-contain" />}
            <h1 className="text-3xl font-black uppercase tracking-tight">{schoolName}</h1>
            <h2 className="text-lg font-bold uppercase text-school-primary tracking-widest border-b-2 border-zinc-900 pb-2 max-w-md mx-auto">
              {selectedCertForPrint.type} CERTIFICATE
            </h2>
            <p className="text-xs font-mono text-zinc-600">Certificate No: {selectedCertForPrint.certificateNumber}</p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed max-w-2xl mx-auto py-6">
            <p>
              This is to officially certify that <strong className="text-base font-sans underline">{selectedCertForPrint.studentName}</strong>,
              Roll Number <strong className="font-mono">{selectedCertForPrint.rollNumber}</strong> (Admission No: {selectedCertForPrint.admissionNumber || "—"}),
              is/was a bonafide student of <strong className="font-sans font-bold">{selectedCertForPrint.className}</strong> at {schoolName} during the academic session {selectedCertForPrint.session}.
            </p>

            <p>
              Remarks & Moral Conduct: <em className="font-sans font-semibold">{selectedCertForPrint.conductRemarks || "Excellent moral character and satisfactory conduct."}</em>
            </p>
          </div>

          <div className="pt-12 grid grid-cols-2 gap-12 text-xs font-sans font-bold uppercase">
            <div className="border-t border-zinc-900 pt-2">
              <span>Date of Issue: {new Date(selectedCertForPrint.issueDate).toLocaleDateString()}</span>
            </div>
            <div className="border-t border-zinc-900 pt-2">
              <span>Principal Signature & School Seal</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
