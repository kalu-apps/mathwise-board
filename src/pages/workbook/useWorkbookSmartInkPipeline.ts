import { useCallback, useRef, type MutableRefObject } from "react";
import { recognizeWorkbookInk } from "@/features/workbook/model/api";
import { ensureWorkbookObjectZOrder } from "@/features/workbook/model/objectZOrder";
import { ApiError, isRecoverableApiError } from "@/shared/api/client";
import type {
  WorkbookBoardObject,
  WorkbookPoint,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { SmartInkDetectedResult } from "@/features/workbook/model/smartInk";
import type { SmartInkOptions } from "./workbookBoardSettingsModel";
import { clampBoardObjectToPageFrame, loadSmartInkRuntime } from "./WorkbookSessionPage.core";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";

type AppendEventsAndApply = (
  events: WorkbookClientEventInput[],
  options?: {
    trackHistory?: boolean;
    markDirty?: boolean;
    historyEntry?: unknown;
  }
) => Promise<void>;

type UseWorkbookSmartInkPipelineParams = {
  sessionId: string;
  boardSettingsCurrentPage: number;
  activeSceneLayerId: string;
  appendEventsAndApply: AppendEventsAndApply;
  setSelectedObjectId: (value: string | null) => void;
  setError: (value: string | null) => void;
  smartInkDebounceRef: MutableRefObject<number | null>;
  smartInkStrokeBufferRef: MutableRefObject<WorkbookStroke[]>;
  smartInkProcessedStrokeIdsRef: MutableRefObject<Set<string>>;
  smartInkOptionsRef: MutableRefObject<SmartInkOptions>;
  smartInkConfigVersionRef: MutableRefObject<number>;
  boardObjectsRef: MutableRefObject<WorkbookBoardObject[]>;
};

type SmartInkAdapterResponse = {
  text?: string;
  latex?: string;
  confidence?: number;
} | null;

const SMART_INK_ADAPTER_CACHE_TTL_MS = 5000;
const SMART_INK_ADAPTER_ERROR_CACHE_TTL_MS = 450;

const getRecognitionScore = (result: SmartInkDetectedResult) => {
  let score = result.confidence;
  if (result.kind === "shape") {
    score += result.object.type === "ellipse" ? 0.05 : 0.02;
    return score;
  }
  if (result.kind === "text") {
    const textValue = typeof result.object.text === "string" ? result.object.text.trim() : "";
    if (textValue.length >= 5) score += 0.08;
    else if (textValue.length >= 2) score += 0.04;
    return score;
  }
  const textValue = typeof result.object.text === "string" ? result.object.text.trim() : "";
  const latexValue =
    result.object.meta &&
    typeof result.object.meta === "object" &&
    typeof result.object.meta.latex === "string"
      ? result.object.meta.latex.trim()
      : "";
  if (latexValue.length) score += 0.1;
  if (textValue.length >= 2) score += 0.03;
  return score;
};


export const useWorkbookSmartInkPipeline = ({
  sessionId,
  boardSettingsCurrentPage,
  activeSceneLayerId,
  appendEventsAndApply,
  setSelectedObjectId,
  setError,
  smartInkDebounceRef,
  smartInkStrokeBufferRef,
  smartInkProcessedStrokeIdsRef,
  smartInkOptionsRef,
  smartInkConfigVersionRef,
  boardObjectsRef,
}: UseWorkbookSmartInkPipelineParams) => {
  const adapterCacheRef = useRef<Map<string, { expiresAt: number; value: SmartInkAdapterResponse }>>(
    new Map()
  );

  const requestSmartInkAdapter = useCallback(
    async (strokes: WorkbookStroke[], options: SmartInkOptions) => {
      if (!sessionId) return null;
      if (!options.smartTextOcr && !options.smartMathOcr) return null;
      const cacheKey = `${options.smartTextOcr ? "text" : "no-text"}:${options.smartMathOcr ? "math" : "no-math"}:${strokes
        .map((stroke) => stroke.id)
        .join(",")}`;
      const now = Date.now();
      const cached = adapterCacheRef.current.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }
      for (const [key, entry] of adapterCacheRef.current.entries()) {
        if (entry.expiresAt <= now) {
          adapterCacheRef.current.delete(key);
        }
      }
      try {
        const response = await recognizeWorkbookInk({
          sessionId,
          strokes: strokes.map((stroke) => ({
            id: stroke.id,
            points: stroke.points,
            width: stroke.width,
            color: stroke.color,
          })),
          preferMath: options.smartMathOcr,
        });
        if (!response || !response.result) return null;
        const value = {
          text: response.result.text ?? "",
          latex: response.result.latex ?? undefined,
          confidence:
            typeof response.result.confidence === "number"
              ? response.result.confidence
              : undefined,
        };
        adapterCacheRef.current.set(cacheKey, {
          value,
          expiresAt: now + SMART_INK_ADAPTER_CACHE_TTL_MS,
        });
        return value;
      } catch {
        adapterCacheRef.current.set(cacheKey, {
          value: null,
          expiresAt: now + SMART_INK_ADAPTER_ERROR_CACHE_TTL_MS,
        });
        return null;
      }
    },
    [sessionId]
  );

  const processSmartInkBuffer = useCallback(
    async (expectedConfigVersion?: number) => {
      if (
        typeof expectedConfigVersion === "number" &&
        expectedConfigVersion !== smartInkConfigVersionRef.current
      ) {
        return;
      }
      const options = smartInkOptionsRef.current;
      if (options.mode === "off") return;
      const buffer = smartInkStrokeBufferRef.current.filter(
        (stroke) => !smartInkProcessedStrokeIdsRef.current.has(stroke.id)
      );
      if (!buffer.length) return;

      const recognitionConfig = {
        smartShapes: options.smartShapes,
        smartTextOcr: options.smartTextOcr,
        smartMathOcr: options.smartMathOcr,
        handwritingAdapter: async (input: {
          stroke: WorkbookStroke;
          points: WorkbookPoint[];
        }) => {
          const sourceStrokes =
            buffer.length > 1 && input.points.length > input.stroke.points.length + 2
              ? buffer
              : [input.stroke];
          return requestSmartInkAdapter(sourceStrokes, options);
        },
      };

      const applyRecognized = async (
        strokes: WorkbookStroke[],
        result: SmartInkDetectedResult
      ) => {
        const objectMeta =
          result.object.meta && typeof result.object.meta === "object"
            ? result.object.meta
            : {};
        const objectWithPage: WorkbookBoardObject = {
          ...result.object,
          page: result.object.page ?? boardSettingsCurrentPage,
          meta: {
            ...objectMeta,
            sceneLayerId: activeSceneLayerId,
            smartInkKind: result.kind,
            smartInkConfidence: result.confidence,
          },
        };
        const clampedObjectWithPage = clampBoardObjectToPageFrame(objectWithPage);
        const objectWithZOrder = ensureWorkbookObjectZOrder(
          clampedObjectWithPage,
          boardObjectsRef.current
        );
        const events: WorkbookClientEventInput[] = [
          {
            type: "board.object.create",
            payload: { object: objectWithZOrder },
          },
          ...strokes.map((stroke) => ({
            type: "board.stroke.delete" as const,
            payload: { strokeId: stroke.id },
          })),
        ];
        try {
          let applied = false;
          let attempt = 0;
          while (!applied && attempt < 2) {
            try {
              await appendEventsAndApply(events);
              applied = true;
            } catch (error) {
              const canRetryConflict =
                error instanceof ApiError && error.code === "conflict" && attempt === 0;
              const canRetryRecoverable =
                isRecoverableApiError(error) && attempt === 0;
              if (!canRetryConflict && !canRetryRecoverable) {
                throw error;
              }
              await new Promise<void>((resolve) => {
                window.setTimeout(resolve, canRetryConflict ? 220 : 320);
              });
              attempt += 1;
            }
          }
          if (!applied) {
            throw new Error("smart_ink_apply_failed");
          }
          strokes.forEach((stroke) => {
            smartInkProcessedStrokeIdsRef.current.add(stroke.id);
          });
          smartInkStrokeBufferRef.current = smartInkStrokeBufferRef.current.filter(
            (item) => !strokes.some((stroke) => stroke.id === item.id)
          );
          setSelectedObjectId(objectWithZOrder.id);
        } catch {
          setError("Не удалось применить автопреобразование штриха.");
        }
      };

      const smartInkRuntime = await loadSmartInkRuntime();

      const lastStroke = buffer[buffer.length - 1];
      const shapeCandidate = options.smartShapes
        ? await smartInkRuntime.recognizeSmartInkStroke(lastStroke, {
            ...recognitionConfig,
            smartShapes: true,
            smartTextOcr: false,
            smartMathOcr: false,
            handwritingAdapter: undefined,
            forceShapeCoercion: true,
          })
        : null;

      const runOcrCandidate = async (
        ocrOptions: Pick<SmartInkOptions, "smartTextOcr" | "smartMathOcr">
      ): Promise<{ result: SmartInkDetectedResult; strokes: WorkbookStroke[] } | null> => {
        if (!ocrOptions.smartTextOcr && !ocrOptions.smartMathOcr) {
          return null;
        }
        const ocrConfig = {
          ...recognitionConfig,
          smartShapes: false,
          smartTextOcr: ocrOptions.smartTextOcr,
          smartMathOcr: ocrOptions.smartMathOcr,
          forceTextFallback: ocrOptions.smartTextOcr,
          forceFormulaFallback: ocrOptions.smartMathOcr,
          handwritingAdapter: async (input: {
            stroke: WorkbookStroke;
            points: WorkbookPoint[];
          }) => {
            const sourceStrokes =
              buffer.length > 1 && input.points.length > input.stroke.points.length + 2
                ? buffer
                : [input.stroke];
            return requestSmartInkAdapter(sourceStrokes, {
              ...options,
              smartShapes: false,
              smartTextOcr: ocrOptions.smartTextOcr,
              smartMathOcr: ocrOptions.smartMathOcr,
            });
          },
        };

        const candidates: Array<{ result: SmartInkDetectedResult; strokes: WorkbookStroke[] }> = [];
        if (buffer.length >= 2) {
          const batchResult = await smartInkRuntime.recognizeSmartInkBatch(buffer, ocrConfig);
          if (batchResult.kind !== "none") {
            candidates.push({ result: batchResult, strokes: buffer });
          }
        }
        const singleResult = await smartInkRuntime.recognizeSmartInkStroke(lastStroke, ocrConfig);
        if (singleResult.kind !== "none") {
          candidates.push({ result: singleResult, strokes: [lastStroke] });
        }
        if (!candidates.length) return null;
        return candidates.reduce((best, current) =>
          getRecognitionScore(current.result) > getRecognitionScore(best.result) ? current : best
        );
      };

      const textCandidate =
        options.mode === "text"
          ? await runOcrCandidate({ smartTextOcr: true, smartMathOcr: false })
          : null;
      const formulaCandidate =
        options.mode === "formula"
          ? await runOcrCandidate({ smartTextOcr: false, smartMathOcr: true })
          : null;

      if (options.mode === "shape") {
        if (shapeCandidate && shapeCandidate.kind !== "none") {
          await applyRecognized([lastStroke], shapeCandidate);
          return;
        }
      } else if (options.mode === "text") {
        if (textCandidate) {
          await applyRecognized(textCandidate.strokes, textCandidate.result);
          return;
        }
      } else if (options.mode === "formula") {
        if (formulaCandidate) {
          await applyRecognized(formulaCandidate.strokes, formulaCandidate.result);
          return;
        }
      }

      if (smartInkStrokeBufferRef.current.length > 8) {
        smartInkStrokeBufferRef.current = smartInkStrokeBufferRef.current.slice(-8);
      }
    },
    [
      activeSceneLayerId,
      appendEventsAndApply,
      boardObjectsRef,
      boardSettingsCurrentPage,
      requestSmartInkAdapter,
      setError,
      setSelectedObjectId,
      smartInkConfigVersionRef,
      smartInkOptionsRef,
      smartInkProcessedStrokeIdsRef,
      smartInkStrokeBufferRef,
    ]
  );

  const queueSmartInkStroke = useCallback(
    (stroke: WorkbookStroke) => {
      const options = smartInkOptionsRef.current;
      if (options.mode === "off") return;
      smartInkStrokeBufferRef.current = [...smartInkStrokeBufferRef.current, stroke];
      if (smartInkDebounceRef.current !== null) {
        window.clearTimeout(smartInkDebounceRef.current);
      }
      const configVersion = smartInkConfigVersionRef.current;
      const debounceMs =
        options.mode === "shape"
          ? 220
          : options.mode === "text" || options.mode === "formula"
            ? 460
            : 320;
      smartInkDebounceRef.current = window.setTimeout(() => {
        smartInkDebounceRef.current = null;
        if (configVersion !== smartInkConfigVersionRef.current) return;
        void processSmartInkBuffer(configVersion);
      }, debounceMs);
    },
    [
      processSmartInkBuffer,
      smartInkConfigVersionRef,
      smartInkDebounceRef,
      smartInkOptionsRef,
      smartInkStrokeBufferRef,
    ]
  );

  return {
    queueSmartInkStroke,
  };
};
