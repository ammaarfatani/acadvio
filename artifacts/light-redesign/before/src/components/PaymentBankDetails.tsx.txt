"use client";
import { Copy } from "lucide-react";
export default function PaymentBankDetails({ bank }: { bank: Record<string, string> }) {
  return <dl className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(bank).map(([label, value]) => <div key={label} className="rounded-xl border border-zinc-200 p-3"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 flex items-center justify-between gap-3"><span className="break-all font-semibold">{value}</span><button type="button" aria-label={"Copy "+label} className="rounded-lg p-2 hover:bg-zinc-100" onClick={async () => { try { await navigator.clipboard.writeText(value); window.dispatchEvent(new CustomEvent("acadivo:feedback", { detail: { type: "success", message: "Copied to clipboard" } })); } catch { window.dispatchEvent(new CustomEvent("acadivo:feedback", { detail: { type: "error", message: "Clipboard unavailable. Select and copy the account detail manually." } })); } }}><Copy size={16}/></button></dd></div>)}</dl>;
}
