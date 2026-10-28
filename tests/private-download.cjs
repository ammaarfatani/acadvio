const ts = require("typescript"),
  fs = require("fs"),
  vm = require("vm"),
  assert = require("assert/strict");
const store = new Map([["acadivo_access_token", "test-token"]]);
let calls = [],
  queue = [],
  checks = 0;
const scope = {
  exports: {},
  process: { env: {} },
  Headers,
  Blob,
  URL,
  console,
  window: {},
  localStorage: {
    getItem: (k) => store.get(k),
    setItem: (k, v) => store.set(k, v),
  },
  sessionStorage: { getItem: () => "authorized-branch" },
  fetch: async (url, options) => {
    calls.push({ url, options });
    return queue.shift();
  },
};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/lib/api.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  scope,
);
const eq = (a, b) => {
  assert.equal(a, b);
  checks++;
};
(async () => {
  for (const type of [
    "text/csv",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ]) {
    queue = [new Response("valid-file", { headers: { "Content-Type": type } })];
    const b = await scope.exports.privateFile("/smart-reports/export", {
      method: "POST",
      body: JSON.stringify({ format: "csv" }),
    });
    eq(b.size, 10);
    eq(calls.at(-1).options.headers.get("Content-Type"), "application/json");
    eq(calls.at(-1).options.headers.get("Authorization"), "Bearer test-token");
    eq(
      calls.at(-1).options.headers.get("X-Acadivo-Branch"),
      "authorized-branch",
    );
  }
  for (const response of [
    new Response("", { headers: { "Content-Type": "application/pdf" } }),
    new Response("<html>login</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    new Response("{}", { headers: { "Content-Type": "application/json" } }),
    new Response('{"message":"No permission"}', {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }),
  ]) {
    queue = [response];
    await assert.rejects(() => scope.exports.privateFile("/export"));
    checks++;
  }
  queue = [
    new Response("{}", { status: 401 }),
    new Response('{"data":{"accessToken":"refreshed"}}', {
      headers: { "Content-Type": "application/json" },
    }),
    new Response("pdf", { headers: { "Content-Type": "application/pdf" } }),
  ];
  await scope.exports.privateFile("/export");
  eq(calls.at(-1).options.headers.get("Authorization"), "Bearer refreshed");
  eq(store.get("acadivo_access_token"), "refreshed");
  console.log(`PASS: ${checks} actual frontend binary download helper checks.`);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
