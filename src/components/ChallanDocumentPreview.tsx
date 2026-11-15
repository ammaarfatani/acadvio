import { challanGeometry, defaultChallanTemplate, getFreeChallanLabel, type ChallanTemplate } from "@/lib/challan-template";

/* eslint-disable @next/next/no-img-element -- School-provided logos may be data URLs; direct loading also preserves print readiness. */

const money = (value: any) => `PKR ${Number(value ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value: any) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }) : "-";

export function ChallanDocumentPreview({ challans, template, className = "" }: { challans: any[]; template?: ChallanTemplate; className?: string }) {
  if (!challans?.length) return null;
  const fallback = template || defaultChallanTemplate();
  return <div className={`challan-preview-list ${className}`}>
    {challans.map((challan, challanIndex) => {
      const style: ChallanTemplate = challan.documentSnapshot?.challanTemplate || fallback;
      const geometry = challanGeometry(style);
      const school = challan.documentSnapshot?.school || {};
      const bank = school.bankDetails || challan.documentSnapshot?.bank;
      const b = challan.feeBreakdown || {};
      const freeLabel = getFreeChallanLabel(challan);
      const trulyFree = Boolean(freeLabel);
      const currentBalance = Number(challan.currentPayablePKR ?? challan.remainingAmountPKR ?? 0);
      const monthTag = /^\d{4}-(\d{2})/.exec(String(challan.month || ""));
      const month = monthTag ? ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Number(monthTag[1]) - 1] : String(challan.month || "").slice(0, 3).toUpperCase();
      const entries: Array<{ label: string; amount: number; tuition?: boolean }> = [
        { label: "TUITION FEE", amount: Number(b.tuitionFee ?? 0), tuition: true },
        ...[["ADMISSION FEE", b.admissionFee], ["EXAMINATION FEE", b.examFee], ["TRANSPORT FEE", b.transportFee], ["COMPUTER FEE", b.computerFee], ["LIBRARY FEE", b.libraryFee], ["OTHER CHARGES", b.otherCharges]].filter(([, amount]) => Number(amount) > 0).map(([label, amount]) => ({ label: String(label), amount: Number(amount) })),
        ...(b.customCharges || []).map((item: any) => ({ label: String(item.label), amount: Number(item.amount) })),
        ...(Number(b.discount || challan.concessionAmount) > 0 ? [{ label: "CONCESSION / DISCOUNT", amount: -Number(b.discount || challan.concessionAmount) }] : []),
        ...(Number(b.scholarship) > 0 ? [{ label: "SCHOLARSHIP", amount: -Number(b.scholarship) }] : []),
        ...(!challan.previousBalanceInformational && Number(challan.previousBalance || b.arrears) > 0 ? [{ label: "PREVIOUS DUES", amount: Number(challan.previousBalance || b.arrears) }] : []),
        ...(Number(b.lateFeeFine) > 0 ? [{ label: "RECORDED LATE FINE", amount: Number(b.lateFeeFine) }] : []),
      ];
      if (trulyFree) {
        const present = new Set(entries.map(entry => entry.label));
        for (const [label, key] of [["ADMISSION FEE", "admissionFee"], ["EXAMINATION FEE", "examFee"], ["TRANSPORT FEE", "transportFee"], ["COMPUTER FEE", "computerFee"], ["LIBRARY FEE", "libraryFee"], ["OTHER CHARGES", "otherCharges"]] as const) {
          if (!present.has(label)) entries.push({ label, amount: Number(b[key] ?? 0) });
        }
      }
      const meta = [
        ["Class", [style.showCategory && challan.classCategoryName, challan.className, challan.sectionName].filter(Boolean).join(" / ") || "-", "Issue date", date(challan.createdAt)],
        ["Student", challan.studentName || "-", "Student ID", challan.admissionNumber || "-"],
        ["Father", challan.fatherName || "-", "Challan", challan.challanNumber || "-"],
        ["Roll no.", challan.rollNumber || "-", "Due date", date(challan.dueDate)],
      ];
      const pairedFees = geometry.panelWidth > 430 && entries.length > 4;
      const renderFee = (entry: typeof entries[number]) => <div className="challan-fee-pair"><span>{entry.label}{entry.tuition && month && <span className="challan-month">{month}</span>}</span><b>{money(entry.amount)}</b></div>;
      const remaining = currentBalance;
      const feeRows = pairedFees
        ? Array.from({ length: Math.ceil(entries.length / 2) }, (_, i) => <tr key={i}><td colSpan={2}><div className="challan-fee-paired-row">{renderFee(entries[i * 2])}{entries[i * 2 + 1] && renderFee(entries[i * 2 + 1])}</div></td></tr>)
        : entries.map((entry, i) => <tr key={i}><td>{entry.label}{entry.tuition && month && <span className="challan-month">{month}</span>}</td><td>{money(entry.amount)}</td></tr>);
      const statusRows = <>
        {challan.previousBalanceInformational && Number(challan.previousBalance) > 0 && <tr><td>Prior invoices (pay separately)</td><td>{money(challan.previousBalance)}</td></tr>}
        {challan.appliedEarlyDiscountPKR && <tr><td>Early discount applied</td><td>-{money(challan.appliedEarlyDiscountPKR)}</td></tr>}
        {Number(challan.paidAmountPKR) > 0 && <tr><td>Payments recorded</td><td>{money(challan.paidAmountPKR)}</td></tr>}
        {(Number(challan.paidAmountPKR) > 0 || challan.status === "PARTIAL") && <tr><td>Remaining balance</td><td>{money(remaining)}</td></tr>}
      </>;
      const policy = challan.lateFeeFinePolicy || {};
      const latePolicy = trulyFree ? "" : challan.lateFinePolicyModel === "RECURRING"
        ? `Late fine: ${policy.dailyRate || 0}${policy.type === "PERCENTAGE" ? "% of unpaid balance" : " PKR"} per day after ${policy.graceDays || 0} grace day(s). Cap PKR ${Number(policy.maxFineCap || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}.`
        : challan.lateFinePolicyModel === "STAGES"
          ? `Late fine by date: ${(challan.lateFineStages || []).map((stage: any) => `${stage.label} PKR ${Number(stage.fineAmount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })} (payable ${Number(stage.payableAmount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })})`).join("; ")}`
          : challan.lateFinePolicyModel === "ONE_TIME"
            ? `After ${date(challan.lateFineStages?.[0]?.deadlineDate || challan.dueDate)} late fine PKR ${Number(challan.lateFineStages?.[0]?.fineAmount ?? policy.amount ?? Math.max(0, Number(challan.amountPayableAfterDueDate || 0) - Number(challan.totalAmountPKR || 0))).toLocaleString("en-PK", { minimumFractionDigits: 2 })}. Payable PKR ${Number(challan.amountPayableAfterDueDate || Number(challan.totalAmountPKR) + Number(challan.lateFineStages?.[0]?.fineAmount || 0)).toLocaleString("en-PK", { minimumFractionDigits: 2 })}.`
            : "";
      return <section data-page-width={`${geometry.width * 25.4 / 72}`} data-page-height={`${geometry.height * 25.4 / 72}`} data-page-name={`challan-page-${challanIndex}`} className={`challan-sheet ${style.arrangement === "columns" ? "challan-columns" : "challan-stacked"}`} key={challan._id || challanIndex} style={{ width: `${geometry.width * 25.4 / 72}mm`, height: `${geometry.height * 25.4 / 72}mm`, aspectRatio: `${geometry.width} / ${geometry.height}`, padding: `${style.margin}mm`, page: `challan-page-${challanIndex}`, "--challan-accent": style.monochrome || style.design === "minimal" || style.design === "classic" ? "#111" : style.color, "--challan-border": `${style.borderWidth}pt`, "--challan-font": `${style.fontSize}pt`, "--challan-spacing": `${style.spacing}pt`, gap: `${geometry.gap * 25.4 / 72}mm` } as any}>
        {Array.from({ length: 3 }, (_, copyIndex) => <article data-design={style.design} data-monochrome={style.monochrome || style.design === "minimal"} className="challan-copy" key={copyIndex} style={{ width: `${geometry.panelWidth * 25.4 / 72}mm`, height: `${geometry.panelHeight * 25.4 / 72}mm` }}>
          <header className="challan-copy-heading"><div className="challan-school-brand">{school.logoUrl && style.logoPosition !== "hidden" && <img style={{ width: `${style.logoSize}mm`, height: `${style.logoSize}mm`, order: style.logoPosition === "right" ? 2 : 0 }} src={school.logoUrl} alt="School logo"/>}<div><b>{school.name || "School"}</b><strong>FEE CHALLAN VOUCHER</strong><small>{[school.branchName, school.address, school.phone].filter(Boolean).join(" · ")}</small></div></div><b className="challan-copy-label">{style.copyLabels[copyIndex]}</b></header>
          <div className="challan-meta">{meta.map(([a,b,c,d], i) => <div className="challan-meta-row" key={i}><b>{a}:</b><strong>{b}</strong><b>{c}:</b><strong>{d}</strong></div>)}</div>
          {(style.showStructure && challan.feeStructureTitle || challan.academicSession) && <p className="challan-context">{style.showStructure && challan.feeStructureTitle ? `Fee structure: ${challan.feeStructureTitle} · ` : ""}Session: {challan.academicSession || "-"}</p>}
          {freeLabel && <p className="challan-free-label">{freeLabel}</p>}
          <table className="challan-fees"><thead><tr><th>Particulars</th><th>Amount (PKR)</th></tr></thead><tbody>{feeRows}</tbody><tfoot><tr><th>{Number(challan.paidAmountPKR) > 0 ? "TOTAL CHARGES" : "Total Payable"}</th><th>{money(challan.totalAmountPKR)}</th></tr>{statusRows}</tfoot></table>
          {trulyFree && <p className="challan-free-status">Status: No Payment Required</p>}
          {latePolicy && <p className="challan-context">{latePolicy}</p>}
          {challan.earlyPaymentDiscount > 0 && !challan.paidAmountPKR && <p className="challan-context">Pay till {date(challan.earlyPaymentDeadline)} (-{money(challan.earlyPaymentDiscount)}): <b>{money(challan.amountPayableWithEarlyDiscount)}</b></p>}
          {bank?.enabled && [bank.bankName, bank.accountTitle, bank.accountNumber && `A/C ${bank.accountNumber}`, bank.iban && `IBAN ${bank.iban}`, bank.instructions].filter(Boolean).length > 0 && <p className="challan-context">{[bank.bankName, bank.accountTitle, bank.accountNumber && `A/C ${bank.accountNumber}`, bank.iban && `IBAN ${bank.iban}`, bank.instructions].filter(Boolean).join(" · ")}</p>}
          {(style.showSignatures || style.showStamp) && <p className="challan-signatures">{style.showSignatures && "Authorized signature __________________"} {style.showStamp && "Stamp __________________"}</p>}
        </article>)}
      </section>;
    })}
  </div>;
}
