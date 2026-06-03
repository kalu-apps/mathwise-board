import { api, ApiError } from "@/shared/api/client";
import { buildApiUrl } from "@/shared/api/base";

type WorkbookUploadedAsset = {
  assetId: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

export async function uploadWorkbookAsset(params: {
  sessionId: string;
  fileName: string;
  dataUrl: string;
  mimeType?: string;
}) {
  const binaryAsset = await buildWorkbookAssetBlob(params.dataUrl);
  if (binaryAsset) {
    try {
      return await uploadWorkbookAssetFile({
        sessionId: params.sessionId,
        fileName: params.fileName,
        file: binaryAsset,
        mimeType: params.mimeType || binaryAsset.type || undefined,
        timeoutMs: 60_000,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 413) {
        throw error;
      }
    }
  }

  return api.post<WorkbookUploadedAsset>(
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
  file: Blob;
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
  return data as WorkbookUploadedAsset;
}

const buildWorkbookAssetBlob = async (dataUrl: string): Promise<Blob | null> => {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
  if (typeof fetch !== "function") return null;
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
};

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

export const postWorkbookPdfBinary = async <T>(
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
