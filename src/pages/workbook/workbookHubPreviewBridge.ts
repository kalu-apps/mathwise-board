export const WORKBOOK_HUB_PREVIEW_BRIDGE_EVENT = "workbook:hub-preview-captured";

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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPreviewDataUrl = (value: unknown): value is string =>
  typeof value === "string" &&
  value.startsWith("data:image/") &&
  value.length > 32;

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
