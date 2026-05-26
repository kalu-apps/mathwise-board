import "reflect-metadata";
import { json, urlencoded } from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { nestEnv } from "./nest-env";
import {
  getStorageDiagnostics,
  initializeDb,
  shutdownDb,
} from "./runtime/core/db";
import {
  getRuntimeServicesStatus,
  initializeRuntimeServices,
  shutdownRuntimeServices,
} from "./runtime/core/runtimeServices";
import { markRuntimeShuttingDown } from "./health/runtime-readiness-state";

const readRequiredEnv = (name: string) => String(process.env[name] ?? "").trim();
const isEmailLike = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);

type BodyParserError = Error & {
  expected?: number;
  length?: number;
  limit?: number;
  status?: number;
  statusCode?: number;
  type?: string;
};

type BodyParserRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
};

type BodyParserResponse = {
  headersSent?: boolean;
  status: (statusCode: number) => {
    json: (payload: unknown) => void;
  };
};

type BodyParserNext = (error?: unknown) => void;

const isBodyParserPayloadTooLargeError = (
  error: unknown
): error is BodyParserError => {
  if (!(error instanceof Error)) return false;
  const candidate = error as BodyParserError;
  return (
    candidate.type === "entity.too.large" ||
    candidate.status === 413 ||
    candidate.statusCode === 413
  );
};

const resolvePayloadTooLargeBytes = (error: BodyParserError) => {
  const receivedBytes =
    typeof error.length === "number" && Number.isFinite(error.length)
      ? Math.max(0, Math.floor(error.length))
      : typeof error.expected === "number" && Number.isFinite(error.expected)
        ? Math.max(0, Math.floor(error.expected))
        : undefined;
  const limitBytes =
    typeof error.limit === "number" && Number.isFinite(error.limit)
      ? Math.max(0, Math.floor(error.limit))
      : nestEnv.bodyLimitMb * 1024 * 1024;
  return { limitBytes, receivedBytes };
};

const handleBodyParserError = (
  error: unknown,
  req: BodyParserRequest,
  res: BodyParserResponse,
  next: BodyParserNext
) => {
  if (!isBodyParserPayloadTooLargeError(error)) {
    next(error);
    return;
  }
  const { limitBytes, receivedBytes } = resolvePayloadTooLargeBytes(error);
  console.warn("[backend:nest] payload_too_large", {
    method: req.method,
    path: req.originalUrl || req.url,
    limitBytes,
    receivedBytes,
    bodyLimitMb: nestEnv.bodyLimitMb,
  });
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(413).json({
    error: "request_body_too_large",
    limitBytes,
    receivedBytes,
  });
};

const assertProductionRuntimeSafety = () => {
  const teacherPassword = readRequiredEnv("WHITEBOARD_TEACHER_PASSWORD");
  if (!teacherPassword) {
    throw new Error("[backend:nest] WHITEBOARD_TEACHER_PASSWORD is required.");
  }
  const teacherEmail = readRequiredEnv("WHITEBOARD_TEACHER_EMAIL").toLowerCase();
  if (teacherEmail && !isEmailLike(teacherEmail)) {
    throw new Error("[backend:nest] WHITEBOARD_TEACHER_EMAIL must be a valid email.");
  }
  if (readRequiredEnv("VITE_WHITEBOARD_TEACHER_PASSWORD")) {
    throw new Error(
      "[backend:nest] VITE_WHITEBOARD_TEACHER_PASSWORD is forbidden. Use WHITEBOARD_TEACHER_PASSWORD only."
    );
  }
  if (!nestEnv.isProduction) return;

  if (nestEnv.corsAllowedOrigins.length === 0) {
    throw new Error("[backend:nest] CORS_ALLOWED_ORIGINS is required in production.");
  }
  if (
    readRequiredEnv("VITE_BOARD_AUTO_LOGIN_EMAIL") ||
    readRequiredEnv("VITE_BOARD_AUTO_LOGIN_PASSWORD")
  ) {
    throw new Error(
      "[backend:nest] VITE_BOARD_AUTO_LOGIN_EMAIL/VITE_BOARD_AUTO_LOGIN_PASSWORD must be disabled in production."
    );
  }
  if (readRequiredEnv("VITE_ENABLE_EMBEDDED_RUNTIME") === "1") {
    throw new Error("[backend:nest] VITE_ENABLE_EMBEDDED_RUNTIME is forbidden in production.");
  }
};

const initializeNestDependencies = async () => {
  try {
    await initializeDb();
  } catch (error) {
    const storageDiagnostics = getStorageDiagnostics();
    if (storageDiagnostics.required) {
      throw error;
    }
    console.warn(
      `[backend:nest] storage init warning: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  try {
    await initializeRuntimeServices();
  } catch (error) {
    const runtimeDiagnostics = getRuntimeServicesStatus();
    if (runtimeDiagnostics.redis.required) {
      throw error;
    }
    console.warn(
      `[backend:nest] runtime init warning: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const bootstrap = async () => {
  assertProductionRuntimeSafety();
  await initializeNestDependencies();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn", "log"],
  });
  const bodyLimit = `${nestEnv.bodyLimitMb}mb`;
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(handleBodyParserError);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        nestEnv.corsAllowedOrigins.length === 0 ||
        nestEnv.corsAllowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("cors_origin_forbidden"), false);
    },
    credentials: true,
  });
  await app.listen(nestEnv.port, nestEnv.host);
  console.log(
    `[backend:nest] app listening on http://${nestEnv.host}:${nestEnv.port} (mode: nest-native-ingress, bodyLimit: ${bodyLimit})`
  );

  let isShuttingDown = false;
  const stop = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    markRuntimeShuttingDown();
    try {
      await app.close();
    } finally {
      await Promise.allSettled([shutdownDb(), shutdownRuntimeServices()]);
      process.exit(0);
    }
  };
  process.on("SIGINT", () => {
    void stop();
  });
  process.on("SIGTERM", () => {
    void stop();
  });
};

void bootstrap();
