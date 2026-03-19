import {
  createEmptyScene,
  encodeScenePayload,
  normalizeScenePayload,
} from "../scene";
import type { WorkbookSessionState } from "../types";

type DecodeRequest = {
  action: "decode";
  requestId: number;
  decodeBoard: boolean;
  decodeAnnotations: boolean;
  boardPayload: unknown;
  annotationPayload: unknown;
};

type EncodeRequest = {
  action: "encode";
  requestId: number;
  boardState: Partial<WorkbookSessionState>;
  annotationState: Partial<WorkbookSessionState>;
};

type WorkerRequest = DecodeRequest | EncodeRequest;

type DecodeResponse = {
  action: "decode";
  requestId: number;
  boardState: WorkbookSessionState | null;
  annotationState: WorkbookSessionState | null;
};

type EncodeResponse = {
  action: "encode";
  requestId: number;
  boardPayload: unknown;
  annotationPayload: unknown;
};

type ErrorResponse = {
  action: "error";
  requestId: number;
  message: string;
};

type WorkerResponse = DecodeResponse | EncodeResponse | ErrorResponse;

const toWorkerErrorMessage = (error: unknown) => {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return "workbook_scene_codec_worker_failed";
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const payload = event.data;
  if (!payload || typeof payload !== "object" || !Number.isFinite(payload.requestId)) {
    return;
  }

  try {
    if (payload.action === "decode") {
      const response: DecodeResponse = {
        action: "decode",
        requestId: payload.requestId,
        boardState: payload.decodeBoard
          ? normalizeScenePayload(payload.boardPayload ?? createEmptyScene())
          : null,
        annotationState: payload.decodeAnnotations
          ? normalizeScenePayload(payload.annotationPayload ?? createEmptyScene())
          : null,
      };
      self.postMessage(response satisfies WorkerResponse);
      return;
    }

    if (payload.action === "encode") {
      const response: EncodeResponse = {
        action: "encode",
        requestId: payload.requestId,
        boardPayload: encodeScenePayload(payload.boardState),
        annotationPayload: encodeScenePayload(payload.annotationState),
      };
      self.postMessage(response satisfies WorkerResponse);
    }
  } catch (error) {
    self.postMessage({
      action: "error",
      requestId: payload.requestId,
      message: toWorkerErrorMessage(error),
    } satisfies WorkerResponse);
  }
};
