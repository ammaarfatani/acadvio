"use client";
import { useRef, useState } from "react";
import { StudentAvatar } from "./StudentAvatar";
export function PhotoRecordPicker({
  records,
  value,
  onChange,
  kind = "student",
  label = "Student",
}: {
  records: any[];
  value: string;
  onChange: (id: string) => void;
  kind?: "student" | "staff";
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDetailsElement>(null);
  const chosen = records.find((r) => String(r._id) === value);
  return (
    <div className="min-w-0 text-sm">
      <span className="block text-xs font-semibold">{label}</span>
      <details ref={ref} className="relative mt-1 rounded-lg border bg-white">
        <summary className="flex cursor-pointer items-center gap-2 p-2">
          {chosen && <StudentAvatar student={chosen} kind={kind} size={28} />}
          <span className="min-w-0 truncate" title={chosen?.name}>
            {chosen ? chosen.name : "Choose " + label.toLowerCase()}
          </span>
        </summary>
        <div className="absolute left-0 top-full z-40 mt-1 w-full min-w-56 rounded-lg border bg-white p-2 shadow-lg">
          <input
            aria-label={`Search ${label}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID or admission"
            className="w-full rounded border p-2 text-sm"
          />
          <div className="mt-2 max-h-64 overflow-auto">
            <button
              type="button"
              className="block w-full p-2 text-left text-sm"
              onClick={() => {
                onChange("");
                ref.current?.removeAttribute("open");
              }}
            >
              Clear selection
            </button>
            {records
              .filter((r) =>
                [
                  r.name,
                  r.studentId,
                  r.employeeId,
                  r.admissionNumber,
                  r.rollNumber,
                ]
                  .join(" ")
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((r) => (
                <button
                  type="button"
                  key={r._id}
                  aria-pressed={String(r._id) === value}
                  className="flex w-full items-center gap-2 border-t p-2 text-left text-sm hover:bg-zinc-50"
                  onClick={() => {
                    onChange(String(r._id));
                    ref.current?.removeAttribute("open");
                  }}
                >
                  <StudentAvatar student={r} kind={kind} size={30} />
                  <span>
                    {r.name}
                    <small className="block text-zinc-500">
                      {r.admissionNumber ||
                        r.employeeId ||
                        r.studentId ||
                        r.rollNumber}
                    </small>
                  </span>
                </button>
              ))}
          </div>
        </div>
      </details>
    </div>
  );
}
