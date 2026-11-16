const assert = require("node:assert/strict");
const fs = require("node:fs");

const manager = fs.readFileSync("src/components/DocumentTemplateManager.tsx", "utf8");
const settings = fs.readFileSync("src/components/MarksheetPrintSettingsForm.tsx", "utf8");

assert.match(manager, /type !== "report-card" \|\| marksheetFormat === "default"/);
assert.match(manager, /onFormatChange=\{setMarksheetFormat\}/);
assert.match(manager, /if \(value === "report-card"\) setMarksheetFormat\(null\)/);
assert.match(settings, /if \(values\.format\) onFormatChange\?\.\(values\.format\)/);
assert.match(settings, /settings\.format === "preprinted" &&/);

console.log("PASS: mode changes immediately control editor visibility; pre-printed controls stay conditional.");
