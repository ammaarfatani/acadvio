"use client";
import { useEffect } from "react";

/** Presentation-only redaction for public product captures; never changes stored records. */
export function ScreenshotPrivacy() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("capture") !== "private") return;
    document.documentElement.dataset.screenshotPrivacy = "true";
    if (new URLSearchParams(window.location.search).get("full") === "1") document.documentElement.dataset.screenshotFull = "true";
    const redact = (value: string) => value.replace(/ammar\s+fatani/gi, "[Name hidden]").replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[Email hidden]").replace(/\+?\d[\d ()-]{8,}\d/g, match => match.replace(/\D/g, "").length >= 10 ? "[Contact hidden]" : match);
    const mask = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (!node.parentElement?.closest("script,style,textarea,input") && redact(node.data) !== node.data) nodes.push(node);
      }
      nodes.forEach(node => { node.data = redact(node.data); });
      document.querySelectorAll("[aria-label],[title],[alt]").forEach(element => { for (const key of ["aria-label","title","alt"]) { const current = element.getAttribute(key); if (current && redact(current) !== current) element.setAttribute(key, redact(current)); } });
    };
    mask();
    const observer = new MutationObserver(mask);
    observer.observe(document.body, {childList:true, subtree:true, characterData:true});
    return () => { observer.disconnect(); delete document.documentElement.dataset.screenshotPrivacy; delete document.documentElement.dataset.screenshotFull; };
  }, []);
  return null;
}


