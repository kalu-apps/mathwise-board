import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./workbookRouteStyles";
import {
  Alert,
  Button,
} from "@mui/material";
import { useAuth } from "@/features/auth/model/AuthContext";
import {
  updateWorkbookSessionDraftPreview,
  uploadWorkbookAsset,
} from "@/features/workbook/model/api";
import { useWorkbookSessionStore } from "@/features/workbook/model/workbookSessionStore";
import {
  startWorkbookPerformanceSession,
} from "@/features/workbook/model/workbookPerformance";
import type {
  WorkbookEvent,
  WorkbookLayer,
} from "@/features/workbook/model/types";
import { PageLoader } from "@/shared/ui/loading";
import { PlatformConfirmDialog } from "@/shared/ui/PlatformConfirmDialog";
import { useWorkbookSessionContextbar } from "./useWorkbookSessionContextbar";
import { useWorkbookSessionPanelHandlers } from "./useWorkbookSessionPanelHandlers";
import { useWorkbookImportModalController } from "./useWorkbookImportModalController";
import { useWorkbookSessionConfirmActions } from "./useWorkbookSessionConfirmActions";
import { useWorkbookSelectedSolid3dActions } from "./useWorkbookSelectedSolid3dActions";
import { useWorkbookSelectedGraphTextActions } from "./useWorkbookSelectedGraphTextActions";
import { useWorkbookSelectedStructureActions } from "./useWorkbookSelectedStructureActions";
import { useWorkbookSelectedShape2dActions } from "./useWorkbookSelectedShape2dActions";
import { useWorkbookContextMenuHandlers } from "./useWorkbookContextMenuHandlers";
import { useWorkbookLaserHandlers } from "./useWorkbookLaserHandlers";
import { useWorkbookHistoryHotkeys } from "./useWorkbookHistoryHotkeys";
import { useWorkbookSessionCollabHandlers } from "./useWorkbookSessionCollabHandlers";
import { useWorkbookSessionDocumentHandlers } from "./useWorkbookSessionDocumentHandlers";
import { useWorkbookCanvasHandlers } from "./useWorkbookCanvasHandlers";
import { useWorkbookEventCommitPipeline } from "./useWorkbookEventCommitPipeline";
import { useWorkbookVolatileSyncPipeline } from "./useWorkbookVolatileSyncPipeline";
import { useWorkbookObjectUpdateQueue } from "./useWorkbookObjectUpdateQueue";
import { useWorkbookLayerClearActions } from "./useWorkbookLayerClearActions";
import { useWorkbookBoardSettingsPages } from "./useWorkbookBoardSettingsPages";
import { useWorkbookUtilityPanelController } from "./useWorkbookUtilityPanelController";
import { useWorkbookHistoryOperationsApply } from "./useWorkbookHistoryOperationsApply";
import { useWorkbookStrokeCommitHandlers } from "./useWorkbookStrokeCommitHandlers";
import { useWorkbookObjectMutationHandlers } from "./useWorkbookObjectMutationHandlers";
import { useWorkbookObjectTransformHandlers } from "./useWorkbookObjectTransformHandlers";
import { useWorkbookObjectDeleteHandler } from "./useWorkbookObjectDeleteHandler";
import { useWorkbookAreaSelectionClipboardHandlers } from "./useWorkbookAreaSelectionClipboardHandlers";
import { useWorkbookCompositionLayerHandlers } from "./useWorkbookCompositionLayerHandlers";
import { useWorkbookSolid3dSectionDraftHandlers } from "./useWorkbookSolid3dSectionDraftHandlers";
import { useWorkbookMathPresetCreationHandlers } from "./useWorkbookMathPresetCreationHandlers";
import { useWorkbookSessionChatEventHandlers } from "./useWorkbookSessionChatEventHandlers";
import { useWorkbookLibraryAndTimerActions } from "./useWorkbookLibraryAndTimerActions";
import { useWorkbookConstraintResolver } from "./useWorkbookConstraintResolver";
import { useWorkbookToolCatalog } from "./useWorkbookToolCatalog";
import { WorkbookSessionTopScaffold } from "./WorkbookSessionTopScaffold";
import {
  ADAPTIVE_POLLING_MAX_MS,
  ADAPTIVE_POLLING_MIN_MS,
  AUTOSAVE_INTERVAL_MS,
  ERASER_RADIUS_MAX,
  ERASER_RADIUS_MIN,
  PARTICIPANT_VISIBILITY_GRACE_MS,
  POLL_INTERVAL_MS,
  POLL_INTERVAL_STREAM_CONNECTED_MS,
  PRESENCE_INTERVAL_MS,
  RESYNC_MIN_INTERVAL_MS,
  SESSION_CHAT_SCROLL_BOTTOM_THRESHOLD_PX,
  STROKE_PREVIEW_EXPIRY_MS,
  TAB_LOCK_HEARTBEAT_MS,
  WORKBOOK_CHAT_EMOJIS,
  MAIN_SCENE_LAYER_ID,
  getSectionVertexLabel,
  getSolidVertexLabel,
} from "./WorkbookSessionPage.core";
import {
  supportsGraphUtilityPanel,
  supportsTransformUtilityPanel,
} from "./WorkbookSessionPage.geometry";
import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";
import { useWorkbookPdfExport } from "./useWorkbookPdfExport";
import { useWorkbookSessionRefs } from "./workbookSessionRefs";
import { useWorkbookSessionCleanupEffects } from "./useWorkbookSessionCleanupEffects";
import { useWorkbookSessionLocalRuntime } from "./useWorkbookSessionLocalRuntime";
import { useWorkbookSessionHistoryRuntime } from "./useWorkbookSessionHistoryRuntime";
import { useWorkbookSessionIncomingRuntime } from "./useWorkbookSessionIncomingRuntime";
import { useWorkbookSessionRealtimeLifecycle } from "./useWorkbookSessionRealtimeLifecycle";
import { useWorkbookToolRuntimeHandlers } from "./useWorkbookToolRuntimeHandlers";
import { WorkbookSessionWorkspace } from "./WorkbookSessionWorkspace";
import { WorkbookSessionSidebar } from "./WorkbookSessionSidebar";
import { useWorkbookSessionSelectionViewportState } from "./useWorkbookSessionSelectionViewportState";
import { buildWorkbookCanvasProps } from "./useWorkbookCanvasProps";
import { buildWorkbookSessionRealtimeLifecycleParams } from "./buildWorkbookSessionRealtimeLifecycleParams";
import { buildWorkbookSessionSelectionViewportParams } from "./buildWorkbookSessionSelectionViewportParams";
import { buildWorkbookSessionLayoutRuntimeProps } from "./buildWorkbookSessionLayoutRuntimeProps";
import { useWorkbookSessionDerivedState } from "./useWorkbookSessionDerivedState";
import { applyWorkbookIncomingEventsBatch } from "./applyWorkbookIncomingEventsBatch";
import { buildWorkbookSessionTransformPanelRuntimeProps } from "./buildWorkbookSessionTransformPanelRuntimeProps";
import { buildWorkbookSessionUtilityPanelProps } from "./buildWorkbookSessionUtilityPanelProps";
import {
  WorkbookSessionToolSettingsPopover,
  type WorkbookToolSettingsPopoverState,
  type WorkbookToolSettingsPopoverTool,
} from "./WorkbookSessionToolSettingsPopover";
import { WorkbookImportModal } from "./WorkbookImportModal";
import { captureWorkbookSessionPreviewDataUrl } from "./workbookHubPreviewCapture";
import { useWorkbookPageTransitionOverlay } from "./useWorkbookPageTransitionOverlay";

export default function WorkbookSessionPage() {
  const { user, isAuthReady, openAuthModal } = useAuth();
  const { sessionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId.trim()) return;
    return startWorkbookPerformanceSession(sessionId);
  }, [sessionId]);

  const layer: WorkbookLayer = "board";
  const textPreset = "";
  const workbookSessionUi = useWorkbookSessionStore((state) => state.ui);
  const latestSeq = useWorkbookSessionStore((state) => state.collab.latestSeq);
  const realtimeSyncWarning = useWorkbookSessionStore((state) => state.collab.realtimeSyncWarning);
  const isWorkbookStreamConnected = useWorkbookSessionStore(
    (state) => state.collab.isWorkbookStreamConnected
  );
  const isWorkbookLiveConnected = useWorkbookSessionStore(
    (state) => state.collab.isWorkbookLiveConnected
  );
  const selectedObjectId = useWorkbookSessionStore((state) => state.scene.selectedObjectId);
  const selectedConstraintId = useWorkbookSessionStore((state) => state.scene.selectedConstraintId);
  const canvasViewport = useWorkbookSessionStore((state) => state.scene.canvasViewport);
  const viewportZoom = useWorkbookSessionStore((state) => state.scene.viewportZoom);
  const focusPoint = useWorkbookSessionStore((state) => state.runtime.focusPoint);
  const pointerPoint = useWorkbookSessionStore((state) => state.runtime.pointerPoint);
  const focusPointsByUser = useWorkbookSessionStore((state) => state.runtime.focusPointsByUser);
  const pointerPointsByUser = useWorkbookSessionStore((state) => state.runtime.pointerPointsByUser);
  const workbookSessionTooling = useWorkbookSessionStore((state) => state.tooling);
  const workbookSessionPage = useWorkbookSessionStore((state) => state.page);
  const workbookSessionData = useWorkbookSessionStore((state) => state.data);
  const workbookSessionActions = useWorkbookSessionStore((state) => state.actions);
  const workbookSessionCollab = useMemo(
    () => ({
      latestSeq,
      realtimeSyncWarning,
      isWorkbookStreamConnected,
      isWorkbookLiveConnected,
    }),
    [latestSeq, realtimeSyncWarning, isWorkbookStreamConnected, isWorkbookLiveConnected]
  );
  const workbookSessionScene = useMemo(
    () => ({
      selectedObjectId,
      selectedConstraintId,
      canvasViewport,
      viewportZoom,
    }),
    [selectedObjectId, selectedConstraintId, canvasViewport, viewportZoom]
  );

  useEffect(() => {
    workbookSessionActions.resetForSession();
  }, [sessionId, workbookSessionActions]);

  const {
    isSessionChatOpen,
    isSessionChatMinimized,
    isSessionChatMaximized,
    isParticipantsCollapsed,
    contextbarPosition,
    floatingPanelsTop,
  } = workbookSessionUi;
  const {
    session,
    boardStrokes,
    boardObjects,
    constraints,
    annotationStrokes,
    chatMessages,
    comments,
    timerState,
    boardSettings,
    libraryState,
    documentState,
  } = workbookSessionData;
  const refs = useWorkbookSessionRefs();
  const {
    tool,
    penToolSettings,
    highlighterToolSettings,
    eraserRadius,
    strokeColor,
    strokeWidth,
    polygonSides,
    polygonMode,
    polygonPreset,
    lineStyle,
    lineWidthDraft,
    shape2dStrokeWidthDraft,
    dividerWidthDraft,
    solid3dStrokeWidthDraft,
    graphExpressionDraft,
    graphDraftFunctions,
    selectedGraphPresetId,
    graphDraftError,
    graphFunctionsDraft,
    graphCatalogCursorActive,
    pendingSolid3dInsertPreset,
    graphWorkbenchTab,
    activeSolidSectionId,
    solid3dSectionPointCollecting,
    solid3dDraftPoints,
  } = workbookSessionTooling;
  const {
    setLatestSeq,
    setRealtimeSyncWarning,
    setIsSessionChatOpen,
    setIsSessionChatMinimized,
    setIsParticipantsCollapsed,
    setContextbarPosition,
    setFloatingPanelsTop,
    setSelectedObjectId,
    setSelectedConstraintId,
    setCanvasViewport,
    setViewportZoom,
    setFocusPoint,
    setPointerPoint,
    setFocusPointsByUser,
    setPointerPointsByUser,
    setTool,
    setPenToolSettings,
    setHighlighterToolSettings,
    setEraserRadius,
    setStrokeColor,
    setStrokeWidth,
    setPolygonSides,
    setPolygonMode,
    setPolygonPreset,
    setGraphExpressionDraft,
    setGraphDraftFunctions,
    setSelectedGraphPresetId,
    setGraphDraftError,
    setGraphFunctionsDraft,
    setGraphCatalogCursorActive,
    setPendingSolid3dInsertPreset,
    setGraphWorkbenchTab,
    setSolid3dInspectorTab,
    setActiveSolidSectionId,
    setSolid3dSectionPointCollecting,
    setSolid3dDraftPoints,
    setIsFullscreen,
    setIsCompactViewport,
    setIsDockedContextbarViewport,
    setUtilityTab,
    setIsUtilityPanelOpen,
    setIsUtilityPanelCollapsed,
    setUtilityPanelPosition,
    setUtilityPanelDragState,
    setObjectContextMenu,
    setShapeVertexContextMenu,
    setLineEndpointContextMenu,
    setSolid3dVertexContextMenu,
    setSolid3dSectionVertexContextMenu,
    setSolid3dSectionContextMenu,
    setSelectedTextDraft,
    setError,
    setSaveSyncWarning,
    setCopyingInviteLink,
    setMenuAnchor,
    setExportingSections,
    setIsBoardPageMutationPending,
    setCanvasVisibilityMode,
    setDocsWindow,
    setUploadingDoc,
    setUploadProgress,
    setPendingClearRequest,
    setAwaitingClearRequest,
    setConfirmedClearRequest,
    setIncomingStrokePreviews,
    setIncomingEraserPreviews,
    setIsSessionChatAtBottom,
    setSessionChatDraft,
    setIsSessionChatEmojiOpen,
    setSessionChatReadAt,
    setAreaSelection,
    setAreaSelectionContextMenu,
    setSaveState,
    setUndoDepth,
    setRedoDepth,
    setBoardStrokes,
    setBoardObjects,
    setConstraints,
    setAnnotationStrokes,
    setChatMessages,
    setComments,
    setTimerState,
    setBoardSettings,
    setLibraryState,
    setDocumentState,
  } = workbookSessionActions;
  const {
    spacePanActive,
    isFullscreen,
    isCompactViewport,
    isDockedContextbarViewport,
    utilityTab,
    isUtilityPanelOpen,
    isUtilityPanelCollapsed,
    utilityPanelPosition,
    utilityPanelDragState,
    selectedLineStartLabelDraft,
    selectedLineEndLabelDraft,
    loading,
    bootstrapReady,
    error,
    saveSyncWarning,
    isSessionTabPassive,
    exportingSections,
    isBoardPageMutationPending,
    canvasVisibilityMode,
    docsWindow,
    pendingClearRequest,
    awaitingClearRequest,
    confirmedClearRequest,
    incomingStrokePreviews,
    isSessionChatAtBottom,
    sessionChatDraft,
    sessionChatReadAt,
    areaSelection,
  } = workbookSessionPage;
  const {
    selectedTextDraftValueRef,
    selectedTextDraftObjectIdRef,
    selectedTextDraftDirtyRef,
    selectedTextDraftCommitTimerRef,
    shapeAngleDraftValuesRef,
    shapeAngleDraftCommitTimersRef,
    shapeAngleDraftObjectIdRef,
    shapeSegmentDraftValuesRef,
    shapeSegmentDraftCommitTimersRef,
    shapeSegmentDraftObjectIdRef,
    graphCatalogCursorTimeoutRef,
    suppressAutoPanelSelectionRef,
    areaSelectionClipboardRef,
    sessionRootRef,
    sessionHeadRef,
    workspaceRef,
    utilityPanelRef,
    boardFileInputRef,
    docsInputRef,
    focusResetTimersByUserRef,
    dirtyRef,
    laserClearInFlightRef,
    autosaveDebounceRef,
    dirtyRevisionRef,
    pendingAutosaveAfterSaveRef,
    persistSnapshotsRef,
    undoStackRef,
    redoStackRef,
    latestSeqRef,
    processedEventIdsRef,
    applyHistoryOperationsRef,
    sessionChatListRef,
    sessionChatRef,
    contextbarRef,
    sessionChatShouldScrollToUnreadRef,
    sessionChatDragStateRef,
    contextbarDragStateRef,
    boardObjectsRef,
    boardObjectIndexByIdRef,
    boardStrokesRef,
    annotationStrokesRef,
    constraintsRef,
    boardSettingsRef,
    documentStateRef,
    queuedBoardSettingsCommitRef,
    queuedBoardSettingsHistoryBeforeRef,
    boardSettingsCommitTimerRef,
    boardSettingsCommitInFlightRef,
    objectUpdateQueuedPatchRef,
    objectUpdateTimersRef,
    objectUpdateInFlightRef,
    objectUpdateDispatchOptionsRef,
    objectUpdateHistoryBeforeRef,
    objectPreviewQueuedPatchRef,
    objectPreviewQueuedAtRef,
    objectPreviewVersionRef,
    incomingPreviewQueuedPatchRef,
    incomingPreviewVersionByAuthorObjectRef,
    strokePreviewQueuedByIdRef,
    strokePreviewQueuedAtRef,
    eraserPreviewQueuedByGestureRef,
    eraserPreviewQueuedAtRef,
    finalizedStrokePreviewIdsRef,
    localPreviewQueuedPatchRef,
    localPreviewFrameRef,
    workbookLiveSendRef,
    volatileSyncTimerRef,
    viewportSyncLastSentAtRef,
    viewportSyncQueuedOffsetRef,
  } = refs;

  const fallbackBackPath = "/workbook";
  const fromPath = searchParams.get("from") || fallbackBackPath;
  const isWorkbookSessionAuthLost = isAuthReady && !user;

  useEffect(() => {
    if (!isWorkbookSessionAuthLost) return;
    workbookSessionActions.setLoading(true);
    if (isAuthReady) {
      openAuthModal();
    }
    if (typeof window === "undefined") {
      navigate("/", { replace: true });
      return;
    }
    const redirectRaf = window.requestAnimationFrame(() => {
      navigate("/", { replace: true });
    });
    return () => window.cancelAnimationFrame(redirectRaf);
  }, [isAuthReady, isWorkbookSessionAuthLost, navigate, openAuthModal, workbookSessionActions]);

  const {
    isEnded,
    actorParticipant,
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
    realtimeBackpressureV2Enabled,
    volatilePreviewMaxPerFlush,
    volatilePreviewQueueMax,
    isLivekitConnected,
    micEnabled,
    setMicEnabled,
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
  } = useWorkbookSessionDerivedState({
    sessionId,
    user,
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
  });
  const showSidebarParticipantsInLayout = showSidebarParticipants;
  const {
    clampedEraserRadius,
    resetToolRuntimeToSelect,
    activateTool,
    handlePenToolSettingsChange,
    handleHighlighterToolSettingsChange,
    handleEraserRadiusChange,
    handleTransformStrokeWidthChange,
  } = useWorkbookToolRuntimeHandlers({
    tool,
    penToolSettings,
    highlighterToolSettings,
    eraserRadius,
    strokeColor,
    strokeWidth,
    setTool,
    setPenToolSettings,
    setHighlighterToolSettings,
    setEraserRadius,
    setStrokeColor,
    setStrokeWidth,
    eraserRadiusMin: ERASER_RADIUS_MIN,
    eraserRadiusMax: ERASER_RADIUS_MAX,
  });
  const [toolSettingsPopoverState, setToolSettingsPopoverState] =
    useState<WorkbookToolSettingsPopoverState>(null);
  const handleCloseToolSettingsPopover = useCallback(() => {
    setToolSettingsPopoverState(null);
  }, []);
  const handleToolContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, nextTool: WorkbookTool) => {
      let menuTool: WorkbookToolSettingsPopoverTool | null = null;
      if (nextTool === "pen" || nextTool === "highlighter" || nextTool === "eraser") {
        menuTool = nextTool;
      }
      if (!menuTool) return;
      event.preventDefault();
      setToolSettingsPopoverState({
        tool: menuTool,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );

  const {
    scheduleLocalPreviewBoardObjectPatch,
    clearLocalPreviewPatchRuntime,
    areParticipantsEqual,
    participantCards,
  } = useWorkbookSessionLocalRuntime({
    boardStrokes,
    boardStrokesRef,
    boardObjects,
    boardObjectsRef,
    boardObjectIndexByIdRef,
    setBoardObjects,
    annotationStrokes,
    annotationStrokesRef,
    constraints,
    constraintsRef,
    boardSettings,
    boardSettingsRef,
    documentState,
    documentStateRef,
    localPreviewFrameRef,
    localPreviewQueuedPatchRef,
    showCollaborationPanels,
    setIsParticipantsCollapsed,
    canAccessBoardSettingsPanel,
    utilityTab,
    setIsUtilityPanelOpen,
    canManageSharedBoardSettings,
    queuedBoardSettingsCommitRef,
    queuedBoardSettingsHistoryBeforeRef,
    boardSettingsCommitInFlightRef,
    boardSettingsCommitTimerRef,
    sessionParticipants: session?.participants,
    participantVisibilityGraceMs: PARTICIPANT_VISIBILITY_GRACE_MS,
    resetToolRuntimeToSelect,
    sessionId,
    latestSeq,
    latestSeqRef,
  });

  const {
    sessionChatReadStorageKey,
    contextbarStorageKey,
    sessionTabLockStorageKey,
    sessionTabLockChannelName,
    personalBoardSettingsStorageKey,
    sessionChatUnreadCount,
    firstUnreadSessionChatMessageId,
    markSessionChatReadToLatest,
    scrollSessionChatToLatest,
    scrollSessionChatToMessage,
    filterUnseenWorkbookEvents,
    recoverChatMessagesFromEvents,
  } = useWorkbookSessionChatEventHandlers({
    sessionId,
    userId: user?.id,
    actorUserId: actorParticipant?.userId,
    chatMessages,
    sessionChatReadAt,
    setSessionChatReadAt,
    setIsSessionChatAtBottom,
    sessionChatListRef,
    latestSeqRef,
    lastAppliedSeqRef: refs.lastAppliedSeqRef,
    processedEventIdsRef,
  });

  useWorkbookSessionContextbar({
    contextbarStorageKey,
    isCompactViewport,
    isDockedContextbarViewport,
    isUtilityPanelOpen,
    contextbarPosition,
    sessionHeadRef,
    contextbarRef,
    contextbarDragStateRef,
    setIsCompactViewport,
    setIsDockedContextbarViewport,
    setIsUtilityPanelCollapsed,
    setFloatingPanelsTop,
    setContextbarPosition,
  });

  const {
    scheduleIncomingEraserPreviewExpiry,
    queueIncomingStrokePreview,
    queueIncomingPreviewPatch,
    applyLocalBoardObjects,
    commitInteractiveBoardObjects,
    clearObjectSyncRuntime,
    clearIncomingEraserPreviewRuntime,
    clearStrokePreviewRuntime,
    finalizeStrokePreview,
  } = useWorkbookSessionIncomingRuntime({
    refs,
    setBoardObjects,
    setIncomingStrokePreviews,
    setIncomingEraserPreviews,
  });

  const {
    restoreSceneSnapshot,
    scheduleAutosave,
    markDirty,
    pushHistoryEntry,
    rollbackHistoryEntry,
    buildHistoryEntryFromEvents,
  } = useWorkbookSessionHistoryRuntime({
    boardObjectsRef,
    boardObjectIndexByIdRef,
    setBoardStrokes,
    setBoardObjects,
    setConstraints,
    setAnnotationStrokes,
    setChatMessages,
    setComments,
    setTimerState,
    setBoardSettings,
    setLibraryState,
    setDocumentState,
    autosaveDebounceRef,
    persistSnapshotsRef,
    dirtyRef,
    dirtyRevisionRef,
    pendingAutosaveAfterSaveRef,
    setSaveState,
    undoStackRef,
    redoStackRef,
    setUndoDepth,
    setRedoDepth,
    boardStrokesRef,
    annotationStrokesRef,
    constraintsRef,
    boardSettingsRef,
    documentStateRef,
  });

  const applyIncomingEvents = useCallback(
    (events: WorkbookEvent[]) => {
      applyWorkbookIncomingEventsBatch({
        sessionId,
        events,
        userId: user?.id,
        selectedObjectId,
        awaitingClearRequest,
        lastAppliedSeqRef: refs.lastAppliedSeqRef,
        lastAppliedBoardSettingsSeqRef: refs.lastAppliedBoardSettingsSeqRef,
        refs,
        actions: workbookSessionActions,
        areParticipantsEqual,
        restoreSceneSnapshot,
        clearObjectSyncRuntime,
        clearStrokePreviewRuntime,
        clearIncomingEraserPreviewRuntime,
        scheduleIncomingEraserPreviewExpiry,
        queueIncomingStrokePreview,
        finalizeStrokePreview,
        queueIncomingPreviewPatch,
        applyLocalBoardObjects,
      });
    },
    [
      user?.id,
      sessionId,
      selectedObjectId,
      awaitingClearRequest,
      refs.lastAppliedSeqRef,
      refs.lastAppliedBoardSettingsSeqRef,
      refs,
      workbookSessionActions,
      areParticipantsEqual,
      restoreSceneSnapshot,
      clearObjectSyncRuntime,
      clearStrokePreviewRuntime,
      clearIncomingEraserPreviewRuntime,
      scheduleIncomingEraserPreviewExpiry,
      queueIncomingStrokePreview,
      finalizeStrokePreview,
      queueIncomingPreviewPatch,
      applyLocalBoardObjects,
    ]
  );

  const {
    persistSnapshots,
    handleRealtimeAuthRequired,
    handleRealtimeConflict,
    enqueueIncomingRealtimeApply,
  } = useWorkbookSessionRealtimeLifecycle(
    buildWorkbookSessionRealtimeLifecycleParams({
      sessionId,
      userId: user?.id,
      isWorkbookSessionAuthLost,
      bootstrapReady,
      isLivekitConnected,
      isTeacherActor,
      canUseSessionChat,
      isSessionChatOpen,
      isSessionChatMinimized,
      isSessionChatMaximized,
      isSessionChatAtBottom,
      isCompactViewport,
      adaptivePollingEnabled,
      clampedEraserRadius,
      collab: workbookSessionCollab,
      page: workbookSessionPage,
      data: workbookSessionData,
      tooling: workbookSessionTooling,
      actions: workbookSessionActions,
      refs,
      applyIncomingEvents,
      clearLocalPreviewPatchRuntime,
      clearObjectSyncRuntime,
      clearStrokePreviewRuntime,
      clearIncomingEraserPreviewRuntime,
      filterUnseenWorkbookEvents,
      recoverChatMessagesFromEvents,
      markSessionChatReadToLatest,
      scrollSessionChatToLatest,
      scrollSessionChatToMessage,
      sessionChatReadStorageKey,
      sessionTabLockStorageKey,
      sessionTabLockChannelName,
      personalBoardSettingsStorageKey,
      firstUnreadSessionChatMessageId,
      areParticipantsEqual,
      pollIntervalMs: POLL_INTERVAL_MS,
      pollIntervalStreamConnectedMs: POLL_INTERVAL_STREAM_CONNECTED_MS,
      resyncMinIntervalMs: RESYNC_MIN_INTERVAL_MS,
      adaptivePollingMinMs: ADAPTIVE_POLLING_MIN_MS,
      adaptivePollingMaxMs: ADAPTIVE_POLLING_MAX_MS,
      tabLockHeartbeatMs: TAB_LOCK_HEARTBEAT_MS,
      presenceIntervalMs: PRESENCE_INTERVAL_MS,
      autosaveIntervalMs: AUTOSAVE_INTERVAL_MS,
      sessionChatScrollBottomThresholdPx: SESSION_CHAT_SCROLL_BOTTOM_THRESHOLD_PX,
      scheduleAutosave,
    })
  );

  useWorkbookSessionCleanupEffects({
    focusResetTimersByUserRef,
    autosaveDebounceRef,
    volatileSyncTimerRef,
    viewportSyncQueuedOffsetRef,
    eraserPreviewQueuedByGestureRef,
    eraserPreviewQueuedAtRef,
    clearLocalPreviewPatchRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    clearIncomingEraserPreviewRuntime,
    setIncomingStrokePreviews,
    strokePreviewExpiryMs: STROKE_PREVIEW_EXPIRY_MS,
  });

  const { sendWorkbookLiveEvents, appendEventsAndApply } = useWorkbookEventCommitPipeline({
    sessionId,
    isWorkbookLiveConnected,
    realtimeBackpressureV2Enabled,
    workbookLiveSendRef,
    latestSeqRef,
    processedEventIdsRef,
    setLatestSeq,
    buildHistoryEntryFromEvents,
    filterUnseenWorkbookEvents,
    markDirty,
    handleRealtimeAuthRequired,
    handleRealtimeConflict,
    pushHistoryEntry,
    rollbackHistoryEntry,
    enqueueIncomingRealtimeApply,
  });

  const {
    scheduleVolatileSyncFlush,
    handleCanvasViewportOffsetChange,
    queueStrokePreview,
    queueEraserPreview,
  } = useWorkbookVolatileSyncPipeline({
    sessionId,
    session,
    isEnded,
    canDraw,
    canSelect,
    realtimeBackpressureV2Enabled,
    volatilePreviewMaxPerFlush,
    volatilePreviewQueueMax,
    sendWorkbookLiveEvents,
    setCanvasViewport,
    volatileSyncTimerRef,
    viewportSyncLastSentAtRef,
    viewportSyncQueuedOffsetRef,
    objectPreviewQueuedPatchRef,
    objectPreviewQueuedAtRef,
    objectPreviewVersionRef,
    strokePreviewQueuedByIdRef,
    strokePreviewQueuedAtRef,
    finalizedStrokePreviewIdsRef,
    eraserPreviewQueuedByGestureRef,
    eraserPreviewQueuedAtRef,
  });

  const { flushQueuedObjectUpdate } = useWorkbookObjectUpdateQueue({
    appendEventsAndApply,
    setError,
    objectUpdateTimersRef,
    objectUpdateInFlightRef,
    objectUpdateQueuedPatchRef,
    objectUpdateDispatchOptionsRef,
    objectUpdateHistoryBeforeRef,
    localPreviewQueuedPatchRef,
    incomingPreviewQueuedPatchRef,
    objectPreviewQueuedPatchRef,
    objectPreviewQueuedAtRef,
  });

  const { clearLayerNow, handleConfirmClear } = useWorkbookLayerClearActions({
    chatMessages,
    comments,
    timerState,
    libraryState,
    userId: user?.id,
    pendingClearRequest,
    confirmedClearRequest,
    boardStrokesRef,
    boardObjectsRef,
    constraintsRef,
    annotationStrokesRef,
    boardSettingsRef,
    documentStateRef,
    focusResetTimersByUserRef,
    setBoardStrokes,
    applyLocalBoardObjects,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    clearIncomingEraserPreviewRuntime,
    setFocusPoint,
    setPointerPoint,
    setFocusPointsByUser,
    setPointerPointsByUser,
    setConstraints,
    setSelectedObjectId,
    setSelectedConstraintId,
    setAnnotationStrokes,
    setPendingClearRequest,
    setAwaitingClearRequest,
    setConfirmedClearRequest,
    appendEventsAndApply,
    markDirty,
    restoreSceneSnapshot,
    setError,
  });

  const {
    handleSharedBoardSettingsChange,
    handleSelectBoardPage,
    handleAddBoardPage,
    handleDeleteBoardPage,
  } = useWorkbookBoardSettingsPages({
    canManageSharedBoardSettings,
    canDelete,
    isBoardPageMutationPending,
    appendEventsAndApply,
    boardSettingsRef,
    boardObjectsRef,
    boardStrokesRef,
    annotationStrokesRef,
    queuedBoardSettingsCommitRef,
    queuedBoardSettingsHistoryBeforeRef,
    boardSettingsCommitTimerRef,
    boardSettingsCommitInFlightRef,
    setBoardSettings,
    setError,
    setIsBoardPageMutationPending,
  });

  const { upsertLibraryItem } = useWorkbookLibraryAndTimerActions({
    appendEventsAndApply,
    setError,
    timerState,
    setTimerState,
  });

  const {
    toggleFullscreen,
    zoomIn,
    zoomOut,
    resetZoom,
    openUtilityPanel,
    handleUtilityPanelDragStart,
    activateGraphCatalogCursor,
    utilityPanelTitle,
  } = useWorkbookUtilityPanelController({
    boardObjects,
    selectedObjectId,
    canvasViewport,
    viewportZoom,
    floatingPanelsTop,
    isCompactViewport,
    isFullscreen,
    isUtilityPanelOpen,
    isUtilityPanelCollapsed,
    utilityTab,
    utilityPanelPosition,
    utilityPanelDragState,
    canAccessBoardSettingsPanel,
    sessionRootRef,
    workspaceRef,
    utilityPanelRef,
    graphCatalogCursorTimeoutRef,
    setError,
    setIsFullscreen,
    setViewportZoom,
    setUtilityTab,
    setIsUtilityPanelOpen,
    setIsUtilityPanelCollapsed,
    setUtilityPanelPosition,
    setUtilityPanelDragState,
    setGraphCatalogCursorActive,
  });

  const { applyConstraintsForObject } = useWorkbookConstraintResolver({
    constraints,
    strictGeometryEnabled: Boolean(session?.settings?.strictGeometry),
  });

  const { applyLocalStrokeCollection, applyHistoryOperations } =
    useWorkbookHistoryOperationsApply({
      setAnnotationStrokes,
      setBoardStrokes,
      applyLocalBoardObjects,
      finalizeStrokePreview,
      setBoardSettings,
      setConstraints,
      setDocumentState,
      setSelectedConstraintId,
      setSelectedObjectId,
      objectUpdateQueuedPatchRef,
      objectUpdateDispatchOptionsRef,
      objectUpdateHistoryBeforeRef,
      objectPreviewQueuedPatchRef,
      objectPreviewQueuedAtRef,
      objectPreviewVersionRef,
      incomingPreviewQueuedPatchRef,
      objectUpdateInFlightRef,
      incomingPreviewVersionByAuthorObjectRef,
      objectUpdateTimersRef,
    });
  useEffect(() => {
    applyHistoryOperationsRef.current = applyHistoryOperations;
  }, [applyHistoryOperations, applyHistoryOperationsRef]);

  const {
    commitStrokePreview,
    commitStroke,
    commitStrokeDelete,
    commitStrokeReplace,
    commitEraserBatch,
  } = useWorkbookStrokeCommitHandlers({
    sessionId,
    canDraw,
    canDelete,
    boardSettingsCurrentPage: boardSettings.currentPage,
    queueStrokePreview,
    finalizeStrokePreview,
    applyLocalStrokeCollection,
    appendEventsAndApply,
    setError,
    setSaveSyncWarning,
    setBoardStrokes,
    setAnnotationStrokes,
    applyLocalBoardObjects,
    boardStrokesRef,
    annotationStrokesRef,
    boardObjectsRef,
    commitInteractiveBoardObjects,
    markDirty,
  });

  const {
    commitObjectCreate,
    commitObjectUpdate,
    commitObjectPin,
    commitObjectReorder,
  } = useWorkbookObjectMutationHandlers({
    sessionId,
    canDraw,
    canSelect,
    canManageSession,
    boardSettingsCurrentPage: boardSettings.currentPage,
    activeSceneLayerId,
    userId: user?.id,
    volatilePreviewQueueMax,
    realtimeBackpressureV2Enabled,
    boardObjectsRef,
    boardObjectIndexByIdRef,
    objectUpdateQueuedPatchRef,
    objectUpdateDispatchOptionsRef,
    objectUpdateHistoryBeforeRef,
    objectPreviewQueuedPatchRef,
    objectPreviewQueuedAtRef,
    setSelectedObjectId,
    setError,
    appendEventsAndApply,
    sendWorkbookLiveEvents,
    upsertLibraryItem,
    commitInteractiveBoardObjects,
    handleRealtimeConflict,
    applyConstraintsForObject,
    scheduleLocalPreviewBoardObjectPatch,
    scheduleVolatileSyncFlush,
    flushQueuedObjectUpdate,
  });

  const { commitObjectDelete } = useWorkbookObjectDeleteHandler({
    sessionId,
    canDelete,
    selectedObjectId,
    selectedConstraintId,
    boardObjectsRef,
    constraintsRef,
    boardSettingsRef,
    objectUpdateQueuedPatchRef,
    objectUpdateDispatchOptionsRef,
    objectUpdateHistoryBeforeRef,
    objectPreviewQueuedPatchRef,
    objectPreviewQueuedAtRef,
    localPreviewQueuedPatchRef,
    objectPreviewVersionRef,
    incomingPreviewVersionByAuthorObjectRef,
    objectUpdateTimersRef,
    objectUpdateInFlightRef,
    setConstraints,
    setBoardSettings,
    setSelectedObjectId,
    setSelectedConstraintId,
    setError,
    appendEventsAndApply,
    commitInteractiveBoardObjects,
    handleRealtimeConflict,
    getObjectSceneLayerId,
  });

  const { scaleObject, mirrorSelectedObject } = useWorkbookObjectTransformHandlers({
    canSelect,
    selectedObjectId,
    boardObjects,
    boardObjectsRef,
    commitObjectUpdate,
  });

  const {
    deleteAreaSelectionObjects,
    copyAreaSelectionObjects,
    pasteAreaSelectionObjects,
    cutAreaSelectionObjects,
    cropImageByAreaSelection,
    restoreImageOriginalView,
  } = useWorkbookAreaSelectionClipboardHandlers({
    canDelete,
    canSelect,
    areaSelection,
    areaSelectionHasContent,
    boardSettings,
    selectedObjectId,
    userId: user?.id,
    sceneLayers: normalizedSceneLayers.sceneLayers,
    boardObjectsRef,
    areaSelectionClipboardRef,
    boardStrokes,
    annotationStrokes,
    getObjectSceneLayerId,
    appendEventsAndApply,
    commitObjectUpdate,
    setAreaSelection,
    setAreaSelectionContextMenu,
    setSelectedObjectId,
    setError,
  });

  const {
    createCompositionFromAreaSelection,
    dissolveCompositionLayer,
  } = useWorkbookCompositionLayerHandlers({
    canSelect,
    areaSelection,
    boardObjects,
    boardSettings,
    sceneLayers: normalizedSceneLayers.sceneLayers,
    getObjectSceneLayerId,
    appendEventsAndApply,
    setAreaSelectionContextMenu,
    setError,
  });

  const handleCanvasSelectedObjectChange = useCallback(
    (nextObjectId: string | null) => {
      const suppressedObjectId = suppressAutoPanelSelectionRef.current;
      setSelectedConstraintId(null);
      setSelectedObjectId(nextObjectId);
      if (!nextObjectId) return;
      if (suppressedObjectId === nextObjectId) {
        suppressAutoPanelSelectionRef.current = null;
        return;
      }
      const targetObject = boardObjects.find((item) => item.id === nextObjectId) ?? null;
      if (supportsGraphUtilityPanel(targetObject)) {
        openUtilityPanel("graph", {
          toggle: false,
          anchorObject: targetObject,
        });
        return;
      }
      if (supportsTransformUtilityPanel(targetObject)) {
        openUtilityPanel("transform", {
          toggle: false,
          anchorObject: targetObject,
        });
      }
    },
    [
      boardObjects,
      openUtilityPanel,
      setSelectedConstraintId,
      setSelectedObjectId,
      suppressAutoPanelSelectionRef,
    ]
  );

  const handleCanvasObjectCreate = useCallback(
    (object: Parameters<typeof commitObjectCreate>[0]) => {
      suppressAutoPanelSelectionRef.current = object.id;
      void commitObjectCreate(object);
    },
    [commitObjectCreate, suppressAutoPanelSelectionRef]
  );

  const getLatestCanvasObject = useCallback(
    (objectId: string) => boardObjects.find((item) => item.id === objectId) ?? null,
    [boardObjects]
  );

  const selectedGraphTextActions = useWorkbookSelectedGraphTextActions({
    selectedObjectId,
    canSelect,
    boardObjects,
    boardObjectsRef,
    boardObjectIndexByIdRef,
    selectedLineStartLabelDraft,
    selectedLineEndLabelDraft,
    lineWidthDraft,
    graphExpressionDraft,
    graphFunctionsDraft,
    setGraphFunctionsDraft,
    setGraphDraftFunctions,
    setGraphExpressionDraft,
    setGraphDraftError,
    commitObjectUpdate,
    applyLocalBoardObjects,
    selectedTextDraftValueRef,
    selectedTextDraftObjectIdRef,
    selectedTextDraftDirtyRef,
    selectedTextDraftCommitTimerRef,
  });

  const selectedStructureActions = useWorkbookSelectedStructureActions({
    selectedObjectId,
    canSelect,
    canDraw,
    canDelete,
    sessionId,
    activeSceneLayerId,
    userId: user?.id,
    boardObjects,
    boardObjectsRef,
    dividerWidthDraft,
    setSelectedObjectId,
    setError,
    commitObjectUpdate,
    appendEventsAndApply,
  });

  const selectedShape2dActions = useWorkbookSelectedShape2dActions({
    selectedObjectId,
    canSelect,
    boardObjects,
    shape2dStrokeWidthDraft,
    commitObjectUpdate,
    shapeAngleDraftValuesRef,
    shapeAngleDraftCommitTimersRef,
    shapeAngleDraftObjectIdRef,
    shapeSegmentDraftValuesRef,
    shapeSegmentDraftCommitTimersRef,
    shapeSegmentDraftObjectIdRef,
  });

  const solid3dSectionDraftHandlers = useWorkbookSolid3dSectionDraftHandlers({
    boardObjects,
    solid3dSectionPointCollecting,
    solid3dDraftPoints,
    setSolid3dDraftPoints,
    setSolid3dSectionPointCollecting,
    setSelectedObjectId,
    setActiveSolidSectionId,
    setError,
    commitObjectUpdate,
  });

  const mathPresetCreationHandlers = useWorkbookMathPresetCreationHandlers({
    canDraw,
    tool,
    boardObjectCount: boardObjects.length,
    boardGridSize: boardSettings.gridSize,
    userId: user?.id,
    pendingSolid3dInsertPreset,
    setPendingSolid3dInsertPreset,
    setSelectedObjectId,
    setSelectedConstraintId,
    setGraphDraftError,
    setGraphWorkbenchTab,
    resetToolRuntimeToSelect,
    activateTool,
    setSuppressAutoPanelSelectionObjectId: (objectId) => {
      suppressAutoPanelSelectionRef.current = objectId;
    },
    commitObjectCreate,
  });

  const { handleLaserPoint, clearLaserPointer } = useWorkbookLaserHandlers({
    canUseLaser,
    userId: user?.id,
    tool,
    pointerPoint,
    appendEventsAndApply,
    setError,
    setPointerPoint,
    setFocusPoint,
    setPointerPointsByUser,
    setFocusPointsByUser,
    focusResetTimersByUserRef,
    laserClearInFlightRef,
    resetToolRuntimeToSelect,
  });

  const { handleUndo, handleRedo } = useWorkbookHistoryHotkeys({
    canUseUndo,
    tool,
    areaSelectionHasContent,
    appendEventsAndApply,
    setError,
    undoStackRef,
    redoStackRef,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    clearIncomingEraserPreviewRuntime,
    setUndoDepth,
    setRedoDepth,
    applyHistoryOperations,
    markDirty,
    deleteAreaSelectionObjects,
    copyAreaSelectionObjects,
    cutAreaSelectionObjects,
    pasteAreaSelectionObjects,
  });

  const {
    handleObjectContextMenu,
    handleShapeVertexContextMenu,
    handleLineEndpointContextMenu,
    handleSolid3dVertexContextMenu,
    handleSolid3dSectionVertexContextMenu,
    handleSolid3dSectionContextMenu,
  } = useWorkbookContextMenuHandlers({
    boardObjects,
    setObjectContextMenu,
    setShapeVertexContextMenu,
    setLineEndpointContextMenu,
    setSolid3dVertexContextMenu,
    setSolid3dSectionVertexContextMenu,
    setSolid3dSectionContextMenu,
    setSelectedObjectId,
    setActiveSolidSectionId,
    getSolidVertexLabel,
    getSectionVertexLabel,
  });

  const {
    handleCopyInviteLink,
    handleMenuClearBoard,
    handleToggleParticipantBoardTools,
    handleToggleParticipantChat,
    handleToggleParticipantMic,
    handleSendSessionChatMessage,
    handleClearSessionChat,
    handleSessionChatDragStart,
  } = useWorkbookSessionCollabHandlers({
    sessionId,
    user: user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      : undefined,
    actorDisplayName: actorParticipant?.displayName,
    canClear,
    isEnded,
    canManageSession,
    canSendSessionChat,
    sessionChatDraft,
    chatMessages,
    isCompactViewport,
    isSessionChatMinimized,
    isSessionChatMaximized,
    sessionChatRef,
    sessionChatDragStateRef,
    setCopyingInviteLink,
    setError,
    setMenuAnchor,
    setChatMessages,
    setSessionChatDraft,
    setIsSessionChatEmojiOpen,
    setIsSessionChatAtBottom,
    scrollSessionChatToLatest,
    markSessionChatReadToLatest,
    clearLayerNow,
    appendEventsAndApply,
  });

  const {
    updateDocumentState,
    importDocumentFile,
    handleDocumentSnapshotToBoard,
    handleAddDocumentAnnotation,
    handleClearDocumentAnnotations,
    handleLoadBoardFile,
  } = useWorkbookSessionDocumentHandlers({
    sessionId,
    canInsertImage,
    userId: user?.id,
    canvasViewport,
    boardObjectCount: boardObjects.length,
    documentState,
    setError,
    setUploadingDoc,
    setUploadProgress,
    setBoardStrokes,
    setBoardObjects,
    setConstraints,
    setChatMessages,
    setComments,
    setTimerState,
    setBoardSettings,
    setLibraryState,
    setDocumentState,
    boardObjectsRef,
    boardObjectIndexByIdRef,
    appendEventsAndApply,
    commitObjectCreate,
    upsertLibraryItem,
    persistSnapshots,
  });

  const {
    isImportModalOpen,
    pendingImportFiles,
    openImportModal,
    handleDocsUploadToModal,
    handleImportModalClose,
    handleImportModalFile,
    handleWorkspaceDragOver,
    handleWorkspaceDrop,
  } = useWorkbookImportModalController({
    canInsertImage,
    isEnded,
    importDocumentFile,
  });

  const panelHandlers = useWorkbookSessionPanelHandlers({
    setDocsWindow,
    clickDocsInput: () => {
      openImportModal();
    },
    snapshotDocumentToBoard: () => {
      void handleDocumentSnapshotToBoard();
    },
    addDocumentAnnotation: () => {
      void handleAddDocumentAnnotation();
    },
    clearDocumentAnnotations: () => {
      void handleClearDocumentAnnotations();
    },
    selectDocumentAsset: (assetId) => {
      void updateDocumentState({ activeAssetId: assetId });
    },
    setDocumentPage: (page) => {
      void updateDocumentState({ page });
    },
    setDocumentZoom: (zoom) => {
      void updateDocumentState({ zoom });
    },
    createFunctionGraphPlane: () => {
      void mathPresetCreationHandlers.createFunctionGraphPlane();
    },
    selectGraphPlane: (planeId) => {
      setSelectedObjectId(planeId);
      resetToolRuntimeToSelect();
    },
    updateFunctionGraphAppearance:
      selectedGraphTextActions.updateSelectedFunctionGraphAppearance,
    setGraphWorkbenchTab,
    setGraphExpressionDraft,
    setSelectedGraphPresetId,
    clearGraphDraftError: () => {
      setGraphDraftError((current) => (current ? null : current));
    },
    appendSelectedGraphFunction: selectedGraphTextActions.appendSelectedGraphFunction,
    activateGraphCatalogCursor,
    updateSelectedGraphFunction: selectedGraphTextActions.updateSelectedGraphFunction,
    normalizeGraphExpressionDraft: selectedGraphTextActions.normalizeGraphExpressionDraft,
    commitSelectedGraphExpressions: selectedGraphTextActions.commitSelectedGraphExpressions,
    removeSelectedGraphFunction: selectedGraphTextActions.removeSelectedGraphFunction,
    reflectGraphFunctionByAxis: selectedGraphTextActions.reflectGraphFunctionByAxis,
  });

  const selectionViewportState = useWorkbookSessionSelectionViewportState(
    buildWorkbookSessionSelectionViewportParams({
      sessionId,
      scene: workbookSessionScene,
      page: workbookSessionPage,
      data: workbookSessionData,
      tooling: workbookSessionTooling,
      actions: workbookSessionActions,
      refs,
      canSelect,
      areaSelectionHasContent,
      getObjectSceneLayerId,
      getPointLimitForSolidObject: solid3dSectionDraftHandlers.getPointLimitForSolidObject,
      commitObjectUpdate,
    })
  );

  const selectedSolid3dActions = useWorkbookSelectedSolid3dActions({
    canSelect,
    selectedObjectId,
    boardObjects,
    selectedSolidMesh: selectionViewportState.selectedSolidMesh,
    selectedSolid3dState: selectionViewportState.selectedSolid3dState,
    solid3dStrokeWidthDraft,
    activeSolidSectionId,
    commitObjectUpdate,
    setError,
    setActiveSolidSectionId,
    setSolid3dSectionVertexContextMenu,
    setSolid3dInspectorTab,
    setSolid3dSectionPointCollecting,
    setSolid3dDraftPoints,
    resetToolRuntimeToSelect,
    getSolidVertexLabel,
  });

  const handleTransformDissolveCompositionLayer = useCallback(() => {
    const layerId = selectionViewportState.selectedObjectSceneLayerId;
    if (!layerId || layerId === MAIN_SCENE_LAYER_ID) {
      return;
    }
    void dissolveCompositionLayer(layerId);
  }, [dissolveCompositionLayer, selectionViewportState.selectedObjectSceneLayerId]);

  const handleTransformOpenGraphPanel = useCallback(() => {
    openUtilityPanel("graph", { toggle: false });
  }, [openUtilityPanel]);

  const transformPanelProps: WorkbookSessionTransformPanelProps =
    buildWorkbookSessionTransformPanelRuntimeProps({
      selectionViewportState,
      workbookSessionTooling,
      workbookSessionPage,
      workbookSessionActions,
      tool,
      canSelect,
      canDelete,
      clampedEraserRadius,
      handleTransformStrokeWidthChange,
      handleTransformDissolveCompositionLayer,
      handleTransformOpenGraphPanel,
      selectedGraphTextActions,
      selectedStructureActions,
      selectedShape2dActions,
      selectedSolid3dActions,
      solid3dSectionDraftHandlers,
      mirrorSelectedObject,
    });


  const { exportBoardAsPdf } = useWorkbookPdfExport({
    boardSettings,
    boardSettingsRef,
    boardObjects,
    boardStrokes,
    sessionId,
    sessionTitle: session?.title,
    exportingSections,
    setExportingSections,
    setCanvasVisibilityMode,
    setBoardSettings,
    setError,
  });

  const {
    confirmDialogOpen,
    confirmDialogContent,
    confirmActionSubmitting,
    handleRequestClearBoard,
    handleRequestExportPdf,
    handleRequestDeleteBoardPage,
    handleCloseConfirmDialog,
    handleConfirmDialogAction,
  } = useWorkbookSessionConfirmActions({
    canClear,
    isEnded,
    exportingSections,
    setMenuAnchor,
    handleMenuClearBoard,
    exportBoardAsPdf,
    handleDeleteBoardPage,
  });

  const canvasHandlers = useWorkbookCanvasHandlers({
    commitStroke,
    commitStrokeDelete,
    commitStrokeReplace,
    commitEraserBatch,
    commitObjectUpdate,
    commitObjectDelete,
    queueEraserPreview,
    setAreaSelection,
    setAreaSelectionContextMenu,
    boardObjects,
    setSelectedTextDraft,
    scheduleSelectedTextDraftCommit: selectedGraphTextActions.scheduleSelectedTextDraftCommit,
    resetToolRuntimeToSelect,
    handleLaserPoint,
    clearLaserPointer,
    isSessionChatOpen,
    setIsSessionChatOpen,
    setIsSessionChatEmojiOpen,
    setIsSessionChatAtBottom,
    setIsSessionChatMinimized,
    sessionChatShouldScrollToUnreadRef,
    setIsParticipantsCollapsed,
    setMicEnabled,
  });

  const { settingsPanelProps, graphPanelProps } =
    buildWorkbookSessionUtilityPanelProps({
      settings: {
        boardSettings,
        onSharedBoardSettingsChange: handleSharedBoardSettingsChange,
        boardPageOptions: selectionViewportState.boardPageOptions,
        canManageSharedBoardSettings,
      },
      graph: {
        graphTabUsesSelectedObject: selectionViewportState.graphTabUsesSelectedObject,
        canDraw,
        graphPlaneEntries: selectionViewportState.graphPlaneEntries,
        selectedFunctionGraphAxisColor:
          selectionViewportState.selectedFunctionGraphAxisColor,
        selectedFunctionGraphPlaneColor:
          selectionViewportState.selectedFunctionGraphPlaneColor,
        graphWorkbenchTab,
        graphExpressionDraft,
        graphDraftError,
        selectedGraphPresetId,
        graphTabFunctions: selectionViewportState.graphTabFunctions,
        onCreatePlane: panelHandlers.handleGraphPanelCreatePlane,
        onSelectPlane: panelHandlers.handleGraphPanelSelectPlane,
        onAxisColorChange: panelHandlers.handleGraphPanelAxisColorChange,
        onPlaneColorChange: panelHandlers.handleGraphPanelPlaneColorChange,
        onClearPlaneBackground: panelHandlers.handleGraphPanelClearPlaneBackground,
        onSelectCatalogTab: panelHandlers.handleGraphPanelSelectCatalogTab,
        onSelectWorkTab: panelHandlers.handleGraphPanelSelectWorkTab,
        onGraphExpressionDraftChange: panelHandlers.handleGraphPanelExpressionDraftChange,
        onAddGraphFunction: panelHandlers.handleGraphPanelAddFunction,
        onSelectGraphPreset: panelHandlers.handleGraphPanelSelectPreset,
        onGraphFunctionColorChange: panelHandlers.handleGraphPanelFunctionColorChange,
        onGraphFunctionExpressionChange: panelHandlers.handleGraphPanelFunctionExpressionChange,
        onCommitGraphExpressions: panelHandlers.handleGraphPanelCommitExpressions,
        onRemoveGraphFunction: panelHandlers.handleGraphPanelRemoveFunction,
        onToggleGraphFunctionVisibility: panelHandlers.handleGraphPanelToggleVisibility,
        onReflectGraphFunctionByAxis: panelHandlers.handleGraphPanelReflectFunction,
      },
    });

  const {
    toolButtonsBeforeCatalog,
    toolButtonsAfterCatalog,
    renderToolButton,
    shapeCatalog,
  } = useWorkbookToolCatalog({
    tool,
    canSelect,
    canDelete,
    canUseLaser,
    canDraw,
    activateTool,
    resetToolRuntimeToSelect,
    createFunctionGraphPlane: () => {
      void mathPresetCreationHandlers.createFunctionGraphPlane();
    },
    setTool,
    setPolygonMode,
    setPolygonPreset,
    setPolygonSides,
    onToolContextMenu: handleToolContextMenu,
  });
  const beforeCatalogToolButtons = useMemo(
    () => toolButtonsBeforeCatalog.map(renderToolButton),
    [toolButtonsBeforeCatalog, renderToolButton]
  );
  const afterCatalogToolButtons = useMemo(
    () => toolButtonsAfterCatalog.map(renderToolButton),
    [renderToolButton, toolButtonsAfterCatalog]
  );

  const persistSessionExitPreview = useCallback(async () => {
    if (!session || session.roleInSession !== "teacher") return;
    if (typeof window === "undefined") return;
    const previewDataUrl = await captureWorkbookSessionPreviewDataUrl(
      workspaceRef.current ?? sessionRootRef.current
    );
    if (!previewDataUrl) return;
    try {
      const uploadedPreview = await uploadWorkbookAsset({
        sessionId: session.id,
        fileName: `session-preview-${session.id}-${Date.now()}.jpg`,
        dataUrl: previewDataUrl,
        mimeType: "image/jpeg",
      });
      await updateWorkbookSessionDraftPreview({
        sessionId: session.id,
        previewUrl: uploadedPreview.url,
        previewAlt:
          typeof boardSettings.currentPage === "number" &&
          Number.isFinite(boardSettings.currentPage)
            ? `Последний вид доски · страница ${Math.max(1, Math.trunc(boardSettings.currentPage))}`
            : "Последний вид доски",
        page:
          typeof boardSettings.currentPage === "number" &&
          Number.isFinite(boardSettings.currentPage)
            ? Math.max(1, Math.trunc(boardSettings.currentPage))
            : undefined,
        viewport: {
          x: canvasViewport.x,
          y: canvasViewport.y,
          zoom: viewportZoom,
        },
      });
    } catch {
      // Hub preview capture is best-effort and must not block session exit.
    }
  }, [
    boardSettings.currentPage,
    canvasViewport.x,
    canvasViewport.y,
    session,
    sessionRootRef,
    viewportZoom,
    workspaceRef,
  ]);

  const handleBack = useCallback(async () => {
    if (dirtyRef.current) {
      const saved = await persistSnapshots({ force: true });
      if (!saved) {
        setError("Не удалось сохранить изменения перед выходом из тетради.");
        return;
      }
    }
    await persistSessionExitPreview();
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      try {
        window.opener.focus?.();
      } catch {
        // ignore opener focus errors; fallback will still close/navigate current tab
      }
      window.close();
      if (!window.closed) {
        navigate(fromPath, { replace: true });
      }
      return;
    }
    navigate(fromPath, { replace: true });
  }, [dirtyRef, fromPath, navigate, persistSessionExitPreview, persistSnapshots, setError]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSessionHeaderBack = (event: Event) => {
      event.preventDefault();
      void handleBack();
    };
    window.addEventListener("workbook:session-back-request", onSessionHeaderBack);
    return () => {
      window.removeEventListener("workbook:session-back-request", onSessionHeaderBack);
    };
  }, [handleBack]);

  const { isPageTransitionActive, transitionLabel } = useWorkbookPageTransitionOverlay({
    currentPage: boardSettings.currentPage,
    loading,
    bootstrapReady,
    boardObjectsRef,
    boardStrokesRef,
  });

  if (loading) {
    return <PageLoader />;
  }

  if (!session) {
    return (
      <section className="workbook-session workbook-session--error">
        <Alert severity="error">{error ?? "Сессия недоступна."}</Alert>
        <div className="workbook-session__error-actions">
          <Button
            variant="contained"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            Переподключиться
          </Button>
        </div>
      </section>
    );
  }

  const overlayContainer =
    sessionRootRef.current ??
    (typeof document !== "undefined" ? document.body : undefined);
  // react-hooks/refs false-positive: refs are forwarded into runtime props and not dereferenced here.
  // eslint-disable-next-line react-hooks/refs
  const canvasProps = buildWorkbookCanvasProps({
    visibleBoardStrokes: selectionViewportState.visibleBoardStrokes,
    visibleAnnotationStrokes: selectionViewportState.visibleAnnotationStrokes,
    previewStrokes,
    visibleBoardObjects: selectionViewportState.visibleBoardObjects,
    constraints,
    layer,
    tool,
    strokeColor,
    strokeWidth,
    userId: user?.id,
    polygonSides,
    polygonMode,
    polygonPreset,
    textPreset,
    graphDraftFunctions,
    lineStyle,
    boardSettings,
    viewportZoom,
    canvasVisibilityMode,
    imageAssetUrls: selectionViewportState.imageAssetUrls,
    visibleIncomingEraserPreviews: selectionViewportState.visibleIncomingEraserPreviews,
    canEdit,
    boardLocked,
    selectedObjectId,
    selectedConstraintId,
    focusPoint,
    pointerPoint,
    focusPoints,
    pointerPoints,
    canvasViewport,
    onViewportOffsetChange: handleCanvasViewportOffsetChange,
    onEraserRadiusChange: handleEraserRadiusChange,
    forcePanMode: spacePanActive,
    areaSelection,
    solid3dSectionPointCollecting,
    isSolid3dPointCollectionActive: selectionViewportState.isSolid3dPointCollectionActive,
    solid3dDraftPoints,
    onSelectedObjectChange: handleCanvasSelectedObjectChange,
    onSelectedConstraintChange: setSelectedConstraintId,
    onStrokeCommit: canvasHandlers.handleCanvasStrokeCommit,
    onStrokePreview: commitStrokePreview,
    onEraserPreview: canvasHandlers.handleCanvasEraserPreview,
    onEraserCommit: canvasHandlers.handleCanvasEraserCommit,
    onStrokeDelete: canvasHandlers.handleCanvasStrokeDelete,
    onStrokeReplace: canvasHandlers.handleCanvasStrokeReplace,
    onObjectCreate: handleCanvasObjectCreate,
    getLatestBoardObject: getLatestCanvasObject,
    onObjectUpdate: canvasHandlers.handleCanvasObjectUpdate,
    onObjectDelete: canvasHandlers.handleCanvasObjectDelete,
    onObjectContextMenu: handleObjectContextMenu,
    onShapeVertexContextMenu: handleShapeVertexContextMenu,
    onLineEndpointContextMenu: handleLineEndpointContextMenu,
    onSolid3dVertexContextMenu: handleSolid3dVertexContextMenu,
    onSolid3dSectionVertexContextMenu: handleSolid3dSectionVertexContextMenu,
    onSolid3dSectionContextMenu: handleSolid3dSectionContextMenu,
    onSolid3dDraftPointAdd: solid3dSectionDraftHandlers.addDraftPointToSolid,
    onAreaSelectionChange: canvasHandlers.handleCanvasAreaSelectionChange,
    onAreaSelectionContextMenu: canvasHandlers.handleCanvasAreaSelectionContextMenu,
    onInlineTextDraftChange: canvasHandlers.handleCanvasInlineTextDraftChange,
    onRequestSelectTool: canvasHandlers.handleCanvasRequestSelectTool,
    onLaserPoint: canvasHandlers.handleCanvasLaserPoint,
    onLaserClear: canvasHandlers.handleCanvasLaserClear,
    solid3dInsertPreset: pendingSolid3dInsertPreset,
    onSolid3dInsertConsumed: mathPresetCreationHandlers.clearPendingSolid3dInsertPreset,
  });
  const layoutRuntimeInput = {
    user,
    ui: workbookSessionUi,
    page: workbookSessionPage,
    scene: workbookSessionScene,
    data: workbookSessionData,
    refs,
    permissions: {
      canUseSessionChat,
      canManageSession,
      canSendSessionChat,
      canUseMedia,
      isEnded,
      showCollaborationPanels,
      canClear,
      canAccessBoardSettingsPanel,
      canManageSharedBoardSettings,
      canUseUndo,
      canInsertImage,
      canDelete,
      canSelect,
      canDraw,
    },
    derived: {
      participantCards,
      sessionChatUnreadCount,
      firstUnreadSessionChatMessageId,
      chatEmojis: WORKBOOK_CHAT_EMOJIS,
      micEnabled,
      canvasProps,
      beforeCatalogToolButtons,
      afterCatalogToolButtons,
      activeDocument: selectionViewportState.activeDocument,
      activeDocumentPageCount: selectionViewportState.activeDocumentPageCount,
      isContextualUtilityPanel: selectionViewportState.isContextualUtilityPanel,
      selectedObjectSupportsGraphPanel:
        selectionViewportState.selectedObjectSupportsGraphPanel,
      selectedObjectSupportsTransformPanel:
        selectionViewportState.selectedObjectSupportsTransformPanel,
      settingsPanelProps,
      graphPanelProps,
      boardPageOptions: selectionViewportState.boardPageOptions,
      transformPanelProps,
      isCompactDialogViewport,
      contextMenuSection: selectionViewportState.contextMenuSection,
      contextMenuShapeVertexObject: selectionViewportState.contextMenuShapeVertexObject,
      contextMenuLineEndpointObject: selectionViewportState.contextMenuLineEndpointObject,
      contextMenuObject: selectionViewportState.contextMenuObject,
      canBringContextMenuImageToFront:
        selectionViewportState.canBringContextMenuImageToFront,
      canSendContextMenuImageToBack: selectionViewportState.canSendContextMenuImageToBack,
      canRestoreContextMenuImage: selectionViewportState.canRestoreContextMenuImage,
      canCropAreaSelectionImage: selectionViewportState.canCropAreaSelectionImage,
      areaSelectionHasContent,
      shapeCatalog,
    },
    handlers: {
      handleToggleSessionChat: canvasHandlers.handleToggleSessionChat,
      handleCollapseParticipants: canvasHandlers.handleCollapseParticipants,
      handleToggleOwnMic: canvasHandlers.handleToggleOwnMic,
      isParticipantBoardToolsEnabled,
      handleToggleParticipantBoardTools,
      handleToggleParticipantChat,
      handleToggleParticipantMic,
      handleSessionChatDragStart,
      scrollSessionChatToLatest,
      markSessionChatReadToLatest,
      handleSendSessionChatMessage,
      exportBoardAsPdf: handleRequestExportPdf,
      handleMenuClearBoard: handleRequestClearBoard,
      openUtilityPanel,
      handleSelectBoardPage,
      handleAddBoardPage,
      handleDeleteBoardPage: handleRequestDeleteBoardPage,
      handleUndo,
      handleRedo,
      zoomOut,
      zoomIn,
      resetZoom,
      requestDocsUpload: () => openImportModal(),
      toggleFullscreen,
      handleCopyInviteLink,
      handleDocsWindowTogglePinned: panelHandlers.handleDocsWindowTogglePinned,
      handleDocsWindowToggleMaximized: panelHandlers.handleDocsWindowToggleMaximized,
      handleDocsWindowClose: panelHandlers.handleDocsWindowClose,
      handleDocsWindowRequestUpload: panelHandlers.handleDocsWindowRequestUpload,
      handleDocsWindowSnapshotToBoard: panelHandlers.handleDocsWindowSnapshotToBoard,
      handleDocsWindowAddAnnotation: panelHandlers.handleDocsWindowAddAnnotation,
      handleDocsWindowClearAnnotations: panelHandlers.handleDocsWindowClearAnnotations,
      handleDocsWindowSelectAsset: panelHandlers.handleDocsWindowSelectAsset,
      handleDocsWindowPageChange: panelHandlers.handleDocsWindowPageChange,
      handleDocsWindowZoomChange: panelHandlers.handleDocsWindowZoomChange,
      handleUtilityPanelDragStart,
      utilityPanelTitle,
      handleClearSessionChat,
      renameSolid3dVertex: selectedSolid3dActions.renameSolid3dVertex,
      getSolidVertexLabel,
      renameSolid3dSectionVertex: selectedSolid3dActions.renameSolid3dSectionVertex,
      getSectionVertexLabel,
      updateSolid3dSection: selectedSolid3dActions.updateSolid3dSection,
      deleteSolid3dSection: selectedSolid3dActions.deleteSolid3dSection,
      renameShape2dVertexByObjectId: selectedStructureActions.renameShape2dVertexByObjectId,
      renameLineEndpointByObjectId: selectedStructureActions.renameLineEndpointByObjectId,
      renamePointObject: selectedStructureActions.renamePointObject,
      commitObjectDelete,
      commitObjectPin,
      scaleObject,
      commitObjectReorder,
      restoreImageOriginalView,
      copyAreaSelectionObjects,
      cutAreaSelectionObjects,
      cropImageByAreaSelection,
      createCompositionFromAreaSelection,
      deleteAreaSelectionObjects,
      createMathPresetObject: mathPresetCreationHandlers.createMathPresetObject,
      activateTool,
    },
    actions: workbookSessionActions,
    overlayContainer,
  };
  // react-hooks/refs false-positive: refs are forwarded as props and not dereferenced here.
  // eslint-disable-next-line react-hooks/refs
  const layoutRuntimeProps = buildWorkbookSessionLayoutRuntimeProps(layoutRuntimeInput);
  const {
    participantsPanelProps,
    sessionChatPanelProps,
    contextbarProps,
    boardShellProps,
    docsWindowProps,
    utilityPanelChromeProps,
    utilityPanelTabsProps,
    overlaysProps,
  } = layoutRuntimeProps;

  return (
    <section
      className={`workbook-session ${isFullscreen ? "is-fullscreen" : ""}`}
      ref={sessionRootRef}
    >
      <WorkbookSessionTopScaffold
        boardFileInputRef={boardFileInputRef}
        docsInputRef={docsInputRef}
        onLoadBoardFile={handleLoadBoardFile}
        onDocsUpload={handleDocsUploadToModal}
        error={error}
        setError={setError}
        saveSyncWarning={saveSyncWarning}
        setSaveSyncWarning={setSaveSyncWarning}
        realtimeSyncWarning={realtimeSyncWarning}
        setRealtimeSyncWarning={setRealtimeSyncWarning}
        isFullscreen={isFullscreen}
        isEnded={session.status === "ended"}
        pendingClearRequest={pendingClearRequest}
        currentUserId={user?.id}
        onConfirmClear={handleConfirmClear}
        awaitingClearRequest={awaitingClearRequest}
      />

      <div
        className={`workbook-session__layout${
          showSidebarParticipantsInLayout
            ? " workbook-session__layout--sidebar-overlay"
            : " workbook-session__layout--workspace"
        }`}
      >
        <WorkbookSessionWorkspace
          workspaceRef={workspaceRef}
          graphCatalogCursorActive={graphCatalogCursorActive}
          contextbarProps={contextbarProps}
          onBack={handleBack}
          onWorkspaceDragOver={handleWorkspaceDragOver}
          onWorkspaceDrop={handleWorkspaceDrop}
          boardShellProps={{
            ...boardShellProps,
            pageTransitionOverlay: {
              active: isPageTransitionActive,
              label: transitionLabel,
            },
          }}
          docsWindowOpen={docsWindow.open}
          docsWindowProps={docsWindowProps}
        />
        <WorkbookSessionSidebar
          isCompactViewport={isCompactViewport}
          showSidebarParticipants={showSidebarParticipantsInLayout}
          floatingPanelsTop={floatingPanelsTop}
          participantsPanelProps={participantsPanelProps}
          utilityPanelChromeProps={utilityPanelChromeProps}
          utilityPanelTabsProps={utilityPanelTabsProps}
          sessionChatPanelProps={sessionChatPanelProps}
          overlaysProps={overlaysProps}
        />
      </div>

      <WorkbookImportModal
        open={isImportModalOpen}
        sessionId={sessionId}
        initialFiles={pendingImportFiles}
        fullScreen
        onClose={handleImportModalClose}
        onImportFile={handleImportModalFile}
      />

      {confirmDialogContent ? (
        <PlatformConfirmDialog
          open={confirmDialogOpen}
          container={overlayContainer}
          fullScreen={isCompactDialogViewport}
          loading={confirmActionSubmitting}
          title={confirmDialogContent.title}
          description={confirmDialogContent.description}
          confirmLabel={confirmDialogContent.confirmLabel}
          tone={confirmDialogContent.tone}
          onCancel={handleCloseConfirmDialog}
          onConfirm={handleConfirmDialogAction}
        />
      ) : null}

      <WorkbookSessionToolSettingsPopover
        state={toolSettingsPopoverState}
        overlayContainer={overlayContainer}
        isFullscreen={isFullscreen}
        onClose={handleCloseToolSettingsPopover}
        penToolSettings={penToolSettings}
        highlighterToolSettings={highlighterToolSettings}
        eraserRadius={clampedEraserRadius}
        eraserRadiusMin={ERASER_RADIUS_MIN}
        eraserRadiusMax={ERASER_RADIUS_MAX}
        onPenToolSettingsChange={handlePenToolSettingsChange}
        onHighlighterToolSettingsChange={handleHighlighterToolSettingsChange}
        onEraserRadiusChange={handleEraserRadiusChange}
      />
    </section>
  );
}
