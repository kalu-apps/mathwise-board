import { ConflictException, Injectable } from "@nestjs/common";
import { nestEnv } from "../nest-env";

type WorkbookEventInput = {
  type: string;
  payload: unknown;
  clientEventId?: string;
};

type ObjectVersionState = {
  version: number;
  deleted: boolean;
  updatedAt: string;
};

type VersionConflict = {
  objectId: string;
  type: string;
  expectedVersion: number | null;
  actualVersion: number;
  reason: string;
};

@Injectable()
export class WorkbookObjectVersionGuardService {
  private readonly strict = nestEnv.objectVersionStrict;
  private readonly statesBySession = new Map<string, Map<string, ObjectVersionState>>();
  private readonly locksBySession = new Map<string, Promise<void>>();
  private conflictCount = 0;
  private acceptCount = 0;

  private normalizeVersion(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.max(0, Math.trunc(value));
  }

  private readSessionState(sessionId: string) {
    const existing = this.statesBySession.get(sessionId);
    if (existing) return existing;
    const created = new Map<string, ObjectVersionState>();
    this.statesBySession.set(sessionId, created);
    return created;
  }

  private parseMutation(event: WorkbookEventInput) {
    if (!event || typeof event !== "object") return null;
    const payload =
      event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : null;
    if (!payload) return null;
    if (event.type === "board.object.create") {
      const object =
        payload.object && typeof payload.object === "object"
          ? (payload.object as Record<string, unknown>)
          : null;
      const objectId = typeof object?.id === "string" ? object.id.trim() : "";
      if (!objectId) return null;
      return {
        event,
        objectId,
        type: event.type,
        payload,
        objectPayload: object,
      };
    }
    if (
      event.type === "board.object.update" ||
      event.type === "board.object.delete" ||
      event.type === "board.object.pin"
    ) {
      const objectId = typeof payload.objectId === "string" ? payload.objectId.trim() : "";
      if (!objectId) return null;
      return {
        event,
        objectId,
        type: event.type,
        payload,
        objectPayload: null,
      };
    }
    return null;
  }

  private planVersionUpdate(params: {
    current: ObjectVersionState | null;
    expectedVersion: number | null;
    type: string;
  }) {
    const currentVersion = params.current?.version ?? 0;
    if (this.strict && params.expectedVersion === null) {
      return {
        ok: false as const,
        reason: "missing_expected_version",
        actualVersion: currentVersion,
      };
    }
    if (params.expectedVersion !== null && params.expectedVersion !== currentVersion) {
      return {
        ok: false as const,
        reason: "expected_version_mismatch",
        actualVersion: currentVersion,
      };
    }
    if (params.type === "board.object.create" && params.current && !params.current.deleted) {
      return {
        ok: false as const,
        reason: "object_already_exists",
        actualVersion: currentVersion,
      };
    }
    if (params.type !== "board.object.create" && !params.current) {
      return {
        ok: false as const,
        reason: "object_not_found",
        actualVersion: 0,
      };
    }
    if (params.type !== "board.object.create" && params.current?.deleted) {
      return {
        ok: false as const,
        reason: "object_deleted",
        actualVersion: currentVersion,
      };
    }
    return {
      ok: true as const,
      nextVersion: currentVersion + 1,
      actualVersion: currentVersion,
    };
  }

  async withSessionLock<T>(sessionId: string, task: () => Promise<T>) {
    const activeLock = this.locksBySession.get(sessionId) ?? Promise.resolve();
    let release = () => undefined;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locksBySession.set(
      sessionId,
      activeLock.then(() => nextLock).catch(() => nextLock)
    );
    await activeLock.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.locksBySession.get(sessionId) === nextLock) {
        this.locksBySession.delete(sessionId);
      }
    }
  }

  async applyOptimisticVersioning(sessionId: string, events: WorkbookEventInput[]) {
    const mutations = events
      .map((event) => this.parseMutation(event))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (mutations.length === 0) return events;
    const sessionState = this.readSessionState(sessionId);
    const pending = new Map<string, ObjectVersionState>();
    const conflicts: VersionConflict[] = [];

    for (const mutation of mutations) {
      const current = pending.get(mutation.objectId) ?? sessionState.get(mutation.objectId) ?? null;
      const expectedVersion = this.normalizeVersion((mutation.payload as Record<string, unknown>).expectedVersion);
      const plan = this.planVersionUpdate({
        current,
        expectedVersion,
        type: mutation.type,
      });
      if (!plan.ok) {
        conflicts.push({
          objectId: mutation.objectId,
          type: mutation.type,
          expectedVersion,
          actualVersion: plan.actualVersion,
          reason: plan.reason,
        });
        continue;
      }

      const nextState: ObjectVersionState = {
        version: plan.nextVersion,
        deleted: mutation.type === "board.object.delete",
        updatedAt: new Date().toISOString(),
      };
      pending.set(mutation.objectId, nextState);
      (mutation.payload as Record<string, unknown>).objectVersion = plan.nextVersion;
      if (mutation.objectPayload) {
        mutation.objectPayload.objectVersion = plan.nextVersion;
      }
      if (expectedVersion === null) {
        (mutation.payload as Record<string, unknown>).expectedVersion = plan.actualVersion;
      }
    }

    if (conflicts.length > 0) {
      this.conflictCount += conflicts.length;
      throw new ConflictException({
        error: "object_version_conflict",
        conflicts,
      });
    }

    for (const [objectId, state] of pending.entries()) {
      sessionState.set(objectId, state);
    }
    this.acceptCount += mutations.length;
    return events;
  }

  getDiagnostics() {
    return {
      strictMode: this.strict,
      trackedSessions: this.statesBySession.size,
      trackedObjects: Array.from(this.statesBySession.values()).reduce(
        (sum, session) => sum + session.size,
        0
      ),
      acceptedMutations: this.acceptCount,
      conflicts: this.conflictCount,
    };
  }
}
