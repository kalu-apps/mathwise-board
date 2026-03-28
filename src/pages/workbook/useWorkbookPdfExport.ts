import { useCallback, useMemo, type MutableRefObject } from "react";
import { jsPDF } from "jspdf";
import {
  type WorkbookExportBounds,
} from "@/features/workbook/model/export";
import { normalizeWorkbookAssetContentUrl } from "@/features/workbook/model/workbookAssetUrl";
import {
  WORKBOOK_BOARD_BACKGROUND_COLOR,
  WORKBOOK_BOARD_GRID_COLOR,
} from "@/features/workbook/model/workbookVisualColors";
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

type ExportPdfOptions = {
  fileName?: string;
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

const EXPORT_MAX_CANVAS_PIXELS = 8_500_000;
const EXPORT_MIN_SCALE = 0.35;
const EXPORT_PDF_FOOTER_HEIGHT_PT = 58;
const EXPORT_PDF_FOOTER_SIDE_PADDING_PT = 24;
const EXPORT_PDF_FOOTER_LINE_Y_OFFSET_PT = 12;
const EXPORT_PDF_FOOTER_PRIMARY_FONT_SIZE_PT = 8;
const EXPORT_PDF_FOOTER_SECONDARY_FONT_SIZE_PT = 6.3;
const EXPORT_PDF_FOOTER_PRIMARY_TEXT_RGB = 56;
const EXPORT_PDF_FOOTER_SECONDARY_TEXT_RGB = 86;
const inlinedExportImageUrls = new Map<string, Promise<string | null>>();
const WORKBOOK_ASSET_PATH_RE = /^\/api\/workbook\/sessions\/[^/]+\/assets\/[^/]+(?:\/content)?$/i;
const WORKBOOK_PDF_COPYRIGHT_NOTICE =
  "Материалы охраняются авторским правом. Копирование, распространение, передача третьим лицам и размещение в сети Интернет полностью или частично без письменного разрешения правообладателя запрещены. Ст. 1229, 1255, 1259, 1270 ГК РФ.";

const resolveSvgImageHref = (node: SVGImageElement) => {
  const href = node.getAttribute("href");
  if (typeof href === "string" && href.trim().length > 0) return href.trim();
  const xlinkHref = node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
  return typeof xlinkHref === "string" && xlinkHref.trim().length > 0 ? xlinkHref.trim() : "";
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string | null>((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });

const parseNumericSvgAttr = (node: Element, name: string, fallback = 0) => {
  const raw = node.getAttribute(name);
  if (typeof raw !== "string") return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseCssPixelSize = (value: string, fallback: number) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Browser SVG->canvas decode can fail when foreignObject is present.
// Convert text foreignObject nodes to pure SVG text before export rasterization.
const normalizeForeignObjectTextForExport = (svg: SVGSVGElement) => {
  const textLikeForeignObjects = Array.from(
    svg.querySelectorAll<SVGForeignObjectElement>("foreignObject")
  ).filter((node) =>
    Boolean(
      node.querySelector(".workbook-session__text-render") ??
        node.querySelector(".workbook-session__text-editor-input")
    )
  );

  textLikeForeignObjects.forEach((node) => {
    const textRenderNode = node.querySelector<HTMLElement>(".workbook-session__text-render");
    const textEditorNode = node.querySelector<HTMLTextAreaElement>(
      ".workbook-session__text-editor-input"
    );
    const sourceNode = textEditorNode ?? textRenderNode;
    if (!sourceNode) return;

    const rawText = textEditorNode ? textEditorNode.value : sourceNode.textContent ?? "";
    const normalizedText = rawText.replace(/\r\n/g, "\n");
    const lines = normalizedText.split("\n");
    if (lines.length === 0) {
      node.remove();
      return;
    }

    const x = parseNumericSvgAttr(node, "x", 0);
    const y = parseNumericSvgAttr(node, "y", 0);
    const width = Math.max(1, parseNumericSvgAttr(node, "width", 1));
    const fontSize = Math.max(10, parseCssPixelSize(sourceNode.style.fontSize, 18));
    const lineHeight = Math.max(fontSize * 1.32, fontSize + 4);
    const textAlign =
      sourceNode.style.textAlign === "center" || sourceNode.style.textAlign === "right"
        ? sourceNode.style.textAlign
        : "left";
    const textAnchor =
      textAlign === "center" ? "middle" : textAlign === "right" ? "end" : "start";
    const textX =
      textAlign === "center" ? x + width / 2 : textAlign === "right" ? x + width - 4 : x + 4;
    const baselineY = y + Math.max(fontSize, 14);

    const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textNode.setAttribute("x", String(textX));
    textNode.setAttribute("y", String(baselineY));
    textNode.setAttribute("text-anchor", textAnchor);
    textNode.setAttribute("fill", sourceNode.style.color || "#1f252b");
    textNode.setAttribute("font-size", String(fontSize));
    textNode.setAttribute(
      "font-family",
      sourceNode.style.fontFamily || "\"Fira Sans\", \"Segoe UI\", sans-serif"
    );
    textNode.setAttribute(
      "font-weight",
      sourceNode.style.fontWeight && sourceNode.style.fontWeight.length > 0
        ? sourceNode.style.fontWeight
        : "500"
    );
    textNode.setAttribute("font-style", sourceNode.style.fontStyle || "normal");
    if (sourceNode.style.textDecoration) {
      textNode.setAttribute("text-decoration", sourceNode.style.textDecoration);
    }

    lines.forEach((line, index) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("x", String(textX));
      if (index === 0) {
        tspan.setAttribute("y", String(baselineY));
      } else {
        tspan.setAttribute("dy", String(lineHeight));
      }
      tspan.textContent = line.length > 0 ? line : " ";
      textNode.appendChild(tspan);
    });

    node.parentNode?.insertBefore(textNode, node);
    node.remove();
  });
};

const triggerPdfDownloadFallback = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
};

const savePdfSafely = (pdf: { save: (fileName: string) => void; output: (type: "blob") => Blob }, fileName: string) => {
  try {
    pdf.save(fileName);
    return;
  } catch {
    const blob = pdf.output("blob");
    if (!(blob instanceof Blob) || blob.size <= 0) {
      throw new Error("pdf_output_blob_failed");
    }
    triggerPdfDownloadFallback(blob, fileName);
  }
};

const wrapCanvasText = (params: {
  ctx: CanvasRenderingContext2D;
  text: string;
  maxWidth: number;
}): string[] => {
  const normalized = params.text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return [];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (params.ctx.measureText(candidate).width <= params.maxWidth || current.length === 0) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
};

const drawWorkbookPdfFooter = (params: {
  pdf: jsPDF;
  pageWidth: number;
  pageHeight: number;
}) => {
  const { pdf, pageWidth, pageHeight } = params;
  if (typeof document === "undefined") return;
  const scale = Math.max(1, Math.min(3, window.devicePixelRatio || 2));
  const footerCanvas = document.createElement("canvas");
  const footerWidth = Math.max(1, Math.round(pageWidth * scale));
  const footerHeight = Math.max(1, Math.round(EXPORT_PDF_FOOTER_HEIGHT_PT * scale));
  footerCanvas.width = footerWidth;
  footerCanvas.height = footerHeight;
  const ctx = footerCanvas.getContext("2d");
  if (!ctx) return;

  const currentYear = new Date().getFullYear();
  const primaryText = `© ${currentYear} · Автор: Калугина Анна Викторовна`;

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, pageWidth, EXPORT_PDF_FOOTER_HEIGHT_PT);

  const lineY = Math.min(
    EXPORT_PDF_FOOTER_HEIGHT_PT - 2,
    EXPORT_PDF_FOOTER_LINE_Y_OFFSET_PT
  );
  ctx.strokeStyle = "rgba(210, 214, 224, 0.95)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(EXPORT_PDF_FOOTER_SIDE_PADDING_PT, lineY);
  ctx.lineTo(pageWidth - EXPORT_PDF_FOOTER_SIDE_PADDING_PT, lineY);
  ctx.stroke();

  const textMaxWidth = Math.max(40, pageWidth - EXPORT_PDF_FOOTER_SIDE_PADDING_PT * 2);
  const primaryY = lineY + 12;
  ctx.fillStyle = `rgb(${EXPORT_PDF_FOOTER_PRIMARY_TEXT_RGB}, ${EXPORT_PDF_FOOTER_PRIMARY_TEXT_RGB}, ${EXPORT_PDF_FOOTER_PRIMARY_TEXT_RGB})`;
  ctx.font = `italic ${EXPORT_PDF_FOOTER_PRIMARY_FONT_SIZE_PT}px "Times New Roman", Georgia, serif`;
  ctx.textBaseline = "top";
  ctx.fillText(primaryText, EXPORT_PDF_FOOTER_SIDE_PADDING_PT, primaryY);

  const secondaryY = primaryY + 10;
  ctx.fillStyle = `rgb(${EXPORT_PDF_FOOTER_SECONDARY_TEXT_RGB}, ${EXPORT_PDF_FOOTER_SECONDARY_TEXT_RGB}, ${EXPORT_PDF_FOOTER_SECONDARY_TEXT_RGB})`;
  ctx.font = `${EXPORT_PDF_FOOTER_SECONDARY_FONT_SIZE_PT}px "Times New Roman", Georgia, serif`;
  const secondaryLines = wrapCanvasText({
    ctx,
    text: WORKBOOK_PDF_COPYRIGHT_NOTICE,
    maxWidth: textMaxWidth,
  });
  let cursorY = secondaryY;
  secondaryLines.forEach((line) => {
    ctx.fillText(line, EXPORT_PDF_FOOTER_SIDE_PADDING_PT, cursorY);
    cursorY += EXPORT_PDF_FOOTER_SECONDARY_FONT_SIZE_PT * 1.28;
  });

  pdf.addImage(
    footerCanvas,
    "PNG",
    0,
    pageHeight - EXPORT_PDF_FOOTER_HEIGHT_PT,
    pageWidth,
    EXPORT_PDF_FOOTER_HEIGHT_PT,
    undefined,
    "FAST"
  );
};

const resolveSameOriginWorkbookAssetUrl = (source: string) => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = new URL(source, window.location.origin);
    if (!WORKBOOK_ASSET_PATH_RE.test(parsed.pathname)) return null;
    return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const fetchImageAsDataUrl = async (source: string) => {
  try {
    const response = await fetch(source, {
      method: "GET",
      credentials: "include",
      cache: "force-cache",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
};

const resolveExportImageHref = async (rawHref: string) => {
  const normalizedHref = normalizeWorkbookAssetContentUrl(rawHref);
  const source = typeof normalizedHref === "string" ? normalizedHref.trim() : "";
  if (!source || source === "content" || source === "/content") {
    return null;
  }
  if (source.startsWith("data:")) {
    return source;
  }

  let inlinePromise = inlinedExportImageUrls.get(source);
  if (!inlinePromise) {
    inlinePromise = (async () => {
      const sameOriginSource = resolveSameOriginWorkbookAssetUrl(source);
      const fetchCandidates =
        typeof sameOriginSource === "string" && sameOriginSource.length > 0
          ? Array.from(new Set([sameOriginSource, source]))
          : [source];

      for (const candidate of fetchCandidates) {
        const inlined = await fetchImageAsDataUrl(candidate);
        if (typeof inlined === "string" && inlined.length > 0) {
          return inlined;
        }
      }
      return null;
    })();
    inlinedExportImageUrls.set(source, inlinePromise);
  }

  const inlinedHref = await inlinePromise;
  if (typeof inlinedHref === "string" && inlinedHref.length > 0) {
    return inlinedHref;
  }
  return null;
};

const waitForSvgImageResources = async (svg: SVGSVGElement) => {
  const imageNodes = Array.from(svg.querySelectorAll<SVGImageElement>("image"));
  if (imageNodes.length === 0) return;

  await Promise.all(
    imageNodes.map(async (node) => {
      const href = resolveSvgImageHref(node);
      if (!href) {
        node.remove();
        return;
      }
      const resolvedHref = await resolveExportImageHref(href);
      if (!resolvedHref) {
        node.remove();
        return;
      }
      node.setAttribute("href", resolvedHref);
      node.setAttributeNS("http://www.w3.org/1999/xlink", "href", resolvedHref);
    })
  );
};

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
  const resolveUniformContentExportBounds = useCallback(
    (_exportPages: number[]): WorkbookExportBounds => resolvePageExportBounds(),
    []
  );

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
      normalizeForeignObjectTextForExport(svgClone);
      await waitForSvgImageResources(svgClone);
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
        const requestedScale = Math.max(EXPORT_MIN_SCALE, Math.min(4, scale));
        const scaleBySide = Math.min(MAX_EXPORT_CANVAS_SIDE / width, MAX_EXPORT_CANVAS_SIDE / height);
        const scaleByPixels = Math.sqrt(EXPORT_MAX_CANVAS_PIXELS / Math.max(1, width * height));
        const safeScale = Math.max(
          EXPORT_MIN_SCALE,
          Math.min(requestedScale, scaleBySide, scaleByPixels)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * safeScale));
        canvas.height = Math.max(1, Math.round(height * safeScale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.save();
        ctx.scale(safeScale, safeScale);
        ctx.fillStyle = boardSettings.backgroundColor || WORKBOOK_BOARD_BACKGROUND_COLOR;
        ctx.fillRect(0, 0, width, height);
        if (boardSettings.showGrid) {
          const gridStep = Math.max(8, Math.min(96, Math.floor(boardSettings.gridSize || 22)));
          ctx.strokeStyle = boardSettings.gridColor || WORKBOOK_BOARD_GRID_COLOR;
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

  const resolveExportPdfFileName = useCallback(
    (options?: ExportPdfOptions) => {
      const fallback = resolveExportFileBaseName();
      const normalized = String(options?.fileName ?? "")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .replace(/\.pdf$/i, "")
        .replace(/[. ]+$/g, "");
      const base = normalized || fallback;
      return `${base}.pdf`;
    },
    [resolveExportFileBaseName]
  );

  const defaultExportPdfName = useMemo(() => resolveExportFileBaseName(), [resolveExportFileBaseName]);

  const exportBoardAsPdf = useCallback(async (options?: ExportPdfOptions) => {
    if (exportingSections) return;
    setExportingSections(true);
    const currentPage = Math.max(1, boardSettings.currentPage || 1);
    let activePage = currentPage;
    try {
      const fileName = resolveExportPdfFileName(options);
      const exportPages = resolveExportPageNumbers();
      const previousPage = currentPage;
      const uniformBounds = resolveUniformContentExportBounds(exportPages);
      const exportTilesByPage = new Map(
        exportPages.map((pageNumber) => [
          pageNumber,
          [
            {
              row: 0,
              column: 0,
              index: 0,
              bounds: uniformBounds,
            },
          ],
        ])
      );
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let renderedPagesCount = 0;
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
          if (renderedPagesCount > 0) {
            pdf.addPage("a4", "portrait");
          }
          const contentHeight = Math.max(1, pageHeight - EXPORT_PDF_FOOTER_HEIGHT_PT);
          pdf.addImage(
            rendered.canvas,
            "JPEG",
            0,
            0,
            pageWidth,
            contentHeight,
            undefined,
            "FAST"
          );
          try {
            drawWorkbookPdfFooter({ pdf, pageWidth, pageHeight });
          } catch {
            // Footer issues must never fail the whole PDF export flow.
          }
          renderedPagesCount += 1;
          await yieldToMainThread();
        }
        await yieldToMainThread();
      }
      if (previousPage !== activePage) {
        await switchBoardPageForExport(previousPage);
        activePage = previousPage;
      }
      if (renderedPagesCount === 0) {
        setError("Не удалось подготовить страницы для PDF.");
        return;
      }
      savePdfSafely(pdf, fileName);
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.error("[workbook-pdf-export] failed", error);
      }
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
    resolveExportPdfFileName,
    resolveExportPageNumbers,
    resolveUniformContentExportBounds,
    setBoardSettings,
    setCanvasVisibilityMode,
    setError,
    setExportingSections,
    switchBoardPageForExport,
  ]);

  return { exportBoardAsPdf, defaultExportPdfName };
};
