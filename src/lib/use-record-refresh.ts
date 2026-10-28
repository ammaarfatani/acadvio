"use client";
import { useEffect, useRef } from "react";
import { invalidateApiReads } from "./api";
// Refresh confirmed server data, with no optimistic success and no polling.
export function useRecordRefresh(load: () => unknown, resources: string[]) {
  const latest = useRef(load);
  latest.current = load;
  const keys = resources.join("|");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>,
      live = true,
      dirty = false;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (live)
          Promise.resolve()
            .then(() => latest.current())
            .catch((error) =>
              window.dispatchEvent(
                new CustomEvent("acadivo:feedback", {
                  detail: {
                    type: "error",
                    message:
                      error?.message ||
                      "Updated records could not be refreshed.",
                  },
                }),
              ),
            );
      }, 450);
    };
    const refresh = (detail: any) => {
      if (!live || !keys.split("|").includes(detail?.resource)) return;
      invalidateApiReads();
      if (document.visibilityState === "hidden") {
        dirty = true;
        return;
      }
      schedule();
    };
    const visible = () => {
      if (dirty && document.visibilityState !== "hidden") {
        dirty = false;
        schedule();
      }
    };
    document.addEventListener("visibilitychange", visible);
    const event = (e: Event) => refresh((e as CustomEvent).detail);
    window.addEventListener("acadivo:data-changed", event);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("acadivo:record-updates")
        : null;
    if (channel) channel.onmessage = (e) => refresh(e.data);
    return () => {
      live = false;
      clearTimeout(timer);
      window.removeEventListener("acadivo:data-changed", event);
      channel?.close();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [keys]);
}
