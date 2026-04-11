import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookDocumentAnnotation,
  WorkbookDocumentAsset,
  WorkbookDocumentState,
  WorkbookEvent,
  WorkbookEventType,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookSessionParticipant,
  WorkbookStroke,
} from "./types";

type WorkbookUnknownPayload = Record<string, unknown>;

export type WorkbookKnownEventPayloadMap = {
  "board.stroke": { stroke: WorkbookStroke };
  "board.stroke.preview": {
    stroke: WorkbookStroke;
    previewVersion?: number;
  };
  "board.eraser.preview": {
    gestureId: string;
    layer?: WorkbookLayer;
    page?: number;
    radius?: number;
    points: WorkbookPoint[];
    ended?: boolean;
  };
  "board.stroke.delete": { strokeId: string };
  "board.object.create": { object: WorkbookBoardObject };
  "board.object.preview": {
    objectId: string;
    patch: Partial<WorkbookBoardObject>;
    previewVersion?: number;
  };
  "board.viewport.sync": { offset: WorkbookPoint };
  "presence.sync": { participants: WorkbookSessionParticipant[] };
  "board.object.update": {
    objectId: string;
    patch: Partial<WorkbookBoardObject>;
  };
  "board.object.delete": { objectId: string };
  "board.object.pin": { objectId: string; pinned: boolean };
  "board.object.reorder": { objectId: string; zOrder: number };
  "board.undo": { operations?: unknown[]; scene?: unknown; page?: number };
  "board.redo": { operations?: unknown[]; scene?: unknown; page?: number };
  "annotations.stroke": { stroke: WorkbookStroke };
  "annotations.stroke.preview": {
    stroke: WorkbookStroke;
    previewVersion?: number;
  };
  "annotations.stroke.delete": { strokeId: string };
  "document.asset.add": { asset: WorkbookDocumentAsset };
  "document.state.update": { document: WorkbookDocumentState };
  "document.annotation.add": { annotation: WorkbookDocumentAnnotation };
  "document.annotation.clear": WorkbookUnknownPayload;
  "board.settings.update": { boardSettings: Partial<WorkbookBoardSettings> };
  "teacher.cursor": {
    target: "board";
    mode: "move" | "clear";
    point?: WorkbookPoint;
  };
  "chat.message": { message: WorkbookChatMessage | WorkbookUnknownPayload };
  "chat.clear": WorkbookUnknownPayload;
  "permissions.update": {
    userId?: string;
    permissions?: WorkbookUnknownPayload;
  };
};

export type WorkbookEventPayloadFor<T extends WorkbookEventType> =
  T extends keyof WorkbookKnownEventPayloadMap
    ? WorkbookKnownEventPayloadMap[T]
    : WorkbookUnknownPayload;

export type WorkbookClientEventInput<T extends WorkbookEventType = WorkbookEventType> = {
  clientEventId?: string;
  type: T;
  payload: WorkbookEventPayloadFor<T>;
};

export type WorkbookTypedEvent<T extends WorkbookEventType = WorkbookEventType> = Omit<
  WorkbookEvent,
  "type" | "payload"
> & {
  type: T;
  payload: WorkbookEventPayloadFor<T>;
};

export const WORKBOOK_PREVIEW_EVENT_TYPES = [
  "board.object.preview",
  "board.eraser.preview",
  "board.stroke.preview",
  "annotations.stroke.preview",
] as const satisfies readonly WorkbookEventType[];

export const WORKBOOK_VOLATILE_EVENT_TYPES = [
  ...WORKBOOK_PREVIEW_EVENT_TYPES,
  "board.viewport.sync",
  "presence.sync",
  "teacher.cursor",
] as const satisfies readonly WorkbookEventType[];

export const WORKBOOK_LIVE_REPLAYABLE_EVENT_TYPES = [
  "board.object.create",
] as const satisfies readonly WorkbookEventType[];

export const WORKBOOK_OPTIMISTIC_EVENT_TYPES = [
  "board.object.create",
  "board.undo",
  "board.redo",
  "chat.message",
  "chat.clear",
] as const satisfies readonly WorkbookEventType[];

export const WORKBOOK_URGENT_LIVE_EVENT_TYPES = [
  "board.stroke",
  "annotations.stroke",
  "board.stroke.delete",
  "annotations.stroke.delete",
  "board.object.create",
  "board.object.update",
  "board.object.delete",
  "board.object.reorder",
  "board.settings.update",
  "board.undo",
  "board.redo",
  "chat.message",
  "chat.clear",
] as const satisfies readonly WorkbookEventType[];

export const WORKBOOK_HISTORY_EVENT_TYPES = [
  "board.stroke",
  "board.stroke.delete",
  "annotations.stroke",
  "annotations.stroke.delete",
  "board.object.create",
  "board.object.update",
  "board.object.delete",
  "board.object.pin",
  "board.object.reorder",
  "board.clear",
  "annotations.clear",
  "geometry.constraint.add",
  "geometry.constraint.remove",
  "board.settings.update",
  "document.asset.add",
  "document.annotation.add",
  "document.annotation.clear",
] as const satisfies readonly WorkbookEventType[];

export const WORKBOOK_DIRTY_EVENT_TYPES = [
  ...WORKBOOK_HISTORY_EVENT_TYPES,
  "chat.message",
  "chat.message.delete",
  "chat.clear",
  "comments.upsert",
  "comments.remove",
  "timer.update",
  "settings.update",
  "permissions.update",
] as const satisfies readonly WorkbookEventType[];

const toReadonlyEventTypeSet = <T extends readonly WorkbookEventType[]>(values: T) =>
  new Set<WorkbookEventType>(values);

const previewEventTypeSet = toReadonlyEventTypeSet(WORKBOOK_PREVIEW_EVENT_TYPES);
const volatileEventTypeSet = toReadonlyEventTypeSet(WORKBOOK_VOLATILE_EVENT_TYPES);
const liveReplayableEventTypeSet = toReadonlyEventTypeSet(WORKBOOK_LIVE_REPLAYABLE_EVENT_TYPES);
const optimisticEventTypeSet = toReadonlyEventTypeSet(WORKBOOK_OPTIMISTIC_EVENT_TYPES);
const urgentLiveEventTypeSet = toReadonlyEventTypeSet(WORKBOOK_URGENT_LIVE_EVENT_TYPES);
const historyEventTypeSet = toReadonlyEventTypeSet(WORKBOOK_HISTORY_EVENT_TYPES);
const dirtyEventTypeSet = toReadonlyEventTypeSet(WORKBOOK_DIRTY_EVENT_TYPES);

export const isWorkbookPreviewEventType = (
  type: WorkbookEventType | string
): type is (typeof WORKBOOK_PREVIEW_EVENT_TYPES)[number] =>
  previewEventTypeSet.has(type as WorkbookEventType);

export const isVolatileWorkbookEventType = (
  type: WorkbookEventType | string
): type is (typeof WORKBOOK_VOLATILE_EVENT_TYPES)[number] =>
  volatileEventTypeSet.has(type as WorkbookEventType);

export const isLiveReplayableWorkbookEventType = (
  type: WorkbookEventType | string
): type is (typeof WORKBOOK_LIVE_REPLAYABLE_EVENT_TYPES)[number] =>
  liveReplayableEventTypeSet.has(type as WorkbookEventType);

export const isOptimisticWorkbookEventType = (
  type: WorkbookEventType | string
): type is (typeof WORKBOOK_OPTIMISTIC_EVENT_TYPES)[number] =>
  optimisticEventTypeSet.has(type as WorkbookEventType);

export const isUrgentWorkbookLiveEventType = (
  type: WorkbookEventType | string
): type is (typeof WORKBOOK_URGENT_LIVE_EVENT_TYPES)[number] =>
  urgentLiveEventTypeSet.has(type as WorkbookEventType);

export const isHistoryTrackedWorkbookEventType = (
  type: WorkbookEventType | string
): type is (typeof WORKBOOK_HISTORY_EVENT_TYPES)[number] =>
  historyEventTypeSet.has(type as WorkbookEventType);

export const isDirtyWorkbookEventType = (
  type: WorkbookEventType | string
): type is (typeof WORKBOOK_DIRTY_EVENT_TYPES)[number] =>
  dirtyEventTypeSet.has(type as WorkbookEventType);
