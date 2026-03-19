import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  applyWorkbookBoardObjectPatchById,
  buildWorkbookBoardObjectIndex,
} from "@/features/workbook/model/boardObjectStore";
import { mergeBoardObjectPatches } from "@/features/workbook/model/runtime";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookSessionParticipant,
  WorkbookStroke,
} from "@/features/workbook/model/types";

type UseWorkbookSessionLocalRuntimeParams = {
  boardStrokes: WorkbookStroke[];
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  boardObjects: WorkbookBoardObject[];
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardObjectIndexByIdRef: MutableRefObject<Map<string, number>>;
  setBoardObjects: Dispatch<SetStateAction<WorkbookBoardObject[]>>;
  annotationStrokes: WorkbookStroke[];
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  constraints: WorkbookConstraint[];
  constraintsRef: MutableRefObject<WorkbookConstraint[]>;
  boardSettings: WorkbookBoardSettings;
  boardSettingsRef: MutableRefObject<WorkbookBoardSettings>;
  documentState: WorkbookDocumentState;
  documentStateRef: MutableRefObject<WorkbookDocumentState>;
  localPreviewFrameRef: MutableRefObject<number | null>;
  localPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  showCollaborationPanels: boolean;
  setIsParticipantsCollapsed: Dispatch<SetStateAction<boolean>>;
  canAccessBoardSettingsPanel: boolean;
  utilityTab: string;
  setIsUtilityPanelOpen: Dispatch<SetStateAction<boolean>>;
  canManageSharedBoardSettings: boolean;
  queuedBoardSettingsCommitRef: MutableRefObject<WorkbookBoardSettings | null>;
  queuedBoardSettingsHistoryBeforeRef: MutableRefObject<WorkbookBoardSettings | null>;
  boardSettingsCommitInFlightRef: MutableRefObject<boolean>;
  boardSettingsCommitTimerRef: MutableRefObject<number | null>;
  sessionParticipants: WorkbookSessionParticipant[] | undefined;
  participantVisibilityGraceMs: number;
  resetToolRuntimeToSelect: () => void;
  sessionId: string;
  latestSeq: number;
  latestSeqRef: MutableRefObject<number>;
};

export const useWorkbookSessionLocalRuntime = ({
  boardStrokes,
  boardStrokesRef,
  boardObjects,
  boardObjectsRef,
  boardObjectIndexByIdRef,
  setBoardObjects,
  annotationStrokes,
  annotationStrokesRef,
  constraints,
  constraintsRef,
  boardSettings,
  boardSettingsRef,
  documentState,
  documentStateRef,
  localPreviewFrameRef,
  localPreviewQueuedPatchRef,
  showCollaborationPanels,
  setIsParticipantsCollapsed,
  canAccessBoardSettingsPanel,
  utilityTab,
  setIsUtilityPanelOpen,
  canManageSharedBoardSettings,
  queuedBoardSettingsCommitRef,
  queuedBoardSettingsHistoryBeforeRef,
  boardSettingsCommitInFlightRef,
  boardSettingsCommitTimerRef,
  sessionParticipants,
  participantVisibilityGraceMs,
  resetToolRuntimeToSelect,
  sessionId,
  latestSeq,
  latestSeqRef,
}: UseWorkbookSessionLocalRuntimeParams) => {
  useEffect(() => {
    boardStrokesRef.current = boardStrokes;
  }, [boardStrokes, boardStrokesRef]);

  useEffect(() => {
    boardObjectsRef.current = boardObjects;
    boardObjectIndexByIdRef.current = buildWorkbookBoardObjectIndex(boardObjects);
  }, [boardObjectIndexByIdRef, boardObjects, boardObjectsRef]);

  const flushLocalPreviewBoardObjectPatches = useCallback(() => {
    localPreviewFrameRef.current = null;
    if (localPreviewQueuedPatchRef.current.size === 0) return;
    const queuedEntries = Array.from(localPreviewQueuedPatchRef.current.entries());
    localPreviewQueuedPatchRef.current.clear();
    let nextObjects = boardObjectsRef.current;
    let changed = false;
    queuedEntries.forEach(([objectId, patch]) => {
      const applied = applyWorkbookBoardObjectPatchById({
        objects: nextObjects,
        objectId,
        patch,
        index: boardObjectIndexByIdRef.current,
      });
      if (applied.nextObjects !== nextObjects) {
        nextObjects = applied.nextObjects;
        changed = true;
      }
    });
    if (!changed) return;
    boardObjectsRef.current = nextObjects;
    boardObjectIndexByIdRef.current = buildWorkbookBoardObjectIndex(nextObjects);
    startTransition(() => {
      setBoardObjects(nextObjects);
    });
  }, [
    boardObjectIndexByIdRef,
    boardObjectsRef,
    localPreviewFrameRef,
    localPreviewQueuedPatchRef,
    setBoardObjects,
  ]);

  const scheduleLocalPreviewBoardObjectPatch = useCallback(
    (objectId: string, patch: Partial<WorkbookBoardObject>) => {
      const pendingPatch = localPreviewQueuedPatchRef.current.get(objectId) ?? {};
      localPreviewQueuedPatchRef.current.set(objectId, mergeBoardObjectPatches(pendingPatch, patch));
      if (localPreviewFrameRef.current !== null) return;
      if (typeof window === "undefined") {
        flushLocalPreviewBoardObjectPatches();
        return;
      }
      localPreviewFrameRef.current = window.requestAnimationFrame(() => {
        flushLocalPreviewBoardObjectPatches();
      });
    },
    [flushLocalPreviewBoardObjectPatches, localPreviewFrameRef, localPreviewQueuedPatchRef]
  );

  const clearLocalPreviewPatchRuntime = useCallback(() => {
    localPreviewQueuedPatchRef.current.clear();
    if (localPreviewFrameRef.current === null || typeof window === "undefined") {
      localPreviewFrameRef.current = null;
      return;
    }
    window.cancelAnimationFrame(localPreviewFrameRef.current);
    localPreviewFrameRef.current = null;
  }, [localPreviewFrameRef, localPreviewQueuedPatchRef]);

  useEffect(() => {
    annotationStrokesRef.current = annotationStrokes;
  }, [annotationStrokes, annotationStrokesRef]);

  useEffect(() => {
    constraintsRef.current = constraints;
  }, [constraints, constraintsRef]);

  useEffect(() => {
    boardSettingsRef.current = boardSettings;
  }, [boardSettings, boardSettingsRef]);

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState, documentStateRef]);

  useEffect(
    () => () => {
      if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(boardSettingsCommitTimerRef.current);
      }
    },
    [boardSettingsCommitTimerRef]
  );

  useEffect(() => {
    if (!showCollaborationPanels) {
      setIsParticipantsCollapsed(false);
    }
  }, [setIsParticipantsCollapsed, showCollaborationPanels]);

  useEffect(() => {
    if (canAccessBoardSettingsPanel || utilityTab !== "settings") return;
    setIsUtilityPanelOpen(false);
  }, [canAccessBoardSettingsPanel, setIsUtilityPanelOpen, utilityTab]);

  useEffect(() => {
    if (canManageSharedBoardSettings) return;
    queuedBoardSettingsCommitRef.current = null;
    queuedBoardSettingsHistoryBeforeRef.current = null;
    boardSettingsCommitInFlightRef.current = false;
    if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(boardSettingsCommitTimerRef.current);
      boardSettingsCommitTimerRef.current = null;
    }
  }, [
    boardSettingsCommitInFlightRef,
    boardSettingsCommitTimerRef,
    canManageSharedBoardSettings,
    queuedBoardSettingsCommitRef,
    queuedBoardSettingsHistoryBeforeRef,
  ]);

  const areParticipantsEqual = useCallback(
    (left: WorkbookSessionParticipant[], right: WorkbookSessionParticipant[]) => {
      if (left.length !== right.length) return false;
      const normalize = (participants: WorkbookSessionParticipant[]) =>
        [...participants]
          .sort((a, b) => a.userId.localeCompare(b.userId))
          .map((participant) => ({
            userId: participant.userId,
            roleInSession: participant.roleInSession,
            isOnline: participant.isOnline,
            canUseChat: participant.permissions.canUseChat,
            canUseMedia: participant.permissions.canUseMedia,
            canDraw: participant.permissions.canDraw,
            canSelect: participant.permissions.canSelect,
            canDelete: participant.permissions.canDelete,
            canInsertImage: participant.permissions.canInsertImage,
            canClear: participant.permissions.canClear,
            canExport: participant.permissions.canExport,
            canUseLaser: participant.permissions.canUseLaser,
          }));
      const normalizedLeft = normalize(left);
      const normalizedRight = normalize(right);
      return normalizedLeft.every((participant, index) => {
        const target = normalizedRight[index];
        return JSON.stringify(participant) === JSON.stringify(target);
      });
    },
    []
  );

  const deferredParticipants = useDeferredValue(sessionParticipants ?? []);
  const participantCards = useMemo(
    () =>
      [...deferredParticipants]
        .filter(
          (participant) =>
            participant.roleInSession === "teacher" ||
            participant.isOnline ||
            (() => {
              const lastSeenAtTs = Date.parse(String(participant.lastSeenAt ?? ""));
              return (
                Number.isFinite(lastSeenAtTs) &&
                Date.now() - lastSeenAtTs <= participantVisibilityGraceMs
              );
            })()
        )
        .sort((left, right) => {
          if (left.roleInSession !== right.roleInSession) {
            return left.roleInSession === "teacher" ? -1 : 1;
          }
          if (left.isOnline !== right.isOnline) {
            return left.isOnline ? -1 : 1;
          }
          return left.displayName.localeCompare(right.displayName, "ru");
        }),
    [deferredParticipants, participantVisibilityGraceMs]
  );

  useEffect(() => {
    resetToolRuntimeToSelect();
  }, [resetToolRuntimeToSelect, sessionId]);

  useEffect(() => {
    latestSeqRef.current = latestSeq;
  }, [latestSeq, latestSeqRef]);

  return {
    scheduleLocalPreviewBoardObjectPatch,
    clearLocalPreviewPatchRuntime,
    areParticipantsEqual,
    participantCards,
  };
};
