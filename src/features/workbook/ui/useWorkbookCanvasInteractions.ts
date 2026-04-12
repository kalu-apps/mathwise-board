import { useCallback, type Dispatch, type MutableRefObject, type PointerEvent, type SetStateAction } from "react";
import { generateId } from "@/shared/lib/id";
import {
  finalizeEraserSegmentPreview,
} from "../model/eraser";
import {
  buildGraphPanCommitUpdate,
  buildSolid3dGestureCommitUpdate,
  buildSolid3dResizeCommitUpdate,
} from "../model/sceneCommit";
import { buildWorkbookPointObject } from "../model/sceneCreation";
import {
  buildAreaSelectionProxyObject,
  collectAreaSelectionObjects,
  resolveAreaSelectionResizeMode,
  type WorkbookAreaSelection,
  type WorkbookAreaSelectionDraft,
} from "../model/sceneSelection";
import { getStrokeRect } from "../model/stroke";
import {
  buildAreaSelectionDraftState,
  buildAreaSelectionResizeState,
  buildPanState,
  buildPanningOffset,
  buildMovingCurrentPoint,
  resolveObjectResizeMode,
  buildSolid3dGesturePreviewMeta,
  buildSolid3dResizeState,
  finalizeAreaSelectionDraftWithQueries,
  finalizeAreaSelectionResizeWithQueries,
  shouldKeepObjectSelectedInsideArea,
  type PanState,
  type Solid3dGestureState,
  type WorkbookAreaSelectionResizeState,
} from "../model/sceneInteraction";
import {
  collectMappedInteractionPoints,
  collectSegmentPreviewPoints,
  filterPreviewPointsByDistance,
  type GraphPanState,
  type MovingState,
  type ResizeState,
  type Solid3dResizeState,
} from "../model/sceneRuntime";
import {
  resolveWorkbookContinueInteractionMode,
  resolveWorkbookFinishInteractionMode,
  resolveWorkbookPanStartAction,
  resolveWorkbookSelectStartAction,
  resolveWorkbookStartInteractionMode,
  shouldClearWorkbookLaserOnSecondaryButton,
  shouldPreventWorkbookPointerDefault,
  shouldTrackWorkbookEraserHover,
} from "../model/scenePointer";
import {
  isWorkbookPolygonPointTool,
  isWorkbookShapeCreationTool,
  isWorkbookStrokeDrawingTool,
  shouldSnapWorkbookPointerForTool,
} from "../model/sceneTools";
import { buildWorkbookStrokeMoveProxyObject, type WorkbookStrokeSelection } from "../model/strokeSelection";
import type { WorkbookBoardObject, WorkbookLayer, WorkbookPoint, WorkbookStroke, WorkbookTool } from "../model/types";
import type {
  Solid3dHostedPointClassification,
  Solid3dSectionPoint,
} from "../model/solid3dState";

type ShapeDraft = {
  tool:
    | "line"
    | "arrow"
    | "rectangle"
    | "ellipse"
    | "triangle"
    | "polygon"
    | "text"
    | "compass"
    | "formula"
    | "function_graph"
    | "frame"
    | "divider"
    | "sticker"
    | "comment"
    | "solid3d";
  start: WorkbookPoint;
  current: WorkbookPoint;
};

type InteractionStateRefs = {
  pointerIdRef: MutableRefObject<number | null>;
  strokePointsRef: MutableRefObject<WorkbookPoint[]>;
  erasedStrokeIdsRef: MutableRefObject<Set<string>>;
  eraserGestureIdRef: MutableRefObject<string | null>;
  eraserLastAppliedPointRef: MutableRefObject<WorkbookPoint | null>;
  eraserLastPreviewPointRef: MutableRefObject<WorkbookPoint | null>;
  shapeDraftRef: MutableRefObject<ShapeDraft | null>;
  movingRef: MutableRefObject<MovingState | null>;
  resizingRef: MutableRefObject<ResizeState | null>;
  graphPanRef: MutableRefObject<GraphPanState | null>;
  solid3dResizeRef: MutableRefObject<Solid3dResizeState | null>;
  areaSelectionDraftRef: MutableRefObject<WorkbookAreaSelectionDraft | null>;
  areaSelectionResizeRef: MutableRefObject<WorkbookAreaSelectionResizeState | null>;
};

type InteractionStateSetters = {
  setPanning: Dispatch<SetStateAction<PanState | null>>;
  setPolygonPointDraft: Dispatch<SetStateAction<WorkbookPoint[]>>;
  setPolygonHoverPoint: (value: WorkbookPoint | null) => void;
  schedulePolygonHoverPoint: (value: WorkbookPoint | ((prev: WorkbookPoint | null) => WorkbookPoint | null)) => void;
  setAreaSelectionResize: (value: WorkbookAreaSelectionResizeState | null) => void;
  setAreaSelectionDraft: (value: WorkbookAreaSelectionDraft | null) => void;
  setSolid3dResize: (value: Solid3dResizeState | null) => void;
  setSolid3dGesture: Dispatch<SetStateAction<Solid3dGestureState | null>>;
  setErasing: Dispatch<SetStateAction<boolean>>;
  setEraserCursorPoint: (value: WorkbookPoint | null) => void;
  scheduleEraserCursorPoint: (value: WorkbookPoint | ((prev: WorkbookPoint | null) => WorkbookPoint | null)) => void;
  setGraphPan: (value: GraphPanState | null) => void;
  scheduleGraphPan: (value: GraphPanState | ((prev: GraphPanState | null) => GraphPanState | null)) => void;
  setShapeDraft: (value: ShapeDraft | null) => void;
  scheduleShapeDraft: (value: ShapeDraft | ((prev: ShapeDraft | null) => ShapeDraft | null)) => void;
  scheduleSolid3dPreviewMetaById: (
    value:
      | Record<string, Record<string, unknown>>
      | ((prev: Record<string, Record<string, unknown>>) => Record<string, Record<string, unknown>>)
  ) => void;
  scheduleSolid3dResize: (
    value:
      | Solid3dResizeState
      | ((prev: Solid3dResizeState | null) => Solid3dResizeState | null)
      | null
  ) => void;
  scheduleAreaSelectionResize: (
    value:
      | WorkbookAreaSelectionResizeState
      | ((prev: WorkbookAreaSelectionResizeState | null) => WorkbookAreaSelectionResizeState | null)
      | null
  ) => void;
  scheduleAreaSelectionDraft: (
    value:
      | WorkbookAreaSelectionDraft
      | ((prev: WorkbookAreaSelectionDraft | null) => WorkbookAreaSelectionDraft | null)
      | null
  ) => void;
  scheduleResizing: (
    value:
      | ResizeState
      | ((prev: ResizeState | null) => ResizeState | null)
      | null
  ) => void;
  scheduleMoving: (
    value:
      | MovingState
      | ((prev: MovingState | null) => MovingState | null)
      | null
  ) => void;
  setSolid3dPreviewMetaById: Dispatch<SetStateAction<Record<string, Record<string, unknown>>>>;
};

type InteractionCallbacks = {
  mapPointer: (
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
    snap?: boolean,
    clamp?: boolean
  ) => WorkbookPoint;
  snapPoint: (point: WorkbookPoint) => WorkbookPoint;
  resolveTopObject: (point: WorkbookPoint) => WorkbookBoardObject | null;
  resolveTopStroke: (point: WorkbookPoint) => WorkbookStroke | null;
  resolveGraphFunctionHit: (target: WorkbookBoardObject, point: WorkbookPoint) => string | null;
  resolveSolid3dPointAtPointer: (
    target: WorkbookBoardObject,
    point: WorkbookPoint
  ) => {
    point: { x: number; y: number; z: number };
    faceIndex: number;
    triangleVertexIndices: [number, number, number];
    barycentric: [number, number, number];
    classification?: Solid3dHostedPointClassification;
    vertexIndex?: number;
    edgeKey?: string;
    hostSegmentId?: string;
    segmentT?: number;
  } | null;
  resolveSolid3dResizeHandleHit: (
    selected: WorkbookBoardObject,
    point: WorkbookPoint
  ) => (WorkbookPoint & { mode: Solid3dResizeState["mode"] }) | null;
  startStroke: (event: PointerEvent<SVGSVGElement>, svg: SVGSVGElement) => void;
  startShape: (
    nextTool: ShapeDraft["tool"],
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => void;
  startMoving: (
    object: WorkbookBoardObject,
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement,
    groupOverride?: WorkbookBoardObject[],
    groupStrokeSelectionsOverride?: Array<{ id: string; layer: WorkbookLayer }>
  ) => void;
  toggleObjectPin: (objectId: string, pinned: boolean) => void;
  startResizing: (
    object: WorkbookBoardObject,
    mode: ResizeState["mode"],
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => void;
  startSolid3dGesture: (
    object: WorkbookBoardObject,
    mode: "rotate" | "pan",
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => void;
  startGraphPan: (
    object: WorkbookBoardObject,
    targetFunctionId: string,
    start: WorkbookPoint,
    event: PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement
  ) => void;
  commitPolygonByPoints: (sourcePoints: WorkbookPoint[]) => void;
  eraseAtPoint: (point: WorkbookPoint) => void;
  eraseAlongSegment: (from: WorkbookPoint, to: WorkbookPoint) => WorkbookPoint[];
  emitEraserPreviewPoints: (points: WorkbookPoint[], ended?: boolean) => void;
  commitEraserGesture: () => void;
  clearEraserPreviewRuntime: () => void;
  enqueueStrokePoints: (nextPoints: WorkbookPoint[]) => void;
  finishStroke: (event: PointerEvent<SVGSVGElement>, svg: SVGSVGElement) => void;
  finishShape: (draft?: ShapeDraft | null) => void;
  finishMoving: (nextMoving?: MovingState | null) => void;
  finishResizing: (nextResizing?: ResizeState | null) => void;
  finishAreaSelectionResize?: (
    nextAreaSelectionResize?: WorkbookAreaSelectionResizeState | null
  ) => void;
  releasePointerCapture: (svg: SVGSVGElement, pointerId: number) => void;
  resolveBoundedMovingCurrentPoint?: (
    moving: MovingState,
    clientX: number,
    clientY: number,
    safeZoom: number
  ) => WorkbookPoint;
  boardObjectCandidatesInRect: (rect: WorkbookAreaSelection["rect"]) => WorkbookBoardObject[];
  strokeCandidatesInRect: (rect: WorkbookAreaSelection["rect"]) => WorkbookStroke[];
  getObjectSceneLayerId: (object: WorkbookBoardObject) => string;
};

type InteractionExternalApi = {
  onSelectedConstraintChange: (constraintId: string | null) => void;
  onSelectedObjectChange: (objectId: string | null) => void;
  onSelectedStrokeChange: (selection: WorkbookStrokeSelection | null) => void;
  onStrokeDelete: (strokeId: string, layer: WorkbookLayer) => void;
  onObjectDelete: (objectId: string) => void;
  onObjectCreate: (object: WorkbookBoardObject) => void;
  onObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: { trackHistory?: boolean; markDirty?: boolean }
  ) => void;
  onRequestSelectTool?: () => void;
  onAreaSelectionChange?: (selection: WorkbookAreaSelection | null) => void;
  onLaserClear?: () => void;
  onLaserPoint: (point: WorkbookPoint) => void;
  onSolid3dDraftPointAdd?: (payload: {
    objectId: string;
    point: Solid3dSectionPoint;
  }) => void;
  onSolid3dInsertConsumed?: () => void;
  onViewportOffsetChange?: (offset: WorkbookPoint) => void;
};

type InteractionData = {
  disabled: boolean;
  tool: WorkbookTool;
  polygonMode: "regular" | "points";
  solid3dInsertPreset: { presetId: string; presetTitle?: string } | null;
  forcePanMode: boolean;
  viewportOffset: WorkbookPoint;
  safeZoom: number;
  allowHorizontalPan: boolean;
  selectedObjectId: string | null;
  objectById: Map<string, WorkbookBoardObject>;
  areaSelection: WorkbookAreaSelection | null;
  solid3dDraftPointCollectionObjectId: string | null;
  panning: PanState | null;
  graphPan: GraphPanState | null;
  solid3dGesture: Solid3dGestureState | null;
  solid3dResize: Solid3dResizeState | null;
  areaSelectionResize: WorkbookAreaSelectionResizeState | null;
  areaSelectionDraft: WorkbookAreaSelectionDraft | null;
  erasing: boolean;
  shapeDraft: ShapeDraft | null;
  resizing: ResizeState | null;
  moving: MovingState | null;
  polygonPointDraft: WorkbookPoint[];
  pointerPoint?: WorkbookPoint | null;
  layer: WorkbookLayer;
  color: string;
  width: number;
  authorUserId: string;
  currentPage: number;
  latestSolid3dPreviewMetaById: Record<string, Record<string, unknown>>;
};

type InteractionFlushers = {
  flushShapeDraft: () => ShapeDraft | null;
  flushMoving: () => MovingState | null;
  flushResizing: () => ResizeState | null;
  flushGraphPan: () => GraphPanState | null;
  flushSolid3dResize: () => Solid3dResizeState | null;
  flushAreaSelectionDraft: () => WorkbookAreaSelectionDraft | null;
  flushAreaSelectionResize: () => WorkbookAreaSelectionResizeState | null;
  flushSolid3dPreviewMetaById: () => Record<string, Record<string, unknown>>;
};

const refineImageScissorsSelection = (params: {
  tool: WorkbookTool;
  selection: WorkbookAreaSelection | null;
  draft: WorkbookAreaSelectionDraft;
  resolveTopObject: (point: WorkbookPoint) => WorkbookBoardObject | null;
}): WorkbookAreaSelection | null => {
  const { tool, selection, draft, resolveTopObject } = params;
  if (tool !== "area_select" || !selection) return selection;
  if (selection.objectIds.length === 0) return selection;

  const objectIds = new Set(selection.objectIds);
  const centerPoint: WorkbookPoint = {
    x: selection.rect.x + selection.rect.width / 2,
    y: selection.rect.y + selection.rect.height / 2,
  };
  const probePoints = [draft.start, draft.current, centerPoint];

  for (const point of probePoints) {
    const topObject = resolveTopObject(point);
    if (!topObject) continue;
    if (!objectIds.has(topObject.id)) continue;
    if (topObject.type !== "image") continue;

    return {
      ...selection,
      objectIds: [topObject.id],
      strokeIds: [],
    };
  }

  return selection;
};

export type UseWorkbookCanvasInteractionsParams = {
  refs: InteractionStateRefs;
  setters: InteractionStateSetters;
  callbacks: InteractionCallbacks;
  api: InteractionExternalApi;
  data: InteractionData;
  flushers: InteractionFlushers;
};

export const useWorkbookCanvasInteractions = (
  params: UseWorkbookCanvasInteractionsParams
) => {
  const { refs, setters, callbacks, api, data, flushers } = params;
  const {
    pointerIdRef,
    strokePointsRef,
    erasedStrokeIdsRef,
    eraserGestureIdRef,
    eraserLastAppliedPointRef,
    eraserLastPreviewPointRef,
    shapeDraftRef,
    movingRef,
    resizingRef,
    graphPanRef,
    solid3dResizeRef,
    areaSelectionDraftRef,
    areaSelectionResizeRef,
  } = refs;
  const canResizeAreaSelection = useCallback(
    (selection: WorkbookAreaSelection | null) =>
      Boolean(
        selection &&
          selection.resizeEnabled === true &&
          selection.objectIds.length === 0 &&
          selection.strokeIds.length === 1
      ),
    []
  );

  const startInteraction = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (data.disabled) return;
      const svg = event.currentTarget ?? null;
      if (!svg) return;
      const startMode = resolveWorkbookStartInteractionMode({
        button: event.button,
        tool: data.tool,
        polygonPointMode: isWorkbookPolygonPointTool(data.tool, data.polygonMode),
        solid3dInsertPreset: Boolean(data.solid3dInsertPreset),
        forcePanMode: data.forcePanMode,
      });
      if (startMode === "button_ignore") {
        if (
          shouldClearWorkbookLaserOnSecondaryButton({
            tool: data.tool,
            button: event.button,
          })
        ) {
          api.onLaserClear?.();
        }
        return;
      }
      if (shouldPreventWorkbookPointerDefault(event.pointerType)) {
        event.preventDefault();
      }
      const shouldSnapPoint = shouldSnapWorkbookPointerForTool(data.tool, {
        polygonMode: data.polygonMode,
        includeSolid3dInsertPreset: Boolean(data.solid3dInsertPreset),
      });
      const point = callbacks.mapPointer(
        svg,
        event.clientX,
        event.clientY,
        shouldSnapPoint
      );
      if (startMode !== "select") {
        api.onSelectedStrokeChange(null);
      }
      if (startMode === "solid3d_insert") {
        api.onSelectedConstraintChange(null);
        api.onSelectedObjectChange(null);
        callbacks.startShape("solid3d", event, svg);
        return;
      }
      if (startMode === "force_pan") {
        pointerIdRef.current = event.pointerId;
        setters.setPanning(
          buildPanState({ x: event.clientX, y: event.clientY }, data.viewportOffset)
        );
        svg.setPointerCapture(event.pointerId);
        return;
      }

      if (startMode === "pan") {
        const target = callbacks.resolveTopObject(point);
        const strokeTarget = !target ? callbacks.resolveTopStroke(point) : null;
        const targetFunctionId =
          target && target.type === "function_graph" && !target.pinned
            ? callbacks.resolveGraphFunctionHit(target, point)
            : null;
        const panAction = resolveWorkbookPanStartAction({
          hasTarget: Boolean(target),
          targetPinned: target?.pinned ?? true,
          targetType: target?.type ?? null,
          hasTargetFunctionId: Boolean(targetFunctionId),
        });
        api.onSelectedConstraintChange(null);
        if (panAction === "rotate_solid3d" && target) {
          api.onSelectedObjectChange(target.id);
          callbacks.startSolid3dGesture(target, "rotate", event, svg);
          return;
        }
        if (panAction === "graph_pan" && target && targetFunctionId) {
          api.onSelectedObjectChange(target.id);
          callbacks.startGraphPan(target, targetFunctionId, point, event, svg);
          return;
        }
        if (panAction === "move" && target) {
          api.onSelectedObjectChange(target.id);
          callbacks.startMoving(target, event, svg);
          return;
        }
        if (strokeTarget) {
          api.onAreaSelectionChange?.(null);
          api.onSelectedObjectChange(null);
          api.onSelectedStrokeChange({
            id: strokeTarget.id,
            layer: strokeTarget.layer,
          });
          const strokeProxy = buildWorkbookStrokeMoveProxyObject(
            strokeTarget,
            data.authorUserId
          );
          if (strokeProxy) {
            callbacks.startMoving(strokeProxy, event, svg, [strokeProxy]);
            return;
          }
        }
        api.onSelectedObjectChange(null);
        pointerIdRef.current = event.pointerId;
        setters.setPanning(buildPanState({ x: event.clientX, y: event.clientY }, data.viewportOffset));
        svg.setPointerCapture(event.pointerId);
        return;
      }

      if (startMode === "lock_toggle") {
        const target = callbacks.resolveTopObject(point);
        api.onSelectedConstraintChange(null);
        api.onAreaSelectionChange?.(null);
        if (target) {
          api.onSelectedObjectChange(target.id);
          callbacks.toggleObjectPin(target.id, !target.pinned);
        } else {
          api.onSelectedObjectChange(null);
        }
        api.onRequestSelectTool?.();
        return;
      }

      if (startMode === "polygon_points") {
        api.onSelectedConstraintChange(null);
        if (event.detail >= 2) {
          callbacks.commitPolygonByPoints(data.polygonPointDraft);
          setters.setPolygonPointDraft([]);
          setters.setPolygonHoverPoint(null);
          return;
        }
        setters.setPolygonPointDraft((current) => [...current, callbacks.snapPoint(point)]);
        setters.setPolygonHoverPoint(point);
        return;
      }

      if (startMode === "laser") {
        api.onSelectedConstraintChange(null);
        if (
          data.pointerPoint &&
          Math.hypot(point.x - data.pointerPoint.x, point.y - data.pointerPoint.y) <= 18
        ) {
          api.onLaserClear?.();
          return;
        }
        api.onLaserPoint(point);
        return;
      }

      if (startMode === "sweep") {
        const strokeTarget = callbacks.resolveTopStroke(point);
        if (strokeTarget) {
          api.onSelectedConstraintChange(null);
          api.onStrokeDelete(strokeTarget.id, strokeTarget.layer);
          return;
        }
        const target = callbacks.resolveTopObject(point);
        if (target) {
          api.onSelectedConstraintChange(null);
          const layerId = callbacks.getObjectSceneLayerId(target);
          if (layerId !== "main") {
            data.objectById.forEach((item) => {
              if (
                item.id !== target.id &&
                callbacks.getObjectSceneLayerId(item) === layerId
              ) {
                api.onObjectDelete(item.id);
              }
            });
            api.onObjectDelete(target.id);
          } else {
            api.onObjectDelete(target.id);
          }
          if (data.selectedObjectId === target.id || layerId !== "main") {
            api.onSelectedObjectChange(null);
          }
        } else {
          api.onSelectedObjectChange(null);
          api.onRequestSelectTool?.();
        }
        return;
      }

      if (startMode === "area_select") {
        if (canResizeAreaSelection(data.areaSelection)) {
          const resizeMode = resolveAreaSelectionResizeMode(data.areaSelection!.rect, point);
          if (resizeMode) {
            pointerIdRef.current = event.pointerId;
            api.onSelectedConstraintChange(null);
            api.onSelectedObjectChange(null);
            setters.setAreaSelectionResize(
              buildAreaSelectionResizeState(data.areaSelection!.rect, resizeMode, point)
            );
            svg.setPointerCapture(event.pointerId);
            return;
          }
        }
        pointerIdRef.current = event.pointerId;
        api.onSelectedConstraintChange(null);
        api.onSelectedObjectChange(null);
        setters.setAreaSelectionDraft(buildAreaSelectionDraftState(point));
        svg.setPointerCapture(event.pointerId);
        return;
      }

      if (startMode === "point") {
        api.onSelectedConstraintChange(null);
        api.onSelectedObjectChange(null);
        const created = buildWorkbookPointObject({
          point,
          layer: data.layer,
          color: data.color,
          width: data.width,
          authorUserId: data.authorUserId,
        });
        api.onObjectCreate(created);
        api.onSelectedObjectChange(created.id);
        return;
      }

      if (data.solid3dDraftPointCollectionObjectId) {
        const target = callbacks.resolveTopObject(point);
        if (
          target &&
          target.type === "solid3d" &&
          target.id === data.solid3dDraftPointCollectionObjectId &&
          !target.pinned &&
          api.onSolid3dDraftPointAdd
        ) {
          const picked = callbacks.resolveSolid3dPointAtPointer(target, point);
          const hasHostedSegmentReference =
            typeof picked?.hostSegmentId === "string" &&
            picked.hostSegmentId.trim().length > 0;
          if (picked && (Number.isInteger(picked.faceIndex) || hasHostedSegmentReference)) {
            api.onSelectedConstraintChange(null);
            api.onSelectedObjectChange(target.id);
            api.onSolid3dDraftPointAdd({
              objectId: target.id,
              point: {
                x: picked.point.x,
                y: picked.point.y,
                z: picked.point.z,
                faceIndex: picked.faceIndex,
                triangleVertexIndices: picked.triangleVertexIndices,
                barycentric: picked.barycentric,
                classification: picked.classification,
                vertexIndex: picked.vertexIndex,
                edgeKey: picked.edgeKey,
                hostSegmentId: picked.hostSegmentId,
                segmentT: picked.segmentT,
                local3d: [picked.point.x, picked.point.y, picked.point.z],
              },
            });
            return;
          }
        }
      }

      if (startMode === "select") {
        if (canResizeAreaSelection(data.areaSelection)) {
          const areaResizeMode = resolveAreaSelectionResizeMode(data.areaSelection!.rect, point);
          if (areaResizeMode) {
            pointerIdRef.current = event.pointerId;
            api.onSelectedConstraintChange(null);
            api.onSelectedObjectChange(null);
            api.onSelectedStrokeChange(null);
            setters.setAreaSelectionResize(
              buildAreaSelectionResizeState(data.areaSelection!.rect, areaResizeMode, point)
            );
            svg.setPointerCapture(event.pointerId);
            return;
          }
        }
        const selected = data.selectedObjectId
          ? data.objectById.get(data.selectedObjectId) ?? null
          : null;
        const solid3dResizeHit =
          selected?.type === "solid3d"
            ? callbacks.resolveSolid3dResizeHandleHit(selected, point)
            : null;
        const resizeMode = selected ? resolveObjectResizeMode(selected, point) : null;
        const keepInsideArea = shouldKeepObjectSelectedInsideArea(point, data.areaSelection);
        const groupedTargets = keepInsideArea
          ? collectAreaSelectionObjects(data.areaSelection, data.objectById)
          : [];
        const groupedStrokeSelections =
          keepInsideArea && data.areaSelection
            ? data.areaSelection.strokeIds.map((entry) => ({
                id: entry.id,
                layer: entry.layer,
              }))
            : [];
        const target = callbacks.resolveTopObject(point);
        const strokeTarget = callbacks.resolveTopStroke(point);
        const selectAction = resolveWorkbookSelectStartAction({
          hasSelected: Boolean(selected),
          selectedPinned: selected?.pinned ?? true,
          selectedType: selected?.type ?? null,
          hasSolid3dResizeHit: Boolean(solid3dResizeHit),
          hasResizeMode: Boolean(resizeMode),
          keepInsideArea,
          hasGroupedTargets:
            groupedTargets.length > 0 || groupedStrokeSelections.length > 0,
          hasTarget: Boolean(target),
          targetPinned: target?.pinned ?? true,
        });
        api.onSelectedConstraintChange(null);
        if (selectAction === "solid3d_resize" && selected?.type === "solid3d" && solid3dResizeHit) {
          pointerIdRef.current = event.pointerId;
          api.onSelectedStrokeChange(null);
          setters.setSolid3dResize(
            buildSolid3dResizeState({
              object: selected,
              mode: solid3dResizeHit.mode,
              start: point,
              startLocal: solid3dResizeHit,
            })
          );
          api.onAreaSelectionChange?.(null);
          svg.setPointerCapture(event.pointerId);
          return;
        }
        if (selectAction === "resize" && selected && resizeMode) {
          api.onAreaSelectionChange?.(null);
          api.onSelectedStrokeChange(null);
          callbacks.startResizing(selected, resizeMode, event, svg);
          return;
        }
        if (
          selectAction === "move_group" &&
          (groupedTargets.length > 0 || groupedStrokeSelections.length > 0) &&
          data.areaSelection
        ) {
          api.onSelectedStrokeChange(null);
          const proxyObject = buildAreaSelectionProxyObject({
            rect: data.areaSelection.rect,
            layer: data.layer,
            authorUserId: data.authorUserId,
          });
          callbacks.startMoving(
            proxyObject,
            event,
            svg,
            groupedTargets,
            groupedStrokeSelections
          );
          return;
        }
        if (selectAction === "move" && target && !target.pinned) {
          api.onAreaSelectionChange?.(null);
          api.onSelectedStrokeChange(null);
          api.onSelectedObjectChange(target.id);
          callbacks.startMoving(target, event, svg);
          return;
        }
        if (!target && strokeTarget) {
          const strokeRect = getStrokeRect(strokeTarget);
          const strokeSelection = {
            id: strokeTarget.id,
            layer: strokeTarget.layer,
          };
          if (strokeRect) {
            const singleStrokeAreaSelection: WorkbookAreaSelection = {
              objectIds: [],
              strokeIds: [strokeSelection],
              rect: strokeRect,
              resizeEnabled: true,
            };
            api.onAreaSelectionChange?.(singleStrokeAreaSelection);
            api.onSelectedObjectChange(null);
            api.onSelectedStrokeChange(strokeSelection);
            const strokeAreaProxy = buildAreaSelectionProxyObject({
              rect: strokeRect,
              layer: data.layer,
              authorUserId: data.authorUserId,
            });
            callbacks.startMoving(
              strokeAreaProxy,
              event,
              svg,
              [],
              [strokeSelection]
            );
            return;
          }
          api.onAreaSelectionChange?.(null);
          api.onSelectedObjectChange(null);
          api.onSelectedStrokeChange(strokeSelection);
          const strokeProxy = buildWorkbookStrokeMoveProxyObject(
            strokeTarget,
            data.authorUserId
          );
          if (strokeProxy) {
            callbacks.startMoving(strokeProxy, event, svg, [strokeProxy]);
          }
          return;
        }
        api.onSelectedObjectChange(null);
        api.onSelectedStrokeChange(null);
        api.onAreaSelectionChange?.(null);
        pointerIdRef.current = event.pointerId;
        setters.setAreaSelectionDraft(buildAreaSelectionDraftState(point));
        svg.setPointerCapture(event.pointerId);
        return;
      }

      if (startMode === "eraser") {
        pointerIdRef.current = event.pointerId;
        callbacks.clearEraserPreviewRuntime();
        erasedStrokeIdsRef.current.clear();
        eraserGestureIdRef.current = generateId();
        eraserLastAppliedPointRef.current = point;
        eraserLastPreviewPointRef.current = point;
        setters.setErasing(true);
        setters.setEraserCursorPoint(point);
        callbacks.eraseAtPoint(point);
        callbacks.emitEraserPreviewPoints([point]);
        svg.setPointerCapture(event.pointerId);
        return;
      }

      if (startMode === "stroke" && isWorkbookStrokeDrawingTool(data.tool)) {
        callbacks.startStroke(event, svg);
        return;
      }

      if (startMode === "shape" && isWorkbookShapeCreationTool(data.tool, data.polygonMode)) {
        const bypassSelectOnHit = data.tool === "line" || data.tool === "arrow";
        if (!bypassSelectOnHit) {
          const target = callbacks.resolveTopObject(point);
          if (target && target.id !== data.selectedObjectId) {
            api.onSelectedConstraintChange(null);
            api.onSelectedStrokeChange(null);
            api.onSelectedObjectChange(target.id);
            api.onRequestSelectTool?.();
            return;
          }
          if (!target && data.selectedObjectId) {
            api.onSelectedConstraintChange(null);
            api.onSelectedStrokeChange(null);
            api.onSelectedObjectChange(null);
            api.onRequestSelectTool?.();
            return;
          }
        }
        api.onSelectedConstraintChange(null);
        api.onSelectedStrokeChange(null);
        callbacks.startShape(data.tool as ShapeDraft["tool"], event, svg);
      }
    },
    [
      api,
      canResizeAreaSelection,
      callbacks,
      data,
      erasedStrokeIdsRef,
      eraserGestureIdRef,
      eraserLastAppliedPointRef,
      eraserLastPreviewPointRef,
      pointerIdRef,
      setters,
    ]
  );

  const continueInteraction = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = event.currentTarget ?? null;
      if (!svg) return;

      if (shouldTrackWorkbookEraserHover(data.tool)) {
        const hoverPoint = callbacks.mapPointer(
          svg,
          event.clientX,
          event.clientY,
          false,
          false
        );
        setters.scheduleEraserCursorPoint(hoverPoint);
      }

      const continueMode = resolveWorkbookContinueInteractionMode({
        pointerIdMatches: pointerIdRef.current === event.pointerId,
        primaryButtonPressed:
          event.pointerType === "mouse" ? (event.buttons & 1) === 1 : true,
        polygonPointMode: isWorkbookPolygonPointTool(data.tool, data.polygonMode),
        panning: Boolean(data.panning),
        forcePanMode: data.forcePanMode,
        graphPan: Boolean(data.graphPan),
        solid3dGesture: Boolean(data.solid3dGesture),
        solid3dResize: Boolean(data.solid3dResize),
        areaSelectionResize: Boolean(data.areaSelectionResize),
        areaSelectionDraft: Boolean(data.areaSelectionDraft),
        erasing: data.erasing,
        eraserMode: data.tool === "eraser",
        hasStrokePoints: strokePointsRef.current.length > 0,
        shapeDraft: Boolean(data.shapeDraft),
        resizing: Boolean(data.resizing),
        moving: Boolean(data.moving),
      });

      if (continueMode === "polygon_hover") {
        setters.schedulePolygonHoverPoint(
          callbacks.mapPointer(svg, event.clientX, event.clientY, true)
        );
        return;
      }
      if (continueMode === "ignore") return;
      if (shouldPreventWorkbookPointerDefault(event.pointerType)) {
        event.preventDefault();
      }
      if (continueMode === "panning" && data.panning) {
        const nextOffset = buildPanningOffset(
          data.panning,
          event.clientX,
          event.clientY,
          data.safeZoom,
          data.allowHorizontalPan
        );
        api.onViewportOffsetChange?.(nextOffset);
        return;
      }
      if (continueMode === "graph_pan" && data.graphPan) {
        const point = callbacks.mapPointer(svg, event.clientX, event.clientY, false, false);
        setters.scheduleGraphPan((prev) => (prev ? { ...prev, current: point } : prev));
        return;
      }
      const requiresUnclampedPointer = Boolean(
        data.solid3dGesture || data.solid3dResize || data.moving
      );
      const point = callbacks.mapPointer(
        svg,
        event.clientX,
        event.clientY,
        Boolean(data.shapeDraft),
        !requiresUnclampedPointer
      );

      if (continueMode === "solid3d_gesture" && data.solid3dGesture) {
        const nextMeta = buildSolid3dGesturePreviewMeta(data.solid3dGesture, point);
        setters.scheduleSolid3dPreviewMetaById((current) => ({
          ...current,
          [data.solid3dGesture!.object.id]: nextMeta,
        }));
        return;
      }
      if (continueMode === "solid3d_resize" && data.solid3dResize) {
        setters.scheduleSolid3dResize((prev) => (prev ? { ...prev, current: point } : prev));
        return;
      }
      if (continueMode === "area_selection_resize" && data.areaSelectionResize) {
        setters.scheduleAreaSelectionResize((prev) => (prev ? { ...prev, current: point } : prev));
        return;
      }
      if (continueMode === "area_selection_draft" && data.areaSelectionDraft) {
        setters.scheduleAreaSelectionDraft((prev) => (prev ? { ...prev, current: point } : prev));
        return;
      }
      if (continueMode === "eraser") {
        const nativeEvent = event.nativeEvent;
        const coalesced =
          typeof nativeEvent.getCoalescedEvents === "function"
            ? nativeEvent.getCoalescedEvents()
            : [];
        const sourceEvents =
          coalesced.length > 0
            ? coalesced
            : [{ clientX: event.clientX, clientY: event.clientY }];
        const eraserSegmentResult = collectSegmentPreviewPoints({
          sourceEvents,
          mapPoint: (sourceEvent) =>
            callbacks.mapPointer(svg, sourceEvent.clientX, sourceEvent.clientY, false, false),
          lastAppliedPoint: eraserLastAppliedPointRef.current ?? point,
          sampleSegment: callbacks.eraseAlongSegment,
        });
        eraserLastAppliedPointRef.current = eraserSegmentResult.lastAppliedPoint;
        const filteredPoints = filterPreviewPointsByDistance({
          previewPoints: eraserSegmentResult.previewPoints,
          lastPreviewPoint: eraserLastPreviewPointRef.current,
          minDistance: Math.max(1.2, Math.max(4, data.width) * 0.22),
        });
        if (filteredPoints.length > 0) {
          eraserLastPreviewPointRef.current = filteredPoints[filteredPoints.length - 1];
          callbacks.emitEraserPreviewPoints(filteredPoints);
        }
        return;
      }
      if (continueMode === "stroke") {
        const nativeEvent = event.nativeEvent;
        const coalesced =
          typeof nativeEvent.getCoalescedEvents === "function"
            ? nativeEvent.getCoalescedEvents()
            : [];
        const sourceEvents =
          coalesced.length > 0
            ? coalesced
            : [nativeEvent as globalThis.PointerEvent];
        const nextPoints = collectMappedInteractionPoints({
          sourceEvents,
          mapPoint: (pointerEvent) =>
            callbacks.mapPointer(svg, pointerEvent.clientX, pointerEvent.clientY),
          lastPoint:
            strokePointsRef.current[strokePointsRef.current.length - 1] ?? null,
          minDistance: 0.18,
        });
        callbacks.enqueueStrokePoints(nextPoints);
        return;
      }
      if (continueMode === "shape") {
        setters.scheduleShapeDraft((prev) => (prev ? { ...prev, current: point } : prev));
        return;
      }
      if (continueMode === "resizing") {
        setters.scheduleResizing((prev) => (prev ? { ...prev, current: point } : prev));
        return;
      }
      if (continueMode === "moving" && data.moving) {
        const nextCurrent = callbacks.resolveBoundedMovingCurrentPoint
          ? callbacks.resolveBoundedMovingCurrentPoint(
              data.moving,
              event.clientX,
              event.clientY,
              data.safeZoom
            )
          : buildMovingCurrentPoint(data.moving, event.clientX, event.clientY, data.safeZoom);
        setters.scheduleMoving((prev) => (prev ? { ...prev, current: nextCurrent } : prev));
      }
    },
    [
      api,
      callbacks,
      data,
      eraserLastAppliedPointRef,
      eraserLastPreviewPointRef,
      pointerIdRef,
      setters,
      strokePointsRef,
    ]
  );

  const finishInteraction = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      const svg = event.currentTarget ?? null;
      const finishMode = resolveWorkbookFinishInteractionMode({
        pointerIdMatches: pointerIdRef.current === event.pointerId,
        svgPresent: Boolean(svg),
        erasing: data.erasing,
        hasStrokePoints: strokePointsRef.current.length > 0,
        hasShapeDraft: Boolean(shapeDraftRef.current),
        hasAreaSelectionResize: Boolean(areaSelectionResizeRef.current),
        hasAreaSelectionDraft: Boolean(areaSelectionDraftRef.current),
        panning: Boolean(data.panning),
        hasGraphPan: Boolean(graphPanRef.current),
        hasSolid3dGesture: Boolean(data.solid3dGesture),
        hasSolid3dResize: Boolean(solid3dResizeRef.current),
        hasResizing: Boolean(resizingRef.current),
        hasMoving: Boolean(movingRef.current),
      });
      if (finishMode === "ignore") {
        pointerIdRef.current = null;
        return;
      }
      if (shouldPreventWorkbookPointerDefault(event.pointerType)) {
        event.preventDefault();
      }
      const latestShapeDraft = flushers.flushShapeDraft();
      const latestMoving = flushers.flushMoving();
      const latestResizing = flushers.flushResizing();
      const latestGraphPan = flushers.flushGraphPan();
      const latestSolid3dResize = flushers.flushSolid3dResize();
      const latestAreaSelectionDraft = flushers.flushAreaSelectionDraft();
      const latestAreaSelectionResize = flushers.flushAreaSelectionResize();
      const latestSolid3dPreviewMetaById = flushers.flushSolid3dPreviewMetaById();
      if (finishMode === "erasing") {
        const point = callbacks.mapPointer(svg!, event.clientX, event.clientY, false, false);
        const eraserFinish = finalizeEraserSegmentPreview({
          point,
          lastAppliedPoint: eraserLastAppliedPointRef.current ?? point,
          eraseAlongSegment: callbacks.eraseAlongSegment,
        });
        eraserLastAppliedPointRef.current = eraserFinish.nextLastAppliedPoint;
        callbacks.emitEraserPreviewPoints(
          eraserFinish.sampledPoints.length > 0 ? eraserFinish.sampledPoints : [point],
          true
        );
        callbacks.commitEraserGesture();
        setters.setErasing(false);
        erasedStrokeIdsRef.current.clear();
        eraserGestureIdRef.current = null;
        eraserLastAppliedPointRef.current = null;
        eraserLastPreviewPointRef.current = null;
        callbacks.clearEraserPreviewRuntime();
      } else if (finishMode === "stroke") {
        callbacks.finishStroke(event, svg!);
      } else if (finishMode === "shape" && latestShapeDraft) {
        callbacks.finishShape(latestShapeDraft);
      } else if (finishMode === "area_selection_resize" && latestAreaSelectionResize) {
        if (data.tool === "select" && callbacks.finishAreaSelectionResize) {
          callbacks.finishAreaSelectionResize(latestAreaSelectionResize);
        } else {
          api.onAreaSelectionChange?.(
            finalizeAreaSelectionResizeWithQueries({
              resize: latestAreaSelectionResize,
              boardObjectCandidatesInRect: callbacks.boardObjectCandidatesInRect,
              strokeCandidatesInRect: callbacks.strokeCandidatesInRect,
            })
          );
        }
        setters.setAreaSelectionResize(null);
      } else if (finishMode === "area_selection_draft" && latestAreaSelectionDraft) {
        const nextSelection = finalizeAreaSelectionDraftWithQueries({
          draft: latestAreaSelectionDraft,
          boardObjectCandidatesInRect: callbacks.boardObjectCandidatesInRect,
          strokeCandidatesInRect: callbacks.strokeCandidatesInRect,
        });
        const refinedSelection = refineImageScissorsSelection({
          tool: data.tool,
          selection: nextSelection,
          draft: latestAreaSelectionDraft,
          resolveTopObject: callbacks.resolveTopObject,
        });
        api.onAreaSelectionChange?.(
          refinedSelection
            ? {
                ...refinedSelection,
                // Marquee selection in "select"/"area_select" is move-only by design.
                resizeEnabled: false,
              }
            : null
        );
        setters.setAreaSelectionDraft(null);
      } else if (finishMode === "panning" && data.panning) {
        setters.setPanning(null);
      } else if (finishMode === "graph_pan" && latestGraphPan) {
        const update = buildGraphPanCommitUpdate(latestGraphPan);
        api.onObjectUpdate(update.id, update.patch);
        setters.setGraphPan(null);
      } else if (finishMode === "solid3d_gesture" && data.solid3dGesture) {
        const update = buildSolid3dGestureCommitUpdate(
          data.solid3dGesture,
          latestSolid3dPreviewMetaById
        );
        if (update) {
          api.onObjectUpdate(update.id, update.patch);
        }
        setters.setSolid3dGesture(null);
        setters.setSolid3dPreviewMetaById((current) => {
          const next = { ...current };
          delete next[data.solid3dGesture!.object.id];
          return next;
        });
      } else if (finishMode === "solid3d_resize" && latestSolid3dResize) {
        const update = buildSolid3dResizeCommitUpdate(latestSolid3dResize);
        api.onObjectUpdate(update.id, update.patch);
        setters.setSolid3dResize(null);
      } else if (finishMode === "resizing" && latestResizing) {
        callbacks.finishResizing(latestResizing);
      } else if (finishMode === "moving" && latestMoving) {
        callbacks.finishMoving(latestMoving);
      }
      pointerIdRef.current = null;
      callbacks.releasePointerCapture(svg!, event.pointerId);
    },
    [
      api,
      callbacks,
      data,
      flushers,
      graphPanRef,
      movingRef,
      pointerIdRef,
      resizingRef,
      setters,
      shapeDraftRef,
      solid3dResizeRef,
      strokePointsRef,
      areaSelectionDraftRef,
      areaSelectionResizeRef,
      erasedStrokeIdsRef,
      eraserGestureIdRef,
      eraserLastAppliedPointRef,
      eraserLastPreviewPointRef,
    ]
  );

  return {
    startInteraction,
    continueInteraction,
    finishInteraction,
  };
};
