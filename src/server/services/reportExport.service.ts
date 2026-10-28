import {
  reportColumnLabel,
  readableReportValue,
} from "../../lib/report-presentation";
import { normalizeCardImage } from "./identityCardRender.service";
import * as XLSX from "xlsx";
import { registerReportFonts } from "./reportFonts";
import {
  csvReport,
  cellValue,
  safeSpreadsheet,
  reportRows,
} from "./smartReports.service";
const PDFDocument = require("pdfkit");
type Report = Awaited<ReturnType<typeof reportRows>>;
export function workbookExport(reports: Report[], metadata: string) {
  const workbook = XLSX.utils.book_new();
  for (const report of reports) {
    const values = [
      report.columns.map((c) => reportColumnLabel(report.report, c)),
      ...report.rows.map((row: any) =>
        report.columns.map((c) => safeSpreadsheet(cellValue(row, c))),
      ),
    ];
    const summable = report.columns.map((c) =>
      /AmountPKR$|^amountPKR$|^lateMinutes$|^workingMinutes$|^totalDays$/.test(
        c,
      ),
    );
    if (summable.some(Boolean))
      values.push(
        report.columns.map((c, i) =>
          summable[i]
            ? report.rows.reduce(
                (sum: number, row: any) =>
                  sum +
                  (typeof cellValue(row, c) === "number"
                    ? Number(cellValue(row, c))
                    : 0),
                0,
              )
            : i === 0
              ? "TOTAL"
              : "",
        ),
      );
    const sheet = XLSX.utils.aoa_to_sheet(values);
    report.columns.forEach((column, index) => {
      if (/PKR$|percentage/i.test(column))
        for (let row = 1; row < values.length; row++) {
          const cell = sheet[XLSX.utils.encode_cell({ r: row, c: index })];
          if (cell?.t === "n")
            cell.z = /PKR$/.test(column) ? "#,##0.00" : "0.00";
        }
    });
    sheet["!cols"] = report.columns.map((c) => ({
      wch: Math.min(
        40,
        Math.max(18, reportColumnLabel(report.report, c).length + 3),
      ),
    }));
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: report.rows.length, c: report.columns.length - 1 },
      }),
    };
    XLSX.utils.book_append_sheet(workbook, sheet, report.report.slice(0, 31));
  }
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Acadivo school reports"],
      [metadata],
      [
        "Generated at (Asia/Karachi)",
        readableReportValue(new Date().toISOString(), "createdAt"),
      ],
      ["Only recorded school data. Refer to each report's definition."],
      ...reports.map((r) => [r.title, r.note, r.total]),
    ]),
    "Read me",
  );
  workbook.Sheets["Read me"]["!cols"] = [
    { wch: 38 },
    { wch: 100 },
    { wch: 16 },
  ];
  const output = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
  // SheetJS handles all values and escaping. Apply two explicit OOXML presentation styles to its valid package.
  const archive = XLSX.CFB.read(output, { type: "buffer" });
  const replaceEntry = (path: string, content: Buffer) => {
    const index = archive.FullPaths.findIndex((p: string) =>
      p.endsWith("/" + path),
    );
    if (index < 0) throw new Error("Generated workbook part is missing.");
    archive.FileIndex[index].content = content;
    archive.FileIndex[index].size = content.length;
  };
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFBD111B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F3F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  replaceEntry("xl/styles.xml", Buffer.from(styles));
  for (let i = 0; i < workbook.SheetNames.length; i++) {
    const path = `xl/worksheets/sheet${i + 1}.xml`,
      file =
        archive.FileIndex[
          archive.FullPaths.findIndex((p: string) => p.endsWith("/" + path))
        ];
    if (!file) continue;
    let xml = Buffer.from(file.content as any).toString();
    xml = xml.replace(/<row r="1"[^>]*>[\s\S]*?<\/row>/, (row) =>
      row.replace(/ s="\d+"/g, "").replace(/<c /g, '<c s="1" '),
    );
    replaceEntry(path, Buffer.from(xml));
  }
  return XLSX.CFB.write(archive, { type: "buffer", fileType: "zip" }) as Buffer;
}
export async function pdfExport(
  reports: Report[],
  metadata: string,
  schoolName: string,
  configuration?: any,
) {
  const style = configuration?.templates?.["report-card"],
    branding = { ...configuration?.school, ...configuration?.branding },
    logo = await normalizeCardImage(branding.logoUrl);
  const margin = ((style?.margin || 12) * 72) / 25.4,
    regular = style?.font === "serif" ? "Times-Roman" : "Helvetica",
    bold = style?.font === "serif" ? "Times-Bold" : "Helvetica-Bold";
  const signature = await normalizeCardImage(branding.signature),
    stamp = await normalizeCardImage(branding.stamp);
  const doc = registerReportFonts(
      new PDFDocument({
        size: reports.some((r) => r.columns.length > 12) ? "A3" : "A4",
        layout: "landscape",
        margin,
        bufferPages: true,
        info: { Title: "Acadivo School Reports", Author: schoolName },
      }),
    ),
    chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (b: Buffer) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const width = doc.page.width - margin * 2,
    bottom =
      doc.page.height - margin - (style?.showSignatures === false ? 24 : 100);
  let first = true;
  for (const report of reports) {
    // Tabular exports keep every record on one aligned row, never disconnected column panels.
    {
      const columns = report.columns,
        rowNumberWidth = 28,
        columnWidth = (width - rowNumberWidth) / columns.length;
      const heading = () => {
        if (logo)
          doc.image(
            Buffer.from(logo.split(",")[1], "base64"),
            doc.page.width - 74,
            20,
            { fit: [36, 24] },
          );
        doc
          .fillColor(style?.color || "#bd111b")
          .font(bold)
          .fontSize(9)
          .text("OFFICIAL SCHOOL REPORT", margin, 30);
        let size = 17;
        doc.fontSize(size);
        while (doc.widthOfString(schoolName) > width && size > 9)
          doc.fontSize(--size);
        doc
          .fillColor("#171717")
          .text(schoolName, margin, 48, { width, height: 21, ellipsis: true });
        doc.fontSize(12).text(report.title, margin, 74, { width });
        doc
          .font(regular)
          .fontSize(8)
          .fillColor("#52525b")
          .text(metadata, margin, 96, { width });
        doc.text(report.note, margin, doc.y + 6, { width });
        const tableTop = doc.y + 14;
        doc.font(bold).fontSize(columns.length > 12 ? 7 : 8);
        const headerHeight = Math.max(
          30,
          ...columns.map(
            (c) =>
              doc.heightOfString(reportColumnLabel(report.report, c), {
                width: columnWidth - 12,
              }) + 12,
          ),
        );
        doc.rect(margin, tableTop, width, headerHeight).fill("#f1f1ef");
        doc
          .fillColor("#171717")
          .font(bold)
          .fontSize(8)
          .text("Row", margin + 4, tableTop + 6, { width: rowNumberWidth - 4 });
        columns.forEach((c, i) =>
          doc
            .fillColor("#171717")
            .font(bold)
            .fontSize(columns.length > 12 ? 7 : 8)
            .text(
              reportColumnLabel(report.report, c),
              margin + rowNumberWidth + 6 + i * columnWidth,
              tableTop + 6,
              {
                width: columnWidth - 12,
                height: headerHeight - 8,
              },
            ),
        );
        doc.y = tableTop + headerHeight + 6;
      };
      if (!first) doc.addPage();
      first = false;
      heading();
      if (!report.rows.length)
        doc
          .fillColor("#52525b")
          .font(regular)
          .fontSize(10)
          .text("No matching recorded data.", margin, 190);
      for (let index = 0; index < report.rows.length; index++) {
        const values = columns.map((c) =>
          String(cellValue(report.rows[index], c)),
        );
        doc.font(regular).fontSize(columns.length > 12 ? 7 : 8);
        const height = Math.max(
          24,
          ...values.map(
            (v) =>
              doc.heightOfString(v || "—", { width: columnWidth - 14 }) + 12,
          ),
        );
        if (height > bottom - 185)
          throw {
            statusCode: 413,
            message:
              "A report cell is too long for printable output. Choose fewer columns or use XLSX.",
          };
        if (doc.y + height > bottom) {
          doc.addPage();
          heading();
        }
        const y = doc.y;
        if (index % 2 === 0)
          doc.rect(margin, y - 3, width, height).fill("#fafaf8");
        doc
          .fillColor("#52525b")
          .font(regular)
          .fontSize(8)
          .text(String(index + 1), margin + 4, y + 3, {
            width: rowNumberWidth - 6,
          });
        values.forEach((v, i) =>
          doc
            .fillColor("#27272a")
            .font(regular)
            .fontSize(columns.length > 12 ? 7 : 8)
            .text(
              v || "—",
              margin + rowNumberWidth + 6 + i * columnWidth,
              y + 3,
              {
                width: columnWidth - 14,
              },
            ),
        );
        doc.y = y + height;
      }
    }
  }
  const range = doc.bufferedPageRange();
  for (let p = range.start; p < range.start + range.count; p++) {
    doc.switchToPage(p);
    if (style?.showSignatures !== false) {
      const y = doc.page.height - margin - 38;
      if (signature)
        doc.image(
          Buffer.from(signature.split(",")[1], "base64"),
          margin,
          y - 50,
          { fit: [100, 40] },
        );
      if (stamp)
        doc.image(
          Buffer.from(stamp.split(",")[1], "base64"),
          doc.page.width - margin - 55,
          y - 50,
          { fit: [45, 45] },
        );
      doc
        .font(regular)
        .fontSize(8)
        .text(
          style?.signatureLabels?.at(-1) || "Authorized signatory",
          margin,
          y,
          { width },
        );
    }
    if (style?.footer)
      doc
        .font(regular)
        .fontSize(8)
        .text(style.footer, margin, doc.page.height - margin - 22, { width });
    doc
      .fillColor("#71717a")
      .font(regular)
      .fontSize(8)
      .text(`Page ${p + 1} / ${range.count}`, margin, doc.page.height - 46, {
        width,
        align: "right",
        lineBreak: false,
      });
  }
  doc.end();
  return done;
}
// ZIP STORE format: authenticated request buffers only, no public files or cleanup race.
export function zipExport(files: { name: string; data: Buffer }[]) {
  let position = 0;
  const chunks: Buffer[] = [],
    directory: Buffer[] = [];
  for (const file of files) {
    const name = Buffer.from(file.name);
    let crc = 0xffffffff;
    for (const byte of file.data) {
      crc ^= byte;
      for (let b = 0; b < 8; b++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(position, 42);
    chunks.push(local, name, file.data);
    directory.push(central, name);
    position += local.length + name.length + file.data.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(position, 16);
  return Buffer.concat([...chunks, central, end]);
}
export { csvReport };
