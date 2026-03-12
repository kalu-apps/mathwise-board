import { getAutoGraphGridStep, type GraphFunctionDraft } from "./functionGraph";
import {
  getObjectRect,
  normalizeRect,
  projectPointToLineCurve,
  readLineCurveMeta,
  rotatePointAround,
} from "./sceneGeometry";
import type { WorkbookBoardObject, WorkbookPoint } from "./types";

export type MovingState = {
  object: WorkbookBoardObject;
  groupObjects: WorkbookBoardObject[];
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

type Solid3dPreviewMetaById = Record<string, Record<string, unknown>>;

const clampGraphOffsetValue = (value: number) =>
  Math.max(-999, Math.min(999, Number.isFinite(value) ? value : 0));

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
