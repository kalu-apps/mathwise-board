import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { SOLID3D_PRESETS } from "@/features/workbook/model/solid3d";
import type { WorkbookBoardObject, WorkbookTool } from "@/features/workbook/model/types";
import type {
  WorkbookAreaSelection,
  WorkbookLineEndpointContextMenu,
  WorkbookObjectContextMenu,
  WorkbookShapeVertexContextMenu,
  WorkbookSolid3dSectionContextMenu,
  WorkbookSolid3dSectionVertexContextMenu,
  WorkbookSolid3dVertexContextMenu,
} from "@/features/workbook/model/workbookSessionUiTypes";
import { SolidPresetPreview } from "@/features/workbook/ui/WorkbookCatalogPreviews";
import type { Solid3dSectionState } from "@/features/workbook/model/solid3dState";
type Updater<T> = T | ((current: T) => T);
type ContextMenuPoint = { x: number; y: number };
type ShapeCatalogItem = { id: string; title: string; subtitle: string; icon: ReactNode; apply: () => void; tool: WorkbookTool };
type WorkbookSessionOverlaysProps = {
  overlayContainer: Element | null | undefined;
  isClearSessionChatDialogOpen: boolean;
  setIsClearSessionChatDialogOpen: (value: boolean) => void;
  isCompactDialogViewport: boolean;
  handleClearSessionChat: () => void | Promise<void>;
  solid3dVertexContextMenu: WorkbookSolid3dVertexContextMenu | null;
  setSolid3dVertexContextMenu: (value: Updater<WorkbookSolid3dVertexContextMenu | null>) => void;
  renameSolid3dVertex: (vertexIndex: number, label: string) => void | Promise<void>;
  getSolidVertexLabel: (index: number) => string;
  solid3dSectionVertexContextMenu: WorkbookSolid3dSectionVertexContextMenu | null;
  setSolid3dSectionVertexContextMenu: (
    value: Updater<WorkbookSolid3dSectionVertexContextMenu | null>
  ) => void;
  renameSolid3dSectionVertex: (
    sectionId: string,
    vertexIndex: number,
    label: string
  ) => void | Promise<void>;
  getSectionVertexLabel: (index: number) => string;
  solid3dSectionContextMenu: WorkbookSolid3dSectionContextMenu | null;
  setSolid3dSectionContextMenu: (value: Updater<WorkbookSolid3dSectionContextMenu | null>) => void;
  contextMenuSection: Solid3dSectionState | null;
  updateSolid3dSection: (
    sectionId: string,
    patch: Partial<Solid3dSectionState>,
    objectIdOverride?: string
  ) => void | Promise<void>;
  deleteSolid3dSection: (sectionId: string, objectIdOverride?: string) => void | Promise<void>;
  shapeVertexContextMenu: WorkbookShapeVertexContextMenu | null;
  contextMenuShapeVertexObject: WorkbookBoardObject | null;
  setShapeVertexContextMenu: (value: Updater<WorkbookShapeVertexContextMenu | null>) => void;
  shapeVertexLabelDraft: string;
  setShapeVertexLabelDraft: (value: string) => void;
  renameShape2dVertexByObjectId: (
    objectId: string,
    vertexIndex: number,
    label: string
  ) => void | Promise<void>;
  lineEndpointContextMenu: WorkbookLineEndpointContextMenu | null;
  contextMenuLineEndpointObject: WorkbookBoardObject | null;
  setLineEndpointContextMenu: (value: Updater<WorkbookLineEndpointContextMenu | null>) => void;
  lineEndpointLabelDraft: string;
  setLineEndpointLabelDraft: (value: string) => void;
  renameLineEndpointByObjectId: (
    objectId: string,
    endpoint: "start" | "end",
    label: string
  ) => void | Promise<void>;
  objectContextMenu: WorkbookObjectContextMenu | null;
  setObjectContextMenu: (value: Updater<WorkbookObjectContextMenu | null>) => void;
  contextMenuObject: WorkbookBoardObject | null;
  pointLabelDraft: string;
  setPointLabelDraft: (value: string) => void;
  renamePointObject: (objectId: string, label: string) => void | Promise<void>;
  canDelete: boolean;
  commitObjectDelete: (objectId: string) => void | Promise<void>;
  commitObjectPin: (objectId: string, pinned: boolean) => void | Promise<void>;
  scaleObject: (factor: number, objectId?: string) => void | Promise<void>;
  commitObjectReorder: (objectId: string, direction: "front" | "back") => void | Promise<void>;
  canBringContextMenuImageToFront: boolean;
  canSendContextMenuImageToBack: boolean;
  canRestoreContextMenuImage: boolean;
  restoreImageOriginalView: (objectId?: string) => void;
  areaSelectionContextMenu: ContextMenuPoint | null;
  areaSelectionHasContent: boolean;
  setAreaSelectionContextMenu: (value: Updater<ContextMenuPoint | null>) => void;
  copyAreaSelectionObjects: () => void | Promise<void>;
  cutAreaSelectionObjects: () => void | Promise<void>;
  cropImageByAreaSelection: () => void;
  canCropAreaSelectionImage: boolean;
  createCompositionFromAreaSelection: () => void | Promise<void>;
  areaSelection: WorkbookAreaSelection | null;
  deleteAreaSelectionObjects: () => void | Promise<void>;
  canSelect: boolean;
  isStereoDialogOpen: boolean;
  setIsStereoDialogOpen: (value: boolean) => void;
  createMathPresetObject: (
    type: "coordinate_grid" | "solid3d" | "section3d" | "net3d",
    options?: { presetId?: string; presetTitle?: string }
  ) => void | Promise<void>;
  isShapesDialogOpen: boolean;
  setIsShapesDialogOpen: (value: boolean) => void;
  shapeCatalog: ShapeCatalogItem[];
  activateTool: (tool: WorkbookTool) => void;
};
export function WorkbookSessionOverlays({
  overlayContainer,
  isClearSessionChatDialogOpen,
  setIsClearSessionChatDialogOpen,
  isCompactDialogViewport,
  handleClearSessionChat,
  solid3dVertexContextMenu,
  setSolid3dVertexContextMenu,
  renameSolid3dVertex,
  getSolidVertexLabel,
  solid3dSectionVertexContextMenu,
  setSolid3dSectionVertexContextMenu,
  renameSolid3dSectionVertex,
  getSectionVertexLabel,
  solid3dSectionContextMenu,
  setSolid3dSectionContextMenu,
  contextMenuSection,
  updateSolid3dSection,
  deleteSolid3dSection,
  shapeVertexContextMenu,
  contextMenuShapeVertexObject,
  setShapeVertexContextMenu,
  shapeVertexLabelDraft,
  setShapeVertexLabelDraft,
  renameShape2dVertexByObjectId,
  lineEndpointContextMenu,
  contextMenuLineEndpointObject,
  setLineEndpointContextMenu,
  lineEndpointLabelDraft,
  setLineEndpointLabelDraft,
  renameLineEndpointByObjectId,
  objectContextMenu,
  setObjectContextMenu,
  contextMenuObject,
  pointLabelDraft,
  setPointLabelDraft,
  renamePointObject,
  canDelete,
  commitObjectDelete,
  commitObjectPin,
  scaleObject,
  commitObjectReorder,
  canBringContextMenuImageToFront,
  canSendContextMenuImageToBack,
  canRestoreContextMenuImage,
  restoreImageOriginalView,
  areaSelectionContextMenu,
  areaSelectionHasContent,
  setAreaSelectionContextMenu,
  copyAreaSelectionObjects,
  cutAreaSelectionObjects,
  cropImageByAreaSelection,
  canCropAreaSelectionImage,
  createCompositionFromAreaSelection,
  areaSelection,
  deleteAreaSelectionObjects,
  canSelect,
  isStereoDialogOpen,
  setIsStereoDialogOpen,
  createMathPresetObject,
  isShapesDialogOpen,
  setIsShapesDialogOpen,
  shapeCatalog,
  activateTool,
}: WorkbookSessionOverlaysProps) {
  return (
    <>
          <Dialog
            container={overlayContainer}
            open={isClearSessionChatDialogOpen}
            onClose={() => setIsClearSessionChatDialogOpen(false)}
            fullWidth
            maxWidth="xs"
            fullScreen={isCompactDialogViewport}
            className="workbook-session__confirm-dialog"
          >
            <DialogTitle>Очистить чат?</DialogTitle>
            <DialogContent>
              <p className="workbook-session__hint">
                Это действие удалит сообщения чата для всех участников текущей сессии.
              </p>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsClearSessionChatDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => {
                  setIsClearSessionChatDialogOpen(false);
                  void handleClearSessionChat();
                }}
              >
                Очистить
              </Button>
            </DialogActions>
          </Dialog>
          <Menu
            container={overlayContainer}
            open={Boolean(solid3dVertexContextMenu)}
            onClose={() => setSolid3dVertexContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              solid3dVertexContextMenu
                ? { top: solid3dVertexContextMenu.y, left: solid3dVertexContextMenu.x }
                : undefined
            }
          >
            <div className="workbook-session__solid-menu">
              <TextField
                size="small"
                placeholder="Название вершины"
                inputProps={{ "aria-label": "Название вершины" }}
                value={solid3dVertexContextMenu?.label ?? ""}
                onChange={(event) =>
                  setSolid3dVertexContextMenu((current) =>
                    current ? { ...current, label: event.target.value } : current
                  )
                }
              />
              <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                <IconButton
                  size="small"
                  aria-label="Сбросить название вершины"
                  onClick={() => {
                    if (!solid3dVertexContextMenu) return;
                    void renameSolid3dVertex(
                      solid3dVertexContextMenu.vertexIndex,
                      getSolidVertexLabel(solid3dVertexContextMenu.vertexIndex)
                    );
                    setSolid3dVertexContextMenu(null);
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="Сохранить название вершины"
                  onClick={() => {
                    if (!solid3dVertexContextMenu) return;
                    void renameSolid3dVertex(
                      solid3dVertexContextMenu.vertexIndex,
                      solid3dVertexContextMenu.label
                    );
                    setSolid3dVertexContextMenu(null);
                  }}
                >
                  <SaveRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          </Menu>
          <Menu
            container={overlayContainer}
            open={Boolean(solid3dSectionVertexContextMenu)}
            onClose={() => setSolid3dSectionVertexContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              solid3dSectionVertexContextMenu
                ? {
                    top: solid3dSectionVertexContextMenu.y,
                    left: solid3dSectionVertexContextMenu.x,
                  }
                : undefined
            }
          >
            <div className="workbook-session__solid-menu">
              <TextField
                size="small"
                placeholder="Название вершины сечения"
                inputProps={{ "aria-label": "Название вершины сечения" }}
                value={solid3dSectionVertexContextMenu?.label ?? ""}
                onChange={(event) =>
                  setSolid3dSectionVertexContextMenu((current) =>
                    current ? { ...current, label: event.target.value } : current
                  )
                }
              />
              <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                <IconButton
                  size="small"
                  aria-label="Сбросить название вершины сечения"
                  onClick={() => {
                    if (!solid3dSectionVertexContextMenu) return;
                    void renameSolid3dSectionVertex(
                      solid3dSectionVertexContextMenu.sectionId,
                      solid3dSectionVertexContextMenu.vertexIndex,
                      getSectionVertexLabel(solid3dSectionVertexContextMenu.vertexIndex)
                    );
                    setSolid3dSectionVertexContextMenu(null);
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="Сохранить название вершины сечения"
                  onClick={() => {
                    if (!solid3dSectionVertexContextMenu) return;
                    void renameSolid3dSectionVertex(
                      solid3dSectionVertexContextMenu.sectionId,
                      solid3dSectionVertexContextMenu.vertexIndex,
                      solid3dSectionVertexContextMenu.label
                    );
                    setSolid3dSectionVertexContextMenu(null);
                  }}
                >
                  <SaveRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          </Menu>
          <Menu
            container={overlayContainer}
            open={Boolean(solid3dSectionContextMenu && contextMenuSection)}
            onClose={() => setSolid3dSectionContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              solid3dSectionContextMenu
                ? { top: solid3dSectionContextMenu.y, left: solid3dSectionContextMenu.x }
                : undefined
            }
          >
            {contextMenuSection ? (
              <div className="workbook-session__solid-menu">
                <div className="workbook-session__solid-menu-row">
                  <span>Цвет сечения</span>
                  <input
                    type="color"
                    className="workbook-session__solid-color"
                    value={contextMenuSection.color}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        color: event.target.value || "#c4872f",
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-row">
                  <span>Показать сечение</span>
                  <Switch
                    size="small"
                    checked={contextMenuSection.visible}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        visible: event.target.checked,
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-row">
                  <span>Заливка</span>
                  <Switch
                    size="small"
                    checked={contextMenuSection.fillEnabled}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        fillEnabled: event.target.checked,
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-row">
                  <span>Метки параметров</span>
                  <Switch
                    size="small"
                    checked={contextMenuSection.showMetrics}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        showMetrics: event.target.checked,
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-actions">
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      void deleteSolid3dSection(
                        contextMenuSection.id,
                        solid3dSectionContextMenu?.objectId
                      );
                      setSolid3dSectionContextMenu(null);
                    }}
                  >
                    Удалить сечение
                  </Button>
                </div>
              </div>
            ) : null}
          </Menu>
          <Menu
            container={overlayContainer}
            open={Boolean(shapeVertexContextMenu && contextMenuShapeVertexObject)}
            onClose={() => setShapeVertexContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              shapeVertexContextMenu
                ? { top: shapeVertexContextMenu.y, left: shapeVertexContextMenu.x }
                : undefined
            }
          >
            {shapeVertexContextMenu && contextMenuShapeVertexObject ? (
              <div className="workbook-session__solid-menu">
                <TextField
                  size="small"
                  placeholder="Название вершины"
                  inputProps={{ "aria-label": "Название вершины" }}
                  value={shapeVertexLabelDraft}
                  onChange={(event) =>
                    setShapeVertexLabelDraft(event.target.value.slice(0, 12))
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key !== "Enter") return;
                    void renameShape2dVertexByObjectId(
                      shapeVertexContextMenu.objectId,
                      shapeVertexContextMenu.vertexIndex,
                      shapeVertexLabelDraft
                    );
                    setShapeVertexContextMenu(null);
                  }}
                  autoFocus
                />
                <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                  <IconButton
                    size="small"
                    aria-label="Сбросить подпись вершины"
                    onClick={() => {
                      void renameShape2dVertexByObjectId(
                        shapeVertexContextMenu.objectId,
                        shapeVertexContextMenu.vertexIndex,
                        ""
                      );
                      setShapeVertexContextMenu(null);
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Сохранить подпись вершины"
                    onClick={() => {
                      void renameShape2dVertexByObjectId(
                        shapeVertexContextMenu.objectId,
                        shapeVertexContextMenu.vertexIndex,
                        shapeVertexLabelDraft
                      );
                      setShapeVertexContextMenu(null);
                    }}
                  >
                    <SaveRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ) : null}
          </Menu>
          <Menu
            container={overlayContainer}
            open={Boolean(lineEndpointContextMenu && contextMenuLineEndpointObject)}
            onClose={() => setLineEndpointContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              lineEndpointContextMenu
                ? { top: lineEndpointContextMenu.y, left: lineEndpointContextMenu.x }
                : undefined
            }
          >
            {lineEndpointContextMenu && contextMenuLineEndpointObject ? (
              <div className="workbook-session__solid-menu">
                <TextField
                  size="small"
                  placeholder={
                    lineEndpointContextMenu.endpoint === "start"
                      ? "Название конца A"
                      : "Название конца B"
                  }
                  inputProps={{
                    "aria-label":
                      lineEndpointContextMenu.endpoint === "start"
                        ? "Название конца A"
                        : "Название конца B",
                  }}
                  value={lineEndpointLabelDraft}
                  onChange={(event) =>
                    setLineEndpointLabelDraft(event.target.value.slice(0, 12))
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key !== "Enter") return;
                    void renameLineEndpointByObjectId(
                      lineEndpointContextMenu.objectId,
                      lineEndpointContextMenu.endpoint,
                      lineEndpointLabelDraft
                    );
                    setLineEndpointContextMenu(null);
                  }}
                  autoFocus
                />
                <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                  <IconButton
                    size="small"
                    aria-label="Сбросить подпись конца отрезка"
                    onClick={() => {
                      void renameLineEndpointByObjectId(
                        lineEndpointContextMenu.objectId,
                        lineEndpointContextMenu.endpoint,
                        ""
                      );
                      setLineEndpointContextMenu(null);
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Сохранить подпись конца отрезка"
                    onClick={() => {
                      void renameLineEndpointByObjectId(
                        lineEndpointContextMenu.objectId,
                        lineEndpointContextMenu.endpoint,
                        lineEndpointLabelDraft
                      );
                      setLineEndpointContextMenu(null);
                    }}
                  >
                    <SaveRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ) : null}
          </Menu>
          <Menu
            container={overlayContainer}
            open={Boolean(objectContextMenu)}
            onClose={() => setObjectContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              objectContextMenu
                ? { top: objectContextMenu.y, left: objectContextMenu.x }
                : undefined
            }
          >
            {contextMenuObject?.type === "point" ? (
              <div className="workbook-session__solid-menu">
                <TextField
                  size="small"
                  placeholder="Название точки"
                  inputProps={{ "aria-label": "Название точки" }}
                  value={pointLabelDraft}
                  onChange={(event) => setPointLabelDraft(event.target.value.slice(0, 12))}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      void renamePointObject(contextMenuObject.id, pointLabelDraft);
                      setObjectContextMenu(null);
                    }
                  }}
                  autoFocus
                />
                <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Удалить точку"
                    onClick={() => {
                      if (!canDelete) return;
                      void commitObjectDelete(contextMenuObject.id);
                      setObjectContextMenu(null);
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Сохранить название точки"
                    onClick={() => {
                      void renamePointObject(contextMenuObject.id, pointLabelDraft);
                      setObjectContextMenu(null);
                    }}
                  >
                    <SaveRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ) : null}
            {contextMenuObject && contextMenuObject.type !== "point" ? (
              <>
                <MenuItem
                  onClick={() => {
                    void commitObjectPin(contextMenuObject.id, !contextMenuObject.pinned);
                    setObjectContextMenu(null);
                  }}
                >
                  {contextMenuObject?.pinned ? "Открепить объект" : "Закрепить объект"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void scaleObject(1.1, contextMenuObject.id);
                    setObjectContextMenu(null);
                  }}
                >
                  Увеличить на 10%
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void scaleObject(0.9, contextMenuObject.id);
                    setObjectContextMenu(null);
                  }}
                >
                  Уменьшить на 10%
                </MenuItem>
                {contextMenuObject.type === "image" ? (
                  <MenuItem
                    onClick={() => {
                      void commitObjectReorder(contextMenuObject.id, "front");
                      setObjectContextMenu(null);
                    }}
                    disabled={!canBringContextMenuImageToFront}
                  >
                    Переместить на передний план
                  </MenuItem>
                ) : null}
                {contextMenuObject.type === "image" ? (
                  <MenuItem
                    onClick={() => {
                      void commitObjectReorder(contextMenuObject.id, "back");
                      setObjectContextMenu(null);
                    }}
                    disabled={!canSendContextMenuImageToBack}
                  >
                    Переместить на задний план
                  </MenuItem>
                ) : null}
                {canRestoreContextMenuImage ? (
                  <MenuItem
                    onClick={() => {
                      restoreImageOriginalView(contextMenuObject.id);
                      setObjectContextMenu(null);
                    }}
                  >
                    Восстановить исходный вид
                  </MenuItem>
                ) : null}
              </>
            ) : null}
            {contextMenuObject &&
            contextMenuObject.type !== "point" &&
            canDelete &&
            !contextMenuObject.pinned ? (
              <MenuItem
                onClick={() => {
                  void commitObjectDelete(contextMenuObject.id);
                  setObjectContextMenu(null);
                }}
              >
                Удалить
              </MenuItem>
            ) : null}
          </Menu>
          <Menu
            container={overlayContainer}
            open={Boolean(areaSelectionContextMenu && areaSelectionHasContent)}
            onClose={() => setAreaSelectionContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              areaSelectionContextMenu
                ? { top: areaSelectionContextMenu.y, left: areaSelectionContextMenu.x }
                : undefined
            }
          >
            <MenuItem
              onClick={() => void copyAreaSelectionObjects()}
              disabled={!canSelect || !areaSelectionHasContent}
            >
              Скопировать область
            </MenuItem>
            <MenuItem
              onClick={() => void cutAreaSelectionObjects()}
              disabled={!canDelete || !areaSelectionHasContent}
            >
              Вырезать область
            </MenuItem>
            <MenuItem
              onClick={() => cropImageByAreaSelection()}
              disabled={!canCropAreaSelectionImage}
            >
              Обрезать изображение по выделению
            </MenuItem>
            <MenuItem
              onClick={() => void createCompositionFromAreaSelection()}
              disabled={!canSelect || !areaSelection || areaSelection.objectIds.length < 2}
            >
              Объединить в композицию
            </MenuItem>
            <MenuItem
              onClick={() => void deleteAreaSelectionObjects()}
              disabled={!canDelete}
            >
              Удалить выделенное
            </MenuItem>
          </Menu>
          <Dialog
            container={overlayContainer}
            open={isStereoDialogOpen}
            onClose={() => setIsStereoDialogOpen(false)}
            fullWidth
            maxWidth="md"
            className="workbook-session__stereo-dialog"
          >
            <DialogTitle>Стереометрические фигуры</DialogTitle>
            <DialogContent dividers>
              <div className="workbook-session__stereo-grid">
                {SOLID3D_PRESETS.map((preset) => (
                  <button
                    key={`stereo-preset-${preset.id}`}
                    type="button"
                    className="workbook-session__stereo-card"
                    onClick={() => {
                      void createMathPresetObject("solid3d", {
                        presetId: preset.id,
                        presetTitle: preset.title,
                      });
                      setIsStereoDialogOpen(false);
                    }}
                  >
                    <SolidPresetPreview presetId={preset.id} />
                    <span>{preset.title}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsStereoDialogOpen(false)}>Закрыть</Button>
            </DialogActions>
          </Dialog>
          <Dialog
            container={overlayContainer}
            open={isShapesDialogOpen}
            onClose={() => setIsShapesDialogOpen(false)}
            fullWidth
            maxWidth="md"
            className="workbook-session__stereo-dialog"
          >
            <DialogTitle>Каталог 2D-фигур</DialogTitle>
            <DialogContent dividers>
              <div className="workbook-session__stereo-grid">
                {shapeCatalog.map((shape) => (
                  <button
                    key={`shape-preset-${shape.id}`}
                    type="button"
                    className="workbook-session__stereo-card"
                    onClick={() => {
                      shape.apply();
                      activateTool(shape.tool);
                      setIsShapesDialogOpen(false);
                    }}
                  >
                    <div className="workbook-session__shape-icon">{shape.icon}</div>
                    <span>{shape.title}</span>
                    <small>{shape.subtitle}</small>
                  </button>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsShapesDialogOpen(false)}>Закрыть</Button>
            </DialogActions>
          </Dialog>
    </>
  );
}
