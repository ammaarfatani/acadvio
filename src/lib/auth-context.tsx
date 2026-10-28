"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "@/lib/api";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  userType: string;
  status?: string;
  organizationId?: string;
  branchId?: string | null;
  isOrganizationOwner?: boolean;
  features?: string[];
  school?: { documentSetupCompletedAt?:string; accountStatus?: "ACTIVE" | "DEACTIVATED"; accountStatusReason?: string; attendanceMode?: "MANUAL" | "BIOMETRIC"; attendanceSetupCompletedAt?: string; _id?: string; name: string; slug?: string; code?: string; status?: string; registrationType?: "trial" | "paid"; plan?: string; logoUrl?: string; address?: string; phone?: string } | null;
  permissions?: string[];
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  refreshUser: () => Promise<SessionUser | null>;
  setUser: (user: SessionUser | null) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const setUser = useCallback((next: SessionUser | null) => setUserState(next), []);
  const clearSession = useCallback(() => {
    localStorage.removeItem("acadivo_access_token");
    sessionStorage.removeItem("acadivo:branch");
    setUserState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await authApi.getMe();
    const current = response.data as SessionUser;
    setUserState(previous => JSON.stringify(previous) === JSON.stringify(current) ? previous : current);
    return current;
  }, []);

  useEffect(() => {
    let active = true;
    const onExpired = () => clearSession();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "acadivo_access_token" && !event.newValue) clearSession();
    };
    window.addEventListener("acadivo:session-expired", onExpired);
    window.addEventListener("storage", onStorage);
    const token = localStorage.getItem("acadivo_access_token");
    if (!token) {
      setLoading(false);
      return () => {
        active = false;
        window.removeEventListener("acadivo:session-expired", onExpired);
        window.removeEventListener("storage", onStorage);
      };
    }
    void authApi.getMe().then((response) => {
      if (active) setUserState(response.data as SessionUser);
    }).catch(() => {
      if (active) clearSession();
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      window.removeEventListener("acadivo:session-expired", onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, [clearSession]);

  useEffect(() => {
    if (!user?.id) return;
    const update = () => { if (document.visibilityState === "visible") void refreshUser().catch((e: any) => { if (e.status === 403 && user.userType !== "SCHOOL_ADMIN") clearSession(); }); };
    window.addEventListener("focus", update);
    window.addEventListener("acadivo:subscription-restricted", update);
    const timer = window.setInterval(update, 60000);
    return () => { window.removeEventListener("focus", update); window.removeEventListener("acadivo:subscription-restricted", update); window.clearInterval(timer); };
  }, [user?.id, user?.userType, refreshUser, clearSession]);

  const value = useMemo(() => ({ user, loading, refreshUser, setUser, clearSession }), [user, loading, refreshUser, setUser, clearSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}


