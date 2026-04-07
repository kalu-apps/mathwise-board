import type { WorkbookClientEventInput } from "@/features/workbook/model/events";
import { mergeBoardObjectWithPatch } from "@/features/workbook/model/runtime";
import { normalizeWorkbookObjectZOrder } from "@/features/workbook/model/objectZOrder";
import {
  normalizeDocumentAnnotationPayload,
  normalizeDocumentAssetPayload,
  normalizeObjectPayload,
  normalizeStrokePayload,
} from "@/features/workbook/model/scene";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import {
  buildBoardObjectDiffPatch,
  buildBoardSettingsDiffPatch,
  cloneSerializable,
} from "./WorkbookSessionPage.core";
import type {
  WorkbookHistoryEntry,
  WorkbookHistoryOperation,
} from "./WorkbookSessionPage.geometry";
import { normalizeSceneLayersForBoard } from "./WorkbookSessionPage.geometry";
import {
  buildBoardSettingsPatchSemanticPayload,
  buildObjectPatchSemanticPayload,
} from "./workbookHistoryPatchSemantics";

type BuildWorkbookHistoryEntryFromEventsArgs = {
  events: WorkbookClientEventInput[];
  currentBoardStrokes: WorkbookStroke[];
  currentAnnotationStrokes: WorkbookStroke[];
  currentObjects: WorkbookBoardObject[];
  currentConstraints: WorkbookConstraint[];
  currentBoardSettings: WorkbookBoardSettings;
  currentDocumentState: WorkbookDocumentState;
};

const toSafePage = (value: number | null | undefined) =>
  Math.max(1, Math.round(value || 1));

export const buildWorkbookHistoryEntryFromEvents = ({
  events,
  currentBoardStrokes,
  currentAnnotationStrokes,
  currentObjects,
  currentConstraints,
  currentBoardSettings,
  currentDocumentState,
}: BuildWorkbookHistoryEntryFromEventsArgs): WorkbookHistoryEntry | null => {
  const forward: WorkbookHistoryOperation[] = [];
  let inverse: WorkbookHistoryOperation[] = [];

  events.forEach((event) => {
    let eventForward: WorkbookHistoryOperation[] = [];
    let eventInverse: WorkbookHistoryOperation[] = [];

    if (event.type === "board.stroke" || event.type === "annotations.stroke") {
      const stroke = normalizeStrokePayload((event.payload as { stroke?: unknown })?.stroke);
      if (!stroke) return;
      eventForward = [
        {
          kind: "upsert_stroke",
          layer: stroke.layer,
          stroke: cloneSerializable(stroke),
          expectedCurrent: null,
        },
      ];
      eventInverse = [
        {
          kind: "remove_stroke",
          layer: stroke.layer,
          strokeId: stroke.id,
          expectedCurrent: cloneSerializable(stroke),
        },
      ];
    } else if (
      event.type === "board.stroke.delete" ||
      event.type === "annotations.stroke.delete"
    ) {
      const strokeId = (event.payload as { strokeId?: unknown })?.strokeId;
      const layer = event.type === "annotations.stroke.delete" ? "annotations" : "board";
      if (typeof strokeId !== "string" || !strokeId) return;
      const source = (layer === "annotations" ? currentAnnotationStrokes : currentBoardStrokes).find(
        (item) => item.id === strokeId
      );
      if (!source) return;
      eventForward = [
        {
          kind: "remove_stroke",
          layer,
          strokeId,
          expectedCurrent: cloneSerializable(source),
        },
      ];
      eventInverse = [
        {
          kind: "upsert_stroke",
          layer,
          stroke: cloneSerializable(source),
          expectedCurrent: null,
        },
      ];
    } else if (event.type === "board.object.create") {
      const object = normalizeObjectPayload((event.payload as { object?: unknown })?.object);
      if (!object) return;
      eventForward = [
        { kind: "upsert_object", object: cloneSerializable(object), expectedCurrent: null },
      ];
      eventInverse = [
        {
          kind: "remove_object",
          objectId: object.id,
          expectedCurrent: cloneSerializable(object),
        },
      ];
    } else if (event.type === "board.object.update") {
      const payload = event.payload as { objectId?: unknown; patch?: unknown };
      const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
      const patch =
        payload.patch && typeof payload.patch === "object"
          ? (payload.patch as Partial<WorkbookBoardObject>)
          : null;
      if (!objectId || !patch) return;
      const currentObject = currentObjects.find((item) => item.id === objectId);
      if (!currentObject) return;
      const nextObject = mergeBoardObjectWithPatch(currentObject, patch);
      const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
      const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
      if (!forwardPatch || !inversePatch) return;
      const forwardSemanticPayload = buildObjectPatchSemanticPayload(
        currentObject,
        nextObject,
        forwardPatch
      );
      const inverseSemanticPayload = buildObjectPatchSemanticPayload(
        nextObject,
        currentObject,
        inversePatch
      );
      eventForward = [
        {
          kind: "patch_object",
          objectId,
          patch: forwardPatch,
          expectedCurrent: cloneSerializable(currentObject),
          beforePatch: forwardSemanticPayload?.beforePatch,
          afterPatch: forwardSemanticPayload?.afterPatch,
        },
      ];
      eventInverse = [
        {
          kind: "patch_object",
          objectId,
          patch: inversePatch,
          expectedCurrent: cloneSerializable(nextObject),
          beforePatch: inverseSemanticPayload?.beforePatch,
          afterPatch: inverseSemanticPayload?.afterPatch,
        },
      ];
    } else if (event.type === "board.object.delete") {
      const objectId = (event.payload as { objectId?: unknown })?.objectId;
      if (typeof objectId !== "string" || !objectId) return;
      const currentObject = currentObjects.find((item) => item.id === objectId);
      if (!currentObject) return;
      const relatedConstraints = currentConstraints.filter(
        (constraint) =>
          constraint.sourceObjectId === objectId || constraint.targetObjectId === objectId
      );
      eventForward = [
        {
          kind: "remove_object",
          objectId,
          expectedCurrent: cloneSerializable(currentObject),
        },
      ];
      eventInverse = [
        { kind: "upsert_object", object: cloneSerializable(currentObject), expectedCurrent: null },
        ...relatedConstraints.map((constraint) => ({
          kind: "upsert_constraint" as const,
          constraint: cloneSerializable(constraint),
        })),
      ];
    } else if (event.type === "board.object.pin") {
      const payload = event.payload as { objectId?: unknown; pinned?: unknown };
      const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
      if (!objectId) return;
      const currentObject = currentObjects.find((item) => item.id === objectId);
      if (!currentObject) return;
      const nextObject = { ...currentObject, pinned: Boolean(payload.pinned) };
      const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
      const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
      if (!forwardPatch || !inversePatch) return;
      const forwardSemanticPayload = buildObjectPatchSemanticPayload(
        currentObject,
        nextObject,
        forwardPatch
      );
      const inverseSemanticPayload = buildObjectPatchSemanticPayload(
        nextObject,
        currentObject,
        inversePatch
      );
      eventForward = [
        {
          kind: "patch_object",
          objectId,
          patch: forwardPatch,
          expectedCurrent: cloneSerializable(currentObject),
          beforePatch: forwardSemanticPayload?.beforePatch,
          afterPatch: forwardSemanticPayload?.afterPatch,
        },
      ];
      eventInverse = [
        {
          kind: "patch_object",
          objectId,
          patch: inversePatch,
          expectedCurrent: cloneSerializable(nextObject),
          beforePatch: inverseSemanticPayload?.beforePatch,
          afterPatch: inverseSemanticPayload?.afterPatch,
        },
      ];
    } else if (event.type === "board.object.reorder") {
      const payload = event.payload as { objectId?: unknown; zOrder?: unknown };
      const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
      const zOrder = normalizeWorkbookObjectZOrder(payload.zOrder);
      if (!objectId || zOrder === undefined) return;
      const currentObject = currentObjects.find((item) => item.id === objectId);
      if (!currentObject) return;
      const nextObject = { ...currentObject, zOrder };
      const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
      const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
      if (!forwardPatch || !inversePatch) return;
      const forwardSemanticPayload = buildObjectPatchSemanticPayload(
        currentObject,
        nextObject,
        forwardPatch
      );
      const inverseSemanticPayload = buildObjectPatchSemanticPayload(
        nextObject,
        currentObject,
        inversePatch
      );
      eventForward = [
        {
          kind: "patch_object",
          objectId,
          patch: forwardPatch,
          expectedCurrent: cloneSerializable(currentObject),
          beforePatch: forwardSemanticPayload?.beforePatch,
          afterPatch: forwardSemanticPayload?.afterPatch,
        },
      ];
      eventInverse = [
        {
          kind: "patch_object",
          objectId,
          patch: inversePatch,
          expectedCurrent: cloneSerializable(nextObject),
          beforePatch: inverseSemanticPayload?.beforePatch,
          afterPatch: inverseSemanticPayload?.afterPatch,
        },
      ];
    } else if (event.type === "board.clear") {
      eventForward = [
        ...currentConstraints.map((constraint) => ({
          kind: "remove_constraint" as const,
          constraintId: constraint.id,
        })),
        ...currentObjects.map((object) => ({
          kind: "remove_object" as const,
          objectId: object.id,
          expectedCurrent: cloneSerializable(object),
        })),
        ...currentBoardStrokes.map((stroke) => ({
          kind: "remove_stroke" as const,
          layer: "board" as const,
          strokeId: stroke.id,
          expectedCurrent: cloneSerializable(stroke),
        })),
      ];
      eventInverse = [
        ...currentBoardStrokes.map((stroke) => ({
          kind: "upsert_stroke" as const,
          layer: "board" as const,
          stroke: cloneSerializable(stroke),
          expectedCurrent: null,
        })),
        ...currentObjects.map((object) => ({
          kind: "upsert_object" as const,
          object: cloneSerializable(object),
          expectedCurrent: null,
        })),
        ...currentConstraints.map((constraint) => ({
          kind: "upsert_constraint" as const,
          constraint: cloneSerializable(constraint),
        })),
      ];
    } else if (event.type === "annotations.clear") {
      eventForward = currentAnnotationStrokes.map((stroke) => ({
        kind: "remove_stroke" as const,
        layer: "annotations" as const,
        strokeId: stroke.id,
        expectedCurrent: cloneSerializable(stroke),
      }));
      eventInverse = currentAnnotationStrokes.map((stroke) => ({
        kind: "upsert_stroke" as const,
        layer: "annotations" as const,
        stroke: cloneSerializable(stroke),
        expectedCurrent: null,
      }));
    } else if (event.type === "geometry.constraint.add") {
      const constraint = (event.payload as { constraint?: unknown })?.constraint;
      if (!constraint || typeof constraint !== "object") return;
      const typed = constraint as WorkbookConstraint;
      if (!typed.id) return;
      eventForward = [{ kind: "upsert_constraint", constraint: cloneSerializable(typed) }];
      eventInverse = [{ kind: "remove_constraint", constraintId: typed.id }];
    } else if (event.type === "geometry.constraint.remove") {
      const constraintId = (event.payload as { constraintId?: unknown })?.constraintId;
      if (typeof constraintId !== "string" || !constraintId) return;
      const currentConstraint = currentConstraints.find((item) => item.id === constraintId);
      if (!currentConstraint) return;
      eventForward = [{ kind: "remove_constraint", constraintId }];
      eventInverse = [
        { kind: "upsert_constraint", constraint: cloneSerializable(currentConstraint) },
      ];
    } else if (event.type === "board.settings.update") {
      const incomingSettings = (event.payload as { boardSettings?: unknown })?.boardSettings;
      if (!incomingSettings || typeof incomingSettings !== "object") return;
      const merged = {
        ...currentBoardSettings,
        ...(incomingSettings as Partial<WorkbookBoardSettings>),
      };
      const normalizedLayers = normalizeSceneLayersForBoard(
        merged.sceneLayers,
        merged.activeSceneLayerId
      );
      const nextSettings: WorkbookBoardSettings = {
        ...merged,
        sceneLayers: normalizedLayers.sceneLayers,
        activeSceneLayerId: normalizedLayers.activeSceneLayerId,
      };
      const forwardPatch = buildBoardSettingsDiffPatch(currentBoardSettings, nextSettings);
      const inversePatch = buildBoardSettingsDiffPatch(nextSettings, currentBoardSettings);
      if (!forwardPatch || !inversePatch) return;
      const forwardSemanticPayload = buildBoardSettingsPatchSemanticPayload(
        currentBoardSettings,
        nextSettings,
        forwardPatch
      );
      const inverseSemanticPayload = buildBoardSettingsPatchSemanticPayload(
        nextSettings,
        currentBoardSettings,
        inversePatch
      );
      eventForward = [
        {
          kind: "patch_board_settings",
          patch: forwardPatch,
          beforePatch: forwardSemanticPayload?.beforePatch,
          afterPatch: forwardSemanticPayload?.afterPatch,
        },
      ];
      eventInverse = [
        {
          kind: "patch_board_settings",
          patch: inversePatch,
          beforePatch: inverseSemanticPayload?.beforePatch,
          afterPatch: inverseSemanticPayload?.afterPatch,
        },
      ];
    } else if (event.type === "document.asset.add") {
      const asset = normalizeDocumentAssetPayload((event.payload as { asset?: unknown })?.asset);
      if (!asset) return;
      eventForward = [{ kind: "upsert_document_asset", asset: cloneSerializable(asset) }];
      eventInverse = [{ kind: "remove_document_asset", assetId: asset.id }];
    } else if (event.type === "document.annotation.add") {
      const annotation = normalizeDocumentAnnotationPayload(
        (event.payload as { annotation?: unknown })?.annotation
      );
      if (!annotation) return;
      eventForward = [
        {
          kind: "upsert_document_annotation",
          annotation: cloneSerializable(annotation),
        },
      ];
      eventInverse = [{ kind: "remove_document_annotation", annotationId: annotation.id }];
    } else if (event.type === "document.annotation.clear") {
      eventForward = currentDocumentState.annotations.map((annotation) => ({
        kind: "remove_document_annotation" as const,
        annotationId: annotation.id,
      }));
      eventInverse = currentDocumentState.annotations.map((annotation) => ({
        kind: "upsert_document_annotation" as const,
        annotation: cloneSerializable(annotation),
      }));
    }

    if (eventForward.length === 0 || eventInverse.length === 0) return;
    forward.push(...eventForward);
    inverse = [...eventInverse, ...inverse];
  });

  if (forward.length === 0 || inverse.length === 0) {
    return null;
  }
  return {
    forward,
    inverse,
    page: toSafePage(currentBoardSettings.currentPage),
    createdAt: new Date().toISOString(),
  } satisfies WorkbookHistoryEntry;
};
