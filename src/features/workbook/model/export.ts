import type { WorkbookBoardObject, WorkbookPoint, WorkbookStroke } from "./types";

export type WorkbookExportBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const EXPORT_PAGE_PORTRAIT_RATIO = 210 / 297;
const EXPORT_PAGE_MIN_WIDTH = 960;
const EXPORT_PAGE_MIN_HEIGHT = Math.round(EXPORT_PAGE_MIN_WIDTH / EXPORT_PAGE_PORTRAIT_RATIO);
const EXPORT_PDF_TILE_DEFAULT_WIDTH = EXPORT_PAGE_MIN_WIDTH;
const EXPORT_PDF_TILE_DEFAULT_OVERLAP = 2;

const getPointsBounds = (points: WorkbookPoint[]): WorkbookExportBounds => {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      width: 1,
      height: 1,
    };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
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

export const padExportBounds = (
  bounds: WorkbookExportBounds,
  padding: number
): WorkbookExportBounds => {
  const safePadding = Math.max(0, padding);
  const minX = bounds.minX - safePadding;
  const minY = bounds.minY - safePadding;
  const maxX = bounds.maxX + safePadding;
  const maxY = bounds.maxY + safePadding;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export const getStrokeExportBounds = (stroke: WorkbookStroke): WorkbookExportBounds | null => {
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) return null;
  const pointsBounds = getPointsBounds(stroke.points);
  const width = Math.max(1, stroke.width ?? 1);
  const halfWidth = width / 2;
  const minX = pointsBounds.minX - halfWidth;
  const minY = pointsBounds.minY - halfWidth;
  const maxX = pointsBounds.maxX + halfWidth;
  const maxY = pointsBounds.maxY + halfWidth;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const rotatePointAroundCenter = (
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

export const getObjectExportBounds = (object: WorkbookBoardObject): WorkbookExportBounds => {
  const left = Math.min(object.x, object.x + object.width);
  const right = Math.max(object.x, object.x + object.width);
  const top = Math.min(object.y, object.y + object.height);
  const bottom = Math.max(object.y, object.y + object.height);
  const center = {
    x: left + (right - left) / 2,
    y: top + (bottom - top) / 2,
  };
  const basePoints: WorkbookPoint[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    ...(Array.isArray(object.points) ? object.points : []),
  ];
  const rotation =
    typeof object.rotation === "number" && Number.isFinite(object.rotation)
      ? object.rotation
      : 0;
  const boundsPoints =
    Math.abs(rotation) > 1e-3
      ? basePoints.map((point) => rotatePointAroundCenter(point, center, rotation))
      : basePoints;
  const baseBounds = getPointsBounds(boundsPoints);
  const strokePadding = Math.max(1, (object.strokeWidth ?? 1) / 2);
  return padExportBounds(baseBounds, strokePadding);
};

export const mergeExportBounds = (
  boundsList: Array<WorkbookExportBounds | null | undefined>
): WorkbookExportBounds | null => {
  const visibleBounds = boundsList.filter(
    (bounds): bounds is WorkbookExportBounds => Boolean(bounds)
  );
  if (visibleBounds.length === 0) return null;
  const minX = Math.min(...visibleBounds.map((bounds) => bounds.minX));
  const minY = Math.min(...visibleBounds.map((bounds) => bounds.minY));
  const maxX = Math.max(...visibleBounds.map((bounds) => bounds.maxX));
  const maxY = Math.max(...visibleBounds.map((bounds) => bounds.maxY));
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export const resolvePortraitExportSize = (width: number, height: number) => {
  let nextWidth = Math.max(EXPORT_PAGE_MIN_WIDTH, Math.ceil(width));
  let nextHeight = Math.max(EXPORT_PAGE_MIN_HEIGHT, Math.ceil(height));
  const currentRatio = nextWidth / nextHeight;
  if (currentRatio > EXPORT_PAGE_PORTRAIT_RATIO) {
    nextHeight = Math.max(nextHeight, Math.ceil(nextWidth / EXPORT_PAGE_PORTRAIT_RATIO));
  } else {
    nextWidth = Math.max(nextWidth, Math.ceil(nextHeight * EXPORT_PAGE_PORTRAIT_RATIO));
  }
  return { width: nextWidth, height: nextHeight };
};

export const fitExportBoundsToPageSize = (
  bounds: WorkbookExportBounds | null,
  size: { width: number; height: number }
): WorkbookExportBounds => {
  if (!bounds) {
    return {
      minX: 0,
      minY: 0,
      maxX: size.width,
      maxY: size.height,
      width: size.width,
      height: size.height,
    };
  }
  const missingWidth = Math.max(0, size.width - bounds.width);
  const missingHeight = Math.max(0, size.height - bounds.height);
  const minX = bounds.minX - missingWidth / 2;
  const minY = bounds.minY - missingHeight / 2;
  const maxX = minX + size.width;
  const maxY = minY + size.height;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: size.width,
    height: size.height,
  };
};

export const resolveWorkbookPdfExportPlan = (
  pages: Array<{ page: number; bounds: WorkbookExportBounds | null }>
) => {
  const canonicalSize = resolvePortraitExportSize(
    Math.max(
      EXPORT_PAGE_MIN_WIDTH,
      ...pages.map((entry) => entry.bounds?.width ?? EXPORT_PAGE_MIN_WIDTH)
    ),
    Math.max(
      EXPORT_PAGE_MIN_HEIGHT,
      ...pages.map((entry) => entry.bounds?.height ?? EXPORT_PAGE_MIN_HEIGHT)
    )
  );
  const fittedBoundsByPage = new Map<number, WorkbookExportBounds>(
    pages.map((entry) => [entry.page, fitExportBoundsToPageSize(entry.bounds, canonicalSize)])
  );
  return {
    canonicalSize,
    fittedBoundsByPage,
  };
};

export const resolvePdfPagePlacement = (params: {
  pageWidth: number;
  pageHeight: number;
  canonicalWidth: number;
  canonicalHeight: number;
  margin?: number;
}) => {
  const margin = Math.max(0, params.margin ?? 30);
  const contentWidth = Math.max(1, params.pageWidth - margin * 2);
  const contentHeight = Math.max(1, params.pageHeight - margin * 2);
  const fittedScale = Math.min(
    contentWidth / Math.max(1, params.canonicalWidth),
    contentHeight / Math.max(1, params.canonicalHeight)
  );
  const drawWidth = Math.max(1, params.canonicalWidth * fittedScale);
  const drawHeight = Math.max(1, params.canonicalHeight * fittedScale);
  return {
    offsetX: (params.pageWidth - drawWidth) / 2,
    offsetY: (params.pageHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
};

export type WorkbookPdfExportTile = {
  row: number;
  column: number;
  index: number;
  bounds: WorkbookExportBounds;
};

const resolveSafeExportBounds = (
  bounds: WorkbookExportBounds | null | undefined
): WorkbookExportBounds => {
  if (!bounds) {
    return {
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      width: 1,
      height: 1,
    };
  }
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const minX = Number.isFinite(bounds.minX) ? bounds.minX : 0;
  const minY = Number.isFinite(bounds.minY) ? bounds.minY : 0;
  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
    width,
    height,
  };
};

const fitExportBoundsToAspectRatio = (
  bounds: WorkbookExportBounds,
  ratio: number
): WorkbookExportBounds => {
  const safeRatio = Math.max(0.001, ratio);
  const currentRatio = bounds.width / bounds.height;
  if (Math.abs(currentRatio - safeRatio) <= 1e-6) {
    return bounds;
  }
  if (currentRatio > safeRatio) {
    const targetHeight = bounds.width / safeRatio;
    const delta = targetHeight - bounds.height;
    const minY = bounds.minY - delta / 2;
    return {
      minX: bounds.minX,
      minY,
      maxX: bounds.maxX,
      maxY: minY + targetHeight,
      width: bounds.width,
      height: targetHeight,
    };
  }
  const targetWidth = bounds.height * safeRatio;
  const delta = targetWidth - bounds.width;
  const minX = bounds.minX - delta / 2;
  return {
    minX,
    minY: bounds.minY,
    maxX: minX + targetWidth,
    maxY: bounds.maxY,
    width: targetWidth,
    height: bounds.height,
  };
};

export const splitExportBoundsToA4Tiles = (params: {
  bounds: WorkbookExportBounds | null | undefined;
  tileWidth?: number;
  overlap?: number;
}): WorkbookPdfExportTile[] => {
  const source = resolveSafeExportBounds(params.bounds);
  const tileWidth = Math.max(1, Math.round(params.tileWidth ?? EXPORT_PDF_TILE_DEFAULT_WIDTH));
  const tileHeight = Math.max(1, Math.round(tileWidth / EXPORT_PAGE_PORTRAIT_RATIO));
  const overlap = Math.max(
    0,
    Math.min(
      Math.round(params.overlap ?? EXPORT_PDF_TILE_DEFAULT_OVERLAP),
      Math.min(tileWidth - 1, tileHeight - 1)
    )
  );

  if (source.width <= tileWidth && source.height <= tileHeight) {
    return [
      {
        row: 0,
        column: 0,
        index: 0,
        bounds: fitExportBoundsToAspectRatio(source, EXPORT_PAGE_PORTRAIT_RATIO),
      },
    ];
  }

  const stepX = Math.max(1, tileWidth - overlap);
  const stepY = Math.max(1, tileHeight - overlap);
  const columns = Math.max(1, Math.ceil((source.width - tileWidth) / stepX) + 1);
  const rows = Math.max(1, Math.ceil((source.height - tileHeight) / stepY) + 1);
  const tiles: WorkbookPdfExportTile[] = [];
  for (let row = 0; row < rows; row += 1) {
    const minY =
      row === rows - 1 ? source.maxY - tileHeight : source.minY + row * stepY;
    for (let column = 0; column < columns; column += 1) {
      const minX =
        column === columns - 1 ? source.maxX - tileWidth : source.minX + column * stepX;
      const width = tileWidth;
      const height = tileHeight;
      tiles.push({
        row,
        column,
        index: row * columns + column,
        bounds: {
          minX,
          minY,
          maxX: minX + width,
          maxY: minY + height,
          width,
          height,
        },
      });
    }
  }
  return tiles;
};
