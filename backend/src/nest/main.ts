import "reflect-metadata";
import { json, urlencoded } from "express";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { nestEnv } from "./nest-env";

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ["error", "warn", "log"],
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
