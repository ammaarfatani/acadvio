const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
const mongoose = require("mongoose");
const { env } = require("../src/server/config/env.ts");
(async () => {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const result = await mongoose.connection.db.admin().command({ hello: 1 });
    console.log(JSON.stringify({ connected: true, replicaSet: !!result.setName, transactionsSupported: !!result.setName || result.msg === "isdbgrid" }));
  } catch (error) { console.log(JSON.stringify({ connected: false, errorName: error.name, errorCode: error.code })); }
  finally { await mongoose.disconnect(); }
})();
