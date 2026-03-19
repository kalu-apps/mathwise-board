import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { promises as fsPromises } from "node:fs";

const execFileAsync = promisify(execFileCallback);

export const WORKBOOK_PDF_RENDER_MAX_BYTES = 20 * 1024 * 1024;

const toDataUrl = (buffer: Buffer, mimeType: string) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

export const decodeWorkbookPdfDataUrl = (value: unknown) => {
  if (typeof value !== "string" || !value.startsWith("data:application/pdf;base64,")) {
    return null;
  }
  const base64 = value.slice("data:application/pdf;base64,".length).trim();
  if (!base64) return null;
  try {
    return Buffer.from(base64, "base64");
  } catch {
    return null;
  }
};

export const renderWorkbookPdfPagesViaPoppler = async (params: {
  pdfBuffer: Buffer;
  dpi: number;
  maxPages: number;
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
      "1",
      "-l",
      String(params.maxPages),
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
