import type { getWorkbookMediaConfig } from "@/features/workbook/model/api";
import type { WorkbookSessionKind } from "@/features/workbook/model/types";
import { ApiError } from "@/shared/api/client";
import { emitMediaMetric } from "@/shared/lib/mediaMonitoring";
import type { RoomConnectOptions, TrackPublishOptions, VideoCaptureOptions } from "livekit-client";

export type LivekitModule = typeof import("livekit-client");
type LivekitVideoPreset = LivekitModule["VideoPresets"][keyof LivekitModule["VideoPresets"]];
export type CameraFacingMode = "user" | "environment";

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
};

type LivekitVideoProfile = {
  capturePreset: LivekitVideoPreset | undefined;
  simulcastLayers: LivekitVideoPreset[];
  captureProfile: string;
  constrainedNetwork: boolean;
  mobileOrTablet: boolean;
  pixelDensity: number;
};

export type LivekitConnectFailureSummary = {
  errorName: string | null;
  errorMessage: string | null;
  errorReason: string | null;
  errorStatus: number | null;
  retryable: boolean;
  userMessage: string;
};

const isPresent = <T,>(value: T | null | undefined): value is T => value != null;

const isLikelyConstrainedNetwork = () => {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  const effectiveType = (connection.effectiveType ?? "").toLowerCase();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") return true;
  const downlink = Number(connection.downlink ?? Number.NaN);
  return Number.isFinite(downlink) && downlink > 0 && downlink < 2;
};

const resolveAdaptivePixelDensity = (isMobileOrTablet: boolean) => {
  if (typeof window === "undefined") return 1;
  const rawDevicePixelRatio = Number(window.devicePixelRatio ?? 1);
  const normalizedDevicePixelRatio =
    Number.isFinite(rawDevicePixelRatio) && rawDevicePixelRatio > 0 ? rawDevicePixelRatio : 1;
  return Math.max(1, Math.min(isMobileOrTablet ? 2 : 2.5, normalizedDevicePixelRatio));
};

export const resolveLivekitVideoProfile = (
  runtime: LivekitModule,
  mobileOrTablet: boolean
): LivekitVideoProfile => {
  const constrainedNetwork = isLikelyConstrainedNetwork();
  const capturePreset = constrainedNetwork
    ? runtime.VideoPresets.h540 ?? runtime.VideoPresets.h360
    : mobileOrTablet
      ? runtime.VideoPresets.h720 ?? runtime.VideoPresets.h540
      : runtime.VideoPresets.h1080 ?? runtime.VideoPresets.h720;
  const simulcastLayers = constrainedNetwork
    ? [runtime.VideoPresets.h360, runtime.VideoPresets.h216].filter(isPresent)
    : mobileOrTablet
      ? [runtime.VideoPresets.h360, runtime.VideoPresets.h180].filter(isPresent)
      : [runtime.VideoPresets.h720, runtime.VideoPresets.h360].filter(isPresent);
  return {
    capturePreset,
    simulcastLayers,
    captureProfile: constrainedNetwork ? "constrained" : mobileOrTablet ? "mobile" : "desktop",
    constrainedNetwork,
    mobileOrTablet,
    pixelDensity: constrainedNetwork ? 1 : resolveAdaptivePixelDensity(mobileOrTablet),
  };
};

export const buildCameraCaptureOptions = (
  profile: LivekitVideoProfile,
  facingMode: CameraFacingMode | null
): VideoCaptureOptions => ({
  ...(profile.capturePreset ? { resolution: profile.capturePreset.resolution } : {}),
  ...(facingMode ? { facingMode } : {}),
});

export const buildCameraPublishOptions = (profile: LivekitVideoProfile): TrackPublishOptions => ({
  videoEncoding: profile.capturePreset?.encoding,
  videoSimulcastLayers: profile.simulcastLayers.length > 0 ? profile.simulcastLayers : undefined,
});

export const buildLivekitConnectOptions = (
  iceServers: RTCIceServer[] | undefined
): RoomConnectOptions => ({
  autoSubscribe: true,
  ...(iceServers ? { rtcConfig: { iceServers } } : {}),
});

export const normalizeLivekitIceServers = (
  iceServers: Awaited<ReturnType<typeof getWorkbookMediaConfig>>["iceServers"] | undefined
): RTCIceServer[] | undefined => {
  if (!Array.isArray(iceServers)) return undefined;
  const normalized = iceServers.flatMap<RTCIceServer>((server) => {
    const urls = Array.isArray(server.urls)
      ? server.urls.filter((url) => typeof url === "string" && url.trim().length > 0)
      : typeof server.urls === "string" && server.urls.trim().length > 0
        ? server.urls
        : null;
    if (!urls || (Array.isArray(urls) && urls.length === 0)) return [];
    return [
      {
        urls,
        ...(typeof server.username === "string" && server.username ? { username: server.username } : {}),
        ...(typeof server.credential === "string" && server.credential ? { credential: server.credential } : {}),
      },
    ];
  });
  return normalized.length > 0 ? normalized : undefined;
};

export const hasRelayIceServer = (iceServers: RTCIceServer[] | undefined) =>
  Boolean(
    iceServers?.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some((url) => /^turns?:/i.test(url));
    })
  );

export const isLikelyMobileOrTabletDevice = () => {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent ?? "";
  if (/android|iphone|ipad|ipod|mobile|tablet/i.test(userAgent)) return true;
  return /mac/i.test(navigator.platform ?? "") && navigator.maxTouchPoints > 1;
};

export const isLocalSecureContext = () => {
  if (typeof window === "undefined") return true;
  if (window.isSecureContext) return true;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
};

export const summarizeLivekitConnectFailure = (reason: unknown): LivekitConnectFailureSummary => {
  if (reason instanceof Error && reason.message === "media_secure_context_required") {
    return {
      errorName: reason.name,
      errorMessage: reason.message,
      errorReason: "secure_context_required",
      errorStatus: null,
      retryable: false,
      userMessage: "Микрофон доступен только в защищённом режиме: откройте сайт по HTTPS (или localhost).",
    };
  }
  if (reason instanceof Error && reason.message === "livekit_token_invalid") {
    return {
      errorName: reason.name,
      errorMessage: reason.message,
      errorReason: "token_invalid",
      errorStatus: null,
      retryable: false,
      userMessage: "Сервер выдал некорректный LiveKit token. Проверьте media/livekit-token endpoint.",
    };
  }
  if (reason instanceof ApiError && reason.status === 503) {
    return {
      errorName: "ApiError",
      errorMessage: reason.message,
      errorReason: "livekit_unavailable",
      errorStatus: reason.status,
      retryable: false,
      userMessage: "LiveKit не настроен на сервере. Проверьте MEDIA_LIVEKIT_* переменные.",
    };
  }
  if (reason instanceof ApiError && reason.status >= 500) {
    return {
      errorName: "ApiError",
      errorMessage: reason.message,
      errorReason: "api_unavailable",
      errorStatus: reason.status,
      retryable: true,
      userMessage: "Сервис аудио временно недоступен. Повторите попытку подключения через несколько секунд.",
    };
  }

  const source =
    reason && typeof reason === "object"
      ? (reason as { name?: unknown; message?: unknown; reasonName?: unknown; reason?: unknown; status?: unknown })
      : null;
  const errorName = reason instanceof Error ? reason.name : typeof source?.name === "string" ? source.name : null;
  const errorMessage =
    reason instanceof Error ? reason.message : typeof source?.message === "string" ? source.message : null;
  const errorReason =
    typeof source?.reasonName === "string"
      ? source.reasonName
      : typeof source?.reason === "string"
        ? source.reason
        : null;
  const errorStatus = typeof source?.status === "number" ? source.status : null;
  const normalizedMessage = (errorMessage ?? "").toLowerCase();
  const retryable =
    errorReason === "ServerUnreachable" ||
    errorReason === "Timeout" ||
    errorReason === "WebSocket" ||
    errorReason === "InternalError" ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("unreachable") ||
    normalizedMessage.includes("websocket") ||
    normalizedMessage.includes("network");

  if (errorReason === "NotAllowed" || errorStatus === 401 || errorStatus === 403) {
    return {
      errorName,
      errorMessage,
      errorReason,
      errorStatus,
      retryable: false,
      userMessage: "Сервис аудио отклонил подключение. Проверьте LiveKit API key/secret и корректность токена.",
    };
  }
  if (errorReason === "ServiceNotFound" || errorStatus === 404) {
    return {
      errorName,
      errorMessage,
      errorReason,
      errorStatus,
      retryable: false,
      userMessage: "LiveKit недоступен на media-сервере. Проверьте прокси rtc.board.mathwise.ru и сам сервис LiveKit.",
    };
  }
  return {
    errorName,
    errorMessage,
    errorReason,
    errorStatus,
    retryable,
    userMessage: retryable
      ? "Сервис аудио временно недоступен. Повторите попытку подключения через несколько секунд."
      : "Не удалось подключить аудио-комнату LiveKit.",
  };
};

export const emitLivekitConnectionQualityMetric = (params: {
  sessionId: string;
  sessionKind?: WorkbookSessionKind;
  quality: unknown;
  participant: unknown;
}) => {
  const participant = params.participant as { identity?: unknown; sid?: unknown; isLocal?: unknown } | null;
  emitMediaMetric({
    scope: "workbook",
    subsystem: "livekit",
    phase: "connection_quality",
    sessionId: params.sessionId,
    sessionKind: params.sessionKind ?? null,
    timestamp: new Date().toISOString(),
    connectionQuality: typeof params.quality === "string" ? params.quality : String(params.quality ?? ""),
    participantIdentity:
      typeof participant?.identity === "string"
        ? participant.identity
        : typeof participant?.sid === "string"
          ? participant.sid
          : null,
    participantLocal: Boolean(participant?.isLocal),
  });
};

export const emitLivekitMediaDevicesErrorMetric = (params: {
  sessionId: string;
  sessionKind?: WorkbookSessionKind;
  error: unknown;
  kind: unknown;
}) => {
  emitMediaMetric({
    scope: "workbook",
    subsystem: "livekit",
    phase: "media_device_error",
    sessionId: params.sessionId,
    sessionKind: params.sessionKind ?? null,
    timestamp: new Date().toISOString(),
    trackKind: typeof params.kind === "string" ? params.kind : String(params.kind ?? ""),
    errorName: params.error instanceof Error ? params.error.name : null,
    errorMessage: params.error instanceof Error ? params.error.message : null,
  });
};
