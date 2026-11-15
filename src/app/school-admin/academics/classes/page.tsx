"use client";

import { WorkspaceDialog, workspacePrimary } from "@/components/WorkspaceDialog";
import { RecordFilters, matchesRecordSearch } from "@/components/RecordFilters";
import { useCallback, useEffect, useState } from "react";
import {
  GraduationCap,
  Plus,
  BookOpen,
  Layers,
  Info,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FolderTree,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";
import { BulkImportModal } from "@/components/BulkImportModal";

export default function ClassesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Class state
  const [classes, setClasses] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [numericLevel, setNumericLevel] = useState("1");
  const [classCategoryId, setClassCategoryId] = useState("");

  // Edit class state
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editNumericLevel, setEditNumericLevel] = useState("1");
  const [editClassCategoryId, setEditClassCategoryId] = useState("");

  // Category state
  const [categories, setCategories] = useState<any[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState("ALL");
  const [categoryModalMode, setCategoryModalMode] = useState<"LIST" | "CREATE" | "EDIT">("LIST");
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catOrder, setCatOrder] = useState("0");
  const [catStatus, setCatStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Inline category create within Add/Edit Class modal
  const [showQuickCreateCategory, setShowQuickCreateCategory] = useState(false);
  const [quickCatName, setQuickCatName] = useState("");
  const [quickCatSaving, setQuickCatSaving] = useState(false);

  // Bulk assign state
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [bulkTargetCategoryId, setBulkTargetCategoryId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Filtering & UI state
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load Classes & Categories
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, catRes] = await Promise.all([
        schoolAdminApi.getClasses(),
        schoolAdminApi.getClassCategories(),
      ]);
      setClasses(classRes?.data || []);
      setCategories(catRes?.data || []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Could not load academic classes or categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Handle Class Creation
  const submitCreateClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!classCategoryId) {
      setError("Please select a Class Category for this class.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolAdminApi.createClass({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        numericLevel: Number(numericLevel) || 1,
        classCategoryId: classCategoryId || undefined,
      });
      setName("");
      setCode("");
      setNumericLevel("1");
      setClassCategoryId("");
      setNotice(`Class '${name}' created successfully.`);
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not create academic class.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Class Update
  const submitUpdateClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingClass) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await schoolAdminApi.updateClass(editingClass._id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        numericLevel: Number(editNumericLevel) || 1,
        classCategoryId: editClassCategoryId || null,
      });
      setNotice(`Class '${editName}' updated successfully.`);
      setEditingClass(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not update academic class.");
    } finally {
      setSaving(false);
    }
  };

  // Quick inline category creation
  const handleQuickCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCatName.trim()) return;
    setQuickCatSaving(true);
    setError("");
    try {
      const res = await schoolAdminApi.createClassCategory({
        name: quickCatName.trim(),
        status: "ACTIVE",
      });
      const created = res.data;
      setCategories((prev) => [...prev, created]);
      setClassCategoryId(created._id);
      if (editingClass) setEditClassCategoryId(created._id);
      setQuickCatName("");
      setShowQuickCreateCategory(false);
      setNotice(`Category '${created.name}' created and selected.`);
    } catch (e: any) {
      setError(e?.message || "Could not create class category.");
    } finally {
      setQuickCatSaving(false);
    }
  };

  // Handle Category Creation in Manage Categories dialog
  const submitCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await schoolAdminApi.createClassCategory({
        name: catName.trim(),
        description: catDesc.trim(),
        displayOrder: Number(catOrder) || 0,
        status: catStatus,
      });
      setCatName("");
      setCatDesc("");
      setCatOrder("0");
      setCatStatus("ACTIVE");
      setCategoryModalMode("LIST");
      setNotice(`Category '${catName}' created successfully.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not create class category.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Category Update
  const submitUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSaving(true);
    setError("");
    try {
      await schoolAdminApi.updateClassCategory(editingCategory._id, {
        name: catName.trim(),
        description: catDesc.trim(),
        displayOrder: Number(catOrder) || 0,
        status: catStatus,
      });
      setEditingCategory(null);
      setCategoryModalMode("LIST");
      setNotice(`Category '${catName}' updated successfully.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not update class category.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Category Deletion
  const handleDeleteCategory = async (cat: any) => {
    if (cat.classCount > 0) {
      setError(`Cannot delete '${cat.name}' because ${cat.classCount} class(es) belong to it. Reassign those classes first.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete category '${cat.name}'?`)) return;
    setSaving(true);
    setError("");
    try {
      await schoolAdminApi.deleteClassCategory(cat._id);
      setNotice(`Category '${cat.name}' deleted successfully.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not delete class category.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Category Status Toggle
  const toggleCategoryStatus = async (cat: any) => {
    setSaving(true);
    setError("");
    const newStatus = cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await schoolAdminApi.updateClassCategory(cat._id, { status: newStatus });
      setNotice(`Category '${cat.name}' set to ${newStatus}.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not update category status.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Bulk Assign
  const handleBulkAssign = async () => {
    if (selectedClassIds.length === 0 || !bulkTargetCategoryId) {
      setError("Please select at least one class and a target category.");
      return;
    }
    setBulkSaving(true);
    setError("");
    try {
      await schoolAdminApi.bulkAssignCategoryToClasses({
        classIds: selectedClassIds,
        classCategoryId: bulkTargetCategoryId,
      });
      const targetCat = categories.find((c) => c._id === bulkTargetCategoryId);
      setNotice(`Successfully assigned category '${targetCat?.name || "Selected"}' to ${selectedClassIds.length} class(es).`);
      setSelectedClassIds([]);
      setBulkTargetCategoryId("");
      setShowBulkAssign(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Could not assign category to selected classes.");
    } finally {
      setBulkSaving(false);
    }
  };

  // Filtered categories for management modal
  const filteredCategories = categories.filter((cat) => {
    if (categoryStatusFilter !== "ALL" && cat.status !== categoryStatusFilter) return false;
    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase();
      return cat.name.toLowerCase().includes(q) || (cat.description && cat.description.toLowerCase().includes(q));
    }
    return true;
  });

  // Filtered classes for main directory
  const filteredClasses = classes.filter((c) => {
    if (!matchesRecordSearch([c.name, c.code, c.numericLevel, c.classCategoryName], query)) return false;
    if (filterCategory !== "ALL") {
      if (filterCategory === "UNCATEGORIZED") {
        return !c.classCategoryId && !c.classCategoryName;
      }
      const catId = typeof c.classCategoryId === "object" ? c.classCategoryId?._id : c.classCategoryId;
      return String(catId) === filterCategory || c.classCategoryName === filterCategory;
    }
    return true;
  });

  const uncategorizedCount = classes.filter((c) => !c.classCategoryId && !c.classCategoryName).length;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {bulkOpen && (
        <BulkImportModal
          entity="classes"
          onClose={() => setBulkOpen(false)}
          onImported={load}
        />
      )}

      {/* Page Header */}
      <div className="border-b border-zinc-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-red-600" />
            Class Management & Academic Levels
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure school classes, academic levels, custom categories, and section structures
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-700">
            Total Classes: {classes.length}
          </span>
          <span className="text-xs font-bold px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-red-700">
            Categories: {categories.length}
          </span>
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice("")} className="text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Migration Notice Banner for Existing Classes without Categories */}
      {uncategorizedCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950">
                {uncategorizedCount} existing class{uncategorizedCount > 1 ? "es" : ""} need category assignment
              </h4>
              <p className="text-[11px] text-amber-800">
                Assign categories to organize students, reports, challans, marksheets, and timetable registers into Primary, Middle, Secondary, or custom tiers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const uncategorizedIds = classes.filter((c) => !c.classCategoryId && !c.classCategoryName).map((c) => c._id);
              setSelectedClassIds(uncategorizedIds);
              setShowBulkAssign(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs"
          >
            <FolderTree size={14} />
            Bulk Assign Categories
          </button>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Browse academic classes below or manage custom categories and levels.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Manage Categories Action */}
          <button
            type="button"
            onClick={() => {
              setCategoryModalMode("LIST");
              setShowManageCategories(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50 transition-colors"
          >
            <FolderTree size={15} className="text-red-600" />
            Manage Categories
            <span className="ml-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 border border-zinc-200">
              {categories.length}
            </span>
          </button>

          {/* Bulk Assign Category */}
          <button
            type="button"
            onClick={() => {
              setSelectedClassIds([]);
              setShowBulkAssign(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50 transition-colors"
          >
            <Layers size={15} className="text-indigo-600" />
            Bulk Assign Category
          </button>

          {/* Bulk Upload Modal */}
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50 transition-colors"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            Bulk Upload
          </button>

          {/* Add Class */}
          <button
            className={workspacePrimary}
            onClick={() => {
              setName("");
              setCode("");
              setNumericLevel("1");
              setClassCategoryId(categories.find((c) => c.status === "ACTIVE")?._id || "");
              setShowCreate(true);
            }}
          >
            <Plus size={15} />
            Add class
          </button>
        </div>
      </div>

      {/* FILTER BAR WITH CATEGORY SELECTOR */}
      <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search classes, codes, ranks or categories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-red-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-zinc-500 shrink-0">Filter by Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:border-red-600"
          >
            <option value="ALL">All Categories ({classes.length})</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name} ({cat.classCount || 0})
              </option>
            ))}
            {uncategorizedCount > 0 && (
              <option value="UNCATEGORIZED">Uncategorized Classes ({uncategorizedCount})</option>
            )}
          </select>
        </div>
      </div>

      {/* CLASS DIRECTORY GRID */}
      {loading ? (
        <div className="p-8 text-center text-xs font-bold text-zinc-400 animate-pulse">
          Loading academic classes directory…
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-zinc-300 mx-auto" />
          <h3 className="text-base font-bold text-zinc-900">No Academic Classes Configured</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Create your first academic class above to begin organizing sections and student enrollments.
          </p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-2">
          <p className="text-xs font-bold text-zinc-600">No classes match your current search or category filter.</p>
          <button
            onClick={() => {
              setQuery("");
              setFilterCategory("ALL");
            }}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map((cls) => {
            const cat = categories.find(
              (c) =>
                c._id === cls.classCategoryId ||
                (typeof cls.classCategoryId === "object" && c._id === cls.classCategoryId?._id)
            );
            const categoryDisplayName = cat?.name || cls.classCategoryName;

            return (
              <div
                key={cls._id}
                className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs hover:border-zinc-300 transition-all space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-zinc-950">{cls.name}</h2>
                        {categoryDisplayName ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            {categoryDisplayName}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            No Category
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">Code: {cls.code}</span>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200 font-mono shrink-0">
                      Level {cls.numericLevel || 1}
                    </span>
                  </div>

                  <div className="pt-3 mt-3 border-t border-zinc-100 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Class Category:</span>
                      <span className="font-bold text-zinc-900">
                        {categoryDisplayName || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Designated Class Teacher:</span>
                      <span className="font-bold text-zinc-900">{cls.classTeacherName || "Section specific"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClass(cls);
                      setEditName(cls.name);
                      setEditCode(cls.code);
                      setEditNumericLevel(String(cls.numericLevel || 1));
                      const catId = typeof cls.classCategoryId === "object" ? cls.classCategoryId?._id : cls.classCategoryId;
                      setEditClassCategoryId(catId || "");
                    }}
                    className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Edit class"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Are you sure you want to delete class '${cls.name}'?`)) return;
                      setSaving(true);
                      setError("");
                      try {
                        await schoolAdminApi.deleteClass(cls._id);
                        setNotice(`Class '${cls.name}' deleted successfully.`);
                        await load();
                      } catch (e: any) {
                        setError(e?.message || "Could not delete class.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors"
                    title="Delete class"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD CLASS MODAL */}
      {showCreate && (
        <WorkspaceDialog
          title="Add Academic Class"
          description="Create the academic grade level, configure its class category, and set its rank tier."
          busy={saving}
          onClose={() => setShowCreate(false)}
          wide
        >
          {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <form onSubmit={submitCreateClass} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Class Name */}
              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">Class Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!code) setCode(e.target.value.toUpperCase().replace(/\s+/g, ""));
                  }}
                  placeholder="e.g. Grade 10, Class 2, Matric Science"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-medium focus:outline-none focus:border-red-600"
                />
                <p className="text-[10px] text-zinc-500">Official name shown on transcripts & rosters (e.g. Grade 2).</p>
              </div>

              {/* Class Code */}
              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">Class Code *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. G2 or MAT-10"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-mono uppercase focus:outline-none focus:border-red-600"
                />
                <p className="text-[10px] text-zinc-500">Unique short code used in reporting (e.g. G2).</p>
              </div>

              {/* Class Category (Required) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-zinc-800 flex items-center gap-1">
                    <FolderTree size={13} className="text-red-600" />
                    Class Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCreateCategory(!showQuickCreateCategory)}
                    className="text-[11px] font-bold text-red-600 hover:underline"
                  >
                    + Add New Category
                  </button>
                </div>

                <select
                  required
                  value={classCategoryId}
                  onChange={(e) => setClassCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-semibold text-zinc-800 focus:outline-none focus:border-red-600"
                >
                  <option value="">-- Select Category --</option>
                  {categories
                    .filter((c) => c.status === "ACTIVE")
                    .map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-zinc-500">
                  Select whether this class belongs to Primary, Middle, Secondary, or custom category.
                </p>

                {/* Inline Quick Category Creator */}
                {showQuickCreateCategory && (
                  <div className="mt-2 p-3 bg-red-50/60 border border-red-200 rounded-xl space-y-2">
                    <span className="text-[11px] font-bold text-red-900 block">Quick Create Category:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Montessori, O Levels, A Levels"
                        value={quickCatName}
                        onChange={(e) => setQuickCatName(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-red-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        disabled={quickCatSaving || !quickCatName.trim()}
                        onClick={handleQuickCreateCategory}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                      >
                        {quickCatSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickCreateCategory(false)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-800"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Academic Level */}
              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">Academic Level / Rank Tier *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="20"
                  value={numericLevel}
                  onChange={(e) => setNumericLevel(e.target.value)}
                  placeholder="e.g. 2"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-mono focus:outline-none focus:border-red-600"
                />
                <p className="text-[10px] text-zinc-500">Integer sorting level for school rank ordering (e.g. 2).</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? "Creating Class…" : "Create Academic Class"}
              </button>
            </div>
          </form>
        </WorkspaceDialog>
      )}

      {/* EDIT CLASS MODAL */}
      {editingClass && (
        <WorkspaceDialog
          title={`Edit Class: ${editingClass.name}`}
          description="Update class name, code, rank order, and reassign its category."
          busy={saving}
          onClose={() => setEditingClass(null)}
          wide
        >
          {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <form onSubmit={submitUpdateClass} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">Class Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-medium focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">Class Code *</label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-mono uppercase focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">Class Category</label>
                <select
                  value={editClassCategoryId}
                  onChange={(e) => setEditClassCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-semibold text-zinc-800 focus:outline-none focus:border-red-600"
                >
                  <option value="">-- No Category Assigned --</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name} {cat.status === "INACTIVE" ? "(Inactive)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500">Reassigning category propagates to enrolled student transcripts.</p>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-zinc-800">Academic Level / Rank Tier *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="20"
                  value={editNumericLevel}
                  onChange={(e) => setEditNumericLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-mono focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="px-4 py-2 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? "Saving Changes…" : "Update Class"}
              </button>
            </div>
          </form>
        </WorkspaceDialog>
      )}

      {/* MANAGE CATEGORIES MODAL */}
      {showManageCategories && (
        <WorkspaceDialog
          title="Class Category Management"
          description="Create and organize academic categories (Primary, Secondary, O Levels, etc.). Assign categories to classes for unified reporting."
          busy={saving}
          onClose={() => {
            setShowManageCategories(false);
            setCategoryModalMode("LIST");
            setEditingCategory(null);
          }}
          wide
        >
          {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

          {/* Sub-header Navigation */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryModalMode("LIST");
                  setEditingCategory(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  categoryModalMode === "LIST"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                All Categories ({categories.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCatName("");
                  setCatDesc("");
                  setCatOrder(String(categories.length + 1));
                  setCatStatus("ACTIVE");
                  setCategoryModalMode("CREATE");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                  categoryModalMode === "CREATE"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                }`}
              >
                <Plus size={13} />
                New Category
              </button>
            </div>

            {categoryModalMode === "LIST" && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs w-44 focus:outline-none focus:border-red-600"
                />
                <select
                  value={categoryStatusFilter}
                  onChange={(e) => setCategoryStatusFilter(e.target.value)}
                  className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            )}
          </div>

          {/* Category List View */}
          {categoryModalMode === "LIST" && (
            <div className="space-y-3">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs">
                  No categories found. Click &quot;New Category&quot; to define your school&apos;s academic tiers.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                  {filteredCategories.map((cat) => (
                    <div
                      key={cat._id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/70 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-zinc-900">{cat.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cat.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                            }`}
                          >
                            {cat.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-zinc-100 text-zinc-600 border border-zinc-200">
                            {cat.classCount || 0} class{(cat.classCount || 0) === 1 ? "" : "es"}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-zinc-500">{cat.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status Toggle */}
                        <button
                          type="button"
                          onClick={() => toggleCategoryStatus(cat)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700"
                        >
                          {cat.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setCatName(cat.name);
                            setCatDesc(cat.description || "");
                            setCatOrder(String(cat.displayOrder || 0));
                            setCatStatus(cat.status || "ACTIVE");
                            setCategoryModalMode("EDIT");
                          }}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg"
                          title="Edit category"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Safe Delete */}
                        <button
                          type="button"
                          disabled={cat.classCount > 0}
                          onClick={() => handleDeleteCategory(cat)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            cat.classCount > 0
                              ? "text-zinc-300 cursor-not-allowed"
                              : "text-red-600 hover:text-red-700 hover:bg-red-50"
                          }`}
                          title={cat.classCount > 0 ? "Cannot delete category while classes are assigned" : "Delete category"}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category Create / Edit Form */}
          {(categoryModalMode === "CREATE" || categoryModalMode === "EDIT") && (
            <form onSubmit={categoryModalMode === "CREATE" ? submitCreateCategory : submitUpdateCategory} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-zinc-800">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Primary, Secondary, Montessori, O Levels"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-medium focus:outline-none focus:border-red-600"
                  />
                  <p className="text-[10px] text-zinc-500">Custom category name defined by your school.</p>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-zinc-800">Display Order</label>
                  <input
                    type="number"
                    min="0"
                    value={catOrder}
                    onChange={(e) => setCatOrder(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-mono focus:outline-none focus:border-red-600"
                  />
                  <p className="text-[10px] text-zinc-500">Numerical order for dropdown sorting.</p>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-bold text-zinc-800">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    placeholder="e.g. Foundational primary education grade 1 through grade 5."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:border-red-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-zinc-800">Status</label>
                  <select
                    value={catStatus}
                    onChange={(e) => setCatStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-semibold text-zinc-800"
                  >
                    <option value="ACTIVE">Active (Available for classes)</option>
                    <option value="INACTIVE">Inactive (Archived)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setCategoryModalMode("LIST")}
                  className="px-4 py-2 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Back to List
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : categoryModalMode === "CREATE" ? "Create Category" : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </WorkspaceDialog>
      )}

      {/* BULK ASSIGN CATEGORY MODAL */}
      {showBulkAssign && (
        <WorkspaceDialog
          title="Bulk Assign Category to Classes"
          description="Select multiple classes and assign them to an academic category in one click. Perfect for migrating existing classes."
          busy={bulkSaving}
          onClose={() => setShowBulkAssign(false)}
          wide
        >
          {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div className="space-y-4 text-xs">
            {/* Target Category Selection */}
            <div className="space-y-1">
              <label className="block font-bold text-zinc-800">Target Category *</label>
              <select
                value={bulkTargetCategoryId}
                onChange={(e) => setBulkTargetCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-800 focus:outline-none focus:border-red-600"
              >
                <option value="">-- Choose Category to Assign --</option>
                {categories
                  .filter((c) => c.status === "ACTIVE")
                  .map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name} ({cat.classCount || 0} classes currently)
                    </option>
                  ))}
              </select>
            </div>

            {/* Class Checkbox List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-800">
                  Select Classes ({selectedClassIds.length} of {classes.length} selected):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedClassIds(classes.map((c) => c._id))}
                    className="text-[11px] font-bold text-red-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedClassIds([])}
                    className="text-[11px] font-bold text-zinc-500 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-zinc-200 rounded-xl divide-y divide-zinc-100 bg-zinc-50/50 p-2">
                {classes.map((cls) => {
                  const isChecked = selectedClassIds.includes(cls._id);
                  const currentCategoryName = cls.classCategoryName;

                  return (
                    <label
                      key={cls._id}
                      className="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClassIds((prev) => [...prev, cls._id]);
                            } else {
                              setSelectedClassIds((prev) => prev.filter((id) => id !== cls._id));
                            }
                          }}
                          className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="font-bold text-zinc-900">{cls.name}</span>
                        <span className="text-[10px] font-mono text-zinc-400">({cls.code})</span>
                      </div>

                      <div>
                        {currentCategoryName ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                            Current: {currentCategoryName}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            No Category
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowBulkAssign(false)}
                className="px-4 py-2 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkSaving || selectedClassIds.length === 0 || !bulkTargetCategoryId}
                onClick={handleBulkAssign}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {bulkSaving ? "Assigning…" : `Assign to ${selectedClassIds.length} Class(es)`}
              </button>
            </div>
          </div>
        </WorkspaceDialog>
      )}
    </div>
  );
}
