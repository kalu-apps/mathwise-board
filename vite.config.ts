import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(loadedEnv)) {
    if (typeof process.env[key] === "undefined") {
      process.env[key] = value;
    }
  }
  const useHttps = process.env.VITE_DEV_HTTPS === "1";
  const useEmbeddedRuntime =
    command === "serve" && process.env.VITE_ENABLE_EMBEDDED_RUNTIME === "1";
  if (useEmbeddedRuntime && mode === "production") {
    throw new Error(
      "[vite] VITE_ENABLE_EMBEDDED_RUNTIME is not allowed for production mode."
    );
  }
  const plugins: PluginOption[] = [
    react(),
    legacy({
      targets: ["defaults", "not IE 11"],
      modernPolyfills: true,
    }),
    ...(useHttps ? [basicSsl()] : []),
  ];
  if (useEmbeddedRuntime) {
    const embeddedRuntimeApiModuleSpecifier =
      "./backend/src/nest/runtime/" + "workbook-runtime-api-adapters";
    plugins.push({
      name: "embedded-runtime-api",
      configureServer(server) {
        void import(embeddedRuntimeApiModuleSpecifier)
          .then(({ createWorkbookApiMiddleware, attachWorkbookLiveSocketServer }) => {
            server.middlewares.use(createWorkbookApiMiddleware());
            attachWorkbookLiveSocketServer(server.httpServer);
          })
          .catch((error) => {
            server.config.logger.error(
              `[embedded-runtime-api] bootstrap failed: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          });
      },
    });
  }
  return {
    plugins,
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
        react: resolve(__dirname, "node_modules/react"),
        "react-dom": resolve(__dirname, "node_modules/react-dom"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      https: useHttps ? {} : undefined,
      host: true,
      allowedHosts: true as const,
      port: 5173,
      strictPort: true,
      hmr: {
        protocol: "ws",
        clientPort: 5173,
        host: process.env.VITE_HMR_HOST || undefined,
      },
    },
    preview: {
      host: true,
      allowedHosts: true as const,
      port: 5173,
      strictPort: true,
    },
    optimizeDeps: {
      include: ["react", "react-dom", "three"],
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, "/");
            if (normalizedId.includes("/node_modules/")) {
              if (
                normalizedId.includes("/@mui/") ||
                normalizedId.includes("/@emotion/")
              ) {
                return "vendor-ui";
              }
              if (normalizedId.includes("/three/")) {
                return "vendor-three";
              }
              if (normalizedId.includes("/livekit-client/")) {
                return "vendor-livekit";
              }
              if (
                normalizedId.includes("/jspdf/") ||
                normalizedId.includes("/html2canvas/")
              ) {
                return "vendor-export";
              }
            }
            if (
              normalizedId.includes("/src/shared/api/") ||
              normalizedId.includes("/src/shared/lib/localDb") ||
              normalizedId.includes("/src/shared/lib/dataUpdateBus") ||
              normalizedId.includes("/src/shared/lib/outbox") ||
              normalizedId.includes("/src/shared/lib/retryLastAction") ||
              normalizedId.includes("/src/shared/lib/performanceMonitoring") ||
              normalizedId.includes("/src/shared/lib/realtimeMonitoring") ||
              normalizedId.includes("/src/shared/lib/mediaMonitoring") ||
              normalizedId.includes("/src/shared/lib/useActionGuard") ||
              normalizedId.includes("/src/features/workbook/model/workbookPerformance")
            ) {
              return "app-runtime-core";
            }
            if (normalizedId.includes("/src/features/workbook/model/solid3d")) {
              return "workbook-solid3d";
            }
            if (normalizedId.includes("/src/features/workbook/lessonRecording/")) {
              return "workbook-recording";
            }
            if (
              normalizedId.includes(
                "/src/features/auth-ambient/lib/createAuthAmbientScene"
              ) ||
              normalizedId.includes("/src/features/auth-ambient/lib/threeGeometry") ||
              normalizedId.includes("/src/features/auth-ambient/model/scenePresets")
            ) {
              return "auth-ambient-runtime";
            }
            if (normalizedId.includes("/src/features/auth-ambient/")) {
              return "auth-ambient";
            }
            if (normalizedId.includes("/src/features/workbook/model/functionGraph")) {
              return "workbook-graph";
            }
            if (
              normalizedId.includes("/src/pages/workbook/WorkbookSessionPageManagerFullscreen") ||
              normalizedId.includes("/src/pages/workbook/WorkbookImportModal")
            ) {
              return "workbook-session-modal-tools";
            }
            if (
              normalizedId.includes("/src/pages/workbook/useWorkbookSession") ||
              normalizedId.includes("/src/pages/workbook/buildWorkbookSession")
            ) {
              return "workbook-session-runtime";
            }
            if (
              normalizedId.includes("/src/pages/workbook/WorkbookSessionTransformPanel") ||
              normalizedId.includes("/src/pages/workbook/WorkbookSessionOverlays")
            ) {
              return "workbook-session-panels";
            }
          },
        },
      },
    },
  };
});
