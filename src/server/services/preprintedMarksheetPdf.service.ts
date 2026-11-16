import { getPageSize, type AlignmentField, type MarksheetPrintSettings } from "../../lib/marksheet-print-settings";
import { registerReportFonts } from "./reportFonts";
import { normalizeCardImage } from "./identityCardRender.service";

const PDFDocument = require("pdfkit");
const mm = (value: number) => value * 72 / 25.4;
const percent = (value?: number | null) => value == null ? "" : Number(value).toFixed(2) + "%";
const rowFields = new Set<AlignmentField>([
  "serialNumber", "subjectName", "exam0Max", "exam0Obtained", "exam1Max", "exam1Obtained",
  "exam2Max", "exam2Obtained", "exam3Max", "exam3Obtained", "grandMax", "grandObtained", "status",
]);

export function sampleMarksheet(title: string) {
  return {
    student: { name: "Sample Student", parentInfo: { fatherName: "Sample Parent" }, className: "Class 5", sectionName: "A",
      admissionNumber: "SAMPLE-01", rollNumber: "01", academicSessionName: "Sample session" },
    view: "ANNUAL",
    components: [{ examId: "sample", title }],
    rows: [{ name: "Sample Subject", scores: [{ obtained: 75, max: 100 }], total: 75, max: 100, percentage: 75, status: "PASSED" }],
    overall: { obtained: 75, max: 100, percentage: 75, grade: "Sample grade", status: "PASSED" },
    stationeryDetails: { rank: 1, attendancePercentage: 100, teacherRemarks: "Sample comment for alignment." },
  };
}

function valueForField(field: AlignmentField, sheet: any, componentTitles: string[]) {
  const student = sheet.student || {}, overall = sheet.overall || {}, details = sheet.stationeryDetails || {};
  const values: Partial<Record<AlignmentField, unknown>> = {
    studentName: student.name,
    fatherName: student.parentInfo?.fatherName,
    className: student.className,
    sectionName: student.sectionName,
    grNumber: student.admissionNumber || student.studentId,
    examinationName: componentTitles.join(" / "),
    academicSession: student.academicSessionName,
    totalMarks: overall.obtained == null || overall.max == null ? "" : `${overall.obtained} / ${overall.max}`,
    percentage: percent(overall.percentage),
    grade: overall.grade,
    rank: details.rank,
    attendance: percent(details.attendancePercentage),
    teacherComments: details.teacherRemarks,
  };
  return values[field];
}

export async function preprintedMarksheetPdf(settings: MarksheetPrintSettings, sheets: any[], alignmentTest = false) {
  if (!sheets.length) throw { statusCode: 400, message: "Select at least one marksheet to print." };
  const [pageWidthMm, pageHeightMm] = getPageSize(settings);
  const pageWidth = mm(pageWidthMm), pageHeight = mm(pageHeightMm);
  const doc = registerReportFonts(new PDFDocument({ autoFirstPage: false, info: { Title: alignmentTest ? "Pre-Printed Marksheet Alignment Test" : "Pre-Printed Marksheet" } }));
  const output: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (buffer: Buffer) => output.push(buffer));
    doc.on("end", () => resolve(Buffer.concat(output)));
    doc.on("error", reject);
  });
  const fields = settings.fields || {};
  const pos = (field: AlignmentField) => fields[field];
  const coordinates = (field: AlignmentField, rowIndex = 0) => {
    const config = pos(field);
    if (!config) return null;
    const x = config.x + settings.offsetX;
    const y = (rowFields.has(field) ? settings.rowStartY + config.y + rowIndex * settings.rowHeight : config.y) + settings.offsetY;
    if (x < 0 || y < 0 || x + config.width > pageWidthMm || y + config.height > pageHeightMm)
      throw { statusCode: 422, message: `The saved ${field} position is outside the selected paper size.` };
    return { x: mm(x), y: mm(y), width: mm(config.width), height: mm(config.height), config };
  };
  const drawText = (field: AlignmentField, value: unknown, rowIndex = 0) => {
    if (value == null || value === "") return;
    const box = coordinates(field, rowIndex);
    if (!box) return;
    let content = String(value);
    let fontSize = box.config.fontSize;
    const font = box.config.bold ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(fontSize);
    while (fontSize > 5 && doc.widthOfString(content) > box.width - mm(0.5)) {
      fontSize = Math.max(5, fontSize - 0.25);
      doc.fontSize(fontSize);
    }
    if (field === "teacherComments") {
      doc.save();
      doc.rect(box.x, box.y, box.width, box.height).clip();
      doc.text(content, box.x, box.y, { width: box.width, height: box.height, align: box.config.align,
        lineGap: Math.max(0, (box.config.lineHeight - 1) * fontSize), ellipsis: false });
      doc.restore();
      return;
    }
    doc.save();
    doc.rect(box.x, box.y, box.width, box.height).clip();
    doc.text(content, box.x, box.y, { width: box.width, height: box.height, align: box.config.align, lineBreak: false, ellipsis: false });
    doc.restore();
  };
  const drawImage = async (field: AlignmentField, imageValue: unknown) => {
    if (!imageValue) return;
    const box = coordinates(field);
    if (!box) return;
    const image = await normalizeCardImage(imageValue);
    if (image) doc.image(Buffer.from(image.split(",")[1], "base64"), box.x, box.y, { fit: [box.width, box.height], align: box.config.align });
  };

  for (const sheet of sheets) {
    const components: any[] = sheet.components || [];
    const rows: any[] = sheet.rows || [];
    if (settings.marksTable && components.length > 4)
      throw { statusCode: 422, message: "This stationery template maps up to four exam columns. Update its mapping before printing this assessment." };
    const titles = components.slice(0, 4).map(component => String(component.title || ""));
    const rowFieldHeight = Math.max(...[...rowFields].map(field => pos(field)?.height || 0));
    const rowEnd = settings.rowStartY + Math.max(0, rows.length - 1) * settings.rowHeight + rowFieldHeight;
    if (settings.marksTable && rowEnd + settings.offsetY > pageHeightMm)
      throw { statusCode: 422, message: "The configured subject rows do not fit on this stationery. Reduce row spacing or use a larger paper size." };
    doc.addPage({ size: [pageWidth, pageHeight], margin: 0 });

    if (alignmentTest) {
      const marker = (xMm: number, yMm: number) => {
        const x = mm(xMm), y = mm(yMm), arm = mm(2.5);
        doc.moveTo(x - arm, y).lineTo(x + arm, y).moveTo(x, y - arm).lineTo(x, y + arm).lineWidth(0.35).strokeColor("#111111").stroke();
      };
      marker(5, 5); marker(pageWidthMm - 5, 5); marker(5, pageHeightMm - 5); marker(pageWidthMm - 5, pageHeightMm - 5);
      marker(pageWidthMm / 2, pageHeightMm / 2);
    }

    if (settings.studentDetails) {
      for (const field of ["studentName", "fatherName", "className", "sectionName", "grNumber", "examinationName", "academicSession"] as const)
        drawText(field, valueForField(field, sheet, titles));
    }
    if (settings.marksTable) {
      titles.forEach((title, index) => drawText((`examTitle${index}`) as AlignmentField, title));
      rows.forEach((row, rowIndex) => {
        if (pos("serialNumber")) drawText("serialNumber", rowIndex + 1, rowIndex);
        drawText("subjectName", row.name, rowIndex);
        for (let index = 0; index < 4; index++) {
          const score = row.scores?.[index];
          drawText((`exam${index}Max`) as AlignmentField, score?.max, rowIndex);
          drawText((`exam${index}Obtained`) as AlignmentField, score?.isAbsent ? "A" : score?.obtained, rowIndex);
        }
        drawText("grandMax", row.max, rowIndex);
        drawText("grandObtained", row.total, rowIndex);
        drawText("status", row.status, rowIndex);
      });
    }
    if (settings.resultSummary) {
      for (const field of ["totalMarks", "percentage", "grade", "rank", "attendance"] as const)
        drawText(field, valueForField(field, sheet, titles));
    }
    if (settings.teacherComments) drawText("teacherComments", valueForField("teacherComments", sheet, titles));
    if (settings.signatures) {
      await drawImage("classTeacherSignature", sheet.school?.teacherSignature || sheet.school?.staffSignature);
      await drawImage("principalSignature", sheet.school?.signature);
      await drawImage("stamp", sheet.school?.stamp);
    }
  }
  doc.end();
  return complete;
}
