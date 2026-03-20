import { useMemo } from "react";
import type {
  WorkbookBoardObject,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookIncomingEraserPreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";

type UseWorkbookVisibleSceneParams = {
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  incomingEraserPreviews: Record<string, WorkbookIncomingEraserPreviewEntry>;
  currentPage: number;
  activeFrameId: string | null;
  frameFocusMode: "all" | "active";
};

export const useWorkbookVisibleScene = (params: UseWorkbookVisibleSceneParams) => {
  const safeCurrentPage = Math.max(1, params.currentPage || 1);

  const visibleIncomingEraserPreviews = useMemo(
    () =>
      Object.values(params.incomingEraserPreviews ?? {}).filter(
        (preview) => preview.page === safeCurrentPage
      ),
    [params.incomingEraserPreviews, safeCurrentPage]
  );

  const activeFrameObject = useMemo(
    () =>
      params.boardObjects.find(
        (object) => object.id === params.activeFrameId && object.type === "frame"
      ) ?? null,
    [params.activeFrameId, params.boardObjects]
  );

  const visibleBoardStrokes = useMemo(
    () =>
      params.boardStrokes.filter((stroke) => (stroke.page ?? 1) === safeCurrentPage),
    [params.boardStrokes, safeCurrentPage]
  );

  const visibleAnnotationStrokes = useMemo(
    () =>
      params.annotationStrokes.filter((stroke) => (stroke.page ?? 1) === safeCurrentPage),
    [params.annotationStrokes, safeCurrentPage]
  );

  const visibleBoardObjects = useMemo(() => {
    const byPage = params.boardObjects.filter(
      (object) => (object.page ?? 1) === safeCurrentPage
    );
    if (params.frameFocusMode !== "active" || !activeFrameObject) return byPage;
    const frameLeft = activeFrameObject.x;
    const frameTop = activeFrameObject.y;
    const frameRight = activeFrameObject.x + activeFrameObject.width;
    const frameBottom = activeFrameObject.y + activeFrameObject.height;
    return byPage.filter((object) => {
      if (object.id === activeFrameObject.id) return true;
      const centerX = object.x + object.width / 2;
      const centerY = object.y + object.height / 2;
      return (
        centerX >= frameLeft &&
        centerX <= frameRight &&
        centerY >= frameTop &&
        centerY <= frameBottom
      );
    });
  }, [activeFrameObject, params.boardObjects, params.frameFocusMode, safeCurrentPage]);

  return {
    visibleIncomingEraserPreviews,
    visibleBoardStrokes,
    visibleAnnotationStrokes,
    visibleBoardObjects,
  };
};
