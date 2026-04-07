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
  areSerializableValuesEqual,
  clampBoardObjectToPageFrame,
  cloneSerializable,
  normalizeMetaRecord,
} from "./WorkbookSessionPage.core";
import { normalizeWorkbookPageFrameWidth } from "@/features/workbook/model/pageFrame";
import {
  normalizeSceneLayersForBoard,
  type WorkbookHistoryApplyResult,
  type WorkbookHistoryOperation,
} from "./WorkbookSessionPage.geometry";

type StateUpdater<T> = T | ((current: T) => T);
type SetState<T> = (updater: StateUpdater<T>) => void;

type UseWorkbookHistoryOperationsApplyParams = {
  setAnnotationStrokes: SetState<WorkbookStroke[]>;
  setBoardStrokes: SetState<WorkbookStroke[]>;
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

export const useWorkbookHistoryOperationsApply = ({
  setAnnotationStrokes,
  setBoardStrokes,
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
      return areSerializableValuesEqual(current, expected);
    },
    []
  );

  const toRecord = useCallback(
    (value: unknown): Record<string, unknown> | null =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null,
    []
  );

  const applyHistoryOperations = useCallback(
    (operations: WorkbookHistoryOperation[]): WorkbookHistoryApplyResult => {
      const result: WorkbookHistoryApplyResult = {
        appliedCount: 0,
        skippedCount: 0,
        conflictCount: 0,
      };

      operations.forEach((operation) => {
        let operationApplied = false;
        let operationConflict = false;

        switch (operation.kind) {
          case "upsert_stroke": {
            applyLocalStrokeCollection(operation.layer, (current) => {
              const currentStroke = current.find((item) => item.id === operation.stroke.id);
              if (!isExpectedStateMatch(currentStroke, operation.expectedCurrent)) {
                operationConflict = true;
                return current;
              }
              const exists = Boolean(currentStroke);
              operationApplied = true;
              if (!exists) return [...current, cloneSerializable(operation.stroke)];
              return current.map((item) =>
                item.id === operation.stroke.id ? cloneSerializable(operation.stroke) : item
              );
            });
            if (operationApplied) {
              finalizeStrokePreview(operation.stroke.id);
            }
            break;
          }
          case "remove_stroke": {
            applyLocalStrokeCollection(operation.layer, (current) => {
              const currentStroke = current.find((item) => item.id === operation.strokeId);
              if (!isExpectedStateMatch(currentStroke, operation.expectedCurrent)) {
                operationConflict = true;
                return current;
              }
              if (!currentStroke) return current;
              operationApplied = true;
              return current.filter((item) => item.id !== operation.strokeId);
            });
            if (operationApplied) {
              finalizeStrokePreview(operation.strokeId);
            }
            break;
          }
          case "upsert_object": {
            const nextObject = clampBoardObjectToPageFrame(
              cloneSerializable(operation.object),
              boardSettingsRef.current.pageFrameWidth
            );
            applyLocalBoardObjects((current) => {
              const currentObject = current.find((item) => item.id === nextObject.id);
              if (!isExpectedStateMatch(currentObject, operation.expectedCurrent)) {
                operationConflict = true;
                return current;
              }
              const exists = Boolean(currentObject);
              operationApplied = true;
              if (!exists) return [...current, nextObject];
              return current.map((item) => (item.id === nextObject.id ? nextObject : item));
            });
            break;
          }
          case "patch_object": {
            applyLocalBoardObjects((current) => {
              const objectIndex = current.findIndex((item) => item.id === operation.objectId);
              if (objectIndex < 0) {
                operationConflict = true;
                return current;
              }
              const currentObject = current[objectIndex];
              const beforeRecord = toRecord(operation.beforePatch);
              const afterRecord = toRecord(operation.afterPatch);
              if (!beforeRecord || !afterRecord) {
                if (!isExpectedStateMatch(currentObject, operation.expectedCurrent)) {
                  operationConflict = true;
                  return current;
                }
                const nextObject = clampBoardObjectToPageFrame(
                  mergeBoardObjectWithPatch(currentObject, cloneSerializable(operation.patch)),
                  boardSettingsRef.current.pageFrameWidth
                );
                if (areSerializableValuesEqual(nextObject, currentObject)) {
                  return current;
                }
                operationApplied = true;
                return current.map((item, index) => (index === objectIndex ? nextObject : item));
              }

              const currentRecord = currentObject as Record<string, unknown>;
              const touchedRootKeys = new Set<string>([
                ...Object.keys(beforeRecord),
                ...Object.keys(afterRecord),
                ...Object.keys(toRecord(operation.patch) ?? {}),
              ]);
              touchedRootKeys.delete("meta");

              const beforeMetaRecord = normalizeMetaRecord(beforeRecord.meta);
              const afterMetaRecord = normalizeMetaRecord(afterRecord.meta);
              const patchMetaRecord = normalizeMetaRecord((toRecord(operation.patch) ?? {}).meta);
              const touchedMetaKeys = new Set<string>([
                ...Object.keys(beforeMetaRecord),
                ...Object.keys(afterMetaRecord),
                ...Object.keys(patchMetaRecord),
              ]);

              let nextRecord: Record<string, unknown> | null = null;

              touchedRootKeys.forEach((key) => {
                const currentValue = currentRecord[key];
                const expectedBeforeValue = beforeRecord[key];
                const targetAfterValue = afterRecord[key];
                if (areSerializableValuesEqual(currentValue, expectedBeforeValue)) {
                  if (!areSerializableValuesEqual(currentValue, targetAfterValue)) {
                    if (!nextRecord) {
                      nextRecord = { ...currentRecord };
                    }
                    nextRecord[key] = cloneSerializable(targetAfterValue);
                  }
                  return;
                }
                if (!areSerializableValuesEqual(currentValue, targetAfterValue)) {
                  operationConflict = true;
                }
              });

              if (touchedMetaKeys.size > 0) {
                const currentMetaRecord = normalizeMetaRecord(currentObject.meta);
                let nextMetaRecord: Record<string, unknown> | null = null;
                touchedMetaKeys.forEach((metaKey) => {
                  const currentValue = currentMetaRecord[metaKey];
                  const expectedBeforeValue = beforeMetaRecord[metaKey];
                  const targetAfterValue = afterMetaRecord[metaKey];
                  if (areSerializableValuesEqual(currentValue, expectedBeforeValue)) {
                    if (!areSerializableValuesEqual(currentValue, targetAfterValue)) {
                      if (!nextMetaRecord) {
                        nextMetaRecord = { ...currentMetaRecord };
                      }
                      nextMetaRecord[metaKey] = cloneSerializable(targetAfterValue);
                    }
                    return;
                  }
                  if (!areSerializableValuesEqual(currentValue, targetAfterValue)) {
                    operationConflict = true;
                  }
                });
                if (nextMetaRecord) {
                  if (!nextRecord) {
                    nextRecord = { ...currentRecord };
                  }
                  nextRecord.meta = nextMetaRecord;
                }
              }

              if (!nextRecord) {
                return current;
              }

              const nextObject = clampBoardObjectToPageFrame(
                nextRecord as WorkbookBoardObject,
                boardSettingsRef.current.pageFrameWidth
              );
              if (areSerializableValuesEqual(nextObject, currentObject)) {
                return current;
              }
              operationApplied = true;
              return current.map((item, index) => (index === objectIndex ? nextObject : item));
            });
            break;
          }
          case "remove_object": {
            const objectId = operation.objectId;
            applyLocalBoardObjects((current) => {
              const currentObject = current.find((item) => item.id === objectId);
              if (!isExpectedStateMatch(currentObject, operation.expectedCurrent)) {
                operationConflict = true;
                return current;
              }
              if (!currentObject) return current;
              operationApplied = true;
              return current.filter((item) => item.id !== objectId);
            });
            if (!operationApplied) {
              break;
            }
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
            break;
          }
          case "upsert_constraint": {
            const nextConstraint = cloneSerializable(operation.constraint);
            setConstraints((current) => {
              const currentConstraint = current.find((item) => item.id === nextConstraint.id);
              if (!currentConstraint) {
                operationApplied = true;
                return [...current, nextConstraint];
              }
              if (areSerializableValuesEqual(currentConstraint, nextConstraint)) {
                return current;
              }
              operationApplied = true;
              return current.map((item) =>
                item.id === nextConstraint.id ? nextConstraint : item
              );
            });
            break;
          }
          case "remove_constraint": {
            setConstraints((current) => {
              const exists = current.some((item) => item.id === operation.constraintId);
              if (!exists) return current;
              operationApplied = true;
              return current.filter((item) => item.id !== operation.constraintId);
            });
            if (operationApplied) {
              setSelectedConstraintId((current) =>
                current === operation.constraintId ? null : current
              );
            }
            break;
          }
          case "patch_board_settings": {
            setBoardSettings((current) => {
              const beforeRecord = toRecord(operation.beforePatch);
              const afterRecord = toRecord(operation.afterPatch);
              const nextFromMerged = (merged: WorkbookBoardSettings) => {
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
              };

              if (!beforeRecord || !afterRecord) {
                const merged = {
                  ...current,
                  ...cloneSerializable(operation.patch),
                };
                const normalizedSettings = nextFromMerged(merged);
                if (areSerializableValuesEqual(current, normalizedSettings)) {
                  return current;
                }
                operationApplied = true;
                return normalizedSettings;
              }

              const currentRecord = current as Record<string, unknown>;
              const touchedKeys = new Set<string>([
                ...Object.keys(beforeRecord),
                ...Object.keys(afterRecord),
                ...Object.keys(toRecord(operation.patch) ?? {}),
              ]);

              let nextRecord: Record<string, unknown> | null = null;
              touchedKeys.forEach((key) => {
                const currentValue = currentRecord[key];
                const expectedBeforeValue = beforeRecord[key];
                const targetAfterValue = afterRecord[key];
                if (areSerializableValuesEqual(currentValue, expectedBeforeValue)) {
                  if (!areSerializableValuesEqual(currentValue, targetAfterValue)) {
                    if (!nextRecord) {
                      nextRecord = { ...currentRecord };
                    }
                    nextRecord[key] = cloneSerializable(targetAfterValue);
                  }
                  return;
                }
                if (!areSerializableValuesEqual(currentValue, targetAfterValue)) {
                  operationConflict = true;
                }
              });

              if (!nextRecord) {
                return current;
              }

              const normalizedSettings = nextFromMerged(nextRecord as WorkbookBoardSettings);
              if (areSerializableValuesEqual(current, normalizedSettings)) {
                return current;
              }
              operationApplied = true;
              return normalizedSettings;
            });
            break;
          }
          case "upsert_document_asset": {
            const nextAsset = cloneSerializable(operation.asset);
            setDocumentState((current) => {
              const currentAsset = current.assets.find((item) => item.id === nextAsset.id);
              if (currentAsset && areSerializableValuesEqual(currentAsset, nextAsset)) {
                return current;
              }
              operationApplied = true;
              const exists = Boolean(currentAsset);
              return {
                ...current,
                assets: exists
                  ? current.assets.map((item) => (item.id === nextAsset.id ? nextAsset : item))
                  : [...current.assets, nextAsset],
                activeAssetId: current.activeAssetId ?? nextAsset.id,
              };
            });
            break;
          }
          case "remove_document_asset": {
            setDocumentState((current) => {
              const exists = current.assets.some((item) => item.id === operation.assetId);
              if (!exists) return current;
              operationApplied = true;
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
            break;
          }
          case "upsert_document_annotation": {
            const nextAnnotation = cloneSerializable(operation.annotation);
            setDocumentState((current) => {
              const currentAnnotation = current.annotations.find(
                (item) => item.id === nextAnnotation.id
              );
              if (currentAnnotation && areSerializableValuesEqual(currentAnnotation, nextAnnotation)) {
                return current;
              }
              operationApplied = true;
              const exists = Boolean(currentAnnotation);
              return {
                ...current,
                annotations: exists
                  ? current.annotations.map((item) =>
                      item.id === nextAnnotation.id ? nextAnnotation : item
                    )
                  : [...current.annotations, nextAnnotation],
              };
            });
            break;
          }
          case "remove_document_annotation": {
            setDocumentState((current) => {
              const exists = current.annotations.some(
                (item) => item.id === operation.annotationId
              );
              if (!exists) return current;
              operationApplied = true;
              return {
                ...current,
                annotations: current.annotations.filter(
                  (item) => item.id !== operation.annotationId
                ),
              };
            });
            break;
          }
          default:
            break;
        }

        if (operationApplied) {
          result.appliedCount += 1;
        } else {
          result.skippedCount += 1;
        }
        if (operationConflict) {
          result.conflictCount += 1;
        }
      });
      return result;
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
      toRecord,
    ]
  );

  return {
    applyLocalStrokeCollection,
    applyHistoryOperations,
  };
};
