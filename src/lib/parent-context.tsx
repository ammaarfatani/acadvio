"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";
type ParentState = {
  children: any[];
  selected: string;
  select: (id: string) => void;
  data: any;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
const Context = createContext<ParentState | null>(null);
export function useParent() {
  const value = useContext(Context);
  if (!value) throw Error("Parent workspace unavailable");
  return value;
}
export function useOptionalParent() {
  return useContext(Context);
}
export function ParentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]),
    [selected, setSelected] = useState(""),
    [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0),
    selection = useRef(selected);
  selection.current = selected;
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    if (user?.userType !== "PARENT") return;
    let live = true;
    setLoading(true);
    const loadChildren = () =>
      apiFetch("/parent/children")
        .then((r) => {
          if (!live) return;
          setRows(r.data);
          const remembered = sessionStorage.getItem("acadivo:child:" + user.id);
          setSelected((current) =>
            r.data.some((s: any) => s._id === current)
              ? current
              : r.data.some((s: any) => s._id === remembered)
                ? remembered
                : r.data[0]?._id || "",
          );
          if (!r.data.length) {
            setData(null);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (live) {
            setError(e.message);
            setLoading(false);
          }
        });
    void loadChildren();
    const update = () => {
      if (document.visibilityState === "visible") void loadChildren();
    };
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      invalidate();
    };
  }, [user?.id, user?.userType, invalidate]);

  const refresh = useCallback(async () => {
    if (!selected) return;
    const version = ++generation.current;
    try {
      const r = await apiFetch("/parent/children/" + selected);
      if (version === generation.current && selection.current === selected) {
        setData(r.data);
        setError("");
      }
    } catch (e: any) {
      if (version === generation.current && selection.current === selected)
        setError(e.message);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [selected]);
  useEffect(() => {
    setData(null);
    setError("");
    if (!selected) return;
    setLoading(true);
    void refresh();
    return () => {
      invalidate();
    };
  }, [selected, refresh, invalidate]);
  useEffect(() => {
    if (!selected) return;
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [selected, refresh]);
  function select(id: string) {
    if (!rows.some((s) => s._id === id)) return;
    generation.current++;
    selection.current = id;
    setData(null);
    setLoading(true);
    setSelected(id);
    if (user) sessionStorage.setItem("acadivo:child:" + user.id, id);
  }
  return (
    <Context.Provider
      value={{
        children: rows,
        selected,
        select,
        data,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function ParentSelection() {
  const { children, selected, select, data, loading, error, refresh } =
    useParent();
  return (
    <div className="parent-selection mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
            Parent workspace
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {children.length} linked{" "}
            {children.length === 1 ? "child" : "children"} • All records below
            follow your selected child.
          </p>
        </div>
        <label className="block min-w-0 flex-1 sm:max-w-sm text-xs font-medium text-zinc-500">
          Viewing child
          <select
            aria-label="Viewing child"
            value={selected}
            onChange={(e) => select(e.target.value)}
            disabled={!children.length}
            className="mt-1 w-full max-w-sm rounded-lg border bg-white p-2 text-sm text-zinc-900"
          >
            {children.map((c) => (
              <option value={c._id} key={c._id}>
                {c.name} — {c.className}
                {(
                  c._id === selected ? data?.student.sectionName : c.sectionName
                )
                  ? " / " +
                    (c._id === selected
                      ? data.student.sectionName
                      : c.sectionName)
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={loading}
          onClick={() => void refresh()}
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        >
          Refresh records
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}{" "}
          <button onClick={() => void refresh()} className="ml-2 underline">
            Retry
          </button>
        </p>
      )}
      {data?.placementWarning && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {data.placementWarning}
        </p>
      )}
    </div>
  );
}
