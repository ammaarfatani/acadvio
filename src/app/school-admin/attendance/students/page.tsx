"use client";
import { useRecordRefresh } from "@/lib/use-record-refresh";

import { useCallback, useEffect, useState } from "react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function StudentAttendancePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    schoolAdminApi
      .getClasses()
      .then((res: any) => setClasses(res?.data || []))
      .catch((e: any) => setError(e?.message || "Could not load classes."));
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schoolAdminApi.getAttendanceReports({
        from: from || undefined,
        to: to || undefined,
        classId: classId || undefined,
      });
      setReport(res?.data || null);
    } catch (e: any) {
      setError(e?.message || "Unable to load attendance reports.");
    } finally {
      setLoading(false);
    }
  }, [from, to, classId]);
  useEffect(() => {
    void load();
  }, [load]);
  useRecordRefresh(load, ["teacher", "school-admin"]);
  const summary = report?.summary || {
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    total: 0,
    attendancePercent: 0,
  };
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-black">Student Attendance</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Read-only attendance monitoring from submitted class registers.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="grid gap-1 text-xs font-semibold">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Class
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="min-w-44 rounded-lg border border-zinc-300 px-3 py-2"
          >
            <option value="">All classes</option>
            {classes.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p
          role="status"
          className="rounded-xl bg-white p-6 text-sm text-zinc-500"
        >
          Loading attendance reports…
        </p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Attendance", `${summary.attendancePercent}%`],
              ["Present", summary.present],
              ["Absent", summary.absent],
              ["Late", summary.late],
              ["Records", summary.total],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-zinc-200 bg-white p-4"
              >
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-1 text-2xl font-bold">{String(value)}</p>
              </div>
            ))}
          </section>
          {report?.studentAttendance?.length ? (
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Marked by</th>
                    <th className="p-3">Present</th>
                    <th className="p-3">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {report.studentAttendance.map((doc: any) => {
                    const present = doc.records.filter(
                      (r: any) => r.status === "PRESENT" || r.status === "LATE",
                    ).length;
                    const absent = doc.records.filter(
                      (r: any) => r.status === "ABSENT",
                    ).length;
                    return (
                      <tr key={doc._id} className="border-t border-zinc-100">
                        <td className="p-3">
                          {new Date(doc.date).toLocaleDateString()}
                        </td>
                        <td className="p-3">{doc.className}</td>
                        <td className="p-3">{doc.sectionName || "—"}</td>
                        <td className="p-3">{doc.markedByName}</td>
                        <td className="p-3">{present}</td>
                        <td className="p-3">{absent}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
              <h2 className="font-bold">
                No attendance records for these filters
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Records will appear here after a teacher submits attendance.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
