const next = require("next");
const http = require("node:http");
const app = next({ dev: true, dir: process.cwd(), conf: { distDir: ".next-payment-qa" } });
app.prepare().then(() => {
  const handler = app.getRequestHandler();
  http.createServer((req, res) => handler(req, res)).listen(3001, "127.0.0.1", () => console.log("Isolated payment UI preview: http://localhost:3001"));
}).catch(error => { console.error(error); process.exitCode = 1; });
