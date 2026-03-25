import { useMemo, type RefObject } from "react";
import { prepareWorkbookRenderObject, buildFunctionGraphRenderStateMap } from "@/features/workbook/model/sceneRender";
import { toPath } from "@/features/workbook/model/stroke";
import {
  resolveWorkbookStrokeOpacity,
  resolveWorkbookStrokeSvgBlendMode,
} from "@/features/workbook/model/strokeRenderStyle";
import {
  WORKBOOK_BOARD_BACKGROUND_COLOR,
  WORKBOOK_BOARD_GRID_COLOR,
  WORKBOOK_BOARD_PRIMARY_COLOR,
} from "@/features/workbook/model/workbookVisualColors";
import { renderWorkbookCanvasPrimaryObject } from "@/features/workbook/ui/WorkbookCanvasPrimaryObjectRenderer";
import { renderWorkbookCanvasSecondaryObject } from "@/features/workbook/ui/WorkbookCanvasSecondaryObjectRenderer";
import { renderWorkbookCanvasSolid3dObject } from "@/features/workbook/ui/WorkbookCanvasSolid3dRenderer";
import {
  ROUND_SOLID_PRESETS,
  summarizeProjectedVertices,
} from "@/features/workbook/ui/WorkbookCanvas.types";
import { getSectionVertexLabel, WORKBOOK_PAGE_FRAME_BOUNDS } from "./WorkbookSessionPage.core";
import type { WorkbookPagePreviewData } from "./useWorkbookPagePreviewMap";

type WorkbookSessionPagePreviewProps = {
  pageId: number;
  previewData: WorkbookPagePreviewData | null;
  imageAssetUrls: Record<string, string>;
  backgroundColor?: string;
  gridColor?: string;
  gridSize?: number;
};

const GRID_STROKE_BASE_OPACITY = 0.22;
const PAGE_FRAME_BOUNDS = WORKBOOK_PAGE_FRAME_BOUNDS;
const PREVIEW_ARROW_MARKER_ID = "workbook-arrow";
const PREVIEW_TEXT_INPUT_REF = { current: null } as RefObject<HTMLTextAreaElement | null>;

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeColorString = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const normalizeStrokeWidth = (value: number | undefined) => {
  if (!Number.isFinite(value)) return 2;
  return clampNumber(Number(value), 1, 28);
};

export function WorkbookSessionPagePreview({
  pageId,
  previewData,
  imageAssetUrls,
  backgroundColor,
  gridColor,
  gridSize,
}: WorkbookSessionPagePreviewProps) {
  const safeBackgroundColor = normalizeColorString(
    backgroundColor,
    WORKBOOK_BOARD_BACKGROUND_COLOR
  );
  const safeGridColor = normalizeColorString(gridColor, WORKBOOK_BOARD_GRID_COLOR);
  const safeGridSize = clampNumber(
    Number.isFinite(gridSize) ? Number(gridSize) : 22,
    8,
    96
  );

  const verticalGridLines = Math.max(
    2,
    Math.floor(PAGE_FRAME_BOUNDS.width / safeGridSize)
  );
  const horizontalGridLines = Math.max(
    3,
    Math.floor(PAGE_FRAME_BOUNDS.height / safeGridSize)
  );

  const visibleObjects = useMemo(
    () => previewData?.objects ?? [],
    [previewData?.objects]
  );

  const functionGraphRenderStateById = useMemo(() => {
    const { map } = buildFunctionGraphRenderStateMap({
      visibleBoardObjects: visibleObjects,
      selectedPreviewObject: null,
      graphPan: null,
      gridSize: safeGridSize,
    });
    return map;
  }, [safeGridSize, visibleObjects]);

  const renderedObjects = useMemo(
    () =>
      visibleObjects.map((object) => {
        const prepared = prepareWorkbookRenderObject({
          objectSource: object,
          moving: null,
          activeMoveRect: null,
          solid3dPreviewMetaById: {},
        });

        const commonProps = {
          stroke: object.color ?? WORKBOOK_BOARD_PRIMARY_COLOR,
          strokeWidth: object.strokeWidth ?? 2,
          fill: object.fill ?? "transparent",
          opacity: object.opacity ?? 1,
          "data-object-id": object.id,
        } as const;

        const renderedPrimary = renderWorkbookCanvasPrimaryObject({
          object: prepared.object,
          normalized: prepared.normalized,
          transform: prepared.transform,
          commonProps,
          imageAssetUrls,
          inlineTextEdit: null,
          setInlineTextEdit: () => {
            /* preview-only noop */
          },
          cancelInlineTextEdit: () => {
            /* preview-only noop */
          },
          inlineTextEditInputRef: PREVIEW_TEXT_INPUT_REF,
          commitInlineTextEdit: () => {
            /* preview-only noop */
          },
          functionGraphRenderStateById,
        });

        if (renderedPrimary) {
          return <g key={`preview-object-${object.id}`}>{renderedPrimary}</g>;
        }

        const renderedSolid3d = renderWorkbookCanvasSolid3dObject({
          object: prepared.object,
          normalized: prepared.normalized,
          transform: prepared.transform,
          isRoundSolidPreset: (presetId) => ROUND_SOLID_PRESETS.has(presetId),
          summarizeProjectedVertices,
          getSectionVertexLabel,
        });

        if (renderedSolid3d) {
          return <g key={`preview-object-${object.id}`}>{renderedSolid3d}</g>;
        }

        const renderedSecondary = renderWorkbookCanvasSecondaryObject({
          object: prepared.object,
          normalized: prepared.normalized,
          transform: prepared.transform,
        });

        return renderedSecondary ? (
          <g key={`preview-object-${object.id}`}>{renderedSecondary}</g>
        ) : null;
      }),
    [functionGraphRenderStateById, imageAssetUrls, visibleObjects]
  );

  const boardStrokes = previewData?.strokes ?? [];
  const annotationStrokes = previewData?.annotationStrokes ?? [];

  return (
    <svg
      className="workbook-session__page-card-svg-preview"
      viewBox={`${PAGE_FRAME_BOUNDS.minX} ${PAGE_FRAME_BOUNDS.minY} ${PAGE_FRAME_BOUNDS.width} ${PAGE_FRAME_BOUNDS.height}`}
      role="img"
      aria-label={`Превью страницы ${pageId}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id={`workbook-page-preview-clip-${pageId}`}>
          <rect
            x={PAGE_FRAME_BOUNDS.minX}
            y={PAGE_FRAME_BOUNDS.minY}
            width={PAGE_FRAME_BOUNDS.width}
            height={PAGE_FRAME_BOUNDS.height}
          />
        </clipPath>
        <marker
          id={PREVIEW_ARROW_MARKER_ID}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <g clipPath={`url(#workbook-page-preview-clip-${pageId})`}>
        <rect
          x={PAGE_FRAME_BOUNDS.minX}
          y={PAGE_FRAME_BOUNDS.minY}
          width={PAGE_FRAME_BOUNDS.width}
          height={PAGE_FRAME_BOUNDS.height}
          fill={safeBackgroundColor}
        />
        {Array.from({ length: verticalGridLines + 1 }, (_, index) => {
          const x = PAGE_FRAME_BOUNDS.minX + index * safeGridSize;
          if (x > PAGE_FRAME_BOUNDS.maxX) return null;
          return (
            <line
              key={`grid-v-${pageId}-${index}`}
              x1={x}
              y1={PAGE_FRAME_BOUNDS.minY}
              x2={x}
              y2={PAGE_FRAME_BOUNDS.maxY}
              stroke={safeGridColor}
              strokeWidth={1}
              opacity={GRID_STROKE_BASE_OPACITY}
            />
          );
        })}
        {Array.from({ length: horizontalGridLines + 1 }, (_, index) => {
          const y = PAGE_FRAME_BOUNDS.minY + index * safeGridSize;
          if (y > PAGE_FRAME_BOUNDS.maxY) return null;
          return (
            <line
              key={`grid-h-${pageId}-${index}`}
              x1={PAGE_FRAME_BOUNDS.minX}
              y1={y}
              x2={PAGE_FRAME_BOUNDS.maxX}
              y2={y}
              stroke={safeGridColor}
              strokeWidth={1}
              opacity={GRID_STROKE_BASE_OPACITY}
            />
          );
        })}
        {boardStrokes.map((stroke) => (
          <path
            key={`preview-board-stroke-${stroke.id}`}
            d={toPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={normalizeStrokeWidth(stroke.width)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={
              stroke.tool === "highlighter"
                ? resolveWorkbookStrokeOpacity(stroke.tool)
                : 1
            }
            style={{ mixBlendMode: resolveWorkbookStrokeSvgBlendMode(stroke.tool) }}
          />
        ))}
        {annotationStrokes.map((stroke) => (
          <path
            key={`preview-annotation-stroke-${stroke.id}`}
            d={toPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={normalizeStrokeWidth(stroke.width)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={
              stroke.tool === "highlighter"
                ? resolveWorkbookStrokeOpacity(stroke.tool)
                : 1
            }
            style={{ mixBlendMode: resolveWorkbookStrokeSvgBlendMode(stroke.tool) }}
          />
        ))}
        {renderedObjects}
      </g>
    </svg>
  );
}
