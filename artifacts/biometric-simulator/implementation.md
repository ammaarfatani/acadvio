# Biometric simulator implementation — 10 October 2026

## Existing integration audit
Authenticated Direct JSON Push, employee mapping, durable raw punches, duplicate detection, policy-based attendance processing, heartbeat/status and connector command handling are implemented. The downloadable Local Connector supports an HTTP JSON adapter, encrypted configuration cache and durable offline queue. Native vendor protocols require a compatible adapter; no physical biometric device was connected or verified.

## Implemented changes
- New administrator-only BiometricSimulator component within BiometricDevices / Attendance Settings. Explicit DEMO enablement, mapped employees, normal/grace/late/checkout presets, duplicate replay, isolated runs, connection distinction and labelled monthly reports.
- Testing-only device creation also works without switching a Manual school's mode. These devices cannot receive connector credentials, execute hardware commands or satisfy real setup completion.
- Existing biometric ingestion, mapping, policy resolver and first/last-punch reducer process simulated events. DEMO snapshots are retained on existing BiometricPunch records rather than inserted into genuine StaffAttendance. No parallel attendance model or replacement integration was introduced.
- Tenant/branch/role/permission validation remains active. Both biometric.manage and staff-attendance.manage are required. Unknown IDs, invalid sessions/tokens, disabled devices and malformed events are rejected or retained with explicit processing errors as appropriate.
- DEMO processing cannot change real attendance, payroll, workforce/payroll revisions or hardware connection timestamps. Optional deductions are read-only previews using existing payroll math and permissions. Production payroll defensively excludes DEMO inputs.
- Device credential provisioning now writes to a private backend file instead of exposing a one-time token in the frontend. Configure BIOMETRIC_PROVISION_DIR to an absolute private, access-restricted directory before provisioning new real connector credentials. Existing credentials remain valid. Securely transfer the file to the connector host and remove it after provisioning; restrict Windows ACLs. Heartbeat errors are sanitized to prevent supplied secrets being echoed.

## Verification
- TypeScript: passed.
- Production build: passed, 132 routes. Isolated build output; no production deployment performed.
- Lint: passed with pre-existing warnings elsewhere; simulator has no new hook warnings.
- Workforce regression: 121 real HTTP/MongoDB checks passed.
- Attendance/calendar/payroll math: 30 checks passed.
- Connector offline/restart/recovery: 6 checks passed, using a mock adapter.
- Simulator integration: 111 real HTTP/MongoDB isolation and policy checks passed. Uses randomly named disposable MongoDB database and real HTTP routes, not the live school database.

## Browser verification limits
Supported browser access was restored. Signed-in Attendance Settings rendered with the new Add DEMO testing-only device control and existing policies/device controls. Clicking it returned endpoint-not-found from the currently running older, non-watch pnpm backend process. No demo device or punch was created in the live school during this browser check, and no live mode/policy/payroll setting was changed. Full rendered simulator interaction and responsive screenshots are therefore not claimed as verified.

Restart the backend terminal (Ctrl+C, then pnpm backend, or pnpm dev:backend for watching), refresh the page and follow docs/biometric-simulator.md. Frontend development server can remain running. The automated integration suites execute the updated backend code independently and verify persisted DEMO records and reports.

Local route: http://localhost:3000/aptechinternationalinstitute/admin/attendance/settings

## Changed areas
src/components/BiometricSimulator.tsx; BiometricDevices.tsx; StaffAttendanceWorkspace.tsx; server workforce models, validator, routes, biometric/workforce services; workforce-math; integration tests; connector README; .env.example; docs/biometric-simulator.md.

Pre-change source snapshots are under artifacts/biometric-simulator/before. No hardware connectivity, deployment or genuine biometric attendance is implied by these results.
