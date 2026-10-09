"use client";

import { PLAN_FEATURE_LABELS } from "@/lib/plan-features";
import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Check, ArrowRight, HelpCircle, Shield, Sparkles, Building, ChevronDown, ChevronUp } from "lucide-react";

export function PricingTable({compact = false}: {compact?: boolean}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [catalogue, setCatalogue] = useState<any[]>([]);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  useEffect(() => { apiFetch("/subscription-payments/plans").then(r => setCatalogue(r.data)).catch(e => setCatalogueError(e.message)).finally(() => setCatalogueLoading(false)); }, []);
  const plans = [
    {
      name: "STARTER",
      description: "Essential administrative suite for growing single-campus schools.",
      badge: null,
      highlight: false,
      ctaText: "Pay Now",
      features: PLAN_FEATURE_LABELS.STARTER,
    },
    {
      name: "PROFESSIONAL",
      description: "Complete ERP suite with automated Fee Challans, Exams & Marksheets.",
      badge: "Complete school workflows",
      highlight: true,
      ctaText: "Pay Now",
      features: PLAN_FEATURE_LABELS.PROFESSIONAL,
    },
    {
      name: "ENTERPRISE",
      description: "Full-scale ERP for multi-branch school networks & educational groups.",
      badge: "Branch management",
      highlight: false,
      ctaText: "Pay Now",
      features: PLAN_FEATURE_LABELS.ENTERPRISE,
    },
  ];

  const comparisonMatrix = [
    { category: "Core Administration", items: [
      { name: "Student Data Records", starter: true, pro: true, enterprise: true },
      { name: "Teacher & Staff Directory", starter: true, pro: true, enterprise: true },
      { name: "Class & Section Setup", starter: true, pro: true, enterprise: true },
      { name: "Subject Catalog", starter: true, pro: true, enterprise: true },
      { name: "Attendance Register", starter: true, pro: true, enterprise: true },
      { name: "Timetable Management", starter: true, pro: true, enterprise: true },
      { name: "School Logo & Custom Receipt Branding", starter: true, pro: true, enterprise: true },
    ]},
    { category: "Finance & Fee Operations", items: [
      { name: "Fee Structure & Monthly Challans", starter: false, pro: true, enterprise: true },
      { name: "Bank Deposit Slips & Receipts", starter: false, pro: true, enterprise: true },
      { name: "Expense Tracking", starter: false, pro: true, enterprise: true },
      { name: "Multi-Branch Financial Consolidation", starter: false, pro: false, enterprise: true },
    ]},
    { category: "Examinations & Grading", items: [
      { name: "Exam Scheduling & Marks Entry", starter: false, pro: true, enterprise: true },
      { name: "Automatic Grade & Rank Calculation", starter: false, pro: true, enterprise: true },
      { name: "Professional Result Marksheets", starter: false, pro: true, enterprise: true },
      { name: "Certificates & Transcripts", starter: false, pro: true, enterprise: true },
    ]},
    { category: "Multi-Branch & Enterprise", items: [
      { name: "Multiple Staff Role Permissions", starter: false, pro: "Standard Roles", enterprise: "Standard Roles" },
      { name: "Multi-Campus Administration", starter: false, pro: false, enterprise: true },
      { name: "Branch School Admin Accounts", starter: false, pro: false, enterprise: true },
      { name: "Consolidated & Branch Reports", starter: false, pro: false, enterprise: true },
    ]},
  ];

  const faqs = [
    {
      q: "Does the 14-day free trial require a credit card or bank details?",
      a: "Use Try Free Now in the top announcement bar to request a 14-day free trial without payment details. Pricing card Pay Now buttons instead open bank-transfer payment submission for a paid subscription.",
    },
    {
      q: "Can we switch between plans later?",
      a: "School administrators can select a subscription from their billing workspace. Paid activation follows payment verification; your school records remain associated with your school.",
    },
    {
      q: "How are fee challans printed for students?",
      a: "Acadivo formats fee challans with standard 3-part deposit slips (Bank Copy, School Copy, Student Copy) customized with your school logo, address, and bank account numbers.",
    },
    {
      q: "Do students or parents get separate login portals?",
      a: "School administrators can create parent login accounts and link their children. Parents can view those children’s attendance and school notices, plus fee statements and published results when included in the school’s plan. Student records do not have separate student logins.",
    },
    {
      q: "What currency is billed?",
      a: "All prices are listed in Pakistani Rupees (PKR) with transparent pricing and no hidden setup fees.",
    },
  ];

  return (
    <div className="m-pricing-table space-y-16">
      
      {/* Billing Switcher */}
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="inline-flex items-center bg-zinc-100 p-1.5 rounded-xl border border-zinc-200">
          <button
            aria-pressed={billingCycle === "monthly"}
            onClick={() => setBillingCycle("monthly")}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              billingCycle === "monthly"
                ? "bg-zinc-950 text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            Monthly Billing
          </button>
          <button
            aria-pressed={billingCycle === "annual"}
            onClick={() => setBillingCycle("annual")}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              billingCycle === "annual"
                ? "bg-zinc-950 text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-950"
            }`}
          >
            <span>Annual Billing</span>
            <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              12-month billing
            </span>
          </button>
        </div>
        <p className="text-xs text-zinc-500 font-medium">
          Pay by bank transfer. Your subscription activates after payment verification.
        </p>
      </div>

      {catalogueLoading && <p role="status" className="text-center text-sm text-zinc-500">Loading subscription plans…</p>}
      {catalogueError && <p role="alert" className="text-center text-sm text-red-700">{catalogueError}</p>}
      {!catalogueLoading && !catalogueError && !catalogue.length && <p className="text-center text-sm text-zinc-500">No subscription plans are currently available.</p>}
      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-7xl mx-auto">
        {plans.filter(plan => catalogue.some(item => item.code === plan.name)).map((plan) => {
          const configuredPlan = catalogue.find(item => item.code === plan.name);
          const price = billingCycle === "monthly" ? configuredPlan.priceMonthlyPKR : configuredPlan.priceAnnualPKR;
          return (
            <div
              key={plan.name}
              className={`rounded-2xl bg-white p-8 flex flex-col justify-between transition-all relative ${
                plan.highlight
                  ? "border-2 border-red-600 shadow-2xl ring-1 ring-red-600/20"
                  : "border border-zinc-200 shadow-sm hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  {plan.badge}
                </div>
              )}

              <div>
                {/* Header */}
                <div className="space-y-2 pb-6 border-b border-zinc-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-extrabold text-zinc-950 tracking-tight">{plan.name}</h3>
                    <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                      SaaS Plan
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed min-h-[36px]">
                    {plan.description}
                  </p>
                  <div className="pt-4 flex items-baseline gap-1">
                    <span className="text-xs text-zinc-500 font-semibold">PKR</span>
                    <span className="text-4xl font-black text-zinc-950 tracking-tight font-mono">
                      {price.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">/ month</span>
                  </div>
                  {billingCycle === "annual" && (
                    <div className="text-[11px] text-emerald-600 font-medium">
                      Billed annually (PKR {(price * 12).toLocaleString()} / yr)
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div className="py-6 space-y-3">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
                    What&apos;s Included:
                  </span>
                  <ul className="space-y-2.5 text-xs text-zinc-700">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <span className={feat.startsWith("Everything in") ? "font-semibold text-zinc-950" : ""}>
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t border-zinc-100">
                <Link
                  href={"/payment?plan="+plan.name+"&billingCycle="+billingCycle}
                  className={`w-full py-3.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg"
                      : "bg-zinc-950 hover:bg-zinc-800 text-white"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <div className="text-center mt-2.5 text-[11px] text-zinc-500 font-medium">
                  Manual verification within 24 hours
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!compact && <>
      {/* Feature Comparison Matrix */}
      <div className="pt-12 space-y-8 max-w-7xl mx-auto">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-zinc-950 tracking-tight">
            Detailed Plan Comparison Matrix
          </h3>
          <p className="text-sm text-zinc-600 max-w-2xl mx-auto">
            Compare ERP features side-by-side to choose the best tier for your school administration.
          </p>
        </div>

        <div className="overflow-x-auto border border-zinc-200 rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-white border-b border-zinc-800 font-semibold">
              <tr>
                <th className="p-4 w-1/3">Feature / Capability</th>
                <th className="p-4 text-center">Starter</th>
                <th className="p-4 text-center bg-zinc-900 text-red-400">Professional</th>
                <th className="p-4 text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-800">
              {comparisonMatrix.map((cat, idx) => (
                <Fragment key={idx}>
                  <tr className="bg-zinc-100/80 font-bold text-zinc-900 uppercase text-[11px] tracking-wider">
                    <td colSpan={4} className="p-3 pl-4 bg-zinc-100 text-zinc-900">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.items.map((item, i) => (
                    <tr key={i} className="hover:bg-zinc-50/80">
                      <td className="p-4 font-medium text-zinc-900">{item.name}</td>
                      <td className="p-4 text-center">
                        {typeof item.starter === "boolean" ? (
                          item.starter ? (
                            <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-zinc-300 font-mono">—</span>
                          )
                        ) : (
                          <span className="font-semibold text-zinc-700">{item.starter}</span>
                        )}
                      </td>
                      <td className="p-4 text-center bg-red-50/20 font-semibold">
                        {typeof item.pro === "boolean" ? (
                          item.pro ? (
                            <Check className="w-4 h-4 text-red-600 mx-auto" />
                          ) : (
                            <span className="text-zinc-300 font-mono">—</span>
                          )
                        ) : (
                          <span className="font-semibold text-red-700">{item.pro}</span>
                        )}
                      </td>
                      <td className="p-4 text-center font-semibold">
                        {typeof item.enterprise === "boolean" ? (
                          item.enterprise ? (
                            <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                          ) : (
                            <span className="text-zinc-300 font-mono">—</span>
                          )
                        ) : (
                          <span className="font-semibold text-zinc-900">{item.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing FAQs */}
      <div className="pt-12 max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-zinc-950">Pricing & Trial FAQ</h3>
          <p className="text-sm text-zinc-600">Everything you need to know about Acadivo SaaS licensing</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="border border-zinc-200 rounded-xl bg-white overflow-hidden"
              >
                <button
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-semibold text-zinc-900 text-sm hover:bg-zinc-50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-red-600 shrink-0" />
                    {faq.q}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      </>}
    </div>
  );
}





