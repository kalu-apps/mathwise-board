import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/shared/lib/localDb";

type SetState<T> = (updater: T | ((current: T) => T)) => void;

type PersistedWorkbookPageZoomState = {
  zoomByPage: Record<string, number>;
};

interface UseWorkbookPageZoomPersistenceParams {
  storageKey: string;
  currentBoardPage: number;
  viewportZoom: number;
  setViewportZoom: SetState<number>;
  availablePages: number[];
  enabled?: boolean;
}

type UseWorkbookPageZoomPersistenceResult = {
  applyZoomForPage: (page: number) => void;
  handlePageCreated: (page: number) => void;
  handlePageDeleted: (targetPage: number) => void;
};

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_EPS = 0.0001;
const DEFAULT_PAGE_ZOOM = 1;

const toSafePage = (value: number) =>
  Math.max(1, Math.round(Number.isFinite(value) ? value : 1));

const toSafeZoom = (value: number) =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number.isFinite(value) ? value : DEFAULT_PAGE_ZOOM));

const areZoomValuesEqual = (left: number, right: number) =>
  Math.abs(left - right) <= ZOOM_EPS;

const normalizeZoomByPage = (value: unknown, allowedPages?: Set<number>) => {
  if (!value || typeof value !== "object") {
    return {} as Record<string, number>;
  }
  const source = value as Record<string, unknown>;
  const normalized: Record<string, number> = {};
  Object.entries(source).forEach(([key, raw]) => {
    const numericPage = Number.parseInt(key, 10);
    if (!Number.isFinite(numericPage) || numericPage < 1) return;
    const safePage = toSafePage(numericPage);
    if (allowedPages && !allowedPages.has(safePage)) return;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return;
    normalized[String(safePage)] = toSafeZoom(raw);
  });
  return normalized;
};

const areZoomMapsEqual = (left: Record<string, number>, right: Record<string, number>) => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) return false;
    if (!areZoomValuesEqual(left[leftKey] ?? DEFAULT_PAGE_ZOOM, right[rightKey] ?? DEFAULT_PAGE_ZOOM)) {
      return false;
    }
  }
  return true;
};

const removeZoomForPage = (source: Record<string, number>, page: number) => {
  const safePage = toSafePage(page);
  const pageKey = String(safePage);
  if (!Object.prototype.hasOwnProperty.call(source, pageKey)) {
    return source;
  }
  const next: Record<string, number> = {};
  Object.entries(source).forEach(([key, zoom]) => {
    if (key === pageKey) return;
    next[key] = zoom;
  });
  return next;
};

const remapZoomByPageAfterDelete = (source: Record<string, number>, targetPage: number) => {
  const safeTargetPage = toSafePage(targetPage);
  const next: Record<string, number> = {};
  Object.entries(source).forEach(([key, zoom]) => {
    const numericPage = Number.parseInt(key, 10);
    if (!Number.isFinite(numericPage) || numericPage < 1) return;
    if (numericPage === safeTargetPage) return;
    const nextPage = numericPage > safeTargetPage ? numericPage - 1 : numericPage;
    next[String(toSafePage(nextPage))] = toSafeZoom(zoom);
  });
  return next;
};

export function useWorkbookPageZoomPersistence({
  storageKey,
  currentBoardPage,
  viewportZoom,
  setViewportZoom,
  availablePages,
  enabled = true,
}: UseWorkbookPageZoomPersistenceParams): UseWorkbookPageZoomPersistenceResult {
  const readyRef = useRef(false);
  const zoomByPageRef = useRef<Record<string, number>>({});
  const pendingApplyRef = useRef<{ page: number; zoom: number } | null>(null);
  const [storageEpoch, setStorageEpoch] = useState(0);
  const normalizedAvailablePages = useMemo(() => {
    const deduped = Array.from(new Set(availablePages.map(toSafePage)));
    return deduped.length > 0 ? deduped : [1];
  }, [availablePages]);

  const persistZoomByPage = useCallback(
    (nextZoomByPage: Record<string, number>) => {
      zoomByPageRef.current = nextZoomByPage;
      if (!storageKey) return;
      writeStorage<PersistedWorkbookPageZoomState>(storageKey, {
        zoomByPage: nextZoomByPage,
      });
    },
    [storageKey]
  );

  const resolveZoomForPage = useCallback((page: number) => {
    const safePage = toSafePage(page);
    const stored = zoomByPageRef.current[String(safePage)];
    return typeof stored === "number" && Number.isFinite(stored)
      ? toSafeZoom(stored)
      : DEFAULT_PAGE_ZOOM;
  }, []);

  const applyZoomForPage = useCallback(
    (page: number) => {
      const safePage = toSafePage(page);
      const nextZoom = resolveZoomForPage(safePage);
      pendingApplyRef.current = {
        page: safePage,
        zoom: nextZoom,
      };
      setViewportZoom((current) => {
        const safeCurrentZoom = toSafeZoom(current);
        if (areZoomValuesEqual(safeCurrentZoom, nextZoom)) {
          pendingApplyRef.current = null;
          return current;
        }
        return nextZoom;
      });
    },
    [resolveZoomForPage, setViewportZoom]
  );

  useEffect(() => {
    readyRef.current = false;
    pendingApplyRef.current = null;
    zoomByPageRef.current = {};
    if (!enabled) {
      readyRef.current = true;
      return;
    }
    if (storageKey) {
      const stored = readStorage<Partial<PersistedWorkbookPageZoomState> | null>(
        storageKey,
        null
      );
      const allowedPages = new Set(normalizedAvailablePages);
      zoomByPageRef.current = normalizeZoomByPage(stored?.zoomByPage, allowedPages);
    }
    readyRef.current = true;
    setStorageEpoch((current) => current + 1);
  }, [enabled, normalizedAvailablePages, storageKey]);

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    applyZoomForPage(currentBoardPage);
  }, [applyZoomForPage, currentBoardPage, enabled, storageEpoch]);

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    const allowedPages = new Set(normalizedAvailablePages);
    const normalized = normalizeZoomByPage(zoomByPageRef.current, allowedPages);
    if (areZoomMapsEqual(zoomByPageRef.current, normalized)) return;
    persistZoomByPage(normalized);
  }, [enabled, normalizedAvailablePages, persistZoomByPage]);

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    const safePage = toSafePage(currentBoardPage);
    const safeZoom = toSafeZoom(viewportZoom);
    const pending = pendingApplyRef.current;
    if (pending && pending.page === safePage) {
      if (!areZoomValuesEqual(safeZoom, pending.zoom)) {
        return;
      }
      pendingApplyRef.current = null;
    }

    const pageKey = String(safePage);
    const prevZoom = zoomByPageRef.current[pageKey];
    if (typeof prevZoom === "number" && areZoomValuesEqual(prevZoom, safeZoom)) {
      return;
    }

    const nextZoomByPage = {
      ...zoomByPageRef.current,
      [pageKey]: safeZoom,
    };
    persistZoomByPage(nextZoomByPage);
  }, [currentBoardPage, enabled, persistZoomByPage, viewportZoom]);

  const handlePageCreated = useCallback(
    (page: number) => {
      if (!readyRef.current) return;
      const nextZoomByPage = removeZoomForPage(zoomByPageRef.current, page);
      if (nextZoomByPage === zoomByPageRef.current) return;
      persistZoomByPage(nextZoomByPage);
    },
    [persistZoomByPage]
  );

  const handlePageDeleted = useCallback(
    (targetPage: number) => {
      if (!readyRef.current) return;
      const nextZoomByPage = remapZoomByPageAfterDelete(
        zoomByPageRef.current,
        targetPage
      );
      persistZoomByPage(nextZoomByPage);
    },
    [persistZoomByPage]
  );

  return {
    applyZoomForPage,
    handlePageCreated,
    handlePageDeleted,
  };
}
