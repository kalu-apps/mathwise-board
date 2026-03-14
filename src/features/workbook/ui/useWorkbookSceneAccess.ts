import { useMemo } from "react";
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
    () =>
      buildWorkbookSceneIndex({
        boardObjects: params.boardObjects,
        strokes: params.strokes,
        getObjectRect: params.getObjectRect,
      }),
    [params.boardObjects, params.getObjectRect, params.strokes]
  );

  return useMemo(
    () =>
      buildWorkbookSceneAccessFromIndex({
        sceneIndex,
        viewportOffset: params.viewportOffset,
        width: params.width,
        height: params.height,
        zoom: params.zoom,
        visibilityMode: params.visibilityMode,
        renderPadding: params.renderPadding,
        hitPadding: params.hitPadding,
        forcedVisibleObjectIds: params.forcedVisibleObjectIds,
      }),
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
