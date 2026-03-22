import { useMemo } from "react";
import type {
  WorkbookBoardObject,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookIncomingEraserPreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import { reportWorkbookPerfPhaseMetric } from "@/features/workbook/model/workbookPerformance";

type UseWorkbookVisibleSceneParams = {
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  incomingEraserPreviews: Record<string, WorkbookIncomingEraserPreviewEntry>;
  currentPage: number;
  activeFrameId: string | null;
  frameFocusMode: "all" | "active";
};

const EMPTY_BOARD_OBJECTS: WorkbookBoardObject[] = [];
const EMPTY_STROKES: WorkbookStroke[] = [];
const EMPTY_PREVIEWS: WorkbookIncomingEraserPreviewEntry[] = [];

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const toSafePage = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.trunc(numeric));
};

const buildBoardObjectsByPage = (objects: WorkbookBoardObject[]) => {
  const byPage = new Map<number, WorkbookBoardObject[]>();
  objects.forEach((object) => {
    const page = toSafePage(object.page);
    const existing = byPage.get(page);
    if (existing) {
      existing.push(object);
      return;
    }
    byPage.set(page, [object]);
  });
  return byPage;
};

const buildStrokesByPage = (strokes: WorkbookStroke[]) => {
  const byPage = new Map<number, WorkbookStroke[]>();
  strokes.forEach((stroke) => {
    const page = toSafePage(stroke.page);
    const existing = byPage.get(page);
    if (existing) {
      existing.push(stroke);
      return;
    }
    byPage.set(page, [stroke]);
  });
  return byPage;
};

const buildIncomingPreviewsByPage = (
  previews: Record<string, WorkbookIncomingEraserPreviewEntry>
) => {
  const byPage = new Map<number, WorkbookIncomingEraserPreviewEntry[]>();
  Object.values(previews ?? {}).forEach((preview) => {
    const page = toSafePage(preview.page);
    const existing = byPage.get(page);
    if (existing) {
      existing.push(preview);
      return;
    }
    byPage.set(page, [preview]);
  });
  return byPage;
};

export const useWorkbookVisibleScene = (params: UseWorkbookVisibleSceneParams) => {
  const safeCurrentPage = toSafePage(params.currentPage);

  const boardObjectsByPage = useMemo(
    () => buildBoardObjectsByPage(params.boardObjects),
    [params.boardObjects]
  );
  const boardStrokesByPage = useMemo(
    () => buildStrokesByPage(params.boardStrokes),
    [params.boardStrokes]
  );
  const annotationStrokesByPage = useMemo(
    () => buildStrokesByPage(params.annotationStrokes),
    [params.annotationStrokes]
  );
  const incomingEraserPreviewsByPage = useMemo(
    () => buildIncomingPreviewsByPage(params.incomingEraserPreviews),
    [params.incomingEraserPreviews]
  );

  return useMemo(() => {
    const startedAtMs = nowMs();
    const pageBoardObjects =
      boardObjectsByPage.get(safeCurrentPage) ?? EMPTY_BOARD_OBJECTS;
    const pageBoardStrokes =
      boardStrokesByPage.get(safeCurrentPage) ?? EMPTY_STROKES;
    const pageAnnotationStrokes =
      annotationStrokesByPage.get(safeCurrentPage) ?? EMPTY_STROKES;
    const pageIncomingPreviews =
      incomingEraserPreviewsByPage.get(safeCurrentPage) ?? EMPTY_PREVIEWS;

    const activeFrameObject =
      params.activeFrameId && params.frameFocusMode === "active"
        ? pageBoardObjects.find(
            (object) =>
              object.id === params.activeFrameId && object.type === "frame"
          ) ?? null
        : null;

    const visibleBoardObjects =
      params.frameFocusMode !== "active" || !activeFrameObject
        ? pageBoardObjects
        : pageBoardObjects.filter((object) => {
            if (object.id === activeFrameObject.id) return true;
            const centerX = object.x + object.width / 2;
            const centerY = object.y + object.height / 2;
            return (
              centerX >= activeFrameObject.x &&
              centerX <= activeFrameObject.x + activeFrameObject.width &&
              centerY >= activeFrameObject.y &&
              centerY <= activeFrameObject.y + activeFrameObject.height
            );
          });

    const finishedAtMs = nowMs();
    reportWorkbookPerfPhaseMetric({
      name: "page_switch_visible_scene_ms",
      durationMs: finishedAtMs - startedAtMs,
      counters: {
        currentPage: safeCurrentPage,
        totalBoardObjects: params.boardObjects.length,
        totalBoardStrokes: params.boardStrokes.length,
        totalAnnotationStrokes: params.annotationStrokes.length,
        visibleBoardObjects: visibleBoardObjects.length,
        visibleBoardStrokes: pageBoardStrokes.length,
        visibleAnnotationStrokes: pageAnnotationStrokes.length,
        visibleIncomingPreviews: pageIncomingPreviews.length,
        frameFocusActive: params.frameFocusMode === "active" ? 1 : 0,
      },
    });

    return {
      visibleIncomingEraserPreviews: pageIncomingPreviews,
      visibleBoardStrokes: pageBoardStrokes,
      visibleAnnotationStrokes: pageAnnotationStrokes,
      visibleBoardObjects,
    };
  }, [
    annotationStrokesByPage,
    boardObjectsByPage,
    boardStrokesByPage,
    incomingEraserPreviewsByPage,
    params.activeFrameId,
    params.annotationStrokes.length,
    params.boardObjects.length,
    params.boardStrokes.length,
    params.frameFocusMode,
    safeCurrentPage,
  ]);
};
