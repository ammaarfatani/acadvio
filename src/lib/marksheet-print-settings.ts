import { z } from "zod";

export const marksheetId = z.string().regex(/^[a-f\d]{24}$/i);
export const paperSizes = {
  A4: [210, 297],
  Legal: [215.9, 355.6],
  Letter: [215.9, 279.4],
} as const;

export const alignmentFields = [
  "studentName", "fatherName", "className", "sectionName", "grNumber",
  "examinationName", "academicSession", "serialNumber", "subjectName",
  "examTitle0", "exam0Max", "exam0Obtained", "examTitle1", "exam1Max",
  "exam1Obtained", "examTitle2", "exam2Max", "exam2Obtained", "examTitle3",
  "exam3Max", "exam3Obtained", "grandMax", "grandObtained", "status",
  "totalMarks", "percentage", "grade", "rank", "attendance", "teacherComments",
  "classTeacherSignature", "principalSignature", "stamp",
] as const;
export type AlignmentField = (typeof alignmentFields)[number];

export const defaultAlignmentFields = {
  studentName: { x: 35, y: 48, width: 80, height: 8, fontSize: 10, bold: false, align: "left" as const, lineHeight: 1.2 },
  fatherName: { x: 130, y: 48, width: 65, height: 8, fontSize: 10, bold: false, align: "left" as const, lineHeight: 1.2 },
  className: { x: 35, y: 58, width: 45, height: 8, fontSize: 10, bold: false, align: "left" as const, lineHeight: 1.2 },
  sectionName: { x: 90, y: 58, width: 35, height: 8, fontSize: 10, bold: false, align: "left" as const, lineHeight: 1.2 },
  grNumber: { x: 145, y: 58, width: 50, height: 8, fontSize: 10, bold: false, align: "left" as const, lineHeight: 1.2 },
  examinationName: { x: 35, y: 68, width: 90, height: 8, fontSize: 10, bold: false, align: "left" as const, lineHeight: 1.2 },
  academicSession: { x: 130, y: 68, width: 65, height: 8, fontSize: 10, bold: false, align: "left" as const, lineHeight: 1.2 },
  serialNumber: { x: 13, y: 0, width: 10, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  subjectName: { x: 25, y: 0, width: 52, height: 7, fontSize: 9, bold: false, align: "left" as const, lineHeight: 1.2 },
  examTitle0: { x: 77, y: 93, width: 27, height: 8, fontSize: 8, bold: false, align: "center" as const, lineHeight: 1.1 },
  exam0Max: { x: 77, y: 0, width: 13, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  exam0Obtained: { x: 91, y: 0, width: 13, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  examTitle1: { x: 104, y: 93, width: 27, height: 8, fontSize: 8, bold: false, align: "center" as const, lineHeight: 1.1 },
  exam1Max: { x: 104, y: 0, width: 13, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  exam1Obtained: { x: 118, y: 0, width: 13, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  examTitle2: { x: 131, y: 93, width: 30, height: 8, fontSize: 8, bold: false, align: "center" as const, lineHeight: 1.1 },
  exam2Max: { x: 131, y: 0, width: 14, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  exam2Obtained: { x: 146, y: 0, width: 15, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  examTitle3: { x: 161, y: 93, width: 20, height: 8, fontSize: 8, bold: false, align: "center" as const, lineHeight: 1.1 },
  exam3Max: { x: 161, y: 0, width: 9, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  exam3Obtained: { x: 171, y: 0, width: 10, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  grandMax: { x: 181, y: 0, width: 12, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  grandObtained: { x: 193, y: 0, width: 12, height: 7, fontSize: 9, bold: false, align: "center" as const, lineHeight: 1.2 },
  status: { x: 25, y: 0, width: 35, height: 8, fontSize: 9, bold: false, align: "left" as const, lineHeight: 1.2 },
  totalMarks: { x: 85, y: 202, width: 30, height: 8, fontSize: 10, bold: false, align: "center" as const, lineHeight: 1.2 },
  percentage: { x: 125, y: 202, width: 20, height: 8, fontSize: 10, bold: false, align: "center" as const, lineHeight: 1.2 },
  grade: { x: 150, y: 202, width: 20, height: 8, fontSize: 10, bold: false, align: "center" as const, lineHeight: 1.2 },
  rank: { x: 175, y: 202, width: 20, height: 8, fontSize: 10, bold: false, align: "center" as const, lineHeight: 1.2 },
  attendance: { x: 25, y: 215, width: 45, height: 8, fontSize: 9, bold: false, align: "left" as const, lineHeight: 1.2 },
  teacherComments: { x: 25, y: 230, width: 160, height: 18, fontSize: 9, bold: false, align: "left" as const, lineHeight: 1.2 },
  classTeacherSignature: { x: 25, y: 260, width: 40, height: 15, fontSize: 8, bold: false, align: "center" as const, lineHeight: 1.2 },
  principalSignature: { x: 155, y: 260, width: 40, height: 15, fontSize: 8, bold: false, align: "center" as const, lineHeight: 1.2 },
  stamp: { x: 105, y: 255, width: 24, height: 24, fontSize: 8, bold: false, align: "center" as const, lineHeight: 1.2 },
};

const fieldSchema = z.object({
  x: z.number().min(0).max(500), y: z.number().min(0).max(500),
  width: z.number().min(2).max(500), height: z.number().min(2).max(100),
  fontSize: z.number().min(5).max(32), bold: z.boolean(),
  align: z.enum(["left", "center", "right"]), lineHeight: z.number().min(0.8).max(3),
}).strict();
export type AlignmentFieldSettings = z.infer<typeof fieldSchema>;
const optionalFieldSchema = fieldSchema.optional();
const alignmentFieldMap = z.object(Object.fromEntries(
  alignmentFields.map(field => [field, optionalFieldSchema]),
) as Record<AlignmentField, typeof optionalFieldSchema>);
const reusableTemplate = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), fields: alignmentFieldMap,
  rowStartY: z.number().min(0).max(500), rowHeight: z.number().min(3).max(30), calibrationX: z.number().min(-20).max(20), calibrationY: z.number().min(-20).max(20),
  paper: z.enum(["A4", "Legal", "Letter"]), orientation: z.enum(["portrait", "landscape"]), customPaper: z.boolean(), pageWidth: z.number().min(100).max(500), pageHeight: z.number().min(100).max(700),
}).strict();

export const marksheetPrintSettingsSchema = z.object({
  format: z.enum(["default", "preprinted"]),
  paper: z.enum(["A4", "Legal", "Letter"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  customPaper: z.boolean().default(false),
  pageWidth: z.number().min(100).max(500).default(210),
  pageHeight: z.number().min(100).max(700).default(297),
  mode: z.enum(["values", "table"]).default("values"),
  exam: z.union([z.literal("selected"), z.literal("annual"), marksheetId]).default("selected"),
  studentDetails: z.boolean().default(true), marksTable: z.boolean().default(true), resultSummary: z.boolean().default(true),
  teacherComments: z.boolean().default(true), signatures: z.boolean().default(true),
  offsetX: z.number().min(-20).max(20).default(0), offsetY: z.number().min(-20).max(20).default(0),
  rowStartY: z.number().min(0).max(500).default(103), rowHeight: z.number().min(3).max(30).default(8),
  fields: alignmentFieldMap.default(defaultAlignmentFields),
  backgroundImage: z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).max(700_000).optional(),
  templates: z.array(reusableTemplate).max(20).default([]), activeTemplateId: z.string().uuid().nullable().default(null),
}).strict().refine(value => value.format === "default" ||
  value.studentDetails || value.marksTable || value.resultSummary || value.teacherComments || value.signatures,
  "Include at least one section on the pre-printed marksheet.");
export type MarksheetPrintSettings = z.infer<typeof marksheetPrintSettingsSchema>;

export const defaultMarksheetPrintSettings = marksheetPrintSettingsSchema.parse({
  format: "default", paper: "A4", orientation: "portrait", customPaper: false, pageWidth: 210, pageHeight: 297,
  mode: "values", exam: "selected", studentDetails: true, marksTable: true, resultSummary: true,
  teacherComments: true, signatures: true, offsetX: 0, offsetY: 0, rowStartY: 103, rowHeight: 8,
  fields: defaultAlignmentFields, templates: [], activeTemplateId: null,
});

export function getPageSize(settings: Pick<MarksheetPrintSettings, "paper" | "orientation" | "customPaper" | "pageWidth" | "pageHeight">) {
  const [knownWidth, knownHeight] = paperSizes[settings.paper];
  const width = settings.customPaper ? settings.pageWidth : knownWidth;
  const height = settings.customPaper ? settings.pageHeight : knownHeight;
  return settings.orientation === "landscape" ? [height, width] as const : [width, height] as const;
}
