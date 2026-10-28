"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Search, Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeading } from "./ProductUI";
export default function WorkspaceNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL"),
    [search, setSearch] = useState(""),
    [reading, setReading] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/workspace/notifications");
      if (version === generation.current) setItems(response.data.items || []);
    } catch (e: any) {
      if (version === generation.current) setError(e.message);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [user?.id, user?.branchId]);
  useEffect(() => {
    setItems([]);
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  const unread = items.filter((item) => item.isRead === false).length;
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (filter !== "UNREAD" || item.isRead === false) &&
          [item.title, item.content]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [items, filter, search],
  );
  async function markRead(item: any) {
    if (reading) return;
    setReading(item.id);
    setError("");
    try {
      await apiFetch("/workspace/notifications/" + item.id + "/read", {
        method: "PATCH",
      });
      setItems((rows) =>
        rows.map((row) =>
          row.id === item.id ? { ...row, isRead: true } : row,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setReading("");
    }
  }
  return (
    <div className="communication-page workspace-notifications space-y-5 pb-10">
      <PageHeading
        eyebrow="Your school inbox"
        title="Notifications"
        description="Account updates, school notices and reminders in one place."
        detail={
          <>
            <Bell size={14} />
            {unread} unread / {items.length} updates
          </>
        }
        actions={
          <button
            disabled={loading}
            onClick={() => void load()}
            className="workspace-secondary-button"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />
      {error && (
        <p role="alert">
          {error}
          <button className="ml-3 underline" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      <section
        className="communication-toolbar"
        aria-label="Notification filters"
      >
        <div className="communication-tabs">
          {[
            ["ALL", "All updates"],
            ["UNREAD", "Unread"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              {value === "UNREAD" && <span>{unread}</span>}
            </button>
          ))}
        </div>
        <label className="workspace-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications"
            aria-label="Search notifications"
          />
        </label>
      </section>
      {loading ? (
        <div role="status" className="communication-empty">
          Loading your notifications...
        </div>
      ) : visible.length ? (
        <div className="communication-feed">
          {visible.map((item) => (
            <article
              key={item.id}
              className="communication-item"
              data-unread={item.isRead === false}
            >
              <span className="communication-item-icon">
                <Bell size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2>{item.title}</h2>
                  {item.isRead === false && (
                    <span className="communication-badge">Unread</span>
                  )}
                </div>
                <p className="communication-body">{item.content}</p>
                <div className="communication-meta">
                  <time dateTime={item.createdAt}>
                    {item.createdAt &&
                    !Number.isNaN(new Date(item.createdAt).getTime())
                      ? new Date(item.createdAt).toLocaleString("en-PK", {
                          timeZone: "Asia/Karachi",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Date not recorded"}
                  </time>
                  {item.canMarkRead && !item.isRead && (
                    <button
                      disabled={!!reading}
                      onClick={() => void markRead(item)}
                      className="communication-read"
                    >
                      <CheckCheck size={14} />
                      {reading === item.id ? "Updating..." : "Mark as read"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="communication-empty">
          <Inbox size={30} />
          <h2>{items.length ? "No matching updates" : "You're up to date"}</h2>
          <p>
            {items.length
              ? "Try another search or switch to all updates."
              : "School notices and account updates will appear here when available."}
          </p>
        </div>
      )}
    </div>
  );
}
