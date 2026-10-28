# Acadivo Attendance Connector

Requires Node.js 20+ on a school PC/service host. Runs outbound only; no LAN exposure or inbound port forwarding. Use a dedicated low-privilege OS account. Run under Windows Task Scheduler (startup trigger/restart on failure) or a service manager; `node connector.cjs` remains a background service process when managed by that host.

Environment: `ACADIVO_API_URL=https://your-api/api`, `ACADIVO_DEVICE_ID=<database device id>`, `ACADIVO_DEVICE_TOKEN=<one-time generated token>`, optionally `ACADIVO_QUEUE_DIR`, `ACADIVO_POLL_MS` (default 30000). Restrict access to the environment/token and queue directory. Local development HTTP requires explicit `ACADIVO_ALLOW_LOCAL_HTTP=true` and localhost endpoint. Do not commit secrets. No private credentials appear in logs/status.

## Supported contracts

- PUSH_JSON: vendor/cloud adapter posts `{events:[{eventId,biometricUserId,timestamp,verificationMethod?}]}` to `/api/workforce/biometric/:id/transactions` with Bearer device token. Timestamp must include UTC `Z` or offset. The endpoint does not implement an undocumented native vendor protocol.
- CONNECTOR_HTTP_JSON: device or vendor-specific LAN adapter supplies an HTTP JSON response `{events:[...],cursor?}` with the same normalized fields. Connector polls configured host/port/path, optionally Basic authentication, and preserves cursor and spool atomically. Stable event IDs are mandatory. Device passwords are encrypted on server and provided only to this device's authenticated connector. Use a trusted restricted LAN (HTTP LAN adapter traffic is not encrypted); cloud uploads require HTTPS.

The adapter registry is the extension point for actual brand/model SDK, ADMS/push or TCP adapters. Native machine support requires its documented protocol/SDK and hardware testing; no universal ZKTeco/Hikvision/etc. compatibility is claimed. The browser never connects directly to a LAN machine. Device Test/Sync commands are queued for the connector; UI only marks the device connected after a successful adapter response or authenticated direct push.

Queue survives process/network failure and retries each polling cycle. Batch acknowledgement means cloud raw punches are durable; unmapped/locked punches remain in cloud for admin review/reprocessing. It does not mean every punch was immediately converted to attendance. Queue/status files are local and contain attendance transaction identifiers/timestamps, not fingerprint/face templates. Test network recovery before deployment. Token rotation invalidates the previous connector token.
