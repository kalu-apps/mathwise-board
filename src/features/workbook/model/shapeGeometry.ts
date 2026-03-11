import type { WorkbookPoint } from "./types";

export type WorkbookShapeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkbookPolygonPreset =
  | "regular"
  | "trapezoid"
  | "trapezoid_right"
  | "trapezoid_scalene"
  | "rhombus";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeRect = (rect: WorkbookShapeRect): WorkbookShapeRect => {
  const width = Math.abs(rect.width);
  const height = Math.abs(rect.height);
  return {
    x: rect.width >= 0 ? rect.x : rect.x + rect.width,
    y: rect.height >= 0 ? rect.y : rect.y + rect.height,
    width,
    height,
  };
};

const buildParallelBaseQuadrilateral = (
  rect: WorkbookShapeRect,
  config: {
    topWidthRatio: number;
    topOffsetRatio: number;
    bottomWidthRatio?: number;
    bottomOffsetRatio?: number;
  }
): WorkbookPoint[] => {
  const normalized = normalizeRect(rect);
  const bottomWidthRatio = clamp(config.bottomWidthRatio ?? 1, 0.2, 1);
  const topWidthRatio = clamp(config.topWidthRatio, 0.2, 1);
  const bottomOffsetRatio = clamp(
    config.bottomOffsetRatio ?? (1 - bottomWidthRatio) / 2,
    0,
    1 - bottomWidthRatio
  );
  const topOffsetRatio = clamp(config.topOffsetRatio, 0, 1 - topWidthRatio);
  const bottomLeft = normalized.x + normalized.width * bottomOffsetRatio;
  const bottomRight = bottomLeft + normalized.width * bottomWidthRatio;
  const topLeft = normalized.x + normalized.width * topOffsetRatio;
  const topRight = topLeft + normalized.width * topWidthRatio;
  return [
    { x: topLeft, y: normalized.y },
    { x: topRight, y: normalized.y },
    { x: bottomRight, y: normalized.y + normalized.height },
    { x: bottomLeft, y: normalized.y + normalized.height },
  ];
};

const buildShearedRhombus = (
  rect: WorkbookShapeRect,
  shearRatio = 0.36
): WorkbookPoint[] => {
  const normalized = normalizeRect(rect);
  const safeShearRatio = clamp(shearRatio, 0.18, 0.48);
  const side = Math.min(
    normalized.width / (1 + safeShearRatio),
    normalized.height / Math.sqrt(1 - safeShearRatio ** 2)
  );
  const shear = side * safeShearRatio;
  const height = side * Math.sqrt(1 - safeShearRatio ** 2);
  const startX = normalized.x + (normalized.width - (side + shear)) / 2;
  const startY = normalized.y + (normalized.height - height) / 2;
  return [
    { x: startX + shear, y: startY },
    { x: startX + shear + side, y: startY },
    { x: startX + side, y: startY + height },
    { x: startX, y: startY + height },
  ];
};

export const getWorkbookPolygonPoints = (
  rect: WorkbookShapeRect,
  sides: number,
  preset: WorkbookPolygonPreset = "regular"
): WorkbookPoint[] => {
  if (preset === "trapezoid") {
    return buildParallelBaseQuadrilateral(rect, {
      topWidthRatio: 0.56,
      topOffsetRatio: 0.22,
    });
  }
  if (preset === "trapezoid_right") {
    return buildParallelBaseQuadrilateral(rect, {
      topWidthRatio: 0.56,
      topOffsetRatio: 0,
    });
  }
  if (preset === "trapezoid_scalene") {
    return buildParallelBaseQuadrilateral(rect, {
      topWidthRatio: 0.52,
      topOffsetRatio: 0.18,
    });
  }
  if (preset === "rhombus") {
    return buildShearedRhombus(rect);
  }

  const normalized = normalizeRect(rect);
  const cx = normalized.x + normalized.width / 2;
  const cy = normalized.y + normalized.height / 2;
  const radiusX = normalized.width / 2;
  const radiusY = normalized.height / 2;
  const safeSides = Math.max(3, Math.min(12, Math.floor(sides)));
  return Array.from({ length: safeSides }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / safeSides;
    return {
      x: cx + radiusX * Math.cos(angle),
      y: cy + radiusY * Math.sin(angle),
    };
  });
};

export const toSvgPointString = (points: WorkbookPoint[]) =>
  points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
