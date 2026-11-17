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

  const renderCompleteTable = async (sheet: any, titles: string[]) => {
    const marginX = mm(14 + settings.offsetX), marginY = mm(14 + settings.offsetY);
    const width = pageWidth - marginX * 2, bottom = pageHeight - marginY;
    if (marginX < mm(2) || marginY < mm(2) || width < mm(50) || bottom < mm(40))
      throw { statusCode: 422, message: "The alignment offset leaves too little printable area. Reduce the offset or use Values Only calibration." };
    let y = marginY;
    const student = sheet.student || {}, overall = sheet.overall || {}, details = sheet.stationeryDetails || {};
    const examHeading = titles.join(" / ") || "Examination Results";
    const header = (continued = false) => {
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#18181b").text(examHeading + (continued ? " · Continued" : ""), marginX, y, { width, align: "center" });
      y = doc.y + mm(2);
      doc.font("Helvetica").fontSize(9).fillColor("#27272a").text(`Academic Session: ${student.academicSessionName || "—"}`, marginX, y, { width, align: "center" });
      y = doc.y + mm(5);
      const detailsRows = [[`Name: ${student.name || "—"}`, `Father's Name: ${student.parentInfo?.fatherName || "—"}`],
        [`Class: ${student.className || "—"}`, `Section: ${student.sectionName || "—"}`, `G.R. No: ${student.admissionNumber || student.studentId || "—"}`]];
      for (const row of detailsRows) {
        const colWidth = width / row.length;
        row.forEach((value, index) => {
          const x = marginX + colWidth * index;
          doc.lineWidth(0.55).rect(x, y, colWidth, mm(9)).strokeColor("#3f3f46").stroke();
          doc.font("Helvetica").fontSize(8).fillColor("#18181b").text(value, x + mm(2), y + mm(2), { width: colWidth - mm(4), height: mm(5), ellipsis: true });
        });
        y += mm(9);
      }
      y += mm(4);
    };
    const columns: { label: string; key: string; componentIndex?: number; width: number }[] = [
      { label: "Subject", key: "subject", width: width * 0.27 },
      ...titles.flatMap((title, componentIndex) => [
        { label: `${title} Max`, key: "max", componentIndex, width: 0 },
        { label: `${title} Obtained`, key: "obtained", componentIndex, width: 0 },
      ]),
      { label: "Grand Max", key: "grandMax", width: 0 }, { label: "Grand Obtained", key: "grandObtained", width: 0 },
      { label: "Status", key: "status", width: 0 },
    ];
    const restWidth = width * 0.73 / (columns.length - 1);
    columns.forEach((column, index) => { if (index > 0) column.width = restWidth; });
    const row = (cells: unknown[], isHeader = false, minHeight = mm(8)) => {
      const fontSize = isHeader ? (columns.length > 8 ? 6 : 8) : (columns.length > 8 ? 7 : 8);
      doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
      const heights = cells.map((value, index) => doc.heightOfString(String(value ?? ""), { width: columns[index].width - mm(3) }));
      const rowHeight = Math.max(minHeight, ...heights.map(value => value + mm(2)));
      if (y + rowHeight > bottom) return false;
      let x = marginX;
      cells.forEach((value, index) => {
        const column = columns[index];
        doc.lineWidth(0.5).rect(x, y, column.width, rowHeight).strokeColor("#52525b").stroke();
        doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize).fillColor("#18181b")
          .text(String(value ?? ""), x + mm(1.5), y + mm(1), { width: column.width - mm(3), height: rowHeight - mm(2), align: index === 0 ? "left" : "center", ellipsis: true });
        x += column.width;
      });
      y += rowHeight;
      return true;
    };
    const headings = columns.map(column => column.label);
    header();
    row(headings, true, mm(11));
    const rows: any[] = sheet.rows || [];
    for (const mark of rows) {
      const cells: unknown[] = [mark.name];
      titles.forEach((_, index) => {
        const score = mark.scores?.[index];
        cells.push(score?.max ?? "", score?.isAbsent ? "A" : score?.obtained ?? "");
      });
      cells.push(mark.max ?? "", mark.total ?? "", mark.status || "");
      const estimatedHeight = mm(8);
      if (y + estimatedHeight > bottom) {
        doc.addPage({ size: [pageWidth, pageHeight], margin: 0 }); y = marginY; header(true); row(headings, true, mm(11));
      }
      row(cells, false, mm(8));
    }
    if (y + mm(33) > bottom) { doc.addPage({ size: [pageWidth, pageHeight], margin: 0 }); y = marginY; header(true); }
    const summary = [`Total Marks: ${overall.max ?? "—"}`, `Obtained Marks: ${overall.obtained ?? "—"}`, `Percentage: ${percent(overall.percentage) || "—"}`,
      `Grade: ${overall.grade || "—"}`, `Rank: ${details.rank ?? "—"}`, `Attendance: ${percent(details.attendancePercentage) || "—"}`];
    const summaryColWidth = width / 3;
    for (let i = 0; i < summary.length; i += 3) {
      const at = y;
      summary.slice(i, i + 3).forEach((value, index) => {
        const x = marginX + index * summaryColWidth;
        doc.lineWidth(0.45).rect(x, at, summaryColWidth, mm(8)).strokeColor("#71717a").stroke();
        doc.font("Helvetica").fontSize(8).fillColor("#18181b").text(value, x + mm(2), at + mm(2), { width: summaryColWidth - mm(4), height: mm(5), ellipsis: true });
      });
      y += mm(8);
    }
    if (settings.teacherComments && details.teacherRemarks) {
      y += mm(3); doc.font("Helvetica-Bold").fontSize(8).text("Teacher Comments", marginX, y, { width });
      doc.font("Helvetica").fontSize(8).text(String(details.teacherRemarks), marginX, doc.y + mm(1), { width, height: mm(18), ellipsis: true }); y = doc.y + mm(4);
    }
    if (settings.signatures) {
      if (y + mm(26) > bottom) { doc.addPage({ size: [pageWidth, pageHeight], margin: 0 }); y = marginY; }
      const signatureY = y + mm(17), labels = ["Sign of Class Teacher", "Sign of Principal"];
      for (let i = 0; i < 2; i++) {
        const x = marginX + i * width / 2, colWidth = width / 2;
        const imageValue = i === 0 ? (sheet.school?.teacherSignature || sheet.school?.staffSignature) : sheet.school?.signature;
        const image = await normalizeCardImage(imageValue);
        if (image) doc.image(Buffer.from(image.split(",")[1], "base64"), x + colWidth / 2 - mm(12), signatureY - mm(14), { fit: [mm(24), mm(13)] });
        doc.moveTo(x + mm(12), signatureY).lineTo(x + colWidth - mm(12), signatureY).lineWidth(0.5).strokeColor("#52525b").stroke();
        doc.font("Helvetica").fontSize(8).fillColor("#18181b").text(labels[i], x, signatureY + mm(2), { width: colWidth, align: "center" });
      }
      const stamp = await normalizeCardImage(sheet.school?.stamp);
      if (stamp) doc.image(Buffer.from(stamp.split(",")[1], "base64"), pageWidth / 2 - mm(10), signatureY - mm(12), { fit: [mm(20), mm(20)] });
    }
  };

  for (const sheet of sheets) {
    const components: any[] = sheet.components || [];
    const rows: any[] = sheet.rows || [];
    if (settings.marksTable && components.length > 4)
      throw { statusCode: 422, message: "This stationery template maps up to four exam columns. Update its mapping before printing this assessment." };
    const titles = components.slice(0, 4).map(component => String(component.title || ""));
    const rowFieldHeight = Math.max(...[...rowFields].map(field => pos(field)?.height || 0));
    const rowEnd = settings.rowStartY + Math.max(0, rows.length - 1) * settings.rowHeight + rowFieldHeight;
    if (settings.mode === "values" && settings.marksTable && rowEnd + settings.offsetY > pageHeightMm)
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

    if (settings.mode === "table") {
      await renderCompleteTable(sheet, titles);
      continue;
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
