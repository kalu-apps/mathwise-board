import { useMemo, type RefObject } from "react";
import { prepareWorkbookRenderObject, buildFunctionGraphRenderStateMap } from "@/features/workbook/model/sceneRender";
import { getObjectRect } from "@/features/workbook/model/sceneGeometry";
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
import {
  renderWorkbookCanvasPrimaryObject,
  type WorkbookPrimaryRenderedObjectParts,
} from "@/features/workbook/ui/WorkbookCanvasPrimaryObjectRenderer";
import { renderWorkbookCanvasSecondaryObject } from "@/features/workbook/ui/WorkbookCanvasSecondaryObjectRenderer";
import { renderWorkbookCanvasSolid3dObject } from "@/features/workbook/ui/WorkbookCanvasSolid3dRenderer";
import {
  ROUND_SOLID_PRESETS,
  summarizeProjectedVertices,
} from "@/features/workbook/ui/WorkbookCanvas.types";
import { resolveWorkbookPageFrameBounds } from "@/features/workbook/model/pageFrame";
import { getSectionVertexLabel } from "./WorkbookSessionPage.core";
import type { WorkbookPagePreviewData } from "./useWorkbookPagePreviewMap";

type WorkbookSessionPagePreviewProps = {
  pageId: number;
  previewData: WorkbookPagePreviewData | null;
  imageAssetUrls: Record<string, string>;
  backgroundColor?: string;
  gridColor?: string;
  gridSize?: number;
  pageFrameWidth: number;
};

const GRID_STROKE_BASE_OPACITY = 0.22;
const PREVIEW_ARROW_MARKER_ID = "workbook-arrow";
const PREVIEW_TEXT_INPUT_REF = { current: null } as RefObject<HTMLTextAreaElement | null>;
const PREVIEW_VIEWPORT_ASPECT = 1.6;
const PREVIEW_VIEWPORT_MIN_WIDTH = 1240;
const PREVIEW_VIEWPORT_MAX_WIDTH_RATIO = 0.72;

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

const isPrimaryRenderedObjectParts = (
  value: unknown
): value is WorkbookPrimaryRenderedObjectParts =>
  Boolean(value) &&
  typeof value === "object" &&
  Object.prototype.hasOwnProperty.call(value, "maskedObject");

type ViewBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const resolveContentBounds = (params: {
  objects: WorkbookPagePreviewData["objects"];
  strokes: WorkbookPagePreviewData["strokes"];
  annotationStrokes: WorkbookPagePreviewData["annotationStrokes"];
}) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const includePoint = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  params.objects.forEach((object) => {
    const rect = getObjectRect(object);
    includePoint(rect.x, rect.y);
    includePoint(rect.x + rect.width, rect.y + rect.height);
  });

  const includeStroke = (stroke: WorkbookPagePreviewData["strokes"][number]) => {
    const halfWidth = normalizeStrokeWidth(stroke.width) / 2;
    stroke.points.forEach((point) => {
      includePoint(point.x - halfWidth, point.y - halfWidth);
      includePoint(point.x + halfWidth, point.y + halfWidth);
    });
  };

  params.strokes.forEach(includeStroke);
  params.annotationStrokes.forEach(includeStroke);

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const resolvePreviewViewBounds = (params: {
  pageFrameBounds: ViewBounds;
  objects: WorkbookPagePreviewData["objects"];
  strokes: WorkbookPagePreviewData["strokes"];
  annotationStrokes: WorkbookPagePreviewData["annotationStrokes"];
}) => {
  const { pageFrameBounds } = params;
  const maxWidth = pageFrameBounds.width * PREVIEW_VIEWPORT_MAX_WIDTH_RATIO;
  const minWidth = Math.min(PREVIEW_VIEWPORT_MIN_WIDTH, maxWidth);
  const minHeight = minWidth / PREVIEW_VIEWPORT_ASPECT;
  const maxHeight = pageFrameBounds.height * PREVIEW_VIEWPORT_MAX_WIDTH_RATIO;
  const contentBounds = resolveContentBounds(params);

  let targetWidth = minWidth;
  let targetHeight = minHeight;
  let centerX = pageFrameBounds.minX + pageFrameBounds.width / 2;
  let centerY = pageFrameBounds.minY + pageFrameBounds.height / 2;

  if (contentBounds) {
    centerX = contentBounds.minX + contentBounds.width / 2;
    centerY = contentBounds.minY + contentBounds.height / 2;
    const contentWidthWithPadding = contentBounds.width * 1.28;
    const contentHeightWithPadding = contentBounds.height * 1.28;
    targetWidth = clampNumber(
      Math.max(minWidth, contentWidthWithPadding),
      minWidth,
      maxWidth
    );
    targetHeight = targetWidth / PREVIEW_VIEWPORT_ASPECT;
    if (targetHeight < contentHeightWithPadding) {
      targetHeight = clampNumber(
        Math.max(minHeight, contentHeightWithPadding),
        minHeight,
        maxHeight
      );
      targetWidth = clampNumber(
        targetHeight * PREVIEW_VIEWPORT_ASPECT,
        minWidth,
        maxWidth
      );
    }
  }

  targetHeight = clampNumber(targetHeight, minHeight, maxHeight);
  targetWidth = clampNumber(targetWidth, minWidth, maxWidth);

  const minX = clampNumber(
    centerX - targetWidth / 2,
    pageFrameBounds.minX,
    pageFrameBounds.maxX - targetWidth
  );
  const minY = clampNumber(
    centerY - targetHeight / 2,
    pageFrameBounds.minY,
    pageFrameBounds.maxY - targetHeight
  );

  const maxX = minX + targetWidth;
  const maxY = minY + targetHeight;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: targetWidth,
    height: targetHeight,
  } satisfies ViewBounds;
};

export function WorkbookSessionPagePreview({
  pageId,
  previewData,
  imageAssetUrls,
  backgroundColor,
  gridColor,
  gridSize,
  pageFrameWidth,
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
  const boardStrokes = previewData?.strokes ?? [];
  const annotationStrokes = previewData?.annotationStrokes ?? [];

  const visibleObjects = useMemo(
    () => previewData?.objects ?? [],
    [previewData?.objects]
  );
  const pageFrameBounds = useMemo(
    () => resolveWorkbookPageFrameBounds(pageFrameWidth),
    [pageFrameWidth]
  );
  const viewBounds = useMemo(
    () =>
      resolvePreviewViewBounds({
        pageFrameBounds,
        objects: visibleObjects,
        strokes: boardStrokes,
        annotationStrokes,
      }),
    [annotationStrokes, boardStrokes, pageFrameBounds, visibleObjects]
  );
  const gridStartX = Math.floor(viewBounds.minX / safeGridSize) * safeGridSize;
  const gridStartY = Math.floor(viewBounds.minY / safeGridSize) * safeGridSize;
  const verticalGridLines = Math.max(
    2,
    Math.ceil((viewBounds.maxX - gridStartX) / safeGridSize) + 1
  );
  const horizontalGridLines = Math.max(
    3,
    Math.ceil((viewBounds.maxY - gridStartY) / safeGridSize) + 1
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
          pageFrameBounds,
        });

        if (renderedPrimary) {
          const maskedObject = isPrimaryRenderedObjectParts(renderedPrimary)
            ? renderedPrimary.maskedObject
            : renderedPrimary;
          const unmaskedOverlay = isPrimaryRenderedObjectParts(renderedPrimary)
            ? renderedPrimary.unmaskedOverlay ?? null
            : null;
          return (
            <g key={`preview-object-${object.id}`}>
              {maskedObject}
              {unmaskedOverlay ? <g>{unmaskedOverlay}</g> : null}
            </g>
          );
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

  return (
    <svg
      className="workbook-session__page-card-svg-preview"
      viewBox={`${viewBounds.minX} ${viewBounds.minY} ${viewBounds.width} ${viewBounds.height}`}
      role="img"
      aria-label={`Превью страницы ${pageId}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <clipPath id={`workbook-page-preview-clip-${pageId}`}>
          <rect
            x={viewBounds.minX}
            y={viewBounds.minY}
            width={viewBounds.width}
            height={viewBounds.height}
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
          x={viewBounds.minX}
          y={viewBounds.minY}
          width={viewBounds.width}
          height={viewBounds.height}
          fill={safeBackgroundColor}
        />
        {Array.from({ length: verticalGridLines + 1 }, (_, index) => {
          const x = gridStartX + index * safeGridSize;
          if (x > viewBounds.maxX) return null;
          return (
            <line
              key={`grid-v-${pageId}-${index}`}
              x1={x}
              y1={viewBounds.minY}
              x2={x}
              y2={viewBounds.maxY}
              stroke={safeGridColor}
              strokeWidth={1}
              opacity={GRID_STROKE_BASE_OPACITY}
            />
          );
        })}
        {Array.from({ length: horizontalGridLines + 1 }, (_, index) => {
          const y = gridStartY + index * safeGridSize;
          if (y > viewBounds.maxY) return null;
          return (
            <line
              key={`grid-h-${pageId}-${index}`}
              x1={viewBounds.minX}
              y1={y}
              x2={viewBounds.maxX}
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
