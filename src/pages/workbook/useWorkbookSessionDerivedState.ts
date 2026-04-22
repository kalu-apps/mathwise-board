import { useCallback, useMemo } from "react";
import { useMediaQuery } from "@mui/material";
import {
  isWorkbookAdaptivePollingEnabled,
  isWorkbookRealtimeBackpressureV2Enabled,
  isWorkbookRealtimeModeAwarePollingEnabled,
} from "@/features/workbook/model/featureFlags";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookPoint,
  WorkbookSession,
  WorkbookSessionParticipant,
} from "@/features/workbook/model/types";
import type { WorkbookStrokePreviewEntry } from "@/features/workbook/model/useWorkbookIncomingRuntimeController";
import type { WorkbookAreaSelection, ClearRequest } from "@/features/workbook/model/workbookSessionUiTypes";
import type { WorkbookSessionStoreActions } from "@/features/workbook/model/workbookSessionStoreTypes";
import { useWorkbookLivekit } from "./useWorkbookLivekit";
import {
  FALLBACK_PERMISSIONS,
  MAIN_SCENE_LAYER_ID,
  VOLATILE_PREVIEW_MAX_PER_FLUSH,
  VOLATILE_PREVIEW_QUEUE_MAX,
} from "./WorkbookSessionPage.core";
import { normalizeSceneLayersForBoard } from "./WorkbookSessionPage.geometry";

type WorkbookSessionDerivedStateParams = {
  sessionId: string;
  user: { id: string } | null;
  currentBoardPage: number;
  session: WorkbookSession | null;
  setError: WorkbookSessionStoreActions["setError"];
  isSessionTabPassive: boolean;
  awaitingClearRequest: ClearRequest | null;
  isParticipantsCollapsed: boolean;
  focusPointsByUser: Record<string, WorkbookPoint>;
  pointerPointsByUser: Record<string, WorkbookPoint>;
  incomingStrokePreviews: Record<string, WorkbookStrokePreviewEntry>;
  areaSelection: WorkbookAreaSelection | null;
  boardSettings: WorkbookBoardSettings;
  boardObjects: WorkbookBoardObject[];
};

const toSafePage = (value: number | null | undefined) =>
  Math.max(1, Math.round(value || 1));

export const useWorkbookSessionDerivedState = ({
  sessionId,
  user,
  currentBoardPage,
  session,
  setError,
  isSessionTabPassive,
  awaitingClearRequest,
  isParticipantsCollapsed,
  focusPointsByUser,
  pointerPointsByUser,
  incomingStrokePreviews,
  areaSelection,
  boardSettings,
  boardObjects,
}: WorkbookSessionDerivedStateParams) => {
  const isEnded = session?.status === "ended";
  const actorParticipant = useMemo(
    () => session?.participants.find((participant) => participant.userId === user?.id) ?? null,
    [session?.participants, user?.id]
  );
  const actorPermissions = useMemo(() => {
    const source = actorParticipant?.permissions;
    const asBool = (value: unknown, fallback: boolean) =>
      typeof value === "boolean" ? value : fallback;

    const canDraw = asBool(source?.canDraw, FALLBACK_PERMISSIONS.canDraw);
    const canSelect = asBool(source?.canSelect, canDraw);
    const canDelete = asBool(source?.canDelete, canSelect);

    return {
      canDraw,
      canAnnotate: asBool(source?.canAnnotate, canDraw),
      canUseMedia: asBool(source?.canUseMedia, FALLBACK_PERMISSIONS.canUseMedia),
      canUseChat: true,
      canInvite: asBool(source?.canInvite, FALLBACK_PERMISSIONS.canInvite),
      canManageSession: asBool(
        source?.canManageSession,
        FALLBACK_PERMISSIONS.canManageSession
      ),
      canSelect,
      canDelete,
      canInsertImage: asBool(source?.canInsertImage, canDraw),
      canClear: asBool(source?.canClear, canDelete),
      canExport: asBool(source?.canExport, FALLBACK_PERMISSIONS.canExport),
      canUseLaser: asBool(source?.canUseLaser, canDraw),
    };
  }, [actorParticipant]);
  const canManageSession = Boolean(actorPermissions.canManageSession && !isSessionTabPassive);
  const hasParticipantBoardToolsAccess = Boolean(
    actorPermissions.canDraw &&
      actorPermissions.canAnnotate &&
      actorPermissions.canSelect &&
      actorPermissions.canDelete &&
      actorPermissions.canInsertImage &&
      actorPermissions.canUseLaser
  );
  const canDraw = Boolean(
    actorPermissions.canDraw && !isEnded && !awaitingClearRequest && !isSessionTabPassive
  );
  const canSelect = Boolean(actorPermissions.canSelect && !isEnded && !isSessionTabPassive);
  const canInsertImage = Boolean(
    actorPermissions.canInsertImage && !isEnded && !isSessionTabPassive
  );
  const canDelete = Boolean(actorPermissions.canDelete && !isEnded && !isSessionTabPassive);
  const canClear = Boolean(
    actorPermissions.canClear && canManageSession && !isEnded && !isSessionTabPassive
  );
  const canUseLaser = Boolean(actorPermissions.canUseLaser && !isEnded && !isSessionTabPassive);
  const canUseMedia = Boolean(actorPermissions.canUseMedia);
  const canUseSessionChat = Boolean(actorPermissions.canUseChat);
  const canSendSessionChat = canUseSessionChat && !isEnded && !isSessionTabPassive;
  const isClassSession = session?.kind === "CLASS";
  const canAccessBoardSettingsPanel = Boolean(
    !isClassSession || canManageSession || hasParticipantBoardToolsAccess
  );
  const canManageSharedBoardSettings = Boolean(
    !isClassSession || canManageSession || hasParticipantBoardToolsAccess
  );
  const showCollaborationPanels = Boolean(isClassSession);
  const adaptivePollingEnabled = useMemo(() => isWorkbookAdaptivePollingEnabled(), []);
  const realtimeModeAwarePollingEnabled = useMemo(
    () => isWorkbookRealtimeModeAwarePollingEnabled(),
    []
  );
  const realtimeBackpressureV2Enabled = useMemo(
    () => isWorkbookRealtimeBackpressureV2Enabled(),
    []
  );
  const volatilePreviewMaxPerFlush = realtimeBackpressureV2Enabled
    ? VOLATILE_PREVIEW_MAX_PER_FLUSH
    : Number.MAX_SAFE_INTEGER;
  const volatilePreviewQueueMax = realtimeBackpressureV2Enabled
    ? VOLATILE_PREVIEW_QUEUE_MAX
    : Number.MAX_SAFE_INTEGER;
  const {
    isLivekitConnected,
    micEnabled,
    setMicEnabled,
    cameraEnabled,
    setCameraEnabled,
    localVideoTrack,
    remoteVideoTracks,
  } = useWorkbookLivekit({
    sessionId,
    sessionKind: session?.kind,
    canUseMedia,
    isEnded,
    userId: user?.id,
    setError,
  });
  const isCompactDialogViewport = useMediaQuery("(max-width: 640px)");
  const showSidebarParticipants = showCollaborationPanels && !isParticipantsCollapsed;
  const focusPoints = useMemo(
    () => Object.values(focusPointsByUser ?? {}),
    [focusPointsByUser]
  );
  const pointerPoints = useMemo(
    () => Object.values(pointerPointsByUser ?? {}),
    [pointerPointsByUser]
  );
  const previewStrokes = useMemo(
    () =>
      Object.values(incomingStrokePreviews ?? {})
        .map((entry) => entry.stroke)
        .filter((stroke) => toSafePage(stroke.page) === toSafePage(currentBoardPage)),
    [currentBoardPage, incomingStrokePreviews]
  );
  const areaSelectionHasContent = Boolean(
    areaSelection && (areaSelection.objectIds.length > 0 || areaSelection.strokeIds.length > 0)
  );
  const isParticipantBoardToolsEnabled = useCallback(
    (participant: WorkbookSessionParticipant) =>
      Boolean(
        participant.permissions.canDraw &&
          participant.permissions.canAnnotate &&
        participant.permissions.canSelect &&
        participant.permissions.canDelete &&
        participant.permissions.canInsertImage &&
        participant.permissions.canUseLaser
      ),
    []
  );
  const boardLocked = Boolean(awaitingClearRequest);
  const canEdit = !isEnded && (canDraw || canSelect);
  const isTeacherActor = Boolean(
    actorParticipant?.roleInSession === "teacher" || actorPermissions.canManageSession
  );
  const canUseUndo = Boolean(
    !isEnded &&
      canEdit &&
      session &&
      (session.kind === "PERSONAL" ||
        session.settings.undoPolicy === "everyone" ||
        (session.settings.undoPolicy === "teacher_only" && isTeacherActor) ||
        session.settings.undoPolicy === "own_only")
  );
  const normalizedSceneLayers = useMemo(
    () =>
      normalizeSceneLayersForBoard(
        boardSettings.sceneLayers,
        boardSettings.activeSceneLayerId
      ),
    [boardSettings.activeSceneLayerId, boardSettings.sceneLayers]
  );
  const activeSceneLayerId = normalizedSceneLayers.activeSceneLayerId;
  const getObjectSceneLayerId = useCallback((object: WorkbookBoardObject) => {
    const layerId =
      object.meta && typeof object.meta === "object" && typeof object.meta.sceneLayerId === "string"
        ? object.meta.sceneLayerId
        : "";
    return layerId.trim() || MAIN_SCENE_LAYER_ID;
  }, []);
  const compositionLayers = useMemo(
    () =>
      normalizedSceneLayers.sceneLayers.filter(
        (layerItem) =>
          layerItem.id !== MAIN_SCENE_LAYER_ID &&
          boardObjects.some((object) => getObjectSceneLayerId(object) === layerItem.id)
      ),
    [boardObjects, getObjectSceneLayerId, normalizedSceneLayers.sceneLayers]
  );
  const compositionObjectsByLayer = useMemo(() => {
    const grouped = new Map<string, WorkbookBoardObject[]>();
    boardObjects.forEach((object) => {
      const layerId = getObjectSceneLayerId(object);
      if (layerId === MAIN_SCENE_LAYER_ID) return;
      const existing = grouped.get(layerId);
      if (existing) {
        existing.push(object);
      } else {
        grouped.set(layerId, [object]);
      }
    });
    return grouped;
  }, [boardObjects, getObjectSceneLayerId]);
  const compositionLayerEntries = useMemo(
    () =>
      compositionLayers.map((layer) => ({
        layer,
        objects: compositionObjectsByLayer.get(layer.id) ?? [],
      })),
    [compositionLayers, compositionObjectsByLayer]
  );

  return {
    isEnded,
    actorParticipant,
    actorPermissions,
    canManageSession,
    canDraw,
    canSelect,
    canInsertImage,
    canDelete,
    canClear,
    canUseLaser,
    canUseMedia,
    canUseSessionChat,
    canSendSessionChat,
    canAccessBoardSettingsPanel,
    canManageSharedBoardSettings,
    showCollaborationPanels,
    adaptivePollingEnabled,
    realtimeModeAwarePollingEnabled,
    realtimeBackpressureV2Enabled,
    volatilePreviewMaxPerFlush,
    volatilePreviewQueueMax,
    isLivekitConnected,
    micEnabled,
    setMicEnabled,
    cameraEnabled,
    setCameraEnabled,
    localVideoTrack,
    remoteVideoTracks,
    isCompactDialogViewport,
    showSidebarParticipants,
    focusPoints,
    pointerPoints,
    previewStrokes,
    areaSelectionHasContent,
    isParticipantBoardToolsEnabled,
    boardLocked,
    canEdit,
    isTeacherActor,
    canUseUndo,
    normalizedSceneLayers,
    activeSceneLayerId,
    getObjectSceneLayerId,
    compositionLayerEntries,
  };
};
