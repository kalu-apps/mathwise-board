import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { nestEnv } from "../nest-env";

type CachedResponse = {
  statusCode: number;
  contentType: string;
  body: unknown;
  expiresAt: number;
};

export type IdempotencyRunResult = {
  statusCode: number;
  contentType: string;
  body: unknown;
  cached: boolean;
};

type IdempotencyStats = {
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
};

@Injectable()
export class NestIdempotencyService {
  private readonly records = new Map<string, CachedResponse>();
  private readonly ttlMs = nestEnv.idempotencyTtlMs;
  private readonly maxRecords = nestEnv.idempotencyMaxRecords;
  private readonly sampleRate = nestEnv.idempotencySampleRate;
  private readonly stats: IdempotencyStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    evictions: 0,
  };

  private evictExpired(now: number) {
    for (const [key, value] of this.records.entries()) {
      if (value.expiresAt > now) continue;
      this.records.delete(key);
      this.stats.evictions += 1;
    }
  }

  private ensureCapacity() {
    const overflow = this.records.size - this.maxRecords;
    if (overflow <= 0) return;
    const keys = this.records.keys();
    for (let index = 0; index < overflow; index += 1) {
      const key = keys.next().value;
      if (!key) break;
      this.records.delete(key);
      this.stats.evictions += 1;
    }
  }

  createFallbackKey(scope: string, sessionId: string, payload: unknown) {
    const fingerprint = stableJsonSha256(payload);
    return `${scope}:${sessionId}:${fingerprint}`;
  }

  async run(
    key: string | null,
    execute: () => Promise<{ statusCode: number; contentType: string; body: unknown }>
  ): Promise<IdempotencyRunResult> {
    if (!key || Math.random() > this.sampleRate) {
      const result = await execute();
      return { ...result, cached: false };
    }
    const now = Date.now();
    this.evictExpired(now);
    const cached = this.records.get(key);
    if (cached && cached.expiresAt > now) {
      this.stats.hits += 1;
      return {
        statusCode: cached.statusCode,
        contentType: cached.contentType,
        body: cached.body,
        cached: true,
      };
    }
    this.stats.misses += 1;
    const result = await execute();
    if (result.statusCode >= 200 && result.statusCode < 300) {
      this.records.set(key, {
        statusCode: result.statusCode,
        contentType: result.contentType,
        body: result.body,
        expiresAt: now + this.ttlMs,
      });
      this.stats.writes += 1;
      this.ensureCapacity();
    }
    return { ...result, cached: false };
  }

  getDiagnostics() {
    return {
      ttlMs: this.ttlMs,
      maxRecords: this.maxRecords,
      records: this.records.size,
      sampleRate: this.sampleRate,
      ...this.stats,
    };
  }
}

const stableJsonSha256 = (value: unknown) => {
  const normalized = stableStringify(value);
  return crypto.createHash("sha256").update(normalized).digest("hex");
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
};
