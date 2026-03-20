import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { User } from "@/entities/user/model/types";
import { readStorage, removeStorage, writeStorage } from "@/shared/lib/localDb";
import {
  AUTH_LOGOUT_BROADCAST_CHANNEL,
  AUTH_LOGOUT_SIGNAL_STORAGE_KEY,
  AUTH_LOGOUT_SIGNAL_TTL_MS,
  AUTH_GUEST_SESSION_KEY,
  AUTH_IDLE_ACTIVITY_KEY,
  AUTH_IDLE_ACTIVITY_THROTTLE_MS,
  AUTH_IDLE_TIMEOUT_MS,
  AUTH_STORAGE_KEY,
  AUTH_STORAGE_TTL_MS,
  TEACHER_LOGIN_HINT_EMAIL,
} from "./constants";
import { getAuthSession, logoutAuthSession, requestPasswordLogin } from "./api";
import { t } from "@/shared/i18n";

const BOARD_AUTO_LOGIN_EMAIL = import.meta.env.VITE_BOARD_AUTO_LOGIN_EMAIL?.trim().toLowerCase() ?? "";
const BOARD_AUTO_LOGIN_PASSWORD = import.meta.env.VITE_BOARD_AUTO_LOGIN_PASSWORD?.trim() ?? "";
const BOARD_AUTO_LOGIN_ENABLED = !import.meta.env.PROD &&
  String(import.meta.env.VITE_ENABLE_DEV_AUTO_LOGIN ?? "1").trim() === "1" &&
  BOARD_AUTO_LOGIN_EMAIL.length > 0 &&
  BOARD_AUTO_LOGIN_PASSWORD.length > 0;
const DISABLE_IDLE_AUTO_LOGOUT =
  import.meta.env.VITE_BOARD_MODE?.trim().toLowerCase() === "realtime" ||
  String(import.meta.env.VITE_WHITEBOARD_ONLY ?? "").trim() === "1";

type AuthLogoutSignal = {
  type: "logout";
  at: number;
};

const readIdleActivityTimestamp = () => {
  if (typeof localStorage === "undefined") return null;
  try {
    const rawValue = localStorage.getItem(AUTH_IDLE_ACTIVITY_KEY);
    if (!rawValue) return null;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const writeIdleActivityTimestamp = (timestamp: number) => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(AUTH_IDLE_ACTIVITY_KEY, String(timestamp));
  } catch {
    // ignore storage errors
  }
};

const clearIdleActivityTimestamp = () => {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(AUTH_IDLE_ACTIVITY_KEY);
  } catch {
    // ignore storage errors
  }
};

const isGuestUser = (user: User | null | undefined) => {
  if (!user || user.role !== "student") return false;
  if (user.id.startsWith("guest_")) return true;
  const normalizedEmail = user.email.trim().toLowerCase();
  return normalizedEmail.startsWith("guest_") && normalizedEmail.endsWith("@axiom.demo");
};

const normalizeLogoutSignal = (raw: unknown): AuthLogoutSignal | null => {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as { type?: unknown; at?: unknown };
  if (source.type !== "logout") return null;
  if (typeof source.at !== "number" || !Number.isFinite(source.at) || source.at <= 0) {
    return null;
  }
  return {
    type: "logout",
    at: Math.floor(source.at),
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>(AUTH_STORAGE_KEY, null));
  const [isGuestSession, setGuestSession] = useState<boolean>(() => readStorage<boolean>(AUTH_GUEST_SESSION_KEY, false));
  const [isAuthReady, setAuthReady] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authModalEmail, setAuthModalEmail] = useState(TEACHER_LOGIN_HINT_EMAIL);

  const idleTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number | null>(null);
  const lastPersistedActivityRef = useRef<number>(0);
  const autoLogoutInProgressRef = useRef(false);
  const autoLoginStartedRef = useRef(false);
  const logoutBroadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastLogoutSignalAtRef = useRef(0);

  const applyLoggedOutState = useCallback((options?: { openAuthModal?: boolean }) => {
    setUser(null);
    setGuestSession(false);
    removeStorage(AUTH_STORAGE_KEY);
    removeStorage(AUTH_GUEST_SESSION_KEY);
    clearIdleActivityTimestamp();
    setAuthModalEmail("");
    if (options?.openAuthModal !== false) {
      setAuthModalOpen(true);
    }
  }, []);

  const emitLogoutSignal = useCallback(() => {
    const signal: AuthLogoutSignal = {
      type: "logout",
      at: Date.now(),
    };
    lastLogoutSignalAtRef.current = Math.max(lastLogoutSignalAtRef.current, signal.at);
    try {
      logoutBroadcastChannelRef.current?.postMessage(signal);
    } catch {
      // ignore BroadcastChannel delivery errors
    }
    writeStorage(AUTH_LOGOUT_SIGNAL_STORAGE_KEY, signal, {
      ttlMs: AUTH_LOGOUT_SIGNAL_TTL_MS,
    });
  }, []);

  const applyLogoutSignal = useCallback(
    (rawSignal: unknown) => {
      const normalized = normalizeLogoutSignal(rawSignal);
      if (!normalized) return;
      if (normalized.at <= lastLogoutSignalAtRef.current) return;
      lastLogoutSignalAtRef.current = normalized.at;
      applyLoggedOutState({ openAuthModal: true });
    },
    [applyLoggedOutState]
  );

  const syncSession = useCallback(async () => {
    try {
      const sessionUser = await getAuthSession();
      setUser(sessionUser);
      if (sessionUser) {
        const nextGuestSession = isGuestUser(sessionUser);
        setGuestSession(nextGuestSession);
        writeStorage(AUTH_STORAGE_KEY, sessionUser, { ttlMs: AUTH_STORAGE_TTL_MS });
        if (nextGuestSession) {
          writeStorage(AUTH_GUEST_SESSION_KEY, true, { ttlMs: AUTH_STORAGE_TTL_MS });
        } else {
          removeStorage(AUTH_GUEST_SESSION_KEY);
        }
      } else {
        setGuestSession(false);
        removeStorage(AUTH_STORAGE_KEY);
        removeStorage(AUTH_GUEST_SESSION_KEY);
      }
    } catch {
      setUser(null);
      setGuestSession(false);
      removeStorage(AUTH_STORAGE_KEY);
      removeStorage(AUTH_GUEST_SESSION_KEY);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      const channel = new BroadcastChannel(AUTH_LOGOUT_BROADCAST_CHANNEL);
      logoutBroadcastChannelRef.current = channel;
      channel.onmessage = (event) => {
        applyLogoutSignal(event.data);
      };
      return () => {
        channel.close();
        if (logoutBroadcastChannelRef.current === channel) {
          logoutBroadcastChannelRef.current = null;
        }
      };
    } catch {
      logoutBroadcastChannelRef.current = null;
      return;
    }
  }, [applyLogoutSignal]);

  useEffect(() => {
    if (!BOARD_AUTO_LOGIN_ENABLED) return;
    if (!isAuthReady || user) return;
    if (autoLoginStartedRef.current) return;
    autoLoginStartedRef.current = true;
    let cancelled = false;

    const autoLogin = async () => {
      try {
        const safeUser = await requestPasswordLogin(
          BOARD_AUTO_LOGIN_EMAIL,
          BOARD_AUTO_LOGIN_PASSWORD
        );
        if (cancelled) return;
        setUser(safeUser);
        writeStorage(AUTH_STORAGE_KEY, safeUser, { ttlMs: AUTH_STORAGE_TTL_MS });
      } catch {
        if (cancelled) return;
        autoLoginStartedRef.current = false;
      }
    };

    void autoLogin();
    return () => {
      cancelled = true;
    };
  }, [isAuthReady, user]);

  const logout = useCallback(() => {
    applyLoggedOutState({ openAuthModal: true });
    emitLogoutSignal();
    void logoutAuthSession();
  }, [applyLoggedOutState, emitLogoutSignal]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (DISABLE_IDLE_AUTO_LOGOUT) return;

    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    if (!user) {
      clearIdleTimer();
      lastActivityRef.current = null;
      lastPersistedActivityRef.current = 0;
      autoLogoutInProgressRef.current = false;
      return;
    }

    const triggerAutoLogout = () => {
      if (autoLogoutInProgressRef.current) return;
      autoLogoutInProgressRef.current = true;
      logout();
    };

    const resolveLastActivityTimestamp = () => {
      const storedTimestamp = readIdleActivityTimestamp();
      if (
        storedTimestamp &&
        (!lastActivityRef.current || storedTimestamp > lastActivityRef.current)
      ) {
        lastActivityRef.current = storedTimestamp;
      }
      return lastActivityRef.current ?? storedTimestamp ?? Date.now();
    };

    const hasExceededIdleTimeout = () =>
      Date.now() - resolveLastActivityTimestamp() >= AUTH_IDLE_TIMEOUT_MS;

    const scheduleIdleLogout = () => {
      clearIdleTimer();
      const lastActivityTs = resolveLastActivityTimestamp();
      const elapsedMs = Date.now() - lastActivityTs;
      const remainingMs = AUTH_IDLE_TIMEOUT_MS - elapsedMs;
      if (remainingMs <= 0) {
        triggerAutoLogout();
        return;
      }
      idleTimerRef.current = window.setTimeout(triggerAutoLogout, remainingMs);
    };

    const persistActivity = (timestamp: number, force = false) => {
      if (
        !force &&
        timestamp - lastPersistedActivityRef.current < AUTH_IDLE_ACTIVITY_THROTTLE_MS
      ) {
        return;
      }
      writeIdleActivityTimestamp(timestamp);
      lastPersistedActivityRef.current = timestamp;
    };

    const markActivity = (forcePersist = false) => {
      if (hasExceededIdleTimeout()) {
        triggerAutoLogout();
        return;
      }
      const timestamp = Date.now();
      lastActivityRef.current = timestamp;
      persistActivity(timestamp, forcePersist);
      scheduleIdleLogout();
    };

    if (hasExceededIdleTimeout()) {
      triggerAutoLogout();
      return;
    }

    lastActivityRef.current = resolveLastActivityTimestamp();
    persistActivity(lastActivityRef.current, true);
    scheduleIdleLogout();

    const onActivity = () => markActivity(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (hasExceededIdleTimeout()) {
          triggerAutoLogout();
          return;
        }
        markActivity(true);
      }
    };
    const onWindowFocus = () => {
      if (hasExceededIdleTimeout()) {
        triggerAutoLogout();
        return;
      }
      markActivity(true);
    };
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === AUTH_IDLE_ACTIVITY_KEY) {
        const externalTimestamp = readIdleActivityTimestamp();
        if (!externalTimestamp) return;
        lastActivityRef.current = externalTimestamp;
        scheduleIdleLogout();
        return;
      }
      if (event.key === AUTH_LOGOUT_SIGNAL_STORAGE_KEY && event.newValue !== null) {
        const signal = readStorage<AuthLogoutSignal | null>(
          AUTH_LOGOUT_SIGNAL_STORAGE_KEY,
          null
        );
        applyLogoutSignal(signal);
        return;
      }
      if (event.key === AUTH_STORAGE_KEY && event.newValue === null) {
        clearIdleTimer();
        applyLoggedOutState({ openAuthModal: true });
        return;
      }
      if (event.key === AUTH_GUEST_SESSION_KEY) {
        const nextGuestValue = readStorage<boolean>(AUTH_GUEST_SESSION_KEY, false);
        setGuestSession(Boolean(nextGuestValue));
      }
    };

    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("wheel", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("storage", onStorageChange);

    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("storage", onStorageChange);
      clearIdleTimer();
    };
  }, [applyLoggedOutState, applyLogoutSignal, logout, user]);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.normalize("NFKC").trim();
    if (!normalizedEmail || !normalizedPassword) {
      return { ok: false as const, error: t("auth.passwordRequired") };
    }

    try {
      const safeUser = await requestPasswordLogin(normalizedEmail, normalizedPassword);
      setUser(safeUser);
      setGuestSession(false);
      writeStorage(AUTH_STORAGE_KEY, safeUser, { ttlMs: AUTH_STORAGE_TTL_MS });
      removeStorage(AUTH_GUEST_SESSION_KEY);
      setAuthModalOpen(false);
      return { ok: true as const };
    } catch (error) {
      await syncSession();
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : t("auth.passwordLoginFailed"),
      };
    }
  }, [syncSession]);

  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser);
    const nextGuestSession = isGuestUser(nextUser);
    setGuestSession(nextGuestSession);
    writeStorage(AUTH_STORAGE_KEY, nextUser, { ttlMs: AUTH_STORAGE_TTL_MS });
    if (nextGuestSession) {
      writeStorage(AUTH_GUEST_SESSION_KEY, true, { ttlMs: AUTH_STORAGE_TTL_MS });
    } else {
      removeStorage(AUTH_GUEST_SESSION_KEY);
    }
  }, []);

  const openAuthModal = useCallback((initialEmail?: string) => {
    setAuthModalEmail((initialEmail ?? TEACHER_LOGIN_HINT_EMAIL).trim().toLowerCase());
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isGuestSession,
        isAuthReady,
        loginWithPassword,
        updateUser,
        logout,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
