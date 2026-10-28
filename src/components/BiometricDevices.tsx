"use client";
import { confirmAction } from "./ConfirmationHost";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { field, button, card, Text, Table } from "./WorkforceUI";
import styles from "./AttendanceUI.module.css";
import {
  Fingerprint,
  Plus,
  Download,
  Users,
  FileText,
  X,
  ShieldCheck,
} from "lucide-react";
export default function DeviceManager() {
  const { user } = useAuth();
  const [readiness, setReadiness] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]),
    [employees, setEmployees] = useState<any[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [provision, setProvision] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [mapping, setMapping] = useState<any>(null),
    [punches, setPunches] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [d, e, r] = await Promise.all([
        apiFetch("/workforce/devices"),
        apiFetch("/workforce/employees"),
        apiFetch("/workforce/devices/readiness"),
      ]);
      setReadiness(r.data);
      setDevices(d.data);
      setEmployees(e.data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    setDevices([]);
    setProvision(null);
    void load();
  }, [load, user?.branchId]);
  async function req(path: string, body: any, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await apiFetch("/workforce/" + path, {
        method,
        body: JSON.stringify(body),
      });
      await load();
      if (r.data?.message) setNotice(r.data.message);
      return r.data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.root}>
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.eyebrow}>Device connections</p>
          <h2>Biometric devices</h2>
          <p>
            Connect your attendance device, map staff IDs and monitor incoming
            attendance.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={busy || !user?.branchId}
            className={styles.primary}
            onClick={() =>
              setEditing({
                name: "",
                brand: "",
                model: "",
                deviceId: "",
                connectionType: "PUSH_JSON",
                timezone: "Asia/Karachi",
                enabled: true,
              })
            }
          >
            <Plus size={15} />
            Add device
          </button>
        </div>
      </div>
      {!user?.branchId && (
        <p role="status" className={styles.notice}>
          Select a specific branch above to configure its attendance devices.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {readiness && !readiness.credentialStorageConfigured && (
        <p role="status" className={styles.notice}>
          <ShieldCheck size={17} />
          <span>
            <b>Secure connection setup required.</b> Ask your backend
            administrator to configure private connector credential storage
            before provisioning a device. See the installation guide below.
          </span>
        </p>
      )}
      <div className={styles.integrationSteps}>
        <div>
          <span>01</span>
          <b>Configure a device</b>
          <p>
            Choose direct JSON push or a local connector for a compatible
            device.
          </p>
        </div>
        <div>
          <span>02</span>
          <b>Map staff IDs</b>
          <p>
            Match each device employee ID to an existing teacher or staff
            account.
          </p>
        </div>
        <div>
          <span>03</span>
          <b>Connect & synchronize</b>
          <p>
            Provision credentials securely and verify incoming device activity.
          </p>
        </div>
      </div>
      <details className={styles.guide}>
        <summary>Connection guide & connector downloads</summary>
        <p>
          Supported: authenticated JSON push, or a local connector with a
          documented HTTP JSON adapter. Vendor-specific protocols require a
          compatible adapter.
        </p>
        <div className={styles.actions}>
          <a className={styles.secondary} href="/api/attendance-connector">
            <Download size={14} />
            Download connector
          </a>
          <a
            className={styles.secondary}
            href="/api/attendance-connector?readme=1"
          >
            <FileText size={14} />
            Installation guide
          </a>
        </div>
        <p>
          Run the connector on a school PC or service host. Your backend
          operator transfers credentials privately; no device token is displayed
          here. A connection is confirmed only after authenticated device
          activity.
        </p>
      </details>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {editing && (
        <form
          className={styles.panel}
          onSubmit={async (e) => {
            e.preventDefault();
            const { _id, demoOnly, ...payload } = editing;
            const body = Object.fromEntries(
              Object.entries(payload).filter(
                ([k, v]) =>
                  v !== undefined &&
                  (![
                    "host",
                    "port",
                    "transactionPath",
                    "username",
                    "credentials",
                  ].includes(k) ||
                    payload.connectionType === "CONNECTOR_HTTP_JSON") &&
                  (k !== "credentials" || !!v),
              ),
            );
            const r = await req(
              _id ? "devices/" + _id : "devices",
              body,
              _id ? "PUT" : "POST",
            );
            if (r) setEditing(null);
          }}
        >
          <div className={styles.sectionHead}>
            <div>
              <h3>{editing._id ? "Edit device" : "Add a real device"}</h3>
              <p>
                Configure the connection used by your school attendance device.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close device editor"
              className={styles.quiet}
              onClick={() => setEditing(null)}
            >
              <X size={16} />
            </button>
          </div>
          <div className={styles.fields}>
            {[
              ["name", "Device name"],
              ["brand", "Brand"],
              ["model", "Model"],
              ["deviceId", "Device ID"],
              ["timezone", "Timezone"],
            ].map(([k, l]) => (
              <Text
                key={k}
                label={l}
                value={editing[k]}
                onChange={(v: string) => setEditing({ ...editing, [k]: v })}
              />
            ))}
            <label>
              Integration type
              <select
                className={field}
                value={editing.connectionType}
                onChange={(e) =>
                  setEditing({ ...editing, connectionType: e.target.value })
                }
              >
                <option value="PUSH_JSON">Direct JSON push integration</option>
                <option value="CONNECTOR_HTTP_JSON">
                  Local connector / HTTP JSON adapter
                </option>
              </select>
            </label>
            {editing.connectionType === "CONNECTOR_HTTP_JSON" &&
              [
                ["host", "LAN host / IP", "text"],
                ["port", "Port", "number"],
                ["transactionPath", "Transaction API path", "text"],
                ["username", "Username", "text"],
                ["credentials", "Password (blank keeps existing)", "password"],
              ].map(([k, l, t]) => (
                <Text
                  key={k}
                  label={l}
                  required={["host", "port", "transactionPath"].includes(k)}
                  type={t}
                  value={editing[k] || ""}
                  onChange={(v: string) =>
                    setEditing({
                      ...editing,
                      [k]: t === "number" ? Number(v) : v,
                    })
                  }
                />
              ))}
          </div>
          <div className={styles.saveBar + " mt-5"}>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) =>
                  setEditing({ ...editing, enabled: e.target.checked })
                }
              />
              Device enabled
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className={styles.primary}>
                Save device
              </button>
            </div>
          </div>
        </form>
      )}
      {!devices.filter((d) => !d.demoOnly).length && (
        <div className={styles.empty}>
          <Fingerprint size={24} className="mx-auto text-zinc-400" />
          <h3>No devices in this workspace yet</h3>
          <p>
            Add a compatible device to start receiving staff attendance.
            Connection status remains unverified until device activity is
            received.
          </p>
        </div>
      )}
      {devices
        .filter((d) => !d.demoOnly)
        .map((d) => (
          <article key={d._id} className={styles.device}>
            <header className={styles.deviceHeader}>
              <div className={styles.headingLine}>
                <span className={styles.icon}>
                  <Fingerprint />
                </span>
                <div>
                  <h3>{d.name}</h3>
                  <p>
                    {d.brand} / {d.model} &middot;{" "}
                    {d.connectionType === "PUSH_JSON"
                      ? "Direct JSON push"
                      : "Local HTTP JSON connector"}
                  </p>
                </div>
              </div>
              <span
                className={
                  styles.tag +
                  " " +
                  (d.demoOnly
                    ? styles.demoTag
                    : d.connectionStatus === "ONLINE"
                      ? styles.goodTag
                      : "")
                }
              >
                {(
                  {
                    ONLINE: "Connected",
                    OFFLINE: "Offline",
                    NOT_CONNECTED: "Awaiting connection",
                    DISABLED: "Disabled",
                  } as Record<string, string>
                )[d.connectionStatus] || "Awaiting connection"}
              </span>
            </header>
            <div className={styles.deviceBody}>
              <dl className={styles.metadata}>
                {[
                  [
                    "Last sync",
                    d.lastSyncAt
                      ? new Date(d.lastSyncAt).toLocaleString()
                      : "Not synced",
                  ],
                  [
                    "Last transaction",
                    d.lastTransactionAt
                      ? new Date(d.lastTransactionAt).toLocaleString()
                      : "None",
                  ],
                  ["Pending queue", d.pendingQueue],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className={styles.deviceId}>Device ID: {d.deviceId}</p>
              {d.lastError && <p className={styles.error}>{d.lastError}</p>}
              <div className={styles.actions + " mt-5"}>
                <button
                  className={styles.secondary}
                  onClick={() =>
                    setMapping({
                      id: d._id,
                      mappings: (d.mappings || []).map((m: any) => ({
                        biometricUserId: m.biometricUserId,
                        employeeId: String(m.employeeId),
                      })),
                    })
                  }
                >
                  <Users size={14} />
                  Map employees{" "}
                  <span className={styles.tag}>{d.mappings?.length || 0}</span>
                </button>
                <button
                  className={styles.secondary}
                  onClick={async () => {
                    try {
                      const r = await apiFetch(
                        "/workforce/devices/" + d._id + "/punches",
                      );
                      setPunches(r.data);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  <FileText size={14} />
                  Raw punches
                </button>
                <button
                  className={styles.quiet}
                  onClick={() => {
                    const {
                      _id,
                      name,
                      brand,
                      model,
                      deviceId,
                      connectionType,
                      timezone,
                      host,
                      port,
                      transactionPath,
                      username,
                      enabled,
                      demoOnly,
                    } = d;
                    setEditing({
                      _id,
                      name,
                      brand,
                      model,
                      deviceId,
                      connectionType,
                      timezone,
                      host,
                      port,
                      transactionPath,
                      username,
                      enabled,
                      demoOnly,
                    });
                  }}
                >
                  Edit device
                </button>
              </div>
              {!d.demoOnly && (
                <div className={styles.actions + " mt-3"}>
                  {["TEST", "SYNC"].map((a) => (
                    <button
                      disabled={busy}
                      key={a}
                      className={styles.secondary}
                      onClick={() =>
                        void req("devices/" + d._id + "/command", { action: a })
                      }
                    >
                      {a === "TEST" ? "Check connection" : "Sync now"}
                    </button>
                  ))}
                  <button
                    className={styles.quiet}
                    disabled={busy || !readiness?.credentialStorageConfigured}
                    onClick={async () => {
                      if (
                        await confirmAction(
                          "Provision/rotate connector credentials to the private backend directory? The existing token stops working.",
                        )
                      )
                        setProvision(
                          await req("devices/" + d._id + "/token", {}),
                        );
                    }}
                  >
                    Provision connector credentials
                  </button>
                </div>
              )}
            </div>
            <details className={styles.guide + " m-5"}>
              <summary>Sync logs</summary>
              {d.syncLogs?.length ? (
                d.syncLogs
                  .slice()
                  .reverse()
                  .map((l: any, i: number) => (
                    <p key={i}>
                      {new Date(l.at).toLocaleString()} &middot;{" "}
                      {l.ok ? "Success" : "Needs review"} &middot; {l.message}{" "}
                      &middot; {l.count} new records
                    </p>
                  ))
              ) : (
                <p>No real connector sync activity recorded.</p>
              )}
            </details>
          </article>
        ))}
      {provision && (
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <div>
              <h3>Private connector credential file</h3>
              <p>{provision.message}</p>
            </div>
            <button className={styles.quiet} onClick={() => setProvision(null)}>
              Dismiss
            </button>
          </div>
          <p className={styles.deviceId}>
            Server file: {provision.credentialFile}
          </p>
          <p className={styles.muted}>
            Ask your backend operator to transfer this file securely to the
            school connector host. No token is returned to this page.
          </p>
        </section>
      )}
      {mapping && (
        <section className={styles.panel}>
          <div className={styles.sectionHead}>
            <div>
              <h3>Link employees to biometric IDs</h3>
              <p>
                Each ID must belong to an existing employee. This tells the
                attendance engine who made the punch.
              </p>
            </div>
            <button
              aria-label="Close employee mapping"
              className={styles.quiet}
              onClick={() => setMapping(null)}
            >
              <X size={16} />
            </button>
          </div>
          {!mapping.mappings.length && (
            <p className={styles.muted + " mb-4"}>
              No mappings yet. Add your first employee below.
            </p>
          )}
          {mapping.mappings.map((m: any, i: number) => (
            <div key={i} className={styles.mappingRow}>
              <label>
                Biometric user ID
                <input
                  className={field}
                  placeholder="e.g. 102"
                  value={m.biometricUserId}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      mappings: mapping.mappings.map((x: any, j: number) =>
                        j === i ? { ...x, biometricUserId: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Employee
                <select
                  className={field}
                  value={m.employeeId}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      mappings: mapping.mappings.map((x: any, j: number) =>
                        j === i ? { ...x, employeeId: e.target.value } : x,
                      ),
                    })
                  }
                >
                  <option value="">Choose employee</option>
                  {employees.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} &middot; {u.employment?.employeeId || u._id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={styles.quiet}
                onClick={() =>
                  setMapping({
                    ...mapping,
                    mappings: mapping.mappings.filter(
                      (_: any, j: number) => j !== i,
                    ),
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              onClick={() =>
                setMapping({
                  ...mapping,
                  mappings: [
                    ...mapping.mappings,
                    { biometricUserId: "", employeeId: "" },
                  ],
                })
              }
            >
              <Plus size={14} />
              Add mapping
            </button>
            <button
              disabled={busy}
              className={styles.primary}
              onClick={async () => {
                const r = await req(
                  "devices/" + mapping.id + "/mappings",
                  { mappings: mapping.mappings },
                  "PUT",
                );
                if (r) setMapping(null);
              }}
            >
              Save & reprocess pending punches
            </button>
          </div>
        </section>
      )}
      {punches && (
        <section className={styles.report}>
          <div className={styles.sectionHead}>
            <div>
              <h3>Raw biometric punches</h3>
              <p>
                Incoming device events and their attendance processing status.
              </p>
            </div>
            <button
              className={styles.secondary}
              onClick={() => setPunches(null)}
            >
              Close
            </button>
          </div>
          <Table
            headers={[
              "Source",
              "Biometric ID",
              "Timestamp",
              "Verification",
              "Processing status",
            ]}
            rows={punches
              .filter((p: any) => !p.isDemo)
              .map((p: any) => [
                <span key={p._id} className={styles.tag}>
                  BIOMETRIC
                </span>,
                p.biometricUserId,
                new Date(p.timestamp).toLocaleString(),
                p.verificationMethod,
                p.processedAt ? "Processed" : p.error || "Pending",
              ])}
          />
        </section>
      )}
    </div>
  );
}
