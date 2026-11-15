const fs = require("fs");
const path = require("path");

function patchFile(relPath, transforms) {
  const fullPath = path.resolve(__dirname, "..", relPath);
  let content = fs.readFileSync(fullPath, "utf8");
  // Normalize line endings for replacement
  content = content.replace(/\r\n/g, "\n");
  for (const { from, to } of transforms) {
    if (!content.includes(from)) {
      console.warn(`[WARN] Pattern not found in ${relPath}: ${from.slice(0, 50)}...`);
      return false;
    }
    content = content.replace(from, to);
  }
  fs.writeFileSync(fullPath, content, "utf8");
  console.log(`[OK] Successfully patched ${relPath}`);
  return true;
}

// 1. ChallanWorkspace.tsx
patchFile("src/components/ChallanWorkspace.tsx", [
  {
    from: 'import { printSchoolDocument } from "@/lib/print-school-document";',
    to: 'import { printSchoolDocument } from "@/lib/print-school-document";\nimport { BulkImportModal } from "./BulkImportModal";\nimport { FileSpreadsheet } from "lucide-react";',
  },
  {
    from: "export default function ChallanWorkspace() {",
    to: "export default function ChallanWorkspace() {\n  const [bulkOpen, setBulkOpen] = useState(false);",
  },
  {
    from: '<main className="space-y-5">',
    to: '<main className="space-y-5">\n      {bulkOpen && (\n        <BulkImportModal\n          entity="feeChallans"\n          onClose={() => setBulkOpen(false)}\n          onImported={() => {}}\n        />\n      )}',
  },
  {
    from: '<header className="border-l-4 border-red-600 bg-[#f2f0ed] px-5 py-6 sm:px-7">',
    to: '<header className="border-l-4 border-red-600 bg-[#f2f0ed] px-5 py-6 sm:px-7 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">',
  },
  {
    from: "        <p className=\"mt-1 text-sm text-zinc-500\">\n          Individual and class printing · Three official copies per student\n        </p>\n      </header>",
    to: "        <div>\n          <p className=\"mt-1 text-sm text-zinc-500\">\n            Individual and class printing · Three official copies per student\n          </p>\n        </div>\n        <button\n          type=\"button\"\n          onClick={() => setBulkOpen(true)}\n          className=\"inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 shadow-sm hover:bg-zinc-50\"\n        >\n          <FileSpreadsheet size={15} className=\"text-emerald-600\" />\n          Bulk Upload Challans\n        </button>\n      </header>",
  },
]);

// 2. AdmissionsPage (src/app/receptionist/admissions/page.tsx)
patchFile("src/app/receptionist/admissions/page.tsx", [
  {
    from: 'import { Download, Plus, Printer, UserPlus } from "lucide-react";',
    to: 'import { Download, Plus, Printer, UserPlus, FileSpreadsheet } from "lucide-react";\nimport { BulkImportModal } from "@/components/BulkImportModal";',
  },
  {
    from: "export default function AdmissionsPage() {",
    to: "export default function AdmissionsPage() {\n  const [bulkOpen, setBulkOpen] = useState(false);",
  },
  {
    from: '      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">',
    to: '      {bulkOpen && (\n        <BulkImportModal\n          entity="admissions"\n          onClose={() => setBulkOpen(false)}\n          onImported={load}\n        />\n      )}\n      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">',
  },
  {
    from: '        <div className="flex gap-2">',
    to: '        <div className="flex gap-2">\n          <button\n            type="button"\n            onClick={() => setBulkOpen(true)}\n            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"\n          >\n            <FileSpreadsheet size={16} className="text-emerald-600" />\n            Bulk Upload Admissions\n          </button>',
  },
]);
