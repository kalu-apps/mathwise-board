import { useMemo } from "react";
import { resolveWorkbookPageFrameBounds } from "@/features/workbook/model/pageFrame";
import { resolveBoardObjectImageAssetId } from "@/features/workbook/model/scene";
import type { WorkbookBoardObject, WorkbookStroke } from "@/features/workbook/model/types";
import { normalizeWorkbookAssetContentUrl } from "@/features/workbook/model/workbookAssetUrl";
import type { WorkbookBoardPageOption } from "./WorkbookSessionBoardSettingsPanel";
import { toSafeWorkbookPage } from "./WorkbookSessionPage.core";

export type WorkbookPagePreviewData = {
  objects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
};

type UseWorkbookPagePreviewMapParams = {
  pageOptions: WorkbookBoardPageOption[];
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
};

type WorkbookSessionPagePreviewProps = {
  previewData: WorkbookPagePreviewData | null;
  imageAssetUrls: Record<string, string>;
};

const MAX_OBJECTS_PER_PAGE_PREVIEW = 180;
const MAX_STROKES_PER_PAGE_PREVIEW = 200;
const STROKE_POINT_SAMPLE_LIMIT = 120;
const PAGE_FRAME_BOUNDS = resolveWorkbookPageFrameBounds();

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizeDimension = (value: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, value);
};

const normalizeObjectOpacity = (value?: number) => {
  if (!Number.isFinite(value)) return 1;
  return clampNumber(value ?? 1, 0.12, 1);
};

const resolveObjectStroke = (object: WorkbookBoardObject) =>
  typeof object.color === "string" && object.color.trim().length > 0
    ? object.color.trim()
    : "rgba(33, 44, 59, 0.86)";

const resolveObjectFill = (object: WorkbookBoardObject) => {
  if (typeof object.fill === "string" && object.fill.trim().length > 0) {
    return object.fill.trim();
  }
  if (object.type === "text" || object.type === "formula" || object.type === "line" || object.type === "arrow") {
    return "transparent";
  }
  return "rgba(89, 129, 186, 0.16)";
};

const resolveStrokeWidth = (value: number | undefined) =>
  clampNumber(Number.isFinite(value) ? Number(value) : 2, 1, 28);

const sampleStrokePoints = (points: WorkbookStroke["points"]) => {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length <= STROKE_POINT_SAMPLE_LIMIT) return points;
  const sampled: WorkbookStroke["points"] = [];
  const step = Math.max(1, Math.floor(points.length / STROKE_POINT_SAMPLE_LIMIT));
  for (let index = 0; index < points.length; index += step) {
    sampled.push(points[index]);
  }
  const tail = points[points.length - 1];
  if (sampled[sampled.length - 1] !== tail) {
    sampled.push(tail);
  }
  return sampled;
};

const resolveObjectImageUrl = (
  object: WorkbookBoardObject,
  imageAssetUrls: Record<string, string>
) => {
  const directImageUrl =
    typeof object.imageUrl === "string" && object.imageUrl.trim().length > 0
      ? normalizeWorkbookAssetContentUrl(object.imageUrl)
      : "";
  if (directImageUrl) return directImageUrl;
  const assetId = resolveBoardObjectImageAssetId(object);
  if (!assetId) return "";
  const fromAssetMap =
    typeof imageAssetUrls[assetId] === "string"
      ? normalizeWorkbookAssetContentUrl(imageAssetUrls[assetId] ?? "")
      : "";
  return fromAssetMap;
};

const renderStrokePreview = (
  stroke: WorkbookStroke,
  key: string
) => {
  const sampledPoints = sampleStrokePoints(stroke.points);
  if (sampledPoints.length < 2) return null;
  return (
    <polyline
      key={key}
      points={sampledPoints.map((point) => `${point.x},${point.y}`).join(" ")}
      fill="none"
      stroke={stroke.color || "rgba(37, 52, 69, 0.82)"}
      strokeWidth={resolveStrokeWidth(stroke.width)}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.94}
    />
  );
};

const renderObjectPreview = (
  object: WorkbookBoardObject,
  index: number,
  imageAssetUrls: Record<string, string>
) => {
  const x = Number.isFinite(object.x) ? object.x : 0;
  const y = Number.isFinite(object.y) ? object.y : 0;
  const width = normalizeDimension(object.width, 96);
  const height = normalizeDimension(object.height, 72);
  const stroke = resolveObjectStroke(object);
  const fill = resolveObjectFill(object);
  const strokeWidth = resolveStrokeWidth(object.strokeWidth);
  const opacity = normalizeObjectOpacity(object.opacity);
  const key = `${object.id}-${index}`;

  if (object.type === "point") {
    return (
      <circle
        key={key}
        cx={x}
        cy={y}
        r={Math.max(4, strokeWidth * 1.6)}
        fill={stroke}
        opacity={opacity}
      />
    );
  }

  if (object.type === "line" || object.type === "arrow" || object.type === "measurement_length") {
    const start = object.points?.[0] ?? { x, y };
    const end = object.points?.[1] ?? { x: x + width, y: y + height };
    return (
      <line
        key={key}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  }

  if ((object.type === "polygon" || object.type === "triangle") && Array.isArray(object.points) && object.points.length >= 3) {
    return (
      <polygon
        key={key}
        points={object.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  }

  if (object.type === "ellipse" || object.type === "measurement_angle") {
    return (
      <ellipse
        key={key}
        cx={x + width / 2}
        cy={y + height / 2}
        rx={Math.max(2, width / 2)}
        ry={Math.max(2, height / 2)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
      />
    );
  }

  if (object.type === "image") {
    const imageUrl = resolveObjectImageUrl(object, imageAssetUrls);
    if (imageUrl.length > 0) {
      return (
        <image
          key={key}
          href={imageUrl}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          opacity={opacity}
        />
      );
    }
  }

  if (object.type === "section_divider") {
    const dividerY = y + height / 2;
    return (
      <line
        key={key}
        x1={x}
        y1={dividerY}
        x2={x + Math.max(width, PAGE_FRAME_BOUNDS.width * 0.2)}
        y2={dividerY}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  }

  const labelText = (object.text ?? "").trim();
  const shouldRenderLabel =
    labelText.length > 0 &&
    (object.type === "text" ||
      object.type === "formula" ||
      object.type === "sticker" ||
      object.type === "comment");

  return (
    <g key={key} opacity={opacity}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={Math.max(2, Math.min(12, width * 0.08))}
        ry={Math.max(2, Math.min(12, height * 0.08))}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {shouldRenderLabel ? (
        <text
          x={x + 8}
          y={y + Math.max(14, Math.min(22, (object.fontSize ?? 16) + 2))}
          fill="rgba(32, 43, 58, 0.92)"
          fontSize={Math.max(11, Math.min(18, object.fontSize ?? 14))}
          fontWeight={object.type === "formula" ? 700 : 600}
          fontFamily="'Fira Sans','Segoe UI',sans-serif"
          textAnchor="start"
        >
          {labelText.slice(0, 36)}
        </text>
      ) : null}
    </g>
  );
};

export const useWorkbookPagePreviewMap = ({
  pageOptions,
  boardObjects,
  boardStrokes,
  annotationStrokes,
}: UseWorkbookPagePreviewMapParams) =>
  useMemo(() => {
    const pageSet = new Set(pageOptions.map((option) => option.page));
    const map = new Map<number, WorkbookPagePreviewData>();

    pageOptions.forEach((option) => {
      map.set(option.page, {
        objects: [],
        strokes: [],
        annotationStrokes: [],
      });
    });

    boardObjects.forEach((object) => {
      const page = toSafeWorkbookPage(object.page);
      if (!pageSet.has(page)) return;
      const bucket = map.get(page);
      if (!bucket) return;
      bucket.objects.push(object);
    });

    boardStrokes.forEach((stroke) => {
      const page = toSafeWorkbookPage(stroke.page);
      if (!pageSet.has(page)) return;
      const bucket = map.get(page);
      if (!bucket) return;
      bucket.strokes.push(stroke);
    });

    annotationStrokes.forEach((stroke) => {
      const page = toSafeWorkbookPage(stroke.page);
      if (!pageSet.has(page)) return;
      const bucket = map.get(page);
      if (!bucket) return;
      bucket.annotationStrokes.push(stroke);
    });

    map.forEach((bucket, page) => {
      const sortedObjects = [...bucket.objects].sort((left, right) => {
        const leftOrder = Number.isFinite(left.zOrder) ? Number(left.zOrder) : 0;
        const rightOrder = Number.isFinite(right.zOrder) ? Number(right.zOrder) : 0;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.id.localeCompare(right.id);
      });
      const nextObjects =
        sortedObjects.length > MAX_OBJECTS_PER_PAGE_PREVIEW
          ? sortedObjects.slice(sortedObjects.length - MAX_OBJECTS_PER_PAGE_PREVIEW)
          : sortedObjects;
      const nextStrokes =
        bucket.strokes.length > MAX_STROKES_PER_PAGE_PREVIEW
          ? bucket.strokes.slice(bucket.strokes.length - MAX_STROKES_PER_PAGE_PREVIEW)
          : bucket.strokes;
      const nextAnnotationStrokes =
        bucket.annotationStrokes.length > MAX_STROKES_PER_PAGE_PREVIEW
          ? bucket.annotationStrokes.slice(
              bucket.annotationStrokes.length - MAX_STROKES_PER_PAGE_PREVIEW
            )
          : bucket.annotationStrokes;
      map.set(page, {
        objects: nextObjects,
        strokes: nextStrokes,
        annotationStrokes: nextAnnotationStrokes,
      });
    });

    return map;
  }, [annotationStrokes, boardObjects, boardStrokes, pageOptions]);

export function WorkbookSessionPagePreview({
  previewData,
  imageAssetUrls,
}: WorkbookSessionPagePreviewProps) {
  const hasContent = Boolean(
    previewData &&
      (previewData.objects.length > 0 ||
        previewData.strokes.length > 0 ||
        previewData.annotationStrokes.length > 0)
  );

  return (
    <svg
      className="workbook-session__page-card-svg-preview"
      viewBox={`${PAGE_FRAME_BOUNDS.minX} ${PAGE_FRAME_BOUNDS.minY} ${PAGE_FRAME_BOUNDS.width} ${PAGE_FRAME_BOUNDS.height}`}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        x={PAGE_FRAME_BOUNDS.minX}
        y={PAGE_FRAME_BOUNDS.minY}
        width={PAGE_FRAME_BOUNDS.width}
        height={PAGE_FRAME_BOUNDS.height}
        fill="rgba(255, 255, 255, 0.98)"
        stroke="rgba(35, 49, 66, 0.2)"
        strokeWidth={34}
        rx={56}
        ry={56}
      />
      {hasContent && previewData ? (
        <>
          {previewData.strokes.map((stroke, index) =>
            renderStrokePreview(stroke, `stroke-${stroke.id}-${index}`)
          )}
          {previewData.annotationStrokes.map((stroke, index) =>
            renderStrokePreview(stroke, `annotation-${stroke.id}-${index}`)
          )}
          {previewData.objects.map((object, index) =>
            renderObjectPreview(object, index, imageAssetUrls)
          )}
        </>
      ) : null}
    </svg>
  );
}
