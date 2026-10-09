"use client";



import { useEffect, useState } from "react";
import { Sliders, Check, Plus, Edit, RefreshCw, Sparkles, Building2 } from "lucide-react";
import { superAdminApi } from "@/lib/superAdminApi";

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getPlans();
      if (res?.data) setPlans(res.data);
    } catch (e) { console.error("Unable to load platform plans:", e); setPlans([]); } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight">
            SaaS Plan Matrix & Feature Management
          </h1>
          <p className="text-xs text-zinc-500">Configure pricing tiers and feature allocations across the Acadivo platform</p>
        </div>
        <button
          onClick={fetchPlans}
          className="p-2.5 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 rounded-xl hover:bg-zinc-50 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Plans Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.code}
            className="bg-white border-2 border-zinc-200 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-xs hover:border-red-600 transition-colors"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-xl font-extrabold text-zinc-950">{plan.name}</h3>
                <span className="text-[10px] font-bold uppercase text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded">
                  {plan.code}
                </span>
              </div>

              <p className="text-xs text-zinc-600 min-h-[36px]">{plan.description}</p>

              <div className="pt-2 flex items-baseline gap-1 font-mono">
                <span className="text-xs text-zinc-500 font-sans">PKR</span>
                <span className="text-3xl font-black text-zinc-950">{(plan.priceMonthlyPKR || 0).toLocaleString()}</span>
                <span className="text-xs text-zinc-500 font-sans font-medium">/ month</span>
              </div>

              <div className="pt-2 space-y-2 border-t border-zinc-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Included Capabilities:
                </span>
                <ul className="space-y-1.5 text-xs text-zinc-700">
                  {plan.features?.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100">
              <button className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl transition-colors">
                Edit Plan & Pricing
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
