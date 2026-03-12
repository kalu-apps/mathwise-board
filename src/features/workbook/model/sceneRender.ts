import { getObjectRect, normalizeRect } from "./sceneGeometry";
import {
  getAreaSelectionDraftRect,
  resizeAreaSelectionRect,
  type WorkbookAreaSelectionDraft,
  type WorkbookAreaSelectionResizeMode,
} from "./sceneSelection";
import type { MovingState } from "./sceneRuntime";
import type { WorkbookBoardObject, WorkbookPoint } from "./types";

export type Solid3dPreviewMetaById = Record<string, Record<string, unknown>>;

export type WorkbookAreaSelectionResizeStateLike = {
  initialRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  mode: WorkbookAreaSelectionResizeMode;
  current: WorkbookPoint;
};

export type PreparedWorkbookRenderObject = {
  object: WorkbookBoardObject;
  rect: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  normalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  centerX: number;
  centerY: number;
  rotation: number;
  transform: string | undefined;
};

export const prepareWorkbookRenderObject = (params: {
  objectSource: WorkbookBoardObject;
  moving: MovingState | null;
  activeMoveRect:
    | {
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | null;
  solid3dPreviewMetaById: Solid3dPreviewMetaById;
}): PreparedWorkbookRenderObject => {
  const { objectSource, moving, activeMoveRect, solid3dPreviewMetaById } = params;
  const previewMeta = solid3dPreviewMetaById[objectSource.id];
  const movingDelta =
    moving
      ? {
          x: moving.current.x - moving.start.x,
          y: moving.current.y - moving.start.y,
        }
      : null;
  const isInMovingGroup =
    moving?.groupObjects.some((entry) => entry.id === objectSource.id) ?? false;
  const movingBaseObject =
    isInMovingGroup && moving
      ? moving.groupObjects.find((entry) => entry.id === objectSource.id) ??
        (moving.object.id === objectSource.id ? moving.object : null)
      : null;
  let object =
    previewMeta && objectSource.type === "solid3d"
      ? { ...objectSource, meta: previewMeta }
      : objectSource;
  if (movingBaseObject && movingDelta) {
    const sourceForMove =
      previewMeta && movingBaseObject.type === "solid3d"
        ? { ...movingBaseObject, meta: previewMeta }
        : movingBaseObject;
    object = {
      ...sourceForMove,
      x: sourceForMove.x + movingDelta.x,
      y: sourceForMove.y + movingDelta.y,
      points: Array.isArray(sourceForMove.points)
        ? sourceForMove.points.map((point) => ({
            x: point.x + movingDelta.x,
            y: point.y + movingDelta.y,
          }))
        : sourceForMove.points,
    };
  }
  const rect =
    activeMoveRect && activeMoveRect.id === object.id
      ? { ...activeMoveRect }
      : {
          id: object.id,
          x: object.x,
          y: object.y,
          width: object.width,
          height: object.height,
        };
  const normalized =
    Array.isArray(object.points) && object.points.length > 0
      ? getObjectRect(object)
      : normalizeRect(
          { x: rect.x, y: rect.y },
          { x: rect.x + rect.width, y: rect.y + rect.height }
        );
  const centerX = normalized.x + normalized.width / 2;
  const centerY = normalized.y + normalized.height / 2;
  const rotation = Number.isFinite(object.rotation) ? (object.rotation as number) : 0;
  return {
    object,
    rect,
    normalized,
    centerX,
    centerY,
    rotation,
    transform: rotation ? `rotate(${rotation} ${centerX} ${centerY})` : undefined,
  };
};

export const resolveSelectedObjectRect = (
  selectedPreviewObject: WorkbookBoardObject | null
) => {
  if (!selectedPreviewObject) return null;
  if (
    selectedPreviewObject.type === "line" ||
    selectedPreviewObject.type === "arrow" ||
    (Array.isArray(selectedPreviewObject.points) && selectedPreviewObject.points.length > 0)
  ) {
    return getObjectRect(selectedPreviewObject);
  }
  return normalizeRect(
    { x: selectedPreviewObject.x, y: selectedPreviewObject.y },
    {
      x: selectedPreviewObject.x + selectedPreviewObject.width,
      y: selectedPreviewObject.y + selectedPreviewObject.height,
    }
  );
};

export const resolveAreaSelectionPreviewRects = (params: {
  areaSelectionDraft: WorkbookAreaSelectionDraft | null;
  areaSelectionResize: WorkbookAreaSelectionResizeStateLike | null;
}) => ({
  areaSelectionDraftRect: params.areaSelectionDraft
    ? getAreaSelectionDraftRect(params.areaSelectionDraft)
    : null,
  areaSelectionResizeRect: params.areaSelectionResize
    ? resizeAreaSelectionRect(
        params.areaSelectionResize.initialRect,
        params.areaSelectionResize.mode,
        params.areaSelectionResize.current
      )
    : null,
});
