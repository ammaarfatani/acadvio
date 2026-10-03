"use client";

import { useState } from "react";
import { Settings, Palette, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function ExamStaffSettingsPage() {
  const { user, setUser } = useAuth();
  const currentTheme = user?.school?.theme || "theme-red";

  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState("");

  const themeOptions = [
    { code: "theme-red", name: "Crimson Red (Default)", colorBg: "bg-red-600" },
    { code: "theme-blue", name: "Royal Blue", colorBg: "bg-blue-600" },
    { code: "theme-green", name: "Emerald Green", colorBg: "bg-emerald-600" },
    { code: "theme-purple", name: "Violet Purple", colorBg: "bg-purple-600" },
    { code: "theme-amber", name: "Warm Amber", colorBg: "bg-amber-600" },
  ];

  const handleSaveTheme = async (themeCode: string) => {
    setSelectedTheme(themeCode);
    setSaving(true);
    setError("");
    try {
      await schoolAdminApi.updateSchoolBranding({ theme: themeCode as any });
      if (user && user.school) {
        setUser({
          ...user,
          school: {
            ...user.school,
            theme: themeCode,
          },
        });
      }
      setNotice("Portal color theme updated successfully!");
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setError(err?.message || "Unable to save theme preference.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
          <Settings className="h-6 w-6 text-school-primary" />
          Examination Portal Settings & Theme Customization
        </h1>
        <p className="text-xs text-zinc-500">
          Customize the visual color theme and interface preferences across the examination department portal.
        </p>
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

      {/* Theme Picker Card */}
      <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-5">
        <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-3">
          <Palette className="h-4 w-4 text-school-primary" />
          Select Accent Color Theme
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themeOptions.map((th) => {
            const isSelected = selectedTheme === th.code;
            return (
              <button
                key={th.code}
                onClick={() => handleSaveTheme(th.code)}
                disabled={saving}
                className={`p-4 rounded-xl border text-left flex items-center justify-between gap-3 transition-all ${
                  isSelected
                    ? "border-school-primary bg-school-primary/5 ring-2 ring-school-primary/30"
                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${th.colorBg} shrink-0 shadow-xs`} />
                  <div>
                    <h3 className="font-bold text-xs text-zinc-950">{th.name}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">{th.code}</p>
                  </div>
                </div>

                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-school-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
