type RedisClient = import("redis").RedisClientType;

const REDIS_URL = String(process.env.REDIS_URL ?? "").trim();
const WORKBOOK_EVENT_CHANNEL_PREFIX = "mw:workbook:events:";
const WORKBOOK_EVENT_SEQ_KEY_PREFIX = "mw:workbook:seq:";

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
};

type WorkbookRealtimeListener = (payload: WorkbookRealtimePayload) => void;

let redisClient: RedisClient | null = null;
let redisSubscriberClient: RedisClient | null = null;
let redisInitPromise: Promise<void> | null = null;

const workbookListenersBySession = new Map<string, Set<WorkbookRealtimeListener>>();
const redisSubscribedWorkbookChannels = new Set<string>();

const redisStatus: {
  enabled: boolean;
  connected: boolean;
  pubsubConnected: boolean;
  lastError: string | null;
} = {
  enabled: REDIS_URL.length > 0,
  connected: false,
  pubsubConnected: false,
  lastError: null,
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const markRedisError = (error: unknown) => {
  redisStatus.lastError = normalizeError(error);
};

const workbookChannel = (sessionId: string) =>
  `${WORKBOOK_EVENT_CHANNEL_PREFIX}${sessionId}`;

const workbookSeqKey = (sessionId: string) =>
  `${WORKBOOK_EVENT_SEQ_KEY_PREFIX}${sessionId}`;

const dispatchWorkbookRealtimePayload = (
  sessionId: string,
  payload: WorkbookRealtimePayload
) => {
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

const ensureRedisSubscribersConnected = async () => {
  if (!redisClient) return;
  if (redisSubscriberClient) return;
  const subscriber = redisClient.duplicate();
  subscriber.on("error", (error) => {
    redisStatus.pubsubConnected = false;
    markRedisError(error);
  });
  await subscriber.connect();
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

export const initializeRuntimeServices = async () => {
  if (!REDIS_URL) return;
  if (redisClient && redisSubscriberClient) return;
  if (redisInitPromise) return redisInitPromise;
  redisInitPromise = (async () => {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: REDIS_URL });
      client.on("error", (error) => {
        redisStatus.connected = false;
        markRedisError(error);
      });
      await client.connect();
      await client.ping();
      redisClient = client;
      redisStatus.connected = true;
      redisStatus.lastError = null;
      await ensureRedisSubscribersConnected();
    } catch (error) {
      markRedisError(error);
      redisStatus.connected = false;
      redisStatus.pubsubConnected = false;
    }
  })().finally(() => {
    redisInitPromise = null;
  });
  return redisInitPromise;
};

export const getWorkbookRuntimeSequence = async (sessionId: string): Promise<number | null> => {
  if (!redisClient) return null;
  try {
    const raw = await redisClient.get(workbookSeqKey(sessionId));
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
      await redisClient.setNX(key, String(fallbackBaseSeq));
      const currentRaw = await redisClient.get(key);
      const current = Number(currentRaw ?? "0");
      if (!Number.isFinite(current) || current < fallbackBaseSeq) {
        await redisClient.set(key, String(fallbackBaseSeq));
      }
    }
    const endSeqRaw = await redisClient.incrBy(key, count);
    const endSeq = Number(endSeqRaw);
    if (!Number.isFinite(endSeq)) return null;
    return {
      from: endSeq - count + 1,
      to: endSeq,
    };
  } catch (error) {
    markRedisError(error);
    return null;
  }
};

export const publishWorkbookRealtimePayload = async (
  sessionId: string,
  payload: WorkbookRealtimePayload
): Promise<boolean> => {
  if (!redisClient) return false;
  try {
    await redisClient.publish(workbookChannel(sessionId), JSON.stringify(payload));
    return true;
  } catch (error) {
    markRedisError(error);
    return false;
  }
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
    connected: redisStatus.connected,
    pubsubConnected: redisStatus.pubsubConnected,
    lastError: redisStatus.lastError,
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
  redisStatus.connected = false;
  redisStatus.pubsubConnected = false;
};
