const WORKBOOK_PREVIEW_MAX_SIDE_PX = 1280;
const WORKBOOK_PREVIEW_JPEG_QUALITY = 0.82;

const loadImageFromObjectUrl = (objectUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("workbook_preview_image_load_failed"));
    image.src = objectUrl;
  });

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

const serializeWorkbookCanvasSvg = (
  svg: SVGSVGElement,
  sourceWidth: number,
  sourceHeight: number
) => {
  const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clonedSvg.setAttribute("width", String(Math.max(1, Math.round(sourceWidth))));
  clonedSvg.setAttribute("height", String(Math.max(1, Math.round(sourceHeight))));
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

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetSize.width, targetSize.height);
  if (committedCanvasNode) {
    context.drawImage(committedCanvasNode, 0, 0, targetSize.width, targetSize.height);
  }

  try {
    const serializedSvg = serializeWorkbookCanvasSvg(svgNode, sourceWidth, sourceHeight);
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
