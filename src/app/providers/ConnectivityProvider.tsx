import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  APP_API_FAILURE_EVENT,
  APP_API_SUCCESS_EVENT,
  type ApiFailureEventDetail,
  type ApiSuccessEventDetail,
} from "@/shared/api/client";
import {
  ConnectivityContext,
  type ConnectivityStatus,
} from "./connectivityContext";
import {
  getRetryLastActionSnapshot,
  retryLastAction,
  subscribeRetryLastAction,
} from "@/shared/lib/retryLastAction";
import {
  flushOutboxQueue,
  getOutboxSnapshot,
  subscribeOutbox,
} from "@/shared/lib/outbox";

const HEALTHCHECK_TIMEOUT_MS = 12_000;
const AUTO_RECHECK_MS = 25_000;
const DEGRADED_FAILURE_THRESHOLD = 5;
const DEGRADED_RECOVERY_MIN_MS = 5_000;

const DEGRADE_CODES = new Set<ApiFailureEventDetail["code"]>([
  "timeout",
  "network_error",
  "server_unavailable",
  "circuit_open",
  "rate_limited",
]);

const isWorkbookRealtimePath = (path: string) =>
  path.startsWith("/workbook/sessions/") &&
  (path.includes("/events") ||
    path.includes("/presence") ||
    path.includes("/snapshot"));

const getInitialStatus = (): ConnectivityStatus => {
  if (typeof navigator === "undefined") return "online";
  return navigator.onLine ? "online" : "offline";
};

const isDocumentVisible = () => {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
};

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectivityStatus>(getInitialStatus);
  const [checking, setChecking] = useState(false);
  const [lastErrorCode, setLastErrorCode] = useState<
    ApiFailureEventDetail["code"] | null
  >(null);
  const [retrySnapshot, setRetrySnapshot] = useState(() =>
    getRetryLastActionSnapshot()
  );
  const [outboxSnapshot, setOutboxSnapshot] = useState(() => getOutboxSnapshot());
  const checkingRef = useRef(false);
  const consecutiveTransportFailuresRef = useRef(0);
  const statusRef = useRef<ConnectivityStatus>(getInitialStatus());
  const degradedSinceRef = useRef<number | null>(null);

  const markOnline = useCallback((force = false) => {
    setStatus((prev) => {
      if (prev === "online") return prev;
      if (
        !force &&
        prev === "degraded" &&
        degradedSinceRef.current &&
        Date.now() - degradedSinceRef.current < DEGRADED_RECOVERY_MIN_MS
      ) {
        return prev;
      }
      statusRef.current = "online";
      degradedSinceRef.current = null;
      return "online";
    });
  }, []);

  const markDegraded = useCallback(() => {
    setStatus((prev) => {
      if (prev === "offline" || prev === "degraded") return prev;
      statusRef.current = "degraded";
      if (!degradedSinceRef.current) {
        degradedSinceRef.current = Date.now();
      }
      return "degraded";
    });
  }, []);

  const markOffline = useCallback(() => {
    setStatus((prev) => {
      if (prev === "offline") return prev;
      statusRef.current = "offline";
      degradedSinceRef.current = null;
      return "offline";
    });
  }, []);

  const recheck = useCallback(async () => {
    if (checkingRef.current) return;
    if (typeof window === "undefined") return;

    checkingRef.current = true;
    setChecking(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      HEALTHCHECK_TIMEOUT_MS
    );

    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });

      if (response.status >= 500) {
        consecutiveTransportFailuresRef.current += 1;
        if (consecutiveTransportFailuresRef.current >= DEGRADED_FAILURE_THRESHOLD) {
          markDegraded();
        }
      } else {
        consecutiveTransportFailuresRef.current = 0;
        markOnline();
        setLastErrorCode(null);
      }
    } catch {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        consecutiveTransportFailuresRef.current = 0;
        markOffline();
        setLastErrorCode("network_offline");
      } else {
        consecutiveTransportFailuresRef.current += 1;
        if (consecutiveTransportFailuresRef.current >= DEGRADED_FAILURE_THRESHOLD) {
          markDegraded();
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
      checkingRef.current = false;
      setChecking(false);
    }
  }, [markDegraded, markOffline, markOnline]);

  useEffect(() => {
    setRetrySnapshot(getRetryLastActionSnapshot());
    return subscribeRetryLastAction(() => {
      setRetrySnapshot(getRetryLastActionSnapshot());
    });
  }, []);

  useEffect(() => {
    setOutboxSnapshot(getOutboxSnapshot());
    return subscribeOutbox(() => {
      setOutboxSnapshot(getOutboxSnapshot());
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleOnline = () => {
      consecutiveTransportFailuresRef.current = 0;
      markDegraded();
      void recheck();
      void flushOutboxQueue();
    };

    const handleOffline = () => {
      markOffline();
      setLastErrorCode("network_offline");
    };

    const handleApiFailure = (event: Event) => {
      const detail = (event as CustomEvent<ApiFailureEventDetail>).detail;
      if (!detail) return;
      if (isWorkbookRealtimePath(detail.path)) {
        return;
      }

      setLastErrorCode(detail.code);

      if (detail.code === "network_offline") {
        consecutiveTransportFailuresRef.current = 0;
        markOffline();
        return;
      }

      if (DEGRADE_CODES.has(detail.code)) {
        consecutiveTransportFailuresRef.current += 1;
        if (consecutiveTransportFailuresRef.current >= DEGRADED_FAILURE_THRESHOLD) {
          markDegraded();
        }
      }
    };

    const handleApiSuccess = (event: Event) => {
      const detail = (event as CustomEvent<ApiSuccessEventDetail>).detail;
      if (!detail) return;
      if (isWorkbookRealtimePath(detail.path)) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      consecutiveTransportFailuresRef.current = 0;
      markOnline();
      setLastErrorCode(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(APP_API_FAILURE_EVENT, handleApiFailure as EventListener);
    window.addEventListener(APP_API_SUCCESS_EVENT, handleApiSuccess as EventListener);

    if (navigator.onLine) {
      void recheck();
      void flushOutboxQueue();
    }

    const handleWakeup = () => {
      if (!navigator.onLine) return;
      if (!isDocumentVisible()) return;
      void recheck();
      void flushOutboxQueue();
    };
    window.addEventListener("focus", handleWakeup);
    document.addEventListener("visibilitychange", handleWakeup);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        APP_API_FAILURE_EVENT,
        handleApiFailure as EventListener
      );
      window.removeEventListener(
        APP_API_SUCCESS_EVENT,
        handleApiSuccess as EventListener
      );
      window.removeEventListener("focus", handleWakeup);
      document.removeEventListener("visibilitychange", handleWakeup);
    };
  }, [markDegraded, markOffline, markOnline, recheck]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (status === "online") return undefined;

    const intervalId = window.setInterval(() => {
      if (!isDocumentVisible()) return;
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void recheck();
        void flushOutboxQueue();
      }
    }, AUTO_RECHECK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status, recheck]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (outboxSnapshot.pendingCount <= 0) return undefined;
    if (outboxSnapshot.flushing) return undefined;
    if (!outboxSnapshot.nextRetryAt) return undefined;

    const retryAtMs = Date.parse(outboxSnapshot.nextRetryAt);
    if (!Number.isFinite(retryAtMs)) return undefined;

    const delayMs = Math.max(0, retryAtMs - Date.now());
    const timerId = window.setTimeout(() => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (!isDocumentVisible()) return;
      void flushOutboxQueue();
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    outboxSnapshot.pendingCount,
    outboxSnapshot.flushing,
    outboxSnapshot.nextRetryAt,
  ]);

  const contextValue = useMemo(
    () => ({
      status,
      isOnline: status === "online",
      checking,
      lastErrorCode,
      recheck,
      retryAvailable: Boolean(retrySnapshot),
      retryPending: Boolean(retrySnapshot?.pending),
      retryTitle: retrySnapshot?.title ?? null,
      retryLastAction: async () => {
        await retryLastAction();
      },
      outboxPendingCount: outboxSnapshot.pendingCount,
      outboxFlushing: outboxSnapshot.flushing,
      outboxRetryAt: outboxSnapshot.nextRetryAt,
      outboxRecoverableFailureCount: outboxSnapshot.recoverableFailureCount,
      flushOutbox: async () => {
        await flushOutboxQueue();
      },
    }),
    [status, checking, lastErrorCode, recheck, retrySnapshot, outboxSnapshot]
  );

  return (
    <ConnectivityContext.Provider value={contextValue}>
      {children}
    </ConnectivityContext.Provider>
  );
}
