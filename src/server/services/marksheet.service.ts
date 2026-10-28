import { documentSettings } from "./schoolDocument.service";
import { readStudentPhoto } from "./studentPhoto.service";
import { ClassModel } from "../models/classSection.model";
import { AcademicSession } from "../models/academicSession.model";
import { Student } from "../models/student.model";
import { Subject } from "../models/subject.model";
import {
  ExamSchedule,
  ProcessedResult,
  GradingScale,
} from "../models/exam.model";
import { AssessmentPolicy } from "../models/assessmentPolicy.model";
import { SchoolService } from "./school.service";
import { calculateAssessment, configuredGrade } from "./assessmentMath";
import { createHash } from "crypto";
async function schoolBranding(schoolId: string, branding: any = {}) {
  const raw = await SchoolService.getSchoolProfile(schoolId);
  return {
    ...branding,
    ...Object.fromEntries(
      ["name", "logoUrl", "address", "phone", "email"].map((k) => [
        k,
        (raw as any)[k],
      ]),
    ),
  };
}
export type MarksheetOptions = {
  academicSessionId?: string;
  classId?: string;
  examId?: string;
  view?: "ANNUAL" | "EXAM";
};
export async function annualMarksheet(
  schoolId: string,
  studentId: string,
  publishedOnly = false,
  options: MarksheetOptions = {},
): Promise<any> {
  const student: any = await Student.findOne({ _id: studentId, schoolId })
    .select(
      "name studentId admissionNumber rollNumber classId className sectionId sectionName academicSessionId academicSessionName parentInfo.fatherName +photoStorageId",
    )
    .lean();
  if (!student) throw { statusCode: 404, message: "Student not found." };
  const config = await documentSettings(schoolId);
  const photo = student.photoStorageId
    ? await readStudentPhoto(student).catch((error) => {
        if (error?.statusCode === 404) return undefined;
        throw error;
      })
    : undefined;
  delete student.photoStorageId;
  const sessionId =
      options.academicSessionId || String(student.academicSessionId || ""),
    classId = options.classId || String(student.classId);
  if (!sessionId)
    return {
      school: await schoolBranding(schoolId, config.branding),
      student,
      photo,
      documentStyle: config.templates["report-card"],
      rows: [],
      components: [],
      overall: {
        obtained: null,
        max: null,
        percentage: null,
        grade: "Incomplete",
        status: "INCOMPLETE",
        complete: false,
      },
      configurationRequired: true,
      policy: { method: "CUMULATIVE", legacy: true },
      terms: {},
      midTotal: { obtained: null, max: null, percentage: null },
      finalTotal: { obtained: null, max: null, percentage: null },
    };
  if (
    (sessionId !== String(student.academicSessionId) ||
      classId !== String(student.classId)) &&
    !(await ProcessedResult.exists({
      schoolId,
      studentId,
      classId,
      examId: {
        $in: (
          await ExamSchedule.find({ schoolId, academicSessionId: sessionId })
            .select("_id")
            .lean()
        ).map((e) => e._id),
      },
    }))
  )
    throw {
      statusCode: 404,
      message: "No student records exist in the selected class and session.",
    };
  const [placement, academicSession] = await Promise.all([
    ClassModel.findOne({ _id: classId, schoolId }).select("name").lean(),
    AcademicSession.findOne({ _id: sessionId, schoolId }).select("name").lean(),
  ]);
  if (!placement || !academicSession)
    throw {
      statusCode: 404,
      message: "Class or academic session is unavailable.",
    };
  const historical =
    sessionId !== String(student.academicSessionId) ||
    classId !== String(student.classId);
  const [school, scale, subjects, exams, storedPolicy] = await Promise.all([
    schoolBranding(schoolId, config.branding),
    GradingScale.findOne({ schoolId }).lean(),
    Subject.find({ schoolId, classId })
      .select("name totalMarks passingMarks")
      .sort({ name: 1 })
      .lean(),
    ExamSchedule.find({
      schoolId,
      academicSessionId: sessionId,
      classes: { $in: [classId, (placement as any).name] },
    })
      .sort({ startDate: -1, _id: -1 })
      .lean(),
    AssessmentPolicy.findOne({
      schoolId,
      academicSessionId: sessionId,
      classId,
    }).lean(),
  ]);
  const anchor = options.examId
    ? exams.find((e) => String(e._id) === options.examId)
    : null;
  const byTerm = (term: string) =>
    exams.find(
      (e) =>
        e.term === term &&
        (!anchor || new Date(e.startDate) <= new Date(anchor.startDate)),
    );
  if (options.examId && !anchor)
    throw {
      statusCode: 404,
      message: "Examination not found in this class and session.",
    };
  let policy: any = (storedPolicy as any)
    ? {
        ...storedPolicy,
        components: (storedPolicy as any).components.map((c: any) => ({
          examId: String(c.examId),
          weight: c.weight,
        })),
        legacy: false,
      }
    : {
        method: "CUMULATIVE",
        components: [byTerm("MID_TERM"), byTerm("FINAL_TERM")]
          .filter(Boolean)
          .map((e) => ({ examId: String(e!._id) })),
        absence: "ZERO_FAIL",
        requireAllSubjects: true,
        legacy: true,
      };
  const single = options.view === "EXAM";
  if (single) {
    if (!anchor)
      throw {
        statusCode: 400,
        message: "Select an examination for an examination-only marksheet.",
      };
    policy = {
      method: "FINAL_ONLY",
      components: [{ examId: String(anchor._id) }],
      absence: (storedPolicy as any)?.absence || "ZERO_FAIL",
      requireAllSubjects: true,
      legacy: false,
    };
  }
  const components = policy.components.map((c: any) => ({
    ...c,
    exam: exams.find((e) => String(e._id) === c.examId),
  }));
  if (components.some((c: any) => !c.exam))
    throw {
      statusCode: 409,
      message:
        "An assessment policy references an unavailable examination. Review the policy.",
    };
  const results = await ProcessedResult.find({
    schoolId,
    studentId,
    classId,
    examId: { $in: components.map((c: any) => c.examId) },
    ...(publishedOnly ? { isPublished: true } : {}),
  }).lean();
  const requiredSubjects = [...subjects];
  // Retain historical subject snapshots while keeping missing current required subjects visible.
  for (const result of results)
    for (const score of result.subjectScores || [])
      if (
        score.subjectId &&
        !requiredSubjects.some((s) => String(s._id) === String(score.subjectId))
      )
        requiredSubjects.push({
          _id: score.subjectId,
          name: score.subjectName,
          totalMarks: score.maxMarks,
          passingMarks: undefined,
        } as any);
  let calculated = policy.components.length
    ? calculateAssessment(
        policy,
        requiredSubjects,
        results,
        (scale as any)?.rules || [],
      )
    : {
        rows: [],
        overall: {
          obtained: null,
          max: null,
          percentage: null,
          grade: "Incomplete",
          status: "INCOMPLETE",
          complete: false,
        },
      };
  const missingLegacy =
    policy.legacy && (!byTerm("MID_TERM") || !byTerm("FINAL_TERM"));
  if (missingLegacy)
    calculated = {
      ...calculated,
      overall: {
        obtained: null,
        max: null,
        percentage: null,
        grade: "Incomplete",
        status: "INCOMPLETE",
        complete: false,
      },
    };
  const totalFor = (term: string) => {
    const i = components.findIndex((c: any) => c.exam.term === term),
      scores = calculated.rows.map((r: any) => r.scores[i]);
    const complete =
      i >= 0 &&
      scores.length > 0 &&
      scores.every((s: any) => s && s.obtained !== null);
    const max = complete
        ? scores.reduce((n: number, s: any) => n + s.max, 0)
        : null,
      obtained = complete
        ? scores.reduce((n: number, s: any) => n + s.obtained, 0)
        : null;
    return {
      max,
      obtained,
      percentage: complete && max > 0 ? (obtained! / max) * 100 : null,
    };
  };
  const rows = calculated.rows.map((r: any) => ({
    ...r,
    mid: r.scores[
      components.findIndex((c: any) => c.exam.term === "MID_TERM")
    ] || { obtained: null, max: null, status: "Not included" },
    final: r.scores[
      components.findIndex((c: any) => c.exam.term === "FINAL_TERM")
    ] || { obtained: null, max: null, status: "Not included" },
  }));
  const branding = Object.fromEntries(
    ["name", "logoUrl", "address", "phone", "email"].map((k) => [
      k,
      (school as any)[k],
    ]),
  );
  const result = {
    school: { ...school, ...branding },
    photo,
    documentStyle: config.templates["report-card"],
    student: {
      ...student,
      academicSessionId: sessionId,
      academicSessionName: (academicSession as any).name,
      classId,
      className: (placement as any).name,
      ...(historical
        ? { sectionId: null, sectionName: "Historical section not recorded" }
        : {}),
    },
    ...calculated,
    rows,
    components: components.map((c: any) => ({
      examId: c.examId,
      title: c.exam.title,
      term: c.exam.term,
      weight: c.weight,
      startDate: c.exam.startDate,
    })),
    policy: {
      method: single ? "EXAM_ONLY" : policy.method,
      absence: policy.absence,
      legacy: policy.legacy,
      revision: (storedPolicy as any)?.revision,
    },
    configurationRequired: !single && !storedPolicy,
    view: single ? "EXAM" : "ANNUAL",
    anchorExamId: options.examId,
    midTotal: totalFor("MID_TERM"),
    finalTotal: totalFor("FINAL_TERM"),
    terms: {
      mid: byTerm("MID_TERM")?.title,
      final: byTerm("FINAL_TERM")?.title,
    },
  };
  return {
    ...result,
    sourceHash: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
    generatedAt: new Date(),
  };
}
