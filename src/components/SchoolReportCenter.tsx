"use client";
import { useRecordRefresh } from "@/lib/use-record-refresh";
import { useEffect, useState, useRef } from "react";
import { apiFetch, privateFile } from "@/lib/api";
import {
  reportColumnLabel,
  reportFilterLabel,
  displayReportCell,
  readableReportValue,
} from "@/lib/report-presentation";
import DataChart from "./DataChart";
type Report = {
  key: string;
  title: string;
  category: string;
  columns: string[];
  filters: string[];
  values: Record<string, string[]>;
  note: string;
};
const day = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const label = (s: string) =>
  s
    .replaceAll("records.", "")
    .replaceAll("parentInfo.", "Guardian: ")
    .replaceAll("feeBreakdown.", "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
const control =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600";
const button =
  "rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-40";
export default function SchoolReportCenter({
  intelligence = false,
}: {
  intelligence?: boolean;
}) {
  const [catalogue, setCatalogue] = useState<Report[]>([]),
    [selected, setSelected] = useState<Record<string, string[]>>({}),
    [filters, setFilters] = useState<any>(() => {
      const now = new Date();
      return {
        from: day(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: day(now),
      };
    }),
    [filterLabels, setFilterLabels] = useState<Record<string, string>>({}),
    [preview, setPreview] = useState<any[]>([]),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(""),
    [formats, setFormats] = useState(["xlsx"]),
    [presets, setPresets] = useState<any[]>([]),
    [name, setName] = useState(""),
    [dashboard, setDashboard] = useState<any>(null),
    [ai, setAi] = useState<any>(null),
    [actions, setActions] = useState<any[]>([]),
    [settings, setSettings] = useState({
      lowAttendance: 80,
      expenseIncrease: 20,
      staleAdmissionDays: 7,
    });
  const run = async (title: string, fn: () => Promise<void>) => {
    setBusy(title);
    setError("");
    setSuccess("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || "Request failed. Please try again.");
    } finally {
      setBusy("");
    }
  };
  const selections = Object.entries(selected).map(([report, columns]) => ({
      report,
      columns,
    })),
    request = { filters, selections };
  useEffect(() => {
    let live = true;
    apiFetch("/smart-reports/catalogue")
      .then((r) => {
        if (!live) return;
        setCatalogue(r.data.reports);
        const query = new URLSearchParams(window.location.search),
          report = query.get("report");
        if (report && r.data.reports.some((v: Report) => v.key === report)) {
          setSelected({
            [report]: r.data.reports.find((v: Report) => v.key === report)
              .columns,
          });
          if (query.get("from") && query.get("to"))
            setFilters({ from: query.get("from"), to: query.get("to") });
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    apiFetch("/smart-reports/presets")
      .then((r) => {
        if (live) setPresets(r.data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const changeFilters = (next: any, resetDependencies = true) => {
    next = { ...next };
    if (resetDependencies) {
      if (next.academicSessionId !== filters.academicSessionId) {
        delete next.examId;
        delete next.studentId;
        delete next.sectionId;
      }
      if (next.classId !== filters.classId) {
        delete next.sectionId;
        delete next.studentId;
        delete next.subjectId;
        delete next.examId;
      }
      if (next.sectionId !== filters.sectionId) delete next.studentId;
    }
    setFilters(next);
    setPreview([]);
    setDashboard(null);
    setAi(null);
  };
  const loadPreview = (next = 1) =>
    run("Loading report preview…", async () => {
      hasPreview.current = true;
      const response = await apiFetch("/smart-reports/preview", {
        method: "POST",
        body: JSON.stringify({ ...request, page: next }),
      });
      setPreview(response.data.reports);
      setPage(next);
    });
  const hasPreview = useRef(false);
  useRecordRefresh(() => {
    if (hasPreview.current) void loadPreview(page);
  }, [
    "finance",
    "school-admin",
    "exams",
    "teacher",
    "workforce",
    "receptionist",
  ]);
  useEffect(() => {
    if (!hasPreview.current || !Object.keys(selected).length) return;
    let live = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy("Updating filtered preview…");
      setError("");
      try {
        const response = await apiFetch("/smart-reports/preview", {
          method: "POST",
          body: JSON.stringify({
            filters,
            selections: Object.entries(selected).map(([report, columns]) => ({
              report,
              columns,
            })),
            page: 1,
          }),
          signal: controller.signal,
        });
        if (live) {
          setPreview(response.data.reports);
          setPage(1);
        }
      } catch (e: any) {
        if (live) setError(e.message);
      } finally {
        if (live) setBusy("");
      }
    }, 400);
    return () => {
      live = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [filters, selected]);
  const calculate = () =>
    run("Calculating recorded school performance…", async () => {
      const r = await apiFetch("/smart-reports/intelligence", {
        method: "POST",
        body: JSON.stringify({ filters, settings }),
      });
      setDashboard(r.data);
      setAi(null);
      setActions((await apiFetch("/smart-reports/actions")).data);
    });
  const download = () =>
    run("Preparing secure download…", async () => {
      const blob = await privateFile(
          filters.studentId
            ? "/smart-reports/student/" + filters.studentId + "/export"
            : "/smart-reports/export",
          { method: "POST", body: JSON.stringify({ ...request, formats }) },
        ),
        extension = blob.type.includes("zip")
          ? "zip"
          : blob.type.includes("pdf")
            ? "pdf"
            : blob.type.includes("spreadsheet")
              ? "xlsx"
              : "csv",
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${selections.length === 1 ? selections[0].report : "school-reports"}_${filters.from}_${filters.to}_${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSuccess(
        "Report generated successfully. Download requested; check your browser downloads.",
      );
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  const period = (key: string) => {
    const start = new Date(),
      end = new Date();
    if (key === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }
    if (key === "week")
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (key === "month") start.setDate(1);
    if (key === "lastMonth") {
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
    }
    if (key === "year") start.setMonth(0, 1);
    if (key === "lastYear") {
      start.setFullYear(start.getFullYear() - 1, 0, 1);
      end.setFullYear(end.getFullYear() - 1, 11, 31);
    }
    changeFilters({ ...filters, from: day(start), to: day(end) });
  };
  return (
    <fieldset
      disabled={!!busy}
      aria-label="School reporting workspace"
      className="mx-auto min-w-0 max-w-[1440px] space-y-6 border-0 p-0 pb-12"
    >
      <header className="border-b border-zinc-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-red-700">
          {intelligence ? "Evidence into action" : "Your school, documented"}
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {intelligence
            ? "School Intelligence & Improvement"
            : "Reports & Data Export"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
          {intelligence
            ? "Understand recorded performance, review the evidence and track practical improvements. Recommendations are advisory."
            : "Choose authorized school records, preview the fields you need and download private reports."}
        </p>
      </header>
      {success && (
        <p
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {success}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <section className="rounded-lg border bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium">
            Quick period
            <select
              aria-label="Quick period"
              defaultValue=""
              onChange={(e) => e.target.value && period(e.target.value)}
              className={control + " mt-2"}
            >
              <option value="">Custom / choose period</option>
              {[
                "today",
                "yesterday",
                "week",
                "month",
                "lastMonth",
                "year",
                "lastYear",
              ].map((k) => (
                <option key={k} value={k}>
                  {label(k)}
                </option>
              ))}
            </select>
          </label>
          {["from", "to"].map((k) => (
            <label key={k} className="text-sm font-medium capitalize">
              {k}
              <input
                type="date"
                value={filters[k]}
                onChange={(e) =>
                  changeFilters({ ...filters, [k]: e.target.value })
                }
                className={control + " mt-2"}
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Asia/Karachi · Both dates included · Branch scope follows the header
          selection · Maximum 731 days.
        </p>
        {Object.keys(filters)
          .filter((k) => !["from", "to"].includes(k))
          .map((k) => (
            <button
              key={k}
              className="mr-2 mt-3 border px-3 py-2 text-xs"
              onClick={() => {
                const next = { ...filters };
                delete next[k];
                changeFilters(next);
              }}
            >
              {reportFilterLabel(k)}:{" "}
              {filterLabels[k + ":" + filters[k]] ||
                preview[0]?.filterLabels?.[k] ||
                (k.endsWith("Id")
                  ? "Selected school record"
                  : readableReportValue(filters[k], k))}{" "}
              ×
            </button>
          ))}
      </section>
      {busy && (
        <p
          role="status"
          aria-live="polite"
          className="border-l-4 border-red-600 bg-red-50 p-3 text-sm"
        >
          {busy}
        </p>
      )}
      {intelligence ? (
        <>
          <section className="rounded-lg border bg-white p-5">
            <h2 className="font-semibold">Review thresholds</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Practical defaults for review, not official education standards.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                ["lowAttendance", "Attendance below (%)"],
                ["expenseIncrease", "Expense increase (%)"],
                ["staleAdmissionDays", "Open application age (days)"],
              ].map(([key, title]) => (
                <label className="text-sm" key={key}>
                  {title}
                  <input
                    type="number"
                    min="1"
                    value={(settings as any)[key]}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        [key]: Number(e.target.value),
                      });
                      setDashboard(null);
                    }}
                    className={control + " mt-2"}
                  />
                </label>
              ))}
            </div>
            <button
              disabled={!!busy}
              onClick={calculate}
              className={button + " mt-5 bg-red-600 text-white"}
            >
              Calculate insights
            </button>
          </section>
          {dashboard && (
            <>
              <p className="text-xs text-zinc-500">
                Updated {new Date(dashboard.generatedAt).toLocaleString()} ·
                Evaluated {dashboard.filters.from} — {dashboard.filters.to} ·
                Previous equal-length period: {dashboard.previous.from} —{" "}
                {dashboard.previous.to}
              </p>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {dashboard.metrics.map((m: any) => (
                  <article
                    key={m.key}
                    className="border-l-2 border-red-600 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-xs font-medium text-zinc-500">
                      {m.label}
                    </h2>
                    <p className="mt-3 text-2xl font-bold">
                      {m.current === null
                        ? "N/A"
                        : `${m.unit === "PKR" ? "PKR " : ""}${Number(m.current).toLocaleString(undefined, { maximumFractionDigits: m.unit === "PKR" ? 2 : 1 })}${m.unit === "%" ? "%" : ""}`}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {m.percent == null
                        ? "No comparable baseline"
                        : `${m.change >= 0 ? "+" : ""}${m.change.toLocaleString()} / ${m.percent.toFixed(1)}% vs previous period`}
                    </p>
                  </article>
                ))}
              </section>
              <section className="grid gap-4 lg:grid-cols-2">
                {dashboard.charts.map((chart: any) => (
                  <div key={chart.title}>
                    <DataChart {...chart} />
                    <a
                      href={
                        typeof window !== "undefined"
                          ? window.location.pathname.replace(
                              /\/intelligence$/,
                              "/reports",
                            ) +
                            `?report=${chart.report}&from=${dashboard.filters.from}&to=${dashboard.filters.to}`
                          : "#"
                      }
                      className="mt-2 inline-block text-xs font-semibold text-red-700"
                    >
                      Open source report →
                    </a>
                  </div>
                ))}
              </section>
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-semibold">Data quality & limitations</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                  {dashboard.quality.map((q: string) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </section>
              <section className="space-y-4">
                <h2 className="text-xl font-semibold">Improvement review</h2>
                {!dashboard.insights.length && (
                  <p className="text-sm text-zinc-500">
                    No rule was triggered by the available evidence. This does
                    not mean every area has been assessed.
                  </p>
                )}
                {[
                  ...dashboard.insights,
                  ...actions
                    .filter(
                      (a) =>
                        !dashboard.insights.some((i: any) => i.rule === a.rule),
                    )
                    .map((a) => ({
                      rule: a.rule,
                      title: label(a.rule.replaceAll("-", " ")),
                      kind: "SAVED REVIEW",
                      priority: "REVIEW",
                      evidence:
                        "This saved action is not triggered by the currently selected evidence.",
                      action:
                        "Review the saved decision and update its status when appropriate.",
                      expectedOutcome: "Maintain an accurate review history.",
                      measurement:
                        "Recalculate insights for the relevant period before closing the review.",
                    })),
                ].map((insight: any) => (
                  <ActionReview
                    key={insight.rule}
                    insight={insight}
                    saved={actions.find((a) => a.rule === insight.rule)}
                    disabled={!!busy}
                    onSave={(value) =>
                      run("Saving review…", async () => {
                        const r = await apiFetch(
                          "/smart-reports/actions/" + insight.rule,
                          { method: "PUT", body: JSON.stringify(value) },
                        );
                        setActions([
                          ...actions.filter((a) => a.rule !== insight.rule),
                          r.data,
                        ]);
                      })
                    }
                  />
                ))}
              </section>
              <section className="rounded-lg border bg-white p-5">
                <h2 className="font-semibold">AI interpretation</h2>
                <p className="mt-2 text-sm text-zinc-600">
                  Only aggregated evidence is sent to the configured provider.
                  Review all suggestions before acting.
                </p>
                <button
                  disabled={!!busy || !dashboard.aiAvailable}
                  onClick={() =>
                    run("Interpreting aggregate evidence…", async () => {
                      setAi(
                        (
                          await apiFetch(
                            "/smart-reports/intelligence/interpret",
                            {
                              method: "POST",
                              body: JSON.stringify({ filters, settings }),
                            },
                          )
                        ).data,
                      );
                    })
                  }
                  className={button + " mt-4"}
                >
                  {dashboard.aiAvailable
                    ? "Generate interpretation"
                    : "AI provider is not configured"}
                </button>
                {ai && (
                  <div className="mt-4 space-y-3 text-sm">
                    <p>{ai.summary}</p>
                    {ai.recommendations.map((r: any, i: number) => (
                      <article key={i} className="border-t pt-3">
                        <p className="font-semibold">
                          {r.priority}: {r.action}
                        </p>
                        <p>Evidence: {r.evidence}</p>
                        <p>Hypothesis: {r.hypothesis}</p>
                        <p>Measure: {r.measurement}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <section className="rounded-lg border bg-white p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-semibold">
                1. Choose reports ({selections.length} selected)
              </h2>
              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => {
                    setSelected(
                      Object.fromEntries(
                        catalogue.map((r) => [r.key, r.columns]),
                      ),
                    );
                    setPreview([]);
                  }}
                  className="text-red-700"
                >
                  Select all
                </button>
                <button
                  onClick={() => {
                    setSelected({});
                    setPreview([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div
              className="mt-4 flex flex-wrap gap-2"
              aria-label="Select report category"
            >
              {Array.from(new Set(catalogue.map((r) => r.category))).map(
                (category) => (
                  <button
                    key={category}
                    className="rounded border border-zinc-200 px-3 py-2 text-xs font-medium hover:border-red-300 hover:bg-red-50"
                    onClick={() => {
                      setSelected({
                        ...selected,
                        ...Object.fromEntries(
                          catalogue
                            .filter((r) => r.category === category)
                            .map((r) => [r.key, r.columns]),
                        ),
                      });
                      setPreview([]);
                    }}
                  >
                    Select {category}
                  </button>
                ),
              )}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {catalogue.map((report) => (
                <article
                  key={report.key}
                  className={`rounded-md border p-4 ${selected[report.key] ? "border-red-300 bg-red-50/40" : "border-zinc-200"}`}
                >
                  <label className="flex items-start gap-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={!!selected[report.key]}
                      onChange={(e) => {
                        const next = { ...selected };
                        if (e.target.checked) next[report.key] = report.columns;
                        else delete next[report.key];
                        setSelected(next);
                        setPreview([]);
                      }}
                      className="mt-1 accent-red-600"
                    />
                    <span>
                      <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
                        {report.category}
                      </span>
                      {report.title}
                    </span>
                  </label>
                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    {report.note}
                  </p>
                  {selected[report.key] && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer font-medium">
                        Choose columns ({selected[report.key].length})
                      </summary>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {report.columns.map((c) => (
                          <label key={c} className="flex gap-2">
                            <input
                              type="checkbox"
                              checked={selected[report.key].includes(c)}
                              disabled={
                                selected[report.key].length === 1 &&
                                selected[report.key].includes(c)
                              }
                              onChange={(e) => {
                                setSelected({
                                  ...selected,
                                  [report.key]: e.target.checked
                                    ? [...selected[report.key], c]
                                    : selected[report.key].filter(
                                        (v) => v !== c,
                                      ),
                                });
                                setPreview([]);
                              }}
                              className="accent-red-600"
                            />
                            {reportColumnLabel(report.key, c)}
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Unavailable: transport operations, inventory, historical capacity.
              These are not represented by invented data.
            </p>
          </section>
          <FilterPicker
            onLabel={(field, value, name) =>
              setFilterLabels((previous) => ({
                ...previous,
                [field + ":" + value]: name,
              }))
            }
            catalogue={catalogue}
            selected={Object.keys(selected)}
            filters={filters}
            onChange={changeFilters}
          />
          <section className="grid gap-5 rounded-lg border bg-white p-5 lg:grid-cols-2">
            <div>
              <h2 className="font-semibold">Saved selections</h2>
              <div className="mt-3 flex gap-2">
                <input
                  placeholder="Preset name, e.g. Monthly collections"
                  aria-label="Preset name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={control}
                />
                <button
                  disabled={!!busy || !name.trim() || !selections.length}
                  onClick={() =>
                    run("Saving selection…", async () => {
                      await apiFetch("/smart-reports/presets", {
                        method: "POST",
                        body: JSON.stringify({ name, configuration: request }),
                      });
                      setPresets(
                        (await apiFetch("/smart-reports/presets")).data,
                      );
                      setName("");
                    })
                  }
                  className={button}
                >
                  Save
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {presets.map((p) => (
                  <span key={p._id} className="flex border text-xs">
                    <button
                      onClick={() => {
                        setSelected(
                          Object.fromEntries(
                            p.configuration.selections.map((s: any) => [
                              s.report,
                              s.columns,
                            ]),
                          ),
                        );
                        changeFilters(p.configuration.filters, false);
                      }}
                      className="px-3 py-2"
                    >
                      {p.name}
                    </button>
                    <button
                      aria-label={"Delete " + p.name}
                      onClick={() =>
                        run("Deleting preset…", async () => {
                          await apiFetch("/smart-reports/presets/" + p._id, {
                            method: "DELETE",
                          });
                          setPresets(presets.filter((v) => v._id !== p._id));
                        })
                      }
                      className="border-l px-2"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h2 className="font-semibold">2. Preview & download</h2>
              <div className="mt-3 flex gap-5">
                {["csv", "xlsx", "pdf"].map((format) => (
                  <label className="flex gap-2 text-sm uppercase" key={format}>
                    <input
                      type="checkbox"
                      checked={formats.includes(format)}
                      onChange={(e) =>
                        setFormats(
                          e.target.checked
                            ? [...formats, format]
                            : formats.filter((f) => f !== format),
                        )
                      }
                      className="accent-red-600"
                    />
                    {format}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={!!busy || !selections.length}
                  onClick={() => loadPreview()}
                  className={button}
                >
                  Preview report
                </button>
                <button
                  disabled={!!busy || !selections.length || !formats.length}
                  onClick={download}
                  className={button + " bg-red-600 text-white"}
                >
                  Download{" "}
                  {formats.length > 1 ||
                  (formats.includes("csv") && selections.length > 1)
                    ? "ZIP bundle"
                    : "report"}
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                5,000 rows/report · 10,000 combined · PDF: 1,000 rows · Maximum
                20 MB. Narrow filters if a limit is reached.
              </p>
            </div>
          </section>
          {preview.map((report) => (
            <section
              key={report.report}
              className="min-w-0 overflow-hidden rounded-lg border bg-white"
            >
              <div className="p-5">
                <h2 className="font-semibold">
                  {report.title}{" "}
                  <span className="font-normal text-zinc-500">
                    · {report.total.toLocaleString()} records
                  </span>
                </h2>
                <p className="mt-2 text-xs text-zinc-500">{report.note}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100">
                    <tr>
                      {report.columns.map((c: string) => (
                        <th
                          key={c}
                          className="whitespace-nowrap p-3 font-medium"
                        >
                          {reportColumnLabel(report.key || report.report, c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row: any, i: number) => (
                      <tr key={i} className="border-t">
                        {report.columns.map((c: string) => (
                          <td key={c} className="max-w-xs truncate p-3">
                            {displayReportCell(row, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.rows.length && (
                <p className="p-5 text-sm text-zinc-500">
                  No matching recorded data.
                </p>
              )}
            </section>
          ))}
          {preview.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <button
                disabled={!!busy || page <= 1}
                onClick={() => loadPreview(page - 1)}
                className={button}
              >
                Previous
              </button>
              <span className="text-sm">Page {page} · 25 rows per report</span>
              <button
                disabled={!!busy || preview.every((r) => page * 25 >= r.total)}
                onClick={() => loadPreview(page + 1)}
                className={button}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
function ActionReview({
  insight,
  saved,
  onSave,
  disabled,
}: {
  insight: any;
  saved: any;
  onSave: (v: any) => void;
  disabled: boolean;
}) {
  const [status, setStatus] = useState(saved?.status || "NEW"),
    [notes, setNotes] = useState(saved?.notes || ""),
    [reviewDate, setReviewDate] = useState(
      saved?.reviewDate || insight.reviewDate || "",
    );
  return (
    <article className="rounded-lg border bg-white p-5">
      <p className="text-xs font-semibold uppercase text-red-700">
        {insight.kind} · {insight.priority}
      </p>
      <h3 className="mt-2 font-semibold">{insight.title}</h3>
      <p className="mt-2 text-sm">{insight.evidence}</p>
      <p className="mt-2 text-sm text-zinc-600">{insight.action}</p>
      <p className="mt-2 text-xs text-zinc-500">
        Expected outcome: {insight.expectedOutcome} Measure:{" "}
        {insight.measurement}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Review status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={control + " mt-1"}
          >
            {["NEW", "IN_PROGRESS", "COMPLETED", "DISMISSED"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Review date
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => setReviewDate(e.target.value)}
            className={control + " mt-1"}
          />
        </label>
        <label className="text-xs sm:col-span-2">
          Internal notes
          <textarea
            placeholder="Record the review decision and next action"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            className={control + " mt-1"}
          />
        </label>
      </div>
      <button
        disabled={disabled}
        onClick={() =>
          onSave({ status, notes, reviewDate: reviewDate || null })
        }
        className={button + " mt-3"}
      >
        Save review
      </button>
    </article>
  );
}
function FilterPicker({
  catalogue,
  selected,
  filters,
  onChange,
  onLabel,
}: {
  onLabel: (field: string, value: string, name: string) => void;
  catalogue: Report[];
  selected: string[];
  filters: any;
  onChange: (v: any) => void;
}) {
  const [field, setField] = useState(""),
    [value, setValue] = useState(""),
    [search, setSearch] = useState(""),
    [options, setOptions] = useState<any[]>([]),
    [lookupError, setLookupError] = useState("");
  const reports = catalogue.filter((r) => selected.includes(r.key)),
    fields = reports.length
      ? reports[0].filters.filter((f) =>
          reports.every((r) => r.filters.includes(f)),
        )
      : [];
  const enumValues = reports.length
    ? (reports[0].values?.[field] || []).filter((v) =>
        reports.every((r) => (r.values?.[field] || []).includes(v)),
      )
    : [];
  useEffect(() => {
    if (!(field.endsWith("Id") || field === "department")) {
      setOptions([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      apiFetch(
        `/smart-reports/options?field=${encodeURIComponent(field)}&search=${encodeURIComponent(search)}${[
          "classId",
          "sectionId",
          "academicSessionId",
        ]
          .filter((k) => filters[k])
          .map((k) => `&${k}=${encodeURIComponent(filters[k])}`)
          .join("")}`,
      )
        .then((r) => {
          if (live) {
            setOptions(r.data.options);
            setLookupError(
              r.data.hasMore
                ? "More matches available. Type a more specific name."
                : "",
            );
          }
        })
        .catch((e) => {
          if (live) setLookupError(e.message);
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [field, search, filters]);
  return (
    <section className="rounded-lg border bg-white p-5">
      <h2 className="font-semibold">Optional filters</h2>
      <p className="mt-2 text-xs text-zinc-500">
        Only filters supported by every selected report are offered. Select
        student-compatible reports and a student filter for a single child&#39;s
        export.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-40 text-xs">
          Filter
          <select
            value={fields.includes(field) ? field : ""}
            onChange={(e) => {
              setField(e.target.value);
              setValue("");
              setSearch("");
              setOptions([]);
              setLookupError("");
            }}
            className={control + " mt-1"}
          >
            <option value="">Choose a filter</option>
            {fields.map((f) => (
              <option key={f} value={f}>
                {reportFilterLabel(f)}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-48 flex-1">
          {field.endsWith("Id") || field === "department" ? (
            <>
              <label className="text-xs">
                Find by name
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setValue("");
                  }}
                  placeholder="Search school records…"
                  className={control + " mt-1"}
                />
              </label>
              <select
                aria-label="Choose matching record"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={control + " mt-2"}
              >
                <option value="">Choose a record</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {lookupError && (
                <p role="status" className="mt-1 text-xs text-zinc-500">
                  {lookupError}
                </p>
              )}
            </>
          ) : (
            <label className="text-xs">
              Value
              {enumValues.length ? (
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={control + " mt-1"}
                >
                  <option value="">Choose a value</option>
                  {enumValues.map((v) => (
                    <option key={v} value={v}>
                      {readableReportValue(v, field)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Exact recorded value, e.g. ACTIVE"
                  className={control + " mt-1"}
                />
              )}
            </label>
          )}
        </div>
        <button
          disabled={!value || !fields.includes(field)}
          onClick={() => {
            onLabel(
              field,
              value.trim(),
              options.find((o) => o.value === value)?.label ||
                String(readableReportValue(value, field)),
            );
            onChange({ ...filters, [field]: value.trim() });
            setValue("");
          }}
          className={button}
        >
          Apply filter
        </button>
      </div>
    </section>
  );
}
