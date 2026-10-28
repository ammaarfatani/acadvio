import path from "path";

// PDFKit has no automatic script fallback. Keep each font's shaping tables intact;
// merging Arabic and Latin GSUB tables can map Urdu letters to unrelated Latin glyphs.
export function registerReportFonts(doc: any) {
  const asset = (name: string) =>
    path.join(process.cwd(), "public/fonts", name);
  doc.registerFont("Helvetica", asset("NotoSans-Regular.ttf"));
  doc.registerFont("Helvetica-Bold", asset("NotoSans-Bold.ttf"));
  doc.registerFont("ReportArabic", asset("NotoSansArabic-Regular.ttf"));
  doc.registerFont("ReportArabicBold", asset("NotoSansArabic-Bold.ttf"));
  const font = doc.font.bind(doc),
    text = doc.text.bind(doc);
  const arabic = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u;
  let selected = "Helvetica";
  doc.font = (name: string, ...args: any[]) => {
    selected = name;
    return font(name, ...args);
  };
  doc.text = (value: any, x?: any, y?: any, options?: any) => {
    const content = String(value ?? "");
    if (!arabic.test(content)) return text(value, x, y, options);
    const saved = selected;
    const opts =
      typeof x === "object" ? x : typeof y === "object" ? y : options || {};
    const parts = content
      .split(/([\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]+)/u)
      .filter(Boolean);
    parts.forEach((part: string, index: number) => {
      font(
        arabic.test(part)
          ? saved.includes("Bold")
            ? "ReportArabicBold"
            : "ReportArabic"
          : saved,
      );
      const run = {
        ...opts,
        continued: index < parts.length - 1 || !!opts.continued,
      };
      if (index === 0 && typeof x === "number")
        text(part, x, typeof y === "number" ? y : undefined, run);
      else text(part, run);
    });
    font(saved);
    return doc;
  };
  return doc;
}
