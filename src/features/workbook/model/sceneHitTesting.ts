import { resolveSolid3dPresetId } from "./solid3d";
import {
  getSolid3dMesh,
  projectSolidVerticesForObject,
} from "./solid3dGeometry";
import { readSolid3dState } from "./solid3dState";
import { getStrokeRect } from "./stroke";
import type {
  WorkbookBoardObject,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";
import {
  circleIntersectsRect,
  distanceToCubicBezier,
  distanceToPolyline,
  distanceToSegment,
  getLineControlPoints,
  getObjectRect,
  getPointObjectCenter,
  getPointsBoundsFromPoints,
  is2dFigureClosed,
  isInsideRect,
  normalizeRect,
  pointInPolygon,
  resolve2dFigureVertices,
  rotatePointAround,
} from "./sceneGeometry";

export const resolveWorkbook2dFigureVertexAtPoint = (
  object: WorkbookBoardObject,
  point: WorkbookPoint
) => {
  if (object.type !== "rectangle" && object.type !== "triangle" && object.type !== "polygon") {
    return null;
  }
  const rect = normalizeRect(
    { x: object.x, y: object.y },
    { x: object.x + object.width, y: object.y + object.height }
  );
  const vertices = resolve2dFigureVertices(object, rect);
  if (vertices.length === 0) return null;
  const nearest = vertices.reduce(
    (acc, vertex, index) => {
      const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
      if (distance < acc.distance) {
        return { index, distance };
      }
      return acc;
    },
    { index: -1, distance: Number.POSITIVE_INFINITY }
  );
  return nearest.index >= 0 && nearest.distance <= 11 ? nearest.index : null;
};

export const resolveWorkbookLineEndpointAtPoint = (
  object: WorkbookBoardObject,
  point: WorkbookPoint
) => {
  if (object.type !== "line" && object.type !== "arrow") return null;
  if (object.meta?.lineKind !== "segment") return null;
  const start = { x: object.x, y: object.y };
  const end = { x: object.x + object.width, y: object.y + object.height };
  const startDistance = Math.hypot(point.x - start.x, point.y - start.y);
  const endDistance = Math.hypot(point.x - end.x, point.y - end.y);
  if (startDistance <= 10 || endDistance <= 10) {
    return startDistance <= endDistance ? "start" : "end";
  }
  return null;
};

export const isWorkbookObjectHit = (
  object: WorkbookBoardObject,
  point: WorkbookPoint
) => {
  if (object.type === "point") {
    const center = getPointObjectCenter(object);
    const radius = Math.max(6, Math.min(14, Math.abs(object.width) * 0.8));
    return Math.hypot(center.x - point.x, center.y - point.y) <= radius;
  }
  if (object.type === "solid3d") {
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
    const presetIdRaw =
      typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
    const presetId = resolveSolid3dPresetId(presetIdRaw);
    const mesh = getSolid3dMesh(
      presetId,
      Math.max(1, Math.abs(object.width)),
      Math.max(1, Math.abs(object.height))
    );
    if (!mesh) {
      return isInsideRect(localPoint, rect);
    }
    const solidState = readSolid3dState(object.meta);
    const projected = projectSolidVerticesForObject({
      mesh,
      view: solidState.view,
      objectRect: rect,
    });
    if (!projected.length) {
      return isInsideRect(localPoint, rect);
    }
    const projectedPoints = projected.map((vertex) => ({ x: vertex.x, y: vertex.y }));
    const projectedBounds = getPointsBoundsFromPoints(projectedPoints);
    const expandedBounds = {
      x: projectedBounds.minX - 8,
      y: projectedBounds.minY - 8,
      width: projectedBounds.width + 16,
      height: projectedBounds.height + 16,
    };
    if (!isInsideRect(localPoint, expandedBounds)) {
      return false;
    }
    const edgeThreshold = Math.max(6, (object.strokeWidth ?? 2) + 4);
    for (const face of mesh.faces) {
      const polygon = face
        .map((vertexIndex) => projected[vertexIndex])
        .filter(Boolean)
        .map((vertex) => ({ x: vertex.x, y: vertex.y }));
      if (polygon.length < 2) continue;
      if (polygon.length >= 3 && pointInPolygon(localPoint, polygon)) return true;
      if (distanceToPolyline(localPoint, polygon, true) <= edgeThreshold) return true;
    }
    return isInsideRect(localPoint, rect);
  }
  if (object.type === "section_divider") {
    const y = object.y + object.height / 2;
    const left = Math.min(object.x, object.x + object.width);
    const right = Math.max(object.x, object.x + object.width);
    const threshold = Math.max(6, (object.strokeWidth ?? 2) + 4);
    return point.x >= left - 8 && point.x <= right + 8 && Math.abs(point.y - y) <= threshold;
  }
  if (object.type === "line" || object.type === "arrow") {
    const controls = getLineControlPoints(object);
    const threshold = Math.max(7, (object.strokeWidth ?? 2) + 5);
    const distance = distanceToCubicBezier(
      point,
      controls.start,
      controls.c1,
      controls.c2,
      controls.end
    );
    return distance <= threshold;
  }
  if (object.type === "rectangle" || object.type === "triangle" || object.type === "polygon") {
    const rect = normalizeRect(
      { x: object.x, y: object.y },
      { x: object.x + object.width, y: object.y + object.height }
    );
    const vertices = resolve2dFigureVertices(object, rect);
    if (vertices.length < 2) return isInsideRect(point, rect);
    const closed = is2dFigureClosed(object);
    const edgeDistance = distanceToPolyline(point, vertices, closed);
    if (edgeDistance <= Math.max(6, (object.strokeWidth ?? 2) + 4)) {
      return true;
    }
    if (closed && pointInPolygon(point, vertices)) return true;
    return false;
  }
  const rect = getObjectRect(object);
  if (object.rotation && Number.isFinite(object.rotation)) {
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    const localPoint = rotatePointAround(point, center, -(object.rotation ?? 0));
    return isInsideRect(localPoint, rect);
  }
  return isInsideRect(point, rect);
};

export const isWorkbookStrokeHit = (
  stroke: WorkbookStroke,
  point: WorkbookPoint
) => {
  if (!stroke.points.length) return false;
  const distance =
    stroke.points.length === 1
      ? Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y)
      : distanceToPolyline(point, stroke.points, false);
  const threshold = Math.max(
    6,
    (stroke.width ?? 2) / 2 + (stroke.tool === "highlighter" ? 6 : 4)
  );
  return distance <= threshold;
};

export const isWorkbookStrokeErasedByCircle = (
  stroke: WorkbookStroke,
  center: WorkbookPoint,
  radius: number
) => {
  if (!stroke.points.length) return false;
  const strokeRect = getStrokeRect(stroke);
  if (strokeRect && !circleIntersectsRect(center, radius, strokeRect)) {
    return false;
  }
  const threshold = Math.max(2, radius + (stroke.width ?? 2) / 2);
  if (stroke.points.length === 1) {
    return Math.hypot(center.x - stroke.points[0].x, center.y - stroke.points[0].y) <= threshold;
  }
  for (let index = 0; index < stroke.points.length - 1; index += 1) {
    if (distanceToSegment(center, stroke.points[index], stroke.points[index + 1]) <= threshold) {
      return true;
    }
  }
  return false;
};

export const isWorkbookObjectErasedByCircle = (
  object: WorkbookBoardObject,
  center: WorkbookPoint,
  radius: number
) => {
  const isNonErasableSolidDomain =
    object.type === "solid3d" ||
    object.type === "section3d" ||
    object.type === "net3d" ||
    (typeof object.meta?.parentSolidId === "string" && object.meta.parentSolidId.trim().length > 0);
  if (isNonErasableSolidDomain) return false;
  if (object.pinned || object.locked) return false;
  const objectRect = getObjectRect(object);
  if (!circleIntersectsRect(center, radius, objectRect)) return false;
  if (isWorkbookObjectHit(object, center)) return true;
  const sampleCount = 16;
  for (let index = 0; index < sampleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / sampleCount;
    const perimeterPoint = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    if (isWorkbookObjectHit(object, perimeterPoint)) {
      return true;
    }
  }
  return false;
};

