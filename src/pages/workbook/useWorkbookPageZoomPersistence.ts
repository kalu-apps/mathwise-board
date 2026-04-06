import { useCallback, useEffect, useRef, useState } from "react";
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
  enabled?: boolean;
}

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

const normalizeZoomByPage = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return {} as Record<string, number>;
  }
  const source = value as Record<string, unknown>;
  const normalized: Record<string, number> = {};
  Object.entries(source).forEach(([key, raw]) => {
    const numericPage = Number.parseInt(key, 10);
    if (!Number.isFinite(numericPage) || numericPage < 1) return;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return;
    normalized[String(toSafePage(numericPage))] = toSafeZoom(raw);
  });
  return normalized;
};

export function useWorkbookPageZoomPersistence({
  storageKey,
  currentBoardPage,
  viewportZoom,
  setViewportZoom,
  enabled = true,
}: UseWorkbookPageZoomPersistenceParams) {
  const readyRef = useRef(false);
  const zoomByPageRef = useRef<Record<string, number>>({});
  const pendingApplyRef = useRef<{ page: number; zoom: number } | null>(null);
  const [storageEpoch, setStorageEpoch] = useState(0);

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
      zoomByPageRef.current = normalizeZoomByPage(stored?.zoomByPage);
    }
    readyRef.current = true;
    setStorageEpoch((current) => current + 1);
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    applyZoomForPage(currentBoardPage);
  }, [applyZoomForPage, currentBoardPage, enabled, storageEpoch]);

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

    zoomByPageRef.current = {
      ...zoomByPageRef.current,
      [pageKey]: safeZoom,
    };
    if (!storageKey) return;
    writeStorage<PersistedWorkbookPageZoomState>(storageKey, {
      zoomByPage: zoomByPageRef.current,
    });
  }, [currentBoardPage, enabled, storageKey, viewportZoom]);
}
