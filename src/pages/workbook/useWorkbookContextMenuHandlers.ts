import { useCallback } from "react";
import type { WorkbookBoardObject } from "@/features/workbook/model/types";
import { readSolid3dState } from "@/features/workbook/model/solid3dState";
import type {
  WorkbookLineEndpointContextMenu,
  WorkbookObjectContextMenu,
  WorkbookShapeVertexContextMenu,
  WorkbookSolid3dSectionContextMenu,
  WorkbookSolid3dSectionVertexContextMenu,
  WorkbookSolid3dVertexContextMenu,
} from "@/features/workbook/model/workbookSessionUiTypes";

type Updater<T> = T | ((current: T) => T);

type UseWorkbookContextMenuHandlersParams = {
  boardObjects: WorkbookBoardObject[];
  setObjectContextMenu: (value: Updater<WorkbookObjectContextMenu | null>) => void;
  setShapeVertexContextMenu: (value: Updater<WorkbookShapeVertexContextMenu | null>) => void;
  setLineEndpointContextMenu: (value: Updater<WorkbookLineEndpointContextMenu | null>) => void;
  setSolid3dVertexContextMenu: (value: Updater<WorkbookSolid3dVertexContextMenu | null>) => void;
  setSolid3dSectionVertexContextMenu: (
    value: Updater<WorkbookSolid3dSectionVertexContextMenu | null>
  ) => void;
  setSolid3dSectionContextMenu: (
    value: Updater<WorkbookSolid3dSectionContextMenu | null>
  ) => void;
  setSelectedObjectId: (value: string | null) => void;
  setActiveSolidSectionId: (value: string | null) => void;
  getSolidVertexLabel: (index: number) => string;
  getSectionVertexLabel: (index: number) => string;
};

export const useWorkbookContextMenuHandlers = ({
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
}: UseWorkbookContextMenuHandlersParams) => {
  const handleObjectContextMenu = useCallback(
    (objectId: string, anchor: { x: number; y: number }) => {
      setShapeVertexContextMenu(null);
      setLineEndpointContextMenu(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dSectionVertexContextMenu(null);
      setSolid3dSectionContextMenu(null);
      setSelectedObjectId(objectId);
      setObjectContextMenu({ objectId, x: anchor.x, y: anchor.y });
    },
    [
      setLineEndpointContextMenu,
      setObjectContextMenu,
      setSelectedObjectId,
      setShapeVertexContextMenu,
      setSolid3dSectionContextMenu,
      setSolid3dSectionVertexContextMenu,
      setSolid3dVertexContextMenu,
    ]
  );

  const handleShapeVertexContextMenu = useCallback(
    (payload: {
      objectId: string;
      vertexIndex: number;
      label: string;
      anchor: { x: number; y: number };
    }) => {
      setObjectContextMenu(null);
      setLineEndpointContextMenu(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dSectionVertexContextMenu(null);
      setSolid3dSectionContextMenu(null);
      setSelectedObjectId(payload.objectId);
      setShapeVertexContextMenu({
        objectId: payload.objectId,
        vertexIndex: payload.vertexIndex,
        x: payload.anchor.x,
        y: payload.anchor.y,
        label: payload.label,
      });
    },
    [
      setLineEndpointContextMenu,
      setObjectContextMenu,
      setSelectedObjectId,
      setShapeVertexContextMenu,
      setSolid3dSectionContextMenu,
      setSolid3dSectionVertexContextMenu,
      setSolid3dVertexContextMenu,
    ]
  );

  const handleLineEndpointContextMenu = useCallback(
    (payload: {
      objectId: string;
      endpoint: "start" | "end";
      label: string;
      anchor: { x: number; y: number };
    }) => {
      setObjectContextMenu(null);
      setShapeVertexContextMenu(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dSectionVertexContextMenu(null);
      setSolid3dSectionContextMenu(null);
      setSelectedObjectId(payload.objectId);
      setLineEndpointContextMenu({
        objectId: payload.objectId,
        endpoint: payload.endpoint,
        x: payload.anchor.x,
        y: payload.anchor.y,
        label: payload.label,
      });
    },
    [
      setLineEndpointContextMenu,
      setObjectContextMenu,
      setSelectedObjectId,
      setShapeVertexContextMenu,
      setSolid3dSectionContextMenu,
      setSolid3dSectionVertexContextMenu,
      setSolid3dVertexContextMenu,
    ]
  );

  const handleSolid3dVertexContextMenu = useCallback(
    (payload: {
      objectId: string;
      vertexIndex: number;
      anchor: { x: number; y: number };
    }) => {
      const targetObject = boardObjects.find(
        (item) => item.id === payload.objectId && item.type === "solid3d"
      );
      if (!targetObject) return;
      const targetState = readSolid3dState(targetObject.meta);
      const label =
        targetState.vertexLabels[payload.vertexIndex] ||
        getSolidVertexLabel(payload.vertexIndex);
      setObjectContextMenu(null);
      setShapeVertexContextMenu(null);
      setLineEndpointContextMenu(null);
      setSolid3dSectionVertexContextMenu(null);
      setSolid3dSectionContextMenu(null);
      setSelectedObjectId(payload.objectId);
      setSolid3dVertexContextMenu({
        objectId: payload.objectId,
        vertexIndex: payload.vertexIndex,
        x: payload.anchor.x,
        y: payload.anchor.y,
        label,
      });
    },
    [
      boardObjects,
      getSolidVertexLabel,
      setLineEndpointContextMenu,
      setObjectContextMenu,
      setSelectedObjectId,
      setShapeVertexContextMenu,
      setSolid3dSectionContextMenu,
      setSolid3dSectionVertexContextMenu,
      setSolid3dVertexContextMenu,
    ]
  );

  const handleSolid3dSectionVertexContextMenu = useCallback(
    (payload: {
      objectId: string;
      sectionId: string;
      vertexIndex: number;
      anchor: { x: number; y: number };
    }) => {
      const targetObject = boardObjects.find(
        (item) => item.id === payload.objectId && item.type === "solid3d"
      );
      if (!targetObject) return;
      const targetState = readSolid3dState(targetObject.meta);
      const section = targetState.sections.find((item) => item.id === payload.sectionId);
      if (!section) return;
      const label =
        section.vertexLabels[payload.vertexIndex] ||
        getSectionVertexLabel(payload.vertexIndex);
      setObjectContextMenu(null);
      setShapeVertexContextMenu(null);
      setLineEndpointContextMenu(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dSectionContextMenu(null);
      setSelectedObjectId(payload.objectId);
      setActiveSolidSectionId(payload.sectionId);
      setSolid3dSectionVertexContextMenu({
        objectId: payload.objectId,
        sectionId: payload.sectionId,
        vertexIndex: payload.vertexIndex,
        x: payload.anchor.x,
        y: payload.anchor.y,
        label,
      });
    },
    [
      boardObjects,
      getSectionVertexLabel,
      setActiveSolidSectionId,
      setLineEndpointContextMenu,
      setObjectContextMenu,
      setSelectedObjectId,
      setShapeVertexContextMenu,
      setSolid3dSectionContextMenu,
      setSolid3dSectionVertexContextMenu,
      setSolid3dVertexContextMenu,
    ]
  );

  const handleSolid3dSectionContextMenu = useCallback(
    (payload: {
      objectId: string;
      sectionId: string;
      anchor: { x: number; y: number };
    }) => {
      const targetObject = boardObjects.find(
        (item) => item.id === payload.objectId && item.type === "solid3d"
      );
      if (!targetObject) return;
      const targetState = readSolid3dState(targetObject.meta);
      const section = targetState.sections.find((item) => item.id === payload.sectionId);
      if (!section) return;
      setObjectContextMenu(null);
      setShapeVertexContextMenu(null);
      setLineEndpointContextMenu(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dSectionVertexContextMenu(null);
      setSelectedObjectId(payload.objectId);
      setActiveSolidSectionId(payload.sectionId);
      setSolid3dSectionContextMenu({
        objectId: payload.objectId,
        sectionId: payload.sectionId,
        x: payload.anchor.x,
        y: payload.anchor.y,
      });
    },
    [
      boardObjects,
      setActiveSolidSectionId,
      setLineEndpointContextMenu,
      setObjectContextMenu,
      setSelectedObjectId,
      setShapeVertexContextMenu,
      setSolid3dSectionContextMenu,
      setSolid3dSectionVertexContextMenu,
      setSolid3dVertexContextMenu,
    ]
  );

  return {
    handleObjectContextMenu,
    handleShapeVertexContextMenu,
    handleLineEndpointContextMenu,
    handleSolid3dVertexContextMenu,
    handleSolid3dSectionVertexContextMenu,
    handleSolid3dSectionContextMenu,
  };
};
