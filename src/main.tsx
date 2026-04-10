import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/App";
import { AppProviders } from "@/app/providers/AppProviders";
import "./index.css";
import "@/styles/fluid-system.css";
import "@/styles/design-system.css";
import "@/styles/visual-refactor-overrides.scss";

const CHUNK_ERROR_RELOAD_KEY = "__mw_chunk_error_reloaded_at__";
const CHUNK_ERROR_RELOAD_COOLDOWN_MS = 60_000;

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
};

const isChunkLoadError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  if (!message) return false;
  return (
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("dynamically imported module") ||
    message.includes("failed to load module script") ||
    message.includes("importing a module script failed")
  );
};

const tryReloadAfterChunkError = () => {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const guardValue = Number(window.sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY) ?? 0);
    if (Number.isFinite(guardValue) && now - guardValue < CHUNK_ERROR_RELOAD_COOLDOWN_MS) return;
    window.sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, String(now));
    window.location.reload();
  } catch {
    window.location.reload();
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    const preloadEvent = event as Event & {
      payload?: unknown;
      preventDefault: () => void;
    };
    if (!isChunkLoadError(preloadEvent.payload)) return;
    preloadEvent.preventDefault();
    tryReloadAfterChunkError();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(event.reason)) return;
    event.preventDefault();
    tryReloadAfterChunkError();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
