const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

let dataRevision = 0;
export function invalidateApiReads() {
  dataRevision++;
}
const inFlight = new Map<string, Promise<any>>();
export function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  retriedAfterRefresh = false,
): Promise<any> {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" || options.signal || typeof window === "undefined")
    return requestJson(endpoint, options, retriedAfterRefresh);
  const key = [
    localStorage.getItem("acadivo_access_token"),
    sessionStorage.getItem("acadivo:branch"),
    dataRevision,
    endpoint,
    JSON.stringify(options.headers || {}),
  ].join("|");
  const pending = inFlight.get(key);
  if (pending) return pending;
  const task = requestJson(endpoint, options, retriedAfterRefresh);
  inFlight.set(key, task);
  void task
    .finally(() => {
      if (inFlight.get(key) === task) inFlight.delete(key);
    })
    .catch(() => {});
  return task;
}
export function optionalPhotoRequest(endpoint: string, method = "GET") {
  return (
    method.toUpperCase() === "GET" &&
    /^\/student-media\/(?:staff\/)?[a-f0-9]{24}\/photo(?:\?|$)/i.test(endpoint)
  );
}
export function friendlyApiError(status: number, message: string) {
  if (typeof message !== "string")
    return "Please review your information and try again.";
  if(status===401) return "Your session has ended. Please sign in again.";
  if(status===403 && /Missing required permission|Role '.+' is not authorized|Missing permission/i.test(message)) return "Your account does not have permission to use this feature. Please contact your school administrator.";
  if (status >= 500)
    return "We couldn't complete this request. Please try again in a moment. Contact your school administrator if it continues.";
  if (status === 404 && /^Student not found\.?$/i.test(message))
    return "This student record is no longer available. Refresh the list and select the student again.";
  if (
    /API endpoint .*not found|Cast to ObjectId|MongoServerError|ValidationError|ECONNREFUSED|stack trace/i.test(
      message,
    )
  )
    return "This service is temporarily unavailable. Please refresh the page or contact your school administrator.";
  return message;
}
async function requestJson(
  endpoint: string,
  options: RequestInit = {},
  retriedAfterRefresh = false,
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("acadivo_access_token")
      : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    const branch = sessionStorage.getItem("acadivo:branch");
    if (
      branch &&
      !endpoint.startsWith("/auth/login") &&
      !endpoint.startsWith("/public/")
    )
      headers["X-Acadivo-Branch"] = branch;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (error: any) {
    if (error?.name === "AbortError") throw error;
    throw Object.assign(
      new Error(
        "Cannot connect to the school service. Please check your connection and try again.",
      ),
      { status: 0 },
    );
  }

  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    !endpoint.startsWith("/auth/login") &&
    !endpoint.startsWith("/auth/refresh")
  ) {
    try {
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const refreshData = await refreshResponse.json();
      const refreshedToken = refreshData.data?.accessToken;
      if (
        refreshResponse.ok &&
        refreshedToken &&
        typeof window !== "undefined"
      ) {
        localStorage.setItem("acadivo_access_token", refreshedToken);
        return requestJson(endpoint, options, true);
      }
    } catch {
      /* The normal unauthorized response below clears the session. */
    }
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = {
      message: "The server returned an unreadable response. Please try again.",
    };
  }

  if (!response.ok) {
    const message = friendlyApiError(
      response.status,
      data.errors?.[0] ||
        data.message ||
        "The request could not be completed. Please review your information and try again.",
    );
    const missingOptionalPhoto =
      response.status === 404 && optionalPhotoRequest(endpoint, options.method);
    if (typeof window !== "undefined") {
      if (!missingOptionalPhoto)
        window.dispatchEvent(
          new CustomEvent("acadivo:feedback", {
            detail: { type: "error", message },
          }),
        );
      if (response.status === 403 && !endpoint.startsWith("/auth/"))
        window.dispatchEvent(
          new CustomEvent("acadivo:subscription-restricted"),
        );
      if (response.status === 401 && !endpoint.startsWith("/auth/login")) {
        window.dispatchEvent(new CustomEvent("acadivo:session-expired"));
      }
    }
    throw Object.assign(new Error(message), { status: response.status });
  }

  const method = (options.method || "GET").toUpperCase();
  if (
    typeof window !== "undefined" &&
    method !== "GET" &&
    data.message &&
    !endpoint.startsWith("/auth/") &&
    !/\/(preview|bulk-preview|export|sheet)(?:\?|$)/.test(endpoint)
  ) {
    window.dispatchEvent(
      new CustomEvent("acadivo:feedback", {
        detail: { type: "success", message: data.message },
      }),
    );
  }

  if (
    typeof window !== "undefined" &&
    !["GET", "HEAD"].includes(method) &&
    !endpoint.startsWith("/auth/") &&
    !/\/(preview|bulk-preview|export|sheet|initialize)(?:\?|$)/.test(endpoint)
  ) {
    dataRevision++;
    const detail = { resource: endpoint.split("/")[1] };
    window.dispatchEvent(new CustomEvent("acadivo:data-changed", { detail }));
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("acadivo:record-updates");
      channel.postMessage(detail);
      channel.close();
    }
  }
  return data;
}

export const authApi = {
  login: async (credentials: any) => {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    if (data.data?.accessToken && typeof window !== "undefined") {
      sessionStorage.removeItem("acadivo:branch");
      localStorage.setItem("acadivo_access_token", data.data.accessToken);
    }
    return data;
  },
  registerSchool: async (schoolData: any) => {
    return apiFetch("/public/register-school", {
      method: "POST",
      body: JSON.stringify(schoolData),
    });
  },
  getMe: async () => {
    return apiFetch("/auth/me");
  },
  logout: async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("acadivo_access_token");
      }
    }
  },
};

export async function privateFile(endpoint: string, options: RequestInit = {}) {
  const make = () => {
    const headers = new Headers(options.headers);
    if (typeof options.body === "string" && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    headers.set(
      "Authorization",
      `Bearer ${localStorage.getItem("acadivo_access_token") || ""}`,
    );
    const branch = sessionStorage.getItem("acadivo:branch");
    if (branch) headers.set("X-Acadivo-Branch", branch);
    return fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: "include",
      headers,
    });
  };
  let response = await make();
  if (response.status === 401) {
    const refreshed = await apiFetch("/auth/refresh-token", {
      method: "POST",
      body: "{}",
    });
    localStorage.setItem("acadivo_access_token", refreshed.data.accessToken);
    response = await make();
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(
        friendlyApiError(
          response.status,
          error.errors?.[0] ||
            error.message ||
            "The file could not be downloaded. Please retry.",
        ),
      ),
      { status: response.status },
    );
  }
  if (
    (response.headers.get("Content-Type") || "").includes("application/json") ||
    (response.headers.get("Content-Type") || "").includes("text/html")
  )
    throw new Error(
      "The server did not return a downloadable file. Please sign in again or retry.",
    );
  const blob = await response.blob();
  if (!blob.size) throw new Error("The generated file is empty. Please retry.");
  return blob;
}
export async function downloadPrivate(endpoint: string, name: string) {
  const url = URL.createObjectURL(await privateFile(endpoint));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
