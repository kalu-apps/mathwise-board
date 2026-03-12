import {
  applyEraserPointToCollections,
  type ObjectEraserCut,
  type ObjectEraserPreviewPath,
} from "./eraser";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "./types";
import type { WorkbookSceneRect } from "./sceneVisibility";

type GetObjectRect = (object: WorkbookBoardObject) => {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkbookIncomingEraserPreview = {
  id: string;
  authorUserId: string;
  gestureId: string;
  layer: WorkbookLayer;
  page: number;
  radius: number;
  points: WorkbookPoint[];
};

export type RemoteEraserPreviewBaseState = {
  strokes: WorkbookStroke[];
  objects: WorkbookBoardObject[];
  page: number;
};

export type RemoteEraserPreviewState = {
  baseState: RemoteEraserPreviewBaseState;
  strokeFragmentsMap: Map<string, WorkbookPoint[][]>;
  objectCutsMap: Map<string, ObjectEraserCut[]>;
  objectPreviewPathsMap: Map<string, ObjectEraserPreviewPath[]>;
  processedPointsById: Map<string, number>;
};

export const createRemoteEraserPreviewState = (
  strokes: WorkbookStroke[],
  objects: WorkbookBoardObject[],
  page: number
): RemoteEraserPreviewState => ({
  baseState: {
    strokes,
    objects,
    page,
  },
  strokeFragmentsMap: new Map(),
  objectCutsMap: new Map(),
  objectPreviewPathsMap: new Map(),
  processedPointsById: new Map(),
});

export const snapshotRemoteEraserPreviewState = (
  state: RemoteEraserPreviewState
) => ({
  strokeFragments: Object.fromEntries(state.strokeFragmentsMap.entries()),
  objectCuts: Object.fromEntries(state.objectCutsMap.entries()),
  objectPaths: Object.fromEntries(state.objectPreviewPathsMap.entries()),
});

export const syncRemoteEraserPreviewState = (params: {
  state: RemoteEraserPreviewState;
  previews: WorkbookIncomingEraserPreview[];
  strokes: WorkbookStroke[];
  objects: WorkbookBoardObject[];
  page: number;
  getStrokeCandidatesInRect: (rect: WorkbookSceneRect) => WorkbookStroke[];
  getObjectCandidatesInRect: (rect: WorkbookSceneRect) => WorkbookBoardObject[];
  getObjectRect: GetObjectRect;
  isStrokeErasedByCircle: (
    stroke: WorkbookStroke,
    center: WorkbookPoint,
    radius: number
  ) => boolean;
  isObjectErasedByCircle: (
    object: WorkbookBoardObject,
    center: WorkbookPoint,
    radius: number
  ) => boolean;
}) => {
  const {
    state,
    previews,
    strokes,
    objects,
    page,
    getStrokeCandidatesInRect,
    getObjectCandidatesInRect,
    getObjectRect,
    isStrokeErasedByCircle,
    isObjectErasedByCircle,
  } = params;

  if (previews.length === 0) {
    return {
      state: createRemoteEraserPreviewState(strokes, objects, page),
      changed: true,
    };
  }

  const activeIds = new Set(previews.map((preview) => preview.id));
  const previousBaseState = state.baseState;
  const shouldRebuild =
    previousBaseState.strokes !== strokes ||
    previousBaseState.objects !== objects ||
    previousBaseState.page !== page ||
    state.processedPointsById.size !== activeIds.size ||
    Array.from(state.processedPointsById.keys()).some((id) => !activeIds.has(id));

  const nextState = shouldRebuild
    ? createRemoteEraserPreviewState(strokes, objects, page)
    : state;

  let changed = shouldRebuild;
  previews.forEach((preview) => {
    const processedPoints = shouldRebuild
      ? 0
      : nextState.processedPointsById.get(preview.id) ?? 0;
    if (preview.points.length <= processedPoints) {
      nextState.processedPointsById.set(preview.id, preview.points.length);
      return;
    }
    const nextPoints = preview.points.slice(processedPoints);
    nextPoints.forEach((point) => {
      const radius = Math.max(4, preview.radius);
      const queryRect: WorkbookSceneRect = {
        x: point.x - radius,
        y: point.y - radius,
        width: radius * 2,
        height: radius * 2,
      };
      applyEraserPointToCollections({
        center: point,
        radius,
        strokes: getStrokeCandidatesInRect(queryRect),
        objects: getObjectCandidatesInRect(queryRect),
        strokeFragmentsMap: nextState.strokeFragmentsMap,
        objectCutsMap: nextState.objectCutsMap,
        objectPreviewPathsMap: nextState.objectPreviewPathsMap,
        getObjectRect,
        isStrokeErasedByCircle,
        isObjectErasedByCircle,
      });
    });
    nextState.processedPointsById.set(preview.id, preview.points.length);
    if (nextPoints.length > 0) {
      changed = true;
    }
  });

  nextState.baseState = {
    strokes,
    objects,
    page,
  };

  return {
    state: nextState,
    changed,
  };
};
