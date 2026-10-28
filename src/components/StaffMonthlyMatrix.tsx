"use client";
import { StaffAvatar } from "./StudentAvatar";
import { useState } from "react";
import { roleLabel } from "./WorkforceUI";
export default function StaffMonthlyMatrix({ rows, month }: any) {
  const [page, setPage] = useState(1);
  const employees = Array.from(
    new Map(rows.map((r: any) => [r.employee._id, r.employee])).values(),
  ) as any[];
  const pages = Math.max(1, Math.ceil(employees.length / 25)),
    active = Math.min(page, pages),
    days = Array.from(
      {
        length: new Date(
          Number(month.slice(0, 4)),
          Number(month.slice(5)),
          0,
        ).getDate(),
      },
      (_, i) => month + "-" + String(i + 1).padStart(2, "0"),
    );
  const cells = new Map(
    rows.map((r: any) => [r.employee._id + ":" + r.date, r]),
  );
  const style: any = {
    PRESENT: "bg-emerald-50 text-emerald-700",
    LATE: "bg-amber-50 text-amber-700",
    ABSENT: "bg-red-50 text-red-700",
    LEAVE: "bg-blue-50 text-blue-700",
    OFF: "bg-zinc-100 text-zinc-400",
  };
  return (
    <section className="overflow-hidden rounded-xl border bg-white">
      <p className="border-b p-4 text-xs text-zinc-500">
        Monthly staff register · P Present · A Absent · L Late · LV Leave · —
        Off / no record
      </p>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-20 bg-zinc-50">
            <tr>
              <th className="sticky left-0 z-30 min-w-48 bg-zinc-50 p-3">
                Employee / role
              </th>
              {days.map((d) => (
                <th key={d} className="min-w-10 p-2 text-center">
                  {Number(d.slice(-2))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.slice((active - 1) * 25, active * 25).map((u) => (
              <tr key={u._id} className="border-t">
                <th className="sticky left-0 bg-white p-3 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <StaffAvatar staff={u} size={28} />
                    {u.name}
                  </span>
                  <span className="mt-1 block text-xs font-normal text-zinc-500">
                    {roleLabel(u.userType)}
                  </span>
                </th>
                {days.map((d) => {
                  const r: any = cells.get(u._id + ":" + d);
                  return (
                    <td key={d} className="p-1 text-center">
                      <span
                        title={
                          d +
                          ": " +
                          (r?.status || "Not recorded") +
                          (r?.correctionReason
                            ? " · " + r.correctionReason
                            : "")
                        }
                        className={
                          "block rounded px-1 py-2 " +
                          (style[r?.status] || "text-zinc-400")
                        }
                      >
                        {(
                          {
                            PRESENT: "P",
                            ABSENT: "A",
                            LATE: "L",
                            LEAVE: "LV",
                          } as any
                        )[r?.status] || "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!employees.length && (
        <p className="p-8 text-center text-sm text-zinc-500">
          No matching employees.
        </p>
      )}
      {pages > 1 && (
        <div className="flex justify-end gap-3 border-t p-3 text-sm">
          <button disabled={active === 1} onClick={() => setPage(active - 1)}>
            Previous
          </button>
          <span>
            {active} / {pages}
          </span>
          <button
            disabled={active === pages}
            onClick={() => setPage(active + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
