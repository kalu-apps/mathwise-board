import { getAutoGraphGridStep, type GraphFunctionDraft } from "./functionGraph";
import {
  getObjectRect,
  getPointsBoundsFromPoints,
  normalizeRect,
  projectPointToLineCurve,
  readLineCurveMeta,
  rotatePointAround,
} from "./sceneGeometry";
import type { WorkbookAreaSelection } from "./sceneSelection";
import type { WorkbookBoardObject, WorkbookLayer, WorkbookPoint } from "./types";

type ClientPointLike = {
  clientX: number;
  clientY: number;
};

export type MovingState = {
  object: WorkbookBoardObject;
  groupObjects: WorkbookBoardObject[];
  groupStrokeSelections: Array<{ id: string; layer: WorkbookLayer }>;
  start: WorkbookPoint;
  current: WorkbookPoint;
  startClientX: number;
  startClientY: number;
};

export type ResizeState = {
  object: WorkbookBoardObject;
  mode:
    | "n"
    | "s"
    | "w"
    | "e"
    | "nw"
    | "ne"
    | "sw"
    | "se"
    | "line-start"
    | "line-end"
    | "line-curve-c1"
    | "line-curve-c2"
    | "rotate";
  start: WorkbookPoint;
  current: WorkbookPoint;
};

export type Solid3dResizeState = {
  object: WorkbookBoardObject;
  mode: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";
  start: WorkbookPoint;
  current: WorkbookPoint;
  center: WorkbookPoint;
  startLocal: WorkbookPoint;
};

export type GraphPanState = {
  object: WorkbookBoardObject;
  targetFunctionId: string | null;
  start: WorkbookPoint;
  current: WorkbookPoint;
  initialFunctions: GraphFunctionDraft[];
  pxPerUnit: number;
};

export type WorkbookObjectPatchUpdate = {
  id: string;
  patch: Partial<WorkbookBoardObject>;
};

type Solid3dPreviewMetaById = Record<string, Record<string, unknown>>;

const clampGraphOffsetValue = (value: number) =>
  Math.max(-999, Math.min(999, Number.isFinite(value) ? value : 0));

const resolveCornerResizeRect = (params: {
  mode: "nw" | "ne" | "se" | "sw";
  rect: { x: number; y: number; width: number; height: number };
  current: WorkbookPoint;
}) => {
  let nextLeft = params.rect.x;
  let nextRight = params.rect.x + params.rect.width;
  let nextTop = params.rect.y;
  let nextBottom = params.rect.y + params.rect.height;
  if (params.mode === "nw") {
    nextLeft = Math.min(params.current.x, nextRight - 1);
    nextTop = Math.min(params.current.y, nextBottom - 1);
  } else if (params.mode === "ne") {
    nextRight = Math.max(params.current.x, nextLeft + 1);
    nextTop = Math.min(params.current.y, nextBottom - 1);
  } else if (params.mode === "se") {
    nextRight = Math.max(params.current.x, nextLeft + 1);
    nextBottom = Math.max(params.current.y, nextTop + 1);
  } else {
    nextLeft = Math.min(params.current.x, nextRight - 1);
    nextBottom = Math.max(params.current.y, nextTop + 1);
  }
  return normalizeRect(
    { x: nextLeft, y: nextTop },
    { x: nextRight, y: nextBottom }
  );
};

export const collectMappedInteractionPoints = <T extends ClientPointLike>(params: {
  sourceEvents: T[];
  mapPoint: (sourceEvent: T) => WorkbookPoint;
  lastPoint: WorkbookPoint | null;
  minDistance: number;
}) => {
  const { sourceEvents, mapPoint, lastPoint, minDistance } = params;
  const nextPoints: WorkbookPoint[] = [];
  sourceEvents.forEach((sourceEvent) => {
    const nextPoint = mapPoint(sourceEvent);
    const previousPoint =
      nextPoints.length > 0 ? nextPoints[nextPoints.length - 1] : lastPoint;
    if (
      !previousPoint ||
      Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y) >= minDistance
    ) {
      nextPoints.push(nextPoint);
    }
  });
  return nextPoints;
};

export const collectSegmentPreviewPoints = <T extends ClientPointLike>(params: {
  sourceEvents: T[];
  mapPoint: (sourceEvent: T) => WorkbookPoint;
  lastAppliedPoint: WorkbookPoint;
  sampleSegment: (from: WorkbookPoint, to: WorkbookPoint) => WorkbookPoint[];
}) => {
  const { sourceEvents, mapPoint, lastAppliedPoint, sampleSegment } = params;
  let nextLastAppliedPoint = lastAppliedPoint;
  const previewPoints: WorkbookPoint[] = [];
  sourceEvents.forEach((sourceEvent) => {
    const nextPoint = mapPoint(sourceEvent);
    const sampledPoints = sampleSegment(nextLastAppliedPoint, nextPoint);
    if (sampledPoints.length > 0) {
      previewPoints.push(...sampledPoints);
      nextLastAppliedPoint = sampledPoints[sampledPoints.length - 1];
    } else {
      nextLastAppliedPoint = nextPoint;
    }
  });
  return {
    previewPoints,
    lastAppliedPoint: nextLastAppliedPoint,
  };
};

export const filterPreviewPointsByDistance = (params: {
  previewPoints: WorkbookPoint[];
  lastPreviewPoint: WorkbookPoint | null;
  minDistance: number;
}) => {
  const { previewPoints, lastPreviewPoint, minDistance } = params;
  if (!lastPreviewPoint) return previewPoints;
  return previewPoints.filter(
    (previewPoint) =>
      Math.hypot(
        previewPoint.x - lastPreviewPoint.x,
        previewPoint.y - lastPreviewPoint.y
      ) >= minDistance
  );
};

export const applyGraphPanToFunctions = (
  functions: GraphFunctionDraft[],
  deltaX: number,
  deltaY: number,
  pxPerUnit: number,
  targetFunctionId: string | null = null
): GraphFunctionDraft[] => {
  if (functions.length === 0 || pxPerUnit <= 0) return functions;
  const offsetXShift = deltaX / pxPerUnit;
  const offsetYShift = -deltaY / pxPerUnit;
  return functions.map((entry) =>
    targetFunctionId && entry.id !== targetFunctionId
      ? entry
      : {
          ...entry,
          offsetX: clampGraphOffsetValue((entry.offsetX ?? 0) + offsetXShift),
          offsetY: clampGraphOffsetValue((entry.offsetY ?? 0) + offsetYShift),
        }
  );
};

export const resolveFunctionGraphScale = (
  object: WorkbookBoardObject,
  gridSize: number
) => {
  const autoStep = getAutoGraphGridStep({
    width: Math.max(1, Math.abs(object.width)),
    height: Math.max(1, Math.abs(object.height)),
  });
  const step = Math.max(
    12,
    Math.min(
      64,
      Math.round(Number.isFinite(gridSize) && gridSize > 0 ? gridSize : autoStep)
    )
  );
  return {
    pxPerUnit: Math.max(0.0001, step),
  };
};

export const computeSolid3dResizePatch = (state: Solid3dResizeState) => {
  const minSize = 24;
  const rect = normalizeRect(
    { x: state.object.x, y: state.object.y },
    { x: state.object.x + state.object.width, y: state.object.y + state.object.height }
  );
  let left = rect.x;
  let right = rect.x + rect.width;
  let top = rect.y;
  let bottom = rect.y + rect.height;
  if (state.mode.includes("w")) {
    left = Math.min(state.current.x, right - minSize);
  }
  if (state.mode.includes("e")) {
    right = Math.max(state.current.x, left + minSize);
  }
  if (state.mode.includes("n")) {
    top = Math.min(state.current.y, bottom - minSize);
  }
  if (state.mode.includes("s")) {
    bottom = Math.max(state.current.y, top + minSize);
  }
  const nextRect = normalizeRect({ x: left, y: top }, { x: right, y: bottom });
  return {
    x: nextRect.x,
    y: nextRect.y,
    width: nextRect.width,
    height: nextRect.height,
  };
};

export const resolveRealtimePatchBaseObject = (params: {
  selectedObject: WorkbookBoardObject | null;
  moving: MovingState | null;
  resizing: ResizeState | null;
  graphPan: GraphPanState | null;
  solid3dResize: Solid3dResizeState | null;
}) => {
  const { selectedObject, moving, resizing, graphPan, solid3dResize } = params;
  if (!selectedObject) return null;
  if (moving && moving.object.id === selectedObject.id) {
    return moving.object;
  }
  if (resizing && resizing.object.id === selectedObject.id) {
    return resizing.object;
  }
  if (graphPan && graphPan.object.id === selectedObject.id) {
    return graphPan.object;
  }
  if (solid3dResize && solid3dResize.object.id === selectedObject.id) {
    return solid3dResize.object;
  }
  return selectedObject;
};

export const buildMoveCommitResult = (params: {
  moving: MovingState;
  areaSelection: WorkbookAreaSelection | null;
}) => {
  const { moving, areaSelection } = params;
  const deltaX = moving.current.x - moving.start.x;
  const deltaY = moving.current.y - moving.start.y;
  if (Math.abs(deltaX) <= 0.5 && Math.abs(deltaY) <= 0.5) {
    return {
      objectPatches: [] as WorkbookObjectPatchUpdate[],
      nextAreaSelection: null as WorkbookAreaSelection | null,
    };
  }
  const targets =
    moving.groupObjects.length > 0
      ? moving.groupObjects
      : moving.object.id === "__area-selection__"
        ? []
        : [moving.object];
  const objectPatches = targets.map((target) => {
    const patch: Partial<WorkbookBoardObject> = {
      x: target.type === "section_divider" ? target.x : target.x + deltaX,
      y: target.y + deltaY,
    };
    if (Array.isArray(target.points) && target.points.length > 0) {
      patch.points = target.points.map((point) => ({
        x: point.x + deltaX,
        y: point.y + deltaY,
      }));
    }
    return {
      id: target.id,
      patch,
    };
  });
  const nextAreaSelection =
    moving.object.id === "__area-selection__" && areaSelection
      ? {
          objectIds: targets.map((target) => target.id),
          strokeIds: areaSelection.strokeIds,
          rect: {
            x: areaSelection.rect.x + deltaX,
            y: areaSelection.rect.y + deltaY,
            width: areaSelection.rect.width,
            height: areaSelection.rect.height,
          },
        }
      : null;
  return {
    objectPatches,
    nextAreaSelection,
  };
};

export const buildResizeCommitPatch = (
  state: ResizeState
): Partial<WorkbookBoardObject> | null => {
  const object = state.object;
  const deltaX = state.current.x - state.start.x;
  const deltaY = state.current.y - state.start.y;
  if (state.mode === "line-start") {
    const nextX = object.x + deltaX;
    const nextY = object.y + deltaY;
    const nextWidth = object.width - deltaX;
    const nextHeight = object.height - deltaY;
    if (Math.hypot(nextWidth, nextHeight) < 1) {
      return null;
    }
    return {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    };
  }
  if (state.mode === "line-end") {
    const widthValue = object.width + deltaX;
    const heightValue = object.height + deltaY;
    if (Math.hypot(widthValue, heightValue) < 1) {
      return null;
    }
    return { width: widthValue, height: heightValue };
  }
  if (state.mode === "line-curve-c1" || state.mode === "line-curve-c2") {
    const projected = projectPointToLineCurve(object, state.current);
    const currentCurve = readLineCurveMeta(object);
    const nextCurve =
      state.mode === "line-curve-c1"
        ? {
            ...currentCurve,
            c1t: Math.max(-1, Math.min(2, projected.t)),
            c1n: Math.max(-480, Math.min(480, projected.n)),
          }
        : {
            ...currentCurve,
            c2t: Math.max(-1, Math.min(2, projected.t)),
            c2n: Math.max(-480, Math.min(480, projected.n)),
          };
    return {
      meta: {
        ...(object.meta ?? {}),
        curve: nextCurve,
      },
    };
  }
  if (state.mode === "rotate") {
    const rect = getObjectRect(object);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    if (object.type === "line" || object.type === "arrow") {
      const length = Math.hypot(object.width, object.height) || 1;
      const angle = Math.atan2(state.current.y - centerY, state.current.x - centerX) + Math.PI / 2;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const half = length / 2;
      const nextStart = {
        x: centerX - dirX * half,
        y: centerY - dirY * half,
      };
      return {
        x: nextStart.x,
        y: nextStart.y,
        width: dirX * length,
        height: dirY * length,
      };
    }
    const startAngle = Math.atan2(state.start.y - centerY, state.start.x - centerX);
    const nextAngle = Math.atan2(state.current.y - centerY, state.current.x - centerX);
    const deltaDeg = ((nextAngle - startAngle) * 180) / Math.PI;
    return {
      rotation: (object.rotation ?? 0) + deltaDeg,
    };
  }
  if (
    (state.mode === "nw" ||
      state.mode === "ne" ||
      state.mode === "se" ||
      state.mode === "sw") &&
    (object.type === "line" || object.type === "arrow")
  ) {
    const rect = getObjectRect(object);
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    const startVector = {
      x: state.start.x - center.x,
      y: state.start.y - center.y,
    };
    const currentVector = {
      x: state.current.x - center.x,
      y: state.current.y - center.y,
    };
    const startDistance = Math.hypot(startVector.x, startVector.y);
    const currentDistance = Math.hypot(currentVector.x, currentVector.y);
    if (startDistance < 1e-6 || currentDistance < 1e-6) {
      return null;
    }
    const scale = Math.max(0.2, Math.min(8, currentDistance / startDistance));
    const startPoint = { x: object.x, y: object.y };
    const endPoint = { x: object.x + object.width, y: object.y + object.height };
    const nextStart = {
      x: center.x + (startPoint.x - center.x) * scale,
      y: center.y + (startPoint.y - center.y) * scale,
    };
    const nextEnd = {
      x: center.x + (endPoint.x - center.x) * scale,
      y: center.y + (endPoint.y - center.y) * scale,
    };
    const nextWidth = nextEnd.x - nextStart.x;
    const nextHeight = nextEnd.y - nextStart.y;
    if (Math.hypot(nextWidth, nextHeight) < 1) {
      return null;
    }
    return {
      x: nextStart.x,
      y: nextStart.y,
      width: nextWidth,
      height: nextHeight,
    };
  }

  const rect = normalizeRect(
    { x: object.x, y: object.y },
    { x: object.x + object.width, y: object.y + object.height }
  );
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  const localStart =
    object.rotation && Number.isFinite(object.rotation)
      ? rotatePointAround(state.start, center, -(object.rotation ?? 0))
      : state.start;
  const localCurrent =
    object.rotation && Number.isFinite(object.rotation)
      ? rotatePointAround(state.current, center, -(object.rotation ?? 0))
      : state.current;
  if (state.mode === "n" || state.mode === "s" || state.mode === "e" || state.mode === "w") {
    let nextLeft = rect.x;
    let nextRight = rect.x + rect.width;
    let nextTop = rect.y;
    let nextBottom = rect.y + rect.height;

    if (state.mode === "n") {
      nextTop = Math.min(localCurrent.y, nextBottom - 1);
    } else if (state.mode === "s") {
      nextBottom = Math.max(localCurrent.y, nextTop + 1);
    } else if (state.mode === "e") {
      nextRight = Math.max(localCurrent.x, nextLeft + 1);
    } else if (state.mode === "w") {
      nextLeft = Math.min(localCurrent.x, nextRight - 1);
    }

    const nextRect = normalizeRect(
      { x: nextLeft, y: nextTop },
      { x: nextRight, y: nextBottom }
    );
    if (Array.isArray(object.points) && object.points.length > 0) {
      const safeWidth = Math.max(1e-6, rect.width);
      const safeHeight = Math.max(1e-6, rect.height);
      const nextCenter = {
        x: nextRect.x + nextRect.width / 2,
        y: nextRect.y + nextRect.height / 2,
      };
      const rotationDeg =
        object.rotation && Number.isFinite(object.rotation) ? object.rotation : 0;
      const resizedPoints = object.points.map((point) => {
        const localPoint =
          rotationDeg !== 0 ? rotatePointAround(point, center, -rotationDeg) : point;
        const nextLocal = {
          x: nextRect.x + ((localPoint.x - rect.x) / safeWidth) * nextRect.width,
          y: nextRect.y + ((localPoint.y - rect.y) / safeHeight) * nextRect.height,
        };
        return rotationDeg !== 0
          ? rotatePointAround(nextLocal, nextCenter, rotationDeg)
          : nextLocal;
      });
      const nextBounds = getPointsBoundsFromPoints(resizedPoints);
      return {
        x: nextBounds.minX,
        y: nextBounds.minY,
        width: nextBounds.width,
        height: nextBounds.height,
        points: resizedPoints,
      };
    }

    return {
      x: nextRect.x,
      y: nextRect.y,
      width: nextRect.width,
      height: nextRect.height,
    };
  }
  if (
    (state.mode === "nw" ||
      state.mode === "ne" ||
      state.mode === "se" ||
      state.mode === "sw") &&
    object.type === "image"
  ) {
    const nextRect = resolveCornerResizeRect({
      mode: state.mode,
      rect,
      current: localCurrent,
    });
    return {
      x: nextRect.x,
      y: nextRect.y,
      width: nextRect.width,
      height: nextRect.height,
    };
  }

  const startVector = {
    x: localStart.x - center.x,
    y: localStart.y - center.y,
  };
  const currentVector = {
    x: localCurrent.x - center.x,
    y: localCurrent.y - center.y,
  };
  const scaleX =
    Math.abs(startVector.x) > 2
      ? Math.max(0.2, Math.min(8, Math.abs(currentVector.x) / Math.abs(startVector.x)))
      : 1;
  const scaleY =
    Math.abs(startVector.y) > 2
      ? Math.max(0.2, Math.min(8, Math.abs(currentVector.y) / Math.abs(startVector.y)))
      : 1;
  const uniformScale = Math.max(scaleX, scaleY);
  const nextWidth = Math.max(1, rect.width * uniformScale);
  const nextHeight = Math.max(1, rect.height * uniformScale);
  const nextLeft = center.x - nextWidth / 2;
  const nextTop = center.y - nextHeight / 2;
  if (Array.isArray(object.points) && object.points.length > 0) {
    const resizedPoints = object.points.map((point) => ({
      x: center.x + (point.x - center.x) * uniformScale,
      y: center.y + (point.y - center.y) * uniformScale,
    }));
    const nextBounds = getPointsBoundsFromPoints(resizedPoints);
    return {
      x: nextBounds.minX,
      y: nextBounds.minY,
      width: nextBounds.width,
      height: nextBounds.height,
      points: resizedPoints,
    };
  }
  return {
    x: nextLeft,
    y: nextTop,
    width: nextWidth,
    height: nextHeight,
  };
};

export const resolveSelectedPreviewObject = (params: {
  selectedObject: WorkbookBoardObject | null;
  moving: MovingState | null;
  resizing: ResizeState | null;
  graphPan: GraphPanState | null;
  solid3dResize: Solid3dResizeState | null;
  solid3dPreviewMetaById: Solid3dPreviewMetaById;
}) => {
  const { selectedObject, moving, resizing, graphPan, solid3dResize, solid3dPreviewMetaById } =
    params;
  if (!selectedObject) return null;
  const interactionSource =
    (moving && moving.object.id === selectedObject.id && moving.object) ||
    (resizing && resizing.object.id === selectedObject.id && resizing.object) ||
    (graphPan && graphPan.object.id === selectedObject.id && graphPan.object) ||
    (solid3dResize && solid3dResize.object.id === selectedObject.id && solid3dResize.object) ||
    selectedObject;
  let preview: WorkbookBoardObject = { ...interactionSource };
  if (interactionSource.type === "solid3d" && solid3dPreviewMetaById[interactionSource.id]) {
    preview = {
      ...preview,
      meta: solid3dPreviewMetaById[interactionSource.id],
    };
  }
  if (moving && moving.object.id === selectedObject.id) {
    const deltaX = moving.current.x - moving.start.x;
    const deltaY = moving.current.y - moving.start.y;
    preview = {
      ...preview,
      x: moving.object.x + deltaX,
      y: moving.object.y + deltaY,
      points: Array.isArray(moving.object.points)
        ? moving.object.points.map((point) => ({
            x: point.x + deltaX,
            y: point.y + deltaY,
          }))
        : moving.object.points,
    };
  }
  if (graphPan && graphPan.object.id === selectedObject.id) {
    const deltaX = graphPan.current.x - graphPan.start.x;
    const deltaY = graphPan.current.y - graphPan.start.y;
    preview = {
      ...graphPan.object,
      meta: {
        ...(graphPan.object.meta ?? {}),
        functions: applyGraphPanToFunctions(
          graphPan.initialFunctions,
          deltaX,
          deltaY,
          graphPan.pxPerUnit,
          graphPan.targetFunctionId
        ),
      },
    };
  }
  if (resizing && resizing.object.id === selectedObject.id) {
    if (resizing.mode === "line-start") {
      preview = {
        ...preview,
        x: resizing.object.x + (resizing.current.x - resizing.start.x),
        y: resizing.object.y + (resizing.current.y - resizing.start.y),
        width: resizing.object.width - (resizing.current.x - resizing.start.x),
        height: resizing.object.height - (resizing.current.y - resizing.start.y),
      };
    } else if (resizing.mode === "line-end") {
      preview = {
        ...preview,
        width: resizing.object.width + (resizing.current.x - resizing.start.x),
        height: resizing.object.height + (resizing.current.y - resizing.start.y),
      };
    } else if (
      resizing.mode === "n" ||
      resizing.mode === "s" ||
      resizing.mode === "e" ||
      resizing.mode === "w"
    ) {
      const rect = normalizeRect(
        { x: preview.x, y: preview.y },
        { x: preview.x + preview.width, y: preview.y + preview.height }
      );
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const rotationDeg =
        preview.rotation && Number.isFinite(preview.rotation) ? preview.rotation : 0;
      const localCurrent =
        rotationDeg !== 0
          ? rotatePointAround(resizing.current, center, -rotationDeg)
          : resizing.current;
      let nextLeft = rect.x;
      let nextRight = rect.x + rect.width;
      let nextTop = rect.y;
      let nextBottom = rect.y + rect.height;
      if (resizing.mode === "n") {
        nextTop = Math.min(localCurrent.y, nextBottom - 1);
      } else if (resizing.mode === "s") {
        nextBottom = Math.max(localCurrent.y, nextTop + 1);
      } else if (resizing.mode === "e") {
        nextRight = Math.max(localCurrent.x, nextLeft + 1);
      } else if (resizing.mode === "w") {
        nextLeft = Math.min(localCurrent.x, nextRight - 1);
      }
      const nextRect = normalizeRect(
        { x: nextLeft, y: nextTop },
        { x: nextRight, y: nextBottom }
      );
      const safeWidth = Math.max(1e-6, rect.width);
      const safeHeight = Math.max(1e-6, rect.height);
      const nextCenter = {
        x: nextRect.x + nextRect.width / 2,
        y: nextRect.y + nextRect.height / 2,
      };
      preview = {
        ...preview,
        x: nextRect.x,
        y: nextRect.y,
        width: nextRect.width,
        height: nextRect.height,
        points: Array.isArray(preview.points)
          ? preview.points.map((point) => {
              const localPoint =
                rotationDeg !== 0
                  ? rotatePointAround(point, center, -rotationDeg)
                  : point;
              const nextLocal = {
                x: nextRect.x + ((localPoint.x - rect.x) / safeWidth) * nextRect.width,
                y: nextRect.y + ((localPoint.y - rect.y) / safeHeight) * nextRect.height,
              };
              return rotationDeg !== 0
                ? rotatePointAround(nextLocal, nextCenter, rotationDeg)
                : nextLocal;
            })
          : preview.points,
      };
    } else if (
      (resizing.mode === "nw" ||
        resizing.mode === "ne" ||
        resizing.mode === "se" ||
        resizing.mode === "sw") &&
      preview.type === "image"
    ) {
      const rect = normalizeRect(
        { x: preview.x, y: preview.y },
        { x: preview.x + preview.width, y: preview.y + preview.height }
      );
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const rotationDeg =
        preview.rotation && Number.isFinite(preview.rotation) ? preview.rotation : 0;
      const localCurrent =
        rotationDeg !== 0
          ? rotatePointAround(resizing.current, center, -rotationDeg)
          : resizing.current;
      const nextRect = resolveCornerResizeRect({
        mode: resizing.mode,
        rect,
        current: localCurrent,
      });
      preview = {
        ...preview,
        x: nextRect.x,
        y: nextRect.y,
        width: nextRect.width,
        height: nextRect.height,
      };
    } else if (
      (resizing.mode === "nw" ||
        resizing.mode === "ne" ||
        resizing.mode === "se" ||
        resizing.mode === "sw") &&
      (preview.type === "line" || preview.type === "arrow")
    ) {
      const rect = getObjectRect(preview);
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const startVector = {
        x: resizing.start.x - center.x,
        y: resizing.start.y - center.y,
      };
      const currentVector = {
        x: resizing.current.x - center.x,
        y: resizing.current.y - center.y,
      };
      const startDistance = Math.hypot(startVector.x, startVector.y);
      const currentDistance = Math.hypot(currentVector.x, currentVector.y);
      const scale =
        startDistance > 1e-6
          ? Math.max(0.2, Math.min(8, currentDistance / startDistance))
          : 1;
      const startPoint = { x: preview.x, y: preview.y };
      const endPoint = { x: preview.x + preview.width, y: preview.y + preview.height };
      const nextStart = {
        x: center.x + (startPoint.x - center.x) * scale,
        y: center.y + (startPoint.y - center.y) * scale,
      };
      const nextEnd = {
        x: center.x + (endPoint.x - center.x) * scale,
        y: center.y + (endPoint.y - center.y) * scale,
      };
      preview = {
        ...preview,
        x: nextStart.x,
        y: nextStart.y,
        width: nextEnd.x - nextStart.x,
        height: nextEnd.y - nextStart.y,
      };
    } else if (resizing.mode === "line-curve-c1" || resizing.mode === "line-curve-c2") {
      const projected = projectPointToLineCurve(preview, resizing.current);
      const currentCurve = readLineCurveMeta(preview);
      const nextCurve =
        resizing.mode === "line-curve-c1"
          ? {
              ...currentCurve,
              c1t: Math.max(-1, Math.min(2, projected.t)),
              c1n: Math.max(-480, Math.min(480, projected.n)),
            }
          : {
              ...currentCurve,
              c2t: Math.max(-1, Math.min(2, projected.t)),
              c2n: Math.max(-480, Math.min(480, projected.n)),
            };
      preview = {
        ...preview,
        meta: {
          ...(preview.meta ?? {}),
          curve: nextCurve,
        },
      };
    } else if (resizing.mode === "rotate") {
      if (preview.type === "line" || preview.type === "arrow") {
        const length = Math.hypot(preview.width, preview.height) || 1;
        const rect = getObjectRect(preview);
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const angle =
          Math.atan2(resizing.current.y - center.y, resizing.current.x - center.x) + Math.PI / 2;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const half = length / 2;
        const nextStart = {
          x: center.x - dirX * half,
          y: center.y - dirY * half,
        };
        preview = {
          ...preview,
          x: nextStart.x,
          y: nextStart.y,
          width: dirX * length,
          height: dirY * length,
        };
      } else {
        const rect = normalizeRect(
          { x: preview.x, y: preview.y },
          { x: preview.x + preview.width, y: preview.y + preview.height }
        );
        const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const startAngle = Math.atan2(resizing.start.y - center.y, resizing.start.x - center.x);
        const nextAngle = Math.atan2(resizing.current.y - center.y, resizing.current.x - center.x);
        preview = {
          ...preview,
          rotation: (preview.rotation ?? 0) + ((nextAngle - startAngle) * 180) / Math.PI,
        };
      }
    } else if (preview.type !== "line" && preview.type !== "arrow") {
      const rect = normalizeRect(
        { x: preview.x, y: preview.y },
        { x: preview.x + preview.width, y: preview.y + preview.height }
      );
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const localStart =
        preview.rotation && Number.isFinite(preview.rotation)
          ? rotatePointAround(resizing.start, center, -(preview.rotation ?? 0))
          : resizing.start;
      const localCurrent =
        preview.rotation && Number.isFinite(preview.rotation)
          ? rotatePointAround(resizing.current, center, -(preview.rotation ?? 0))
          : resizing.current;
      const startVector = {
        x: localStart.x - center.x,
        y: localStart.y - center.y,
      };
      const currentVector = {
        x: localCurrent.x - center.x,
        y: localCurrent.y - center.y,
      };
      const scaleX =
        Math.abs(startVector.x) > 2
          ? Math.max(0.2, Math.min(8, Math.abs(currentVector.x) / Math.abs(startVector.x)))
          : 1;
      const scaleY =
        Math.abs(startVector.y) > 2
          ? Math.max(0.2, Math.min(8, Math.abs(currentVector.y) / Math.abs(startVector.y)))
          : 1;
      const uniformScale = Math.max(scaleX, scaleY);
      const nextWidth = Math.max(1, rect.width * uniformScale);
      const nextHeight = Math.max(1, rect.height * uniformScale);
      const nextLeft = center.x - nextWidth / 2;
      const nextTop = center.y - nextHeight / 2;
      preview = {
        ...preview,
        x: nextLeft,
        y: nextTop,
        width: nextWidth,
        height: nextHeight,
        points: Array.isArray(preview.points)
          ? preview.points.map((point) => ({
              x: center.x + (point.x - center.x) * uniformScale,
              y: center.y + (point.y - center.y) * uniformScale,
            }))
          : preview.points,
      };
    }
  }
  if (solid3dResize && solid3dResize.object.id === selectedObject.id) {
    const patch = computeSolid3dResizePatch(solid3dResize);
    preview = {
      ...preview,
      ...patch,
    };
  }
  return preview;
};
