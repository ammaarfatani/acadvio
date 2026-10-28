// This runner never reads .env and forces its child test process onto local MongoDB.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
console.log('Testing only: local MongoDB 127.0.0.1:27018.');
console.log('Temporary test records are separate from your school records.');
const result = spawnSync(process.execPath, [path.join(root, 'tests/biometric-simulator.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env,
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27018/acadivo_test?replicaSet=acadivoDemo',
    JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('hex')
  }
});
if (result.error) console.error('FAILED: ' + result.error.message);
process.exitCode = result.status === null ? 1 : result.status;
