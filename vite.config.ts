import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { setupMockServer } from "./src/mock/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(loadedEnv)) {
    if (typeof process.env[key] === "undefined") {
      process.env[key] = value;
    }
  }
  const useHttps = process.env.VITE_DEV_HTTPS === "1";
  const plugins: PluginOption[] = [
    react(),
    legacy({
      targets: ["defaults", "not IE 11"],
      modernPolyfills: true,
    }),
    ...(useHttps ? [basicSsl()] : []),
    {
      name: "mock-api",
      configureServer(server) {
        setupMockServer(server);
      },
      configurePreviewServer(server) {
        setupMockServer(server);
      },
    },
  ];
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
      include: ["react", "react-dom"],
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
              if (normalizedId.includes("/mathjs/")) {
                return "vendor-mathjs";
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
            if (normalizedId.includes("/src/features/workbook/model/solid3d")) {
              return "workbook-solid3d";
            }
            if (normalizedId.includes("/src/features/workbook/model/functionGraph")) {
              return "workbook-graph";
            }
            if (normalizedId.includes("/src/features/workbook/model/smartInk")) {
              return "workbook-smartink";
            }
          },
        },
      },
    },
  };
});
