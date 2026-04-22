import type { Dispatch, SetStateAction } from "react";
import {
  normalizeChatMessagePayload,
  normalizeDocumentAnnotationPayload,
  normalizeDocumentAssetPayload,
} from "./scene";
import { upsertWorkbookChatMessage } from "./chatMessageState";
import { normalizeWorkbookPageFrameWidth } from "./pageFrame";
import {
  normalizeWorkbookBoardPageVisualSettingsByPage,
  resolveWorkbookBoardPageVisualDefaults,
} from "./boardPageSettings";
import type {
  WorkbookBoardSettings,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentState,
  WorkbookEvent,
  WorkbookLibraryState,
  WorkbookSession,
  WorkbookSessionParticipant,
  WorkbookSessionSettings,
  WorkbookTimerState,
} from "./types";

type ApplyWorkbookIncomingSessionMetaEventParams = {
  event: WorkbookEvent;
  normalizeSceneLayersForBoard: (
    sourceLayers: WorkbookBoardSettings["sceneLayers"] | undefined,
    activeSceneLayerId: string | undefined
  ) => {
    sceneLayers: WorkbookBoardSettings["sceneLayers"];
    activeSceneLayerId: string;
  };
  setDocumentState: Dispatch<SetStateAction<WorkbookDocumentState>>;
  setConstraints: Dispatch<SetStateAction<WorkbookConstraint[]>>;
  setSelectedConstraintId: Dispatch<SetStateAction<string | null>>;
  setBoardSettings: Dispatch<SetStateAction<WorkbookBoardSettings>>;
  setLibraryState: Dispatch<SetStateAction<WorkbookLibraryState>>;
  setComments: Dispatch<SetStateAction<WorkbookComment[]>>;
  setTimerState: Dispatch<SetStateAction<WorkbookTimerState | null>>;
  setSession: Dispatch<SetStateAction<WorkbookSession | null>>;
  setChatMessages: Dispatch<
    SetStateAction<
      Array<{
        id: string;
        authorUserId: string;
        authorName: string;
        text: string;
        createdAt: string;
      }>
    >
  >;
};

export const applyWorkbookIncomingSessionMetaEvent = (
  params: ApplyWorkbookIncomingSessionMetaEventParams
) => {
  const {
    event,
    normalizeSceneLayersForBoard,
    setDocumentState,
    setConstraints,
    setSelectedConstraintId,
    setBoardSettings,
    setLibraryState,
    setComments,
    setTimerState,
    setSession,
    setChatMessages,
  } = params;

  if (event.type === "document.asset.add") {
    const asset = normalizeDocumentAssetPayload((event.payload as { asset?: unknown })?.asset);
    if (!asset) return true;
    setDocumentState((current) => ({
      ...current,
      assets: current.assets.some((item) => item.id === asset.id)
        ? current.assets
        : [...current.assets, asset],
      activeAssetId: current.activeAssetId ?? asset.id,
    }));
    return true;
  }

  if (event.type === "document.state.update") {
    const payload = event.payload as {
      activeAssetId?: unknown;
      page?: unknown;
      zoom?: unknown;
    };
    setDocumentState((current) => ({
      ...current,
      activeAssetId:
        typeof payload.activeAssetId === "string"
          ? payload.activeAssetId
          : current.activeAssetId,
      page:
        typeof payload.page === "number" && Number.isFinite(payload.page)
          ? Math.max(1, Math.floor(payload.page))
          : current.page,
      zoom:
        typeof payload.zoom === "number" && Number.isFinite(payload.zoom)
          ? Math.max(0.2, Math.min(4, payload.zoom))
          : current.zoom,
    }));
    return true;
  }

  if (event.type === "document.annotation.add") {
    const annotation = normalizeDocumentAnnotationPayload(
      (event.payload as { annotation?: unknown })?.annotation
    );
    if (!annotation) return true;
    setDocumentState((current) => ({
      ...current,
      annotations: [...current.annotations, annotation],
    }));
    return true;
  }

  if (event.type === "document.annotation.clear") {
    setDocumentState((current) => ({
      ...current,
      annotations: [],
    }));
    return true;
  }

  if (event.type === "geometry.constraint.add") {
    const payload = event.payload as { constraint?: unknown };
    if (!payload.constraint || typeof payload.constraint !== "object") return true;
    const typed = payload.constraint as WorkbookConstraint;
    if (!typed.id || !typed.type || !typed.sourceObjectId || !typed.targetObjectId) {
      return true;
    }
    setConstraints((current) => {
      const exists = current.some((item) => item.id === typed.id);
      if (!exists) return [...current, typed];
      return current.map((item) => (item.id === typed.id ? { ...item, ...typed } : item));
    });
    return true;
  }

  if (event.type === "geometry.constraint.remove") {
    const constraintId = (event.payload as { constraintId?: unknown })?.constraintId;
    if (typeof constraintId !== "string") return true;
    setConstraints((current) => current.filter((item) => item.id !== constraintId));
    setSelectedConstraintId((current) => (current === constraintId ? null : current));
    return true;
  }

  if (event.type === "board.settings.update") {
    const payload = event.payload as { boardSettings?: unknown };
    if (!payload.boardSettings || typeof payload.boardSettings !== "object") return true;
    setBoardSettings((current) => {
      const merged = {
        ...current,
        ...(payload.boardSettings as Partial<WorkbookBoardSettings>),
      };
      const normalizedLayers = normalizeSceneLayersForBoard(
        merged.sceneLayers,
        merged.activeSceneLayerId
      );
      const normalizedSettings: WorkbookBoardSettings = {
        ...merged,
        pageFrameWidth: normalizeWorkbookPageFrameWidth(merged.pageFrameWidth),
        sceneLayers: normalizedLayers.sceneLayers,
        activeSceneLayerId: normalizedLayers.activeSceneLayerId,
      };
      const fallbackPageVisual = resolveWorkbookBoardPageVisualDefaults(normalizedSettings);
      normalizedSettings.pageBoardSettingsByPage =
        normalizeWorkbookBoardPageVisualSettingsByPage(
          merged.pageBoardSettingsByPage,
          fallbackPageVisual
        );
      return {
        ...normalizedSettings,
      };
    });
    return true;
  }

  if (event.type === "library.folder.upsert") {
    const payload = event.payload as { folder?: unknown };
    if (!payload.folder || typeof payload.folder !== "object") return true;
    const folder = payload.folder as WorkbookLibraryState["folders"][number];
    if (!folder.id) return true;
    setLibraryState((current) => {
      const exists = current.folders.some((item) => item.id === folder.id);
      return {
        ...current,
        folders: exists
          ? current.folders.map((item) => (item.id === folder.id ? { ...item, ...folder } : item))
          : [...current.folders, folder],
      };
    });
    return true;
  }

  if (event.type === "library.folder.remove") {
    const payload = event.payload as { folderId?: unknown };
    if (typeof payload.folderId !== "string") return true;
    setLibraryState((current) => ({
      ...current,
      folders: current.folders.filter((item) => item.id !== payload.folderId),
      items: current.items.map((item) =>
        item.folderId === payload.folderId ? { ...item, folderId: null } : item
      ),
    }));
    return true;
  }

  if (event.type === "library.item.upsert") {
    const payload = event.payload as { item?: unknown };
    if (!payload.item || typeof payload.item !== "object") return true;
    const item = payload.item as WorkbookLibraryState["items"][number];
    if (!item.id) return true;
    setLibraryState((current) => {
      const exists = current.items.some((entry) => entry.id === item.id);
      return {
        ...current,
        items: exists
          ? current.items.map((entry) => (entry.id === item.id ? { ...entry, ...item } : entry))
          : [...current.items, item],
      };
    });
    return true;
  }

  if (event.type === "library.item.remove") {
    const payload = event.payload as { itemId?: unknown };
    if (typeof payload.itemId !== "string") return true;
    setLibraryState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== payload.itemId),
    }));
    return true;
  }

  if (event.type === "library.template.upsert") {
    const payload = event.payload as { template?: unknown };
    if (!payload.template || typeof payload.template !== "object") return true;
    const template = payload.template as WorkbookLibraryState["templates"][number];
    if (!template.id) return true;
    setLibraryState((current) => {
      const exists = current.templates.some((entry) => entry.id === template.id);
      return {
        ...current,
        templates: exists
          ? current.templates.map((entry) =>
              entry.id === template.id ? { ...entry, ...template } : entry
            )
          : [...current.templates, template],
      };
    });
    return true;
  }

  if (event.type === "library.template.remove") {
    const payload = event.payload as { templateId?: unknown };
    if (typeof payload.templateId !== "string") return true;
    setLibraryState((current) => ({
      ...current,
      templates: current.templates.filter((template) => template.id !== payload.templateId),
    }));
    return true;
  }

  if (event.type === "comments.upsert") {
    const payload = event.payload as { comment?: unknown };
    if (!payload.comment || typeof payload.comment !== "object") return true;
    const comment = payload.comment as WorkbookComment;
    if (!comment.id) return true;
    setComments((current) => {
      const exists = current.some((item) => item.id === comment.id);
      return exists
        ? current.map((item) => (item.id === comment.id ? { ...item, ...comment } : item))
        : [...current, comment];
    });
    return true;
  }

  if (event.type === "comments.remove") {
    const payload = event.payload as { commentId?: unknown };
    if (typeof payload.commentId !== "string") return true;
    setComments((current) => current.filter((comment) => comment.id !== payload.commentId));
    return true;
  }

  if (event.type === "timer.update") {
    const payload = event.payload as { timer?: unknown };
    if (payload.timer === null) {
      setTimerState(null);
      return true;
    }
    if (!payload.timer || typeof payload.timer !== "object") return true;
    const timer = payload.timer as WorkbookTimerState;
    if (!timer.id) return true;
    setTimerState(timer);
    return true;
  }

  if (event.type === "settings.update") {
    const payload = event.payload as { settings?: Partial<WorkbookSessionSettings> };
    const incomingSettings = payload.settings;
    if (!incomingSettings) return true;
    setSession((current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              ...incomingSettings,
              studentControls: {
                ...current.settings.studentControls,
                ...incomingSettings.studentControls,
              },
            },
          }
        : current
    );
    return true;
  }

  if (event.type === "permissions.update") {
    const payload = event.payload as {
      userId?: unknown;
      permissions?: unknown;
    };
    const targetUserId = typeof payload.userId === "string" ? payload.userId : "";
    const patch =
      payload.permissions && typeof payload.permissions === "object"
        ? (payload.permissions as Partial<WorkbookSessionParticipant["permissions"]>)
        : null;
    if (!targetUserId || !patch) return true;
    setSession((current) => {
      if (!current) return current;
      return {
        ...current,
        participants: current.participants.map((participant) =>
          participant.userId === targetUserId
            ? (() => {
                const nextPermissions = {
                  ...participant.permissions,
                  ...patch,
                };
                if (typeof patch.canUseMedia === "boolean") {
                  if (typeof patch.canUseMicrophone !== "boolean") {
                    nextPermissions.canUseMicrophone = patch.canUseMedia;
                  }
                  if (typeof patch.canUseCamera !== "boolean") {
                    nextPermissions.canUseCamera = patch.canUseMedia;
                  }
                }
                const canUseMicrophone =
                  typeof nextPermissions.canUseMicrophone === "boolean"
                    ? nextPermissions.canUseMicrophone
                    : Boolean(nextPermissions.canUseMedia);
                const canUseCamera =
                  typeof nextPermissions.canUseCamera === "boolean"
                    ? nextPermissions.canUseCamera
                    : Boolean(nextPermissions.canUseMedia);
                nextPermissions.canUseMicrophone = canUseMicrophone;
                nextPermissions.canUseCamera = canUseCamera;
                nextPermissions.canUseMedia = canUseMicrophone && canUseCamera;
                return {
                  ...participant,
                  permissions: nextPermissions,
                };
              })()
            : participant
        ),
      };
    });
    return true;
  }

  if (event.type === "chat.message") {
    const message = normalizeChatMessagePayload((event.payload as { message?: unknown })?.message);
    if (!message) return true;
    setChatMessages((current) => upsertWorkbookChatMessage(current, message));
    return true;
  }

  if (event.type === "chat.message.delete") {
    const messageId = (event.payload as { messageId?: unknown })?.messageId;
    if (typeof messageId !== "string" || !messageId) return true;
    setChatMessages((current) => current.filter((item) => item.id !== messageId));
    return true;
  }

  if (event.type === "chat.clear") {
    setChatMessages([]);
    return true;
  }

  return false;
};
