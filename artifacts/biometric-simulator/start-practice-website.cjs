// Start the real frontend separately and route its API calls to local practice only.
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
console.log('Practice website: http://127.0.0.1:3001');
console.log('Practice API only: http://127.0.0.1:5001/api');
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-p', '3001', '-H', '127.0.0.1'], {
  cwd: root, stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development',
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:5001/api',
    NEXT_BUILD_DIR: '.next-biometric-practice', NEXT_TELEMETRY_DISABLED: '1' }
});
child.on('error', error => { console.error('FAILED: ' + error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code === null ? 1 : code; });
