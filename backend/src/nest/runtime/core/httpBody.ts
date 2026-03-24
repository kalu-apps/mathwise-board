import type { IncomingMessage } from "node:http";

export const REQUEST_BODY_TOO_LARGE_ERROR = "request_body_too_large";
export const INVALID_JSON_BODY_ERROR = "invalid_json_body";

const DEFAULT_MAX_BODY_BYTES = 768_000;

const normalizeMaxBytes = (value: number | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_MAX_BODY_BYTES;
  return Math.max(1_024, Math.floor(value ?? DEFAULT_MAX_BODY_BYTES));
};

export const readJsonBody = async (
  req: IncomingMessage,
  options?: { maxBytes?: number }
): Promise<unknown> => {
  const maxBytes = normalizeMaxBytes(options?.maxBytes);
  const chunks: string[] = [];
  let bytesRead = 0;

  for await (const chunk of req) {
    const textChunk = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8");
    bytesRead += Buffer.byteLength(textChunk, "utf-8");
    if (bytesRead > maxBytes) {
      throw new Error(REQUEST_BODY_TOO_LARGE_ERROR);
    }
    chunks.push(textChunk);
  }

  const rawBody = chunks.join("");
  if (!rawBody.trim()) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(INVALID_JSON_BODY_ERROR);
  }
};

export const readRawBody = async (
  req: IncomingMessage,
  options?: { maxBytes?: number }
): Promise<Buffer> => {
  const maxBytes = normalizeMaxBytes(options?.maxBytes);
  const chunks: Buffer[] = [];
  let bytesRead = 0;

  for await (const chunk of req) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytesRead += bufferChunk.length;
    if (bytesRead > maxBytes) {
      throw new Error(REQUEST_BODY_TOO_LARGE_ERROR);
    }
    chunks.push(bufferChunk);
  }

  return Buffer.concat(chunks);
};
