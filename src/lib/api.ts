const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function apiFetch(endpoint: string, options: RequestInit = {}, retriedAfterRefresh = false) {
  const token = typeof window !== "undefined" ? localStorage.getItem("acadivo_access_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !retriedAfterRefresh && !endpoint.startsWith("/auth/login") && !endpoint.startsWith("/auth/refresh")) {
    try {
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      const refreshData = await refreshResponse.json();
      const refreshedToken = refreshData.data?.accessToken;
      if (refreshResponse.ok && refreshedToken && typeof window !== "undefined") {
        localStorage.setItem("acadivo_access_token", refreshedToken);
        return apiFetch(endpoint, options, true);
      }
    } catch { /* The normal unauthorized response below clears the session. */ }
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = { message: "The server returned an unreadable response. Please try again." };
  }

  if (!response.ok) {
    const message = data.message || data.errors?.[0] || "The request could not be completed. Please review your information and try again.";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("acadivo:feedback", { detail: { type: "error", message } }));
      if (response.status === 403 && !endpoint.startsWith("/auth/")) window.dispatchEvent(new CustomEvent("acadivo:subscription-restricted"));
      if (response.status === 401 && !endpoint.startsWith("/auth/login")) {
        window.dispatchEvent(new CustomEvent("acadivo:session-expired"));
      }
    }
    throw Object.assign(new Error(message), { status: response.status });
  }

  const method = (options.method || "GET").toUpperCase();
  if (typeof window !== "undefined" && method !== "GET" && data.message && !endpoint.startsWith("/auth/")) {
    window.dispatchEvent(new CustomEvent("acadivo:feedback", { detail: { type: "success", message: data.message } }));
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


