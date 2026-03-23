export const WORKBOOK_HUB_PREVIEW_BRIDGE_EVENT = "workbook:hub-preview-captured";
const WORKBOOK_HUB_PREVIEW_REFRESH_HINTS_STORAGE_KEY = "workbook:hub-preview-refresh-hints:v1";
const WORKBOOK_HUB_PREVIEW_REFRESH_HINT_TTL_MS = 20_000;

export type WorkbookHubPreviewBridgePayload = {
  sessionId: string;
  previewDataUrl: string;
  previewAlt?: string;
  page?: number;
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  capturedAt?: string;
};

export type WorkbookHubPreviewBridgeMessage = {
  type: typeof WORKBOOK_HUB_PREVIEW_BRIDGE_EVENT;
  payload: WorkbookHubPreviewBridgePayload;
};

export type WorkbookHubPreviewRefreshHint = {
  sessionId: string;
  requestedAt: number;
  expiresAt: number;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPreviewDataUrl = (value: unknown): value is string =>
  typeof value === "string" &&
  value.startsWith("data:image/") &&
  value.length > 32;

const isPreviewRefreshHint = (value: unknown): value is WorkbookHubPreviewRefreshHint => {
  if (!isRecord(value)) return false;
  if (typeof value.sessionId !== "string" || value.sessionId.trim().length === 0) {
    return false;
  }
  if (!isFiniteNumber(value.requestedAt) || !isFiniteNumber(value.expiresAt)) {
    return false;
  }
  return true;
};

const readPreviewRefreshHints = () => {
  if (typeof window === "undefined") return [] as WorkbookHubPreviewRefreshHint[];
  let raw = "";
  try {
    raw = window.sessionStorage.getItem(WORKBOOK_HUB_PREVIEW_REFRESH_HINTS_STORAGE_KEY) ?? "";
  } catch {
    return [] as WorkbookHubPreviewRefreshHint[];
  }
  if (raw.length === 0) return [] as WorkbookHubPreviewRefreshHint[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as WorkbookHubPreviewRefreshHint[];
    return parsed.filter(isPreviewRefreshHint);
  } catch {
    return [] as WorkbookHubPreviewRefreshHint[];
  }
};

const writePreviewRefreshHints = (hints: WorkbookHubPreviewRefreshHint[]) => {
  if (typeof window === "undefined") return;
  if (hints.length === 0) {
    try {
      window.sessionStorage.removeItem(WORKBOOK_HUB_PREVIEW_REFRESH_HINTS_STORAGE_KEY);
    } catch {
      // no-op
    }
    return;
  }
  try {
    window.sessionStorage.setItem(
      WORKBOOK_HUB_PREVIEW_REFRESH_HINTS_STORAGE_KEY,
      JSON.stringify(hints)
    );
  } catch {
    // no-op
  }
};

export const queueWorkbookHubPreviewRefreshHint = (
  sessionId: string,
  requestedAt = Date.now()
) => {
  if (typeof window === "undefined") return;
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) return;
  const now = Date.now();
  const baselineRequestedAt =
    Number.isFinite(requestedAt) && requestedAt > 0 ? requestedAt : now;
  const nextHint: WorkbookHubPreviewRefreshHint = {
    sessionId: normalizedSessionId,
    requestedAt: baselineRequestedAt,
    expiresAt: baselineRequestedAt + WORKBOOK_HUB_PREVIEW_REFRESH_HINT_TTL_MS,
  };
  const current = readPreviewRefreshHints().filter((hint) => hint.expiresAt > now);
  const deduped = current.filter((hint) => hint.sessionId !== normalizedSessionId);
  deduped.push(nextHint);
  writePreviewRefreshHints(deduped);
};

export const consumeWorkbookHubPreviewRefreshHints = () => {
  const now = Date.now();
  const hints = readPreviewRefreshHints().filter((hint) => hint.expiresAt > now);
  writePreviewRefreshHints([]);
  return hints;
};

export const isWorkbookHubPreviewBridgeMessage = (
  value: unknown
): value is WorkbookHubPreviewBridgeMessage => {
  if (!isRecord(value)) return false;
  if (value.type !== WORKBOOK_HUB_PREVIEW_BRIDGE_EVENT) return false;
  if (!isRecord(value.payload)) return false;
  const payload = value.payload;
  if (typeof payload.sessionId !== "string" || payload.sessionId.trim().length === 0) {
    return false;
  }
  if (!isPreviewDataUrl(payload.previewDataUrl)) return false;
  if (typeof payload.previewAlt !== "undefined" && typeof payload.previewAlt !== "string") {
    return false;
  }
  if (typeof payload.page !== "undefined" && !isFiniteNumber(payload.page)) {
    return false;
  }
  if (typeof payload.viewport !== "undefined") {
    if (!isRecord(payload.viewport)) return false;
    if (
      !isFiniteNumber(payload.viewport.x) ||
      !isFiniteNumber(payload.viewport.y) ||
      !isFiniteNumber(payload.viewport.zoom)
    ) {
      return false;
    }
  }
  if (typeof payload.capturedAt !== "undefined" && typeof payload.capturedAt !== "string") {
    return false;
  }
  return true;
};
