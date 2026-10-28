const ts = require("typescript"),
  fs = require("fs"),
  assert = require("assert/strict");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const {
  calculateAssessment,
} = require("../src/server/services/assessmentMath.ts");
let n = 0;
const eq = (a, b, label) => {
  assert.deepEqual(a, b, label);
  n++;
};
const rules = [
    { grade: "PASS", minPercentage: 50, maxPercentage: 100 },
    { grade: "FAIL", minPercentage: 0, maxPercentage: 49.99 },
  ],
  subjects = [{ _id: "s", name: "English", totalMarks: 100, passingMarks: 50 }],
  results = [
    {
      examId: "mid",
      subjectScores: [
        { subjectId: "s", maxMarks: 50, obtainedMarks: 40, grade: "PASS" },
      ],
    },
    {
      examId: "final",
      subjectScores: [
        { subjectId: "s", maxMarks: 100, obtainedMarks: 70, grade: "PASS" },
      ],
    },
  ],
  base = {
    method: "WEIGHTED",
    components: [
      { examId: "mid", weight: 40 },
      { examId: "final", weight: 60 },
    ],
    absence: "ZERO_FAIL",
    requireAllSubjects: true,
  };
const calc = (p = base, r = results, s = subjects, g = rules) =>
  calculateAssessment(p, s, r, g);
eq(calc().overall.percentage, 74, "normalized unequal maxima weighting");
eq(calc().overall.obtained, null, "weighted has no misleading raw total");
eq(calc().overall.status, "PASSED", "configured passing rule");
eq(
  calc({ ...base, method: "CUMULATIVE" }).overall.percentage,
  (110 / 150) * 100,
  "explicit cumulative marks",
);
eq(
  calc({ ...base, method: "CUMULATIVE" }).overall.max,
  150,
  "same eligible maxima",
);
eq(
  calc({ ...base, method: "FINAL_ONLY", components: [{ examId: "final" }] })
    .overall.percentage,
  70,
  "final-only explicit",
);
eq(
  calc(base, results.slice(0, 1)).overall.status,
  "INCOMPLETE",
  "missing result not zero",
);
eq(
  calc(base, results.slice(0, 1)).overall.percentage,
  null,
  "never renormalizes missing component",
);
const zero = structuredClone(results);
zero[0].subjectScores[0].obtainedMarks = 0;
eq(calc(base, zero).rows[0].scores[0].obtained, 0, "explicit zero retained");
eq(calc(base, zero).overall.percentage, 42, "explicit zero participates");
const absent = structuredClone(results);
absent[0].subjectScores[0].isAbsent = true;
eq(
  calc(base, absent).overall.status,
  "FAILED",
  "recorded absence policy zero fail",
);
eq(
  calc({ ...base, absence: "INCOMPLETE" }, absent).overall.status,
  "INCOMPLETE",
  "absence review policy",
);
for (const grade of ["PENDING", "WITHHELD", "EXEMPT"]) {
  const r = structuredClone(results);
  r[0].subjectScores[0].grade = grade;
  eq(
    calc(base, r).overall.status,
    "INCOMPLETE",
    grade + " not silently zero or pass",
  );
}
const missing = structuredClone(results);
missing[0].subjectScores[0].obtainedMarks = null;
eq(calc(base, missing).overall.status, "INCOMPLETE", "null distinct from zero");
const stale = structuredClone(results);
stale[0].needsProcessing = true;
eq(
  calc(base, stale).overall.status,
  "INCOMPLETE",
  "stale processed result rejected",
);
eq(
  calc(base, [...results, results[0]]).overall.status,
  "INCOMPLETE",
  "duplicate record never double counted",
);
eq(
  calc(base, results, [
    ...subjects,
    { _id: "missing", name: "Science", totalMarks: 100, passingMarks: 50 },
  ]).overall.status,
  "INCOMPLETE",
  "missing required subject prevents pass",
);
eq(
  calc(base, results, subjects, []).overall.status,
  "INCOMPLETE",
  "missing school grading configuration cannot be passed",
);
for (const p of [
  {
    ...base,
    components: [
      { examId: "mid", weight: 30 },
      { examId: "final", weight: 60 },
    ],
  },
  {
    ...base,
    components: [
      { examId: "mid", weight: 50 },
      { examId: "mid", weight: 50 },
    ],
  },
  { ...base, method: "FINAL_ONLY" },
]) {
  assert.throws(() => calc(p));
  n++;
}
const explicitAbsent = structuredClone(results);
explicitAbsent[0].subjectScores[0].isAbsent = true;
explicitAbsent[0].subjectScores[0].obtainedMarks = null;
eq(
  calc(base, explicitAbsent).rows[0].scores[0].obtained,
  0,
  "Recorded absence uses the zero policy without an entered score",
);
const boundary = structuredClone(results);
boundary[0].subjectScores[0].obtainedMarks = 24.999;
boundary[1].subjectScores[0].obtainedMarks = 49.998;
eq(
  calc(base, boundary).overall.status,
  "PASSED",
  "Display rounding and pass threshold agree",
);
console.log(`PASS: ${n} assessment calculation checks.`);
