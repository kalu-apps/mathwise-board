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

  const applyHistoryOperations = useCallback(
    (operations: WorkbookHistoryOperation[]) => {
      operations.forEach((operation) => {
        if (operation.kind === "upsert_stroke") {
          finalizeStrokePreview(operation.stroke.id);
          applyLocalStrokeCollection(operation.layer, (current) => {
            const exists = current.some((item) => item.id === operation.stroke.id);
            if (!exists) return [...current, cloneSerializable(operation.stroke)];
            return current.map((item) =>
              item.id === operation.stroke.id ? cloneSerializable(operation.stroke) : item
            );
          });
          return;
        }
        if (operation.kind === "remove_stroke") {
          finalizeStrokePreview(operation.strokeId);
          applyLocalStrokeCollection(operation.layer, (current) =>
            current.filter((item) => item.id !== operation.strokeId)
          );
          return;
        }
        if (operation.kind === "upsert_object") {
          const nextObject = clampBoardObjectToPageFrame(
            cloneSerializable(operation.object),
            boardSettingsRef.current.pageFrameWidth
          );
          applyLocalBoardObjects((current) => {
            const exists = current.some((item) => item.id === nextObject.id);
            if (!exists) return [...current, nextObject];
            return current.map((item) => (item.id === nextObject.id ? nextObject : item));
          });
          return;
        }
        if (operation.kind === "patch_object") {
          applyLocalBoardObjects((current) =>
            current.map((item) =>
              item.id === operation.objectId
                ? clampBoardObjectToPageFrame(
                    mergeBoardObjectWithPatch(item, cloneSerializable(operation.patch)),
                    boardSettingsRef.current.pageFrameWidth
                  )
                : item
            )
          );
          return;
        }
        if (operation.kind === "remove_object") {
          const objectId = operation.objectId;
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
          applyLocalBoardObjects((current) => current.filter((item) => item.id !== objectId));
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
          return;
        }
        if (operation.kind === "remove_constraint") {
          setConstraints((current) =>
            current.filter((item) => item.id !== operation.constraintId)
          );
          setSelectedConstraintId((current) =>
            current === operation.constraintId ? null : current
          );
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
          return;
        }
        if (operation.kind === "remove_document_annotation") {
          setDocumentState((current) => ({
            ...current,
            annotations: current.annotations.filter(
              (item) => item.id !== operation.annotationId
            ),
          }));
        }
      });
    },
    [
      applyLocalBoardObjects,
      applyLocalStrokeCollection,
      finalizeStrokePreview,
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
