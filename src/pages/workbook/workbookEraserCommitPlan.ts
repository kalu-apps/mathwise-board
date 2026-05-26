import { generateId } from "@/shared/lib/id";
import { mergeBoardObjectPatches } from "@/features/workbook/model/runtime";
import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookEraserCommitPayload } from "@/features/workbook/ui/WorkbookCanvas";

type WorkbookEraserCommitPlan = {
  events: WorkbookClientEventInput[];
  deleteBoardStrokeIds: Set<string>;
  deleteAnnotationStrokeIds: Set<string>;
  replacementBoardStrokes: WorkbookStroke[];
  replacementAnnotationStrokes: WorkbookStroke[];
  objectPatchById: Map<string, Partial<WorkbookBoardObject>>;
};

const buildStrokeDeleteEvent = (
  layer: WorkbookLayer,
  strokeId: string
): WorkbookClientEventInput => ({
  type: layer === "annotations" ? "annotations.stroke.delete" : "board.stroke.delete",
  payload: { strokeId },
});

const buildStrokeCreateEvent = (
  stroke: WorkbookStroke
): WorkbookClientEventInput => ({
  type: stroke.layer === "annotations" ? "annotations.stroke" : "board.stroke",
  payload: { stroke },
});

export const buildWorkbookEraserCommitPlan = (params: {
  payload: WorkbookEraserCommitPayload;
  currentBoardPage: number;
  nowIso: string;
  generateReplacementId?: () => string;
}): WorkbookEraserCommitPlan => {
  const generateReplacementId = params.generateReplacementId ?? generateId;
  const deleteBoardStrokeIds = new Set<string>();
  const deleteAnnotationStrokeIds = new Set<string>();
  const replacementBoardStrokes: WorkbookStroke[] = [];
  const replacementAnnotationStrokes: WorkbookStroke[] = [];
  const objectPatchById = new Map<string, Partial<WorkbookBoardObject>>();
  const events: WorkbookClientEventInput[] = [];
  const emittedDeleteKeys = new Set<string>();

  const appendDelete = (layer: WorkbookLayer, strokeId: string) => {
    const key = `${layer}:${strokeId}`;
    if (emittedDeleteKeys.has(key)) return;
    emittedDeleteKeys.add(key);
    if (layer === "annotations") {
      deleteAnnotationStrokeIds.add(strokeId);
    } else {
      deleteBoardStrokeIds.add(strokeId);
    }
    events.push(buildStrokeDeleteEvent(layer, strokeId));
  };

  params.payload.strokeReplacements.forEach((entry) => {
    const sourceStroke = entry.stroke;
    const sourceId =
      sourceStroke && typeof sourceStroke.id === "string"
        ? sourceStroke.id.trim()
        : "";
    const sourceLayer: WorkbookLayer =
      sourceStroke?.layer === "annotations" ? "annotations" : "board";
    if (!sourceId) return;
    appendDelete(sourceLayer, sourceId);

    const sanitizedFragments = entry.fragments
      .map((fragment) =>
        fragment.filter(
          (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
        )
      )
      .filter((fragment) => fragment.length > 0);
    if (sanitizedFragments.length === 0) return;

    const replacements = sanitizedFragments.map((points, index) => ({
      ...sourceStroke,
      id: entry.preserveSourceId && index === 0 ? sourceId : generateReplacementId(),
      points,
      createdAt: params.nowIso,
      page: Math.max(1, sourceStroke.page ?? params.currentBoardPage),
    }));
    replacements.forEach((stroke) => {
      events.push(buildStrokeCreateEvent(stroke));
    });
    if (sourceLayer === "annotations") {
      replacementAnnotationStrokes.push(...replacements);
    } else {
      replacementBoardStrokes.push(...replacements);
    }
  });

  params.payload.strokeDeletes.forEach((entry) => {
    const strokeId = typeof entry.strokeId === "string" ? entry.strokeId.trim() : "";
    if (!strokeId) return;
    appendDelete(entry.layer === "annotations" ? "annotations" : "board", strokeId);
  });

  params.payload.objectUpdates.forEach((entry) => {
    const objectId = typeof entry.objectId === "string" ? entry.objectId.trim() : "";
    const patch =
      entry.patch && typeof entry.patch === "object"
        ? (entry.patch as Partial<WorkbookBoardObject>)
        : null;
    if (!objectId || !patch) return;
    const currentPatch = objectPatchById.get(objectId) ?? {};
    objectPatchById.set(objectId, mergeBoardObjectPatches(currentPatch, patch));
  });

  objectPatchById.forEach((patch, objectId) => {
    events.push({
      type: "board.object.update",
      payload: { objectId, patch },
    });
  });

  return {
    events,
    deleteBoardStrokeIds,
    deleteAnnotationStrokeIds,
    replacementBoardStrokes,
    replacementAnnotationStrokes,
    objectPatchById,
  };
};
