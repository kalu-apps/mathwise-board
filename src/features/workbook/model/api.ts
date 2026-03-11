import { api } from "@/shared/api/client";
import { buildApiUrl } from "@/shared/api/base";
import type { User } from "@/entities/user/model/types";
import type { WorkbookClientEventInput } from "./events";
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
  });
}

export async function createWorkbookSession(params: {
  kind: WorkbookSessionKind;
  title?: string;
}) {
  return api.post<{
    session: WorkbookSession;
    draft: WorkbookDraftCard;
  }>("/workbook/sessions/", params);
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

  const scheduleReconnect = () => {
    if (closed || reconnectTimer !== null) return;
    const delay = Math.min(4_000, 250 * 2 ** reconnectAttempt);
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connectSocket();
    }, delay);
  };

  const connectSocket = () => {
    if (closed) return;
    clearReconnectTimer();
    const nextSocket = new WebSocket(socketUrl);
    socket = nextSocket;

    nextSocket.onopen = () => {
      reconnectAttempt = 0;
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
  return api.post<{ events: WorkbookEvent[]; latestSeq: number }>(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/events`,
    { events: params.events },
    { notifyDataUpdate: false }
  );
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
  return api.put<WorkbookSnapshot>(
    `/workbook/sessions/${encodeURIComponent(params.sessionId)}/snapshot`,
    params,
    { notifyDataUpdate: false }
  );
}

export async function heartbeatWorkbookPresence(sessionId: string) {
  return api.post<{ ok: true; participants: WorkbookSession["participants"] }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/presence`,
    {},
    { notifyDataUpdate: false }
  );
}

export async function leaveWorkbookPresence(sessionId: string) {
  return api.post<{ ok: true; participants: WorkbookSession["participants"] }>(
    `/workbook/sessions/${encodeURIComponent(sessionId)}/presence/leave`,
    {},
    { notifyDataUpdate: false }
  );
}

export async function renderWorkbookPdfPages(params: {
  fileName: string;
  dataUrl: string;
  dpi?: number;
  maxPages?: number;
}) {
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
  }>("/workbook/pdf/render", params, { notifyDataUpdate: false });
}

export async function recognizeWorkbookInk(params: {
  sessionId: string;
  strokes: Array<{
    id: string;
    points: Array<{ x: number; y: number }>;
    width: number;
    color: string;
  }>;
  preferMath?: boolean;
}) {
  return api.post<{
    provider: "mock" | "external";
    supported: boolean;
    result: null | {
      text?: string;
      latex?: string;
      confidence?: number;
    };
  }>("/workbook/ink/recognize", params, { notifyDataUpdate: false });
}
