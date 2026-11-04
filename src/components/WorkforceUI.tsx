"use client";

import {apiFetch} from "@/lib/api";

import {TableScroll} from "@/components/TableScroll";



import { printSchoolDocument } from "@/lib/print-school-document";

import { useState,useEffect,isValidElement } from "react";

import {RecordFilters,matchesRecordSearch} from "./RecordFilters";

export const field =

  "ui-field w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm";

export const button =

  "ui-primary-button rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

export const card = "ui-panel rounded-xl border border-zinc-200 bg-white p-5";

export const fmt = (n: any) =>

  (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString(undefined, {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  });

export const time = (s: any) =>

  s && !Number.isNaN(new Date(s).getTime())

    ? new Date(s).toLocaleTimeString("en-PK", {

        timeZone: "Asia/Karachi",

        hour: "2-digit",

        minute: "2-digit",

      })

    : "—";

export const roleLabel = (s: string) =>

  ({

    TEACHER: "Teacher",

    FINANCE: "Finance",

    EXAM_STAFF: "Examination",

    RECEPTIONIST: "Reception",

    SCHOOL_ADMIN: "School administrator",

  })[s] ||

  s?.replaceAll("_", " ") ||

  "—";

export const currentMonth = () =>

  new Intl.DateTimeFormat("en-CA", {

    timeZone: "Asia/Karachi",

    year: "numeric",

    month: "2-digit",

  }).format(new Date());

export function Text({

  label,

  value,

  onChange,

  type = "text",

  required = true,

  placeholder,

  help,

  min,

  max,

  minLength,

  maxLength,

}: any) {

  return (

    <label className="grid content-start gap-1.5 text-xs font-semibold text-zinc-700">

      {label}

      <input

        required={required}

        type={type}

        min={min}

        max={max}

        minLength={minLength}

        maxLength={maxLength}

        placeholder={

          placeholder ||

          (type === "number"

            ? "Enter amount or number"

            : "Enter " + label.toLowerCase())

        }

        value={value ?? ""}

        onChange={(e) => onChange(e.target.value)}

        className={

          field +

          " min-h-11 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"

        }

      />

      {help && (

        <span className="text-xs font-normal leading-relaxed text-zinc-500">

          {help}

        </span>

      )}

    </label>

  );

}

export function Select({

  label,

  value,

  onChange,

  options,

  empty = "Select an option",

  required = false,

}: any) {

  return (

    <label className="grid content-start gap-1.5 text-xs font-semibold text-zinc-700">

      {label}

      <select

        required={required}

        className={field + " min-h-11"}

        value={value || ""}

        onChange={(e) => onChange(e.target.value)}

      >

        <option value="">{empty}</option>

        {options.map((x: any) => (

          <option

            key={typeof x === "string" ? x : x.value}

            value={typeof x === "string" ? x : x.value}

          >

            {typeof x === "string" ? roleLabel(x) : x.label}

          </option>

        ))}

      </select>

    </label>

  );

}

function cellSearchText(value:any):string {if(value==null||typeof value==="boolean")return "";if(typeof value==="string"||typeof value==="number")return String(value);if(Array.isArray(value))return value.map(cellSearchText).join(" ");if(isValidElement(value)){const props=value.props as any;return cellSearchText(props.children);}return "";}

export function Table({ headers, rows, pageSize = 25, searchable=true }: any) {

  const numericColumn=(header:string)=>/amount|salary|\bpkr\b|gross|\bnet\b|deduction|balance|minutes|days|count|payable|worked|late min|^other$/i.test(header);

  const [search,setSearch]=useState("");

  const filtered=searchable?rows.filter((row:any[])=>matchesRecordSearch(row.map((cell:any,index:number)=>/action/i.test(headers[index]||"")?"":cellSearchText(cell)),search)):rows;

  const [page, setPage] = useState(1);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const active = Math.min(page, pages);

  return (

    <div className="ui-table-frame rounded-xl border border-zinc-200 bg-white">

      {searchable&&<RecordFilters search={search} onSearch={v=>{setSearch(v);setPage(1)}} placeholder="Search these records" count={filtered.length} total={rows.length} onReset={()=>{setSearch("");setPage(1)}}/>}

      <div

        className="overflow-x-auto"

        tabIndex={0}

        role="region"

        aria-label="Scrollable records table"

      >

        <TableScroll><table className="w-full text-left text-sm">

          <thead className="bg-zinc-50 text-xs text-zinc-600">

            <tr>

              {headers.map((x: string) => (

                <th

                  className={"whitespace-nowrap px-4 py-3 font-semibold "+(numericColumn(x)?"text-right":"text-left")}

                  key={x}

                >

                  {x}

                </th>

              ))}

            </tr>

          </thead>

          <tbody>

            {filtered

              .slice((active - 1) * pageSize, active * pageSize)

              .map((row: any[], i: number) => (

                <tr

                  className="border-t border-zinc-100 hover:bg-zinc-50/70"

                  key={i}

                >

                  {row.map((v: any, j: number) => (

                    <td className={"whitespace-nowrap px-4 py-3 align-top "+(numericColumn(headers[j])?"text-right tabular-nums":"text-left")} key={j}>

                      {v ?? "—"}

                    </td>

                  ))}

                </tr>

              ))}

          </tbody>

        </table></TableScroll>

      </div>

      {!filtered.length && (

        <p className="p-8 text-center text-sm text-zinc-500">

          No records match your selection.

        </p>

      )}

      {pages > 1 && (

        <div className="no-print flex items-center justify-between border-t p-3 text-xs text-zinc-600">

          <span>

            {filtered.length} records · Page {active} of {pages}

          </span>

          <div className="flex gap-3">

            <button

              disabled={active === 1}

              className="rounded border px-3 py-2 disabled:opacity-40"

              onClick={() => setPage(active - 1)}

            >

              Previous

            </button>

            <button

              disabled={active === pages}

              className="rounded border px-3 py-2 disabled:opacity-40"

              onClick={() => setPage(active + 1)}

            >

              Next

            </button>

          </div>

        </div>

      )}

    </div>

  );

}

export function Payslip({ record, onClose }: any) {

  const s = record.snapshot;

  const [payments,setPayments]=useState<any[]>([]),[paymentError,setPaymentError]=useState(""),[proofPreview,setProofPreview]=useState<{url:string;filename:string}|null>(null);

  useEffect(()=>{let live=true;apiFetch("/workforce/payroll/"+record._id+"/payments").then(r=>{if(live)setPayments(r.data)}).catch(e=>{if(live)setPaymentError(e.message)});return()=>{live=false}},[record._id]);
  useEffect(()=>()=>{if(proofPreview)URL.revokeObjectURL(proofPreview.url)},[proofPreview]);

  const paid=record.status==="PAID"?Math.max(0,s.netSalary+Number(record.allowance||0)-Number(record.otherDeduction||0)):Number(record.paidAmount||0),remaining=Math.max(0,s.netSalary+Number(record.allowance||0)-Number(record.otherDeduction||0)-paid);

  async function download(){try{const r=await apiFetch("/workforce/payroll/"+record._id+"/pdf");const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(r.data.file),c=>c.charCodeAt(0))],{type:r.data.mime}));const a=document.createElement("a");a.href=url;a.download=r.data.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e:any){setPaymentError(e.message)}}

  return (

    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/30 p-3 sm:p-8">

      <section

        id="workforce-payslip"

        className="mx-auto max-w-3xl rounded-xl bg-white p-6 sm:p-9"

      >

        <div className="no-print flex justify-end gap-3">

          <button

            className={button}

            onClick={() =>

              void printSchoolDocument(

                document.getElementById("workforce-payslip"),

              ).catch((e) => window.alert(e.message))

            }

          >

            Print / Save PDF

          </button>

          <button className={button} onClick={()=>void download()}>Download PDF</button><button onClick={onClose}>Close</button>

        </div>

        {s.school?.logoUrl&&<img src={s.school.logoUrl} alt="School logo" className="mt-4 h-14 max-w-40 object-contain"/>}
        <h1 className="mt-4 text-2xl font-semibold">

          {s.school?.name || "School"}

        </h1>

        <p className="text-sm text-zinc-500">

          {record.status === "PAID"

            ? "Salary payment receipt"

            : "Salary payslip"}{" "}

          · {record.month} · {record.reference}

        </p>

        <div className="my-6 grid grid-cols-2 gap-4 text-sm">

          <p>

            <b>{s.employee.name}</b>

            <br />

            {s.employee.employeeId}

            <br />

            {roleLabel(s.employee.role)} ·{" "}

            {s.employee.department || "Not configured"}

          </p>

          <p>

            Status: <b>{record.status}</b>

            <br />

            Payment date:{" "}

            {record.paidAt

              ? new Date(record.paidAt).toLocaleDateString()

              : "Not recorded"}

            <br />

            {record.paymentMethod} {record.paymentReference}

          </p>

        </div>

        <section className="my-5 grid gap-4 sm:grid-cols-2">{[

 {title:"Earnings",items:[["Base salary",fmt(s.baseSalary)+" PKR"],["Additional allowances",fmt(record.allowance)+" PKR"],["Salary basis",s.salaryBasis],["Gross salary",fmt(s.grossSalary+Number(record.allowance||0))+" PKR"]]},

 {title:"Deductions",items:[["Late deduction",fmt(s.lateDeduction)+" PKR"],["Absence deduction",fmt(s.absenceDeduction)+" PKR"],["Unpaid leave deduction",fmt(s.unpaidLeaveDeduction)+" PKR"],["Other deduction",fmt(record.otherDeduction)+" PKR"]]}

 ].map(section=><div key={section.title} className="rounded-md border p-4"><h2 className="mb-3 font-semibold">{section.title}</h2><dl className="space-y-3 text-sm">{section.items.map(([label,value])=><div key={label} className="flex justify-between gap-4"><dt className="text-zinc-500">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl></div>)}</section>

 <div className="my-5 flex flex-wrap items-center justify-between gap-3 border-y-2 border-red-600 bg-red-50 p-5"><h2 className="font-semibold">Net payable</h2><p className="text-2xl font-bold tabular-nums">PKR {fmt(Math.max(0,s.netSalary+Number(record.allowance||0)-Number(record.otherDeduction||0)))}</p></div>

 <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">{[["Payable days",s.payableDays],["Worked days",s.workedDays],["Paid / unpaid leave",s.paidLeave+" / "+s.unpaidLeave],["Late minutes",s.lateMinutes]].map(([label,value])=><div key={String(label)}><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>

        <p className="no-print my-5 text-xs text-zinc-500">

          Daily salary = effective monthly salary ÷ {s.payableDays} payable

          days. Late deduction = late minutes × daily salary ÷ configured

          working minutes. Acadivo records the external payment; it does not

          transfer money.

        </p>

        <div className="no-print">

          <h2 className="mb-3 mt-6 font-semibold">

            Attendance calculation details

          </h2>

          <Table

            headers={[

              "Date",

              "Status",

              "Source",

              "Late minutes",

              "Daily salary",

              "Working minutes",

              "Deduction",

            ]}

            rows={s.days.map((d: any) => [

              d.date,

              d.status,

              d.source,

              d.lateMinutes,

              fmt(d.dailySalary),

              d.workingMinutes,

              fmt(d.lateDeduction + d.absenceDeduction + d.unpaidDeduction),

            ])}

          />

        </div>

        <section className="my-5 rounded border p-4"><h2 className="font-semibold">Payment history</h2><p className="my-2 text-sm">Paid PKR {fmt(paid)} · Outstanding PKR {fmt(remaining)}</p>{paymentError&&<p role="alert" className="no-print text-sm text-red-700">{paymentError}</p>}{payments.length?<Table searchable={false} headers={["Date","Amount PKR","Method / reference","Recorded by","Proof"]} rows={payments.map(p=>[String(p.paidAt).slice(0,10),fmt(p.amount),p.method+" · "+(p.reference||"No reference"),p.paidByName,p.hasProof?<button key={p._id} className="no-print text-school-primary underline" onClick={async()=>{try{const r=await apiFetch(`/workforce/payroll/${record._id}/payments/${p._id}/proof`);const mime=String(r.data.mime);if(!["image/png","image/jpeg","image/webp"].includes(mime))throw new Error("This payment proof is not a supported image.");const extension=({"image/png":"png","image/jpeg":"jpg","image/webp":"webp"} as Record<string,string>)[mime];const url=URL.createObjectURL(new Blob([Uint8Array.from(atob(r.data.file),c=>c.charCodeAt(0))],{type:mime}));setProofPreview({url,filename:`salary-proof-${p._id}.${extension}`})}catch(e:any){setPaymentError(e.message)}}}>View proof</button>:<span className="text-zinc-500">No proof attached</span>])}/>:<p className="text-sm text-zinc-500">{record.status==="PAID"?"Historical payment; separate transaction history is unavailable.":"No salary payment recorded."}</p>}</section>

        <div className="mt-10 grid grid-cols-2 gap-12 text-xs text-zinc-600">

          <div className="border-t pt-3">

            Authorized by / signature

            <br />

            {record.approvedByName || "School administration"}

          </div>

          <div className="border-t pt-3">Employee acknowledgement</div>

        </div>

      </section>

      {proofPreview&&<div className="no-print fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Salary payment proof"><section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4 shadow-2xl sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Salary payment proof</h2><div className="flex gap-2"><a className={button+" inline-flex items-center"} href={proofPreview.url} download={proofPreview.filename}>Download image</a><button className="rounded-lg border px-4 py-2 text-sm" onClick={()=>setProofPreview(null)}>Close</button></div></div><img src={proofPreview.url} alt="Uploaded salary payment proof" className="mx-auto max-h-[75vh] max-w-full object-contain"/></section></div>}

    </div>

  );

}



export function PayrollTable({ rows, onView, onAction, payOnly = false, allowPay = false, searchable = true }: any) {

  return (

    <Table searchable={searchable}

      headers={[

        "Employee / month",

        "Department",

        "Base PKR",

        "Payable / worked",

        "Paid / unpaid leave",

        "Late min",

        "Late / absence / unpaid deduction",

        "Other",

        "Allowances",
        "Gross",

        "Net",

        "Paid / remaining PKR",

        "Last payment date",
        "Status",

        "Actions",

      ]}

      rows={rows.map((r: any) => [

        r.snapshot.employee.name + " · " + r.month,

        r.snapshot.employee.department,

        fmt(r.snapshot.baseSalary),

        r.snapshot.payableDays + " / " + r.snapshot.workedDays,

        r.snapshot.paidLeave + " / " + r.snapshot.unpaidLeave,

        r.snapshot.lateMinutes,

        [

          r.snapshot.lateDeduction,

          r.snapshot.absenceDeduction,

          r.snapshot.unpaidLeaveDeduction,

        ]

          .map(fmt)

          .join(" / "),

        fmt(r.otherDeduction),

        fmt(r.allowance),
        fmt(r.snapshot.grossSalary+Number(r.allowance||0)),

        fmt(Math.max(0, r.snapshot.netSalary + Number(r.allowance||0) - r.otherDeduction)),

        fmt(r.status==="PAID"?Math.max(0,r.snapshot.netSalary+Number(r.allowance||0)-r.otherDeduction):r.paidAmount||0)+" / "+fmt(r.status==="PAID"?0:Math.max(0,r.snapshot.netSalary+Number(r.allowance||0)-r.otherDeduction-(r.paidAmount||0))),

        r.paidAt?String(r.paidAt).slice(0,10):"Not paid",
        <span key={r._id+"-status"} className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${r.status==="PAID"?"border-emerald-200 bg-emerald-50 text-emerald-800":r.status==="PARTIALLY_PAID"?"border-amber-200 bg-amber-50 text-amber-900":"border-zinc-200 bg-zinc-50 text-zinc-700"}`}>{r.status.replaceAll("_"," ")}</span>,

        <div key={r._id} className="ui-table-actions">

          <button className="text-brand-600" onClick={() => onView(r)}>

            Details / Payslip

          </button>

          {onAction && (

            <div className="flex flex-nowrap gap-2">

              {(["CALCULATED", "PENDING"].includes(r.status) ? ["ADJUST"] : [])

                .concat(

                  r.status === "CALCULATED"

                    ? ["SUBMIT"]

                    : r.status === "PENDING"

                      ? ["APPROVE"]

                      : ["APPROVED","PARTIALLY_PAID"].includes(r.status)

                        ? ["PAY"]

                        : [],

                )

                .filter((a) => (!payOnly || a === "PAY")&&(a!=="PAY"||allowPay))

                .map((a) => (

                  <button

                    className="rounded border p-1"

                    key={a}

                    onClick={() => onAction(r, a)}

                  >

                    {

                      (

                        {

                          PAY: "Pay Salary",

                          ADJUST: "Adjust deduction",

                          SUBMIT: "Submit for approval",

                          APPROVE: "Approve",

                        } as any

                      )[a]

                    }

                  </button>

                ))}

            </div>

          )}

        </div>,

      ])}

    />

  );

}



export function PayrollReport({ rows, month, onClose }: any) {

  const total = rows.reduce(

    (n: number, r: any) =>

      n + Math.max(0, r.snapshot.netSalary + Number(r.allowance||0) - r.otherDeduction),

    0,

  );

  return (

    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/40 p-3 sm:p-8">

      <article

        id="payroll-report"

        className="mx-auto max-w-4xl rounded-xl bg-white p-6 sm:p-9"

      >

        <div className="no-print flex justify-end gap-3">

          <button

            className={button}

            onClick={() =>

              void printSchoolDocument(

                document.getElementById("payroll-report"),

              ).catch((e) => window.alert(e.message))

            }

          >

            Print / Save PDF

          </button>

          <button onClick={onClose}>Close</button>

        </div>

        <header className="my-6 border-b-2 border-red-600 pb-5">

          <h1 className="text-2xl font-semibold">

            {rows[0]?.snapshot.school?.name || "School payroll"}

          </h1>

          <h2 className="mt-2 font-semibold">

            Monthly payroll register · {month}

          </h2>

          <p className="mt-2 text-sm text-zinc-600">

            {rows.length} employees · Net payable PKR {fmt(total)}

          </p>

          <p className="text-xs text-zinc-500">

            Includes the employees matching your current filters. Payment status

            records external payments.

          </p>

        </header>

        <Table

          pageSize={Math.max(1, rows.length)}

          headers={[

            "Employee / ID",

            "Role / department",

            "Gross PKR",

            "Deductions PKR",

            "Net PKR",

            "Status",

          ]}

          rows={rows.map((r: any) => [

            <span key={r._id}>

              {r.snapshot.employee.name}

              <br />

              <small>{r.snapshot.employee.employeeId}</small>

            </span>,

            roleLabel(r.snapshot.employee.role) +

              " · " +

              (r.snapshot.employee.department || "Not configured"),

            fmt(r.snapshot.grossSalary+Number(r.allowance||0)),

            fmt(

              r.snapshot.lateDeduction +

                r.snapshot.absenceDeduction +

                r.snapshot.unpaidLeaveDeduction +

                r.otherDeduction,

            ),

            fmt(Math.max(0, r.snapshot.netSalary + Number(r.allowance||0) - r.otherDeduction)),

            r.status,

          ])}

        />

        <footer className="mt-10 grid grid-cols-2 gap-12 text-xs">

          <p className="border-t pt-3">Prepared by / signature</p>

          <p className="border-t pt-3">Authorized by / school stamp</p>

        </footer>

      </article>

    </div>

  );

}
