import {
  createEmptyScene,
  encodeScenePayload,
  normalizeScenePayload,
} from "./scene";
import type { WorkbookSessionState } from "./types";

type DecodeWorkerRequest = {
  action: "decode";
  requestId: number;
  decodeBoard: boolean;
  decodeAnnotations: boolean;
  boardPayload: unknown;
  annotationPayload: unknown;
};

type EncodeWorkerRequest = {
  action: "encode";
  requestId: number;
  boardState: Partial<WorkbookSessionState>;
  annotationState: Partial<WorkbookSessionState>;
};

type WorkerRequest = DecodeWorkerRequest | EncodeWorkerRequest;
type WorkerRequestWithoutId = Omit<DecodeWorkerRequest, "requestId"> | Omit<EncodeWorkerRequest, "requestId">;

type DecodeWorkerResponse = {
  action: "decode";
  requestId: number;
  boardState: WorkbookSessionState | null;
  annotationState: WorkbookSessionState | null;
};

type EncodeWorkerResponse = {
  action: "encode";
  requestId: number;
  boardPayload: unknown;
  annotationPayload: unknown;
};

type ErrorWorkerResponse = {
  action: "error";
  requestId: number;
  message: string;
};

type WorkerResponse = DecodeWorkerResponse | EncodeWorkerResponse | ErrorWorkerResponse;

type PendingWorkerRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

let workerInstance: Worker | null = null;
let nextRequestId = 1;
let workerUnsupported = false;
const pendingWorkerRequests = new Map<number, PendingWorkerRequest>();
const WORKBOOK_SCENE_CODEC_WORKER_TIMEOUT_MS = 4_000;

const rejectAllPendingWorkerRequests = (reason: string) => {
  pendingWorkerRequests.forEach((request) => {
    request.reject(new Error(reason));
  });
  pendingWorkerRequests.clear();
};

const isWorkerRuntimeSupported = () =>
  typeof window !== "undefined" && typeof Worker !== "undefined";

const ensureCodecWorker = () => {
  if (workerUnsupported || !isWorkerRuntimeSupported()) {
    return null;
  }
  if (workerInstance) {
    return workerInstance;
  }

  try {
    const worker = new Worker(
      new URL("./workers/workbookSceneCodec.worker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (!response || typeof response !== "object" || !Number.isFinite(response.requestId)) {
        return;
      }
      const pending = pendingWorkerRequests.get(response.requestId);
      if (!pending) {
        return;
      }
      pendingWorkerRequests.delete(response.requestId);
      if (response.action === "error") {
        pending.reject(
          new Error(
            typeof response.message === "string" && response.message.trim()
              ? response.message
              : "workbook_scene_codec_worker_failed"
          )
        );
        return;
      }
      pending.resolve(response);
    };
    worker.onerror = () => {
      rejectAllPendingWorkerRequests("workbook_scene_codec_worker_runtime_error");
      try {
        worker.terminate();
      } catch {
        // ignore worker termination failures
      }
      workerInstance = null;
      workerUnsupported = true;
    };
    workerInstance = worker;
    return worker;
  } catch {
    workerUnsupported = true;
    return null;
  }
};

function runWorkerRequest(requestWithoutId: Omit<DecodeWorkerRequest, "requestId">): Promise<DecodeWorkerResponse>;
function runWorkerRequest(requestWithoutId: Omit<EncodeWorkerRequest, "requestId">): Promise<EncodeWorkerResponse>;
async function runWorkerRequest(
  requestWithoutId: WorkerRequestWithoutId
): Promise<DecodeWorkerResponse | EncodeWorkerResponse> {
  const worker = ensureCodecWorker();
  if (!worker) {
    throw new Error("workbook_scene_codec_worker_unavailable");
  }
  const requestId = nextRequestId;
  nextRequestId += 1;

  return await new Promise<DecodeWorkerResponse | EncodeWorkerResponse>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingWorkerRequests.delete(requestId);
      reject(new Error("workbook_scene_codec_worker_timeout"));
    }, WORKBOOK_SCENE_CODEC_WORKER_TIMEOUT_MS);
    pendingWorkerRequests.set(requestId, {
      resolve: (response) => {
        clearTimeout(timeoutId);
        resolve(response as DecodeWorkerResponse | EncodeWorkerResponse);
      },
      reject: (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    });

    try {
      const request: WorkerRequest = {
        ...requestWithoutId,
        requestId,
      };
      worker.postMessage(request);
    } catch (error) {
      pendingWorkerRequests.delete(requestId);
      clearTimeout(timeoutId);
      reject(
        error instanceof Error
          ? error
          : new Error("workbook_scene_codec_worker_post_message_failed")
      );
    }
  });
}

const decodeSnapshotsSync = (params: {
  decodeBoard: boolean;
  decodeAnnotations: boolean;
  boardPayload: unknown;
  annotationPayload: unknown;
}) => ({
  boardState: params.decodeBoard
    ? normalizeScenePayload(params.boardPayload ?? createEmptyScene())
    : null,
  annotationState: params.decodeAnnotations
    ? normalizeScenePayload(params.annotationPayload ?? createEmptyScene())
    : null,
});

const encodeSnapshotsSync = (params: {
  boardState: Partial<WorkbookSessionState>;
  annotationState: Partial<WorkbookSessionState>;
}) => ({
  boardPayload: encodeScenePayload(params.boardState),
  annotationPayload: encodeScenePayload(params.annotationState),
});

export const decodeWorkbookSceneSnapshots = async (params: {
  decodeBoard: boolean;
  decodeAnnotations: boolean;
  boardPayload: unknown;
  annotationPayload: unknown;
}) => {
  if (!params.decodeBoard && !params.decodeAnnotations) {
    return {
      boardState: null,
      annotationState: null,
    };
  }

  try {
    const response = await runWorkerRequest({
      action: "decode",
      decodeBoard: params.decodeBoard,
      decodeAnnotations: params.decodeAnnotations,
      boardPayload: params.boardPayload,
      annotationPayload: params.annotationPayload,
    });
    return {
      boardState: response.boardState,
      annotationState: response.annotationState,
    };
  } catch {
    return decodeSnapshotsSync(params);
  }
};

export const encodeWorkbookSceneSnapshots = async (params: {
  boardState: Partial<WorkbookSessionState>;
  annotationState: Partial<WorkbookSessionState>;
}) => {
  try {
    const response = await runWorkerRequest({
      action: "encode",
      boardState: params.boardState,
      annotationState: params.annotationState,
    });
    return {
      boardPayload: response.boardPayload,
      annotationPayload: response.annotationPayload,
    };
  } catch {
    return encodeSnapshotsSync(params);
  }
};
