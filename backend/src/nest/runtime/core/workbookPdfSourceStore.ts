import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fsPromises from "node:fs/promises";

const readPositiveInt = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, parsed);
};

const WORKBOOK_PDF_SOURCE_STORAGE_DIR = path.resolve(
  String(process.env.WORKBOOK_PDF_SOURCE_STORAGE_DIR ?? path.join(os.tmpdir(), "workbook-pdf-sources"))
    .trim()
    .replace(/\/+$/g, "")
);

const WORKBOOK_PDF_SOURCE_TTL_MS = readPositiveInt(
  process.env.WORKBOOK_PDF_SOURCE_TTL_MS,
  30 * 60_000,
  24 * 60 * 60_000
);

const WORKBOOK_PDF_SOURCE_MAX_FILES = readPositiveInt(
  process.env.WORKBOOK_PDF_SOURCE_MAX_FILES,
  120,
  2_000
);

const SAFE_SOURCE_ID_RE = /^[a-f0-9]{32}$/i;

const resolveSourcePath = (sourceId: string) =>
  path.join(WORKBOOK_PDF_SOURCE_STORAGE_DIR, `${sourceId.toLowerCase()}.pdf`);

const ensureStorageDir = async () => {
  await fsPromises.mkdir(WORKBOOK_PDF_SOURCE_STORAGE_DIR, { recursive: true });
};

const removeSourceFileSafe = async (filePath: string) => {
  try {
    await fsPromises.rm(filePath, { force: true });
  } catch {
    // noop
  }
};

const cleanupPdfSources = async () => {
  await ensureStorageDir();
  let entries: Array<{ filePath: string; mtimeMs: number }> = [];
  try {
    const dirEntries = await fsPromises.readdir(WORKBOOK_PDF_SOURCE_STORAGE_DIR, {
      withFileTypes: true,
    });
    const now = Date.now();
    for (const dirEntry of dirEntries) {
      if (!dirEntry.isFile() || !dirEntry.name.endsWith(".pdf")) continue;
      const sourceId = dirEntry.name.slice(0, -4);
      if (!SAFE_SOURCE_ID_RE.test(sourceId)) continue;
      const filePath = path.join(WORKBOOK_PDF_SOURCE_STORAGE_DIR, dirEntry.name);
      try {
        const stat = await fsPromises.stat(filePath);
        if (now - stat.mtimeMs > WORKBOOK_PDF_SOURCE_TTL_MS) {
          await removeSourceFileSafe(filePath);
          continue;
        }
        entries.push({ filePath, mtimeMs: stat.mtimeMs });
      } catch {
        // Ignore stale race files.
      }
    }
  } catch {
    return;
  }
  if (entries.length <= WORKBOOK_PDF_SOURCE_MAX_FILES) return;
  entries = entries.sort((left, right) => left.mtimeMs - right.mtimeMs);
  const overflow = entries.length - WORKBOOK_PDF_SOURCE_MAX_FILES;
  for (let index = 0; index < overflow; index += 1) {
    await removeSourceFileSafe(entries[index].filePath);
  }
};

export const createWorkbookPdfTempSource = async (params: {
  pdfBuffer: Buffer;
  fileName?: string;
}) => {
  await cleanupPdfSources();
  const sourceId = crypto.randomUUID().replace(/-/g, "").toLowerCase();
  const filePath = resolveSourcePath(sourceId);
  await ensureStorageDir();
  await fsPromises.writeFile(filePath, params.pdfBuffer);
  const now = Date.now();
  return {
    sourceId,
    fileName: String(params.fileName ?? "document.pdf"),
    sizeBytes: params.pdfBuffer.length,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + WORKBOOK_PDF_SOURCE_TTL_MS).toISOString(),
  };
};

export const readWorkbookPdfTempSourceBuffer = async (sourceId: string) => {
  const normalizedSourceId = String(sourceId ?? "").trim().toLowerCase();
  if (!SAFE_SOURCE_ID_RE.test(normalizedSourceId)) return null;
  const filePath = resolveSourcePath(normalizedSourceId);
  try {
    const stat = await fsPromises.stat(filePath);
    if (!stat.isFile()) return null;
    if (Date.now() - stat.mtimeMs > WORKBOOK_PDF_SOURCE_TTL_MS) {
      await removeSourceFileSafe(filePath);
      return null;
    }
    // Touch mtime to keep actively used source files alive during range retries.
    await fsPromises.utimes(filePath, new Date(), new Date());
    return await fsPromises.readFile(filePath);
  } catch {
    return null;
  }
};

