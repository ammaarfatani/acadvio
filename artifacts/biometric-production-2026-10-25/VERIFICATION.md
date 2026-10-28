# Biometric production transition - 25 October 2026

- Removed the simulator component, test panel, DEMO creation controls and four simulator API routes. Removed simulator services, batch validator and obsolete CSS.
- Real push/connector authentication, employee mapping, first/last punch processing, diagnostics, provisioning and downloads preserved. Diagnostic Check connection requests real adapter activity; it does not create fake attendance.
- Existing testing devices hidden and rejected by real configuration/mapping/ingestion. Historical test punches preserved with source isolation and excluded from operational feed/payroll. No live history was deleted.
- Attendance UI matches warm neutral / charcoal / red portal styling, with aligned policy fields, three setup steps, real connection statuses and explicit server readiness.
- PASS: 136 isolated local HTTP/MongoDB checks and 6 durable connector offline/restart/recovery checks. Initial test count assertion included a newly added historical DEMO fixture; corrected the assertion to count genuine punches separately and reran successfully.
- TypeScript passed before final formatting. Real school Attendance Settings and both device-editor integration choices reviewed on desktop. Mobile capture was interrupted by browser session reset; not claimed verified for this change.
- Screenshots: attendance-settings.png, device-connections.png, connector-editor.png. No device saved or school attendance policy changed during browser review.
- Current configuration: encryption key present; BIOMETRIC_PROVISION_DIR missing. Production operator must configure an absolute private credential-storage folder outside public assets, then provision/transfer connector credentials securely.
- Real hardware connectivity NOT verified. A machine needs its compatible JSON push/HTTP adapter or vendor-specific integration. See connectors/attendance/README.md.
