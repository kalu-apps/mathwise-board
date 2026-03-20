export type SmartInkMode = "off" | "shape" | "text" | "formula" | "auto";

export type SmartInkOptions = {
  mode: SmartInkMode;
  confidenceThreshold: number;
  smartShapes: boolean;
  smartTextOcr: boolean;
  smartMathOcr: boolean;
};

export const DEFAULT_SMART_INK_OPTIONS: SmartInkOptions = {
  // По умолчанию ручка работает без автопреобразований, пока пользователь их не включит.
  mode: "off",
  confidenceThreshold: 0.58,
  smartShapes: false,
  smartTextOcr: false,
  smartMathOcr: false,
};

const normalizeSmartInkMode = (value: unknown): SmartInkMode => {
  if (
    value === "off" ||
    value === "shape" ||
    value === "text" ||
    value === "formula" ||
    value === "auto"
  ) {
    return value;
  }
  if (value === "basic") return "shape";
  if (value === "full") return "auto";
  return DEFAULT_SMART_INK_OPTIONS.mode;
};

export const normalizeSmartInkOptions = (
  source?: Partial<SmartInkOptions> | null
): SmartInkOptions => {
  const mode = normalizeSmartInkMode(source?.mode);
  const confidenceThresholdRaw =
    typeof source?.confidenceThreshold === "number" &&
    Number.isFinite(source.confidenceThreshold)
      ? source.confidenceThreshold
      : DEFAULT_SMART_INK_OPTIONS.confidenceThreshold;
  const confidenceThreshold = Math.max(0.35, Math.min(0.98, confidenceThresholdRaw));
  if (mode === "off") {
    return {
      mode,
      confidenceThreshold,
      smartShapes: false,
      smartTextOcr: false,
      smartMathOcr: false,
    };
  }

  if (mode === "shape") {
    return {
      mode,
      confidenceThreshold,
      smartShapes: true,
      smartTextOcr: false,
      smartMathOcr: false,
    };
  }

  if (mode === "text") {
    return {
      mode,
      confidenceThreshold,
      smartShapes: false,
      smartTextOcr: true,
      smartMathOcr: false,
    };
  }

  if (mode === "formula") {
    return {
      mode,
      confidenceThreshold,
      smartShapes: false,
      smartTextOcr: false,
      smartMathOcr: true,
    };
  }

  return {
    mode,
    confidenceThreshold,
    smartShapes: true,
    smartTextOcr: true,
    smartMathOcr: true,
  };
};
