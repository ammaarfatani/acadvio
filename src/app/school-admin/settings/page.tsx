"use client";



import { useState, useEffect } from "react";
import { Settings, Save, Building2, ShieldCheck, CheckCircle2, DollarSign, Calendar } from "lucide-react";
import Link from "next/link";
import SchoolLogoEditor from "@/components/SchoolLogoEditor";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function SchoolSettingsPage() {
  const { refreshUser,user } = useAuth();
  const financeEnabled=!!user?.features?.includes("FINANCE");
  const [profile, setProfile] = useState<any>({ currency: "PKR", dateFormat: "DD/MM/YYYY", bankDetails: {} });

  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await schoolAdminApi.getSchoolProfile();
        if (res?.data) {
          setProfile({
            ...res.data,
            currency: res.data.currency || "PKR",
            dateFormat: res.data.dateFormat || "DD/MM/YYYY",
            bankDetails: res.data.bankDetails || {},
          });
        }
      } catch (e: any) {
        setLoadError(e.message || "Could not load school settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(false);
    setSaveError("");
    try {
      await schoolAdminApi.updateSchoolBranding({ name: profile.name, phone: profile.phone, address: profile.address, currency: profile.currency, dateFormat: profile.dateFormat, ...(financeEnabled?{bankDetails:profile.bankDetails}:{}) });
      await refreshUser();
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Could not save school settings. Please review the form and try again.");
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl">
      
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
          School Branding & Custom Settings
        </h1>
        <p className="text-xs text-zinc-500">Manage institutional logo, bank slip headers, and ERP rules</p>
      </div>

      {savedNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>School branding and settings updated.</span>
        </div>
      )}
      {saveError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{saveError}</div>}
      {loadError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{loadError}</div>}

      <Link href={(user?.school?.slug?"/"+user.school.slug+"/admin":"/school-admin")+"/settings/document-templates"} className="block rounded-lg border border-red-100 bg-red-50 p-4"><strong>Document Templates</strong><p className="mt-1 text-xs text-zinc-600">Choose school document designs and manage shared signatures, stamp and print settings.</p></Link>
      <SchoolLogoEditor/>
      <form onSubmit={handleSaveSettings} className="space-y-6">
        
        {/* Section 2: School Information & Print Headers */}
        <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-2">
            <Building2 className="w-5 h-5 text-school-primary" />
            Institutional Identity & Print Headers
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">Official School Name *</label>
              <input
                type="text"
                required
                value={profile.name || ""}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">School Subdomain Code</label>
              <input
                type="text"
                disabled
                value={`${profile.code}.acadivo.com`}
                className="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-lg font-mono text-zinc-500"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Official School Email *</label>
              <input
                type="email"
                required
                value={profile.email || ""}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Official Phone Number *</label>
              <input
                type="text"
                required
                value={profile.phone || ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">Physical Address *</label>
              <input
                type="text"
                required
                value={profile.address || ""}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Bank Details for Fee Challans */}
        {financeEnabled&&<div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-2">
            <DollarSign className="w-5 h-5 text-school-primary" />
            Bank Deposit Slip Details (Printed on Challans)
          </h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!profile.bankDetails.enabled} onChange={e=>setProfile({...profile,bankDetails:{...profile.bankDetails,enabled:e.target.checked}})}/>Enable parent bank payment submissions</label><label className="block text-sm">Bank branch<input value={profile.bankDetails.branch||""} onChange={e=>setProfile({...profile,bankDetails:{...profile.bankDetails,branch:e.target.value}})} className="mt-1 block w-full rounded-lg border p-2"/></label><label className="block text-sm">Payment instructions<input value={profile.bankDetails.instructions||""} onChange={e=>setProfile({...profile,bankDetails:{...profile.bankDetails,instructions:e.target.value}})} className="mt-1 block w-full rounded-lg border p-2"/></label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold mb-1">Bank Name</label>
              <input
                type="text"
                value={profile.bankDetails?.bankName || ""}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, bankName: e.target.value } })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Account Title</label>
              <input
                type="text"
                value={profile.bankDetails?.accountTitle || ""}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountTitle: e.target.value } })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Account Number</label>
              <input
                type="text"
                value={profile.bankDetails?.accountNumber || ""}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, accountNumber: e.target.value } })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">IBAN (Optional)</label>
              <input
                type="text"
                value={profile.bankDetails?.iban || ""}
                onChange={(e) => setProfile({ ...profile, bankDetails: { ...profile.bankDetails, iban: e.target.value } })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono"
              />
            </div>
          </div>
        </div>}

        {/* Submit */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-school-primary hover:bg-school-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save School Branding & Settings</span>
          </button>
        </div>

      </form>

    </div>
  );
}

