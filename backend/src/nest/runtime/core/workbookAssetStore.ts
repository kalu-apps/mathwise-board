import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

const readPositiveInt = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, parsed);
};

const WORKBOOK_ASSET_STORAGE_DIR =
  String(process.env.WORKBOOK_ASSET_STORAGE_DIR ?? "").trim() ||
  path.join(process.cwd(), ".workbook-assets");
const WORKBOOK_ASSET_MAX_BYTES = readPositiveInt(
  process.env.WORKBOOK_ASSET_MAX_BYTES,
  24 * 1024 * 1024,
  128 * 1024 * 1024
);
const WORKBOOK_ASSET_CACHE_MAX_AGE_SEC = readPositiveInt(
  process.env.WORKBOOK_ASSET_CACHE_MAX_AGE_SEC,
  7 * 24 * 60 * 60,
  30 * 24 * 60 * 60
);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "application/pdf": "pdf",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  pdf: "application/pdf",
  bin: "application/octet-stream",
};

const SAFE_ASSET_ID_RE = /^[a-f0-9]{64}\.[a-z0-9]{2,8}$/i;

type ParsedDataUrl = {
  mimeType: string;
  buffer: Buffer;
};

const isDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:");

const parseDataUrl = (dataUrl: string): ParsedDataUrl => {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex <= 5) {
    throw new Error("workbook_asset_invalid_data_url");
  }
  const meta = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const metaParts = meta
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const rawMimeType = metaParts[0]?.toLowerCase() ?? "";
  const mimeType = rawMimeType || "application/octet-stream";
  const base64 = metaParts.some((part) => part.toLowerCase() === "base64");
  const buffer = base64
    ? Buffer.from(body, "base64")
    : Buffer.from(decodeURIComponent(body), "utf-8");
  if (!buffer.length) {
    throw new Error("workbook_asset_invalid_data_url");
  }
  return { mimeType, buffer };
};

const readFileExtension = (fileName?: string) => {
  const safeName = String(fileName ?? "")
    .trim()
    .toLowerCase();
  const dotIndex = safeName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= safeName.length - 1) return "";
  return safeName.slice(dotIndex + 1);
};

const resolveAssetExtension = (mimeType: string, fileName?: string) => {
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  const byMime = MIME_TO_EXT[normalizedMime];
  if (byMime) return byMime;
  const byName = readFileExtension(fileName);
  if (byName && /^[a-z0-9]{2,8}$/i.test(byName)) return byName;
  return "bin";
};

const resolveMimeTypeByExt = (ext: string) =>
  EXT_TO_MIME[String(ext || "").trim().toLowerCase()] ?? "application/octet-stream";

const ensureDir = async (dir: string) => {
  await fsPromises.mkdir(dir, { recursive: true });
};

const resolveAssetPath = (assetId: string) => {
  const hash = assetId.slice(0, 64).toLowerCase();
  return path.join(WORKBOOK_ASSET_STORAGE_DIR, hash.slice(0, 2), assetId);
};

export const buildWorkbookAssetUrl = (sessionId: string, assetId: string) =>
  `/api/workbook/sessions/${encodeURIComponent(sessionId)}/assets/${encodeURIComponent(assetId)}/content`;

export const persistWorkbookAssetFromDataUrl = async (params: {
  sessionId: string;
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
}) => {
  if (!isDataUrl(params.dataUrl)) {
    throw new Error("workbook_asset_invalid_data_url");
  }
  const parsed = parseDataUrl(params.dataUrl);
  const mimeType = String(params.mimeType ?? parsed.mimeType ?? "").trim().toLowerCase() || parsed.mimeType;
  if (parsed.buffer.length > WORKBOOK_ASSET_MAX_BYTES) {
    throw new Error("workbook_asset_too_large");
  }
  const hash = crypto.createHash("sha256").update(parsed.buffer).digest("hex");
  const ext = resolveAssetExtension(mimeType, params.fileName);
  const assetId = `${hash}.${ext}`;
  const assetPath = resolveAssetPath(assetId);
  await ensureDir(path.dirname(assetPath));
  try {
    await fsPromises.access(assetPath, fs.constants.R_OK);
  } catch {
    await fsPromises.writeFile(assetPath, parsed.buffer);
  }
  return {
    assetId,
    url: buildWorkbookAssetUrl(params.sessionId, assetId),
    mimeType: resolveMimeTypeByExt(ext),
    sizeBytes: parsed.buffer.length,
  };
};

export const readWorkbookAssetById = async (assetId: string) => {
  const normalizedAssetId = String(assetId ?? "").trim();
  if (!SAFE_ASSET_ID_RE.test(normalizedAssetId)) {
    return null;
  }
  const assetPath = resolveAssetPath(normalizedAssetId);
  try {
    const stat = await fsPromises.stat(assetPath);
    if (!stat.isFile()) return null;
    const ext = normalizedAssetId.split(".").pop() ?? "bin";
    return {
      assetId: normalizedAssetId,
      filePath: assetPath,
      sizeBytes: stat.size,
      mimeType: resolveMimeTypeByExt(ext),
      cacheControl: `public, max-age=${WORKBOOK_ASSET_CACHE_MAX_AGE_SEC}`,
    };
  } catch {
    return null;
  }
};

export const createWorkbookAssetReadStream = (filePath: string) => fs.createReadStream(filePath);

export const getWorkbookAssetStorageDiagnostics = () => ({
  dir: WORKBOOK_ASSET_STORAGE_DIR,
  maxBytes: WORKBOOK_ASSET_MAX_BYTES,
});
