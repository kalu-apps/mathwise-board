import { useEffect, useMemo } from "react";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookDocumentState,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookIncomingEraserPreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { WorkbookAreaSelection } from "@/features/workbook/model/workbookSessionUiTypes";
import { resolveMaxKnownWorkbookPage, toSafeWorkbookPage } from "./WorkbookSessionPage.core";
import { useWorkbookVisibleScene } from "./useWorkbookVisibleScene";

type SetSelectedObjectId = (value: string | null | ((current: string | null) => string | null)) => void;

type SetAreaSelection = (
  value: WorkbookAreaSelection | null | ((current: WorkbookAreaSelection | null) => WorkbookAreaSelection | null)
) => void;

type UseWorkbookPageVisibilityStateParams = {
  documentState: WorkbookDocumentState;
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  incomingEraserPreviews: Record<string, WorkbookIncomingEraserPreviewEntry>;
  boardSettings: Pick<WorkbookBoardSettings, "pagesCount" | "currentPage" | "activeFrameId">;
  frameFocusMode: "all" | "active";
  selectedObjectId: string | null;
  setSelectedObjectId: SetSelectedObjectId;
  setAreaSelection: SetAreaSelection;
};

const prewarmedImageAssetUrls = new Set<string>();

export const useWorkbookPageVisibilityState = ({
  documentState,
  boardObjects,
  boardStrokes,
  annotationStrokes,
  incomingEraserPreviews,
  boardSettings,
  frameFocusMode,
  selectedObjectId,
  setSelectedObjectId,
  setAreaSelection,
}: UseWorkbookPageVisibilityStateParams) => {
  const activeDocument = useMemo(
    () => documentState.assets.find((asset) => asset.id === documentState.activeAssetId),
    [documentState.activeAssetId, documentState.assets]
  );

  const activeDocumentPageCount =
    activeDocument?.type === "pdf"
      ? Math.max(1, activeDocument.renderedPages?.length ?? 1)
      : 1;

  const imageAssetUrls = useMemo(
    () =>
      Object.fromEntries(
        documentState.assets
          .filter((asset) => asset.type === "image" && typeof asset.url === "string" && asset.url)
          .map((asset) => [asset.id, asset.url])
      ),
    [documentState.assets]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    Object.values(imageAssetUrls).forEach((assetUrl) => {
      if (typeof assetUrl !== "string" || assetUrl.length === 0) return;
      if (prewarmedImageAssetUrls.has(assetUrl)) return;
      prewarmedImageAssetUrls.add(assetUrl);
      const image = new Image();
      image.decoding = "async";
      image.src = assetUrl;
      if (typeof image.decode === "function") {
        void image.decode().catch(() => undefined);
      }
    });
  }, [imageAssetUrls]);

  const boardPageOptions = useMemo(() => {
    const contentPages = new Set<number>();
    boardObjects.forEach((object) => {
      contentPages.add(toSafeWorkbookPage(object.page));
    });
    boardStrokes.forEach((stroke) => {
      contentPages.add(toSafeWorkbookPage(stroke.page));
    });
    annotationStrokes.forEach((stroke) => {
      contentPages.add(toSafeWorkbookPage(stroke.page));
    });

    const maxKnownPage = resolveMaxKnownWorkbookPage({
      pagesCount: boardSettings.pagesCount,
      boardObjects,
      boardStrokes,
      annotationStrokes,
    });

    return Array.from({ length: maxKnownPage }, (_, index) => {
      const page = index + 1;
      const hasContent = contentPages.has(page);
      return {
        page,
        hasContent,
        label: hasContent ? `Страница ${page} • контент` : `Страница ${page}`,
      };
    });
  }, [annotationStrokes, boardObjects, boardSettings.pagesCount, boardStrokes]);

  const {
    visibleIncomingEraserPreviews,
    visibleBoardStrokes,
    visibleAnnotationStrokes,
    visibleBoardObjects,
  } = useWorkbookVisibleScene({
    boardObjects,
    boardStrokes,
    annotationStrokes,
    incomingEraserPreviews,
    currentPage: boardSettings.currentPage,
    activeFrameId: boardSettings.activeFrameId,
    frameFocusMode,
  });

  useEffect(() => {
    if (!selectedObjectId) return;
    if (visibleBoardObjects.some((object) => object.id === selectedObjectId)) return;
    setSelectedObjectId(null);
  }, [selectedObjectId, setSelectedObjectId, visibleBoardObjects]);

  useEffect(() => {
    setAreaSelection((current) => {
      if (!current) return current;
      const visibleObjectIds = new Set(visibleBoardObjects.map((object) => object.id));
      const visibleBoardStrokeIds = new Set(visibleBoardStrokes.map((stroke) => stroke.id));
      const visibleAnnotationStrokeIds = new Set(
        visibleAnnotationStrokes.map((stroke) => stroke.id)
      );
      const nextObjectIds = current.objectIds.filter((id) => visibleObjectIds.has(id));
      const nextStrokeIds = current.strokeIds.filter((entry) =>
        entry.layer === "annotations"
          ? visibleAnnotationStrokeIds.has(entry.id)
          : visibleBoardStrokeIds.has(entry.id)
      );
      if (
        nextObjectIds.length === current.objectIds.length &&
        nextStrokeIds.length === current.strokeIds.length
      ) {
        return current;
      }
      if (nextObjectIds.length === 0 && nextStrokeIds.length === 0) {
        return null;
      }
      return {
        ...current,
        objectIds: nextObjectIds,
        strokeIds: nextStrokeIds,
      };
    });
  }, [setAreaSelection, visibleAnnotationStrokes, visibleBoardObjects, visibleBoardStrokes]);

  return {
    activeDocument,
    activeDocumentPageCount,
    imageAssetUrls,
    boardPageOptions,
    visibleIncomingEraserPreviews,
    visibleBoardStrokes,
    visibleAnnotationStrokes,
    visibleBoardObjects,
  };
};
