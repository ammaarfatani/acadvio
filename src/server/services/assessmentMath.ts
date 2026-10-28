export type AssessmentMethod = "WEIGHTED" | "CUMULATIVE" | "FINAL_ONLY";
export function configuredGrade(percentage: number | null, rules: any[]) {
  if (percentage === null) return "Incomplete";
  const rounded = Number(percentage.toFixed(2));
  return (
    [...rules]
      .sort((a, b) => b.minPercentage - a.minPercentage)
      .find((r) => rounded >= r.minPercentage && rounded <= r.maxPercentage)
      ?.grade || "Not configured"
  );
}
export function calculateAssessment(
  policy: {
    method: AssessmentMethod;
    components: { examId: string; weight?: number }[];
    absence: string;
    requireAllSubjects: boolean;
  },
  subjects: any[],
  results: any[],
  rules: any[],
) {
  const seen = new Set<string>();
  for (const c of policy.components) {
    if (seen.has(String(c.examId)))
      throw {
        statusCode: 400,
        message: "An assessment cannot be counted twice.",
      };
    seen.add(String(c.examId));
  }
  if (
    !policy.components.length ||
    (policy.method === "FINAL_ONLY" && policy.components.length !== 1)
  )
    throw {
      statusCode: 400,
      message: "Select the required assessment components.",
    };
  if (
    policy.method === "WEIGHTED" &&
    (policy.components.some(
      (c) => typeof c.weight !== "number" || c.weight <= 0,
    ) ||
      Math.abs(
        policy.components.reduce((n, c) => n + (c.weight || 0), 0) - 100,
      ) > 0.000001)
  )
    throw {
      statusCode: 400,
      message: "Assessment weights must be positive and total exactly 100%.",
    };
  const rows = subjects.map((subject) => {
    const scores = policy.components.map((c) => {
      const matches = results.filter(
        (r) => String(r.examId) === String(c.examId),
      );
      const result =
        matches.length === 1 && !matches[0].needsProcessing ? matches[0] : null;
      const entries = (result?.subjectScores || []).filter(
        (s: any) => String(s.subjectId) === String(subject._id),
      );
      const score = entries.length === 1 ? entries[0] : null;
      const absent = !!score?.isAbsent || score?.grade === "ABSENT";
      const blocked =
        !score ||
        ["PENDING", "WITHHELD", "EXEMPT"].includes(score.grade) ||
        (!absent &&
          (score.obtainedMarks == null ||
            !Number.isFinite(score.obtainedMarks))) ||
        !Number.isFinite(score.maxMarks) ||
        score.maxMarks <= 0 ||
        score.obtainedMarks < 0 ||
        score.obtainedMarks > score.maxMarks ||
        (absent && policy.absence === "INCOMPLETE");
      return {
        examId: String(c.examId),
        obtained: blocked ? null : absent ? 0 : score.obtainedMarks,
        max: score?.maxMarks ?? null,
        status: blocked
          ? score?.grade === "EXEMPT"
            ? "Exempt — policy review required"
            : score?.grade === "WITHHELD"
              ? "Withheld"
              : "Incomplete"
          : absent
            ? "Absent"
            : "Entered",
        isAbsent: absent,
        weight: c.weight,
      };
    });
    const complete =
      scores.length > 0 && scores.every((s) => s.obtained !== null);
    const rawMax = complete ? scores.reduce((n, s) => n + s.max!, 0) : null,
      rawObtained = complete
        ? scores.reduce((n, s) => n + s.obtained!, 0)
        : null;
    const percentage = !complete
      ? null
      : policy.method === "WEIGHTED"
        ? scores.reduce((n, s) => n + (s.obtained! / s.max!) * s.weight!, 0)
        : (rawObtained! / rawMax!) * 100;
    const requiredPass =
      Number.isFinite(subject.passingMarks) && subject.totalMarks > 0
        ? (subject.passingMarks / subject.totalMarks) * 100
        : null;
    const status = !complete
      ? "INCOMPLETE"
      : scores.some((s) => s.isAbsent) && policy.absence === "ZERO_FAIL"
        ? "FAILED"
        : requiredPass === null
          ? "UNCONFIGURED"
          : Number(percentage!.toFixed(2)) >= Number(requiredPass.toFixed(2))
            ? "PASSED"
            : "FAILED";
    return {
      subjectId: String(subject._id),
      name: subject.name,
      scores,
      total: policy.method === "WEIGHTED" ? null : rawObtained,
      max: policy.method === "WEIGHTED" ? null : rawMax,
      percentage,
      grade: configuredGrade(percentage, rules),
      status,
    };
  });
  const complete =
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.percentage !== null &&
        r.status !== "UNCONFIGURED" &&
        r.grade !== "Not configured",
    );
  const obtained =
      policy.method === "WEIGHTED" || !complete
        ? null
        : rows.reduce((n, r) => n + r.total!, 0),
    max =
      policy.method === "WEIGHTED" || !complete
        ? null
        : rows.reduce((n, r) => n + r.max!, 0);
  const percentage = !complete
    ? null
    : policy.method === "WEIGHTED"
      ? rows.reduce((n, r) => n + r.percentage!, 0) / rows.length
      : (obtained! / max!) * 100;
  return {
    rows,
    overall: {
      obtained,
      max,
      percentage,
      grade: configuredGrade(percentage, rules),
      status: !complete
        ? "INCOMPLETE"
        : rows.some((r) => r.status === "FAILED")
          ? "FAILED"
          : "PASSED",
      complete,
    },
  };
}
