const fs = require("fs"),
  ts = require("typescript"),
  assert = require("assert/strict");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    f,
  );
const {
  documentLibraryTypesForRole,
  documentTypesForRole,
  DOCUMENT_TYPES,
} = require("../src/lib/document-templates.ts");
const { portalNavigation } = require("../src/lib/portal-navigation.ts");
const library = documentLibraryTypesForRole("SCHOOL_ADMIN");
for (const type of [
  "admission",
  "registration",
  "student-profile",
  "student-id",
  "attendance",
  "character",
  "leaving",
  "bonafide",
  "transfer",
  "general-certificate",
])
  assert(library.includes(type));
for (const type of [
  "fee-receipt",
  "fee-statement",
  "report-card",
  "transcript",
  "staff-id",
  "experience",
])
  assert(!library.includes(type));
assert.deepEqual(documentLibraryTypesForRole("FINANCE"), [
  "fee-receipt",
  "fee-statement",
]);
assert(documentTypesForRole("SCHOOL_ADMIN").includes("report-card"));
assert.equal(DOCUMENT_TYPES.length, 16);
const links = portalNavigation.SCHOOL_ADMIN.groups
  .flatMap((g) => g.items)
  .filter((i) => i.path === "/documents");
assert.equal(links.length, 1);
assert.equal(links[0].label, "School Document Library");
console.log(
  "PASS: 21 school-library category, dedicated finance workflow, shared-template preservation and duplicate-navigation checks.",
);
