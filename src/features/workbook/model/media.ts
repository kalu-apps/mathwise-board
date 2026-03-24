// Source PDF can be larger than the final import payload as long as selected pages fit limits.
export const WORKBOOK_PDF_SOURCE_MAX_BYTES = 64 * 1024 * 1024;
export const WORKBOOK_PDF_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const WORKBOOK_IMAGE_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
// Keep payloads bounded for stability, but allow noticeably better visual quality.
export const WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS = 96_000;
export const WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS = 180_000;

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "pjpeg",
  "pjp",
  "gif",
  "bmp",
  "webp",
  "svg",
  "avif",
  "apng",
  "tif",
  "tiff",
  "ico",
  "heic",
  "heif",
]);

export const readFileExtension = (fileName: string) => {
  const safeName = typeof fileName === "string" ? fileName.trim().toLowerCase() : "";
  const dotIndex = safeName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= safeName.length - 1) return "";
  return safeName.slice(dotIndex + 1);
};

export const isPdfUploadFile = (file: File) =>
  file.type.toLowerCase().includes("pdf") || readFileExtension(file.name) === "pdf";

export const isImageUploadFile = (file: File) => {
  if (file.type.toLowerCase().startsWith("image/")) return true;
  return SUPPORTED_IMAGE_EXTENSIONS.has(readFileExtension(file.name));
};

export const formatFileSizeMb = (bytes: number) =>
  `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)} МБ`;

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

export const normalizePdfDataUrl = (value: string) => {
  if (typeof value !== "string") return value;
  if (!value.startsWith("data:")) return value;
  const commaIndex = value.indexOf(",");
  if (commaIndex <= 5) return value;
  const meta = value.slice(5, commaIndex);
  const body = value.slice(commaIndex + 1).trim();
  if (!body) return value;
  const metaParts = meta
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const hasBase64 = metaParts.includes("base64");
  if (!hasBase64) return value;
  return `data:application/pdf;base64,${body}`;
};

const loadImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = dataUrl;
  });

type WorkbookDecodedImageSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release?: () => void;
};

const loadImageSourceFromDataUrl = async (
  dataUrl: string
): Promise<WorkbookDecodedImageSource> => {
  if (typeof createImageBitmap === "function" && typeof fetch === "function") {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: Math.max(1, bitmap.width),
        height: Math.max(1, bitmap.height),
        release: () => bitmap.close(),
      };
    } catch {
      // Fall back to Image() decoding when bitmap decoding is unavailable.
    }
  }
  const image = await loadImageFromDataUrl(dataUrl);
  return {
    source: image,
    width: Math.max(1, image.naturalWidth || image.width),
    height: Math.max(1, image.naturalHeight || image.height),
  };
};

export const optimizeImageDataUrl = async (
  dataUrl: string,
  options?: { maxEdge?: number; quality?: number; maxChars?: number }
) => {
  if (typeof document === "undefined") return dataUrl;
  const decoded = await loadImageSourceFromDataUrl(dataUrl);
  const maxEdge = Math.max(720, options?.maxEdge ?? 1_920);
  const quality = Math.max(0.5, Math.min(0.95, options?.quality ?? 0.84));
  const maxChars = Math.max(18_000, Math.round(options?.maxChars ?? 420_000));
  const sourceWidth = decoded.width;
  const sourceHeight = decoded.height;
  const ratio = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  let targetWidth = Math.max(1, Math.round(sourceWidth * ratio));
  let targetHeight = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    decoded.release?.();
    return dataUrl;
  }
  const renderCandidate = (width: number, height: number, outputQuality: number) => {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", outputQuality);
  };
  const original = typeof dataUrl === "string" ? dataUrl : "";
  let best = renderCandidate(targetWidth, targetHeight, quality);
  if (!best) best = original;
  if (original && original.length < best.length) {
    best = original;
  }
  if (best.length <= maxChars) return best;
  let nextQuality = quality;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    nextQuality = Math.max(0.28, nextQuality * 0.86);
    if (attempt % 2 === 1 || best.length > maxChars * 1.6) {
      targetWidth = Math.max(64, Math.round(targetWidth * 0.82));
      targetHeight = Math.max(64, Math.round(targetHeight * 0.82));
    }
    const candidate = renderCandidate(targetWidth, targetHeight, nextQuality);
    if (candidate && candidate.length < best.length) {
      best = candidate;
    }
    if (best.length <= maxChars) break;
  }
  if (best.length > maxChars) {
    let emergencyWidth = targetWidth;
    let emergencyHeight = targetHeight;
    let emergencyQuality = nextQuality;
    while (
      best.length > maxChars &&
      (emergencyWidth > 64 || emergencyHeight > 64 || emergencyQuality > 0.18)
    ) {
      emergencyWidth = Math.max(64, Math.round(emergencyWidth * 0.76));
      emergencyHeight = Math.max(64, Math.round(emergencyHeight * 0.76));
      emergencyQuality = Math.max(0.18, emergencyQuality * 0.82);
      const candidate = renderCandidate(emergencyWidth, emergencyHeight, emergencyQuality);
      if (candidate && candidate.length < best.length) {
        best = candidate;
      } else {
        break;
      }
    }
  }
  decoded.release?.();
  return best;
};
