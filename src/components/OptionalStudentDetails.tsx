"use client";
import { useState, useEffect } from "react";
import { OPTIONAL_STUDENT_FIELDS } from "@/lib/document-templates";
export function OptionalStudentDetails({
  values,
  onChange,
  presentAddress,
  onPresentAddress,
}: {
  values: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  presentAddress: string;
  onPresentAddress: (value: string) => void;
}) {
  const [same, setSame] = useState(false);
  useEffect(() => {
    if (
      same &&
      values.permanentAddress &&
      presentAddress !== values.permanentAddress
    )
      onPresentAddress(values.permanentAddress);
  }, [same, values.permanentAddress, presentAddress, onPresentAddress]);
  return (
    <details className="rounded-lg border bg-zinc-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Additional student information (optional)
      </summary>
      <p className="mt-2 text-xs text-zinc-500">
        Only enter information collected by your school. Empty fields do not
        prevent admission.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {OPTIONAL_STUDENT_FIELDS.map(([key, label]) => (
          <label key={key} className="grid gap-1 text-xs font-semibold">
            {label}
            <input
              type="text"
              maxLength={2000}
              value={values[key] || ""}
              placeholder={label}
              onChange={(e) => onChange({ ...values, [key]: e.target.value })}
              className="rounded border bg-white p-2"
            />
          </label>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          disabled={!values.permanentAddress}
          checked={same}
          onChange={(e) => {
            setSame(e.target.checked);
            if (e.target.checked) onPresentAddress(values.permanentAddress);
          }}
        />
        Present address same as permanent address
      </label>
    </details>
  );
}
