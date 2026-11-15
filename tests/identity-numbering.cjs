const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

const source = fs.readFileSync("src/server/services/identityNumbering.util.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`, { module: loaded, exports: loaded.exports });
const { formatNumberedIdentifier, normalizeNumberFormat, parseNumberedIdentifier } = loaded.exports;

const schoolPrefix = normalizeNumberFormat({ prefix: "ST-", startAt: 1, padding: 4 }, { prefix: "STUD", startAt: 1, padding: 3 });
const imported = ["ST-0347", "ST-0349", "ST-0348"].map(value => parseNumberedIdentifier(value, schoolPrefix.prefix));
assert.deepEqual(imported, [347, 349, 348]);
assert.equal(formatNumberedIdentifier(Math.max(...imported) + 1, schoolPrefix), "ST-0350");

const numeric = normalizeNumberFormat({ prefix: "", startAt: 1, padding: 0 }, { prefix: "STUD", startAt: 1, padding: 3 });
assert.equal(parseNumberedIdentifier("00347", numeric.prefix), 347);
assert.equal(formatNumberedIdentifier(348, numeric), "348");
assert.equal(parseNumberedIdentifier("EMP-0148", "EMP-"), 148);
assert.equal(formatNumberedIdentifier(149, { prefix: "EMP-", startAt: 1, padding: 4 }), "EMP-0149");
assert.equal(parseNumberedIdentifier("ST-0347-X", "ST-"), null);
assert.equal(parseNumberedIdentifier("ST.0347", "ST."), 347);
assert.equal(normalizeNumberFormat({ prefix: "X", startAt: 0, padding: 99 }, { prefix: "", startAt: 1, padding: 0 }).startAt, 1);
assert.equal(normalizeNumberFormat({ prefix: "X", startAt: 2, padding: 99 }, { prefix: "", startAt: 1, padding: 0 }).padding, 12);

console.log("Identity numbering utility checks passed.");
