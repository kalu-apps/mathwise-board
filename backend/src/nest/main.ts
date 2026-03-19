import "reflect-metadata";
import { json, urlencoded } from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { nestEnv } from "./nest-env";
import { getStorageDiagnostics, initializeDb, shutdownDb } from "../../../src/mock/db";
import {
  getRuntimeServicesStatus,
  initializeRuntimeServices,
  shutdownRuntimeServices,
} from "../../../src/mock/runtimeServices";
import { createWorkbookApiMiddleware } from "../../../src/mock/server";

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
  await initializeNestDependencies();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn", "log"],
  });
  const httpAdapter = app.getHttpAdapter().getInstance();
  httpAdapter.use(createWorkbookApiMiddleware());
  const bodyLimit = `${nestEnv.bodyLimitMb}mb`;
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors({
    origin: true,
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
