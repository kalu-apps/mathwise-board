import { useCallback } from "react";

export type UseWorkbookSessionPanelHandlersParams = {
  setDocsWindow: (
    updater: (current: {
      open: boolean;
      pinned: boolean;
      maximized: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
    }) => {
      open: boolean;
      pinned: boolean;
      maximized: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  ) => void;
  clickDocsInput: () => void;
  snapshotDocumentToBoard: () => void;
  addDocumentAnnotation: () => void;
  clearDocumentAnnotations: () => void;
  selectDocumentAsset: (assetId: string) => void;
  setDocumentPage: (page: number) => void;
  setDocumentZoom: (zoom: number) => void;
  createFunctionGraphPlane: () => void;
  selectGraphPlane: (planeId: string) => void;
  updateFunctionGraphAppearance: (patch: { axisColor?: string; planeColor?: string }) => void;
  setGraphWorkbenchTab: (tab: "catalog" | "work") => void;
  setGraphExpressionDraft: (value: string) => void;
  setSelectedGraphPresetId: (value: string | null) => void;
  clearGraphDraftError: () => void;
  appendSelectedGraphFunction: (expression?: string) => void;
  activateGraphCatalogCursor: () => void;
  updateSelectedGraphFunction: (id: string, patch: { color?: string; visible?: boolean }) => void;
  normalizeGraphExpressionDraft: (id: string, value: string, fromPanel: boolean) => void;
  commitSelectedGraphExpressions: () => void;
  removeSelectedGraphFunction: (id: string) => void;
  reflectGraphFunctionByAxis: (id: string, axis: "x" | "y") => void;
};

export const useWorkbookSessionPanelHandlers = ({
  setDocsWindow,
  clickDocsInput,
  snapshotDocumentToBoard,
  addDocumentAnnotation,
  clearDocumentAnnotations,
  selectDocumentAsset,
  setDocumentPage,
  setDocumentZoom,
  createFunctionGraphPlane,
  selectGraphPlane,
  updateFunctionGraphAppearance,
  setGraphWorkbenchTab,
  setGraphExpressionDraft,
  setSelectedGraphPresetId,
  clearGraphDraftError,
  appendSelectedGraphFunction,
  activateGraphCatalogCursor,
  updateSelectedGraphFunction,
  normalizeGraphExpressionDraft,
  commitSelectedGraphExpressions,
  removeSelectedGraphFunction,
  reflectGraphFunctionByAxis,
}: UseWorkbookSessionPanelHandlersParams) => {
  const handleDocsWindowTogglePinned = useCallback(() => {
    setDocsWindow((current) => ({ ...current, pinned: !current.pinned }));
  }, [setDocsWindow]);

  const handleDocsWindowToggleMaximized = useCallback(() => {
    setDocsWindow((current) => ({ ...current, maximized: !current.maximized }));
  }, [setDocsWindow]);

  const handleDocsWindowClose = useCallback(() => {
    setDocsWindow((current) => ({ ...current, open: false }));
  }, [setDocsWindow]);

  const handleDocsWindowRequestUpload = useCallback(() => {
    clickDocsInput();
  }, [clickDocsInput]);

  const handleDocsWindowSnapshotToBoard = useCallback(() => {
    snapshotDocumentToBoard();
  }, [snapshotDocumentToBoard]);

  const handleDocsWindowAddAnnotation = useCallback(() => {
    addDocumentAnnotation();
  }, [addDocumentAnnotation]);

  const handleDocsWindowClearAnnotations = useCallback(() => {
    clearDocumentAnnotations();
  }, [clearDocumentAnnotations]);

  const handleDocsWindowSelectAsset = useCallback(
    (assetId: string) => {
      selectDocumentAsset(assetId);
    },
    [selectDocumentAsset]
  );

  const handleDocsWindowPageChange = useCallback(
    (page: number) => {
      setDocumentPage(page);
    },
    [setDocumentPage]
  );

  const handleDocsWindowZoomChange = useCallback(
    (zoom: number) => {
      setDocumentZoom(zoom);
    },
    [setDocumentZoom]
  );

  const handleGraphPanelCreatePlane = useCallback(() => {
    createFunctionGraphPlane();
  }, [createFunctionGraphPlane]);

  const handleGraphPanelSelectPlane = useCallback(
    (planeId: string) => {
      selectGraphPlane(planeId);
    },
    [selectGraphPlane]
  );

  const handleGraphPanelAxisColorChange = useCallback(
    (color: string) => {
      updateFunctionGraphAppearance({ axisColor: color });
    },
    [updateFunctionGraphAppearance]
  );

  const handleGraphPanelPlaneColorChange = useCallback(
    (color: string) => {
      updateFunctionGraphAppearance({ planeColor: color });
    },
    [updateFunctionGraphAppearance]
  );

  const handleGraphPanelClearPlaneBackground = useCallback(() => {
    updateFunctionGraphAppearance({ planeColor: "transparent" });
  }, [updateFunctionGraphAppearance]);

  const handleGraphPanelSelectCatalogTab = useCallback(() => {
    setGraphWorkbenchTab("catalog");
  }, [setGraphWorkbenchTab]);

  const handleGraphPanelSelectWorkTab = useCallback(() => {
    setGraphWorkbenchTab("work");
  }, [setGraphWorkbenchTab]);

  const handleGraphPanelExpressionDraftChange = useCallback(
    (value: string) => {
      setGraphExpressionDraft(value);
      setSelectedGraphPresetId(null);
      clearGraphDraftError();
    },
    [clearGraphDraftError, setGraphExpressionDraft, setSelectedGraphPresetId]
  );

  const handleGraphPanelAddFunction = useCallback(() => {
    setSelectedGraphPresetId(null);
    appendSelectedGraphFunction();
  }, [appendSelectedGraphFunction, setSelectedGraphPresetId]);

  const handleGraphPanelSelectPreset = useCallback(
    (presetId: string, expression: string) => {
      setSelectedGraphPresetId(presetId);
      activateGraphCatalogCursor();
      appendSelectedGraphFunction(expression);
    },
    [activateGraphCatalogCursor, appendSelectedGraphFunction, setSelectedGraphPresetId]
  );

  const handleGraphPanelFunctionColorChange = useCallback(
    (id: string, color: string) => {
      updateSelectedGraphFunction(id, { color });
    },
    [updateSelectedGraphFunction]
  );

  const handleGraphPanelFunctionExpressionChange = useCallback(
    (id: string, value: string) => {
      normalizeGraphExpressionDraft(id, value, true);
    },
    [normalizeGraphExpressionDraft]
  );

  const handleGraphPanelCommitExpressions = useCallback(() => {
    commitSelectedGraphExpressions();
  }, [commitSelectedGraphExpressions]);

  const handleGraphPanelRemoveFunction = useCallback(
    (id: string) => {
      removeSelectedGraphFunction(id);
    },
    [removeSelectedGraphFunction]
  );

  const handleGraphPanelToggleVisibility = useCallback(
    (id: string, visible: boolean) => {
      updateSelectedGraphFunction(id, { visible });
    },
    [updateSelectedGraphFunction]
  );

  const handleGraphPanelReflectFunction = useCallback(
    (id: string, axis: "x" | "y") => {
      reflectGraphFunctionByAxis(id, axis);
    },
    [reflectGraphFunctionByAxis]
  );

  return {
    handleDocsWindowTogglePinned,
    handleDocsWindowToggleMaximized,
    handleDocsWindowClose,
    handleDocsWindowRequestUpload,
    handleDocsWindowSnapshotToBoard,
    handleDocsWindowAddAnnotation,
    handleDocsWindowClearAnnotations,
    handleDocsWindowSelectAsset,
    handleDocsWindowPageChange,
    handleDocsWindowZoomChange,
    handleGraphPanelCreatePlane,
    handleGraphPanelSelectPlane,
    handleGraphPanelAxisColorChange,
    handleGraphPanelPlaneColorChange,
    handleGraphPanelClearPlaneBackground,
    handleGraphPanelSelectCatalogTab,
    handleGraphPanelSelectWorkTab,
    handleGraphPanelExpressionDraftChange,
    handleGraphPanelAddFunction,
    handleGraphPanelSelectPreset,
    handleGraphPanelFunctionColorChange,
    handleGraphPanelFunctionExpressionChange,
    handleGraphPanelCommitExpressions,
    handleGraphPanelRemoveFunction,
    handleGraphPanelToggleVisibility,
    handleGraphPanelReflectFunction,
  };
};
