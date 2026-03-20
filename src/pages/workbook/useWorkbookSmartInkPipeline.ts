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
      if (options.smartShapes) {
        const shapeResult = await smartInkRuntime.recognizeSmartInkStroke(lastStroke, {
          ...recognitionConfig,
          smartShapes: true,
          smartTextOcr: false,
          smartMathOcr: false,
          handwritingAdapter: undefined,
        });
        if (shapeResult.kind !== "none" && shapeResult.confidence >= threshold) {
          await applyRecognized([lastStroke], shapeResult);
          return;
        }
      }

      if (options.smartTextOcr || options.smartMathOcr) {
        if (buffer.length >= 2) {
          const batchResult = await smartInkRuntime.recognizeSmartInkBatch(
            buffer,
            recognitionConfig
          );
          if (batchResult.kind !== "none" && batchResult.confidence >= threshold) {
            await applyRecognized(buffer, batchResult);
            return;
          }
        }

        const singleResult = await smartInkRuntime.recognizeSmartInkStroke(
          lastStroke,
          recognitionConfig
        );
        if (singleResult.kind !== "none" && singleResult.confidence >= threshold) {
          await applyRecognized([lastStroke], singleResult);
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
