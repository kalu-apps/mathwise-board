import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkbookPersistenceReadiness,
  buildWorkbookRuntimeReadiness,
} from "./runtimeReadiness";

const storageReady = {
  ready: true,
  required: true,
  driver: "postgres",
} as Parameters<typeof buildWorkbookPersistenceReadiness>[0]["storage"];

const runtimeRedisUnavailable = {
  redis: {
    required: true,
    connected: false,
    pubsubConnected: false,
  },
} as Parameters<typeof buildWorkbookPersistenceReadiness>[0]["runtime"];

test("workbook persistence readiness does not depend on Redis pubsub availability", () => {
  const readiness = buildWorkbookPersistenceReadiness({
    storage: storageReady,
    runtime: runtimeRedisUnavailable,
  });

  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.reasons, []);
});

test("workbook runtime readiness still reports required Redis degradation", () => {
  const readiness = buildWorkbookRuntimeReadiness({
    storage: storageReady,
    runtime: runtimeRedisUnavailable,
  });

  assert.equal(readiness.ready, false);
  assert.equal(readiness.persistenceReady, true);
  assert.equal(readiness.runtimeReady, false);
  assert.deepEqual(readiness.runtimeReasons, [
    "runtime_redis_not_connected",
    "runtime_redis_pubsub_not_connected",
  ]);
});
