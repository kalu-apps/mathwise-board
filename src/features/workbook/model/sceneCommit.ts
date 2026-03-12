import { buildGraphPanCommitPatch, type Solid3dGestureState } from "./sceneInteraction";
import {
  computeSolid3dResizePatch,
  type GraphPanState,
  type Solid3dResizeState,
  type WorkbookObjectPatchUpdate,
} from "./sceneRuntime";

type Solid3dPreviewMetaById = Record<string, Record<string, unknown>>;

export const buildGraphPanCommitUpdate = (
  graphPan: GraphPanState
): WorkbookObjectPatchUpdate => ({
  id: graphPan.object.id,
  patch: buildGraphPanCommitPatch(graphPan),
});

export const buildSolid3dGestureCommitUpdate = (
  gesture: Solid3dGestureState,
  previewMetaById: Solid3dPreviewMetaById
): WorkbookObjectPatchUpdate | null => {
  const previewMeta = previewMetaById[gesture.object.id];
  if (!previewMeta) return null;
  return {
    id: gesture.object.id,
    patch: { meta: previewMeta },
  };
};

export const buildSolid3dResizeCommitUpdate = (
  solid3dResize: Solid3dResizeState
): WorkbookObjectPatchUpdate => ({
  id: solid3dResize.object.id,
  patch: computeSolid3dResizePatch(solid3dResize),
});
