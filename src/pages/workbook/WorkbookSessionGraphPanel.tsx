import { memo } from "react";
import { Alert, Button, IconButton, Switch, Tooltip } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  FUNCTION_GRAPH_PRESETS,
  type GraphFunctionDraft,
} from "@/features/workbook/model/functionGraph";
import { toColorInputValue } from "@/shared/lib/colorInput";

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
  selectedGraphPresetId: string | null;
  onSelectGraphPreset: (presetId: string, expression: string) => void;
  graphTabFunctions: GraphFunctionDraft[];
  onGraphFunctionColorChange: (id: string, color: string) => void;
  onToggleGraphFunctionDashed: (id: string, dashed: boolean) => void;
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
  selectedGraphPresetId,
  onSelectGraphPreset,
  graphTabFunctions,
  onGraphFunctionColorChange,
  onToggleGraphFunctionDashed,
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
                  value={toColorInputValue(selectedFunctionGraphAxisColor, "#c4872f")}
                  onChange={(event) => onAxisColorChange(event.target.value || "#c4872f")}
                />
              </label>
              <label>
                <span>Цвет плоскости</span>
                <span className="workbook-session__graph-appearance-tools">
                  <input
                    type="color"
                    value={toColorInputValue(selectedFunctionGraphPlaneColor, "#5f6f86")}
                    onChange={(event) => onPlaneColorChange(event.target.value || "#5f6f86")}
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
                    На плоскости пока нет функций. Выберите шаблон из каталога.
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
                              value={toColorInputValue(item.color, "#2f4f7f")}
                              onChange={(event) =>
                                onGraphFunctionColorChange(item.id, event.target.value || item.color)
                              }
                            />
                          </label>
                          <span
                            className="workbook-session__graph-expression-badge"
                            title={item.expression}
                          >
                            {item.expression}
                          </span>
                          <label className="workbook-session__graph-dashed-toggle">
                            <Switch
                              size="small"
                              checked={Boolean(item.dashed)}
                              onChange={(event) =>
                                onToggleGraphFunctionDashed(item.id, event.target.checked)
                              }
                              inputProps={{ "aria-label": "Пунктир" }}
                            />
                            <span>Пунктир</span>
                          </label>
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
                            <button
                              type="button"
                              className="workbook-session__graph-inline-action workbook-session__graph-inline-action--danger"
                              onClick={() => onRemoveGraphFunction(item.id)}
                              aria-label="Удалить функцию"
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});
