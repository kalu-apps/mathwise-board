import { memo, useLayoutEffect, useRef } from "react";
import type {
  WorkbookBoardObject,
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTool,
} from "../model/types";
import type {
  WorkbookConstraintRenderSegment,
  WorkbookMaskedObjectSceneEntry,
} from "../model/sceneRender";
import { getAreaSelectionHandlePoints, type WorkbookAreaSelection } from "../model/sceneSelection";
import { createPolygonPath, normalizeRect } from "../model/sceneGeometry";
import type { WorkbookPolygonPreset } from "../model/shapeGeometry";
import {
  resolveWorkbookStrokeOpacity,
  resolveWorkbookStrokeSvgBlendMode,
} from "../model/strokeRenderStyle";
import { toPath, toSmoothPath } from "../model/stroke";
import {
  WORKBOOK_BOARD_PRIMARY_COLOR,
  WORKBOOK_SELECTION_HELPER_COLOR,
  WORKBOOK_SHAPE_FILL_SOFT,
  WORKBOOK_SYSTEM_COLORS,
} from "../model/workbookVisualColors";

export type WorkbookCanvasDividerLine = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const WORKBOOK_LAYER_COLORS = {
  autoDivider: "rgba(95, 111, 134, 0.68)",
  eraserFill: WORKBOOK_SHAPE_FILL_SOFT,
  primary: WORKBOOK_BOARD_PRIMARY_COLOR,
  warning: WORKBOOK_SELECTION_HELPER_COLOR,
  white: WORKBOOK_SYSTEM_COLORS.white,
  black: WORKBOOK_SYSTEM_COLORS.black,
} as const;

export const WorkbookAutoDividerLayer = memo(function WorkbookAutoDividerLayer({
  lines,
}: {
  lines: WorkbookCanvasDividerLine[];
}) {
  return (
    <>
      {lines.map((line) => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={WORKBOOK_LAYER_COLORS.autoDivider}
          strokeWidth={1}
          strokeDasharray="5 5"
          opacity={0.7}
        />
      ))}
    </>
  );
});

export const WorkbookStrokeLayer = memo(function WorkbookStrokeLayer({
  strokes,
  preview = false,
}: {
  strokes: WorkbookStroke[];
  preview?: boolean;
}) {
  return (
    <>
      {strokes.map((stroke) => (
        <path
          key={preview ? `preview-${stroke.id}` : stroke.id}
          d={toPath(stroke.points)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={
            stroke.tool === "highlighter"
              ? resolveWorkbookStrokeOpacity(stroke.tool)
              : preview
                ? 0.94
                : 1
          }
          style={{ mixBlendMode: resolveWorkbookStrokeSvgBlendMode(stroke.tool) }}
          pointerEvents={preview ? "none" : undefined}
        />
      ))}
    </>
  );
});

const syncStrokePathNode = (
  node: SVGPathElement,
  stroke: WorkbookStroke,
  preview: boolean
) => {
  node.setAttribute("d", toPath(stroke.points));
  node.setAttribute("stroke", stroke.color);
  node.setAttribute("stroke-width", String(stroke.width));
  node.setAttribute("stroke-linecap", "round");
  node.setAttribute("stroke-linejoin", "round");
  node.setAttribute("fill", "none");
  node.setAttribute(
    "opacity",
    String(
      stroke.tool === "highlighter"
        ? resolveWorkbookStrokeOpacity(stroke.tool)
        : preview
          ? 0.94
          : 1
    )
  );
  node.style.mixBlendMode = resolveWorkbookStrokeSvgBlendMode(stroke.tool);
  node.setAttribute("pointer-events", "none");
};

export const WorkbookPreviewStrokeRuntimeLayer = memo(function WorkbookPreviewStrokeRuntimeLayer({
  strokes,
}: {
  strokes: WorkbookStroke[];
}) {
  const groupRef = useRef<SVGGElement | null>(null);
  const nodesByStrokeIdRef = useRef<Map<string, SVGPathElement>>(new Map());
  const strokeSnapshotByIdRef = useRef<Map<string, WorkbookStroke>>(new Map());

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const nextIds = new Set(strokes.map((stroke) => stroke.id));
    nodesByStrokeIdRef.current.forEach((node, strokeId) => {
      if (nextIds.has(strokeId)) return;
      node.remove();
      nodesByStrokeIdRef.current.delete(strokeId);
      strokeSnapshotByIdRef.current.delete(strokeId);
    });

    let previousNode: SVGPathElement | null = null;
    strokes.forEach((stroke) => {
      let node = nodesByStrokeIdRef.current.get(stroke.id);
      if (!node) {
        node = document.createElementNS("http://www.w3.org/2000/svg", "path");
        nodesByStrokeIdRef.current.set(stroke.id, node);
      }
      if (node.parentNode !== group) {
        group.appendChild(node);
      }
      if (previousNode) {
        if (node.previousSibling !== previousNode) {
          group.insertBefore(node, previousNode.nextSibling);
        }
      } else if (group.firstChild !== node) {
        group.insertBefore(node, group.firstChild);
      }
      previousNode = node;

      const previousStrokeSnapshot = strokeSnapshotByIdRef.current.get(stroke.id);
      if (previousStrokeSnapshot !== stroke) {
        syncStrokePathNode(node, stroke, true);
        strokeSnapshotByIdRef.current.set(stroke.id, stroke);
      }
    });
  }, [strokes]);

  useLayoutEffect(
    () => () => {
      nodesByStrokeIdRef.current.forEach((node) => node.remove());
      nodesByStrokeIdRef.current.clear();
      strokeSnapshotByIdRef.current.clear();
    },
    []
  );

  return <g ref={groupRef} pointerEvents="none" />;
});

export const WorkbookPresenceLayer = memo(function WorkbookPresenceLayer({
  focusPoints,
  pointerPoints,
}: {
  focusPoints: WorkbookPoint[];
  pointerPoints: WorkbookPoint[];
}) {
  return (
    <>
      {focusPoints.map((focus, index) => (
        <g
          key={`focus-point-${Math.round(focus.x)}-${Math.round(focus.y)}-${index}`}
          className="workbook-session__focus-blink"
        >
          <circle cx={focus.x} cy={focus.y} r={18} />
          <line x1={focus.x - 8} y1={focus.y} x2={focus.x + 8} y2={focus.y} />
          <line x1={focus.x} y1={focus.y - 8} x2={focus.x} y2={focus.y + 8} />
        </g>
      ))}

      {pointerPoints.map((pointer, index) => (
        <g
          key={`laser-pointer-${Math.round(pointer.x)}-${Math.round(pointer.y)}-${index}`}
          className="workbook-session__teacher-pointer"
          transform={`translate(${pointer.x} ${pointer.y}) rotate(-22) scale(0.5)`}
        >
          <path
            className="workbook-session__teacher-pointer-shaft"
            d="M -82 -5 C -74 -8 -44 -9 -11 -7 L -11 7 C -44 9 -74 8 -82 5 Z"
          />
          <path
            className="workbook-session__teacher-pointer-tip"
            d="M -11 -7 L 13 0 L -11 7 Z"
          />
          <path
            className="workbook-session__teacher-pointer-accent"
            d="M -78 -2 C -58 -5 -33 -5 -13 -4"
          />
          <circle className="workbook-session__teacher-pointer-glow" cx={15} cy={0} r={7.4} />
          <circle className="workbook-session__teacher-pointer-point" cx={15} cy={0} r={3.4} />
        </g>
      ))}
    </>
  );
});

export const WorkbookObjectSceneLayer = memo(function WorkbookObjectSceneLayer({
  entries,
}: {
  entries: WorkbookMaskedObjectSceneEntry[];
}) {
  return (
    <>
      {entries.map((entry) => {
        if (
          entry.resolvedEraserCuts.length === 0 &&
          entry.maskPaths.length === 0 &&
          !entry.maskBounds
        ) {
          return <g key={entry.id}>{entry.renderedObject}</g>;
        }
        const safeMaskId = `workbook-object-mask-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        return (
          <g key={entry.id}>
            <defs>
              <mask
                id={safeMaskId}
                maskUnits="userSpaceOnUse"
                x={entry.maskBounds?.x ?? 0}
                y={entry.maskBounds?.y ?? 0}
                width={entry.maskBounds?.width ?? 1}
                height={entry.maskBounds?.height ?? 1}
              >
                <rect
                  x={entry.maskBounds?.x ?? 0}
                  y={entry.maskBounds?.y ?? 0}
                  width={entry.maskBounds?.width ?? 1}
                  height={entry.maskBounds?.height ?? 1}
                  fill={WORKBOOK_LAYER_COLORS.white}
                />
                {entry.resolvedEraserCuts.map((cut, index) => (
                  <circle
                    key={`${entry.id}-erase-cut-${index}`}
                    cx={cut.x}
                    cy={cut.y}
                    r={Math.max(1, cut.radius)}
                    fill={WORKBOOK_LAYER_COLORS.black}
                  />
                ))}
                {entry.maskPaths.map((path, index) => (
                  <path
                    key={`${entry.id}-erase-path-${index}`}
                    d={toSmoothPath(path.points)}
                    stroke={WORKBOOK_LAYER_COLORS.black}
                    strokeWidth={Math.max(1, path.radius * 2)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </mask>
            </defs>
            <g mask={`url(#${safeMaskId})`}>{entry.renderedObject}</g>
          </g>
        );
      })}
    </>
  );
});

export const WorkbookConstraintLayer = memo(function WorkbookConstraintLayer({
  segments,
  selectedConstraintId,
  tool,
  onSelectConstraint,
}: {
  segments: WorkbookConstraintRenderSegment[];
  selectedConstraintId: string | null;
  tool: WorkbookTool;
  onSelectConstraint: (constraintId: string) => void;
}) {
  const interactive = tool === "select";
  return (
    <>
      {segments.map((segment) => {
        const isActive = segment.constraint.id === selectedConstraintId;
        const midX = (segment.source.x + segment.target.x) / 2;
        const midY = (segment.source.y + segment.target.y) / 2;
        return (
          <g
            key={`constraint-${segment.constraint.id}`}
            className={`workbook-session__constraint-line ${isActive ? "is-active" : ""}`}
            onPointerDown={(event) => {
              if (!interactive) return;
              event.stopPropagation();
              onSelectConstraint(segment.constraint.id);
            }}
            style={{ pointerEvents: interactive ? "all" : "none" }}
          >
            <line
              x1={segment.source.x}
              y1={segment.source.y}
              x2={segment.target.x}
              y2={segment.target.y}
            />
            <text x={midX} y={midY}>
              {segment.label}
            </text>
          </g>
        );
      })}
    </>
  );
});

export const WorkbookDraftOverlayLayer = memo(function WorkbookDraftOverlayLayer({
  shapeDraft,
  tool,
  color,
  width,
  polygonMode,
  polygonPointDraft,
  polygonHoverPoint,
  polygonSides,
  polygonPreset,
  eraserCursorPoint,
  areaSelectionDraftRect,
  areaSelectionResizeRect,
}: {
  shapeDraft:
    | {
        tool:
          | "line"
          | "arrow"
          | "rectangle"
          | "ellipse"
          | "triangle"
          | "polygon"
          | "text"
          | "compass"
          | "formula"
          | "function_graph"
          | "frame"
          | "divider"
          | "sticker"
          | "comment"
          | "solid3d";
        start: WorkbookPoint;
        current: WorkbookPoint;
      }
    | null;
  tool: WorkbookTool;
  color: string;
  width: number;
  polygonMode: "regular" | "points";
  polygonPointDraft: WorkbookPoint[];
  polygonHoverPoint: WorkbookPoint | null;
  polygonSides: number;
  polygonPreset?: WorkbookPolygonPreset;
  eraserCursorPoint: WorkbookPoint | null;
  areaSelectionDraftRect: { x: number; y: number; width: number; height: number } | null;
  areaSelectionResizeRect: { x: number; y: number; width: number; height: number } | null;
}) {
  if (
    !shapeDraft &&
    !(tool === "polygon" && polygonMode === "points" && polygonPointDraft.length > 0) &&
    !(tool === "area_select" && areaSelectionDraftRect) &&
    !(tool === "select" && areaSelectionDraftRect) &&
    !(tool === "area_select" && areaSelectionResizeRect) &&
    !(tool === "eraser" && eraserCursorPoint)
  ) {
    return null;
  }

  return (
    <>
      {shapeDraft ? (
        <g className="workbook-session__draft-shape">
          {shapeDraft.tool === "line" || shapeDraft.tool === "arrow" ? (
            <line
              x1={shapeDraft.start.x}
              y1={shapeDraft.start.y}
              x2={shapeDraft.current.x}
              y2={shapeDraft.current.y}
              stroke={color}
              strokeWidth={Math.max(1, width)}
              strokeDasharray="6 4"
              markerEnd={shapeDraft.tool === "arrow" ? "url(#workbook-arrow)" : undefined}
            />
          ) : shapeDraft.tool === "divider" ? (
            <line
              x1={shapeDraft.start.x - 2000}
              y1={shapeDraft.start.y}
              x2={shapeDraft.start.x + 2000}
              y2={shapeDraft.start.y}
              stroke={color}
              strokeWidth={Math.max(1.2, width)}
              strokeDasharray="8 6"
            />
          ) : shapeDraft.tool === "ellipse" || shapeDraft.tool === "compass" ? (
            <ellipse
              cx={
                shapeDraft.tool === "compass"
                  ? shapeDraft.start.x
                  : (shapeDraft.start.x + shapeDraft.current.x) / 2
              }
              cy={
                shapeDraft.tool === "compass"
                  ? shapeDraft.start.y
                  : (shapeDraft.start.y + shapeDraft.current.y) / 2
              }
              rx={
                shapeDraft.tool === "compass"
                  ? Math.max(
                      1,
                      Math.hypot(
                        shapeDraft.current.x - shapeDraft.start.x,
                        shapeDraft.current.y - shapeDraft.start.y
                      )
                    )
                  : Math.max(1, Math.abs(shapeDraft.start.x - shapeDraft.current.x) / 2)
              }
              ry={
                shapeDraft.tool === "compass"
                  ? Math.max(
                      1,
                      Math.hypot(
                        shapeDraft.current.x - shapeDraft.start.x,
                        shapeDraft.current.y - shapeDraft.start.y
                      )
                    )
                  : Math.max(1, Math.abs(shapeDraft.start.y - shapeDraft.current.y) / 2)
              }
              stroke={color}
              strokeWidth={Math.max(1, width)}
              strokeDasharray="6 4"
              fill="none"
            />
          ) : shapeDraft.tool === "triangle" ? (
            <path
              d={`M ${(shapeDraft.start.x + shapeDraft.current.x) / 2} ${
                Math.min(shapeDraft.start.y, shapeDraft.current.y)
              } L ${Math.min(shapeDraft.start.x, shapeDraft.current.x)} ${
                Math.max(shapeDraft.start.y, shapeDraft.current.y)
              } L ${Math.max(shapeDraft.start.x, shapeDraft.current.x)} ${
                Math.max(shapeDraft.start.y, shapeDraft.current.y)
              } Z`}
              stroke={color}
              strokeWidth={Math.max(1, width)}
              strokeDasharray="6 4"
              fill="none"
            />
          ) : shapeDraft.tool === "polygon" ? (
            <path
              d={createPolygonPath(
                normalizeRect(shapeDraft.start, shapeDraft.current),
                polygonSides,
                polygonPreset
              )}
              stroke={color}
              strokeWidth={Math.max(1, width)}
              strokeDasharray="6 4"
              fill="none"
            />
          ) : (
            <rect
              x={Math.min(shapeDraft.start.x, shapeDraft.current.x)}
              y={Math.min(shapeDraft.start.y, shapeDraft.current.y)}
              width={Math.max(1, Math.abs(shapeDraft.start.x - shapeDraft.current.x))}
              height={Math.max(1, Math.abs(shapeDraft.start.y - shapeDraft.current.y))}
              rx={shapeDraft.tool === "text" ? 4 : 8}
              ry={shapeDraft.tool === "text" ? 4 : 8}
              stroke={color}
              strokeWidth={Math.max(1, width)}
              strokeDasharray="6 4"
              fill="none"
            />
          )}
        </g>
      ) : null}

      {tool === "polygon" && polygonMode === "points" && polygonPointDraft.length > 0 ? (
        <g className="workbook-session__draft-shape">
          <path
            d={toPath(
              polygonHoverPoint ? [...polygonPointDraft, polygonHoverPoint] : polygonPointDraft
            )}
            stroke={color}
            strokeWidth={Math.max(1, width)}
            strokeDasharray="6 4"
            fill="none"
          />
          {polygonPointDraft.map((point, index) => (
            <circle
              key={`poly-point-${index}-${point.x}-${point.y}`}
              cx={point.x}
              cy={point.y}
              r={2.5}
              fill={color}
            />
          ))}
        </g>
      ) : null}

      {tool === "eraser" && eraserCursorPoint ? (
        <g pointerEvents="none">
          <circle
            cx={eraserCursorPoint.x}
            cy={eraserCursorPoint.y}
            r={Math.max(4, width)}
            fill={WORKBOOK_LAYER_COLORS.eraserFill}
            stroke={WORKBOOK_LAYER_COLORS.primary}
            strokeWidth={1.1}
            strokeDasharray="5 4"
          />
          <circle cx={eraserCursorPoint.x} cy={eraserCursorPoint.y} r={1.5} fill={WORKBOOK_LAYER_COLORS.primary} />
        </g>
      ) : null}

      {tool === "area_select" && areaSelectionDraftRect ? (
        <rect
          x={areaSelectionDraftRect.x}
          y={areaSelectionDraftRect.y}
          width={areaSelectionDraftRect.width}
          height={areaSelectionDraftRect.height}
          fill="none"
          stroke={WORKBOOK_LAYER_COLORS.primary}
          strokeWidth={1.2}
          strokeDasharray="7 5"
        />
      ) : null}

      {tool === "select" && areaSelectionDraftRect ? (
        <rect
          x={areaSelectionDraftRect.x}
          y={areaSelectionDraftRect.y}
          width={areaSelectionDraftRect.width}
          height={areaSelectionDraftRect.height}
          fill="none"
          stroke={WORKBOOK_LAYER_COLORS.primary}
          strokeWidth={1.2}
          strokeDasharray="7 5"
        />
      ) : null}

      {tool === "area_select" && areaSelectionResizeRect ? (
        <rect
          x={areaSelectionResizeRect.x}
          y={areaSelectionResizeRect.y}
          width={areaSelectionResizeRect.width}
          height={areaSelectionResizeRect.height}
          fill="none"
          stroke={WORKBOOK_LAYER_COLORS.primary}
          strokeWidth={1.2}
          strokeDasharray="7 5"
        />
      ) : null}

      {tool === "select" && areaSelectionResizeRect ? (
        <rect
          x={areaSelectionResizeRect.x}
          y={areaSelectionResizeRect.y}
          width={areaSelectionResizeRect.width}
          height={areaSelectionResizeRect.height}
          fill="none"
          stroke={WORKBOOK_LAYER_COLORS.primary}
          strokeWidth={1.2}
          strokeDasharray="7 5"
        />
      ) : null}
    </>
  );
});

export const WorkbookSelectionOverlayLayer = memo(function WorkbookSelectionOverlayLayer({
  areaSelection,
  selectedRect,
  selectedPreviewObject,
  selectedStroke,
  selectedStrokeRect,
  isStrokeDragging,
  selectedLineControls,
  selectedSolidResizeHandles,
  tool,
}: {
  areaSelection: WorkbookAreaSelection | null;
  selectedRect: { x: number; y: number; width: number; height: number } | null;
  selectedPreviewObject: WorkbookBoardObject | null;
  selectedStroke: WorkbookStroke | null;
  selectedStrokeRect: { x: number; y: number; width: number; height: number } | null;
  isStrokeDragging: boolean;
  selectedLineControls:
    | {
        c1: WorkbookPoint;
        c2: WorkbookPoint;
      }
    | null;
  selectedSolidResizeHandles: Array<{ mode: string; x: number; y: number }>;
  tool: WorkbookTool;
}) {
  if (!areaSelection && !selectedRect && !selectedStrokeRect) return null;

  return (
    <>
      {areaSelection ? (
        <>
          <rect
            x={areaSelection.rect.x}
            y={areaSelection.rect.y}
            width={areaSelection.rect.width}
            height={areaSelection.rect.height}
            fill="none"
            stroke={WORKBOOK_LAYER_COLORS.primary}
            strokeWidth={1.2}
            strokeDasharray="7 5"
          />
          {tool === "area_select" || tool === "select"
            ? getAreaSelectionHandlePoints(areaSelection.rect).map((handle) => (
                <circle
                  key={`area-selection-handle-${handle.mode}`}
                  cx={handle.x}
                  cy={handle.y}
                  r={4}
                  fill={WORKBOOK_LAYER_COLORS.primary}
                  stroke={WORKBOOK_LAYER_COLORS.white}
                  strokeWidth={1}
                />
              ))
            : null}
        </>
      ) : null}

      {tool === "select" && !areaSelection && selectedStroke && selectedStrokeRect ? (
        <>
          <rect
            x={selectedStrokeRect.x}
            y={selectedStrokeRect.y}
            width={selectedStrokeRect.width}
            height={selectedStrokeRect.height}
            fill="none"
            stroke={WORKBOOK_LAYER_COLORS.warning}
            strokeWidth={1.2}
            strokeDasharray="7 5"
            opacity={isStrokeDragging ? 0.62 : 0.78}
          />
        </>
      ) : null}

      {tool === "select" && selectedRect ? (
        <>
          {selectedPreviewObject?.type === "solid3d" ? (
            <g>
              {selectedSolidResizeHandles.length >= 2 ? (
                <path
                  d={`${toPath(
                    selectedSolidResizeHandles.map((handle) => ({ x: handle.x, y: handle.y }))
                  )} Z`}
                  fill="none"
                  stroke={WORKBOOK_LAYER_COLORS.primary}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  strokeOpacity={0.72}
                />
              ) : null}
              {selectedSolidResizeHandles.map((handle, index) => (
                <circle
                  key={`solid3d-resize-handle-${selectedPreviewObject.id}-${handle.mode}-${index}`}
                  cx={handle.x}
                  cy={handle.y}
                  r={3.5}
                  fill={WORKBOOK_LAYER_COLORS.primary}
                  stroke={WORKBOOK_LAYER_COLORS.white}
                  strokeWidth={1}
                />
              ))}
            </g>
          ) : selectedPreviewObject?.type === "section_divider" ? (
            <line
              x1={selectedPreviewObject.x}
              y1={selectedPreviewObject.y + selectedPreviewObject.height / 2}
              x2={selectedPreviewObject.x + selectedPreviewObject.width}
              y2={selectedPreviewObject.y + selectedPreviewObject.height / 2}
              stroke={WORKBOOK_LAYER_COLORS.warning}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ) : selectedPreviewObject?.type === "point" ? (
            <circle
              cx={selectedPreviewObject.x + selectedPreviewObject.width / 2}
              cy={selectedPreviewObject.y + selectedPreviewObject.height / 2}
              r={8}
              fill="none"
              stroke={WORKBOOK_LAYER_COLORS.warning}
              strokeWidth={1.6}
              strokeDasharray="6 4"
            />
          ) : selectedPreviewObject &&
            (selectedPreviewObject.type === "line" || selectedPreviewObject.type === "arrow") ? (
            <>
              {(() => {
                const lineKind =
                  selectedPreviewObject.meta?.lineKind === "segment" ? "segment" : "line";
                return (
                  <>
                    <line
                      x1={selectedPreviewObject.x}
                      y1={selectedPreviewObject.y}
                      x2={selectedLineControls?.c1.x ?? selectedPreviewObject.x}
                      y2={selectedLineControls?.c1.y ?? selectedPreviewObject.y}
                      stroke={WORKBOOK_LAYER_COLORS.primary}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                    <line
                      x1={selectedPreviewObject.x + selectedPreviewObject.width}
                      y1={selectedPreviewObject.y + selectedPreviewObject.height}
                      x2={
                        selectedLineControls?.c2.x ??
                        selectedPreviewObject.x + selectedPreviewObject.width
                      }
                      y2={
                        selectedLineControls?.c2.y ??
                        selectedPreviewObject.y + selectedPreviewObject.height
                      }
                      stroke={WORKBOOK_LAYER_COLORS.primary}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                    <rect
                      x={selectedRect.x}
                      y={selectedRect.y}
                      width={selectedRect.width}
                      height={selectedRect.height}
                      fill="none"
                      stroke={WORKBOOK_LAYER_COLORS.warning}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />
                    {!selectedPreviewObject.pinned ? (
                      <>
                        {[
                          { key: "nw", x: selectedRect.x, y: selectedRect.y },
                          { key: "ne", x: selectedRect.x + selectedRect.width, y: selectedRect.y },
                          {
                            key: "se",
                            x: selectedRect.x + selectedRect.width,
                            y: selectedRect.y + selectedRect.height,
                          },
                          { key: "sw", x: selectedRect.x, y: selectedRect.y + selectedRect.height },
                        ].map((handle) => (
                          <rect
                            key={`line-handle-${selectedPreviewObject.id}-${handle.key}`}
                            x={handle.x - 3}
                            y={handle.y - 3}
                            width={6}
                            height={6}
                            rx={1.5}
                            ry={1.5}
                            fill={WORKBOOK_LAYER_COLORS.warning}
                            stroke={WORKBOOK_LAYER_COLORS.white}
                            strokeWidth={1}
                          />
                        ))}
                        <circle
                          cx={selectedLineControls?.c1.x ?? selectedPreviewObject.x}
                          cy={selectedLineControls?.c1.y ?? selectedPreviewObject.y}
                          r={3.2}
                          fill={WORKBOOK_LAYER_COLORS.primary}
                          stroke={WORKBOOK_LAYER_COLORS.white}
                          strokeWidth={1}
                        />
                        <circle
                          cx={
                            selectedLineControls?.c2.x ??
                            selectedPreviewObject.x + selectedPreviewObject.width
                          }
                          cy={
                            selectedLineControls?.c2.y ??
                            selectedPreviewObject.y + selectedPreviewObject.height
                          }
                          r={3.3}
                          fill={WORKBOOK_LAYER_COLORS.primary}
                          stroke={WORKBOOK_LAYER_COLORS.white}
                          strokeWidth={1}
                        />
                        <circle
                          cx={selectedPreviewObject.x}
                          cy={selectedPreviewObject.y}
                          r={3.5}
                          fill={lineKind === "segment" ? WORKBOOK_LAYER_COLORS.white : WORKBOOK_LAYER_COLORS.warning}
                          stroke={WORKBOOK_LAYER_COLORS.warning}
                          strokeWidth={1.2}
                        />
                        <circle
                          cx={selectedPreviewObject.x + selectedPreviewObject.width}
                          cy={selectedPreviewObject.y + selectedPreviewObject.height}
                          r={3.5}
                          fill={lineKind === "segment" ? WORKBOOK_LAYER_COLORS.white : WORKBOOK_LAYER_COLORS.warning}
                          stroke={WORKBOOK_LAYER_COLORS.warning}
                          strokeWidth={1.2}
                        />
                        <circle
                          cx={selectedRect.x + selectedRect.width / 2}
                          cy={selectedRect.y - 18}
                          r={3.5}
                          fill={WORKBOOK_LAYER_COLORS.primary}
                          stroke={WORKBOOK_LAYER_COLORS.white}
                          strokeWidth={1}
                        />
                      </>
                    ) : null}
                  </>
                );
              })()}
            </>
          ) : selectedPreviewObject ? (
            <g
              transform={
                selectedPreviewObject.rotation
                  ? `rotate(${selectedPreviewObject.rotation} ${
                      selectedRect.x + selectedRect.width / 2
                    } ${selectedRect.y + selectedRect.height / 2})`
                  : undefined
              }
            >
              <rect
                x={selectedRect.x}
                y={selectedRect.y}
                width={selectedRect.width}
                height={selectedRect.height}
                fill="none"
                stroke={WORKBOOK_LAYER_COLORS.warning}
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              {!selectedPreviewObject.pinned ? (
                <>
                  {[
                    { key: "nw", x: selectedRect.x, y: selectedRect.y },
                    { key: "ne", x: selectedRect.x + selectedRect.width, y: selectedRect.y },
                    {
                      key: "se",
                      x: selectedRect.x + selectedRect.width,
                      y: selectedRect.y + selectedRect.height,
                    },
                    { key: "sw", x: selectedRect.x, y: selectedRect.y + selectedRect.height },
                    { key: "n", x: selectedRect.x + selectedRect.width / 2, y: selectedRect.y },
                    {
                      key: "e",
                      x: selectedRect.x + selectedRect.width,
                      y: selectedRect.y + selectedRect.height / 2,
                    },
                    {
                      key: "s",
                      x: selectedRect.x + selectedRect.width / 2,
                      y: selectedRect.y + selectedRect.height,
                    },
                    { key: "w", x: selectedRect.x, y: selectedRect.y + selectedRect.height / 2 },
                  ].map((handle) => (
                    <rect
                      key={`handle-${selectedPreviewObject.id}-${handle.key}`}
                      x={handle.x - 3}
                      y={handle.y - 3}
                      width={6}
                      height={6}
                      rx={1.5}
                      ry={1.5}
                      fill={WORKBOOK_LAYER_COLORS.warning}
                      stroke={WORKBOOK_LAYER_COLORS.white}
                      strokeWidth={1}
                    />
                  ))}
                  <line
                    x1={selectedRect.x + selectedRect.width / 2}
                    y1={selectedRect.y}
                    x2={selectedRect.x + selectedRect.width / 2}
                    y2={selectedRect.y - 14}
                    stroke={WORKBOOK_LAYER_COLORS.primary}
                    strokeWidth={1.2}
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={selectedRect.x + selectedRect.width / 2}
                    cy={selectedRect.y - 18}
                    r={3.5}
                    fill={WORKBOOK_LAYER_COLORS.primary}
                    stroke={WORKBOOK_LAYER_COLORS.white}
                    strokeWidth={1}
                  />
                </>
              ) : null}
            </g>
          ) : null}
        </>
      ) : null}
    </>
  );
});
