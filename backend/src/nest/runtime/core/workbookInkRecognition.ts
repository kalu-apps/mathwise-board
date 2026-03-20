type InkPoint = {
  x: number;
  y: number;
};

type InkStrokeInput = {
  points: InkPoint[];
};

type InkBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type InkToken = {
  strokes: InkStrokeInput[];
  bounds: InkBounds;
};

type InkTemplate = {
  symbol: string;
  points: InkPoint[];
};

type RecognizeInkParams = {
  strokes: InkStrokeInput[];
  preferMath: boolean;
};

type RecognizeInkResult = {
  text?: string;
  latex?: string;
  confidence?: number;
} | null;

const TEMPLATE_SAMPLE_POINTS = 48;
const DEFAULT_RECOGNITION_THRESHOLD = 0.44;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const distance = (a: InkPoint, b: InkPoint) => Math.hypot(a.x - b.x, a.y - b.y);

const overlap1d = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const gap1d = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.max(aStart, bStart) - Math.min(aEnd, bEnd));

const computeBounds = (points: InkPoint[]): InkBounds => {
  let minX = points[0]?.x ?? 0;
  let minY = points[0]?.y ?? 0;
  let maxX = points[0]?.x ?? 0;
  let maxY = points[0]?.y ?? 0;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  const width = Math.max(1e-3, maxX - minX);
  const height = Math.max(1e-3, maxY - minY);
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

const dedupePoints = (points: InkPoint[], minDistance = 0.8): InkPoint[] => {
  if (points.length <= 1) return points;
  const output: InkPoint[] = [points[0]];
  for (const point of points) {
    const previous = output[output.length - 1];
    if (!previous || distance(previous, point) >= minDistance) {
      output.push(point);
    }
  }
  return output;
};

const pathLength = (points: InkPoint[]) => {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }
  return length;
};

const resamplePath = (points: InkPoint[], sampleCount: number): InkPoint[] => {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: sampleCount }, () => points[0]);
  const totalLength = pathLength(points);
  if (totalLength <= 1e-6) return Array.from({ length: sampleCount }, () => points[0]);

  const spacing = totalLength / Math.max(1, sampleCount - 1);
  const output: InkPoint[] = [points[0]];
  let accumulated = 0;
  let previous = points[0];
  let index = 1;

  while (index < points.length) {
    const current = points[index];
    const segment = distance(previous, current);
    if (segment <= 1e-8) {
      index += 1;
      continue;
    }
    if (accumulated + segment >= spacing) {
      const ratio = (spacing - accumulated) / segment;
      const nextPoint = {
        x: previous.x + ratio * (current.x - previous.x),
        y: previous.y + ratio * (current.y - previous.y),
      };
      output.push(nextPoint);
      previous = nextPoint;
      accumulated = 0;
      continue;
    }
    accumulated += segment;
    previous = current;
    index += 1;
  }

  while (output.length < sampleCount) {
    output.push(points[points.length - 1]);
  }
  if (output.length > sampleCount) {
    output.length = sampleCount;
  }
  return output;
};

const centroid = (points: InkPoint[]) => {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return {
    x: x / Math.max(1, points.length),
    y: y / Math.max(1, points.length),
  };
};

const rotateToZero = (points: InkPoint[]) => {
  if (points.length === 0) return points;
  const center = centroid(points);
  const first = points[0];
  const angle = Math.atan2(first.y - center.y, first.x - center.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: dx * cos - dy * sin + center.x,
      y: dx * sin + dy * cos + center.y,
    };
  });
};

const scaleToUnitSquare = (points: InkPoint[]) => {
  const bounds = computeBounds(points);
  const scale = Math.max(bounds.width, bounds.height);
  return points.map((point) => ({
    x: (point.x - bounds.centerX) / scale,
    y: (point.y - bounds.centerY) / scale,
  }));
};

const normalizePath = (points: InkPoint[]) => {
  const sampled = resamplePath(dedupePoints(points), TEMPLATE_SAMPLE_POINTS);
  const rotated = rotateToZero(sampled);
  return scaleToUnitSquare(rotated);
};

const pathDistance = (left: InkPoint[], right: InkPoint[]) => {
  const size = Math.min(left.length, right.length);
  if (size === 0) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let index = 0; index < size; index += 1) {
    total += distance(left[index], right[index]);
  }
  return total / size;
};

const rawTemplate = (symbol: string, points: Array<[number, number]>) => ({
  symbol,
  points: points.map(([x, y]) => ({ x, y })),
});

const RAW_TEMPLATES = [
  rawTemplate("0", [[20, 14], [50, 8], [80, 14], [90, 50], [80, 86], [50, 92], [20, 86], [10, 50], [20, 14]]),
  rawTemplate("1", [[44, 20], [55, 10], [55, 92], [38, 92], [72, 92]]),
  rawTemplate("2", [[14, 24], [34, 10], [72, 10], [86, 24], [80, 46], [20, 90], [86, 90]]),
  rawTemplate("3", [[20, 16], [74, 16], [56, 42], [78, 44], [86, 68], [72, 88], [20, 88]]),
  rawTemplate("4", [[76, 12], [76, 90], [18, 58], [90, 58]]),
  rawTemplate("5", [[84, 12], [24, 12], [20, 50], [66, 50], [84, 62], [74, 90], [18, 90]]),
  rawTemplate("6", [[80, 18], [40, 20], [22, 46], [26, 76], [44, 92], [72, 86], [82, 68], [72, 50], [44, 50], [26, 64]]),
  rawTemplate("7", [[14, 12], [88, 12], [50, 90]]),
  rawTemplate("8", [[50, 8], [74, 20], [74, 40], [50, 52], [26, 40], [26, 20], [50, 8], [50, 52], [74, 66], [74, 86], [50, 98], [26, 86], [26, 66], [50, 52]]),
  rawTemplate("9", [[78, 54], [56, 52], [34, 42], [28, 24], [38, 10], [60, 8], [78, 18], [82, 42], [68, 70], [42, 90], [22, 90]]),
  rawTemplate("+", [[50, 10], [50, 90], [14, 50], [86, 50]]),
  rawTemplate("-", [[12, 52], [88, 52]]),
  rawTemplate("=", [[14, 36], [86, 36], [14, 66], [86, 66]]),
  rawTemplate("/", [[78, 12], [22, 90]]),
  rawTemplate("*", [[50, 14], [50, 86], [18, 30], [82, 70], [18, 70], [82, 30]]),
  rawTemplate("^", [[18, 70], [50, 26], [82, 70]]),
  rawTemplate("(", [[68, 12], [48, 24], [34, 48], [34, 56], [48, 80], [68, 92]]),
  rawTemplate(")", [[32, 12], [52, 24], [66, 48], [66, 56], [52, 80], [32, 92]]),
  rawTemplate(".", [[50, 84], [52, 86]]),
  rawTemplate("x", [[18, 18], [82, 82], [50, 50], [82, 18], [18, 82]]),
  rawTemplate("y", [[18, 20], [50, 52], [82, 20], [50, 52], [50, 92]]),
  rawTemplate("z", [[18, 20], [84, 20], [20, 82], [86, 82]]),
  rawTemplate("a", [[20, 66], [34, 48], [60, 46], [74, 62], [70, 82], [50, 92], [30, 84], [20, 66], [72, 46], [72, 92]]),
  rawTemplate("b", [[24, 10], [24, 92], [54, 92], [74, 76], [74, 58], [56, 46], [24, 50]]),
  rawTemplate("c", [[78, 22], [50, 12], [24, 22], [14, 50], [24, 78], [50, 88], [78, 78]]),
  rawTemplate("m", [[16, 86], [16, 38], [34, 30], [48, 40], [48, 86], [48, 40], [64, 30], [80, 40], [80, 86]]),
  rawTemplate("n", [[20, 86], [20, 36], [38, 30], [56, 40], [56, 86]]),
  rawTemplate("t", [[50, 12], [50, 88], [24, 36], [76, 36]]),
  rawTemplate("√", [[18, 58], [30, 74], [40, 42], [56, 86], [84, 18]]),
];

const INK_TEMPLATES: InkTemplate[] = RAW_TEMPLATES.map((template) => ({
  symbol: template.symbol,
  points: normalizePath(template.points),
}));

const isMostlyLine = (points: InkPoint[]) => {
  if (points.length < 2) return false;
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return false;
  let maxDeviation = 0;
  for (const point of points) {
    const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length);
    const projected = { x: start.x + projection * dx, y: start.y + projection * dy };
    maxDeviation = Math.max(maxDeviation, distance(point, projected));
  }
  return maxDeviation <= Math.max(4, length * 0.1);
};

const strokeAngleDeg = (points: InkPoint[]) => {
  if (points.length < 2) return 0;
  const start = points[0];
  const end = points[points.length - 1];
  return (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
};

const normalizeAngle = (angle: number) => {
  let normalized = angle;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
};

const tryRecognizeByLineHeuristics = (token: InkToken): { symbol: string; confidence: number } | null => {
  if (token.strokes.length !== 2) return null;
  const [leftStroke, rightStroke] = token.strokes;
  if (!isMostlyLine(leftStroke.points) || !isMostlyLine(rightStroke.points)) return null;

  const leftAngle = normalizeAngle(strokeAngleDeg(leftStroke.points));
  const rightAngle = normalizeAngle(strokeAngleDeg(rightStroke.points));
  const leftBounds = computeBounds(leftStroke.points);
  const rightBounds = computeBounds(rightStroke.points);
  const xOverlap = overlap1d(leftBounds.minX, leftBounds.maxX, rightBounds.minX, rightBounds.maxX);
  const yOverlap = overlap1d(leftBounds.minY, leftBounds.maxY, rightBounds.minY, rightBounds.maxY);
  const centerGapY = Math.abs(leftBounds.centerY - rightBounds.centerY);

  const leftHorizontal = Math.abs(leftAngle) <= 24 || Math.abs(Math.abs(leftAngle) - 180) <= 24;
  const rightHorizontal = Math.abs(rightAngle) <= 24 || Math.abs(Math.abs(rightAngle) - 180) <= 24;
  const leftVertical = Math.abs(Math.abs(leftAngle) - 90) <= 22;
  const rightVertical = Math.abs(Math.abs(rightAngle) - 90) <= 22;
  const leftDiag = Math.abs(Math.abs(leftAngle) - 45) <= 24 || Math.abs(Math.abs(leftAngle) - 135) <= 24;
  const rightDiag = Math.abs(Math.abs(rightAngle) - 45) <= 24 || Math.abs(Math.abs(rightAngle) - 135) <= 24;

  if (
    leftHorizontal &&
    rightHorizontal &&
    xOverlap >= Math.min(leftBounds.width, rightBounds.width) * 0.35 &&
    centerGapY >= 3 &&
    centerGapY <= 22
  ) {
    return { symbol: "=", confidence: 0.9 };
  }

  if (
    ((leftHorizontal && rightVertical) || (leftVertical && rightHorizontal)) &&
    xOverlap > 0 &&
    yOverlap > 0
  ) {
    return { symbol: "+", confidence: 0.88 };
  }

  if (leftDiag && rightDiag && xOverlap > 0 && yOverlap > 0) {
    const oppositeSigns = Math.sign(leftAngle || 1) !== Math.sign(rightAngle || -1);
    if (oppositeSigns) {
      return { symbol: "x", confidence: 0.86 };
    }
  }

  return null;
};

const shouldMergeStrokes = (left: InkBounds, right: InkBounds) => {
  const xOverlap = overlap1d(left.minX, left.maxX, right.minX, right.maxX);
  const yOverlap = overlap1d(left.minY, left.maxY, right.minY, right.maxY);
  const xGap = gap1d(left.minX, left.maxX, right.minX, right.maxX);
  const yGap = gap1d(left.minY, left.maxY, right.minY, right.maxY);

  if (xOverlap > 0 && yGap <= 12) return true;
  if (yOverlap > 0 && xGap <= 8) return true;
  if (xGap <= 5 && yGap <= 5) return true;
  if (xOverlap >= Math.min(left.width, right.width) * 0.45 && yGap <= 18) return true;
  return false;
};

const mergeStrokeTokens = (strokes: InkStrokeInput[]): InkToken[] => {
  if (strokes.length === 0) return [];
  const bounds = strokes.map((stroke) => computeBounds(stroke.points));
  const parent = Array.from({ length: strokes.length }, (_, index) => index);

  const find = (index: number): number => {
    if (parent[index] === index) return index;
    parent[index] = find(parent[index]);
    return parent[index];
  };

  const union = (leftIndex: number, rightIndex: number) => {
    const leftRoot = find(leftIndex);
    const rightRoot = find(rightIndex);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };

  for (let left = 0; left < strokes.length; left += 1) {
    for (let right = left + 1; right < strokes.length; right += 1) {
      if (shouldMergeStrokes(bounds[left], bounds[right])) {
        union(left, right);
      }
    }
  }

  const clusters = new Map<number, InkStrokeInput[]>();
  for (let index = 0; index < strokes.length; index += 1) {
    const root = find(index);
    const bucket = clusters.get(root) ?? [];
    bucket.push(strokes[index]);
    clusters.set(root, bucket);
  }

  return Array.from(clusters.values())
    .map((cluster) => {
      const tokenPoints = cluster.flatMap((stroke) => stroke.points);
      return {
        strokes: cluster,
        bounds: computeBounds(tokenPoints),
      };
    })
    .sort((left, right) =>
      left.bounds.minX === right.bounds.minX
        ? left.bounds.minY - right.bounds.minY
        : left.bounds.minX - right.bounds.minX
    );
};

const recognizeToken = (token: InkToken): { symbol: string; confidence: number } | null => {
  const heuristic = tryRecognizeByLineHeuristics(token);
  if (heuristic) return heuristic;

  const mergedPoints = dedupePoints(token.strokes.flatMap((stroke) => stroke.points), 0.7);
  if (mergedPoints.length < 2) {
    const dotLike = Math.max(token.bounds.width, token.bounds.height) <= 8;
    return dotLike ? { symbol: ".", confidence: 0.65 } : null;
  }
  const normalized = normalizePath(mergedPoints);
  if (normalized.length === 0) return null;

  let bestTemplate: InkTemplate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const template of INK_TEMPLATES) {
    const currentDistance = pathDistance(normalized, template.points);
    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      bestTemplate = template;
    }
  }

  if (!bestTemplate || !Number.isFinite(bestDistance)) return null;
  const confidence = clamp(1 - bestDistance / 0.72, 0.01, 0.99);
  if (confidence < DEFAULT_RECOGNITION_THRESHOLD) return null;
  return { symbol: bestTemplate.symbol, confidence };
};

const isFormulaLikeText = (value: string) =>
  /[=+\-*/^_()√]|\d/.test(value) || /[a-zA-Z]\d|\d[a-zA-Z]/.test(value);

const escapeLatexToken = (token: string) => {
  if (token === "\\") return "\\backslash";
  if (token === "{") return "\\{";
  if (token === "}") return "\\}";
  return token;
};

const toLatex = (tokens: string[]) => {
  let output = "";
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if ((token === "^" || token === "_") && tokens[index + 1]) {
      output += `${token}{${escapeLatexToken(tokens[index + 1])}}`;
      index += 1;
      continue;
    }
    if (token === "*") {
      output += "\\cdot ";
      continue;
    }
    if (token === "√") {
      if (tokens[index + 1]) {
        output += `\\sqrt{${escapeLatexToken(tokens[index + 1])}}`;
        index += 1;
      } else {
        output += "\\sqrt{}";
      }
      continue;
    }
    output += escapeLatexToken(token);
  }
  return output.trim();
};

const sanitizeStroke = (input: InkStrokeInput): InkStrokeInput | null => {
  const points = Array.isArray(input.points)
    ? input.points
        .map((point) => ({
          x: Number(point.x),
          y: Number(point.y),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  if (points.length < 2) return null;
  const deduped = dedupePoints(points);
  if (deduped.length < 2 || pathLength(deduped) < 6) return null;
  return { points: deduped };
};

export const recognizeWorkbookInkLocal = (params: RecognizeInkParams): RecognizeInkResult => {
  const preparedStrokes = params.strokes
    .map(sanitizeStroke)
    .filter((stroke): stroke is InkStrokeInput => Boolean(stroke));
  if (preparedStrokes.length === 0) return null;

  const tokens = mergeStrokeTokens(preparedStrokes);
  if (tokens.length === 0) return null;

  const recognized = tokens
    .map((token) => recognizeToken(token))
    .filter((token): token is { symbol: string; confidence: number } => Boolean(token));
  if (recognized.length === 0) return null;

  const text = recognized.map((token) => token.symbol).join("").trim();
  if (!text) return null;

  const avgConfidence =
    recognized.reduce((sum, token) => sum + token.confidence, 0) / recognized.length;
  const confidence = clamp(avgConfidence, 0.01, 0.99);
  if (confidence < DEFAULT_RECOGNITION_THRESHOLD) return null;

  const shouldEmitLatex = params.preferMath && isFormulaLikeText(text);
  return {
    text,
    latex: shouldEmitLatex ? toLatex(recognized.map((token) => token.symbol)) : undefined,
    confidence,
  };
};
