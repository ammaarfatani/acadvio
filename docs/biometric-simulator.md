> RETIRED - 25 October 2026. Simulator controls and API routes have been removed from the application. The instructions below are historical only and must not be used for production setup. Existing DEMO records remain isolated from genuine attendance/payroll. Use connectors/attendance/README.md for current real-device installation instructions. tests/biometric-simulator.cjs now runs the production workforce regression suite, including checks that simulator routes are absent.

# Biometric attendance audit and simulator

## Existing implementation inspected

- `src/server/routes/workforce.routes.ts`: separate Bearer device authentication for JSON transaction/heartbeat endpoints; user authentication, School Admin and permission guards for configuration. Strict Zod contracts reject tenant/source overrides.
- `src/server/services/biometric.service.ts`: hashed device token checks, encrypted device passwords, branch context, raw transaction durability, stable-ID duplicates, employee mapping, employment-date checks, transaction processing, manual/corrected-history preservation and approved payroll locks.
- `src/server/services/workforce.service.ts` and `src/lib/workforce-math.ts`: manual check-in/out, school/employment policies, teacher first scheduled class, grace rules, weekly calendar, deductions and explicit payroll approval/payment.
- `connectors/attendance/connector.cjs`: outbound HTTP JSON adapter, encrypted cached configuration, durable queue/cursor, restart recovery, heartbeat and queued TEST/SYNC commands. Existing automated adapter tests use a local fixture HTTP service.
- `src/components/BiometricDevices.tsx`: actual device configuration, mapping, status/logs/raw punches and downloads. PUSH_JSON Test returns awaiting authenticated push; connector Test/Sync queues a command. It does not directly connect a browser to hardware.

Native vendor SDK/ADMS/TCP protocols are not implemented by the generic HTTP JSON adapter. No physical biometric device is connected for this work; hardware connectivity/brand compatibility has not been verified.

Security gap found: the old rotation API returned a one-time token displayed in the browser. It now provisions to a private operator-controlled backend file and returns only its filename. Configure BIOMETRIC_PROVISION_DIR before provisioning; follow the connector README. Existing machine authentication and deployed tokens are preserved until explicit rotation. Connector-reported errors are reduced to safe generic messages rather than echoing arbitrary external strings.

## Architecture of DEMO mode

No parallel attendance model or attendance calculation system was introduced. New additive metadata on existing BiometricDevice/BiometricPunch models records testing-only purpose, opt-in status, run identity, actor, DEMO source and attendance snapshot. Testing-only devices are created through the existing device service while keeping the real school mode unchanged, cannot receive machine credentials or hardware commands, and cannot satisfy biometric setup completion. Existing attendance unique indexes and genuine attendance data are unchanged.

Authorized user requests call the same `ingest` / `processPunch` pipeline. Mapping, branch, employee dates, current device configuration and policy are checked again before processing. The shared first/last reducer creates identical attendance values. Production punches write StaffAttendance; DEMO punches store the resulting snapshot on their existing raw BiometricPunch record. A per-device transactional sequence serializes demo processing; event IDs are namespaced by run and reserved from real pushes.

DEMO processing does not update School.workforceRevision, WorkforcePeriod, StaffAttendance, PayrollRecord or real device connection/sync timestamps. Therefore it cannot satisfy real biometric setup completion, invalidate an approved payroll or masquerade as genuine staff attendance. Real pending-punch mapping replay excludes DEMO punches. Pending DEMO punches can be retried explicitly through the simulator after mapping is fixed.

The DEMO report resolves the existing school/shift/first-class policy and calendar. Existing payroll math is used for a labelled read-only deduction preview when the admin has payroll permission and salary history exists. Production payroll math also defensively ignores isDemo/DEMO source inputs; only an explicitly labelled internal demo-preview call includes them. No payment action is exposed for previews.

Simulation is authorized through the existing administrator session, not a device-token bypass. Machine endpoints continue to require actual device credentials and school biometric mode. Both transports converge at the same processing function but have distinct, appropriate authentication.

## Endpoints

All demo endpoints are under `/api/workforce/devices/:id`, after existing authentication, School Admin and BOTH biometric.manage / staff-attendance.manage guards, scoped to a chosen branch.

- POST `/api/workforce/devices/demo`: empty object; creates an explicitly testing-only device without switching Manual/Biometric mode.
- PUT `/demo`: `{enabled:boolean}`.
- POST `/demo/events`: `{runId:UUID, events:[{eventId,biometricUserId,timestamp,verificationMethod?}]}`; maximum 20, at least one. Offset/Z timestamps use the existing validation and future tolerance. Source/actor/tenant flags are not accepted from clients.
- GET `/demo/report?runId=UUID&employeeId=ObjectId&month=YYYY-MM`: mapped employee, labelled records and optional permission-safe preview.

## Manual testing without a machine

Use the Attendance Settings device panel and the step-by-step connector README. UI test presets populate a time; pressing Send DEMO punch actually submits it. Reset the run between normal and late scenarios so the earliest punch of one scenario does not replace another. At grace boundary expect zero late minutes. One minute beyond grace expects either grace+1 late minutes (FROM_START) or 1 (AFTER_GRACE). Teacher FIRST_CLASS uses the current-session first lesson when present, otherwise the existing shift fallback. Off days are visible and excluded from payable days. Missing checkout stays empty; subsequent later event sets checkout.

Open the real staff attendance/monthly payroll view afterward: demo punches must not appear as real records or change payroll. Reports are deliberately separate and prominently marked DEMO; do not use them as payslips.

## Automated checks

Run from the repository root:

```
node tests/biometric-simulator.cjs
node tests/workforce-security.cjs
node tests/workforce-math.cjs
node tests/attendance-connector.cjs
node node_modules/typescript/bin/tsc --noEmit
pnpm lint
```

The two integration suites use the configured MongoDB host with randomly named `acadivo_workforce_test_*` disposable databases, unique fixture users/schools and local ephemeral HTTP servers. MongoDB must support transactions (replica set/Atlas). They never target the application's business database. Their guarded cleanup drops only their generated disposable database; private credential fixtures live in isolated OS temporary directories and are removed. Do not grant a test runner unrestricted database access without reviewing the fixture scope.

Coverage includes authenticated admin versus teacher/foreign-school/all-branch requests, strict payloads, missing/invalid user and machine authentication, unknown device/mapping, normal/grace/late/checkout/off-day events, duplicates and concurrent retries, isolated runs, first-class shift rules, absence/late deduction previews and disabled deduction flags. Preservation checks cover real attendance/payroll/revision/status fields; the existing workforce suite covers genuine JSON ingestion, manual mode, corrections, approvals and branch boundaries. Connector tests cover durable offline/restart/recovery using a mock adapter, not real hardware.

Rendered browser behavior and physical-device verification are separate from these automated API/database checks. See the implementation report for the results actually obtained in this session.
