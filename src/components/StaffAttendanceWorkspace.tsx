"use client";
import { confirmAction } from "./ConfirmationHost";
import { Presence } from "@/components/Motion";
import { PageHeading } from "@/components/ProductUI";

import { useCallback, useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_POLICY } from "@/lib/workforce-math";
import DeviceManager from "./BiometricDevices";
import styles from "./AttendanceUI.module.css";
import {
  Clock3,
  Fingerprint,
  CalendarDays,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import {
  Text,
  Table,
  PayrollTable,
  Payslip,
  field,
  card,
  button,
  time,
  fmt,
  currentMonth,
} from "./WorkforceUI";
export { Payslip } from "./WorkforceUI";
export function AttendanceSetup({ onComplete, mandatory = false }: any) {
  const { refreshUser } = useAuth();
  const [settings, setSettings] = useState<any>(null),
    [mode, setMode] = useState(""),
    [policy, setPolicy] = useState<any>({ ...DEFAULT_POLICY }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    apiFetch("/workforce/settings")
      .then((r) => {
        if (live) {
          setSettings(r.data);
          setMode(r.data.mode || "");
          setPolicy(r.data.policy);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      live = false;
    };
  }, []);
  async function save(complete: boolean) {
    if (
      settings?.mode &&
      settings.mode !== mode &&
      !(await confirmAction(
        "Changing attendance mode affects future attendance records. Existing attendance history will remain unchanged.",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      const r = await apiFetch("/workforce/settings", {
        method: "PUT",
        body: JSON.stringify({
          mode,
          policy,
          confirmModeChange: true,
          complete,
        }),
      });
      setSettings(r.data);
      setSaved(true);
      await refreshUser();
      if (complete) onComplete?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.root}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>School operations / Attendance</p>
          <h2>Attendance settings</h2>
          <p>
            Set the working day, define fair attendance rules and manage your
            devices in one place.
          </p>
        </div>
        <div className={styles.heroStats}>
          <div>
            <span>Saved method</span>
            <b>
              {settings?.mode === "BIOMETRIC"
                ? "Biometric"
                : settings?.mode === "MANUAL"
                  ? "Manual"
                  : "Not configured"}
            </b>
          </div>
          <div>
            <span>School timezone</span>
            <b>{policy.timezone}</b>
          </div>
        </div>
      </header>
      {!settings && !error && (
        <p role="status" className={styles.muted}>
          Loading attendance settings...
        </p>
      )}
      <div className={styles.panel}>
        <div className={styles.sectionHead}>
          <div>
            <div className={styles.headingLine}>
              <span className={styles.icon}>
                <Fingerprint />
              </span>
              <h3>Choose your attendance method</h3>
            </div>
            <p className="mt-2">
              Select how your team records attendance. Your existing history
              stays intact.
            </p>
          </div>
          <span className={styles.number}>01 / METHOD</span>
        </div>
        <div className={styles.modes}>
          {[
            [
              "MANUAL",
              "Manual Attendance",
              "Staff and teachers check in and out through their Acadivo portal.",
            ],
            [
              "BIOMETRIC",
              "Biometric Attendance",
              "Receive attendance from a compatible fingerprint or face-attendance device.",
            ],
          ].map(([id, title, description]) => (
            <button
              type="button"
              key={id}
              onClick={() => {
                setMode(id);
                setSaved(false);
              }}
              aria-pressed={mode === id}
              className={styles.mode}
            >
              <span className={styles.icon}>
                {id === "MANUAL" ? <Clock3 /> : <Fingerprint />}
              </span>
              <div>
                <b>{title}</b>
                <p>{description}</p>
              </div>
              {mode === id && (
                <CheckCircle2 size={18} className={styles.check} />
              )}
            </button>
          ))}
        </div>
      </div>
      {mode && (
        <>
          <div className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.headingLine}>
                  <span className={styles.icon}>
                    <Clock3 />
                  </span>
                  <h3>Working hours & arrival rules</h3>
                </div>
                <p className="mt-2">
                  The shift your team follows, with a grace period for late
                  arrivals.
                </p>
              </div>
              <span className={styles.number}>02 / POLICY</span>
            </div>
            <div className={styles.fields}>
              {[
                ["startTime", "Work start", "time"],
                ["endTime", "Work end", "time"],
                ["workingMinutes", "Daily working minutes", "number"],
                ["graceMinutes", "Grace minutes", "number"],
                ["timezone", "School timezone", "text"],
              ].map(([k, l, t]) => (
                <Text
                  key={k}
                  label={l}
                  help={
                    (
                      {
                        startTime: "When the working day starts.",
                        endTime: "When the working day ends.",
                        workingMinutes:
                          "Paid minutes per day, excluding unpaid breaks.",
                        graceMinutes:
                          "Allowed arrival delay before late rules apply.",
                        timezone: "Used to calculate attendance dates.",
                      } as any
                    )[k]
                  }
                  type={t}
                  value={policy[k]}
                  onChange={(v: string) =>
                    setPolicy({
                      ...policy,
                      [k]: t === "number" ? Number(v) : v,
                    })
                  }
                />
              ))}
              {[
                [
                  "lateMethod",
                  "Late calculation",
                  ["FROM_START", "AFTER_GRACE"],
                ],
                [
                  "teacherStart",
                  "Teacher start rule",
                  ["SHIFT", "FIRST_CLASS"],
                ],
                ["rounding", "Deduction rounding", ["NEAREST", "UP", "DOWN"]],
              ].map(([key, label, options]: any) => (
                <label key={key}>
                  {label}
                  <select
                    className={field}
                    value={policy[key]}
                    onChange={(e) =>
                      setPolicy({ ...policy, [key]: e.target.value })
                    }
                  >
                    {options.map((x: string) => (
                      <option value={x} key={x}>
                        {(
                          {
                            FROM_START: "Count from shift start",
                            AFTER_GRACE: "Count only beyond grace",
                            SHIFT: "Configured staff shift",
                            FIRST_CLASS: "First scheduled lesson",
                            NEAREST: "Nearest paisa (2 decimals)",
                            UP: "Round up to next paisa",
                            DOWN: "Round down to whole paisa",
                          } as any
                        )[x] || x}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    {key === "lateMethod"
                      ? "Applied only after the grace period ends."
                      : key === "teacherStart"
                        ? "First lesson uses the teacher's timetable."
                        : "Controls the precision of monetary deductions."}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.headingLine}>
                    <span className={styles.icon}>
                      <CalendarDays />
                    </span>
                    <h3>Weekly off days</h3>
                  </div>
                  <p className="mt-2">
                    Selected days are excluded from regular payable working
                    days.
                  </p>
                </div>
              </div>
              <div className={styles.days}>
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((day, i) => (
                  <label key={day} className={styles.day}>
                    <input
                      type="checkbox"
                      aria-label={day + " off"}
                      checked={policy.weeklyOff.includes(i)}
                      onChange={(e) =>
                        setPolicy({
                          ...policy,
                          weeklyOff: e.target.checked
                            ? [...policy.weeklyOff, i]
                            : policy.weeklyOff.filter((v: number) => v !== i),
                        })
                      }
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
              <p className={styles.muted + " mt-4"}>
                School calendar exceptions still apply to holidays and special
                working days.
              </p>
            </div>
            <div className={styles.panel}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.headingLine}>
                    <span className={styles.icon}>
                      <ShieldCheck />
                    </span>
                    <h3>Salary & leave rules</h3>
                  </div>
                  <p className="mt-2">
                    Choose how attendance affects calculated salary.
                  </p>
                </div>
              </div>
              <div className={styles.toggles}>
                {[
                  [
                    "lateEnabled",
                    "Late deduction",
                    "Deduct for late minutes under your arrival rule.",
                  ],
                  [
                    "absenceDeduction",
                    "Absence deduction",
                    "Deduct for missing attendance on payable days.",
                  ],
                  [
                    "paidLeave",
                    "Approved paid leave stays paid",
                    "Approved paid leave does not reduce salary.",
                  ],
                  [
                    "unpaidLeaveDeduction",
                    "Unpaid leave deduction",
                    "Deduct for approved unpaid leave.",
                  ],
                ].map(([k, l, help]) => (
                  <label className={styles.toggle} key={k}>
                    <input
                      type="checkbox"
                      checked={policy[k]}
                      onChange={(e) =>
                        setPolicy({ ...policy, [k]: e.target.checked })
                      }
                    />
                    <span>
                      <b>{l}</b>
                      <small>{help}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.saveBar}>
            <div>
              <b className="text-sm">
                {saved ? "Settings saved" : "Save your attendance policy"}
              </b>
              <p>
                {mode === "BIOMETRIC"
                  ? "Save before configuring a real device. Hardware setup is completed separately."
                  : "Your team continues to mark attendance through their own portals."}
              </p>
            </div>
            <button
              type="button"
              disabled={busy || !settings}
              className={styles.primary}
              onClick={() => void save(mode === "MANUAL")}
            >
              {busy
                ? "Saving..."
                : mode === "MANUAL"
                  ? mandatory
                    ? "Enable manual attendance & continue"
                    : "Save manual settings"
                  : "Save biometric mode"}
            </button>
          </div>
          {mode === "BIOMETRIC" &&
            (saved || settings?.mode === "BIOMETRIC") && (
              <>
                <DeviceManager />
                <div className={styles.saveBar}>
                  <div>
                    <b className="text-sm">Real device setup</b>
                    <p>
                      Requires a connected real device and at least one mapped
                      employee.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void save(true)}
                  >
                    Complete biometric setup
                  </button>
                </div>
              </>
            )}
        </>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {mandatory && !mode && (
        <p className={styles.muted}>Select an attendance method to continue.</p>
      )}
    </section>
  );
}
export function StaffSelfWorkspace({ payrollOnly = false }: any) {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [slip, setSlip] = useState<any>(null),
    [leave, setLeave] = useState<any>({
      leaveType: "Casual",
      startDate: "",
      endDate: "",
      reason: "",
    });
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    try {
      const r = await apiFetch("/workforce/self?month=" + month);
      if (current === generation.current) setData(r.data);
    } catch (e: any) {
      if (current === generation.current) setError(e.message);
    }
  }, [month]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load, user?.branchId]);
  async function act(action: string) {
    setBusy(true);
    try {
      await apiFetch("/workforce/self/check-" + action, {
        method: "POST",
        body: "{}",
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const today = data?.records.find((r: any) => r.date === data.today);
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="My workspace"
        title={payrollOnly ? "Salary & payroll" : "My attendance"}
        description={
          payrollOnly
            ? "Your salary calculations and recorded payment history."
            : "Your check-in records and leave requests."
        }
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="max-w-xs">
        <Text label="Month" type="month" value={month} onChange={setMonth} />
      </div>
      {!data ? (
        <p>Loading your records...</p>
      ) : (
        <>
          {!payrollOnly && (
            <>
              <section className={card}>
                <p className="text-xs text-zinc-500">
                  Attendance Mode: {data.mode || "Not configured"}
                </p>
                <h2 className="mt-3 font-semibold">
                  Today&apos;s attendance · {data.today}
                </h2>
                <div className="my-4 grid gap-3 sm:grid-cols-4">
                  {[
                    ["Status", today?.status || "Not checked in"],
                    ["Check-in", time(today?.checkedInAt)],
                    ["Check-out", time(today?.checkedOutAt)],
                    [
                      "Working time",
                      today
                        ? Math.floor(today.workingMinutes / 60) +
                          "h " +
                          (today.workingMinutes % 60) +
                          "m"
                        : "—",
                    ],
                    ["Late minutes", today?.lateMinutes || 0],
                  ].map(([k, v]) => (
                    <p key={String(k)} className="text-sm">
                      <span className="block text-xs text-zinc-500">{k}</span>
                      {v}
                    </p>
                  ))}
                </div>
                {data.mode === "MANUAL" && data.setupCompletedAt ? (
                  <div className="flex gap-3">
                    <button
                      className={button}
                      disabled={busy || !!today?.checkedInAt}
                      onClick={() => void act("in")}
                    >
                      Check In
                    </button>
                    <button
                      className={button}
                      disabled={
                        busy || !today?.checkedInAt || !!today?.checkedOutAt
                      }
                      onClick={() => void act("out")}
                    >
                      Check Out
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    {data.mode === "BIOMETRIC"
                      ? "Attendance synchronizes from the school's biometric integration."
                      : "School Admin must complete attendance setup."}
                  </p>
                )}
              </section>
              <Table
                headers={[
                  "Date",
                  "Status",
                  "Source",
                  "Check-in",
                  "Check-out",
                  "Working minutes",
                  "Late minutes",
                ]}
                rows={data.records.map((r: any) => [
                  r.date,
                  r.status,
                  r.source,
                  time(r.checkedInAt),
                  time(r.checkedOutAt),
                  r.workingMinutes,
                  r.lateMinutes,
                ])}
              />
              <form
                className={card + " grid gap-3 sm:grid-cols-2"}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await apiFetch("/workforce/leave", {
                      method: "POST",
                      body: JSON.stringify(leave),
                    });
                    setLeave({ ...leave, reason: "" });
                    await load();
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <h2 className="font-semibold sm:col-span-2">Request leave</h2>
                <select
                  className={field}
                  value={leave.leaveType}
                  onChange={(e) =>
                    setLeave({ ...leave, leaveType: e.target.value })
                  }
                >
                  {["Casual", "Sick", "Earned", "Maternity", "Unpaid"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
                <Text
                  label="Reason"
                  value={leave.reason}
                  onChange={(reason: string) => setLeave({ ...leave, reason })}
                />
                <Text
                  label="From"
                  type="date"
                  value={leave.startDate}
                  onChange={(startDate: string) =>
                    setLeave({ ...leave, startDate })
                  }
                />
                <Text
                  label="To"
                  type="date"
                  value={leave.endDate}
                  onChange={(endDate: string) =>
                    setLeave({ ...leave, endDate })
                  }
                />
                <button className={button} disabled={busy}>
                  Submit leave request
                </button>
              </form>
              <section className={card}>
                <h2 className="mb-4 font-semibold">My leave requests</h2>
                <Table
                  headers={["Leave type", "Dates", "Status", "Review comment"]}
                  rows={(data.leaveRequests || []).map((r: any) => [
                    r.leaveType,
                    String(r.startDate).slice(0, 10) +
                      " – " +
                      String(r.endDate).slice(0, 10),
                    r.status,
                    r.reviewComment || "Awaiting review",
                  ])}
                />
              </section>
            </>
          )}
          {user?.features?.includes("FINANCE") && (
            <section className={card}>
              <h2 className="font-semibold">Salary & payment history</h2>
              <p className="my-3 text-sm text-zinc-500">
                {data.employment?.salaryHistory?.length
                  ? "Latest base salary: PKR " +
                    fmt(data.employment.salaryHistory.at(-1).amount)
                  : "Salary has not been configured."}
              </p>
              <PayrollTable rows={data.payroll} onView={setSlip} />
            </section>
          )}
        </>
      )}
      <Presence show={Boolean(slip)} kind="modal">
        {slip && <Payslip record={slip} onClose={() => setSlip(null)} />}
      </Presence>
    </div>
  );
}
