import { api, ApiError, isRecoverableApiError } from "@/shared/api/client";
import { buildApiUrl } from "@/shared/api/base";
import { generateId } from "@/shared/lib/id";
import type { User } from "@/entities/user/model/types";
import type { WorkbookClientEventInput } from "./events";
import {
  enqueueWorkbookEventsPersistence,
  enqueueWorkbookSnapshotPersistence,
  flushWorkbookPersistenceQueue,
} from "./persistenceQueue";
import type {
  WorkbookDraftCard,
  WorkbookEvent,
  WorkbookEventsResponse,
  WorkbookInviteInfo,
  WorkbookLayer,
  WorkbookLivekitTokenResponse,
  WorkbookMediaConfig,
  WorkbookSessionSettings,
  WorkbookSession,
  WorkbookSessionKind,
  WorkbookSnapshot,
  WorkbookStroke,
} from "./types";

const buildWorkbookWebSocketUrl = (pathname: string) => {
  if (typeof window === "undefined") return null;
  const url = new URL(buildApiUrl(pathname), window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

export async function getWorkbookDrafts(scope: "all" | "personal" | "class" = "all") {
  const query = new URLSearchParams({ scope }).toString();
  return api.get<{ items: WorkbookDraftCard[] }>(`/workbook/drafts?${query}`, {
    cacheTtlMs: 1_000,
    staleIfErrorMs: 0,
  });
}

export async function createWorkbookSession(params: {
  kind: WorkbookSessionKind;
  title?: string;
}) {
  return api.post<{
    session: WorkbookSession;
    draft: WorkbookDraftCard;
  }>("/workbook/sessions", params);
}

export async function getWorkbookSession(sessionId: string) {
  return api.get<WorkbookSession>(`/workbook/sessions/${encodeURIComponent(sessionId)}`, {
    cacheTtlMs: 600,
  });
}

export async function openWorkbookSession(sessionId: string) {
  return api.post<{ ok: true }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/open`,
    {},
    { notifyDataUpdate: true }
  );
}

export async function endWorkbookSession(sessionId: string) {
  return api.post<{ ok: true; session: WorkbookSession }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/end`,
    {},
    { notifyDataUpdate: true }
  );
}

export async function updateWorkbookSessionSettings(
  sessionId: string,
  payload: Partial<WorkbookSessionSettings>
) {
  return api.put<{ ok: true; session: WorkbookSession }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/settings`,
    payload,
    { notifyDataUpdate: false }
  );
}

export async function duplicateWorkbookSession(sessionId: string) {
  return api.post<{
    session: WorkbookSession;
    draft: WorkbookDraftCard;
  }>(`/workbook/sessions/${encodeURIComponent(sessionId)}/duplicate`, {});
}

export async function deleteWorkbookSession(sessionId: string) {
  return api.del<{
    ok: true;
    deletedSessionId: string;
    message: string;
  }>(`/workbook/sessions/${encodeURIComponent(sessionId)}`, {
    notifyDataUpdate: true,
  });
}

export async function renameWorkbookSession(sessionId: string, title: string) {
  return api.put<{ ok: true; session: WorkbookSession }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/title`,
    { title },
    { notifyDataUpdate: true }
  );
}

export async function createWorkbookInvite(sessionId: string) {
  return api.post<WorkbookInviteInfo>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/invite`,
    {}
  );
}

export async function resolveWorkbookInvite(token: string) {
  return api.get<{
    sessionId: string;
    title: string;
    kind: WorkbookSessionKind;
    hostName: string;
    ended: boolean;
    expired: boolean;
    revoked: boolean;
  }>(`/workbook/invites/${encodeURIComponent(token)}`);
}

export async function joinWorkbookInvite(token: string, guestName?: string) {
  return api.post<{
    session: WorkbookSession;
    draft: WorkbookDraftCard;
    user?: User;
  }>(
    `/workbook/invites/${encodeURIComponent(token)}/join`,
    typeof guestName === "string" ? { guestName } : {}
  );
}

export async function getWorkbookEvents(sessionId: string, afterSeq: number) {
  const query = new URLSearchParams({ afterSeq: String(afterSeq) }).toString();
  return api.get<WorkbookEventsResponse>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/events?${query}`,
    {
      cacheTtlMs: 0,
      dedupe: false,
    }
  );
}

export async function getWorkbookMediaConfig(sessionId: string) {
  return api.get<WorkbookMediaConfig>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/media/config`,
    {
      cacheTtlMs: 0,
      dedupe: false,
    }
  );
}

export async function getWorkbookLivekitToken(sessionId: string) {
  return api.get<WorkbookLivekitTokenResponse>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/media/livekit-token`,
    {
      cacheTtlMs: 0,
      dedupe: false,
    }
  );
}

export function subscribeWorkbookEventsStream(params: {
  sessionId: string;
  onEvents: (payload: WorkbookEventsResponse) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Event) => void;
}) {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {
      // noop
    };
  }
  const source = new EventSource(
    buildApiUrl(`/workbook/sessions/${encodeURIComponent(params.sessionId)}/events/stream`),
    { withCredentials: true }
  );

  const handlePayload = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const payload = raw as Partial<WorkbookEventsResponse>;
    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.latestSeq !== "number" ||
      !Array.isArray(payload.events)
    ) {
      return;
    }
    params.onEvents({
      sessionId: payload.sessionId,
      latestSeq: payload.latestSeq,
      events: payload.events as WorkbookEvent[],
    });
  };

  source.addEventListener("workbook", (event) => {
    if (!(event instanceof MessageEvent)) return;
    try {
      handlePayload(JSON.parse(String(event.data ?? "{}")));
    } catch {
      // ignore malformed stream payload
    }
  });

  source.onopen = () => {
    params.onConnectionChange?.(true);
  };

  source.onerror = (error) => {
    params.onConnectionChange?.(false);
    params.onError?.(error);
  };

  return () => {
    params.onConnectionChange?.(false);
    source.close();
  };
}

export function subscribeWorkbookLiveSocket(params: {
  sessionId: string;
  onEvents: (payload: WorkbookEventsResponse) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Event | EventTarget | null) => void;
}) {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") {
    return {
      sendEvents: () => false,
      close: () => {
        params.onConnectionChange?.(false);
      },
    };
  }
  const socketUrl = buildWorkbookWebSocketUrl(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/events/live`
  );
  if (!socketUrl) {
    return {
      sendEvents: () => false,
      close: () => {
        params.onConnectionChange?.(false);
      },
    };
  }
  let closed = false;
  let reconnectTimer: number | null = null;
  let socket: WebSocket | null = null;
  let reconnectAttempt = 0;
  let fastFailureCount = 0;
  let fastFailureWindowStartedAt = 0;
  let reconnectCooldownUntil = 0;
  const FAST_FAILURE_WINDOW_MS = 15_000;
  const FAST_FAILURE_CONNECT_MAX_MS = 1_200;
  const FAST_FAILURE_THRESHOLD = 6;
  const RECONNECT_COOLDOWN_MS = 20_000;

  const handlePayload = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const payload = raw as Partial<WorkbookEventsResponse>;
    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.latestSeq !== "number" ||
      !Array.isArray(payload.events)
    ) {
      return;
    }
    params.onEvents({
      sessionId: payload.sessionId,
      latestSeq: payload.latestSeq,
      events: payload.events as WorkbookEvent[],
    });
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer === null) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const resetFastFailureWindow = () => {
    fastFailureCount = 0;
    fastFailureWindowStartedAt = 0;
    reconnectCooldownUntil = 0;
  };

  const noteFastFailure = () => {
    const now = Date.now();
    if (
      fastFailureWindowStartedAt === 0 ||
      now - fastFailureWindowStartedAt > FAST_FAILURE_WINDOW_MS
    ) {
      fastFailureWindowStartedAt = now;
      fastFailureCount = 0;
    }
    fastFailureCount += 1;
    if (fastFailureCount < FAST_FAILURE_THRESHOLD) return;
    reconnectCooldownUntil = now + RECONNECT_COOLDOWN_MS;
    fastFailureCount = 0;
    fastFailureWindowStartedAt = now;
    params.onError?.(new Event("workbook_live_socket_cooldown"));
  };

  const scheduleReconnect = () => {
    if (closed || reconnectTimer !== null) return;
    const now = Date.now();
    const backoffDelay = Math.min(6_000, 250 * 2 ** reconnectAttempt);
    const cooldownDelay =
      reconnectCooldownUntil > now ? reconnectCooldownUntil - now : 0;
    const delay = Math.max(backoffDelay, cooldownDelay);
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connectSocket();
    }, delay);
  };

  const connectSocket = () => {
    if (closed) return;
    clearReconnectTimer();
    const connectedStartedAt = Date.now();
    let wasOpened = false;
    const nextSocket = new WebSocket(socketUrl);
    socket = nextSocket;

    nextSocket.onopen = () => {
      wasOpened = true;
      reconnectAttempt = 0;
      resetFastFailureWindow();
      params.onConnectionChange?.(true);
    };

    nextSocket.onmessage = (event) => {
      try {
        handlePayload(JSON.parse(String(event.data ?? "{}")));
      } catch {
        // ignore malformed live payloads
      }
    };

    nextSocket.onerror = (error) => {
      params.onError?.(error);
    };

    nextSocket.onclose = () => {
      if (socket === nextSocket) {
        socket = null;
      }
      if (!wasOpened && Date.now() - connectedStartedAt <= FAST_FAILURE_CONNECT_MAX_MS) {
        noteFastFailure();
      }
      params.onConnectionChange?.(false);
      scheduleReconnect();
    };
  };

  connectSocket();

  return {
    sendEvents: (
      events: WorkbookClientEventInput[]
    ) => {
      if (
        closed ||
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        events.length === 0
      ) {
        return false;
      }
      try {
        socket.send(JSON.stringify({ events }));
        return true;
      } catch {
        return false;
      }
    },
    close: () => {
      if (closed) return;
      closed = true;
      clearReconnectTimer();
      resetFastFailureWindow();
      params.onConnectionChange?.(false);
      socket?.close();
      socket = null;
    },
  };
}

export async function appendWorkbookEvents(params: {
  sessionId: string;
  events: WorkbookClientEventInput[];
}) {
  const idempotencyKey = `event-${generateId()}`;
  try {
    const response = await api.post<{ events: WorkbookEvent[]; latestSeq: number }>(
      `/workbook/sessions/${encodeURIComponent(params.sessionId)}/events`,
      { events: params.events },
      {
        notifyDataUpdate: false,
        idempotencyKey,
        idempotencyPrefix: "workbook-events",
      }
    );
    void flushWorkbookPersistenceQueue();
    return response;
  } catch (error) {
    if (isRecoverableApiError(error)) {
      enqueueWorkbookEventsPersistence({
        sessionId: params.sessionId,
        events: params.events,
        idempotencyKey,
      });
    }
    throw error;
  }
}

export async function appendWorkbookLiveEvents(params: {
  sessionId: string;
  events: WorkbookClientEventInput[];
}) {
  return api.post<{ ok: true }>(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/events/live`,
    { events: params.events },
    { notifyDataUpdate: false }
  );
}

export async function appendWorkbookPreview(params: {
  sessionId: string;
  objectId: string;
  patch: Partial<Record<string, unknown>>;
  previewVersion?: number;
}) {
  return api.post<{ ok: true }>(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/events/preview`,
    {
      objectId: params.objectId,
      patch: params.patch,
      previewVersion:
        typeof params.previewVersion === "number" && Number.isFinite(params.previewVersion)
          ? Math.max(1, Math.trunc(params.previewVersion))
          : undefined,
    },
    { notifyDataUpdate: false }
  );
}

export async function appendWorkbookStrokePreview(params: {
  sessionId: string;
  stroke: WorkbookStroke;
  previewVersion?: number;
}) {
  return api.post<{ ok: true }>(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/events/preview`,
    {
      type:
        params.stroke.layer === "annotations"
          ? ("annotations.stroke.preview" as const)
          : ("board.stroke.preview" as const),
      stroke: params.stroke,
      previewVersion:
        typeof params.previewVersion === "number" && Number.isFinite(params.previewVersion)
          ? Math.max(1, Math.trunc(params.previewVersion))
          : undefined,
    },
    { notifyDataUpdate: false }
  );
}

export async function getWorkbookSnapshot(sessionId: string, layer: WorkbookLayer) {
  const query = new URLSearchParams({ layer }).toString();
  return api.get<WorkbookSnapshot | null>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/snapshot?${query}`,
    {
      cacheTtlMs: 0,
      dedupe: false,
    }
  );
}

export async function saveWorkbookSnapshot(params: {
  sessionId: string;
  layer: WorkbookLayer;
  version: number;
  payload: unknown;
}) {
  const normalizedVersion = Number.isFinite(params.version)
    ? Math.max(1, Math.trunc(params.version))
    : 1;
  const requestPayload = {
    ...params,
    version: normalizedVersion,
  };
  const idempotencyKey = `snapshot-${params.sessionId}-${params.layer}-v${normalizedVersion}-${generateId()}`;
  try {
    const response = await api.put<WorkbookSnapshot>(
      `/workbook/sessions/${encodeURIComponent(params.sessionId)}/snapshot`,
      requestPayload,
      {
        notifyDataUpdate: false,
        idempotencyKey,
        idempotencyPrefix: "workbook-snapshot",
        timeoutMs: 45_000,
      }
    );
    void flushWorkbookPersistenceQueue();
    return response;
  } catch (error) {
    if (isRecoverableApiError(error)) {
      enqueueWorkbookSnapshotPersistence({
        ...params,
        idempotencyKey,
      });
    }
    throw error;
  }
}

type WorkbookPresenceState = "active" | "inactive";

type WorkbookPresencePayload = {
  tabId?: string;
  state?: WorkbookPresenceState;
  reason?: string;
};

export async function heartbeatWorkbookPresence(
  sessionId: string,
  payload?: WorkbookPresencePayload
) {
  return api.post<{ ok: true; participants: WorkbookSession["participants"] }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/presence`,
    payload ?? {},
    { notifyDataUpdate: false }
  );
}

export async function leaveWorkbookPresence(sessionId: string, payload?: WorkbookPresencePayload) {
  return api.post<{ ok: true; participants: WorkbookSession["participants"] }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/presence/leave`,
    payload ?? {},
    { notifyDataUpdate: false }
  );
}

export async function renderWorkbookPdfPages(params: {
  fileName: string;
  sourceId?: string;
  dataUrl?: string;
  file?: File;
  dpi?: number;
  imageFormat?: "png" | "jpeg";
  jpegQuality?: number;
  maxPages?: number;
  pageFrom?: number;
  pageTo?: number;
}) {
  if (typeof params.sourceId === "string" && params.sourceId.trim().length > 0) {
    return api.post<{
      renderer: "poppler" | "unavailable";
      fileName: string;
      sourceId?: string | null;
      pages: Array<{
        id: string;
        page: number;
        imageUrl: string;
        width?: number;
        height?: number;
      }>;
    }>(
      "/workbook/pdf/render",
      {
        fileName: params.fileName,
        sourceId: params.sourceId,
        dpi: params.dpi,
        imageFormat: params.imageFormat,
        jpegQuality: params.jpegQuality,
        maxPages: params.maxPages,
        pageFrom: params.pageFrom,
        pageTo: params.pageTo,
      },
      { notifyDataUpdate: false, timeoutMs: 90_000 }
    );
  }
  if (params.file instanceof File) {
    return postWorkbookPdfBinary<{
      renderer: "poppler" | "unavailable";
      fileName: string;
      sourceId?: string | null;
      pages: Array<{
        id: string;
        page: number;
        imageUrl: string;
        width?: number;
        height?: number;
      }>;
    }>("/workbook/pdf/render", {
      file: params.file,
      timeoutMs: 90_000,
      query: {
        fileName: params.fileName,
        dpi: params.dpi,
        imageFormat: params.imageFormat,
        jpegQuality: params.jpegQuality,
        maxPages: params.maxPages,
        pageFrom: params.pageFrom,
        pageTo: params.pageTo,
      },
    });
  }
  return api.post<{
    renderer: "poppler" | "unavailable";
    fileName: string;
    pages: Array<{
      id: string;
      page: number;
      imageUrl: string;
      width?: number;
      height?: number;
    }>;
  }>("/workbook/pdf/render", params, { notifyDataUpdate: false, timeoutMs: 90_000 });
}

export async function inspectWorkbookPdf(params: {
  fileName: string;
  sourceId?: string;
  dataUrl?: string;
  file?: File;
}) {
  if (typeof params.sourceId === "string" && params.sourceId.trim().length > 0) {
    return api.post<{
      fileName: string;
      sourceId?: string | null;
      pageCount: number;
    }>(
      "/workbook/pdf/inspect",
      {
        fileName: params.fileName,
        sourceId: params.sourceId,
      },
      { notifyDataUpdate: false, timeoutMs: 45_000 }
    );
  }
  if (params.file instanceof File) {
    return postWorkbookPdfBinary<{
      fileName: string;
      sourceId?: string | null;
      pageCount: number;
    }>("/workbook/pdf/inspect", {
      file: params.file,
      timeoutMs: 45_000,
      query: {
        fileName: params.fileName,
      },
    });
  }
  return api.post<{
    fileName: string;
    pageCount: number;
  }>("/workbook/pdf/inspect", params, { notifyDataUpdate: false, timeoutMs: 45_000 });
}

export async function createWorkbookPdfSource(params: { fileName: string; file: File }) {
  return postWorkbookPdfBinary<{
    sourceId: string;
    fileName: string;
    sizeBytes: number;
    createdAt: string;
    expiresAt: string;
  }>("/workbook/pdf/source", {
    file: params.file,
    timeoutMs: 90_000,
    query: {
      fileName: params.fileName,
    },
  });
}

export async function uploadWorkbookAsset(params: {
  sessionId: string;
  fileName: string;
  dataUrl: string;
  mimeType?: string;
}) {
  return api.post<{
    assetId: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
  }>(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/assets`,
    {
      fileName: params.fileName,
      dataUrl: params.dataUrl,
      mimeType: params.mimeType,
    },
    { notifyDataUpdate: false, timeoutMs: 60_000 }
  );
}

export async function uploadWorkbookAssetFile(params: {
  sessionId: string;
  fileName: string;
  file: File;
  mimeType?: string;
  timeoutMs?: number;
}) {
  const query = new URLSearchParams();
  query.set("fileName", params.fileName);
  if (typeof params.mimeType === "string" && params.mimeType.trim().length > 0) {
    query.set("mimeType", params.mimeType);
  }
  const response = await fetch(
    buildApiUrl(
      `/workbook/sessions/${encodeURIComponent(params.sessionId)}/assets?${query.toString()}`
    ),
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type":
          params.mimeType?.trim() || params.file.type || "application/octet-stream",
      },
      body: params.file,
      signal: createTimeoutSignal(params.timeoutMs ?? 60_000),
    }
  );
  const data = await parseBinaryApiResponse(response);
  if (!response.ok) {
    throw asApiError(response, data);
  }
  return data as {
    assetId: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
  };
}

const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, Math.max(1_000, Math.floor(timeoutMs)));
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeoutId);
    },
    { once: true }
  );
  return controller.signal;
};

const parseBinaryApiResponse = async (response: Response) => {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const extractBinaryApiErrorMessage = (response: Response, data: unknown) => {
  if (typeof data === "object" && data !== null && "error" in data) {
    const maybeError = (data as { error?: unknown }).error;
    if (typeof maybeError === "string" && maybeError.trim().length > 0) {
      return maybeError;
    }
  }
  if (typeof data === "string" && data.trim().length > 0) {
    return data;
  }
  return response.statusText || "Request failed";
};

const asApiError = (response: Response, data: unknown) => {
  const message = extractBinaryApiErrorMessage(response, data);
  return new ApiError(message, response.status, data);
};

const postWorkbookPdfBinary = async <T>(
  path: string,
  params: {
    file: File;
    timeoutMs: number;
    query?: Record<string, string | number | undefined>;
  }
) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value == null) continue;
    query.set(key, String(value));
  }
  const querySuffix = query.toString();
  const response = await fetch(
    buildApiUrl(`${path}${querySuffix ? `?${querySuffix}` : ""}`),
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: params.file,
      signal: createTimeoutSignal(params.timeoutMs),
    }
  );
  const data = await parseBinaryApiResponse(response);
  if (!response.ok) {
    throw asApiError(response, data);
  }
  return data as T;
};

export async function updateWorkbookSessionDraftPreview(params: {
  sessionId: string;
  previewUrl: string;
  previewAlt?: string;
  page?: number;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}) {
  return api.post<{ ok: true }>(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/draft-preview`,
    {
      previewUrl: params.previewUrl,
      previewAlt: params.previewAlt,
      page:
        typeof params.page === "number" && Number.isFinite(params.page)
          ? Math.max(1, Math.trunc(params.page))
          : undefined,
      viewport:
        params.viewport &&
        Number.isFinite(params.viewport.x) &&
        Number.isFinite(params.viewport.y) &&
        Number.isFinite(params.viewport.zoom)
          ? {
              x: params.viewport.x,
              y: params.viewport.y,
              zoom: params.viewport.zoom,
            }
          : undefined,
    },
    { notifyDataUpdate: true, timeoutMs: 15_000 }
  );
}
