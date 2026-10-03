"use client";

import { useEffect, useState } from "react";
import { Award, Printer, AlertCircle, Building2 } from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { useAuth } from "@/lib/auth-context";

interface StudentRecord {
  _id: string;
  name: string;
  admissionNumber: string;
  rollNumber: string;
  className: string;
  sectionName?: string;
  parentInfo?: {
    fatherName?: string;
  };
  dob?: string;
  admissionDate?: string;
}

export default function CertificatesGeneratorPage() {
  const { user } = useAuth();
  const [certType, setCertType] = useState<"BONAFIDE" | "CHARACTER" | "LEAVING" | "TRANSFER" | "RESULT">("BONAFIDE");
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [schoolProfile, setSchoolProfile] = useState<any>(null);
  const [reason, setReason] = useState("Official Verification & Record Keeping");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, studentRes] = await Promise.all([
          schoolAdminApi.getSchoolProfile().catch(() => null),
          schoolAdminApi.getStudents(),
        ]);

        if (profileRes?.data) setSchoolProfile(profileRes.data);

        const list = studentRes?.data?.students || studentRes?.data || (Array.isArray(studentRes) ? studentRes : []);
        setStudents(list);

        if (list.length > 0) {
          setSelectedStudentId(list[0]._id);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load student records for certificate generation.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const student = students.find((s) => s._id === selectedStudentId);
  const schoolName = schoolProfile?.name || user?.school?.name || "School ERP System";
  const logoUrl = schoolProfile?.logoUrl || (user?.school as any)?.logoUrl || "";
  const schoolAddress = schoolProfile?.address || (user?.school as any)?.address || "";
  const schoolPhone = schoolProfile?.phone || (user?.school as any)?.phone || "";

  const certNumber = student
    ? `CERT-${certType.slice(0, 3)}-${(student.admissionNumber || student.rollNumber || student._id.slice(-4)).split("-").pop()}`
    : "";

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm font-semibold text-zinc-500 animate-pulse bg-white border border-zinc-200 rounded-xl">
        Loading real student records & institutional branding...
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-zinc-300 mx-auto" />
        <h3 className="text-base font-bold text-zinc-900">No Enrolled Students Found</h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          No active student records exist in the database for certificate generation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Controls Header */}
      <div className="print:hidden bg-white border border-zinc-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-950 flex items-center gap-2">
            <Award className="h-5 w-5 text-red-600" />
            Institutional Certificate Generator
          </h1>
          <p className="text-xs text-zinc-500">Issue Bonafide, Character, School Leaving, Transfer & Result certificates from real student records</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={certType}
            onChange={(e: any) => setCertType(e.target.value)}
            className="text-xs font-bold border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
          >
            <option value="BONAFIDE">Bonafide Student Certificate</option>
            <option value="CHARACTER">Character Certificate</option>
            <option value="LEAVING">School Leaving Certificate (SLC)</option>
            <option value="TRANSFER">School Transfer Certificate</option>
            <option value="RESULT">Academic Result Certificate</option>
          </select>

          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="text-xs font-bold border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
          >
            {students.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.className} - Roll {s.rollNumber || "—"})
              </option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            disabled={!student}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors shadow-xs shrink-0 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print Official Certificate
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Certificate Document Card (Print Friendly) */}
      {student && (
        <div className="bg-white border-4 border-double border-zinc-900 p-10 rounded-none shadow-md max-w-3xl mx-auto space-y-8 text-zinc-950 print:border-0 print:p-0 print:shadow-none font-serif">
          {/* Header */}
          <div className="text-center space-y-2 border-b-2 border-zinc-900 pb-6">
            <div className="flex items-center justify-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={schoolName} className="h-12 w-12 object-contain" />
              ) : (
                <div className="w-12 h-12 bg-red-600 text-white font-sans font-black flex items-center justify-center text-2xl rounded">
                  {schoolName.charAt(0)}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black tracking-tight text-zinc-950 uppercase font-sans">{schoolName}</h2>
                <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest font-sans">Affiliated & Recognized Educational Institution</p>
              </div>
            </div>
            {schoolAddress && <p className="text-[11px] text-zinc-500 font-mono">{schoolAddress} {schoolPhone ? `| Phone: ${schoolPhone}` : ""}</p>}
          </div>

          {/* Certificate Title */}
          <div className="text-center py-2">
            <span className="border-b-2 border-t-2 border-zinc-900 py-1.5 px-8 text-base font-black uppercase tracking-widest font-sans inline-block">
              {certType === "BONAFIDE" && "BONAFIDE STUDENT CERTIFICATE"}
              {certType === "CHARACTER" && "CHARACTER & CONDUCT CERTIFICATE"}
              {certType === "LEAVING" && "SCHOOL LEAVING CERTIFICATE"}
              {certType === "TRANSFER" && "TRANSFER CERTIFICATE"}
              {certType === "RESULT" && "ACADEMIC RESULT CERTIFICATE"}
            </span>
          </div>

          {/* Certificate Serial Metadata */}
          <div className="flex justify-between items-center text-xs font-mono text-zinc-600">
            <span>Certificate No: <strong className="text-zinc-950">{certNumber}</strong></span>
            <span>Date of Issue: <strong className="text-zinc-950">{issueDate}</strong></span>
          </div>

          {/* Certificate Legal Wording Body */}
          <div className="text-sm leading-relaxed text-justify space-y-4 text-zinc-900 pt-2">
            {certType === "BONAFIDE" && (
              <p>
                This is to certify that <strong>{student.name}</strong>, Son/Daughter of <strong>{student.parentInfo?.fatherName || "N/A"}</strong>, bearing Roll Number <strong>{student.rollNumber || "N/A"}</strong> and Admission ID <strong>{student.admissionNumber || "N/A"}</strong>, is a bonafide student of this institution currently studying in <strong>{student.className} {student.sectionName || ""}</strong>.
              </p>
            )}

            {certType === "CHARACTER" && (
              <p>
                This is to certify that <strong>{student.name}</strong>, Son/Daughter of <strong>{student.parentInfo?.fatherName || "N/A"}</strong>, bearing Roll Number <strong>{student.rollNumber || "N/A"}</strong>, has been a regular student of <strong>{student.className}</strong> in this institution. During his/her stay at this school, his/her general conduct and moral character have been found to be <strong>Exemplary and Outstanding</strong>. To the best of my knowledge, he/she bears a good reputation.
              </p>
            )}

            {certType === "LEAVING" && (
              <p>
                This is to certify that <strong>{student.name}</strong>, Son/Daughter of <strong>{student.parentInfo?.fatherName || "N/A"}</strong>, was admitted to this school and left the institution on <strong>{issueDate}</strong> after completing studies in <strong>{student.className}</strong>. All school dues have been cleared.
              </p>
            )}

            {certType === "TRANSFER" && (
              <p>
                This Transfer Certificate is issued to <strong>{student.name}</strong>, Son/Daughter of <strong>{student.parentInfo?.fatherName || "N/A"}</strong>, studying in <strong>{student.className}</strong>, enabling transfer to another recognized institution. All institutional fees have been cleared.
              </p>
            )}

            {certType === "RESULT" && (
              <p>
                This is to certify that <strong>{student.name}</strong>, Roll Number <strong>{student.rollNumber || "N/A"}</strong>, appeared in the Academic Examination for <strong>{student.className}</strong> and passed the examination with distinction.
              </p>
            )}

            <p className="italic text-xs text-zinc-600">
              This certificate is issued upon official request for <strong>{reason}</strong>.
            </p>
          </div>

          {/* Signatures & Seal */}
          <div className="pt-12 grid grid-cols-2 gap-12 items-end text-center text-xs font-sans">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 border-2 border-dashed border-red-500 rounded-full flex flex-col items-center justify-center text-[9px] font-bold text-red-600 uppercase tracking-tighter mb-2 p-1 text-center">
                Official Seal
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Checked By: Exam Office</span>
            </div>

            <div className="border-t border-zinc-900 pt-2 font-bold text-zinc-950">
              Principal Stamp & Authorized Signature
            </div>
          </div>

          {/* Digital Footer */}
          <div className="border-t border-zinc-200 pt-3 flex justify-between items-center text-[10px] font-mono text-zinc-400 font-sans">
            <span>Generated by {schoolName} ERP</span>
            <span>Verification Code: {certNumber}</span>
          </div>
        </div>
      )}
    </div>
  );
}
