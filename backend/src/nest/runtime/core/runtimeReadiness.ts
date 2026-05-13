import { getStorageDiagnostics } from "./db";
import { getRuntimeServicesStatus } from "./runtimeServices";

type WorkbookStorageDiagnostics = ReturnType<typeof getStorageDiagnostics>;
type WorkbookRuntimeServicesStatus = ReturnType<typeof getRuntimeServicesStatus>;

export type WorkbookPersistenceReadiness = {
  ready: boolean;
  reasons: string[];
  storage: WorkbookStorageDiagnostics;
  runtime: WorkbookRuntimeServicesStatus;
};

export type WorkbookRuntimeReadiness = WorkbookPersistenceReadiness & {
  persistenceReady: boolean;
  persistenceReasons: string[];
  runtimeReady: boolean;
  runtimeReasons: string[];
};

type WorkbookReadinessInputs = {
  storage: WorkbookStorageDiagnostics;
  runtime: WorkbookRuntimeServicesStatus;
};

const collectWorkbookPersistenceReasons = (storage: WorkbookStorageDiagnostics) => {
  const reasons: string[] = [];
  if (!storage.ready) {
    reasons.push("storage_not_ready");
  }
  if (storage.required && storage.driver !== "postgres") {
    reasons.push("storage_driver_degraded");
  }
  return reasons;
};

const collectWorkbookRuntimeReasons = (runtime: WorkbookRuntimeServicesStatus) => {
  const reasons: string[] = [];
  if (runtime.redis.required && !runtime.redis.connected) {
    reasons.push("runtime_redis_not_connected");
  }
  if (runtime.redis.required && !runtime.redis.pubsubConnected) {
    reasons.push("runtime_redis_pubsub_not_connected");
  }
  return reasons;
};

export const buildWorkbookPersistenceReadiness = ({
  storage,
  runtime,
}: WorkbookReadinessInputs): WorkbookPersistenceReadiness => {
  const reasons = collectWorkbookPersistenceReasons(storage);
  return {
    ready: reasons.length === 0,
    reasons,
    storage,
    runtime,
  };
};

export const buildWorkbookRuntimeReadiness = ({
  storage,
  runtime,
}: WorkbookReadinessInputs): WorkbookRuntimeReadiness => {
  const persistence = buildWorkbookPersistenceReadiness({ storage, runtime });
  const runtimeReasons = collectWorkbookRuntimeReasons(persistence.runtime);
  const reasons = [...persistence.reasons, ...runtimeReasons];
  return {
    ready: reasons.length === 0,
    reasons,
    storage: persistence.storage,
    runtime: persistence.runtime,
    persistenceReady: persistence.ready,
    persistenceReasons: persistence.reasons,
    runtimeReady: runtimeReasons.length === 0,
    runtimeReasons,
  };
};

export const getWorkbookPersistenceReadiness = (): WorkbookPersistenceReadiness =>
  buildWorkbookPersistenceReadiness({
    storage: getStorageDiagnostics(),
    runtime: getRuntimeServicesStatus(),
  });

export const getWorkbookRuntimeReadiness = (): WorkbookRuntimeReadiness =>
  buildWorkbookRuntimeReadiness({
    storage: getStorageDiagnostics(),
    runtime: getRuntimeServicesStatus(),
  });
