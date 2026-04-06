import {
  useCallback,
  useEffect,
  useMemo,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getObjectExportBounds } from "@/features/workbook/model/export";
import type {
  WorkbookBoardObject,
  WorkbookPoint,
} from "@/features/workbook/model/types";
import type {
  WorkbookUtilityPanelDragState,
  WorkbookUtilityTab,
} from "@/features/workbook/model/workbookSessionUiTypes";
import {
  supportsGraphUtilityPanel,
  supportsTransformUtilityPanel,
} from "./WorkbookSessionPage.geometry";

type StateUpdater<T> = T | ((current: T) => T);

type SetState<T> = (updater: StateUpdater<T>) => void;

type WorkbookViewportPanelBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const resolveViewportPanelBounds = ({
  viewportWidth,
  viewportHeight,
  panelWidth,
  panelHeight,
  floatingPanelsTop,
}: {
  viewportWidth: number;
  viewportHeight: number;
  panelWidth: number;
  panelHeight: number;
  floatingPanelsTop: number;
}): WorkbookViewportPanelBounds => {
  const horizontalInset = 8;
  const verticalInset = 8;
  const minX = horizontalInset;
  const minY = Math.max(verticalInset, floatingPanelsTop);
  const maxX = Math.max(minX + 24, viewportWidth - panelWidth - horizontalInset);
  const maxY = Math.max(minY + 24, viewportHeight - panelHeight - verticalInset);
  return {
    minX,
    maxX,
    minY,
    maxY,
  };
};

const clampPanelPositionToBounds = (
  position: WorkbookPoint,
  bounds: WorkbookViewportPanelBounds
): WorkbookPoint => ({
  x: Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
  y: Math.max(bounds.minY, Math.min(bounds.maxY, position.y)),
});

type UseWorkbookUtilityPanelControllerParams = {
  boardObjects: WorkbookBoardObject[];
  selectedObjectId: string | null;
  canvasViewport: WorkbookPoint;
  viewportZoom: number;
  floatingPanelsTop: number;
  isCompactViewport: boolean;
  isFullscreen: boolean;
  isUtilityPanelOpen: boolean;
  isUtilityPanelCollapsed: boolean;
  utilityTab: WorkbookUtilityTab;
  utilityPanelPosition: WorkbookPoint;
  utilityPanelDragState: WorkbookUtilityPanelDragState | null;
  canAccessBoardSettingsPanel: boolean;
  sessionRootRef: MutableRefObject<HTMLElement | null>;
  workspaceRef: MutableRefObject<HTMLDivElement | null>;
  utilityPanelRef: MutableRefObject<HTMLDivElement | null>;
  graphCatalogCursorTimeoutRef: MutableRefObject<number | null>;
  setError: (value: string | null) => void;
  setIsFullscreen: SetState<boolean>;
  setViewportZoom: SetState<number>;
  setUtilityTab: SetState<WorkbookUtilityTab>;
  setIsUtilityPanelOpen: SetState<boolean>;
  setIsUtilityPanelCollapsed: SetState<boolean>;
  setUtilityPanelPosition: SetState<WorkbookPoint>;
  setUtilityPanelDragState: SetState<WorkbookUtilityPanelDragState | null>;
  setGraphCatalogCursorActive: SetState<boolean>;
};

export const useWorkbookUtilityPanelController = ({
  boardObjects,
  selectedObjectId,
  canvasViewport,
  viewportZoom,
  floatingPanelsTop,
  isCompactViewport,
  isFullscreen,
  isUtilityPanelOpen,
  isUtilityPanelCollapsed,
  utilityTab,
  utilityPanelPosition,
  utilityPanelDragState,
  canAccessBoardSettingsPanel,
  sessionRootRef,
  workspaceRef,
  utilityPanelRef,
  graphCatalogCursorTimeoutRef,
  setError,
  setIsFullscreen,
  setViewportZoom,
  setUtilityTab,
  setIsUtilityPanelOpen,
  setIsUtilityPanelCollapsed,
  setUtilityPanelPosition,
  setUtilityPanelDragState,
  setGraphCatalogCursorActive,
}: UseWorkbookUtilityPanelControllerParams) => {
  const selectedObjectForUtilityPanel = useMemo(
    () => boardObjects.find((item) => item.id === selectedObjectId) ?? null,
    [boardObjects, selectedObjectId]
  );

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!sessionRootRef.current) {
        setIsFullscreen(false);
        return;
      }
      setIsFullscreen(document.fullscreenElement === sessionRootRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [sessionRootRef, setIsFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const rootNode = sessionRootRef.current;
    if (!rootNode) return;
    try {
      if (document.fullscreenElement === rootNode) {
        await document.exitFullscreen();
        return;
      }
      await rootNode.requestFullscreen();
    } catch {
      setError("Не удалось переключить полноэкранный режим.");
    }
  }, [sessionRootRef, setError]);

  const zoomIn = useCallback(() => {
    setViewportZoom((current) => Math.min(3, Number((current + 0.1).toFixed(2))));
  }, [setViewportZoom]);

  const zoomOut = useCallback(() => {
    setViewportZoom((current) => Math.max(0.3, Number((current - 0.1).toFixed(2))));
  }, [setViewportZoom]);

  const resetZoom = useCallback(() => {
    setViewportZoom(1);
  }, [setViewportZoom]);

  const resolveUtilityPanelPositionNearObject = useCallback(
    (
      targetObject: WorkbookBoardObject | null,
      tab: "graph" | "transform"
    ): { x: number; y: number } | null => {
      if (isCompactViewport || !targetObject || typeof window === "undefined") {
        return null;
      }
      const canvasElement = workspaceRef.current?.querySelector<HTMLDivElement>(
        ".workbook-session__canvas"
      );
      if (!canvasElement) return null;
      const canvasRect = canvasElement.getBoundingClientRect();
      if (canvasRect.width <= 1 || canvasRect.height <= 1) return null;
      const measuredPanelRect = utilityPanelRef.current?.getBoundingClientRect() ?? null;
      const fallbackWidth = tab === "graph" ? 392 : 380;
      const viewportPadding = 12;
      const panelWidth = Math.max(
        280,
        Math.min(
          measuredPanelRect?.width ?? fallbackWidth,
          Math.max(280, window.innerWidth - viewportPadding * 2)
        )
      );
      const panelHeight = Math.max(
        220,
        measuredPanelRect?.height ?? (isUtilityPanelCollapsed ? 92 : 560)
      );
      const bounds = getObjectExportBounds(targetObject);
      const objectLeft = canvasRect.left + (bounds.minX - canvasViewport.x) * viewportZoom;
      const objectRight = canvasRect.left + (bounds.maxX - canvasViewport.x) * viewportZoom;
      const objectTop = canvasRect.top + (bounds.minY - canvasViewport.y) * viewportZoom;
      const objectBottom = canvasRect.top + (bounds.maxY - canvasViewport.y) * viewportZoom;
      const objectHeight = Math.max(24, objectBottom - objectTop);
      const gap = 14;
      const availableLeft = viewportPadding;
      const availableRight = window.innerWidth - viewportPadding;
      const availableTop = Math.max(floatingPanelsTop, viewportPadding);
      const availableBottom = window.innerHeight - viewportPadding;
      const maxX = Math.max(availableLeft, availableRight - panelWidth);
      const maxY = Math.max(availableTop, availableBottom - panelHeight);
      const fitsRight = objectRight + gap + panelWidth <= availableRight;
      const fitsLeft = objectLeft - gap - panelWidth >= availableLeft;
      const nextX = fitsRight
        ? objectRight + gap
        : fitsLeft
          ? objectLeft - gap - panelWidth
          : Math.max(availableLeft, Math.min(maxX, objectRight + gap));
      const desiredY = objectTop + (objectHeight - panelHeight) / 2;
      return {
        x: Math.max(availableLeft, Math.min(maxX, nextX)),
        y: Math.max(availableTop, Math.min(maxY, desiredY)),
      };
    },
    [
      canvasViewport.x,
      canvasViewport.y,
      floatingPanelsTop,
      isCompactViewport,
      isUtilityPanelCollapsed,
      utilityPanelRef,
      viewportZoom,
      workspaceRef,
    ]
  );

  const openUtilityPanel = useCallback(
    (
      tab: "settings" | "graph" | "transform",
      options?: {
        toggle?: boolean;
        anchorObject?: WorkbookBoardObject | null;
      }
    ) => {
      if (tab === "settings" && !canAccessBoardSettingsPanel) {
        return;
      }
      const anchorObject = options?.anchorObject ?? selectedObjectForUtilityPanel;
      const canOpenTransformPanel = supportsTransformUtilityPanel(anchorObject);
      const canOpenGraphPanel = supportsGraphUtilityPanel(anchorObject);
      if (tab === "transform" && !canOpenTransformPanel) {
        return;
      }
      if (tab === "graph" && !canOpenGraphPanel) {
        return;
      }
      const allowToggle = options?.toggle ?? true;
      if (allowToggle && isUtilityPanelOpen && utilityTab === tab) {
        const isSolid3dSelected = anchorObject?.type === "solid3d";
        if (tab === "transform" && isFullscreen && isSolid3dSelected) {
          return;
        }
        setIsUtilityPanelOpen(false);
        return;
      }
      setUtilityTab(tab);
      setIsUtilityPanelOpen(true);
      setIsUtilityPanelCollapsed(isCompactViewport);
      if (isCompactViewport) {
        return;
      }
      const anchoredPosition =
        tab === "graph" || tab === "transform"
          ? resolveUtilityPanelPositionNearObject(anchorObject, tab)
          : null;
      if (anchoredPosition) {
        setUtilityPanelPosition(anchoredPosition);
        return;
      }
      if (tab === "graph" || tab === "transform") {
        return;
      }
      if (typeof window === "undefined") return;
      setUtilityPanelPosition((current) => {
        const panelWidth = utilityPanelRef.current?.offsetWidth ?? 420;
        const panelHeight = utilityPanelRef.current?.offsetHeight ?? 560;
        const bounds = resolveViewportPanelBounds({
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          panelWidth,
          panelHeight,
          floatingPanelsTop,
        });
        const fallbackX = Math.max(bounds.minX, bounds.maxX);
        const fallbackY = bounds.minY;
        const nextX = current.x > 0 ? current.x : fallbackX;
        const nextY = current.y > 0 ? current.y : fallbackY;
        return clampPanelPositionToBounds({ x: nextX, y: nextY }, bounds);
      });
    },
    [
      canAccessBoardSettingsPanel,
      floatingPanelsTop,
      isCompactViewport,
      isFullscreen,
      isUtilityPanelOpen,
      resolveUtilityPanelPositionNearObject,
      selectedObjectForUtilityPanel,
      setIsUtilityPanelCollapsed,
      setIsUtilityPanelOpen,
      setUtilityPanelPosition,
      setUtilityTab,
      utilityTab,
      utilityPanelRef,
    ]
  );

  const handleUtilityPanelDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isCompactViewport || !isUtilityPanelOpen) return;
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const interactive = target.closest(
          "button, input, textarea, select, option, a, [role='button'], .MuiButtonBase-root, .MuiInputBase-root, .MuiFormControl-root, .MuiSelect-root, .MuiSwitch-root"
        );
        if (interactive) return;
      }
      event.preventDefault();
      setUtilityPanelDragState({
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLeft: utilityPanelPosition.x,
        startTop: utilityPanelPosition.y,
      });
    },
    [
      isCompactViewport,
      isUtilityPanelOpen,
      setUtilityPanelDragState,
      utilityPanelPosition.x,
      utilityPanelPosition.y,
    ]
  );

  const activateGraphCatalogCursor = useCallback(() => {
    if (graphCatalogCursorTimeoutRef.current !== null) {
      window.clearTimeout(graphCatalogCursorTimeoutRef.current);
      graphCatalogCursorTimeoutRef.current = null;
    }
    setGraphCatalogCursorActive(true);
    graphCatalogCursorTimeoutRef.current = window.setTimeout(() => {
      setGraphCatalogCursorActive(false);
      graphCatalogCursorTimeoutRef.current = null;
    }, 1300);
  }, [graphCatalogCursorTimeoutRef, setGraphCatalogCursorActive]);

  useEffect(
    () => () => {
      if (graphCatalogCursorTimeoutRef.current !== null) {
        window.clearTimeout(graphCatalogCursorTimeoutRef.current);
      }
    },
    [graphCatalogCursorTimeoutRef]
  );

  useEffect(() => {
    if (isCompactViewport || !isUtilityPanelOpen) {
      setUtilityPanelDragState(null);
      return;
    }
    if (!utilityPanelDragState) return;
    const onPointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - utilityPanelDragState.startClientX;
      const deltaY = event.clientY - utilityPanelDragState.startClientY;
      const panelWidth = utilityPanelRef.current?.offsetWidth ?? 360;
      const panelHeight = utilityPanelRef.current?.offsetHeight ?? 420;
      const bounds = resolveViewportPanelBounds({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        panelWidth,
        panelHeight,
        floatingPanelsTop,
      });
      setUtilityPanelPosition(
        clampPanelPositionToBounds(
          {
            x: utilityPanelDragState.startLeft + deltaX,
            y: utilityPanelDragState.startTop + deltaY,
          },
          bounds
        )
      );
    };
    const onPointerUp = () => setUtilityPanelDragState(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [
    floatingPanelsTop,
    isCompactViewport,
    isUtilityPanelOpen,
    setUtilityPanelDragState,
    setUtilityPanelPosition,
    utilityPanelDragState,
    utilityPanelRef,
  ]);

  useEffect(() => {
    if (isCompactViewport) return;
    if (!isUtilityPanelOpen) return;
    if (typeof window === "undefined") return;
    setUtilityPanelPosition((current) => {
      const panelWidth = utilityPanelRef.current?.offsetWidth ?? 360;
      const panelHeight = utilityPanelRef.current?.offsetHeight ?? 420;
      const bounds = resolveViewportPanelBounds({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        panelWidth,
        panelHeight,
        floatingPanelsTop,
      });
      const fallbackX = Math.max(bounds.minX, bounds.maxX);
      const fallbackY = bounds.minY;
      const nextX = current.x > 0 ? current.x : fallbackX;
      const nextY = current.y > 0 ? current.y : fallbackY;
      return clampPanelPositionToBounds({ x: nextX, y: nextY }, bounds);
    });
  }, [
    floatingPanelsTop,
    isCompactViewport,
    isFullscreen,
    isUtilityPanelOpen,
    setUtilityPanelPosition,
    utilityPanelRef,
    utilityTab,
  ]);

  useEffect(() => {
    const panelNode = utilityPanelRef.current;
    if (isCompactViewport || !isUtilityPanelOpen) {
      panelNode?.style.removeProperty("--workbook-utility-max-height");
      return;
    }
    const updatePanelMaxHeight = () => {
      const currentPanelNode = utilityPanelRef.current;
      if (!currentPanelNode) return;
      const maxHeight = Math.max(
        280,
        Math.floor(window.innerHeight - Math.max(8, floatingPanelsTop) - 12)
      );
      currentPanelNode.style.setProperty("--workbook-utility-max-height", `${maxHeight}px`);
    };
    updatePanelMaxHeight();
    window.addEventListener("resize", updatePanelMaxHeight);
    return () => {
      window.removeEventListener("resize", updatePanelMaxHeight);
      panelNode?.style.removeProperty("--workbook-utility-max-height");
    };
  }, [floatingPanelsTop, isCompactViewport, isUtilityPanelOpen, utilityPanelRef]);

  const utilityPanelTitle = useMemo(() => {
    if (utilityTab === "settings") return "Настройки доски";
    if (utilityTab === "graph") return "График функции";
    return "Трансформации";
  }, [utilityTab]);

  return {
    toggleFullscreen,
    zoomIn,
    zoomOut,
    resetZoom,
    openUtilityPanel,
    handleUtilityPanelDragStart,
    activateGraphCatalogCursor,
    utilityPanelTitle,
  };
};
