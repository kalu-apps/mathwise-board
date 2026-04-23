import type { WorkbookPoint, WorkbookStroke } from "./types";

// Keep preview payload bounded, but preserve enough head/tail context so long strokes
// do not visually "rewrite" the beginning while the user is still drawing.
const STROKE_PREVIEW_MAX_POINTS = 288;
const STROKE_PREVIEW_PINNED_HEAD_POINTS = 128;
const STROKE_PREVIEW_PINNED_TAIL_POINTS = 96;
const STROKE_PREVIEW_POINT_MERGE_EPSILON = 0.01;

const clampIndex = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const dedupeAdjacentPreviewPoints = (points: WorkbookPoint[]) => {
  if (points.length <= 1) return [...points];
  const output: WorkbookPoint[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const previous = output[output.length - 1];
    if (
      previous &&
      Math.hypot(point.x - previous.x, point.y - previous.y) < STROKE_PREVIEW_POINT_MERGE_EPSILON
    ) {
      continue;
    }
    output.push(point);
  }
  return output;
};

const samplePointRangeByBudget = (
  points: WorkbookPoint[],
  start: number,
  end: number,
  budget: number
) => {
  if (budget <= 0 || end <= start) return [] as WorkbookPoint[];
  const span = end - start;
  if (span <= budget) {
    return points.slice(start, end);
  }
  const stride = span / budget;
  const sampled: WorkbookPoint[] = [];
  let previousIndex = -1;
  for (let slot = 0; slot < budget; slot += 1) {
    const rawIndex = Math.floor(start + slot * stride);
    const index = clampIndex(rawIndex, start, end - 1);
    if (index === previousIndex) continue;
    sampled.push(points[index]);
    previousIndex = index;
  }
  return sampled;
};

export const toPath = (points: WorkbookPoint[]) => {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [single] = points;
    return `M ${single.x} ${single.y} L ${single.x + 0.01} ${single.y + 0.01}`;
  }
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
};

export const toSmoothPath = (points: WorkbookPoint[]) => {
  if (points.length <= 2) return toPath(points);
  const midpoints = Array.from({ length: points.length - 1 }, (_, index) => ({
    x: (points[index].x + points[index + 1].x) / 2,
    y: (points[index].y + points[index + 1].y) / 2,
  }));
  const commands = [`M ${points[0].x} ${points[0].y}`];
  commands.push(`Q ${points[0].x} ${points[0].y} ${midpoints[0].x} ${midpoints[0].y}`);
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const midpoint = midpoints[index];
    commands.push(`Q ${point.x} ${point.y} ${midpoint.x} ${midpoint.y}`);
  }
  const lastPoint = points[points.length - 1];
  commands.push(`L ${lastPoint.x} ${lastPoint.y}`);
  return commands.join(" ");
};

export const buildStrokePreviewPoints = (points: WorkbookPoint[]) => {
  if (points.length <= STROKE_PREVIEW_MAX_POINTS) {
    return [...points];
  }
  const maxPoints = STROKE_PREVIEW_MAX_POINTS;
  const desiredHead = Math.min(STROKE_PREVIEW_PINNED_HEAD_POINTS, points.length);
  const desiredTail = Math.min(
    STROKE_PREVIEW_PINNED_TAIL_POINTS,
    Math.max(1, points.length - desiredHead)
  );
  let headCount = desiredHead;
  let tailCount = desiredTail;
  if (headCount + tailCount > maxPoints) {
    const overflow = headCount + tailCount - maxPoints;
    tailCount = Math.max(1, tailCount - overflow);
    if (headCount + tailCount > maxPoints) {
      headCount = Math.max(1, maxPoints - tailCount);
    }
  }

  const middleStart = headCount;
  const middleEnd = Math.max(middleStart, points.length - tailCount);
  const middleBudget = Math.max(0, maxPoints - headCount - tailCount);

  const output: WorkbookPoint[] = [...points.slice(0, headCount)];
  if (middleBudget > 0 && middleEnd > middleStart) {
    output.push(...samplePointRangeByBudget(points, middleStart, middleEnd, middleBudget));
  }
  if (middleEnd < points.length) {
    output.push(...points.slice(middleEnd));
  }
  return dedupeAdjacentPreviewPoints(output);
};

export const getStrokeRect = (stroke: WorkbookStroke) => {
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) return null;
  let minX = stroke.points[0].x;
  let maxX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxY = stroke.points[0].y;
  stroke.points.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });
  const padding = Math.max(3, (stroke.width ?? 2) / 2 + 2);
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX) + padding * 2,
    height: Math.max(1, maxY - minY) + padding * 2,
  };
};
