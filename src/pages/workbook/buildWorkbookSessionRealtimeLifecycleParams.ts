import type { WorkbookEvent } from "@/features/workbook/model/types";
import type {
  WorkbookSessionCollabSlice,
  WorkbookSessionDataSlice,
  WorkbookSessionPageSlice,
  WorkbookSessionStoreActions,
  WorkbookSessionToolingSlice,
} from "@/features/workbook/model/workbookSessionStoreTypes";
import type { useWorkbookSessionRefs } from "./workbookSessionRefs";
import type { useWorkbookSessionChatEventHandlers } from "./useWorkbookSessionChatEventHandlers";
import type { useWorkbookSessionLocalRuntime } from "./useWorkbookSessionLocalRuntime";
import type { useWorkbookSessionRealtimeLifecycle } from "./useWorkbookSessionRealtimeLifecycle";

type WorkbookSessionRefs = ReturnType<typeof useWorkbookSessionRefs>;
type ChatEventHandlers = ReturnType<typeof useWorkbookSessionChatEventHandlers>;
type LocalRuntimeHandlers = ReturnType<typeof useWorkbookSessionLocalRuntime>;
type RealtimeLifecycleParams = Parameters<typeof useWorkbookSessionRealtimeLifecycle>[0];

interface BuildWorkbookSessionRealtimeLifecycleParamsInput {
  sessionId: string;
  userId?: string;
  isWorkbookSessionAuthLost: boolean;
  bootstrapReady: boolean;
  isLivekitConnected: boolean;
  isTeacherActor: boolean;
  canUseSessionChat: boolean;
  isSessionChatOpen: boolean;
  isSessionChatMinimized: boolean;
  isSessionChatMaximized: boolean;
  isSessionChatAtBottom: boolean;
  isCompactViewport: boolean;
  adaptivePollingEnabled: boolean;
  clampedEraserRadius: number;
  smartInkOptions: WorkbookSessionDataSlice["smartInkOptions"];
  collab: WorkbookSessionCollabSlice;
  page: WorkbookSessionPageSlice;
  data: WorkbookSessionDataSlice;
  tooling: WorkbookSessionToolingSlice;
  actions: WorkbookSessionStoreActions;
  refs: WorkbookSessionRefs;
  applyIncomingEvents: (events: WorkbookEvent[]) => void;
  clearLocalPreviewPatchRuntime: LocalRuntimeHandlers["clearLocalPreviewPatchRuntime"];
  clearObjectSyncRuntime: () => void;
  clearStrokePreviewRuntime: () => void;
  clearIncomingEraserPreviewRuntime: () => void;
  filterUnseenWorkbookEvents: ChatEventHandlers["filterUnseenWorkbookEvents"];
  recoverChatMessagesFromEvents: ChatEventHandlers["recoverChatMessagesFromEvents"];
  markSessionChatReadToLatest: ChatEventHandlers["markSessionChatReadToLatest"];
  scrollSessionChatToLatest: ChatEventHandlers["scrollSessionChatToLatest"];
  scrollSessionChatToMessage: ChatEventHandlers["scrollSessionChatToMessage"];
  sessionChatReadStorageKey: string;
  sessionTabLockStorageKey: string;
  sessionTabLockChannelName: string;
  personalBoardSettingsStorageKey: string;
  firstUnreadSessionChatMessageId: string | null;
  areParticipantsEqual: LocalRuntimeHandlers["areParticipantsEqual"];
  pollIntervalMs: number;
  pollIntervalStreamConnectedMs: number;
  resyncMinIntervalMs: number;
  adaptivePollingMinMs: number;
  adaptivePollingMaxMs: number;
  tabLockHeartbeatMs: number;
  presenceIntervalMs: number;
  autosaveIntervalMs: number;
  sessionChatScrollBottomThresholdPx: number;
  scheduleAutosave: RealtimeLifecycleParams["persistSnapshotsParams"]["scheduleAutosave"];
}

export const buildWorkbookSessionRealtimeLifecycleParams = ({
  sessionId,
  userId,
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
  smartInkOptions,
  collab,
  page,
  data,
  tooling,
  actions,
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
  pollIntervalMs,
  pollIntervalStreamConnectedMs,
  resyncMinIntervalMs,
  adaptivePollingMinMs,
  adaptivePollingMaxMs,
  tabLockHeartbeatMs,
  presenceIntervalMs,
  autosaveIntervalMs,
  sessionChatScrollBottomThresholdPx,
  scheduleAutosave,
}: BuildWorkbookSessionRealtimeLifecycleParamsInput): RealtimeLifecycleParams => ({
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
    setSaveState: actions.setSaveState,
    setError: actions.setError,
    setSaveSyncWarning: actions.setSaveSyncWarning,
    setBootstrapReady: actions.setBootstrapReady,
    setLoading: actions.setLoading,
    setSession: actions.setSession,
    setBoardStrokes: actions.setBoardStrokes,
    setBoardObjects: actions.setBoardObjects,
    setConstraints: actions.setConstraints,
    setBoardSettings: actions.setBoardSettings,
    setAnnotationStrokes: actions.setAnnotationStrokes,
    setLatestSeq: actions.setLatestSeq,
    setUndoDepth: actions.setUndoDepth,
    setRedoDepth: actions.setRedoDepth,
    setFocusPoint: actions.setFocusPoint,
    setPointerPoint: actions.setPointerPoint,
    setFocusPointsByUser: actions.setFocusPointsByUser,
    setPointerPointsByUser: actions.setPointerPointsByUser,
    setChatMessages: actions.setChatMessages,
    setComments: actions.setComments,
    setTimerState: actions.setTimerState,
    setLibraryState: actions.setLibraryState,
    setDocumentState: actions.setDocumentState,
    setRealtimeSyncWarning: actions.setRealtimeSyncWarning,
    authRequiredRef: refs.authRequiredRef,
    loadSessionRequestIdRef: refs.loadSessionRequestIdRef,
    firstInteractiveMetricReportedRef: refs.firstInteractiveMetricReportedRef,
    queuedBoardSettingsCommitRef: refs.queuedBoardSettingsCommitRef,
    queuedBoardSettingsHistoryBeforeRef: refs.queuedBoardSettingsHistoryBeforeRef,
    boardSettingsCommitTimerRef: refs.boardSettingsCommitTimerRef,
    latestSeqRef: refs.latestSeqRef,
    processedEventIdsRef: refs.processedEventIdsRef,
    smartInkStrokeBufferRef: refs.smartInkStrokeBufferRef,
    smartInkProcessedStrokeIdsRef: refs.smartInkProcessedStrokeIdsRef,
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
    enabled: Boolean(userId) && !isWorkbookSessionAuthLost,
    bootstrapReady,
    filterUnseenWorkbookEvents,
    latestSeqRef: refs.latestSeqRef,
    sessionResyncInFlightRef: refs.sessionResyncInFlightRef,
    realtimeDisconnectSinceRef: refs.realtimeDisconnectSinceRef,
    lastForcedResyncAtRef: refs.lastForcedResyncAtRef,
    workbookLiveSendRef: refs.workbookLiveSendRef,
    setLatestSeq: actions.setLatestSeq,
    setRealtimeSyncWarning: actions.setRealtimeSyncWarning,
    isWorkbookStreamConnected: collab.isWorkbookStreamConnected,
    isWorkbookLiveConnected: collab.isWorkbookLiveConnected,
    setIsWorkbookStreamConnected: actions.setIsWorkbookStreamConnected,
    setIsWorkbookLiveConnected: actions.setIsWorkbookLiveConnected,
    pollIntervalMs,
    pollIntervalStreamConnectedMs,
    resyncMinIntervalMs,
    adaptivePollingEnabled,
    adaptivePollingMinMs,
    adaptivePollingMaxMs,
    isMediaAudioConnected: isLivekitConnected,
  },
  sessionTabLockParams: {
    sessionTabLockStorageKey,
    sessionTabLockChannelName,
    tabIdRef: refs.presenceTabIdRef,
    setActiveSessionTabId: actions.setActiveSessionTabId,
    setIsSessionTabPassive: actions.setIsSessionTabPassive,
    heartbeatMs: tabLockHeartbeatMs,
  },
  personalBoardSettingsParams: {
    personalBoardSettingsStorageKey,
    personalBoardSettingsReadyRef: refs.personalBoardSettingsReadyRef,
    skipNextPersonalBoardSettingsPersistRef: refs.skipNextPersonalBoardSettingsPersistRef,
    setPenToolSettings: actions.setPenToolSettings,
    setHighlighterToolSettings: actions.setHighlighterToolSettings,
    setEraserRadius: actions.setEraserRadius,
    setSmartInkOptions: actions.setSmartInkOptions,
    penToolSettings: tooling.penToolSettings,
    highlighterToolSettings: tooling.highlighterToolSettings,
    clampedEraserRadius,
    smartInkOptions,
  },
  presenceLifecycleParams: {
    sessionId,
    userId,
    isTeacherActor,
    presenceTabIdRef: refs.presenceTabIdRef,
    presenceLeaveSentRef: refs.presenceLeaveSentRef,
    presenceIntervalMs,
  },
  areParticipantsEqual,
  sessionChatUiEffectsParams: {
    sessionChatReadStorageKey,
    setSessionChatReadAt: actions.setSessionChatReadAt,
    canUseSessionChat,
    isSessionChatOpen,
    setIsSessionChatOpen: actions.setIsSessionChatOpen,
    setIsSessionChatEmojiOpen: actions.setIsSessionChatEmojiOpen,
    setSessionChatDraft: actions.setSessionChatDraft,
    isSessionChatMinimized,
    isSessionChatMaximized,
    isSessionChatAtBottom,
    firstUnreadSessionChatMessageId,
    sessionChatUnreadCount: page.sessionChatUnreadCount,
    chatMessages: data.chatMessages,
    sessionChatShouldScrollToUnreadRef: refs.sessionChatShouldScrollToUnreadRef,
    sessionChatListRef: refs.sessionChatListRef,
    sessionChatRef: refs.sessionChatRef,
    sessionChatDragStateRef: refs.sessionChatDragStateRef,
    isCompactViewport,
    setIsSessionChatAtBottom: actions.setIsSessionChatAtBottom,
    markSessionChatReadToLatest,
    scrollSessionChatToLatest,
    scrollSessionChatToMessage,
    setSessionChatPosition: actions.setSessionChatPosition,
    sessionChatScrollBottomThresholdPx,
  },
  persistSnapshotsParams: {
    sessionId,
    boardStrokes: data.boardStrokes,
    boardObjects: data.boardObjects,
    constraints: data.constraints,
    chatMessages: data.chatMessages,
    comments: data.comments,
    timerState: data.timerState,
    boardSettings: data.boardSettings,
    libraryState: data.libraryState,
    documentState: data.documentState,
    annotationStrokes: data.annotationStrokes,
    latestSeq: collab.latestSeq,
    authRequiredRef: refs.authRequiredRef,
    dirtyRef: refs.dirtyRef,
    dirtyRevisionRef: refs.dirtyRevisionRef,
    isSavingRef: refs.isSavingRef,
    pendingAutosaveAfterSaveRef: refs.pendingAutosaveAfterSaveRef,
    setSaveState: actions.setSaveState,
    setSaveSyncWarning: actions.setSaveSyncWarning,
    scheduleAutosave,
  },
  persistenceLifecycleParams: {
    sessionId,
    sessionReady: Boolean(data.session && !isWorkbookSessionAuthLost),
    persistSnapshotsRef: refs.persistSnapshotsRef,
    dirtyRef: refs.dirtyRef,
    autosaveIntervalMs,
  },
});
