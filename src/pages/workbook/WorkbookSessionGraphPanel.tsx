import { memo } from "react";
import { Alert, Button, IconButton, TextField, Tooltip } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  FUNCTION_GRAPH_PRESETS,
  isFunctionExpressionValid,
  type GraphFunctionDraft,
} from "@/features/workbook/model/functionGraph";

export type WorkbookSessionGraphPanelProps = {
  graphTabUsesSelectedObject: boolean;
  canDraw: boolean;
  planeEntries: Array<{
    id: string;
    title: string;
    functionCount: number;
  }>;
  onCreatePlane: () => void;
  onSelectPlane: (planeId: string) => void;
  selectedFunctionGraphAxisColor: string;
  selectedFunctionGraphPlaneColor: string;
  onAxisColorChange: (color: string) => void;
  onPlaneColorChange: (color: string) => void;
  onClearPlaneBackground: () => void;
  graphWorkbenchTab: "catalog" | "work";
  onSelectCatalogTab: () => void;
  onSelectWorkTab: () => void;
  graphExpressionDraft: string;
  graphDraftError: string | null;
  onGraphExpressionDraftChange: (value: string) => void;
  onAddGraphFunction: () => void;
  selectedGraphPresetId: string | null;
  onSelectGraphPreset: (presetId: string, expression: string) => void;
  graphTabFunctions: GraphFunctionDraft[];
  onGraphFunctionColorChange: (id: string, color: string) => void;
  onGraphFunctionExpressionChange: (id: string, value: string) => void;
  onCommitGraphExpressions: () => void;
  onRemoveGraphFunction: (id: string) => void;
  onToggleGraphFunctionVisibility: (id: string, hidden: boolean) => void;
  onReflectGraphFunctionByAxis: (id: string, axis: "x" | "y") => void;
};

export const WorkbookSessionGraphPanel = memo(function WorkbookSessionGraphPanel({
  graphTabUsesSelectedObject,
  canDraw,
  planeEntries,
  onCreatePlane,
  onSelectPlane,
  selectedFunctionGraphAxisColor,
  selectedFunctionGraphPlaneColor,
  onAxisColorChange,
  onPlaneColorChange,
  onClearPlaneBackground,
  graphWorkbenchTab,
  onSelectCatalogTab,
  onSelectWorkTab,
  graphExpressionDraft,
  graphDraftError,
  onGraphExpressionDraftChange,
  onAddGraphFunction,
  selectedGraphPresetId,
  onSelectGraphPreset,
  graphTabFunctions,
  onGraphFunctionColorChange,
  onGraphFunctionExpressionChange,
  onCommitGraphExpressions,
  onRemoveGraphFunction,
  onToggleGraphFunctionVisibility,
  onReflectGraphFunctionByAxis,
}: WorkbookSessionGraphPanelProps) {
  return (
    <div className="workbook-session__card">
      <h3>График функции</h3>
      <div className="workbook-session__settings workbook-session__graph-tab">
        {!graphTabUsesSelectedObject ? (
          <div className="workbook-session__graph-plane-select">
            <Alert severity="info">
              Для работы с графиками выберите существующую плоскость или создайте новую на доске.
            </Alert>
            <div className="workbook-session__graph-plane-select-actions">
              <Button
                size="small"
                variant="contained"
                onClick={onCreatePlane}
                disabled={!canDraw}
              >
                Разместить плоскость
              </Button>
            </div>
            {planeEntries.length > 0 ? (
              <div className="workbook-session__graph-plane-list">
                {planeEntries.map((plane) => (
                  <button
                    key={plane.id}
                    type="button"
                    className="workbook-session__graph-plane-item"
                    onClick={() => onSelectPlane(plane.id)}
                  >
                    <strong>{plane.title}</strong>
                    <span>{`Графиков: ${plane.functionCount}`}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="workbook-session__hint">Координатные плоскости пока не созданы.</p>
            )}
          </div>
        ) : (
          <>
            <p className="workbook-session__hint">
              Редактируется выбранная координатная плоскость.
            </p>

            <div className="workbook-session__graph-appearance">
              <label>
                <span>Цвет осей</span>
                <input
                  type="color"
                  value={selectedFunctionGraphAxisColor}
                  onChange={(event) => onAxisColorChange(event.target.value || "#ff8e3c")}
                />
              </label>
              <label>
                <span>Цвет плоскости</span>
                <span className="workbook-session__graph-appearance-tools">
                  <input
                    type="color"
                    value={selectedFunctionGraphPlaneColor}
                    onChange={(event) => onPlaneColorChange(event.target.value || "#8ea7ff")}
                  />
                  <Tooltip title="Убрать фон" arrow>
                    <IconButton
                      size="small"
                      className="workbook-session__graph-plane-reset-btn"
                      onClick={onClearPlaneBackground}
                      aria-label="Убрать фон плоскости"
                    >
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </span>
              </label>
            </div>

            <div className="workbook-session__graph-mode-tabs">
              <button
                type="button"
                className={graphWorkbenchTab === "catalog" ? "is-active" : ""}
                onClick={onSelectCatalogTab}
              >
                Каталог
              </button>
              <button
                type="button"
                className={graphWorkbenchTab === "work" ? "is-active" : ""}
                onClick={onSelectWorkTab}
              >
                Работа с чертежом
              </button>
            </div>

            {graphWorkbenchTab === "catalog" ? (
              <>
                <div className="workbook-session__graph-builder-row">
                  <TextField
                    size="small"
                    value={graphExpressionDraft}
                    error={Boolean(graphDraftError)}
                    helperText={
                      graphDraftError ?? "Примеры: y = x^2 - 3*x + 2, sin(x), 1/x, abs(x)"
                    }
                    onChange={(event) => onGraphExpressionDraftChange(event.target.value)}
                    placeholder="Формула y = ..."
                  />
                  <Button size="small" variant="outlined" onClick={onAddGraphFunction}>
                    Добавить
                  </Button>
                </div>
                <div className="workbook-session__graph-presets">
                  {FUNCTION_GRAPH_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      className={`workbook-session__graph-preset ${
                        selectedGraphPresetId === preset.id ? "is-selected" : ""
                      }`}
                      onClick={() => onSelectGraphPreset(preset.id, preset.expression)}
                      aria-pressed={selectedGraphPresetId === preset.id}
                    >
                      <strong>{preset.title}</strong>
                      <span>{preset.expression}</span>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {graphTabFunctions.length === 0 ? (
                  <Alert
                    severity="info"
                    className="workbook-session__hint-alert--compact"
                    action={
                      <Button size="small" onClick={onSelectCatalogTab}>
                        Каталог
                      </Button>
                    }
                  >
                    На плоскости пока нет функций. Добавьте формулу или выберите шаблон.
                  </Alert>
                ) : (
                  <div className="workbook-session__graph-builder-list">
                    {graphTabFunctions.map((item) => (
                      <div
                        key={`graph-builder-${item.id}`}
                        className="workbook-session__graph-builder-item workbook-session__graph-builder-item--work"
                      >
                        <div className="workbook-session__graph-builder-item-main workbook-session__graph-builder-item-main--inline">
                          <label className="workbook-session__graph-swatch" title="Цвет графика">
                            <input
                              type="color"
                              value={item.color}
                              onChange={(event) =>
                                onGraphFunctionColorChange(item.id, event.target.value || item.color)
                              }
                            />
                          </label>
                          <TextField
                            size="small"
                            value={item.expression}
                            error={!isFunctionExpressionValid(item.expression)}
                            placeholder="f(x)"
                            inputProps={{ title: item.expression }}
                            onChange={(event) =>
                              onGraphFunctionExpressionChange(item.id, event.target.value)
                            }
                            onBlur={onCommitGraphExpressions}
                          />
                        </div>
                        <div className="workbook-session__graph-card-actions">
                          <Tooltip
                            title={item.visible !== false ? "Скрыть график" : "Показать график"}
                            arrow
                          >
                            <button
                              type="button"
                              className="workbook-session__graph-inline-action"
                              onClick={() =>
                                onToggleGraphFunctionVisibility(item.id, item.visible === false)
                              }
                              aria-label={item.visible !== false ? "Скрыть график" : "Показать график"}
                            >
                              {item.visible !== false ? (
                                <VisibilityRoundedIcon fontSize="small" />
                              ) : (
                                <VisibilityOffRoundedIcon fontSize="small" />
                              )}
                            </button>
                          </Tooltip>
                          <Tooltip title="Отразить по оси OX" arrow>
                            <button
                              type="button"
                              className="workbook-session__graph-inline-action"
                              onClick={() => onReflectGraphFunctionByAxis(item.id, "x")}
                              aria-label="Отразить по оси OX"
                            >
                              <SwapVertRoundedIcon fontSize="small" />
                            </button>
                          </Tooltip>
                          <Tooltip title="Отразить по оси OY" arrow>
                            <button
                              type="button"
                              className="workbook-session__graph-inline-action"
                              onClick={() => onReflectGraphFunctionByAxis(item.id, "y")}
                              aria-label="Отразить по оси OY"
                            >
                              <SwapHorizRoundedIcon fontSize="small" />
                            </button>
                          </Tooltip>
                          <Tooltip title="Удалить функцию" arrow>
                            <span>
                              <button
                                type="button"
                                className="workbook-session__graph-inline-action workbook-session__graph-inline-action--danger"
                                onClick={() => onRemoveGraphFunction(item.id)}
                                disabled={graphTabFunctions.length <= 1}
                                aria-label="Удалить функцию"
                              >
                                <DeleteOutlineRoundedIcon fontSize="small" />
                              </button>
                            </span>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="workbook-session__hint">
                  Координатная сетка и оси отображаются прямо на доске в границах плоскости.
                </p>
              </>
            )}
          </>
        )}

        {graphDraftError ? <Alert severity="error">{graphDraftError}</Alert> : null}
      </div>
    </div>
  );
});
