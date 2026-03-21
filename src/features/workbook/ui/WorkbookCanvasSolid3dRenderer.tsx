import type { ReactNode } from "react";
import type { WorkbookBoardObject } from "../model/types";
import { resolveSolid3dPresetId } from "../model/solid3d";
import { readSolid3dState } from "../model/solid3dState";
import type { ProjectedSolidVertex } from "../model/solid3dGeometry";
import {
  computeSectionPolygon,
  getSolid3dMesh,
  projectSolidPointForObject,
  projectSolidVerticesForObject,
} from "../model/solid3dGeometry";
import {
  buildAngleArcPath,
  buildRightAngleMarkerPath,
  clampUnitDot,
  clipPolygonByHalfPlane,
  getPointsCentroid,
  resolveOutsideVertexLabelPlacement,
} from "../model/sceneGeometry";
import { resolveRenderedShapeAngleMarkStyle } from "../model/shapeAngleMarks";
import { toPath } from "../model/stroke";

type Solid3dObjectRendererParams = {
  object: WorkbookBoardObject;
  normalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  transform: string | undefined;
  isRoundSolidPreset: (presetId: string) => boolean;
  summarizeProjectedVertices: (
    projectedVertexByIndex: Map<number, ProjectedSolidVertex>,
    indices: number[]
  ) => {
    points: ProjectedSolidVertex[];
    center: { x: number; y: number };
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    rx: number;
    ry: number;
  } | null;
  getSectionVertexLabel: (index: number) => string;
};

export const renderWorkbookCanvasSolid3dObject = ({
  object,
  normalized,
  transform,
  isRoundSolidPreset,
  summarizeProjectedVertices,
  getSectionVertexLabel,
}: Solid3dObjectRendererParams): ReactNode | null => {
  if (object.type === "solid3d") {
    const presetIdRaw =
      typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
    const presetId = resolveSolid3dPresetId(presetIdRaw);
    const isRoundPreset = isRoundSolidPreset(presetId);
    const color = object.color ?? "#4f63ff";
    const strokeWidth = object.strokeWidth ?? 2;
    const solidState = readSolid3dState(object.meta);
    const hiddenFaceSet = new Set(solidState.hiddenFaceIds);
    const clipScale =
      solidState.clippingPreset === "small"
        ? 0.82
        : solidState.clippingPreset === "medium"
          ? 0.68
          : solidState.clippingPreset === "large"
            ? 0.54
            : 1;
    const hideHiddenEdges = solidState.hiddenFaceIds.includes("hidden_edges");
    const faceColors = solidState.faceColors ?? {};
    const edgeColors = solidState.edgeColors ?? {};
    const angleMarks = Array.isArray(solidState.angleMarks)
      ? solidState.angleMarks.filter((mark) => mark.visible !== false)
      : [];
    const pad = Math.max(6, Math.min(normalized.width, normalized.height) * 0.08);
    const contentX = normalized.x + pad;
    const contentY = normalized.y + pad;
    const contentWidth = Math.max(1, normalized.width - pad * 2);
    const contentHeight = Math.max(1, normalized.height - pad * 2);
    const view = solidState.view;
    const mesh = getSolid3dMesh(presetId, normalized.width, normalized.height);
    const projectedVertices = mesh
      ? projectSolidVerticesForObject({
          mesh,
          view,
          objectRect: normalized,
        })
      : [];
    const projectedBounds =
      projectedVertices.length > 0
        ? projectedVertices.reduce(
            (acc, vertex) => ({
              minX: Math.min(acc.minX, vertex.x),
              maxX: Math.max(acc.maxX, vertex.x),
              minY: Math.min(acc.minY, vertex.y),
              maxY: Math.max(acc.maxY, vertex.y),
            }),
            {
              minX: projectedVertices[0].x,
              maxX: projectedVertices[0].x,
              minY: projectedVertices[0].y,
              maxY: projectedVertices[0].y,
            }
          )
        : null;

    type SolidFaceRender = {
      index: number;
      points: ProjectedSolidVertex[];
      depth: number;
      isFront: boolean;
    };

    const faceRenderData: SolidFaceRender[] = mesh
      ? mesh.faces.reduce<SolidFaceRender[]>((acc, face, index) => {
          if (face.length < 3) return acc;
          if (hiddenFaceSet.has(`face-${index}`)) return acc;
          const points = face
            .map((vertexIndex) => projectedVertices[vertexIndex])
            .filter((vertex): vertex is ProjectedSolidVertex => Boolean(vertex));
          if (points.length < 3) return acc;
          const depth =
            points.reduce((sum, point) => sum + point.depth, 0) / points.length;
          const signedArea = points.reduce((sum, point, pointIndex) => {
            const next = points[(pointIndex + 1) % points.length];
            return sum + point.x * next.y - next.x * point.y;
          }, 0);
          acc.push({
            index,
            points,
            depth,
            isFront: signedArea <= 0,
          });
          return acc;
        }, [])
      : [];
    faceRenderData.sort((left, right) => right.depth - left.depth);
    const faceDepthRange = faceRenderData.reduce(
      (acc, face) => ({
        min: Math.min(acc.min, face.depth),
        max: Math.max(acc.max, face.depth),
      }),
      { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
    );
    const depthSpan =
      Number.isFinite(faceDepthRange.min) &&
      Number.isFinite(faceDepthRange.max) &&
      faceDepthRange.max > faceDepthRange.min
        ? faceDepthRange.max - faceDepthRange.min
        : 1;

    const visibleFaceIds = new Set(
      faceRenderData
        .filter((face) => face.isFront)
        .map((face) => face.index)
    );

    type SolidEdgeRender = {
      key: string;
      from: ProjectedSolidVertex;
      to: ProjectedSolidVertex;
      depth: number;
      dashed: boolean;
    };

    const edgeRenderData: SolidEdgeRender[] =
      mesh && projectedVertices.length > 0
        ? (() => {
            const edgeFaces = new Map<string, number[]>();
            mesh.faces.forEach((face, faceIndex) => {
              if (hiddenFaceSet.has(`face-${faceIndex}`) || face.length < 2) return;
              face.forEach((fromIndex, localIndex) => {
                const toIndex = face[(localIndex + 1) % face.length];
                const min = Math.min(fromIndex, toIndex);
                const max = Math.max(fromIndex, toIndex);
                const key = `${min}:${max}`;
                const bucket = edgeFaces.get(key);
                if (!bucket) {
                  edgeFaces.set(key, [faceIndex]);
                } else if (!bucket.includes(faceIndex)) {
                  bucket.push(faceIndex);
                }
              });
            });

            const edges = [...edgeFaces.entries()].reduce<SolidEdgeRender[]>(
              (acc, [key, faces]) => {
                const [fromRaw, toRaw] = key.split(":");
                const fromIndex = Number(fromRaw);
                const toIndex = Number(toRaw);
                if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
                  return acc;
                }
                const from = projectedVertices[fromIndex];
                const to = projectedVertices[toIndex];
                if (!from || !to) return acc;
                const frontFaceCount = faces.reduce(
                  (sum, faceIndex) => sum + (visibleFaceIds.has(faceIndex) ? 1 : 0),
                  0
                );
                const isFront = frontFaceCount > 0;
                if (isRoundPreset) {
                  const isSilhouette = frontFaceCount > 0 && frontFaceCount < faces.length;
                  if (!isSilhouette) return acc;
                } else if (!isFront && hideHiddenEdges) {
                  return acc;
                }
                acc.push({
                  key,
                  from,
                  to,
                  depth: (from.depth + to.depth) / 2,
                  dashed: isRoundPreset ? false : !isFront,
                });
                return acc;
              },
              []
            );
            edges.sort((left, right) => right.depth - left.depth);
            return edges;
          })()
        : [];

    const sectionPolygons = mesh
      ? solidState.sections
          .filter((section) => section.visible)
          .map((section) => {
            const sectionData = computeSectionPolygon(mesh, section);
            const points = sectionData.polygon.map((point) =>
              projectSolidPointForObject({
                point,
                view,
                objectRect: normalized,
              })
            );
            return {
              section,
              points,
            };
          })
          .filter((item) => item.points.length >= 2)
      : [];

    const sectionPolygonsById = new Map(
      sectionPolygons.map((polygon) => [polygon.section.id, polygon])
    );

    const visibleSectionMarkers = !isRoundPreset
      ? sectionPolygons.flatMap((polygon) => {
          if (polygon.points.length < 3) return [];
          const polygon2d = polygon.points.map((point) => ({ x: point.x, y: point.y }));
          const sectionCenter = getPointsCentroid(polygon2d);
          return polygon.points.map((point, index) => ({
            sectionId: polygon.section.id,
            index,
            x: point.x,
            y: point.y,
            color: polygon.section.color,
            label:
              polygon.section.vertexLabels[index]?.trim() || getSectionVertexLabel(index),
            placement: resolveOutsideVertexLabelPlacement({
              vertex: { x: point.x, y: point.y },
              center: sectionCenter,
              polygon: polygon2d,
              baseOffset: 14,
            }),
          }));
        })
      : [];

    const sectionLines = solidState.sections
      .filter((section) => section.visible)
      .map((section) => {
        const polygon = sectionPolygonsById.get(section.id);
        if (polygon && polygon.points.length >= 2) {
          const center = polygon.points.reduce(
            (acc, point) => ({
              x: acc.x + point.x,
              y: acc.y + point.y,
            }),
            { x: 0, y: 0 }
          );
          center.x /= polygon.points.length;
          center.y /= polygon.points.length;
          const first = polygon.points[0];
          const second = polygon.points[1];
          const tangentRaw = {
            x: second.x - first.x,
            y: second.y - first.y,
          };
          const tangentLength = Math.hypot(tangentRaw.x, tangentRaw.y) || 1;
          const tangent = {
            x: tangentRaw.x / tangentLength,
            y: tangentRaw.y / tangentLength,
          };
          const normal = {
            x: -tangent.y,
            y: tangent.x,
          };
          const half = Math.max(contentWidth, contentHeight) * 0.78;
          return {
            section,
            center,
            normal,
            from: {
              x: center.x - tangent.x * half,
              y: center.y - tangent.y * half,
            },
            to: {
              x: center.x + tangent.x * half,
              y: center.y + tangent.y * half,
            },
            hasPolygon: polygon.points.length >= 3,
          };
        }

        const tiltRad = ((section.tiltY + view.rotationY) * Math.PI) / 180;
        const normal = {
          x: Math.cos(tiltRad),
          y: Math.sin(tiltRad),
        };
        const center = {
          x: contentX + contentWidth * (0.5 + view.panX * 0.25 + section.offset * 0.5),
          y: contentY + contentHeight * (0.5 + view.panY * 0.25),
        };
        const tangent = { x: -normal.y, y: normal.x };
        const half = Math.max(contentWidth, contentHeight) * 0.78;
        return {
          section,
          normal,
          center,
          from: {
            x: center.x - tangent.x * half,
            y: center.y - tangent.y * half,
          },
          to: {
            x: center.x + tangent.x * half,
            y: center.y + tangent.y * half,
          },
          hasPolygon: false,
        };
      });

    const keepSection = sectionLines.find((item) => item.section.keepSide !== "both");
    const keepPolygon =
      keepSection && keepSection.section.keepSide !== "both"
        ? clipPolygonByHalfPlane(
            [
              { x: contentX, y: contentY },
              { x: contentX + contentWidth, y: contentY },
              { x: contentX + contentWidth, y: contentY + contentHeight },
              { x: contentX, y: contentY + contentHeight },
            ],
            keepSection.center,
            keepSection.normal,
            keepSection.section.keepSide === "negative"
          )
        : null;
    const clipRect =
      clipScale < 1
        ? {
            x: contentX + (contentWidth * (1 - clipScale)) / 2,
            y: contentY + (contentHeight * (1 - clipScale)) / 2,
            width: contentWidth * clipScale,
            height: contentHeight * clipScale,
          }
        : null;
    const clipPathId = `workbook-solid-clip-${object.id}`;
    const keepPolygonPoints =
      keepPolygon && keepPolygon.length >= 3
        ? keepPolygon.map((point) => `${point.x},${point.y}`).join(" ")
        : "";
    const shouldUseClipPath = Boolean(clipRect || keepPolygonPoints);
    const measurementLabels = solidState.measurements.filter((measurement) => measurement.visible);
    const faceFill = object.fill ?? "rgba(95, 106, 160, 0.16)";
    const vertexLabels = solidState.vertexLabels ?? [];
    const showVertexLabels =
      object.meta?.showLabels !== false && (!isRoundPreset || presetId === "cone");
    const solidLabelCenter = projectedBounds
      ? {
          x: (projectedBounds.minX + projectedBounds.maxX) / 2,
          y: (projectedBounds.minY + projectedBounds.maxY) / 2,
        }
      : {
          x: contentX + contentWidth / 2,
          y: contentY + contentHeight / 2,
        };
    const vertexAdjacency = mesh
      ? mesh.edges.reduce<Map<number, number[]>>((acc, [a, b]) => {
          const neighboursA = acc.get(a) ?? [];
          if (!neighboursA.includes(b)) {
            neighboursA.push(b);
            acc.set(a, neighboursA);
          }
          const neighboursB = acc.get(b) ?? [];
          if (!neighboursB.includes(a)) {
            neighboursB.push(a);
            acc.set(b, neighboursB);
          }
          return acc;
        }, new Map<number, number[]>())
      : new Map<number, number[]>();
    const projectedVertexByIndex = new Map(
      projectedVertices.map((vertex) => [vertex.index, vertex] as const)
    );
    const roundRingVertexCount =
      isRoundPreset && mesh
        ? presetId === "cone"
          ? Math.max(0, mesh.vertices.length - 1)
          : presetId === "cylinder" || presetId === "truncated_cone"
            ? Math.max(0, Math.floor(mesh.vertices.length / 2))
            : 0
        : 0;
    const roundBottomStats =
      roundRingVertexCount > 0
        ? summarizeProjectedVertices(
            projectedVertexByIndex,
            Array.from({ length: roundRingVertexCount }, (_, index) => index)
          )
        : null;
    const roundTopStats =
      roundRingVertexCount > 0 &&
      mesh &&
      (presetId === "cylinder" || presetId === "truncated_cone")
        ? summarizeProjectedVertices(
            projectedVertexByIndex,
            Array.from({ length: roundRingVertexCount }, (_, index) => index + roundRingVertexCount)
          )
        : null;
    const roundConeApex =
      presetId === "cone" && mesh ? projectedVertexByIndex.get(mesh.vertices.length - 1) ?? null : null;
    const visibleVertexIndices = (() => {
      if (!projectedVertices.length) return [] as number[];
      if (isRoundPreset) {
        if (presetId === "cone" && mesh && mesh.vertices.length > 0) {
          return [mesh.vertices.length - 1];
        }
        return [] as number[];
      }
      return projectedVertices.map((vertex) => vertex.index);
    })();

    const vertexLabelPlacements = new Map(
      visibleVertexIndices
        .map((vertexIndex) => {
          const vertex = projectedVertexByIndex.get(vertexIndex);
          if (!vertex) return null;
          return [
            vertexIndex,
            resolveOutsideVertexLabelPlacement({
              vertex: { x: vertex.x, y: vertex.y },
              center: solidLabelCenter,
              baseOffset: 14,
            }),
          ] as const;
        })
        .filter(
          (
            entry
          ): entry is readonly [
            number,
            ReturnType<typeof resolveOutsideVertexLabelPlacement>,
          ] => Boolean(entry)
        )
    );

    const angleMarkRenderData = angleMarks
      .map((mark) => {
        const center = projectedVertexByIndex.get(mark.vertexIndex);
        if (!center) return null;
        const activeFaceIndex =
          typeof mark.faceIndex === "number" &&
          Number.isInteger(mark.faceIndex) &&
          mark.faceIndex >= 0 &&
          mesh?.faces[mark.faceIndex]
            ? mark.faceIndex
            : null;
        const faceVertices =
          activeFaceIndex !== null && mesh ? mesh.faces[activeFaceIndex] : null;
        const faceVertexIndex =
          faceVertices?.findIndex((vertexIndex: number) => vertexIndex === mark.vertexIndex) ??
          -1;
        const neighbours =
          faceVertices && faceVertexIndex >= 0 && faceVertices.length >= 3
            ? [
                faceVertices[
                  (faceVertexIndex - 1 + faceVertices.length) % faceVertices.length
                ],
                faceVertices[(faceVertexIndex + 1) % faceVertices.length],
              ]
            : vertexAdjacency.get(mark.vertexIndex) ?? [];
        if (neighbours.length < 2) return null;
        const first = projectedVertexByIndex.get(neighbours[0]);
        const second = projectedVertexByIndex.get(neighbours[1]);
        if (!first || !second) return null;
        const toUnit = (from: ProjectedSolidVertex, to: ProjectedSolidVertex) => {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy);
          if (len < 1e-6) return null;
          return {
            x: dx / len,
            y: dy / len,
          };
        };
        const dirA = toUnit(center, first);
        const dirB = toUnit(center, second);
        if (!dirA || !dirB) return null;
        const dot = clampUnitDot(dirA.x * dirB.x + dirA.y * dirB.y);
        const angleDeg = (Math.acos(dot) * 180) / Math.PI;
        const renderedStyle = resolveRenderedShapeAngleMarkStyle(mark.style ?? "auto", angleDeg);
        const arcCount =
          renderedStyle === "arc_double"
            ? 2
            : renderedStyle === "arc_triple"
              ? 3
              : renderedStyle === "arc_single"
                ? 1
                : 0;
        const radius = Math.max(8, Math.min(20, Math.min(first.depth, second.depth) * 0.3 + 10));
        const sweep: 0 | 1 = dirA.x * dirB.y - dirA.y * dirB.x > 0 ? 1 : 0;
        const bisectorRaw = {
          x: dirA.x + dirB.x,
          y: dirA.y + dirB.y,
        };
        const bisectorLen = Math.hypot(bisectorRaw.x, bisectorRaw.y);
        const labelVector =
          bisectorLen > 1e-6
            ? {
                x: bisectorRaw.x / bisectorLen,
                y: bisectorRaw.y / bisectorLen,
              }
            : {
                x: -(dirA.y + dirB.y) * 0.5,
                y: (dirA.x + dirB.x) * 0.5,
              };
        const rightSquareSize = Math.max(6, Math.min(15, radius * 0.72));
        const markerDepth =
          renderedStyle === "right_square"
            ? rightSquareSize + 2
            : radius + Math.max(0, arcCount - 1) * 4;
        const label = typeof mark.label === "string" ? mark.label.trim() : "";
        return {
          id: mark.id,
          color: mark.color || "#ff8e3c",
          center,
          dirA,
          dirB,
          sweep: sweep as 0 | 1,
          arcCount,
          radius,
          renderedStyle,
          rightSquareSize,
          label,
          labelX: center.x + labelVector.x * (markerDepth + 10),
          labelY: center.y + labelVector.y * (markerDepth + 10),
        };
      })
      .filter(
        (entry): entry is {
          id: string;
          color: string;
          center: ProjectedSolidVertex;
          dirA: { x: number; y: number };
          dirB: { x: number; y: number };
          sweep: 0 | 1;
          arcCount: number;
          radius: number;
          renderedStyle: "right_square" | "arc_single" | "arc_double" | "arc_triple";
          rightSquareSize: number;
          label: string;
          labelX: number;
          labelY: number;
        } => Boolean(entry)
      );

    const roundBodyNode = (() => {
      if (!isRoundPreset) return null;
      const center = projectedBounds
        ? {
            x: (projectedBounds.minX + projectedBounds.maxX) / 2,
            y: (projectedBounds.minY + projectedBounds.maxY) / 2,
          }
        : {
            x: contentX + contentWidth / 2,
            y: contentY + contentHeight / 2,
          };
      const baseRx = Math.max(
        12,
        projectedBounds ? (projectedBounds.maxX - projectedBounds.minX) / 2 : contentWidth * 0.34
      );
      const baseRy = Math.max(
        12,
        projectedBounds ? (projectedBounds.maxY - projectedBounds.minY) / 2 : contentHeight * 0.34
      );
      const ellipseDepth = Math.max(
        4,
        baseRy * (0.14 + Math.abs(Math.sin((view.rotationX * Math.PI) / 180)) * 0.1)
      );
      const lineColor = color;
      const fillColor = object.fill ?? "rgba(95, 106, 160, 0.16)";
      const frontDash = hideHiddenEdges ? undefined : "7 5";

      const ellipseFrontPath = (cx: number, cy: number, rx: number, ry: number) =>
        `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
      const ellipseBackPath = (cx: number, cy: number, rx: number, ry: number) =>
        `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;

      if (presetId === "sphere") {
        const sphereRx = baseRx;
        const sphereRy = baseRy;
        const equatorRy = Math.max(
          4,
          sphereRy * (0.22 + Math.abs(Math.sin((view.rotationX * Math.PI) / 180)) * 0.1)
        );
        const meridianRx = Math.max(
          4,
          sphereRx * (0.22 + Math.abs(Math.sin((view.rotationY * Math.PI) / 180)) * 0.08)
        );
        return (
          <g>
            <ellipse
              cx={center.x}
              cy={center.y}
              rx={sphereRx}
              ry={sphereRy}
              fill={fillColor}
              fillOpacity={0.86}
              stroke={lineColor}
              strokeWidth={strokeWidth}
            />
            {!hideHiddenEdges ? (
              <path
                d={ellipseBackPath(center.x, center.y, sphereRx, equatorRy)}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.8)}
                strokeDasharray="6 5"
                opacity={0.58}
              />
            ) : null}
            <path
              d={ellipseFrontPath(center.x, center.y, sphereRx, equatorRy)}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.82)}
              opacity={0.9}
            />
            {!hideHiddenEdges ? (
              <path
                d={`M ${center.x} ${center.y - sphereRy} A ${meridianRx} ${sphereRy} 0 0 1 ${center.x} ${center.y + sphereRy}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.68)}
                strokeDasharray="6 5"
                opacity={0.5}
              />
            ) : null}
            <path
              d={`M ${center.x} ${center.y - sphereRy} A ${meridianRx} ${sphereRy} 0 0 0 ${center.x} ${center.y + sphereRy}`}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.7)}
              opacity={0.66}
            />
          </g>
        );
      }

      if (presetId === "hemisphere") {
        const radius = Math.min(baseRx, baseRy);
        const domeTop = center.y - radius;
        const baseY = center.y + radius * 0.36;
        const baseEllipseRy = Math.max(4, ellipseDepth);
        return (
          <g>
            <path
              d={`M ${center.x - radius} ${baseY} A ${radius} ${radius} 0 0 1 ${center.x + radius} ${baseY} L ${center.x + radius} ${baseY} L ${center.x - radius} ${baseY} Z`}
              fill={fillColor}
              fillOpacity={0.86}
              stroke={lineColor}
              strokeWidth={strokeWidth}
            />
            {!hideHiddenEdges ? (
              <path
                d={ellipseBackPath(center.x, baseY, radius, baseEllipseRy)}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.78)}
                strokeDasharray="6 5"
                opacity={0.56}
              />
            ) : null}
            <path
              d={ellipseFrontPath(center.x, baseY, radius, baseEllipseRy)}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.82)}
              opacity={0.88}
            />
            <path
              d={`M ${center.x - radius} ${baseY} Q ${center.x} ${domeTop} ${center.x + radius} ${baseY}`}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.74)}
              opacity={0.56}
            />
            {!hideHiddenEdges ? (
              <line
                x1={center.x}
                y1={domeTop}
                x2={center.x}
                y2={baseY}
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.64)}
                strokeDasharray="6 5"
                opacity={0.46}
              />
            ) : null}
          </g>
        );
      }

      if (presetId === "torus") {
        const outerRx = Math.max(16, baseRx);
        const outerRy = Math.max(11, baseRy * 0.78);
        const tilt = Math.abs(Math.sin((view.rotationX * Math.PI) / 180));
        const holeRx = Math.max(7, outerRx * (0.44 - tilt * 0.06));
        const holeRy = Math.max(4, outerRy * (0.36 + tilt * 0.14));
        const donutPath = [
          `M ${center.x - outerRx} ${center.y}`,
          `A ${outerRx} ${outerRy} 0 1 0 ${center.x + outerRx} ${center.y}`,
          `A ${outerRx} ${outerRy} 0 1 0 ${center.x - outerRx} ${center.y}`,
          `M ${center.x - holeRx} ${center.y}`,
          `A ${holeRx} ${holeRy} 0 1 1 ${center.x + holeRx} ${center.y}`,
          `A ${holeRx} ${holeRy} 0 1 1 ${center.x - holeRx} ${center.y}`,
        ].join(" ");
        return (
          <g>
            <path
              d={donutPath}
              fill={fillColor}
              fillOpacity={0.86}
              fillRule="evenodd"
              stroke={lineColor}
              strokeWidth={strokeWidth}
            />
            {!hideHiddenEdges ? (
              <>
                <path
                  d={ellipseBackPath(center.x, center.y, outerRx, outerRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.74)}
                  strokeDasharray="6 5"
                  opacity={0.52}
                />
                <path
                  d={ellipseBackPath(center.x, center.y, holeRx, holeRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.72)}
                  strokeDasharray="5 4"
                  opacity={0.5}
                />
              </>
            ) : null}
            <path
              d={ellipseFrontPath(center.x, center.y, outerRx, outerRy)}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.82)}
              opacity={0.9}
            />
            <path
              d={ellipseFrontPath(center.x, center.y, holeRx, holeRy)}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.8)}
              opacity={0.88}
            />
            {!hideHiddenEdges ? (
              <line
                x1={center.x - outerRx}
                y1={center.y}
                x2={center.x + outerRx}
                y2={center.y}
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.62)}
                strokeDasharray="6 5"
                opacity={0.44}
              />
            ) : null}
          </g>
        );
      }

      if (presetId === "cone") {
        const apex = roundConeApex ?? {
          x: center.x,
          y: center.y - baseRy,
          depth: 0,
          index: -1,
        };
        const bottom = roundBottomStats;
        if (!bottom) return null;
        const bottomRy = Math.max(4, ellipseDepth);
        const apexDx = apex.x - bottom.center.x;
        const apexDy = apex.y - bottom.center.y;
        const apexDistance = Math.hypot(apexDx, apexDy);
        const minVisualApexOffset = Math.max(18, bottomRy * 1.9);
        const normalizedApex = apexDistance > 1e-3
          ? { x: apexDx / apexDistance, y: apexDy / apexDistance }
          : { x: 0, y: -1 };
        const visualApex =
          apexDistance >= minVisualApexOffset
            ? apex
            : {
                ...apex,
                x: bottom.center.x + normalizedApex.x * minVisualApexOffset * 0.34,
                y: bottom.center.y + normalizedApex.y * minVisualApexOffset,
              };
        const topViewBlend = Math.max(
          0,
          Math.min(1, 1 - apexDistance / Math.max(1, bottom.rx * 0.82 + bottomRy * 0.82))
        );
        const leftCtrl = {
          x: (visualApex.x + bottom.minX) * 0.5 - bottom.rx * (0.08 + topViewBlend * 0.05),
          y:
            (visualApex.y + bottom.center.y) * 0.5 -
            Math.max(10, bottomRy * (0.42 + topViewBlend * 0.18)),
        };
        const rightCtrl = {
          x: (visualApex.x + bottom.maxX) * 0.5 + bottom.rx * (0.08 + topViewBlend * 0.05),
          y:
            (visualApex.y + bottom.center.y) * 0.5 -
            Math.max(10, bottomRy * (0.42 + topViewBlend * 0.18)),
        };
        const midRingCenter = {
          x: visualApex.x + (bottom.center.x - visualApex.x) * 0.58,
          y: visualApex.y + (bottom.center.y - visualApex.y) * 0.58,
        };
        const midRingRx = Math.max(7, bottom.rx * (0.42 + topViewBlend * 0.08));
        const midRingRy = Math.max(3, bottomRy * (0.56 + topViewBlend * 0.1));
        const helperOpacity = 0.42 + topViewBlend * 0.18;
        return (
          <g>
            <path
              d={`M ${bottom.minX} ${bottom.center.y} A ${bottom.rx} ${bottomRy} 0 0 0 ${bottom.maxX} ${bottom.center.y} Q ${rightCtrl.x} ${rightCtrl.y} ${visualApex.x} ${visualApex.y} Q ${leftCtrl.x} ${leftCtrl.y} ${bottom.minX} ${bottom.center.y} Z`}
              fill={fillColor}
              fillOpacity={0.86}
              stroke={lineColor}
              strokeWidth={strokeWidth}
            />
            {!hideHiddenEdges ? (
              <path
                d={`M ${bottom.minX} ${bottom.center.y} A ${bottom.rx} ${bottomRy} 0 0 1 ${bottom.maxX} ${bottom.center.y}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.78)}
                strokeDasharray="6 5"
                opacity={0.56}
              />
            ) : null}
            <path
              d={`M ${bottom.minX} ${bottom.center.y} A ${bottom.rx} ${bottomRy} 0 0 0 ${bottom.maxX} ${bottom.center.y}`}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.82)}
              opacity={0.9}
            />
            <path
              d={`M ${visualApex.x} ${visualApex.y} Q ${leftCtrl.x} ${leftCtrl.y} ${bottom.minX} ${bottom.center.y}`}
              stroke={lineColor}
              fill="none"
              strokeWidth={Math.max(1, strokeWidth * 0.82)}
            />
            <path
              d={`M ${visualApex.x} ${visualApex.y} Q ${rightCtrl.x} ${rightCtrl.y} ${bottom.maxX} ${bottom.center.y}`}
              stroke={lineColor}
              fill="none"
              strokeWidth={Math.max(1, strokeWidth * 0.82)}
            />
            {!hideHiddenEdges ? (
              <>
                <path
                  d={ellipseBackPath(midRingCenter.x, midRingCenter.y, midRingRx, midRingRy)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.66)}
                  strokeDasharray="6 5"
                  opacity={helperOpacity}
                />
                <path
                  d={`M ${visualApex.x} ${visualApex.y} Q ${midRingCenter.x - midRingRx * 0.4} ${midRingCenter.y - midRingRy * 0.95} ${midRingCenter.x - midRingRx} ${midRingCenter.y}`}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.62)}
                  strokeDasharray="6 5"
                  opacity={helperOpacity}
                />
                <path
                  d={`M ${visualApex.x} ${visualApex.y} Q ${midRingCenter.x + midRingRx * 0.4} ${midRingCenter.y - midRingRy * 0.95} ${midRingCenter.x + midRingRx} ${midRingCenter.y}`}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.62)}
                  strokeDasharray="6 5"
                  opacity={helperOpacity}
                />
                <line
                  x1={visualApex.x}
                  y1={visualApex.y}
                  x2={bottom.center.x}
                  y2={bottom.center.y}
                  stroke={lineColor}
                  strokeWidth={Math.max(1, strokeWidth * 0.62)}
                  strokeDasharray="6 5"
                  opacity={0.45 + topViewBlend * 0.1}
                />
              </>
            ) : null}
            <path
              d={ellipseFrontPath(midRingCenter.x, midRingCenter.y, midRingRx, midRingRy)}
              fill="none"
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.7)}
              opacity={0.56 + topViewBlend * 0.08}
            />
          </g>
        );
      }

      const bottom = roundBottomStats;
      const top = roundTopStats;
      if (!bottom || !top) return null;
      const topRy = Math.max(4, ellipseDepth * 0.92);
      const bottomRy = Math.max(4, ellipseDepth);
      return (
        <g>
          <path
            d={`M ${top.minX} ${top.center.y} A ${top.rx} ${topRy} 0 0 0 ${top.maxX} ${top.center.y} L ${bottom.maxX} ${bottom.center.y} A ${bottom.rx} ${bottomRy} 0 0 1 ${bottom.minX} ${bottom.center.y} Z`}
            fill={fillColor}
            fillOpacity={0.86}
            stroke={lineColor}
            strokeWidth={strokeWidth}
          />
          {!hideHiddenEdges ? (
            <>
              <path
                d={`M ${bottom.minX} ${bottom.center.y} A ${bottom.rx} ${bottomRy} 0 0 1 ${bottom.maxX} ${bottom.center.y}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.78)}
                strokeDasharray={frontDash}
                opacity={0.56}
              />
              <path
                d={`M ${top.minX} ${top.center.y} A ${top.rx} ${topRy} 0 0 1 ${top.maxX} ${top.center.y}`}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, strokeWidth * 0.74)}
                strokeDasharray="5 4"
                opacity={0.5}
              />
            </>
          ) : null}
          <path
            d={`M ${bottom.minX} ${bottom.center.y} A ${bottom.rx} ${bottomRy} 0 0 0 ${bottom.maxX} ${bottom.center.y}`}
            fill="none"
            stroke={lineColor}
            strokeWidth={Math.max(1, strokeWidth * 0.82)}
            opacity={0.9}
          />
          <path
            d={`M ${top.minX} ${top.center.y} A ${top.rx} ${topRy} 0 0 0 ${top.maxX} ${top.center.y}`}
            fill="none"
            stroke={lineColor}
            strokeWidth={Math.max(1, strokeWidth * 0.8)}
            opacity={0.86}
          />
          <line
            x1={top.minX}
            y1={top.center.y}
            x2={bottom.minX}
            y2={bottom.center.y}
            stroke={lineColor}
            strokeWidth={Math.max(1, strokeWidth * 0.82)}
          />
          <line
            x1={top.maxX}
            y1={top.center.y}
            x2={bottom.maxX}
            y2={bottom.center.y}
            stroke={lineColor}
            strokeWidth={Math.max(1, strokeWidth * 0.82)}
          />
          {!hideHiddenEdges ? (
            <line
              x1={top.center.x}
              y1={top.center.y}
              x2={bottom.center.x}
              y2={bottom.center.y}
              stroke={lineColor}
              strokeWidth={Math.max(1, strokeWidth * 0.66)}
              strokeDasharray="6 5"
              opacity={0.48}
            />
          ) : null}
        </g>
      );
    })();

    return (
      <g>
        <defs>
          {shouldUseClipPath ? (
            <clipPath id={clipPathId}>
              {clipRect ? (
                <rect
                  x={clipRect.x}
                  y={clipRect.y}
                  width={clipRect.width}
                  height={clipRect.height}
                  rx={Math.min(18, clipRect.width * 0.12)}
                  ry={Math.min(18, clipRect.height * 0.12)}
                />
              ) : null}
              {keepPolygonPoints ? <polygon points={keepPolygonPoints} /> : null}
            </clipPath>
          ) : null}
        </defs>
        <g transform={transform} clipPath={shouldUseClipPath ? `url(#${clipPathId})` : undefined}>
          {isRoundPreset && roundBodyNode ? (
            roundBodyNode
          ) : faceRenderData.length > 0 ? (
            <>
              {faceRenderData.map((face) => {
                const fillColor = faceColors[String(face.index)] || faceFill;
                const depthWeight =
                  depthSpan > 0 ? (face.depth - faceDepthRange.min) / depthSpan : 0.5;
                const roundOpacity = Math.max(
                  0.22,
                  Math.min(0.92, 0.24 + depthWeight * 0.58 + (face.isFront ? 0.08 : 0))
                );
                return (
                  <path
                    key={`${object.id}-face-${face.index}`}
                    d={`${toPath(face.points)} Z`}
                    fill={fillColor}
                    fillOpacity={isRoundPreset ? roundOpacity : face.isFront ? 0.82 : 0.3}
                    stroke={isRoundPreset ? "none" : color}
                    strokeWidth={isRoundPreset ? 0 : strokeWidth * 0.78}
                  />
                );
              })}
              {edgeRenderData.map((edge) => (
                <line
                  key={`${object.id}-edge-${edge.key}`}
                  x1={edge.from.x}
                  y1={edge.from.y}
                  x2={edge.to.x}
                  y2={edge.to.y}
                  stroke={edgeColors[edge.key] || color}
                  strokeWidth={Math.max(1, strokeWidth * (isRoundPreset ? 0.62 : 0.76))}
                  strokeDasharray={edge.dashed ? "5 4" : undefined}
                  opacity={edge.dashed ? 0.62 : isRoundPreset ? 0.8 : 0.94}
                  strokeLinecap="round"
                />
              ))}
            </>
          ) : null}
          {angleMarkRenderData.map((mark) => (
            <g key={`${object.id}-angle-mark-${mark.id}`}>
              {mark.renderedStyle === "right_square" ? (
                <path
                  d={buildRightAngleMarkerPath(
                    { x: mark.center.x, y: mark.center.y },
                    mark.dirA,
                    mark.dirB,
                    mark.rightSquareSize
                  )}
                  fill="none"
                  stroke={mark.color}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              ) : (
                Array.from({ length: mark.arcCount }, (_, arcIndex) => {
                  const arcRadius = mark.radius + arcIndex * 4;
                  return (
                    <path
                      key={`${object.id}-angle-mark-${mark.id}-${arcRadius}`}
                      d={buildAngleArcPath(
                        { x: mark.center.x, y: mark.center.y },
                        mark.dirA,
                        mark.dirB,
                        arcRadius,
                        mark.sweep
                      )}
                      fill="none"
                      stroke={mark.color}
                      strokeWidth={1.25}
                      opacity={0.88}
                    />
                  );
                })
              )}
              {mark.label ? (
                <text
                  x={mark.labelX}
                  y={mark.labelY}
                  fill={mark.color}
                  fontSize={10}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {(() => {
                    const normalizedValue = mark.label.replace("°", "").replace(",", ".").trim();
                    const hasLabel = normalizedValue.length > 0;
                    if (!hasLabel) return null;
                    const isNumeric = /^-?\d+(\.\d+)?$/.test(normalizedValue);
                    if (!isNumeric) return mark.label;
                    return (
                      <>
                        <tspan>{normalizedValue}</tspan>
                        <tspan baselineShift="super" fontSize="8">
                          °
                        </tspan>
                      </>
                    );
                  })()}
                </text>
              ) : null}
            </g>
          ))}
          {sectionLines.map((line) => {
            const polygon = sectionPolygonsById.get(line.section.id);
            if (polygon && polygon.points.length >= 2) {
              const points = polygon.points.map((point) => `${point.x},${point.y}`).join(" ");
              return (
                <g key={`${object.id}-section-${line.section.id}`}>
                  {line.hasPolygon ? (
                    <polygon
                      points={points}
                      fill={`${line.section.color}22`}
                      stroke={line.section.color}
                      strokeWidth={line.section.thickness}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ) : (
                    <polyline
                      points={points}
                      fill="none"
                      stroke={line.section.color}
                      strokeWidth={line.section.thickness}
                      strokeDasharray="7 5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            }
            return line.hasPolygon ? null : (
              <line
                key={`${object.id}-section-${line.section.id}`}
                x1={line.from.x}
                y1={line.from.y}
                x2={line.to.x}
                y2={line.to.y}
                stroke={line.section.color}
                strokeWidth={line.section.thickness}
                strokeDasharray="7 5"
                strokeLinecap="round"
              />
            );
          })}
          {measurementLabels.length > 0 ? (
            <text
              x={contentX + 4}
              y={contentY + 14}
              fill="#42526f"
              fontSize={11}
              fontWeight={600}
            >
              {measurementLabels.slice(0, 3).map((measurement, index) => (
                <tspan
                  key={`${object.id}-measurement-${measurement.id}`}
                  x={contentX + 4}
                  dy={index === 0 ? 0 : 13}
                >
                  {measurement.label}
                </tspan>
              ))}
            </text>
          ) : null}
        </g>
        {visibleVertexIndices.map((vertexIndex) => {
          const vertex = projectedVertexByIndex.get(vertexIndex);
          if (!vertex) return null;
          const label =
            isRoundPreset && presetId === "cone" && mesh && vertexIndex === mesh.vertices.length - 1
              ? vertexLabels[vertexIndex] || "A"
              : vertexLabels[vertexIndex] || `V${vertexIndex + 1}`;
          const placement = vertexLabelPlacements.get(vertexIndex);
          return (
            <g key={`${object.id}-vertex-${vertex.index}`}>
              <circle
                cx={vertex.x}
                cy={vertex.y}
                r={isRoundPreset ? 2.2 : 2.8}
                fill="#ffffff"
                stroke={color}
                strokeWidth={1}
              />
              {showVertexLabels ? (
                <text
                  x={placement?.x ?? vertex.x + 4}
                  y={placement?.y ?? vertex.y - 4}
                  fill={color}
                  fontSize={isRoundPreset ? 8 : 8.5}
                  fontWeight={700}
                  textAnchor={placement?.textAnchor ?? "start"}
                  dominantBaseline="central"
                  paintOrder="stroke"
                  stroke="rgba(245, 247, 255, 0.94)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
        {visibleSectionMarkers.map((marker) => (
          <g key={`${object.id}-section-point-${marker.sectionId}-${marker.index}`}>
            <circle
              cx={marker.x}
              cy={marker.y}
              r={2.6}
              fill="#ffffff"
              stroke={marker.color}
              strokeWidth={1}
            />
            {object.meta?.showLabels !== false ? (
              <text
                x={marker.placement.x}
                y={marker.placement.y}
                fill={marker.color}
                fontSize={8.5}
                fontWeight={700}
                textAnchor={marker.placement.textAnchor}
                dominantBaseline="central"
                paintOrder="stroke"
                stroke="rgba(245, 247, 255, 0.94)"
                strokeWidth={2}
                strokeLinejoin="round"
              >
                {marker.label}
              </text>
            ) : null}
          </g>
        ))}
      </g>
    );
  }

  return null;
};
