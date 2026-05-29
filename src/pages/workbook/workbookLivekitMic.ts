import type { WorkbookSessionKind } from "@/features/workbook/model/types";
import { emitMediaMetric } from "@/shared/lib/mediaMonitoring";
import type { Dispatch, SetStateAction } from "react";
import type { Room as LivekitRoom } from "livekit-client";
import type { LivekitModule } from "./workbookLivekitRuntime";

type MutableRef<T> = {
  current: T;
};

const PERMANENT_MICROPHONE_ERROR_NAMES = new Set([
  "NotAllowedError",
  "NotFoundError",
  "NotReadableError",
  "SecurityError",
]);

const LIVEKIT_MIC_RETRY_DELAYS_MS = [500, 1_500, 3_500] as const;

export type WorkbookLivekitMicrophoneFailureSummary = {
  errorName: string | null;
  errorMessage: string | null;
  retryable: boolean;
};

export type WorkbookLivekitMicSyncOptions = {
  resetRetry?: boolean;
  reason?: string;
};

export const summarizeWorkbookLivekitMicrophoneFailure = (
  reason: unknown
): WorkbookLivekitMicrophoneFailureSummary => {
  const errorName =
    reason instanceof Error
      ? reason.name
      : reason && typeof reason === "object" && typeof (reason as { name?: unknown }).name === "string"
        ? (reason as { name: string }).name
        : null;
  const errorMessage =
    reason instanceof Error
      ? reason.message
      : reason && typeof reason === "object" && typeof (reason as { message?: unknown }).message === "string"
        ? (reason as { message: string }).message
        : null;
  if (errorName && PERMANENT_MICROPHONE_ERROR_NAMES.has(errorName)) {
    return {
      errorName,
      errorMessage,
      retryable: false,
    };
  }
  const normalizedMessage = (errorMessage ?? "").toLowerCase();
  const retryable =
    !errorName ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("websocket") ||
    normalizedMessage.includes("transport") ||
    normalizedMessage.includes("disconnected") ||
    normalizedMessage.includes("connection") ||
    normalizedMessage.includes("signal") ||
    normalizedMessage.includes("aborted");
  return {
    errorName,
    errorMessage,
    retryable,
  };
};

export const clearWorkbookLivekitMicRetryTimeout = (
  retryTimeoutRef: MutableRef<number | null>
) => {
  if (typeof window === "undefined") return;
  if (retryTimeoutRef.current === null) return;
  window.clearTimeout(retryTimeoutRef.current);
  retryTimeoutRef.current = null;
};

export const syncWorkbookLivekitMicrophoneState = async ({
  runtimeRef,
  roomRef,
  shouldBeConnectedRef,
  canUseMicrophoneRef,
  micEnabledRef,
  syncInFlightRef,
  syncPendingRef,
  retryTimeoutRef,
  retryAttemptRef,
  sessionId,
  sessionKind,
  setError,
  handleMicrophoneError,
  syncAgain,
  options,
}: {
  runtimeRef: MutableRef<LivekitModule | null>;
  roomRef: MutableRef<LivekitRoom | null>;
  shouldBeConnectedRef: MutableRef<boolean>;
  canUseMicrophoneRef: MutableRef<boolean>;
  micEnabledRef: MutableRef<boolean>;
  syncInFlightRef: MutableRef<Promise<void> | null>;
  syncPendingRef: MutableRef<boolean>;
  retryTimeoutRef: MutableRef<number | null>;
  retryAttemptRef: MutableRef<number>;
  sessionId: string;
  sessionKind?: WorkbookSessionKind;
  setError: Dispatch<SetStateAction<string | null>>;
  handleMicrophoneError: (reason: unknown) => void;
  syncAgain: (options?: WorkbookLivekitMicSyncOptions) => void;
  options?: WorkbookLivekitMicSyncOptions;
}) => {
  const clearRetryTimeout = () => clearWorkbookLivekitMicRetryTimeout(retryTimeoutRef);
  if (options?.resetRetry) {
    retryAttemptRef.current = 0;
    clearRetryTimeout();
  }
  if (syncInFlightRef.current) {
    syncPendingRef.current = true;
    return;
  }

  const task = (async () => {
    const runtime = runtimeRef.current;
    const room = roomRef.current;
    if (!runtime || !room || room.state !== runtime.ConnectionState.Connected) return;

    const shouldPublishMicrophone = Boolean(canUseMicrophoneRef.current && micEnabledRef.current);
    emitMediaMetric({
      scope: "workbook",
      subsystem: "livekit",
      phase: "mic_publish_start",
      sessionId,
      sessionKind: sessionKind ?? null,
      timestamp: new Date().toISOString(),
      targetEnabled: shouldPublishMicrophone,
    });

    try {
      await room.localParticipant.setMicrophoneEnabled(shouldPublishMicrophone);
      if (roomRef.current !== room) return;
      clearRetryTimeout();
      retryAttemptRef.current = 0;
      emitMediaMetric({
        scope: "workbook",
        subsystem: "livekit",
        phase: "mic_publish_success",
        sessionId,
        sessionKind: sessionKind ?? null,
        timestamp: new Date().toISOString(),
        targetEnabled: shouldPublishMicrophone,
      });
      if (shouldPublishMicrophone) {
        setError((current) => {
          if (!current) return current;
          return current.includes("микрофон") || current.includes("Микрофон") ? null : current;
        });
      }
    } catch (reason) {
      if (roomRef.current !== room) return;
      const failure = summarizeWorkbookLivekitMicrophoneFailure(reason);
      emitMediaMetric({
        scope: "workbook",
        subsystem: "livekit",
        phase: "mic_publish_failure",
        sessionId,
        sessionKind: sessionKind ?? null,
        timestamp: new Date().toISOString(),
        targetEnabled: shouldPublishMicrophone,
        errorName: failure.errorName,
        errorMessage: failure.errorMessage,
        errorReason: options?.reason ?? null,
      });

      const retryDelay =
        shouldPublishMicrophone && failure.retryable && shouldBeConnectedRef.current
          ? LIVEKIT_MIC_RETRY_DELAYS_MS[retryAttemptRef.current] ?? null
          : null;
      if (retryDelay !== null && typeof window !== "undefined") {
        retryAttemptRef.current += 1;
        clearRetryTimeout();
        emitMediaMetric({
          scope: "workbook",
          subsystem: "livekit",
          phase: "retry_scheduled",
          sessionId,
          sessionKind: sessionKind ?? null,
          timestamp: new Date().toISOString(),
          attempt: retryAttemptRef.current,
          retryInMs: retryDelay,
          errorName: failure.errorName,
          errorReason: "microphone_publish",
        });
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          if (!shouldBeConnectedRef.current) return;
          if (!canUseMicrophoneRef.current || !micEnabledRef.current) return;
          syncAgain({ reason: "retry" });
        }, retryDelay);
        return;
      }

      clearRetryTimeout();
      retryAttemptRef.current = 0;
      if (shouldPublishMicrophone) {
        handleMicrophoneError(reason);
      }
    }
  })();

  syncInFlightRef.current = task;
  await task.finally(() => {
    if (syncInFlightRef.current !== task) return;
    syncInFlightRef.current = null;
    if (!syncPendingRef.current) return;
    syncPendingRef.current = false;
    syncAgain({ reason: "pending" });
  });
};
