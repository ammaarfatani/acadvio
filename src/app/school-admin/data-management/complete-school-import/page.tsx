"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ArrowRight,
  Database,
  Building,
  GraduationCap,
  Users,
  Coins,
  BookOpen,
  Award,
  Layers,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  FileCheck,
  ShieldCheck,
  Loader2,
  Sparkles,
  History,
} from "lucide-react";
import { PageHeading } from "@/components/ProductUI";
import { TableScroll } from "@/components/TableScroll";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import {
  UNIVERSAL_ENTITIES,
  UNIVERSAL_IMPORT_ORDER,
  SubscriptionPlanTier,
  PLAN_ENTITIES,
  PLAN_TIER_DETAILS,
  normalizePlanTier,
} from "@/lib/universal-import-config";
import type { ImportPreview, StagedRow } from "@/lib/bulk-import";

function saveExcelFile(data: { base64: string; filename: string; mime: string }) {
  const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: data.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });
}

type MigrationStep = "PREPARE" | "UPLOAD" | "PREVIEW" | "EXECUTING" | "COMPLETED";

export default function CompleteSchoolImportPage() {
  const { user } = useAuth();
  const storageKey = `acadivo:migration-job:${user?.id || ""}:${user?.school?._id || ""}`;

  const [step, setStep] = useState<MigrationStep>("PREPARE");
  const [job, setJob] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadingSample, setDownloadingSample] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  // Plan Entitlement Metadata
  const [planInfo, setPlanInfo] = useState<any>(null);
  const [selectedPlanTier, setSelectedPlanTier] = useState<SubscriptionPlanTier>("ENTERPRISE");

  // Import History State
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load school plan entitlement info
  useEffect(() => {
    schoolAdminApi
      .getMigrationPlanInfo()
      .then((res: any) => {
        if (res?.data) {
          setPlanInfo(res.data);
          setSelectedPlanTier(res.data.planTier || "ENTERPRISE");
        }
      })
      .catch(() => {
        const tier = normalizePlanTier(user?.school?.plan);
        const details = PLAN_TIER_DETAILS[tier];
        setPlanInfo({
          plan: user?.school?.plan || "BASIC",
          planTier: tier,
          details,
          allowedEntities: PLAN_ENTITIES[tier],
          sheetCount: details.sheetCount,
          allPlans: PLAN_TIER_DETAILS,
        });
        setSelectedPlanTier(tier);
      });
  }, [user?.school?.plan]);

  // Load import history
  const loadHistory = () => {
    setLoadingHistory(true);
    schoolAdminApi
      .getMigrationHistory()
      .then((res: any) => {
        if (res?.data && Array.isArray(res.data)) {
          setHistory(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    loadHistory();
  }, [step]);

  // Preview filtering
  const [selectedSheet, setSelectedSheet] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [rowSearch, setRowSearch] = useState<string>("");
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Re-hydrate existing job from sessionStorage
  useEffect(() => {
    try {
      const savedJobId = sessionStorage.getItem(storageKey);
      if (savedJobId) {
        setLoading(true);
        schoolAdminApi
          .getMasterImport(savedJobId, 1)
          .then((res: any) => {
            const currentJob: ImportPreview = res.data;
            if (currentJob) {
              setJob(currentJob);
              if (currentJob.status === "COMPLETED") {
                setStep("COMPLETED");
              } else if (currentJob.status === "PROCESSING") {
                setStep("EXECUTING");
              } else {
                setStep("PREVIEW");
              }
            }
          })
          .catch(() => {
            sessionStorage.removeItem(storageKey);
          })
          .finally(() => setLoading(false));
      }
    } catch {}
  }, [storageKey]);

  // Polling during EXECUTION
  useEffect(() => {
    if (step === "EXECUTING" && job?.id) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res: any = await schoolAdminApi.getMasterImport(job.id, 1);
          const updated: ImportPreview = res.data;
          setJob(updated);
          if (updated.status === "COMPLETED" || updated.status === "FAILED") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setStep("COMPLETED");
            loadHistory();
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [step, job?.id]);

  const handleDownloadMasterTemplate = async (tierOverride?: SubscriptionPlanTier) => {
    const tier = tierOverride || selectedPlanTier || planInfo?.planTier || "ENTERPRISE";
    const filename = PLAN_TIER_DETAILS[tier]?.blankFilename || `Acadivo-${tier}-Blank-Template.xlsx`;
    try {
      setDownloadingTemplate(true);
      setErrorMessage("");
      const res: any = await schoolAdminApi.getMasterTemplate(tier, "blank");
      if (res?.data) {
        saveExcelFile(res.data);
        return;
      }
      window.open(`/templates/${filename}`, "_blank");
    } catch {
      window.open(`/templates/${filename}`, "_blank");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleDownloadSample = async (tierOverride?: SubscriptionPlanTier) => {
    const tier = tierOverride || selectedPlanTier || planInfo?.planTier || "ENTERPRISE";
    const filename = PLAN_TIER_DETAILS[tier]?.exampleFilename || `Acadivo-${tier}-Example-Data.xlsx`;
    try {
      setDownloadingSample(true);
      setErrorMessage("");
      const res: any = await schoolAdminApi.getMasterSample(tier);
      if (res?.data) {
        saveExcelFile(res.data);
        return;
      }
      window.open(`/templates/${filename}`, "_blank");
    } catch {
      window.open(`/templates/${filename}`, "_blank");
    } finally {
      setDownloadingSample(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMessage("Please select a valid Excel workbook (.xlsx or .xls).");
      return;
    }
    if (file.size > 26214400) {
      setErrorMessage("File exceeds maximum allowed size of 25 MB.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const base64 = await readFileAsBase64(file);
      const res: any = await schoolAdminApi.previewMasterImport({
        filename: file.name,
        base64,
      });

      const previewJob: ImportPreview = res.data;
      setJob(previewJob);
      try {
        sessionStorage.setItem(storageKey, previewJob.id);
      } catch {}
      setStep("PREVIEW");
    } catch (e: any) {
      setErrorMessage(e?.message || "Failed to parse and validate the uploaded workbook.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartImport = async () => {
    if (!job?.id) return;
    try {
      setLoading(true);
      setConfirmModalOpen(false);
      await schoolAdminApi.commitMasterImport(job.id, skipDuplicates);
      setStep("EXECUTING");
    } catch (e: any) {
      setErrorMessage(e?.message || "Failed to start migration execution.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrors = async (importIdOverride?: string) => {
    const targetId = importIdOverride || job?.id;
    if (!targetId) return;
    try {
      setLoading(true);
      const res: any = await schoolAdminApi.getMasterImportErrors(targetId);
      if (res?.data) {
        saveExcelFile(res.data);
      }
    } catch (e: any) {
      alert("No errors to download or report unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
    setJob(null);
    setStep("PREPARE");
    setErrorMessage("");
  };

  // Filter staged rows in preview
  const filteredRows = (job?.rows || []).filter((r: StagedRow) => {
    if (selectedSheet !== "ALL" && r.sheet !== selectedSheet) return false;
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (rowSearch.trim()) {
      const q = rowSearch.toLowerCase();
      const matchKey = r.key?.toLowerCase().includes(q);
      const matchMsg = r.message?.toLowerCase().includes(q);
      const matchData = Object.values(r.data || {}).some((v) =>
        String(v).toLowerCase().includes(q)
      );
      if (!matchKey && !matchMsg && !matchData) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <PageHeading
        eyebrow="Universal Onboarding & Data Management"
        title="Complete School Import"
        description="Import an entire operating school into Acadivo with a single unified master Excel workbook. Supports branches, sessions, academics, students, parents, attendance, finance, examinations, and payroll."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-sm transition-all ${
                showHistory
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <History size={15} className={showHistory ? "text-white" : "text-zinc-500"} />
              {showHistory ? "Hide Import History" : `Import History (${history.length})`}
            </button>
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              <Database size={15} className="text-zinc-500" />
              {showCatalog ? "Hide Entity Catalog" : "View 36 Supported Entities"}
            </button>
            {job && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                <RefreshCw size={14} className="text-zinc-500" />
                New Import
              </button>
            )}
          </div>
        }
      />

      {/* Import History Collapsible Section */}
      {showHistory && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                <History size={16} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Recent School Import Batches</h3>
                <p className="text-xs text-zinc-500">
                  Audit log of previously executed bulk migration workbooks for this school tenant.
                </p>
              </div>
            </div>
            <button
              onClick={loadHistory}
              disabled={loadingHistory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {history.length > 0 ? (
            <TableScroll>
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-3.5 py-2.5">Execution Date</th>
                    <th className="px-3.5 py-2.5">Workbook File</th>
                    <th className="px-3.5 py-2.5">Plan Tier</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Sheets</th>
                    <th className="px-3.5 py-2.5">Total Rows</th>
                    <th className="px-3.5 py-2.5">Created</th>
                    <th className="px-3.5 py-2.5">Errors</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {history.map((h: any) => {
                    const statusColor =
                      h.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : h.status === "PROCESSING"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800";

                    return (
                      <tr key={h.id} className="hover:bg-zinc-50/70">
                        <td className="px-3.5 py-2.5 font-medium text-zinc-700">
                          {new Date(h.createdAt).toLocaleString("en-PK", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-zinc-800 truncate max-w-[200px]" title={h.filename}>
                          {h.filename}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700">
                            {h.planTier || "ENTERPRISE"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-zinc-600">{h.sheetsCount || "—"}</td>
                        <td className="px-3.5 py-2.5 font-bold text-zinc-900">{h.totalRows}</td>
                        <td className="px-3.5 py-2.5 font-bold text-emerald-600">{h.successRows}</td>
                        <td className="px-3.5 py-2.5 font-bold text-red-600">{h.errorRows}</td>
                        <td className="px-3.5 py-2.5 text-right">
                          {h.errorRows > 0 ? (
                            <button
                              onClick={() => handleDownloadErrors(h.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-800 hover:underline"
                            >
                              <Download size={12} />
                              Errors
                            </button>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">Clean</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400">
              No previous import jobs recorded. Upload your school&apos;s master template to execute your first batch.
            </div>
          )}
        </div>
      )}

      {/* Step Indicator */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {[
            { key: "PREPARE", label: "1. Prepare Template", desc: "Download master .xlsx" },
            { key: "UPLOAD", label: "2. Upload Workbook", desc: "Drag & drop master file" },
            { key: "PREVIEW", label: "3. Verify & Preview", desc: "Validate 38 sheets" },
            { key: "EXECUTING", label: "4. Dependency Import", desc: "Topological resolution" },
            { key: "COMPLETED", label: "5. Ready & Verified", desc: "Explore portal data" },
          ].map((s, idx) => {
            const isActive = step === s.key;
            const isDone =
              (s.key === "PREPARE" && step !== "PREPARE") ||
              (s.key === "UPLOAD" && ["PREVIEW", "EXECUTING", "COMPLETED"].includes(step)) ||
              (s.key === "PREVIEW" && ["EXECUTING", "COMPLETED"].includes(step)) ||
              (s.key === "EXECUTING" && step === "COMPLETED") ||
              (s.key === "COMPLETED" && step === "COMPLETED");

            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors ${
                  isActive
                    ? "bg-red-50/80 border border-red-200"
                    : isDone
                    ? "bg-emerald-50/50 border border-emerald-100"
                    : "bg-zinc-50/60 border border-zinc-100"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isActive
                      ? "bg-red-600 text-white"
                      : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {isDone ? <CheckCircle2 size={15} /> : idx + 1}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isActive ? "text-red-950 font-bold" : isDone ? "text-emerald-950" : "text-zinc-600"
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={20} className="shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold">Migration Notice</h4>
            <p className="mt-0.5 text-xs text-red-700">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage("")}
            className="text-xs font-semibold text-red-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Plan Entitlement & Tier Selection Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50/60 to-zinc-100/40 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Active Subscription Entitlement
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wide ${
                  (planInfo?.planTier || "ENTERPRISE") === "BASIC"
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : (planInfo?.planTier || "ENTERPRISE") === "PROFESSIONAL"
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                <Sparkles size={11} />
                {planInfo?.details?.name || planInfo?.planTier || "ENTERPRISE"} PLAN
              </span>
            </div>
            <h3 className="text-base font-bold text-zinc-900">
              Plan-Specific Bulk Import & School Migration System
            </h3>
            <p className="text-xs text-zinc-600 max-w-2xl">
              Your subscription provides access to{" "}
              <strong className="text-zinc-900">{planInfo?.sheetCount || 38} worksheets</strong> tailored to your school capacity. Download blank templates ready for data entry or explore complete sample files with interconnected records.
            </p>
          </div>

          {/* Plan Tier Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-zinc-200/60 p-1 self-start md:self-auto">
            {(["BASIC", "PROFESSIONAL", "ENTERPRISE"] as SubscriptionPlanTier[]).map((tierKey) => {
              const isSelected = selectedPlanTier === tierKey;
              const isCurrentSchoolPlan = (planInfo?.planTier || "ENTERPRISE") === tierKey;
              const tierMeta = PLAN_TIER_DETAILS[tierKey];

              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => setSelectedPlanTier(tierKey)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                  }`}
                >
                  <span>{tierMeta.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                      isSelected ? "bg-zinc-100 text-zinc-700" : "text-zinc-400"
                    }`}
                  >
                    {tierMeta.sheetCount} sheets
                  </span>
                  {isCurrentSchoolPlan && (
                    <span className="rounded-full bg-emerald-500/10 px-1 text-[9px] font-black text-emerald-700">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tier Capability Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Student Quota</span>
            <p className="text-sm font-black text-zinc-900">
              {PLAN_TIER_DETAILS[selectedPlanTier].maxStudentsDisplay}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Faculty Quota</span>
            <p className="text-sm font-black text-zinc-900">
              {PLAN_TIER_DETAILS[selectedPlanTier].maxTeachersDisplay}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Campus Architecture</span>
            <p className="text-sm font-black text-zinc-900">
              {PLAN_TIER_DETAILS[selectedPlanTier].branchesDisplay}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Included Sheets</span>
            <p className="text-sm font-black text-zinc-900">
              {PLAN_TIER_DETAILS[selectedPlanTier].sheetCount} Worksheets ({PLAN_ENTITIES[selectedPlanTier].length} Entities)
            </p>
          </div>
        </div>
      </div>

      {/* 36-Entity Matrix Catalog (Toggled) */}
      {showCatalog && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                <Database size={18} className="text-red-600" />
                All 36 Supported Migration Entities
              </h3>
              <p className="text-xs text-zinc-500">
                Data is imported in strict topological order to guarantee that referenced branches, sessions, classes, and users exist before dependent records are created.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search entities or sheets..."
                className="w-full rounded-xl border border-zinc-200 pl-8 pr-3 py-1.5 text-xs focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {UNIVERSAL_IMPORT_ORDER.map((entityKey: string, idx: number) => {
              const def = UNIVERSAL_ENTITIES[entityKey];
              if (!def) return null;
              if (
                catalogSearch.trim() &&
                !def.title.toLowerCase().includes(catalogSearch.toLowerCase()) &&
                !def.sheetName.toLowerCase().includes(catalogSearch.toLowerCase()) &&
                !def.description.toLowerCase().includes(catalogSearch.toLowerCase())
              ) {
                return null;
              }

              const isIncludedInSelectedTier = (PLAN_ENTITIES[selectedPlanTier] as readonly string[])?.includes(entityKey);

              return (
                <div
                  key={entityKey}
                  className={`rounded-xl border p-3.5 transition-all ${
                    isIncludedInSelectedTier
                      ? "border-zinc-200 bg-zinc-50/50 hover:bg-white hover:shadow-sm"
                      : "border-zinc-200/60 bg-zinc-100/40 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center justify-center rounded-md bg-zinc-200/80 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                      Step {idx + 1}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-400 truncate max-w-[120px]">
                      Sheet: {def.sheetName}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-zinc-900">{def.title}</h4>
                    {isIncludedInSelectedTier ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 shrink-0">
                        ✓ In {PLAN_TIER_DETAILS[selectedPlanTier].name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 shrink-0">
                        Requires Upgrade
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                    {def.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between border-t border-zinc-200/60 pt-2 text-[10px] text-zinc-400">
                    <span>{def.columns.length} columns</span>
                    <span className="text-zinc-600 font-medium">Group: {def.group}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 1: PREPARATION & DOWNLOAD */}
      {(step === "PREPARE" || step === "UPLOAD") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Blank Master Template for selected plan */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white">
                <FileSpreadsheet size={24} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900">1. Blank Template</h3>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                  {PLAN_TIER_DETAILS[selectedPlanTier].sheetCount} Worksheets
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Download the official <strong>{PLAN_TIER_DETAILS[selectedPlanTier].name}</strong> blank Excel workbook. Includes field validations, column tooltips, data dropdowns, human-readable headers, and empty entry rows ready for your school.
              </p>
              <ul className="text-xs text-zinc-600 space-y-1.5 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  {PLAN_TIER_DETAILS[selectedPlanTier].sheetCount} sheets tailored to your plan
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  Cell dropdowns & field validation rules
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  Leave optional operational sheets blank safely
                </li>
              </ul>
              <div className="pt-1 text-[11px] font-mono text-zinc-400 truncate">
                File: {PLAN_TIER_DETAILS[selectedPlanTier].blankFilename}
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => handleDownloadMasterTemplate(selectedPlanTier)}
                disabled={downloadingTemplate}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                {downloadingTemplate ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download {PLAN_TIER_DETAILS[selectedPlanTier].name} Blank Template (.xlsx)
              </button>
            </div>
          </div>

          {/* Card 2: Example Dataset for selected plan */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/20 p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Sparkles size={24} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900">2. Example Dataset</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {selectedPlanTier === "BASIC"
                    ? "100+ Students"
                    : selectedPlanTier === "PROFESSIONAL"
                    ? "250+ Students"
                    : "1,000+ Students"}
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Pre-populated workbook representing a real operational school with fictional Pakistani data matching the <strong>{PLAN_TIER_DETAILS[selectedPlanTier].name}</strong> feature tier.
              </p>
              <ul className="text-xs text-zinc-600 space-y-1.5 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  {selectedPlanTier === "ENTERPRISE"
                    ? "Main Campus & Model Town Branch"
                    : "Single Campus Operation"}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  100% interconnected fictional students & staff
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  {selectedPlanTier === "BASIC"
                    ? "Core Academic Setup & Enrollments"
                    : "Fee Challans, Exams & Staff Payroll"}
                </li>
              </ul>
              <div className="pt-1 text-[11px] font-mono text-zinc-400 truncate">
                File: {PLAN_TIER_DETAILS[selectedPlanTier].exampleFilename}
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => handleDownloadSample(selectedPlanTier)}
                disabled={downloadingSample}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-white px-4 py-2.5 text-xs font-bold text-emerald-700 shadow-sm hover:bg-emerald-50 disabled:opacity-50"
              >
                {downloadingSample ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download {PLAN_TIER_DETAILS[selectedPlanTier].name} Example Data (.xlsx)
              </button>
            </div>
          </div>

          {/* Card 3: Upload completed file */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Upload size={24} />
              </div>
              <h3 className="font-bold text-zinc-900">3. Upload Completed File</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Once your Excel workbook is populated, drop it below. The system reads all worksheets, validates fields, and checks references before any data is committed.
              </p>

              {/* Drag and drop target */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.[0]) {
                    void handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`mt-4 rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                  dragActive
                    ? "border-red-500 bg-red-50/50"
                    : "border-zinc-300 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-400"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      void handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <Upload size={24} className="mx-auto text-zinc-400 mb-2" />
                <p className="text-xs font-semibold text-zinc-700">
                  Drag & drop Excel workbook here
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Supports up to 25 MB (.xlsx, .xls)
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 border border-zinc-200 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                  Browse Files
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VERIFICATION */}
      {step === "PREVIEW" && job && (
        <div className="space-y-6">
          {/* Demonstration Notice Alert Banner */}
          {job.demoNotice && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-xs">
              <AlertTriangle size={20} className="shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold text-amber-950">Demonstration Dataset Detected</h4>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  {job.demoNotice}
                </p>
              </div>
            </div>
          )}

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-[11px] font-medium text-zinc-400">Total Rows</span>
              <p className="mt-1 text-2xl font-black text-zinc-900">{job.totalRows}</p>
              <span className="text-[10px] text-zinc-400">Across {job.sheets?.length || 1} sheets</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
              <span className="text-[11px] font-medium text-emerald-800">Valid Rows</span>
              <p className="mt-1 text-2xl font-black text-emerald-700">{job.validRows}</p>
              <span className="text-[10px] text-emerald-600">Ready to commit</span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
              <span className="text-[11px] font-medium text-amber-800">Duplicates Found</span>
              <p className="mt-1 text-2xl font-black text-amber-700">{job.duplicateRows}</p>
              <span className="text-[10px] text-amber-600">Will be safely handled</span>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-sm">
              <span className="text-[11px] font-medium text-red-800">Invalid Rows</span>
              <p className="mt-1 text-2xl font-black text-red-700">{job.invalidRows}</p>
              <span className="text-[10px] text-red-600">Need attention or skipped</span>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-[11px] font-medium text-zinc-400">Target Plan & File</span>
              <p className="mt-1 text-xs font-bold text-zinc-800 truncate" title={job.filename}>
                {job.filename}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-black uppercase text-zinc-700">
                  {job.planName || job.planTier || "ENTERPRISE"}
                </span>
                <span className="text-[10px] text-zinc-400">{job.sheets?.length || 0} sheets</span>
              </div>
            </div>
          </div>

          {/* Per-Sheet Cards Carousel/Grid */}
          {job.sheets && job.sheets.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-800 mb-3 flex items-center justify-between">
                <span>Worksheet Breakdown ({job.sheets.length} Active Sheets)</span>
                <span className="text-[11px] text-zinc-400 font-normal">
                  Click any sheet to filter rows table below
                </span>
              </h3>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                <button
                  onClick={() => setSelectedSheet("ALL")}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all border ${
                    selectedSheet === "ALL"
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                      : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                  }`}
                >
                  All Sheets ({job.totalRows})
                </button>
                {job.sheets.map((sh: any) => {
                  const isCurrent = selectedSheet === sh.sheet;
                  return (
                    <button
                      key={sh.sheet}
                      onClick={() => setSelectedSheet(sh.sheet)}
                      className={`shrink-0 rounded-xl px-3 py-2 text-left transition-all border ${
                        isCurrent
                          ? "bg-red-50 text-red-950 border-red-300 shadow-sm"
                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{sh.sheet}</span>
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-600">
                          {sh.total}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="text-emerald-600 font-medium">✓ {sh.valid}</span>
                        {sh.duplicate > 0 && <span className="text-amber-600">⚡ {sh.duplicate}</span>}
                        {sh.invalid > 0 && <span className="text-red-600">✗ {sh.invalid}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Staged Rows Table & Controls */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            {/* Filter Bar */}
            <div className="border-b border-zinc-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
                  <input
                    type="text"
                    value={rowSearch}
                    onChange={(e) => setRowSearch(e.target.value)}
                    placeholder="Search row values, keys, errors..."
                    className="w-full rounded-xl border border-zinc-200 pl-8 pr-3 py-1.5 text-xs focus:border-red-500 focus:outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 focus:border-red-500 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VALID">Valid Only</option>
                  <option value="DUPLICATE">Duplicates</option>
                  <option value="INVALID">Errors Only</option>
                </select>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                  />
                  Skip existing duplicates
                </label>

                <button
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={job.validRows === 0 && !skipDuplicates}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  Confirm & Execute Import
                </button>
              </div>
            </div>

            {/* Table */}
            <TableScroll>
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Sheet</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ref Key</th>
                    <th className="px-4 py-3">Details / Validation Message</th>
                    <th className="px-4 py-3">Staged Payload Fields</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredRows.slice(0, 100).map((r: StagedRow, idx: number) => {
                    const statusColor =
                      r.status === "VALID"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "DUPLICATE"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800";

                    return (
                      <tr key={`${r.sheet}-${r.rowNumber}-${idx}`} className="hover:bg-zinc-50/70">
                        <td className="px-4 py-2.5 font-mono text-zinc-500">#{r.rowNumber}</td>
                        <td className="px-4 py-2.5 font-bold text-zinc-800">{r.sheet}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-zinc-600 truncate max-w-[120px]">
                          {r.key || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600">
                          {r.message ? (
                            <span className="text-red-600 font-medium">{r.message}</span>
                          ) : (
                            <span className="text-zinc-400">Ready</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500 truncate max-w-[300px]">
                          {Object.entries(r.data || {})
                            .slice(0, 4)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" | ")}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">
                        No rows match the selected sheet and status filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroll>
            {filteredRows.length > 100 && (
              <div className="p-3 border-t border-zinc-200 bg-zinc-50 text-center text-xs text-zinc-500">
                Showing top 100 rows of {filteredRows.length}. All valid rows will be committed during import.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModalOpen && job && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">Confirm Universal School Import</h3>
                <p className="text-xs text-zinc-500">
                  Ready to import {job.validRows} records across {job.sheets?.length || 1} worksheets.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Target School:</span>
                <span className="font-bold text-zinc-800">{user?.school?.name || "Current School"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Valid Records to Create:</span>
                <span className="font-bold text-emerald-600">{job.validRows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Duplicate Handling:</span>
                <span className="font-bold text-zinc-800">
                  {skipDuplicates ? "Skip duplicates (safe idempotent mode)" : "Attempt overwrite"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Dependency Order:</span>
                <span className="font-bold text-zinc-800">Topological Graph (36 steps)</span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              This process executes in safe chunked background transactions. All existing data is preserved. Passwords are securely hashed and sealed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartImport}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Begin Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: EXECUTING MIGRATION */}
      {step === "EXECUTING" && job && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm max-w-2xl mx-auto text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <RefreshCw size={32} className="animate-spin text-red-600" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-zinc-900">
              Importing School Data in Dependency Order
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Please do not close this browser tab. Records are being validated, foreign keys resolved, and stored in atomic batches.
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
              <span>Current Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-red-600 transition-all duration-500"
                style={{ width: `${Math.max(5, job.progress || 0)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-left">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <span className="text-[10px] text-zinc-400 font-medium">Processed</span>
              <p className="text-lg font-bold text-zinc-800">{job.processedRows} / {job.totalRows}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
              <span className="text-[10px] text-emerald-700 font-medium">Successfully Created</span>
              <p className="text-lg font-bold text-emerald-700">{job.successRows}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
              <span className="text-[10px] text-red-700 font-medium">Errors / Skipped</span>
              <p className="text-lg font-bold text-red-700">{job.errorRows}</p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: COMPLETED SUMMARY */}
      {step === "COMPLETED" && job && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-8 shadow-sm text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-zinc-900">
                School Import Completed Successfully!
              </h3>
              <p className="text-xs text-zinc-600 max-w-lg mx-auto mt-1">
                Your school records have been created and linked across all Acadivo portals. Students, parents, staff, fee challans, and academic configurations are immediately operational.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {(job.errorRows || 0) > 0 && (
                <button
                  onClick={() => handleDownloadErrors()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 shadow-sm"
                >
                  <Download size={14} />
                  Download Error Report ({job.errorRows} failed)
                </button>
              )}
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 shadow-sm"
              >
                <RefreshCw size={14} />
                Start Another Import
              </button>
            </div>
          </div>

          {/* Verification Links to All Modules */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" />
              Verify Imported Data Across Acadivo Portals
            </h3>
            <p className="text-xs text-zinc-500">
              Select any portal section below to inspect the newly imported live records:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link
                href="/school-admin/students"
                className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 hover:border-red-400 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900">Students Directory</h4>
                    <span className="text-[10px] text-zinc-400">Profiles, Guardians, Admissions</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-zinc-400 group-hover:text-red-600 transition-colors" />
              </Link>

              <Link
                href="/school-admin/teachers"
                className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 hover:border-red-400 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Users size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900">Teachers & Staff</h4>
                    <span className="text-[10px] text-zinc-400">Faculty, Roles, Assignments</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-zinc-400 group-hover:text-blue-600 transition-colors" />
              </Link>

              <Link
                href="/school-admin/academics/classes"
                className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 hover:border-red-400 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900">Academics Setup</h4>
                    <span className="text-[10px] text-zinc-400">Classes, Sections, Subjects</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-zinc-400 group-hover:text-emerald-600 transition-colors" />
              </Link>

              <Link
                href="/school-admin/finance/challans"
                className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 hover:border-red-400 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Coins size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900">Finance & Challans</h4>
                    <span className="text-[10px] text-zinc-400">Structures, Challans, Payments</span>
                  </div>
                </div>
                <ArrowRight size={14} className="text-zinc-400 group-hover:text-amber-600 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
