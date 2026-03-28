import { resolveSolid3dPresetId } from "./solid3d";
import {
  computeSectionPolygon,
  getSolid3dMesh,
  pickSolidPointOnSurface,
  projectSolidPointForObject,
  projectSolidVerticesForObject,
  resolveSectionPointForMesh,
  type SolidSurfacePick,
} from "./solid3dGeometry";
import type { Solid3dSectionPoint } from "./solid3dState";
import { readSolid3dState } from "./solid3dState";
import {
  distanceToSegment,
  getPointsBoundsFromPoints,
  normalizeRect,
  pointInPolygon,
  rotatePointAround,
} from "./sceneGeometry";
import type { WorkbookBoardObject, WorkbookPoint } from "./types";

export type Solid3dResizeHandle = {
  mode: "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";
  x: number;
  y: number;
};

type Solid3dPreviewMetaById = Record<string, Record<string, unknown>>;

const resolveSolid3dRenderSource = (
  sourceObject: WorkbookBoardObject,
  previewMetaById: Solid3dPreviewMetaById
) =>
  previewMetaById[sourceObject.id] && sourceObject.type === "solid3d"
    ? { ...sourceObject, meta: previewMetaById[sourceObject.id] }
    : sourceObject;

const resolveSolid3dMeshAndRect = (object: WorkbookBoardObject) => {
  const presetIdRaw =
    typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
  const presetId = resolveSolid3dPresetId(presetIdRaw);
  const mesh = getSolid3dMesh(
    presetId,
    Math.max(1, Math.abs(object.width)),
    Math.max(1, Math.abs(object.height))
  );
  const rect = normalizeRect(
    { x: object.x, y: object.y },
    { x: object.x + object.width, y: object.y + object.height }
  );
  return {
    presetId,
    mesh,
    rect,
  };
};

export const resolveSolid3dPointAtPointer = (
  object: WorkbookBoardObject,
  point: WorkbookPoint
): SolidSurfacePick | null => {
  if (object.type !== "solid3d") return null;
  const { mesh, rect } = resolveSolid3dMeshAndRect(object);
  if (!mesh) return null;
  const solidState = readSolid3dState(object.meta);
  const localPoint =
    object.rotation && Number.isFinite(object.rotation)
      ? rotatePointAround(
          point,
          { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          -(object.rotation ?? 0)
        )
      : point;

  const projectedVertices = projectSolidVerticesForObject({
    mesh,
    view: solidState.view,
    objectRect: rect,
  });
  const nearestVertex = projectedVertices.reduce(
    (acc, vertex) => {
      const distance = Math.hypot(vertex.x - localPoint.x, vertex.y - localPoint.y);
      if (distance < acc.distance) {
        return { index: vertex.index, distance };
      }
      return acc;
    },
    { index: -1, distance: Number.POSITIVE_INFINITY }
  );
  if (nearestVertex.index >= 0 && nearestVertex.distance <= 20) {
    const faceIndex = mesh.faces.findIndex((face) => face.includes(nearestVertex.index));
    return {
      point: mesh.vertices[nearestVertex.index],
      faceIndex: faceIndex >= 0 ? faceIndex : 0,
      depth: projectedVertices[nearestVertex.index]?.depth ?? 0,
      triangleVertexIndices: [
        nearestVertex.index,
        nearestVertex.index,
        nearestVertex.index,
      ],
      barycentric: [1, 0, 0],
      classification: "vertex",
      vertexIndex: nearestVertex.index,
    };
  }

  const hostedPoints = solidState.hostedPoints.filter(
    (entry) => entry.hostObjectId === object.id && entry.visible !== false
  );
  if (hostedPoints.length > 0) {
    const hostedPointPick = hostedPoints
      .map((entry) => {
        const worldPoint = resolveSectionPointForMesh(entry, mesh);
        const projected = projectSolidPointForObject({
          point: worldPoint,
          view: solidState.view,
          objectRect: rect,
        });
        const distance = Math.hypot(projected.x - localPoint.x, projected.y - localPoint.y);
        return {
          entry,
          worldPoint,
          projected,
          distance,
        };
      })
      .filter((candidate) => candidate.distance <= 12)
      .sort((left, right) => left.distance - right.distance)[0];
    if (hostedPointPick) {
      const entry = hostedPointPick.entry;
      const fallbackFaceIndex =
        Number.isInteger(entry.faceIndex) && Number(entry.faceIndex) >= 0
          ? Number(entry.faceIndex)
          : 0;
      return {
        point: hostedPointPick.worldPoint,
        faceIndex: fallbackFaceIndex,
        depth: hostedPointPick.projected.depth,
        triangleVertexIndices:
          Array.isArray(entry.triangleVertexIndices) &&
          entry.triangleVertexIndices.length === 3
            ? [
                entry.triangleVertexIndices[0],
                entry.triangleVertexIndices[1],
                entry.triangleVertexIndices[2],
              ]
            : [0, 0, 0],
        barycentric:
          Array.isArray(entry.barycentric) && entry.barycentric.length === 3
            ? [entry.barycentric[0], entry.barycentric[1], entry.barycentric[2]]
            : [1, 0, 0],
        classification: entry.classification,
        vertexIndex: entry.vertexIndex,
        edgeKey: entry.edgeKey,
        hostSegmentId: entry.hostSegmentId,
        segmentT: entry.segmentT,
      };
    }
  }

  const hostedPointById = new Map(hostedPoints.map((entry) => [entry.id, entry] as const));
  const hostedSegments = solidState.hostedSegments.filter(
    (entry) => entry.hostObjectId === object.id && entry.visible !== false
  );
  if (hostedSegments.length > 0) {
    const hostedSegmentPick = hostedSegments
      .map((segment) => {
        const start = hostedPointById.get(segment.startPointId);
        const end = hostedPointById.get(segment.endPointId);
        if (!start || !end) return null;
        const startWorld = resolveSectionPointForMesh(start, mesh);
        const endWorld = resolveSectionPointForMesh(end, mesh);
        const startProjected = projectSolidPointForObject({
          point: startWorld,
          view: solidState.view,
          objectRect: rect,
        });
        const endProjected = projectSolidPointForObject({
          point: endWorld,
          view: solidState.view,
          objectRect: rect,
        });
        const vx = endProjected.x - startProjected.x;
        const vy = endProjected.y - startProjected.y;
        const edgeLengthSq = vx * vx + vy * vy;
        if (edgeLengthSq < 1e-8) return null;
        const px = localPoint.x - startProjected.x;
        const py = localPoint.y - startProjected.y;
        const rawT = (px * vx + py * vy) / edgeLengthSq;
        const t = Math.max(0, Math.min(1, rawT));
        const closestX = startProjected.x + vx * t;
        const closestY = startProjected.y + vy * t;
        const distance = Math.hypot(localPoint.x - closestX, localPoint.y - closestY);
        if (distance > 10) return null;
        const worldPoint = {
          x: startWorld.x * (1 - t) + endWorld.x * t,
          y: startWorld.y * (1 - t) + endWorld.y * t,
          z: startWorld.z * (1 - t) + endWorld.z * t,
        };
        const fallbackFaceIndex =
          Number.isInteger(start.faceIndex) && Number(start.faceIndex) >= 0
            ? Number(start.faceIndex)
            : Number.isInteger(end.faceIndex) && Number(end.faceIndex) >= 0
              ? Number(end.faceIndex)
              : 0;
        const depth = startProjected.depth * (1 - t) + endProjected.depth * t;
        return {
          segment,
          worldPoint,
          distance,
          t,
          depth,
          fallbackFaceIndex,
        };
      })
      .filter(
        (
          candidate
        ): candidate is {
          segment: (typeof hostedSegments)[number];
          worldPoint: { x: number; y: number; z: number };
          distance: number;
          t: number;
          depth: number;
          fallbackFaceIndex: number;
        } => Boolean(candidate)
      )
      .sort((left, right) => left.distance - right.distance)[0];
    if (hostedSegmentPick) {
      return {
        point: hostedSegmentPick.worldPoint,
        faceIndex: hostedSegmentPick.fallbackFaceIndex,
        depth: hostedSegmentPick.depth,
        triangleVertexIndices: [0, 0, 0],
        barycentric: [1 - hostedSegmentPick.t, hostedSegmentPick.t, 0],
        classification: "point_on_segment",
        hostSegmentId: hostedSegmentPick.segment.id,
        segmentT: hostedSegmentPick.t,
      };
    }
  }

  return pickSolidPointOnSurface({
    mesh,
    view: solidState.view,
    objectRect: rect,
    point: localPoint,
  });
};

export const resolveSolid3dResizeHandles = (
  object: WorkbookBoardObject
): Solid3dResizeHandle[] => {
  if (object.type !== "solid3d") return [];
  const { mesh, rect } = resolveSolid3dMeshAndRect(object);
  if (!mesh) return [];
  const solidState = readSolid3dState(object.meta);
  const projected = projectSolidVerticesForObject({
    mesh,
    view: solidState.view,
    objectRect: rect,
  }).map((vertex) => ({ x: vertex.x, y: vertex.y }));
  if (!projected.length) return [];
  const bounds = getPointsBoundsFromPoints(projected);
  const left = bounds.minX;
  const right = bounds.maxX;
  const top = bounds.minY;
  const bottom = bounds.maxY;
  const padding = 12;
  return [
    { mode: "nw", x: left - padding, y: top - padding },
    { mode: "ne", x: right + padding, y: top - padding },
    { mode: "se", x: right + padding, y: bottom + padding },
    { mode: "sw", x: left - padding, y: bottom + padding },
  ];
};

export const resolveSolid3dResizeHandleHit = (
  object: WorkbookBoardObject,
  point: WorkbookPoint,
  radius = 8.5
): Solid3dResizeHandle | null =>
  resolveSolid3dResizeHandles(object).find(
    (handle) => Math.hypot(handle.x - point.x, handle.y - point.y) <= radius
  ) ?? null;

export const resolveSolid3dPickMarkersForObject = (
  sourceObject: WorkbookBoardObject,
  selectedPoints: Solid3dSectionPoint[],
  previewMetaById: Solid3dPreviewMetaById
) => {
  if (sourceObject.type !== "solid3d") {
    return [] as Array<{ index: number; x: number; y: number; label: string }>;
  }
  const object = resolveSolid3dRenderSource(sourceObject, previewMetaById);
  const { mesh, rect } = resolveSolid3dMeshAndRect(object);
  const solidState = readSolid3dState(object.meta);
  return selectedPoints.map((point3d, index) => {
    const worldPoint =
      mesh && point3d
        ? resolveSectionPointForMesh(point3d, mesh)
        : { x: point3d.x, y: point3d.y, z: point3d.z };
    const projected = projectSolidPointForObject({
      point: worldPoint,
      view: solidState.view,
      objectRect: rect,
    });
    return {
      index,
      x: projected.x,
      y: projected.y,
      label: point3d.label || `P${index + 1}`,
    };
  });
};

export const resolveSolid3dVertexAtPointer = (
  sourceObject: WorkbookBoardObject,
  point: WorkbookPoint,
  previewMetaById: Solid3dPreviewMetaById
) => {
  if (sourceObject.type !== "solid3d") return null;
  const object = resolveSolid3dRenderSource(sourceObject, previewMetaById);
  const { mesh, rect } = resolveSolid3dMeshAndRect(object);
  if (!mesh) return null;
  const solidState = readSolid3dState(object.meta);
  const projected = projectSolidVerticesForObject({
    mesh,
    view: solidState.view,
    objectRect: rect,
  });
  const nearest = projected.reduce(
    (acc, vertex) => {
      const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
      if (distance < acc.distance) {
        return { index: vertex.index, distance };
      }
      return acc;
    },
    { index: -1, distance: Number.POSITIVE_INFINITY }
  );
  if (nearest.index < 0 || nearest.distance > 12) return null;
  return nearest.index;
};

export const resolveSolid3dSectionVertexAtPointer = (
  sourceObject: WorkbookBoardObject,
  point: WorkbookPoint,
  previewMetaById: Solid3dPreviewMetaById,
  roundSolidPresets: Set<string>
) => {
  if (sourceObject.type !== "solid3d") return null;
  const object = resolveSolid3dRenderSource(sourceObject, previewMetaById);
  const { presetId, mesh, rect } = resolveSolid3dMeshAndRect(object);
  if (roundSolidPresets.has(presetId) || !mesh) return null;
  const solidState = readSolid3dState(object.meta);
  const view = solidState.view;
  let bestMatch: { sectionId: string; vertexIndex: number; distance: number } | null = null;
  for (const section of solidState.sections) {
    if (!section.visible) continue;
    const polygon3d = computeSectionPolygon(mesh, section).polygon;
    if (polygon3d.length < 3) continue;
    for (let vertexIndex = 0; vertexIndex < polygon3d.length; vertexIndex += 1) {
      const vertex = polygon3d[vertexIndex];
      const projected = projectSolidPointForObject({
        point: vertex,
        view,
        objectRect: rect,
      });
      const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
      if (distance > 11) continue;
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = {
          sectionId: section.id,
          vertexIndex,
          distance,
        };
      }
    }
  }
  return bestMatch
    ? {
        sectionId: bestMatch.sectionId,
        vertexIndex: bestMatch.vertexIndex,
      }
    : null;
};

export const resolveSolid3dSectionAtPointer = (
  sourceObject: WorkbookBoardObject,
  point: WorkbookPoint,
  previewMetaById: Solid3dPreviewMetaById
) => {
  if (sourceObject.type !== "solid3d") return null;
  const object = resolveSolid3dRenderSource(sourceObject, previewMetaById);
  const { mesh, rect } = resolveSolid3dMeshAndRect(object);
  if (!mesh) return null;
  const solidState = readSolid3dState(object.meta);
  const view = solidState.view;
  let bestSectionId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  solidState.sections.forEach((section) => {
    if (!section.visible) return;
    const polygon3d = computeSectionPolygon(mesh, section).polygon;
    if (polygon3d.length < 2) return;
    const polygon2d = polygon3d.map((p3d) =>
      projectSolidPointForObject({
        point: p3d,
        view,
        objectRect: rect,
      })
    );
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < polygon2d.length; index += 1) {
      const a = polygon2d[index];
      const b = polygon2d[(index + 1) % polygon2d.length];
      const edgeDistance = distanceToSegment(point, a, b);
      if (edgeDistance < distance) distance = edgeDistance;
    }
    if (polygon2d.length >= 3 && pointInPolygon(point, polygon2d)) {
      distance = 0;
    }
    if (distance <= 12 && distance < bestDistance) {
      bestDistance = distance;
      bestSectionId = section.id;
    }
  });
  return bestSectionId;
};
