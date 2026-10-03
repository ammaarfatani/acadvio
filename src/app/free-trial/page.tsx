import { Suspense } from "react";
import { FreeTrialForm } from "@/components/FreeTrialForm";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Start 14-Day Free Trial — Acadivo",
  description:
    "Register your school for a 14-day free trial of Acadivo School Management & ERP SaaS. No credit card required.",
};

export default function FreeTrialPage() {
  return (
    <div className="py-12 sm:py-16 bg-zinc-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 bg-red-100 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Institutional Registration
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight">
            Start Your 14-Day Free Trial
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
            Register your school institutional details to experience Acadivo. No credit card or upfront deposit required during trial.
          </p>
        </div>

        {/* Form Container */}
        <Suspense fallback={<div className="text-center p-12 text-sm text-zinc-500">Loading form...</div>}>
          <FreeTrialForm />
        </Suspense>

      </div>
    </div>
  );
}
