import { sanitizeFunctionGraphDrafts, type GraphFunctionDraft } from "./functionGraph";
import { getLineControlPoints, getObjectRect, isInsideRect, normalizeRect, rotatePointAround } from "./sceneGeometry";
import {
  applyGraphPanToFunctions,
  resolveFunctionGraphScale,
  type GraphPanState,
  type MovingState,
  type ResizeState,
} from "./sceneRuntime";
import {
  buildAreaSelection,
  getAreaSelectionDraftRect,
  hasMeaningfulAreaSelectionRect,
  resizeAreaSelectionRect,
  type WorkbookAreaSelection,
  type WorkbookAreaSelectionDraft,
  type WorkbookAreaSelectionResizeMode,
} from "./sceneSelection";
import { readSolid3dState, writeSolid3dState } from "./solid3dState";
import type {
  WorkbookBoardObject,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";

export type Solid3dGestureState = {
  object: WorkbookBoardObject;
  mode: "rotate" | "pan";
  start: WorkbookPoint;
  baseRotationX: number;
  baseRotationY: number;
  basePanX: number;
  basePanY: number;
};

export type PanState = {
  start: WorkbookPoint;
  baseOffset: WorkbookPoint;
};

export type WorkbookAreaSelectionResizeState = {
  initialRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  mode: WorkbookAreaSelectionResizeMode;
  current: WorkbookPoint;
};

export const buildPanState = (
  start: WorkbookPoint,
  baseOffset: WorkbookPoint
): PanState => ({
  start,
  baseOffset,
});

export const buildMovingState = (params: {
  object: WorkbookBoardObject;
  groupObjects: WorkbookBoardObject[];
  start: WorkbookPoint;
  startClientX: number;
  startClientY: number;
}): MovingState => ({
  object: params.object,
  groupObjects: params.groupObjects,
  start: params.start,
  current: params.start,
  startClientX: params.startClientX,
  startClientY: params.startClientY,
});

export const buildPanningOffset = (
  pan: PanState,
  clientX: number,
  clientY: number,
  safeZoom: number
): WorkbookPoint => {
  const dy = clientY - pan.start.y;
  return {
    x: pan.baseOffset.x,
    y: Math.max(0, pan.baseOffset.y - dy / safeZoom),
  };
};

export const buildMovingCurrentPoint = (
  moving: MovingState,
  clientX: number,
  clientY: number,
  safeZoom: number
): WorkbookPoint => {
  const deltaX = (clientX - moving.startClientX) / safeZoom;
  const deltaY = (clientY - moving.startClientY) / safeZoom;
  return {
    x: moving.start.x + deltaX,
    y: moving.start.y + deltaY,
  };
};

export const resolveObjectResizeMode = (
  object: WorkbookBoardObject,
  point: WorkbookPoint
): ResizeState["mode"] | null => {
  if (object.type === "section_divider" || object.type === "point") {
    return null;
  }
  if (object.type === "line" || object.type === "arrow") {
    const rect = getObjectRect(object);
    const startDistance = Math.hypot(point.x - object.x, point.y - object.y);
    if (startDistance <= 8) return "line-start";
    const endDistance = Math.hypot(
      point.x - (object.x + object.width),
      point.y - (object.y + object.height)
    );
    if (endDistance <= 8) return "line-end";
    const corners = [
      { mode: "nw" as const, x: rect.x, y: rect.y },
      { mode: "ne" as const, x: rect.x + rect.width, y: rect.y },
      { mode: "se" as const, x: rect.x + rect.width, y: rect.y + rect.height },
      { mode: "sw" as const, x: rect.x, y: rect.y + rect.height },
    ];
    const corner = corners.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 8);
    if (corner) return corner.mode;
    const rotateX = rect.x + rect.width / 2;
    const rotateY = rect.y - 18;
    if (Math.hypot(point.x - rotateX, point.y - rotateY) <= 8) {
      return "rotate";
    }
    const controls = getLineControlPoints(object);
    if (Math.hypot(point.x - controls.c1.x, point.y - controls.c1.y) <= 8) {
      return "line-curve-c1";
    }
    if (Math.hypot(point.x - controls.c2.x, point.y - controls.c2.y) <= 8) {
      return "line-curve-c2";
    }
    return null;
  }
  const rect = normalizeRect(
    { x: object.x, y: object.y },
    { x: object.x + object.width, y: object.y + object.height }
  );
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  const localPoint =
    object.rotation && Number.isFinite(object.rotation)
      ? rotatePointAround(point, center, -(object.rotation ?? 0))
      : point;
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const cx = left + rect.width / 2;
  const hit = 8;
  const rotateHandle = { x: cx, y: top - 18 };
  if (Math.hypot(localPoint.x - rotateHandle.x, localPoint.y - rotateHandle.y) <= hit) {
    return "rotate";
  }
  if (Math.abs(localPoint.x - left) <= hit && Math.abs(localPoint.y - top) <= hit) {
    return "nw";
  }
  if (Math.abs(localPoint.x - right) <= hit && Math.abs(localPoint.y - top) <= hit) {
    return "ne";
  }
  if (Math.abs(localPoint.x - right) <= hit && Math.abs(localPoint.y - bottom) <= hit) {
    return "se";
  }
  if (Math.abs(localPoint.x - left) <= hit && Math.abs(localPoint.y - bottom) <= hit) {
    return "sw";
  }
  if (Math.abs(localPoint.x - cx) <= hit && Math.abs(localPoint.y - top) <= hit) {
    return "n";
  }
  if (Math.abs(localPoint.x - right) <= hit && Math.abs(localPoint.y - (top + bottom) / 2) <= hit) {
    return "e";
  }
  if (Math.abs(localPoint.x - cx) <= hit && Math.abs(localPoint.y - bottom) <= hit) {
    return "s";
  }
  if (Math.abs(localPoint.x - left) <= hit && Math.abs(localPoint.y - (top + bottom) / 2) <= hit) {
    return "w";
  }
  return null;
};

export const buildResizeState = (
  object: WorkbookBoardObject,
  mode: ResizeState["mode"],
  start: WorkbookPoint
): ResizeState => ({
  object,
  mode,
  start,
  current: start,
});

export const buildSolid3dGestureState = (
  object: WorkbookBoardObject,
  mode: Solid3dGestureState["mode"],
  start: WorkbookPoint
): Solid3dGestureState => {
  const state = readSolid3dState(object.meta);
  return {
    object,
    mode,
    start,
    baseRotationX: state.view.rotationX,
    baseRotationY: state.view.rotationY,
    basePanX: state.view.panX,
    basePanY: state.view.panY,
  };
};

export const buildSolid3dResizeState = (params: {
  object: WorkbookBoardObject;
  mode: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";
  start: WorkbookPoint;
  startLocal: WorkbookPoint;
}) => ({
  object: params.object,
  mode: params.mode,
  start: params.start,
  current: params.start,
  center: {
    x: params.object.x + params.object.width / 2,
    y: params.object.y + params.object.height / 2,
  },
  startLocal: params.startLocal,
});

export const buildSolid3dGesturePreviewMeta = (
  gesture: Solid3dGestureState,
  point: WorkbookPoint
): Record<string, unknown> => {
  const deltaX = point.x - gesture.start.x;
  const deltaY = point.y - gesture.start.y;
  const currentState = readSolid3dState(gesture.object.meta);
  const nextView =
    gesture.mode === "rotate"
      ? {
          ...currentState.view,
          rotationY: gesture.baseRotationY + deltaX * 0.38,
          rotationX: gesture.baseRotationX + deltaY * 0.32,
        }
      : {
          ...currentState.view,
          panX: gesture.basePanX + deltaX / 240,
          panY: gesture.basePanY + deltaY / 240,
        };
  return writeSolid3dState(
    { ...currentState, view: nextView },
    gesture.object.meta
  );
};

export const buildGraphPanState = (params: {
  object: WorkbookBoardObject;
  targetFunctionId: string;
  start: WorkbookPoint;
  gridSize: number;
}): GraphPanState | null => {
  if (params.object.type !== "function_graph") return null;
  const rawFunctions = Array.isArray(params.object.meta?.functions)
    ? (params.object.meta.functions as GraphFunctionDraft[])
    : [];
  const initialFunctions = sanitizeFunctionGraphDrafts(rawFunctions, {
    ensureNonEmpty: false,
  });
  const { pxPerUnit } = resolveFunctionGraphScale(params.object, params.gridSize);
  return {
    object: params.object,
    targetFunctionId: params.targetFunctionId,
    start: params.start,
    current: params.start,
    initialFunctions,
    pxPerUnit,
  };
};

export const buildAreaSelectionDraftState = (
  point: WorkbookPoint
): WorkbookAreaSelectionDraft => ({
  start: point,
  current: point,
});

export const buildAreaSelectionResizeState = (
  initialRect: WorkbookAreaSelection["rect"],
  mode: WorkbookAreaSelectionResizeMode,
  point: WorkbookPoint
): WorkbookAreaSelectionResizeState => ({
  initialRect,
  mode,
  current: point,
});

export const finalizeAreaSelectionDraft = (params: {
  draft: WorkbookAreaSelectionDraft;
  boardObjects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
}): WorkbookAreaSelection | null => {
  const nextRect = getAreaSelectionDraftRect(params.draft);
  if (!hasMeaningfulAreaSelectionRect(nextRect)) {
    return null;
  }
  return buildAreaSelection(nextRect, params.boardObjects, params.strokes);
};

export const finalizeAreaSelectionDraftWithQueries = (params: {
  draft: WorkbookAreaSelectionDraft;
  boardObjectCandidatesInRect: (rect: WorkbookAreaSelection["rect"]) => WorkbookBoardObject[];
  strokeCandidatesInRect: (rect: WorkbookAreaSelection["rect"]) => WorkbookStroke[];
}): WorkbookAreaSelection | null => {
  const nextRect = getAreaSelectionDraftRect(params.draft);
  if (!hasMeaningfulAreaSelectionRect(nextRect)) {
    return null;
  }
  return buildAreaSelection(
    nextRect,
    params.boardObjectCandidatesInRect(nextRect),
    params.strokeCandidatesInRect(nextRect)
  );
};

export const finalizeAreaSelectionResize = (params: {
  resize: WorkbookAreaSelectionResizeState;
  boardObjects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
}): WorkbookAreaSelection | null => {
  const nextRect = resizeAreaSelectionRect(
    params.resize.initialRect,
    params.resize.mode,
    params.resize.current
  );
  if (!hasMeaningfulAreaSelectionRect(nextRect)) {
    return null;
  }
  return buildAreaSelection(nextRect, params.boardObjects, params.strokes);
};

export const finalizeAreaSelectionResizeWithQueries = (params: {
  resize: WorkbookAreaSelectionResizeState;
  boardObjectCandidatesInRect: (rect: WorkbookAreaSelection["rect"]) => WorkbookBoardObject[];
  strokeCandidatesInRect: (rect: WorkbookAreaSelection["rect"]) => WorkbookStroke[];
}): WorkbookAreaSelection | null => {
  const nextRect = resizeAreaSelectionRect(
    params.resize.initialRect,
    params.resize.mode,
    params.resize.current
  );
  if (!hasMeaningfulAreaSelectionRect(nextRect)) {
    return null;
  }
  return buildAreaSelection(
    nextRect,
    params.boardObjectCandidatesInRect(nextRect),
    params.strokeCandidatesInRect(nextRect)
  );
};

export const buildGraphPanCommitPatch = (
  graphPan: GraphPanState
): Partial<WorkbookBoardObject> => {
  const deltaX = graphPan.current.x - graphPan.start.x;
  const deltaY = graphPan.current.y - graphPan.start.y;
  const shiftedFunctions = applyGraphPanToFunctions(
    graphPan.initialFunctions,
    deltaX,
    deltaY,
    graphPan.pxPerUnit,
    graphPan.targetFunctionId
  );
  return {
    meta: {
      ...(graphPan.object.meta ?? {}),
      functions: shiftedFunctions,
    },
  };
};

export const shouldKeepObjectSelectedInsideArea = (
  point: WorkbookPoint,
  areaSelection: WorkbookAreaSelection | null
) =>
  Boolean(
    areaSelection &&
      (areaSelection.objectIds.length > 0 || areaSelection.strokeIds.length > 0) &&
      isInsideRect(point, areaSelection.rect)
  );
