export async function printChallanDocument(root: HTMLElement | null) {
  if (!root?.querySelector(".challan-sheet")) throw new Error("Prepare a challan preview before printing.");
  const frame = document.createElement("iframe");
  frame.title = "Fee challan print";
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1100px;height:900px;border:0";
  document.body.appendChild(frame);
  try {
    const target = frame.contentDocument!, win = frame.contentWindow!;
    target.open();
    target.write('<!doctype html><html><head><meta charset="utf-8"><title>Fee challan</title></head><body></body></html>');
    target.close();
    document.querySelectorAll("style,link[rel=stylesheet]").forEach(node => target.head.appendChild(node.cloneNode(true)));
    const copy = root.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(".no-print,button,[data-print-exclude]").forEach(node => node.remove());
    copy.querySelectorAll("img").forEach(node => { (node as HTMLImageElement).loading = "eager"; });
    target.body.appendChild(copy);
    const pageRules = Array.from(copy.querySelectorAll<HTMLElement>(".challan-sheet")).map(sheet => `@page ${sheet.dataset.pageName}{size:${sheet.dataset.pageWidth}mm ${sheet.dataset.pageHeight}mm;margin:0}`).join("");
    const style = target.createElement("style");
    style.textContent = `${pageRules}@page{size:A4 portrait;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;overflow:visible!important}.challan-print-root{max-height:none!important;height:auto!important;overflow:visible!important;background:#fff!important;padding:0!important;border:0!important}.challan-preview-list{display:block!important}.challan-sheet{box-sizing:border-box!important;max-width:none!important;min-height:0!important;margin:0!important;box-shadow:none!important;overflow:hidden!important;break-after:page;page-break-after:always}.challan-sheet:last-child{break-after:auto;page-break-after:auto}.challan-copy{box-sizing:border-box!important;height:auto!important;min-height:52mm!important;overflow:hidden!important;break-inside:avoid;page-break-inside:avoid}.challan-stacked{display:flex!important;flex-direction:column!important;justify-content:center!important}.challan-columns{display:flex!important;flex-direction:row!important;align-items:center!important}.challan-preview-list,.challan-preview-list *{visibility:visible!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}`;
    target.head.appendChild(style);
    await Promise.all(Array.from(target.querySelectorAll('link[rel="stylesheet"]')).map(node => {
      const link = node as HTMLLinkElement;
      if (link.sheet) return Promise.resolve();
      return new Promise<void>((resolve, reject) => { link.onload = () => resolve(); link.onerror = () => reject(new Error("Challan print styles could not load.")); });
    }));
    await target.fonts.ready;
    await Promise.all(Array.from(target.images).map(async image => { await image.decode(); if (!image.naturalWidth) throw new Error("A school logo could not load. Replace it before printing."); }));
    await new Promise<void>(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())));
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 120000);
  } catch (error) {
    frame.remove();
    throw error;
  }
}
