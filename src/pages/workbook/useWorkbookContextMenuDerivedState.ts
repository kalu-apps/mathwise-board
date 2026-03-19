import { useEffect, useMemo } from "react";
import {
  buildWorkbookImageCropUpdate,
  isWorkbookImageCropActive,
} from "@/features/workbook/model/imageCrop";
import { resolveWorkbookObjectReorderZOrder } from "@/features/workbook/model/objectZOrder";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import type { Solid3dState } from "@/features/workbook/model/solid3dState";
import type {
  WorkbookAreaSelection,
  WorkbookLineEndpointContextMenu,
  WorkbookObjectContextMenu,
  WorkbookShapeVertexContextMenu,
  WorkbookSolid3dSectionContextMenu,
} from "@/features/workbook/model/workbookSessionUiTypes";
import { getFigureVertexLabel } from "./WorkbookSessionPage.core";
import { is2dFigureObject, resolve2dFigureVertices } from "./WorkbookSessionPage.geometry";

type UseWorkbookContextMenuDerivedStateParams = {
  boardObjects: WorkbookBoardObject[];
  objectContextMenu: WorkbookObjectContextMenu | null;
  shapeVertexContextMenu: WorkbookShapeVertexContextMenu | null;
  lineEndpointContextMenu: WorkbookLineEndpointContextMenu | null;
  solid3dSectionContextMenu: WorkbookSolid3dSectionContextMenu | null;
  selectedSolid3dState: Solid3dState | null;
  areaSelection: WorkbookAreaSelection | null;
  areaSelectionHasContent: boolean;
  canSelect: boolean;
  setPointLabelDraft: (value: string) => void;
  setShapeVertexLabelDraft: (value: string) => void;
  setLineEndpointLabelDraft: (value: string) => void;
};

export const useWorkbookContextMenuDerivedState = ({
  boardObjects,
  objectContextMenu,
  shapeVertexContextMenu,
  lineEndpointContextMenu,
  solid3dSectionContextMenu,
  selectedSolid3dState,
  areaSelection,
  areaSelectionHasContent,
  canSelect,
  setPointLabelDraft,
  setShapeVertexLabelDraft,
  setLineEndpointLabelDraft,
}: UseWorkbookContextMenuDerivedStateParams) => {
  const contextMenuObject = useMemo(
    () =>
      objectContextMenu
        ? boardObjects.find((item) => item.id === objectContextMenu.objectId) ?? null
        : null,
    [boardObjects, objectContextMenu]
  );

  const areaSelectionImageCropPatch = useMemo(() => {
    if (!areaSelection || !areaSelectionHasContent) return null;
    if (areaSelection.objectIds.length !== 1 || areaSelection.strokeIds.length > 0) {
      return null;
    }
    const targetId = areaSelection.objectIds[0];
    const target = boardObjects.find((item) => item.id === targetId) ?? null;
    if (!target || target.type !== "image" || target.pinned || target.locked) {
      return null;
    }
    return buildWorkbookImageCropUpdate({
      object: target,
      selectionRect: areaSelection.rect,
    });
  }, [areaSelection, areaSelectionHasContent, boardObjects]);

  const canCropAreaSelectionImage = Boolean(canSelect && areaSelectionImageCropPatch);

  const canRestoreContextMenuImage = Boolean(
    contextMenuObject &&
      contextMenuObject.type === "image" &&
      !contextMenuObject.pinned &&
      !contextMenuObject.locked &&
      canSelect &&
      isWorkbookImageCropActive(contextMenuObject)
  );

  const canBringContextMenuImageToFront = Boolean(
    contextMenuObject &&
      contextMenuObject.type === "image" &&
      !contextMenuObject.locked &&
      canSelect &&
      resolveWorkbookObjectReorderZOrder({
        objects: boardObjects,
        targetObjectId: contextMenuObject.id,
        direction: "front",
      }) !== null
  );

  const canSendContextMenuImageToBack = Boolean(
    contextMenuObject &&
      contextMenuObject.type === "image" &&
      !contextMenuObject.locked &&
      canSelect &&
      resolveWorkbookObjectReorderZOrder({
        objects: boardObjects,
        targetObjectId: contextMenuObject.id,
        direction: "back",
      }) !== null
  );

  const contextMenuShapeVertexObject = useMemo(() => {
    if (!shapeVertexContextMenu) return null;
    const object = boardObjects.find((item) => item.id === shapeVertexContextMenu.objectId) ?? null;
    if (!is2dFigureObject(object)) return null;
    return object;
  }, [boardObjects, shapeVertexContextMenu]);

  const contextMenuLineEndpointObject = useMemo(() => {
    if (!lineEndpointContextMenu) return null;
    const object = boardObjects.find((item) => item.id === lineEndpointContextMenu.objectId) ?? null;
    if (!object || (object.type !== "line" && object.type !== "arrow")) return null;
    if (object.meta?.lineKind !== "segment") return null;
    return object;
  }, [boardObjects, lineEndpointContextMenu]);

  const contextMenuSection = useMemo(() => {
    if (!solid3dSectionContextMenu || !selectedSolid3dState) return null;
    return (
      selectedSolid3dState.sections.find(
        (section) => section.id === solid3dSectionContextMenu.sectionId
      ) ?? null
    );
  }, [selectedSolid3dState, solid3dSectionContextMenu]);

  useEffect(() => {
    if (!contextMenuObject || contextMenuObject.type !== "point") {
      setPointLabelDraft("");
      return;
    }
    const label =
      typeof contextMenuObject.meta?.label === "string" ? contextMenuObject.meta.label : "";
    setPointLabelDraft(label);
  }, [contextMenuObject, setPointLabelDraft]);

  useEffect(() => {
    if (!shapeVertexContextMenu || !contextMenuShapeVertexObject) {
      setShapeVertexLabelDraft("");
      return;
    }
    const vertices = resolve2dFigureVertices(contextMenuShapeVertexObject);
    if (!vertices.length) {
      setShapeVertexLabelDraft("");
      return;
    }
    const labels = Array.isArray(contextMenuShapeVertexObject.meta?.vertexLabels)
      ? contextMenuShapeVertexObject.meta.vertexLabels
      : [];
    const current = labels[shapeVertexContextMenu.vertexIndex];
    const value =
      typeof current === "string" && current.trim()
        ? current.trim()
        : getFigureVertexLabel(shapeVertexContextMenu.vertexIndex);
    setShapeVertexLabelDraft(value);
  }, [contextMenuShapeVertexObject, setShapeVertexLabelDraft, shapeVertexContextMenu]);

  useEffect(() => {
    if (!lineEndpointContextMenu || !contextMenuLineEndpointObject) {
      setLineEndpointLabelDraft("");
      return;
    }
    const valueRaw =
      lineEndpointContextMenu.endpoint === "start"
        ? contextMenuLineEndpointObject.meta?.startLabel
        : contextMenuLineEndpointObject.meta?.endLabel;
    const fallback = lineEndpointContextMenu.endpoint === "start" ? "A" : "B";
    const value =
      typeof valueRaw === "string" && valueRaw.trim() ? valueRaw.trim() : fallback;
    setLineEndpointLabelDraft(value);
  }, [contextMenuLineEndpointObject, lineEndpointContextMenu, setLineEndpointLabelDraft]);

  return {
    contextMenuObject,
    canCropAreaSelectionImage,
    canRestoreContextMenuImage,
    canBringContextMenuImageToFront,
    canSendContextMenuImageToBack,
    contextMenuShapeVertexObject,
    contextMenuLineEndpointObject,
    contextMenuSection,
  };
};
