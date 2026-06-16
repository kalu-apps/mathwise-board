import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { MockDb, UserRecord } from "./db";

export type WorkbookServerRecordingStatus =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "processing"
  | "ready"
  | "failed";

export type WorkbookServerRecordingRecord = {
  id: string;
  sessionId: string;
  status: WorkbookServerRecordingStatus;
  startedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
  outputUrl: string | null;
  errorMessage: string | null;
  egressId: string | null;
  recordingPageUrl: string | null;
  createdBy: string;
};

type StartWorkbookServerRecordingParams = {
  sessionId: string;
  roomName: string;
  publicBaseUrl: string;
  createdBy: string;
};

type StopWorkbookServerRecordingParams = {
  sessionId: string;
  recordingId?: string | null;
};

type RecordingTokenPayload = {
  v: 1;
  sessionId: string;
  recordingId: string;
  exp: number;
};

const WORKBOOK_RECORDING_TOKEN_HEADER = "x-workbook-recording-token";
const WORKBOOK_RECORDING_TOKEN_QUERY_PARAM = "recordingToken";
const DEFAULT_RECORDING_VIEW_PATH = "/workbook/recording/:sessionId";
const DEFAULT_RECORDING_FILE_PREFIX = "workbook-recordings";
const DEFAULT_RECORDING_TOKEN_TTL_SECONDS = 12 * 60 * 60;
const DEFAULT_LIVEKIT_EGRESS_PRESET = "H264_1080P_30";

const recordingsById = new Map<string, WorkbookServerRecordingRecord>();
const activeRecordingIdBySession = new Map<string, string>();

const nowIso = () => new Date().toISOString();

const ensureId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `recording_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const readBoolEnv = (name: string, fallback = false) => {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
};

const readPositiveIntEnv = (name: string, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(process.env[name] ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
};

const readTrimmedEnv = (name: string) => String(process.env[name] ?? "").trim();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, "");

const toHttpLivekitUrl = (value: string) => {
  const normalized = trimTrailingSlash(value.trim());
  if (!normalized) return "";
  if (normalized.startsWith("wss://")) return `https://${normalized.slice("wss://".length)}`;
  if (normalized.startsWith("ws://")) return `http://${normalized.slice("ws://".length)}`;
  return normalized;
};

const base64UrlEncode = (value: string | Buffer) => Buffer.from(value).toString("base64url");

const signHs256 = (payload: unknown, secret: string) => {
  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const resolveLivekitEgressApiUrl = () =>
  trimTrailingSlash(
    readTrimmedEnv("WORKBOOK_RECORDING_LIVEKIT_EGRESS_URL") ||
      toHttpLivekitUrl(readTrimmedEnv("MEDIA_LIVEKIT_WS_URL"))
  );

const resolveRecordingSecret = () =>
  readTrimmedEnv("WORKBOOK_RECORDING_TOKEN_SECRET") ||
  readTrimmedEnv("MEDIA_LIVEKIT_API_SECRET");

const resolveEgressPath = (methodName: "StartWebEgress" | "StopEgress") =>
  `${resolveLivekitEgressApiUrl()}/twirp/livekit.Egress/${methodName}`;

const createLivekitApiToken = (roomName?: string) => {
  const apiKey = readTrimmedEnv("MEDIA_LIVEKIT_API_KEY");
  const apiSecret = readTrimmedEnv("MEDIA_LIVEKIT_API_SECRET");
  const issuedAtUnix = Math.floor(Date.now() / 1000);
  return signHs256(
    {
      iss: apiKey,
      sub: "mathwise-workbook-recorder",
      iat: issuedAtUnix,
      nbf: issuedAtUnix - 5,
      exp: issuedAtUnix + 10 * 60,
      video: {
        roomRecord: true,
        ...(roomName ? { room: roomName } : {}),
      },
    },
    apiSecret
  );
};

const sanitizeFilePathPart = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "session";

const buildRecordingFilePath = (sessionId: string, recordingId: string) => {
  const prefix = (readTrimmedEnv("WORKBOOK_RECORDING_FILE_PREFIX") || DEFAULT_RECORDING_FILE_PREFIX)
    .split("/")
    .map(sanitizeFilePathPart)
    .filter(Boolean)
    .join("/");
  return `${prefix}/${sanitizeFilePathPart(sessionId)}/${sanitizeFilePathPart(recordingId)}.mp4`;
};

const buildOutputUrl = (filePath: string) => {
  const publicBase = trimTrailingSlash(readTrimmedEnv("WORKBOOK_RECORDING_PUBLIC_URL_BASE"));
  if (!publicBase) return null;
  return `${publicBase}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
};

const buildS3Output = (filePath: string) => {
  const bucket = readTrimmedEnv("WORKBOOK_RECORDING_S3_BUCKET");
  const accessKey = readTrimmedEnv("WORKBOOK_RECORDING_S3_ACCESS_KEY");
  const secret = readTrimmedEnv("WORKBOOK_RECORDING_S3_SECRET");
  if (!bucket || !accessKey || !secret) return null;
  return {
    filepath: filePath,
    s3: {
      access_key: accessKey,
      secret,
      bucket,
      region: readTrimmedEnv("WORKBOOK_RECORDING_S3_REGION") || "auto",
      endpoint: readTrimmedEnv("WORKBOOK_RECORDING_S3_ENDPOINT") || undefined,
      force_path_style: readBoolEnv("WORKBOOK_RECORDING_S3_FORCE_PATH_STYLE", true),
    },
  };
};

const createRecordingAccessToken = (payload: RecordingTokenPayload) => {
  const secret = resolveRecordingSecret();
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
};

const verifyRecordingAccessToken = (token: string): RecordingTokenPayload | null => {
  const secret = resolveRecordingSecret();
  if (!secret) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8")) as
      | RecordingTokenPayload
      | null;
    if (!payload || payload.v !== 1) return null;
    if (!payload.sessionId || !payload.recordingId || !Number.isFinite(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

const buildRecordingPageUrl = (params: {
  publicBaseUrl: string;
  sessionId: string;
  recordingId: string;
}) => {
  const publicBaseUrl = trimTrailingSlash(params.publicBaseUrl);
  if (!publicBaseUrl) return null;
  const tokenTtlSeconds = readPositiveIntEnv(
    "WORKBOOK_RECORDING_TOKEN_TTL_SECONDS",
    DEFAULT_RECORDING_TOKEN_TTL_SECONDS,
    7 * 24 * 60 * 60
  );
  const token = createRecordingAccessToken({
    v: 1,
    sessionId: params.sessionId,
    recordingId: params.recordingId,
    exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
  });
  const pathTemplate =
    readTrimmedEnv("WORKBOOK_RECORDING_VIEW_PATH") || DEFAULT_RECORDING_VIEW_PATH;
  const path = pathTemplate.replace(":sessionId", encodeURIComponent(params.sessionId));
  const url = new URL(path, `${publicBaseUrl}/`);
  url.searchParams.set("recordingId", params.recordingId);
  url.searchParams.set(WORKBOOK_RECORDING_TOKEN_QUERY_PARAM, token);
  return url.toString();
};

const parseEgressId = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  const candidates = [source.egress_id, source.egressId, source.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

const fetchLivekitEgress = async (params: {
  methodName: "StartWebEgress" | "StopEgress";
  roomName?: string;
  payload: unknown;
}) => {
  const response = await fetch(resolveEgressPath(params.methodName), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${createLivekitApiToken(params.roomName)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });
  const responseText = await response.text();
  let responsePayload: Record<string, unknown> = {};
  if (responseText) {
    try {
      responsePayload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      responsePayload = { error: responseText };
    }
  }
  if (!response.ok) {
    const message =
      typeof responsePayload.msg === "string"
        ? responsePayload.msg
        : typeof responsePayload.error === "string"
          ? responsePayload.error
          : `livekit_egress_http_${response.status}`;
    throw new Error(message);
  }
  return responsePayload;
};

export const getWorkbookServerRecordingAvailability = () => {
  if (!readBoolEnv("WORKBOOK_SERVER_RECORDING_ENABLED", true)) {
    return { available: false, reason: "server_recording_disabled" };
  }
  if (!resolveLivekitEgressApiUrl()) {
    return { available: false, reason: "livekit_egress_url_missing" };
  }
  if (!readTrimmedEnv("MEDIA_LIVEKIT_API_KEY") || !readTrimmedEnv("MEDIA_LIVEKIT_API_SECRET")) {
    return { available: false, reason: "livekit_credentials_missing" };
  }
  if (!resolveRecordingSecret()) {
    return { available: false, reason: "recording_token_secret_missing" };
  }
  if (!buildS3Output("probe.mp4")) {
    return { available: false, reason: "recording_storage_missing" };
  }
  return { available: true, reason: null };
};

export const serializeWorkbookServerRecording = (
  recording: WorkbookServerRecordingRecord | null
) =>
  recording
    ? {
        id: recording.id,
        sessionId: recording.sessionId,
        status: recording.status,
        startedAt: recording.startedAt,
        stoppedAt: recording.stoppedAt,
        updatedAt: recording.updatedAt,
        outputUrl: recording.outputUrl,
        errorMessage: recording.errorMessage,
      }
    : null;

export const getWorkbookServerRecordingForSession = (sessionId: string) => {
  const activeId = activeRecordingIdBySession.get(sessionId);
  if (activeId) return recordingsById.get(activeId) ?? null;
  const recordings = Array.from(recordingsById.values())
    .filter((recording) => recording.sessionId === sessionId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  return recordings[0] ?? null;
};

export const startWorkbookServerRecording = async ({
  sessionId,
  roomName,
  publicBaseUrl,
  createdBy,
}: StartWorkbookServerRecordingParams) => {
  const availability = getWorkbookServerRecordingAvailability();
  if (!availability.available) {
    throw new Error(availability.reason ?? "server_recording_unavailable");
  }
  const active = getWorkbookServerRecordingForSession(sessionId);
  if (active && activeRecordingIdBySession.get(sessionId) === active.id) {
    if (active.status === "starting" || active.status === "recording") {
      return active;
    }
    if (active.status === "stopping" || active.status === "processing") {
      throw new Error("recording_stop_in_progress");
    }
  }

  const timestamp = nowIso();
  const recordingId = ensureId();
  const filePath = buildRecordingFilePath(sessionId, recordingId);
  const output = buildS3Output(filePath);
  const recordingPageUrl = buildRecordingPageUrl({
    publicBaseUrl,
    sessionId,
    recordingId,
  });
  if (!output || !recordingPageUrl) {
    throw new Error("recording_output_unavailable");
  }

  const recording: WorkbookServerRecordingRecord = {
    id: recordingId,
    sessionId,
    status: "starting",
    startedAt: timestamp,
    stoppedAt: null,
    updatedAt: timestamp,
    outputUrl: buildOutputUrl(filePath),
    errorMessage: null,
    egressId: null,
    recordingPageUrl,
    createdBy,
  };
  recordingsById.set(recording.id, recording);
  activeRecordingIdBySession.set(sessionId, recording.id);

  try {
    const response = await fetchLivekitEgress({
      methodName: "StartWebEgress",
      roomName,
      payload: {
        url: recordingPageUrl,
        file_outputs: [output],
        preset: readTrimmedEnv("WORKBOOK_RECORDING_LIVEKIT_PRESET") || DEFAULT_LIVEKIT_EGRESS_PRESET,
      },
    });
    recording.egressId = parseEgressId(response);
    recording.status = "recording";
    recording.updatedAt = nowIso();
    return recording;
  } catch (error) {
    recording.status = "failed";
    recording.errorMessage = error instanceof Error ? error.message : "recording_start_failed";
    recording.updatedAt = nowIso();
    activeRecordingIdBySession.delete(sessionId);
    throw error;
  }
};

export const stopWorkbookServerRecording = async ({
  sessionId,
  recordingId,
}: StopWorkbookServerRecordingParams) => {
  const activeId = activeRecordingIdBySession.get(sessionId);
  const resolvedRecordingId = recordingId || activeId;
  const recording = resolvedRecordingId ? recordingsById.get(resolvedRecordingId) ?? null : null;
  if (!recording || recording.sessionId !== sessionId) {
    throw new Error("recording_not_found");
  }
  if (recording.status !== "recording" && recording.status !== "starting") {
    return recording;
  }
  recording.status = "stopping";
  recording.updatedAt = nowIso();
  try {
    if (recording.egressId) {
      await fetchLivekitEgress({
        methodName: "StopEgress",
        roomName: undefined,
        payload: {
          egress_id: recording.egressId,
        },
      });
    }
    recording.status = recording.outputUrl ? "ready" : "processing";
    recording.stoppedAt = nowIso();
    recording.updatedAt = recording.stoppedAt;
    activeRecordingIdBySession.delete(sessionId);
    return recording;
  } catch (error) {
    recording.status = "failed";
    recording.errorMessage = error instanceof Error ? error.message : "recording_stop_failed";
    recording.updatedAt = nowIso();
    activeRecordingIdBySession.delete(sessionId);
    throw error;
  }
};

const extractRecordingTokenFromRequest = (req: IncomingMessage) => {
  const headerValue = req.headers[WORKBOOK_RECORDING_TOKEN_HEADER];
  if (Array.isArray(headerValue)) {
    const normalized = String(headerValue[0] ?? "").trim();
    if (normalized) return normalized;
  } else if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }
  try {
    const url = new URL(req.url ?? "", "http://workbook.local");
    const queryToken = url.searchParams.get(WORKBOOK_RECORDING_TOKEN_QUERY_PARAM)?.trim() ?? "";
    return queryToken || null;
  } catch {
    return null;
  }
};

export const resolveWorkbookRecordingAccessPayload = (
  req: IncomingMessage
): RecordingTokenPayload | null => {
  const token = extractRecordingTokenFromRequest(req);
  return token ? verifyRecordingAccessToken(token) : null;
};

const extractSessionIdFromRequestPath = (req: IncomingMessage) => {
  try {
    const url = new URL(req.url ?? "", "http://workbook.local");
    const match = url.pathname.match(/^\/api\/workbook\/sessions\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

export const resolveWorkbookRecordingReadUser = (
  req: IncomingMessage,
  db: MockDb
): UserRecord | null => {
  if (req.method !== "GET") return null;
  const payload = resolveWorkbookRecordingAccessPayload(req);
  if (!payload) return null;
  const pathSessionId = extractSessionIdFromRequestPath(req);
  if (pathSessionId && pathSessionId !== payload.sessionId) return null;
  const session = db.workbookSessions.find((item) => item.id === payload.sessionId);
  if (!session) return null;
  return db.users.find((user) => user.id === session.createdBy) ?? null;
};
