"use client";
import {
  FileText,
  Landmark,
  ReceiptText,
  RefreshCw,
  Clock3,
} from "lucide-react";
const money = (v: any) => "PKR " + Number(v || 0).toLocaleString("en-PK");
const date = (v: any) =>
  v && !Number.isNaN(new Date(v).getTime())
    ? new Date(v).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })
    : "Not recorded";
const label = (v: string) =>
  v
    .replace(/PKR$/, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
export function PaymentStatus({ status }: { status: string }) {
  return (
    <span className="family-status" data-status={status.toUpperCase()}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
export default function ParentFinanceRecords({
  data,
  onPay,
  onReceipt,
  onRefresh,
}: {
  data: any;
  onPay: (v: any) => void;
  onReceipt: (v: any) => void;
  onRefresh: () => void;
}) {
  const fees = data.fees || [],
    submissions = data.submissions || [],
    payments = data.payments || [];
  const total = fees.reduce(
    (a: any, f: any) => ({
      issued: a.issued + Number(f.totalAmountPKR || 0),
      paid: a.paid + Number(f.paidAmountPKR || 0),
      remaining: a.remaining + Number(f.remainingAmountPKR || 0),
      overdue:
        a.overdue +
        (new Date(f.dueDate) < new Date()
          ? Number(f.remainingAmountPKR || 0)
          : 0),
    }),
    { issued: 0, paid: 0, remaining: 0, overdue: 0 },
  );
  return (
    <div className="family-finance space-y-5">
      <div className="family-finance-summary">
        {[
          ["Total invoiced", total.issued],
          ["Paid against invoices", total.paid],
          ["Outstanding balance", total.remaining],
          ["Past due", total.overdue],
        ].map(([k, v]) => (
          <article key={k} data-overdue={k === "Past due" && Number(v) > 0}>
            <span>{k}</span>
            <strong>{money(v)}</strong>
          </article>
        ))}
      </div>
      <section className="family-panel">
        <header>
          <div>
            <p className="family-kicker">
              <FileText size={14} />
              School fees
            </p>
            <h2>Fee invoices</h2>
            <p>
              Review each invoice, its charges and the outstanding amount before
              paying.
            </p>
          </div>
          <span className="family-status">{fees.length} invoices</span>
        </header>
        {fees.length ? (
          <div className="family-invoice-list">
            {fees.map((f: any) => {
              const pending = submissions.some(
                (s: any) =>
                  String(s.challanId) === String(f._id) &&
                  s.status === "PENDING",
              );
              const status =
                f.remainingAmountPKR > 0 && new Date(f.dueDate) < new Date()
                  ? "OVERDUE"
                  : f.status === "PAID"
                    ? "PAID"
                    : f.status === "PARTIAL"
                      ? "PARTIAL"
                      : "UNPAID";
              return (
                <article key={f._id} className="family-invoice">
                  <div className="family-record-heading">
                    <div>
                      <small>{f.month || "Fee invoice"}</small>
                      <h3>{f.challanNumber}</h3>
                      <p>Due {date(f.dueDate)}</p>
                    </div>
                    <PaymentStatus status={status} />
                  </div>
                  <dl className="family-amounts">
                    <div>
                      <dt>Invoice total</dt>
                      <dd>{money(f.totalAmountPKR)}</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>{money(f.paidAmountPKR)}</dd>
                    </div>
                    <div>
                      <dt>Balance due</dt>
                      <dd>{money(f.remainingAmountPKR)}</dd>
                    </div>
                  </dl>
                  <div className="family-breakdown">
                    <h4>Fee breakdown</h4>
                    {Object.entries(f.feeBreakdown || {}).filter(([, v]) =>
                      Number(v),
                    ).length ? (
                      <dl>
                        {Object.entries(f.feeBreakdown || {})
                          .filter(([, v]) => Number(v))
                          .map(([k, v]) => (
                            <div key={k}>
                              <dt>{label(k)}</dt>
                              <dd>{money(v)}</dd>
                            </div>
                          ))}
                      </dl>
                    ) : (
                      <p>
                        Itemized charges have not been provided for this
                        invoice.
                      </p>
                    )}
                  </div>
                  {f.remainingAmountPKR > 0 && (
                    <footer>
                      {pending ? (
                        <p className="family-review-note">
                          <Clock3 size={16} />
                          Payment proof is under review. The balance updates
                          after Finance approves it.
                        </p>
                      ) : data.bankDetails ? (
                        <button
                          className="family-primary-action"
                          onClick={() => onPay(f)}
                        >
                          <Landmark size={16} />
                          Pay by bank transfer
                        </button>
                      ) : (
                        <p>
                          Contact the school Finance office for payment
                          instructions.
                        </p>
                      )}
                    </footer>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="family-empty">
            No invoices have been issued for this child. Issued invoices and
            their fee breakdowns will appear here.
          </p>
        )}
      </section>
      <section className="family-panel">
        <header>
          <div>
            <p className="family-kicker">
              <Clock3 size={14} />
              Payment review
            </p>
            <h2>Payment verification status</h2>
            <p>
              Submitting proof does not mark a fee as paid. Finance must approve
              the payment.
            </p>
          </div>
          <button className="workspace-secondary-button" onClick={onRefresh}>
            <RefreshCw size={14} />
            Refresh status
          </button>
        </header>
        {submissions.length ? (
          <div className="family-table-scroll">
            <table className="family-data-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Review / receipt</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s: any) => (
                  <tr key={s._id}>
                    <td>{date(s.submittedAt)}</td>
                    <td>
                      <strong>{money(s.amountPKR)}</strong>
                    </td>
                    <td>
                      <PaymentStatus status={s.status} />
                    </td>
                    <td>
                      {s.rejectionReason ? (
                        <span className="text-red-700">
                          {s.rejectionReason}
                        </span>
                      ) : s.receiptNumber ? (
                        `Receipt ${s.receiptNumber}`
                      ) : s.status === "PENDING" ? (
                        "Awaiting Finance review"
                      ) : s.status === "APPROVED" ? (
                        "Approved by Finance"
                      ) : (
                        "No review note recorded"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="family-empty">
            No payment proofs submitted yet. Use an unpaid invoice above to
            submit a bank-transfer screenshot.
          </p>
        )}
      </section>
      <section className="family-panel">
        <header>
          <div>
            <p className="family-kicker">
              <ReceiptText size={14} />
              Verified transactions
            </p>
            <h2>Payment history & receipts</h2>
            <p>Approved payments and the corresponding receipt details.</p>
          </div>
          <span className="family-status">{payments.length} payments</span>
        </header>
        {payments.length ? (
          <div className="family-table-scroll">
            <table className="family-data-table">
              <thead>
                <tr>
                  <th>Receipt / date</th>
                  <th>Method / reference</th>
                  <th>Amount paid</th>
                  <th>Document</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p._id}>
                    <td>
                      <strong>
                        {p.receiptNumber || "Receipt number not recorded"}
                      </strong>
                      <small>{date(p.paidAt)}</small>
                    </td>
                    <td>
                      {label(p.paymentMethod || "Not recorded")}
                      <small>{p.reference || "No reference recorded"}</small>
                    </td>
                    <td>
                      <strong>{money(p.amountPKR)}</strong>
                    </td>
                    <td>
                      <button
                        className="workspace-secondary-button"
                        onClick={() => onReceipt(p)}
                      >
                        View / print receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="family-empty">
            No verified payments yet. Receipts become available when the school
            records or approves a payment.
          </p>
        )}
      </section>
      <section className="family-panel">
        <header>
          <div>
            <p className="family-kicker">Class fee schedule</p>
            <h2>Applicable fee structures</h2>
            <p>
              The school&apos;s configured charges. Your issued invoice determines
              the amount payable.
            </p>
          </div>
        </header>
        {data.structures?.length ? (
          <div className="family-table-scroll">
            <table className="family-data-table">
              <thead>
                <tr>
                  <th>Fee structure</th>
                  <th>Tuition</th>
                  <th>Examination</th>
                  <th>Other charges</th>
                  <th>Monthly total</th>
                </tr>
              </thead>
              <tbody>
                {data.structures.map((s: any) => (
                  <tr key={s._id}>
                    <td>
                      <strong>{s.title}</strong>
                    </td>
                    <td>{money(s.tuitionFee)}</td>
                    <td>{money(s.examFee)}</td>
                    <td>{money(s.otherCharges)}</td>
                    <td>
                      <strong>{money(s.totalMonthlyFee)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="family-empty">
            No fee structure has been assigned to this class yet.
          </p>
        )}
      </section>
    </div>
  );
}
