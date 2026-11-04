"use client";

import {WorkspaceDialog,WorkspaceTabs,workspacePrimary,workspaceSecondary} from "./WorkspaceDialog";

import {matchesRecordSearch} from "./RecordFilters";

import { StaffAvatar } from "@/components/StudentAvatar";

import { confirmAction } from "./ConfirmationHost";

import { Presence } from "@/components/Motion";

import { PageHeading } from "@/components/ProductUI";



import { useCallback, useEffect, useState, useRef } from "react";

import { apiFetch } from "@/lib/api";

import { useAuth } from "@/lib/auth-context";

import { AttendanceSetup } from "./StaffAttendanceWorkspace";

import {

  Text,

  Select,

  roleLabel,

  Table,

  PayrollTable,

  PayrollReport,

  Payslip,

  field,

  card,

  button,

  time,

  fmt,

  currentMonth,

} from "./WorkforceUI";

import StaffMonthlyMatrix from "./StaffMonthlyMatrix";

import DeviceManager from "./BiometricDevices";

import {SalaryHistoryDialog} from "./SalaryHistoryDialog";

export default function StaffAdminWorkspace({

  tab = "attendance",

  finance = false,

}: any) {

  const { user } = useAuth();
  const canRecordSalaryPayment = (finance && user?.permissions?.includes("payroll.pay")) || (user?.userType === "SCHOOL_ADMIN" && user?.permissions?.includes("payroll.manage"));

  const [salaryHistory,setSalaryHistory]=useState<any>(null),[notice,setNotice]=useState(""),[loading,setLoading]=useState(false);

  const [payrollView,setPayrollView]=useState("register"),[calculateOpen,setCalculateOpen]=useState(false),[holidayOpen,setHolidayOpen]=useState(false),[calendarEditing,setCalendarEditing]=useState(false),[calendarKind,setCalendarKind]=useState("");

  const [month, setMonth] = useState(currentMonth),

    [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)),

    [monthly, setMonthly] = useState(false),

    [rows, setRows] = useState<any[]>([]),

    [summary, setSummary] = useState<any>({}),

    [employees, setEmployees] = useState<any[]>([]),

    [calendar, setCalendar] = useState<any[]>([]),

    [error, setError] = useState(""),

    [busy, setBusy] = useState(false),

    [slip, setSlip] = useState<any>(null);

  const [filters, setFilters] = useState<any>({

      employeeId: "",

      role: "",

      department: "",

      status: "",

      source: "",

    }),

    [editing, setEditing] = useState<any>(null),

    [holiday, setHoliday] = useState<any>({

      date: "",

      title: "",

      kind: "CLOSURE",

      reason: "",

    });

  const [report, setReport] = useState(false);

  const [mode, setMode] = useState<string | null>(null),

    [departments, setDepartments] = useState<any[]>([]),

    [search, setSearch] = useState(""),

    [paymentAction, setPaymentAction] = useState<any>(null);

  const [salaryChange,setSalaryChange]=useState(false);

  useEffect(()=>setSalaryChange(false),[editing?.userId]);

  const [salaryPage,setSalaryPage]=useState(1),[employmentStatus,setEmploymentStatus]=useState("");

  useEffect(()=>setSalaryPage(1),[search,filters.role,filters.department,employmentStatus]);

  const generation = useRef(0);

  const load = useCallback(async () => {

    const current = ++generation.current;

    setLoading(true);

    setError("");

    try {

      if (tab === "payroll") {

        const query = new URLSearchParams({ month });

        for (const k of ["employeeId", "role", "department", "status"])

          if (filters[k]) query.set(k, filters[k]);

        const r = await apiFetch("/workforce/payroll?" + query);

        if (current === generation.current) setRows(r.data);

      } else if (tab === "calendar") {

        const r = await apiFetch("/workforce/calendar?month=" + month);

        if (current === generation.current) setCalendar(r.data);

      } else if (tab === "attendance") {

        const query = new URLSearchParams(monthly ? { month } : { date });

        for (const [k, v] of Object.entries(filters))

          if (v) query.set(k, String(v));

        const r = await apiFetch("/workforce/attendance?" + query);

        if (current === generation.current) {

          setRows(r.data.rows);

          setSummary(r.data.summary);

        }

      }

    } catch (e: any) {

      if(current===generation.current)setError(e.message);

    } finally {if(current===generation.current)setLoading(false)}

  }, [tab, month, date, monthly, filters, finance]);

  useEffect(() => {

    setRows([]);

    setEditing(null);

    void load();

  }, [load, user?.branchId]);

  useEffect(()=>{let live=true;setEmployees([]);if(!finance)Promise.all([apiFetch("/workforce/employees"),apiFetch("/workforce/settings"),apiFetch("/workforce/departments")]).then(([e,c,d])=>{if(live){setEmployees(e.data);setMode(c.data.mode);setDepartments(d.data)}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[finance,user?.branchId]);

  async function request(endpoint: string, body: any, method = "POST") {

    if (busy) return;

    setBusy(true);

    try {

      await apiFetch("/workforce/" + endpoint, {

        method,

        body: JSON.stringify(body),

      });

      setEditing(null);

      await load();

      if(tab==="salaries")setEmployees((await apiFetch("/workforce/employees")).data);

      return true;

    } catch (e: any) {

      setError(e.message);

      return false;

    } finally {

      setBusy(false);

    }

  }

  async function action(record: any, kind: string) {
    if (kind === "PAY" && !canRecordSalaryPayment) return;

    if (

      finance &&

      (kind !== "PAY" || !user?.permissions?.includes("payroll.pay"))

    )

      return;

    setPaymentAction({

      record,

      kind,

      amount: String(kind==="PAY"?Math.max(0,record.snapshot.netSalary+Number(record.allowance||0)-Number(record.otherDeduction||0)-Number(record.paidAmount||0)):record.otherDeduction || 0),

      allowance:String(record.allowance||0),

      requestId:crypto.randomUUID(),

      paidAt:new Date().toISOString().slice(0,10),

      notes:"",proof:"",

      reason: "",

      method: "Bank Transfer / Online",

      reference: "",

    });

  }

  const departmentOptions = Array.from(

    new Set(

      [

        ...departments.map((d) => d.name),

        ...employees.map((u) => u.employment?.department),

        ...rows.map((r) => r.snapshot?.employee?.department),

      ].filter(Boolean),

    ),

  ).sort();

  const roleOptions = [

    "TEACHER",

    "FINANCE",

    "EXAM_STAFF",

    "RECEPTIONIST",

    "SCHOOL_ADMIN",

  ];

  const employmentByUser=new Map(employees.map(u=>[String(u._id),u.employment]));

  const visibleRows=rows.filter(r=>matchesRecordSearch([r.employee?.name,r.employee?.email,employmentByUser.get(String(r.employee?._id||r.employeeId))?.employeeId,r.department,r.snapshot?.employee?.name,r.snapshot?.employee?.employeeId,r.snapshot?.employee?.department],search));

  const visibleEmployees = employees.filter(

    (u) =>

      (!search ||

        [u.name, u.email, u.employment?.employeeId]

          .join(" ")

          .toLowerCase()

          .includes(search.toLowerCase())) &&

      (!filters.role || u.userType === filters.role) &&

      (!filters.department || u.employment?.department === filters.department) && (!employmentStatus||u.employment?.status===employmentStatus),

  );

  if (tab === "settings") return <AttendanceSetup />;

  if (tab === "devices") return <DeviceManager />;

  return (

    <div className="space-y-5">

      <PageHeading

        eyebrow="People & operations"

        title={

          tab === "payroll"

            ? "Monthly payroll"

            : tab === "salaries"

              ? "Staff salaries"

              : tab === "calendar"

                ? "School calendar"

                : "Staff attendance"

        }

        description="Records follow the selected branch. Amounts are in PKR."

      />

      <div className="no-print flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-sm leading-6 text-zinc-500">{tab==="attendance"?"Choose a daily or monthly register, then filter employees. Corrections open separately and are audited.":tab==="payroll"?"Filter the register, view totals, calculate the month or print a report.":tab==="salaries"?"Find an employee and open their employment and salary details.":"Manage holidays and working-day exceptions. Approved payroll periods remain locked."}</p><div className="flex flex-wrap gap-2">{tab==="attendance"&&<button className={workspacePrimary} onClick={()=>setEditing({employeeId:"",date,status:"PRESENT",checkIn:"",checkOut:"",reason:""})}>Mark / correct attendance</button>}{tab==="payroll"&&<><button className={workspaceSecondary} disabled={!visibleRows.length} onClick={()=>setReport(true)}>Print filtered register</button>{!finance&&<button disabled={busy} className={workspacePrimary} onClick={()=>setCalculateOpen(true)}>Calculate payroll</button>}</>}{tab==="calendar"&&<button className={workspacePrimary} onClick={()=>{setCalendarEditing(false);setHoliday({date:"",title:"",kind:"CLOSURE",reason:""});setHolidayOpen(true)}}>Add calendar day</button>}</div></div>

      {tab==="payroll"&&finance&&!user?.permissions?.includes("payroll.pay")&&<p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Salary payment access is disabled for this Finance account.</strong> Ask the School Admin to enable it under Staff &amp; roles → Finance salary payment access, then refresh this portal. Separately, payroll must show <em>Approved</em> before it can be paid.</p>}
      {tab==="payroll"&&<WorkspaceTabs value={payrollView} onChange={setPayrollView} tabs={[{value:"register",label:"Employee register"},{value:"totals",label:"Payroll totals"}]}/>}

      {salaryHistory&&<SalaryHistoryDialog employee={salaryHistory} onClose={()=>setSalaryHistory(null)} onView={r=>{setSalaryHistory(null);setSlip(r)}}/>}

      {notice&&<p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}

      {loading&&<p role="status" className="text-sm text-zinc-500">Loading selected records…</p>}

      {calculateOpen&&<WorkspaceDialog title="Calculate monthly payroll" onClose={()=>setCalculateOpen(false)} busy={busy} description="This refreshes eligible employees for the whole month. Register search and display filters do not limit the calculation."><div className="space-y-4"><Text label="Payroll month" type="month" value={month} onChange={setMonth}/><p className="text-sm leading-6 text-zinc-600">Approved and paid payroll keeps its existing protections. Current-month figures are provisional until month end.</p>{error&&<p role="alert" className="text-sm text-red-800">{error}</p>}<div className="flex justify-end gap-3"><button className={workspaceSecondary} disabled={busy} onClick={()=>setCalculateOpen(false)}>Cancel</button><button className={workspacePrimary} disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);setError("");setNotice("");try{const r=await apiFetch("/workforce/payroll/calculate",{method:"POST",body:JSON.stringify({month})});setCalculateOpen(false);setPayrollView("register");setSearch("");setNotice(month+": "+r.data.calculated+" payroll records calculated/refreshed. Results are in the employee register below. Approved and paid records remain protected.");if(Object.values(filters).some(Boolean))setFilters({employeeId:"",role:"",department:"",status:"",source:""});else await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>{busy?"Calculating...":"Calculate month"}</button></div></div></WorkspaceDialog>}

      {error && (

        <p

          role="alert"

          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"

        >

          {error}

        </p>

      )}

      <div

        className={

          card +

          " ui-data-toolbar no-print grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4"

        }

      >

        {tab === "attendance" && (

          <Select

            label="Attendance view"

            value={monthly ? "month" : "day"}

            empty="Choose view"

            options={[

              { value: "day", label: "Daily register" },

              { value: "month", label: "Monthly register" },

            ]}

            onChange={(v: string) => setMonthly(v === "month")}

          />

        )}

        {tab !== "salaries" && (tab !== "attendance" || monthly) ? (

          <Text label="Month" type="month" value={month} onChange={setMonth} />

        ) : tab === "attendance" ? (

          <Text

            label="Attendance date"

            type="date"

            value={date}

            onChange={setDate}

          />

        ) : null}

        {["attendance", "payroll", "salaries"].includes(tab) && (

          <>

            <Text

              label="Search employees"

              placeholder="Search name or employee ID"

              required={false}

              value={search}

              onChange={setSearch}

            />

            <Select

              label="Department"

              empty="All departments"

              value={filters.department}

              options={departmentOptions}

              onChange={(v: string) =>

                setFilters({ ...filters, department: v })

              }

            />

            <Select

              label="Role"

              empty="All roles"

              value={filters.role}

              options={roleOptions}

              onChange={(v: string) => setFilters({ ...filters, role: v })}

            />

          </>

        )}

        {["attendance", "payroll"].includes(tab) && (

          <Select

            label="Employee"

            empty="All employees"

            value={filters.employeeId}

            options={(finance

              ? Array.from(

                  new Map(

                    rows.map((r) => [

                      r.employeeId,

                      { _id: r.employeeId, name: r.snapshot.employee.name },

                    ]),

                  ).values(),

                )

              : employees

            ).map((u) => ({ value: u._id, label: u.name }))}

            onChange={(v: string) => setFilters({ ...filters, employeeId: v })}

          />

        )}

        {["attendance", "payroll"].includes(tab) && (

          <Select

            label="Status"

            empty="All statuses"

            value={filters.status}

            options={

              tab === "payroll"

                ? ["CALCULATED", "PENDING", "APPROVED", "PARTIALLY_PAID", "PAID"]

                : ["PRESENT", "LATE", "ABSENT", "LEAVE", "OFF"]

            }

            onChange={(v: string) => setFilters({ ...filters, status: v })}

          />

        )}

        {tab === "attendance" && mode === "BIOMETRIC" && (

          <Select

            label="Attendance source"

            empty="All sources"

            value={filters.source}

            options={["MANUAL", "BIOMETRIC"]}

            onChange={(v: string) => setFilters({ ...filters, source: v })}

          />

        )}

      </div>

      {tab === "attendance" && (

        <>

          <div className="grid gap-3 sm:grid-cols-4">

            {Object.entries(summary).map(([k, v]) => (

              <div className={card} key={k}>

                <p className="text-xs text-zinc-500">

                  {k.replace(/([A-Z])/g, " $1")}

                </p>

                <p className="mt-2 text-2xl font-semibold">{String(v)}</p>

              </div>

            ))}

          </div>

          {monthly && <StaffMonthlyMatrix month={month} rows={visibleRows} />}

          {!monthly&&<section>

            <Table searchable={false}

              headers={[

                "Employee",

                "Role",

                "Date",

                "Department",

                "Scheduled start",

                "Check-in",

                "Check-out",

                "Working min",

                "Late min",

                "Source",

                "Status",

                ...(user?.features?.includes("FINANCE")

                  ? ["Daily deduction"]

                  : []),

              ]}

              rows={visibleRows.map((r) => [

                <span key={r._id} className="inline-flex items-center gap-2">

                  <StaffAvatar staff={r.employee} />

                  {r.employee.name}

                </span>,

                roleLabel(r.employee.userType),

                r.date,

                r.department,

                time(r.scheduledStart),

                time(r.checkedInAt),

                time(r.checkedOutAt),

                r.workingMinutes,

                r.lateMinutes,

                r.source,

                r.status,

                ...(user?.features?.includes("FINANCE")

                  ? [fmt(r.dailyDeduction)]

                  : []),

              ])}

            />

          </section>}

          {editing && (

            <WorkspaceDialog title="Mark or correct staff attendance" description="Choose the employee and date. Every correction requires a reason and remains in the audit history." busy={busy} onClose={()=>setEditing(null)} wide>{error&&<p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}

            <form

              className={card + " grid gap-3 sm:grid-cols-2"}

              onSubmit={(e) => {

                e.preventDefault();

                const { checkIn, checkOut, ...rest } = editing;

                void request("attendance/correct", {

                  ...rest,

                  ...(checkIn

                    ? { checkedInAt: new Date(checkIn).toISOString() }

                    : {}),

                  ...(checkOut

                    ? { checkedOutAt: new Date(checkOut).toISOString() }

                    : {}),

                });

              }}

            >

              <div className="sm:col-span-2"><Text label="Find employee" required={false} value={search} placeholder="Employee name, email or ID" onChange={setSearch}/></div>

              <label className="text-xs">

                Employee

                <select

                  required

                  className={field}

                  value={editing.employeeId}

                  onChange={(e) =>

                    setEditing({ ...editing, employeeId: e.target.value })

                  }

                >

                  <option value="">Choose employee</option>

                  {visibleEmployees.slice((Math.min(salaryPage,Math.max(1,Math.ceil(visibleEmployees.length/20)))-1)*20,Math.min(salaryPage,Math.max(1,Math.ceil(visibleEmployees.length/20)))*20).map((u) => (

                    <option key={u._id} value={u._id}>

                      {u.name} · {u.userType}

                    </option>

                  ))}

                </select>

              </label>

              {[

                ["date", "Date", "date"],

                ["checkIn", "Check-in (browser timezone)", "datetime-local"],

                ["checkOut", "Check-out (browser timezone)", "datetime-local"],

                ["reason", "Correction reason", "text"],

              ].map(([k, l, t]) => (

                <Text

                  key={k}

                  required={!["checkIn", "checkOut"].includes(k)}

                  label={l}

                  type={t}

                  value={editing[k]}

                  onChange={(v: string) => setEditing({ ...editing, [k]: v })}

                />

              ))}



<label className="grid content-start gap-1.5 text-xs font-semibold">Attendance status              <select

                aria-label="Attendance status"

                className={field}

                value={editing.status}

                onChange={(e) =>

                  setEditing({ ...editing, status: e.target.value })

                }

              >

                {["PRESENT", "LATE", "ABSENT", "LEAVE"].map((x) => (

                  <option key={x}>{x}</option>

                ))}

              </select></label>

              <button disabled={busy} className={button}>

                Save audited correction

              </button>

            </form></WorkspaceDialog>

          )}

        </>

      )}

      {tab === "salaries" && (

        <>

          <div className="flex flex-wrap items-end justify-between gap-3"><Select label="Employment status" empty="All employment statuses" value={employmentStatus} options={["ACTIVE","ENDED"]} onChange={setEmploymentStatus}/><p className="text-xs text-zinc-500">{visibleEmployees.length} employees match</p></div>

          <div className="grid gap-4 sm:grid-cols-2">

            {visibleEmployees.map((u) => (

              <div className={card} key={u._id}>

                <span className="inline-flex items-center gap-2">

                  <StaffAvatar staff={u} />

                  <b>{u.name}</b>

                </span>

                <p className="text-xs text-zinc-500">

                  {roleLabel(u.userType)} ·{" "}

                  {u.employment?.department || "Department not configured"}

                </p>

                <p className="mt-2 text-xs text-zinc-500">Employee ID: {u.employment?.employeeId||"Not configured"}</p>

                <p className="my-3 border-l-2 border-red-500 bg-zinc-50 p-3 text-base font-semibold">

                  {u.employment?.salaryHistory?.length

                    ? "Latest base: PKR " +

                      fmt(u.employment.salaryHistory.at(-1).amount)

                    : "Salary not configured"}

                </p>

                <button

                  className={button}

                  onClick={() =>

                    setEditing({

                      userId: u._id,

                      employeeId: u.employment?.employeeId || String(u._id),

                      department: u.employment?.department || "",

                      designation: u.employment?.designation || "",

                      joiningDate: u.employment?.joiningDate || date,

                      leavingDate: u.employment?.leavingDate || "",

                      status: u.employment?.status || "ACTIVE",

                      schedule: u.employment?.schedule || {

                        startTime: "09:00",

                        endTime: "17:00",

                        workingMinutes: 480,

                        teacherStart: "SHIFT",

                      },

                      salary: {

                        effectiveDate: date,

                        amount: u.employment?.salaryHistory?.at(-1)?.amount || 0,

                        basis: "MONTHLY",

                      },

                    })

                  }

                >

                  Edit employment / salary

                </button>

                <button type="button" className={workspaceSecondary+" mt-3"} onClick={()=>setSalaryHistory(u)}>View salary history</button>

              </div>

            ))}

          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500"><span>Page {Math.min(salaryPage,Math.max(1,Math.ceil(visibleEmployees.length/20)))} / {Math.max(1,Math.ceil(visibleEmployees.length/20))}</span><div className="flex gap-2"><button className={workspaceSecondary} disabled={salaryPage<=1} onClick={()=>setSalaryPage(p=>p-1)}>Previous</button><button className={workspaceSecondary} disabled={salaryPage*20>=visibleEmployees.length} onClick={()=>setSalaryPage(p=>p+1)}>Next</button></div></div>

          {editing&&<WorkspaceDialog title={employees.find(u=>u._id===editing.userId)?.name||"Employment and salary"} description="Review employment details and working hours. Choose Add a salary change only when updating pay." onClose={()=>setEditing(null)} busy={busy} wide>{error&&<p role="alert" className="mb-4 text-sm text-red-800">{error}</p>}

                <form

                  className={

                    "grid items-start gap-4 sm:grid-cols-3"

                  }

                  onSubmit={(e) => {

                    e.preventDefault();

                    const { userId, leavingDate, salary, ...body } = editing;

                    void request(

                      "employees/" + userId,

                      { ...body, ...(salaryChange?{salary}:{}), ...(leavingDate ? { leavingDate } : {}) },

                      "PUT",

                    );

                  }}

                >

                  {[

                    ["designation", "Designation", "text"],

                    ["joiningDate", "Joining date", "date"],

                    ["leavingDate", "Leaving date", "date"],

                  ].map(([k, l, t]) => (

                    <Text

                      key={k}

                      label={l}

                      type={t}

                      required={k !== "leavingDate"}

                      value={editing[k]}

                      onChange={(v: string) =>

                        setEditing({ ...editing, [k]: v })

                      }

                    />

                  ))}

                  <Select

                    label="Department"

                    required

                    empty="Select department"

                    value={editing.department}

                    options={departmentOptions}

                    onChange={(v: string) =>

                      setEditing({ ...editing, department: v })

                    }

                  />

<label className="grid content-start gap-1.5 text-xs font-semibold">Employment status                  <select

                    aria-label="Employment status"

                    className={field}

                    value={editing.status}

                    onChange={(e) =>

                      setEditing({ ...editing, status: e.target.value })

                    }

                  >

                    {["ACTIVE", "ENDED"].map((x) => (

                      <option key={x}>{x}</option>

                    ))}

                  </select></label>

                  {[

                    ["startTime", "Shift start", "time"],

                    ["endTime", "Shift end", "time"],

                    ["workingMinutes", "Working minutes", "number"],

                  ].map(([k, l, t]) => (

                    <Text

                      key={k}

                      label={l}

                      type={t}

                      value={editing.schedule[k]}

                      onChange={(v: string) =>

                        setEditing({

                          ...editing,

                          schedule: {

                            ...editing.schedule,

                            [k]: t === "number" ? Number(v) : v,

                          },

                        })

                      }

                    />

                  ))}

                  <label className="grid content-start gap-1.5 text-xs font-semibold">Teacher attendance starts<select

                    className={field}

                    value={editing.schedule.teacherStart}

                    onChange={(e) =>

                      setEditing({

                        ...editing,

                        schedule: {

                          ...editing.schedule,

                          teacherStart: e.target.value,

                        },

                      })

                    }

                  >

                    <option value="SHIFT">Shift start</option>

                    <option value="FIRST_CLASS">First scheduled class</option>

                  </select></label>

                  <div className="border-t pt-4 sm:col-span-3"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={salaryChange} onChange={e=>setSalaryChange(e.target.checked)}/>Add a salary change</label><p className="mt-2 text-xs leading-5 text-zinc-500">Leave this off to update employment details without adding or changing salary history.</p></div>

                  {salaryChange&&<>

                  <Text

                    label="Salary effective date"

                    type="date"

                    value={editing.salary.effectiveDate}

                    onChange={(v: string) =>

                      setEditing({

                        ...editing,

                        salary: { ...editing.salary, effectiveDate: v },

                      })

                    }

                  />

                  <Text

                    label="New base salary (PKR)"

                    help="Enter the amount effective from the selected date; this adds salary history."

                    type="number"

                    value={editing.salary.amount}

                    onChange={(v: string) =>

                      setEditing({

                        ...editing,

                        salary: { ...editing.salary, amount: Number(v) },

                      })

                    }

                  />

                  <label className="grid content-start gap-1.5 text-xs font-semibold">Pay basis<select

                    className={field}

                    value={editing.salary.basis}

                    onChange={(e) =>

                      setEditing({

                        ...editing,

                        salary: { ...editing.salary, basis: e.target.value },

                      })

                    }

                  >

                    {["MONTHLY", "DAILY", "HOURLY"].map((x) => (

                      <option key={x}>{x}</option>

                    ))}

                  </select></label>

                  </>}

                  <button disabled={busy} className={button}>

                    {salaryChange?"Save employment and salary change":"Save employment details"}

                  </button>

                </form></WorkspaceDialog>}

        </>

      )}

      {tab==="calendar"&&<><div className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2"><Text label="Search calendar" required={false} placeholder="Holiday title, date or reason" value={search} onChange={setSearch}/><Select label="Day type" empty="All day types" value={calendarKind} options={[{value:"CLOSURE",label:"School closure"},{value:"PAID_HOLIDAY",label:"Paid holiday"},{value:"UNPAID_HOLIDAY",label:"Unpaid holiday"},{value:"SPECIAL_WORKING",label:"Special working day"}]} onChange={setCalendarKind}/></div><Table searchable={false} headers={["Date","Calendar day","Day type","Reason","Actions"]} rows={calendar.filter(h=>(!calendarKind||h.kind===calendarKind)&&matchesRecordSearch([h.date,h.title,h.reason],search)).map(h=>[h.date,h.title,({CLOSURE:"School closure",PAID_HOLIDAY:"Paid holiday",UNPAID_HOLIDAY:"Unpaid holiday",SPECIAL_WORKING:"Special working day"} as any)[h.kind],h.reason||"Not provided",<div key={h._id} className="flex gap-2"><button className={workspaceSecondary} onClick={()=>{setCalendarEditing(true);setHoliday({date:h.date,title:h.title,kind:h.kind,reason:h.reason||""});setHolidayOpen(true)}}>Edit</button><button className={workspaceSecondary} disabled={busy} onClick={async()=>{if(!(await confirmAction("Remove this calendar exception? Payroll locks still apply.")))return;setBusy(true);try{await apiFetch("/workforce/calendar/"+h._id,{method:"DELETE"});await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>Remove</button></div>])}/>{holidayOpen&&<WorkspaceDialog title={calendarEditing?"Edit calendar day":"Add calendar day"} onClose={()=>setHolidayOpen(false)} busy={busy} description="Calendar exceptions control attendance expectations and payroll days. Exam dates stay in the examination timetable."><form className="space-y-5" onSubmit={async e=>{e.preventDefault();if(await request("calendar",holiday))setHolidayOpen(false)}}><div className="grid items-start gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold">Date<input type="date" required disabled={calendarEditing} value={holiday.date} onChange={e=>setHoliday({...holiday,date:e.target.value})} className={field+" min-h-11"}/></label><Text label="Day title" placeholder="e.g. Eid holiday or weather closure" value={holiday.title} onChange={(title:string)=>setHoliday({...holiday,title})}/><Select label="Day type" value={holiday.kind} required options={[{value:"CLOSURE",label:"School closure"},{value:"PAID_HOLIDAY",label:"Paid holiday"},{value:"UNPAID_HOLIDAY",label:"Unpaid holiday"},{value:"SPECIAL_WORKING",label:"Special working day"}]} onChange={(kind:string)=>setHoliday({...holiday,kind})}/><Text label="Reason" required={false} placeholder="e.g. Public holiday or severe weather" value={holiday.reason} onChange={(reason:string)=>setHoliday({...holiday,reason})}/></div><p className="rounded-md border bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">{holiday.kind==="UNPAID_HOLIDAY"?"An unpaid non-working day. The existing payroll policy applies its unpaid-day deduction.":holiday.kind==="SPECIAL_WORKING"?"A working-day exception, including a normally weekly-off date. Attendance is expected.":"Attendance is not expected. This date is excluded from working-day attendance and absence calculations."}{calendarEditing&&" The date is fixed; edit the title, type or reason."}</p>{error&&<p role="alert" className="text-sm text-red-800">{error}</p>}<footer className="flex justify-end gap-3"><button type="button" className={workspaceSecondary} disabled={busy} onClick={()=>setHolidayOpen(false)}>Cancel</button><button className={workspacePrimary} disabled={busy}>{busy?"Saving...":"Save calendar day"}</button></footer></form></WorkspaceDialog>}</>}

      {tab === "payroll" && (

        <>

          <p className="text-xs text-zinc-500">

            {rows.filter((r) => r.status === "CALCULATED").length} calculated ·{" "}

            {rows.filter((r) => r.status === "PENDING").length} pending ·{" "}

            {rows.filter((r) => r.status === "APPROVED").length} approved ·{" "}

            {rows.filter((r) => r.status === "PAID").length} paid. Current-month

            calculations are provisional. Approve after month end. Recalculate

            when attendance, salary, leave or policy changes.

          </p>

          <section aria-label="Payroll overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[

 ["Employees in selected records",String(new Set(visibleRows.map(r=>String(r.employeeId))).size)],

 ["Gross salary", "PKR "+fmt(visibleRows.reduce((sum,r)=>sum+Number(r.snapshot.grossSalary||0)+Number(r.allowance||0),0))],

 ["Total deductions", "PKR "+fmt(visibleRows.reduce((sum,r)=>sum+Number(r.snapshot.lateDeduction||0)+Number(r.snapshot.absenceDeduction||0)+Number(r.snapshot.unpaidLeaveDeduction||0)+Number(r.otherDeduction||0),0))],

 ["Net payable", "PKR "+fmt(visibleRows.reduce((sum,r)=>sum+Math.max(0,r.snapshot.netSalary+Number(r.allowance||0)-Number(r.otherDeduction||0)),0))],

 ["Actual paid", "PKR "+fmt(visibleRows.reduce((sum,r)=>sum+(r.status==="PAID"?Math.max(0,r.snapshot.netSalary+Number(r.allowance||0)-Number(r.otherDeduction||0)):Number(r.paidAmount||0)),0))],

 ["Outstanding", "PKR "+fmt(visibleRows.reduce((sum,r)=>sum+(r.status==="PAID"?0:Math.max(0,r.snapshot.netSalary+Number(r.allowance||0)-Number(r.otherDeduction||0)-Number(r.paidAmount||0))),0))],

 ...["CALCULATED","PENDING","APPROVED","PARTIALLY_PAID","PAID"].map(status=>[({CALCULATED:"Calculated",PENDING:"Pending approval",APPROVED:"Approved · awaiting payment",PARTIALLY_PAID:"Partially paid",PAID:"Paid"} as any)[status],String(visibleRows.filter(r=>r.status===status).length)])

 ].map(([label,value])=><div key={label} className={card}><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>)}</section><p className="text-xs text-zinc-500">Overview reflects the selected month and current search/filters. No payroll record means no calculated amount; it does not mean an employee has been paid.</p>

          {payrollView==="register"&&<PayrollTable searchable={false}

            rows={visibleRows}

            payOnly={finance}

            allowPay={canRecordSalaryPayment}

            onView={setSlip}

            onAction={

              !finance

                ? action

                : user?.permissions?.includes("payroll.pay")

                  ? (r: any, a: string) => a === "PAY" && void action(r, a)

                  : undefined

            }

          />}

        </>

      )}

      <Presence show={Boolean(paymentAction)} kind="modal">

        {paymentAction && (

          <WorkspaceDialog title={paymentAction.kind==="PAY"?"Pay Salary":"Payroll action"} description="Review the saved payroll before confirming. Recording a payment does not transfer funds." busy={busy} onClose={()=>setPaymentAction(null)}>

            <form

              className="space-y-4"

              onSubmit={async (e) => {

                e.preventDefault();

                const a = paymentAction;

                const saved = await request(

                  "payroll/" + a.record._id + (a.kind==="PAY"?"/payments":"/action"),

                  {

                    ...(a.kind!=="PAY"?{action:a.kind}:{}),

                    ...(a.kind === "ADJUST"

                      ? { amount: Number(a.amount), allowance:Number(a.allowance), reason: a.reason }

                      : a.kind === "PAY"

                        ? { method: a.method, reference: a.reference, amount:Number(a.amount),requestId:a.requestId,paidAt:a.paidAt,notes:a.notes,...(a.proof?{proof:a.proof}:{}) }

                        : {}),

                  },

                );

                if (saved) setPaymentAction(null);

              }}

            >

              {error && (

                <p

                  role="alert"

                  className="rounded bg-red-50 p-3 text-sm text-red-700"

                >

                  {error}

                </p>

              )}

              <h2 className="text-xl font-semibold">

                {paymentAction.kind === "PAY"

                  ? "Pay salary · record payment"

                  : paymentAction.kind === "ADJUST"

                    ? "Adjust deductions & allowances"

                    : paymentAction.kind === "APPROVE"

                      ? "Approve payroll"

                      : "Submit payroll for approval"}

              </h2>

              <p className="text-sm text-zinc-600">

                {paymentAction.record.snapshot.employee.name} ·{" "}

                {paymentAction.record.month}

              </p><dl className="grid grid-cols-2 gap-3 rounded-md border bg-zinc-50 p-4 text-sm">{[["Employee ID",paymentAction.record.snapshot.employee.employeeId],["Department",paymentAction.record.snapshot.employee.department||"Not configured"],["Base salary",fmt(paymentAction.record.snapshot.baseSalary)],["Allowances",fmt(paymentAction.record.allowance)],["Net payable",fmt(paymentAction.record.snapshot.netSalary+Number(paymentAction.record.allowance||0)-Number(paymentAction.record.otherDeduction||0))],["Payment status",paymentAction.record.status]].map(([label,value])=><div key={String(label)}><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>

              {paymentAction.kind === "ADJUST" && (

                <>

                  <Text

                    label="Other deduction (PKR)"

                    type="number"

                    min="0"

                    value={paymentAction.amount}

                    onChange={(v: string) =>

                      setPaymentAction({ ...paymentAction, amount: v })

                    }

                  />

                  <Text label="Additional allowance / bonus (PKR)" type="number" min="0" value={paymentAction.allowance} onChange={(allowance:string)=>setPaymentAction({...paymentAction,allowance})}/>

                  <Text

                    label="Adjustment reason"

                    placeholder="Explain this deduction"

                    value={paymentAction.reason}

                    onChange={(v: string) =>

                      setPaymentAction({ ...paymentAction, reason: v })

                    }

                  />

                </>

              )}

              {paymentAction.kind === "PAY" && (

                <>

                  <Select

                    label="Payment method"

                    required

                    options={["Bank Transfer / Online", "Cash"]}

                    value={paymentAction.method}

                    onChange={(v: string) =>

                      setPaymentAction({ ...paymentAction, method: v })

                    }

                  />

                  <Text

                    label="Payment reference"

                    required={paymentAction.method === "Bank Transfer / Online"}

                    placeholder="Bank reference, receipt or cheque number"

                    value={paymentAction.reference}

                    onChange={(v: string) =>

                      setPaymentAction({ ...paymentAction, reference: v })

                    }

                  />

                  <div className="grid gap-4 sm:grid-cols-2"><Text label="Amount paid (PKR)" type="number" min="0.01" step="0.01" value={paymentAction.amount} onChange={(amount:string)=>setPaymentAction({...paymentAction,amount})}/><Text label="Payment date" type="date" value={paymentAction.paidAt} onChange={(paidAt:string)=>setPaymentAction({...paymentAction,paidAt})}/></div><Text label="Payment notes" required={false} value={paymentAction.notes} onChange={(notes:string)=>setPaymentAction({...paymentAction,notes})}/><label className="grid gap-2 text-sm">Payment proof / screenshot (optional, JPG, PNG or WebP up to 5 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file){setPaymentAction({...paymentAction,proof:""});return}if(file.size>5*1024*1024){setError("Choose a proof image under 5 MB.");return}const proof=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)});setPaymentAction({...paymentAction,proof})}}/></label>

                  <label className="flex gap-2 text-sm">

                    <input type="checkbox" required />I confirm that this salary

                    payment has been made. Acadivo records the payment and

                    generates its receipt.

                  </label>

                </>

              )}

              <div className="flex justify-end gap-3">

                <button

                  type="button"

                  className="rounded border px-4 py-2 text-sm"

                  onClick={() => setPaymentAction(null)}

                >

                  Cancel

                </button>

                <button disabled={busy} className={button}>

                  {busy ? "Saving…" : "Confirm"}

                </button>

              </div>

            </form>

          </WorkspaceDialog>

        )}

      </Presence>

      <Presence show={Boolean(report)} kind="modal">

        {report && (

          <PayrollReport

            rows={visibleRows}

            month={month}

            onClose={() => setReport(false)}

          />

        )}

      </Presence>{" "}

      <Presence show={Boolean(slip)} kind="modal">

        {slip && <Payslip record={slip} onClose={() => setSlip(null)} />}

      </Presence>

    </div>

  );

}
