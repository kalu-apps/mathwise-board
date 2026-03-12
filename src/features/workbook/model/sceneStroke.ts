import { generateId } from "@/shared/lib/id";
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
