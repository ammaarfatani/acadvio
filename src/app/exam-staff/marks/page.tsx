"use client";
import {TableScroll} from "@/components/TableScroll";




import { useEffect, useState, useRef } from "react";
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Save,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import {confirmAction} from "@/components/ConfirmationHost";
import { examStaffApi } from "@/lib/examStaffApi";

export default function MarksEntryDeskPage() {
  const [dirty,setDirty]=useState(false),[loadedKey,setLoadedKey]=useState(""),[studentSearch,setStudentSearch]=useState("");
  const [activeTab, setActiveTab] = useState<"ENTRY" | "MISSING" | "VERIFICATION">("ENTRY");

  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [passingMarks, setPassingMarks] = useState<number>(33);
  const [marksRecords, setMarksRecords] = useState<Record<string, { obtainedMarks: number | ""; remarks: string; isAbsent: boolean }>>({});

  const [existingMarksDoc, setExistingMarksDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      examStaffApi.getSchedules(),
      examStaffApi.getClasses(),
    ])
      .then(([examRes, classRes]) => {
        const exList = examRes?.data || [];
        const clsList = classRes?.data || [];
        setExams(exList);
        setClasses(clsList);
        if (exList.length > 0) setSelectedExamId(exList[0]._id);
        if (clsList.length > 0) setSelectedClassId(clsList[0]._id);
      })
      .catch((err) => setError(err?.message || "Unable to load initial exam data."));
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      Promise.all([
        examStaffApi.getSections(selectedClassId),
        examStaffApi.getSubjects(selectedClassId),
      ])
        .then(([secRes, subjRes]) => {
          const secList = secRes?.data || [];
          const subjList = subjRes?.data || [];
          setSections(secList);
          setSubjects(subjList);
          if (subjList.length > 0) setSelectedSubjectId(subjList[0]._id);
        })
        .catch(() => {
          setSections([]);
          setSubjects([]);
        });
    }
  }, [selectedClassId]);

  const selectionKey=[selectedExamId,selectedClassId,selectedSectionId,selectedSubjectId].join("/");
  const currentSelection=useRef(selectionKey);currentSelection.current=selectionKey;
  const ready=loadedKey===selectionKey;
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[dirty]);
  const loadMarks = async (afterSave=false) => {
    if(loading||saving&&!afterSave)return;
    if(dirty&&!afterSave&&!(await confirmAction("Discard unsaved marks and load this selection?")))return;
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) return;

    setLoading(true);
    setError("");
    try {
      const [stuRes, marksRes] = await Promise.all([
        examStaffApi.getStudents(selectedClassId, selectedSectionId),
        examStaffApi.getMarks(selectedExamId, selectedClassId, selectedSubjectId, selectedSectionId),
      ]);

      if(currentSelection.current!==selectionKey)return;
      setLoadedKey(selectionKey);setDirty(false);
      const studentList = stuRes?.data || [];
      setStudents(studentList);

      const existingDoc = Array.isArray(marksRes?.data) ? marksRes.data[0] : null;
      setExistingMarksDoc(existingDoc);

      if (existingDoc) {
        setMaxMarks(existingDoc.maxMarks || 100);
        setPassingMarks(existingDoc.passingMarks || 33);
        const map: Record<string, { obtainedMarks: number | ""; remarks: string; isAbsent: boolean }> = {};

        studentList.forEach((s: any) => {
          const matched = (existingDoc.records || []).find((r: any) => String(r.studentId) === String(s._id));
          map[s._id] = {
            obtainedMarks: matched ? Number(matched.obtainedMarks) : "",
            remarks: matched ? matched.remarks || "" : "",
            isAbsent: matched ? Boolean(matched.isAbsent) : false,
          };
        });
        setMarksRecords(map);
      } else {
        const map: Record<string, { obtainedMarks: number | ""; remarks: string; isAbsent: boolean }> = {};
        studentList.forEach((s: any) => {
          map[s._id] = { obtainedMarks: "", remarks: "", isAbsent: false };
        });
        setMarksRecords(map);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load marks for this subject.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(!dirty){setStudents([]);setExistingMarksDoc(null);}
  }, [selectedExamId, selectedClassId, selectedSectionId, selectedSubjectId]);

  const handleRecordChange = (studentId: string, field: "obtainedMarks" | "remarks" | "isAbsent", value: any) => {
    setDirty(true);
    setMarksRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const handleSaveMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving||!ready||!selectedExamId || !selectedClassId || !selectedSubjectId || students.length === 0) return;
    if(!Number.isFinite(maxMarks)||maxMarks<=0||!Number.isFinite(passingMarks)||passingMarks<0||passingMarks>maxMarks){setError("Passing marks must be between zero and maximum marks.");return;}

    // Validate marks limits
    for (const s of students) {
      const rec = marksRecords[s._id];
      if (rec) {
        if (rec.obtainedMarks!=="" && (!Number.isFinite(rec.obtainedMarks) || rec.obtainedMarks < 0 || rec.obtainedMarks > maxMarks)) {
          setError(`Invalid marks for ${s.name}: Marks must be between 0 and ${maxMarks}.`);
          return;
        }
      }
    }

    setSaving(true);
    setError("");
    try {
      const targetSubject = subjects.find((sub) => sub._id === selectedSubjectId);
      const recordsToSave = students.filter(s=>marksRecords[s._id]?.isAbsent || marksRecords[s._id]?.obtainedMarks!=="" && marksRecords[s._id]?.obtainedMarks!==undefined).map((s) => ({
        studentId: s._id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        obtainedMarks: Number(marksRecords[s._id]?.obtainedMarks || 0),
        remarks: marksRecords[s._id]?.remarks || "",
        isAbsent: Boolean(marksRecords[s._id]?.isAbsent),
      }));

      if(!recordsToSave.length){setError("Enter at least one score or mark a student absent. Blank scores remain pending.");return;}
      await examStaffApi.saveMarks({
        examId: selectedExamId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        subjectName: targetSubject?.name || "Subject",
        maxMarks: Number(maxMarks),
        passingMarks: Number(passingMarks),
        records: recordsToSave,
      });

      setNotice("Marks saved successfully and student grades calculated!");
      setTimeout(() => setNotice(null), 4000);
      setDirty(false);await loadMarks(true);
    } catch (err: any) {
      setError(err?.message || "Unable to save examination marks.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-school-primary" />
            Mark Entry
          </h1>
          <p className="text-xs text-zinc-500">
            Record subject marks, verify teacher-entered scores, and track missing mark sheets across examination terms.
          </p>
        </div>

        {/* Sub-Tab Selector */}
        <div className="flex flex-wrap items-center gap-1 bg-zinc-200 p-1 rounded-xl text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab("ENTRY")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "ENTRY" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            Marks Entry
          </button>
          <button
            onClick={() => setActiveTab("VERIFICATION")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "VERIFICATION" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            Verification & Status
          </button>
          <button
            onClick={() => setActiveTab("MISSING")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "MISSING" ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            Missing Marks Tracker
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </p>
      )}

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter Selection Grid */}
      <div className="bg-white border border-zinc-200 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Select Exam *</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
          >
            <option value="">Select Exam</option>
            {exams.map((ex) => (
              <option key={ex._id} value={ex._id}>{ex.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Select Class *</label>
          <select
            value={selectedClassId}
            onChange={(e) => { setSelectedClassId(e.target.value); setSelectedSectionId(""); }}
            className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
          >
            <option value="">Select Class</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Section (Optional)</label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={!selectedClassId}
            className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none disabled:opacity-50"
          >
            <option value="">All Sections</option>
            {sections.map((sec) => (
              <option key={sec._id} value={sec._id}>{sec.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-zinc-700 uppercase mb-1">Select Subject *</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            disabled={!selectedClassId}
            className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none disabled:opacity-50"
          >
            <option value="">Select Subject</option>
            {subjects.map((sub) => (
              <option key={sub._id} value={sub._id}>{sub.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"><p role="status" className="text-sm text-zinc-600">{dirty?"Unsaved changes — save before changing your selection.":ready?"Loaded records · changes are saved only when you choose Save Subject Marks.":"Choose the examination, class and subject, then load students."}</p><button type="button" disabled={loading||saving||!selectedExamId||!selectedClassId||!selectedSubjectId} onClick={()=>void loadMarks()} className="min-h-11 rounded-md bg-school-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{loading?"Loading…":"Load Students"}</button></div>
      <label className="grid gap-2 text-xs font-semibold">Search loaded students<input type="search" value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="Student name, ID or roll" className="min-h-11 rounded-md border px-3"/></label>
      {/* MARKS ENTRY TAB */}
      {activeTab === "ENTRY" && (
        <form onSubmit={handleSaveMarks} className="space-y-4">
          <div className="bg-white border border-zinc-200 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Max Marks</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxMarks}
                  onChange={(e) => {setDirty(true);setMaxMarks(Number(e.target.value))}}
                  className="w-24 border border-zinc-300 rounded-lg p-2 font-mono font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Passing Marks</label>
                <input
                  type="number"
                  min="1"
                  max={maxMarks}
                  value={passingMarks}
                  onChange={(e) => {setDirty(true);setPassingMarks(Number(e.target.value))}}
                  className="w-24 border border-zinc-300 rounded-lg p-2 font-mono font-bold focus:outline-none"
                />
              </div>

              {existingMarksDoc && (
                <div className="text-[11px] text-zinc-500 font-medium">
                  Last Recorded By: <strong className="text-zinc-900 font-bold">{existingMarksDoc.enteredByTeacherName}</strong>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !ready || students.length === 0}
              className="w-full sm:w-auto px-5 py-2.5 bg-school-primary text-white font-bold rounded-xl shadow-xs hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving Marks..." : "Save Subject Marks"}
            </button>
          </div>

          {/* Student Marks Table */}
          {loading ? (
            <p role="status" className="rounded-xl bg-white p-8 text-center text-xs text-zinc-500 border border-zinc-200">
              Loading student records for marks entry…
            </p>
          ) : students.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-xs">
              <TableScroll><table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-zinc-950 text-white uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3.5">Roll No</th>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5">Student / Admission ID</th><th className="p-3.5">Entry status</th>
                    <th className="p-3.5 w-36 text-center">Absent?</th>
                    <th className="p-3.5 w-44">Obtained Marks (Max {maxMarks})</th>
                    <th className="p-3.5">Teacher / Staff Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {students.filter(s=>[s.name,s.studentId,s.admissionNumber,s.rollNumber].join(" ").toLowerCase().includes(studentSearch.toLowerCase())).map((s) => {
                    const rec = marksRecords[s._id] || { obtainedMarks: "", remarks: "", isAbsent: false };
                    return (
                      <tr key={s._id} className={rec.isAbsent ? "bg-red-50/50" : "hover:bg-zinc-50"}>
                        <td className="p-3.5 font-mono font-bold text-zinc-900">{s.rollNumber}</td>
                        <td className="p-3.5 font-bold text-zinc-950">{s.name}</td>
                        <td className="p-3.5 font-mono text-zinc-500">{s.studentId || s.admissionNumber || "—"}</td><td className="p-3.5">{rec.isAbsent?"Absent":rec.obtainedMarks===""?"Pending":dirty?"Unsaved":"Saved"}</td>
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={rec.isAbsent}
                            onChange={(e) => handleRecordChange(s._id, "isAbsent", e.target.checked)}
                            className="h-4 w-4 text-red-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3.5">
                          <input
                            type="number"
                            min="0"
                            max={maxMarks}
                            disabled={rec.isAbsent}
                            placeholder="Pending"
                            value={rec.isAbsent ? "" : rec.obtainedMarks}
                            onChange={(e) => handleRecordChange(s._id, "obtainedMarks", e.target.value===""?"":Number(e.target.value))}
                            className="w-full border border-zinc-300 rounded-lg p-2 font-mono font-bold text-zinc-900 focus:outline-none text-xs disabled:opacity-40"
                          />
                        </td>
                        <td className="p-3.5">
                          <input
                            type="text"
                            placeholder="Optional remark..."
                            value={rec.remarks}
                            onChange={(e) => handleRecordChange(s._id, "remarks", e.target.value)}
                            className="w-full border border-zinc-200 rounded-lg p-2 focus:outline-none text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></TableScroll>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center space-y-2">
              <h3 className="font-bold text-zinc-950 text-xs">No Enrolled Students Available</h3>
              <p className="text-xs text-zinc-500">Select an exam, class, and subject to begin entering student marks.</p>
            </div>
          )}
        </form>
      )}

      {/* MARKS VERIFICATION TAB */}
      {activeTab === "VERIFICATION" && (
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Subject Marks Verification & Audit Status
          </h2>

          {existingMarksDoc ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span>Subject / Class:</span>
                  <strong className="font-bold">{existingMarksDoc.subjectName} ({existingMarksDoc.className})</strong>
                </div>
                <div className="flex justify-between">
                  <span>Records Submitted:</span>
                  <strong className="font-bold text-emerald-700">{existingMarksDoc.records?.length || 0} Students</strong>
                </div>
                <div className="flex justify-between">
                  <span>Recorded By:</span>
                  <strong className="font-mono">{existingMarksDoc.enteredByTeacherName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Verification Status:</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">
                    SAVED RECORD
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500">
              No marks entry batch submitted yet for this exam, class, and subject selection.
            </div>
          )}
        </div>
      )}

      {/* MISSING MARKS TRACKER TAB */}
      {activeTab === "MISSING" && (
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Missing Marks Tracker
          </h2>

          <p className="text-xs text-zinc-500">
            Identifies students and subjects where examination marks have not been recorded or submitted.
          </p>

          {!existingMarksDoc ? (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
              <strong className="font-bold block">Marks Sheet Missing for Selected Subject!</strong>
              <p>No marks entry record exists for the selected subject. Switch to the &quot;Marks Entry&quot; tab to record student marks.</p>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{students.filter(s=>!existingMarksDoc.records?.some((r:any)=>String(r.studentId)===String(s._id))).length} students have no saved entry in this selection.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
