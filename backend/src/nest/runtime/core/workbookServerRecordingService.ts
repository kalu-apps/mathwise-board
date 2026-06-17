import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";
import type {
  MockDb,
  UserRecord,
  WorkbookRecordingRecord,
  WorkbookRecordingStatus,
} from "./db";

export type WorkbookServerRecordingStatus =
  | "idle"
  | WorkbookRecordingStatus;

export type WorkbookServerRecordingRecord = WorkbookRecordingRecord;

type StartWorkbookServerRecordingParams = {
  db: MockDb;
  sessionId: string;
  sessionTitle?: string | null;
  publicBaseUrl: string;
  createdBy: string;
  persist?: () => void;
};

type StopWorkbookServerRecordingParams = {
  db: MockDb;
  sessionId: string;
  recordingId?: string | null;
  resolveOutputPresence?: (
    recording: WorkbookServerRecordingRecord
  ) => Promise<WorkbookRecordingOutputPresence>;
  persist?: () => void;
};

export type WorkbookRecordingOutputPresence = "exists" | "missing" | "unknown";

type ReconcileWorkbookServerRecordingParams = {
  db: MockDb;
  recording: WorkbookServerRecordingRecord;
  resolveOutputPresence?: (
    recording: WorkbookServerRecordingRecord
  ) => Promise<WorkbookRecordingOutputPresence>;
  persist?: () => void;
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
const DEFAULT_RECORDING_START_STALE_SECONDS = 2 * 60;
const DEFAULT_RECORDING_STORAGE_GRACE_SECONDS = 10 * 60;

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

type LivekitEgressMethodName = "StartWebEgress" | "StopEgress" | "ListEgress";

const resolveEgressPath = (methodName: LivekitEgressMethodName) =>
  `${resolveLivekitEgressApiUrl()}/twirp/livekit.Egress/${methodName}`;

const createLivekitApiToken = () => {
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

const sanitizeRecordingTitle = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

const buildDefaultRecordingTitle = (sessionTitle: string | null | undefined) =>
  sanitizeRecordingTitle(sessionTitle ?? "") || "Запись занятия";

const ensureWorkbookRecordings = (db: MockDb) => {
  if (!Array.isArray(db.workbookRecordings)) {
    db.workbookRecordings = [];
  }
  return db.workbookRecordings;
};

const upsertWorkbookRecording = (db: MockDb, recording: WorkbookServerRecordingRecord) => {
  const recordings = ensureWorkbookRecordings(db);
  const index = recordings.findIndex((item) => item.id === recording.id);
  if (index >= 0) {
    recordings[index] = recording;
  } else {
    recordings.push(recording);
  }
  recordingsById.set(recording.id, recording);
};

const readWorkbookRecordingById = (db: MockDb, recordingId: string) =>
  recordingsById.get(recordingId) ??
  ensureWorkbookRecordings(db).find((recording) => recording.id === recordingId) ??
  null;

const isActiveRecordingStatus = (status: WorkbookServerRecordingStatus) =>
  status === "starting" ||
  status === "recording" ||
  status === "stopping" ||
  status === "processing";

const parseRecordingTimestampMs = (value: string | null | undefined) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const readStorageGraceMs = () =>
  readPositiveIntEnv(
    "WORKBOOK_RECORDING_STORAGE_GRACE_SECONDS",
    DEFAULT_RECORDING_STORAGE_GRACE_SECONDS,
    24 * 60 * 60
  ) * 1_000;

const readStartStaleMs = () =>
  readPositiveIntEnv(
    "WORKBOOK_RECORDING_START_STALE_SECONDS",
    DEFAULT_RECORDING_START_STALE_SECONDS,
    60 * 60
  ) * 1_000;

const isStorageGraceExpired = (recording: WorkbookServerRecordingRecord) => {
  const referenceMs =
    parseRecordingTimestampMs(recording.stoppedAt) ||
    parseRecordingTimestampMs(recording.updatedAt) ||
    parseRecordingTimestampMs(recording.startedAt);
  return referenceMs > 0 && Date.now() - referenceMs > readStorageGraceMs();
};

const isStartStale = (recording: WorkbookServerRecordingRecord) => {
  const referenceMs =
    parseRecordingTimestampMs(recording.updatedAt) ||
    parseRecordingTimestampMs(recording.startedAt) ||
    parseRecordingTimestampMs(recording.createdAt);
  return referenceMs > 0 && Date.now() - referenceMs > readStartStaleMs();
};

const markWorkbookRecordingReady = (
  db: MockDb,
  recording: WorkbookServerRecordingRecord,
  timestamp = nowIso()
) => {
  recording.status = "ready";
  recording.stoppedAt = recording.stoppedAt ?? timestamp;
  recording.updatedAt = timestamp;
  recording.errorMessage = null;
  upsertWorkbookRecording(db, recording);
  activeRecordingIdBySession.delete(recording.sessionId);
};

const markWorkbookRecordingProcessing = (
  db: MockDb,
  recording: WorkbookServerRecordingRecord,
  timestamp = nowIso()
) => {
  const shouldTouch = recording.status !== "processing" || !recording.stoppedAt;
  recording.status = "processing";
  recording.stoppedAt = recording.stoppedAt ?? timestamp;
  recording.updatedAt = shouldTouch ? timestamp : recording.updatedAt;
  upsertWorkbookRecording(db, recording);
  activeRecordingIdBySession.delete(recording.sessionId);
};

const markWorkbookRecordingFailed = (
  db: MockDb,
  recording: WorkbookServerRecordingRecord,
  errorMessage: string,
  timestamp = nowIso()
) => {
  recording.status = "failed";
  recording.errorMessage = errorMessage.slice(0, 600) || "recording_failed";
  recording.stoppedAt = recording.stoppedAt ?? timestamp;
  recording.updatedAt = timestamp;
  upsertWorkbookRecording(db, recording);
  activeRecordingIdBySession.delete(recording.sessionId);
};

const hydrateActiveRecordingForSession = (db: MockDb, sessionId: string) => {
  const active = ensureWorkbookRecordings(db)
    .filter(
      (recording) =>
        recording.sessionId === sessionId &&
        !recording.deletedAt &&
        isActiveRecordingStatus(recording.status)
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
  if (active) {
    activeRecordingIdBySession.set(sessionId, active.id);
    recordingsById.set(active.id, active);
  }
  return active ?? null;
};

const resolveRecordingOutputPresence = async (
  recording: WorkbookServerRecordingRecord,
  resolveOutputPresence?: (
    recording: WorkbookServerRecordingRecord
  ) => Promise<WorkbookRecordingOutputPresence>
) => {
  if (!resolveOutputPresence) return "unknown" as const;
  try {
    return await resolveOutputPresence(recording);
  } catch {
    return "unknown" as const;
  }
};

const applyStoppedRecordingOutputState = async (
  db: MockDb,
  recording: WorkbookServerRecordingRecord,
  resolveOutputPresence?: (
    recording: WorkbookServerRecordingRecord
  ) => Promise<WorkbookRecordingOutputPresence>
) => {
  const presence = await resolveRecordingOutputPresence(recording, resolveOutputPresence);
  if (presence === "exists") {
    markWorkbookRecordingReady(db, recording);
    return;
  }
  if (presence === "missing" && isStorageGraceExpired(recording)) {
    markWorkbookRecordingFailed(db, recording, "recording_output_missing");
    return;
  }
  markWorkbookRecordingProcessing(db, recording);
};

const resolveRecordingDurationSeconds = (recording: WorkbookServerRecordingRecord) => {
  if (!recording.startedAt || !recording.stoppedAt) return null;
  const startedAt = Date.parse(recording.startedAt);
  const stoppedAt = Date.parse(recording.stoppedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(stoppedAt) || stoppedAt < startedAt) {
    return null;
  }
  return Math.max(0, Math.round((stoppedAt - startedAt) / 1_000));
};

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
  methodName: LivekitEgressMethodName;
  payload: unknown;
}) => {
  const response = await fetch(resolveEgressPath(params.methodName), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${createLivekitApiToken()}`,
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

type LivekitEgressKnownStatus =
  | "starting"
  | "active"
  | "ending"
  | "complete"
  | "failed"
  | "aborted"
  | "limit_reached"
  | "unknown";

type LivekitEgressInfo = {
  status: LivekitEgressKnownStatus;
  errorMessage: string | null;
  endedAt: string | null;
};

const normalizeLivekitEgressStatus = (value: unknown): LivekitEgressKnownStatus => {
  if (typeof value === "number") {
    if (value === 0) return "starting";
    if (value === 1) return "active";
    if (value === 2) return "ending";
    if (value === 3) return "complete";
    if (value === 4) return "failed";
    if (value === 5) return "aborted";
    if (value === 6) return "limit_reached";
    return "unknown";
  }
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized.endsWith("starting")) return "starting";
  if (normalized === "1" || normalized.endsWith("active")) return "active";
  if (normalized === "2" || normalized.endsWith("ending")) return "ending";
  if (normalized === "3" || normalized.endsWith("complete")) return "complete";
  if (normalized === "4" || normalized.endsWith("failed")) return "failed";
  if (normalized === "5" || normalized.endsWith("aborted")) return "aborted";
  if (normalized === "6" || normalized.endsWith("limit_reached")) return "limit_reached";
  return "unknown";
};

const parseLivekitEgressEndedAt = (value: unknown) => {
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return new Date(asNumber / 1_000_000).toISOString();
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value / 1_000_000).toISOString();
  }
  return null;
};

const parseLivekitEgressInfo = (
  payload: Record<string, unknown>,
  egressId: string
): LivekitEgressInfo | null => {
  const sourceItems = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.egress)
      ? payload.egress
      : Array.isArray(payload.results)
        ? payload.results
        : [];
  const item = sourceItems.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const source = candidate as Record<string, unknown>;
    return source.egress_id === egressId || source.egressId === egressId || source.id === egressId;
  });
  if (!item || typeof item !== "object") return null;
  const source = item as Record<string, unknown>;
  const errorMessage =
    typeof source.error === "string" && source.error.trim()
      ? source.error.trim().slice(0, 600)
      : typeof source.details === "string" && source.details.trim()
        ? source.details.trim().slice(0, 600)
        : null;
  return {
    status: normalizeLivekitEgressStatus(source.status),
    errorMessage,
    endedAt: parseLivekitEgressEndedAt(source.ended_at ?? source.endedAt),
  };
};

const listLivekitEgressInfo = async (
  recording: WorkbookServerRecordingRecord
): Promise<LivekitEgressInfo | null> => {
  const egressId = recording.egressId?.trim();
  if (!egressId) return null;
  const payload = await fetchLivekitEgress({
    methodName: "ListEgress",
    payload: { egress_id: egressId },
  });
  return parseLivekitEgressInfo(payload, egressId);
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
        title: recording.title,
        sessionTitle: recording.sessionTitle ?? null,
        status: recording.status,
        startedAt: recording.startedAt,
        stoppedAt: recording.stoppedAt,
        updatedAt: recording.updatedAt,
        outputUrl: recording.outputUrl,
        errorMessage: recording.errorMessage,
      }
    : null;

export const serializeWorkbookRecordingLibraryItem = (
  recording: WorkbookServerRecordingRecord
) => ({
  id: recording.id,
  sessionId: recording.sessionId,
  title: recording.title,
  sessionTitle: recording.sessionTitle ?? null,
  status: recording.status,
  createdAt: recording.createdAt,
  startedAt: recording.startedAt,
  stoppedAt: recording.stoppedAt,
  updatedAt: recording.updatedAt,
  durationSeconds: resolveRecordingDurationSeconds(recording),
  playbackUrl: `/api/workbook/recordings/${encodeURIComponent(recording.id)}/playback`,
  downloadUrl: `/api/workbook/recordings/${encodeURIComponent(recording.id)}/download`,
  errorMessage: recording.errorMessage,
});

export const getWorkbookServerRecordingForSession = (db: MockDb, sessionId: string) => {
  const activeId = activeRecordingIdBySession.get(sessionId);
  if (activeId) return readWorkbookRecordingById(db, activeId);
  const hydratedActive = hydrateActiveRecordingForSession(db, sessionId);
  if (hydratedActive) return hydratedActive;
  const recordings = ensureWorkbookRecordings(db)
    .filter((recording) => recording.sessionId === sessionId && !recording.deletedAt)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  return recordings[0] ?? null;
};

export const listWorkbookServerRecordingsForUser = (db: MockDb, userId: string) =>
  ensureWorkbookRecordings(db)
    .filter((recording) => recording.createdBy === userId && !recording.deletedAt)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

export const getWorkbookServerRecordingForUser = (
  db: MockDb,
  userId: string,
  recordingId: string
) => {
  const recording = readWorkbookRecordingById(db, recordingId);
  if (!recording || recording.createdBy !== userId || recording.deletedAt) return null;
  return recording;
};

export const renameWorkbookServerRecording = (
  db: MockDb,
  userId: string,
  recordingId: string,
  title: string
) => {
  const recording = getWorkbookServerRecordingForUser(db, userId, recordingId);
  if (!recording) return null;
  const nextTitle = sanitizeRecordingTitle(title);
  if (nextTitle.length < 2) {
    throw new Error("recording_title_too_short");
  }
  recording.title = nextTitle;
  recording.updatedAt = nowIso();
  upsertWorkbookRecording(db, recording);
  return recording;
};

export const deleteWorkbookServerRecording = (
  db: MockDb,
  userId: string,
  recordingId: string
) => {
  const recording = getWorkbookServerRecordingForUser(db, userId, recordingId);
  if (!recording) return null;
  if (isActiveRecordingStatus(recording.status)) {
    throw new Error("recording_is_active");
  }
  recording.deletedAt = nowIso();
  recording.updatedAt = recording.deletedAt;
  upsertWorkbookRecording(db, recording);
  return recording;
};

export const reconcileWorkbookServerRecordingState = async ({
  db,
  recording,
  resolveOutputPresence,
  persist,
}: ReconcileWorkbookServerRecordingParams) => {
  if (recording.deletedAt) return false;
  const before = {
    status: recording.status,
    stoppedAt: recording.stoppedAt,
    updatedAt: recording.updatedAt,
    errorMessage: recording.errorMessage,
  };
  const persistIfChanged = () => {
    const changed =
      before.status !== recording.status ||
      before.stoppedAt !== recording.stoppedAt ||
      before.updatedAt !== recording.updatedAt ||
      before.errorMessage !== recording.errorMessage;
    if (changed) persist?.();
    return changed;
  };

  if (recording.status === "processing") {
    await applyStoppedRecordingOutputState(db, recording, resolveOutputPresence);
    return persistIfChanged();
  }

  if (!isActiveRecordingStatus(recording.status)) {
    return false;
  }

  if (!recording.egressId) {
    if (recording.status === "starting" && isStartStale(recording)) {
      markWorkbookRecordingFailed(db, recording, "recording_start_interrupted");
      return persistIfChanged();
    }
    activeRecordingIdBySession.set(recording.sessionId, recording.id);
    return false;
  }

  let egressInfo: LivekitEgressInfo | null = null;
  try {
    egressInfo = await listLivekitEgressInfo(recording);
  } catch {
    activeRecordingIdBySession.set(recording.sessionId, recording.id);
    return false;
  }

  if (!egressInfo) {
    activeRecordingIdBySession.set(recording.sessionId, recording.id);
    return false;
  }

  if (egressInfo.status === "starting" || egressInfo.status === "active") {
    const nextStatus = recording.status === "stopping" ? "stopping" : "recording";
    if (recording.status !== nextStatus || recording.errorMessage) {
      recording.status = nextStatus;
      recording.errorMessage = null;
      recording.updatedAt = nowIso();
      upsertWorkbookRecording(db, recording);
    }
    activeRecordingIdBySession.set(recording.sessionId, recording.id);
    return persistIfChanged();
  }

  if (egressInfo.status === "ending") {
    if (recording.status !== "stopping") {
      recording.status = "stopping";
      recording.updatedAt = nowIso();
      upsertWorkbookRecording(db, recording);
    }
    activeRecordingIdBySession.set(recording.sessionId, recording.id);
    return persistIfChanged();
  }

  if (egressInfo.status === "complete") {
    recording.stoppedAt = recording.stoppedAt ?? egressInfo.endedAt ?? nowIso();
    recording.updatedAt = recording.stoppedAt;
    await applyStoppedRecordingOutputState(db, recording, resolveOutputPresence);
    return persistIfChanged();
  }

  if (
    egressInfo.status === "failed" ||
    egressInfo.status === "aborted" ||
    egressInfo.status === "limit_reached"
  ) {
    markWorkbookRecordingFailed(
      db,
      recording,
      egressInfo.errorMessage ?? `livekit_egress_${egressInfo.status}`
    );
    return persistIfChanged();
  }

  activeRecordingIdBySession.set(recording.sessionId, recording.id);
  return false;
};

export const startWorkbookServerRecording = async ({
  db,
  sessionId,
  sessionTitle,
  publicBaseUrl,
  createdBy,
  persist,
}: StartWorkbookServerRecordingParams) => {
  const availability = getWorkbookServerRecordingAvailability();
  if (!availability.available) {
    throw new Error(availability.reason ?? "server_recording_unavailable");
  }
  const active = getWorkbookServerRecordingForSession(db, sessionId);
  if (active && isActiveRecordingStatus(active.status)) {
    activeRecordingIdBySession.set(sessionId, active.id);
    if (active.status === "starting" || active.status === "recording") return active;
    throw new Error("recording_stop_in_progress");
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
    createdBy,
    title: buildDefaultRecordingTitle(sessionTitle),
    sessionTitle: sanitizeRecordingTitle(sessionTitle ?? "") || null,
    status: "starting",
    createdAt: timestamp,
    startedAt: timestamp,
    stoppedAt: null,
    updatedAt: timestamp,
    outputUrl: buildOutputUrl(filePath),
    filePath,
    errorMessage: null,
    egressId: null,
    recordingPageUrl,
    deletedAt: null,
  };
  upsertWorkbookRecording(db, recording);
  persist?.();
  activeRecordingIdBySession.set(sessionId, recording.id);

  try {
    const response = await fetchLivekitEgress({
      methodName: "StartWebEgress",
      payload: {
        url: recordingPageUrl,
        file_outputs: [output],
        preset: readTrimmedEnv("WORKBOOK_RECORDING_LIVEKIT_PRESET") || DEFAULT_LIVEKIT_EGRESS_PRESET,
      },
    });
    recording.egressId = parseEgressId(response);
    recording.status = "recording";
    recording.updatedAt = nowIso();
    upsertWorkbookRecording(db, recording);
    persist?.();
    return recording;
  } catch (error) {
    recording.status = "failed";
    recording.errorMessage = error instanceof Error ? error.message : "recording_start_failed";
    recording.updatedAt = nowIso();
    upsertWorkbookRecording(db, recording);
    persist?.();
    activeRecordingIdBySession.delete(sessionId);
    throw error;
  }
};

export const stopWorkbookServerRecording = async ({
  db,
  sessionId,
  recordingId,
  resolveOutputPresence,
  persist,
}: StopWorkbookServerRecordingParams) => {
  const activeId = activeRecordingIdBySession.get(sessionId);
  const resolvedRecordingId = recordingId || activeId;
  const recording = resolvedRecordingId ? readWorkbookRecordingById(db, resolvedRecordingId) : null;
  if (!recording || recording.sessionId !== sessionId) {
    throw new Error("recording_not_found");
  }
  if (
    recording.status !== "recording" &&
    recording.status !== "starting" &&
    recording.status !== "stopping"
  ) {
    return recording;
  }
  recording.status = "stopping";
  recording.updatedAt = nowIso();
  upsertWorkbookRecording(db, recording);
  persist?.();
  try {
    if (recording.egressId) {
      await fetchLivekitEgress({
        methodName: "StopEgress",
        payload: {
          egress_id: recording.egressId,
        },
      });
    }
    recording.stoppedAt = nowIso();
    recording.updatedAt = recording.stoppedAt;
    await applyStoppedRecordingOutputState(db, recording, resolveOutputPresence);
    persist?.();
    return recording;
  } catch (error) {
    recording.errorMessage = error instanceof Error ? error.message : "recording_stop_failed";
    recording.updatedAt = nowIso();
    recording.status = "stopping";
    upsertWorkbookRecording(db, recording);
    persist?.();
    activeRecordingIdBySession.set(sessionId, recording.id);
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
