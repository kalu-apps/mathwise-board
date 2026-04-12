import {
  isHistoryTrackedWorkbookEventType,
  type WorkbookClientEventInput,
} from "../../../../../src/features/workbook/model/events";
import { normalizeWorkbookObjectZOrder } from "../../../../../src/features/workbook/model/objectZOrder";
import {
  normalizeDocumentAnnotationPayload,
  normalizeDocumentAssetPayload,
  normalizeObjectPayload,
  normalizeScenePayload,
  normalizeStrokePayload,
} from "../../../../../src/features/workbook/model/scene";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookEvent,
  WorkbookLayer,
  WorkbookStroke,
} from "../../../../../src/features/workbook/model/types";

type WorkbookHistoryOperation =
  | {
      kind: "upsert_stroke";
      layer: WorkbookLayer;
      stroke: WorkbookStroke;
      expectedCurrent?: WorkbookStroke | null;
    }
  | {
      kind: "remove_stroke";
      layer: WorkbookLayer;
      strokeId: string;
      expectedCurrent?: WorkbookStroke | null;
    }
  | {
      kind: "upsert_object";
      object: WorkbookBoardObject;
      expectedCurrent?: WorkbookBoardObject | null;
    }
  | {
      kind: "patch_object";
      objectId: string;
      patch: Partial<WorkbookBoardObject>;
      expectedCurrent?: WorkbookBoardObject | null;
    }
  | {
      kind: "remove_object";
      objectId: string;
      expectedCurrent?: WorkbookBoardObject | null;
    }
  | { kind: "upsert_constraint"; constraint: WorkbookConstraint }
  | { kind: "remove_constraint"; constraintId: string }
  | { kind: "patch_board_settings"; patch: Partial<WorkbookBoardSettings> }
  | { kind: "upsert_document_asset"; asset: WorkbookDocumentState["assets"][number] }
  | { kind: "remove_document_asset"; assetId: string }
  | {
      kind: "upsert_document_annotation";
      annotation: WorkbookDocumentState["annotations"][number];
    }
  | { kind: "remove_document_annotation"; annotationId: string };

type WorkbookHistoryEntry = {
  forward: WorkbookHistoryOperation[];
  inverse: WorkbookHistoryOperation[];
  page: number;
  createdAt: string;
};

type WorkbookServerSceneState = {
  boardStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  annotationStrokes: WorkbookStroke[];
  boardSettings: WorkbookBoardSettings;
  documentState: WorkbookDocumentState;
};

type WorkbookServerHistoryState = {
  scene: WorkbookServerSceneState;
  undoByPage: Map<number, WorkbookHistoryEntry[]>;
  redoByPage: Map<number, WorkbookHistoryEntry[]>;
};

type WorkbookSnapshotStoreLike = {
  read: (params: {
    sessionId: string;
    layer: "board" | "annotations";
  }) => Promise<{ payload: unknown; version: number } | null>;
};

type WorkbookEventStoreLike = {
  read: (params: {
    sessionId: string;
    afterSeq: number;
    limit?: number;
  }) => Promise<{ events: WorkbookEvent[]; latestSeq: number }>;
};

type ResolveWorkbookUndoRedoEventsParams = {
  sessionId: string;
  events: WorkbookClientEventInput[];
  workbookSnapshotStore: WorkbookSnapshotStoreLike;
  workbookEventStore: WorkbookEventStoreLike;
  eventLimit: number;
};

type WorkbookHistorySourceEvent = WorkbookClientEventInput | WorkbookEvent;

const MAX_HISTORY_ENTRIES_PER_PAGE = 80;

const cloneSerializable = <T,>(value: T): T => structuredClone(value);

const toSafePage = (value: number | null | undefined) =>
  Math.max(1, Math.round(value || 1));

const isPlainSerializableObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const areSerializableValuesStructurallyEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null) return left === right;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (!areSerializableValuesStructurallyEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }
  if (!isPlainSerializableObject(left) || !isPlainSerializableObject(right)) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (leftKey !== rightKey) return false;
    if (!areSerializableValuesStructurallyEqual(left[leftKey], right[rightKey])) {
      return false;
    }
  }
  return true;
};

const normalizeMetaRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const buildBoardObjectDiffPatch = (
  previous: WorkbookBoardObject,
  next: WorkbookBoardObject
): Partial<WorkbookBoardObject> | null => {
  const patch: Partial<WorkbookBoardObject> = {};
  const patchRecord = patch as Record<string, unknown>;
  const mutableKeys: Array<keyof WorkbookBoardObject> = [
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "color",
    "fill",
    "strokeWidth",
    "opacity",
    "points",
    "text",
    "fontSize",
    "imageUrl",
    "imageName",
    "sides",
    "page",
    "zOrder",
    "pinned",
    "locked",
  ];
  mutableKeys.forEach((key) => {
    if (!areSerializableValuesStructurallyEqual(previous[key], next[key])) {
      patchRecord[key] = cloneSerializable(next[key]);
    }
  });
  const previousMeta = normalizeMetaRecord(previous.meta);
  const nextMeta = normalizeMetaRecord(next.meta);
  const changedMetaKeys = Array.from(
    new Set([...Object.keys(previousMeta), ...Object.keys(nextMeta)])
  ).filter((key) => !areSerializableValuesStructurallyEqual(previousMeta[key], nextMeta[key]));
  if (changedMetaKeys.length > 0) {
    patch.meta = changedMetaKeys.reduce<Record<string, unknown>>((acc, key) => {
      const hasNextValue = Object.prototype.hasOwnProperty.call(nextMeta, key);
      acc[key] = hasNextValue ? cloneSerializable(nextMeta[key]) : null;
      return acc;
    }, {});
  }
  return Object.keys(patch).length > 0 ? patch : null;
};

const buildBoardSettingsDiffPatch = (
  previous: WorkbookBoardSettings,
  next: WorkbookBoardSettings
): Partial<WorkbookBoardSettings> | null => {
  const patch: Partial<WorkbookBoardSettings> = {};
  const patchRecord = patch as Record<string, unknown>;
  (Object.keys(next) as Array<keyof WorkbookBoardSettings>).forEach((key) => {
    if (!areSerializableValuesStructurallyEqual(previous[key], next[key])) {
      patchRecord[key] = cloneSerializable(next[key]);
    }
  });
  return Object.keys(patch).length > 0 ? patch : null;
};

const mergeBoardObjectWithPatch = (
  current: WorkbookBoardObject,
  patch: Partial<WorkbookBoardObject>
): WorkbookBoardObject => {
  const hasMetaPatch = Object.prototype.hasOwnProperty.call(patch, "meta");
  if (!hasMetaPatch) {
    return {
      ...current,
      ...patch,
    };
  }
  const patchMeta = patch.meta;
  if (!patchMeta || typeof patchMeta !== "object" || Array.isArray(patchMeta)) {
    return {
      ...current,
      ...patch,
      meta: patchMeta,
    };
  }
  const currentMeta =
    current.meta && typeof current.meta === "object" && !Array.isArray(current.meta)
      ? (current.meta as Record<string, unknown>)
      : {};
  const nextMeta = { ...currentMeta };
  Object.entries(patchMeta as Record<string, unknown>).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      delete nextMeta[key];
      return;
    }
    nextMeta[key] = value;
  });
  return {
    ...current,
    ...patch,
    meta: nextMeta,
  };
};

const resolveEntryPage = (
  fallbackPage: number,
  source?: {
    eventPage?: number | null;
    objectPage?: number | null;
    strokePage?: number | null;
  }
) =>
  toSafePage(
    source?.eventPage ?? source?.objectPage ?? source?.strokePage ?? fallbackPage
  );

const createInitialHistoryState = (
  boardPayload: unknown,
  annotationPayload: unknown
): WorkbookServerHistoryState => {
  const normalizedBoard = normalizeScenePayload(boardPayload ?? {});
  const normalizedAnnotations = normalizeScenePayload(annotationPayload ?? {});
  const boardStrokes = normalizedBoard.strokes.filter((stroke) => stroke.layer === "board");
  const annotationStrokes =
    normalizedAnnotations.strokes.filter((stroke) => stroke.layer === "annotations").length > 0
      ? normalizedAnnotations.strokes.filter((stroke) => stroke.layer === "annotations")
      : normalizedBoard.strokes.filter((stroke) => stroke.layer === "annotations");
  return {
    scene: {
      boardStrokes,
      boardObjects: normalizedBoard.objects,
      constraints: normalizedBoard.constraints,
      annotationStrokes,
      boardSettings: normalizedBoard.boardSettings,
      documentState: normalizedBoard.document,
    },
    undoByPage: new Map<number, WorkbookHistoryEntry[]>(),
    redoByPage: new Map<number, WorkbookHistoryEntry[]>(),
  };
};

const buildHistoryEntryFromEvent = (
  state: WorkbookServerSceneState,
  event: WorkbookHistorySourceEvent
): WorkbookHistoryEntry | null => {
  const fallbackPage = toSafePage(state.boardSettings.currentPage);
  const forward: WorkbookHistoryOperation[] = [];
  let inverse: WorkbookHistoryOperation[] = [];
  let entryPage = fallbackPage;

  if (event.type === "board.stroke" || event.type === "annotations.stroke") {
    const stroke = normalizeStrokePayload((event.payload as { stroke?: unknown })?.stroke);
    if (!stroke) return null;
    entryPage = resolveEntryPage(fallbackPage, { strokePage: stroke.page ?? 1 });
    forward.push({
      kind: "upsert_stroke",
      layer: stroke.layer,
      stroke: cloneSerializable(stroke),
      expectedCurrent: null,
    });
    inverse = [
      {
        kind: "remove_stroke",
        layer: stroke.layer,
        strokeId: stroke.id,
        expectedCurrent: cloneSerializable(stroke),
      },
    ];
  } else if (event.type === "board.stroke.delete" || event.type === "annotations.stroke.delete") {
    const strokeId = (event.payload as { strokeId?: unknown })?.strokeId;
    const layer = event.type === "annotations.stroke.delete" ? "annotations" : "board";
    if (typeof strokeId !== "string" || !strokeId) return null;
    const source = (layer === "annotations" ? state.annotationStrokes : state.boardStrokes).find(
      (item) => item.id === strokeId
    );
    if (!source) return null;
    entryPage = resolveEntryPage(fallbackPage, { strokePage: source.page ?? 1 });
    forward.push({
      kind: "remove_stroke",
      layer,
      strokeId,
      expectedCurrent: cloneSerializable(source),
    });
    inverse = [
      {
        kind: "upsert_stroke",
        layer,
        stroke: cloneSerializable(source),
        expectedCurrent: null,
      },
    ];
  } else if (event.type === "board.object.create") {
    const object = normalizeObjectPayload((event.payload as { object?: unknown })?.object);
    if (!object) return null;
    entryPage = resolveEntryPage(fallbackPage, { objectPage: object.page ?? 1 });
    forward.push({
      kind: "upsert_object",
      object: cloneSerializable(object),
      expectedCurrent: null,
    });
    inverse = [
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
    if (!objectId || !patch) return null;
    const currentObject = state.boardObjects.find((item) => item.id === objectId);
    if (!currentObject) return null;
    const nextObject = mergeBoardObjectWithPatch(currentObject, patch);
    const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
    const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
    if (!forwardPatch || !inversePatch) return null;
    entryPage = resolveEntryPage(fallbackPage, { objectPage: nextObject.page ?? currentObject.page ?? 1 });
    forward.push({
      kind: "patch_object",
      objectId,
      patch: forwardPatch,
      expectedCurrent: cloneSerializable(currentObject),
    });
    inverse = [
      {
        kind: "patch_object",
        objectId,
        patch: inversePatch,
        expectedCurrent: cloneSerializable(nextObject),
      },
    ];
  } else if (event.type === "board.object.delete") {
    const objectId = (event.payload as { objectId?: unknown })?.objectId;
    if (typeof objectId !== "string" || !objectId) return null;
    const currentObject = state.boardObjects.find((item) => item.id === objectId);
    if (!currentObject) return null;
    const relatedConstraints = state.constraints.filter(
      (constraint) =>
        constraint.sourceObjectId === objectId || constraint.targetObjectId === objectId
    );
    entryPage = resolveEntryPage(fallbackPage, { objectPage: currentObject.page ?? 1 });
    forward.push({
      kind: "remove_object",
      objectId,
      expectedCurrent: cloneSerializable(currentObject),
    });
    inverse = [
      {
        kind: "upsert_object",
        object: cloneSerializable(currentObject),
        expectedCurrent: null,
      },
      ...relatedConstraints.map((constraint) => ({
        kind: "upsert_constraint" as const,
        constraint: cloneSerializable(constraint),
      })),
    ];
  } else if (event.type === "board.object.pin") {
    const payload = event.payload as { objectId?: unknown; pinned?: unknown };
    const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
    if (!objectId) return null;
    const currentObject = state.boardObjects.find((item) => item.id === objectId);
    if (!currentObject) return null;
    const nextObject = { ...currentObject, pinned: Boolean(payload.pinned) };
    const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
    const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
    if (!forwardPatch || !inversePatch) return null;
    entryPage = resolveEntryPage(fallbackPage, { objectPage: currentObject.page ?? 1 });
    forward.push({
      kind: "patch_object",
      objectId,
      patch: forwardPatch,
      expectedCurrent: cloneSerializable(currentObject),
    });
    inverse = [
      {
        kind: "patch_object",
        objectId,
        patch: inversePatch,
        expectedCurrent: cloneSerializable(nextObject),
      },
    ];
  } else if (event.type === "board.object.reorder") {
    const payload = event.payload as { objectId?: unknown; zOrder?: unknown };
    const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
    const zOrder = normalizeWorkbookObjectZOrder(payload.zOrder);
    if (!objectId || zOrder === undefined) return null;
    const currentObject = state.boardObjects.find((item) => item.id === objectId);
    if (!currentObject) return null;
    const nextObject = { ...currentObject, zOrder };
    const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
    const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
    if (!forwardPatch || !inversePatch) return null;
    entryPage = resolveEntryPage(fallbackPage, { objectPage: currentObject.page ?? 1 });
    forward.push({
      kind: "patch_object",
      objectId,
      patch: forwardPatch,
      expectedCurrent: cloneSerializable(currentObject),
    });
    inverse = [
      {
        kind: "patch_object",
        objectId,
        patch: inversePatch,
        expectedCurrent: cloneSerializable(nextObject),
      },
    ];
  } else if (event.type === "board.clear") {
    const payload = event.payload as { page?: unknown };
    const targetPage =
      typeof payload.page === "number" && Number.isFinite(payload.page)
        ? toSafePage(payload.page)
        : null;
    if (targetPage === null) {
      entryPage = fallbackPage;
      forward.push(
        ...state.constraints.map((constraint) => ({
          kind: "remove_constraint" as const,
          constraintId: constraint.id,
        })),
        ...state.boardObjects.map((object) => ({
          kind: "remove_object" as const,
          objectId: object.id,
          expectedCurrent: cloneSerializable(object),
        })),
        ...state.boardStrokes.map((stroke) => ({
          kind: "remove_stroke" as const,
          layer: "board" as const,
          strokeId: stroke.id,
          expectedCurrent: cloneSerializable(stroke),
        }))
      );
      inverse = [
        ...state.boardStrokes.map((stroke) => ({
          kind: "upsert_stroke" as const,
          layer: "board" as const,
          stroke: cloneSerializable(stroke),
          expectedCurrent: null,
        })),
        ...state.boardObjects.map((object) => ({
          kind: "upsert_object" as const,
          object: cloneSerializable(object),
          expectedCurrent: null,
        })),
        ...state.constraints.map((constraint) => ({
          kind: "upsert_constraint" as const,
          constraint: cloneSerializable(constraint),
        })),
      ];
    } else {
      const pageObjectIds = new Set(
        state.boardObjects
          .filter((object) => toSafePage(object.page) === targetPage)
          .map((object) => object.id)
      );
      const pageObjects = state.boardObjects.filter((object) => pageObjectIds.has(object.id));
      const pageConstraints = state.constraints.filter(
        (constraint) =>
          pageObjectIds.has(constraint.sourceObjectId) ||
          pageObjectIds.has(constraint.targetObjectId)
      );
      const pageBoardStrokes = state.boardStrokes.filter(
        (stroke) => toSafePage(stroke.page) === targetPage
      );
      const pageAnnotationStrokes = state.annotationStrokes.filter(
        (stroke) => toSafePage(stroke.page) === targetPage
      );
      entryPage = targetPage;
      forward.push(
        ...pageConstraints.map((constraint) => ({
          kind: "remove_constraint" as const,
          constraintId: constraint.id,
        })),
        ...pageObjects.map((object) => ({
          kind: "remove_object" as const,
          objectId: object.id,
          expectedCurrent: cloneSerializable(object),
        })),
        ...pageBoardStrokes.map((stroke) => ({
          kind: "remove_stroke" as const,
          layer: "board" as const,
          strokeId: stroke.id,
          expectedCurrent: cloneSerializable(stroke),
        })),
        ...pageAnnotationStrokes.map((stroke) => ({
          kind: "remove_stroke" as const,
          layer: "annotations" as const,
          strokeId: stroke.id,
          expectedCurrent: cloneSerializable(stroke),
        }))
      );
      inverse = [
        ...pageBoardStrokes.map((stroke) => ({
          kind: "upsert_stroke" as const,
          layer: "board" as const,
          stroke: cloneSerializable(stroke),
          expectedCurrent: null,
        })),
        ...pageAnnotationStrokes.map((stroke) => ({
          kind: "upsert_stroke" as const,
          layer: "annotations" as const,
          stroke: cloneSerializable(stroke),
          expectedCurrent: null,
        })),
        ...pageObjects.map((object) => ({
          kind: "upsert_object" as const,
          object: cloneSerializable(object),
          expectedCurrent: null,
        })),
        ...pageConstraints.map((constraint) => ({
          kind: "upsert_constraint" as const,
          constraint: cloneSerializable(constraint),
        })),
      ];
    }
  } else if (event.type === "annotations.clear") {
    entryPage = fallbackPage;
    forward.push(
      ...state.annotationStrokes.map((stroke) => ({
        kind: "remove_stroke" as const,
        layer: "annotations" as const,
        strokeId: stroke.id,
        expectedCurrent: cloneSerializable(stroke),
      }))
    );
    inverse = [
      ...state.annotationStrokes.map((stroke) => ({
        kind: "upsert_stroke" as const,
        layer: "annotations" as const,
        stroke: cloneSerializable(stroke),
        expectedCurrent: null,
      })),
    ];
  } else if (event.type === "geometry.constraint.add") {
    const constraint = (event.payload as { constraint?: unknown })?.constraint;
    if (!constraint || typeof constraint !== "object") return null;
    const typed = constraint as WorkbookConstraint;
    if (typeof typed.id !== "string" || !typed.id) return null;
    const sourceObject = state.boardObjects.find((item) => item.id === typed.sourceObjectId);
    const targetObject = state.boardObjects.find((item) => item.id === typed.targetObjectId);
    entryPage = resolveEntryPage(fallbackPage, {
      objectPage: sourceObject?.page ?? targetObject?.page ?? fallbackPage,
    });
    forward.push({
      kind: "upsert_constraint",
      constraint: cloneSerializable(typed),
    });
    inverse = [{ kind: "remove_constraint", constraintId: typed.id }];
  } else if (event.type === "geometry.constraint.remove") {
    const constraintId = (event.payload as { constraintId?: unknown })?.constraintId;
    if (typeof constraintId !== "string" || !constraintId) return null;
    const currentConstraint = state.constraints.find((item) => item.id === constraintId);
    if (!currentConstraint) return null;
    const sourceObject = state.boardObjects.find(
      (item) => item.id === currentConstraint.sourceObjectId
    );
    const targetObject = state.boardObjects.find(
      (item) => item.id === currentConstraint.targetObjectId
    );
    entryPage = resolveEntryPage(fallbackPage, {
      objectPage: sourceObject?.page ?? targetObject?.page ?? fallbackPage,
    });
    forward.push({ kind: "remove_constraint", constraintId });
    inverse = [
      { kind: "upsert_constraint", constraint: cloneSerializable(currentConstraint) },
    ];
  } else if (event.type === "board.settings.update") {
    const incomingSettings = (event.payload as { boardSettings?: unknown })?.boardSettings;
    if (!incomingSettings || typeof incomingSettings !== "object") return null;
    const merged = {
      ...state.boardSettings,
      ...(incomingSettings as Partial<WorkbookBoardSettings>),
    };
    const normalizedSettings = normalizeScenePayload({
      boardSettings: merged,
    }).boardSettings;
    const forwardPatch = buildBoardSettingsDiffPatch(state.boardSettings, normalizedSettings);
    const inversePatch = buildBoardSettingsDiffPatch(normalizedSettings, state.boardSettings);
    if (!forwardPatch || !inversePatch) return null;
    const targetPage =
      typeof normalizedSettings.currentPage === "number"
        ? normalizedSettings.currentPage
        : state.boardSettings.currentPage;
    entryPage = resolveEntryPage(fallbackPage, { eventPage: targetPage });
    forward.push({ kind: "patch_board_settings", patch: forwardPatch });
    inverse = [{ kind: "patch_board_settings", patch: inversePatch }];
  } else if (event.type === "document.asset.add") {
    const asset = normalizeDocumentAssetPayload((event.payload as { asset?: unknown })?.asset);
    if (!asset) return null;
    entryPage = fallbackPage;
    forward.push({
      kind: "upsert_document_asset",
      asset: cloneSerializable(asset),
    });
    inverse = [{ kind: "remove_document_asset", assetId: asset.id }];
  } else if (event.type === "document.annotation.add") {
    const annotation = normalizeDocumentAnnotationPayload(
      (event.payload as { annotation?: unknown })?.annotation
    );
    if (!annotation) return null;
    entryPage = resolveEntryPage(fallbackPage, { eventPage: annotation.page });
    forward.push({
      kind: "upsert_document_annotation",
      annotation: cloneSerializable(annotation),
    });
    inverse = [{ kind: "remove_document_annotation", annotationId: annotation.id }];
  } else if (event.type === "document.annotation.clear") {
    entryPage = fallbackPage;
    forward.push(
      ...state.documentState.annotations.map((annotation) => ({
        kind: "remove_document_annotation" as const,
        annotationId: annotation.id,
      }))
    );
    inverse = [
      ...state.documentState.annotations.map((annotation) => ({
        kind: "upsert_document_annotation" as const,
        annotation: cloneSerializable(annotation),
      })),
    ];
  }

  if (forward.length === 0 || inverse.length === 0) return null;
  return {
    forward,
    inverse,
    page: toSafePage(entryPage),
    createdAt: new Date().toISOString(),
  };
};

const buildHistoryEntryFromEventBatch = (
  state: WorkbookServerSceneState,
  events: WorkbookHistorySourceEvent[]
): WorkbookHistoryEntry | null => {
  if (events.length === 0) return null;
  const forward: WorkbookHistoryOperation[] = [];
  let inverse: WorkbookHistoryOperation[] = [];
  const eventPages: number[] = [];
  const fallbackPage = toSafePage(state.boardSettings.currentPage);

  events.forEach((event) => {
    const entry = buildHistoryEntryFromEvent(state, event);
    if (!entry) return;
    forward.push(...entry.forward);
    inverse = [...entry.inverse, ...inverse];
    eventPages.push(toSafePage(entry.page));
  });

  if (forward.length === 0 || inverse.length === 0) {
    return null;
  }
  const entryPage =
    eventPages.length > 0 && eventPages.every((page) => page === eventPages[0])
      ? eventPages[0]
      : fallbackPage;

  return {
    forward,
    inverse,
    page: entryPage,
    createdAt: new Date().toISOString(),
  };
};

const applyHistoryOperations = (
  state: WorkbookServerSceneState,
  operations: WorkbookHistoryOperation[],
  options?: { ignoreExpectedCurrent?: boolean }
) => {
  const ignoreExpectedCurrent = options?.ignoreExpectedCurrent === true;
  let appliedOperationsCount = 0;

  const isExpectedStateMatch = <T,>(current: T | undefined, expected: T | null | undefined) => {
    if (expected === undefined) return true;
    if (expected === null) return current === undefined;
    if (current === undefined) return false;
    return areSerializableValuesStructurallyEqual(current, expected);
  };

  operations.forEach((operation) => {
    if (operation.kind === "upsert_stroke") {
      const collection =
        operation.layer === "annotations" ? state.annotationStrokes : state.boardStrokes;
      const currentStroke = collection.find((item) => item.id === operation.stroke.id);
      if (
        !ignoreExpectedCurrent &&
        !isExpectedStateMatch(currentStroke, operation.expectedCurrent)
      ) {
        return;
      }
      const nextStroke = cloneSerializable(operation.stroke);
      if (!currentStroke) {
        collection.push(nextStroke);
      } else {
        const index = collection.findIndex((item) => item.id === operation.stroke.id);
        if (index >= 0) {
          collection[index] = nextStroke;
        }
      }
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "remove_stroke") {
      const collection =
        operation.layer === "annotations" ? state.annotationStrokes : state.boardStrokes;
      const currentStroke = collection.find((item) => item.id === operation.strokeId);
      if (
        !ignoreExpectedCurrent &&
        !isExpectedStateMatch(currentStroke, operation.expectedCurrent)
      ) {
        return;
      }
      if (!currentStroke) return;
      const index = collection.findIndex((item) => item.id === operation.strokeId);
      if (index >= 0) {
        collection.splice(index, 1);
        appliedOperationsCount += 1;
      }
      return;
    }
    if (operation.kind === "upsert_object") {
      const currentObject = state.boardObjects.find((item) => item.id === operation.object.id);
      if (
        !ignoreExpectedCurrent &&
        !isExpectedStateMatch(currentObject, operation.expectedCurrent)
      ) {
        return;
      }
      const nextObject = cloneSerializable(operation.object);
      if (!currentObject) {
        state.boardObjects.push(nextObject);
      } else {
        const index = state.boardObjects.findIndex((item) => item.id === operation.object.id);
        if (index >= 0) {
          state.boardObjects[index] = nextObject;
        }
      }
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "patch_object") {
      const index = state.boardObjects.findIndex((item) => item.id === operation.objectId);
      if (index < 0) return;
      const currentObject = state.boardObjects[index];
      if (
        !ignoreExpectedCurrent &&
        !isExpectedStateMatch(currentObject, operation.expectedCurrent)
      ) {
        return;
      }
      state.boardObjects[index] = mergeBoardObjectWithPatch(
        currentObject,
        cloneSerializable(operation.patch)
      );
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "remove_object") {
      const index = state.boardObjects.findIndex((item) => item.id === operation.objectId);
      if (index < 0) return;
      const currentObject = state.boardObjects[index];
      if (
        !ignoreExpectedCurrent &&
        !isExpectedStateMatch(currentObject, operation.expectedCurrent)
      ) {
        return;
      }
      state.boardObjects.splice(index, 1);
      state.constraints = state.constraints.filter(
        (constraint) =>
          constraint.sourceObjectId !== operation.objectId &&
          constraint.targetObjectId !== operation.objectId
      );
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "upsert_constraint") {
      const nextConstraint = cloneSerializable(operation.constraint);
      const index = state.constraints.findIndex((item) => item.id === nextConstraint.id);
      if (index < 0) {
        state.constraints.push(nextConstraint);
      } else {
        state.constraints[index] = nextConstraint;
      }
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "remove_constraint") {
      const index = state.constraints.findIndex((item) => item.id === operation.constraintId);
      if (index < 0) return;
      state.constraints.splice(index, 1);
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "patch_board_settings") {
      state.boardSettings = {
        ...state.boardSettings,
        ...cloneSerializable(operation.patch),
      };
      state.boardSettings.currentPage = toSafePage(state.boardSettings.currentPage);
      state.boardObjects = state.boardObjects.map((object) => ({
        ...object,
        page: toSafePage(object.page),
      }));
      state.boardStrokes = state.boardStrokes.map((stroke) => ({
        ...stroke,
        page: toSafePage(stroke.page),
      }));
      state.annotationStrokes = state.annotationStrokes.map((stroke) => ({
        ...stroke,
        page: toSafePage(stroke.page),
      }));
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "upsert_document_asset") {
      const nextAsset = cloneSerializable(operation.asset);
      const index = state.documentState.assets.findIndex((item) => item.id === nextAsset.id);
      if (index < 0) {
        state.documentState.assets = [...state.documentState.assets, nextAsset];
      } else {
        state.documentState.assets = state.documentState.assets.map((item) =>
          item.id === nextAsset.id ? nextAsset : item
        );
      }
      if (!state.documentState.activeAssetId) {
        state.documentState.activeAssetId = nextAsset.id;
      }
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "remove_document_asset") {
      const nextAssets = state.documentState.assets.filter(
        (item) => item.id !== operation.assetId
      );
      if (nextAssets.length === state.documentState.assets.length) return;
      state.documentState.assets = nextAssets;
      if (state.documentState.activeAssetId === operation.assetId) {
        state.documentState.activeAssetId = nextAssets[0]?.id ?? null;
      }
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "upsert_document_annotation") {
      const nextAnnotation = cloneSerializable(operation.annotation);
      const index = state.documentState.annotations.findIndex(
        (item) => item.id === nextAnnotation.id
      );
      if (index < 0) {
        state.documentState.annotations = [
          ...state.documentState.annotations,
          nextAnnotation,
        ];
      } else {
        state.documentState.annotations = state.documentState.annotations.map((item) =>
          item.id === nextAnnotation.id ? nextAnnotation : item
        );
      }
      appliedOperationsCount += 1;
      return;
    }
    if (operation.kind === "remove_document_annotation") {
      const nextAnnotations = state.documentState.annotations.filter(
        (item) => item.id !== operation.annotationId
      );
      if (nextAnnotations.length === state.documentState.annotations.length) return;
      state.documentState.annotations = nextAnnotations;
      appliedOperationsCount += 1;
    }
  });

  return appliedOperationsCount;
};

const pushUndoEntry = (state: WorkbookServerHistoryState, entry: WorkbookHistoryEntry) => {
  const page = toSafePage(entry.page);
  const undoStack = state.undoByPage.get(page) ?? [];
  undoStack.push(entry);
  state.undoByPage.set(page, undoStack.slice(-MAX_HISTORY_ENTRIES_PER_PAGE));
  state.redoByPage.set(page, []);
};

const popLastHistoryEntryForPage = (
  map: Map<number, WorkbookHistoryEntry[]>,
  page: number
) => {
  const stack = map.get(page);
  if (!stack || stack.length === 0) return null;
  const entry = stack.pop() ?? null;
  map.set(page, stack);
  return entry;
};

const applyUndoRedoEventToHistoryState = (
  state: WorkbookServerHistoryState,
  event: WorkbookHistorySourceEvent
) => {
  if (event.type !== "board.undo" && event.type !== "board.redo") return;
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as { operations?: unknown; page?: unknown })
      : {};
  const targetPage =
    typeof payload.page === "number" && Number.isFinite(payload.page)
      ? toSafePage(payload.page)
      : toSafePage(state.scene.boardSettings.currentPage);
  if (event.type === "board.undo") {
    const entry = popLastHistoryEntryForPage(state.undoByPage, targetPage);
    if (entry) {
      const redoStack = state.redoByPage.get(targetPage) ?? [];
      redoStack.push(entry);
      state.redoByPage.set(targetPage, redoStack.slice(-MAX_HISTORY_ENTRIES_PER_PAGE));
    }
    const operations = entry
      ? entry.inverse
      : Array.isArray(payload.operations)
        ? (payload.operations as WorkbookHistoryOperation[])
        : [];
    if (operations.length > 0) {
      applyHistoryOperations(state.scene, operations, {
        ignoreExpectedCurrent: true,
      });
    }
  } else {
    const entry = popLastHistoryEntryForPage(state.redoByPage, targetPage);
    if (entry) {
      const undoStack = state.undoByPage.get(targetPage) ?? [];
      undoStack.push(entry);
      state.undoByPage.set(targetPage, undoStack.slice(-MAX_HISTORY_ENTRIES_PER_PAGE));
    }
    const operations = entry
      ? entry.forward
      : Array.isArray(payload.operations)
        ? (payload.operations as WorkbookHistoryOperation[])
        : [];
    if (operations.length > 0) {
      applyHistoryOperations(state.scene, operations, {
        ignoreExpectedCurrent: true,
      });
    }
  }
};

const applyDirectNonHistoryEventToSceneState = (
  state: WorkbookServerHistoryState,
  event: WorkbookHistorySourceEvent
) => {
  if (event.type === "document.state.update") {
    const normalized = normalizeScenePayload({
      document: (event.payload as { document?: unknown })?.document,
    });
    state.scene.documentState = normalized.document;
  }
};

const applyHistoryEventBatchToHistoryState = (
  state: WorkbookServerHistoryState,
  events: WorkbookHistorySourceEvent[]
) => {
  if (events.length === 0) return;
  const entry = buildHistoryEntryFromEventBatch(state.scene, events);
  if (!entry) return;
  pushUndoEntry(state, entry);
  applyHistoryOperations(state.scene, entry.forward, {
    ignoreExpectedCurrent: true,
  });
};

const applyEventBatchToHistoryState = (
  state: WorkbookServerHistoryState,
  events: WorkbookHistorySourceEvent[]
) => {
  if (events.length === 0) return;
  let pendingHistoryEvents: WorkbookHistorySourceEvent[] = [];
  const flushHistoryEvents = () => {
    if (pendingHistoryEvents.length === 0) return;
    applyHistoryEventBatchToHistoryState(state, pendingHistoryEvents);
    pendingHistoryEvents = [];
  };
  events.forEach((event) => {
    if (event.type === "board.undo" || event.type === "board.redo") {
      flushHistoryEvents();
      applyUndoRedoEventToHistoryState(state, event);
      return;
    }
    if (isHistoryTrackedWorkbookEventType(event.type)) {
      pendingHistoryEvents.push(event);
      return;
    }
    applyDirectNonHistoryEventToSceneState(state, event);
  });
  flushHistoryEvents();
};

const resolvePersistedBatchKey = (event: WorkbookEvent): string => {
  const authorUserId =
    typeof event.authorUserId === "string" ? event.authorUserId.trim() : "";
  const createdAt =
    typeof event.createdAt === "string" ? event.createdAt.trim() : "";
  if (!authorUserId || !createdAt) {
    return `seq:${Math.max(0, Math.trunc(event.seq ?? 0))}`;
  }
  return `${authorUserId}::${createdAt}`;
};

const applyPersistedEventsToHistoryState = (
  state: WorkbookServerHistoryState,
  events: WorkbookEvent[]
) => {
  let pendingBatch: WorkbookEvent[] = [];
  let pendingBatchKey: string | null = null;
  const flushPendingBatch = () => {
    if (pendingBatch.length === 0) return;
    applyEventBatchToHistoryState(state, pendingBatch);
    pendingBatch = [];
    pendingBatchKey = null;
  };

  events.forEach((event) => {
    const batchKey = resolvePersistedBatchKey(event);
    if (pendingBatchKey !== null && batchKey !== pendingBatchKey) {
      flushPendingBatch();
    }
    pendingBatch.push(event);
    pendingBatchKey = batchKey;
  });

  flushPendingBatch();
};

const loadSessionTailEvents = async (
  sessionId: string,
  workbookEventStore: WorkbookEventStoreLike,
  eventLimit: number,
  afterSeq: number
) => {
  const collected: WorkbookEvent[] = [];
  let cursor = Math.max(0, Math.trunc(afterSeq));
  let latestKnownSeq = cursor;
  const safeLimit = Math.max(50, Math.min(5_000, Math.trunc(eventLimit || 1_200)));

  for (let iteration = 0; iteration < 256; iteration += 1) {
    const response = await workbookEventStore.read({
      sessionId,
      afterSeq: cursor,
      limit: safeLimit,
    });
    latestKnownSeq = Math.max(latestKnownSeq, Math.max(0, Math.trunc(response.latestSeq ?? 0)));
    const chunk = response.events
      .filter(
        (event) =>
          typeof event?.seq === "number" &&
          Number.isFinite(event.seq) &&
          Math.trunc(event.seq) > cursor
      )
      .sort((left, right) => left.seq - right.seq);
    if (chunk.length === 0) {
      if (cursor >= latestKnownSeq) break;
      cursor = latestKnownSeq;
      continue;
    }
    collected.push(...chunk);
    cursor = Math.max(cursor, Math.trunc(chunk[chunk.length - 1].seq));
    if (cursor >= latestKnownSeq) break;
  }

  return collected;
};

const buildHistoryStateFromPersistence = async (params: {
  sessionId: string;
  workbookSnapshotStore: WorkbookSnapshotStoreLike;
  workbookEventStore: WorkbookEventStoreLike;
  eventLimit: number;
}) => {
  const [boardSnapshot, annotationSnapshot] = await Promise.all([
    params.workbookSnapshotStore.read({
      sessionId: params.sessionId,
      layer: "board",
    }),
    params.workbookSnapshotStore.read({
      sessionId: params.sessionId,
      layer: "annotations",
    }),
  ]);
  const baseVersion =
    boardSnapshot &&
    annotationSnapshot &&
    Number.isFinite(boardSnapshot.version) &&
    Number.isFinite(annotationSnapshot.version)
      ? Math.max(
          0,
          Math.min(Math.trunc(boardSnapshot.version), Math.trunc(annotationSnapshot.version))
        )
      : 0;
  const historyState = createInitialHistoryState(
    boardSnapshot?.payload,
    annotationSnapshot?.payload
  );
  const tailEvents = await loadSessionTailEvents(
    params.sessionId,
    params.workbookEventStore,
    params.eventLimit,
    baseVersion
  );
  applyPersistedEventsToHistoryState(historyState, tailEvents);
  return historyState;
};

export const resolveWorkbookUndoRedoEvents = async ({
  sessionId,
  events,
  workbookSnapshotStore,
  workbookEventStore,
  eventLimit,
}: ResolveWorkbookUndoRedoEventsParams): Promise<WorkbookClientEventInput[]> => {
  const hasUndoRedoCommand = events.some(
    (event) => event.type === "board.undo" || event.type === "board.redo"
  );
  if (!hasUndoRedoCommand) return events;

  const historyState = await buildHistoryStateFromPersistence({
    sessionId,
    workbookSnapshotStore,
    workbookEventStore,
    eventLimit,
  });

  const resolved: WorkbookClientEventInput[] = [];
  let pendingClientBatch: WorkbookHistorySourceEvent[] = [];
  const flushPendingClientBatch = () => {
    if (pendingClientBatch.length === 0) return;
    applyEventBatchToHistoryState(historyState, pendingClientBatch);
    pendingClientBatch = [];
  };

  events.forEach((event) => {
    if (event.type === "board.undo" || event.type === "board.redo") {
      flushPendingClientBatch();
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as { page?: unknown; operations?: unknown })
          : {};
      const targetPage =
        typeof payload.page === "number" && Number.isFinite(payload.page)
          ? toSafePage(payload.page)
          : toSafePage(historyState.scene.boardSettings.currentPage);
      const requestedOperations = Array.isArray(payload.operations)
        ? cloneSerializable(payload.operations as WorkbookHistoryOperation[])
        : [];

      if (event.type === "board.undo") {
        const entry = popLastHistoryEntryForPage(historyState.undoByPage, targetPage);
        const operations = entry ? cloneSerializable(entry.inverse) : requestedOperations;
        if (entry) {
          const redoStack = historyState.redoByPage.get(targetPage) ?? [];
          redoStack.push(entry);
          historyState.redoByPage.set(
            targetPage,
            redoStack.slice(-MAX_HISTORY_ENTRIES_PER_PAGE)
          );
        }
        applyHistoryOperations(historyState.scene, operations, {
          ignoreExpectedCurrent: true,
        });
        resolved.push({
          ...event,
          payload: {
            operations,
            page: targetPage,
          },
        });
      } else {
        const entry = popLastHistoryEntryForPage(historyState.redoByPage, targetPage);
        const operations = entry ? cloneSerializable(entry.forward) : requestedOperations;
        if (entry) {
          const undoStack = historyState.undoByPage.get(targetPage) ?? [];
          undoStack.push(entry);
          historyState.undoByPage.set(
            targetPage,
            undoStack.slice(-MAX_HISTORY_ENTRIES_PER_PAGE)
          );
        }
        applyHistoryOperations(historyState.scene, operations, {
          ignoreExpectedCurrent: true,
        });
        resolved.push({
          ...event,
          payload: {
            operations,
            page: targetPage,
          },
        });
      }
      return;
    }

    resolved.push(event);
    pendingClientBatch.push(event);
  });

  flushPendingClientBatch();

  return resolved;
};
