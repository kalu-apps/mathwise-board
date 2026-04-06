import type { WorkbookPoint } from "../model/types";
import type { WorkbookPageFrameBounds } from "../model/pageFrame";

type ResolveWorkbookDisplayBiasParams = {
  viewportWidthPx: number;
  viewportHeightPx: number;
  pageFrameBounds: WorkbookPageFrameBounds;
  viewportOffset: WorkbookPoint;
  safeZoom: number;
};

const toFinitePositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export const resolveWorkbookDisplayBias = (
  params: ResolveWorkbookDisplayBiasParams
): WorkbookPoint => {
  const safeViewportWidthPx = Math.max(1, Math.floor(toFinitePositive(params.viewportWidthPx, 1)));
  const safeViewportHeightPx = Math.max(
    1,
    Math.floor(toFinitePositive(params.viewportHeightPx, 1))
  );
  const safeRenderZoom = Math.max(0.02, toFinitePositive(params.safeZoom, 1));
  const pageLeftPx =
    (params.pageFrameBounds.minX - toFinitePositive(params.viewportOffset.x, 0)) * safeRenderZoom;
  const pageTopPx =
    (params.pageFrameBounds.minY - toFinitePositive(params.viewportOffset.y, 0)) * safeRenderZoom;
  const pageWidthPx = Math.max(1, params.pageFrameBounds.width * safeRenderZoom);
  const pageHeightPx = Math.max(1, params.pageFrameBounds.height * safeRenderZoom);
  const availableX = safeViewportWidthPx - pageWidthPx;
  const availableY = safeViewportHeightPx - pageHeightPx;

  return {
    x: availableX > 0.5 ? availableX / 2 - pageLeftPx : 0,
    y: availableY > 0.5 ? availableY / 2 - pageTopPx : 0,
  };
};
