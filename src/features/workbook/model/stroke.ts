import type { WorkbookPoint, WorkbookStroke } from "./types";

const STROKE_PREVIEW_MAX_POINTS = 96;

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
  const output: WorkbookPoint[] = [points[0]];
  const interiorBudget = Math.max(1, STROKE_PREVIEW_MAX_POINTS - 2);
  const stride = Math.max(1, Math.ceil((points.length - 2) / interiorBudget));
  for (let index = stride; index < points.length - 1; index += stride) {
    const point = points[index];
    const previous = output[output.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.18) {
      output.push(point);
    }
  }
  const lastPoint = points[points.length - 1];
  const tail = output[output.length - 1];
  if (!tail || Math.hypot(lastPoint.x - tail.x, lastPoint.y - tail.y) >= 0.01) {
    output.push(lastPoint);
  }
  return output;
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
