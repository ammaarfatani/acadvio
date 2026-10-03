import { PricingTable } from "@/components/PricingTable";
import { CTASection } from "@/components/CTASection";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Pricing Plans (PKR) — Acadivo",
  description:
    "Transparent pricing for Acadivo School Management & ERP SaaS. Starter (PKR 4,999), Professional (PKR 9,999), Enterprise (PKR 19,999). Pay by bank transfer with manual payment verification.",
};

export default function PricingPage() {
  return (
    <div className="space-y-16 pb-16">
      
      {/* Header */}
      <section className="bg-zinc-950 text-white py-16 sm:py-20 border-b border-zinc-800 relative overflow-hidden">
        <div className="bg-grid-pattern absolute inset-0 opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-4">
          <span className="inline-flex items-center gap-2 bg-red-950 text-red-400 border border-red-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            Simple & Transparent Licensing
          </span>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white">
            Simple, Predictable School ERP Pricing
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Choose the plan that fits your school size. Pay by bank transfer and submit your screenshot for subscription activation.
          </p>

          <div className="pt-2 flex items-center justify-center gap-6 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Billed in Pakistani Rupees (PKR)
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              No hidden setup or installation fees
            </span>
          </div>
        </div>
      </section>

      {/* Main Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PricingTable />
      </section>

      {/* Bottom CTA */}
      <CTASection />

    </div>
  );
}

