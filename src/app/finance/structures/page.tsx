"use client";



import {Presence} from "@/components/Motion";
import { useEffect, useState } from "react";
import { CreditCard, Plus, CheckCircle2, X } from "lucide-react";
import { financeApi } from "@/lib/financeApi";

interface FeeStructureItem {
  _id: string;
  classId?: string;
  title: string;
  academicSession: string;
  className: string;
  sectionName?: string;
  admissionFee: number;
  tuitionFee: number;
  examFee: number;
  transportFee: number;
  libraryFee: number;
  computerFee: number;
  otherCharges: number;
  totalMonthlyFee: number;
  defaultDiscount?: number;
  lateFeeFineRate?: number;
  dueDateDay?: number;
}

export default function FeeStructuresPage() {
  const [structures, setStructures] = useState<FeeStructureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [academicSession, setAcademicSession] = useState("2025-2026");
  const [className, setClassName] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<Array<{ _id: string; name: string }>>([]);
  const [admissionFee, setAdmissionFee] = useState(0);
  const [tuitionFee, setTuitionFee] = useState(0);
  const [examFee, setExamFee] = useState(0);
  const [transportFee, setTransportFee] = useState(0);
  const [libraryFee, setLibraryFee] = useState(0);
  const [computerFee, setComputerFee] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [defaultDiscount, setDefaultDiscount] = useState(0);
  const [lateFeeFineRate, setLateFeeFineRate] = useState(500);
  const [dueDateDay, setDueDateDay] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getFeeStructures();
      if (res?.data && Array.isArray(res.data)) {
        setStructures(res.data);
      } else {
        setStructures([]);
      }
    } catch {
      setStructures([]);
    } finally {
      setLoading(false);
    }

    try {
      const res = await financeApi.getClasses();
      const available = Array.isArray(res?.data) ? res.data : [];
      setClasses(available);
      if (available.length > 0) {
        setClassId(available[0]._id);
        setClassName(available[0].name);
      }
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const totalMonthlyFee = tuitionFee + examFee + transportFee + libraryFee + computerFee + otherCharges;

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) {
      setNotice("Create a class in School Admin → Academics → Classes before adding a fee structure.");
      return;
    }
    setSubmitting(true);

    const payload = {
      title: title || `${className} Fee Structure ${academicSession}`,
      academicSession,
      classId,
      className,
      admissionFee,
      tuitionFee,
      examFee,
      transportFee,
      libraryFee,
      computerFee,
      otherCharges,
      defaultDiscount,
      lateFeeFineRate,
      dueDateDay,
    };

    try {
      await financeApi.createFeeStructure(payload);
      await loadData();
      setShowModal(false);
      setNotice(`Fee structure for ${className} created successfully!`);
      setTimeout(() => setNotice(null), 3500);
    } catch {
      // API error feedback handled centrally
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-red-600" />
            Class Fee Structure Builder & Component Policy
          </h1>
          <p className="text-xs text-zinc-500">Configure tuition, admission, computer, transport fees, discounts, and late fines</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Create Fee Structure
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Fee Structures Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-zinc-500 bg-white border border-zinc-200 rounded-2xl">
          Loading fee structures...
        </div>
      ) : structures.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-zinc-300 rounded-2xl space-y-2">
          <CreditCard className="h-8 w-8 text-zinc-400 mx-auto" />
          <h3 className="font-bold text-zinc-950 text-sm">No Fee Structures Found</h3>
          <p className="text-xs text-zinc-500">Create a fee structure for your school classes to begin generating monthly challans.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {structures.map((s) => (
            <div key={s._id} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-start border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">{s.academicSession}</span>
                  <h3 className="text-base font-black text-zinc-950">{s.title}</h3>
                  <p className="text-xs text-zinc-500 font-semibold">{s.className} ({s.sectionName || "All Sections"})</p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-zinc-500 block">Total Monthly</span>
                  <span className="text-lg font-black text-red-600 font-mono">PKR {(s.totalMonthlyFee || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Component Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-700 bg-zinc-50/70 p-3.5 rounded-xl">
                <div>Tuition Fee: <strong className="font-mono text-zinc-950">PKR {(s.tuitionFee || 0).toLocaleString()}</strong></div>
                <div>Admission Fee: <strong className="font-mono text-zinc-950">PKR {(s.admissionFee || 0).toLocaleString()}</strong></div>
                <div>Exam Fee: <strong className="font-mono text-zinc-950">PKR {(s.examFee || 0).toLocaleString()}</strong></div>
                <div>Transport Fee: <strong className="font-mono text-zinc-950">PKR {(s.transportFee || 0).toLocaleString()}</strong></div>
                <div>Computer Fee: <strong className="font-mono text-zinc-950">PKR {(s.computerFee || 0).toLocaleString()}</strong></div>
                <div>Library Fee: <strong className="font-mono text-zinc-950">PKR {(s.libraryFee || 0).toLocaleString()}</strong></div>
                <div>Other Charges: <strong className="font-mono text-zinc-950">PKR {(s.otherCharges || 0).toLocaleString()}</strong></div>
                <div>Default Discount: <strong className="font-mono text-red-600">PKR {(s.defaultDiscount || 0).toLocaleString()}</strong></div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-zinc-500 font-mono border-t border-zinc-100 pt-2">
                <span>Due Date: {s.dueDateDay || 10}th of month</span>
                <span>Late Fine: PKR {s.lateFeeFineRate || 500}/month</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Presence show={Boolean(showModal)} kind="modal">{showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-zinc-200 pb-3">
              <h3 className="text-lg font-bold text-zinc-950">Create New Class Fee Structure</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStructure} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Academic Session</label>
                  <select
                    value={academicSession}
                    onChange={(e) => setAcademicSession(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
                  >
                    <option>2025-2026</option>
                    <option>2026-2027</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 uppercase mb-1">Class</label>
                  <select
                    required
                    value={classId}
                    onChange={(e) => {
                      const selected = classes.find((item) => item._id === e.target.value);
                      setClassId(e.target.value);
                      setClassName(selected?.name || "");
                    }}
                    className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none font-bold"
                  >
                    <option value="">Select a class</option>
                    {classes.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 uppercase mb-1">Fee Structure Title</label>
                <input
                  type="text"
                  placeholder="e.g. Class 10 Monthly Fee Structure 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-3 rounded-xl">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Tuition Fee (PKR)</label>
                  <input
                    type="number"
                    value={tuitionFee}
                    onChange={(e) => setTuitionFee(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Admission Fee (PKR)</label>
                  <input
                    type="number"
                    value={admissionFee}
                    onChange={(e) => setAdmissionFee(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Exam Fee (PKR)</label>
                  <input
                    type="number"
                    value={examFee}
                    onChange={(e) => setExamFee(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Transport Fee (PKR)</label>
                  <input
                    type="number"
                    value={transportFee}
                    onChange={(e) => setTransportFee(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Computer Fee (PKR)</label>
                  <input
                    type="number"
                    value={computerFee}
                    onChange={(e) => setComputerFee(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Library Fee (PKR)</label>
                  <input
                    type="number"
                    value={libraryFee}
                    onChange={(e) => setLibraryFee(Number(e.target.value))}
                    className="w-full border border-zinc-300 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div className="bg-zinc-950 text-white p-3 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold uppercase text-zinc-300">Calculated Total Monthly Fee</span>
                <span className="font-black text-red-400 font-mono text-base">PKR {totalMonthlyFee.toLocaleString()}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-xs"
                >
                  Save Fee Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</Presence>
    </div>
  );
}

