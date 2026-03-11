export type SmartInkMode = "off" | "basic" | "full";

export type SmartInkOptions = {
  mode: SmartInkMode;
  confidenceThreshold: number;
  smartShapes: boolean;
  smartTextOcr: boolean;
  smartMathOcr: boolean;
};

export const DEFAULT_SMART_INK_OPTIONS: SmartInkOptions = {
  mode: "basic",
  confidenceThreshold: 0.72,
  smartShapes: true,
  smartTextOcr: false,
  smartMathOcr: false,
};

export const normalizeSmartInkOptions = (
  source?: Partial<SmartInkOptions> | null
): SmartInkOptions => {
  const mode: SmartInkMode =
    source?.mode === "off" || source?.mode === "basic" || source?.mode === "full"
      ? source.mode
      : DEFAULT_SMART_INK_OPTIONS.mode;
  const confidenceThresholdRaw =
    typeof source?.confidenceThreshold === "number" &&
    Number.isFinite(source.confidenceThreshold)
      ? source.confidenceThreshold
      : DEFAULT_SMART_INK_OPTIONS.confidenceThreshold;
  const confidenceThreshold = Math.max(0.35, Math.min(0.98, confidenceThresholdRaw));
  const smartShapes =
    typeof source?.smartShapes === "boolean"
      ? source.smartShapes
      : DEFAULT_SMART_INK_OPTIONS.smartShapes;
  const smartTextOcr =
    typeof source?.smartTextOcr === "boolean"
      ? source.smartTextOcr
      : DEFAULT_SMART_INK_OPTIONS.smartTextOcr;
  const smartMathOcr =
    typeof source?.smartMathOcr === "boolean"
      ? source.smartMathOcr
      : DEFAULT_SMART_INK_OPTIONS.smartMathOcr;

  if (mode === "off") {
    return {
      mode,
      confidenceThreshold,
      smartShapes: false,
      smartTextOcr: false,
      smartMathOcr: false,
    };
  }

  if (mode === "basic") {
    return {
      mode,
      confidenceThreshold,
      smartShapes,
      smartTextOcr: false,
      smartMathOcr: false,
    };
  }

  return {
    mode,
    confidenceThreshold,
    smartShapes,
    smartTextOcr,
    smartMathOcr,
  };
};
