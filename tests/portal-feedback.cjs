const ts = require("typescript"),
  fs = require("fs"),
  vm = require("vm"),
  assert = require("assert/strict");
const compile = (f) =>
  ts.transpileModule(fs.readFileSync(f, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
let status = 404,
  message = "Student photo not found.",
  events = [];
const context = {
  exports: {},
  process: { env: {} },
  window: { dispatchEvent: (e) => events.push(e) },
  localStorage: { getItem: () => "" },
  sessionStorage: { getItem: () => "" },
  Map,
  Promise,
  JSON,
  CustomEvent: class {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  },
  fetch: async () => ({ ok: false, status, json: async () => ({ message }) }),
};
vm.runInNewContext(compile("src/lib/api.ts"), context);
const { apiFetch, friendlyApiError, optionalPhotoRequest } = context.exports;
const warning = { exports: {} };
vm.runInNewContext(compile("src/lib/subscription-warning.ts"), warning);
(async () => {
  let checks = 0;
  const eq = (a, b) => {
    assert.equal(a, b);
    checks++;
  };
  for (const endpoint of [
    "/student-media/0123456789abcdef01234567/photo",
    "/student-media/staff/0123456789abcdef01234567/photo",
  ]) {
    events = [];
    await assert.rejects(
      () => apiFetch(endpoint),
      (error) => error.status === 404,
    );
    checks++;
    eq(
      events.some((e) => e.type === "acadivo:feedback"),
      false,
    );
  }
  events = [];
  message = "Student not found.";
  await assert.rejects(() => apiFetch("/school-admin/students/missing"));
  checks++;
  eq(events.filter((e) => e.type === "acadivo:feedback").length, 1);
  eq(events[0].detail.message.includes("Refresh the list"), true);
  for (const code of [401, 403]) {
    status = code;
    events = [];
    await assert.rejects(() =>
      apiFetch("/student-media/0123456789abcdef01234567/photo"),
    );
    checks++;
    eq(
      events.some((e) => e.type === "acadivo:feedback"),
      true,
    );
  }
  status = 500;
  message = "MongoServerError private stack trace";
  events = [];
  await assert.rejects(() => apiFetch("/workspace/notifications"));
  checks++;
  eq(events[0].detail.message.includes("Mongo"), false);
  eq(
    optionalPhotoRequest("/school-admin/students/0123456789abcdef01234567"),
    false,
  );
  eq(
    optionalPhotoRequest(
      "/student-media/0123456789abcdef01234567/photo",
      "DELETE",
    ),
    false,
  );
  eq(
    friendlyApiError(400, "Amount must be greater than zero."),
    "Amount must be greater than zero.",
  );
  const need = warning.exports.needsSubscriptionReminder;
  for (const days of [0, 1, 3, 6, 7]) eq(need({ daysRemaining: days }), true);
  for (const days of [8, 30, null, undefined, NaN, Infinity])
    eq(need({ daysRemaining: days }), false);
  eq(need(null), false);
  eq(need({ isExpired: true, daysRemaining: -1 }), true);
  eq(need({ accountStatus: "DEACTIVATED", daysRemaining: 30 }), true);
  console.log(
    `PASS: ${checks} optional-photo feedback, authorization error, safe messages and subscription reminder boundary checks.`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
