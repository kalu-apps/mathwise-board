import { useMemo } from "react";
import { Alert, Button, IconButton, MenuItem, Select, Switch, TextField } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PolylineRoundedIcon from "@mui/icons-material/PolylineRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import { computeSectionPolygon } from "@/features/workbook/model/solid3dGeometry";
import {
  SHAPE_ANGLE_MARK_STYLE_OPTIONS,
  type WorkbookShapeAngleMarkStyle,
} from "@/features/workbook/model/shapeAngleMarks";
import {
  WORKBOOK_BOARD_PRIMARY_COLOR,
  WORKBOOK_SELECTION_HELPER_COLOR,
  WORKBOOK_SYSTEM_COLORS,
} from "@/features/workbook/model/workbookVisualColors";
import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";

type WorkbookSessionTransformPanelSolid3dProps = Pick<
  WorkbookSessionTransformPanelProps,
  | "selectedSolid3dState"
  | "selectedSolidMesh"
  | "selectedSolidIsCurved"
  | "selectedSolidHiddenEdges"
  | "selectedSolidSurfaceColor"
  | "selectedSolidFaceColors"
  | "selectedSolidEdgeColors"
  | "selectedSolidEdges"
  | "selectedSolidAngleMarks"
  | "selectedSolidVertexLabels"
  | "solid3dInspectorTab"
  | "setSolid3dInspectorTab"
  | "solid3dFigureTab"
  | "setSolid3dFigureTab"
  | "activeSolidSectionId"
  | "setActiveSolidSectionId"
  | "solid3dDraftPoints"
  | "solid3dDraftPointLimit"
  | "isSolid3dPointCollectionActive"
  | "canSelect"
  | "solid3dStrokeWidthDraft"
  | "setSolid3dStrokeWidthDraft"
  | "onUpdateSelectedSolid3dStrokeWidth"
  | "onCommitSelectedSolid3dStrokeWidth"
  | "onSetSolid3dHiddenEdges"
  | "onUpdateSelectedSolid3dSurfaceColor"
  | "onResetSolid3dFaceColors"
  | "onSetSolid3dFaceColor"
  | "onResetSolid3dEdgeColors"
  | "onSetSolid3dEdgeColor"
  | "onAddSolid3dAngleMark"
  | "onUpdateSolid3dAngleMark"
  | "onDeleteSolid3dAngleMark"
  | "onStartSolid3dSectionPointCollection"
  | "onBuildSectionFromDraftPoints"
  | "onClearSolid3dDraftPoints"
  | "onUpdateSolid3dSection"
  | "onDeleteSolid3dSection"
  | "getSolidVertexLabel"
  | "canToggleSelectedObjectLabels"
  | "selectedObjectShowLabels"
  | "onUpdateSelectedObjectMeta"
>;

export function WorkbookSessionTransformPanelSolid3d({
  selectedSolid3dState,
  selectedSolidMesh,
  selectedSolidIsCurved,
  selectedSolidHiddenEdges,
  selectedSolidSurfaceColor,
  selectedSolidFaceColors,
  selectedSolidEdgeColors,
  selectedSolidEdges,
  selectedSolidAngleMarks,
  selectedSolidVertexLabels,
  solid3dInspectorTab,
  setSolid3dInspectorTab,
  solid3dFigureTab,
  setSolid3dFigureTab,
  activeSolidSectionId,
  setActiveSolidSectionId,
  solid3dDraftPoints,
  solid3dDraftPointLimit,
  isSolid3dPointCollectionActive,
  canSelect,
  solid3dStrokeWidthDraft,
  setSolid3dStrokeWidthDraft,
  onUpdateSelectedSolid3dStrokeWidth,
  onCommitSelectedSolid3dStrokeWidth,
  onSetSolid3dHiddenEdges,
  onUpdateSelectedSolid3dSurfaceColor,
  onResetSolid3dFaceColors,
  onSetSolid3dFaceColor,
  onResetSolid3dEdgeColors,
  onSetSolid3dEdgeColor,
  onAddSolid3dAngleMark,
  onUpdateSolid3dAngleMark,
  onDeleteSolid3dAngleMark,
  onStartSolid3dSectionPointCollection,
  onBuildSectionFromDraftPoints,
  onClearSolid3dDraftPoints,
  onUpdateSolid3dSection,
  onDeleteSolid3dSection,
  getSolidVertexLabel,
  canToggleSelectedObjectLabels,
  selectedObjectShowLabels,
  onUpdateSelectedObjectMeta,
}: WorkbookSessionTransformPanelSolid3dProps) {
  const solidSurfaceFallback = WORKBOOK_SYSTEM_COLORS.tertiary;
  const solidEdgeFallback = WORKBOOK_BOARD_PRIMARY_COLOR;
  const solidAngleFallback = WORKBOOK_SELECTION_HELPER_COLOR;

  const solid3dSectionSummaries = useMemo(
    () =>
      selectedSolid3dState?.sections.map((section) => {
        const polygon =
          selectedSolidMesh && section.visible
            ? computeSectionPolygon(selectedSolidMesh, section).polygon
            : [];
        const vertexCount = polygon.length;
        const isPolygonal = !selectedSolidIsCurved && vertexCount >= 3;
        return {
          sectionId: section.id,
          vertexCount,
          isPolygonal,
          supportPointCount: section.points.length,
        };
      }),
    [selectedSolid3dState?.sections, selectedSolidIsCurved, selectedSolidMesh]
  );

  return (
    <div className="workbook-session__solid-inspector">
      <div className="workbook-session__solid-tabs">
        <Button
          size="small"
          className="workbook-session__solid-tab-btn"
          startIcon={<ViewInArRoundedIcon />}
          variant={solid3dInspectorTab === "figure" ? "contained" : "outlined"}
          onClick={() => setSolid3dInspectorTab("figure")}
        >
          Фигура
        </Button>
        <Button
          size="small"
          className="workbook-session__solid-tab-btn"
          startIcon={<PolylineRoundedIcon />}
          variant={solid3dInspectorTab === "section" ? "contained" : "outlined"}
          onClick={() => setSolid3dInspectorTab("section")}
        >
          Сечения
        </Button>
      </div>

      {solid3dInspectorTab === "figure" ? (
        selectedSolidMesh ? (
          <div className="workbook-session__solid-card-list workbook-session__solid-card-list--figure">
            <div className="workbook-session__solid-subtabs">
              <button
                type="button"
                className={solid3dFigureTab === "display" ? "is-active" : ""}
                onClick={() => setSolid3dFigureTab("display")}
              >
                Вид
              </button>
              {selectedSolidIsCurved ? (
                <button
                  type="button"
                  className={solid3dFigureTab === "surface" ? "is-active" : ""}
                  onClick={() => setSolid3dFigureTab("surface")}
                >
                  Поверхность
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={solid3dFigureTab === "faces" ? "is-active" : ""}
                    onClick={() => setSolid3dFigureTab("faces")}
                  >
                    Грани
                  </button>
                  <button
                    type="button"
                    className={solid3dFigureTab === "edges" ? "is-active" : ""}
                    onClick={() => setSolid3dFigureTab("edges")}
                  >
                    Ребра
                  </button>
                  <button
                    type="button"
                    className={solid3dFigureTab === "angles" ? "is-active" : ""}
                    onClick={() => setSolid3dFigureTab("angles")}
                  >
                    Углы
                  </button>
                </>
              )}
            </div>

            {solid3dFigureTab === "display" ? (
              <article className="workbook-session__solid-card">
                <div className="workbook-session__settings-row">
                  <span>Толщина контура</span>
                  <div className="workbook-session__line-range">
                    <input
                      type="range"
                      min={1}
                      max={18}
                      step={1}
                      value={solid3dStrokeWidthDraft}
                      onChange={(event) => {
                        const nextWidth = Math.max(1, Math.min(18, Number(event.target.value) || 1));
                        setSolid3dStrokeWidthDraft(nextWidth);
                        void onUpdateSelectedSolid3dStrokeWidth(nextWidth);
                      }}
                      onMouseUp={() => void onCommitSelectedSolid3dStrokeWidth()}
                      onTouchEnd={() => void onCommitSelectedSolid3dStrokeWidth()}
                      onBlur={() => void onCommitSelectedSolid3dStrokeWidth()}
                    />
                  </div>
                </div>
                <div className="workbook-session__solid-card-toggle-stack">
                  <div className="workbook-session__solid-card-row workbook-session__solid-card-row--toggle">
                    <span>
                      {selectedSolidIsCurved
                        ? "Скрыть вспомогательные контуры"
                        : "Скрыть пунктир"}
                    </span>
                    <Switch
                      size="small"
                      checked={selectedSolidHiddenEdges}
                      onChange={(event) => void onSetSolid3dHiddenEdges(event.target.checked)}
                    />
                  </div>
                  {canToggleSelectedObjectLabels ? (
                    <div className="workbook-session__solid-card-row workbook-session__solid-card-row--toggle">
                      <span>Показывать названия вершин/точек</span>
                      <Switch
                        size="small"
                        checked={selectedObjectShowLabels}
                        onChange={(event) =>
                          void onUpdateSelectedObjectMeta({
                            showLabels: event.target.checked,
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
                {selectedSolidIsCurved ? (
                  <p className="workbook-session__hint">
                    Для тел с круговым основанием скрыты служебные mesh-точки: в учебной записи
                    остаются контур, образующие, ось и сечения.
                  </p>
                ) : null}
              </article>
            ) : null}

            {solid3dFigureTab === "surface" && selectedSolidIsCurved ? (
              <article className="workbook-session__solid-card">
                <div className="workbook-session__solid-card-head">
                  <span className="workbook-session__solid-card-title">Поверхность тела</span>
                </div>
                <div className="workbook-session__solid-face-grid">
                  <div className="workbook-session__solid-face-row">
                    <span>Заливка</span>
                    <input
                      type="color"
                      className="workbook-session__solid-color"
                      value={selectedSolidSurfaceColor}
                      onChange={(event) =>
                        void onUpdateSelectedSolid3dSurfaceColor(
                          event.target.value || solidSurfaceFallback
                        )
                      }
                    />
                  </div>
                </div>
                <p className="workbook-session__hint">
                  Для тел с круговым основанием доступны управление поверхностью и служебными
                  контурами.
                </p>
              </article>
            ) : null}

            {solid3dFigureTab === "faces" && !selectedSolidIsCurved ? (
              <article className="workbook-session__solid-card">
                <div className="workbook-session__solid-card-head">
                  <span className="workbook-session__solid-card-title">Окрашивание граней</span>
                  <Button size="small" variant="outlined" onClick={() => void onResetSolid3dFaceColors()}>
                    Сбросить
                  </Button>
                </div>
                <div className="workbook-session__solid-face-grid">
                  {selectedSolidMesh.faces.slice(0, 24).map((_, faceIndex) => (
                    <div key={`solid-face-color-${faceIndex}`} className="workbook-session__solid-face-row">
                      <span>
                        {`Грань ${
                          selectedSolidMesh.faces[faceIndex]
                            .map(
                              (vertexIndex) =>
                                selectedSolidVertexLabels[vertexIndex] || getSolidVertexLabel(vertexIndex)
                            )
                            .join("-") || faceIndex + 1
                        }`}
                      </span>
                      <input
                        type="color"
                        className="workbook-session__solid-color"
                        value={selectedSolidFaceColors[String(faceIndex)] || solidSurfaceFallback}
                        onChange={(event) =>
                          void onSetSolid3dFaceColor(
                            faceIndex,
                            event.target.value || solidSurfaceFallback
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                {selectedSolidMesh.faces.length > 24 ? (
                  <p className="workbook-session__hint">
                    Для этой фигуры доступно много граней. Показаны первые 24.
                  </p>
                ) : null}
              </article>
            ) : null}

            {solid3dFigureTab === "edges" && !selectedSolidIsCurved ? (
              <article className="workbook-session__solid-card">
                <div className="workbook-session__solid-card-head">
                  <span className="workbook-session__solid-card-title">Окрашивание ребер</span>
                  <Button size="small" variant="outlined" onClick={() => void onResetSolid3dEdgeColors()}>
                    Сбросить
                  </Button>
                </div>
                <div className="workbook-session__solid-face-grid">
                  {selectedSolidEdges.slice(0, 24).map((edge) => (
                    <div key={`solid-edge-color-${edge.key}`} className="workbook-session__solid-face-row">
                      <span>{`Ребро ${edge.label}`}</span>
                      <input
                        type="color"
                        className="workbook-session__solid-color"
                        value={selectedSolidEdgeColors[edge.key] || solidEdgeFallback}
                        onChange={(event) =>
                          void onSetSolid3dEdgeColor(
                            edge.key,
                            event.target.value || solidEdgeFallback
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                {selectedSolidEdges.length > 24 ? (
                  <p className="workbook-session__hint">
                    Для этой фигуры доступно много ребер. Показаны первые 24.
                  </p>
                ) : null}
              </article>
            ) : null}

            {solid3dFigureTab === "angles" && !selectedSolidIsCurved ? (
              <article className="workbook-session__solid-card">
                <div className="workbook-session__solid-card-head">
                  <span className="workbook-session__solid-card-title">Углы</span>
                  <Button size="small" variant="outlined" onClick={() => void onAddSolid3dAngleMark()}>
                    Добавить
                  </Button>
                </div>
                {selectedSolidAngleMarks.length ? (
                  <div className="workbook-session__solid-angle-list">
                    {selectedSolidAngleMarks.map((mark) => {
                      const fallbackFaceIndex = selectedSolidMesh.faces.findIndex((face) =>
                        face.includes(mark.vertexIndex)
                      );
                      const storedFaceIndex =
                        typeof mark.faceIndex === "number" &&
                        Number.isInteger(mark.faceIndex) &&
                        mark.faceIndex >= 0
                          ? mark.faceIndex
                          : null;
                      const activeFaceIndex =
                        storedFaceIndex !== null && selectedSolidMesh.faces[storedFaceIndex]
                          ? storedFaceIndex
                          : Math.max(0, fallbackFaceIndex);
                      const activeFace = selectedSolidMesh.faces[activeFaceIndex] ?? [];
                      const activeVertexValue = activeFace.includes(mark.vertexIndex)
                        ? mark.vertexIndex
                        : (activeFace[0] ?? mark.vertexIndex);
                      const activeVertexLabel =
                        selectedSolidVertexLabels[activeVertexValue] ||
                        getSolidVertexLabel(activeVertexValue);

                      return (
                        <div key={mark.id} className="workbook-session__solid-angle-card">
                          <div className="workbook-session__solid-angle-card-head">
                            <div className="workbook-session__shape-angle-meta">
                              <span className="workbook-session__shape-angle-badge">
                                ∠{activeVertexLabel}
                              </span>
                              <div className="workbook-session__solid-angle-visibility">
                                <span>Скрыть</span>
                                <Switch
                                  size="small"
                                  checked={mark.visible === false}
                                  onChange={(event) =>
                                    void onUpdateSolid3dAngleMark(mark.id, {
                                      visible: !event.target.checked,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div className="workbook-session__solid-angle-card-actions">
                              <input
                                type="color"
                                className="workbook-session__solid-color"
                                value={mark.color || solidAngleFallback}
                                onChange={(event) =>
                                  void onUpdateSolid3dAngleMark(mark.id, {
                                    color: event.target.value || solidAngleFallback,
                                  })
                                }
                              />
                              <IconButton
                                size="small"
                                className="workbook-session__solid-angle-delete"
                                onClick={() => void onDeleteSolid3dAngleMark(mark.id)}
                              >
                                <CloseRoundedIcon />
                              </IconButton>
                            </div>
                          </div>
                          <div className="workbook-session__solid-angle-grid">
                            <Select
                              native
                              size="small"
                              className="workbook-session__solid-angle-field workbook-session__solid-angle-field--face"
                              value={String(activeFaceIndex)}
                              onChange={(event) => {
                                const nextFaceIndex = Number(event.target.value);
                                const nextFace = selectedSolidMesh.faces[nextFaceIndex] ?? [];
                                void onUpdateSolid3dAngleMark(mark.id, {
                                  faceIndex: nextFaceIndex,
                                  vertexIndex: nextFace.includes(mark.vertexIndex)
                                    ? mark.vertexIndex
                                    : (nextFace[0] ?? mark.vertexIndex),
                                });
                              }}
                              inputProps={{ "aria-label": "Грань угла" }}
                            >
                              {selectedSolidMesh.faces.map((face, faceIndex) => (
                                <option key={`face-opt-${mark.id}-${faceIndex}`} value={faceIndex}>
                                  {face
                                    .map(
                                      (vertexIndex) =>
                                        selectedSolidVertexLabels[vertexIndex] ||
                                        getSolidVertexLabel(vertexIndex)
                                    )
                                    .join("-")}
                                </option>
                              ))}
                            </Select>
                            <Select
                              native
                              size="small"
                              className="workbook-session__solid-angle-field workbook-session__solid-angle-field--vertex"
                              value={String(activeVertexValue)}
                              onChange={(event) =>
                                void onUpdateSolid3dAngleMark(mark.id, {
                                  vertexIndex: Number(event.target.value),
                                })
                              }
                              inputProps={{ "aria-label": "Вершина угла" }}
                            >
                              {activeFace.map((vertexIndex) => (
                                <option key={`vertex-opt-${mark.id}-${vertexIndex}`} value={vertexIndex}>
                                  {selectedSolidVertexLabels[vertexIndex] ||
                                    getSolidVertexLabel(vertexIndex)}
                                </option>
                              ))}
                            </Select>
                            <TextField
                              size="small"
                              className="workbook-session__solid-input workbook-session__solid-angle-field workbook-session__solid-angle-field--value"
                              placeholder="Значение"
                              inputProps={{ "aria-label": "Значение угла" }}
                              value={mark.label}
                              onChange={(event) =>
                                void onUpdateSolid3dAngleMark(mark.id, {
                                  label: event.target.value,
                                })
                              }
                            />
                            <TextField
                              select
                              size="small"
                              className="workbook-session__solid-input workbook-session__solid-angle-field workbook-session__solid-angle-field--style"
                              SelectProps={{
                                inputProps: { "aria-label": "Обозначение угла" },
                              }}
                              value={mark.style ?? "arc_single"}
                              onChange={(event) =>
                                void onUpdateSolid3dAngleMark(mark.id, {
                                  style: event.target.value as WorkbookShapeAngleMarkStyle,
                                })
                              }
                            >
                              {SHAPE_ANGLE_MARK_STYLE_OPTIONS.filter((option) => option.value !== "auto").map(
                                (option) => (
                                  <MenuItem key={option.value} value={option.value}>
                                    {option.preview} {option.label}
                                  </MenuItem>
                                )
                              )}
                            </TextField>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="workbook-session__hint">Добавьте угол и задайте значение вручную.</p>
                )}
              </article>
            ) : null}
          </div>
        ) : (
          <p className="workbook-session__hint">Выберите 3D-фигуру для настройки отображения.</p>
        )
      ) : (
        <>
          <div className="workbook-session__solid-section-actions">
            <Button
              size="small"
              variant={isSolid3dPointCollectionActive ? "contained" : "outlined"}
              onClick={onStartSolid3dSectionPointCollection}
              disabled={!canSelect}
            >
              Добавить точки сечения
            </Button>
            {isSolid3dPointCollectionActive ? (
              <>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void onBuildSectionFromDraftPoints()}
                  disabled={!solid3dDraftPoints || solid3dDraftPoints.points.length < 3}
                >
                  Построить сечение
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onClearSolid3dDraftPoints}
                  disabled={!solid3dDraftPoints || solid3dDraftPoints.points.length === 0}
                >
                  Очистить точки
                </Button>
              </>
            ) : null}
          </div>

          {isSolid3dPointCollectionActive ? (
            <Alert severity="info" className="workbook-session__hint-alert--compact">
              Кликните по ребру или вершине 3D-фигуры, чтобы добавить точку сечения.
              {solid3dDraftPoints
                ? ` Точки: ${solid3dDraftPoints.points.length}/${solid3dDraftPointLimit}.`
                : null}
            </Alert>
          ) : null}

          {selectedSolid3dState?.sections.length ? (
            <div className="workbook-session__solid-card-list">
              {selectedSolid3dState.sections.map((section) => {
                const summary = solid3dSectionSummaries?.find(
                  (item) => item.sectionId === section.id
                );
                return (
                  <article
                    key={section.id}
                    className={`workbook-session__solid-card ${
                      activeSolidSectionId === section.id ? "is-selected" : ""
                    }`}
                    onClick={() => setActiveSolidSectionId(section.id)}
                  >
                    <div className="workbook-session__solid-card-head">
                      <span className="workbook-session__solid-card-title">{section.name}</span>
                      <div className="workbook-session__solid-card-controls">
                        <input
                          type="color"
                          className="workbook-session__solid-color"
                          value={section.color}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            void onUpdateSolid3dSection(section.id, {
                              color: event.target.value || solidAngleFallback,
                            })
                          }
                        />
                        <Switch
                          size="small"
                          checked={section.visible}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            void onUpdateSolid3dSection(section.id, {
                              visible: event.target.checked,
                            });
                          }}
                        />
                        <IconButton
                          size="small"
                          className="workbook-session__solid-section-delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            void onDeleteSolid3dSection(section.id);
                          }}
                        >
                          <CloseRoundedIcon />
                        </IconButton>
                      </div>
                    </div>
                    <div className="workbook-session__solid-section-summary">
                      <div className="workbook-session__solid-section-badges">
                        <span className="workbook-session__solid-section-badge">
                          {selectedSolidIsCurved
                            ? "Криволинейное сечение"
                            : summary?.vertexCount && summary.vertexCount >= 3
                              ? `Многоугольник, ${summary.vertexCount} вершин`
                              : "Контур вычисляется автоматически"}
                        </span>
                        <span className="workbook-session__solid-section-badge is-muted">
                          Опорных точек: {summary?.supportPointCount ?? section.points.length}
                        </span>
                      </div>
                      {selectedSolidIsCurved ? (
                        <p className="workbook-session__hint">
                          Для тел с круговым основанием вершины сечения не используются.
                        </p>
                      ) : summary?.isPolygonal ? (
                        <p className="workbook-session__hint">
                          Переименовывайте вершины сечения правым кликом прямо на доске.
                        </p>
                      ) : (
                        <p className="workbook-session__hint">
                          Сечение сохранено как плоскость пересечения. Контур появится, когда
                          фигура корректно пересечётся этой плоскостью.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="workbook-session__hint">
              Добавьте сечение, затем укажите точки на ребрах или вершинах фигуры.
            </p>
          )}
        </>
      )}
    </div>
  );
}
