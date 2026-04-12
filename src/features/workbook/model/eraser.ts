import {
  distanceToSegment,
  getLineBasis,
  rotatePointAround,
} from "./sceneGeometry";
import type { WorkbookBoardObject, WorkbookPoint, WorkbookStroke } from "./types";

type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ObjectEraserCut = {
  u: number;
  v: number;
  radiusRatio: number;
};

type ResolvedObjectEraserCut = {
  x: number;
  y: number;
  radius: number;
};

export type ObjectEraserPreviewPath = {
  points: WorkbookPoint[];
  radius: number;
};

export type ObjectEraserStoredPath = {
  points: Array<{ u: number; v: number }>;
  radiusRatio: number;
  space?: "rect" | "line";
};

type GetObjectRect = (object: WorkbookBoardObject) => RectLike;

const MAX_OBJECT_ERASER_CUTS = 2200;
const ERASER_INTERSECTION_EPSILON = 1e-4;
const OBJECT_ERASER_RATIO_MIN = 0.003;
const OBJECT_ERASER_RATIO_MAX = 2.4;
const OBJECT_ERASER_CUT_MERGE_RATIO = 0.38;
const OBJECT_ERASER_PREVIEW_SEGMENT_GAP_FACTOR = 1.6;
const ERASER_SAMPLE_SPACING_MIN = 0.8;
const ERASER_SAMPLE_SPACING_FACTOR = 0.18;

const pointsAlmostEqual = (
  left: WorkbookPoint,
  right: WorkbookPoint,
  epsilon = 1e-2
) => Math.abs(left.x - right.x) <= epsilon && Math.abs(left.y - right.y) <= epsilon;

const projectPointOnSegment = (
  from: WorkbookPoint,
  to: WorkbookPoint,
  t: number
): WorkbookPoint => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
});

const distanceBetweenPoints = (left: WorkbookPoint, right: WorkbookPoint) =>
  Math.hypot(left.x - right.x, left.y - right.y);

type ObjectEraserCoordinateSpace = "rect" | "line";

type LineEraserFrame = {
  start: WorkbookPoint;
  tangent: WorkbookPoint;
  normal: WorkbookPoint;
  length: number;
};

const isLineLikeObject = (object: WorkbookBoardObject) =>
  object.type === "line" || object.type === "arrow";

const resolveLineEraserFrame = (object: WorkbookBoardObject): LineEraserFrame | null => {
  if (!isLineLikeObject(object)) return null;
  const basis = getLineBasis(object);
  const safeLength = Math.max(1, basis.length);
  if (!Number.isFinite(safeLength)) return null;
  return {
    start: basis.start,
    tangent: basis.tangent,
    normal: basis.normal,
    length: safeLength,
  };
};

const projectPointToLineEraserFrame = (point: WorkbookPoint, frame: LineEraserFrame) => {
  const dx = point.x - frame.start.x;
  const dy = point.y - frame.start.y;
  return {
    u: (dx * frame.tangent.x + dy * frame.tangent.y) / frame.length,
    v: (dx * frame.normal.x + dy * frame.normal.y) / frame.length,
  };
};

const projectPointFromLineEraserFrame = (
  point: { u: number; v: number },
  frame: LineEraserFrame
): WorkbookPoint => ({
  x:
    frame.start.x +
    frame.tangent.x * point.u * frame.length +
    frame.normal.x * point.v * frame.length,
  y:
    frame.start.y +
    frame.tangent.y * point.u * frame.length +
    frame.normal.y * point.v * frame.length,
});

const resolvePathCoordinateSpace = (
  object: WorkbookBoardObject,
  pathSpace: unknown
): ObjectEraserCoordinateSpace =>
  pathSpace === "line" && isLineLikeObject(object) ? "line" : "rect";

const resolveObjectRotation = (object: WorkbookBoardObject) =>
  typeof object.rotation === "number" && Number.isFinite(object.rotation)
    ? object.rotation
    : 0;

const rotatePathsWithObject = (
  object: WorkbookBoardObject,
  paths: ObjectEraserPreviewPath[],
  getObjectRect: GetObjectRect
) => {
  if (paths.length === 0) return paths;
  const rotation = resolveObjectRotation(object);
  if (Math.abs(rotation) <= 1e-6) return paths;
  const rect = getObjectRect(object);
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
  return paths.map((path) => ({
    ...path,
    points: path.points.map((point) => rotatePointAround(point, center, rotation)),
  }));
};

export const buildEraserSegmentPoints = (
  from: WorkbookPoint,
  to: WorkbookPoint,
  radius: number
) => {
  const distance = distanceBetweenPoints(from, to);
  if (distance <= 0.01) return [to];
  const spacing = Math.max(ERASER_SAMPLE_SPACING_MIN, radius * ERASER_SAMPLE_SPACING_FACTOR);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  return Array.from({ length: steps }, (_, index) =>
    projectPointOnSegment(from, to, (index + 1) / steps)
  );
};

export const finalizeEraserSegmentPreview = (params: {
  point: WorkbookPoint;
  lastAppliedPoint: WorkbookPoint;
  eraseAlongSegment: (from: WorkbookPoint, to: WorkbookPoint) => WorkbookPoint[];
}) => {
  const sampledPoints = params.eraseAlongSegment(
    params.lastAppliedPoint,
    params.point
  );
  return {
    sampledPoints,
    nextLastAppliedPoint:
      sampledPoints[sampledPoints.length - 1] ?? params.point,
  };
};

const resolveSegmentCircleIntersections = (
  from: WorkbookPoint,
  to: WorkbookPoint,
  center: WorkbookPoint,
  radius: number
) => {
  const directionX = to.x - from.x;
  const directionY = to.y - from.y;
  const offsetX = from.x - center.x;
  const offsetY = from.y - center.y;
  const a = directionX * directionX + directionY * directionY;
  if (a <= ERASER_INTERSECTION_EPSILON) return [] as number[];
  const b = 2 * (offsetX * directionX + offsetY * directionY);
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < ERASER_INTERSECTION_EPSILON) return [] as number[];
  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);
  const intersections = [t1, t2]
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > ERASER_INTERSECTION_EPSILON &&
        value < 1 - ERASER_INTERSECTION_EPSILON
    )
    .sort((left, right) => left - right);
  return intersections.reduce<number[]>((acc, value) => {
    if (acc.length === 0 || Math.abs(acc[acc.length - 1] - value) > ERASER_INTERSECTION_EPSILON) {
      acc.push(value);
    }
    return acc;
  }, []);
};

const compactStrokePoints = (points: WorkbookPoint[]) =>
  points.reduce<WorkbookPoint[]>((acc, point) => {
    if (acc.length === 0) {
      acc.push(point);
      return acc;
    }
    const previous = acc[acc.length - 1];
    if (!pointsAlmostEqual(previous, point)) {
      acc.push(point);
    }
    return acc;
  }, []);

const splitStrokeByCircle = (
  stroke: WorkbookStroke,
  center: WorkbookPoint,
  radius: number
) => {
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) {
    return [] as WorkbookPoint[][];
  }
  const threshold = Math.max(2, radius + (stroke.width ?? 2) / 2);
  if (stroke.points.length === 1) {
    return distanceBetweenPoints(stroke.points[0], center) <= threshold
      ? ([] as WorkbookPoint[][])
      : [[stroke.points[0]]];
  }

  const result: WorkbookPoint[][] = [];
  let current: WorkbookPoint[] = [];

  for (let index = 0; index < stroke.points.length - 1; index += 1) {
    const from = stroke.points[index];
    const to = stroke.points[index + 1];
    const intersections = resolveSegmentCircleIntersections(from, to, center, threshold);
    const checkpoints = [0, ...intersections, 1];

    for (let checkpointIndex = 0; checkpointIndex < checkpoints.length - 1; checkpointIndex += 1) {
      const startT = checkpoints[checkpointIndex];
      const endT = checkpoints[checkpointIndex + 1];
      if (endT - startT <= ERASER_INTERSECTION_EPSILON) continue;
      const middle = projectPointOnSegment(from, to, (startT + endT) / 2);
      const keepSegment = distanceBetweenPoints(middle, center) > threshold;
      const segmentStart = projectPointOnSegment(from, to, startT);
      const segmentEnd = projectPointOnSegment(from, to, endT);

      if (keepSegment) {
        if (current.length === 0) {
          current.push(segmentStart);
        } else if (!pointsAlmostEqual(current[current.length - 1], segmentStart)) {
          current.push(segmentStart);
        }
        if (!pointsAlmostEqual(current[current.length - 1], segmentEnd)) {
          current.push(segmentEnd);
        }
      } else if (current.length > 0) {
        const compacted = compactStrokePoints(current);
        if (compacted.length > 0) {
          result.push(compacted);
        }
        current = [];
      }
    }
  }

  if (current.length > 0) {
    const compacted = compactStrokePoints(current);
    if (compacted.length > 0) {
      result.push(compacted);
    }
  }
  return result;
};

const areStrokeFragmentsEquivalent = (
  stroke: WorkbookStroke,
  fragments: WorkbookPoint[][]
) => {
  if (fragments.length !== 1) return false;
  const [fragment] = fragments;
  if (fragment.length !== stroke.points.length) return false;
  return fragment.every((point, index) => pointsAlmostEqual(point, stroke.points[index]));
};

const areFragmentCollectionsEquivalent = (
  left: WorkbookPoint[][],
  right: WorkbookPoint[][]
) => {
  if (left.length !== right.length) return false;
  return left.every((fragment, fragmentIndex) => {
    const target = right[fragmentIndex];
    if (!target || fragment.length !== target.length) return false;
    return fragment.every((point, pointIndex) => pointsAlmostEqual(point, target[pointIndex]));
  });
};

const clampObjectEraserCut = (cut: ObjectEraserCut): ObjectEraserCut => ({
  u: Math.max(-2, Math.min(3, cut.u)),
  v: Math.max(-2, Math.min(3, cut.v)),
  radiusRatio: Math.max(
    OBJECT_ERASER_RATIO_MIN,
    Math.min(OBJECT_ERASER_RATIO_MAX, cut.radiusRatio)
  ),
});

const normalizeObjectEraserCut = (
  object: WorkbookBoardObject,
  center: WorkbookPoint,
  radius: number,
  getObjectRect: GetObjectRect
): ObjectEraserCut => {
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return clampObjectEraserCut({
    u: (center.x - rect.x) / safeWidth,
    v: (center.y - rect.y) / safeHeight,
    radiusRatio: radius / safeScale,
  });
};

const getObjectCutDistance = (
  object: WorkbookBoardObject,
  left: ObjectEraserCut,
  right: ObjectEraserCut,
  getObjectRect: GetObjectRect
) => {
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  const widthRatio = safeWidth / safeScale;
  const heightRatio = safeHeight / safeScale;
  return Math.hypot((left.u - right.u) * widthRatio, (left.v - right.v) * heightRatio);
};

const resolveObjectEraserCutGeometry = (
  object: WorkbookBoardObject,
  cut: ObjectEraserCut,
  getObjectRect: GetObjectRect
): ResolvedObjectEraserCut => {
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return {
    x: rect.x + cut.u * safeWidth,
    y: rect.y + cut.v * safeHeight,
    radius: Math.max(1, Math.min(320, cut.radiusRatio * safeScale)),
  };
};

const mergeObjectEraserCutPair = (
  object: WorkbookBoardObject,
  left: ObjectEraserCut,
  right: ObjectEraserCut,
  getObjectRect: GetObjectRect
): ObjectEraserCut => {
  const leftGeometry = resolveObjectEraserCutGeometry(object, left, getObjectRect);
  const rightGeometry = resolveObjectEraserCutGeometry(object, right, getObjectRect);
  const dx = rightGeometry.x - leftGeometry.x;
  const dy = rightGeometry.y - leftGeometry.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= 1e-4) {
    return normalizeObjectEraserCut(
      object,
      {
        x: rightGeometry.radius >= leftGeometry.radius ? rightGeometry.x : leftGeometry.x,
        y: rightGeometry.radius >= leftGeometry.radius ? rightGeometry.y : leftGeometry.y,
      },
      Math.max(leftGeometry.radius, rightGeometry.radius),
      getObjectRect
    );
  }

  if (leftGeometry.radius >= distance + rightGeometry.radius) {
    return left;
  }
  if (rightGeometry.radius >= distance + leftGeometry.radius) {
    return right;
  }

  const mergedRadius = (distance + leftGeometry.radius + rightGeometry.radius) / 2;
  const t = (mergedRadius - leftGeometry.radius) / distance;
  return normalizeObjectEraserCut(
    object,
    {
      x: leftGeometry.x + dx * t,
      y: leftGeometry.y + dy * t,
    },
    mergedRadius,
    getObjectRect
  );
};

const compactObjectEraserCuts = (
  object: WorkbookBoardObject,
  cuts: ObjectEraserCut[],
  maxCuts: number,
  getObjectRect: GetObjectRect
) => {
  if (cuts.length <= maxCuts) return cuts;
  const next = [...cuts];
  while (next.length > maxCuts) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < next.length - 1; index += 1) {
      const distance = getObjectCutDistance(object, next[index], next[index + 1], getObjectRect);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    next.splice(
      bestIndex,
      2,
      mergeObjectEraserCutPair(object, next[bestIndex], next[bestIndex + 1], getObjectRect)
    );
  }
  return next;
};

export const appendObjectEraserPreviewPathPoint = (
  paths: ObjectEraserPreviewPath[],
  point: WorkbookPoint,
  radius: number
) => {
  if (paths.length === 0) {
    return [{ points: [point], radius }];
  }
  const next = [...paths];
  const lastIndex = next.length - 1;
  const lastPath = next[lastIndex];
  const lastPoint = lastPath.points[lastPath.points.length - 1] ?? null;
  const gapThreshold = Math.max(radius * OBJECT_ERASER_PREVIEW_SEGMENT_GAP_FACTOR, 10);
  if (
    !lastPoint ||
    Math.abs(lastPath.radius - radius) > 0.01 ||
    distanceBetweenPoints(lastPoint, point) > gapThreshold
  ) {
    next.push({ points: [point], radius });
    return next;
  }
  if (distanceBetweenPoints(lastPoint, point) <= 0.06) {
    const updatedPoints = [...lastPath.points];
    updatedPoints[updatedPoints.length - 1] = point;
    next[lastIndex] = {
      ...lastPath,
      points: updatedPoints,
    };
    return next;
  }
  next[lastIndex] = {
    ...lastPath,
    points: [...lastPath.points, point],
  };
  return next;
};

const appendObjectEraserCut = (
  object: WorkbookBoardObject,
  cuts: ObjectEraserCut[],
  nextCut: ObjectEraserCut,
  getObjectRect: GetObjectRect
) => {
  if (cuts.length === 0) return [nextCut];
  const next = [...cuts];
  const lastIndex = next.length - 1;
  const lastCut = next[lastIndex];
  const mergeThreshold =
    Math.max(lastCut.radiusRatio, nextCut.radiusRatio) * OBJECT_ERASER_CUT_MERGE_RATIO;
  if (getObjectCutDistance(object, lastCut, nextCut, getObjectRect) <= mergeThreshold) {
    next[lastIndex] = mergeObjectEraserCutPair(object, lastCut, nextCut, getObjectRect);
    return next;
  }
  next.push(nextCut);
  return compactObjectEraserCuts(object, next, MAX_OBJECT_ERASER_CUTS, getObjectRect);
};

export const sanitizeObjectEraserCuts = (
  object: WorkbookBoardObject,
  getObjectRect: GetObjectRect
): ObjectEraserCut[] => {
  const raw = Array.isArray(object.meta?.eraserCuts) ? object.meta.eraserCuts : [];
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return raw.reduce<ObjectEraserCut[]>((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const typed = item as {
      u?: unknown;
      v?: unknown;
      radiusRatio?: unknown;
      x?: unknown;
      y?: unknown;
      radius?: unknown;
      r?: unknown;
    };
    if (
      typeof typed.u === "number" &&
      Number.isFinite(typed.u) &&
      typeof typed.v === "number" &&
      Number.isFinite(typed.v)
    ) {
      const ratioRaw =
        typeof typed.radiusRatio === "number" && Number.isFinite(typed.radiusRatio)
          ? typed.radiusRatio
          : typeof typed.radius === "number" && Number.isFinite(typed.radius)
            ? typed.radius / safeScale
            : typeof typed.r === "number" && Number.isFinite(typed.r)
              ? typed.r / safeScale
              : null;
      if (ratioRaw === null) return acc;
      return [...acc, clampObjectEraserCut({ u: typed.u, v: typed.v, radiusRatio: ratioRaw })];
    }
    if (
      typeof typed.x === "number" &&
      Number.isFinite(typed.x) &&
      typeof typed.y === "number" &&
      Number.isFinite(typed.y)
    ) {
      const radiusRaw =
        typeof typed.radius === "number" && Number.isFinite(typed.radius)
          ? typed.radius
          : typeof typed.r === "number" && Number.isFinite(typed.r)
            ? typed.r
            : null;
      if (radiusRaw === null) return acc;
      return [
        ...acc,
        clampObjectEraserCut({
          u: (typed.x - rect.x) / safeWidth,
          v: (typed.y - rect.y) / safeHeight,
          radiusRatio: Math.max(1, Math.min(240, radiusRaw)) / safeScale,
        }),
      ];
    }
    return acc;
  }, []);
};

export const normalizeObjectEraserPreviewPath = (
  object: WorkbookBoardObject,
  path: ObjectEraserPreviewPath,
  getObjectRect: GetObjectRect
): ObjectEraserStoredPath | null => {
  if (!Array.isArray(path.points) || path.points.length === 0) return null;
  const lineFrame = resolveLineEraserFrame(object);
  const coordinateSpace: ObjectEraserCoordinateSpace = lineFrame ? "line" : "rect";
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  const normalizedPoints = path.points.reduce<Array<{ u: number; v: number }>>((acc, point) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return acc;
    if (coordinateSpace === "line" && lineFrame) {
      acc.push(projectPointToLineEraserFrame(point, lineFrame));
    } else {
      acc.push({
        u: (point.x - rect.x) / safeWidth,
        v: (point.y - rect.y) / safeHeight,
      });
    }
    return acc;
  }, []);
  if (normalizedPoints.length === 0) return null;
  const scale =
    coordinateSpace === "line" && lineFrame ? lineFrame.length : safeScale;
  return {
    points: normalizedPoints,
    radiusRatio: Math.max(
      OBJECT_ERASER_RATIO_MIN,
      Math.min(OBJECT_ERASER_RATIO_MAX, path.radius / scale)
    ),
    ...(coordinateSpace === "line" ? { space: "line" as const } : {}),
  };
};

export const convertObjectEraserCutToStoredPath = (
  cut: ObjectEraserCut
): ObjectEraserStoredPath => ({
  points: [{ u: cut.u, v: cut.v }],
  radiusRatio: cut.radiusRatio,
});

export const sanitizeObjectEraserPaths = (
  object: WorkbookBoardObject,
  getObjectRect: GetObjectRect
): ObjectEraserStoredPath[] => {
  const raw = Array.isArray(object.meta?.eraserPaths) ? object.meta.eraserPaths : [];
  const lineFrame = resolveLineEraserFrame(object);
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return raw.reduce<ObjectEraserStoredPath[]>((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const typed = item as {
      points?: unknown;
      radiusRatio?: unknown;
      radius?: unknown;
      r?: unknown;
      space?: unknown;
    };
    const coordinateSpace = resolvePathCoordinateSpace(object, typed.space);
    const rawPoints = Array.isArray(typed.points) ? typed.points : [];
    const normalizedPoints = rawPoints.reduce<Array<{ u: number; v: number }>>((pointsAcc, point) => {
      if (!point || typeof point !== "object") return pointsAcc;
      const rawU = (point as { u?: unknown }).u;
      const rawV = (point as { v?: unknown }).v;
      if (
        typeof rawU === "number" &&
        Number.isFinite(rawU) &&
        typeof rawV === "number" &&
        Number.isFinite(rawV)
      ) {
        pointsAcc.push({ u: rawU, v: rawV });
        return pointsAcc;
      }
      const rawX = (point as { x?: unknown }).x;
      const rawY = (point as { y?: unknown }).y;
      if (
        typeof rawX === "number" &&
        Number.isFinite(rawX) &&
        typeof rawY === "number" &&
        Number.isFinite(rawY)
      ) {
        if (coordinateSpace === "line" && lineFrame) {
          pointsAcc.push(
            projectPointToLineEraserFrame({ x: rawX, y: rawY }, lineFrame)
          );
        } else {
          pointsAcc.push({
            u: (rawX - rect.x) / safeWidth,
            v: (rawY - rect.y) / safeHeight,
          });
        }
      }
      return pointsAcc;
    }, []);
    if (normalizedPoints.length === 0) return acc;
    const radiusScale =
      coordinateSpace === "line" && lineFrame ? lineFrame.length : safeScale;
    const radiusRatio =
      typeof typed.radiusRatio === "number" && Number.isFinite(typed.radiusRatio)
        ? typed.radiusRatio
        : typeof typed.radius === "number" && Number.isFinite(typed.radius)
          ? typed.radius / radiusScale
          : typeof typed.r === "number" && Number.isFinite(typed.r)
            ? typed.r / radiusScale
            : null;
    if (radiusRatio === null) return acc;
    acc.push({
      points: normalizedPoints,
      radiusRatio: Math.max(
        OBJECT_ERASER_RATIO_MIN,
        Math.min(OBJECT_ERASER_RATIO_MAX, radiusRatio)
      ),
      ...(coordinateSpace === "line" ? { space: "line" as const } : {}),
    });
    return acc;
  }, []);
};

export const areObjectEraserCutsEquivalent = (
  left: ObjectEraserCut[],
  right: ObjectEraserCut[],
  epsilon = 1e-4
) => {
  if (left.length !== right.length) return false;
  return left.every((cut, index) => {
    const target = right[index];
    if (!target) return false;
    return (
      Math.abs(cut.u - target.u) <= epsilon &&
      Math.abs(cut.v - target.v) <= epsilon &&
      Math.abs(cut.radiusRatio - target.radiusRatio) <= epsilon
    );
  });
};

export const areObjectEraserStoredPathsEquivalent = (
  left: ObjectEraserStoredPath[],
  right: ObjectEraserStoredPath[],
  epsilon = 1e-4
) => {
  if (left.length !== right.length) return false;
  return left.every((path, index) => {
    const target = right[index];
    if (!target) return false;
    const leftSpace = path.space === "line" ? "line" : "rect";
    const rightSpace = target.space === "line" ? "line" : "rect";
    if (leftSpace !== rightSpace) return false;
    if (Math.abs(path.radiusRatio - target.radiusRatio) > epsilon) return false;
    if (path.points.length !== target.points.length) return false;
    return path.points.every((point, pointIndex) => {
      const targetPoint = target.points[pointIndex];
      if (!targetPoint) return false;
      return (
        Math.abs(point.u - targetPoint.u) <= epsilon &&
        Math.abs(point.v - targetPoint.v) <= epsilon
      );
    });
  });
};

export const applyEraserPointToCollections = (
  params: {
    center: WorkbookPoint;
    radius: number;
    strokes: WorkbookStroke[];
    objects: WorkbookBoardObject[];
    strokeFragmentsMap: Map<string, WorkbookPoint[][]>;
    objectCutsMap: Map<string, ObjectEraserCut[]>;
    objectPreviewPathsMap?: Map<string, ObjectEraserPreviewPath[]>;
    touchedStrokeIds?: Set<string>;
    touchedObjectIds?: Set<string>;
    getObjectRect: GetObjectRect;
    isStrokeErasedByCircle: (
      stroke: WorkbookStroke,
      center: WorkbookPoint,
      radius: number
    ) => boolean;
    isObjectErasedByCircle: (
      object: WorkbookBoardObject,
      center: WorkbookPoint,
      radius: number
    ) => boolean;
    resolveObjectForErasing?: (object: WorkbookBoardObject) => WorkbookBoardObject;
  }
) => {
  const {
    center,
    radius,
    strokes,
    objects,
    strokeFragmentsMap,
    objectCutsMap,
    objectPreviewPathsMap,
    touchedStrokeIds,
    touchedObjectIds,
    getObjectRect,
    isStrokeErasedByCircle,
    isObjectErasedByCircle,
    resolveObjectForErasing,
  } = params;
  strokes.forEach((stroke) => {
    const key = `${stroke.layer}:${stroke.id}`;
    const currentFragments = strokeFragmentsMap.get(key) ?? [stroke.points];
    if (currentFragments.length === 0) return;
    const nextFragments = currentFragments.reduce<WorkbookPoint[][]>((acc, fragment) => {
      const fragmentStroke: WorkbookStroke = {
        ...stroke,
        points: fragment,
      };
      if (!isStrokeErasedByCircle(fragmentStroke, center, radius)) {
        acc.push(fragment);
        return acc;
      }
      const splitFragments = splitStrokeByCircle(fragmentStroke, center, radius);
      if (areStrokeFragmentsEquivalent(fragmentStroke, splitFragments)) {
        acc.push(fragment);
        return acc;
      }
      acc.push(...splitFragments);
      return acc;
    }, []);
    if (areFragmentCollectionsEquivalent(currentFragments, nextFragments)) return;
    touchedStrokeIds?.add(key);
    strokeFragmentsMap.set(key, nextFragments);
  });
  objects.forEach((object) => {
    const sourceObject = resolveObjectForErasing?.(object) ?? object;
    if (!isObjectErasedByCircle(sourceObject, center, radius)) return;
    const cachedCuts =
      objectCutsMap.get(sourceObject.id) ?? sanitizeObjectEraserCuts(sourceObject, getObjectRect);
    const nextCuts = appendObjectEraserCut(
      sourceObject,
      cachedCuts,
      normalizeObjectEraserCut(sourceObject, center, radius, getObjectRect),
      getObjectRect
    );
    objectCutsMap.set(sourceObject.id, nextCuts);
    if (objectPreviewPathsMap) {
      const currentPaths = objectPreviewPathsMap.get(sourceObject.id) ?? [];
      objectPreviewPathsMap.set(
        sourceObject.id,
        appendObjectEraserPreviewPathPoint(currentPaths, center, radius)
      );
    }
    touchedObjectIds?.add(sourceObject.id);
  });
};

export const resolveObjectEraserCutsForRender = (
  object: WorkbookBoardObject,
  cuts: ObjectEraserCut[],
  getObjectRect: GetObjectRect
) => {
  if (cuts.length === 0) return [] as Array<{ x: number; y: number; radius: number }>;
  return cuts.map((cut) => resolveObjectEraserCutGeometry(object, cut, getObjectRect));
};

export const resolveObjectEraserCutPathsForRender = (
  object: WorkbookBoardObject,
  cuts: ObjectEraserCut[],
  getObjectRect: GetObjectRect
): ObjectEraserPreviewPath[] =>
  resolveObjectEraserCutsForRender(object, cuts, getObjectRect).map((cut) => ({
    points: [{ x: cut.x, y: cut.y }],
    radius: cut.radius,
  }));

export const resolveObjectEraserPathsForRender = (
  object: WorkbookBoardObject,
  paths: ObjectEraserStoredPath[],
  getObjectRect: GetObjectRect
): ObjectEraserPreviewPath[] => {
  if (paths.length === 0) return [];
  const lineFrame = resolveLineEraserFrame(object);
  const rect = getObjectRect(object);
  const safeWidth = Math.max(1, Math.abs(rect.width));
  const safeHeight = Math.max(1, Math.abs(rect.height));
  const safeScale = Math.max(1, Math.max(safeWidth, safeHeight));
  return paths.reduce<ObjectEraserPreviewPath[]>((acc, path) => {
    if (!Array.isArray(path.points) || path.points.length === 0) return acc;
    const coordinateSpace = resolvePathCoordinateSpace(object, path.space);
    const resolvedPoints = path.points.reduce<WorkbookPoint[]>((pointsAcc, point) => {
      if (!point || typeof point !== "object") return pointsAcc;
      if (
        typeof point.u !== "number" ||
        !Number.isFinite(point.u) ||
        typeof point.v !== "number" ||
        !Number.isFinite(point.v)
      ) {
        return pointsAcc;
      }
      if (coordinateSpace === "line" && lineFrame) {
        pointsAcc.push(projectPointFromLineEraserFrame(point, lineFrame));
      } else {
        pointsAcc.push({
          x: rect.x + point.u * safeWidth,
          y: rect.y + point.v * safeHeight,
        });
      }
      return pointsAcc;
    }, []);
    if (resolvedPoints.length === 0) return acc;
    const scale =
      coordinateSpace === "line" && lineFrame ? lineFrame.length : safeScale;
    acc.push({
      points: resolvedPoints,
      radius: Math.max(1, Math.min(320, path.radiusRatio * scale)),
    });
    return acc;
  }, []);
};

export const resolveObjectEraserMaskPathsForRender = (params: {
  object: WorkbookBoardObject;
  getObjectRect: GetObjectRect;
  cuts?: ObjectEraserCut[] | null;
  storedPaths?: ObjectEraserStoredPath[] | null;
  previewPaths?: ObjectEraserPreviewPath[] | null;
}): ObjectEraserPreviewPath[] => {
  const {
    object,
    getObjectRect,
    cuts = null,
    storedPaths = null,
    previewPaths = null,
  } = params;
  const committedStoredPaths =
    storedPaths ?? sanitizeObjectEraserPaths(object, getObjectRect);
  const committedPaths =
    committedStoredPaths.length > 0
      ? resolveObjectEraserPathsForRender(object, committedStoredPaths, getObjectRect)
      : [];
  const rotatedCommittedPaths = rotatePathsWithObject(
    object,
    committedPaths,
    getObjectRect
  );
  if (previewPaths && previewPaths.length > 0) {
    return rotatedCommittedPaths.length > 0
      ? [...rotatedCommittedPaths, ...previewPaths]
      : previewPaths;
  }
  if (rotatedCommittedPaths.length > 0) {
    return rotatedCommittedPaths;
  }
  return rotatePathsWithObject(
    object,
    resolveObjectEraserCutPathsForRender(
      object,
      cuts ?? sanitizeObjectEraserCuts(object, getObjectRect),
      getObjectRect
    ),
    getObjectRect
  );
};

export const buildCommittedObjectEraserStoredPaths = (params: {
  object: WorkbookBoardObject;
  getObjectRect: GetObjectRect;
  nextStoredPaths?: ObjectEraserStoredPath[];
}) => {
  const { object, getObjectRect, nextStoredPaths = [] } = params;
  const committedStoredPaths = sanitizeObjectEraserPaths(object, getObjectRect);
  const fallbackStoredPaths =
    committedStoredPaths.length > 0
      ? committedStoredPaths
      : sanitizeObjectEraserCuts(object, getObjectRect).map(convertObjectEraserCutToStoredPath);
  return [...fallbackStoredPaths, ...nextStoredPaths];
};

const isPointInsideObjectEraserPreviewPath = (
  point: WorkbookPoint,
  path: ObjectEraserPreviewPath
) => {
  if (!Array.isArray(path.points) || path.points.length === 0) return false;
  if (path.points.length === 1) {
    return Math.hypot(point.x - path.points[0].x, point.y - path.points[0].y) <= path.radius;
  }
  for (let index = 0; index < path.points.length - 1; index += 1) {
    if (distanceToSegment(point, path.points[index], path.points[index + 1]) <= path.radius) {
      return true;
    }
  }
  return false;
};

export const isPointInsideObjectEraserMask = (params: {
  object: WorkbookBoardObject;
  point: WorkbookPoint;
  getObjectRect: GetObjectRect;
  previewCuts?: ObjectEraserCut[] | null;
  previewPaths?: ObjectEraserPreviewPath[] | null;
}) => {
  const {
    object,
    point,
    getObjectRect,
    previewCuts = null,
    previewPaths = null,
  } = params;
  const activePaths = resolveObjectEraserMaskPathsForRender({
    object,
    getObjectRect,
    cuts: previewCuts,
    previewPaths,
  });
  return activePaths.some((path) => isPointInsideObjectEraserPreviewPath(point, path));
};
