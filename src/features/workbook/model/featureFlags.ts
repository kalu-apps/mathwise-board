const TRUTHY_FLAG_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);

const toBooleanFlag = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return TRUTHY_FLAG_VALUES.has(value.trim().toLowerCase());
};

const readFeatureFlagValue = (...keys: string[]) => {
  const env = import.meta.env as Record<string, unknown>;
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined) {
      return value;
    }
  }
  return "";
};

export const isWorkbookNewRendererEnabled = () =>
  toBooleanFlag(
    readFeatureFlagValue(
      "VITE_FF_NEW_RENDERER",
      "VITE_FF_BOARD_CANVAS_COMMITTED_LAYER",
      "VITE_FF_FRONTEND_NEW_RENDERER"
    )
  );

export const isWorkbookAdaptivePollingEnabled = () =>
  toBooleanFlag(
    readFeatureFlagValue(
      "VITE_FF_REALTIME_ADAPTIVE_POLLING",
      "VITE_FF_ADAPTIVE_POLLING"
    )
  );

export const isWorkbookRealtimeBackpressureV2Enabled = () =>
  toBooleanFlag(
    readFeatureFlagValue(
      "VITE_FF_REALTIME_BACKPRESSURE_V2",
      "VITE_FF_BACKPRESSURE_V2"
    )
  );
