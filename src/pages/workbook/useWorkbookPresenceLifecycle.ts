import { useEffect } from "react";
import {
  heartbeatWorkbookPresence,
  leaveWorkbookPresence,
} from "@/features/workbook/model/api";
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
    const presenceTabId = presenceTabIdRef.current;
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
    const heartbeat = async () => {
      try {
        const response = await heartbeatWorkbookPresence(sessionId, {
          state: resolvePresenceState(),
          tabId: presenceTabId,
        });
        if (!active) return;
        onHeartbeatParticipants(response.participants);
      } catch {
        // ignore transient presence errors
      }
    };
    void heartbeat();
    const onVisibilityOrFocusChange = () => {
      void heartbeat();
    };
    window.addEventListener("focus", onVisibilityOrFocusChange);
    window.addEventListener("blur", onVisibilityOrFocusChange);
    document.addEventListener("visibilitychange", onVisibilityOrFocusChange);
    const intervalId = window.setInterval(() => {
      void heartbeat();
    }, presenceIntervalMs);
    return () => {
      active = false;
      window.removeEventListener("focus", onVisibilityOrFocusChange);
      window.removeEventListener("blur", onVisibilityOrFocusChange);
      document.removeEventListener("visibilitychange", onVisibilityOrFocusChange);
      window.clearInterval(intervalId);
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
