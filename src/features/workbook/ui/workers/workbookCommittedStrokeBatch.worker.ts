import {
  resolveWorkbookStrokeCanvasCompositeOperation,
  resolveWorkbookStrokeOpacity,
} from "../../model/strokeRenderStyle";

type WorkerPoint = {
  x: number;
  y: number;
};

type WorkerStroke = {
  id: string;
  color: string;
  width: number;
  tool: string;
  page?: number;
  points: WorkerPoint[];
};

type RenderPayload = {
  requestId: number;
  strokes: WorkerStroke[];
  viewportOffset: WorkerPoint;
  zoom: number;
  width: number;
  height: number;
  currentPage: number;
  maxPointsPerStroke: number;
};

type StrokeBatch = {
  id: string;
  color: string;
  width: number;
  opacity: number;
  compositeOperation: string;
  points: number[];
};

type RenderResult = {
  requestId: number;
  batches: StrokeBatch[];
  sourceStrokeCount: number;
  renderedStrokeCount: number;
  droppedStrokeCount: number;
  sourcePointCount: number;
  renderedPointCount: number;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampPositive = (value: number, fallback: number) =>
  isFiniteNumber(value) && value > 0 ? value : fallback;

const simplifyPoints = (points: WorkerPoint[], minDistanceSq: number, maxPoints: number) => {
  if (points.length <= 2) return points;
  const simplified: WorkerPoint[] = [];
  let lastX = Number.NaN;
  let lastY = Number.NaN;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) continue;
    if (index === 0 || index === points.length - 1) {
      simplified.push(point);
      lastX = point.x;
      lastY = point.y;
      continue;
    }
    const dx = point.x - lastX;
    const dy = point.y - lastY;
    if (dx * dx + dy * dy < minDistanceSq) continue;
    simplified.push(point);
    lastX = point.x;
    lastY = point.y;
  }
  if (simplified.length <= maxPoints) return simplified;
  const stride = Math.max(1, Math.ceil(simplified.length / maxPoints));
  const sampled: WorkerPoint[] = [];
  for (let index = 0; index < simplified.length; index += stride) {
    sampled.push(simplified[index]);
  }
  const lastPoint = simplified[simplified.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint);
  }
  return sampled;
};

const normalizeStrokeBounds = (points: WorkerPoint[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
};

const renderPayload = (payload: RenderPayload): RenderResult => {
  const safeZoom = clampPositive(payload.zoom, 1);
  const safeWidth = Math.max(1, Math.floor(clampPositive(payload.width, 1)));
  const safeHeight = Math.max(1, Math.floor(clampPositive(payload.height, 1)));
  const safeCurrentPage = Math.max(1, Math.floor(clampPositive(payload.currentPage, 1)));
  const safeViewportOffset = {
    x: isFiniteNumber(payload.viewportOffset?.x) ? payload.viewportOffset.x : 0,
    y: isFiniteNumber(payload.viewportOffset?.y) ? payload.viewportOffset.y : 0,
  };
  const maxPointsPerStroke = Math.max(12, Math.floor(clampPositive(payload.maxPointsPerStroke, 240)));
  const worldMargin = Math.max(48, Math.round(220 / safeZoom));
  const viewportBounds = {
    minX: safeViewportOffset.x - worldMargin,
    minY: safeViewportOffset.y - worldMargin,
    maxX: safeViewportOffset.x + safeWidth / safeZoom + worldMargin,
    maxY: safeViewportOffset.y + safeHeight / safeZoom + worldMargin,
  };
  const minDistance = Math.max(0.4 / safeZoom, 0.1);
  const minDistanceSq = minDistance * minDistance;
  const batches: StrokeBatch[] = [];
  let sourcePointCount = 0;
  let renderedPointCount = 0;
  let droppedStrokeCount = 0;

  for (const stroke of payload.strokes) {
    if (!stroke || typeof stroke !== "object") continue;
    const safePage = Math.max(
      1,
      Math.floor(isFiniteNumber(stroke.page) ? stroke.page : safeCurrentPage)
    );
    if (safePage !== safeCurrentPage) {
      droppedStrokeCount += 1;
      continue;
    }
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    sourcePointCount += points.length;
    if (points.length < 2) {
      droppedStrokeCount += 1;
      continue;
    }
    const bounds = normalizeStrokeBounds(points);
    if (!bounds) {
      droppedStrokeCount += 1;
      continue;
    }
    if (
      bounds.maxX < viewportBounds.minX ||
      bounds.maxY < viewportBounds.minY ||
      bounds.minX > viewportBounds.maxX ||
      bounds.minY > viewportBounds.maxY
    ) {
      droppedStrokeCount += 1;
      continue;
    }
    const simplifiedPoints = simplifyPoints(points, minDistanceSq, maxPointsPerStroke);
    if (simplifiedPoints.length < 2) {
      droppedStrokeCount += 1;
      continue;
    }
    const flatPoints: number[] = [];
    for (const point of simplifiedPoints) {
      const x = (point.x - safeViewportOffset.x) * safeZoom;
      const y = (point.y - safeViewportOffset.y) * safeZoom;
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) continue;
      flatPoints.push(x, y);
    }
    if (flatPoints.length < 4) {
      droppedStrokeCount += 1;
      continue;
    }
    renderedPointCount += flatPoints.length / 2;
    batches.push({
      id: typeof stroke.id === "string" && stroke.id ? stroke.id : `stroke-${batches.length + 1}`,
      color:
        typeof stroke.color === "string" && stroke.color.trim().length > 0
          ? stroke.color
          : "#1f252b",
      width: clampPositive(stroke.width, 2) * safeZoom,
      opacity: resolveWorkbookStrokeOpacity(stroke.tool),
      compositeOperation: resolveWorkbookStrokeCanvasCompositeOperation(stroke.tool),
      points: flatPoints,
    });
  }

  return {
    requestId: payload.requestId,
    batches,
    sourceStrokeCount: payload.strokes.length,
    renderedStrokeCount: batches.length,
    droppedStrokeCount,
    sourcePointCount,
    renderedPointCount,
  };
};

self.onmessage = (event: MessageEvent<RenderPayload>) => {
  const payload = event.data;
  if (!payload || typeof payload !== "object" || !isFiniteNumber(payload.requestId)) return;
  const result = renderPayload(payload);
  self.postMessage(result satisfies RenderResult);
};
