import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { WorkbookPoint } from "@/features/workbook/model/types";
import type { StateUpdater } from "@/features/workbook/model/workbookSessionStoreTypes";
import { readStorage, writeStorage } from "@/shared/lib/localDb";
import {
  CONTEXTBAR_DOCKED_VIEWPORT_MAX_WIDTH,
  CONTEXTBAR_VIEWPORT_MARGIN_PX,
} from "./WorkbookSessionPage.core";

type WorkbookSetUpdater<T> = (updater: StateUpdater<T>) => void;

type UseWorkbookSessionContextbarParams = {
  contextbarStorageKey: string;
  isCompactViewport: boolean;
  isDockedContextbarViewport: boolean;
  isUtilityPanelOpen: boolean;
  contextbarPosition: WorkbookPoint;
  sessionHeadRef: MutableRefObject<HTMLElement | null>;
  contextbarRef: MutableRefObject<HTMLDivElement | null>;
  contextbarDragStateRef: MutableRefObject<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>;
  setIsCompactViewport: Dispatch<SetStateAction<boolean>>;
  setIsDockedContextbarViewport: Dispatch<SetStateAction<boolean>>;
  setIsUtilityPanelCollapsed: Dispatch<SetStateAction<boolean>>;
  setFloatingPanelsTop: WorkbookSetUpdater<number>;
  setContextbarPosition: WorkbookSetUpdater<WorkbookPoint>;
};

export const useWorkbookSessionContextbar = ({
  contextbarStorageKey,
  isCompactViewport,
  isDockedContextbarViewport,
  isUtilityPanelOpen,
  contextbarPosition,
  sessionHeadRef,
  contextbarRef,
  contextbarDragStateRef,
  setIsCompactViewport,
  setIsDockedContextbarViewport,
  setIsUtilityPanelCollapsed,
  setFloatingPanelsTop,
  setContextbarPosition,
}: UseWorkbookSessionContextbarParams) => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsCompactViewport(window.innerWidth <= 760);
      setIsDockedContextbarViewport(
        window.innerWidth <= CONTEXTBAR_DOCKED_VIEWPORT_MAX_WIDTH
      );
    };
    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [setIsCompactViewport, setIsDockedContextbarViewport]);

  useEffect(() => {
    if (!isCompactViewport || !isUtilityPanelOpen) return;
    setIsUtilityPanelCollapsed(true);
  }, [isCompactViewport, isUtilityPanelOpen, setIsUtilityPanelCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCompactViewport) {
      setFloatingPanelsTop(12);
      return;
    }
    const updateFloatingPanelsTop = () => {
      const headRect = sessionHeadRef.current?.getBoundingClientRect() ?? null;
      if (!headRect) {
        setFloatingPanelsTop(86);
        return;
      }
      const nextTop = Math.max(
        12,
        Math.min(112, Math.round((headRect.bottom > 0 ? headRect.bottom : 0) + 10))
      );
      setFloatingPanelsTop((current) => (current === nextTop ? current : nextTop));
    };
    updateFloatingPanelsTop();
    window.addEventListener("scroll", updateFloatingPanelsTop, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", updateFloatingPanelsTop, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateFloatingPanelsTop, true);
      window.removeEventListener("resize", updateFloatingPanelsTop);
    };
  }, [isCompactViewport, sessionHeadRef, setFloatingPanelsTop]);

  const resolveContextbarDefaultPosition = useCallback(() => {
    if (typeof window === "undefined") {
      return { x: 24, y: 18 };
    }
    const dockWidth = contextbarRef.current?.offsetWidth ?? 760;
    return {
      x: Math.max(12, Math.round((window.innerWidth - dockWidth) / 2)),
      y: 18,
    };
  }, [contextbarRef]);

  const clampContextbarPosition = useCallback(
    (position: WorkbookPoint) => {
      if (typeof window === "undefined") return position;
      const dockWidth = contextbarRef.current?.offsetWidth ?? 760;
      const dockHeight = contextbarRef.current?.offsetHeight ?? 104;
      const maxX = Math.max(
        CONTEXTBAR_VIEWPORT_MARGIN_PX,
        window.innerWidth - dockWidth - CONTEXTBAR_VIEWPORT_MARGIN_PX
      );
      const maxY = Math.max(
        CONTEXTBAR_VIEWPORT_MARGIN_PX,
        window.innerHeight - dockHeight - CONTEXTBAR_VIEWPORT_MARGIN_PX
      );
      return {
        x: Math.min(maxX, Math.max(CONTEXTBAR_VIEWPORT_MARGIN_PX, position.x)),
        y: Math.min(maxY, Math.max(CONTEXTBAR_VIEWPORT_MARGIN_PX, position.y)),
      };
    },
    [contextbarRef]
  );

  const handleContextbarDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isDockedContextbarViewport || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, option, a, summary, [role='button'], [role='menuitem'], .MuiButtonBase-root, .MuiInputBase-root, .MuiSwitch-root, .MuiSlider-root"
        )
      ) {
        return;
      }
      event.preventDefault();
      contextbarDragStateRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - contextbarPosition.x,
        offsetY: event.clientY - contextbarPosition.y,
      };
    },
    [contextbarDragStateRef, contextbarPosition.x, contextbarPosition.y, isDockedContextbarViewport]
  );

  useEffect(() => {
    if (!contextbarStorageKey) return;
    const stored = readStorage<{
      position?: { x?: number; y?: number };
    } | null>(contextbarStorageKey, null);
    if (stored?.position) {
      const x =
        typeof stored.position.x === "number" && Number.isFinite(stored.position.x)
          ? stored.position.x
          : resolveContextbarDefaultPosition().x;
      const y =
        typeof stored.position.y === "number" && Number.isFinite(stored.position.y)
          ? stored.position.y
          : resolveContextbarDefaultPosition().y;
      setContextbarPosition({ x, y });
    } else {
      setContextbarPosition(resolveContextbarDefaultPosition());
    }
  }, [contextbarStorageKey, resolveContextbarDefaultPosition, setContextbarPosition]);

  useEffect(() => {
    if (!contextbarStorageKey) return;
    writeStorage(contextbarStorageKey, {
      position: contextbarPosition,
    });
  }, [contextbarPosition, contextbarStorageKey]);

  useEffect(() => {
    if (isDockedContextbarViewport) {
      contextbarDragStateRef.current = null;
      return;
    }
    setContextbarPosition((current) => {
      const next = clampContextbarPosition(current);
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [
    clampContextbarPosition,
    contextbarDragStateRef,
    isDockedContextbarViewport,
    setContextbarPosition,
  ]);

  useEffect(() => {
    if (isDockedContextbarViewport || typeof window === "undefined") return;
    const handleResize = () => {
      setContextbarPosition((current) => {
        const next = clampContextbarPosition(current);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [clampContextbarPosition, isDockedContextbarViewport, setContextbarPosition]);

  useEffect(() => {
    if (isDockedContextbarViewport || typeof ResizeObserver === "undefined") return;
    const dock = contextbarRef.current;
    if (!dock) return;
    const observer = new ResizeObserver(() => {
      setContextbarPosition((current) => {
        const next = clampContextbarPosition(current);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    });
    observer.observe(dock);
    return () => observer.disconnect();
  }, [
    clampContextbarPosition,
    contextbarRef,
    isDockedContextbarViewport,
    setContextbarPosition,
  ]);

  useEffect(() => {
    if (isDockedContextbarViewport || typeof window === "undefined") return;
    const onPointerMove = (event: PointerEvent) => {
      const dragState = contextbarDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      setContextbarPosition(
        clampContextbarPosition({
          x: event.clientX - dragState.offsetX,
          y: event.clientY - dragState.offsetY,
        })
      );
    };
    const onPointerUp = (event: PointerEvent) => {
      const dragState = contextbarDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      contextbarDragStateRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      contextbarDragStateRef.current = null;
    };
  }, [
    clampContextbarPosition,
    contextbarDragStateRef,
    isDockedContextbarViewport,
    setContextbarPosition,
  ]);

  return {
    handleContextbarDragStart,
  };
};
