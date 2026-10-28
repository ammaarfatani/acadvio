const fs = require("fs"),
  ts = require("typescript"),
  vm = require("vm"),
  assert = require("assert/strict");
const source = ts.transpileModule(fs.readFileSync("src/lib/api.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
let calls = 0,
  token = "a",
  branch = "main",
  hold = null,
  events = [];
const response = (ok = true) => ({
  status: ok ? 200 : 500,
  ok,
  json: async () => ({
    data: { count: calls },
    message: ok ? "Saved" : "Failure",
  }),
});
const context = {
  exports: {},
  require() {},
  process: { env: {} },
  window: { dispatchEvent: (e) => events.push(e) },
  localStorage: { getItem: () => token },
  sessionStorage: { getItem: () => branch },
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
  fetch: async (url, opts) => {
    calls++;
    if (opts.method === "POST") return response(!url.endsWith("/fail"));
    if (hold) return new Promise((resolve) => hold.push(resolve));
    return response();
  },
  Map,
  Promise,
  JSON,
};
vm.runInNewContext(source, context);
const { apiFetch } = context.exports;
(async () => {
  let checks = 0;
  hold = [];
  const a = apiFetch("/finance/dashboard"),
    b = apiFetch("/finance/dashboard");
  assert.strictEqual(a, b);
  checks++;
  assert.equal(calls, 1);
  checks++;
  hold.shift()(response());
  await a;
  hold = [];
  const old = apiFetch("/finance/dashboard");
  await apiFetch("/finance/collect-payment", { method: "POST", body: "{}" });
  const fresh = apiFetch("/finance/dashboard");
  assert.notStrictEqual(old, fresh);
  checks++;
  assert.equal(
    events.filter((e) => e.type === "acadivo:data-changed").length,
    1,
  );
  checks++;
  hold.splice(0).forEach((resolve) => resolve(response()));
  await Promise.all([old, fresh]);
  const before = events.filter((e) => e.type === "acadivo:data-changed").length;
  await assert.rejects(apiFetch("/finance/fail", { method: "POST" }));
  assert.equal(
    events.filter((e) => e.type === "acadivo:data-changed").length,
    before,
  );
  checks++;
  await apiFetch("/school-documents/bulk-preview", { method: "POST" });
  assert.equal(
    events.filter((e) => e.type === "acadivo:data-changed").length,
    before,
  );
  checks++;
  hold = [];
  const s1 = apiFetch("/finance/dashboard");
  token = "b";
  const s2 = apiFetch("/finance/dashboard");
  assert.notStrictEqual(s1, s2);
  checks++;
  branch = "other";
  const s3 = apiFetch("/finance/dashboard");
  assert.notStrictEqual(s2, s3);
  checks++;
  hold.splice(0).forEach((resolve) => resolve(response()));
  await Promise.all([s1, s2, s3]);
  console.log(
    `PASS: ${checks} request deduplication, confirmed-write invalidation, failed/read-only action and token/branch isolation checks.`,
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
