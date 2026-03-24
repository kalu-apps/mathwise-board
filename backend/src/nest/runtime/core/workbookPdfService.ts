import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { promises as fsPromises } from "node:fs";

const execFileAsync = promisify(execFileCallback);

const readPositiveInt = (value: string | undefined, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, parsed);
};

// Source file limit: governs how large a PDF can be for inspect/render pre-processing.
export const WORKBOOK_PDF_SOURCE_MAX_BYTES = readPositiveInt(
  process.env.WORKBOOK_PDF_SOURCE_MAX_BYTES,
  64 * 1024 * 1024,
  256 * 1024 * 1024
);

// Final rendered payload limit: governs how much page image data can be imported at once.
export const WORKBOOK_PDF_RENDER_MAX_BYTES = readPositiveInt(
  process.env.WORKBOOK_PDF_RENDER_MAX_BYTES,
  20 * 1024 * 1024,
  128 * 1024 * 1024
);

const toDataUrl = (buffer: Buffer, mimeType: string) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

export const decodeWorkbookPdfDataUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.startsWith("data:")) {
    return null;
  }
  const commaIndex = value.indexOf(",");
  if (commaIndex <= 5) return null;
  const meta = value.slice(5, commaIndex);
  const base64 = value.slice(commaIndex + 1).trim();
  if (!base64) return null;
  const metaParts = meta
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const mimeType = metaParts[0] ?? "";
  const hasBase64 = metaParts.includes("base64");
  const isAllowedMime =
    mimeType === "application/pdf" ||
    mimeType === "application/x-pdf" ||
    mimeType === "application/octet-stream" ||
    mimeType === "";
  if (!hasBase64 || !isAllowedMime) return null;
  try {
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return null;
    const markerIndex = buffer.indexOf(Buffer.from("%PDF-"));
    if (markerIndex < 0 || markerIndex > 1024) return null;
    return buffer;
  } catch {
    return null;
  }
};

export const renderWorkbookPdfPagesViaPoppler = async (params: {
  pdfBuffer: Buffer;
  dpi: number;
  firstPage: number;
  lastPage: number;
  ensureId: () => string;
}) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "workbook-pdf-"));
  const inputPath = path.join(tempRoot, "input.pdf");
  const outputPrefix = path.join(tempRoot, "page");
  await fsPromises.writeFile(inputPath, params.pdfBuffer);

  try {
    await execFileAsync("pdftoppm", [
      "-png",
      "-r",
      String(params.dpi),
      "-f",
      String(params.firstPage),
      "-l",
      String(params.lastPage),
      inputPath,
      outputPrefix,
    ]);

    const files = await fsPromises.readdir(tempRoot);
    const pages = await Promise.all(
      files
        .filter((name) => /^page-\d+\.png$/i.test(name))
        .map(async (name) => {
          const page = Number(name.match(/(\d+)/)?.[1] ?? "0");
          const fullPath = path.join(tempRoot, name);
          const image = await fsPromises.readFile(fullPath);
          return {
            id: params.ensureId(),
            page,
            imageUrl: toDataUrl(image, "image/png"),
          };
        })
    );

    return pages.sort((a, b) => a.page - b.page);
  } finally {
    await fsPromises.rm(tempRoot, { recursive: true, force: true });
  }
};

export const inspectWorkbookPdfViaPoppler = async (params: { pdfBuffer: Buffer }) => {
  const tempRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "workbook-pdf-"));
  const inputPath = path.join(tempRoot, "input.pdf");
  await fsPromises.writeFile(inputPath, params.pdfBuffer);
  try {
    const { stdout } = await execFileAsync("pdfinfo", [inputPath]);
    const pagesMatch = String(stdout ?? "").match(/^\s*Pages:\s*(\d+)\s*$/im);
    const pageCount = Number.parseInt(pagesMatch?.[1] ?? "", 10);
    if (!Number.isFinite(pageCount) || pageCount <= 0) {
      throw new Error("workbook_pdf_page_count_unavailable");
    }
    return {
      pageCount: Math.max(1, Math.trunc(pageCount)),
    };
  } finally {
    await fsPromises.rm(tempRoot, { recursive: true, force: true });
  }
};
