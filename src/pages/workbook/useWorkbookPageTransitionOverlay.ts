import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { WorkbookBoardObject, WorkbookStroke } from "@/features/workbook/model/types";

type UseWorkbookPageTransitionOverlayParams = {
  currentPage: number;
  loading: boolean;
  bootstrapReady: boolean;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
  visibleImagesReady: boolean;
  pendingVisibleImageCount: number;
};

type PageTransitionProfile = {
  minVisibleMs: number;
  maxVisibleMs: number;
  label: string;
};

const toSafePage = (value: number) =>
  Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;

const resolvePageTransitionProfile = (params: {
  page: number;
  objects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
}): PageTransitionProfile => {
  const page = toSafePage(params.page);
  let objectsOnPage = 0;
  let strokesOnPage = 0;
  let imagesOnPage = 0;
  let solidsOnPage = 0;

  params.objects.forEach((object) => {
    if (toSafePage(object.page ?? 1) !== page) return;
    objectsOnPage += 1;
    if (object.type === "image") imagesOnPage += 1;
    if (object.type === "solid3d") solidsOnPage += 1;
  });

  params.strokes.forEach((stroke) => {
    if (toSafePage(stroke.page ?? 1) !== page) return;
    strokesOnPage += 1;
  });

  const weightedLoadScore =
    objectsOnPage + strokesOnPage * 0.4 + imagesOnPage * 6 + solidsOnPage * 4;
  const isHeavy = weightedLoadScore >= 80;
  return {
    minVisibleMs: isHeavy ? 190 : 120,
    maxVisibleMs: isHeavy ? 460 : 300,
    label: `Загружаем страницу ${page}...`,
  };
};

export const useWorkbookPageTransitionOverlay = ({
  currentPage,
  loading,
  bootstrapReady,
  boardObjectsRef,
  boardStrokesRef,
  visibleImagesReady,
  pendingVisibleImageCount,
}: UseWorkbookPageTransitionOverlayParams) => {
  const [isPageTransitionActive, setIsPageTransitionActive] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("Загружаем страницу...");
  const previousPageRef = useRef<number | null>(null);
  const transitionTokenRef = useRef(0);
  const visibleImagesReadyRef = useRef(visibleImagesReady);
  const pendingVisibleImageCountRef = useRef(pendingVisibleImageCount);

  const safeCurrentPage = useMemo(() => toSafePage(currentPage), [currentPage]);

  useEffect(() => {
    visibleImagesReadyRef.current = visibleImagesReady;
    pendingVisibleImageCountRef.current = pendingVisibleImageCount;
  }, [pendingVisibleImageCount, visibleImagesReady]);

  useEffect(() => {
    if (loading || !bootstrapReady) {
      previousPageRef.current = safeCurrentPage;
      setIsPageTransitionActive(false);
      return;
    }
    if (previousPageRef.current === null) {
      previousPageRef.current = safeCurrentPage;
      return;
    }
    if (previousPageRef.current === safeCurrentPage) {
      return;
    }

    previousPageRef.current = safeCurrentPage;
    const transitionToken = transitionTokenRef.current + 1;
    transitionTokenRef.current = transitionToken;
    const profile = resolvePageTransitionProfile({
      page: safeCurrentPage,
      objects: boardObjectsRef.current,
      strokes: boardStrokesRef.current,
    });
    setTransitionLabel(profile.label);
    setIsPageTransitionActive(true);

    const startedAt =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    let isDisposed = false;
    let rafToken: number | null = null;

    const finalize = () => {
      if (isDisposed) return;
      if (transitionTokenRef.current !== transitionToken) return;
      setIsPageTransitionActive(false);
    };
    const scheduleFinalize = () => {
      if (isDisposed) return;
      if (transitionTokenRef.current !== transitionToken) return;
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const elapsed = now - startedAt;
      const minVisibleReached = elapsed >= profile.minVisibleMs;
      const imageLayerReady =
        visibleImagesReadyRef.current || pendingVisibleImageCountRef.current <= 0;
      if (minVisibleReached && imageLayerReady) {
        finalize();
        return;
      }
      rafToken = window.requestAnimationFrame(scheduleFinalize);
    };

    const hardStopTimer = window.setTimeout(finalize, profile.maxVisibleMs);
    rafToken = window.requestAnimationFrame(scheduleFinalize);

    return () => {
      isDisposed = true;
      window.clearTimeout(hardStopTimer);
      if (rafToken !== null) {
        window.cancelAnimationFrame(rafToken);
      }
    };
  }, [
    loading,
    bootstrapReady,
    safeCurrentPage,
    boardObjectsRef,
    boardStrokesRef,
  ]);

  return {
    isPageTransitionActive,
    transitionLabel,
  };
};
