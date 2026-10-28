# Acadivo Attendance Connector

Requires Node.js 20+ on a school PC/service host. Runs outbound only; no LAN exposure or inbound port forwarding. Use a dedicated low-privilege OS account. Run under Windows Task Scheduler (startup trigger/restart on failure) or a service manager; `node connector.cjs` remains a background service process when managed by that host.

## Private credential provisioning

The device settings page no longer returns or displays connector tokens. Existing deployed connector tokens remain valid until explicitly rotated. A backend operator must configure `BIOMETRIC_PROVISION_DIR` as an absolute private directory outside all web-served folders (for example `/var/lib/acadivo/connector-credentials` or `D:\AcadivoPrivate\connector-credentials`). Use a restricted backend service account and persistent storage where appropriate. On Windows, restrict directory/file ACLs to that service account and the trusted operator; POSIX mode bits alone are not Windows ACL protection.

An authorized school administrator chooses **Provision connector credentials** on the existing device. The backend writes an owner-only credential `.env` file and returns only its random filename. The operator transfers that file securely to the school connector host, loads it into the connector service environment and removes the provisioning copy after successful setup. Do not print its contents, place it in public/uploads, commit it, or paste it into browser fields/logs. A failed provisioning transaction does not commit a token rotation. File permissions and secure transfer are operational requirements. Missing directory configuration produces a clear setup error; no secret is returned.

Environment: `ACADIVO_API_URL=https://your-api/api`, `ACADIVO_DEVICE_ID=<database device id>`, `ACADIVO_DEVICE_TOKEN=<one-time generated token>`, optionally `ACADIVO_QUEUE_DIR`, `ACADIVO_POLL_MS` (default 30000). Restrict access to the environment/token and queue directory. Local development HTTP requires explicit `ACADIVO_ALLOW_LOCAL_HTTP=true` and localhost endpoint. Do not commit secrets. No private credentials appear in logs/status.

## Supported contracts

- PUSH_JSON: vendor/cloud adapter posts `{events:[{eventId,biometricUserId,timestamp,verificationMethod?}]}` to `/api/workforce/biometric/:id/transactions` with Bearer device token. Timestamp must include UTC `Z` or offset. The endpoint does not implement an undocumented native vendor protocol.
- CONNECTOR_HTTP_JSON: device or vendor-specific LAN adapter supplies an HTTP JSON response `{events:[...],cursor?}` with the same normalized fields. Connector polls configured host/port/path, optionally Basic authentication, and preserves cursor and spool atomically. Stable event IDs are mandatory. Device passwords are encrypted on server and provided only to this device's authenticated connector. Use a trusted restricted LAN (HTTP LAN adapter traffic is not encrypted); cloud uploads require HTTPS.

The adapter registry is the extension point for actual brand/model SDK, ADMS/push or TCP adapters. Native machine support requires its documented protocol/SDK and hardware testing; no universal ZKTeco/Hikvision/etc. compatibility is claimed. The browser never connects directly to a LAN machine. Device Test/Sync commands are queued for the connector; UI only marks the device connected after a successful adapter response or authenticated direct push.

Queue survives process/network failure and retries each polling cycle. Batch acknowledgement means cloud raw punches are durable; unmapped/locked punches remain in cloud for admin review/reprocessing. It does not mean every punch was immediately converted to attendance. Queue/status files are local and contain attendance transaction identifiers/timestamps, not fingerprint/face templates. Test network recovery before deployment. Token rotation invalidates the previous connector token.

## Production readiness

The simulator has been retired from the application UI and API. Existing testing-only devices are not listed or accepted by real device ingestion. Historical test punches retain their source markers and cannot become genuine attendance or payroll.

1. Select the correct branch and save Biometric attendance mode.
2. Add a real device using the integration contract supported by its vendor or adapter. Brand/model alone is not a protocol configuration.
3. Map the device employee IDs to existing school staff.
4. Configure BIOMETRIC_PROVISION_DIR outside public folders. For a credential-protected HTTP adapter, also configure BIOMETRIC_ENCRYPTION_KEY (64 hexadecimal characters).
5. Provision connector credentials, transfer privately to the connector host, and configure ACADIVO_API_URL, ACADIVO_DEVICE_ID and ACADIVO_DEVICE_TOKEN.
6. Start the connector or authenticated push adapter. Check connection queues a diagnostic; it does not fabricate a successful connection. For direct push, send a genuine authenticated event/heartbeat from the adapter.
7. Confirm connection, synchronize actual punches and review unmapped/failed events. Complete biometric setup only after a connected device has at least one mapped employee.

Automated local contract checks: run tests/workforce-security.cjs with an explicit isolated local MONGODB_URI, and node tests/attendance-connector.cjs for durable queue/restart/recovery checks. These validate software contracts, not physical hardware connectivity. Device-specific acceptance must be performed with the chosen machine and its supported adapter.
