const EPSILON = 1e-4;
const MIN_RATIO = 0.02;

export type WorkbookImportCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_WORKBOOK_IMPORT_CROP_RECT: WorkbookImportCropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const normalizeWorkbookImportCropRect = (
  value: WorkbookImportCropRect
): WorkbookImportCropRect => {
  const left = clamp(value.x, 0, 1);
  const top = clamp(value.y, 0, 1);
  const right = clamp(value.x + value.width, 0, 1);
  const bottom = clamp(value.y + value.height, 0, 1);
  return {
    x: left,
    y: top,
    width: Math.max(MIN_RATIO, right - left),
    height: Math.max(MIN_RATIO, bottom - top),
  };
};

export const isWorkbookImportCropRectDefault = (value: WorkbookImportCropRect) => {
  const normalized = normalizeWorkbookImportCropRect(value);
  return (
    Math.abs(normalized.x) <= EPSILON &&
    Math.abs(normalized.y) <= EPSILON &&
    Math.abs(normalized.width - 1) <= EPSILON &&
    Math.abs(normalized.height - 1) <= EPSILON
  );
};

const loadImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = dataUrl;
  });

export const cropWorkbookImageDataUrl = async (params: {
  dataUrl: string;
  cropRect: WorkbookImportCropRect;
}) => {
  if (typeof document === "undefined") {
    throw new Error("crop_unavailable");
  }
  const image = await loadImageFromDataUrl(params.dataUrl);
  const naturalWidth = Math.max(1, image.naturalWidth || image.width);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height);
  const cropRect = normalizeWorkbookImportCropRect(params.cropRect);
  const sourceX = Math.max(0, Math.min(naturalWidth - 1, Math.round(cropRect.x * naturalWidth)));
  const sourceY = Math.max(
    0,
    Math.min(naturalHeight - 1, Math.round(cropRect.y * naturalHeight))
  );
  const sourceWidth = Math.max(
    1,
    Math.min(
      naturalWidth - sourceX,
      Math.round(cropRect.width * naturalWidth)
    )
  );
  const sourceHeight = Math.max(
    1,
    Math.min(
      naturalHeight - sourceY,
      Math.round(cropRect.height * naturalHeight)
    )
  );
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("crop_context_unavailable");
  }
  context.clearRect(0, 0, sourceWidth, sourceHeight);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight
  );
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: sourceWidth,
    height: sourceHeight,
  };
};

