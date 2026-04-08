import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  buildRealtimeObjectPatch,
  REALTIME_PREVIEW_REPEAT_GUARD_MS,
  toStableSignature,
} from "../model/realtimePreview";
import {
  buildFunctionGraphRenderStateMap,
  buildWorkbookObjectSceneEntries,
  prepareWorkbookRenderObject,
  type WorkbookMaskedObjectSceneEntry,
} from "../model/sceneRender";
import {
  resolveRealtimePatchBaseObject,
  resolveSelectedPreviewObject,
  type GraphPanState,
  type MovingState,
  type ResizeState,
  type Solid3dResizeState,
} from "../model/sceneRuntime";
import type { WorkbookAreaSelectionDraft } from "../model/sceneSelection";
import type {
  Solid3dGestureState,
  WorkbookAreaSelectionResizeState,
} from "../model/sceneInteraction";
import type { WorkbookPageFrameBounds } from "../model/pageFrame";
import { resolveFunctionGraphPlotHit } from "../model/sceneHitTesting";
import type { Solid3dSectionPoint } from "../model/solid3dState";
import type {
  ObjectEraserCut,
  ObjectEraserPreviewPath,
} from "../model/eraser";
import type {
  WorkbookBoardObject,
  WorkbookConstraint,
  WorkbookPoint,
} from "../model/types";
import { getObjectRect } from "../model/sceneGeometry";
import {
  getSectionVertexLabel,
  type InlineTextEditDraft,
  ROUND_SOLID_PRESETS,
  summarizeProjectedVertices,
} from "./WorkbookCanvas.types";
import { renderWorkbookCanvasPrimaryObject } from "./WorkbookCanvasPrimaryObjectRenderer";
import { renderWorkbookCanvasSecondaryObject } from "./WorkbookCanvasSecondaryObjectRenderer";
import { renderWorkbookCanvasSolid3dObject } from "./WorkbookCanvasSolid3dRenderer";
import { useWorkbookSelectionOverlayController } from "./useWorkbookSelectionOverlayController";
import { WORKBOOK_BOARD_PRIMARY_COLOR } from "../model/workbookVisualColors";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface UseWorkbookCanvasSceneRuntimeParams {
  visibleBoardObjects: WorkbookBoardObject[];
  objectById: Map<string, WorkbookBoardObject>;
  selectedObjectId: string | null;
  moving: MovingState | null;
  resizing: ResizeState | null;
  graphPan: GraphPanState | null;
  solid3dResize: Solid3dResizeState | null;
  solid3dGesture: Solid3dGestureState | null;
  gridSize: number;
  imageAssetUrls: Record<string, string>;
  inlineTextEdit: InlineTextEditDraft | null;
  inlineTextEditInputRef: MutableRefObject<HTMLTextAreaElement | null>;
  onInlineTextDraftChange?: (objectId: string, value: string) => void;
  commitInlineTextEdit: () => void;
  setInlineTextEdit: Dispatch<SetStateAction<InlineTextEditDraft | null>>;
  cancelInlineTextEdit: () => void;
  eraserPreviewActive: boolean;
  activeEraserPreviewObjectCuts: Record<string, ObjectEraserCut[]>;
  activeEraserPreviewObjectPaths: Record<string, ObjectEraserPreviewPath[]>;
  constraints: WorkbookConstraint[];
  selectedConstraintId: string | null;
  renderViewportRect: Rect;
  pageFrameBounds: WorkbookPageFrameBounds;
  solid3dSectionMarkers: {
    objectId: string;
    sectionId: string;
    selectedPoints: Solid3dSectionPoint[];
  } | null;
  solid3dPreviewMetaById: Record<string, Record<string, unknown>>;
  areaSelectionDraft: WorkbookAreaSelectionDraft | null;
  areaSelectionResize: WorkbookAreaSelectionResizeState | null;
  onObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: {
      trackHistory?: boolean;
      markDirty?: boolean;
    }
  ) => void;
}

export const useWorkbookCanvasSceneRuntime = ({
  visibleBoardObjects,
  objectById,
  selectedObjectId,
  moving,
  resizing,
  graphPan,
  solid3dResize,
  solid3dGesture,
  gridSize,
  imageAssetUrls,
  inlineTextEdit,
  inlineTextEditInputRef,
  onInlineTextDraftChange,
  commitInlineTextEdit,
  setInlineTextEdit,
  cancelInlineTextEdit,
  eraserPreviewActive,
  activeEraserPreviewObjectCuts,
  activeEraserPreviewObjectPaths,
  constraints,
  selectedConstraintId,
  renderViewportRect,
  pageFrameBounds,
  solid3dSectionMarkers,
  solid3dPreviewMetaById,
  areaSelectionDraft,
  areaSelectionResize,
  onObjectUpdate,
}: UseWorkbookCanvasSceneRuntimeParams) => {
  const lastRealtimeUpdateAtRef = useRef<Map<string, number>>(new Map());
  const lastRealtimePatchSignatureRef = useRef<Map<string, string>>(new Map());

  const activeMoveRect = useMemo(() => {
    if (!moving) return null;
    const deltaX = moving.current.x - moving.start.x;
    const deltaY = moving.current.y - moving.start.y;
    const baseRect = getObjectRect(moving.object);
    return {
      id: moving.object.id,
      x: baseRect.x + deltaX,
      y: baseRect.y + deltaY,
      width: baseRect.width,
      height: baseRect.height,
    };
  }, [moving]);

  const selectedObject = selectedObjectId ? objectById.get(selectedObjectId) ?? null : null;
  const selectedPreviewObject = useMemo(
    () =>
      resolveSelectedPreviewObject({
        selectedObject,
        moving,
        resizing,
        graphPan,
        solid3dResize,
        solid3dPreviewMetaById,
      }),
    [graphPan, moving, resizing, selectedObject, solid3dPreviewMetaById, solid3dResize]
  );

  const functionGraphRenderStateById = useMemo(() => {
    const { map } = buildFunctionGraphRenderStateMap({
      visibleBoardObjects,
      selectedPreviewObject,
      graphPan,
      gridSize,
    });
    return map;
  }, [graphPan, gridSize, selectedPreviewObject, visibleBoardObjects]);

  const resolveGraphFunctionHit = useCallback(
    (object: WorkbookBoardObject, point: WorkbookPoint) => {
      if (object.type !== "function_graph") return null;
      const renderState = functionGraphRenderStateById.get(object.id);
      if (!renderState) return null;
      return resolveFunctionGraphPlotHit(renderState.plots, point);
    },
    [functionGraphRenderStateById]
  );

  const renderObject = useCallback(
    (objectSource: WorkbookBoardObject) => {
      const prepared = prepareWorkbookRenderObject({
        objectSource,
        moving,
        activeMoveRect,
        solid3dPreviewMetaById,
      });
      const { object, normalized, transform } = prepared;
      const commonProps = {
        stroke: object.color ?? WORKBOOK_BOARD_PRIMARY_COLOR,
        strokeWidth: object.strokeWidth ?? 2,
        fill: object.fill ?? "transparent",
        opacity: object.opacity ?? 1,
        "data-object-id": object.id,
      };

      const renderedPrimaryObject = renderWorkbookCanvasPrimaryObject({
        object,
        normalized,
        transform,
        commonProps,
        imageAssetUrls,
        inlineTextEdit,
        inlineTextEditInputRef,
        onInlineTextDraftChange,
        commitInlineTextEdit,
        setInlineTextEdit,
        cancelInlineTextEdit,
        functionGraphRenderStateById,
        pageFrameBounds,
      });
      if (renderedPrimaryObject) {
        return renderedPrimaryObject;
      }
      const renderedSolid3d = renderWorkbookCanvasSolid3dObject({
        object,
        normalized,
        transform,
        isRoundSolidPreset: (presetId) => ROUND_SOLID_PRESETS.has(presetId),
        summarizeProjectedVertices,
        getSectionVertexLabel,
      });
      if (renderedSolid3d) {
        return renderedSolid3d;
      }
      return renderWorkbookCanvasSecondaryObject({
        object,
        normalized,
        transform,
      });
    },
    [
      activeMoveRect,
      cancelInlineTextEdit,
      commitInlineTextEdit,
      functionGraphRenderStateById,
      imageAssetUrls,
      inlineTextEdit,
      inlineTextEditInputRef,
      moving,
      onInlineTextDraftChange,
      pageFrameBounds,
      setInlineTextEdit,
      solid3dPreviewMetaById,
    ]
  );

  const imageAssetRevision = useMemo(
    () => Object.entries(imageAssetUrls).map(([id, url]) => `${id}:${url}`).join("|"),
    [imageAssetUrls]
  );
  const inlineTextEditRevision = inlineTextEdit
    ? `${inlineTextEdit.objectId}:${inlineTextEdit.value}`
    : "";

  const objectSceneEntries = useMemo<WorkbookMaskedObjectSceneEntry[]>(() => {
    const { entries } = buildWorkbookObjectSceneEntries({
      visibleBoardObjects,
      selectedPreviewObject,
      eraserPreviewActive,
      previewObjectCuts: activeEraserPreviewObjectCuts,
      previewObjectPaths: activeEraserPreviewObjectPaths,
      renderRevision: `${imageAssetRevision}::${inlineTextEditRevision}`,
      functionGraphRenderStateById,
      renderObject,
    });
    return entries;
  }, [
    activeEraserPreviewObjectCuts,
    activeEraserPreviewObjectPaths,
    eraserPreviewActive,
    functionGraphRenderStateById,
    imageAssetRevision,
    inlineTextEditRevision,
    renderObject,
    selectedPreviewObject,
    visibleBoardObjects,
  ]);

  const isLiveInteractionActive = Boolean(
    moving || resizing || graphPan || solid3dGesture || solid3dResize
  );
  const realtimePatchBaseObject = useMemo(
    () =>
      resolveRealtimePatchBaseObject({
        selectedObject,
        moving,
        resizing,
        graphPan,
        solid3dResize,
      }),
    [graphPan, moving, resizing, selectedObject, solid3dResize]
  );

  const emitRealtimeObjectUpdate = useCallback(
    (objectId: string, patch: Partial<WorkbookBoardObject>) => {
      const now =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const previousTs = lastRealtimeUpdateAtRef.current.get(objectId) ?? 0;
      const signature = toStableSignature(patch);
      const previousSignature = lastRealtimePatchSignatureRef.current.get(objectId) ?? "";
      if (
        signature === previousSignature &&
        now - previousTs < REALTIME_PREVIEW_REPEAT_GUARD_MS
      ) {
        return;
      }
      lastRealtimeUpdateAtRef.current.set(objectId, now);
      lastRealtimePatchSignatureRef.current.set(objectId, signature);
      onObjectUpdate(objectId, patch, {
        trackHistory: false,
        markDirty: false,
      });
    },
    [onObjectUpdate]
  );

  useEffect(() => {
    if (!isLiveInteractionActive || !realtimePatchBaseObject || !selectedPreviewObject) return;
    if (realtimePatchBaseObject.id !== selectedPreviewObject.id) return;
    const patch = buildRealtimeObjectPatch(realtimePatchBaseObject, selectedPreviewObject);
    if (!patch) return;
    emitRealtimeObjectUpdate(realtimePatchBaseObject.id, patch);
  }, [
    emitRealtimeObjectUpdate,
    isLiveInteractionActive,
    realtimePatchBaseObject,
    selectedPreviewObject,
  ]);

  useEffect(() => {
    if (isLiveInteractionActive) return;
    lastRealtimePatchSignatureRef.current.clear();
    lastRealtimeUpdateAtRef.current.clear();
  }, [isLiveInteractionActive]);

  const {
    selectedRect,
    selectedLineControls,
    selectedSolidResizeHandles,
    constraintRenderSegments,
    solid3dMarkerNodes,
    areaSelectionDraftRect,
    areaSelectionResizeRect,
  } = useWorkbookSelectionOverlayController({
    selectedPreviewObject,
    constraints,
    objectById,
    selectedConstraintId,
    renderViewportRect,
    solid3dSectionMarkers,
    solid3dPreviewMetaById,
    areaSelectionDraft,
    areaSelectionResize,
  });

  return {
    selectedPreviewObject,
    resolveGraphFunctionHit,
    objectSceneEntries,
    selectedRect,
    selectedLineControls,
    selectedSolidResizeHandles,
    constraintRenderSegments,
    solid3dMarkerNodes,
    areaSelectionDraftRect,
    areaSelectionResizeRect,
  };
};
