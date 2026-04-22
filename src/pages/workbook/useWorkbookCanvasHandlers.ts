import { useCallback, type MutableRefObject } from "react";
import type {
  WorkbookBoardObject,
  WorkbookLayer,
  WorkbookPoint,
  WorkbookStroke,
} from "@/features/workbook/model/types";
import type { WorkbookAreaSelection } from "@/features/workbook/model/workbookSessionUiTypes";
import type { WorkbookEraserCommitPayload } from "@/features/workbook/ui/WorkbookCanvas";

type SetState<T> = (value: T | ((current: T) => T)) => void;

type UseWorkbookCanvasHandlersParams = {
  commitStroke: (stroke: WorkbookStroke) => Promise<void> | void;
  commitStrokeDelete: (strokeId: string, layer: WorkbookLayer) => Promise<void> | void;
  commitStrokeReplace: (payload: {
    stroke: WorkbookStroke;
    fragments: WorkbookPoint[][];
    preserveSourceId?: boolean;
  }) => Promise<void> | void;
  commitEraserBatch: (payload: WorkbookEraserCommitPayload) => Promise<void> | void;
  commitObjectUpdate: (
    objectId: string,
    patch: Partial<WorkbookBoardObject>,
    options?: { trackHistory?: boolean; markDirty?: boolean }
  ) => Promise<void> | void;
  commitObjectDelete: (objectId: string) => Promise<void> | void;
  queueEraserPreview: (payload: {
    gestureId: string;
    layer: WorkbookLayer;
    page: number;
    radius: number;
    points: WorkbookPoint[];
    ended?: boolean;
  }) => void;
  setAreaSelection: SetState<WorkbookAreaSelection | null>;
  setAreaSelectionContextMenu: SetState<{ x: number; y: number } | null>;
  boardObjects: WorkbookBoardObject[];
  setSelectedTextDraft: SetState<string>;
  scheduleSelectedTextDraftCommit: (value: string) => void;
  resetToolRuntimeToSelect: () => void;
  handleLaserPoint: (point: WorkbookPoint) => Promise<void> | void;
  clearLaserPointer: () => Promise<void> | void;
  isSessionChatOpen: boolean;
  setIsSessionChatOpen: SetState<boolean>;
  setIsSessionChatEmojiOpen: SetState<boolean>;
  setIsSessionChatAtBottom: SetState<boolean>;
  setIsSessionChatMinimized: SetState<boolean>;
  sessionChatShouldScrollToUnreadRef: MutableRefObject<boolean>;
  setIsParticipantsCollapsed: SetState<boolean>;
  setMicEnabled: SetState<boolean>;
  setCameraEnabled: SetState<boolean>;
};

export const useWorkbookCanvasHandlers = ({
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
  scheduleSelectedTextDraftCommit,
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
  setCameraEnabled,
}: UseWorkbookCanvasHandlersParams) => {
  const handleCanvasObjectUpdate = useCallback(
    (
      objectId: string,
      patch: Partial<WorkbookBoardObject>,
      options?: { trackHistory?: boolean; markDirty?: boolean }
    ) => {
      void commitObjectUpdate(objectId, patch, options);
    },
    [commitObjectUpdate]
  );

  const handleCanvasStrokeCommit = useCallback(
    (stroke: WorkbookStroke) => {
      void commitStroke(stroke);
    },
    [commitStroke]
  );

  const handleCanvasStrokeDelete = useCallback(
    (strokeId: string, targetLayer: WorkbookLayer) => {
      void commitStrokeDelete(strokeId, targetLayer);
    },
    [commitStrokeDelete]
  );

  const handleCanvasStrokeReplace = useCallback(
    (payload: Parameters<typeof commitStrokeReplace>[0]) => {
      void commitStrokeReplace(payload);
    },
    [commitStrokeReplace]
  );

  const handleCanvasEraserCommit = useCallback(
    (payload: WorkbookEraserCommitPayload) => {
      void commitEraserBatch(payload);
    },
    [commitEraserBatch]
  );

  const handleCanvasEraserPreview = useCallback(
    (payload: {
      gestureId: string;
      layer: WorkbookLayer;
      page: number;
      radius: number;
      points: WorkbookPoint[];
      ended?: boolean;
    }) => {
      queueEraserPreview(payload);
    },
    [queueEraserPreview]
  );

  const handleCanvasObjectDelete = useCallback(
    (objectId: string) => {
      void commitObjectDelete(objectId);
    },
    [commitObjectDelete]
  );

  const handleCanvasAreaSelectionChange = useCallback(
    (selection: WorkbookAreaSelection | null) => {
      setAreaSelection(selection);
      if (!selection || (selection.objectIds.length === 0 && selection.strokeIds.length === 0)) {
        setAreaSelectionContextMenu(null);
      }
    },
    [setAreaSelection, setAreaSelectionContextMenu]
  );

  const handleCanvasAreaSelectionContextMenu = useCallback(
    (payload: {
      objectIds: string[];
      strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
      rect: { x: number; y: number; width: number; height: number };
      anchor: { x: number; y: number };
    }) => {
      setAreaSelection({
        objectIds: payload.objectIds,
        strokeIds: payload.strokeIds,
        rect: payload.rect,
      });
      setAreaSelectionContextMenu({
        x: payload.anchor.x,
        y: payload.anchor.y,
      });
    },
    [setAreaSelection, setAreaSelectionContextMenu]
  );

  const handleCanvasInlineTextDraftChange = useCallback(
    (objectId: string, value: string) => {
      const selectedTextTarget = boardObjects.find((item) => item.id === objectId) ?? null;
      if (!selectedTextTarget || selectedTextTarget.type !== "text") return;
      setSelectedTextDraft((current) => (current === value ? current : value));
      scheduleSelectedTextDraftCommit(value);
    },
    [boardObjects, scheduleSelectedTextDraftCommit, setSelectedTextDraft]
  );

  const handleCanvasRequestSelectTool = useCallback(() => {
    resetToolRuntimeToSelect();
  }, [resetToolRuntimeToSelect]);

  const handleCanvasLaserPoint = useCallback(
    (point: WorkbookPoint) => {
      void handleLaserPoint(point);
    },
    [handleLaserPoint]
  );

  const handleCanvasLaserClear = useCallback(() => {
    void clearLaserPointer();
  }, [clearLaserPointer]);

  const handleToggleSessionChat = useCallback(() => {
    if (isSessionChatOpen) {
      setIsSessionChatOpen(false);
      setIsSessionChatEmojiOpen(false);
      return;
    }
    sessionChatShouldScrollToUnreadRef.current = true;
    setIsSessionChatAtBottom(false);
    setIsSessionChatOpen(true);
    setIsSessionChatMinimized(false);
  }, [
    isSessionChatOpen,
    sessionChatShouldScrollToUnreadRef,
    setIsSessionChatAtBottom,
    setIsSessionChatEmojiOpen,
    setIsSessionChatMinimized,
    setIsSessionChatOpen,
  ]);

  const handleCollapseParticipants = useCallback(() => {
    setIsParticipantsCollapsed((current) => !current);
  }, [setIsParticipantsCollapsed]);

  const handleToggleOwnMic = useCallback(() => {
    setMicEnabled((current) => !current);
  }, [setMicEnabled]);

  const handleToggleOwnCamera = useCallback(() => {
    setCameraEnabled((current) => !current);
  }, [setCameraEnabled]);

  return {
    handleCanvasObjectUpdate,
    handleCanvasStrokeCommit,
    handleCanvasStrokeDelete,
    handleCanvasStrokeReplace,
    handleCanvasEraserCommit,
    handleCanvasEraserPreview,
    handleCanvasObjectDelete,
    handleCanvasAreaSelectionChange,
    handleCanvasAreaSelectionContextMenu,
    handleCanvasInlineTextDraftChange,
    handleCanvasRequestSelectTool,
    handleCanvasLaserPoint,
    handleCanvasLaserClear,
    handleToggleSessionChat,
    handleCollapseParticipants,
    handleToggleOwnMic,
    handleToggleOwnCamera,
  };
};
