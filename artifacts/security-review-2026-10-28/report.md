# Acadivo security review — 28 October 2026

## Scope and limits

Source/configuration/dependency review covering public routes, authentication and recovery, role checks, school/branch scoping, parent/teacher access, payment verification, reports/downloads, document/image handling, biometric credential storage and assistant report authorization. Automated source/public-output secret scanning supplements manual review of security-critical paths. This is not an independent penetration test or a guarantee that every vulnerability has been found.

No attack traffic was sent to a production site. Integration fixtures use randomly named disposable databases on `127.0.0.1:27018`; existing school records and `.env` were not modified. Test notification delivery is stubbed. The local preview servers were stopped during dependency replacement.

## Findings addressed

| Finding | Change |
|---|---|
| Some controllers accepted nested Express query objects as database filter values | Simple query parsing plus strict scalar/unique query validation; operator-shaped, prototype and dotted request keys rejected |
| Student/teacher searches accepted raw regular expressions | Literal escaping and a 200-character search limit |
| Inactive Super Admin bypassed the normal account-status check on protected APIs and refresh | Active status now required for platform administrators too |
| Refresh-token check/save could race with another refresh, logout or password change | Atomic compare-and-update using the previous hash, token version and account status |
| Parallel browser requests could race when rotating a session | Shared refresh promise for JSON/download requests and Web Locks coordination where supported |
| Cross-origin mutations relied on CORS alone | Requests carrying an untrusted browser Origin are rejected before processing; originless authenticated connector/API clients remain supported |
| Sensitive API responses lacked a uniform cache policy | API responses use `private, no-store` |
| Database failure silently selected a different local database; raw startup errors could expose connection details | Fail closed on the configured database, with redacted startup/index errors |
| Session refresh and current-password verification lacked specific throttles | Added refresh and per-account change-password limits |
| Logout left existing access tokens usable until expiry | Logout now increments the server-side token version as well as revoking refresh |
| Frontend security settings were in the inactive TypeScript config, shadowed by `next.config.mjs` | Applied headers in the canonical active MJS config; TS config now re-exports it to prevent drift |
| Installed `qs` dependency advisory | Override/lockfile updated to patched 6.16.2; see maintainer advisory below |

The `qs` issue concerns comma-array serialization and does not by itself establish that this application's routes were exploitable. Maintainer reference: https://github.com/ljharb/qs/security/advisories/GHSA-6pq8-jhm2-2vcw

## Verified before final dependency replacement

- Secret scan: 457 source/public/build-output text files, zero findings; `.env` ignored and no commits found for `.env`, `.env.local` or `.env.production` in available local history.
- Organization integration: 239 HTTP/MongoDB checks (roles, plans, tenant/branch isolation, parent linkage, notices, fee submissions, documents and password revocation).
- Web security: 81 checks (anonymous portal denial, malformed tokens, response headers, error disclosure, request filters and sign-in throttling).
- Session integration: 10 checks (inactive platform account denial, concurrent refresh replay, rotation usability and logout refresh revocation).
- Existing frontend download/freshness: 22 + 8 checks.

Final dependency audit and runtime results follow.

## Final runtime reruns after package repair

- Frozen-lockfile dependency install completed. All required runtime packages loaded successfully.
- Full production + development dependency audit: zero known advisories (`dependencies-all-after.json`).
- Final source/public/production-output secret scan: 629 files, zero findings (`secrets-after-build.json`).
- Web security: 81 checks passed.
- Parallel frontend refresh + Web Locks: 8 checks passed; existing private downloads 22 and read freshness 8 also passed.
- Database fail-closed/redaction: 2 checks passed without a database connection.
- Admission/parent/assignment/exam/marksheet integration: 114 checks passed in disposable local MongoDB.
- Disabled Super Admin, concurrent refresh, logout/access revocation: 11 checks passed in disposable local MongoDB.
- Workforce permissions/attendance/payroll integration: 136 real HTTP/MongoDB checks passed.
- Subscription payments: mocked-persistence regression suite passed (quotes, server-owned amount, role/tenant access, upload validation, duplicates and approval/rejection).
- Profile-photo isolation: 14 checks passed. Attendance connector durable recovery: 6 checks passed.

- Smart reports: 125 real HTTP/MongoDB accuracy, tenant isolation, export and intelligence checks passed.
- Final TypeScript check passed after correcting the Web Locks promise type.
- Canonical frontend config: 9 regression checks passed.
- Final `pnpm build` passed: 151 pages generated. Existing non-blocking hook/image lint warnings remain; these are not claimed resolved by this security change.
- Local preview restored: Next production preview at `127.0.0.1:3000`, existing API at port 5000 started with maintenance/seeding/scheduled-email jobs disabled.
- API smoke: public health 200, anonymous parent records 401, untrusted-origin mutation 403; API responses include private/no-store and nosniff.
- Final built frontend HTTP verification: login, payment and favicon return 200, `nosniff`, frame denial, CSP and HSTS, without `X-Powered-By` (`frontend-http-headers.json`). This confirms the canonical MJS configuration is actually applied.

## Deployment controls still require operational verification

- Production must use HTTPS with `NODE_ENV=production`, an exact trusted `FRONTEND_URL` and correctly configured proxy hops. Localhost verification cannot prove public TLS, DNS, reverse-proxy or WAF settings.
- Restrict MongoDB network access and use a least-privilege database user, TLS and tested encrypted backups. This review does not modify cloud/network policies.
- JWT/SMTP/AI/biometric secrets belong only in server environment configuration. Rotate any credential previously shared outside trusted channels; no credentials are printed in this report.
- Access tokens still use the existing browser localStorage architecture. An eventual XSS could steal an active token. A full session-storage redesign and nonce-based CSP require a separate compatibility rollout; current React escaping, no unsafe user-controlled HTML insertion identified in the reviewed renderers, short access lifetime and server-side revocation reduce but do not eliminate this risk.
- In-memory request limits reset on restart and are per process. Multi-instance deployments should use a shared limiter store or an edge-level limit.
- Platform MFA, live monitoring/alerting, backup restoration and cloud account security were not verified by these local tests. Previously shared testing passwords must be replaced before launch; this audit did not reset existing user credentials.

No physical biometric device connectivity or live payment settlement is asserted.

## Re-run the isolated checks

With the dedicated local `acadivoDemo` MongoDB instance running on port 27018, use a separate PowerShell terminal:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27018/acadivo_security_audit?replicaSet=acadivoDemo'
$env:NODE_ENV='test'
node tests/web-security.cjs
node tests/security-sessions.cjs
node tests/session-refresh-client.cjs
node tests/database-fail-closed.cjs
node tests/organization-security.cjs
node tests/school-lifecycle.cjs
node tests/workforce-security.cjs
node tests/smart-reports.cjs
```

Database suites create/drop only their own randomly named fixtures and refuse online database URLs. Close this test terminal afterwards so its test environment variables are not reused for normal startup.
