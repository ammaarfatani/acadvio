"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { schoolAdminApi } from "@/lib/schoolAdminApi";

export default function FeeStructuresPage() {
  const [structures, setStructures] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [structureRes, classRes] = await Promise.all([
        schoolAdminApi.getFeeStructures(),
        schoolAdminApi.getClasses(),
      ]);
      setStructures(structureRes?.data || []);
      setClasses(classRes?.data || []);
    } catch (e: any) {
      setError(e?.message || "Unable to load fee structures.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    const linkedClass = classes.find((c) => c._id === form.get("classId"));
    try {
      await schoolAdminApi.createFeeStructure({
        title: form.get("title"),
        classId: linkedClass?._id,
        className: linkedClass?.name,
        tuitionFee: Number(form.get("tuitionFee")),
        examFee: Number(form.get("examFee") || 0),
        transportFee: Number(form.get("transportFee") || 0),
        libraryFee: Number(form.get("libraryFee") || 0),
        computerFee: Number(form.get("computerFee") || 0),
        otherCharges: Number(form.get("otherCharges") || 0),
      });
      formElement.reset();
      setNotice("Fee structure created.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Unable to create fee structure.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-black">Fee Structures</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Set class-wise charges used when generating fee challans.
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
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <form
        onSubmit={create}
        className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="grid gap-1 text-xs font-semibold">
          Structure name *
          <input
            name="title"
            required
            className="rounded-lg border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Class *
          <select
            name="classId"
            required
            className="rounded-lg border px-3 py-2"
          >
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {[
          ["tuitionFee", "Tuition fee *", true],
          ["examFee", "Exam fee"],
          ["transportFee", "Transport"],
          ["libraryFee", "Library"],
          ["computerFee", "Computer"],
          ["otherCharges", "Other charges"],
        ].map(([name, label, required]) => (
          <label
            key={String(name)}
            className="grid gap-1 text-xs font-semibold"
          >
            {String(label)}
            <input
              name={String(name)}
              type="number"
              min="0"
              step="0.01"
              required={Boolean(required)}
              defaultValue={required ? undefined : 0}
              className="rounded-lg border px-3 py-2"
            />
          </label>
        ))}
        <button
          disabled={saving || !classes.length}
          className="self-end rounded-lg bg-school-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create structure"}
        </button>
      </form>
      {loading ? (
        <p
          role="status"
          className="rounded-xl bg-white p-6 text-sm text-zinc-500"
        >
          Loading fee structures…
        </p>
      ) : structures.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {structures.map((item) => (
            <article
              key={item._id}
              className="rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex justify-between gap-2">
                <h2 className="font-bold">{item.title}</h2>
                <span className="text-sm font-semibold text-school-primary">
                  {item.className}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Tuition", item.tuitionFee],
                  ["Exam", item.examFee],
                  ["Transport", item.transportFee],
                  ["Library", item.libraryFee],
                  ["Computer", item.computerFee],
                  ["Other", item.otherCharges],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between gap-2"
                  >
                    <dt className="text-zinc-500">{label}</dt>
                    <dd>PKR {Number(value || 0).toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t pt-3 text-right font-bold">
                Monthly total PKR{" "}
                {Number(item.totalMonthlyFee || 0).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="font-bold">No fee structures yet</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Add a structure before generating challans.
          </p>
        </div>
      )}
    </div>
  );
}
