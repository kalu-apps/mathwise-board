import { useEffect, useMemo, useState } from "react";
import type { WorkbookPoint } from "../model/types";
import {
  clampWorkbookViewportOffsetToPageFrame,
  resolveWorkbookPageFrameBounds,
} from "../model/pageFrame";
import { resolveWorkbookDisplayBias } from "./resolveWorkbookDisplayBias";

type UseWorkbookCanvasViewportParams = {
  containerNode: HTMLDivElement | null;
  viewportZoom: number;
  pageFrameWidth: number;
  viewportOffset: WorkbookPoint;
  onViewportOffsetChange?: (offset: WorkbookPoint) => void;
  focusPoint?: WorkbookPoint | null;
  pointerPoint?: WorkbookPoint | null;
  focusPoints: WorkbookPoint[];
  pointerPoints: WorkbookPoint[];
  autoDividerStep: number;
  autoDividersEnabled: boolean;
};

const useElementSize = (element: HTMLDivElement | null) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(1, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(1, Math.floor(entry.contentRect.height));
      setSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return size;
};

export const useWorkbookCanvasViewport = ({
  containerNode,
  viewportZoom,
  pageFrameWidth,
  viewportOffset,
  onViewportOffsetChange,
  focusPoint,
  pointerPoint,
  focusPoints,
  pointerPoints,
  autoDividerStep,
  autoDividersEnabled,
}: UseWorkbookCanvasViewportParams) => {
  const size = useElementSize(containerNode);
  const pageFrameBounds = useMemo(
    () => resolveWorkbookPageFrameBounds(pageFrameWidth),
    [pageFrameWidth]
  );
  const relativeZoom = Math.max(
    0.3,
    Math.min(3, Number.isFinite(viewportZoom) ? viewportZoom : 1)
  );
  const fitZoom = useMemo(() => {
    const widthFit = size.width > 0 ? size.width / pageFrameBounds.width : 1;
    const candidate = widthFit;
    return Number.isFinite(candidate) && candidate > 0 ? candidate : 1;
  }, [pageFrameBounds.width, size.width]);
  // Runtime semantics: 100% fits the whole working width into viewport.
  // Values above/below 100% zoom relative to that baseline.
  const safeZoom = Math.max(0.02, fitZoom * relativeZoom);
  const pageSurfaceZoom = relativeZoom < 1 ? fitZoom : safeZoom;
  const visibleViewportWidth = Math.max(1, size.width / safeZoom);
  const visibleViewportHeight = Math.max(1, size.height / safeZoom);
  const allowHorizontalPan = pageFrameBounds.width > visibleViewportWidth + 1;
  const resolvedViewportOffset = useMemo(
    () => {
      const clamped = clampWorkbookViewportOffsetToPageFrame({
        offset: viewportOffset,
        bounds: pageFrameBounds,
        viewportWidth: visibleViewportWidth,
        viewportHeight: visibleViewportHeight,
      });
      return clamped;
    },
    [pageFrameBounds, viewportOffset, visibleViewportHeight, visibleViewportWidth]
  );

  useEffect(() => {
    if (!onViewportOffsetChange) return;
    const deltaX = Math.abs(resolvedViewportOffset.x - viewportOffset.x);
    const deltaY = Math.abs(resolvedViewportOffset.y - viewportOffset.y);
    if (deltaX <= 0.01 && deltaY <= 0.01) return;
    onViewportOffsetChange(resolvedViewportOffset);
  }, [onViewportOffsetChange, resolvedViewportOffset, viewportOffset.x, viewportOffset.y]);

  const effectiveFocusPoints = useMemo(() => {
    const base = focusPoints.length > 0 ? focusPoints : focusPoint ? [focusPoint] : [];
    if (base.length <= 1) return base;
    const seen = new Set<string>();
    return base.filter((point) => {
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [focusPoint, focusPoints]);

  const effectivePointerPoints = useMemo(() => {
    const base =
      pointerPoints.length > 0 ? pointerPoints : pointerPoint ? [pointerPoint] : [];
    if (base.length <= 1) return base;
    const seen = new Set<string>();
    return base.filter((point) => {
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pointerPoint, pointerPoints]);

  const autoDividerLines = (() => {
    if (!autoDividersEnabled) return [];
    const step = Math.max(320, Math.floor(autoDividerStep || 960));
    const visibleWidth = visibleViewportWidth;
    const visibleHeight = visibleViewportHeight;
    const visibleLeft = Math.max(0, resolvedViewportOffset.x);
    const visibleTop = Math.max(0, resolvedViewportOffset.y);
    const visibleRight = visibleLeft + visibleWidth;
    const visibleBottom = visibleTop + visibleHeight;
    const startY = Math.max(0, Math.floor(visibleTop / step) * step);
    const lines: Array<{
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }> = [];
    for (let y = startY; y <= visibleBottom + step; y += step) {
      lines.push({
        key: `auto-divider-${y}`,
        x1: visibleLeft - 2000,
        y1: y,
        x2: visibleRight + 2000,
        y2: y,
      });
    }
    return lines;
  })();

  const displayBias = useMemo(
    () =>
      resolveWorkbookDisplayBias({
        viewportWidthPx: size.width,
        viewportHeightPx: size.height,
        pageFrameBounds,
        viewportOffset: resolvedViewportOffset,
        safeZoom,
      }),
    [
      pageFrameBounds,
      resolvedViewportOffset,
      safeZoom,
      size.height,
      size.width,
    ]
  );
  const pageSurfaceDisplayBias = useMemo(
    () =>
      resolveWorkbookDisplayBias({
        viewportWidthPx: size.width,
        viewportHeightPx: size.height,
        pageFrameBounds,
        viewportOffset: resolvedViewportOffset,
        safeZoom: pageSurfaceZoom,
      }),
    [
      pageFrameBounds,
      pageSurfaceZoom,
      resolvedViewportOffset,
      size.height,
      size.width,
    ]
  );

  return {
    size,
    safeZoom,
    pageSurfaceZoom,
    allowHorizontalPan,
    pageFrameBounds,
    visibleViewportWidth,
    visibleViewportHeight,
    resolvedViewportOffset,
    displayBias,
    pageSurfaceDisplayBias,
    effectiveFocusPoints,
    effectivePointerPoints,
    autoDividerLines,
  };
};
