// Isolated local practice server: same application routes and authentication, no production startup jobs.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
Object.assign(process.env, {
  NODE_ENV: 'test', PORT: '5001',
  MONGODB_URI: 'mongodb://127.0.0.1:27018/acadivo_biometric_practice?replicaSet=acadivoDemo',
  FRONTEND_URL: 'http://127.0.0.1:3001', NEXT_PUBLIC_API_URL: 'http://127.0.0.1:5001/api',
  JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'),
  JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex'),
  BIOMETRIC_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: '', SMTP_PASS: '', FROM_EMAIL: 'local@example.invalid'
});
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const mongoose = require('mongoose');
const load = relative => require(path.join(root, relative));
load('src/server/utils/email.util.ts').sendEmailNotification = async () => { throw { statusCode: 503, message: 'Email sending is disabled in local practice mode.' }; };
const { createApp } = load('src/server/app.ts');
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    if (mongoose.connection.name !== 'acadivo_biometric_practice' || mongoose.connection.host !== '127.0.0.1') throw new Error('Unexpected database; stopped.');
    const server = createApp().listen(5001, '127.0.0.1', () => {
      console.log('SUCCESS: Practice backend running at http://127.0.0.1:5001');
      console.log('Database: local practice school only. Emails disabled.');
      console.log('Keep this terminal open. Press Ctrl+C when practice is finished.');
    });
    server.on('error', async error => { console.error('FAILED: ' + error.message); await mongoose.disconnect(); process.exitCode = 1; });
  } catch (error) { console.error('FAILED: ' + error.message); await mongoose.disconnect(); process.exitCode = 1; }
})();
