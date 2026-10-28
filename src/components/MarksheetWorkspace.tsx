"use client";
import { BulkMarksheetPrint } from "./BulkMarksheetPrint";
import { PhotoRecordPicker } from "./PhotoRecordPicker";
import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import AnnualMarksheet from "./AnnualMarksheet";
import { useAuth } from "@/lib/auth-context";
const input =
  "mt-2 min-h-11 w-full min-w-0 rounded-md border border-zinc-300 bg-white p-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100";
export default function MarksheetWorkspace() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]),
    [classes, setClasses] = useState<any[]>([]),
    [exams, setExams] = useState<any[]>([]),
    [sections, setSections] = useState<any[]>([]),
    [students, setStudents] = useState<any[]>([]);
  const [session, setSession] = useState(""),
    [classId, setClass] = useState(""),
    [section, setSection] = useState(""),
    [exam, setExam] = useState(""),
    [student, setStudent] = useState(""),
    [search, setSearch] = useState(""),
    [view, setView] = useState("EXAM"),
    [sheet, setSheet] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [policy, setPolicy] = useState<any>(null),
    [method, setMethod] = useState("CUMULATIVE"),
    [absence, setAbsence] = useState("ZERO_FAIL"),
    [components, setComponents] = useState<Record<string, number>>({});
  const canManage = user?.permissions?.includes("exams.manage");
  useEffect(() => {
    let live = true;
    Promise.all([
      apiFetch("/exams/sessions"),
      apiFetch("/exams/classes"),
      apiFetch("/exams/schedules"),
    ])
      .then(([s, c, e]) => {
        if (!live) return;
        setSessions(s.data);
        setClasses(c.data);
        setExams(e.data);
        setSession(
          s.data.find((a: any) => a.isCurrent)?._id || s.data[0]?._id || "",
        );
        setClass(c.data[0]?._id || "");
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const scopedExams = useMemo(
    () =>
      exams.filter(
        (e) =>
          String(e.academicSessionId) === session &&
          e.classes?.some(
            (c: any) =>
              String(c) === classId ||
              c === classes.find((a) => a._id === classId)?.name,
          ),
      ),
    [exams, session, classId, classes],
  );
  useEffect(() => {
    if (!classId || !session) return;
    let live = true;
    setStudent("");
    setSheet(null);
    setSection("");
    setPolicy(null);
    setComponents({});
    Promise.all([
      apiFetch("/exams/sections?classId=" + classId),
      apiFetch(
        `/exams/assessment-policy?academicSessionId=${session}&classId=${classId}`,
      ),
    ])
      .then(([s, p]) => {
        if (!live) return;
        setSections(s.data);
        setPolicy(p.data);
        if (p.data) {
          setMethod(p.data.method);
          setAbsence(p.data.absence);
          setComponents(
            Object.fromEntries(
              p.data.components.map((c: any) => [
                String(c.examId),
                c.weight || 0,
              ]),
            ),
          );
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [classId, session]);
  useEffect(() => {
    setStudent("");
    setSheet(null);
    if (!classId || !session) return;
    let live = true;
    const timer = setTimeout(() => {
      apiFetch(
        `/exams/marksheet-candidates?academicSessionId=${session}&classId=${classId}&search=${encodeURIComponent(search)}${section ? "&sectionId=" + section : ""}`,
      )
        .then((r) => {
          if (live) setStudents(r.data.students);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [classId, session, section, search]);
  useEffect(() => {
    setExam(scopedExams[0]?._id || "");
    setSheet(null);
  }, [scopedExams]); // Exam lists are reset when their owning context changes.
  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({
        academicSessionId: session,
        classId,
        view,
        ...(exam ? { examId: exam } : {}),
      });
      setSheet((await apiFetch(`/exams/marksheet/${student}?${q}`)).data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const data = {
        academicSessionId: session,
        classId,
        method,
        absence,
        revision: policy?.revision || 0,
        components: scopedExams
          .filter((e) => e._id in components)
          .sort(
            (a, b) =>
              new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
          )
          .map((e) => ({
            examId: e._id,
            ...(method === "WEIGHTED" ? { weight: components[e._id] } : {}),
          })),
      };
      const p = await apiFetch("/exams/assessment-policy", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setPolicy(p.data);
      setSheet(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-5 pb-10">
      <header className="border-l-4 border-red-600 bg-[#f2f0ed] px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
          Examinations & results
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Marksheets</h1>
        <p className="mt-2 text-sm text-zinc-500">
          View one examination or an annual result using the class&apos;s saved
          assessment policy.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <fieldset
        disabled={busy}
        className="min-w-0 rounded-lg border bg-white p-4 sm:p-6"
      >
        <legend className="px-2 text-sm font-semibold">
          01  -  Choose class and result
        </legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="min-w-0 text-sm">
            Academic session
            <select
              className={input}
              value={session}
              onChange={(e) => {
                setSession(e.target.value);
                setStudent("");
                setSheet(null);
              }}
            >
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                  {s.isArchived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm">
            Class
            <select
              className={input}
              value={classId}
              onChange={(e) => {
                setClass(e.target.value);
                setSheet(null);
              }}
            >
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm">
            Section
            <select
              className={input}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-sm">
            Find student
            <input
              className={input}
              value={search}
              placeholder="Search student name, ID or roll number"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div>
            <PhotoRecordPicker
              label="Student"
              records={students}
              value={student}
              onChange={(id) => {
                setStudent(id);
                setSheet(null);
              }}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Up to 50 matches. Narrow your search for more.
            </p>
          </div>
          <label className="min-w-0 text-sm">
            Result view
            <select
              className={input}
              value={view}
              onChange={(e) => {
                setView(e.target.value);
                setSheet(null);
              }}
            >
              <option value="EXAM">
                One examination (Mid / Final paper only)
              </option>
              <option value="ANNUAL">
                Annual result (saved assessment policy)
              </option>
            </select>
          </label>
          <label className="min-w-0 text-sm sm:col-span-2">
            Examination
            <select
              className={input}
              value={exam}
              onChange={(e) => {
                setExam(e.target.value);
                setSheet(null);
              }}
            >
              <option value="">Choose an examination</option>
              {scopedExams.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.title} · {e.term || "Assessment"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          disabled={!student || (view === "EXAM" && !exam)}
          onClick={generate}
          className="mt-5 min-h-11 rounded-md bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Loading…" : "Preview marksheet"}
        </button>
      </fieldset>
      {canManage && (
        <details className="rounded-lg border bg-white p-4 sm:p-6">
          <summary className="cursor-pointer font-semibold">
            Annual assessment policy{" "}
            {policy
              ? `· ${policy.method}`
              : "· Not configured (legacy summary retained)"}
          </summary>
          <fieldset disabled={busy} className="mt-4 min-w-0 space-y-4">
            <p className="text-sm text-zinc-600">
              Saved per class/session. This changes annual calculations only;
              individual exam marks are preserved. Select the exact assessments
              to include.
            </p>
            <label className="block text-sm">
              Calculation method
              <select
                className={input}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="CUMULATIVE">
                  Cumulative eligible raw marks
                </option>
                <option value="WEIGHTED">
                  Weighted normalized percentages
                </option>
                <option value="FINAL_ONLY">Final examination only</option>
              </select>
            </label>
            <label className="block text-sm">
              Recorded absence
              <select
                className={input}
                value={absence}
                onChange={(e) => setAbsence(e.target.value)}
              >
                <option value="ZERO_FAIL">
                  Recorded absent paper counts as zero and fails
                </option>
                <option value="INCOMPLETE">
                  Absent paper requires review; annual result incomplete
                </option>
              </select>
            </label>
            <div className="space-y-3">
              {scopedExams.map((e) => (
                <div
                  key={e._id}
                  className="flex flex-wrap items-center gap-3 rounded border p-3"
                >
                  <label className="flex min-w-0 flex-1 items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={e._id in components}
                      onChange={(event) => {
                        const n = { ...components };
                        if (event.target.checked) n[e._id] = 0;
                        else delete n[e._id];
                        setComponents(n);
                      }}
                    />
                    <span className="break-words">{e.title}</span>
                  </label>
                  {method === "WEIGHTED" && e._id in components && (
                    <label className="text-xs">
                      Weight %
                      <input
                        aria-label={e.title + " weight"}
                        className="ml-2 w-20 rounded border p-2"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={components[e._id]}
                        onChange={(v) =>
                          setComponents({
                            ...components,
                            [e._id]: Number(v.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
            {method === "WEIGHTED" && (
              <p className="text-sm">
                Selected weights:{" "}
                {Object.values(components).reduce((a, b) => a + b, 0)}% · Must
                total 100%.
              </p>
            )}
            <button
              onClick={save}
              disabled={!session || !classId || !Object.keys(components).length}
              className="rounded border px-5 py-3 text-sm font-semibold disabled:opacity-40"
            >
              Save assessment policy
            </button>
          </fieldset>
        </details>
      )}
      <BulkMarksheetPrint
        session={session}
        classId={classId}
        section={section}
        exam={exam}
        view={view}
      />
      {sheet && (
        <AnnualMarksheet data={sheet} inline onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
