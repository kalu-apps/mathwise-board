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
