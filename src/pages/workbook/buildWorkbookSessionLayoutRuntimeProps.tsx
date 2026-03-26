import type { ComponentProps } from "react";
import type {
  WorkbookSessionDataSlice,
  WorkbookSessionUiSlice,
  WorkbookSessionPageSlice,
  WorkbookSessionSceneSlice,
  WorkbookSessionStoreActions,
} from "@/features/workbook/model/workbookSessionStoreTypes";
import type { useWorkbookSessionRefs } from "./workbookSessionRefs";
import type { WorkbookSessionDocsWindowProps } from "./WorkbookSessionDocsWindow";
import type { WorkbookSessionParticipantsPanelProps } from "./WorkbookSessionParticipantsPanel";
import { WorkbookSessionBoardShell } from "./WorkbookSessionBoardShell";
import { WorkbookSessionChatPanel } from "./WorkbookSessionChatPanel";
import { WorkbookSessionContextbar } from "./WorkbookSessionContextbar";
import { WorkbookSessionOverlays } from "./WorkbookSessionOverlays";
import { WorkbookSessionUtilityPanelChrome } from "./WorkbookSessionUtilityPanelChrome";
import { WorkbookSessionUtilityPanelTabs } from "./WorkbookSessionUtilityPanelTabs";

type WorkbookSessionRefs = ReturnType<typeof useWorkbookSessionRefs>;
type ContextbarProps = ComponentProps<typeof WorkbookSessionContextbar>;
type BoardShellProps = ComponentProps<typeof WorkbookSessionBoardShell>;
type UtilityPanelChromeProps = Omit<
  ComponentProps<typeof WorkbookSessionUtilityPanelChrome>,
  "children"
>;
type UtilityPanelTabsProps = ComponentProps<typeof WorkbookSessionUtilityPanelTabs>;
type SessionChatPanelProps = ComponentProps<typeof WorkbookSessionChatPanel>;
type OverlaysProps = ComponentProps<typeof WorkbookSessionOverlays>;

type BuildWorkbookSessionLayoutRuntimePropsInput = {
  user: { id?: string; role?: string } | null;
  ui: WorkbookSessionUiSlice;
  page: WorkbookSessionPageSlice;
  scene: WorkbookSessionSceneSlice;
  data: WorkbookSessionDataSlice;
  refs: WorkbookSessionRefs;
  permissions: {
    canUseSessionChat: boolean;
    canManageSession: boolean;
    canSendSessionChat: boolean;
    canUseMedia: boolean;
    isEnded: boolean;
    showCollaborationPanels: boolean;
    canClear: boolean;
    canAccessBoardSettingsPanel: boolean;
    canManageSharedBoardSettings: boolean;
    canUseUndo: boolean;
    canInsertImage: boolean;
    canDelete: boolean;
    canSelect: boolean;
    canDraw: boolean;
  };
  derived: {
    participantCards: WorkbookSessionParticipantsPanelProps["participantCards"];
    sessionChatUnreadCount: number;
    firstUnreadSessionChatMessageId: string | null;
    chatEmojis: SessionChatPanelProps["chatEmojis"];
    micEnabled: WorkbookSessionParticipantsPanelProps["micEnabled"];
    canvasProps: BoardShellProps["canvasProps"];
    beforeCatalogToolButtons: BoardShellProps["beforeCatalogToolButtons"];
    afterCatalogToolButtons: BoardShellProps["afterCatalogToolButtons"];
    activeDocument: WorkbookSessionDocsWindowProps["activeDocument"];
    activeDocumentPageCount: WorkbookSessionDocsWindowProps["activeDocumentPageCount"];
    isContextualUtilityPanel: UtilityPanelChromeProps["isContextualUtilityPanel"];
    selectedObjectSupportsGraphPanel: UtilityPanelTabsProps["selectedObjectSupportsGraphPanel"];
    selectedObjectSupportsTransformPanel: UtilityPanelTabsProps["selectedObjectSupportsTransformPanel"];
    settingsPanelProps: UtilityPanelTabsProps["settingsPanelProps"];
    graphPanelProps: UtilityPanelTabsProps["graphPanelProps"];
    boardPageOptions: UtilityPanelTabsProps["settingsPanelProps"]["pageOptions"];
    transformPanelProps: UtilityPanelTabsProps["transformPanelProps"];
    isCompactDialogViewport: OverlaysProps["isCompactDialogViewport"];
    contextMenuSection: OverlaysProps["contextMenuSection"];
    contextMenuShapeVertexObject: OverlaysProps["contextMenuShapeVertexObject"];
    contextMenuLineEndpointObject: OverlaysProps["contextMenuLineEndpointObject"];
    contextMenuObject: OverlaysProps["contextMenuObject"];
    canBringContextMenuImageToFront: OverlaysProps["canBringContextMenuImageToFront"];
    canSendContextMenuImageToBack: OverlaysProps["canSendContextMenuImageToBack"];
    canRestoreContextMenuImage: OverlaysProps["canRestoreContextMenuImage"];
    canCropAreaSelectionImage: OverlaysProps["canCropAreaSelectionImage"];
    areaSelectionHasContent: OverlaysProps["areaSelectionHasContent"];
    shapeCatalog: OverlaysProps["shapeCatalog"];
  };
  handlers: {
    handleToggleSessionChat: WorkbookSessionParticipantsPanelProps["onToggleSessionChat"];
    handleCollapseParticipants: WorkbookSessionParticipantsPanelProps["onCollapseParticipants"];
    handleToggleOwnMic: WorkbookSessionParticipantsPanelProps["onToggleMic"];
    isParticipantBoardToolsEnabled: WorkbookSessionParticipantsPanelProps["isParticipantBoardToolsEnabled"];
    handleToggleParticipantBoardTools: WorkbookSessionParticipantsPanelProps["onToggleParticipantBoardTools"];
    handleToggleParticipantChat: WorkbookSessionParticipantsPanelProps["onToggleParticipantChat"];
    handleToggleParticipantMic: WorkbookSessionParticipantsPanelProps["onToggleParticipantMic"];
    handleSessionChatDragStart: SessionChatPanelProps["onSessionChatDragStart"];
    scrollSessionChatToLatest: SessionChatPanelProps["onScrollSessionChatToLatest"];
    markSessionChatReadToLatest: SessionChatPanelProps["onMarkSessionChatReadToLatest"];
    handleSendSessionChatMessage: SessionChatPanelProps["onSendSessionChatMessage"];
    exportBoardAsPdf: ContextbarProps["exportBoardAsPdf"];
    handleMenuClearBoard: ContextbarProps["onMenuClearBoard"];
    openUtilityPanel: ContextbarProps["openUtilityPanel"];
    handleSelectBoardPage: ContextbarProps["onSelectBoardPage"];
    handleAddBoardPage: ContextbarProps["onAddBoardPage"];
    handleDeleteBoardPage: ContextbarProps["onDeleteBoardPage"];
    handleUndo: ContextbarProps["onUndo"];
    handleRedo: ContextbarProps["onRedo"];
    zoomOut: ContextbarProps["onZoomOut"];
    zoomIn: ContextbarProps["onZoomIn"];
    resetZoom: ContextbarProps["onResetZoom"];
    requestDocsUpload: ContextbarProps["onRequestDocsUpload"];
    toggleFullscreen: ContextbarProps["onToggleFullscreen"];
    handleCopyInviteLink: ContextbarProps["onCopyInviteLink"];
    handleDocsWindowTogglePinned: WorkbookSessionDocsWindowProps["onTogglePinned"];
    handleDocsWindowToggleMaximized: WorkbookSessionDocsWindowProps["onToggleMaximized"];
    handleDocsWindowClose: WorkbookSessionDocsWindowProps["onClose"];
    handleDocsWindowRequestUpload: WorkbookSessionDocsWindowProps["onRequestUpload"];
    handleDocsWindowSnapshotToBoard: WorkbookSessionDocsWindowProps["onSnapshotToBoard"];
    handleDocsWindowAddAnnotation: WorkbookSessionDocsWindowProps["onAddAnnotation"];
    handleDocsWindowClearAnnotations: WorkbookSessionDocsWindowProps["onClearAnnotations"];
    handleDocsWindowSelectAsset: WorkbookSessionDocsWindowProps["onSelectAsset"];
    handleDocsWindowPageChange: WorkbookSessionDocsWindowProps["onChangePage"];
    handleDocsWindowZoomChange: WorkbookSessionDocsWindowProps["onChangeZoom"];
    handleUtilityPanelDragStart: UtilityPanelChromeProps["onDragStart"];
    utilityPanelTitle: UtilityPanelChromeProps["title"];
    handleClearSessionChat: OverlaysProps["handleClearSessionChat"];
    renameSolid3dVertex: OverlaysProps["renameSolid3dVertex"];
    getSolidVertexLabel: OverlaysProps["getSolidVertexLabel"];
    renameSolid3dSectionVertex: OverlaysProps["renameSolid3dSectionVertex"];
    getSectionVertexLabel: OverlaysProps["getSectionVertexLabel"];
    updateSolid3dSection: OverlaysProps["updateSolid3dSection"];
    deleteSolid3dSection: OverlaysProps["deleteSolid3dSection"];
    renameShape2dVertexByObjectId: OverlaysProps["renameShape2dVertexByObjectId"];
    renameLineEndpointByObjectId: OverlaysProps["renameLineEndpointByObjectId"];
    renamePointObject: OverlaysProps["renamePointObject"];
    commitObjectDelete: OverlaysProps["commitObjectDelete"];
    commitObjectPin: OverlaysProps["commitObjectPin"];
    scaleObject: OverlaysProps["scaleObject"];
    commitObjectReorder: OverlaysProps["commitObjectReorder"];
    restoreImageOriginalView: OverlaysProps["restoreImageOriginalView"];
    copyAreaSelectionObjects: OverlaysProps["copyAreaSelectionObjects"];
    cutAreaSelectionObjects: OverlaysProps["cutAreaSelectionObjects"];
    cropImageByAreaSelection: OverlaysProps["cropImageByAreaSelection"];
    fillAreaSelection: OverlaysProps["fillAreaSelection"];
    createCompositionFromAreaSelection: OverlaysProps["createCompositionFromAreaSelection"];
    deleteAreaSelectionObjects: OverlaysProps["deleteAreaSelectionObjects"];
    createMathPresetObject: OverlaysProps["createMathPresetObject"];
    activateTool: OverlaysProps["activateTool"];
  };
  actions: WorkbookSessionStoreActions;
  overlayContainer: ContextbarProps["overlayContainer"];
};

export interface WorkbookSessionLayoutRuntimeProps {
  participantsPanelProps: WorkbookSessionParticipantsPanelProps;
  sessionChatPanelProps: SessionChatPanelProps;
  contextbarProps: ContextbarProps;
  boardShellProps: BoardShellProps;
  docsWindowProps: WorkbookSessionDocsWindowProps;
  utilityPanelChromeProps: UtilityPanelChromeProps;
  utilityPanelTabsProps: UtilityPanelTabsProps;
  overlaysProps: OverlaysProps;
}

// Intentionally takes grouped runtime objects from WorkbookSessionPage to keep page orchestration concise.
export const buildWorkbookSessionLayoutRuntimeProps = ({
  user,
  ui,
  page,
  scene,
  data,
  refs,
  permissions,
  derived,
  handlers,
  actions,
  overlayContainer,
}: BuildWorkbookSessionLayoutRuntimePropsInput): WorkbookSessionLayoutRuntimeProps => {
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
  const safeCurrentBoardPage = Math.max(
    1,
    Math.round(data.boardSettings.currentPage || 1)
  );
  const safeTotalBoardPages = Math.max(
    safeCurrentBoardPage,
    Math.round(data.boardSettings.pagesCount || 1),
    derived.boardPageOptions[derived.boardPageOptions.length - 1]?.page ?? 1
  );

  const sessionChatPosition = normalizePoint(ui.sessionChatPosition, { x: 24, y: 96 });
  const floatingPanelsTop =
    typeof ui.floatingPanelsTop === "number" && Number.isFinite(ui.floatingPanelsTop)
      ? ui.floatingPanelsTop
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

  const participantsPanelProps: WorkbookSessionParticipantsPanelProps = {
    participantCards: derived.participantCards,
    currentUserId: user?.id,
    currentUserRole: user?.role,
    canUseSessionChat: permissions.canUseSessionChat,
    canManageSession: permissions.canManageSession,
    isSessionChatOpen: ui.isSessionChatOpen,
    sessionChatUnreadCount: derived.sessionChatUnreadCount,
    onToggleSessionChat: handlers.handleToggleSessionChat,
    onCollapseParticipants: handlers.handleCollapseParticipants,
    micEnabled: derived.micEnabled,
    onToggleMic: handlers.handleToggleOwnMic,
    canUseMedia: permissions.canUseMedia,
    isEnded: permissions.isEnded,
    isParticipantBoardToolsEnabled: handlers.isParticipantBoardToolsEnabled,
    onToggleParticipantBoardTools: handlers.handleToggleParticipantBoardTools,
    onToggleParticipantChat: handlers.handleToggleParticipantChat,
    onToggleParticipantMic: handlers.handleToggleParticipantMic,
  };

  const sessionChatPanelProps: SessionChatPanelProps = {
    showCollaborationPanels: permissions.showCollaborationPanels,
    isSessionChatOpen: ui.isSessionChatOpen,
    sessionChatRef: refs.sessionChatRef,
    sessionChatListRef: refs.sessionChatListRef,
    sessionChatDragStateRef: refs.sessionChatDragStateRef,
    isSessionChatMinimized: ui.isSessionChatMinimized,
    isSessionChatMaximized: ui.isSessionChatMaximized,
    isCompactViewport: page.isCompactViewport,
    sessionChatPosition,
    participantCards: derived.participantCards,
    chatMessages: data.chatMessages,
    firstUnreadSessionChatMessageId: derived.firstUnreadSessionChatMessageId,
    currentUserId: user?.id,
    canManageSession: permissions.canManageSession,
    canSendSessionChat: permissions.canSendSessionChat,
    sessionChatUnreadCount: derived.sessionChatUnreadCount,
    isSessionChatAtBottom: page.isSessionChatAtBottom,
    sessionChatDraft: page.sessionChatDraft,
    isSessionChatEmojiOpen: page.isSessionChatEmojiOpen,
    chatEmojis: derived.chatEmojis,
    setIsSessionChatMinimized: actions.setIsSessionChatMinimized,
    setIsSessionChatMaximized: actions.setIsSessionChatMaximized,
    setIsSessionChatOpen: actions.setIsSessionChatOpen,
    setIsSessionChatEmojiOpen: actions.setIsSessionChatEmojiOpen,
    setSessionChatDraft: actions.setSessionChatDraft,
    setIsClearSessionChatDialogOpen: actions.setIsClearSessionChatDialogOpen,
    onSessionChatDragStart: handlers.handleSessionChatDragStart,
    onScrollSessionChatToLatest: handlers.scrollSessionChatToLatest,
    onMarkSessionChatReadToLatest: handlers.markSessionChatReadToLatest,
    onSendSessionChatMessage: handlers.handleSendSessionChatMessage,
  };

  const contextbarProps: ContextbarProps = {
    overlayContainer,
    menuAnchor: page.menuAnchor,
    setMenuAnchor: actions.setMenuAnchor,
    exportBoardAsPdf: handlers.exportBoardAsPdf,
    exportingSections: page.exportingSections,
    onMenuClearBoard: handlers.handleMenuClearBoard,
    canClear: permissions.canClear,
    isEnded: permissions.isEnded,
    canAccessBoardSettingsPanel: permissions.canAccessBoardSettingsPanel,
    isUtilityPanelOpen: page.isUtilityPanelOpen,
    utilityTab: page.utilityTab,
    openUtilityPanel: handlers.openUtilityPanel,
    boardPageOptions: derived.boardPageOptions,
    currentBoardPage: safeCurrentBoardPage,
    totalBoardPages: safeTotalBoardPages,
    canManageBoardPages: permissions.canManageSharedBoardSettings,
    isBoardPageMutationPending: page.isBoardPageMutationPending,
    onSelectBoardPage: handlers.handleSelectBoardPage,
    onAddBoardPage: handlers.handleAddBoardPage,
    onDeleteBoardPage: handlers.handleDeleteBoardPage,
    canUseUndo: permissions.canUseUndo,
    undoDepth: page.undoDepth,
    redoDepth: page.redoDepth,
    onUndo: handlers.handleUndo,
    onRedo: handlers.handleRedo,
    onZoomOut: handlers.zoomOut,
    onZoomIn: handlers.zoomIn,
    onResetZoom: handlers.resetZoom,
    viewportZoom: scene.viewportZoom,
    canInsertImage: permissions.canInsertImage,
    onRequestDocsUpload: handlers.requestDocsUpload,
    hotkeysTooltipContent,
    isFullscreen: page.isFullscreen,
    onToggleFullscreen: handlers.toggleFullscreen,
    showCollaborationPanels: permissions.showCollaborationPanels,
    isParticipantsCollapsed: ui.isParticipantsCollapsed,
    onToggleParticipantsCollapsed: () =>
      actions.setIsParticipantsCollapsed((current: boolean) => !current),
    showInviteLinkButton:
      permissions.canManageSession && data.session?.kind === "CLASS",
    copyingInviteLink: page.copyingInviteLink,
    onCopyInviteLink: handlers.handleCopyInviteLink,
    contextbarRef: refs.contextbarRef,
    isDockedContextbarViewport: page.isDockedContextbarViewport,
    isCompactViewport: page.isCompactViewport,
  };

  const boardShellProps: BoardShellProps = {
    canvasProps: derived.canvasProps,
    isSessionTabPassive: page.isSessionTabPassive,
    activeSessionTabId: page.activeSessionTabId,
    presenceTabId: refs.presenceTabIdRef.current,
    beforeCatalogToolButtons: derived.beforeCatalogToolButtons,
    afterCatalogToolButtons: derived.afterCatalogToolButtons,
    canDraw: permissions.canDraw,
    onOpenShapesDialog: () => actions.setIsShapesDialogOpen(true),
    onOpenStereoDialog: () => actions.setIsStereoDialogOpen(true),
  };

  const docsWindowProps: WorkbookSessionDocsWindowProps = {
    pinned: page.docsWindow.pinned,
    maximized: page.docsWindow.maximized,
    canInsertImage: permissions.canInsertImage,
    uploadingDoc: page.uploadingDoc,
    uploadProgress: page.uploadProgress,
    assets: data.documentState.assets,
    activeAssetId: data.documentState.activeAssetId,
    activeDocument: derived.activeDocument,
    page: data.documentState.page,
    zoom: data.documentState.zoom,
    activeDocumentPageCount: derived.activeDocumentPageCount,
    annotationsCount: data.documentState.annotations.length,
    onTogglePinned: handlers.handleDocsWindowTogglePinned,
    onToggleMaximized: handlers.handleDocsWindowToggleMaximized,
    onClose: handlers.handleDocsWindowClose,
    onRequestUpload: handlers.handleDocsWindowRequestUpload,
    onSnapshotToBoard: handlers.handleDocsWindowSnapshotToBoard,
    onAddAnnotation: handlers.handleDocsWindowAddAnnotation,
    onClearAnnotations: handlers.handleDocsWindowClearAnnotations,
    onSelectAsset: handlers.handleDocsWindowSelectAsset,
    onChangePage: handlers.handleDocsWindowPageChange,
    onChangeZoom: handlers.handleDocsWindowZoomChange,
  };

  const utilityPanelChromeProps: UtilityPanelChromeProps = {
    isOpen: page.isUtilityPanelOpen,
    utilityPanelRef: refs.utilityPanelRef,
    isUtilityPanelCollapsed: page.isUtilityPanelCollapsed,
    isContextualUtilityPanel: derived.isContextualUtilityPanel,
    utilityTab: page.utilityTab,
    isCompactViewport: page.isCompactViewport,
    utilityPanelPosition: page.utilityPanelPosition,
    floatingPanelsTop,
    onDragStart: handlers.handleUtilityPanelDragStart,
    title: handlers.utilityPanelTitle,
    setIsUtilityPanelCollapsed: actions.setIsUtilityPanelCollapsed,
    setIsUtilityPanelOpen: actions.setIsUtilityPanelOpen,
  };

  const utilityPanelTabsProps: UtilityPanelTabsProps = {
    utilityTab: page.utilityTab,
    selectedObjectSupportsGraphPanel: derived.selectedObjectSupportsGraphPanel,
    selectedObjectSupportsTransformPanel: derived.selectedObjectSupportsTransformPanel,
    settingsPanelProps: derived.settingsPanelProps,
    graphPanelProps: derived.graphPanelProps,
    transformPanelProps: derived.transformPanelProps,
  };

  const overlaysProps: OverlaysProps = {
    overlayContainer,
    isClearSessionChatDialogOpen: page.isClearSessionChatDialogOpen,
    setIsClearSessionChatDialogOpen: actions.setIsClearSessionChatDialogOpen,
    isCompactDialogViewport: derived.isCompactDialogViewport,
    handleClearSessionChat: handlers.handleClearSessionChat,
    solid3dVertexContextMenu: page.solid3dVertexContextMenu,
    setSolid3dVertexContextMenu: actions.setSolid3dVertexContextMenu,
    renameSolid3dVertex: handlers.renameSolid3dVertex,
    getSolidVertexLabel: handlers.getSolidVertexLabel,
    solid3dSectionVertexContextMenu: page.solid3dSectionVertexContextMenu,
    setSolid3dSectionVertexContextMenu: actions.setSolid3dSectionVertexContextMenu,
    renameSolid3dSectionVertex: handlers.renameSolid3dSectionVertex,
    getSectionVertexLabel: handlers.getSectionVertexLabel,
    solid3dSectionContextMenu: page.solid3dSectionContextMenu,
    setSolid3dSectionContextMenu: actions.setSolid3dSectionContextMenu,
    contextMenuSection: derived.contextMenuSection,
    updateSolid3dSection: handlers.updateSolid3dSection,
    deleteSolid3dSection: handlers.deleteSolid3dSection,
    shapeVertexContextMenu: page.shapeVertexContextMenu,
    contextMenuShapeVertexObject: derived.contextMenuShapeVertexObject,
    setShapeVertexContextMenu: actions.setShapeVertexContextMenu,
    shapeVertexLabelDraft: page.shapeVertexLabelDraft,
    setShapeVertexLabelDraft: actions.setShapeVertexLabelDraft,
    renameShape2dVertexByObjectId: handlers.renameShape2dVertexByObjectId,
    lineEndpointContextMenu: page.lineEndpointContextMenu,
    contextMenuLineEndpointObject: derived.contextMenuLineEndpointObject,
    setLineEndpointContextMenu: actions.setLineEndpointContextMenu,
    lineEndpointLabelDraft: page.lineEndpointLabelDraft,
    setLineEndpointLabelDraft: actions.setLineEndpointLabelDraft,
    renameLineEndpointByObjectId: handlers.renameLineEndpointByObjectId,
    objectContextMenu: page.objectContextMenu,
    setObjectContextMenu: actions.setObjectContextMenu,
    contextMenuObject: derived.contextMenuObject,
    pointLabelDraft: page.pointLabelDraft,
    setPointLabelDraft: actions.setPointLabelDraft,
    renamePointObject: handlers.renamePointObject,
    canDelete: permissions.canDelete,
    commitObjectDelete: handlers.commitObjectDelete,
    commitObjectPin: handlers.commitObjectPin,
    scaleObject: handlers.scaleObject,
    commitObjectReorder: handlers.commitObjectReorder,
    canBringContextMenuImageToFront: derived.canBringContextMenuImageToFront,
    canSendContextMenuImageToBack: derived.canSendContextMenuImageToBack,
    canRestoreContextMenuImage: derived.canRestoreContextMenuImage,
    restoreImageOriginalView: handlers.restoreImageOriginalView,
    areaSelectionContextMenu: page.areaSelectionContextMenu,
    areaSelectionHasContent: derived.areaSelectionHasContent,
    setAreaSelectionContextMenu: actions.setAreaSelectionContextMenu,
    copyAreaSelectionObjects: handlers.copyAreaSelectionObjects,
    cutAreaSelectionObjects: handlers.cutAreaSelectionObjects,
    cropImageByAreaSelection: handlers.cropImageByAreaSelection,
    fillAreaSelection: handlers.fillAreaSelection,
    canCropAreaSelectionImage: derived.canCropAreaSelectionImage,
    createCompositionFromAreaSelection: handlers.createCompositionFromAreaSelection,
    areaSelection: page.areaSelection,
    deleteAreaSelectionObjects: handlers.deleteAreaSelectionObjects,
    canSelect: permissions.canSelect,
    isStereoDialogOpen: page.isStereoDialogOpen,
    setIsStereoDialogOpen: actions.setIsStereoDialogOpen,
    createMathPresetObject: handlers.createMathPresetObject,
    isShapesDialogOpen: page.isShapesDialogOpen,
    setIsShapesDialogOpen: actions.setIsShapesDialogOpen,
    shapeCatalog: derived.shapeCatalog,
    activateTool: handlers.activateTool,
  };

  return {
    participantsPanelProps,
    sessionChatPanelProps,
    contextbarProps,
    boardShellProps,
    docsWindowProps,
    utilityPanelChromeProps,
    utilityPanelTabsProps,
    overlaysProps,
  };
};
