import { getStorageDiagnostics } from "./db";
import { getRuntimeServicesStatus } from "./runtimeServices";

export type WorkbookPersistenceReadiness = {
  ready: boolean;
  reasons: string[];
  storage: ReturnType<typeof getStorageDiagnostics>;
  runtime: ReturnType<typeof getRuntimeServicesStatus>;
};

export const getWorkbookPersistenceReadiness = (): WorkbookPersistenceReadiness => {
  const storage = getStorageDiagnostics();
  const runtime = getRuntimeServicesStatus();
  const reasons: string[] = [];
  if (!storage.ready) {
    reasons.push("storage_not_ready");
  }
  if (storage.required && storage.driver !== "postgres") {
    reasons.push("storage_driver_degraded");
  }
  if (runtime.redis.required && !runtime.redis.connected) {
    reasons.push("runtime_redis_not_connected");
  }
  return {
    ready: reasons.length === 0,
    reasons,
    storage,
    runtime,
  };
};
