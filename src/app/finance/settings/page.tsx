"use client";



import { useState, useEffect } from "react";
import { Settings, CheckCircle2, DollarSign, Calendar, Building2, Save } from "lucide-react";
import { financeApi } from "@/lib/financeApi";

export default function FinanceSettingsPage() {
  const [currency, setCurrency] = useState("PKR");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    iban: "", branch:"", instructions:"", enabled:false,
  });

  const [savingPreferences, setSavingPreferences] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await financeApi.getSchoolProfile();
        if (res?.data) {
          if (res.data.currency) setCurrency(res.data.currency);
          if (res.data.dateFormat) setDateFormat(res.data.dateFormat);
          if (res.data.bankDetails) {
            setBankDetails({
              bankName: res.data.bankDetails.bankName || "",
              accountTitle: res.data.bankDetails.accountTitle || "",
              accountNumber: res.data.bankDetails.accountNumber || "",
              iban: res.data.bankDetails.iban || "", branch:res.data.bankDetails.branch||"", instructions:res.data.bankDetails.instructions||"", enabled:!!res.data.bankDetails.enabled,
            });
          }
        }
      } catch (err: any) {
        console.warn("Could not fetch detailed school profile for finance settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPreferences(true);
    setError("");
    try {
      await financeApi.updateSchoolBranding({
        currency: currency as any,
        dateFormat: dateFormat as any,
        bankDetails,
      });
      setNotice("Financial preferences and challan bank details updated successfully!");
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setError(err?.message || "Unable to save preferences.");
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-black text-zinc-950 flex items-center gap-2">
          <Settings className="h-6 w-6 text-school-primary" />
          Finance Portal Settings
        </h1>
        <p className="text-xs text-zinc-500">
          Manage challan bank accounts and financial display preferences across the finance department portal.
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

      {/* Financial Display & Bank Details Preferences */}
      <form onSubmit={handleSavePreferences} className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-xs space-y-5">
        <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2 border-b border-zinc-100 pb-3">
          <DollarSign className="h-4 w-4 text-school-primary" />
          Financial & Bank Challan Preferences
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-zinc-700 uppercase mb-1">Default Ledger Currency</label>
            <div className="relative">
              <input
                type="text"
                disabled
                value={currency}
                className="w-full border border-zinc-200 bg-zinc-100 text-zinc-500 rounded-lg p-2.5 font-bold cursor-not-allowed"
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-zinc-400 font-mono">Pakistani Rupee</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-zinc-700 uppercase mb-1">Receipt & Challan Date Format</label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-semibold focus:outline-none"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 01/10/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/01/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-10-01)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-100 space-y-3">
          <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-zinc-500" />
            Official Bank Account on Student Fee Challans
          </h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!bankDetails.enabled} onChange={e=>setBankDetails({...bankDetails,enabled:e.target.checked})}/>Enable parent bank payment submissions</label><label className="block text-sm">Bank branch<input value={bankDetails.branch||""} onChange={e=>setBankDetails({...bankDetails,branch:e.target.value})} className="mt-1 block w-full rounded-lg border p-2"/></label><label className="block text-sm">Payment instructions<input value={bankDetails.instructions||""} onChange={e=>setBankDetails({...bankDetails,instructions:e.target.value})} className="mt-1 block w-full rounded-lg border p-2"/></label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-600 mb-1">Designated Bank Name</label>
              <input
                type="text"
                placeholder="e.g. Habib Bank Limited (HBL)"
                value={bankDetails.bankName}
                onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-600 mb-1">Account Title</label>
              <input
                type="text"
                placeholder="e.g. The City Grammar School Account"
                value={bankDetails.accountTitle}
                onChange={(e) => setBankDetails({ ...bankDetails, accountTitle: e.target.value })}
                className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-600 mb-1">Account Number</label>
              <input
                type="text"
                placeholder="e.g. 01234567890123"
                value={bankDetails.accountNumber}
                onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-600 mb-1">IBAN Number</label>
              <input
                type="text"
                placeholder="e.g. PK36HABB0000123456789012"
                value={bankDetails.iban}
                onChange={(e) => setBankDetails({ ...bankDetails, iban: e.target.value })}
                className="w-full border border-zinc-300 rounded-lg p-2.5 bg-zinc-50 font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingPreferences}
            className="px-5 py-2.5 bg-school-primary text-white font-bold rounded-xl text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingPreferences ? "Saving Preferences..." : "Save Financial Preferences"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
