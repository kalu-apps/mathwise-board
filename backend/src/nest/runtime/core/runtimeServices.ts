import { recordWorkbookServerTrace } from "./telemetryService";

type RedisClient = ReturnType<typeof import("redis").createClient>;

const readBool = (value: string | undefined, fallback = false) => {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const readPositiveInt = (value: string | undefined, fallback: number, cap: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(cap, parsed);
};

const REDIS_URL = String(process.env.REDIS_URL ?? "").trim();
const REDIS_REQUIRED =
  String(process.env.BOARD_RUNTIME_REDIS_REQUIRED ?? process.env.REDIS_REQUIRED ?? "")
    .trim()
    .toLowerCase() === "1" ||
  String(process.env.BOARD_RUNTIME_REDIS_REQUIRED ?? process.env.REDIS_REQUIRED ?? "")
    .trim()
    .toLowerCase() === "true";
const WORKBOOK_EVENT_CHANNEL_PREFIX = "mw:workbook:events:";
const WORKBOOK_EVENT_SEQ_KEY_PREFIX = "mw:workbook:seq:";
const LIVE_REDIS_QUEUED_EVENT_LIMIT = readPositiveInt(
  process.env.BOARD_RUNTIME_REDIS_LIVE_QUEUE_EVENT_LIMIT,
  96,
  5_000
);

const redisConfig = {
  enabled: REDIS_URL.length > 0,
  required: REDIS_REQUIRED,
  connectTimeoutMs: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_CONNECT_TIMEOUT_MS, 4_000, 60_000),
  initTimeoutMs: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_INIT_TIMEOUT_MS, 8_000, 90_000),
  commandTimeoutMs: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_COMMAND_TIMEOUT_MS, 1_500, 30_000),
  reconnectBaseDelayMs: readPositiveInt(
    process.env.BOARD_RUNTIME_REDIS_RECONNECT_BASE_DELAY_MS,
    150,
    15_000
  ),
  reconnectMaxDelayMs: readPositiveInt(
    process.env.BOARD_RUNTIME_REDIS_RECONNECT_MAX_DELAY_MS,
    5_000,
    120_000
  ),
  reconnectMaxAttempts: readPositiveInt(
    process.env.BOARD_RUNTIME_REDIS_RECONNECT_MAX_ATTEMPTS,
    0,
    100_000
  ),
  initMaxAttempts: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_INIT_MAX_ATTEMPTS, 3, 50),
  initRetryDelayMs: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_INIT_RETRY_DELAY_MS, 600, 30_000),
  commandRetries: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_COMMAND_RETRIES, 1, 10),
  publishRetries: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_PUBLISH_RETRIES, 2, 10),
  keepAliveMs: readPositiveInt(process.env.BOARD_RUNTIME_REDIS_KEEPALIVE_MS, 30_000, 600_000),
  disableOfflineQueue: readBool(process.env.BOARD_RUNTIME_REDIS_DISABLE_OFFLINE_QUEUE, false),
};

export type WorkbookRealtimeEvent = {
  id: string;
  sessionId: string;
  seq: number;
  authorUserId: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type WorkbookRealtimePayload = {
  sessionId: string;
  latestSeq: number;
  events: WorkbookRealtimeEvent[];
  nodeId?: string;
  channel?: "stream" | "live";
};

type WorkbookRealtimeListener = (payload: WorkbookRealtimePayload) => void;

let redisClient: RedisClient | null = null;
let redisSubscriberClient: RedisClient | null = null;
let redisInitPromise: Promise<void> | null = null;

const workbookListenersBySession = new Map<string, Set<WorkbookRealtimeListener>>();
const redisSubscribedWorkbookChannels = new Set<string>();
const liveRedisPublishStateBySession = new Map<
  string,
  {
    inFlight: boolean;
    queued: WorkbookRealtimePayload | null;
  }
>();

const redisStatus: {
  enabled: boolean;
  required: boolean;
  connected: boolean;
  pubsubConnected: boolean;
  reconnecting: boolean;
  clientReconnecting: boolean;
  subscriberReconnecting: boolean;
  initAttempts: number;
  initFailures: number;
  commandTimeouts: number;
  commandRetries: number;
  publishRetries: number;
  publishFailures: number;
  seqAllocationFailures: number;
  reconnectEvents: number;
  lastError: string | null;
  lastConnectedAt: string | null;
  lastInitAt: string | null;
  lastReconnectAt: string | null;
  lastCommandTimeoutAt: string | null;
  lastCommandRetryAt: string | null;
  lastPublishFailureAt: string | null;
  lastPublishRetryAt: string | null;
  lastSeqAllocationFailureAt: string | null;
} = {
  enabled: redisConfig.enabled,
  required: redisConfig.required,
  connected: false,
  pubsubConnected: false,
  reconnecting: false,
  clientReconnecting: false,
  subscriberReconnecting: false,
  initAttempts: 0,
  initFailures: 0,
  commandTimeouts: 0,
  commandRetries: 0,
  publishRetries: 0,
  publishFailures: 0,
  seqAllocationFailures: 0,
  reconnectEvents: 0,
  lastError: null,
  lastConnectedAt: null,
  lastInitAt: null,
  lastReconnectAt: null,
  lastCommandTimeoutAt: null,
  lastCommandRetryAt: null,
  lastPublishFailureAt: null,
  lastPublishRetryAt: null,
  lastSeqAllocationFailureAt: null,
};

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const withTimeout = async <T>(task: () => Promise<T>, timeoutMs: number, timeoutMessage: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      task(),
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error(timeoutMessage)),
          { once: true }
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const summarizeEventTypes = (eventTypes: string[]) =>
  Array.from(new Set(eventTypes.filter((type) => typeof type === "string" && type.length > 0))).slice(
    0,
    6
  );

const normalizeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const markRedisError = (error: unknown) => {
  redisStatus.lastError = normalizeError(error);
};

const refreshRedisReconnectingStatus = () => {
  redisStatus.reconnecting = redisStatus.clientReconnecting || redisStatus.subscriberReconnecting;
};

const clearRedisErrorWhenHealthy = () => {
  if (redisStatus.connected && redisStatus.pubsubConnected && !redisStatus.reconnecting) {
    redisStatus.lastError = null;
  }
};

const setRedisClientReconnecting = (isSubscriber: boolean, reconnecting: boolean) => {
  if (isSubscriber) {
    redisStatus.subscriberReconnecting = reconnecting;
  } else {
    redisStatus.clientReconnecting = reconnecting;
  }
  refreshRedisReconnectingStatus();
};

const isRetryableRedisError = (error: unknown) => {
  const message = normalizeError(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes("timeout") ||
    message.includes("socket") ||
    message.includes("connect") ||
    message.includes("econnreset") ||
    message.includes("abort") ||
    message.includes("closed")
  );
};

const workbookChannel = (sessionId: string) => `${WORKBOOK_EVENT_CHANNEL_PREFIX}${sessionId}`;

const workbookSeqKey = (sessionId: string) => `${WORKBOOK_EVENT_SEQ_KEY_PREFIX}${sessionId}`;

const dispatchWorkbookRealtimePayload = (sessionId: string, payload: WorkbookRealtimePayload) => {
  const listeners = workbookListenersBySession.get(sessionId);
  if (!listeners || listeners.size === 0) return;
  for (const listener of listeners.values()) {
    try {
      listener(payload);
    } catch {
      // ignore listener failures and keep other listeners alive
    }
  }
};

const createReconnectStrategy = () =>
  (retries: number) => {
    if (redisConfig.reconnectMaxAttempts > 0 && retries >= redisConfig.reconnectMaxAttempts) {
      return new Error("redis_reconnect_attempts_exhausted");
    }
    const exponentialDelay = Math.min(
      redisConfig.reconnectMaxDelayMs,
      redisConfig.reconnectBaseDelayMs * 2 ** Math.min(10, retries)
    );
    const jitter = Math.floor(Math.random() * 150);
    return exponentialDelay + jitter;
  };

const bindRedisClientEvents = (client: RedisClient, isSubscriber: boolean) => {
  client.on("error", (error) => {
    markRedisError(error);
    if (isSubscriber) {
      redisStatus.pubsubConnected = false;
    } else {
      redisStatus.connected = false;
    }
  });
  client.on("ready", () => {
    if (isSubscriber) {
      redisStatus.pubsubConnected = true;
      setRedisClientReconnecting(true, false);
      clearRedisErrorWhenHealthy();
      return;
    }
    redisStatus.connected = true;
    setRedisClientReconnecting(false, false);
    redisStatus.lastConnectedAt = new Date().toISOString();
    clearRedisErrorWhenHealthy();
  });
  client.on("reconnecting", () => {
    if (isSubscriber) {
      redisStatus.pubsubConnected = false;
    } else {
      redisStatus.connected = false;
    }
    setRedisClientReconnecting(isSubscriber, true);
    redisStatus.reconnectEvents += 1;
    redisStatus.lastReconnectAt = new Date().toISOString();
  });
  client.on("end", () => {
    if (isSubscriber) {
      redisStatus.pubsubConnected = false;
      setRedisClientReconnecting(true, false);
      return;
    }
    redisStatus.connected = false;
    setRedisClientReconnecting(false, false);
  });
};

const ensureRedisSubscribersConnected = async () => {
  if (!redisClient) return;
  if (redisSubscriberClient) return;
  const subscriber = redisClient.duplicate();
  bindRedisClientEvents(subscriber, true);
  await withTimeout(
    () => subscriber.connect(),
    redisConfig.initTimeoutMs,
    "redis_subscriber_connect_timeout"
  );
  redisSubscriberClient = subscriber;
  redisStatus.pubsubConnected = true;
};

const ensureWorkbookChannelSubscribed = async (sessionId: string) => {
  if (!redisSubscriberClient) return;
  const channel = workbookChannel(sessionId);
  if (redisSubscribedWorkbookChannels.has(channel)) return;
  await redisSubscriberClient.subscribe(channel, (rawMessage: string) => {
    let parsed: WorkbookRealtimePayload | null = null;
    try {
      const candidate = JSON.parse(rawMessage) as WorkbookRealtimePayload;
      if (
        candidate &&
        typeof candidate === "object" &&
        typeof candidate.sessionId === "string" &&
        Array.isArray(candidate.events)
      ) {
        parsed = candidate;
      }
    } catch {
      parsed = null;
    }
    if (!parsed) return;
    dispatchWorkbookRealtimePayload(sessionId, parsed);
  });
  redisSubscribedWorkbookChannels.add(channel);
};

const maybeUnsubscribeWorkbookChannel = async (sessionId: string) => {
  if (!redisSubscriberClient) return;
  const channel = workbookChannel(sessionId);
  if (!redisSubscribedWorkbookChannels.has(channel)) return;
  const listeners = workbookListenersBySession.get(sessionId);
  if (listeners && listeners.size > 0) return;
  await redisSubscriberClient.unsubscribe(channel);
  redisSubscribedWorkbookChannels.delete(channel);
};

const runRedisCommand = async <T>(label: string, task: () => Promise<T>): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= redisConfig.commandRetries; attempt += 1) {
    try {
      return await withTimeout(task, redisConfig.commandTimeoutMs, `${label}_timeout`);
    } catch (error) {
      lastError = error;
      if (normalizeError(error).includes("_timeout")) {
        redisStatus.commandTimeouts += 1;
        redisStatus.lastCommandTimeoutAt = new Date().toISOString();
      }
      if (attempt >= redisConfig.commandRetries || !isRetryableRedisError(error)) {
        throw error;
      }
      redisStatus.commandRetries += 1;
      redisStatus.lastCommandRetryAt = new Date().toISOString();
      await sleep(Math.min(2000, 100 + attempt * 120));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label}_failed`);
};

const disconnectClient = async (client: RedisClient | null) => {
  if (!client) return;
  await client.quit().catch(() => undefined);
};

const createRedisClient = async () => {
  const { createClient } = await import("redis");
  const options = {
    url: REDIS_URL,
    socket: {
      connectTimeout: redisConfig.connectTimeoutMs,
      keepAlive: redisConfig.keepAliveMs,
      reconnectStrategy: createReconnectStrategy(),
    },
    disableOfflineQueue: redisConfig.disableOfflineQueue,
  };
  const client = createClient(options as unknown as Parameters<typeof createClient>[0]);
  bindRedisClientEvents(client, false);
  return client;
};

export const initializeRuntimeServices = async () => {
  if (!redisConfig.enabled) {
    if (redisConfig.required) {
      throw new Error("REDIS_URL is required when BOARD_RUNTIME_REDIS_REQUIRED is enabled");
    }
    return;
  }
  if (redisClient && redisSubscriberClient && redisStatus.connected) return;
  if (redisInitPromise) return redisInitPromise;

  redisInitPromise = (async () => {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= redisConfig.initMaxAttempts; attempt += 1) {
      redisStatus.initAttempts += 1;
      redisStatus.lastInitAt = new Date().toISOString();
      let client: RedisClient | null = null;
      let subscriber: RedisClient | null = null;
      try {
        client = await createRedisClient();
        await withTimeout(() => client!.connect(), redisConfig.initTimeoutMs, "redis_connect_timeout");
        await runRedisCommand("redis_ping", () => client!.ping());

        redisClient = client;
        redisStatus.connected = true;
        setRedisClientReconnecting(false, false);
        redisStatus.lastConnectedAt = new Date().toISOString();

        subscriber = redisClient.duplicate();
        bindRedisClientEvents(subscriber, true);
        await withTimeout(
          () => subscriber!.connect(),
          redisConfig.initTimeoutMs,
          "redis_subscriber_connect_timeout"
        );
        redisSubscriberClient = subscriber;
        redisStatus.pubsubConnected = true;
        setRedisClientReconnecting(true, false);
        clearRedisErrorWhenHealthy();
        return;
      } catch (error) {
        lastError = error;
        redisStatus.initFailures += 1;
        redisStatus.connected = false;
        redisStatus.pubsubConnected = false;
        setRedisClientReconnecting(false, false);
        setRedisClientReconnecting(true, false);
        markRedisError(error);
        await Promise.allSettled([disconnectClient(subscriber), disconnectClient(client)]);
        redisClient = null;
        redisSubscriberClient = null;
        if (attempt < redisConfig.initMaxAttempts) {
          await sleep(redisConfig.initRetryDelayMs * attempt);
        }
      }
    }

    if (redisConfig.required) {
      throw lastError instanceof Error ? lastError : new Error("redis_init_failed");
    }
  })().finally(() => {
    redisInitPromise = null;
  });

  return redisInitPromise;
};

export const getWorkbookRuntimeSequence = async (sessionId: string): Promise<number | null> => {
  if (!redisClient) return null;
  try {
    const raw = await runRedisCommand("redis_get_runtime_seq", () => redisClient!.get(workbookSeqKey(sessionId)));
    if (!raw) return 0;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  } catch (error) {
    markRedisError(error);
    return null;
  }
};

export const allocateWorkbookRuntimeSequence = async (params: {
  sessionId: string;
  count: number;
  fallbackBaseSeq?: number;
}): Promise<{ from: number; to: number } | null> => {
  if (!redisClient) return null;
  const count = Number.isFinite(params.count) ? Math.max(1, Math.floor(params.count)) : 1;
  const fallbackBaseSeq = Number.isFinite(params.fallbackBaseSeq)
    ? Math.max(0, Math.floor(params.fallbackBaseSeq ?? 0))
    : 0;
  const key = workbookSeqKey(params.sessionId);
  try {
    if (fallbackBaseSeq > 0) {
      await runRedisCommand("redis_setnx_runtime_seq", () => redisClient!.setNX(key, String(fallbackBaseSeq)));
      const currentRaw = await runRedisCommand("redis_get_runtime_seq", () => redisClient!.get(key));
      const current = Number(currentRaw ?? "0");
      if (!Number.isFinite(current) || current < fallbackBaseSeq) {
        await runRedisCommand("redis_set_runtime_seq", () => redisClient!.set(key, String(fallbackBaseSeq)));
      }
    }
    const endSeqRaw = await runRedisCommand("redis_incr_runtime_seq", () => redisClient!.incrBy(key, count));
    const endSeq = Number(endSeqRaw);
    if (!Number.isFinite(endSeq)) return null;
    return {
      from: endSeq - count + 1,
      to: endSeq,
    };
  } catch (error) {
    redisStatus.seqAllocationFailures += 1;
    redisStatus.lastSeqAllocationFailureAt = new Date().toISOString();
    markRedisError(error);
    return null;
  }
};

const mergeLiveRedisPayload = (
  current: WorkbookRealtimePayload | null,
  incoming: WorkbookRealtimePayload
): WorkbookRealtimePayload => {
  if (!current) {
    return {
      ...incoming,
      events: incoming.events.slice(-LIVE_REDIS_QUEUED_EVENT_LIMIT),
      channel: "live",
    };
  }
  return {
    ...incoming,
    latestSeq: Math.max(current.latestSeq, incoming.latestSeq),
    events: [...current.events, ...incoming.events].slice(-LIVE_REDIS_QUEUED_EVENT_LIMIT),
    channel: "live",
  };
};

const publishWorkbookRealtimePayloadNow = async (
  sessionId: string,
  payload: WorkbookRealtimePayload
): Promise<boolean> => {
  const startedAt = nowMs();
  if (!redisClient) return false;
  const message = JSON.stringify(payload);
  let publishError: unknown = null;

  for (let attempt = 0; attempt <= redisConfig.publishRetries; attempt += 1) {
    try {
      await runRedisCommand("redis_publish_runtime", () => redisClient!.publish(workbookChannel(sessionId), message));
      recordWorkbookServerTrace({
        scope: "workbook",
        op: "publish_runtime",
        channel: payload.channel === "live" ? "live" : "stream",
        sessionId,
        eventCount: payload.events.length,
        eventTypes: summarizeEventTypes(payload.events.map((event) => event.type)),
        durationMs: nowMs() - startedAt,
        latestSeq: payload.latestSeq,
        success: true,
      });
      return true;
    } catch (error) {
      publishError = error;
      if (attempt >= redisConfig.publishRetries || !isRetryableRedisError(error)) {
        break;
      }
      redisStatus.publishRetries += 1;
      redisStatus.lastPublishRetryAt = new Date().toISOString();
      await sleep(Math.min(2_000, 120 + attempt * 180));
    }
  }

  redisStatus.publishFailures += 1;
  redisStatus.lastPublishFailureAt = new Date().toISOString();
  markRedisError(publishError);
  recordWorkbookServerTrace({
    scope: "workbook",
    op: "publish_runtime",
    channel: payload.channel === "live" ? "live" : "stream",
    sessionId,
    eventCount: payload.events.length,
    eventTypes: summarizeEventTypes(payload.events.map((event) => event.type)),
    durationMs: nowMs() - startedAt,
    latestSeq: payload.latestSeq,
    success: false,
    error: normalizeError(publishError),
  });
  return false;
};

const flushLiveRedisPublishQueue = async (
  sessionId: string,
  initialPayload: WorkbookRealtimePayload
) => {
  const state = liveRedisPublishStateBySession.get(sessionId);
  if (!state) return false;
  state.inFlight = true;
  let payload: WorkbookRealtimePayload | null = initialPayload;
  let success = true;
  try {
    while (payload) {
      success = (await publishWorkbookRealtimePayloadNow(sessionId, payload)) && success;
      payload = state.queued;
      state.queued = null;
    }
    return success;
  } finally {
    state.inFlight = false;
    if (state.queued) {
      const queued = state.queued;
      state.queued = null;
      void flushLiveRedisPublishQueue(sessionId, queued);
    } else {
      liveRedisPublishStateBySession.delete(sessionId);
    }
  }
};

export const publishWorkbookRealtimePayload = async (
  sessionId: string,
  payload: WorkbookRealtimePayload
): Promise<boolean> => {
  if (payload.channel !== "live") {
    return publishWorkbookRealtimePayloadNow(sessionId, payload);
  }
  let state = liveRedisPublishStateBySession.get(sessionId);
  if (state?.inFlight) {
    state.queued = mergeLiveRedisPayload(state.queued, payload);
    return true;
  }
  if (!state) {
    state = {
      inFlight: false,
      queued: null,
    };
    liveRedisPublishStateBySession.set(sessionId, state);
  }
  return flushLiveRedisPublishQueue(sessionId, payload);
};

export const subscribeWorkbookRealtimePayload = async (
  sessionId: string,
  listener: WorkbookRealtimeListener
) => {
  let listeners = workbookListenersBySession.get(sessionId);
  if (!listeners) {
    listeners = new Set();
    workbookListenersBySession.set(sessionId, listeners);
  }
  listeners.add(listener);

  if (!redisSubscriberClient && redisClient) {
    try {
      await ensureRedisSubscribersConnected();
    } catch (error) {
      markRedisError(error);
    }
  }

  if (redisSubscriberClient) {
    try {
      await ensureWorkbookChannelSubscribed(sessionId);
    } catch (error) {
      markRedisError(error);
    }
  }

  return async () => {
    const current = workbookListenersBySession.get(sessionId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      workbookListenersBySession.delete(sessionId);
    }
    if (redisSubscriberClient) {
      try {
        await maybeUnsubscribeWorkbookChannel(sessionId);
      } catch (error) {
        markRedisError(error);
      }
    }
  };
};

export const getRuntimeServicesStatus = () => ({
  redis: {
    enabled: redisStatus.enabled,
    required: redisStatus.required,
    connected: redisStatus.connected,
    pubsubConnected: redisStatus.pubsubConnected,
    reconnecting: redisStatus.reconnecting,
    clientReconnecting: redisStatus.clientReconnecting,
    subscriberReconnecting: redisStatus.subscriberReconnecting,
    initAttempts: redisStatus.initAttempts,
    initFailures: redisStatus.initFailures,
    reconnectEvents: redisStatus.reconnectEvents,
    commandTimeouts: redisStatus.commandTimeouts,
    commandRetries: redisStatus.commandRetries,
    publishRetries: redisStatus.publishRetries,
    publishFailures: redisStatus.publishFailures,
    seqAllocationFailures: redisStatus.seqAllocationFailures,
    subscribedChannels: redisSubscribedWorkbookChannels.size,
    listenerSessions: workbookListenersBySession.size,
    livePublishInFlightSessions: Array.from(liveRedisPublishStateBySession.values()).filter(
      (state) => state.inFlight
    ).length,
    livePublishQueuedSessions: Array.from(liveRedisPublishStateBySession.values()).filter(
      (state) => state.queued
    ).length,
    lastConnectedAt: redisStatus.lastConnectedAt,
    lastInitAt: redisStatus.lastInitAt,
    lastReconnectAt: redisStatus.lastReconnectAt,
    lastCommandTimeoutAt: redisStatus.lastCommandTimeoutAt,
    lastCommandRetryAt: redisStatus.lastCommandRetryAt,
    lastPublishFailureAt: redisStatus.lastPublishFailureAt,
    lastPublishRetryAt: redisStatus.lastPublishRetryAt,
    lastSeqAllocationFailureAt: redisStatus.lastSeqAllocationFailureAt,
    lastError: redisStatus.lastError,
    config: {
      connectTimeoutMs: redisConfig.connectTimeoutMs,
      initTimeoutMs: redisConfig.initTimeoutMs,
      commandTimeoutMs: redisConfig.commandTimeoutMs,
      liveQueuedEventLimit: LIVE_REDIS_QUEUED_EVENT_LIMIT,
      reconnectBaseDelayMs: redisConfig.reconnectBaseDelayMs,
      reconnectMaxDelayMs: redisConfig.reconnectMaxDelayMs,
      reconnectMaxAttempts: redisConfig.reconnectMaxAttempts,
      initMaxAttempts: redisConfig.initMaxAttempts,
      initRetryDelayMs: redisConfig.initRetryDelayMs,
      commandRetries: redisConfig.commandRetries,
      publishRetries: redisConfig.publishRetries,
      keepAliveMs: redisConfig.keepAliveMs,
      disableOfflineQueue: redisConfig.disableOfflineQueue,
    },
  },
});

export const shutdownRuntimeServices = async () => {
  const tasks: Promise<unknown>[] = [];
  if (redisSubscriberClient) {
    tasks.push(redisSubscriberClient.quit().catch(() => undefined));
  }
  if (redisClient) {
    tasks.push(redisClient.quit().catch(() => undefined));
  }
  await Promise.allSettled(tasks);
  redisClient = null;
  redisSubscriberClient = null;
  redisSubscribedWorkbookChannels.clear();
  workbookListenersBySession.clear();
  liveRedisPublishStateBySession.clear();
  redisStatus.connected = false;
  redisStatus.pubsubConnected = false;
  redisStatus.clientReconnecting = false;
  redisStatus.subscriberReconnecting = false;
  refreshRedisReconnectingStatus();
};
