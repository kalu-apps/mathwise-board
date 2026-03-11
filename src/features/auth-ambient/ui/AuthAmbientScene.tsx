import { useEffect, useRef, useState } from "react";
import { usePerformanceMode } from "@/app/providers/performanceModeContext";
import { useThemeMode } from "@/app/theme/themeModeContext";
import type { AuthAmbientSceneController } from "@/features/auth-ambient/lib/createAuthAmbientScene";
import type { AuthAmbientVariant } from "@/features/auth-ambient/model/scenePresets";

type AuthAmbientSceneProps = {
  variant: AuthAmbientVariant;
};

export function AuthAmbientScene({ variant }: AuthAmbientSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AuthAmbientSceneController | null>(null);
  const { isDegraded } = usePerformanceMode();
  const { mode } = useThemeMode();
  const modeRef = useRef(mode);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  modeRef.current = mode;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setPrefersReducedMotion(media.matches);
    };
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => {
      media.removeEventListener("change", syncPreference);
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || isDegraded) return;

    let active = true;

    void import("../lib/createAuthAmbientScene").then(({ createAuthAmbientScene }) => {
      if (!active || !containerRef.current) return;
      controllerRef.current = createAuthAmbientScene({
        container: containerRef.current,
        variant,
        themeMode: modeRef.current,
        reducedMotion: prefersReducedMotion,
      });
    });

    return () => {
      active = false;
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [isDegraded, prefersReducedMotion, variant]);

  useEffect(() => {
    controllerRef.current?.setThemeMode(mode);
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className={`auth-ambient auth-ambient--${variant}`}
      aria-hidden="true"
    />
  );
}
