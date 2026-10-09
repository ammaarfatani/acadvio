const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function apiFetch(endpoint: string, options: RequestInit = {}, retriedAfterRefresh = false) {
  const token = typeof window !== "undefined" ? localStorage.getItem("acadivo_access_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    const branch = sessionStorage.getItem("acadivo:branch");
    if (branch && !endpoint.startsWith("/auth/login") && !endpoint.startsWith("/public/")) headers["X-Acadivo-Branch"] = branch;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !retriedAfterRefresh && !endpoint.startsWith("/auth/login") && !endpoint.startsWith("/auth/refresh")) {
    try {
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh-token`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
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



export async function privateFile(endpoint:string){
 const make=()=>fetch(`${API_BASE}${endpoint}`,{credentials:"include",headers:{Authorization:`Bearer ${localStorage.getItem("acadivo_access_token")||""}`,...(sessionStorage.getItem("acadivo:branch")?{"X-Acadivo-Branch":sessionStorage.getItem("acadivo:branch")!}:{})}});
 let response=await make();if(response.status===401){const refreshed=await apiFetch("/auth/refresh-token",{method:"POST",body:"{}"});localStorage.setItem("acadivo_access_token",refreshed.data.accessToken);response=await make();}
 if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.message||"File unavailable.");}return response.blob();
}
export async function downloadPrivate(endpoint:string,name:string){const url=URL.createObjectURL(await privateFile(endpoint));const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
