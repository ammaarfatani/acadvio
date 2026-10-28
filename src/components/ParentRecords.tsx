"use client";

import { PageHeading } from "./ProductUI";
import { StudentAvatar } from "./StudentAvatar";
import { Presence } from "@/components/Motion";
import ParentWeeklyTimetable from "./ParentWeeklyTimetable";
import ParentFinanceRecords from "./ParentFinanceRecords";
import ParentFeePayment from "./ParentFeePayment";
import AnnualMarksheet from "./AnnualMarksheet";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useParent } from "@/lib/parent-context";
import ParentReport from "./ParentReport";
import DataChart from "@/components/DataChart";
const date = (s: string) =>
  s && !Number.isNaN(new Date(s).getTime())
    ? new Date(s).toLocaleDateString("en-GB")
    : "Not recorded";
const box = "rounded-xl border bg-white p-5";
export default function ParentRecords({
  section = "academics",
}: {
  section?: "academics" | "fees" | "children";
}) {
  const [annualOpen, setAnnualOpen] = useState(false);
  const [report, setReport] = useState<any>(null);
  const { user } = useAuth();
  const {
    children,
    selected,
    data,
    loading,
    error: loadError,
    refresh,
  } = useParent();
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState(section === "fees" ? "Fees" : "Profile"),
    [invoice, setInvoice] = useState<any>(null);
  const [month, setMonth] = useState("");
  useEffect(() => setTab(section === "fees" ? "Fees" : "Profile"), [section]);
  const finance = !!user?.features?.includes("FINANCE"),
    exams = !!user?.features?.includes("EXAMINATIONS");
  useEffect(() => {
    setInvoice(null);
    setNotice("");
    setError("");
    setReport(null);
    setAnnualOpen(false);
  }, [selected]);
  const visibleAttendance = (data?.attendance || []).filter(
    (a: any) =>
      !month ||
      new Date(a.date)
        .toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" })
        .startsWith(month),
  );
  const monthPresent = visibleAttendance.filter((a: any) =>
    ["PRESENT", "LATE"].includes(a.status),
  ).length;

  return (
    <div className="parent-records space-y-6 pb-12">
      <Presence show={Boolean(report && data)} kind="modal">
        {report && data && (
          <ParentReport
            record={report.record}
            kind={report.kind}
            student={data.student}
            onClose={() => setReport(null)}
          />
        )}
      </Presence>
      <PageHeading
        eyebrow="Family workspace"
        title={
          section === "fees"
            ? "Fees & payments"
            : section === "children"
              ? "My children"
              : "Academics"
        }
        description={
          section === "fees"
            ? "Keep track of invoices, verified payments and submitted payment proofs."
            : section === "children"
              ? "Your child's student profile, guardian details and school information."
              : "Attendance, the weekly timetable, examinations and published results."
        }
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading child records...</p>
      ) : !children.length ? (
        <p className={box}>
          No children linked to your account. Contact your school administrator.
        </p>
      ) : (
        !loadError &&
        data && (
          <>
            <article className={box + " parent-child-summary"}>
              <StudentAvatar student={data.student} size={56} />
              <div>
                <h2 className="text-xl font-bold">{data.student.name}</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  {data.student.className} ·{" "}
                  {data.student.sectionName || "Section not assigned"} · Roll{" "}
                  {data.student.rollNumber} · {data.student.status}
                </p>
              </div>
            </article>
            {section === "academics" && (
              <nav className="flex flex-wrap gap-2" aria-label="Child records">
                {[
                  "Profile",
                  "Attendance",
                  ...(exams ? ["Results"] : []),
                  "Timetable",
                ].map((t) => (
                  <button
                    key={t}
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                    className={
                      "rounded-lg border px-4 py-2 text-sm " +
                      (tab === t ? "bg-red-600 text-white" : "bg-white")
                    }
                  >
                    {t}
                  </button>
                ))}
              </nav>
            )}
            {tab === "Profile" && (
              <>
                <article className={box + " family-profile-details"}>
                  <h2 className="font-bold">Student profile</h2>
                  <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                    {[
                      ["Admission number", data.student.admissionNumber],
                      ["Admission date", date(data.student.admissionDate)],
                      ["Date of birth", date(data.student.dob)],
                      ["Gender", data.student.gender],
                      ["Class teacher", data.classInfo?.classTeacherName],
                      ["Academic year", data.student.academicSessionName],
                      ["Address", data.student.address],
                      ["Phone", data.student.phone],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-zinc-500">{label}</dt>
                        <dd className="mt-1">{value || "Not recorded"}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
                <section className="family-panel">
                  <header>
                    <div>
                      <p className="family-kicker">Learning team</p>
                      <h2>Subjects & teachers</h2>
                      <p>Each subject and its assigned teaching staff.</p>
                    </div>
                    <span className="family-status">
                      {data.subjects.length} subjects
                    </span>
                  </header>
                  {data.subjects.length ? (
                    <div className="family-table-scroll">
                      <table className="family-data-table">
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Category</th>
                            <th>Teacher</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.subjects.map((s: any) => (
                            <tr key={s._id}>
                              <td>
                                <strong>{s.name}</strong>
                              </td>
                              <td>{s.type || "Not specified"}</td>
                              <td>{s.teacherName || "Teacher not assigned"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="family-empty">
                      Subjects have not been assigned to this class yet.
                    </p>
                  )}
                </section>
              </>
            )}
            {tab === "Attendance" && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm">
                    Attendance month
                    <input
                      aria-label="Attendance month"
                      type="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="ml-3 rounded-lg border bg-white p-2"
                    />
                  </label>
                  <button
                    onClick={() => setMonth("")}
                    className="rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    All recorded dates
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {["PRESENT", "ABSENT", "LATE", "LEAVE"].map((status) => (
                    <article key={status} className={box}>
                      <p className="text-xs text-zinc-500">{status}</p>
                      <p className="mt-2 text-xl font-bold">
                        {
                          visibleAttendance.filter(
                            (a: any) => a.status === status,
                          ).length
                        }
                      </p>
                    </article>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <article className={box}>
                    <p className="text-sm text-zinc-500">Recorded attendance</p>
                    <p className="mt-2 text-2xl font-bold">
                      {visibleAttendance.length
                        ? Math.round(
                            (monthPresent / visibleAttendance.length) * 100,
                          ) + "%"
                        : "Not recorded yet"}
                    </p>
                  </article>
                  <DataChart
                    title="Attendance status"
                    kind="donut"
                    data={["PRESENT", "ABSENT", "LATE", "LEAVE"].map(
                      (label) => ({
                        label,
                        value: visibleAttendance.filter(
                          (a: any) => a.status === label,
                        ).length,
                      }),
                    )}
                  />
                </div>
                <article className={box}>
                  <h2 className="font-bold">Attendance history</h2>
                  {visibleAttendance.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {visibleAttendance.map((a: any) => (
                        <p
                          key={a.date}
                          className="rounded bg-zinc-50 p-3 text-sm"
                        >
                          {date(a.date)} · {a.status}
                          {a.remarks && (
                            <span className="mt-1 block text-xs text-zinc-500">
                              {a.remarks}
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-500">
                      Your school has not recorded this information yet.
                    </p>
                  )}
                </article>
              </>
            )}
            <Presence show={Boolean(annualOpen)} kind="modal">
              {annualOpen && (
                <AnnualMarksheet
                  data={data.marksheet}
                  schoolName={user?.school?.name}
                  onClose={() => setAnnualOpen(false)}
                />
              )}
            </Presence>
            {tab === "Results" && exams && (
              <>
                <button
                  className="rounded-lg border bg-white px-4 py-2 text-sm"
                  onClick={() => setAnnualOpen(true)}
                >
                  Mid-Term & Final Term marksheet
                </button>
                <article className={box}>
                  <h2 className="font-bold">Examination schedules</h2>
                  {data.examSchedules.length ? (
                    data.examSchedules.map((e: any) => (
                      <p key={e._id} className="border-b py-3 text-sm">
                        {e.title} · {date(e.startDate)} - {date(e.endDate)} ·{" "}
                        {e.status}
                        <span className="mt-1 block text-zinc-500">
                          Subjects: {e.subjects?.join(", ") || "Not specified"}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="mt-4 text-sm text-zinc-500">
                      No schedules available.
                    </p>
                  )}
                </article>
                <article className={box}>
                  <h2 className="font-bold">Exam date sheet</h2>
                  {data.examTimetable?.length ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr>
                            {["Date", "Time", "Subject", "Room"].map((h) => (
                              <th className="p-3" key={h}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.examTimetable.map((p: any) => (
                            <tr className="border-t" key={p._id}>
                              <td className="p-3">{date(p.date)}</td>
                              <td className="p-3">
                                {p.startTime}–{p.endTime}
                              </td>
                              <td className="p-3">{p.subjectId?.name}</td>
                              <td className="p-3">
                                {p.room || "Not assigned"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">
                      The school has not scheduled subject papers for this class
                      yet.
                    </p>
                  )}
                </article>
                <DataChart
                  title="Published academic performance"
                  kind="line"
                  unit="%"
                  data={[...data.results].reverse().map((r: any) => ({
                    label: r.examTitle,
                    value: r.percentage,
                  }))}
                />
                {data.results.length ? (
                  data.results.map((r: any) => (
                    <article key={r._id} className={box}>
                      <h2 className="font-bold">{r.examTitle}</h2>
                      <p className="mt-2 text-sm">
                        {r.totalObtainedMarks}/{r.totalMaxMarks} ·{" "}
                        {r.percentage}% · Grade {r.overallGrade} · {r.status}
                      </p>
                      {r.rank && <p className="mt-1 text-sm">Rank: {r.rank}</p>}
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr>
                              {["Subject", "Marks", "Grade", "Remarks"].map(
                                (v) => (
                                  <th key={v} className="p-2">
                                    {v}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {r.subjectScores.map((s: any) => (
                              <tr
                                key={s.subjectId || s.subjectName}
                                className="border-t"
                              >
                                <td className="p-2">{s.subjectName}</td>
                                <td className="p-2">
                                  {s.obtainedMarks}/{s.maxMarks}
                                </td>
                                <td className="p-2">{s.grade}</td>
                                <td className="p-2">
                                  {s.remarks || "Not recorded"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {r.teacherRemarks && (
                        <p className="mt-3 text-sm">
                          Teacher remarks: {r.teacherRemarks}
                        </p>
                      )}
                      <button
                        onClick={() => setReport({ kind: "result", record: r })}
                        className="mt-4 rounded-lg border px-3 py-2 text-sm"
                      >
                        Print academic report
                      </button>
                    </article>
                  ))
                ) : (
                  <p className={box}>Results have not been published yet.</p>
                )}
              </>
            )}
            {tab === "Timetable" && (
              <ParentWeeklyTimetable rows={data.timetable} />
            )}
            {tab === "Fees" && finance && (
              <>
                <ParentFinanceRecords
                  data={data}
                  onPay={(f: any) => {
                    setInvoice(f);
                    setError("");
                    setNotice("");
                  }}
                  onReceipt={(p: any) =>
                    setReport({ kind: "receipt", record: p })
                  }
                  onRefresh={() => void refresh()}
                />
                {invoice && (
                  <ParentFeePayment
                    key={selected + ":" + invoice._id}
                    studentId={selected}
                    invoice={invoice}
                    bank={data.bankDetails}
                    onClose={() => setInvoice(null)}
                    onSubmitted={async () => {
                      setInvoice(null);
                      setNotice(
                        "Payment submitted successfully. Finance will review your screenshot. Your fee balance changes only after approval.",
                      );
                      await refresh();
                    }}
                  />
                )}
              </>
            )}
          </>
        )
      )}
    </div>
  );
}
