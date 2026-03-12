import { generateId } from "@/shared/lib/id";
import { buildStrokePreviewPoints, toPath } from "./stroke";
import type {
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTool,
} from "./types";

export type WorkbookActiveStrokeDraft = Omit<WorkbookStroke, "points"> & {
  previewVersion: number;
};

export const buildWorkbookActiveStrokeDraft = (params: {
  layer: WorkbookLayer;
  color: string;
  width: number;
  tool: WorkbookTool;
  page: number;
  authorUserId: string;
  createdAt?: string;
}): WorkbookActiveStrokeDraft => ({
  id: generateId(),
  layer: params.layer,
  color: params.color,
  width: params.width,
  tool: params.tool,
  page: params.page,
  authorUserId: params.authorUserId,
  createdAt: params.createdAt ?? new Date().toISOString(),
  previewVersion: 0,
});

export const buildWorkbookCommittedStroke = (params: {
  activeStroke: WorkbookActiveStrokeDraft | null;
  points: WorkbookPoint[];
  fallback: {
    layer: WorkbookLayer;
    color: string;
    width: number;
    tool: WorkbookTool;
    page: number;
    authorUserId: string;
  };
}): WorkbookStroke => ({
  id: params.activeStroke?.id ?? generateId(),
  layer: params.activeStroke?.layer ?? params.fallback.layer,
  color: params.activeStroke?.color ?? params.fallback.color,
  width: params.activeStroke?.width ?? params.fallback.width,
  tool: params.activeStroke?.tool ?? params.fallback.tool,
  points: params.points,
  page: params.activeStroke?.page ?? params.fallback.page,
  authorUserId: params.activeStroke?.authorUserId ?? params.fallback.authorUserId,
  createdAt: params.activeStroke?.createdAt ?? new Date().toISOString(),
});

export const finalizeWorkbookStrokeDraft = (params: {
  activeStroke: WorkbookActiveStrokeDraft | null;
  bufferedPoints: WorkbookPoint[];
  fallbackPoint: WorkbookPoint;
  fallback: {
    layer: WorkbookLayer;
    color: string;
    width: number;
    tool: WorkbookTool;
    page: number;
    authorUserId: string;
  };
}) => {
  const bufferedPoints =
    params.bufferedPoints.length > 0
      ? params.bufferedPoints
      : [params.fallbackPoint];
  const lastPoint = bufferedPoints[bufferedPoints.length - 1] ?? null;
  const finalPoints =
    !lastPoint ||
    Math.hypot(
      params.fallbackPoint.x - lastPoint.x,
      params.fallbackPoint.y - lastPoint.y
    ) > 0.12
      ? [...bufferedPoints, params.fallbackPoint]
      : [...bufferedPoints];
  if (finalPoints.length === 0) return null;
  const previewStroke = params.activeStroke
    ? {
        ...params.activeStroke,
        previewVersion: params.activeStroke.previewVersion + 1,
        points: buildStrokePreviewPoints(finalPoints),
      }
    : null;
  const committedStroke = buildWorkbookCommittedStroke({
    activeStroke: params.activeStroke,
    points: finalPoints,
    fallback: params.fallback,
  });
  return {
    finalPoints,
    previewStroke,
    committedStroke,
    pathD: toPath(finalPoints),
  };
};
