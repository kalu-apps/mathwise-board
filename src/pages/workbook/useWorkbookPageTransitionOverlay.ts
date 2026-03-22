import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { WorkbookBoardObject, WorkbookStroke } from "@/features/workbook/model/types";

type UseWorkbookPageTransitionOverlayParams = {
  currentPage: number;
  loading: boolean;
  bootstrapReady: boolean;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
  boardStrokesRef: MutableRefObject<WorkbookStroke[]>;
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
}: UseWorkbookPageTransitionOverlayParams) => {
  const [isPageTransitionActive, setIsPageTransitionActive] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("Загружаем страницу...");
  const previousPageRef = useRef<number | null>(null);
  const transitionTokenRef = useRef(0);

  const safeCurrentPage = useMemo(() => toSafePage(currentPage), [currentPage]);

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
    let rafStart: number | null = null;
    let rafEnd: number | null = null;

    const finalize = () => {
      if (isDisposed) return;
      if (transitionTokenRef.current !== transitionToken) return;
      setIsPageTransitionActive(false);
    };

    const scheduleFinalize = () => {
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const elapsed = now - startedAt;
      const remainingMs = Math.max(0, profile.minVisibleMs - elapsed);
      window.setTimeout(finalize, remainingMs);
    };

    const hardStopTimer = window.setTimeout(finalize, profile.maxVisibleMs);
    rafStart = window.requestAnimationFrame(() => {
      rafEnd = window.requestAnimationFrame(scheduleFinalize);
    });

    return () => {
      isDisposed = true;
      window.clearTimeout(hardStopTimer);
      if (rafStart !== null) {
        window.cancelAnimationFrame(rafStart);
      }
      if (rafEnd !== null) {
        window.cancelAnimationFrame(rafEnd);
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
