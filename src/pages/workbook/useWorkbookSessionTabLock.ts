import { useEffect, useRef, type MutableRefObject } from "react";
import {
  isWorkbookTabLockStale,
  parseWorkbookTabLockRecord,
  type WorkbookTabLockRecord,
} from "./WorkbookSessionPage.core";

interface UseWorkbookSessionTabLockParams {
  sessionTabLockStorageKey: string;
  sessionTabLockChannelName: string;
  tabIdRef: MutableRefObject<string>;
  setActiveSessionTabId: (tabId: string | null) => void;
  setIsSessionTabPassive: (value: boolean | ((current: boolean) => boolean)) => void;
  onBecomePassive: () => void;
  heartbeatMs: number;
}

export function useWorkbookSessionTabLock({
  sessionTabLockStorageKey,
  sessionTabLockChannelName,
  tabIdRef,
  setActiveSessionTabId,
  setIsSessionTabPassive,
  onBecomePassive,
  heartbeatMs,
}: UseWorkbookSessionTabLockParams) {
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const claimTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      !sessionTabLockStorageKey ||
      !sessionTabLockChannelName ||
      typeof window === "undefined"
    ) {
      setIsSessionTabPassive(false);
      setActiveSessionTabId(null);
      return;
    }

    let effectActive = true;
    const tabId = tabIdRef.current;

    const readLock = () =>
      parseWorkbookTabLockRecord(window.localStorage.getItem(sessionTabLockStorageKey));

    const clearClaimTimer = () => {
      if (claimTimerRef.current === null) return;
      window.clearTimeout(claimTimerRef.current);
      claimTimerRef.current = null;
    };

    const postLockSignal = (type: "claim" | "release") => {
      broadcastChannelRef.current?.postMessage({
        type,
        tabId,
        timestamp: Date.now(),
      });
    };

    const claimLock = () => {
      if (!effectActive) return;
      const now = Date.now();
      const current = readLock();
      const nextLock: WorkbookTabLockRecord = {
        tabId,
        acquiredAt:
          current?.tabId === tabId && Number.isFinite(current.acquiredAt)
            ? current.acquiredAt
            : now,
        updatedAt: now,
      };
      try {
        window.localStorage.setItem(sessionTabLockStorageKey, JSON.stringify(nextLock));
      } catch {
        // ignore storage write failures in restricted environments
      }
      setActiveSessionTabId(tabId);
      setIsSessionTabPassive(false);
      postLockSignal("claim");
    };

    const scheduleClaim = (delayMs = 120) => {
      if (!effectActive || claimTimerRef.current !== null) return;
      claimTimerRef.current = window.setTimeout(() => {
        claimTimerRef.current = null;
        const current = readLock();
        if (!current || isWorkbookTabLockStale(current) || current.tabId === tabId) {
          claimLock();
        }
      }, delayMs + Math.floor(Math.random() * 140));
    };

    const applyLockState = (record: WorkbookTabLockRecord | null) => {
      if (!effectActive) return;
      if (isWorkbookTabLockStale(record)) {
        setActiveSessionTabId(null);
        setIsSessionTabPassive(false);
        scheduleClaim(80);
        return;
      }
      if (!record) return;
      setActiveSessionTabId(record.tabId);
      const shouldBePassive = record.tabId !== tabId;
      setIsSessionTabPassive((current) => {
        if (shouldBePassive && !current) {
          onBecomePassive();
        }
        return shouldBePassive;
      });
    };

    const releaseLockIfOwned = () => {
      const current = readLock();
      if (!current || current.tabId !== tabId) return;
      try {
        window.localStorage.removeItem(sessionTabLockStorageKey);
      } catch {
        // ignore storage remove failures in restricted environments
      }
      postLockSignal("release");
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== sessionTabLockStorageKey) return;
      applyLockState(parseWorkbookTabLockRecord(event.newValue));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      applyLockState(readLock());
    };

    const onPageHide = () => {
      releaseLockIfOwned();
    };

    if (typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel(sessionTabLockChannelName);
        broadcastChannelRef.current = channel;
        channel.onmessage = () => {
          applyLockState(readLock());
        };
      } catch {
        broadcastChannelRef.current = null;
      }
    }

    claimLock();
    heartbeatTimerRef.current = window.setInterval(() => {
      const current = readLock();
      if (!current || isWorkbookTabLockStale(current) || current.tabId === tabId) {
        claimLock();
        return;
      }
      applyLockState(current);
    }, heartbeatMs);

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      effectActive = false;
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      clearClaimTimer();
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
      releaseLockIfOwned();
    };
  }, [
    heartbeatMs,
    onBecomePassive,
    sessionTabLockChannelName,
    sessionTabLockStorageKey,
    setActiveSessionTabId,
    setIsSessionTabPassive,
    tabIdRef,
  ]);
}
