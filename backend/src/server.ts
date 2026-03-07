import connect, { type NextHandleFunction } from "connect";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import type { ViteDevServer } from "vite";
import { setupMockServer } from "../../src/mock/server";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? 4173);
const DIST_DIR = resolve(process.cwd(), process.env.WEB_DIST_DIR ?? "dist");
const INDEX_FILE = resolve(DIST_DIR, "index.html");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
};

const json = (
  res: Parameters<NextHandleFunction>[1],
  status: number,
  payload: unknown
) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const isSafeResolvedPath = (candidate: string) => {
  const relativePrefix = `${DIST_DIR}/`;
  return candidate === DIST_DIR || candidate.startsWith(relativePrefix);
};

const resolveStaticPath = (pathname: string) => {
  const normalized = pathname.replace(/\\/g, "/");
  const candidate = resolve(DIST_DIR, `.${normalized}`);
  if (!isSafeResolvedPath(candidate)) return null;
  return candidate;
};

const sendFile = async (
  req: Parameters<NextHandleFunction>[0],
  res: Parameters<NextHandleFunction>[1],
  filePath: string,
  cacheControl: string
) => {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) return false;
  const ext = extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] ?? "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", String(fileStats.size));
  res.setHeader("Cache-Control", cacheControl);
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("error", rejectPromise);
    res.on("error", rejectPromise);
    res.on("finish", () => resolvePromise());
    stream.pipe(res);
  });
  return true;
};

const staticMiddleware: NextHandleFunction = async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  if (!req.url) {
    return next();
  }
  const parsed = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname.startsWith("/api/")) {
    return next();
  }
  if (pathname === "/healthz") {
    return json(res, 200, {
      ok: true,
      service: "mathboard-monolith",
      timestamp: new Date().toISOString(),
    });
  }

  const staticPath = resolveStaticPath(pathname);
  if (!staticPath) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  const hasExtension = extname(pathname).length > 0;

  try {
    if (hasExtension) {
      const sent = await sendFile(
        req,
        res,
        staticPath,
        pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=600"
      );
      if (sent) return;
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    await sendFile(req, res, INDEX_FILE, "no-cache");
  } catch {
    res.statusCode = 500;
    res.end("Static render failed");
  }
};

const app = connect();
setupMockServer({
  middlewares: app as unknown as ViteDevServer["middlewares"],
});
app.use(staticMiddleware);

const server = createServer(app);
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const start = async () => {
  try {
    await access(INDEX_FILE);
  } catch {
    console.warn(
      `[backend] static dist not found at ${INDEX_FILE}. Run "npm run build:board" first.`
    );
  }

  server.listen(PORT, HOST, () => {
    console.log(
      `[backend] monolith listening on http://${HOST}:${PORT} (dist: ${DIST_DIR})`
    );
  });
};

const stop = () => {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8_000).unref();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

void start();
