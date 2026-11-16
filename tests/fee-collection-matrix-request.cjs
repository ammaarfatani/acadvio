const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { buildFeeCollectionMatrixRequest, feeCollectionMatrixFiltersSchema, feeCollectionMatrixRequestSchema } = require("../src/lib/fee-collection-matrix-request.ts");
const sessionId = "507f1f77bcf86cd799439011";
const validIds = {
  branchId: "507f1f77bcf86cd799439012",
  classCategoryId: "507f1f77bcf86cd799439013",
  classId: "507f1f77bcf86cd799439014",
  sectionId: "507f1f77bcf86cd799439015",
};
const base = { academicSessionId: sessionId, fromDate: "2026-10-01", toDate: "2026-11-16" };

const allFiltersEmpty = buildFeeCollectionMatrixRequest({
  ...base, branchId: "", classCategoryId: "", classId: "", sectionId: "",
});
assert.deepEqual(allFiltersEmpty, base, "All selections are omitted from the request payload.");
assert.equal(feeCollectionMatrixRequestSchema.parse(allFiltersEmpty).academicSessionId, sessionId);

const explicitlyEmptyFilters = feeCollectionMatrixRequestSchema.parse({
  ...base, branchId: "", classCategoryId: "", classId: "", sectionId: "",
});
for (const field of Object.keys(validIds)) assert.equal(explicitlyEmptyFilters[field], undefined, `${field} empty selection means no filter`);
assert.equal(feeCollectionMatrixFiltersSchema.parse({ classCategoryId: "", classId: "" }).classId, undefined);
assert.equal(feeCollectionMatrixFiltersSchema.parse({}).classCategoryId, undefined);

const selectedFilters = buildFeeCollectionMatrixRequest({ ...base, ...validIds, format: "pdf" });
assert.deepEqual(feeCollectionMatrixRequestSchema.parse(selectedFilters), { ...selectedFilters });
assert.equal(feeCollectionMatrixRequestSchema.parse({ ...selectedFilters, format: "xlsx" }).format, "xlsx");

for (const [field, label] of [["branchId", "Branch"], ["classCategoryId", "Class Category"], ["classId", "Class"], ["sectionId", "Section"]]) {
  const parsed = feeCollectionMatrixRequestSchema.safeParse({ ...base, [field]: "All" });
  assert.equal(parsed.success, false, `${field} rejects display labels in the ID field`);
  assert.match(parsed.error.issues[0].message, new RegExp(label));
  assert.deepEqual(parsed.error.issues[0].path, [field]);
}
assert.equal(feeCollectionMatrixFiltersSchema.parse({ classCategoryId: validIds.classCategoryId, classId: validIds.classId }).classId, validIds.classId);
const invalidFilterQuery = feeCollectionMatrixFiltersSchema.safeParse({ classCategoryId: "not-an-id" });
assert.equal(invalidFilterQuery.success, false);
assert.match(invalidFilterQuery.error.issues[0].message, /Class Category/);

const displaySessionLabel = feeCollectionMatrixRequestSchema.safeParse({ ...base, academicSessionId: "2026-2027" });
assert.equal(displaySessionLabel.success, false, "Academic Session expects the MongoDB ID, not its year label.");
assert.deepEqual(displaySessionLabel.error.issues[0].path, ["academicSessionId"]);
assert.match(displaySessionLabel.error.issues[0].message, /Academic Session/);

const invalidSession = feeCollectionMatrixRequestSchema.safeParse({ ...base, academicSessionId: "507f1f77bcf86cd79943901z" });
assert.equal(invalidSession.success, false);
assert.deepEqual(invalidSession.error.issues[0].path, ["academicSessionId"]);

console.log("PASS: empty filters are omitted/normalized, valid Mongo IDs are accepted, year labels and display labels are rejected with field-specific errors.");
