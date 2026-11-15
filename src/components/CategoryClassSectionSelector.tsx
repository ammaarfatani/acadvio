"use client";

import { useMemo } from "react";
import { FolderTree, GraduationCap, Layers } from "lucide-react";

export interface CategoryOption {
  _id: string;
  name: string;
  status?: string;
  displayOrder?: number;
}

export interface ClassOption {
  _id: string;
  name: string;
  code?: string;
  classCategoryId?: string | { _id: string; name: string };
  classCategoryName?: string;
}

export interface SectionOption {
  _id: string;
  name: string;
  classId: string | { _id: string };
}

export interface CategoryClassSectionSelectorProps {
  categories: CategoryOption[];
  classes: ClassOption[];
  sections?: SectionOption[];
  selectedCategory?: string;
  selectedClass?: string;
  selectedSection?: string;
  onCategoryChange: (categoryId: string) => void;
  onClassChange: (classId: string) => void;
  onSectionChange?: (sectionId: string) => void;
  showAllOption?: boolean;
  allCategoryLabel?: string;
  allClassLabel?: string;
  allSectionLabel?: string;
  categoryLabel?: string;
  classLabel?: string;
  sectionLabel?: string;
  disabled?: boolean;
  required?: boolean;
  layout?: "grid" | "stacked" | "inline";
  className?: string;
}

export function CategoryClassSectionSelector({
  categories,
  classes,
  sections = [],
  selectedCategory = "",
  selectedClass = "",
  selectedSection = "",
  onCategoryChange,
  onClassChange,
  onSectionChange,
  showAllOption = false,
  allCategoryLabel = "All Categories",
  allClassLabel = "All Classes",
  allSectionLabel = "All Sections",
  categoryLabel = "Class Category",
  classLabel = "Class",
  sectionLabel = "Section",
  disabled = false,
  required = false,
  layout = "grid",
  className = "",
}: CategoryClassSectionSelectorProps) {
  // Filter classes based on selectedCategory (if selected and not empty/ALL)
  const filteredClasses = useMemo(() => {
    if (!selectedCategory || selectedCategory === "ALL") {
      return classes;
    }
    return classes.filter((cls) => {
      const catId = typeof cls.classCategoryId === "object" ? cls.classCategoryId?._id : cls.classCategoryId;
      return String(catId) === String(selectedCategory);
    });
  }, [classes, selectedCategory]);

  // Filter sections based on selectedClass
  const filteredSections = useMemo(() => {
    if (!selectedClass || selectedClass === "ALL") {
      return [];
    }
    return sections.filter((sec) => {
      const clsId = typeof sec.classId === "object" ? sec.classId?._id : sec.classId;
      return String(clsId) === String(selectedClass);
    });
  }, [sections, selectedClass]);

  const handleCategorySelect = (categoryId: string) => {
    onCategoryChange(categoryId);
    // If current selected class is not in the filtered classes of new category, reset class and section
    if (categoryId && categoryId !== "ALL" && selectedClass) {
      const isClassInCategory = classes.some((cls) => {
        const catId = typeof cls.classCategoryId === "object" ? cls.classCategoryId?._id : cls.classCategoryId;
        return String(cls._id) === String(selectedClass) && String(catId) === String(categoryId);
      });
      if (!isClassInCategory) {
        onClassChange("");
        if (onSectionChange) onSectionChange("");
      }
    }
  };

  const handleClassSelect = (classId: string) => {
    onClassChange(classId);
    if (onSectionChange) onSectionChange("");

    // Automatically synchronize category if not set
    if (classId && !selectedCategory) {
      const matched = classes.find((c) => String(c._id) === String(classId));
      if (matched) {
        const catId = typeof matched.classCategoryId === "object" ? matched.classCategoryId?._id : matched.classCategoryId;
        if (catId) {
          onCategoryChange(String(catId));
        }
      }
    }
  };

  const fieldStyles =
    "w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 focus:outline-none focus:border-red-600 focus:bg-white disabled:opacity-50 transition-colors";

  if (layout === "inline") {
    return (
      <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
        {/* Category Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-zinc-500 shrink-0">{categoryLabel}:</span>
          <select
            value={selectedCategory}
            onChange={(e) => handleCategorySelect(e.target.value)}
            disabled={disabled}
            className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
          >
            {showAllOption && <option value="ALL">{allCategoryLabel}</option>}
            {!showAllOption && <option value="">Select Category</option>}
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Class Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-zinc-500 shrink-0">{classLabel}:</span>
          <select
            value={selectedClass}
            onChange={(e) => handleClassSelect(e.target.value)}
            disabled={disabled}
            className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
          >
            {showAllOption && <option value="ALL">{allClassLabel}</option>}
            {!showAllOption && <option value="">Select Class</option>}
            {filteredClasses.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Section Dropdown */}
        {onSectionChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-500 shrink-0">{sectionLabel}:</span>
            <select
              value={selectedSection}
              onChange={(e) => onSectionChange(e.target.value)}
              disabled={disabled || !selectedClass || selectedClass === "ALL"}
              className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800"
            >
              {showAllOption && <option value="ALL">{allSectionLabel}</option>}
              {!showAllOption && (
                <option value="">{selectedClass ? "Select Section" : "Select Class First"}</option>
              )}
              {filteredSections.map((sec) => (
                <option key={sec._id} value={sec._id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 ${onSectionChange ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3 ${className}`}>
      {/* Category */}
      <div className="space-y-1">
        <label className="block text-xs font-bold text-zinc-800 flex items-center gap-1.5">
          <FolderTree className="w-3.5 h-3.5 text-zinc-400" />
          <span>{categoryLabel}</span>
          {required && <span className="text-red-600">*</span>}
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => handleCategorySelect(e.target.value)}
          disabled={disabled}
          required={required}
          className={fieldStyles}
        >
          {showAllOption ? (
            <option value="ALL">{allCategoryLabel}</option>
          ) : (
            <option value="">Select Category</option>
          )}
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Class */}
      <div className="space-y-1">
        <label className="block text-xs font-bold text-zinc-800 flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
          <span>{classLabel}</span>
          {required && <span className="text-red-600">*</span>}
        </label>
        <select
          value={selectedClass}
          onChange={(e) => handleClassSelect(e.target.value)}
          disabled={disabled}
          required={required}
          className={fieldStyles}
        >
          {showAllOption ? (
            <option value="ALL">{allClassLabel}</option>
          ) : (
            <option value="">Select Class</option>
          )}
          {filteredClasses.map((cls) => (
            <option key={cls._id} value={cls._id}>
              {cls.name} {cls.classCategoryName ? `(${cls.classCategoryName})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Section */}
      {onSectionChange && (
        <div className="space-y-1">
          <label className="block text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>{sectionLabel}</span>
            {required && <span className="text-red-600">*</span>}
          </label>
          <select
            value={selectedSection}
            onChange={(e) => onSectionChange(e.target.value)}
            disabled={disabled || !selectedClass || selectedClass === "ALL"}
            required={required}
            className={fieldStyles}
          >
            {showAllOption ? (
              <option value="ALL">{allSectionLabel}</option>
            ) : (
              <option value="">
                {selectedClass && selectedClass !== "ALL" ? "Select Section" : "Select Class First"}
              </option>
            )}
            {filteredSections.map((sec) => (
              <option key={sec._id} value={sec._id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
