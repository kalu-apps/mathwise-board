import { useCallback, type MutableRefObject } from "react";
import {
  mergeBoardObjectWithPatch,
} from "@/features/workbook/model/runtime";
import {
  normalizeWorkbookBoardPageVisualSettingsByPage,
  resolveWorkbookBoardPageVisualDefaults,
} from "@/features/workbook/model/boardPageSettings";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookStroke,
  WorkbookLayer,
} from "@/features/workbook/model/types";
import {
  clampBoardObjectToPageFrame,
  cloneSerializable,
} from "./WorkbookSessionPage.core";
import { normalizeWorkbookPageFrameWidth } from "@/features/workbook/model/pageFrame";
import {
  normalizeSceneLayersForBoard,
  type WorkbookHistoryOperation,
} from "./WorkbookSessionPage.geometry";

type StateUpdater<T> = T | ((current: T) => T);
type SetState<T> = (updater: StateUpdater<T>) => void;

type UseWorkbookHistoryOperationsApplyParams = {
  setAnnotationStrokes: SetState<WorkbookStroke[]>;
  setBoardStrokes: SetState<WorkbookStroke[]>;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  annotationStrokesRef: MutableRefObject<WorkbookStroke[]>;
  applyLocalBoardObjects: (
    updater: (current: WorkbookBoardObject[]) => WorkbookBoardObject[]
  ) => void;
  finalizeStrokePreview: (strokeId: string) => void;
  setBoardSettings: SetState<WorkbookBoardSettings>;
  setConstraints: SetState<WorkbookConstraint[]>;
  setDocumentState: SetState<WorkbookDocumentState>;
  setSelectedConstraintId: SetState<string | null>;
  setSelectedObjectId: SetState<string | null>;
  boardSettingsRef: MutableRefObject<WorkbookBoardSettings>;
  objectUpdateQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectUpdateDispatchOptionsRef: MutableRefObject<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >;
  objectUpdateHistoryBeforeRef: MutableRefObject<Map<string, WorkbookBoardObject>>;
  objectPreviewQueuedPatchRef: MutableRefObject<Map<string, Partial<WorkbookBoardObject>>>;
  objectPreviewQueuedAtRef: MutableRefObject<Map<string, number>>;
  objectPreviewVersionRef: MutableRefObject<Map<string, number>>;
  incomingPreviewQueuedPatchRef: MutableRefObject<
    Map<string, Partial<WorkbookBoardObject>[]>
  >;
  objectUpdateInFlightRef: MutableRefObject<Set<string>>;
  incomingPreviewVersionByAuthorObjectRef: MutableRefObject<Map<string, number>>;
  objectUpdateTimersRef: MutableRefObject<Map<string, number>>;
};

const isPlainSerializableObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const areSerializableValuesStructurallyEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null) return left === right;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!areSerializableValuesStructurallyEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }
  if (!isPlainSerializableObject(left) || !isPlainSerializableObject(right)) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) return false;
    if (!areSerializableValuesStructurallyEqual(left[leftKey], right[rightKey])) {
      return false;
    }
  }
  return true;
};

export const useWorkbookHistoryOperationsApply = ({
  setAnnotationStrokes,
  setBoardStrokes,
  boardStrokesRef,
  annotationStrokesRef,
  applyLocalBoardObjects,
  finalizeStrokePreview,
  setBoardSettings,
  setConstraints,
  setDocumentState,
  setSelectedConstraintId,
  setSelectedObjectId,
  boardSettingsRef,
  objectUpdateQueuedPatchRef,
  objectUpdateDispatchOptionsRef,
  objectUpdateHistoryBeforeRef,
  objectPreviewQueuedPatchRef,
  objectPreviewQueuedAtRef,
  objectPreviewVersionRef,
  incomingPreviewQueuedPatchRef,
  objectUpdateInFlightRef,
  incomingPreviewVersionByAuthorObjectRef,
  objectUpdateTimersRef,
}: UseWorkbookHistoryOperationsApplyParams) => {
  void boardStrokesRef;
  void annotationStrokesRef;

  const applyLocalStrokeCollection = useCallback(
    (
      targetLayer: WorkbookLayer,
      updater: (current: WorkbookStroke[]) => WorkbookStroke[]
    ) => {
      if (targetLayer === "annotations") {
        setAnnotationStrokes(updater);
        return;
      }
      setBoardStrokes(updater);
    },
    [setAnnotationStrokes, setBoardStrokes]
  );

  const isExpectedStateMatch = useCallback(
    <T,>(current: T | undefined, expected: T | null | undefined) => {
      if (expected === undefined) return true;
      if (expected === null) return current === undefined;
      if (current === undefined) return false;
      return areSerializableValuesStructurallyEqual(current, expected);
    },
    []
  );

  const applyHistoryOperations = useCallback(
    (
      operations: WorkbookHistoryOperation[],
      options?: { ignoreExpectedCurrent?: boolean }
    ) => {
      const ignoreExpectedCurrent = options?.ignoreExpectedCurrent === true;
      let appliedOperationsCount = 0;
      operations.forEach((operation) => {
        if (operation.kind === "upsert_stroke") {
          let applied = false;
          applyLocalStrokeCollection(operation.layer, (current) => {
            const currentStroke = current.find((item) => item.id === operation.stroke.id);
            if (
              !ignoreExpectedCurrent &&
              !isExpectedStateMatch(currentStroke, operation.expectedCurrent)
            ) {
              return current;
            }
            const exists = Boolean(currentStroke);
            applied = true;
            if (!exists) return [...current, cloneSerializable(operation.stroke)];
            return current.map((item) =>
              item.id === operation.stroke.id ? cloneSerializable(operation.stroke) : item
            );
          });
          if (applied) {
            finalizeStrokePreview(operation.stroke.id);
            appliedOperationsCount += 1;
          }
          return;
        }
        if (operation.kind === "remove_stroke") {
          let applied = false;
          applyLocalStrokeCollection(operation.layer, (current) => {
            const currentStroke = current.find((item) => item.id === operation.strokeId);
            if (
              !ignoreExpectedCurrent &&
              !isExpectedStateMatch(currentStroke, operation.expectedCurrent)
            ) {
              return current;
            }
            if (!currentStroke) return current;
            applied = true;
            return current.filter((item) => item.id !== operation.strokeId);
          });
          if (applied) {
            finalizeStrokePreview(operation.strokeId);
            appliedOperationsCount += 1;
          }
          return;
        }
        if (operation.kind === "upsert_object") {
          let applied = false;
          const nextObject = clampBoardObjectToPageFrame(
            cloneSerializable(operation.object),
            boardSettingsRef.current.pageFrameWidth
          );
          applyLocalBoardObjects((current) => {
            const currentObject = current.find((item) => item.id === nextObject.id);
            if (
              !ignoreExpectedCurrent &&
              !isExpectedStateMatch(currentObject, operation.expectedCurrent)
            ) {
              return current;
            }
            const exists = Boolean(currentObject);
            applied = true;
            if (!exists) return [...current, nextObject];
            return current.map((item) => (item.id === nextObject.id ? nextObject : item));
          });
          if (applied) {
            appliedOperationsCount += 1;
          }
          return;
        }
        if (operation.kind === "patch_object") {
          let applied = false;
          applyLocalBoardObjects((current) => {
            const currentObject = current.find((item) => item.id === operation.objectId);
            if (!currentObject) return current;
            if (
              !ignoreExpectedCurrent &&
              !isExpectedStateMatch(currentObject, operation.expectedCurrent)
            ) {
              return current;
            }
            applied = true;
            return current.map((item) =>
              item.id === operation.objectId
                ? clampBoardObjectToPageFrame(
                    mergeBoardObjectWithPatch(item, cloneSerializable(operation.patch)),
                    boardSettingsRef.current.pageFrameWidth
                  )
                : item
            );
          });
          if (applied) {
            appliedOperationsCount += 1;
          }
          return;
        }
        if (operation.kind === "remove_object") {
          const objectId = operation.objectId;
          let removed = false;
          applyLocalBoardObjects((current) => {
            const currentObject = current.find((item) => item.id === objectId);
            if (
              !ignoreExpectedCurrent &&
              !isExpectedStateMatch(currentObject, operation.expectedCurrent)
            ) {
              return current;
            }
            if (!currentObject) return current;
            removed = true;
            return current.filter((item) => item.id !== objectId);
          });
          if (!removed) return;
          appliedOperationsCount += 1;
          objectUpdateQueuedPatchRef.current.delete(objectId);
          objectUpdateDispatchOptionsRef.current.delete(objectId);
          objectUpdateHistoryBeforeRef.current.delete(objectId);
          objectPreviewQueuedPatchRef.current.delete(objectId);
          objectPreviewQueuedAtRef.current.delete(objectId);
          objectPreviewVersionRef.current.delete(objectId);
          incomingPreviewQueuedPatchRef.current.delete(objectId);
          objectUpdateInFlightRef.current.delete(objectId);
          Array.from(incomingPreviewVersionByAuthorObjectRef.current.keys()).forEach((key) => {
            if (key.endsWith(`:${objectId}`)) {
              incomingPreviewVersionByAuthorObjectRef.current.delete(key);
            }
          });
          const pendingUpdateTimer = objectUpdateTimersRef.current.get(objectId);
          if (pendingUpdateTimer !== undefined) {
            window.clearTimeout(pendingUpdateTimer);
            objectUpdateTimersRef.current.delete(objectId);
          }
          setConstraints((current) =>
            current.filter(
              (constraint) =>
                constraint.sourceObjectId !== objectId &&
                constraint.targetObjectId !== objectId
            )
          );
          setSelectedObjectId((current) => (current === objectId ? null : current));
          return;
        }
        if (operation.kind === "upsert_constraint") {
          const nextConstraint = cloneSerializable(operation.constraint);
          setConstraints((current) => {
            const exists = current.some((item) => item.id === nextConstraint.id);
            if (!exists) return [...current, nextConstraint];
            return current.map((item) => (item.id === nextConstraint.id ? nextConstraint : item));
          });
          appliedOperationsCount += 1;
          return;
        }
        if (operation.kind === "remove_constraint") {
          setConstraints((current) =>
            current.filter((item) => item.id !== operation.constraintId)
          );
          setSelectedConstraintId((current) =>
            current === operation.constraintId ? null : current
          );
          appliedOperationsCount += 1;
          return;
        }
        if (operation.kind === "patch_board_settings") {
          setBoardSettings((current) => {
            const merged = {
              ...current,
              ...cloneSerializable(operation.patch),
            };
            const normalizedLayers = normalizeSceneLayersForBoard(
              merged.sceneLayers,
              merged.activeSceneLayerId
            );
            const normalizedSettings: WorkbookBoardSettings = {
              ...merged,
              pageFrameWidth: normalizeWorkbookPageFrameWidth(merged.pageFrameWidth),
              sceneLayers: normalizedLayers.sceneLayers,
              activeSceneLayerId: normalizedLayers.activeSceneLayerId,
            };
            const fallbackPageVisual = resolveWorkbookBoardPageVisualDefaults(
              normalizedSettings
            );
            normalizedSettings.pageBoardSettingsByPage =
              normalizeWorkbookBoardPageVisualSettingsByPage(
                merged.pageBoardSettingsByPage,
                fallbackPageVisual
              );
            return normalizedSettings;
          });
          appliedOperationsCount += 1;
          return;
        }
        if (operation.kind === "upsert_document_asset") {
          const nextAsset = cloneSerializable(operation.asset);
          setDocumentState((current) => {
            const exists = current.assets.some((item) => item.id === nextAsset.id);
            return {
              ...current,
              assets: exists
                ? current.assets.map((item) => (item.id === nextAsset.id ? nextAsset : item))
                : [...current.assets, nextAsset],
              activeAssetId: current.activeAssetId ?? nextAsset.id,
            };
          });
          appliedOperationsCount += 1;
          return;
        }
        if (operation.kind === "remove_document_asset") {
          setDocumentState((current) => {
            const assets = current.assets.filter((item) => item.id !== operation.assetId);
            return {
              ...current,
              assets,
              activeAssetId:
                current.activeAssetId === operation.assetId
                  ? (assets[0]?.id ?? null)
                  : current.activeAssetId,
            };
          });
          appliedOperationsCount += 1;
          return;
        }
        if (operation.kind === "upsert_document_annotation") {
          const nextAnnotation = cloneSerializable(operation.annotation);
          setDocumentState((current) => {
            const exists = current.annotations.some((item) => item.id === nextAnnotation.id);
            return {
              ...current,
              annotations: exists
                ? current.annotations.map((item) =>
                    item.id === nextAnnotation.id ? nextAnnotation : item
                  )
                : [...current.annotations, nextAnnotation],
            };
          });
          appliedOperationsCount += 1;
          return;
        }
        if (operation.kind === "remove_document_annotation") {
          setDocumentState((current) => ({
            ...current,
            annotations: current.annotations.filter(
              (item) => item.id !== operation.annotationId
            ),
          }));
          appliedOperationsCount += 1;
        }
      });
      return appliedOperationsCount;
    },
    [
      applyLocalBoardObjects,
      applyLocalStrokeCollection,
      finalizeStrokePreview,
      isExpectedStateMatch,
      incomingPreviewQueuedPatchRef,
      incomingPreviewVersionByAuthorObjectRef,
      objectPreviewQueuedAtRef,
      objectPreviewQueuedPatchRef,
      objectPreviewVersionRef,
      objectUpdateDispatchOptionsRef,
      objectUpdateHistoryBeforeRef,
      objectUpdateInFlightRef,
      objectUpdateQueuedPatchRef,
      objectUpdateTimersRef,
      setBoardSettings,
      setConstraints,
      setDocumentState,
      setSelectedConstraintId,
      setSelectedObjectId,
      boardSettingsRef,
    ]
  );

  return {
    applyLocalStrokeCollection,
    applyHistoryOperations,
  };
};
