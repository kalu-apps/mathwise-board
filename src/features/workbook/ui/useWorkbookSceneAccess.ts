import { useMemo } from "react";
import { reportWorkbookPerfPhaseMetric } from "../model/workbookPerformance";
import type { WorkbookBoardObject, WorkbookPoint, WorkbookStroke } from "../model/types";
import {
  buildWorkbookSceneAccessFromIndex,
  buildWorkbookSceneIndex,
  type WorkbookSceneAccess,
  type WorkbookSceneRect,
} from "../model/sceneVisibility";

type UseWorkbookSceneAccessParams = {
  boardObjects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
  viewportOffset: WorkbookPoint;
  width: number;
  height: number;
  zoom: number;
  visibilityMode?: "viewport" | "full";
  forcedVisibleObjectIds?: ReadonlySet<string>;
  renderPadding?: number;
  hitPadding?: number;
  getObjectRect: (object: WorkbookBoardObject) => WorkbookSceneRect;
};

export const useWorkbookSceneAccess = (
  params: UseWorkbookSceneAccessParams
): WorkbookSceneAccess => {
  const sceneIndex = useMemo(
    () => {
      const startedAtMs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const index = buildWorkbookSceneIndex({
        boardObjects: params.boardObjects,
        strokes: params.strokes,
        getObjectRect: params.getObjectRect,
      });
      const finishedAtMs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      reportWorkbookPerfPhaseMetric({
        name: "scene_index_rebuild_ms",
        durationMs: finishedAtMs - startedAtMs,
        counters: {
          objectCount: index.metrics.objectCount,
          strokeCount: index.metrics.strokeCount,
          totalStrokePoints: index.metrics.totalStrokePoints,
          objectRectCacheHits: index.metrics.objectRectCacheHits,
          objectRectCacheMisses: index.metrics.objectRectCacheMisses,
          strokeRectCacheHits: index.metrics.strokeRectCacheHits,
          strokeRectCacheMisses: index.metrics.strokeRectCacheMisses,
        },
      });
      return index;
    },
    [params.boardObjects, params.getObjectRect, params.strokes]
  );

  return useMemo(
    () => {
      const startedAtMs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const access = buildWorkbookSceneAccessFromIndex({
        sceneIndex,
        viewportOffset: params.viewportOffset,
        width: params.width,
        height: params.height,
        zoom: params.zoom,
        visibilityMode: params.visibilityMode,
        renderPadding: params.renderPadding,
        hitPadding: params.hitPadding,
        forcedVisibleObjectIds: params.forcedVisibleObjectIds,
      });
      const finishedAtMs =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      reportWorkbookPerfPhaseMetric({
        name: "scene_access_rebuild_ms",
        durationMs: finishedAtMs - startedAtMs,
        counters: {
          visibleObjects: access.visibleBoardObjects.length,
          visibleHitObjects: access.visibleHitObjects.length,
          visibleStrokes: access.visibleStrokes.length,
          visibleHitStrokes: access.visibleHitStrokes.length,
          viewportWidth: Math.round(access.viewportRect.width),
          viewportHeight: Math.round(access.viewportRect.height),
        },
      });
      return access;
    },
    [
      params.forcedVisibleObjectIds,
      params.height,
      params.hitPadding,
      params.visibilityMode,
      params.renderPadding,
      params.viewportOffset,
      params.width,
      params.zoom,
      sceneIndex,
    ]
  );
};
