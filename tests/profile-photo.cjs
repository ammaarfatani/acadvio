const fs = require("fs"),
  ts = require("typescript"),
  vm = require("vm"),
  assert = require("assert/strict");
let hits = 0,
  failureStatus = 0,
  token = "session-a",
  branch = "branch-a";
const code = ts.transpileModule(
  fs.readFileSync("src/lib/profile-photo.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const ctx = {
  exports: {},
  require: () => ({
    apiFetch: async (url) => {
      hits++;
      if (failureStatus) throw Object.assign(new Error("Photo unavailable"), { status: failureStatus });
      return { data: { image: url } };
    },
  }),
  window: {},
  localStorage: { getItem: () => token },
  sessionStorage: { getItem: () => branch },
  Map,
  Date,
};
vm.runInNewContext(code, ctx);
const photo = ctx.exports.profilePhoto;
(async () => {
  const p = { _id: "0123456789abcdef01234567" };
  const [a, b] = await Promise.all([photo(p), photo(p)]);
  assert.equal(a, b);
  assert.equal(hits, 1);
  token = "session-b";
  await photo(p);
  assert.equal(hits, 2);
  branch = "branch-b";
  await photo(p);
  assert.equal(hits, 3);
  await photo({ ...p, photoUrl: "" });
  assert.equal(hits, 3);
  assert.equal(
    await photo({ ...p, photoUrl: "https://school.example/photo.png" }),
    "https://school.example/photo.png",
  );
  assert.equal(
    await photo({ ...p, idPhoto: "data:image/png;base64,test" }, "staff"),
    "data:image/png;base64,test",
  );
  const other = await photo({ _id: "abcdef0123456789abcdef01" });
  assert.notEqual(other, a);
  failureStatus = 404;
  const missing = { _id: "111111111111111111111111" };
  const beforeMissing = hits;
  assert.equal(await photo(missing), "");
  assert.equal(await photo(missing), "");
  assert.equal(hits, beforeMissing + 1, "missing photo cached briefly");
  failureStatus = 500;
  const unavailable = { _id: "222222222222222222222222" };
  const beforeRetry = hits;
  await photo(unavailable);
  await photo(unavailable);
  assert.equal(hits, beforeRetry + 2, "service failure remains retryable");
  const beforeInvalid = hits;
  assert.equal(await photo({ _id: "EMP-001" }, "staff"), "");
  assert.equal(hits, beforeInvalid, "business employee IDs never sent to photo API");
  console.log(
    "PASS: 14 profile-photo session isolation, deduplication, missing-photo caching, retry and employee-ID checks.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
