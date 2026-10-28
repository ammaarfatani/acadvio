import sharp from "sharp";
import path from "node:path";
import { realpath, readFile, stat } from "node:fs/promises";
const QRCode = require("qrcode"),
  PDFDocument = require("pdfkit");
const esc = (s: any) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const lines = (s: any, n = 32) => {
  const words = String(s || "").split(/\s+/),
    out: string[] = [];
  for (const word of words) {
    if (!out.length || out[out.length - 1].length + word.length > n)
      out.push(word);
    else out[out.length - 1] += " " + word;
  }
  return out.slice(0, 2);
};
export async function normalizeCardImage(value: any): Promise<string> {
  if (typeof value !== "string") return "";
  try {
    let bytes: Buffer;
    if (/^data:image\/(png|jpeg|webp);base64,/.test(value)) {
      bytes = Buffer.from(value.split(",")[1], "base64");
    } else if (
      /^\/[a-z0-9_./ -]+\.(png|jpe?g|webp)$/i.test(value) &&
      !value.includes("..")
    ) {
      const root = await realpath(path.resolve(process.cwd(), "public"));
      const file = await realpath(path.resolve(root, "." + value));
      if (
        !file.toLowerCase().startsWith((root + path.sep).toLowerCase()) ||
        (await stat(file)).size > 5242880
      )
        return "";
      bytes = await readFile(file);
    } else return "";
    if (bytes.length > 5242880) return "";
    const png = await sharp(bytes, {
      limitInputPixels: 16000000,
    })
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    return "data:image/png;base64," + png.toString("base64");
  } catch {
    return "";
  }
}
export async function cardSvg(data: any, back = false) {
  const accent = /^#[0-9a-f]{6}$/i.test(data.style?.color || "")
      ? data.style.color
      : "#b20913",
    classic = data.style?.family === "classic",
    institutional = data.style?.family === "institutional";
  const [logo, photo, qr, signature, stamp] = await Promise.all([
    normalizeCardImage(data.school?.logoUrl),
    normalizeCardImage(data.photo),
    QRCode.toDataURL("ACADIVO-CARD:" + (data.reference || "PREVIEW"), {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
    }),
    normalizeCardImage(data.school?.signature),
    normalizeCardImage(data.school?.stamp),
  ]);
  const text = (
    value: any,
    x: number,
    y: number,
    size = 21,
    color = "#202631",
    weight = 400,
  ) =>
    `<text x="${x}" y="${y}" font-family="${data.style?.font === "serif" ? "Georgia, serif" : "Arial, sans-serif"}" font-size="${size}" fill="${color}" font-weight="${weight}">${esc(value)}</text>`;
  const schoolLines = lines(data.school?.name, 34),
    nameLines = lines(data.name, 25),
    id = data.identifier || "Pending ID";
  let body = `<rect width="856" height="540" rx="12" fill="#ffffff"/><rect x="1" y="1" width="854" height="538" rx="12" fill="none" stroke="#cbd0d7" stroke-width="2"/><rect width="856" height="${classic ? 12 : 114}" fill="${accent}"/>`;
  if (institutional)
    body += `<rect x="0" y="114" width="13" height="426" fill="${accent}"/>`;
  if (back) {
    body += text(
      "SCHOOL IDENTITY CARD",
      40,
      64,
      25,
      classic ? accent : "#ffffff",
      700,
    );
    body += text("If found, please return to", 40, 161, 22);
    schoolLines.forEach(
      (l, i) => (body += text(l, 40, 205 + i * 31, 24, accent, 700)),
    );
    lines(data.school?.address, 45).forEach(
      (l, i) => (body += text(l, 40, 295 + i * 28, 19)),
    );
    body += text(data.school?.phone || "", 40, 373, 21);
    body += text(data.school?.email || "", 40, 405, 18);
    body += `<image href="${qr}" x="630" y="166" width="180" height="180"/>`;
    body += text("Authorized verification", 613, 378, 17);
    if (data.style?.showSignatures !== false) {
      if (signature)
        body += `<image href="${signature}" x="440" y="420" width="170" height="65" preserveAspectRatio="xMidYMid meet"/>`;
      if (stamp)
        body += `<image href="${stamp}" x="720" y="420" width="65" height="65" preserveAspectRatio="xMidYMid meet"/>`;
    }
    body += text(
      "Reference: " +
        (data.reference ? data.reference.slice(0, 18) : "PREVIEW"),
      40,
      473,
      16,
    );
    body += text("This card remains the property of the school.", 40, 505, 17);
  } else {
    if (logo)
      body += `<rect x="25" y="20" width="75" height="75" fill="#fff" rx="4"/><image href="${logo}" x="30" y="25" width="65" height="65"/>`;
    schoolLines.forEach(
      (l, i) =>
        (body += text(
          l,
          logo ? 119 : 32,
          47 + i * 30,
          24,
          classic ? accent : "#ffffff",
          700,
        )),
    );
    const photoVisible = data.style?.showPhoto !== false;
    if (photoVisible) {
      body += `<rect x="32" y="145" width="168" height="213" fill="#f2f3f5" stroke="#d9dee4"/>`;
      body += photo
        ? `<image href="${photo}" x="33" y="146" width="166" height="211" preserveAspectRatio="xMidYMid slice"/>`
        : text(
            String(data.name || "?").slice(0, 1),
            90,
            270,
            70,
            "#949ba7",
            700,
          );
    }
    const left = photoVisible ? 225 : 34;
    body += text(
      data.kind === "student" ? "STUDENT" : "STAFF",
      left,
      163,
      17,
      accent,
      700,
    );
    nameLines.forEach(
      (l, i) => (body += text(l, left, 201 + i * 32, 29, "#202631", 700)),
    );
    body += text(id, left, 282, 25, accent, 700);
    const detail =
      data.kind === "student"
        ? [data.className, data.sectionName].filter(Boolean).join(" / ")
        : data.role;
    lines(detail, 35).forEach(
      (l, i) => (body += text(l, left, 320 + i * 25, 20)),
    );
    if (data.kind === "student")
      body += text(
        data.academicYear
          ? "Academic year: " + data.academicYear
          : "Academic year not recorded",
        left,
        381,
        18,
      );
    else if (data.department) body += text(data.department, left, 381, 18);
    body += `<image href="${qr}" x="702" y="370" width="116" height="116"/>`;
    body += text(
      data.kind === "student" && data.guardian
        ? "Guardian: " + data.guardian
        : "School-issued identification",
      32,
      432,
      18,
    );
    body += text(
      data.branch && data.branch !== data.school?.name
        ? data.branch
        : data.school?.phone || data.school?.email || "",
      32,
      465,
      18,
    );
    body += text(
      data.preview
        ? "PREVIEW · NOT ISSUED"
        : "ISSUED · Version " + (data.version || 1),
      32,
      509,
      16,
      data.preview ? "#b20913" : "#5e6673",
      700,
    );
  }
  if (data.preview)
    body += `<g transform="translate(310 310) rotate(-18)"><text font-family="Arial" font-size="44" font-weight="700" fill="#b20913" opacity="0.18">NOT ISSUED</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 856 540" width="856" height="540">${body}</svg>`;
}
export async function cardPdf(cards: any[], sheet = false) {
  const w = (85.6 * 72) / 25.4,
    h = (54 * 72) / 25.4,
    doc = new PDFDocument({
      autoFirstPage: false,
      info: { Title: "School identity cards" },
    });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (let i = 0; i < cards.length; i++) {
    if (sheet) {
      if (i % 8 === 0) doc.addPage({ size: "A4", margin: 0 });
      const x = 35 + (i % 2) * (w + 20),
        y = 30 + Math.floor((i % 8) / 2) * (h + 35);
      const png = await sharp(Buffer.from(await cardSvg(cards[i])))
        .resize({ width: 1284 })
        .png()
        .toBuffer();
      doc.image(png, x, y, { width: w, height: h });
    } else
      for (const back of [false, true]) {
        doc.addPage({ size: [w, h], margin: 0 });
        const png = await sharp(Buffer.from(await cardSvg(cards[i], back)))
          .resize({ width: 1284 })
          .png()
          .toBuffer();
        doc.image(png, 0, 0, { width: w, height: h });
      }
  }
  doc.end();
  return completed;
}
