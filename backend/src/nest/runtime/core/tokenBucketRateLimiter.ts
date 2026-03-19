type TokenBucketRateLimiterOptions = {
  capacity: number;
  refillPerSecond: number;
  idleTtlMs?: number;
  maxKeys?: number;
};

type TokenBucketState = {
  tokens: number;
  lastRefillAt: number;
  lastAccessAt: number;
};

export type TokenBucketConsumeResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

const normalizePositiveInt = (value: number | undefined, fallback: number, min: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.floor(value ?? fallback));
};

const refillTokens = (
  bucket: TokenBucketState,
  now: number,
  capacity: number,
  refillPerMs: number
) => {
  if (now <= bucket.lastRefillAt) return;
  const elapsedMs = now - bucket.lastRefillAt;
  const refill = elapsedMs * refillPerMs;
  if (refill <= 0) return;
  bucket.tokens = Math.min(capacity, bucket.tokens + refill);
  bucket.lastRefillAt = now;
};

export const createTokenBucketRateLimiter = (
  options: TokenBucketRateLimiterOptions
) => {
  const capacity = normalizePositiveInt(options.capacity, 120, 1);
  const refillPerSecond = normalizePositiveInt(options.refillPerSecond, 90, 1);
  const idleTtlMs = normalizePositiveInt(options.idleTtlMs, 2 * 60_000, 10_000);
  const maxKeys = normalizePositiveInt(options.maxKeys, 20_000, 256);
  const refillPerMs = refillPerSecond / 1_000;
  const buckets = new Map<string, TokenBucketState>();
  let consumeCount = 0;

  const sweep = (now = Date.now()) => {
    if (buckets.size === 0) return;
    const idleBefore = now - idleTtlMs;
    buckets.forEach((state, key) => {
      if (state.lastAccessAt < idleBefore) {
        buckets.delete(key);
      }
    });
    if (buckets.size <= maxKeys) return;
    const overflow = buckets.size - maxKeys;
    const sortedByAccess = Array.from(buckets.entries()).sort(
      (left, right) => left[1].lastAccessAt - right[1].lastAccessAt
    );
    for (let index = 0; index < overflow; index += 1) {
      const key = sortedByAccess[index]?.[0];
      if (!key) continue;
      buckets.delete(key);
    }
  };

  const consume = (key: string, cost = 1): TokenBucketConsumeResult => {
    const now = Date.now();
    const normalizedCost = Math.max(1, Math.floor(cost));
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefillAt: now,
        lastAccessAt: now,
      };
      buckets.set(key, bucket);
    } else {
      refillTokens(bucket, now, capacity, refillPerMs);
      bucket.lastAccessAt = now;
    }

    consumeCount += 1;
    if (consumeCount % 256 === 0) {
      sweep(now);
    }

    if (bucket.tokens >= normalizedCost) {
      bucket.tokens -= normalizedCost;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfterMs: 0,
      };
    }

    const missingTokens = normalizedCost - bucket.tokens;
    const retryAfterMs = Math.max(100, Math.ceil(missingTokens / refillPerMs));
    return {
      allowed: false,
      remaining: Math.floor(Math.max(0, bucket.tokens)),
      retryAfterMs,
    };
  };

  return {
    consume,
    sweep,
    size: () => buckets.size,
  };
};
