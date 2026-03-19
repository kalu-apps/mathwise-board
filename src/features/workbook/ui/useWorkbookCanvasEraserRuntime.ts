import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import {
  applyEraserPointToCollections,
  areObjectEraserStoredPathsEquivalent,
  buildCommittedObjectEraserStoredPaths,
  buildEraserSegmentPoints,
  isPointInsideObjectEraserMask,
  normalizeObjectEraserPreviewPath,
  sanitizeObjectEraserCuts,
  sanitizeObjectEraserPaths,
  type ObjectEraserCut,
  type ObjectEraserPreviewPath,
  type ObjectEraserStoredPath,
} from "../model/eraser";
import {
  syncRemoteEraserPreviewState,
  type WorkbookIncomingEraserPreview,
  type RemoteEraserPreviewState,
} from "../model/remoteEraserPreview";
import {
  buildRenderedWorkbookStrokes,
} from "../model/sceneRender";
import {
  isWorkbookObjectErasedByCircle,
  isWorkbookObjectHit,
  isWorkbookStrokeErasedByCircle,
} from "../model/sceneHitTesting";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "../model/types";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface UseWorkbookCanvasEraserRuntimeParams {
  currentPage: number;
  width: number;
  erasing: boolean;
  incomingEraserPreviews: WorkbookIncomingEraserPreview[];
  allStrokes: WorkbookStroke[];
  visibleStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  objectById: Map<string, WorkbookBoardObject>;
  strokeByKey: Map<string, WorkbookStroke>;
  getLatestBoardObject?: (objectId: string) => WorkbookBoardObject | null;
  getObjectRect: (object: WorkbookBoardObject) => Rect;
  getStrokeCandidatesInRect: (rect: Rect) => WorkbookStroke[];
  getObjectCandidatesInRect: (rect: Rect) => WorkbookBoardObject[];
  eraserStrokeFragmentsRef: MutableRefObject<Map<string, WorkbookPoint[][]>>;
  eraserObjectCutsRef: MutableRefObject<Map<string, ObjectEraserCut[]>>;
  eraserObjectPreviewPathsRef: MutableRefObject<Map<string, ObjectEraserPreviewPath[]>>;
  erasedStrokeIdsRef: MutableRefObject<Set<string>>;
  eraserTouchedObjectIdsRef: MutableRefObject<Set<string>>;
  remoteEraserPreviewStateRef: MutableRefObject<RemoteEraserPreviewState>;
  eraserPreviewStrokeFragments: Record<string, WorkbookPoint[][]>;
  eraserPreviewObjectCuts: Record<string, ObjectEraserCut[]>;
  eraserPreviewObjectPaths: Record<string, ObjectEraserPreviewPath[]>;
  remoteEraserPreviewStrokeFragments: Record<string, WorkbookPoint[][]>;
  remoteEraserPreviewObjectCuts: Record<string, ObjectEraserCut[]>;
  remoteEraserPreviewObjectPaths: Record<string, ObjectEraserPreviewPath[]>;
  scheduleRemoteEraserPreviewRender: () => void;
  scheduleEraserPreviewRender: () => void;
  onEraserCommit?: (payload: {
    strokeDeletes: Array<{ strokeId: string; layer: WorkbookLayer }>;
    strokeReplacements: Array<{ stroke: WorkbookStroke; fragments: WorkbookPoint[][] }>;
    objectUpdates: Array<{ objectId: string; patch: Partial<WorkbookBoardObject> }>;
  }) => void;
  onStrokeDelete: (strokeId: string, layer: WorkbookLayer) => void;
  onStrokeReplace: (payload: {
    stroke: WorkbookStroke;
    fragments: WorkbookPoint[][];
  }) => void;
  onObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void;
}

export function useWorkbookCanvasEraserRuntime({
  currentPage,
  width,
  erasing,
  incomingEraserPreviews,
  allStrokes,
  visibleStrokes,
  boardObjects,
  objectById,
  strokeByKey,
  getLatestBoardObject,
  getObjectRect,
  getStrokeCandidatesInRect,
  getObjectCandidatesInRect,
  eraserStrokeFragmentsRef,
  eraserObjectCutsRef,
  eraserObjectPreviewPathsRef,
  erasedStrokeIdsRef,
  eraserTouchedObjectIdsRef,
  remoteEraserPreviewStateRef,
  eraserPreviewStrokeFragments,
  eraserPreviewObjectCuts,
  eraserPreviewObjectPaths,
  remoteEraserPreviewStrokeFragments,
  remoteEraserPreviewObjectCuts,
  remoteEraserPreviewObjectPaths,
  scheduleRemoteEraserPreviewRender,
  scheduleEraserPreviewRender,
  onEraserCommit,
  onStrokeDelete,
  onStrokeReplace,
  onObjectUpdate,
}: UseWorkbookCanvasEraserRuntimeParams) {
  const isStrokeErasedByCircle = useCallback(
    (stroke: WorkbookStroke, center: WorkbookPoint, radius: number) =>
      isWorkbookStrokeErasedByCircle(stroke, center, radius),
    []
  );

  const isObjectErasedByCircle = useCallback(
    (object: WorkbookBoardObject, center: WorkbookPoint, radius: number) => {
      const sourceObject = getLatestBoardObject?.(object.id) ?? object;
      if (!isWorkbookObjectErasedByCircle(sourceObject, center, radius)) return false;
      const previewCuts = eraserObjectCutsRef.current.get(sourceObject.id) ?? null;
      const previewPaths = eraserObjectPreviewPathsRef.current.get(sourceObject.id) ?? null;
      const sampleCount = 16;
      const samplePoints = [center];
      for (let index = 0; index < sampleCount; index += 1) {
        const angle = (Math.PI * 2 * index) / sampleCount;
        samplePoints.push({
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        });
      }
      return samplePoints.some(
        (point) =>
          isWorkbookObjectHit(sourceObject, point) &&
          !isPointInsideObjectEraserMask({
            object: sourceObject,
            point,
            getObjectRect,
            previewCuts,
            previewPaths,
          })
      );
    },
    [eraserObjectCutsRef, eraserObjectPreviewPathsRef, getLatestBoardObject, getObjectRect]
  );

  useEffect(() => {
    const safePage = Math.max(1, currentPage);
    const nextRemoteState = syncRemoteEraserPreviewState({
      state: remoteEraserPreviewStateRef.current,
      previews: incomingEraserPreviews,
      strokes: allStrokes,
      objects: boardObjects,
      page: safePage,
      getStrokeCandidatesInRect,
      getObjectCandidatesInRect,
      getObjectRect,
      isStrokeErasedByCircle,
      isObjectErasedByCircle,
    });
    remoteEraserPreviewStateRef.current = nextRemoteState.state;
    if (!nextRemoteState.changed) return;
    scheduleRemoteEraserPreviewRender();
  }, [
    allStrokes,
    boardObjects,
    currentPage,
    getObjectCandidatesInRect,
    getObjectRect,
    getStrokeCandidatesInRect,
    incomingEraserPreviews,
    isObjectErasedByCircle,
    isStrokeErasedByCircle,
    remoteEraserPreviewStateRef,
    scheduleRemoteEraserPreviewRender,
  ]);

  const activeEraserPreviewStrokeFragments = erasing
    ? eraserPreviewStrokeFragments
    : remoteEraserPreviewStrokeFragments;
  const activeEraserPreviewObjectCuts = erasing
    ? eraserPreviewObjectCuts
    : remoteEraserPreviewObjectCuts;
  const activeEraserPreviewObjectPaths = erasing
    ? eraserPreviewObjectPaths
    : remoteEraserPreviewObjectPaths;
  const eraserPreviewActive = erasing || incomingEraserPreviews.length > 0;

  const renderedStrokes = useMemo(() => {
    const { rendered } = buildRenderedWorkbookStrokes({
      visibleStrokes,
      eraserPreviewActive,
      previewStrokeFragments: activeEraserPreviewStrokeFragments,
    });
    return rendered;
  }, [activeEraserPreviewStrokeFragments, eraserPreviewActive, visibleStrokes]);

  const eraseAtPoint = useCallback(
    (center: WorkbookPoint) => {
      const radius = Math.max(4, width);
      const queryRect = {
        x: center.x - radius,
        y: center.y - radius,
        width: radius * 2,
        height: radius * 2,
      };
      applyEraserPointToCollections({
        center,
        radius,
        strokes: getStrokeCandidatesInRect(queryRect),
        objects: getObjectCandidatesInRect(queryRect),
        strokeFragmentsMap: eraserStrokeFragmentsRef.current,
        objectCutsMap: eraserObjectCutsRef.current,
        objectPreviewPathsMap: eraserObjectPreviewPathsRef.current,
        touchedStrokeIds: erasedStrokeIdsRef.current,
        touchedObjectIds: eraserTouchedObjectIdsRef.current,
        getObjectRect,
        isStrokeErasedByCircle,
        isObjectErasedByCircle,
        resolveObjectForErasing: (object) => getLatestBoardObject?.(object.id) ?? object,
      });
      scheduleEraserPreviewRender();
    },
    [
      erasedStrokeIdsRef,
      eraserObjectCutsRef,
      eraserObjectPreviewPathsRef,
      eraserStrokeFragmentsRef,
      eraserTouchedObjectIdsRef,
      getLatestBoardObject,
      getObjectCandidatesInRect,
      getObjectRect,
      getStrokeCandidatesInRect,
      isObjectErasedByCircle,
      isStrokeErasedByCircle,
      scheduleEraserPreviewRender,
      width,
    ]
  );

  const eraseAlongSegment = useCallback(
    (from: WorkbookPoint, to: WorkbookPoint) => {
      const radius = Math.max(4, width);
      const sampledPoints = buildEraserSegmentPoints(from, to, radius);
      sampledPoints.forEach((point) => {
        eraseAtPoint(point);
      });
      return sampledPoints;
    },
    [eraseAtPoint, width]
  );

  const commitEraserGesture = useCallback(() => {
    const strokeDeletes: Array<{ strokeId: string; layer: WorkbookLayer }> = [];
    const strokeReplacements: Array<{
      stroke: WorkbookStroke;
      fragments: WorkbookPoint[][];
    }> = [];
    const objectUpdates: Array<{
      objectId: string;
      patch: Partial<WorkbookBoardObject>;
    }> = [];

    erasedStrokeIdsRef.current.forEach((key) => {
      const [targetLayer, strokeId] = key.split(":");
      if (!strokeId) return;
      const sourceStroke = strokeByKey.get(key) ?? null;
      if (!sourceStroke) return;
      const fragments = eraserStrokeFragmentsRef.current.get(key) ?? [];
      if (fragments.length === 0) {
        strokeDeletes.push({
          strokeId,
          layer: targetLayer === "annotations" ? "annotations" : "board",
        });
        return;
      }
      strokeReplacements.push({
        stroke: sourceStroke,
        fragments,
      });
    });

    if (eraserTouchedObjectIdsRef.current.size > 0) {
      const touchedIds = Array.from(eraserTouchedObjectIdsRef.current);
      touchedIds.forEach((objectId) => {
        const sourceObject = getLatestBoardObject?.(objectId) ?? objectById.get(objectId) ?? null;
        const cuts = eraserObjectCutsRef.current.get(objectId);
        if (!cuts || cuts.length === 0) return;
        const nextStoredPaths = (
          eraserObjectPreviewPathsRef.current.get(objectId) ?? []
        ).reduce<ObjectEraserStoredPath[]>((acc, path) => {
          const normalized = sourceObject
            ? normalizeObjectEraserPreviewPath(sourceObject, path, getObjectRect)
            : null;
          if (normalized) {
            acc.push(normalized);
          }
          return acc;
        }, []);
        const existingStoredPaths = sourceObject
          ? sanitizeObjectEraserPaths(sourceObject, getObjectRect)
          : [];
        const persistedPaths = sourceObject
          ? buildCommittedObjectEraserStoredPaths({
              object: sourceObject,
              getObjectRect,
              nextStoredPaths,
            })
          : [];
        const currentCuts = sourceObject
          ? sanitizeObjectEraserCuts(sourceObject, getObjectRect)
          : [];
        if (
          currentCuts.length === 0 &&
          areObjectEraserStoredPathsEquivalent(existingStoredPaths, persistedPaths)
        ) {
          return;
        }
        objectUpdates.push({
          objectId,
          patch: {
            meta: {
              eraserCuts: [],
              eraserPaths: persistedPaths,
            },
          },
        });
      });
    }

    if (
      strokeDeletes.length === 0 &&
      strokeReplacements.length === 0 &&
      objectUpdates.length === 0
    ) {
      return;
    }

    if (onEraserCommit) {
      onEraserCommit({
        strokeDeletes,
        strokeReplacements,
        objectUpdates,
      });
      return;
    }

    strokeDeletes.forEach((entry) => {
      onStrokeDelete(entry.strokeId, entry.layer);
    });
    strokeReplacements.forEach((entry) => {
      onStrokeReplace(entry);
    });
    objectUpdates.forEach((entry) => {
      onObjectUpdate(entry.objectId, entry.patch, {
        trackHistory: true,
        markDirty: true,
      });
    });
  }, [
    erasedStrokeIdsRef,
    eraserObjectCutsRef,
    eraserObjectPreviewPathsRef,
    eraserStrokeFragmentsRef,
    eraserTouchedObjectIdsRef,
    getLatestBoardObject,
    getObjectRect,
    objectById,
    onEraserCommit,
    onObjectUpdate,
    onStrokeDelete,
    onStrokeReplace,
    strokeByKey,
  ]);

  return {
    renderedStrokes,
    eraserPreviewActive,
    activeEraserPreviewObjectCuts,
    activeEraserPreviewObjectPaths,
    eraseAtPoint,
    eraseAlongSegment,
    commitEraserGesture,
  };
}
