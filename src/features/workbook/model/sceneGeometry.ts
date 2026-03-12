import { getWorkbookPolygonPoints, type WorkbookPolygonPreset } from "./shapeGeometry";
import { toPath } from "./stroke";
import type {
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookPoint,
} from "./types";
import type { WorkbookSceneRect } from "./sceneVisibility";

type Rect = WorkbookSceneRect;

export type LineCurveMeta = {
  c1t: number;
  c1n: number;
  c2t: number;
  c2n: number;
};

type CanvasPoint = {
  x: number;
  y: number;
};

const DEFAULT_LINE_CURVE: LineCurveMeta = {
  c1t: 1 / 3,
  c1n: 0,
  c2t: 2 / 3,
  c2n: 0,
};

export const normalizeRect = (a: WorkbookPoint, b: WorkbookPoint): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.max(1, Math.abs(a.x - b.x)),
  height: Math.max(1, Math.abs(a.y - b.y)),
});

export const circleIntersectsRect = (
  center: WorkbookPoint,
  radius: number,
  rect: Rect
) => {
  const nearestX = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  return Math.hypot(center.x - nearestX, center.y - nearestY) <= radius;
};

export const distanceToSegment = (
  point: WorkbookPoint,
  a: WorkbookPoint,
  b: WorkbookPoint
) => {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const apX = point.x - a.x;
  const apY = point.y - a.y;
  const denominator = abX * abX + abY * abY;
  if (denominator <= 1e-8) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / denominator));
  const closest = { x: a.x + abX * t, y: a.y + abY * t };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
};

export const pointInPolygon = (point: WorkbookPoint, polygon: WorkbookPoint[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x <
        ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + Number.EPSILON) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

const getLineEndpoints = (object: WorkbookBoardObject) => ({
  start: { x: object.x, y: object.y },
  end: { x: object.x + object.width, y: object.y + object.height },
});

export const getLineBasis = (object: WorkbookBoardObject) => {
  const { start, end } = getLineEndpoints(object);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.0001) {
    return {
      start,
      end,
      length: 0,
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: -1 },
    };
  }
  return {
    start,
    end,
    length,
    tangent: { x: dx / length, y: dy / length },
    normal: { x: -dy / length, y: dx / length },
  };
};

export const readLineCurveMeta = (object: WorkbookBoardObject): LineCurveMeta => {
  const curve = object.meta?.curve;
  if (curve && typeof curve === "object" && !Array.isArray(curve)) {
    const record = curve as Record<string, unknown>;
    const c1t =
      typeof record.c1t === "number" && Number.isFinite(record.c1t)
        ? record.c1t
        : DEFAULT_LINE_CURVE.c1t;
    const c1n =
      typeof record.c1n === "number" && Number.isFinite(record.c1n)
        ? record.c1n
        : DEFAULT_LINE_CURVE.c1n;
    const c2t =
      typeof record.c2t === "number" && Number.isFinite(record.c2t)
        ? record.c2t
        : DEFAULT_LINE_CURVE.c2t;
    const c2n =
      typeof record.c2n === "number" && Number.isFinite(record.c2n)
        ? record.c2n
        : DEFAULT_LINE_CURVE.c2n;
    return { c1t, c1n, c2t, c2n };
  }
  const legacyOffset = object.meta?.curveOffset;
  if (typeof legacyOffset === "number" && Number.isFinite(legacyOffset)) {
    return {
      c1t: DEFAULT_LINE_CURVE.c1t,
      c1n: legacyOffset,
      c2t: DEFAULT_LINE_CURVE.c2t,
      c2n: legacyOffset,
    };
  }
  return { ...DEFAULT_LINE_CURVE };
};

export const getLineControlPoints = (object: WorkbookBoardObject) => {
  const basis = getLineBasis(object);
  const curve = readLineCurveMeta(object);
  const project = (t: number, n: number) => ({
    x: basis.start.x + basis.tangent.x * basis.length * t + basis.normal.x * n,
    y: basis.start.y + basis.tangent.y * basis.length * t + basis.normal.y * n,
  });
  return {
    start: basis.start,
    end: basis.end,
    c1: project(curve.c1t, curve.c1n),
    c2: project(curve.c2t, curve.c2n),
    curve,
    basis,
  };
};

export const projectPointToLineCurve = (
  object: WorkbookBoardObject,
  point: WorkbookPoint
) => {
  const basis = getLineBasis(object);
  if (basis.length <= 0.0001) {
    return { t: DEFAULT_LINE_CURVE.c1t, n: 0 };
  }
  const dx = point.x - basis.start.x;
  const dy = point.y - basis.start.y;
  return {
    t: (dx * basis.tangent.x + dy * basis.tangent.y) / basis.length,
    n: dx * basis.normal.x + dy * basis.normal.y,
  };
};

export const getLinePathD = (object: WorkbookBoardObject) => {
  const controls = getLineControlPoints(object);
  return `M ${controls.start.x} ${controls.start.y} C ${controls.c1.x} ${controls.c1.y} ${controls.c2.x} ${controls.c2.y} ${controls.end.x} ${controls.end.y}`;
};

export const getObjectRect = (object: WorkbookBoardObject): Rect => {
  if (object.type === "line" || object.type === "arrow") {
    const controls = getLineControlPoints(object);
    const minX = Math.min(controls.start.x, controls.end.x, controls.c1.x, controls.c2.x);
    const maxX = Math.max(controls.start.x, controls.end.x, controls.c1.x, controls.c2.x);
    const minY = Math.min(controls.start.y, controls.end.y, controls.c1.y, controls.c2.y);
    const maxY = Math.max(controls.start.y, controls.end.y, controls.c1.y, controls.c2.y);
    return {
      x: minX - 8,
      y: minY - 8,
      width: Math.max(1, maxX - minX) + 16,
      height: Math.max(1, maxY - minY) + 16,
    };
  }
  if (Array.isArray(object.points) && object.points.length > 0) {
    let minX = object.points[0].x;
    let minY = object.points[0].y;
    let maxX = object.points[0].x;
    let maxY = object.points[0].y;
    object.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }
  const width = Math.max(1, Math.abs(object.width));
  const height = Math.max(1, Math.abs(object.height));
  return {
    x: Math.min(object.x, object.x + object.width),
    y: Math.min(object.y, object.y + object.height),
    width,
    height,
  };
};

export const getObjectCenter = (object: WorkbookBoardObject): WorkbookPoint => {
  const rect = getObjectRect(object);
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

export const rotatePointAround = (
  point: WorkbookPoint,
  center: WorkbookPoint,
  angleDeg: number
): WorkbookPoint => {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

export const isInsideRect = (point: WorkbookPoint, rect: Rect) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const createPolygonPath = (
  rect: Rect,
  sides: number,
  preset: WorkbookPolygonPreset = "regular"
) => {
  const points = getWorkbookPolygonPoints(rect, sides, preset);
  return `${toPath(points)} Z`;
};

export const resolvePolygonFigureKind = (
  sides: number,
  preset: WorkbookPolygonPreset
): string | undefined => {
  if (preset === "rhombus") return "rhombus";
  if (preset === "trapezoid") return "trapezoid_isosceles";
  if (preset === "trapezoid_right") return "trapezoid_right";
  if (preset === "trapezoid_scalene") return "trapezoid_scalene";
  if (sides === 3) return "triangle";
  if (sides === 5) return "pentagon";
  if (sides === 6) return "hexagon";
  return undefined;
};

export const getFigureVertexLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length)}`;
};

export const resolve2dFigureVertices = (
  object: WorkbookBoardObject,
  normalized: Rect
) => {
  if (object.type === "rectangle") {
    return [
      { x: normalized.x, y: normalized.y },
      { x: normalized.x + normalized.width, y: normalized.y },
      { x: normalized.x + normalized.width, y: normalized.y + normalized.height },
      { x: normalized.x, y: normalized.y + normalized.height },
    ];
  }
  if (object.type === "triangle") {
    return [
      { x: normalized.x + normalized.width / 2, y: normalized.y },
      { x: normalized.x, y: normalized.y + normalized.height },
      { x: normalized.x + normalized.width, y: normalized.y + normalized.height },
    ];
  }
  if (object.type === "polygon") {
    if (Array.isArray(object.points) && object.points.length >= 2) {
      return object.points;
    }
    const objectPreset =
      object.meta?.polygonPreset === "trapezoid" ||
      object.meta?.polygonPreset === "trapezoid_right" ||
      object.meta?.polygonPreset === "trapezoid_scalene" ||
      object.meta?.polygonPreset === "rhombus"
        ? object.meta.polygonPreset
        : "regular";
    return getWorkbookPolygonPoints(normalized, object.sides ?? 5, objectPreset);
  }
  return [] as WorkbookPoint[];
};

export const is2dFigureClosed = (object: WorkbookBoardObject) => {
  if (object.type !== "polygon") return true;
  if (!Array.isArray(object.points) || object.points.length < 2) return true;
  return object.meta?.closed !== false;
};

export const get2dFigureSegments = (
  vertices: WorkbookPoint[],
  closed: boolean
) => {
  if (vertices.length < 2) return [] as { start: WorkbookPoint; end: WorkbookPoint }[];
  const segmentCount = closed ? vertices.length : Math.max(0, vertices.length - 1);
  return Array.from({ length: segmentCount }, (_, index) => ({
    start: vertices[index],
    end: vertices[(index + 1) % vertices.length],
  }));
};

export const resolve2dFigureVertexLabels = (
  object: WorkbookBoardObject,
  verticesCount: number
) => {
  const source = Array.isArray(object.meta?.vertexLabels) ? object.meta.vertexLabels : [];
  return Array.from({ length: verticesCount }, (_, index) => {
    const raw = typeof source[index] === "string" ? source[index].trim() : "";
    return raw || getFigureVertexLabel(index);
  });
};

const sampleCubicBezier = (
  p0: WorkbookPoint,
  p1: WorkbookPoint,
  p2: WorkbookPoint,
  p3: WorkbookPoint,
  t: number
) => {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const x =
    mt2 * mt * p0.x +
    3 * mt2 * t * p1.x +
    3 * mt * t2 * p2.x +
    t2 * t * p3.x;
  const y =
    mt2 * mt * p0.y +
    3 * mt2 * t * p1.y +
    3 * mt * t2 * p2.y +
    t2 * t * p3.y;
  return { x, y };
};

export const distanceToCubicBezier = (
  point: WorkbookPoint,
  p0: WorkbookPoint,
  p1: WorkbookPoint,
  p2: WorkbookPoint,
  p3: WorkbookPoint
) => {
  const samples = 30;
  let nearest = Number.POSITIVE_INFINITY;
  let previous = p0;
  for (let index = 1; index <= samples; index += 1) {
    const current = sampleCubicBezier(p0, p1, p2, p3, index / samples);
    nearest = Math.min(nearest, distanceToSegment(point, previous, current));
    previous = current;
  }
  return nearest;
};

export const distanceToPolyline = (
  point: WorkbookPoint,
  vertices: WorkbookPoint[],
  closed: boolean
) => {
  if (vertices.length < 2) return Number.POSITIVE_INFINITY;
  let nearest = Number.POSITIVE_INFINITY;
  const segments = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < segments; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    nearest = Math.min(nearest, distanceToSegment(point, start, end));
  }
  return nearest;
};

const dot2 = (a: CanvasPoint, b: CanvasPoint) => a.x * b.x + a.y * b.y;

export const clipPolygonByHalfPlane = (
  polygon: CanvasPoint[],
  origin: CanvasPoint,
  normal: CanvasPoint,
  keepPositive: boolean
) => {
  if (polygon.length === 0) return polygon;
  const sign = keepPositive ? 1 : -1;
  const inside = (point: CanvasPoint) =>
    sign * dot2({ x: point.x - origin.x, y: point.y - origin.y }, normal) >= 0;

  const intersect = (a: CanvasPoint, b: CanvasPoint) => {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const numerator = dot2({ x: origin.x - a.x, y: origin.y - a.y }, normal);
    const denominator = dot2(ab, normal);
    if (Math.abs(denominator) < 1e-6) return b;
    const t = numerator / denominator;
    return {
      x: a.x + ab.x * t,
      y: a.y + ab.y * t,
    };
  };

  const output: CanvasPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);
    if (currentInside) {
      if (!previousInside) {
        output.push(intersect(previous, current));
      }
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }
  return output;
};

export const getPointsBoundsFromPoints = (points: WorkbookPoint[]) => {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export const getPointsCentroid = (points: WorkbookPoint[]) => {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  if (points.length < 3) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    signedArea += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }
  if (Math.abs(signedArea) < 1e-6) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }
  return {
    x: centroidX / (3 * signedArea),
    y: centroidY / (3 * signedArea),
  };
};

export const resolveOutsideVertexLabelPlacement = (params: {
  vertex: WorkbookPoint;
  center?: WorkbookPoint | null;
  polygon?: WorkbookPoint[];
  baseOffset?: number;
}) => {
  const { vertex, center = null, polygon = [], baseOffset = 14 } = params;
  const polygonCenter =
    polygon.length >= 2 ? getPointsCentroid(polygon) : center ?? { x: vertex.x, y: vertex.y };
  let dx = vertex.x - polygonCenter.x;
  let dy = vertex.y - polygonCenter.y;
  let length = Math.hypot(dx, dy);
  if (length < 1e-6 && polygon.length >= 2) {
    const bounds = getPointsBoundsFromPoints(polygon);
    dx = vertex.x - (bounds.minX + bounds.width / 2);
    dy = vertex.y - (bounds.minY + bounds.height / 2);
    length = Math.hypot(dx, dy);
  }
  if (length < 1e-6 && center) {
    dx = vertex.x - center.x;
    dy = vertex.y - center.y;
    length = Math.hypot(dx, dy);
  }
  if (length < 1e-6) {
    dx = 0.82;
    dy = -0.58;
    length = 1;
  }
  const direction = {
    x: dx / length,
    y: dy / length,
  };
  const offsets = [baseOffset, baseOffset + 6, baseOffset + 12];
  let target = {
    x: vertex.x + direction.x * offsets[0],
    y: vertex.y + direction.y * offsets[0],
  };
  for (const offset of offsets) {
    const candidate = {
      x: vertex.x + direction.x * offset,
      y: vertex.y + direction.y * offset,
    };
    if (polygon.length < 3 || !pointInPolygon(candidate, polygon)) {
      target = candidate;
      break;
    }
    target = candidate;
  }
  return {
    x: target.x,
    y: target.y,
    textAnchor:
      direction.x > 0.35 ? "start" : direction.x < -0.35 ? "end" : "middle",
  } as const;
};

export const clampUnitDot = (value: number) => Math.max(-1, Math.min(1, value));

export const buildAngleArcPath = (
  vertex: WorkbookPoint,
  unitA: WorkbookPoint,
  unitB: WorkbookPoint,
  radius: number,
  sweep: 0 | 1
) => {
  const start = {
    x: vertex.x + unitA.x * radius,
    y: vertex.y + unitA.y * radius,
  };
  const end = {
    x: vertex.x + unitB.x * radius,
    y: vertex.y + unitB.y * radius,
  };
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`;
};

export const buildRightAngleMarkerPath = (
  vertex: WorkbookPoint,
  unitA: WorkbookPoint,
  unitB: WorkbookPoint,
  size: number
) => {
  const first = {
    x: vertex.x + unitA.x * size,
    y: vertex.y + unitA.y * size,
  };
  const corner = {
    x: first.x + unitB.x * size,
    y: first.y + unitB.y * size,
  };
  const second = {
    x: vertex.x + unitB.x * size,
    y: vertex.y + unitB.y * size,
  };
  return `M ${first.x} ${first.y} L ${corner.x} ${corner.y} L ${second.x} ${second.y}`;
};

export const mapConstraintLabel = (type: WorkbookConstraint["type"]) => {
  if (type === "parallel") return "∥";
  if (type === "perpendicular") return "⊥";
  if (type === "equal_length") return "L=";
  if (type === "equal_angle") return "∠=";
  if (type === "point_on_line") return "•—";
  if (type === "point_on_circle") return "•○";
  return "Связь";
};

export const getPointObjectCenter = (object: WorkbookBoardObject) => ({
  x: object.x + object.width / 2,
  y: object.y + object.height / 2,
});

