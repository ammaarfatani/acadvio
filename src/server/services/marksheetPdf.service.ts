import { defaultDocumentStyle } from "../../lib/document-templates";
import { registerReportFonts } from "./reportFonts";
import { normalizeCardImage } from "./identityCardRender.service";
const PDFDocument = require("pdfkit");
const pct = (v: any) => (v == null ? "Incomplete" : Number(v).toFixed(2) + "%");
export async function marksheetPdf(data: any, sharedDoc?: any) {
  const style = {
      ...defaultDocumentStyle("report-card"),
      ...data.documentStyle,
    },
    margin = (style.margin * 72) / 25.4,
    brand = style.color,
    regular = style.font === "serif" ? "Times-Roman" : "Helvetica",
    bold = style.font === "serif" ? "Times-Bold" : "Helvetica-Bold";
  const photo = style.showPhoto ? await normalizeCardImage(data.photo) : "",
    signature = await normalizeCardImage(data.school?.signature),
    stamp = await normalizeCardImage(data.school?.stamp),
    teacherSignature = await normalizeCardImage(data.school?.teacherSignature),
    staffSignature = await normalizeCardImage(data.school?.staffSignature);
  const photoW = ((style.photoWidth || 32) * 72) / 25.4,
    photoH = ((style.photoHeight || 40) * 72) / 25.4;
  const metadataLeft =
      margin + (photo && style.photoAlign === "left" ? photoW + 12 : 0),
    metadataWidth = () =>
      doc.page.width - margin * 2 - (photo ? photoW + 12 : 0);
  const doc =
      sharedDoc ||
      registerReportFonts(
        new PDFDocument({
          size: style.pageSize || "A4",
          layout: style.orientation,
          margin,
          bufferPages: true,
          info: {
            Title:
              data.view === "EXAM"
                ? "Examination marksheet"
                : "Annual marksheet",
            Author: data.school?.name || "School",
          },
        }),
      ),
    chunks: Buffer[] = [];
  if (sharedDoc)
    doc.addPage({
      size: style.pageSize || "A4",
      layout: style.orientation,
      margin,
    });
  const finished = sharedDoc
    ? Promise.resolve(Buffer.alloc(0))
    : new Promise<Buffer>((resolve, reject) => {
        doc.on("data", (b: Buffer) => chunks.push(b));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });
  const logo = await normalizeCardImage(data.school?.logoUrl),
    width = doc.page.width - margin * 2,
    bottom = doc.page.height - margin - 24;
  const panels = Math.max(1, Math.ceil(data.components.length / 3));
  for (let panel = 0; panel < panels; panel++) {
    const start = panel * 3,
      components = data.components.slice(start, start + 3),
      columns = [
        "Subject",
        ...components.map(
          (c: any) => c.title + (c.weight != null ? ` (${c.weight}%)` : ""),
        ),
        "Annual / result %",
        "Grade / status",
      ],
      colWidth = width / columns.length;
    const header = () => {
      if (style.family === "institutional")
        doc
          .rect(
            margin - 6,
            margin - 6,
            width + 12,
            doc.page.height - margin * 2 + 12,
          )
          .strokeColor(brand)
          .stroke();
      if (photo)
        doc.image(
          Buffer.from(photo.split(",")[1], "base64"),
          style.photoAlign === "left"
            ? margin
            : doc.page.width - margin - photoW,
          margin + 70,
          { fit: [photoW, photoH] },
        );
      if (logo)
        doc.image(Buffer.from(logo.split(",")[1], "base64"), margin, margin, {
          fit: [44, 44],
        });
      doc
        .font(bold)
        .fontSize(16)
        .fillColor("#20232a")
        .text(
          data.school?.name || "School",
          logo ? margin + 54 : margin,
          margin,
          {
            width: width - (logo ? 54 : 0),
            height: 40,
            ellipsis: true,
          },
        );
      doc
        .fontSize(11)
        .fillColor(brand)
        .text(
          `${data.view === "EXAM" ? "Examination result" : "Annual result"} | ${data.overall.complete ? (data.policy.legacy ? "LEGACY SUMMARY — POLICY REVIEW REQUIRED" : data.overall.status) : "INCOMPLETE — NOT A COMPLETED RESULT"}`,
          margin,
          margin + 48,
          { width },
        );
      doc
        .font(regular)
        .fontSize(9)
        .fillColor("#30343b")
        .text(
          `Student: ${data.student.name} | ID: ${data.student.studentId || data.student.admissionNumber} | Roll: ${data.student.rollNumber || "Not recorded"}`,
          metadataLeft,
          margin + 73,
          { width: metadataWidth() },
        );
      doc.text(
        `Session: ${data.student.academicSessionName || data.student.academicSessionId} | Class / section: ${data.student.className} / ${data.student.sectionName || "Not assigned"}`,
        metadataLeft,
        doc.y + 6,
        { width: metadataWidth() },
      );
      const top = Math.max(doc.y + 14, photo ? margin + 70 + photoH + 12 : 0);
      doc.rect(margin, top, width, 35).fill("#f1f2f3");
      columns.forEach((c, i) =>
        doc
          .font(bold)
          .fontSize(8)
          .fillColor("#20232a")
          .text(c, margin + 5 + i * colWidth, top + 5, {
            width: colWidth - 10,
            height: 27,
          }),
      );
      doc.y = top + 41;
    };
    if (panel) doc.addPage();
    header();
    for (const row of data.rows) {
      const values = [
        row.name,
        ...components.map((_: any, i: number) => {
          const s = row.scores[start + i];
          return s?.obtained == null
            ? s?.status || "Incomplete"
            : s.isAbsent
              ? `Absent (0 / ${s.max})`
              : `${s.obtained} / ${s.max}`;
        }),
        pct(row.percentage),
        `${row.grade} / ${row.status}`,
      ];
      doc.font(regular).fontSize(9);
      const height = Math.max(
        26,
        ...values.map(
          (v) => doc.heightOfString(String(v), { width: colWidth - 10 }) + 12,
        ),
      );
      if (height > 200)
        throw {
          statusCode: 413,
          message:
            "A subject label is too long for PDF output. Review the source record.",
        };
      if (doc.y + height > bottom) {
        doc.addPage();
        header();
      }
      const y = doc.y;
      values.forEach((v, i) =>
        doc
          .fillColor("#20232a")
          .text(String(v), margin + 5 + i * colWidth, y + 4, {
            width: colWidth - 10,
          }),
      );
      doc
        .moveTo(margin, y + height)
        .lineTo(margin + width, y + height)
        .strokeColor("#dddddd")
        .stroke();
      doc.y = y + height;
    }
    if (
      doc.y +
        70 +
        (style.showSignatures === false
          ? 30
          : (Math.max(style.signatureHeight || 16, style.stampSize || 22) *
              72) /
              25.4 +
            50) >
      bottom
    ) {
      doc.addPage();
      header();
    }
    doc
      .font(bold)
      .fontSize(11)
      .text(
        `Overall: ${pct(data.overall.percentage)} | Grade: ${data.overall.grade} | ${data.overall.status}`,
        margin,
        doc.y + 18,
        { width },
      );
    if (data.policy.method !== "WEIGHTED")
      doc
        .font(regular)
        .fontSize(9)
        .text(
          `Recorded total: ${data.overall.obtained ?? "Incomplete"} / ${data.overall.max ?? "Not complete"}`,
          margin,
          doc.y + 8,
          { width },
        );
    if (style.showSignatures !== false) {
      const h = Math.max(
          ((style.signatureHeight || 16) * 72) / 25.4,
          ((style.stampSize || 22) * 72) / 25.4,
        ),
        y = doc.y + h + 18,
        labels = style.signatureLabels;
      if (y + 40 > bottom) {
        doc.addPage();
        header();
      }
      const baseline = doc.y + h + 18;
      labels.forEach((label: string, i: number) => {
        const x = margin + i * (width / labels.length),
          last = i === labels.length - 1,
          img = last ? signature : i === 0 ? teacherSignature : staffSignature;
        if (img)
          doc.image(Buffer.from(img.split(",")[1], "base64"), x, baseline - h, {
            fit: [
              ((style.signatureWidth || 36) * 72) / 25.4,
              ((style.signatureHeight || 16) * 72) / 25.4,
            ],
          });
        if (last && stamp)
          doc.image(
            Buffer.from(stamp.split(",")[1], "base64"),
            x + width / labels.length - h,
            baseline - h,
            { fit: [h, h] },
          );
        doc
          .moveTo(x, baseline)
          .lineTo(x + width / labels.length - 12, baseline)
          .strokeColor("#666666")
          .stroke();
        doc.text(label, x, baseline + 6, { width: width / labels.length - 12 });
      });
    }
    if (style.footer)
      doc
        .font(regular)
        .fontSize(8)
        .text(style.footer, margin, bottom - 12, { width });
  }
  if (!sharedDoc) doc.end();
  return finished;
}

// Each student starts a fresh page; the existing renderer owns all result calculations/layout.
export async function bulkMarksheetPdf(documents: any[]) {
  if (!documents.length) throw new Error("No marksheets selected.");
  const doc = registerReportFonts(
    new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
      info: {
        Title: "Class marksheets",
        Author: documents[0].school?.name || "School",
      },
    }),
  );
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  try {
    for (const data of documents) await marksheetPdf(data, doc);
    doc.end();
  } catch (error) {
    doc.destroy();
    throw error;
  }
  return finished;
}
