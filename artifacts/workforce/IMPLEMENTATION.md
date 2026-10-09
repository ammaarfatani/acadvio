# Acadivo Attendance and Payroll

Implementation: 6 October 2026, existing CRM architecture. No rebuild, production deployment or real salary payment was performed.

## Architecture and delivered workflows

School persists optional MANUAL/BIOMETRIC mode, setup completion, tenant-wide attendance policy and a transactional workforce revision. No default mode is silently assigned. Approved main School Admin/Enterprise owner sees the mandatory setup wizard before dashboard contents. Manual selection completes without device questions. Biometric setup requires an enabled device, a recent real successful adapter/push response and employee mapping. Existing payment approval email remains, now directs the approved school to log in and continue setup. Later mode changes require confirmation and retain history; punches that conflict with an earlier source are preserved for review rather than overwriting that record.

User remains employee identity. Existing TeacherProfile, timetable/current academic session, LeaveRequest, AuditLog, auth/RBAC, branch scope and finance plan configuration are reused. Existing teacher attendance collections remain historical inputs; read projections merge unified records into existing teacher reports/history. Student attendance is unchanged.

One StaffAttendance engine accepts server-timed manual self attendance or normalized biometric punches. Employee cannot choose another employee, date or timestamp, edit historical records, modify salary, or mark payroll paid. Authorized School Admin corrections need a reason and transactional audit. School Admin views scoped staff registers, daily/month filters, role/department/employee/status/source, late and absence/leave information. Teacher/Finance/Examination/Receptionist/School Admin use reusable own-attendance and salary pages. Future non-parent staff roles can reuse these routes with the explicit own-attendance permission; no separate engine is needed.

Policy supports timezone, shift start/end, overnight shifts, configured working minutes, grace, FROM_START/AFTER_GRACE, shift/first current scheduled teacher class, weekly off, absence/paid/unpaid leave and cent rounding. Calendar handles paid holiday, unpaid holiday, closures (with weather/security/custom reasons) and special working days. Missing attendance on elapsed payable dates is derived as absence; no fictitious check-in is generated. Current-month payroll is provisional; future dates are UPCOMING without absence deductions.

Employment stores stable employee code, department, designation, joining/leaving dates, schedule and effective-date salary history. Monthly/day/hour bases are supported. Historical payroll snapshots retain the exact salary, policy, calendar and calculation after later updates. Joining/leaving and salary changes prorate by actual eligible working days.

Payroll: CALCULATED -> PENDING -> APPROVED -> PAID. Approval requires month end and rejects stale input calculations. Authorized additional deductions require reason. PAY requires explicit permission and external payment method/reference, records server payment date, and can succeed only once under concurrent requests. Approved/paid attendance and calendar are locked, salary backdating into approved periods is rejected, and snapshot corrections cannot silently change paid payroll. Payslip includes the school, employee, reference, working days, leave, late/absence/other deductions, calculation rows and external payment status; print/save PDF uses browser printing.

## Models and modified existing modules

New models in `src/server/models/workforce.model.ts`: StaffEmployment, StaffAttendance, SchoolCalendar, BiometricDevice, BiometricPunch, PayrollRecord and WorkforcePeriod. They cover genuinely new staff/payroll/device capabilities, not duplicate User or Leave records. Branch plugin enforces scope and references. AuditLog gained actor ID, entity ID and previous/new values. School gained attendance settings and the concurrency revision.

Existing modified modules: permission definitions, plan-feature mapping, route registry, TeacherService manual attendance/read history/leave review, SchoolAdmin attendance/report/history projections, approval email text, PortalShell onboarding/navigation, session school types, scoped portal pages and print CSS. Existing account Change Password modal remains available.

New backend modules: workforce/biometric services, shared pure `src/lib/workforce-math.ts` (server re-export), strict validators and workforce routes. New frontend modules: StaffAttendanceWorkspace, StaffAdminWorkspace, BiometricDevices and shared WorkforceUI. Main admin pages: `/school-admin/attendance/staff`, `/attendance/settings`, `/attendance/devices`, `/attendance/calendar`, `/payroll`, `/payroll/salaries`; staff portals: `/my-attendance` and `/salary`; authorized Finance also `/finance/payroll`. Existing school-slug rewrites/layouts are reused.

## APIs (under /api/workforce)

- GET/PUT settings; GET self; POST self/check-in and self/check-out.
- GET attendance/employees; POST attendance/correct; PUT employees/:id.
- GET/POST calendar; DELETE calendar/:id (locked after approval).
- GET/POST devices; PUT devices/:id; POST devices/:id/token (one-time token/rotation); PUT devices/:id/mappings; POST devices/:id/command; GET devices/:id/punches.
- Machine-only POST biometric/:id/transactions and biometric/:id/heartbeat.
- Own leave GET/POST reuses LeaveRequest; existing School Admin teacher leave review handles all staff and validates payroll locks.
- GET payroll; POST payroll/calculate; POST payroll/:id/action; GET audit.
- Public connector source/setup guide download at `/api/attendance-connector` (no secrets or school data).

Permissions: staff-attendance.self, staff-attendance.manage, biometric.manage, payroll.view, payroll.manage and payroll.pay. Finance gets view, never automatic pay/manage. Payroll and salary features use the existing FINANCE entitlement; attendance remains core. Device menu only appears in biometric mode. Payroll has backend entitlement checks, and salary values/audits are excluded from restricted plan views.

## Biometric support and exact hardware boundary

Operational adapters supported here: PUSH_JSON (authenticated normalized transactions) and CONNECTOR_HTTP_JSON (outbound connector polling a normalized LAN HTTP API). Contract: stable eventId, biometricUserId, offset/UTC timestamp, optional verification method. IDs map to actual authorized User IDs; names are not matching keys. Raw punches, including intermediate, unmapped and conflicted events, are preserved. First/last timestamps feed the same engine. Unique device/event index enforces deduplication, including payload conflict rejection.

Connector is in `connectors/attendance/connector.cjs`. Node 20+, no runtime third-party dependencies, background operation via OS service/startup task, persistent atomic queue/cursor, encrypted cached configuration, retry/network recovery and single-instance guard. Reads LAN adapter while cloud is unavailable after configuration has been cached. Cloud upload requires HTTPS except explicitly permitted localhost development. It does not expose the LAN. Device Test/Sync are requests to the connector; UI connection state requires a successful real adapter/push result. Status file exposes queue/sync/error without secrets.

Device token is random, hash-only on server and displayed once. Device credentials use AES-256-GCM with server BIOMETRIC_ENCRYPTION_KEY; they are never returned to ordinary browser/device list responses or logs. Credential delivery is restricted to that device's authenticated connector. Raw fingerprint/face templates are not stored. Local ignored encryption key was configured without printing it; keep and back up the production key, because replacing it prevents decrypting existing credentials.

**Native vendor compatibility is not established.** No physical biometric machine or brand/model/protocol/SDK was supplied. A device with a native TCP/SDK/ADMS payload needs its documented adapter, vendor credentials and hardware test; merely adding its brand/model does not make unsupported hardware compatible. Required next action: supply exact brand/model and API/SDK/push documentation, and configure/test the local adapter/service or direct normalized push on the school network. See the connector README for complete install/authentication/queue details. LAN HTTP Basic authentication requires a restricted trusted network or a secure vendor adapter; cloud HTTPS remains mandatory.

## Calculation and validation

Monthly daily rate = effective monthly salary / actual calendar payable days. Per-minute rate = that daily rate / employee's configured working minutes. Grace default: at/before 09:15 for 09:00 start, zero; 09:16 counts 16 minutes under FROM_START. Late deduction is capped at one daily salary. Approved paid leave has no deduction; unpaid leave/full-day absence use the corresponding configured deduction. Weekly off and paid closures do not produce absence deductions. Values are in the existing PKR currency; no example salary or fake chart data is inserted into production.

Exact requested October example is tested in the pure engine: 31 days, four Sundays, two closures -> 25 payable days; salary 10,000 / 25 = 400; working minutes 480; 16 minutes -> 13.33; net 9,986.67 for both sources. Real integration also verifies a 25-day closed payroll month, to exercise actual approval/payment rather than approving an unfinished current month.

## Verification and limitations

Logs are in `../organization/workforce-*.log`. Tests use isolated random databases; real school attendance/payroll was not fabricated. Databases left by interrupted MongoDB network runs were checked by exact name and fixture identity (or confirmed empty), then removed; rerun of the existing suite passed.

Completed checks: 30 pure attendance/calendar/salary calculations; six connector offline/restart/network-recovery checks; **119 real workforce HTTP/MongoDB checks**; existing 203 parent/auth/tenant/branch regressions; trial approval/form and existing mocked subscription-payment/branding suites; TypeScript, lint, production build and whitespace checks. Bulk-import regression passed, including 1,001 real student inserts and transaction/teacher-login checks. Final run counts/results are recorded in the logs and final response. Quiet lint passes; full build may include existing nonblocking image/hook warnings.

Current browser inventory reports no connected browser/apps. Mobile/tablet visual layout, actual browser console/network, printed PDF pagination and physical-device behavior have not been visually/hardware verified. Reconnect browser and supply hardware access/documentation for those checks. No production deployment was requested.
