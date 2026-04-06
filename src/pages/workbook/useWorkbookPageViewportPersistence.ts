import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readStorage, writeStorage } from "@/shared/lib/localDb";

type WorkbookPoint = { x: number; y: number };
type SetState<T> = (updater: T | ((current: T) => T)) => void;

type PersistedWorkbookPageViewportState = {
  lastPage: number | null;
  viewportByPage: Record<string, WorkbookPoint>;
};

interface UseWorkbookPageViewportPersistenceParams {
  storageKey: string;
  currentBoardPage: number;
  setCurrentBoardPage: SetState<number>;
  canvasViewport: WorkbookPoint;
  setCanvasViewport: SetState<WorkbookPoint>;
  availablePages: number[];
  enabled?: boolean;
}

const PAGE_MIN = 1;
const VIEWPORT_EPS = 0.01;
const DEFAULT_PAGE = 1;
const DEFAULT_VIEWPORT: WorkbookPoint = { x: 0, y: 0 };
const PERSIST_DEBOUNCE_MS = 140;

const toSafePage = (value: number) =>
  Math.max(PAGE_MIN, Math.round(Number.isFinite(value) ? value : DEFAULT_PAGE));

const toSafeViewport = (value: WorkbookPoint | null | undefined): WorkbookPoint => ({
  x: value && Number.isFinite(value.x) ? Math.max(0, Number(value.x)) : DEFAULT_VIEWPORT.x,
  y: value && Number.isFinite(value.y) ? Math.max(0, Number(value.y)) : DEFAULT_VIEWPORT.y,
});

const areViewportsEqual = (left: WorkbookPoint, right: WorkbookPoint) =>
  Math.abs(left.x - right.x) <= VIEWPORT_EPS && Math.abs(left.y - right.y) <= VIEWPORT_EPS;

const arePagesEqual = (left: number | null, right: number | null) => (left ?? null) === (right ?? null);

const normalizeViewportByPage = (value: unknown, allowedPages: Set<number>) => {
  if (!value || typeof value !== "object") {
    return {} as Record<string, WorkbookPoint>;
  }
  const source = value as Record<string, unknown>;
  const normalized: Record<string, WorkbookPoint> = {};
  Object.entries(source).forEach(([key, raw]) => {
    const numericPage = Number.parseInt(key, 10);
    const safePage = toSafePage(numericPage);
    if (!allowedPages.has(safePage)) return;
    if (!raw || typeof raw !== "object") return;
    const point = raw as Partial<WorkbookPoint>;
    normalized[String(safePage)] = toSafeViewport({
      x: typeof point.x === "number" ? point.x : DEFAULT_VIEWPORT.x,
      y: typeof point.y === "number" ? point.y : DEFAULT_VIEWPORT.y,
    });
  });
  return normalized;
};

const resolveRawLastPage = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<PersistedWorkbookPageViewportState>;
  if (typeof source.lastPage !== "number" || !Number.isFinite(source.lastPage)) return null;
  return toSafePage(source.lastPage);
};

const normalizePersistedState = (
  value: unknown,
  fallbackPage: number,
  availablePages: number[]
): PersistedWorkbookPageViewportState => {
  const safeAvailablePages = availablePages.length > 0 ? availablePages : [fallbackPage];
  const allowedPages = new Set(safeAvailablePages.map(toSafePage));
  if (!value || typeof value !== "object") {
    return {
      lastPage: allowedPages.has(fallbackPage) ? fallbackPage : safeAvailablePages[0] ?? DEFAULT_PAGE,
      viewportByPage: {},
    };
  }
  const source = value as Partial<PersistedWorkbookPageViewportState>;
  const viewportByPage = normalizeViewportByPage(source.viewportByPage, allowedPages);
  const parsedLastPage =
    typeof source.lastPage === "number" && Number.isFinite(source.lastPage)
      ? toSafePage(source.lastPage)
      : null;
  const safeLastPage =
    parsedLastPage && allowedPages.has(parsedLastPage)
      ? parsedLastPage
      : allowedPages.has(fallbackPage)
        ? fallbackPage
        : safeAvailablePages[0] ?? DEFAULT_PAGE;
  return {
    lastPage: safeLastPage,
    viewportByPage,
  };
};

const isBundleEqual = (
  left: PersistedWorkbookPageViewportState,
  right: PersistedWorkbookPageViewportState
) => {
  if (!arePagesEqual(left.lastPage, right.lastPage)) return false;
  const leftKeys = Object.keys(left.viewportByPage).sort();
  const rightKeys = Object.keys(right.viewportByPage).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) return false;
    const leftViewport = left.viewportByPage[leftKey];
    const rightViewport = right.viewportByPage[rightKey];
    if (!leftViewport || !rightViewport || !areViewportsEqual(leftViewport, rightViewport)) {
      return false;
    }
  }
  return true;
};

export function useWorkbookPageViewportPersistence({
  storageKey,
  currentBoardPage,
  setCurrentBoardPage,
  canvasViewport,
  setCanvasViewport,
  availablePages,
  enabled = true,
}: UseWorkbookPageViewportPersistenceParams) {
  const safeCurrentPage = toSafePage(currentBoardPage);
  const safeCurrentViewport = toSafeViewport(canvasViewport);
  const normalizedAvailablePages = useMemo(() => {
    const deduped = Array.from(new Set(availablePages.map(toSafePage)));
    return deduped.length > 0 ? deduped : [DEFAULT_PAGE];
  }, [availablePages]);
  const availablePagesKey = normalizedAvailablePages.join(",");
  const currentPageRef = useRef(safeCurrentPage);
  const currentViewportRef = useRef(safeCurrentViewport);
  const [storageEpoch, setStorageEpoch] = useState(0);
  const readyRef = useRef(false);
  const restoringRef = useRef(false);
  const restoreTargetPageRef = useRef<number | null>(null);
  const stateRef = useRef<PersistedWorkbookPageViewportState>({
    lastPage: safeCurrentPage,
    viewportByPage: {},
  });
  const lifecycleRef = useRef<{ page: number; viewport: WorkbookPoint } | null>(null);
  const pendingApplyRef = useRef<{ page: number; viewport: WorkbookPoint } | null>(null);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    currentPageRef.current = safeCurrentPage;
    currentViewportRef.current = safeCurrentViewport;
  }, [safeCurrentPage, safeCurrentViewport]);

  const flushPersist = useCallback(() => {
    if (!storageKey) return;
    writeStorage<PersistedWorkbookPageViewportState>(storageKey, stateRef.current);
  }, [storageKey]);

  const schedulePersist = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }, [flushPersist, storageKey]);

  const resolveViewportForPage = useCallback((page: number) => {
    const pageKey = String(toSafePage(page));
    const stored = stateRef.current.viewportByPage[pageKey];
    return stored ? toSafeViewport(stored) : DEFAULT_VIEWPORT;
  }, []);

  const applyViewportForPage = useCallback(
    (page: number) => {
      const safePage = toSafePage(page);
      const targetViewport = resolveViewportForPage(safePage);
      pendingApplyRef.current = { page: safePage, viewport: targetViewport };
      setCanvasViewport((current) => {
        const safeCurrent = toSafeViewport(current as WorkbookPoint);
        if (areViewportsEqual(safeCurrent, targetViewport)) {
          pendingApplyRef.current = null;
          return current as WorkbookPoint;
        }
        return targetViewport;
      });
      return targetViewport;
    },
    [resolveViewportForPage, setCanvasViewport]
  );

  useEffect(() => {
    readyRef.current = false;
    restoringRef.current = false;
    restoreTargetPageRef.current = null;
    pendingApplyRef.current = null;
    if (persistTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    const fallbackPage = normalizedAvailablePages[0] ?? DEFAULT_PAGE;
    const raw = enabled && storageKey
      ? readStorage<Partial<PersistedWorkbookPageViewportState> | null>(storageKey, null)
      : null;
    const normalized = normalizePersistedState(raw, fallbackPage, normalizedAvailablePages);
    stateRef.current = normalized;
    lifecycleRef.current = {
      page: currentPageRef.current,
      viewport: currentViewportRef.current,
    };

    if (enabled) {
      const availableSet = new Set(normalizedAvailablePages);
      const rawLastPage = resolveRawLastPage(raw);
      const hasStoredData = rawLastPage !== null || Object.keys(normalized.viewportByPage).length > 0;
      if (hasStoredData) {
        const targetPage =
          rawLastPage && availableSet.has(rawLastPage) ? rawLastPage : currentPageRef.current;
        restoreTargetPageRef.current = targetPage;
        restoringRef.current = true;
      }
    }

    readyRef.current = true;
    setStorageEpoch((current) => current + 1);
  }, [availablePagesKey, enabled, normalizedAvailablePages, storageKey]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      flushPersist();
    };
  }, [flushPersist]);

  useEffect(() => {
    if (!enabled || !readyRef.current || !restoringRef.current) return;
    const availableSet = new Set(normalizedAvailablePages);
    const target = restoreTargetPageRef.current;
    if (!target || !availableSet.has(target)) {
      restoringRef.current = false;
      restoreTargetPageRef.current = null;
      return;
    }
    if (target !== safeCurrentPage) {
      setCurrentBoardPage(target);
      return;
    }
    const appliedViewport = applyViewportForPage(target);
    lifecycleRef.current = {
      page: target,
      viewport: appliedViewport,
    };
    restoringRef.current = false;
    restoreTargetPageRef.current = null;
  }, [
    applyViewportForPage,
    enabled,
    normalizedAvailablePages,
    safeCurrentPage,
    setCurrentBoardPage,
    storageEpoch,
  ]);

  useEffect(() => {
    if (!enabled || !readyRef.current || restoringRef.current) return;
    const availableSet = new Set(normalizedAvailablePages);
    const prev = lifecycleRef.current;
    if (!prev) {
      lifecycleRef.current = { page: safeCurrentPage, viewport: safeCurrentViewport };
      return;
    }

    if (prev.page !== safeCurrentPage) {
      if (availableSet.has(prev.page)) {
        const prevKey = String(prev.page);
        const currentStoredPrev = stateRef.current.viewportByPage[prevKey];
        if (!currentStoredPrev || !areViewportsEqual(currentStoredPrev, prev.viewport)) {
          stateRef.current = {
            ...stateRef.current,
            viewportByPage: {
              ...stateRef.current.viewportByPage,
              [prevKey]: prev.viewport,
            },
          };
        }
      }
      if (stateRef.current.lastPage !== safeCurrentPage) {
        stateRef.current = {
          ...stateRef.current,
          lastPage: safeCurrentPage,
        };
      }
      schedulePersist();
      const appliedViewport = applyViewportForPage(safeCurrentPage);
      lifecycleRef.current = {
        page: safeCurrentPage,
        viewport: appliedViewport,
      };
      return;
    }

    const pending = pendingApplyRef.current;
    if (pending && pending.page === safeCurrentPage) {
      if (!areViewportsEqual(safeCurrentViewport, pending.viewport)) {
        return;
      }
      pendingApplyRef.current = null;
    }

    const pageKey = String(safeCurrentPage);
    const storedCurrent = stateRef.current.viewportByPage[pageKey];
    let changed = false;
    if (!storedCurrent || !areViewportsEqual(storedCurrent, safeCurrentViewport)) {
      stateRef.current = {
        ...stateRef.current,
        viewportByPage: {
          ...stateRef.current.viewportByPage,
          [pageKey]: safeCurrentViewport,
        },
      };
      changed = true;
    }
    if (stateRef.current.lastPage !== safeCurrentPage) {
      stateRef.current = {
        ...stateRef.current,
        lastPage: safeCurrentPage,
      };
      changed = true;
    }
    if (changed) {
      schedulePersist();
    }
    lifecycleRef.current = {
      page: safeCurrentPage,
      viewport: safeCurrentViewport,
    };
  }, [
    applyViewportForPage,
    enabled,
    normalizedAvailablePages,
    safeCurrentPage,
    safeCurrentViewport,
    schedulePersist,
  ]);

  useEffect(() => {
    if (!enabled || !readyRef.current) return;
    const normalized = normalizePersistedState(
      stateRef.current,
      safeCurrentPage,
      normalizedAvailablePages
    );
    if (isBundleEqual(stateRef.current, normalized)) return;
    stateRef.current = normalized;
    schedulePersist();
  }, [availablePagesKey, enabled, normalizedAvailablePages, safeCurrentPage, schedulePersist]);
}
