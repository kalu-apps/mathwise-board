import { generateId } from "@/shared/lib/id";
import type { WorkbookBoardObject, WorkbookPoint, WorkbookStroke } from "./types";

type StrokeBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export type SmartInkRecognitionConfig = {
  smartShapes?: boolean;
  smartTextOcr?: boolean;
  smartMathOcr?: boolean;
  handwritingAdapter?: (input: {
    stroke: WorkbookStroke;
    points: WorkbookPoint[];
    bounds: StrokeBounds;
  }) => Promise<{
    text?: string;
    latex?: string;
    confidence?: number;
  } | null>;
};

export type SmartInkRecognitionResult =
  | {
      kind: "shape";
      object: WorkbookBoardObject;
      confidence: number;
    }
  | {
      kind: "text";
      object: WorkbookBoardObject;
      confidence: number;
    }
  | {
      kind: "formula";
      object: WorkbookBoardObject;
      confidence: number;
    }
  | { kind: "none" };

export type SmartInkDetectedResult = Exclude<SmartInkRecognitionResult, { kind: "none" }>;

const distance = (a: WorkbookPoint, b: WorkbookPoint) => Math.hypot(a.x - b.x, a.y - b.y);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const SMART_INK_SHAPE_CONFIDENCE = {
  triangle: 0.78,
  rectangle: 0.82,
  ellipse: 0.8,
  polygon: 0.68,
} as const;

const SMART_INK_OCR_CONFIDENCE_FALLBACK = {
  formula: 0.6,
  text: 0.56,
} as const;

const SMART_INK_SHAPE_SAMPLE_LIMIT = 140;
const SMART_INK_ELLIPSE_IDEAL_AREA_RATIO = Math.PI / 4;

const resolveConfidence = (source: unknown, fallback: number) => {
  if (typeof source === "number" && Number.isFinite(source)) {
    return clamp(source, 0.01, 0.99);
  }
  return fallback;
};

const getBounds = (points: WorkbookPoint[]): StrokeBounds => {
  let minX = points[0]?.x ?? 0;
  let minY = points[0]?.y ?? 0;
  let maxX = points[0]?.x ?? 0;
  let maxY = points[0]?.y ?? 0;
  points.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  });
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
};

const pathLength = (points: WorkbookPoint[]) => {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }
  return length;
};

const dedupePoints = (points: WorkbookPoint[], minDistance = 1.1) => {
  if (points.length <= 1) return points;
  const output: WorkbookPoint[] = [points[0]];
  points.forEach((point) => {
    const previous = output[output.length - 1];
    if (!previous || distance(previous, point) >= minDistance) {
      output.push(point);
    }
  });
  return output;
};

const downsamplePoints = (points: WorkbookPoint[], maxPoints: number) => {
  if (points.length <= maxPoints || maxPoints <= 2) return points;
  const output: WorkbookPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  let lastIndex = -1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round(index * step);
    if (sourceIndex === lastIndex) continue;
    output.push(points[sourceIndex]);
    lastIndex = sourceIndex;
  }
  const lastPoint = points[points.length - 1];
  if (output[output.length - 1] !== lastPoint) {
    output.push(lastPoint);
  }
  return output;
};

const perpendicularDistance = (point: WorkbookPoint, start: WorkbookPoint, end: WorkbookPoint) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return distance(point, start);
  }
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const projected = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
  return distance(point, projected);
};

const simplifyRdp = (points: WorkbookPoint[], epsilon: number): WorkbookPoint[] => {
  if (points.length < 3) return points;
  const start = points[0];
  const end = points[points.length - 1];
  let maxDistance = 0;
  let splitIndex = -1;

  for (let index = 1; index < points.length - 1; index += 1) {
    const currentDistance = perpendicularDistance(points[index], start, end);
    if (currentDistance > maxDistance) {
      maxDistance = currentDistance;
      splitIndex = index;
    }
  }

  if (maxDistance <= epsilon || splitIndex <= 0) {
    return [start, end];
  }

  const left = simplifyRdp(points.slice(0, splitIndex + 1), epsilon);
  const right = simplifyRdp(points.slice(splitIndex), epsilon);
  return [...left.slice(0, -1), ...right];
};

const polygonArea = (points: WorkbookPoint[]) => {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
};

const toVector = (from: WorkbookPoint, to: WorkbookPoint) => ({
  x: to.x - from.x,
  y: to.y - from.y,
});

const normalizeVector = (vector: { x: number; y: number }) => {
  const len = Math.hypot(vector.x, vector.y);
  if (len < 1e-6) return { x: 0, y: 0, len: 0 };
  return { x: vector.x / len, y: vector.y / len, len };
};

const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

const estimateAngularCoverage = (points: WorkbookPoint[], center: { x: number; y: number }) => {
  const bins = 24;
  const visited = new Set<number>();
  points.forEach((point) => {
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
    const bucket = Math.min(
      bins - 1,
      Math.max(0, Math.floor((normalized / (Math.PI * 2)) * bins))
    );
    visited.add(bucket);
  });
  return visited.size / bins;
};

const isRectangleLike = (points: WorkbookPoint[], bounds: StrokeBounds) => {
  if (points.length !== 4) return false;
  const minSide = Math.max(6, Math.min(bounds.width, bounds.height) * 0.16);
  const vectors = points.map((point, index) => toVector(point, points[(index + 1) % points.length]));
  const lengths = vectors.map((vector) => Math.hypot(vector.x, vector.y));
  if (lengths.some((value) => value < minSide)) return false;
  for (let index = 0; index < vectors.length; index += 1) {
    const current = normalizeVector(vectors[index]);
    const next = normalizeVector(vectors[(index + 1) % vectors.length]);
    const cosine = Math.abs(dot(current, next));
    if (cosine > 0.34) {
      return false;
    }
  }
  return true;
};

const isEllipseLike = (
  points: WorkbookPoint[],
  bounds: StrokeBounds
): { matched: boolean; confidence: number } => {
  if (points.length < 5) return { matched: false, confidence: 0 };
  if (bounds.width < 12 || bounds.height < 12) return { matched: false, confidence: 0 };
  const center = { x: bounds.centerX, y: bounds.centerY };
  const radiusX = Math.max(1, bounds.width / 2);
  const radiusY = Math.max(1, bounds.height / 2);
  const aspectRatio =
    Math.min(bounds.width, bounds.height) / Math.max(1, Math.max(bounds.width, bounds.height));
  const normalizedDistances = points.map((point) =>
    Math.hypot((point.x - center.x) / radiusX, (point.y - center.y) / radiusY)
  );
  const mean =
    normalizedDistances.reduce((sum, value) => sum + value, 0) / normalizedDistances.length;
  const variance =
    normalizedDistances.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    normalizedDistances.length;
  const std = Math.sqrt(variance);
  const outlierRatio =
    normalizedDistances.filter((value) => Math.abs(value - mean) > 0.44).length /
    normalizedDistances.length;
  const boxArea = Math.max(1, bounds.width * bounds.height);
  const contourAreaRatio = polygonArea(points) / boxArea;
  const angularCoverage = estimateAngularCoverage(points, center);
  const stdScore = clamp(1 - std / 0.31, 0, 1);
  const areaScore = clamp(
    1 - Math.abs(contourAreaRatio - SMART_INK_ELLIPSE_IDEAL_AREA_RATIO) / 0.36,
    0,
    1
  );
  const coverageScore = clamp((angularCoverage - 0.54) / 0.46, 0, 1);
  const outlierScore = clamp(1 - outlierRatio / 0.3, 0, 1);
  const aspectScore = clamp((aspectRatio - 0.16) / 0.38, 0, 1);
  const confidence = clamp(
    0.49 +
      stdScore * 0.2 +
      areaScore * 0.16 +
      coverageScore * 0.16 +
      outlierScore * 0.12 +
      aspectScore * 0.1,
    0.56,
    0.97
  );
  const matched =
    std <= 0.34 &&
    contourAreaRatio >= 0.42 &&
    contourAreaRatio <= 0.95 &&
    angularCoverage >= 0.6 &&
    outlierRatio <= 0.28 &&
    aspectRatio >= 0.16;
  return {
    matched,
    confidence,
  };
};

const createBaseObject = (
  stroke: WorkbookStroke,
  patch: Partial<WorkbookBoardObject>
): WorkbookBoardObject => ({
  id: generateId(),
  type: "line",
  layer: stroke.layer,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  color: stroke.color,
  strokeWidth: stroke.width,
  authorUserId: stroke.authorUserId,
  createdAt: new Date().toISOString(),
  ...patch,
});

const normalizePolygonVertices = (points: WorkbookPoint[]) => {
  if (points.length < 2) return points;
  const output = [...points];
  const first = output[0];
  const last = output[output.length - 1];
  if (distance(first, last) <= 8) {
    output.pop();
  }
  return output;
};

const detectSmartShape = (stroke: WorkbookStroke): SmartInkRecognitionResult => {
  const deduped = dedupePoints(stroke.points);
  if (deduped.length < 2) {
    return { kind: "none" };
  }
  const sampled = downsamplePoints(deduped, SMART_INK_SHAPE_SAMPLE_LIMIT);
  const points = sampled.length >= 2 ? sampled : deduped;
  const bounds = getBounds(points);
  const diagonal = Math.hypot(bounds.width, bounds.height);
  const length = pathLength(points);
  if (length < 18) {
    return { kind: "none" };
  }
  const start = points[0];
  const end = points[points.length - 1];
  const center = { x: bounds.centerX, y: bounds.centerY };
  const angularCoverage = estimateAngularCoverage(points, center);
  const closeThreshold = Math.max(
    10,
    diagonal * 0.26,
    Math.min(bounds.width, bounds.height) * 0.32
  );
  const expandedCloseThreshold = Math.max(
    closeThreshold,
    diagonal * 0.48,
    Math.min(bounds.width, bounds.height) * 0.58
  );
  const endGap = distance(start, end);
  const loopByCoverage = angularCoverage >= 0.72 && length >= Math.max(26, diagonal * 2.05);
  const isClosed = endGap <= closeThreshold || (endGap <= expandedCloseThreshold && loopByCoverage);
  const epsilon = clamp(diagonal * (isClosed ? 0.028 : 0.035), 2, 16);
  const simplifiedRaw = simplifyRdp(points, epsilon);
  const simplified = isClosed ? normalizePolygonVertices(simplifiedRaw) : simplifiedRaw;
  const maxDeviationFromLine = points.reduce((max, point) => {
    const value = perpendicularDistance(point, start, end);
    return value > max ? value : max;
  }, 0);

  const lineDeviationScore = maxDeviationFromLine / Math.max(14, diagonal);
  if (!isClosed && lineDeviationScore <= 0.08) {
    const candidate = createBaseObject(stroke, {
      type: "line",
      x: start.x,
      y: start.y,
      width: end.x - start.x,
      height: end.y - start.y,
      meta: {
        lineKind: "line",
        lineStyle: "solid",
        smartInk: true,
      },
    });
    return {
      kind: "shape",
      object: candidate,
      confidence: clamp(1 - lineDeviationScore * 2.7, 0.56, 0.98),
    };
  }

  if (isClosed && simplified.length >= 3) {
    const ellipseMatch = isEllipseLike(points, bounds);
    if (ellipseMatch.matched) {
      return {
        kind: "shape",
        object: createBaseObject(stroke, {
          type: "ellipse",
          x: bounds.minX,
          y: bounds.minY,
          width: Math.max(1, bounds.width),
          height: Math.max(1, bounds.height),
          meta: {
            showLabels: true,
            smartInk: true,
          },
        }),
        confidence: ellipseMatch.confidence,
      };
    }
    if (simplified.length === 3) {
      const polygonBounds = getBounds(simplified);
      return {
        kind: "shape",
        object: createBaseObject(stroke, {
          type: "triangle",
          x: polygonBounds.minX,
          y: polygonBounds.minY,
          width: Math.max(1, polygonBounds.width),
          height: Math.max(1, polygonBounds.height),
          points: simplified,
          meta: {
            showLabels: true,
            smartInk: true,
          },
        }),
        confidence: SMART_INK_SHAPE_CONFIDENCE.triangle,
      };
    }
    if (simplified.length === 4 && isRectangleLike(simplified, bounds)) {
      return {
        kind: "shape",
        object: createBaseObject(stroke, {
          type: "rectangle",
          x: bounds.minX,
          y: bounds.minY,
          width: Math.max(1, bounds.width),
          height: Math.max(1, bounds.height),
          meta: {
            showLabels: true,
            smartInk: true,
          },
        }),
        confidence: SMART_INK_SHAPE_CONFIDENCE.rectangle,
      };
    }
    if (simplified.length >= 5 && simplified.length <= 10) {
      const polygonBounds = getBounds(simplified);
      return {
        kind: "shape",
        object: createBaseObject(stroke, {
          type: "polygon",
          x: polygonBounds.minX,
          y: polygonBounds.minY,
          width: Math.max(1, polygonBounds.width),
          height: Math.max(1, polygonBounds.height),
          points: simplified,
          sides: simplified.length,
          meta: {
            showLabels: true,
            smartInk: true,
          },
        }),
        confidence: SMART_INK_SHAPE_CONFIDENCE.polygon,
      };
    }
  }

  return { kind: "none" };
};

const looksLikeFormula = (value: string) =>
  /[=+\-*/^_()√π∫∑<>]|(?:\d+\s*[a-zA-Z])|(?:[a-zA-Z]\s*\()/.test(value);

const buildTextOrFormulaObject = (
  stroke: WorkbookStroke,
  bounds: StrokeBounds,
  text: string,
  latex?: string,
  adapterConfidence?: number
): SmartInkRecognitionResult => {
  const trimmed = text.trim();
  if (!trimmed && !latex?.trim()) return { kind: "none" };
  const isFormula = Boolean((latex && latex.trim()) || looksLikeFormula(trimmed));
  if (isFormula) {
    return {
      kind: "formula",
      confidence: resolveConfidence(
        adapterConfidence,
        SMART_INK_OCR_CONFIDENCE_FALLBACK.formula
      ),
      object: createBaseObject(stroke, {
        type: "formula",
        x: bounds.minX,
        y: bounds.minY,
        width: Math.max(92, bounds.width),
        height: Math.max(42, bounds.height),
        text: trimmed || latex || "f(x)",
        meta: {
          latex: latex?.trim() || "",
          smartInk: true,
        },
      }),
    };
  }
  return {
    kind: "text",
    confidence: resolveConfidence(adapterConfidence, SMART_INK_OCR_CONFIDENCE_FALLBACK.text),
    object: createBaseObject(stroke, {
      type: "text",
      x: bounds.minX,
      y: bounds.minY,
      width: Math.max(82, bounds.width),
      height: Math.max(30, bounds.height),
      text: trimmed,
      fontSize: 18,
      meta: {
        smartInk: true,
      },
    }),
  };
};

export async function recognizeSmartInkStroke(
  stroke: WorkbookStroke,
  config?: SmartInkRecognitionConfig
): Promise<SmartInkRecognitionResult> {
  if (!stroke.points.length) return { kind: "none" };
  const points = dedupePoints(stroke.points);
  const bounds = getBounds(points);
  const smartShapes = config?.smartShapes !== false;
  const smartTextOcr = Boolean(config?.smartTextOcr);
  const smartMathOcr = Boolean(config?.smartMathOcr);

  if (smartShapes) {
    const shapeResult = detectSmartShape({ ...stroke, points });
    if (shapeResult.kind !== "none") return shapeResult;
  }

  if ((smartTextOcr || smartMathOcr) && config?.handwritingAdapter) {
    try {
      const ocr = await config.handwritingAdapter({
        stroke,
        points,
        bounds,
      });
      if (ocr) {
        return buildTextOrFormulaObject(
          stroke,
          bounds,
          ocr.text ?? "",
          smartMathOcr ? ocr.latex : undefined,
          ocr.confidence
        );
      }
    } catch {
      return { kind: "none" };
    }
  }

  return { kind: "none" };
}

export async function recognizeSmartInkBatch(
  strokes: WorkbookStroke[],
  config?: SmartInkRecognitionConfig
): Promise<SmartInkRecognitionResult> {
  if (!strokes.length) return { kind: "none" };
  if (strokes.length === 1) {
    return recognizeSmartInkStroke(strokes[0], config);
  }
  const points = dedupePoints(
    strokes.flatMap((stroke) => stroke.points),
    0.8
  );
  if (!points.length) return { kind: "none" };
  const bounds = getBounds(points);
  const smartTextOcr = Boolean(config?.smartTextOcr);
  const smartMathOcr = Boolean(config?.smartMathOcr);
  if ((smartTextOcr || smartMathOcr) && config?.handwritingAdapter) {
    try {
      const ocr = await config.handwritingAdapter({
        stroke: {
          ...strokes[strokes.length - 1],
          points,
        },
        points,
        bounds,
      });
      if (ocr) {
        return buildTextOrFormulaObject(
          strokes[strokes.length - 1],
          bounds,
          ocr.text ?? "",
          smartMathOcr ? ocr.latex : undefined,
          ocr.confidence
        );
      }
    } catch {
      return { kind: "none" };
    }
  }
  return { kind: "none" };
}
