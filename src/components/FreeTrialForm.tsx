"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowRight, CheckCircle2, Clock, School, User, Lock, Mail, Phone, MapPin, Building2, Sparkles } from "lucide-react";

export function FreeTrialForm({ checkout = false, selectedPlan, onRegistered }: { checkout?: boolean; selectedPlan?: string; onRegistered?: () => Promise<void> } = {}) {
  const searchParams = useSearchParams();
  const preselectedPlan = checkout ? selectedPlan?.toLowerCase() || searchParams.get("plan") || "professional" : "";

  const [formData, setFormData] = useState({
    schoolName: "",
    schoolEmail: "",
    schoolPhone: "",
    schoolAddress: "",
    adminName: "",
    adminEmail: "",
    password: "",
    studentCount: "201-500",
    teacherCount: "",
    selectedPlan: preselectedPlan,
  });

  const [submitted, setSubmitted] = useState(false);

  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preselectedPlan) {
      setFormData((prev) => ({ ...prev, selectedPlan: preselectedPlan }));
    }
  }, [preselectedPlan]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = {
        schoolName: formData.schoolName,
        schoolEmail: formData.schoolEmail,
        schoolPhone: formData.schoolPhone,
        schoolAddress: formData.schoolAddress,
        adminName: formData.adminName,
        adminEmail: formData.adminEmail,
        password: formData.password,
        studentCountRange: formData.studentCount,
        teacherCount: Number(formData.teacherCount),
        registrationType: checkout ? "paid" : "trial",
        ...(checkout ? { selectedPlan: formData.selectedPlan.toUpperCase() } : {}),
      };
      
      const { authApi } = await import("@/lib/api");
      await authApi.registerSchool(payload);
      setSubmitted(true);
      setFormData(previous => ({ ...previous, password: "" }));
      if (checkout) {
        await authApi.login({ email: formData.adminEmail, password: formData.password });
        await onRegistered?.();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "We couldn't submit your school registration. Please review the form and try again.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (submitted && checkout) {
    return <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center space-y-4"><h2 className="text-xl font-bold">School account registered</h2><p className="text-sm text-zinc-600">Continue to submit your payment screenshot. Your CRM access remains pending until approval.</p>{errorMsg && <p role="alert" className="text-sm text-red-700">{errorMsg}</p>}<Link href={"/login?next="+encodeURIComponent("/payment?plan="+preselectedPlan.toUpperCase()+"&billingCycle="+(searchParams.get("billingCycle") || "monthly"))} className="inline-block rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white">Sign in to continue payment</Link></div>;
  }
  if (submitted) {
    return <div role="status" className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 text-center space-y-4"><h2 className="text-2xl font-black">Your school registration has been submitted.</h2><p className="text-sm text-zinc-600">Your free trial request is currently under review. You will receive an email once your school has been approved.</p><p className="text-sm text-zinc-600">Please check your email for further updates.</p></div>;
  }
  return (
    <div className="max-w-3xl mx-auto bg-white border border-zinc-200 rounded-2xl p-6 sm:p-10 shadow-xl space-y-8">
      
      {/* Notice Banner */}
      <div className="ac-registration-notice p-4 rounded-xl bg-zinc-950 text-white text-xs flex items-start gap-3 border border-zinc-800">
        <ShieldCheck className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-[#d60811] text-sm">
  Account Activation & Security Verification
</div>
          <p className="text-zinc-300 leading-relaxed">
            {checkout ? "CRM access will be activated after your subscription payment is verified." : "Your 14-day free trial starts after Super Admin approval. No paid plan selection or payment is required."}
          </p>
        </div>
      </div>

      {errorMsg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{errorMsg}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: School Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-100 pb-2">
            <Building2 className="w-4 h-4 text-red-600" />
            1. Institutional School Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                School / Institution Name *
              </label>
              <div className="relative">
                <School className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  name="schoolName"
                  required
                  placeholder="e.g. Oakridge Model School"
                  value={formData.schoolName}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Official School Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="email"
                  name="schoolEmail"
                  required
                  placeholder="admin@oakridge.edu.pk"
                  value={formData.schoolEmail}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                School Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  name="schoolPhone"
                  required
                  placeholder="+92 300 1234567"
                  value={formData.schoolPhone}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                School Address & City *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  name="schoolAddress"
                  required
                  placeholder="Campus 1, Gulberg III, Lahore"
                  value={formData.schoolAddress}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Administrator Credentials */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-100 pb-2">
            <User className="w-4 h-4 text-red-600" />
            2. School Administrator Account
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Admin Full Name *
              </label>
              <input
                type="text"
                name="adminName"
                required
                placeholder="e.g. Principal Rashid Malik"
                value={formData.adminName}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Admin Personal Email *
              </label>
              <input
                type="email"
                name="adminEmail"
                required
                placeholder="r.malik@oakridge.edu.pk"
                value={formData.adminEmail}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Set Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
                <p className="mt-1 text-[11px] text-zinc-500">Password must be at least 8 characters.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: School Scale & SaaS Plan */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-100 pb-2">
            <Sparkles className="w-4 h-4 text-red-600" />
            3. School Scale & SaaS Plan Selection
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Number of Students *
              </label>
              <select
                name="studentCount"
                value={formData.studentCount}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              >
                <option value="1-200">1 to 200 Students</option>
                <option value="201-500">201 to 500 Students</option>
                <option value="501-1000">501 to 1,000 Students</option>
                <option value="1000+">1,000+ Students (Enterprise)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Number of Teachers *
              </label>
              <input
                type="number"
                name="teacherCount"
                required
                min={0}
                max={10000}
                step={1}
                placeholder="25"
                value={formData.teacherCount}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>

            {checkout && <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                {checkout ? "Selected Subscription Plan *" : "Free Trial"}
              </label>
              <select
                name="selectedPlan" disabled={checkout}
                value={formData.selectedPlan}
                onChange={handleChange}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 font-semibold text-red-600"
              >
                {checkout ? <option value={preselectedPlan}>{preselectedPlan.toUpperCase()} · selected above</option> : <><option value="starter">Starter Plan</option>
                <option value="professional">Professional Plan</option>
                <option value="enterprise">Enterprise Plan</option></>}
              </select>
            </div>}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-zinc-200 space-y-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Submitting School Registration...</span>
            ) : (
              <>
                <span>{checkout ? "Create School Account & Continue to Payment" : "Start 14-Day Free Trial"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{checkout ? "Your account stays pending until your payment is verified." : "No payment or credit card required. Free review & setup."}</span>
          </div>
        </div>

      </form>
    </div>
  );
}





