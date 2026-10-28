// Print the same saved document DOM in an isolated frame; never print dashboard chrome.
export async function printSchoolDocument(root?: Element | null) {
  const source =
    root ||
    document.querySelector(
      ".financial-preview-dialog .school-document, #annual-marksheet, .school-document",
    );
  if (!source) throw new Error("Open a document preview before printing.");
  if (
    source.getAttribute("data-document-ready") === "false" ||
    source.querySelector('[data-document-ready="false"]')
  )
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(
            "Document photos or settings are still loading. Please retry.",
          ),
        );
      }, 30000);
      const observer = new MutationObserver(() => {
        if (
          source.getAttribute("data-document-ready") !== "false" &&
          !source.querySelector('[data-document-ready="false"]')
        ) {
          clearTimeout(timer);
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(source, {
        attributes: true,
        subtree: true,
        childList: true,
      });
    });
  const failedDocument =
    source.getAttribute("data-document-error") ||
    source
      .querySelector("[data-document-error]")
      ?.getAttribute("data-document-error");
  if (failedDocument) throw new Error(failedDocument);
  const frame = document.createElement("iframe");
  frame.title = "School document print";
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1100px;height:900px;border:0";
  document.body.appendChild(frame);
  try {
    const target = frame.contentDocument!,
      win = frame.contentWindow!;
    const copy = source.cloneNode(true) as HTMLElement;
    copy
      .querySelectorAll(
        ".no-print, button, [data-print-exclude], input, select, textarea",
      )
      .forEach((n) => n.remove());
    copy.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
    });
    target.open();
    target.write(
      '<!doctype html><html><head><meta charset="utf-8"><title></title></head><body></body></html>',
    );
    target.close();
    document
      .querySelectorAll('style,link[rel="stylesheet"]')
      .forEach((n) => target.head.appendChild(n.cloneNode(true)));
    target.body.appendChild(copy);
    const style = document.createElement("style"),
      page =
        (source.matches(".school-document")
          ? source
          : source.querySelector(".school-document")
        )?.getAttribute("data-page-size") || "A4",
      orientation =
        (source.matches(".school-document")
          ? source
          : source.querySelector(".school-document")
        )?.getAttribute("data-page-orientation") || "portrait",
      margin = Number(
        (source.matches(".school-document")
          ? source
          : source.querySelector(".school-document")
        )?.getAttribute("data-page-margin") || 12,
      );
    const computed = getComputedStyle(
      source.matches(".school-document")
        ? source
        : source.querySelector(".school-document") || source,
    );
    const borders = ["top", "right", "bottom", "left"]
      .map(
        (side) =>
          `border-${side}:${computed.getPropertyValue("border-" + side + "-width")} ${computed.getPropertyValue("border-" + side + "-style")} ${computed.getPropertyValue("border-" + side + "-color")}!important`,
      )
      .join(";");
    const size = ["A3", "A4", "A5", "Letter", "85.6mm 54mm"].includes(page)
      ? page
      : "A4";
    // Zero physical page margins suppress Chromium's automatic date/title/URL
    // decorations. Preserve the school's spacing inside the document instead.
    // Other print engines may still require Headers and footers to be turned off.
    style.textContent = `@page{size:${size} ${size.includes("mm") ? "" : orientation === "landscape" ? "landscape" : "portrait"};margin:0}html,body{margin:0!important;height:auto!important;overflow:visible!important;background:white!important}body>.school-document,body>.school-document-bulk .school-document,body>.ledger-student-page>.school-document,body>#workforce-payslip,body>#payroll-report{position:static!important;width:100%!important;max-width:none!important;min-height:0!important;box-sizing:border-box!important;padding:${size.includes("mm") ? 0 : Math.max(0, Math.min(30, margin))}mm!important;box-shadow:none!important;break-inside:auto!important;page-break-inside:auto!important;${borders}}body>.school-document,body>.school-document *,body>.school-document-bulk,body>.school-document-bulk *,body>.ledger-student-page,body>.ledger-student-page *,body>#workforce-payslip,body>#workforce-payslip *,body>#payroll-report,body>#payroll-report *{visibility:visible!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}body>.school-document-bulk>.ledger-student-page{page-break-inside:auto!important}body [role=region],body .overflow-x-auto{overflow:visible!important}body .school-document table{min-width:0!important;width:100%!important}.school-document-bulk>.ledger-student-page{break-before:page;page-break-before:always;break-inside:auto!important;margin:0!important}.school-document-bulk>.ledger-student-page:first-child{break-before:auto;page-break-before:auto}.challan-student-group+.challan-student-group{break-before:page;page-break-before:always}.document-header,.sd-section h3,.document-total,.sd-portrait-row,tr{break-inside:avoid}thead{display:table-header-group}.no-print,[data-print-exclude]{display:none!important}`;
    target.head.appendChild(style);
    const timeout = (p: Promise<any>) =>
      Promise.race([
        p,
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Document assets are taking too long to load. Please retry.",
                ),
              ),
            15000,
          ),
        ),
      ]);
    await timeout(
      Promise.all(
        Array.from(target.querySelectorAll('link[rel="stylesheet"]')).map(
          (n) =>
            new Promise<void>((resolve, reject) => {
              const link = n as HTMLLinkElement;
              if (link.sheet) return resolve();
              link.onload = () => resolve();
              link.onerror = () =>
                reject(new Error("Document styles could not load."));
            }),
        ),
      ),
    );
    await timeout(target.fonts.ready);
    await timeout(
      Promise.all(
        Array.from(target.images).map(async (img) => {
          await img.decode();
          if (!img.naturalWidth)
            throw new Error(
              "A document image could not load. Replace it before printing.",
            );
        }),
      ),
    );
    await new Promise<void>((resolve) =>
      win.requestAnimationFrame(() =>
        win.requestAnimationFrame(() => resolve()),
      ),
    );
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 120000);
  } catch (e) {
    frame.remove();
    throw e;
  }
}
