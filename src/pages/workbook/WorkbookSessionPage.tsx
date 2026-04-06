import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./workbookRouteStyles";
import {
  Alert,
  Button,
  TextField,
} from "@mui/material";
import { useThemeMode } from "@/app/theme/themeModeContext";
import { useAuth } from "@/features/auth/model/AuthContext";
import {
  updateWorkbookSessionDraftPreview,
  uploadWorkbookAsset,
} from "@/features/workbook/model/api";
import { normalizeWorkbookPageFrameWidth } from "@/features/workbook/model/pageFrame";
import { useWorkbookSessionStore } from "@/features/workbook/model/workbookSessionStore";
import {
  WorkbookLessonRecordingControls,
  WorkbookLessonRecordingDialogs,
  useWorkbookLessonRecording,
} from "@/features/workbook/lessonRecording";
import {
  startWorkbookPerformanceSession,
} from "@/features/workbook/model/workbookPerformance";
import type {
  WorkbookEvent,
  WorkbookLayer,
  WorkbookTool,
} from "@/features/workbook/model/types";
import { sanitizeFunctionGraphDrafts } from "@/features/workbook/model/functionGraph";
import {
  readSolid3dState,
  writeSolid3dState,
  type Solid3dHostedPointClassification,
  type Solid3dHostedPoint,
  type Solid3dHostedSegment,
  type Solid3dSectionPoint,
} from "@/features/workbook/model/solid3dState";
import { PageLoader } from "@/shared/ui/loading";
import { PlatformConfirmDialog } from "@/shared/ui/PlatformConfirmDialog";
import { generateId } from "@/shared/lib/id";
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
  normalizeWorkbookPageOrder,
  resolveMaxKnownWorkbookPage,
  toSafeWorkbookPage,
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
import { buildWorkbookSessionSelectionViewportParams } from "./buildWorkbookSessionSelectionViewportParams";
import { useWorkbookSessionDerivedState } from "./useWorkbookSessionDerivedState";
import { applyWorkbookIncomingEventsBatch } from "./applyWorkbookIncomingEventsBatch";
import { buildWorkbookSessionTransformPanelRuntimeProps } from "./buildWorkbookSessionTransformPanelRuntimeProps";
import { buildWorkbookSessionUtilityPanelProps } from "./buildWorkbookSessionUtilityPanelProps";
import {
  WorkbookSessionToolSettingsPopover,
  type WorkbookToolSettingsPopoverState,
  type WorkbookToolSettingsPopoverTool,
} from "./WorkbookSessionToolSettingsPopover";
import { WorkbookImportModalBoundary } from "./WorkbookImportModalBoundary";
import { captureWorkbookSessionPreviewDataUrl } from "./workbookHubPreviewCapture";
import { useWorkbookPageTransitionOverlay } from "./useWorkbookPageTransitionOverlay";
import { useWorkbookPageZoomPersistence } from "./useWorkbookPageZoomPersistence";
import { useWorkbookPageViewportPersistence } from "./useWorkbookPageViewportPersistence";
import {
  WORKBOOK_HUB_PREVIEW_BRIDGE_EVENT,
  queueWorkbookHubPreviewRefreshHint,
  type WorkbookHubPreviewBridgeMessage,
} from "./workbookHubPreviewBridge";

const WorkbookSessionPageManagerFullscreen = lazy(() =>
  import("./WorkbookSessionPageManagerFullscreen").then((module) => ({
    default: module.WorkbookSessionPageManagerFullscreen,
  }))
);

const WorkbookImportModal = lazy(() =>
  import("./WorkbookImportModal").then((module) => ({
    default: module.WorkbookImportModal,
  }))
);

export default function WorkbookSessionPage() {
  const { user, isAuthReady, openAuthModal } = useAuth();
  const { mode: themeMode, toggleMode } = useThemeMode();
  const { sessionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isBackNavigationPending, setIsBackNavigationPending] = useState(false);

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
  const currentBoardPage = useWorkbookSessionStore((state) => state.scene.currentBoardPage);
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
      currentBoardPage,
      canvasViewport,
      viewportZoom,
    }),
    [selectedObjectId, selectedConstraintId, currentBoardPage, canvasViewport, viewportZoom]
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
    setCurrentBoardPage,
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
    menuAnchor,
    undoDepth,
    redoDepth,
    activeSessionTabId,
    copyingInviteLink,
    uploadingDoc,
    uploadProgress,
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
    isSessionChatEmojiOpen,
    sessionChatReadAt,
    isClearSessionChatDialogOpen,
    solid3dVertexContextMenu,
    solid3dSectionVertexContextMenu,
    solid3dSectionContextMenu,
    shapeVertexContextMenu,
    shapeVertexLabelDraft,
    lineEndpointContextMenu,
    lineEndpointLabelDraft,
    objectContextMenu,
    pointLabelDraft,
    areaSelectionContextMenu,
    isStereoDialogOpen,
    isShapesDialogOpen,
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
  const [overlayContainer, setOverlayContainer] = useState<Element | undefined>(() =>
    typeof document !== "undefined" ? document.body : undefined
  );
  const [isPageManagerOpen, setIsPageManagerOpen] = useState(false);
  const [presenceTabIdSnapshot, setPresenceTabIdSnapshot] = useState("");
  const [solid3dHostedDraft, setSolid3dHostedDraft] = useState<{
    objectId: string;
    mode: "segment";
    points: Solid3dSectionPoint[];
    pointIds: Array<string | null>;
  } | null>(null);
  const [selectedHostedEntity, setSelectedHostedEntity] = useState<{
    objectId: string;
    entityType: "point" | "segment";
    entityId: string;
  } | null>(null);
  const currentBoardPageRef = useRef<number>(Math.max(1, Math.round(currentBoardPage || 1)));
  const initializedLocalPageSessionIdRef = useRef<string | null>(null);
  const lastAutoPageFrameWidthRef = useRef<number>(0);

  useEffect(() => {
    currentBoardPageRef.current = Math.max(1, Math.round(currentBoardPage || 1));
  }, [currentBoardPage]);

  useEffect(() => {
    initializedLocalPageSessionIdRef.current = null;
    lastAutoPageFrameWidthRef.current = 0;
  }, [sessionId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncOverlayContainer = () => {
      const nextContainer = document.fullscreenElement ?? document.body;
      setOverlayContainer((current) => (current === nextContainer ? current : nextContainer));
    };
    syncOverlayContainer();
    document.addEventListener("fullscreenchange", syncOverlayContainer);
    return () => {
      document.removeEventListener("fullscreenchange", syncOverlayContainer);
    };
  }, []);

  useEffect(() => {
    if (!bootstrapReady || !sessionId || !session) return;
    if (initializedLocalPageSessionIdRef.current === sessionId) return;
    initializedLocalPageSessionIdRef.current = sessionId;
    const maxKnownPage = resolveMaxKnownWorkbookPage({
      pagesCount: boardSettings.pagesCount,
      boardObjects,
      boardStrokes,
      annotationStrokes,
    });
    const normalizedOrder = normalizeWorkbookPageOrder(boardSettings.pageOrder, maxKnownPage);
    const preferredPage = Math.min(maxKnownPage, toSafeWorkbookPage(boardSettings.currentPage));
    const nextLocalPage = normalizedOrder.includes(preferredPage)
      ? preferredPage
      : normalizedOrder[0] ?? 1;
    setCurrentBoardPage(nextLocalPage);
  }, [
    annotationStrokes,
    boardObjects,
    boardSettings.currentPage,
    boardSettings.pageOrder,
    boardSettings.pagesCount,
    boardStrokes,
    bootstrapReady,
    session,
    sessionId,
    setCurrentBoardPage,
  ]);

  const handleSessionRootRef = useCallback(
    (node: HTMLElement | null) => {
      sessionRootRef.current = node;
    },
    [sessionRootRef]
  );

  useEffect(() => {
    const nextPresenceTabId = refs.presenceTabIdRef.current;
    if (!nextPresenceTabId || typeof window === "undefined") return;
    const raf = window.requestAnimationFrame(() => {
      setPresenceTabIdSnapshot((current) =>
        current === nextPresenceTabId ? current : nextPresenceTabId
      );
    });
    return () => window.cancelAnimationFrame(raf);
  }, [refs.presenceTabIdRef]);

  useEffect(() => {
    if (!solid3dHostedDraft) return;
    const targetExists = boardObjects.some(
      (item) => item.id === solid3dHostedDraft.objectId && item.type === "solid3d"
    );
    if (!targetExists) {
      setSolid3dHostedDraft(null);
    }
  }, [boardObjects, solid3dHostedDraft]);

  useEffect(() => {
    if (!selectedHostedEntity) return;
    const targetObject = boardObjects.find(
      (item) => item.id === selectedHostedEntity.objectId && item.type === "solid3d"
    );
    if (!targetObject) {
      setSelectedHostedEntity(null);
      return;
    }
    const solidState = readSolid3dState(targetObject.meta);
    const exists =
      selectedHostedEntity.entityType === "point"
        ? solidState.hostedPoints.some((point) => point.id === selectedHostedEntity.entityId)
        : solidState.hostedSegments.some(
            (segment) => segment.id === selectedHostedEntity.entityId
          );
    if (!exists) {
      setSelectedHostedEntity(null);
    }
  }, [boardObjects, selectedHostedEntity]);

  useEffect(() => {
    if (!selectedHostedEntity) return;
    if (!selectedObjectId || selectedHostedEntity.objectId !== selectedObjectId) {
      setSelectedHostedEntity(null);
    }
  }, [selectedHostedEntity, selectedObjectId]);

  useEffect(() => {
    if (!solid3dHostedDraft || !solid3dSectionPointCollecting) return;
    setSolid3dHostedDraft(null);
  }, [solid3dHostedDraft, solid3dSectionPointCollecting]);

  useEffect(() => {
    if (!selectedHostedEntity || !solid3dSectionPointCollecting) return;
    setSelectedHostedEntity(null);
  }, [selectedHostedEntity, solid3dSectionPointCollecting]);

  useEffect(() => {
    if (!solid3dHostedDraft) return;
    if (!selectedObjectId || selectedObjectId !== solid3dHostedDraft.objectId) {
      setSolid3dHostedDraft(null);
    }
  }, [selectedObjectId, solid3dHostedDraft]);

  const fallbackBackPath = "/workbook";
  const fromPath = searchParams.get("from") || fallbackBackPath;
  const isWorkbookSessionAuthLost = isAuthReady && !user;
  const isSessionAccessBlocked = refs.authRequiredRef.current;
  const isWorkspaceInteractionBlocked = isSessionTabPassive || isSessionAccessBlocked;

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
    isSessionTabPassive: isWorkspaceInteractionBlocked,
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
  const canAccessLessonRecording = useMemo(() => {
    if (session?.kind === "PERSONAL") return true;
    if (session?.kind === "CLASS") return isTeacherActor;
    return false;
  }, [isTeacherActor, session?.kind]);
  const lessonRecording = useWorkbookLessonRecording({
    canAccessRecording: canAccessLessonRecording,
    canRecord:
      canAccessLessonRecording &&
      !isEnded &&
      !isWorkspaceInteractionBlocked,
    canUseMedia,
    micEnabled,
    setMicEnabled,
    sessionTitle: session?.title,
    setError,
  });
  const lessonRecordingControls = useMemo(
    () =>
      lessonRecording.canShowControls ? (
        <WorkbookLessonRecordingControls
          status={lessonRecording.status}
          elapsedMs={lessonRecording.elapsedMs}
          isSupported={lessonRecording.isSupported}
          audioSummary={lessonRecording.audioSummary}
          micEnabled={lessonRecording.micEnabled}
          canToggleMicrophone={lessonRecording.canToggleMicrophone}
          onRequestStart={lessonRecording.openPreStartDialog}
          onPause={lessonRecording.pauseRecording}
          onResume={lessonRecording.resumeRecording}
          onToggleMicrophone={lessonRecording.toggleMicrophone}
          onStop={() => lessonRecording.stopRecording("stopped")}
        />
      ) : null,
    [
      lessonRecording.audioSummary,
      lessonRecording.canToggleMicrophone,
      lessonRecording.canShowControls,
      lessonRecording.elapsedMs,
      lessonRecording.isSupported,
      lessonRecording.micEnabled,
      lessonRecording.openPreStartDialog,
      lessonRecording.pauseRecording,
      lessonRecording.resumeRecording,
      lessonRecording.status,
      lessonRecording.stopRecording,
      lessonRecording.toggleMicrophone,
    ]
  );
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
    lastAppliedSeqRef: refs.lastAppliedSeqRef,
    processedEventIdsRef,
  });
  const effectiveActorUserId = actorParticipant?.userId ?? user?.id ?? "";
  const pageZoomStorageKey = useMemo(() => {
    return sessionId && effectiveActorUserId
      ? `workbook:page-zoom:${sessionId}:${effectiveActorUserId}`
      : "";
  }, [effectiveActorUserId, sessionId]);
  const pageViewportStorageKey = useMemo(
    () =>
      sessionId && effectiveActorUserId
        ? `workbook:page-viewport:${sessionId}:${effectiveActorUserId}`
        : "",
    [effectiveActorUserId, sessionId]
  );

  useWorkbookPageZoomPersistence({
    storageKey: pageZoomStorageKey,
    currentBoardPage,
    viewportZoom,
    setViewportZoom,
    enabled: bootstrapReady && Boolean(sessionId),
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
    pageFrameWidth: boardSettings.pageFrameWidth,
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
  const selectedObjectIdRef = useRef<string | null>(selectedObjectId);
  const awaitingClearRequestRef = useRef(awaitingClearRequest);
  useEffect(() => {
    selectedObjectIdRef.current = selectedObjectId;
  }, [selectedObjectId]);
  useEffect(() => {
    awaitingClearRequestRef.current = awaitingClearRequest;
  }, [awaitingClearRequest]);

  const applyIncomingEvents = useCallback(
    (events: WorkbookEvent[]) => {
      applyWorkbookIncomingEventsBatch({
        sessionId,
        events,
        userId: user?.id,
        selectedObjectId: selectedObjectIdRef.current,
        awaitingClearRequest: awaitingClearRequestRef.current,
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
  } = useWorkbookSessionRealtimeLifecycle({
    realtimeApplyQueueParams: {
      sessionId,
      applyIncomingEvents,
    },
    loadAndAuthParams: {
      sessionId,
      isWorkbookSessionAuthLost,
      clearLocalPreviewPatchRuntime,
      clearObjectSyncRuntime,
      clearStrokePreviewRuntime,
      clearIncomingEraserPreviewRuntime,
      recoverChatMessagesFromEvents,
      setSaveState: workbookSessionActions.setSaveState,
      setError: workbookSessionActions.setError,
      setSaveSyncWarning: workbookSessionActions.setSaveSyncWarning,
      setBootstrapReady: workbookSessionActions.setBootstrapReady,
      setLoading: workbookSessionActions.setLoading,
      setSession: workbookSessionActions.setSession,
      setBoardStrokes: workbookSessionActions.setBoardStrokes,
      setBoardObjects: workbookSessionActions.setBoardObjects,
      setConstraints: workbookSessionActions.setConstraints,
      setBoardSettings: workbookSessionActions.setBoardSettings,
      setAnnotationStrokes: workbookSessionActions.setAnnotationStrokes,
      setLatestSeq: workbookSessionActions.setLatestSeq,
      setUndoDepth: workbookSessionActions.setUndoDepth,
      setRedoDepth: workbookSessionActions.setRedoDepth,
      setFocusPoint: workbookSessionActions.setFocusPoint,
      setPointerPoint: workbookSessionActions.setPointerPoint,
      setFocusPointsByUser: workbookSessionActions.setFocusPointsByUser,
      setPointerPointsByUser: workbookSessionActions.setPointerPointsByUser,
      setChatMessages: workbookSessionActions.setChatMessages,
      setComments: workbookSessionActions.setComments,
      setTimerState: workbookSessionActions.setTimerState,
      setLibraryState: workbookSessionActions.setLibraryState,
      setDocumentState: workbookSessionActions.setDocumentState,
      setRealtimeSyncWarning: workbookSessionActions.setRealtimeSyncWarning,
      authRequiredRef: refs.authRequiredRef,
      loadSessionRequestIdRef: refs.loadSessionRequestIdRef,
      firstInteractiveMetricReportedRef: refs.firstInteractiveMetricReportedRef,
      queuedBoardSettingsCommitRef: refs.queuedBoardSettingsCommitRef,
      queuedBoardSettingsHistoryBeforeRef: refs.queuedBoardSettingsHistoryBeforeRef,
      boardSettingsCommitTimerRef: refs.boardSettingsCommitTimerRef,
      latestSeqRef: refs.latestSeqRef,
      lastAppliedSeqRef: refs.lastAppliedSeqRef,
      lastAppliedBoardSettingsSeqRef: refs.lastAppliedBoardSettingsSeqRef,
      recoveryModeRef: refs.recoveryModeRef,
      processedEventIdsRef: refs.processedEventIdsRef,
      applyIncomingEvents,
      filterUnseenWorkbookEvents,
      dirtyRef: refs.dirtyRef,
      undoStackRef: refs.undoStackRef,
      redoStackRef: refs.redoStackRef,
      focusResetTimersByUserRef: refs.focusResetTimersByUserRef,
      boardObjectsRef: refs.boardObjectsRef,
      boardObjectIndexByIdRef: refs.boardObjectIndexByIdRef,
      sessionResyncInFlightRef: refs.sessionResyncInFlightRef,
      lastForcedResyncAtRef: refs.lastForcedResyncAtRef,
    },
    clearLocalPreviewPatchRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    clearIncomingEraserPreviewRuntime,
    realtimeTransportParams: {
      enabled: Boolean(user?.id) && !isWorkbookSessionAuthLost,
      bootstrapReady,
      filterUnseenWorkbookEvents,
      latestSeqRef: refs.latestSeqRef,
      sessionResyncInFlightRef: refs.sessionResyncInFlightRef,
      realtimeDisconnectSinceRef: refs.realtimeDisconnectSinceRef,
      lastForcedResyncAtRef: refs.lastForcedResyncAtRef,
      workbookLiveSendRef: refs.workbookLiveSendRef,
      setLatestSeq: workbookSessionActions.setLatestSeq,
      setRealtimeSyncWarning: workbookSessionActions.setRealtimeSyncWarning,
      isWorkbookStreamConnected: workbookSessionCollab.isWorkbookStreamConnected,
      isWorkbookLiveConnected: workbookSessionCollab.isWorkbookLiveConnected,
      setIsWorkbookStreamConnected: workbookSessionActions.setIsWorkbookStreamConnected,
      setIsWorkbookLiveConnected: workbookSessionActions.setIsWorkbookLiveConnected,
      pollIntervalMs: POLL_INTERVAL_MS,
      pollIntervalStreamConnectedMs: POLL_INTERVAL_STREAM_CONNECTED_MS,
      resyncMinIntervalMs: RESYNC_MIN_INTERVAL_MS,
      adaptivePollingEnabled,
      adaptivePollingMinMs: ADAPTIVE_POLLING_MIN_MS,
      adaptivePollingMaxMs: ADAPTIVE_POLLING_MAX_MS,
      isMediaAudioConnected: isLivekitConnected,
    },
    sessionTabLockParams: {
      sessionTabLockStorageKey,
      sessionTabLockChannelName,
      tabIdRef: refs.presenceTabIdRef,
      setActiveSessionTabId: workbookSessionActions.setActiveSessionTabId,
      setIsSessionTabPassive: workbookSessionActions.setIsSessionTabPassive,
      heartbeatMs: TAB_LOCK_HEARTBEAT_MS,
    },
    personalBoardSettingsParams: {
      personalBoardSettingsStorageKey,
      personalBoardSettingsReadyRef: refs.personalBoardSettingsReadyRef,
      skipNextPersonalBoardSettingsPersistRef: refs.skipNextPersonalBoardSettingsPersistRef,
      setPenToolSettings: workbookSessionActions.setPenToolSettings,
      setHighlighterToolSettings: workbookSessionActions.setHighlighterToolSettings,
      setEraserRadius: workbookSessionActions.setEraserRadius,
      penToolSettings: workbookSessionTooling.penToolSettings,
      highlighterToolSettings: workbookSessionTooling.highlighterToolSettings,
      clampedEraserRadius,
    },
    presenceLifecycleParams: {
      sessionId,
      userId: user?.id,
      isTeacherActor,
      presenceTabIdRef: refs.presenceTabIdRef,
      presenceLeaveSentRef: refs.presenceLeaveSentRef,
      presenceIntervalMs: PRESENCE_INTERVAL_MS,
    },
    areParticipantsEqual,
    sessionChatUiEffectsParams: {
      sessionChatReadStorageKey,
      setSessionChatReadAt: workbookSessionActions.setSessionChatReadAt,
      canUseSessionChat,
      isSessionChatOpen,
      setIsSessionChatOpen: workbookSessionActions.setIsSessionChatOpen,
      setIsSessionChatEmojiOpen: workbookSessionActions.setIsSessionChatEmojiOpen,
      setSessionChatDraft: workbookSessionActions.setSessionChatDraft,
      isSessionChatMinimized,
      isSessionChatMaximized,
      isSessionChatAtBottom,
      firstUnreadSessionChatMessageId,
      sessionChatUnreadCount: workbookSessionPage.sessionChatUnreadCount,
      chatMessages: workbookSessionData.chatMessages,
      sessionChatShouldScrollToUnreadRef: refs.sessionChatShouldScrollToUnreadRef,
      sessionChatListRef: refs.sessionChatListRef,
      sessionChatRef: refs.sessionChatRef,
      sessionChatDragStateRef: refs.sessionChatDragStateRef,
      isCompactViewport,
      setIsSessionChatAtBottom: workbookSessionActions.setIsSessionChatAtBottom,
      markSessionChatReadToLatest,
      scrollSessionChatToLatest,
      scrollSessionChatToMessage,
      setSessionChatPosition: workbookSessionActions.setSessionChatPosition,
      sessionChatScrollBottomThresholdPx: SESSION_CHAT_SCROLL_BOTTOM_THRESHOLD_PX,
    },
    persistSnapshotsParams: {
      sessionId,
      boardStrokes: workbookSessionData.boardStrokes,
      boardObjects: workbookSessionData.boardObjects,
      constraints: workbookSessionData.constraints,
      chatMessages: workbookSessionData.chatMessages,
      comments: workbookSessionData.comments,
      timerState: workbookSessionData.timerState,
      boardSettings: workbookSessionData.boardSettings,
      libraryState: workbookSessionData.libraryState,
      documentState: workbookSessionData.documentState,
      annotationStrokes: workbookSessionData.annotationStrokes,
      latestSeq: workbookSessionCollab.latestSeq,
      lastAppliedSeqRef: refs.lastAppliedSeqRef,
      authRequiredRef: refs.authRequiredRef,
      dirtyRef: refs.dirtyRef,
      dirtyRevisionRef: refs.dirtyRevisionRef,
      isSavingRef: refs.isSavingRef,
      pendingAutosaveAfterSaveRef: refs.pendingAutosaveAfterSaveRef,
      setSaveState: workbookSessionActions.setSaveState,
      setSaveSyncWarning: workbookSessionActions.setSaveSyncWarning,
      scheduleAutosave,
    },
    persistenceLifecycleParams: {
      sessionId,
      sessionReady: Boolean(workbookSessionData.session && !isWorkbookSessionAuthLost),
      persistSnapshotsRef,
      dirtyRef: refs.dirtyRef,
      autosaveIntervalMs: AUTOSAVE_INTERVAL_MS,
    },
  });

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
    handleReorderBoardPages,
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

  useEffect(() => {
    if (!bootstrapReady || !sessionId || !canManageSharedBoardSettings) return;
    if (typeof ResizeObserver === "undefined") return;
    const workspaceNode = workspaceRef.current;
    if (!workspaceNode) return;

    const tryGrowSharedPageFrameWidth = (workspaceWidth: number) => {
      if (!Number.isFinite(workspaceWidth) || workspaceWidth <= 1) return;
      const nextWidth = normalizeWorkbookPageFrameWidth(workspaceWidth);
      const currentWidth = normalizeWorkbookPageFrameWidth(
        boardSettingsRef.current.pageFrameWidth
      );
      if (nextWidth <= currentWidth + 24) return;
      if (nextWidth <= lastAutoPageFrameWidthRef.current + 24) return;
      lastAutoPageFrameWidthRef.current = nextWidth;
      handleSharedBoardSettingsChange({ pageFrameWidth: nextWidth });
    };

    tryGrowSharedPageFrameWidth(workspaceNode.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      tryGrowSharedPageFrameWidth(entry.contentRect.width);
    });
    observer.observe(workspaceNode);
    return () => observer.disconnect();
  }, [
    bootstrapReady,
    sessionId,
    canManageSharedBoardSettings,
    boardSettingsRef,
    handleSharedBoardSettingsChange,
    workspaceRef,
  ]);

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
      boardSettingsRef,
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
    currentBoardPage,
    buildHistoryEntryFromEvents,
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
    currentBoardPage,
    activeSceneLayerId,
    pageFrameWidth: boardSettings.pageFrameWidth,
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
    buildHistoryEntryFromEvents,
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
    fillAreaSelection,
    restoreImageOriginalView,
  } = useWorkbookAreaSelectionClipboardHandlers({
    canDelete,
    canSelect,
    areaSelection,
    areaSelectionHasContent,
    currentBoardPage,
    boardSettings,
    areaFillColor: strokeColor,
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
    },
    [
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
    pageFrameWidth: boardSettings.pageFrameWidth,
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
    setSelectedGraphPresetId,
    appendSelectedGraphFunction: selectedGraphTextActions.appendSelectedGraphFunction,
    activateGraphCatalogCursor,
    updateSelectedGraphFunction: selectedGraphTextActions.updateSelectedGraphFunction,
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

  const resolveHostedPointClassification = useCallback(
    (point: Solid3dSectionPoint): Solid3dHostedPointClassification => {
      if (point.classification === "point_on_segment") return "point_on_segment";
      if (point.classification === "vertex") return "vertex";
      if (point.classification === "edge") return "edge";
      if (point.classification === "interior") return "interior";
      if (typeof point.hostSegmentId === "string" && point.hostSegmentId.trim().length > 0) {
        return "point_on_segment";
      }
      if (Number.isInteger(point.vertexIndex) && Number(point.vertexIndex) >= 0) {
        return "vertex";
      }
      if (typeof point.edgeKey === "string" && point.edgeKey.trim().length > 0) {
        return "edge";
      }
      if (
        Array.isArray(point.barycentric) &&
        point.barycentric.length === 3 &&
        point.barycentric.some((weight) => Math.abs(weight) <= 1e-4)
      ) {
        return "edge";
      }
      if (Number.isInteger(point.faceIndex) && Number(point.faceIndex) >= 0) {
        return "face";
      }
      return "interior";
    },
    []
  );

  const getNextHostedPointName = useCallback((hostedPoints: Solid3dHostedPoint[]) => {
    const used = new Set(
      hostedPoints
        .map((point) => point.name?.trim() ?? "")
        .filter((value) => value.length > 0)
    );
    let index = 1;
    while (used.has(`H${index}`)) {
      index += 1;
    }
    return `H${index}`;
  }, []);

  const toHostedPoint = useCallback(
    (
      objectId: string,
      objectColor: string,
      basePoint: Solid3dSectionPoint,
      id: string,
      name: string
    ): Solid3dHostedPoint => {
      const faceIndex =
        Number.isInteger(basePoint.faceIndex) && Number(basePoint.faceIndex) >= 0
          ? Number(basePoint.faceIndex)
          : undefined;
      const classification = resolveHostedPointClassification(basePoint);
      const hostSegmentId =
        typeof basePoint.hostSegmentId === "string" && basePoint.hostSegmentId.trim().length > 0
          ? basePoint.hostSegmentId.trim()
          : undefined;
      const rawSegmentT = Number(basePoint.segmentT);
      const segmentT = Number.isFinite(rawSegmentT)
        ? Math.max(0, Math.min(1, rawSegmentT))
        : undefined;
      return {
        id,
        kind: "hosted_point",
        hostObjectId: objectId,
        hostFaceId: faceIndex !== undefined ? `face-${faceIndex}` : undefined,
        faceIndex,
        classification,
        vertexIndex:
          Number.isInteger(basePoint.vertexIndex) && Number(basePoint.vertexIndex) >= 0
            ? Number(basePoint.vertexIndex)
            : undefined,
        edgeKey:
          typeof basePoint.edgeKey === "string" && basePoint.edgeKey.trim().length > 0
            ? basePoint.edgeKey.trim()
            : undefined,
        hostSegmentId,
        segmentT,
        local3d:
          Array.isArray(basePoint.local3d) && basePoint.local3d.length === 3
            ? [basePoint.local3d[0], basePoint.local3d[1], basePoint.local3d[2]]
            : [basePoint.x, basePoint.y, basePoint.z],
        x: basePoint.x,
        y: basePoint.y,
        z: basePoint.z,
        triangleVertexIndices: basePoint.triangleVertexIndices,
        barycentric: basePoint.barycentric,
        name,
        labelVisible: true,
        color: objectColor || "#c4872f",
        radius: 2.4,
        visible: true,
      };
    },
    [resolveHostedPointClassification]
  );

  const handleStartSolid3dHostedSegmentMode = useCallback(
    (objectId: string) => {
      const targetObject = boardObjects.find((item) => item.id === objectId);
      if (!targetObject || targetObject.type !== "solid3d") {
        setError("Сначала выберите 3D-объект.");
        return;
      }
      setSelectedObjectId(objectId);
      setSolid3dSectionPointCollecting(null);
      setSolid3dDraftPoints(null);
      setSolid3dInspectorTab("hosted");
      resetToolRuntimeToSelect();
      setSelectedHostedEntity(null);
      setSolid3dHostedDraft({
        objectId,
        mode: "segment",
        points: [],
        pointIds: [],
      });
      setError(null);
    },
    [
      boardObjects,
      resetToolRuntimeToSelect,
      setError,
      setSelectedObjectId,
      setSolid3dDraftPoints,
      setSolid3dInspectorTab,
      setSolid3dSectionPointCollecting,
    ]
  );

  const handleCancelSolid3dHostedDraft = useCallback((objectId?: string) => {
    setSolid3dHostedDraft((current) => {
      if (!current) return null;
      if (objectId && current.objectId !== objectId) return current;
      return null;
    });
  }, []);

  const handleSolid3dDraftPointAdd = useCallback(
    (payload: {
      objectId: string;
      point: Solid3dSectionPoint;
    }) => {
      if (!solid3dHostedDraft) {
        solid3dSectionDraftHandlers.addDraftPointToSolid(payload);
        return;
      }
      if (payload.objectId !== solid3dHostedDraft.objectId) {
        return;
      }
      const targetObject = boardObjects.find((item) => item.id === payload.objectId);
      if (!targetObject || targetObject.type !== "solid3d") {
        setSolid3dHostedDraft(null);
        setError("Не удалось найти выбранную 3D-фигуру.");
        return;
      }
      const triangleIndices = payload.point.triangleVertexIndices ?? [];
      const barycentric = payload.point.barycentric ?? [];
      const hasSurfaceTuple =
        Number.isInteger(payload.point.faceIndex) &&
        triangleIndices.length === 3 &&
        barycentric.length === 3;
      const hasLocalPoint = Array.isArray(payload.point.local3d) && payload.point.local3d.length === 3;
      const hasHostedSegmentReference =
        typeof payload.point.hostSegmentId === "string" &&
        payload.point.hostSegmentId.trim().length > 0;
      if (!hasSurfaceTuple && !hasLocalPoint && !hasHostedSegmentReference) {
        setError("Точка должна быть выбрана на фигуре или на уже построенном отрезке.");
        return;
      }
      const currentState = readSolid3dState(targetObject.meta);
      const objectColor = targetObject.color ?? "#c4872f";
      const currentPoints = solid3dHostedDraft.points;
      const currentPointIds = solid3dHostedDraft.pointIds;
      const isDuplicate = currentPoints.some(
        (entry) =>
          Math.hypot(entry.x - payload.point.x, entry.y - payload.point.y, entry.z - payload.point.z) <
          1e-4
      );
      if (isDuplicate) return;
      const payloadHostSegmentId =
        typeof payload.point.hostSegmentId === "string" &&
        payload.point.hostSegmentId.trim().length > 0
          ? payload.point.hostSegmentId.trim()
          : null;
      const payloadSegmentT = Number(payload.point.segmentT);
      const reusablePoint = currentState.hostedPoints.find(
        (point) => {
          if (point.hostObjectId !== targetObject.id) return false;
          const pointHostSegmentId =
            typeof point.hostSegmentId === "string" && point.hostSegmentId.trim().length > 0
              ? point.hostSegmentId.trim()
              : null;
          if (
            payloadHostSegmentId &&
            pointHostSegmentId === payloadHostSegmentId &&
            Number.isFinite(payloadSegmentT) &&
            Number.isFinite(Number(point.segmentT))
          ) {
            const deltaT = Math.abs(Number(point.segmentT) - payloadSegmentT);
            if (deltaT <= 0.015) return true;
          }
          return (
            Math.hypot(point.x - payload.point.x, point.y - payload.point.y, point.z - payload.point.z) <
            1e-4
          );
        }
      );
      if (currentPoints.length === 0) {
        setSelectedObjectId(targetObject.id);
        setSolid3dHostedDraft({
          objectId: targetObject.id,
          mode: "segment",
          points: [{ ...payload.point, label: "H1" }],
          pointIds: [reusablePoint?.id ?? null],
        });
        return;
      }
      const firstPoint = currentPoints[0];
      const firstPointId = currentPointIds[0] ?? null;
      const secondPoint: Solid3dSectionPoint = {
        ...payload.point,
        label: "H2",
      };
      const secondPointId = reusablePoint?.id ?? null;
      const startPointId = firstPointId ?? generateId();
      const endPointId = secondPointId ?? generateId();
      if (startPointId === endPointId) {
        setError("Выберите вторую точку отрезка в другом месте.");
        return;
      }
      const hostedPointsForNaming = [...currentState.hostedPoints];
      const startPointName = firstPointId
        ? (currentState.hostedPoints.find((point) => point.id === firstPointId)?.name ??
          getNextHostedPointName(hostedPointsForNaming))
        : getNextHostedPointName(hostedPointsForNaming);
      if (!firstPointId) {
        hostedPointsForNaming.push({ id: startPointId, name: startPointName } as Solid3dHostedPoint);
      }
      const endPointName = secondPointId
        ? (currentState.hostedPoints.find((point) => point.id === secondPointId)?.name ??
          getNextHostedPointName(hostedPointsForNaming))
        : getNextHostedPointName(hostedPointsForNaming);
      const startPoint =
        firstPointId === null
          ? toHostedPoint(
              targetObject.id,
              objectColor,
              firstPoint,
              startPointId,
              startPointName
            )
          : null;
      const endPoint =
        secondPointId === null
          ? toHostedPoint(
              targetObject.id,
              objectColor,
              secondPoint,
              endPointId,
              endPointName
            )
          : null;
      const resolvedStartPoint =
        startPoint ?? currentState.hostedPoints.find((point) => point.id === startPointId);
      const resolvedEndPoint =
        endPoint ?? currentState.hostedPoints.find((point) => point.id === endPointId);
      const nextSegment: Solid3dHostedSegment = {
        id: generateId(),
        kind: "hosted_segment",
        hostObjectId: targetObject.id,
        hostFaceId:
          resolvedStartPoint?.hostFaceId &&
          resolvedStartPoint.hostFaceId === resolvedEndPoint?.hostFaceId
            ? resolvedStartPoint.hostFaceId
            : undefined,
        faceIndex:
          Number.isInteger(resolvedStartPoint?.faceIndex) &&
          Number.isInteger(resolvedEndPoint?.faceIndex) &&
          resolvedStartPoint.faceIndex === resolvedEndPoint.faceIndex
            ? resolvedStartPoint.faceIndex
            : undefined,
        startPointId,
        endPointId,
        semanticRole: "section_support",
        supportMode: "full_segment",
        color: objectColor,
        thickness: Math.max(1, targetObject.strokeWidth ?? 2),
        dashed: false,
        showEndpointLabels: false,
        visible: true,
      };
      const hasDuplicateSegment = currentState.hostedSegments.some(
        (segment) =>
          (segment.startPointId === startPointId && segment.endPointId === endPointId) ||
          (segment.startPointId === endPointId && segment.endPointId === startPointId)
      );
      if (hasDuplicateSegment) {
        setError("Такой hosted-отрезок уже существует.");
        return;
      }
      const nextState = {
        ...currentState,
        hostedPoints: [
          ...currentState.hostedPoints,
          ...(startPoint ? [startPoint] : []),
          ...(endPoint ? [endPoint] : []),
        ],
        hostedSegments: [...currentState.hostedSegments, nextSegment],
      };
      commitObjectUpdate(targetObject.id, {
        meta: writeSolid3dState(nextState, targetObject.meta),
      });
      setSelectedObjectId(targetObject.id);
      setSelectedHostedEntity({
        objectId: targetObject.id,
        entityType: "segment",
        entityId: nextSegment.id,
      });
      setSolid3dHostedDraft(null);
      setError(null);
    },
    [
      boardObjects,
      commitObjectUpdate,
      getNextHostedPointName,
      setError,
      setSelectedObjectId,
      solid3dHostedDraft,
      solid3dSectionDraftHandlers,
      toHostedPoint,
    ]
  );

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

  const handleOpenObjectEditorFromContextMenu = useCallback(
    (objectId: string) => {
      const targetObject = boardObjects.find((item) => item.id === objectId) ?? null;
      if (!targetObject) return;
      setSelectedConstraintId(null);
      setSelectedObjectId(objectId);
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
    [boardObjects, openUtilityPanel, setSelectedConstraintId, setSelectedObjectId]
  );

  const transformPanelBaseProps: WorkbookSessionTransformPanelProps =
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

  const transformPanelProps: WorkbookSessionTransformPanelProps = {
    ...transformPanelBaseProps,
    hostedGeometryDraftMode: solid3dHostedDraft?.mode ?? null,
    hostedGeometryDraftPoints: solid3dHostedDraft?.points ?? [],
    onStartSolid3dHostedSegmentMode: handleStartSolid3dHostedSegmentMode,
    onCancelSolid3dHostedDraft: () => handleCancelSolid3dHostedDraft(selectedObjectId ?? undefined),
    selectedHostedEntityType: selectedHostedEntity?.entityType ?? null,
    selectedHostedEntityId: selectedHostedEntity?.entityId ?? null,
    onSelectHostedEntity: (entityType, entityId) => {
      if (!selectedObjectId) return;
      setSelectedHostedEntity({
        objectId: selectedObjectId,
        entityType,
        entityId,
      });
    },
    onClearHostedEntitySelection: () => {
      setSelectedHostedEntity(null);
    },
    onUpdateSolid3dHostedPoint: selectedSolid3dActions.updateSolid3dHostedPoint,
    onUpdateSolid3dHostedSegment: selectedSolid3dActions.updateSolid3dHostedSegment,
    onDeleteSolid3dHostedSegment: selectedSolid3dActions.deleteSolid3dHostedSegment,
  };

  const orderedBoardPages = useMemo(
    () => selectionViewportState.boardPageOptions.map((option) => option.page),
    [selectionViewportState.boardPageOptions]
  );
  const safeCurrentBoardPage = useMemo(
    () =>
      orderedBoardPages.includes(currentBoardPage)
        ? currentBoardPage
        : orderedBoardPages[0] ?? Math.max(1, Math.round(currentBoardPage || 1)),
    [currentBoardPage, orderedBoardPages]
  );
  useEffect(() => {
    if (safeCurrentBoardPage === currentBoardPage) return;
    setCurrentBoardPage(safeCurrentBoardPage);
  }, [currentBoardPage, safeCurrentBoardPage, setCurrentBoardPage]);

  useWorkbookPageViewportPersistence({
    storageKey: pageViewportStorageKey,
    currentBoardPage,
    setCurrentBoardPage,
    canvasViewport,
    setCanvasViewport,
    availablePages: orderedBoardPages,
    enabled: bootstrapReady && Boolean(sessionId),
  });

  const handleSelectLocalBoardPage = useCallback(
    (page: number) => {
      const nextPage = toSafeWorkbookPage(page);
      if (!orderedBoardPages.includes(nextPage)) return;
      setCurrentBoardPage((current) => (current === nextPage ? current : nextPage));
    },
    [orderedBoardPages, setCurrentBoardPage]
  );
  const handleAddLocalBoardPage = useCallback(() => {
    const maxKnownPage = resolveMaxKnownWorkbookPage({
      pagesCount: boardSettings.pagesCount,
      boardObjects,
      boardStrokes,
      annotationStrokes,
    });
    const nextPage = Math.max(1, maxKnownPage + 1);
    handleAddBoardPage();
    setCurrentBoardPage(nextPage);
  }, [
    annotationStrokes,
    boardObjects,
    boardSettings.pagesCount,
    boardStrokes,
    handleAddBoardPage,
    setCurrentBoardPage,
  ]);
  const handleDeleteLocalBoardPage = useCallback(
    async (targetPage: number) => {
      const maxKnownPage = resolveMaxKnownWorkbookPage({
        pagesCount: boardSettings.pagesCount,
        boardObjects,
        boardStrokes,
        annotationStrokes,
      });
      const safeTargetPage = Math.min(maxKnownPage, toSafeWorkbookPage(targetPage));
      const currentOrder = normalizeWorkbookPageOrder(boardSettings.pageOrder, maxKnownPage);
      const nextOrder = normalizeWorkbookPageOrder(
        currentOrder
          .filter((pageId) => pageId !== safeTargetPage)
          .map((pageId) => (pageId > safeTargetPage ? pageId - 1 : pageId)),
        Math.max(1, maxKnownPage - 1)
      );
      const safeCurrentLocalPage = Math.min(maxKnownPage, toSafeWorkbookPage(currentBoardPage));
      const nextCurrentLocalPage = safeCurrentLocalPage > safeTargetPage
        ? safeCurrentLocalPage - 1
        : Math.min(safeCurrentLocalPage, Math.max(1, maxKnownPage - 1));
      await handleDeleteBoardPage(targetPage);
      if (nextOrder.includes(nextCurrentLocalPage)) {
        setCurrentBoardPage(nextCurrentLocalPage);
        return;
      }
      setCurrentBoardPage(nextOrder[0] ?? 1);
    },
    [
      annotationStrokes,
      boardObjects,
      boardSettings.pageOrder,
      boardSettings.pagesCount,
      boardStrokes,
      currentBoardPage,
      handleDeleteBoardPage,
      setCurrentBoardPage,
    ]
  );


  const { exportBoardAsPdf, defaultExportPdfName } = useWorkbookPdfExport({
    boardSettings,
    currentBoardPage,
    currentBoardPageRef,
    boardObjects,
    boardStrokes,
    sessionId,
    sessionTitle: session?.title,
    exportingSections,
    setExportingSections,
    setCanvasVisibilityMode,
    setCurrentBoardPage,
    setError,
  });

  const {
    confirmDialogOpen,
    isExportPdfConfirmOpen,
    confirmDialogContent,
    confirmActionSubmitting,
    exportPdfFileName,
    setExportPdfFileName,
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
    defaultExportPdfName,
    handleDeleteBoardPage: handleDeleteLocalBoardPage,
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
        currentBoardPage: safeCurrentBoardPage,
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
        selectedGraphPresetId,
        graphTabFunctions: selectionViewportState.graphTabFunctions,
        onCreatePlane: panelHandlers.handleGraphPanelCreatePlane,
        onSelectPlane: panelHandlers.handleGraphPanelSelectPlane,
        onAxisColorChange: panelHandlers.handleGraphPanelAxisColorChange,
        onPlaneColorChange: panelHandlers.handleGraphPanelPlaneColorChange,
        onClearPlaneBackground: panelHandlers.handleGraphPanelClearPlaneBackground,
        onSelectCatalogTab: panelHandlers.handleGraphPanelSelectCatalogTab,
        onSelectWorkTab: panelHandlers.handleGraphPanelSelectWorkTab,
        onSelectGraphPreset: panelHandlers.handleGraphPanelSelectPreset,
        onGraphFunctionColorChange: panelHandlers.handleGraphPanelFunctionColorChange,
        onToggleGraphFunctionDashed: panelHandlers.handleGraphPanelToggleDashed,
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
    canManageSession,
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

  const buildSessionExitPreviewPayload = useCallback(async () => {
    if (!session || session.roleInSession !== "teacher") return;
    if (typeof window === "undefined") return;
    const previewDataUrl = await captureWorkbookSessionPreviewDataUrl(
      workspaceRef.current ?? sessionRootRef.current
    );
    if (!previewDataUrl) return;
    const safePreviewPage = Math.max(1, Math.trunc(currentBoardPage || 1));
    return {
      previewDataUrl,
      previewAlt: `Последний вид доски · страница ${safePreviewPage}`,
      page: safePreviewPage,
      viewport: {
        x: canvasViewport.x,
        y: canvasViewport.y,
        zoom: viewportZoom,
      },
    };
  }, [
    canvasViewport.x,
    canvasViewport.y,
    currentBoardPage,
    session,
    sessionRootRef,
    viewportZoom,
    workspaceRef,
  ]);

  const persistSessionExitPreview = useCallback(async () => {
    const payload = await buildSessionExitPreviewPayload();
    if (!session || !payload) return;
    try {
      const uploadedPreview = await uploadWorkbookAsset({
        sessionId: session.id,
        fileName: `session-preview-${session.id}-${Date.now()}.jpg`,
        dataUrl: payload.previewDataUrl,
        mimeType: "image/jpeg",
      });
      await updateWorkbookSessionDraftPreview({
        sessionId: session.id,
        previewUrl: uploadedPreview.url,
        previewAlt: payload.previewAlt,
        page: payload.page,
        viewport: payload.viewport,
      });
    } catch {
      // Hub preview capture is best-effort and must not block session exit.
    }
  }, [buildSessionExitPreviewPayload, session]);

  const postSessionExitPreviewToHub = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !session ||
      session.roleInSession !== "teacher" ||
      !window.opener ||
      window.opener.closed
    ) {
      return false;
    }
    const payload = await buildSessionExitPreviewPayload();
    if (!payload) return false;
    const message: WorkbookHubPreviewBridgeMessage = {
      type: WORKBOOK_HUB_PREVIEW_BRIDGE_EVENT,
      payload: {
        sessionId: session.id,
        previewDataUrl: payload.previewDataUrl,
        previewAlt: payload.previewAlt,
        page: payload.page,
        viewport: payload.viewport,
        capturedAt: new Date().toISOString(),
      },
    };
    try {
      window.opener.postMessage(message, window.location.origin);
      return true;
    } catch {
      return false;
    }
  }, [buildSessionExitPreviewPayload, session]);

  const handleBack = useCallback(async () => {
    if (isBackNavigationPending) return;
    setIsBackNavigationPending(true);
    const showStudentExitNoticeState =
      session?.roleInSession === "student" ? { showStudentExitNotice: true } : undefined;
    try {
      if (dirtyRef.current) {
        const saved = await persistSnapshots({ force: true });
        if (!saved) {
          setError("Не удалось сохранить изменения перед выходом из тетради.");
          setIsBackNavigationPending(false);
          return;
        }
      }
      if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
        // Try to hand off preview to the hub tab without waiting for upload in this tab.
        const previewPosted = await Promise.race([
          postSessionExitPreviewToHub(),
          new Promise<boolean>((resolve) => {
            window.setTimeout(() => resolve(false), 240);
          }),
        ]);
        if (!previewPosted) {
          if (session) {
            queueWorkbookHubPreviewRefreshHint(session.id);
          }
          void persistSessionExitPreview();
        }
        try {
          window.opener.focus?.();
        } catch {
          // ignore opener focus errors; fallback will still close/navigate current tab
        }
        window.close();
        if (!window.closed) {
          navigate(fromPath, { replace: true, state: showStudentExitNoticeState });
        }
        return;
      }
      // Hub preview refresh is best-effort and must never delay route transition.
      if (session) {
        queueWorkbookHubPreviewRefreshHint(session.id);
      }
      void persistSessionExitPreview();
      navigate(fromPath, { replace: true, state: showStudentExitNoticeState });
    } catch {
      setError("Не удалось завершить выход из тетради. Повторите попытку.");
      setIsBackNavigationPending(false);
    }
  }, [
    dirtyRef,
    fromPath,
    isBackNavigationPending,
    navigate,
    postSessionExitPreviewToHub,
    persistSessionExitPreview,
    persistSnapshots,
    session,
    setError,
  ]);

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
    currentPage: safeCurrentBoardPage,
    loading,
    bootstrapReady,
    boardObjectsRef,
    boardStrokesRef,
    visibleImagesReady: selectionViewportState.visibleImagesReady,
    pendingVisibleImageCount: selectionViewportState.pendingVisibleImageCount,
  });
  const sanitizedGraphDraftFunctions = useMemo(
    () =>
      sanitizeFunctionGraphDrafts(graphDraftFunctions, {
        ensureNonEmpty: false,
      }),
    [graphDraftFunctions]
  );
  const handleOpenPageManager = useCallback(() => {
    setIsPageManagerOpen(true);
  }, []);
  const handleClosePageManager = useCallback(() => {
    setIsPageManagerOpen(false);
  }, []);

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

  const canvasProps = {
    boardStrokes: selectionViewportState.visibleBoardStrokes,
    annotationStrokes: selectionViewportState.visibleAnnotationStrokes,
    previewStrokes,
    boardObjects: selectionViewportState.visibleBoardObjects,
    constraints,
    layer,
    tool,
    color: strokeColor,
    width: strokeWidth,
    authorUserId: user?.id ?? "unknown",
    polygonSides,
    polygonMode,
    polygonPreset,
    textPreset,
    graphFunctions: sanitizedGraphDraftFunctions,
    lineStyle,
    snapToGrid: boardSettings.snapToGrid,
    gridSize: boardSettings.gridSize,
    viewportZoom,
    pageFrameWidth: boardSettings.pageFrameWidth,
    visibilityMode: canvasVisibilityMode,
    showGrid: boardSettings.showGrid,
    gridColor: boardSettings.gridColor,
    backgroundColor: boardSettings.backgroundColor,
    imageAssetUrls: selectionViewportState.imageAssetUrls,
    incomingEraserPreviews: selectionViewportState.visibleIncomingEraserPreviews,
    showPageNumbers: boardSettings.showPageNumbers,
    currentPage: safeCurrentBoardPage,
    disabled: !canEdit || boardLocked,
    selectedObjectId,
    selectedConstraintId,
    focusPoint,
    pointerPoint,
    focusPoints,
    pointerPoints,
    viewportOffset: canvasViewport,
    onViewportOffsetChange: handleCanvasViewportOffsetChange,
    onEraserRadiusChange: handleEraserRadiusChange,
    forcePanMode: spacePanActive,
    autoDividersEnabled: boardSettings.autoSectionDividers,
    autoDividerStep: boardSettings.dividerStep,
    areaSelection,
    solid3dDraftPointCollectionObjectId:
      solid3dHostedDraft?.objectId ?? solid3dSectionPointCollecting,
    solid3dSectionMarkers: solid3dHostedDraft
      ? {
          objectId: solid3dHostedDraft.objectId,
          sectionId: "hosted-draft",
          selectedPoints: solid3dHostedDraft.points,
        }
      : selectionViewportState.isSolid3dPointCollectionActive && solid3dDraftPoints
        ? {
            objectId: solid3dDraftPoints.objectId,
            sectionId: "draft",
            selectedPoints: solid3dDraftPoints.points,
          }
        : null,
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
    onObjectPinToggle: commitObjectPin,
    onObjectDelete: canvasHandlers.handleCanvasObjectDelete,
    onObjectContextMenu: handleObjectContextMenu,
    onShapeVertexContextMenu: handleShapeVertexContextMenu,
    onLineEndpointContextMenu: handleLineEndpointContextMenu,
    onSolid3dVertexContextMenu: handleSolid3dVertexContextMenu,
    onSolid3dSectionVertexContextMenu: handleSolid3dSectionVertexContextMenu,
    onSolid3dSectionContextMenu: handleSolid3dSectionContextMenu,
    onSolid3dDraftPointAdd: handleSolid3dDraftPointAdd,
    onAreaSelectionChange: canvasHandlers.handleCanvasAreaSelectionChange,
    onAreaSelectionContextMenu: canvasHandlers.handleCanvasAreaSelectionContextMenu,
    onInlineTextDraftChange: canvasHandlers.handleCanvasInlineTextDraftChange,
    onRequestSelectTool: canvasHandlers.handleCanvasRequestSelectTool,
    onLaserPoint: canvasHandlers.handleCanvasLaserPoint,
    onLaserClear: canvasHandlers.handleCanvasLaserClear,
    solid3dInsertPreset: pendingSolid3dInsertPreset,
    onSolid3dInsertConsumed: mathPresetCreationHandlers.clearPendingSolid3dInsertPreset,
  };
  const normalizePoint = (
    point: { x?: number; y?: number } | null | undefined,
    fallback: { x: number; y: number }
  ) => {
    if (
      point
      && typeof point.x === "number"
      && Number.isFinite(point.x)
      && typeof point.y === "number"
      && Number.isFinite(point.y)
    ) {
      return { x: point.x, y: point.y };
    }
    return fallback;
  };
  const safeTotalBoardPages = Math.max(
    safeCurrentBoardPage,
    Math.round(boardSettings.pagesCount || 1),
    selectionViewportState.boardPageOptions[
      selectionViewportState.boardPageOptions.length - 1
    ]?.page ?? 1
  );
  const sessionChatPosition = normalizePoint(workbookSessionUi.sessionChatPosition, {
    x: 24,
    y: 96,
  });
  const normalizedFloatingPanelsTop =
    typeof workbookSessionUi.floatingPanelsTop === "number"
    && Number.isFinite(workbookSessionUi.floatingPanelsTop)
      ? workbookSessionUi.floatingPanelsTop
      : 86;
  const hotkeysTooltipContent = (
    <div className="workbook-session__hotkeys-tooltip">
      <strong>Горячие клавиши</strong>
      <ul>
        <li>`Ctrl/Cmd + Z` — отмена действия</li>
        <li>`Ctrl/Cmd + Shift + Z` — повтор действия</li>
        <li>`Del / Backspace` — удалить выбранный объект</li>
        <li>`Shift + Click` — мультивыбор</li>
        <li>`Ctrl/Cmd + C` — копировать выделенную область (Ножницы)</li>
        <li>`Ctrl/Cmd + V` — вставить выделенную область (Ножницы)</li>
        <li>`Ctrl/Cmd + X` — вырезать выделенную область (Ножницы)</li>
        <li>`Space` — временная рука (pan)</li>
        <li>`Esc` — убрать указку (в режиме указки)</li>
      </ul>
    </div>
  );

  const participantsPanelProps = {
    participantCards,
    currentUserId: user?.id,
    currentUserRole: user?.role,
    canUseSessionChat,
    canManageSession,
    isSessionChatOpen,
    sessionChatUnreadCount,
    onToggleSessionChat: canvasHandlers.handleToggleSessionChat,
    onCollapseParticipants: canvasHandlers.handleCollapseParticipants,
    micEnabled,
    onToggleMic: canvasHandlers.handleToggleOwnMic,
    canUseMedia,
    isEnded,
    isParticipantBoardToolsEnabled,
    onToggleParticipantBoardTools: handleToggleParticipantBoardTools,
    onToggleParticipantChat: handleToggleParticipantChat,
    onToggleParticipantMic: handleToggleParticipantMic,
  };

  const sessionChatPanelProps = {
    showCollaborationPanels,
    isSessionChatOpen,
    sessionChatRef,
    sessionChatListRef,
    sessionChatDragStateRef,
    isSessionChatMinimized,
    isSessionChatMaximized,
    isCompactViewport,
    sessionChatPosition,
    participantCards,
    chatMessages,
    firstUnreadSessionChatMessageId,
    currentUserId: user?.id,
    canManageSession,
    canSendSessionChat,
    sessionChatUnreadCount,
    isSessionChatAtBottom,
    sessionChatDraft,
    isSessionChatEmojiOpen,
    chatEmojis: WORKBOOK_CHAT_EMOJIS,
    setIsSessionChatMinimized: workbookSessionActions.setIsSessionChatMinimized,
    setIsSessionChatMaximized: workbookSessionActions.setIsSessionChatMaximized,
    setIsSessionChatOpen: workbookSessionActions.setIsSessionChatOpen,
    setIsSessionChatEmojiOpen: workbookSessionActions.setIsSessionChatEmojiOpen,
    setSessionChatDraft: workbookSessionActions.setSessionChatDraft,
    setIsClearSessionChatDialogOpen: workbookSessionActions.setIsClearSessionChatDialogOpen,
    onSessionChatDragStart: handleSessionChatDragStart,
    onScrollSessionChatToLatest: scrollSessionChatToLatest,
    onMarkSessionChatReadToLatest: markSessionChatReadToLatest,
    onSendSessionChatMessage: handleSendSessionChatMessage,
  };
  const contextbarProps = {
    overlayContainer,
    menuAnchor,
    setMenuAnchor: workbookSessionActions.setMenuAnchor,
    exportBoardAsPdf: handleRequestExportPdf,
    exportingSections,
    onMenuClearBoard: handleRequestClearBoard,
    canClear,
    isEnded,
    canAccessBoardSettingsPanel,
    isUtilityPanelOpen,
    utilityTab,
    openUtilityPanel,
    boardPageOptions: selectionViewportState.boardPageOptions,
    currentBoardPage: safeCurrentBoardPage,
    totalBoardPages: safeTotalBoardPages,
    onOpenPageManager: handleOpenPageManager,
    canManageBoardPages: canManageSharedBoardSettings,
    isBoardPageMutationPending,
    onSelectBoardPage: handleSelectLocalBoardPage,
    onAddBoardPage: handleAddLocalBoardPage,
    onDeleteBoardPage: handleRequestDeleteBoardPage,
    canUseUndo,
    undoDepth,
    redoDepth,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onZoomOut: zoomOut,
    onZoomIn: zoomIn,
    onResetZoom: resetZoom,
    viewportZoom,
    canInsertImage,
    onRequestDocsUpload: () => openImportModal(),
    hotkeysTooltipContent,
    isFullscreen,
    onToggleFullscreen: toggleFullscreen,
    themeMode,
    onToggleThemeMode: toggleMode,
    onExitSession: handleBack,
    isExitSessionPending: isBackNavigationPending,
    showCollaborationPanels,
    isParticipantsCollapsed,
    onToggleParticipantsCollapsed: () =>
      workbookSessionActions.setIsParticipantsCollapsed((current: boolean) => !current),
    showInviteLinkButton: canManageSession && session?.kind === "CLASS",
    copyingInviteLink,
    onCopyInviteLink: handleCopyInviteLink,
    recordingControls: lessonRecordingControls,
    contextbarRef,
    isDockedContextbarViewport,
    isCompactViewport,
  };

  const boardShellProps = {
    canvasProps,
    isSessionTabPassive,
    isSessionAccessBlocked,
    activeSessionTabId,
    presenceTabId: presenceTabIdSnapshot || activeSessionTabId || "",
    beforeCatalogToolButtons,
    afterCatalogToolButtons,
    canDraw,
    onOpenShapesDialog: () => workbookSessionActions.setIsShapesDialogOpen(true),
    onOpenStereoDialog: () => workbookSessionActions.setIsStereoDialogOpen(true),
  };

  const docsWindowProps = {
    pinned: docsWindow.pinned,
    maximized: docsWindow.maximized,
    canInsertImage,
    uploadingDoc,
    uploadProgress,
    assets: documentState.assets,
    activeAssetId: documentState.activeAssetId,
    activeDocument: selectionViewportState.activeDocument,
    page: documentState.page,
    zoom: documentState.zoom,
    activeDocumentPageCount: selectionViewportState.activeDocumentPageCount,
    annotationsCount: documentState.annotations.length,
    onTogglePinned: panelHandlers.handleDocsWindowTogglePinned,
    onToggleMaximized: panelHandlers.handleDocsWindowToggleMaximized,
    onClose: panelHandlers.handleDocsWindowClose,
    onRequestUpload: panelHandlers.handleDocsWindowRequestUpload,
    onSnapshotToBoard: panelHandlers.handleDocsWindowSnapshotToBoard,
    onAddAnnotation: panelHandlers.handleDocsWindowAddAnnotation,
    onClearAnnotations: panelHandlers.handleDocsWindowClearAnnotations,
    onSelectAsset: panelHandlers.handleDocsWindowSelectAsset,
    onChangePage: panelHandlers.handleDocsWindowPageChange,
    onChangeZoom: panelHandlers.handleDocsWindowZoomChange,
  };

  const utilityPanelChromeProps = {
    isOpen: isUtilityPanelOpen,
    utilityPanelRef,
    isUtilityPanelCollapsed,
    isContextualUtilityPanel: selectionViewportState.isContextualUtilityPanel,
    utilityTab,
    isCompactViewport,
    utilityPanelPosition,
    floatingPanelsTop: normalizedFloatingPanelsTop,
    onDragStart: handleUtilityPanelDragStart,
    title: utilityPanelTitle,
    setIsUtilityPanelCollapsed: workbookSessionActions.setIsUtilityPanelCollapsed,
    setIsUtilityPanelOpen: workbookSessionActions.setIsUtilityPanelOpen,
  };

  const utilityPanelTabsProps = {
    utilityTab,
    selectedObjectSupportsGraphPanel: selectionViewportState.selectedObjectSupportsGraphPanel,
    selectedObjectSupportsTransformPanel:
      selectionViewportState.selectedObjectSupportsTransformPanel,
    settingsPanelProps,
    graphPanelProps,
    transformPanelProps,
  };

  const overlaysProps = {
    overlayContainer,
    isClearSessionChatDialogOpen,
    setIsClearSessionChatDialogOpen: workbookSessionActions.setIsClearSessionChatDialogOpen,
    isCompactDialogViewport,
    handleClearSessionChat,
    solid3dVertexContextMenu,
    setSolid3dVertexContextMenu: workbookSessionActions.setSolid3dVertexContextMenu,
    renameSolid3dVertex: selectedSolid3dActions.renameSolid3dVertex,
    getSolidVertexLabel,
    solid3dSectionVertexContextMenu,
    setSolid3dSectionVertexContextMenu:
      workbookSessionActions.setSolid3dSectionVertexContextMenu,
    renameSolid3dSectionVertex: selectedSolid3dActions.renameSolid3dSectionVertex,
    getSectionVertexLabel,
    solid3dSectionContextMenu,
    setSolid3dSectionContextMenu: workbookSessionActions.setSolid3dSectionContextMenu,
    contextMenuSection: selectionViewportState.contextMenuSection,
    updateSolid3dSection: selectedSolid3dActions.updateSolid3dSection,
    deleteSolid3dSection: selectedSolid3dActions.deleteSolid3dSection,
    shapeVertexContextMenu,
    contextMenuShapeVertexObject: selectionViewportState.contextMenuShapeVertexObject,
    setShapeVertexContextMenu: workbookSessionActions.setShapeVertexContextMenu,
    shapeVertexLabelDraft,
    setShapeVertexLabelDraft: workbookSessionActions.setShapeVertexLabelDraft,
    renameShape2dVertexByObjectId: selectedStructureActions.renameShape2dVertexByObjectId,
    lineEndpointContextMenu,
    contextMenuLineEndpointObject: selectionViewportState.contextMenuLineEndpointObject,
    setLineEndpointContextMenu: workbookSessionActions.setLineEndpointContextMenu,
    lineEndpointLabelDraft,
    setLineEndpointLabelDraft: workbookSessionActions.setLineEndpointLabelDraft,
    renameLineEndpointByObjectId: selectedStructureActions.renameLineEndpointByObjectId,
    objectContextMenu,
    setObjectContextMenu: workbookSessionActions.setObjectContextMenu,
    contextMenuObject: selectionViewportState.contextMenuObject,
    onRequestEditObject: handleOpenObjectEditorFromContextMenu,
    pointLabelDraft,
    setPointLabelDraft: workbookSessionActions.setPointLabelDraft,
    renamePointObject: selectedStructureActions.renamePointObject,
    canDelete,
    commitObjectDelete,
    scaleObject,
    commitObjectReorder,
    canBringContextMenuImageToFront: selectionViewportState.canBringContextMenuImageToFront,
    canSendContextMenuImageToBack: selectionViewportState.canSendContextMenuImageToBack,
    canRestoreContextMenuImage: selectionViewportState.canRestoreContextMenuImage,
    restoreImageOriginalView,
    areaSelectionContextMenu,
    areaSelectionHasContent,
    setAreaSelectionContextMenu: workbookSessionActions.setAreaSelectionContextMenu,
    copyAreaSelectionObjects,
    cutAreaSelectionObjects,
    cropImageByAreaSelection,
    fillAreaSelection,
    areaFillDefaultColor: strokeColor,
    canCropAreaSelectionImage: selectionViewportState.canCropAreaSelectionImage,
    createCompositionFromAreaSelection,
    areaSelection,
    deleteAreaSelectionObjects,
    canSelect,
    isStereoDialogOpen,
    setIsStereoDialogOpen: workbookSessionActions.setIsStereoDialogOpen,
    createMathPresetObject: mathPresetCreationHandlers.createMathPresetObject,
    isShapesDialogOpen,
    setIsShapesDialogOpen: workbookSessionActions.setIsShapesDialogOpen,
    shapeCatalog,
    activateTool,
  };

  return (
    <section
      className={`workbook-session ${isFullscreen ? "is-fullscreen" : ""}`}
      ref={handleSessionRootRef}
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

      <WorkbookImportModalBoundary
        active={isImportModalOpen}
        onReset={handleImportModalClose}
      >
        {isImportModalOpen ? (
          <Suspense fallback={null}>
            <WorkbookImportModal
              open={isImportModalOpen}
              sessionId={sessionId}
              initialFiles={pendingImportFiles}
              container={overlayContainer}
              onClose={handleImportModalClose}
              onImportFile={handleImportModalFile}
            />
          </Suspense>
        ) : null}
      </WorkbookImportModalBoundary>

      {isPageManagerOpen ? (
        <Suspense fallback={null}>
          <WorkbookSessionPageManagerFullscreen
            open={isPageManagerOpen}
            overlayContainer={overlayContainer}
            pageOptions={selectionViewportState.boardPageOptions}
            boardObjects={boardObjects}
            boardStrokes={boardStrokes}
            annotationStrokes={annotationStrokes}
            imageAssetUrls={selectionViewportState.imageAssetUrls}
            boardBackgroundColor={boardSettings.backgroundColor}
            boardGridColor={boardSettings.gridColor}
            boardGridSize={boardSettings.gridSize}
            boardPageFrameWidth={boardSettings.pageFrameWidth}
            currentPage={safeCurrentBoardPage}
            canManageBoardPages={canManageSharedBoardSettings}
            isBoardPageMutationPending={isBoardPageMutationPending}
            onClose={handleClosePageManager}
            onSelectPage={handleSelectLocalBoardPage}
            onReorderPages={handleReorderBoardPages}
          />
        </Suspense>
      ) : null}

      <WorkbookLessonRecordingDialogs
        overlayContainer={overlayContainer}
        isCompactDialogViewport={isCompactDialogViewport}
        preStartDialogOpen={lessonRecording.preStartDialogOpen}
        isStarting={lessonRecording.status === "starting"}
        onClosePreStartDialog={lessonRecording.closePreStartDialog}
        onConfirmPreStartDialog={() => {
          void lessonRecording.startRecording();
        }}
        notice={lessonRecording.notice}
        onCloseNotice={lessonRecording.closeNotice}
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
          confirmDisabled={isExportPdfConfirmOpen && exportPdfFileName.trim().length === 0}
          content={
            isExportPdfConfirmOpen ? (
              <TextField
                autoFocus
                fullWidth
                size="small"
                label="Имя файла"
                value={exportPdfFileName}
                onChange={(event) => setExportPdfFileName(event.target.value)}
                disabled={confirmActionSubmitting}
                inputProps={{ maxLength: 120 }}
                helperText="Расширение .pdf добавится автоматически"
              />
            ) : undefined
          }
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
