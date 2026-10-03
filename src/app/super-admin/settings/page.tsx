"use client";

import { useState } from "react";
import { Settings, ShieldCheck, Save, Clock, Sliders, Building2, CheckCircle2 } from "lucide-react";

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState({
    platformName: "Acadivo",
    companyName: "AKTech Digital Solutions",
    defaultTrialDays: 14,
    supportEmail: "hello@aktech.tech",
    corporateEmail: "hello@aktech.tech",
    defaultCurrency: "PKR",
    autoApprovalEnabled: false,
    requireAdminEmailVerification: true,
  });

  const [savedNotice, setSavedNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl">
      
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
          Global Platform Settings
        </h1>
        <p className="text-xs text-zinc-500">Configure default trial rules, company branding, and security parameters</p>
      </div>

      {savedNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Global platform configuration saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Platform Branding */}
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-2">
            <Building2 className="w-5 h-5 text-red-600" />
            Product & Entity Branding
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">Product SaaS Name</label>
              <input
                type="text"
                value={settings.platformName}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">Developer Company Entity</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">Public Support Email</label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">Corporate Contact Email</label>
              <input
                type="email"
                value={settings.corporateEmail}
                onChange={(e) => setSettings({ ...settings, corporateEmail: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Trial & Billing Defaults */}
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-2">
            <Clock className="w-5 h-5 text-red-600" />
            Trial & Subscription Defaults
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">Default Trial Duration (Days)</label>
              <input
                type="number"
                value={settings.defaultTrialDays}
                onChange={(e) => setSettings({ ...settings, defaultTrialDays: parseInt(e.target.value, 10) || 14 })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">Default Billing Currency</label>
              <input
                type="text"
                disabled
                value={settings.defaultCurrency}
                className="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-medium font-mono text-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Security Policies */}
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            Platform Security & Approval Policies
          </h3>

          <div className="space-y-3 text-xs text-zinc-800">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.autoApprovalEnabled}
                onChange={(e) => setSettings({ ...settings, autoApprovalEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-600"
              />
              <div>
                <div className="font-bold">Auto-Approve Trial Applications</div>
                <div className="text-[11px] text-zinc-500">Automatically activate 14-day trials without manual Super Admin review (Not Recommended)</div>
              </div>
            </label>

            <label className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                checked={settings.requireAdminEmailVerification}
                onChange={(e) => setSettings({ ...settings, requireAdminEmailVerification: e.target.checked })}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-600"
              />
              <div>
                <div className="font-bold">Require Email Verification for School Admins</div>
                <div className="text-[11px] text-zinc-500">Enforce email verification before full school portal access</div>
              </div>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Global Platform Settings</span>
          </button>
        </div>

      </form>

    </div>
  );
}

