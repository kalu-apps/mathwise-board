import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { WorkbookBoardObject, WorkbookPoint } from "../model/types";
import type { FunctionGraphPlot } from "../model/functionGraph";
import type { PreparedFunctionGraphRenderState } from "../model/sceneRender";
import type { WorkbookPageFrameBounds } from "../model/pageFrame";
import { resolveBoardObjectImageAssetId } from "../model/scene";
import {
  isWorkbookAssetContentUrl,
  normalizeWorkbookAssetContentUrl,
} from "../model/workbookAssetUrl";
import {
  resolveWorkbookImageCropProjection,
  resolveWorkbookImageCropState,
} from "../model/imageCrop";
import {
  buildAngleArcPath,
  buildRightAngleMarkerPath,
  clampUnitDot,
  createPolygonPath,
  getLineBasis,
  getLinePathD,
  getPointObjectCenter,
  getPointsCentroid,
  is2dFigureClosed,
  resolve2dFigureVertexLabels,
  resolve2dFigureVertices,
  resolveOutsideVertexLabelPlacement,
  get2dFigureSegments,
} from "../model/sceneGeometry";
import { normalizeShapeAngleMarks, resolveRenderedShapeAngleMarkStyle } from "../model/shapeAngleMarks";
import { toPath } from "../model/stroke";
import {
  WORKBOOK_BOARD_PRIMARY_COLOR,
  WORKBOOK_SELECTION_HELPER_COLOR,
  WORKBOOK_SHAPE_FILL_SOFT,
  WORKBOOK_SYSTEM_COLORS,
  WORKBOOK_TEXT_FALLBACK_COLOR,
} from "../model/workbookVisualColors";
import { WORKBOOK_VERTEX_LABEL_FONT_SIZE } from "../model/vertexLabelDefaults";

type PrimaryObjectRendererParams = {
  object: WorkbookBoardObject;
  normalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  transform: string | undefined;
  commonProps: {
    stroke: string;
    strokeWidth: number;
    fill: string;
    opacity: number;
    "data-object-id": string;
  };
  imageAssetUrls: Record<string, string>;
  inlineTextEdit: {
    objectId: string;
    value: string;
  } | null;
  setInlineTextEdit: Dispatch<
    SetStateAction<{
      objectId: string;
      value: string;
    } | null>
  >;
  cancelInlineTextEdit: () => void;
  inlineTextEditInputRef: RefObject<HTMLTextAreaElement | null>;
  onInlineTextDraftChange?: (objectId: string, text: string) => void;
  commitInlineTextEdit: () => void;
  functionGraphRenderStateById: Map<string, PreparedFunctionGraphRenderState>;
  pageFrameBounds: WorkbookPageFrameBounds;
};

export type WorkbookPrimaryRenderedObjectParts = {
  maskedObject: ReactNode;
  unmaskedOverlay?: ReactNode | null;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const clampVertexLabelPlacementToPage = (params: {
  placement: { x: number; y: number; textAnchor: "start" | "end" | "middle" };
  label: string;
  pageFrameBounds: WorkbookPageFrameBounds;
}) => {
  const { placement, label, pageFrameBounds } = params;
  const padding = 10;
  const fontSize = WORKBOOK_VERTEX_LABEL_FONT_SIZE;
  const approxWidth = Math.max(fontSize, Math.max(1, label.length) * fontSize * 0.62);
  const halfHeight = fontSize * 0.58;
  const minY = pageFrameBounds.minY + padding + halfHeight;
  const maxY = pageFrameBounds.maxY - padding - halfHeight;
  const minX = pageFrameBounds.minX + padding;
  const maxX = pageFrameBounds.maxX - padding;
  const y = clampNumber(placement.y, minY, maxY);
  let textAnchor: "start" | "end" | "middle" = placement.textAnchor;
  if (textAnchor === "start" && placement.x + approxWidth > maxX) {
    textAnchor = "end";
  } else if (textAnchor === "end" && placement.x - approxWidth < minX) {
    textAnchor = "start";
  }
  let x = placement.x;
  if (textAnchor === "start") {
    x = clampNumber(x, minX, maxX - approxWidth);
  } else if (textAnchor === "end") {
    x = clampNumber(x, minX + approxWidth, maxX);
  } else {
    const halfWidth = approxWidth / 2;
    x = clampNumber(x, minX + halfWidth, maxX - halfWidth);
  }
  return { x, y, textAnchor };
};

export const renderWorkbookCanvasPrimaryObject = ({
  object,
  normalized,
  transform,
  commonProps,
  imageAssetUrls,
  inlineTextEdit,
  setInlineTextEdit,
  cancelInlineTextEdit,
  inlineTextEditInputRef,
  onInlineTextDraftChange,
  commitInlineTextEdit,
  functionGraphRenderStateById,
  pageFrameBounds,
}: PrimaryObjectRendererParams): ReactNode | WorkbookPrimaryRenderedObjectParts | null => {
    const WORKBOOK_RENDER_COLORS = {
      primary: WORKBOOK_BOARD_PRIMARY_COLOR,
      warning: WORKBOOK_SELECTION_HELPER_COLOR,
      white: WORKBOOK_SYSTEM_COLORS.white,
      text: WORKBOOK_TEXT_FALLBACK_COLOR,
      softFill: WORKBOOK_SHAPE_FILL_SOFT,
      softStroke: "rgba(248, 251, 255, 0.92)",
      warningFillSoft: "rgba(255, 244, 163, 0.92)",
      lightSurfaceFill: "rgba(238, 243, 248, 0.94)",
      primaryFillSoft: "rgba(47, 79, 127, 0.14)",
    } as const;
    const render2dFigureVertexLabels = (vertices: WorkbookPoint[]) => {
      if (vertices.length < 2) return null;
      const showLabels = object.meta?.showLabels !== false;
      if (!showLabels) return null;
      const labels = resolve2dFigureVertexLabels(object, vertices.length);
      const figureCenter = getPointsCentroid(vertices);
      const labelPlacements = vertices.map((vertex) =>
        resolveOutsideVertexLabelPlacement({
          vertex,
          center: figureCenter,
          polygon: is2dFigureClosed(object) ? vertices : [],
          baseOffset: 14,
        })
      );
      const safeLabelPlacements = labelPlacements.map((placement, index) =>
        clampVertexLabelPlacementToPage({
          placement,
          label: labels[index] ?? "",
          pageFrameBounds,
        })
      );
      const vertexColorsRaw = Array.isArray(object.meta?.vertexColors)
        ? object.meta.vertexColors
        : [];
      return (
        <>
          {vertices.map((vertex, index) => {
            const vertexColor =
              typeof vertexColorsRaw[index] === "string" && vertexColorsRaw[index]
                ? vertexColorsRaw[index]
                : object.color ?? WORKBOOK_RENDER_COLORS.primary;
            return (
              <text
                key={`${object.id}-vertex-label-detached-${index}`}
                x={safeLabelPlacements[index]?.x ?? vertex.x + 4}
                y={safeLabelPlacements[index]?.y ?? vertex.y - 4}
                fill={vertexColor}
                fontSize={WORKBOOK_VERTEX_LABEL_FONT_SIZE}
                fontWeight={700}
                textAnchor={safeLabelPlacements[index]?.textAnchor ?? "start"}
                dominantBaseline="central"
                paintOrder="stroke"
                stroke={WORKBOOK_RENDER_COLORS.softStroke}
                strokeWidth={2}
                strokeLinejoin="round"
              >
                {labels[index]}
              </text>
            );
          })}
        </>
      );
    };

    const render2dFigureOverlay = (vertices: WorkbookPoint[]) => {
      if (vertices.length < 2) return null;
      const showAngles = Boolean(object.meta?.showAngles);
      const isClosed = is2dFigureClosed(object);
      const segments = get2dFigureSegments(vertices, isClosed);
      const angleMarks = normalizeShapeAngleMarks(
        object,
        vertices.length,
        object.color ?? WORKBOOK_RENDER_COLORS.primary
      );
      const vertexColorsRaw = Array.isArray(object.meta?.vertexColors)
        ? object.meta.vertexColors
        : [];
      const segmentNotesRaw = Array.isArray(object.meta?.segmentNotes)
        ? object.meta.segmentNotes
        : [];
      const segmentColorsRaw = Array.isArray(object.meta?.segmentColors)
        ? object.meta.segmentColors
        : [];
      const segmentDash =
        object.meta?.lineStyle === "dashed" ? `${Math.max(4, (object.strokeWidth ?? 2) * 2.2)} ${Math.max(3, (object.strokeWidth ?? 2) * 1.8)}` : undefined;
      return (
        <>
          {segments.map((segment, index) => {
            const segmentColor =
              typeof segmentColorsRaw[index] === "string" && segmentColorsRaw[index]
                ? segmentColorsRaw[index]
                : object.color ?? WORKBOOK_RENDER_COLORS.primary;
            return (
              <line
                key={`${object.id}-segment-color-${index}`}
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke={segmentColor}
                strokeWidth={Math.max(1, (object.strokeWidth ?? 2) * 0.92)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={segmentDash}
                opacity={0.98}
              />
            );
          })}
          {vertices.map((vertex, index) => (
            <g key={`${object.id}-vertex-label-${index}`}>
              {(() => {
                const vertexColor =
                  typeof vertexColorsRaw[index] === "string" && vertexColorsRaw[index]
                    ? vertexColorsRaw[index]
                    : object.color ?? WORKBOOK_RENDER_COLORS.primary;
                return (
                  <>
                    <circle
                      cx={vertex.x}
                      cy={vertex.y}
                      r={1.9}
                      fill={WORKBOOK_RENDER_COLORS.white}
                      stroke={vertexColor}
                      strokeWidth={1}
                    />
                  </>
                );
              })()}
            </g>
          ))}
          {segments.map((segment, index) => {
            const note =
              typeof segmentNotesRaw[index] === "string" ? segmentNotesRaw[index].trim() : "";
            if (!note) return null;
            const dx = segment.end.x - segment.start.x;
            const dy = segment.end.y - segment.start.y;
            const length = Math.hypot(dx, dy);
            if (length < 1e-6) return null;
            const normal = { x: -dy / length, y: dx / length };
            const midpoint = {
              x: (segment.start.x + segment.end.x) / 2,
              y: (segment.start.y + segment.end.y) / 2,
            };
            const segmentColor =
              typeof segmentColorsRaw[index] === "string" && segmentColorsRaw[index]
                ? segmentColorsRaw[index]
                : object.color ?? WORKBOOK_RENDER_COLORS.primary;
            return (
              <text
                key={`${object.id}-segment-note-${index}`}
                x={midpoint.x + normal.x * 10}
                y={midpoint.y + normal.y * 10}
                fill={segmentColor}
                fontSize={10}
                fontWeight={600}
                textAnchor="middle"
              >
                {note}
              </text>
            );
          })}
          {showAngles && isClosed && vertices.length >= 3
            ? vertices.map((vertex, index) => {
                const previous = vertices[(index + vertices.length - 1) % vertices.length];
                const next = vertices[(index + 1) % vertices.length];
                const vecA = { x: previous.x - vertex.x, y: previous.y - vertex.y };
                const vecB = { x: next.x - vertex.x, y: next.y - vertex.y };
                const lenA = Math.hypot(vecA.x, vecA.y);
                const lenB = Math.hypot(vecB.x, vecB.y);
                if (lenA < 1e-6 || lenB < 1e-6) return null;
                const unitA = { x: vecA.x / lenA, y: vecA.y / lenA };
                const unitB = { x: vecB.x / lenB, y: vecB.y / lenB };
                const radius = Math.max(8, Math.min(22, Math.min(lenA, lenB) * 0.22));
                const sweep: 0 | 1 =
                  unitA.x * unitB.y - unitA.y * unitB.x > 0 ? 1 : 0;
                const dot = clampUnitDot(unitA.x * unitB.x + unitA.y * unitB.y);
                const angleDeg = (Math.acos(dot) * 180) / Math.PI;
                const angleMark = angleMarks[index] ?? {
                  valueText: "",
                  color: object.color ?? WORKBOOK_RENDER_COLORS.primary,
                  style: "auto" as const,
                };
                const renderedStyle = resolveRenderedShapeAngleMarkStyle(
                  angleMark.style,
                  angleDeg
                );
                const note = angleMark.valueText.trim();
                const angleColor = angleMark.color || object.color || WORKBOOK_RENDER_COLORS.primary;
                const bisector = { x: unitA.x + unitB.x, y: unitA.y + unitB.y };
                const bisectorLength = Math.hypot(bisector.x, bisector.y);
                const labelDirection =
                  bisectorLength > 1e-6
                    ? { x: bisector.x / bisectorLength, y: bisector.y / bisectorLength }
                    : { x: -(unitA.y + unitB.y) * 0.5, y: (unitA.x + unitB.x) * 0.5 };
                const arcCount =
                  renderedStyle === "arc_double"
                    ? 2
                    : renderedStyle === "arc_triple"
                      ? 3
                      : renderedStyle === "arc_single"
                        ? 1
                        : 0;
                const rightSquareSize = Math.max(7, Math.min(15, radius * 0.72));
                const markerDepth =
                  renderedStyle === "right_square"
                    ? rightSquareSize + 2
                    : radius + Math.max(0, arcCount - 1) * 4;
                const noteAnchor = {
                  x: vertex.x + labelDirection.x * (markerDepth + 11),
                  y: vertex.y + labelDirection.y * (markerDepth + 11),
                };
                return (
                  <g key={`${object.id}-angle-${index}`}>
                    {renderedStyle === "right_square" ? (
                      <path
                        d={buildRightAngleMarkerPath(
                          vertex,
                          unitA,
                          unitB,
                          rightSquareSize
                        )}
                        fill="none"
                        stroke={angleColor}
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        opacity={0.9}
                      />
                    ) : (
                      Array.from({ length: arcCount }, (_, arcIndex) => {
                        const arcRadius = radius + arcIndex * 4;
                        return (
                          <path
                            key={`${object.id}-angle-${index}-arc-${arcRadius}`}
                            d={buildAngleArcPath(vertex, unitA, unitB, arcRadius, sweep)}
                            fill="none"
                            stroke={angleColor}
                            strokeWidth={1.2}
                            opacity={0.88}
                          />
                        );
                      })
                    )}
                    {note ? (
                      <text
                        x={noteAnchor.x}
                        y={noteAnchor.y}
                        fill={angleColor}
                        fontSize={10}
                        fontWeight={600}
                        textAnchor="middle"
                      >
                        {(() => {
                          const normalized = note.replace("°", "").replace(",", ".").trim();
                          const isNumeric = /^-?\d+(\.\d+)?$/.test(normalized);
                          if (!isNumeric) return note;
                          return (
                            <>
                              <tspan>{normalized}</tspan>
                              <tspan baselineShift="super" fontSize="8">
                                °
                              </tspan>
                            </>
                          );
                        })()}
                      </text>
                    ) : null}
                  </g>
                );
              })
            : null}
        </>
      );
    };

    if (object.type === "line" || object.type === "arrow") {
      const lineStyleMeta =
        typeof object.meta?.lineStyle === "string" ? object.meta.lineStyle : "solid";
      const lineKind = object.meta?.lineKind === "segment" ? "segment" : "line";
      const showLabels = object.meta?.showLabels !== false;
      const startLabel =
        typeof object.meta?.startLabel === "string" ? object.meta.startLabel.trim() : "";
      const endLabel =
        typeof object.meta?.endLabel === "string" ? object.meta.endLabel.trim() : "";
      const basis = getLineBasis(object);
      const labelOffset = 14;
      return (
        <g>
          <path
            {...commonProps}
            d={getLinePathD(object)}
            markerEnd={object.type === "arrow" ? "url(#workbook-arrow)" : undefined}
            strokeDasharray={lineStyleMeta === "dashed" ? "8 6" : undefined}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {lineKind === "segment" && showLabels && startLabel ? (
            <text
              x={basis.start.x + basis.normal.x * labelOffset}
              y={basis.start.y + basis.normal.y * labelOffset}
              fill={object.color ?? WORKBOOK_RENDER_COLORS.primary}
              fontSize={WORKBOOK_VERTEX_LABEL_FONT_SIZE}
              fontWeight={600}
              paintOrder="stroke"
              stroke={WORKBOOK_RENDER_COLORS.softStroke}
              strokeWidth={2}
              strokeLinejoin="round"
            >
              {startLabel}
            </text>
          ) : null}
          {lineKind === "segment" && showLabels && endLabel ? (
            <text
              x={basis.end.x + basis.normal.x * labelOffset}
              y={basis.end.y + basis.normal.y * labelOffset}
              fill={object.color ?? WORKBOOK_RENDER_COLORS.primary}
              fontSize={WORKBOOK_VERTEX_LABEL_FONT_SIZE}
              fontWeight={600}
              paintOrder="stroke"
              stroke={WORKBOOK_RENDER_COLORS.softStroke}
              strokeWidth={2}
              strokeLinejoin="round"
            >
              {endLabel}
            </text>
          ) : null}
        </g>
      );
    }

    if (object.type === "point") {
      const center = getPointObjectCenter(object);
      const label =
        typeof object.meta?.label === "string" ? object.meta.label.trim() : "";
      const showLabels = object.meta?.showLabels !== false;
      return (
        <g>
          <circle
            cx={center.x}
            cy={center.y}
            r={Math.max(2.8, Math.min(7, Math.abs(object.width) * 0.33))}
            fill={object.fill ?? WORKBOOK_RENDER_COLORS.white}
            stroke={object.color ?? WORKBOOK_RENDER_COLORS.primary}
            strokeWidth={Math.max(1, object.strokeWidth ?? 2)}
          />
          {showLabels && label ? (
            <text
              x={center.x + 6}
              y={center.y - 6}
              fill={object.color ?? WORKBOOK_RENDER_COLORS.primary}
              fontSize={WORKBOOK_VERTEX_LABEL_FONT_SIZE}
              fontWeight={700}
              paintOrder="stroke"
              stroke={WORKBOOK_RENDER_COLORS.softStroke}
              strokeWidth={2}
              strokeLinejoin="round"
            >
              {label}
            </text>
          ) : null}
        </g>
      );
    }

    if (object.type === "section_divider") {
      const isAuto = object.meta?.dividerType === "auto";
      const dividerLineStyle =
        object.meta?.lineStyle === "solid" ? "solid" : "dashed";
      const label =
        typeof object.meta?.sectionLabel === "string" ? object.meta.sectionLabel : "";
      const y = normalized.y + normalized.height / 2;
      return (
        <g>
          <line
            x1={object.x}
            y1={y}
            x2={object.x + object.width}
            y2={y}
            stroke={isAuto ? "rgba(95, 111, 134, 0.68)" : (object.color ?? WORKBOOK_RENDER_COLORS.primary)}
            strokeWidth={isAuto ? 1.1 : (object.strokeWidth ?? 1.6)}
            strokeDasharray={isAuto ? "5 5" : dividerLineStyle === "dashed" ? "9 6" : undefined}
            opacity={0.8}
          />
          {label ? (
            <text
              x={object.x + 10}
              y={y - 8}
              fill="#5a6486"
              fontSize={11}
              fontWeight={600}
            >
              {label}
            </text>
          ) : null}
        </g>
      );
    }

    if (object.type === "rectangle") {
      const vertices = resolve2dFigureVertices(object, normalized);
      return {
        maskedObject: (
          <g transform={transform}>
            <rect
              {...commonProps}
              x={normalized.x}
              y={normalized.y}
              width={normalized.width}
              height={normalized.height}
              rx={0}
              ry={0}
            />
            {render2dFigureOverlay(vertices)}
          </g>
        ),
        unmaskedOverlay: (
          <g transform={transform}>
            {render2dFigureVertexLabels(vertices)}
          </g>
        ),
      };
    }

    if (object.type === "ellipse") {
      return (
        <ellipse
          {...commonProps}
          cx={normalized.x + normalized.width / 2}
          cy={normalized.y + normalized.height / 2}
          rx={normalized.width / 2}
          ry={normalized.height / 2}
          transform={transform}
        />
      );
    }

    if (object.type === "triangle") {
      const vertices = resolve2dFigureVertices(object, normalized);
      const path = `M ${normalized.x + normalized.width / 2} ${normalized.y} L ${
        normalized.x
      } ${normalized.y + normalized.height} L ${normalized.x + normalized.width} ${
        normalized.y + normalized.height
      } Z`;
      return {
        maskedObject: (
          <g transform={transform}>
            <path {...commonProps} d={path} />
            {render2dFigureOverlay(vertices)}
          </g>
        ),
        unmaskedOverlay: (
          <g transform={transform}>
            {render2dFigureVertexLabels(vertices)}
          </g>
        ),
      };
    }

    if (object.type === "polygon") {
      const vertices = resolve2dFigureVertices(object, normalized);
      const isClosed = is2dFigureClosed(object);
      const objectPreset =
        object.meta?.polygonPreset === "trapezoid" ||
        object.meta?.polygonPreset === "trapezoid_right" ||
        object.meta?.polygonPreset === "trapezoid_scalene" ||
        object.meta?.polygonPreset === "rhombus"
          ? object.meta.polygonPreset
          : "regular";
      if (Array.isArray(object.points) && object.points.length >= 2) {
        return {
          maskedObject: (
            <g transform={transform}>
              <path {...commonProps} d={`${toPath(object.points)}${isClosed ? " Z" : ""}`} />
              {render2dFigureOverlay(vertices)}
            </g>
          ),
          unmaskedOverlay: (
            <g transform={transform}>
              {render2dFigureVertexLabels(vertices)}
            </g>
          ),
        };
      }
      return {
        maskedObject: (
          <g transform={transform}>
            <path
              {...commonProps}
              d={createPolygonPath(normalized, object.sides ?? 5, objectPreset)}
            />
            {render2dFigureOverlay(vertices)}
          </g>
        ),
        unmaskedOverlay: (
          <g transform={transform}>
            {render2dFigureVertexLabels(vertices)}
          </g>
        ),
      };
    }

    if (object.type === "text") {
      const fontSize = Math.max(12, object.fontSize ?? 18);
      const textColor =
        typeof object.meta?.textColor === "string" && object.meta.textColor
          ? object.meta.textColor
          : object.color ?? WORKBOOK_RENDER_COLORS.text;
      const fontFamily =
        typeof object.meta?.textFontFamily === "string" && object.meta.textFontFamily
          ? object.meta.textFontFamily
          : "\"Fira Sans\", \"Segoe UI\", sans-serif";
      const fontWeight = object.meta?.textBold ? 700 : 500;
      const fontStyle = object.meta?.textItalic ? "italic" : "normal";
      const textDecoration = object.meta?.textUnderline ? "underline" : "none";
      const textAlign =
        object.meta?.textAlign === "center" || object.meta?.textAlign === "right"
          ? object.meta.textAlign
          : "left";
      const textContent = typeof object.text === "string" ? object.text : "Текст";
      const backgroundFill =
        typeof object.meta?.textBackground === "string" && object.meta.textBackground
          ? object.meta.textBackground
          : object.fill;
      const isInlineEditing = inlineTextEdit?.objectId === object.id;
      return (
        <g transform={transform}>
          {backgroundFill && backgroundFill !== "transparent" ? (
            <rect
              x={normalized.x}
              y={normalized.y}
              width={normalized.width}
              height={normalized.height}
              rx={6}
              ry={6}
              fill={backgroundFill}
              stroke="none"
            />
          ) : null}
          {isInlineEditing ? (
            <foreignObject
              x={normalized.x}
              y={normalized.y}
              width={Math.max(140, normalized.width)}
              height={Math.max(48, normalized.height)}
              requiredExtensions="http://www.w3.org/1999/xhtml"
            >
              <div
                className="workbook-session__text-editor"
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <textarea
                  ref={inlineTextEditInputRef}
                  className="workbook-session__text-editor-input"
                  value={inlineTextEdit?.value ?? ""}
                  onChange={(event) =>
                    {
                      const nextValue = event.target.value;
                      setInlineTextEdit((current) =>
                        current && current.objectId === object.id
                          ? { ...current, value: nextValue }
                          : current
                      );
                      onInlineTextDraftChange?.(object.id, nextValue);
                    }
                  }
                  onBlur={() => commitInlineTextEdit()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelInlineTextEdit();
                      return;
                    }
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      commitInlineTextEdit();
                    }
                  }}
                  style={{
                    color: textColor,
                    fontSize: `${fontSize}px`,
                    fontFamily,
                    fontWeight,
                    fontStyle,
                    textDecoration,
                    textAlign,
                    background:
                      backgroundFill && backgroundFill !== "transparent"
                        ? backgroundFill
                        : "transparent",
                  }}
                />
              </div>
            </foreignObject>
          ) : (
            <foreignObject
              x={normalized.x + 6}
              y={normalized.y + 6}
              width={Math.max(1, normalized.width - 12)}
              height={Math.max(1, normalized.height - 12)}
              requiredExtensions="http://www.w3.org/1999/xhtml"
              pointerEvents="none"
            >
              <div
                className="workbook-session__text-render"
                style={{
                  color: textColor,
                  fontSize: `${fontSize}px`,
                  fontFamily,
                  fontWeight,
                  fontStyle,
                  textDecoration,
                  textAlign,
                }}
              >
                {textContent}
              </div>
            </foreignObject>
          )}
        </g>
      );
    }

    if (object.type === "formula") {
      const latex = typeof object.meta?.latex === "string" ? object.meta.latex : "";
      const mathml = typeof object.meta?.mathml === "string" ? object.meta.mathml : "";
      const shown = latex || mathml || object.text || "f(x)=...";
      return (
        <g>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={Math.max(38, normalized.height)}
            rx={8}
            ry={8}
            fill="rgba(238, 243, 248, 0.9)"
            stroke={object.color ?? WORKBOOK_RENDER_COLORS.primary}
            strokeWidth={object.strokeWidth ?? 2}
          />
          <text
            x={normalized.x + 10}
            y={normalized.y + 24}
            fill={object.color ?? WORKBOOK_RENDER_COLORS.primary}
            fontSize={Math.max(14, object.fontSize ?? 18)}
            fontWeight={700}
          >
            {shown}
          </text>
        </g>
      );
    }

    if (object.type === "function_graph") {
      const renderState = functionGraphRenderStateById.get(object.id);
      if (!renderState) return null;
      const { axisColor, planeColor, centerX, centerY, ghostPlots, plots } = renderState;
      const lines: ReactNode[] = [];
      const labels: ReactNode[] = [];

      lines.push(
        <line
          key={`fn-axis-x-${object.id}`}
          x1={normalized.x}
          y1={centerY}
          x2={normalized.x + normalized.width}
          y2={centerY}
          stroke={axisColor}
          strokeWidth={1.35}
        />
      );
      lines.push(
        <line
          key={`fn-axis-y-${object.id}`}
          x1={centerX}
          y1={normalized.y}
          x2={centerX}
          y2={normalized.y + normalized.height}
          stroke={axisColor}
          strokeWidth={1.35}
        />
      );
      labels.push(
        <text
          key={`fn-label-axis-x-${object.id}`}
          x={normalized.x + normalized.width - 14}
          y={centerY - 6}
          fill={axisColor}
          fontSize={11}
          fontWeight={700}
        >
          x
        </text>
      );
      labels.push(
        <text
          key={`fn-label-axis-y-${object.id}`}
          x={centerX + 6}
          y={normalized.y + 12}
          fill={axisColor}
          fontSize={11}
          fontWeight={700}
        >
          y
        </text>
      );
      return (
        <g transform={transform}>
          <defs>
            <clipPath id={`fn-clip-${object.id}`}>
              <rect
                x={normalized.x}
                y={normalized.y}
                width={normalized.width}
                height={normalized.height}
              />
            </clipPath>
          </defs>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            fill={planeColor}
            fillOpacity={planeColor === "transparent" ? 0 : 0.14}
            stroke="none"
            strokeWidth={0}
          />
          <g clipPath={`url(#fn-clip-${object.id})`}>
            {lines}
            {labels}
            {ghostPlots.flatMap((plot: FunctionGraphPlot) =>
              plot.segments.map((segment: WorkbookPoint[], segmentIndex: number) =>
                segment.length > 1 ? (
                  <path
                    key={`${object.id}-graph-ghost-${plot.id}-${segmentIndex}`}
                    d={toPath(segment)}
                    stroke={plot.color}
                    strokeWidth={Math.max(1, plot.width * 0.9)}
                    strokeDasharray="7 5"
                    strokeOpacity={0.24}
                    fill="none"
                  />
                ) : null
              )
            )}
            {plots.flatMap((plot: FunctionGraphPlot) =>
              plot.segments.map((segment: WorkbookPoint[], segmentIndex: number) =>
                segment.length > 1 ? (
                  <path
                    key={`${object.id}-graph-${plot.id}-${segmentIndex}`}
                    d={toPath(segment)}
                    stroke={plot.color}
                    strokeWidth={plot.width}
                    strokeDasharray={plot.dashed ? "8 6" : undefined}
                    fill="none"
                  />
                ) : null
              )
            )}
          </g>
        </g>
      );
    }

    if (object.type === "frame") {
      const title =
        typeof object.meta?.title === "string" && object.meta.title.trim().length > 0
          ? object.meta.title
          : "Фрейм";
      return (
        <g transform={transform}>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            rx={12}
            ry={12}
            fill={object.fill ?? WORKBOOK_RENDER_COLORS.softFill}
            stroke={object.color ?? WORKBOOK_RENDER_COLORS.primary}
            strokeWidth={object.strokeWidth ?? 2}
            strokeDasharray="10 6"
          />
          <rect
            x={normalized.x + 8}
            y={normalized.y + 8}
            width={Math.min(normalized.width - 16, 180)}
            height={24}
            rx={8}
            ry={8}
            fill={WORKBOOK_RENDER_COLORS.primaryFillSoft}
            stroke="none"
          />
          <text
            x={normalized.x + 16}
            y={normalized.y + 24}
            fill={WORKBOOK_RENDER_COLORS.primary}
            fontSize={12}
            fontWeight={700}
          >
            {title}
          </text>
        </g>
      );
    }

    if (object.type === "sticker") {
      const text =
        typeof object.text === "string" && object.text.trim().length > 0
          ? object.text
          : "Стикер";
      return (
        <g transform={transform}>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            rx={10}
            ry={10}
            fill={object.fill ?? WORKBOOK_RENDER_COLORS.warningFillSoft}
            stroke={object.color ?? WORKBOOK_RENDER_COLORS.warning}
            strokeWidth={object.strokeWidth ?? 1.8}
          />
          <text
            x={normalized.x + 10}
            y={normalized.y + 24}
            fill="#6d4a24"
            fontSize={13}
            fontWeight={600}
          >
            {text}
          </text>
        </g>
      );
    }

    if (object.type === "comment") {
      const text =
        typeof object.text === "string" && object.text.trim().length > 0
          ? object.text
          : "Комментарий";
      return (
        <g transform={transform}>
          <rect
            x={normalized.x}
            y={normalized.y}
            width={normalized.width}
            height={normalized.height}
            rx={12}
            ry={12}
            fill={object.fill ?? WORKBOOK_RENDER_COLORS.lightSurfaceFill}
            stroke={object.color ?? WORKBOOK_RENDER_COLORS.primary}
            strokeWidth={object.strokeWidth ?? 1.8}
          />
          <path
            d={`M ${normalized.x + 24} ${normalized.y + normalized.height} L ${
              normalized.x + 36
            } ${normalized.y + normalized.height + 14} L ${normalized.x + 48} ${
              normalized.y + normalized.height
            } Z`}
            fill={object.fill ?? WORKBOOK_RENDER_COLORS.lightSurfaceFill}
            stroke={object.color ?? WORKBOOK_RENDER_COLORS.primary}
            strokeWidth={object.strokeWidth ?? 1.4}
          />
          <text
            x={normalized.x + 10}
            y={normalized.y + 22}
            fill={WORKBOOK_RENDER_COLORS.primary}
            fontSize={13}
            fontWeight={600}
          >
            {text}
          </text>
        </g>
      );
    }

    const imageSource =
      object.type === "image"
        ? (() => {
            const normalizedObjectImageUrl =
              typeof object.imageUrl === "string"
                ? normalizeWorkbookAssetContentUrl(object.imageUrl)
                : undefined;
            if (
              typeof normalizedObjectImageUrl === "string" &&
              normalizedObjectImageUrl.trim().length > 0 &&
              (normalizedObjectImageUrl.startsWith("data:") ||
                isWorkbookAssetContentUrl(normalizedObjectImageUrl))
            ) {
              return normalizedObjectImageUrl;
            }
            const assetId = resolveBoardObjectImageAssetId(object);
            return assetId ? imageAssetUrls[assetId] : undefined;
          })()
        : undefined;
    if (object.type === "image" && imageSource) {
      const cropState = resolveWorkbookImageCropState(object);
      if (cropState.hasCrop && cropState.crop) {
        const safeObjectId = object.id.replace(/[^a-zA-Z0-9_-]/g, "-");
        const clipPathId = `workbook-image-crop-${safeObjectId}`;
        const projection = resolveWorkbookImageCropProjection({
          frame: normalized,
          crop: cropState.crop,
        });
        return (
          <g transform={transform}>
            <defs>
              <clipPath id={clipPathId}>
                <rect
                  x={normalized.x}
                  y={normalized.y}
                  width={normalized.width}
                  height={normalized.height}
                />
              </clipPath>
            </defs>
            <image
              href={imageSource}
              x={projection.x}
              y={projection.y}
              width={projection.width}
              height={projection.height}
              preserveAspectRatio="none"
              clipPath={`url(#${clipPathId})`}
              opacity={object.opacity ?? 1}
            />
          </g>
        );
      }
      return (
        <image
          href={imageSource}
          x={normalized.x}
          y={normalized.y}
          width={normalized.width}
          height={normalized.height}
          preserveAspectRatio="none"
          opacity={object.opacity ?? 1}
          transform={transform}
        />
      );
    }


  return null;
};
