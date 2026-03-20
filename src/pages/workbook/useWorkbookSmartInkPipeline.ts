import { useCallback, type MutableRefObject } from "react";
import { recognizeWorkbookInk } from "@/features/workbook/model/api";
import { ensureWorkbookObjectZOrder } from "@/features/workbook/model/objectZOrder";
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
  const requestSmartInkAdapter = useCallback(
    async (strokes: WorkbookStroke[], options: SmartInkOptions) => {
      if (!sessionId) return null;
      if (!options.smartTextOcr && !options.smartMathOcr) return null;
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
        return {
          text: response.result.text ?? "",
          latex: response.result.latex ?? undefined,
          confidence:
            typeof response.result.confidence === "number"
              ? response.result.confidence
              : undefined,
        };
      } catch {
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
          await appendEventsAndApply(events);
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

      const threshold = options.confidenceThreshold;
      const smartInkRuntime = await loadSmartInkRuntime();

      const lastStroke = buffer[buffer.length - 1];
      const shapeCandidate = options.smartShapes
        ? await smartInkRuntime.recognizeSmartInkStroke(lastStroke, {
            ...recognitionConfig,
            smartShapes: true,
            smartTextOcr: false,
            smartMathOcr: false,
            handwritingAdapter: undefined,
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
          current.result.confidence > best.result.confidence ? current : best
        );
      };

      const textCandidate =
        options.mode === "text" || options.mode === "auto"
          ? await runOcrCandidate({ smartTextOcr: true, smartMathOcr: false })
          : null;
      const formulaCandidate =
        options.mode === "formula" || options.mode === "auto"
          ? await runOcrCandidate({ smartTextOcr: false, smartMathOcr: true })
          : null;

      if (options.mode === "shape") {
        if (
          shapeCandidate &&
          shapeCandidate.kind !== "none" &&
          shapeCandidate.confidence >= threshold
        ) {
          await applyRecognized([lastStroke], shapeCandidate);
          return;
        }
      } else if (options.mode === "text") {
        if (textCandidate && textCandidate.result.confidence >= threshold) {
          await applyRecognized(textCandidate.strokes, textCandidate.result);
          return;
        }
      } else if (options.mode === "formula") {
        if (formulaCandidate && formulaCandidate.result.confidence >= threshold) {
          await applyRecognized(formulaCandidate.strokes, formulaCandidate.result);
          return;
        }
      } else {
        const autoCandidates: Array<{ result: SmartInkDetectedResult; strokes: WorkbookStroke[] }> = [];
        if (shapeCandidate && shapeCandidate.kind !== "none") {
          autoCandidates.push({ result: shapeCandidate, strokes: [lastStroke] });
        }
        if (textCandidate) {
          autoCandidates.push(textCandidate);
        }
        if (formulaCandidate) {
          autoCandidates.push(formulaCandidate);
        }
        if (autoCandidates.length) {
          const bestCandidate = autoCandidates.reduce((best, current) =>
            current.result.confidence > best.result.confidence ? current : best
          );
          if (bestCandidate.result.confidence >= threshold) {
            await applyRecognized(bestCandidate.strokes, bestCandidate.result);
            return;
          }
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
      smartInkDebounceRef.current = window.setTimeout(() => {
        smartInkDebounceRef.current = null;
        if (configVersion !== smartInkConfigVersionRef.current) return;
        void processSmartInkBuffer(configVersion);
      }, options.smartTextOcr || options.smartMathOcr ? 620 : 360);
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
