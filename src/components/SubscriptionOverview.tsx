"use client";
import { canManageSchoolBilling } from "@/lib/billing-access";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Clock3, ShieldCheck, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { needsSubscriptionReminder } from "@/lib/subscription-warning";
import { useAuth } from "@/lib/auth-context";
const date = (value: any) =>
  value
    ? new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not configured";
const money = (value: number) => "PKR " + Number(value).toLocaleString("en-PK");
export default function SubscriptionOverview() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [cycle, setCycle] = useState("monthly");
  const load = useCallback(async () => {
    if (!canManageSchoolBilling(user)) return;
    setLoading(true);
    try {
      setData((await apiFetch("/subscriptions/current")).data);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.userType, user?.isOrganizationOwner, user?.branchId, user?.school?.plan]);
  useEffect(() => {
    void load();
  }, [load]);
  const admin = user?.userType === "SCHOOL_ADMIN",
    o = data?.overview;
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-600">
            Organization / Billing
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Subscription & plans
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Authoritative account dates, current entitlement and verified
            payments.
          </p>
        </div>
        <button
          disabled={loading}
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm"
        >
          <RefreshCw size={15} />
          Refresh status
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading && !o ? (
        <p role="status">Loading subscription...</p>
      ) : (
        o && (
          <>
            <section className="rounded-lg border border-red-200 bg-red-50/40 p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CreditCard className="mb-3 text-red-600" />
                  <h2 className="text-xl font-bold">
                    {data.plans.find((p: any) => p.code === o.plan)?.name ||
                      o.plan?.replaceAll("_", " ")}
                  </h2>
                  <p className="mt-2 text-sm">{o.message}</p>
                </div>
                <span className="rounded-md border bg-white px-3 py-2 text-xs font-bold">
                  {o.displayStatus}
                </span>
              </div>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Subscription started", date(o.startsAt)],
                  ["Expiry (Asia/Karachi)", date(o.expiresAt)],
                  [
                    "Days remaining",
                    o.daysRemaining === null
                      ? "Not configured"
                      : o.daysRemaining,
                  ],
                  ["Next billing / renewal", date(o.nextBillingAt)],
                  ["Account access", o.accountStatus],
                  ["Payment status", o.paymentStatus],
                  ["Billing period", data.billingCycle || "Not configured"],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="mt-1 text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              {o.accountStatus === "DEACTIVATED" && (
                <p className="mt-5 rounded-md border border-red-200 bg-white p-3 text-sm text-red-700">
                  Your organization is deactivated. Renewing does not remove an
                  administrative restriction. Contact support.
                  {o.accountReason && <> Reason: {o.accountReason}</>}
                </p>
              )}
            </section>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Available plans</h2>
                <label className="text-xs">
                  Billing period
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                    className="ml-3 rounded-md border px-3 py-2"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {data.plans.map((p: any) => (
                  <article
                    key={p.code}
                    className="flex flex-col rounded-lg border bg-white p-5"
                  >
                    <h3 className="font-bold">{p.name}</h3>
                    <p className="my-3 text-2xl font-bold">
                      {money(
                        cycle === "annual"
                          ? p.priceAnnualPKR * 12
                          : p.priceMonthlyPKR,
                      )}
                      <span className="ml-1 text-xs font-normal text-zinc-500">
                        / {cycle === "annual" ? "year" : "month"}
                      </span>
                    </p>
                    {cycle === "annual" && (
                      <p className="mb-3 text-xs text-zinc-500">
                        {money(p.priceAnnualPKR)} per month, billed annually.
                      </p>
                    )}
                    <ul className="mb-5 flex-1 space-y-2 text-xs text-zinc-600">
                      {p.features?.map((f: string) => (
                        <li key={f} className="flex gap-2">
                          <ShieldCheck
                            size={13}
                            className="shrink-0 text-red-600"
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {admin ? (
                      <Link
                        href={
                          "/payment?plan=" + p.code + "&billingCycle=" + cycle
                        }
                        className="rounded-md bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white"
                      >
                        {o.plan === p.code ? "Renew plan" : "Choose plan"}
                      </Link>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Ask your school administrator to manage billing.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
            <aside className="rounded-lg border bg-zinc-50 p-4 text-sm text-zinc-600">
              Payments use manual bank transfer and administrative verification.
              Submitting proof does not activate a subscription.{" "}
              <a
                href="mailto:hello@aktech.tech"
                className="font-semibold text-red-600"
              >
                Contact support
              </a>
            </aside>
            {admin && (
              <section className="overflow-hidden rounded-lg border bg-white">
                <h2 className="border-b p-5 font-bold">
                  Payment & renewal history
                </h2>
                {data.latestSuccessfulPayment && (
                  <p className="border-b bg-emerald-50 px-5 py-3 text-xs text-emerald-800">
                    Latest verified payment:{" "}
                    {money(data.latestSuccessfulPayment.amount)} &middot;{" "}
                    {date(data.latestSuccessfulPayment.reviewedAt)}
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-zinc-50 text-xs text-zinc-500">
                      <tr>
                        {[
                          "Submitted",
                          "Plan / period",
                          "Amount",
                          "Status",
                          "Reference",
                        ].map((h) => (
                          <th className="p-3" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p: any) => (
                        <tr className="border-t" key={p._id}>
                          <td className="p-3">{date(p.submittedAt)}</td>
                          <td className="p-3">
                            {p.plan} / {p.billingCycle}
                          </td>
                          <td className="p-3">{money(p.amount)}</td>
                          <td className="p-3">
                            {p.status}
                            {p.status === "APPROVED" &&
                            p.activationComplete === false
                              ? " / activation pending"
                              : ""}
                            {p.rejectionReason && (
                              <p className="text-xs text-red-700">
                                {p.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="p-3">
                            {p.reference || "Not provided"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.payments.length && (
                  <p className="p-7 text-sm text-zinc-500">
                    No subscription payments recorded yet.
                  </p>
                )}
                <p className="border-t p-4 text-xs text-zinc-500">
                  No subscription invoice download is currently available.
                  Recorded payment verification is shown above.
                </p>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
export function SubscriptionWarning({ href }: { href?: string }) {
  const { user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  useEffect(() => {
    setOverview(null);
    if (!user?.school?._id || !canManageSchoolBilling(user)) return;
    let active = true;
    const load = () =>
      apiFetch("/subscriptions/current")
        .then((response) => {
          if (active) setOverview(response.data.overview);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(() => void load(), 60000);
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("acadivo:data-changed", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("acadivo:data-changed", refresh);
    };
  }, [user?.school?._id, user?.branchId, user?.isOrganizationOwner, user?.userType, user?.school?.plan]);
  const days = overview?.daysRemaining;
  if (!canManageSchoolBilling(user) || !needsSubscriptionReminder(overview)) return null;
  const admin = user?.userType === "SCHOOL_ADMIN";
  const restricted = overview.accountStatus === "DEACTIVATED";
  const expiry =
    overview.expiresAt && !Number.isNaN(new Date(overview.expiresAt).getTime())
      ? new Intl.DateTimeFormat("en-PK", {
          dateStyle: "medium",
          timeZone: "Asia/Karachi",
        }).format(new Date(overview.expiresAt))
      : "";
  return (
    <aside
      className="subscription-reminder flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 lg:px-7"
      role="status"
      aria-label="Subscription reminder"
    >
      <p className="flex min-w-0 items-start gap-2">
        <Clock3 size={17} className="mt-0.5 shrink-0" />
        <span>
          <strong>
            {restricted
              ? "School account requires attention."
              : overview.isExpired
                ? "Your school's subscription has expired."
                : `Your school's subscription ${days === 0 ? "expires today" : `expires in ${days} ${days === 1 ? "day" : "days"}`}.`}
          </strong>
          {expiry && !restricted && <span> Expiry: {expiry}.</span>}
          <span className="block text-xs">
            {restricted
              ? "Contact support to review the account restriction."
              : admin
                ? "Renew before expiry to keep your school workspace available."
                : "Please contact your school administrator about renewal."}
          </span>
        </span>
      </p>
      {href && (
        <Link
          href={href}
          className="shrink-0 rounded border border-amber-300 bg-white px-3 py-2 text-xs font-semibold"
        >
          {admin ? "Manage subscription" : "Subscription details"}
        </Link>
      )}
    </aside>
  );
}
