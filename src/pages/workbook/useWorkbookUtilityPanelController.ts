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
      const panelWidth = Math.max(
        280,
        Math.min(
          measuredPanelRect?.width ?? fallbackWidth,
          Math.max(280, canvasRect.width - 18)
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
      const availableLeft = Math.max(12, canvasRect.left + 6);
      const availableRight = Math.min(window.innerWidth - 12, canvasRect.right - 6);
      const availableTop = Math.max(12, canvasRect.top + 6);
      const availableBottom = Math.min(window.innerHeight - 12, canvasRect.bottom - 6);
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
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      setUtilityPanelPosition((current) => {
        const fallbackX = Math.max(rect.left + 8, rect.right - 420);
        const fallbackY = Math.max(rect.top + 8, floatingPanelsTop);
        const nextX = current.x > 0 ? current.x : fallbackX;
        const nextY = current.y > 0 ? current.y : fallbackY;
        const minX = rect.left + 8;
        const minY = Math.max(rect.top + 8, floatingPanelsTop);
        const maxX = Math.max(minX + 24, rect.right - 320);
        const maxY = Math.max(minY + 24, rect.bottom - 120);
        return {
          x: Math.max(minX, Math.min(maxX, nextX)),
          y: Math.max(minY, Math.min(maxY, nextY)),
        };
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
      workspaceRef,
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
      const workspaceRect = workspaceRef.current?.getBoundingClientRect();
      const panelWidth = utilityPanelRef.current?.offsetWidth ?? 360;
      const panelHeight = utilityPanelRef.current?.offsetHeight ?? 420;
      const minX = (workspaceRect?.left ?? 0) + 8;
      const minY = Math.max((workspaceRect?.top ?? 0) + 8, floatingPanelsTop);
      const maxX = Math.max(
        minX + 24,
        (workspaceRect?.right ?? window.innerWidth) - panelWidth - 8
      );
      const maxY = Math.max(
        minY + 24,
        (workspaceRect?.bottom ?? window.innerHeight) - panelHeight - 8
      );
      setUtilityPanelPosition({
        x: Math.max(minX, Math.min(maxX, utilityPanelDragState.startLeft + deltaX)),
        y: Math.max(minY, Math.min(maxY, utilityPanelDragState.startTop + deltaY)),
      });
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
    workspaceRef,
  ]);

  useEffect(() => {
    if (isCompactViewport) return;
    if (!isUtilityPanelOpen) return;
    if (!workspaceRef.current) return;
    setUtilityPanelPosition((current) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return current;
      const panelWidth = utilityPanelRef.current?.offsetWidth ?? 360;
      const panelHeight = utilityPanelRef.current?.offsetHeight ?? 420;
      const fallbackX = Math.max(rect.left + 8, rect.right - 420);
      const fallbackY = Math.max(rect.top + 8, floatingPanelsTop);
      const nextX = current.x > 0 ? current.x : fallbackX;
      const nextY = current.y > 0 ? current.y : fallbackY;
      const minX = rect.left + 8;
      const minY = Math.max(rect.top + 8, floatingPanelsTop);
      const maxX = Math.max(minX + 24, rect.right - panelWidth - 8);
      const maxY = Math.max(minY + 24, rect.bottom - panelHeight - 8);
      return {
        x: Math.max(minX, Math.min(maxX, nextX)),
        y: Math.max(minY, Math.min(maxY, nextY)),
      };
    });
  }, [
    floatingPanelsTop,
    isCompactViewport,
    isFullscreen,
    isUtilityPanelOpen,
    setUtilityPanelPosition,
    utilityPanelRef,
    utilityTab,
    workspaceRef,
  ]);

  useEffect(() => {
    if (isCompactViewport || !isUtilityPanelOpen) {
      utilityPanelRef.current?.style.removeProperty("--workbook-utility-max-height");
      return;
    }
    const updatePanelMaxHeight = () => {
      const panelNode = utilityPanelRef.current;
      const workspaceNode = workspaceRef.current;
      if (!panelNode || !workspaceNode) return;
      const workspaceRect = workspaceNode.getBoundingClientRect();
      const maxHeight = Math.max(280, Math.floor(workspaceRect.height - 16));
      panelNode.style.setProperty("--workbook-utility-max-height", `${maxHeight}px`);
    };
    updatePanelMaxHeight();
    window.addEventListener("resize", updatePanelMaxHeight);
    return () => {
      window.removeEventListener("resize", updatePanelMaxHeight);
      utilityPanelRef.current?.style.removeProperty("--workbook-utility-max-height");
    };
  }, [isCompactViewport, isUtilityPanelOpen, utilityPanelRef, workspaceRef]);

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
