import { useEffect, useMemo, useRef, useState } from "react";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookDocumentState,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookIncomingEraserPreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { WorkbookAreaSelection } from "@/features/workbook/model/workbookSessionUiTypes";
import {
  normalizeWorkbookPageOrder,
  normalizeWorkbookPageTitles,
  resolveMaxKnownWorkbookPage,
  toSafeWorkbookPage,
} from "./WorkbookSessionPage.core";
import { useWorkbookVisibleScene } from "./useWorkbookVisibleScene";
import {
  resolveBoardObjectImageAssetId,
} from "@/features/workbook/model/scene";
import { normalizeWorkbookAssetContentUrl } from "@/features/workbook/model/workbookAssetUrl";

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
  currentPage: number;
  boardSettings: Pick<
    WorkbookBoardSettings,
    "pagesCount" | "activeFrameId" | "pageOrder" | "pageTitles"
  >;
  frameFocusMode: "all" | "active";
  selectedObjectId: string | null;
  setSelectedObjectId: SetSelectedObjectId;
  setAreaSelection: SetAreaSelection;
};

const prewarmedImageAssetUrls = new Set<string>();
const IMAGE_VISIBILITY_READY_TIMEOUT_MS = 900;

const loadImageForVisibility = (assetUrl: string): Promise<void> =>
  new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    const image = new Image();
    image.decoding = "async";
    let settled = false;
    const finalize = () => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    image.onerror = finalize;
    image.onload = () => {
      if (typeof image.decode === "function") {
        void image.decode().catch(() => undefined).finally(finalize);
        return;
      }
      finalize();
    };
    image.src = assetUrl;
    if (image.complete) {
      if (typeof image.decode === "function") {
        void image.decode().catch(() => undefined).finally(finalize);
      } else {
        finalize();
      }
    }
  });

export const useWorkbookPageVisibilityState = ({
  documentState,
  boardObjects,
  boardStrokes,
  annotationStrokes,
  incomingEraserPreviews,
  currentPage,
  boardSettings,
  frameFocusMode,
  selectedObjectId,
  setSelectedObjectId,
  setAreaSelection,
}: UseWorkbookPageVisibilityStateParams) => {
  const visibleImageResolveRunRef = useRef(0);
  const [visibleImagesReady, setVisibleImagesReady] = useState(true);
  const [pendingVisibleImageCount, setPendingVisibleImageCount] = useState(0);

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

  const boardPageOptions = useMemo(() => {
    const contentPages = new Set<number>();
    const objectCountByPage = new Map<number, number>();
    const strokeCountByPage = new Map<number, number>();
    const annotationCountByPage = new Map<number, number>();
    const imageByPage = new Map<number, string>();
    boardObjects.forEach((object) => {
      const page = toSafeWorkbookPage(object.page);
      contentPages.add(page);
      objectCountByPage.set(page, (objectCountByPage.get(page) ?? 0) + 1);
      if (imageByPage.has(page)) return;
      if (object.type !== "image") return;
      const objectImageUrl =
        typeof object.imageUrl === "string" && object.imageUrl.trim().length > 0
          ? normalizeWorkbookAssetContentUrl(object.imageUrl)
          : "";
      if (objectImageUrl) {
        imageByPage.set(page, objectImageUrl);
        return;
      }
      const assetId = resolveBoardObjectImageAssetId(object);
      if (!assetId) return;
      const assetImageUrl =
        typeof imageAssetUrls[assetId] === "string"
          ? normalizeWorkbookAssetContentUrl(imageAssetUrls[assetId] ?? "")
          : "";
      if (assetImageUrl) {
        imageByPage.set(page, assetImageUrl);
      }
    });
    boardStrokes.forEach((stroke) => {
      const page = toSafeWorkbookPage(stroke.page);
      contentPages.add(page);
      strokeCountByPage.set(page, (strokeCountByPage.get(page) ?? 0) + 1);
    });
    annotationStrokes.forEach((stroke) => {
      const page = toSafeWorkbookPage(stroke.page);
      contentPages.add(page);
      annotationCountByPage.set(page, (annotationCountByPage.get(page) ?? 0) + 1);
    });

    const maxKnownPage = resolveMaxKnownWorkbookPage({
      pagesCount: boardSettings.pagesCount,
      boardObjects,
      boardStrokes,
      annotationStrokes,
    });

    const orderedPages = normalizeWorkbookPageOrder(boardSettings.pageOrder, maxKnownPage);

    const normalizedTitles = normalizeWorkbookPageTitles(
      boardSettings.pageTitles,
      maxKnownPage
    );
    return orderedPages.map((page, index) => {
      const hasContent = contentPages.has(page);
      const objectCount = objectCountByPage.get(page) ?? 0;
      const strokeCount = strokeCountByPage.get(page) ?? 0;
      const annotationCount = annotationCountByPage.get(page) ?? 0;
      const resolvedTitle = (normalizedTitles[String(page)] ?? "").trim();
      const position = index + 1;
      return {
        page,
        position,
        hasContent,
        title: resolvedTitle.length > 0 ? resolvedTitle : `Страница ${position}`,
        label: hasContent ? `Страница ${position} • контент` : `Страница ${position}`,
        preview: {
          objectCount,
          strokeCount,
          annotationCount,
          imageUrl: imageByPage.get(page) ?? null,
        },
      };
    });
  }, [
    annotationStrokes,
    boardObjects,
    boardSettings.pageOrder,
    boardSettings.pageTitles,
    boardSettings.pagesCount,
    boardStrokes,
    imageAssetUrls,
  ]);

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
    currentPage,
    activeFrameId: boardSettings.activeFrameId,
    frameFocusMode,
  });

  const visibleImageUrls = useMemo(() => {
    const urls: string[] = [];
    const seen = new Set<string>();
    visibleBoardObjects.forEach((object) => {
      if (object.type !== "image") return;
      const objectImageUrl =
        typeof object.imageUrl === "string" && object.imageUrl.trim().length > 0
          ? normalizeWorkbookAssetContentUrl(object.imageUrl)
          : "";
      if (objectImageUrl && !seen.has(objectImageUrl)) {
        seen.add(objectImageUrl);
        urls.push(objectImageUrl);
      }
      const assetId = resolveBoardObjectImageAssetId(object);
      const assetImageUrl =
        assetId && typeof imageAssetUrls[assetId] === "string"
          ? normalizeWorkbookAssetContentUrl(imageAssetUrls[assetId] ?? "")
          : "";
      if (assetImageUrl && !seen.has(assetImageUrl)) {
        seen.add(assetImageUrl);
        urls.push(assetImageUrl);
      }
    });
    return urls;
  }, [imageAssetUrls, visibleBoardObjects]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    visibleImageUrls.forEach((assetUrl) => {
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
  }, [visibleImageUrls]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setVisibleImagesReady(true);
      setPendingVisibleImageCount(0);
      return;
    }
    if (visibleImageUrls.length === 0) {
      setVisibleImagesReady(true);
      setPendingVisibleImageCount(0);
      return;
    }

    const resolveRunId = visibleImageResolveRunRef.current + 1;
    visibleImageResolveRunRef.current = resolveRunId;
    let disposed = false;
    let remaining = visibleImageUrls.length;
    const finish = () => {
      if (disposed) return;
      if (visibleImageResolveRunRef.current !== resolveRunId) return;
      setPendingVisibleImageCount(0);
      setVisibleImagesReady(true);
    };
    const settleOne = () => {
      if (disposed) return;
      if (visibleImageResolveRunRef.current !== resolveRunId) return;
      remaining = Math.max(0, remaining - 1);
      setPendingVisibleImageCount(remaining);
      if (remaining === 0) {
        finish();
      }
    };

    setVisibleImagesReady(false);
    setPendingVisibleImageCount(visibleImageUrls.length);

    const hardStopTimer = window.setTimeout(finish, IMAGE_VISIBILITY_READY_TIMEOUT_MS);
    visibleImageUrls.forEach((assetUrl) => {
      void loadImageForVisibility(assetUrl).finally(settleOne);
    });

    return () => {
      disposed = true;
      window.clearTimeout(hardStopTimer);
    };
  }, [visibleImageUrls]);

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
    visibleImagesReady,
    pendingVisibleImageCount,
  };
};
