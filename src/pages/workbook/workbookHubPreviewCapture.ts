const WORKBOOK_PREVIEW_MAX_SIDE_PX = 1280;
const WORKBOOK_PREVIEW_JPEG_QUALITY = 0.82;
const WORKBOOK_PREVIEW_MAX_INLINE_IMAGES = 16;

const parseCssPixelSize = (value: string, fallback: number) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const drawWorkbookGrid = (
  context: CanvasRenderingContext2D,
  params: {
    width: number;
    height: number;
    sourceWidth: number;
    targetWidth: number;
    gridSizePx: number;
    gridColor: string;
  }
) => {
  const scale = params.targetWidth / Math.max(1, params.sourceWidth);
  const scaledGridSize = Math.max(1, params.gridSizePx * scale);
  if (scaledGridSize <= 1) return;
  context.save();
  context.strokeStyle = params.gridColor;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0.5; x <= params.width; x += scaledGridSize) {
    context.moveTo(x, 0);
    context.lineTo(x, params.height);
  }
  for (let y = 0.5; y <= params.height; y += scaledGridSize) {
    context.moveTo(0, y);
    context.lineTo(params.width, y);
  }
  context.stroke();
  context.restore();
};

const loadImageFromObjectUrl = (objectUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("workbook_preview_image_load_failed"));
    image.src = objectUrl;
  });

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.startsWith("data:")) {
        resolve(result);
        return;
      }
      reject(new Error("workbook_preview_blob_to_data_url_failed"));
    };
    reader.onerror = () => reject(new Error("workbook_preview_blob_to_data_url_failed"));
    reader.readAsDataURL(blob);
  });

const resolveSvgImageHref = (node: SVGImageElement) => {
  const hrefAttr = node.getAttribute("href");
  if (hrefAttr && hrefAttr.trim().length > 0) return hrefAttr.trim();
  const xlinkHref = node.getAttributeNS("http://www.w3.org/1999/xlink", "href");
  return xlinkHref && xlinkHref.trim().length > 0 ? xlinkHref.trim() : "";
};

const writeSvgImageHref = (node: SVGImageElement, value: string) => {
  node.setAttribute("href", value);
  node.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", value);
};

const inlineSvgImagesAsDataUrls = async (svg: SVGSVGElement) => {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  const imageNodes = Array.from(svg.querySelectorAll<SVGImageElement>("image"));
  if (imageNodes.length === 0) return;

  const cache = new Map<string, string | null>();
  const limitedNodes = imageNodes.slice(0, WORKBOOK_PREVIEW_MAX_INLINE_IMAGES);
  await Promise.all(
    limitedNodes.map(async (node) => {
      const rawHref = resolveSvgImageHref(node);
      if (!rawHref || rawHref.startsWith("data:")) return;

      let absoluteHref: string;
      try {
        absoluteHref = new URL(rawHref, window.location.origin).toString();
      } catch {
        return;
      }

      if (!cache.has(absoluteHref)) {
        try {
          const response = await fetch(absoluteHref, {
            credentials: "include",
            cache: "force-cache",
          });
          if (!response.ok) {
            cache.set(absoluteHref, null);
          } else {
            const blob = await response.blob();
            cache.set(absoluteHref, await readBlobAsDataUrl(blob));
          }
        } catch {
          cache.set(absoluteHref, null);
        }
      }

      const inlinedHref = cache.get(absoluteHref);
      if (!inlinedHref) return;
      writeSvgImageHref(node, inlinedHref);
    })
  );
};

const resolveSafeCanvasSize = (width: number, height: number) => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const largestSide = Math.max(safeWidth, safeHeight);
  if (largestSide <= WORKBOOK_PREVIEW_MAX_SIDE_PX) {
    return {
      width: safeWidth,
      height: safeHeight,
    };
  }
  const scale = WORKBOOK_PREVIEW_MAX_SIDE_PX / largestSide;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
};

const serializeWorkbookCanvasSvg = async (
  svg: SVGSVGElement,
  sourceWidth: number,
  sourceHeight: number
) => {
  const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clonedSvg.setAttribute("width", String(Math.max(1, Math.round(sourceWidth))));
  clonedSvg.setAttribute("height", String(Math.max(1, Math.round(sourceHeight))));
  await inlineSvgImagesAsDataUrls(clonedSvg);
  return new XMLSerializer().serializeToString(clonedSvg);
};

export const captureWorkbookSessionPreviewDataUrl = async (
  scopeRoot: HTMLElement | null | undefined
) => {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const root = scopeRoot ?? document.body;
  const canvasNode = root.querySelector<HTMLElement>(".workbook-session__canvas");
  if (!canvasNode) return null;
  const svgNode = canvasNode.querySelector<SVGSVGElement>(".workbook-session__canvas-svg");
  if (!svgNode) return null;
  const committedCanvasNode = canvasNode.querySelector<HTMLCanvasElement>(
    ".workbook-session__canvas-committed"
  );

  const rect = canvasNode.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
  if (rect.width <= 1 || rect.height <= 1) return null;

  const sourceWidth = Math.round(rect.width);
  const sourceHeight = Math.round(rect.height);
  const targetSize = resolveSafeCanvasSize(sourceWidth, sourceHeight);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = targetSize.width;
  outputCanvas.height = targetSize.height;
  const context = outputCanvas.getContext("2d");
  if (!context) return null;

  const canvasComputedStyle = window.getComputedStyle(canvasNode);
  const backgroundColor =
    canvasComputedStyle.getPropertyValue("--workbook-background-color").trim() ||
    canvasComputedStyle.backgroundColor ||
    "#ffffff";
  const gridColor = canvasComputedStyle.getPropertyValue("--workbook-grid-color").trim();
  const gridSizePx = parseCssPixelSize(
    canvasComputedStyle.getPropertyValue("--workbook-grid-size"),
    22
  );

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, targetSize.width, targetSize.height);
  if (gridColor && gridColor.toLowerCase() !== "transparent") {
    drawWorkbookGrid(context, {
      width: targetSize.width,
      height: targetSize.height,
      sourceWidth,
      targetWidth: targetSize.width,
      gridSizePx,
      gridColor,
    });
  }
  if (committedCanvasNode) {
    context.drawImage(committedCanvasNode, 0, 0, targetSize.width, targetSize.height);
  }

  try {
    const serializedSvg = await serializeWorkbookCanvasSvg(svgNode, sourceWidth, sourceHeight);
    const svgBlob = new Blob([serializedSvg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgObjectUrl = URL.createObjectURL(svgBlob);
    try {
      const svgImage = await loadImageFromObjectUrl(svgObjectUrl);
      context.drawImage(svgImage, 0, 0, targetSize.width, targetSize.height);
    } finally {
      URL.revokeObjectURL(svgObjectUrl);
    }
  } catch {
    // Keep a best-effort preview using committed canvas layer only.
  }

  try {
    const dataUrl = outputCanvas.toDataURL("image/jpeg", WORKBOOK_PREVIEW_JPEG_QUALITY);
    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
      return dataUrl;
    }
  } catch {
    return null;
  }
  return null;
};
