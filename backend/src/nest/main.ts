import "reflect-metadata";
import { json, urlencoded } from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { nestEnv } from "./nest-env";
import { getStorageDiagnostics, initializeDb } from "../../../src/mock/db";
import {
  getRuntimeServicesStatus,
  initializeRuntimeServices,
} from "../../../src/mock/runtimeServices";
import { setupMockServer } from "../../../src/mock/server";

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
  setupMockServer({
    middlewares: app.getHttpAdapter().getInstance(),
    httpServer: app.getHttpServer(),
  });
  const bodyLimit = `${nestEnv.bodyLimitMb}mb`;
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors({
    origin: true,
    credentials: true,
  });
  await app.listen(nestEnv.port, nestEnv.host);
  console.log(
    `[backend:nest] app listening on http://${nestEnv.host}:${nestEnv.port} (legacy: ${nestEnv.legacyBaseUrl}, proxyMode: ${nestEnv.proxyMode}, bodyLimit: ${bodyLimit})`
  );
};

void bootstrap();
