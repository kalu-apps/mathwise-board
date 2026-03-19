import { useCallback, type MutableRefObject } from "react";
import {
  getStrokeExportBounds,
  splitExportBoundsToA4Tiles,
  type WorkbookExportBounds,
} from "@/features/workbook/model/export";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import { MAX_EXPORT_CANVAS_SIDE, WORKBOOK_PAGE_FRAME_BOUNDS } from "./WorkbookSessionPage.core";

type SetBoardSettings = (
  next:
    | WorkbookBoardSettings
    | ((state: WorkbookBoardSettings) => WorkbookBoardSettings)
) => void;

type UseWorkbookPdfExportParams = {
  boardSettings: WorkbookBoardSettings;
  boardSettingsRef: MutableRefObject<WorkbookBoardSettings>;
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  sessionId: string;
  sessionTitle?: string | null;
  exportingSections: boolean;
  setExportingSections: (value: boolean) => void;
  setCanvasVisibilityMode: (mode: "viewport" | "full") => void;
  setBoardSettings: SetBoardSettings;
  setError: (value: string | null) => void;
};

const waitForCanvasRender = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

const yieldToMainThread = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

const resolvePageExportBounds = (): WorkbookExportBounds => ({
  minX: WORKBOOK_PAGE_FRAME_BOUNDS.minX,
  minY: WORKBOOK_PAGE_FRAME_BOUNDS.minY,
  maxX: WORKBOOK_PAGE_FRAME_BOUNDS.maxX,
  maxY: WORKBOOK_PAGE_FRAME_BOUNDS.maxY,
  width: WORKBOOK_PAGE_FRAME_BOUNDS.width,
  height: WORKBOOK_PAGE_FRAME_BOUNDS.height,
});

export const useWorkbookPdfExport = ({
  boardSettings,
  boardSettingsRef,
  boardObjects,
  boardStrokes,
  sessionId,
  sessionTitle,
  exportingSections,
  setExportingSections,
  setCanvasVisibilityMode,
  setBoardSettings,
  setError,
}: UseWorkbookPdfExportParams) => {
  const switchBoardPageForExport = useCallback(
    async (targetPage: number) => {
      const safePage = Math.max(1, Math.floor(targetPage));
      if ((boardSettingsRef.current.currentPage ?? 1) === safePage) {
        await waitForCanvasRender();
        return;
      }
      setBoardSettings((state) => ({
        ...state,
        currentPage: safePage,
      }));
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      await new Promise<void>((resolve) => {
        const poll = () => {
          const now = typeof performance !== "undefined" ? performance.now() : Date.now();
          const current = boardSettingsRef.current.currentPage ?? 1;
          if (current === safePage || now - startedAt > 900) {
            resolve();
            return;
          }
          window.requestAnimationFrame(poll);
        };
        window.requestAnimationFrame(poll);
      });
      await waitForCanvasRender();
    },
    [boardSettingsRef, setBoardSettings]
  );

  const resolveExportPageNumbers = useCallback((): number[] => {
    const maxReferencedPage = Math.max(
      1,
      boardSettings.pagesCount || 1,
      ...boardObjects.map((object) => Math.max(1, object.page ?? 1)),
      ...boardStrokes.map((stroke) => Math.max(1, stroke.page ?? 1))
    );
    const contentPages = new Set<number>();

    boardObjects.forEach((object) => {
      contentPages.add(Math.max(1, object.page ?? 1));
    });

    boardStrokes.forEach((stroke) => {
      if (!getStrokeExportBounds(stroke)) return;
      contentPages.add(Math.max(1, stroke.page ?? 1));
    });

    if (contentPages.size === 0) {
      return [Math.max(1, boardSettings.currentPage || 1)];
    }

    return Array.from(contentPages)
      .filter((page) => page >= 1 && page <= maxReferencedPage)
      .sort((left, right) => left - right);
  }, [boardObjects, boardSettings.currentPage, boardSettings.pagesCount, boardStrokes]);

  const renderBoardToCanvas = useCallback(
    async (scale = 2, options?: { bounds?: WorkbookExportBounds | null }) => {
      const svg = document.querySelector<SVGSVGElement>(".workbook-session__canvas-svg");
      if (!svg) return null;
      const bounds = options?.bounds ?? null;
      const svgClone = svg.cloneNode(true) as SVGSVGElement;
      svgClone
        .querySelectorAll<SVGGElement>('[data-workbook-export-only="true"]')
        .forEach((node) => {
          node.style.display = "";
          node.removeAttribute("aria-hidden");
        });
      if (bounds) {
        svgClone.setAttribute(
          "viewBox",
          `${bounds.minX} ${bounds.minY} ${Math.max(1, bounds.width)} ${Math.max(
            1,
            bounds.height
          )}`
        );
        svgClone.setAttribute("width", `${Math.max(1, bounds.width)}`);
        svgClone.setAttribute("height", `${Math.max(1, bounds.height)}`);
        const scaleGroup = Array.from(svgClone.children).find(
          (node) => node.tagName.toLowerCase() === "g"
        );
        if (scaleGroup) {
          scaleGroup.setAttribute("transform", "scale(1)");
          const translateGroup = Array.from(scaleGroup.children).find((node) => {
            if (node.tagName.toLowerCase() !== "g") return false;
            const transform = node.getAttribute("transform");
            return typeof transform === "string" && transform.startsWith("translate(");
          });
          if (translateGroup) {
            translateGroup.setAttribute("transform", "translate(0 0)");
          }
        }
      }
      const serialized = new XMLSerializer().serializeToString(svgClone);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      try {
        const decodedImage = await (async () => {
          if (typeof createImageBitmap === "function") {
            try {
              const bitmap = await createImageBitmap(blob);
              return {
                source: bitmap as CanvasImageSource,
                release: () => bitmap.close(),
              };
            } catch {
              // Fall through to HTMLImageElement decoding below.
            }
          }
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const next = new Image();
            next.onload = () => resolve(next);
            next.onerror = () => reject(new Error("image_load_failed"));
            next.src = url;
          });
          return {
            source: image as CanvasImageSource,
            release: undefined as (() => void) | undefined,
          };
        })();
        const widthSource = bounds?.width ?? svg.viewBox.baseVal.width ?? 1600;
        const heightSource = bounds?.height ?? svg.viewBox.baseVal.height ?? 900;
        const width = Math.max(1, Math.round(widthSource));
        const height = Math.max(1, Math.round(heightSource));
        const requestedScale = Math.max(1, Math.min(4, scale));
        const safeScale = Math.min(
          requestedScale,
          MAX_EXPORT_CANVAS_SIDE / width,
          MAX_EXPORT_CANVAS_SIDE / height
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * safeScale));
        canvas.height = Math.max(1, Math.round(height * safeScale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.save();
        ctx.scale(safeScale, safeScale);
        ctx.fillStyle = boardSettings.backgroundColor || "#f5f7ff";
        ctx.fillRect(0, 0, width, height);
        if (boardSettings.showGrid) {
          const gridStep = Math.max(8, Math.min(96, Math.floor(boardSettings.gridSize || 22)));
          ctx.strokeStyle = boardSettings.gridColor || "rgba(92, 129, 192, 0.32)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const minGridX = bounds ? Math.floor(bounds.minX / gridStep) * gridStep : 0;
          const maxGridX = bounds ? bounds.maxX : width;
          for (let x = minGridX; x <= maxGridX; x += gridStep) {
            const relativeX = bounds ? x - bounds.minX : x;
            const crispX = Math.round(relativeX) + 0.5;
            ctx.moveTo(crispX, 0);
            ctx.lineTo(crispX, height);
          }
          const minGridY = bounds ? Math.floor(bounds.minY / gridStep) * gridStep : 0;
          const maxGridY = bounds ? bounds.maxY : height;
          for (let y = minGridY; y <= maxGridY; y += gridStep) {
            const relativeY = bounds ? y - bounds.minY : y;
            const crispY = Math.round(relativeY) + 0.5;
            ctx.moveTo(0, crispY);
            ctx.lineTo(width, crispY);
          }
          ctx.stroke();
        }
        ctx.drawImage(decodedImage.source, 0, 0, width, height);
        ctx.restore();
        decodedImage.release?.();
        return { canvas, width, height };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [boardSettings.backgroundColor, boardSettings.gridColor, boardSettings.gridSize, boardSettings.showGrid]
  );

  const resolveExportFileBaseName = useCallback(() => {
    const fallback = `workbook-${sessionId || "session"}`;
    const source = sessionTitle?.trim() || fallback;
    const cleaned = source
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");
    return cleaned || fallback;
  }, [sessionId, sessionTitle]);

  const requestExportFileName = useCallback(
    (extension: "pdf") => {
      const fallback = resolveExportFileBaseName();
      if (typeof window === "undefined") {
        return `${fallback}.${extension}`;
      }
      const entered = window.prompt(
        `Введите имя файла (${extension.toUpperCase()})`,
        fallback
      );
      if (entered === null) return null;
      const normalized = entered
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .replace(new RegExp(`\\.${extension}$`, "i"), "")
        .replace(/[. ]+$/g, "");
      const base = normalized || fallback;
      return `${base}.${extension}`;
    },
    [resolveExportFileBaseName]
  );

  const exportBoardAsPdf = useCallback(async () => {
    if (exportingSections) return;
    setExportingSections(true);
    const currentPage = Math.max(1, boardSettings.currentPage || 1);
    let activePage = currentPage;
    try {
      const fileName = requestExportFileName("pdf");
      if (!fileName) return;
      const exportPages = resolveExportPageNumbers();
      const previousPage = currentPage;
      const exportTilesByPage = new Map(
        exportPages.map((pageNumber) => [
          pageNumber,
          splitExportBoundsToA4Tiles({
            bounds: resolvePageExportBounds(),
            tileWidth: WORKBOOK_PAGE_FRAME_BOUNDS.width,
            overlap: 0,
          }),
        ])
      );
      const renderedPages: Array<{ dataUrl: string }> = [];
      setCanvasVisibilityMode("full");
      await waitForCanvasRender();
      for (const pageNumber of exportPages) {
        if (pageNumber !== activePage) {
          await switchBoardPageForExport(pageNumber);
          activePage = pageNumber;
        } else {
          await waitForCanvasRender();
        }
        const tiles = exportTilesByPage.get(pageNumber) ?? [];
        for (const tile of tiles) {
          const rendered = await renderBoardToCanvas(2.2, {
            bounds: tile.bounds,
          });
          if (!rendered) continue;
          renderedPages.push({
            dataUrl: rendered.canvas.toDataURL("image/png"),
          });
          await yieldToMainThread();
        }
        await yieldToMainThread();
      }
      if (previousPage !== activePage) {
        await switchBoardPageForExport(previousPage);
        activePage = previousPage;
      }
      if (renderedPages.length === 0) {
        setError("Не удалось подготовить страницы для PDF.");
        return;
      }
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      renderedPages.forEach((page, index) => {
        if (index > 0) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(page.dataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
      });
      pdf.save(fileName);
    } catch {
      setError("Не удалось экспортировать PDF.");
    } finally {
      setCanvasVisibilityMode("viewport");
      if (activePage !== currentPage) {
        setBoardSettings((state) => ({
          ...state,
          currentPage,
        }));
      }
      setExportingSections(false);
    }
  }, [
    boardSettings.currentPage,
    exportingSections,
    renderBoardToCanvas,
    requestExportFileName,
    resolveExportPageNumbers,
    setBoardSettings,
    setCanvasVisibilityMode,
    setError,
    setExportingSections,
    switchBoardPageForExport,
  ]);

  return { exportBoardAsPdf };
};
