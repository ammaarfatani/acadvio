"use client";
import {Presence} from "@/components/Motion";
import {PageHeading} from "@/components/ProductUI";



import { useEffect, useState } from "react";
import {
  Users,
  Search,
  Plus,
  Printer,
  Filter,
  Eye,
  Edit,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  X,
  School,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar
} from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { useAuth } from "@/lib/auth-context";
import { StudentHistoryModal } from "@/components/StudentHistoryModal";

import { BulkImportModal } from "@/components/BulkImportModal";

export default function StudentsPage() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [rollLoading, setRollLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<any | null>(null);
  const [printAdmissionForm, setPrintAdmissionForm] = useState<any | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    dob: "",
    gender: "Male",
    className: "",
    classId: "",
    rollNumber: "",
    sectionId: "",
    academicSessionId: "",
    address: "",
    phone: "",
    fatherName: "",
    fatherPhone: "",
    fatherCnic: "",
    fatherOccupation: "",
    guardianEmail:"", motherName:"", motherPhone:"", parentPassword:"",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelation: "",
  });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const [resStudents, resClasses, resSessions] = await Promise.all([
        schoolAdminApi.getStudents(classFilter !== "ALL" ? classFilter : undefined, search, statusFilter),
        schoolAdminApi.getClasses(),
        schoolAdminApi.getAcademicSessions(),
      ]);
      if (resStudents?.data) setStudents(resStudents.data);
      if (resClasses?.data) setClasses(resClasses.data);
      if (resSessions?.data) { setSessions(resSessions.data); if (!formData.academicSessionId) setFormData((current) => ({ ...current, academicSessionId: resSessions.data.find((item: any) => item.isCurrent)?._id || "" })); }
      setLoadError("");
    } catch (e: any) {
      setStudents([]);
      setClasses([]);
      setLoadError(e.message || "Could not load students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [classFilter, search, statusFilter]);

  useEffect(() => {
    if (!modalOpen || !formData.classId) { setFormData((current) => ({ ...current, rollNumber: "" })); return; }
    let active = true; setRollLoading(true);
    schoolAdminApi.getNextStudentRollNumber(formData.classId, formData.sectionId || undefined, formData.academicSessionId || undefined)
      .then((res: any) => { if (active) setFormData((current) => ({ ...current, rollNumber: res?.data?.rollNumber || "" })); })
      .catch((e: any) => { if (active) { setFormData((current) => ({ ...current, rollNumber: "" })); setNotice(e?.message || "Unable to preview the next roll number."); } })
      .finally(() => { if (active) setRollLoading(false); });
    return () => { active = false; };
  }, [modalOpen, formData.classId, formData.sectionId, formData.academicSessionId]);

  const handleSubmitAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        dob: new Date(formData.dob),
        gender: formData.gender,
        className: classes.find((c) => c._id === formData.classId)?.name || "",
        classId: formData.classId,
        rollNumber: undefined,
        sectionId: formData.sectionId || undefined,
        sectionName: sections.find((section) => section._id === formData.sectionId)?.name,
        academicSessionId: formData.academicSessionId || undefined,
        academicSessionName: sessions.find((session) => session._id === formData.academicSessionId)?.name,
        address: formData.address,
        phone: formData.phone,
        parentInfo: {
          fatherName: formData.fatherName,
          fatherPhone: formData.fatherPhone,
          fatherCnic: formData.fatherCnic,
          fatherOccupation: formData.fatherOccupation,guardianEmail:formData.guardianEmail,motherName:formData.motherName,motherPhone:formData.motherPhone,
        },
        ...(!editingStudent&&formData.guardianEmail&&formData.parentPassword?{parentAccount:{password:formData.parentPassword}}:{}),
        emergencyContact: {
          name: formData.emergencyName,
          phone: formData.emergencyPhone,
          relation: formData.emergencyRelation,
        },
      };

      if (editingStudent) await schoolAdminApi.updateStudent(editingStudent._id, payload);
      else {const created=await schoolAdminApi.createStudent(payload);if(created.data?.primaryParent?.initialPassword){setNotice("Student admitted. Primary parent login: "+created.data.primaryParent.email+". Initial password: "+created.data.primaryParent.initialPassword+". Share securely with the parent.");setEditingStudent(null);setModalOpen(false);await fetchStudents();return;}}
      setNotice(editingStudent ? `Student '${formData.name}' updated successfully.` : `New student '${formData.name}' admitted successfully. Admission number generated.`);
      setEditingStudent(null);
      setModalOpen(false);
      await fetchStudents();
    } catch (err: any) {
      setNotice(err.message || `Could not save '${formData.name}'. Please check the required fields and try again.`);
    }
  };

  const changeStudentStatus = async (student: any, status: string) => {
    const label = status.replaceAll("_", " ").toLowerCase();
    if (!window.confirm(`Change ${student.name}'s status to ${label}? Student history and linked records will be retained.`)) return;
    try { await schoolAdminApi.updateStudent(student._id, { status }); setNotice(`${student.name}'s status updated to ${label}.`); await fetchStudents(); }
    catch (e: any) { setNotice(e?.message || "Could not update student status."); }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      
      <Presence show={Boolean(bulkOpen)} kind="modal">{bulkOpen && <BulkImportModal entity="students" onClose={() => setBulkOpen(false)} onImported={fetchStudents} />}</Presence>
      {/* Header */}
      <PageHeading eyebrow="School directory" title="Students & admissions" description="Student profiles, guardian contacts, enrollment and admission records." actions={<div className="flex flex-wrap gap-2"><button onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold text-zinc-800"><FileSpreadsheet size={16} />Bulk Upload</button>
        <button
          onClick={() => { setEditingStudent(null); setFormData({ name: "", dob: "", gender: "Male", className: "", classId: "", rollNumber: "", sectionId: "", academicSessionId: sessions.find((s) => s.isCurrent)?._id || "", address: "", phone: "", fatherName: "", fatherPhone: "", fatherCnic: "", fatherOccupation: "",guardianEmail:"",motherName:"",motherPhone:"",parentPassword:"", emergencyName: "", emergencyPhone: "", emergencyRelation: "" }); setModalOpen(true); }}
          className="bg-school-primary hover:bg-school-primary-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Student Admission</span>
        </button></div>}/>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-700 font-bold">Dismiss</button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="ui-data-toolbar bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by student name, roll #, or adm #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-school-primary/20 focus:border-school-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-zinc-500 font-semibold shrink-0">Class Filter:</span>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
          >
            <option value="ALL">All Classes</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter students by status" className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"><option value="ALL">All statuses</option>{[["ACTIVE","Active"],["INACTIVE","Inactive"],["LEFT","Left school"],["GRADUATED","Graduated"],["TRANSFERRED","Transferred"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
      </div>

      {loadError && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{loadError}</p>}
      {/* Students Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-600 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="p-3.5">Admission #</th>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Class / Roll #</th>
                <th className="p-3.5">Father / Guardian Name</th>
                <th className="p-3.5">Parent Contact</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    No student records found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s._id} className="hover:bg-zinc-50">
                    <td className="p-3.5 font-mono font-bold text-school-primary">{s.admissionNumber}</td>
                    <td className="p-3.5 font-bold text-zinc-950">{s.name}</td>
                    <td className="p-3.5">
                      <span className="font-semibold text-zinc-900">{s.className}</span>
                      <span className="text-[10px] font-mono text-zinc-500 block">Roll: {s.rollNumber}</span>
                    </td>
                    <td className="p-3.5 text-zinc-700">{s.parentInfo?.fatherName || "Father Record"}</td>
                    <td className="p-3.5 font-mono text-zinc-600">{s.parentInfo?.fatherPhone || s.phone}</td>
                    <td className="p-3.5"><select value={s.status} onChange={(e) => void changeStudentStatus(s, e.target.value)} aria-label={`Status for ${s.name}`} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${s.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-700"}`}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="LEFT">Left school</option><option value="GRADUATED">Graduated</option><option value="TRANSFERRED">Transferred</option><option value="ARCHIVED">Archive</option></select></td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setEditingStudent(s); setFormData({ name: s.name || "", dob: s.dob ? new Date(s.dob).toISOString().slice(0,10) : "", gender: s.gender || "Male", className: s.className || "", classId: s.classId, rollNumber: s.rollNumber || "", sectionId: s.sectionId || "", academicSessionId: s.academicSessionId || "", address: s.address || "", phone: s.phone || "", fatherName: s.parentInfo?.fatherName || "", fatherPhone: s.parentInfo?.fatherPhone || "", fatherCnic: s.parentInfo?.fatherCnic || "", fatherOccupation: s.parentInfo?.fatherOccupation || "", guardianEmail:s.parentInfo?.guardianEmail||"",motherName:s.parentInfo?.motherName||"",motherPhone:s.parentInfo?.motherPhone||"",parentPassword:"", emergencyName: s.emergencyContact?.name || "", emergencyPhone: s.emergencyContact?.phone || "", emergencyRelation: s.emergencyContact?.relation || "" }); if (s.classId) schoolAdminApi.getSections(s.classId).then((res: any) => setSections(res?.data || [])); setModalOpen(true); }}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg"
                          title="Edit student"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewStudent(s)}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg"
                          title="View Full Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPrintAdmissionForm(s)}
                          className="p-1.5 text-school-primary hover:bg-school-primary-light rounded-lg"
                          title="Print Admission Form"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADMISSION FORM MODAL */}
      <Presence show={Boolean(modalOpen)} kind="modal">{modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-950">{editingStudent ? "Edit Student Record" : "New Student Admission"}</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-950">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdmission} className="space-y-4">
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-school-primary uppercase tracking-wider">1. Student Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Student Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Muhammad Hamza"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Date of Birth *</label>
                    <input
                      type="date"
                      required
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Class / Grade Allocation *</label>
                    <select required value={formData.classId} onChange={(e) => { const selected = classes.find((c) => c._id === e.target.value); setFormData({ ...formData, classId: e.target.value, className: selected?.name || "", sectionId: "" }); setSections([]); if (e.target.value) schoolAdminApi.getSections(e.target.value).then((res: any) => setSections(res?.data || [])).catch(() => setNotice("Could not load sections for this class.")); }} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-900">
                      <option value="">Select a class</option>{classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Academic Session *</label>
                    <select required value={formData.academicSessionId} onChange={(e) => setFormData({ ...formData, academicSessionId: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-900">
                      <option value="">Select a session</option>{sessions.map((session) => <option key={session._id} value={session._id}>{session.name}{session.isCurrent ? " (Current)" : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Section</label>
                    <select value={formData.sectionId} onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })} disabled={!formData.classId} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-900">
                      <option value="">Select a section</option>{sections.map((section) => <option key={section._id} value={section._id}>{section.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Automatic Roll Number</label>
                    <input
                      type="text"
                      readOnly
                      placeholder={rollLoading ? "Generating…" : "Select a class to preview"}
                      value={formData.rollNumber}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-school-primary uppercase tracking-wider">3. Emergency Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input required aria-label="Emergency contact name" value={formData.emergencyName} onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })} placeholder="Contact name" className="rounded-lg border bg-zinc-50 px-3 py-2 text-xs" />
                  <input required aria-label="Emergency contact phone" value={formData.emergencyPhone} onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })} placeholder="Contact phone" className="rounded-lg border bg-zinc-50 px-3 py-2 text-xs" />
                  <input required aria-label="Emergency contact relation" value={formData.emergencyRelation} onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })} placeholder="Relationship" className="rounded-lg border bg-zinc-50 px-3 py-2 text-xs" />
                </div>
              </div>

              <section className="rounded-xl border border-red-100 bg-red-50/30 p-4"><h4 className="text-sm font-semibold">Primary parent portal</h4><p className="mt-1 text-xs text-zinc-600">Enter one primary parent email. Admission creates the account or links an existing parent in this branch. Father and mother details stay in the student record.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Primary parent email<input type="email" value={formData.guardianEmail} onChange={e=>setFormData({...formData,guardianEmail:e.target.value})} placeholder="parent@example.com" className="rounded-lg border bg-white p-3"/></label>{!editingStudent&&<label className="grid gap-1 text-xs font-semibold">Initial parent password (optional)<input type="password" minLength={8} value={formData.parentPassword} onChange={e=>setFormData({...formData,parentPassword:e.target.value})} placeholder="Leave blank to generate a secure password" className="rounded-lg border bg-white p-3"/></label>}<label className="grid gap-1 text-xs font-semibold">Mother name<input value={formData.motherName} onChange={e=>setFormData({...formData,motherName:e.target.value})} placeholder="Enter mother's full name" className="rounded-lg border bg-white p-3"/></label><label className="grid gap-1 text-xs font-semibold">Mother phone<input value={formData.motherPhone} onChange={e=>setFormData({...formData,motherPhone:e.target.value})} placeholder="03XX-XXXXXXX" className="rounded-lg border bg-white p-3"/></label></div></section>
<div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-school-primary uppercase tracking-wider">2. Parent / Guardian Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Father / Guardian Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Rashid Mahmood"
                      value={formData.fatherName}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Father Mobile Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="+92 300 1234567"
                      value={formData.fatherPhone}
                      onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Father CNIC / National ID</label>
                    <input
                      type="text"
                      placeholder="35202-1234567-1"
                      value={formData.fatherCnic}
                      onChange={(e) => setFormData({ ...formData, fatherCnic: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-1">Residential Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="Gulberg III, Lahore"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-school-primary hover:bg-school-primary-hover text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Admit & Save Student Record
                </button>
              </div>

            </form>
          </div>
        </div>
      )}</Presence>

      {/* PRINTABLE ADMISSION FORM VIEW */}
      <Presence show={Boolean(printAdmissionForm)} kind="modal">{printAdmissionForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 space-y-6 shadow-2xl border border-zinc-950 font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-4">
              <div>
                <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">{user?.school?.name || "School"}</h2>
                <p className="text-xs text-zinc-600">Official Student Enrollment & Admission Form</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-school-primary font-mono">{printAdmissionForm.admissionNumber}</div>
                <div className="text-[10px] text-zinc-500">Date: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div><strong>Student Name:</strong> {printAdmissionForm.name}</div>
              <div><strong>Class:</strong> {printAdmissionForm.className}</div>
              <div><strong>Roll Number:</strong> {printAdmissionForm.rollNumber}</div>
              <div><strong>Date of Birth:</strong> {printAdmissionForm.dob}</div>
              <div><strong>Father Name:</strong> {printAdmissionForm.parentInfo?.fatherName}</div>
              <div><strong>Father Mobile:</strong> {printAdmissionForm.parentInfo?.fatherPhone}</div>
              <div><strong>Father CNIC:</strong> {printAdmissionForm.parentInfo?.fatherCnic}</div>
              <div><strong>Address:</strong> {printAdmissionForm.address}</div>
            </div>

            <div className="pt-8 border-t border-zinc-300 flex justify-between text-[11px] font-bold text-zinc-800">
              <div>Parent Signature: __________________</div>
              <div>Principal Seal & Sign: __________________</div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setPrintAdmissionForm(null)} className="px-4 py-2 bg-zinc-100 text-xs font-semibold rounded-xl">Close</button>
              <button onClick={() => window.print()} className="px-4 py-2 bg-zinc-950 text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Print Form
              </button>
            </div>
          </div>
        </div>
      )}</Presence>

      {/* STUDENT HISTORY MODAL */}
      <Presence show={Boolean(viewStudent)} kind="modal">{viewStudent && (
        <StudentHistoryModal
          studentId={viewStudent._id}
          isOpen={!!viewStudent}
          onClose={() => setViewStudent(null)}
          portalType="admin"
        />
      )}</Presence>

    </div>
  );
}
