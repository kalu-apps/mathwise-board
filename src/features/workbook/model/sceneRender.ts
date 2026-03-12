import type { ReactNode } from "react";
import {
  buildFunctionGraphPlots,
  getAutoGraphGridStep,
  type FunctionGraphPlot,
  type GraphFunctionDraft,
} from "./functionGraph";
import {
  resolveObjectEraserCutsForRender,
  resolveObjectEraserPathsForRender,
  sanitizeObjectEraserCuts,
  sanitizeObjectEraserPaths,
  type ObjectEraserCut,
  type ObjectEraserPreviewPath,
} from "./eraser";
import {
  getObjectCenter,
  getObjectRect,
  mapConstraintLabel,
  normalizeRect,
} from "./sceneGeometry";
import {
  getAreaSelectionDraftRect,
  resizeAreaSelectionRect,
  type WorkbookAreaSelectionDraft,
  type WorkbookAreaSelectionResizeMode,
} from "./sceneSelection";
import type { MovingState } from "./sceneRuntime";
import type { GraphPanState } from "./sceneRuntime";
import { rectIntersects } from "./sceneVisibility";
import type {
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";

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

export type WorkbookMaskedObjectSceneEntry = {
  id: string;
  renderedObject: ReactNode;
  resolvedEraserCuts: ObjectEraserCut[];
  maskPaths: ObjectEraserPreviewPath[];
  maskBounds: { x: number; y: number; width: number; height: number } | null;
};

export type WorkbookConstraintRenderSegment = {
  constraint: WorkbookConstraint;
  source: WorkbookPoint;
  target: WorkbookPoint;
  label: string;
};

export type PreparedFunctionGraphRenderState = {
  axisColor: string;
  planeColor: string;
  centerX: number;
  centerY: number;
  plots: FunctionGraphPlot[];
  ghostPlots: FunctionGraphPlot[];
};

const ERASER_MASK_PADDING = 20;

const expandRectByPadding = (
  rect: { x: number; y: number; width: number; height: number },
  padding: number
) => ({
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2,
});

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

export const buildMaskedObjectSceneEntry = (params: {
  object: WorkbookBoardObject;
  renderSource: WorkbookBoardObject;
  renderedObject: ReactNode;
  eraserPreviewActive: boolean;
  previewObjectCuts: Record<string, ObjectEraserCut[]>;
  previewObjectPaths: Record<string, ObjectEraserPreviewPath[]>;
}): WorkbookMaskedObjectSceneEntry => {
  const {
    object,
    renderSource,
    renderedObject,
    eraserPreviewActive,
    previewObjectCuts,
    previewObjectPaths,
  } = params;
  const committedEraserCuts = sanitizeObjectEraserCuts(renderSource, getObjectRect);
  const committedEraserPaths = resolveObjectEraserPathsForRender(
    renderSource,
    sanitizeObjectEraserPaths(renderSource, getObjectRect),
    getObjectRect
  );
  const previewPaths = eraserPreviewActive ? previewObjectPaths[renderSource.id] ?? [] : [];
  const maskPaths =
    committedEraserPaths.length > 0 ? [...committedEraserPaths, ...previewPaths] : previewPaths;
  const previewCuts =
    eraserPreviewActive && maskPaths.length === 0
      ? previewObjectCuts[renderSource.id] ?? committedEraserCuts
      : committedEraserCuts;
  const resolvedEraserCuts =
    committedEraserPaths.length > 0
      ? []
      : resolveObjectEraserCutsForRender(renderSource, previewCuts, getObjectRect);
  if (resolvedEraserCuts.length === 0 && maskPaths.length === 0) {
    return {
      id: object.id,
      renderedObject,
      resolvedEraserCuts,
      maskPaths,
      maskBounds: null,
    };
  }
  const objectRect = getObjectRect(renderSource);
  let minX = objectRect.x - ERASER_MASK_PADDING;
  let minY = objectRect.y - ERASER_MASK_PADDING;
  let maxX = objectRect.x + objectRect.width + ERASER_MASK_PADDING;
  let maxY = objectRect.y + objectRect.height + ERASER_MASK_PADDING;
  resolvedEraserCuts.forEach((cut) => {
    minX = Math.min(minX, cut.x - cut.radius - ERASER_MASK_PADDING);
    minY = Math.min(minY, cut.y - cut.radius - ERASER_MASK_PADDING);
    maxX = Math.max(maxX, cut.x + cut.radius + ERASER_MASK_PADDING);
    maxY = Math.max(maxY, cut.y + cut.radius + ERASER_MASK_PADDING);
  });
  maskPaths.forEach((path) => {
    path.points.forEach((point) => {
      minX = Math.min(minX, point.x - path.radius - ERASER_MASK_PADDING);
      minY = Math.min(minY, point.y - path.radius - ERASER_MASK_PADDING);
      maxX = Math.max(maxX, point.x + path.radius + ERASER_MASK_PADDING);
      maxY = Math.max(maxY, point.y + path.radius + ERASER_MASK_PADDING);
    });
  });
  return {
    id: object.id,
    renderedObject,
    resolvedEraserCuts,
    maskPaths,
    maskBounds: {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    },
  };
};

export const buildRenderedWorkbookStrokes = (params: {
  visibleStrokes: WorkbookStroke[];
  eraserPreviewActive: boolean;
  previewStrokeFragments: Record<string, WorkbookPoint[][]>;
}) =>
  params.visibleStrokes.flatMap((stroke) => {
    const key = `${stroke.layer}:${stroke.id}`;
    const previewFragments = params.eraserPreviewActive
      ? params.previewStrokeFragments[key]
      : undefined;
    if (!previewFragments) return [stroke];
    return previewFragments.map((points, index) => ({
      ...stroke,
      id: `${stroke.id}::preview-${index}`,
      points,
    }));
  });

export const buildConstraintRenderSegments = (params: {
  constraints: WorkbookConstraint[];
  objectById: Map<string, WorkbookBoardObject>;
  selectedConstraintId: string | null;
  renderViewportRect: { x: number; y: number; width: number; height: number };
}) =>
  params.constraints.reduce<WorkbookConstraintRenderSegment[]>((acc, constraint) => {
    const source = params.objectById.get(constraint.sourceObjectId);
    const target = params.objectById.get(constraint.targetObjectId);
    if (!source || !target) return acc;
    const sourceCenter = getObjectCenter(source);
    const targetCenter = getObjectCenter(target);
    const segmentBounds = expandRectByPadding(normalizeRect(sourceCenter, targetCenter), 32);
    if (
      constraint.id !== params.selectedConstraintId &&
      !rectIntersects(segmentBounds, params.renderViewportRect)
    ) {
      return acc;
    }
    acc.push({
      constraint,
      source: sourceCenter,
      target: targetCenter,
      label: mapConstraintLabel(constraint.type),
    });
    return acc;
  }, []);

export const prepareFunctionGraphRenderState = (params: {
  object: WorkbookBoardObject;
  normalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  gridSize: number;
  graphPan: GraphPanState | null;
}): PreparedFunctionGraphRenderState => {
  const { object, normalized, gridSize, graphPan } = params;
  const functions = Array.isArray(object.meta?.functions)
    ? (object.meta.functions as GraphFunctionDraft[])
    : [];
  const graphPanPreviewActive = Boolean(graphPan && graphPan.object.id === object.id);
  const activeGraphPan = graphPanPreviewActive ? graphPan : null;
  const axisColorRaw = object.meta?.axisColor;
  const axisColor =
    typeof axisColorRaw === "string" && axisColorRaw.startsWith("#")
      ? axisColorRaw
      : "#ff8e3c";
  const planeColorRaw = object.meta?.planeColor;
  const planeColor =
    typeof planeColorRaw === "string"
      ? planeColorRaw === "transparent" || planeColorRaw.startsWith("#")
        ? planeColorRaw
        : "#8ea7ff"
      : "#8ea7ff";
  const autoStep = getAutoGraphGridStep({
    width: normalized.width,
    height: normalized.height,
  });
  const step = Math.max(
    12,
    Math.min(64, Math.round(Number.isFinite(gridSize) && gridSize > 0 ? gridSize : autoStep))
  );
  const viewport = {
    x: normalized.x,
    y: normalized.y,
    width: normalized.width,
    height: normalized.height,
  };
  return {
    axisColor,
    planeColor,
    centerX: normalized.x + normalized.width / 2,
    centerY: normalized.y + normalized.height / 2,
    plots: buildFunctionGraphPlots(functions, viewport, step),
    ghostPlots: activeGraphPan
      ? buildFunctionGraphPlots(
          activeGraphPan.initialFunctions.filter(
            (entry) =>
              !activeGraphPan.targetFunctionId || entry.id === activeGraphPan.targetFunctionId
          ),
          viewport,
          step
        )
      : [],
  };
};

export const buildFunctionGraphRenderStateMap = (params: {
  visibleBoardObjects: WorkbookBoardObject[];
  selectedPreviewObject: WorkbookBoardObject | null;
  graphPan: GraphPanState | null;
  gridSize: number;
}) => {
  const { visibleBoardObjects, selectedPreviewObject, graphPan, gridSize } = params;
  const next = new Map<string, PreparedFunctionGraphRenderState>();
  visibleBoardObjects.forEach((object) => {
    if (object.type !== "function_graph") return;
    const renderSource =
      selectedPreviewObject?.id === object.id ? selectedPreviewObject : object;
    const normalized = getObjectRect(renderSource);
    next.set(
      object.id,
      prepareFunctionGraphRenderState({
        object: renderSource,
        normalized,
        gridSize,
        graphPan,
      })
    );
  });
  return next;
};
