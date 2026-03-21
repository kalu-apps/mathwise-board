import { useEffect } from "react";
import {
  heartbeatWorkbookPresence,
  leaveWorkbookPresence,
} from "@/features/workbook/model/api";
import { ApiError } from "@/shared/api/client";
import type { WorkbookSessionParticipant } from "@/features/workbook/model/types";
import type { MutableRefObject } from "react";

interface UseWorkbookPresenceLifecycleParams {
  sessionId: string;
  userId?: string;
  isTeacherActor: boolean;
  presenceTabIdRef: MutableRefObject<string>;
  presenceLeaveSentRef: MutableRefObject<boolean>;
  onHeartbeatParticipants: (participants: WorkbookSessionParticipant[]) => void;
  presenceIntervalMs: number;
}

export function useWorkbookPresenceLifecycle({
  sessionId,
  userId,
  isTeacherActor,
  presenceTabIdRef,
  presenceLeaveSentRef,
  onHeartbeatParticipants,
  presenceIntervalMs,
}: UseWorkbookPresenceLifecycleParams) {
  useEffect(() => {
    if (!sessionId || !userId) return;
    let active = true;
    let heartbeatTimerId: number | null = null;
    let heartbeatInFlight = false;
    let heartbeatFailureStreak = 0;
    const presenceTabId = presenceTabIdRef.current;
    const clearHeartbeatTimer = () => {
      if (heartbeatTimerId === null) return;
      window.clearTimeout(heartbeatTimerId);
      heartbeatTimerId = null;
    };
    const scheduleHeartbeat = (delayMs: number) => {
      clearHeartbeatTimer();
      heartbeatTimerId = window.setTimeout(() => {
        void heartbeat("interval");
      }, delayMs);
    };
    const resolvePresenceState = () => {
      if (typeof document === "undefined" || typeof window === "undefined") {
        return "active" as const;
      }
      if (!isTeacherActor) {
        // Students should stay "present" while the tab is open to avoid noisy presence flicker.
        return "active" as const;
      }
      const hasFocus = typeof document.hasFocus === "function" ? document.hasFocus() : true;
      return document.visibilityState === "visible" && hasFocus ? "active" : "inactive";
    };
    const heartbeat = async (reason: "interval" | "interaction") => {
      if (!active || heartbeatInFlight) return;
      heartbeatInFlight = true;
      let nextDelayMs = presenceIntervalMs;
      try {
        const response = await heartbeatWorkbookPresence(sessionId, {
          state: resolvePresenceState(),
          tabId: presenceTabId,
        });
        if (!active) return;
        onHeartbeatParticipants(response.participants);
        heartbeatFailureStreak = 0;
        nextDelayMs = presenceIntervalMs;
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403 || error.status === 404)
        ) {
          heartbeatFailureStreak = 0;
          nextDelayMs = Math.max(15_000, Math.floor(presenceIntervalMs * 4));
        } else {
          heartbeatFailureStreak += 1;
          const outageMaxMs = Math.max(20_000, presenceIntervalMs * 12);
          const baseDelay = Math.max(1_000, presenceIntervalMs);
          nextDelayMs = Math.min(
            outageMaxMs,
            Math.floor(baseDelay * 1.7 ** Math.max(1, heartbeatFailureStreak))
          );
        }
      } finally {
        heartbeatInFlight = false;
        if (active) {
          const jitterBase = Math.min(nextDelayMs, 3_000);
          const jitter = Math.floor(jitterBase * 0.2 * Math.random());
          scheduleHeartbeat(
            reason === "interaction"
              ? Math.min(nextDelayMs, Math.max(500, Math.floor(nextDelayMs * 0.6))) + jitter
              : nextDelayMs + jitter
          );
        }
      }
    };
    const onVisibilityOrFocusChange = () => {
      void heartbeat("interaction");
    };
    window.addEventListener("focus", onVisibilityOrFocusChange);
    window.addEventListener("blur", onVisibilityOrFocusChange);
    document.addEventListener("visibilitychange", onVisibilityOrFocusChange);
    void heartbeat("interval");
    return () => {
      active = false;
      window.removeEventListener("focus", onVisibilityOrFocusChange);
      window.removeEventListener("blur", onVisibilityOrFocusChange);
      document.removeEventListener("visibilitychange", onVisibilityOrFocusChange);
      clearHeartbeatTimer();
    };
  }, [
    isTeacherActor,
    onHeartbeatParticipants,
    presenceIntervalMs,
    presenceTabIdRef,
    sessionId,
    userId,
  ]);

  useEffect(() => {
    if (!sessionId || !userId) return;
    presenceLeaveSentRef.current = false;
    const presenceTabId = presenceTabIdRef.current;
    const leaveUrl = `/api/workbook/sessions/${encodeURIComponent(sessionId)}/presence/leave`;
    const sendLeave = (reason: string) => {
      if (presenceLeaveSentRef.current) return;
      presenceLeaveSentRef.current = true;
      const payload = JSON.stringify({
        tabId: presenceTabId,
        reason,
      });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const beaconPayload = new Blob([payload], {
          type: "application/json",
        });
        navigator.sendBeacon(leaveUrl, beaconPayload);
        return;
      }
      void fetch(leaveUrl, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: payload,
      });
    };
    const onPageHide = () => {
      sendLeave("pagehide");
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      if (!presenceLeaveSentRef.current) {
        void leaveWorkbookPresence(sessionId, {
          tabId: presenceTabId,
          reason: "cleanup",
        }).catch(() => {
          // ignore leave errors
        });
      }
      presenceLeaveSentRef.current = false;
    };
  }, [presenceLeaveSentRef, presenceTabIdRef, sessionId, userId]);
}
