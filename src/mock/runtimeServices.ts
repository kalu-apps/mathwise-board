type RedisClient = import("redis").RedisClientType;

const REDIS_URL = String(process.env.REDIS_URL ?? "").trim();

let redisClient: RedisClient | null = null;
let redisInitPromise: Promise<void> | null = null;

const redisStatus: {
  enabled: boolean;
  connected: boolean;
  lastError: string | null;
} = {
  enabled: REDIS_URL.length > 0,
  connected: false,
  lastError: null,
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const initializeRuntimeServices = async () => {
  if (!REDIS_URL) return;
  if (redisClient) return;
  if (redisInitPromise) return redisInitPromise;
  redisInitPromise = (async () => {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: REDIS_URL });
      client.on("error", (error) => {
        redisStatus.lastError = normalizeError(error);
        redisStatus.connected = false;
      });
      await client.connect();
      await client.ping();
      redisClient = client;
      redisStatus.connected = true;
      redisStatus.lastError = null;
    } catch (error) {
      redisStatus.lastError = normalizeError(error);
      redisStatus.connected = false;
    }
  })().finally(() => {
    redisInitPromise = null;
  });
  return redisInitPromise;
};

export const getRuntimeServicesStatus = () => ({
  redis: {
    enabled: redisStatus.enabled,
    connected: redisStatus.connected,
    lastError: redisStatus.lastError,
  },
});

export const shutdownRuntimeServices = async () => {
  if (!redisClient) return;
  await redisClient.quit().catch(() => undefined);
  redisClient = null;
  redisStatus.connected = false;
};
