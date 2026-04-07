import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { ApiError } from "@/shared/api/client";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import {
  buildBoardObjectDiffPatch,
  OBJECT_UPDATE_FLUSH_INTERVAL_MS,
} from "./WorkbookSessionPage.core";
import {
  mergeBoardObjectPatches,
  mergeBoardObjectWithPatch,
} from "@/features/workbook/model/runtime";
import { type WorkbookHistoryEntry } from "./WorkbookSessionPage.geometry";

const toSafePage = (value: number | null | undefined) =>
  Math.max(1, Math.round(value || 1));

type AppendEventsAndApply = (
  events: WorkbookClientEventInput[],
  options?: {
    trackHistory?: boolean;
    markDirty?: boolean;
    historyEntry?: WorkbookHistoryEntry | null;
  }
) => Promise<void>;

type UseWorkbookObjectUpdateQueueParams = {
  appendEventsAndApply: AppendEventsAndApply;
  setError: (value: string | null) => void;
  objectUpdateTimersRef: MutableRefObject<Map<string, number>>;
  objectUpdateInFlightRef: MutableRefObject<Set<string>>;
  objectUpdateQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectUpdateDispatchOptionsRef: MutableRefObject<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >;
  objectUpdateHistoryBeforeRef: MutableRefObject<Map<string, WorkbookBoardObject>>;
  localPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  incomingPreviewQueuedPatchRef: MutableRefObject<
    Map<string, Partial<WorkbookBoardObject>[]>
  >;
  objectPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectPreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
};

export const useWorkbookObjectUpdateQueue = ({
  appendEventsAndApply,
  setError,
  objectUpdateTimersRef,
  objectUpdateInFlightRef,
  objectUpdateQueuedPatchRef,
  objectUpdateDispatchOptionsRef,
  objectUpdateHistoryBeforeRef,
  localPreviewQueuedPatchRef,
  incomingPreviewQueuedPatchRef,
  objectPreviewQueuedPatchRef,
  objectPreviewQueuedAtRef,
}: UseWorkbookObjectUpdateQueueParams) => {
  const flushQueuedObjectUpdateRef = useRef<(objectId: string) => void>(() => {});

  const flushQueuedObjectUpdate = useCallback(
    (objectId: string) => {
      if (objectUpdateTimersRef.current.has(objectId)) return;
      const timerId = window.setTimeout(() => {
        objectUpdateTimersRef.current.delete(objectId);
        if (objectUpdateInFlightRef.current.has(objectId)) {
          flushQueuedObjectUpdateRef.current(objectId);
          return;
        }
        const queuedPatch = objectUpdateQueuedPatchRef.current.get(objectId);
        if (!queuedPatch) return;
        objectUpdateQueuedPatchRef.current.delete(objectId);
        const dispatchOptions = objectUpdateDispatchOptionsRef.current.get(objectId) ?? {
          trackHistory: true,
          markDirty: true,
        };
        objectUpdateDispatchOptionsRef.current.delete(objectId);
        const historyBefore = objectUpdateHistoryBeforeRef.current.get(objectId) ?? null;
        const historyEntry =
          dispatchOptions.trackHistory !== false && historyBefore
            ? (() => {
                const historyAfter = mergeBoardObjectWithPatch(historyBefore, queuedPatch);
                const forwardPatch = buildBoardObjectDiffPatch(historyBefore, historyAfter);
                const inversePatch = buildBoardObjectDiffPatch(historyAfter, historyBefore);
                if (!forwardPatch || !inversePatch) return null;
                return {
                  forward: [
                    {
                      kind: "patch_object" as const,
                      objectId,
                      patch: forwardPatch,
                      expectedCurrent: historyBefore,
                    },
                  ],
                  inverse: [
                    {
                      kind: "patch_object" as const,
                      objectId,
                      patch: inversePatch,
                      expectedCurrent: historyAfter,
                    },
                  ],
                  page: toSafePage(historyAfter.page),
                  createdAt: new Date().toISOString(),
                } satisfies WorkbookHistoryEntry;
              })()
            : null;
        objectUpdateInFlightRef.current.add(objectId);
        void appendEventsAndApply(
          [
            {
              type: "board.object.update",
              payload: { objectId, patch: queuedPatch },
            },
          ],
          {
            ...dispatchOptions,
            historyEntry,
          }
        )
          .catch((error) => {
            if (error instanceof ApiError && error.code === "not_found") {
              objectUpdateQueuedPatchRef.current.delete(objectId);
              objectUpdateDispatchOptionsRef.current.delete(objectId);
              objectUpdateHistoryBeforeRef.current.delete(objectId);
              localPreviewQueuedPatchRef.current.delete(objectId);
              incomingPreviewQueuedPatchRef.current.delete(objectId);
              return;
            }
            if (error instanceof ApiError && error.code === "conflict" && error.status === 409) {
              // Preserve local intent on conflict and retry after controlled resync.
              const pendingPatch = objectUpdateQueuedPatchRef.current.get(objectId) ?? {};
              objectUpdateQueuedPatchRef.current.set(
                objectId,
                mergeBoardObjectPatches(queuedPatch, pendingPatch)
              );
              const pendingOptions = objectUpdateDispatchOptionsRef.current.get(objectId) ?? {
                trackHistory: false,
                markDirty: false,
              };
              objectUpdateDispatchOptionsRef.current.set(objectId, {
                trackHistory: dispatchOptions.trackHistory || pendingOptions.trackHistory,
                markDirty: dispatchOptions.markDirty || pendingOptions.markDirty,
              });
              objectPreviewQueuedPatchRef.current.delete(objectId);
              objectPreviewQueuedAtRef.current.delete(objectId);
              localPreviewQueuedPatchRef.current.delete(objectId);
              incomingPreviewQueuedPatchRef.current.delete(objectId);
              window.setTimeout(
                () => flushQueuedObjectUpdateRef.current(objectId),
                OBJECT_UPDATE_FLUSH_INTERVAL_MS * 4
              );
              return;
            }
            const isTransientError =
              error instanceof ApiError &&
              (error.code === "server_unavailable" ||
                error.code === "network_error" ||
                error.code === "timeout" ||
                error.code === "rate_limited");
            if (isTransientError) {
              const pendingPatch = objectUpdateQueuedPatchRef.current.get(objectId) ?? {};
              objectUpdateQueuedPatchRef.current.set(
                objectId,
                mergeBoardObjectPatches(queuedPatch, pendingPatch)
              );
              const pendingOptions = objectUpdateDispatchOptionsRef.current.get(objectId) ?? {
                trackHistory: false,
                markDirty: false,
              };
              objectUpdateDispatchOptionsRef.current.set(objectId, {
                trackHistory: dispatchOptions.trackHistory || pendingOptions.trackHistory,
                markDirty: dispatchOptions.markDirty || pendingOptions.markDirty,
              });
              return;
            }
            setError("Не удалось обновить объект.");
          })
          .finally(() => {
            objectUpdateInFlightRef.current.delete(objectId);
            if (!objectUpdateQueuedPatchRef.current.has(objectId)) {
              objectUpdateHistoryBeforeRef.current.delete(objectId);
            }
            if (objectUpdateQueuedPatchRef.current.has(objectId)) {
              flushQueuedObjectUpdateRef.current(objectId);
            }
          });
      }, OBJECT_UPDATE_FLUSH_INTERVAL_MS);
      objectUpdateTimersRef.current.set(objectId, timerId);
    },
    [
      appendEventsAndApply,
      setError,
      objectUpdateTimersRef,
      objectUpdateInFlightRef,
      objectUpdateQueuedPatchRef,
      objectUpdateDispatchOptionsRef,
      objectUpdateHistoryBeforeRef,
      localPreviewQueuedPatchRef,
      incomingPreviewQueuedPatchRef,
      objectPreviewQueuedPatchRef,
      objectPreviewQueuedAtRef,
    ]
  );

  useEffect(() => {
    flushQueuedObjectUpdateRef.current = flushQueuedObjectUpdate;
  }, [flushQueuedObjectUpdate]);

  return { flushQueuedObjectUpdate };
};
