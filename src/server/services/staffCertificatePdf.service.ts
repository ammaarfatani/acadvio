import { normalizeCardImage } from "./identityCardRender.service";
const PDFDocument = require("pdfkit");

export async function staffCertificatePdf(snapshot: any) {
  const orientation = snapshot.style?.orientation === "portrait" ? "portrait" : "landscape";
  const doc = new PDFDocument({ size: "A4", layout: orientation, margin: 42, bufferPages: true });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const pageWidth = doc.page.width, pageHeight = doc.page.height;
  const margin = 38, border = snapshot.style?.color || "#b20913";
  const serif = snapshot.style?.font === "serif";
  if (snapshot.background) {
    const safe = await normalizeCardImage(snapshot.background);
    if (safe) doc.image(Buffer.from(safe.split(",")[1], "base64"), margin, margin, { fit: [pageWidth - margin * 2, pageHeight - margin * 2], align: "center", valign: "center" });
  }
  const double = snapshot.style?.border !== "minimal";
  doc.save().lineWidth(3).strokeColor(border).roundedRect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2, snapshot.style?.border === "minimal" ? 4 : 0).stroke();
  if (double) doc.lineWidth(0.8).strokeColor(border).rect(margin + 9, margin + 9, pageWidth - (margin + 9) * 2, pageHeight - (margin + 9) * 2).stroke();
  doc.restore();
  const inside = margin + 34, available = pageWidth - inside * 2;
  const brand = snapshot.school || {};
  if (brand.logoUrl) {
    const logo = await normalizeCardImage(brand.logoUrl);
    if (logo) doc.image(Buffer.from(logo.split(",")[1], "base64"), inside, inside - 4, { fit: [68, 54] });
  }
  doc.fillColor("#1d222b").font(serif ? "Times-Bold" : "Helvetica-Bold").fontSize(19).text(brand.name || "School", inside + 80, inside, { width: available - 80, align: "center" });
  doc.font(serif ? "Times-Roman" : "Helvetica").fontSize(8.5).fillColor("#5c6370").text([brand.address, brand.phone, brand.email].filter(Boolean).join("  ·  "), inside + 80, inside + 26, { width: available - 80, align: "center" });
  const top = inside + 85;
  doc.moveTo(inside, top - 12).lineTo(pageWidth - inside, top - 12).lineWidth(0.8).strokeColor(border).stroke();
  doc.font(serif ? "Times-Bold" : "Helvetica-Bold").fontSize(10).fillColor(border).text("OFFICIAL STAFF CERTIFICATE", inside, top + 5, { width: available, align: "center", characterSpacing: 2 });
  doc.font(serif ? "Times-Bold" : "Helvetica-Bold").fontSize(25).fillColor("#20242b").text(snapshot.certificateTitle || "Staff Certificate", inside + 10, top + 27, { width: available - 20, align: "center" });
  doc.font(serif ? "Times-Roman" : "Helvetica").fontSize(11).fillColor("#596273").text("This certificate is respectfully presented to", inside, top + 70, { width: available, align: "center" });
  doc.font(serif ? "Times-Bold" : "Helvetica-Bold").fontSize(28).fillColor("#20242b").text(snapshot.staff?.name || "Staff member", inside, top + 92, { width: available, align: "center" });
  const employeeLine = [snapshot.staff?.designation, snapshot.staff?.department, snapshot.staff?.employeeId ? `Employee ID ${snapshot.staff.employeeId}` : ""].filter(Boolean).join("  ·  ");
  if (employeeLine) doc.font(serif ? "Times-Roman" : "Helvetica").fontSize(10).fillColor("#596273").text(employeeLine, inside, top + 127, { width: available, align: "center" });
  const bodyY = top + 158;
  doc.font(serif ? "Times-Roman" : "Helvetica").fontSize(12).fillColor("#30343b").text(snapshot.body || "", inside + 30, bodyY, { width: available - 60, align: "center", lineGap: 6 });
  const detailPairs = [["Certificate number", snapshot.certificateNumber], ["Issue date", new Date(snapshot.issuedAt || Date.now()).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })], ["Joining date", snapshot.staff?.joiningDate], ["Employment status", snapshot.staff?.employmentStatus]].filter(([, value]) => Boolean(value));
  let detailY = Math.min(bodyY + Math.max(54, doc.heightOfString(snapshot.body || "", { width: available - 60, lineGap: 6 }) + 28), pageHeight - 160);
  const colWidth = available / Math.max(1, detailPairs.length);
  for (const [i, [label, value]] of detailPairs.entries()) {
    doc.font(serif ? "Times-Bold" : "Helvetica-Bold").fontSize(7.5).fillColor("#697180").text(String(label).toUpperCase(), inside + colWidth * i, detailY, { width: colWidth, align: "center" });
    doc.font(serif ? "Times-Roman" : "Helvetica").fontSize(9.5).fillColor("#242831").text(String(value), inside + colWidth * i, detailY + 12, { width: colWidth, align: "center" });
  }
  const signatureTop = pageHeight - margin - 86;
  const signature = brand.staffSignature || brand.signature;
  if (signature) { const safe = await normalizeCardImage(signature); if (safe) doc.image(Buffer.from(safe.split(",")[1], "base64"), inside + 24, signatureTop - 34, { fit: [115, 34] }); }
  if (brand.stamp) { const safe = await normalizeCardImage(brand.stamp); if (safe) doc.image(Buffer.from(safe.split(",")[1], "base64"), pageWidth / 2 - 26, signatureTop - 30, { fit: [52, 52] }); }
  doc.moveTo(inside + 12, signatureTop).lineTo(inside + 175, signatureTop).lineWidth(0.8).strokeColor("#6b7280").stroke();
  doc.font(serif ? "Times-Bold" : "Helvetica-Bold").fontSize(8.5).fillColor("#242831").text(brand.signatoryName || brand.principalName || "Authorized signatory", inside + 12, signatureTop + 7, { width: 163, align: "center" });
  doc.font(serif ? "Times-Roman" : "Helvetica").fontSize(7.5).fillColor("#687080").text(brand.signatoryDesignation || "School administration", inside + 12, signatureTop + 19, { width: 163, align: "center" });
  if (snapshot.verificationQr) { const qr = Buffer.from(snapshot.verificationQr.split(",")[1], "base64"); doc.image(qr, pageWidth - inside - 66, signatureTop - 31, { width: 60, height: 60 }); doc.fontSize(6.5).fillColor("#687080").text("VERIFY", pageWidth - inside - 66, signatureTop + 31, { width: 60, align: "center" }); }
  if (snapshot.revoked || snapshot.replaced) doc.save().rotate(-18, { origin: [pageWidth / 2, pageHeight / 2] }).font("Helvetica-Bold").fontSize(42).fillColor("#b00020").fillOpacity(0.2).text(snapshot.replaced ? "REPLACED · SUPERSEDED" : "REVOKED · NOT VALID", margin + 30, pageHeight / 2, { width: pageWidth - 2 * (margin + 30), align: "center" }).restore();
  doc.end();
  return done;
}
