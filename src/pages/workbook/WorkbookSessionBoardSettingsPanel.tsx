import { memo } from "react";
import { Switch, TextField, useMediaQuery } from "@mui/material";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import DrawRoundedIcon from "@mui/icons-material/DrawRounded";
import type { WorkbookBoardSettings } from "@/features/workbook/model/types";
import { toColorInputValue } from "@/shared/lib/colorInput";

export type WorkbookBoardPageOption = {
  page: number;
  position: number;
  hasContent: boolean;
  label: string;
  title: string;
  preview: {
    objectCount: number;
    strokeCount: number;
    annotationCount: number;
    imageUrl: string | null;
  };
};

type ToolPaintSettings = {
  color: string;
  width: number;
};

export type WorkbookSessionBoardCompactToolSettings = {
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  eraserRadius: number;
  eraserRadiusMin: number;
  eraserRadiusMax: number;
  onPenToolSettingsChange: (patch: Partial<ToolPaintSettings>) => void;
  onHighlighterToolSettingsChange: (patch: Partial<ToolPaintSettings>) => void;
  onEraserRadiusChange: (value: number) => void;
  dividerColor: string;
  dividerWidth: number;
  dividerLineStyle: "solid" | "dashed";
  onDividerColorChange: (value: string) => void;
  onDividerWidthChange: (value: number) => void;
  onDividerLineStyleChange: (value: "solid" | "dashed") => void;
};

export type WorkbookSessionBoardSettingsPanelProps = {
  sharedBoardSettings: WorkbookBoardSettings;
  currentBoardPage: number;
  onSharedBoardSettingsChange: (patch: Partial<WorkbookBoardSettings>) => void;
  pageOptions: WorkbookBoardPageOption[];
  canManageSharedBoardSettings: boolean;
  compactToolSettings?: WorkbookSessionBoardCompactToolSettings;
};

export const WorkbookSessionBoardSettingsPanel = memo(function WorkbookSessionBoardSettingsPanel({
  sharedBoardSettings,
  currentBoardPage,
  onSharedBoardSettingsChange,
  pageOptions,
  canManageSharedBoardSettings,
  compactToolSettings,
}: WorkbookSessionBoardSettingsPanelProps) {
  const isCompactViewport = useMediaQuery("(max-width: 760px)");
  const mobileToolSettings = compactToolSettings ?? null;
  const safePageOptions =
    pageOptions.length > 0
      ? pageOptions
      : [
          {
            page: Math.max(1, Math.round(currentBoardPage || 1)),
            position: 1,
            hasContent: false,
            label: "Страница 1",
            title: "Страница 1",
            preview: {
              objectCount: 0,
              strokeCount: 0,
              annotationCount: 0,
              imageUrl: null,
            },
          },
        ];
  const safeCurrentPage = Math.max(1, Math.round(currentBoardPage || 1));
  const totalPages = Math.max(
    safeCurrentPage,
    Math.round(sharedBoardSettings.pagesCount || 1),
    safePageOptions[safePageOptions.length - 1]?.page ?? 1
  );

  return (
    <div className="workbook-session__card workbook-session__board-settings">
      <div className="workbook-session__board-settings-head">
        <h3>Настройки доски</h3>
        <p>
          {canManageSharedBoardSettings
            ? isCompactViewport
              ? "Общие параметры доски синхронизируются у всех участников."
              : "Из этого блока настраиваются только общие параметры доски с синхронизацией у всех участников."
            : isCompactViewport
              ? "Просмотр общих параметров без права изменения."
              : "Вы можете просматривать общие параметры. Изменение доступно только преподавателю."}
        </p>
      </div>

      <div className="workbook-session__board-settings-grid">
        {canManageSharedBoardSettings ? (
          <section className="workbook-session__board-settings-card">
            <div className="workbook-session__board-settings-card-head">
              <div className="workbook-session__board-settings-page-meta workbook-session__board-settings-page-meta--top">
                <span>Текущая страница: {safeCurrentPage}</span>
                <span>Всего страниц: {totalPages}</span>
              </div>
              <div className="workbook-session__board-settings-card-title">
                <h4>
                  <CropFreeRoundedIcon fontSize="small" />
                  Поле и сетка
                </h4>
              </div>
              <p>Эти параметры автоматически синхронизируются у всех участников сессии.</p>
            </div>
            <TextField
              size="small"
              placeholder="Название доски"
              inputProps={{ "aria-label": "Название доски" }}
              className="workbook-session__board-settings-text"
              value={sharedBoardSettings.title}
              onChange={(event) =>
                onSharedBoardSettingsChange({
                  title: event.target.value,
                })
              }
            />
            <div className="workbook-session__board-settings-field">
              <div className="workbook-session__board-settings-field-main">
                <strong>Показывать сетку</strong>
                <small>Фоновая разметка для построений и заметок.</small>
              </div>
              <Switch
                checked={sharedBoardSettings.showGrid}
                className="workbook-session__board-settings-switch"
                onChange={(event) =>
                  onSharedBoardSettingsChange({
                    showGrid: event.target.checked,
                  })
                }
              />
            </div>
            <div className="workbook-session__board-settings-field">
              <div className="workbook-session__board-settings-field-main">
                <strong>Привязка к сетке</strong>
                <small>Снап фигур и точек к базовой разметке.</small>
              </div>
              <Switch
                checked={sharedBoardSettings.snapToGrid}
                className="workbook-session__board-settings-switch"
                onChange={(event) =>
                  onSharedBoardSettingsChange({
                    snapToGrid: event.target.checked,
                  })
                }
              />
            </div>
            <div className="workbook-session__board-settings-field workbook-session__board-settings-field--grid">
              <div className="workbook-session__board-settings-grid-row">
                <strong>Размер сетки</strong>
                <div className="workbook-session__board-settings-range workbook-session__board-settings-range--grid">
                  <input
                    type="range"
                    min={8}
                    max={96}
                    value={sharedBoardSettings.gridSize}
                    onChange={(event) =>
                      onSharedBoardSettingsChange({
                        gridSize: Number(event.target.value),
                      })
                    }
                  />
                  <span className="workbook-session__board-settings-range-value">
                    {Math.round(sharedBoardSettings.gridSize)}
                  </span>
                </div>
              </div>
            </div>
            <div className="workbook-session__board-settings-field workbook-session__board-settings-field--colors">
              <div className="workbook-session__board-settings-field-main">
                <strong>Фон доски и сетка</strong>
              </div>
              <div className="workbook-session__board-settings-color-inline">
                <label className="workbook-session__board-settings-color-inline-item">
                  <span>Фон доски</span>
                  <input
                    type="color"
                    value={toColorInputValue(sharedBoardSettings.backgroundColor, "#ffffff")}
                    onChange={(event) =>
                      onSharedBoardSettingsChange({
                        backgroundColor: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="workbook-session__board-settings-color-inline-item">
                  <span>Цвет сетки</span>
                  <input
                    type="color"
                    value={toColorInputValue(sharedBoardSettings.gridColor, "#6d88ad")}
                    onChange={(event) =>
                      onSharedBoardSettingsChange({
                        gridColor: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </section>
        ) : (
          <section className="workbook-session__board-settings-card workbook-session__board-settings-card--muted">
            <div className="workbook-session__board-settings-card-head">
              <div className="workbook-session__board-settings-card-title">
                <h4>
                  <MenuRoundedIcon fontSize="small" />
                  Общие настройки
                </h4>
              </div>
              <p>
                Сетка, страницы, фон доски и другие общие параметры изменяет только преподаватель.
              </p>
            </div>
            <div className="workbook-session__board-settings-page-meta">
              <span>Текущая страница: {safeCurrentPage}</span>
              <span>Всего страниц: {totalPages}</span>
            </div>
            <div className="workbook-session__board-settings-note">
              Переключение страниц и изменение структуры доски доступны только у преподавателя.
            </div>
          </section>
        )}

        {mobileToolSettings ? (
          <section className="workbook-session__board-settings-card">
            <div className="workbook-session__board-settings-card-head">
              <div className="workbook-session__board-settings-card-title">
                <h4>
                  <DrawRoundedIcon fontSize="small" />
                  Инструменты рисования
                </h4>
              </div>
              <p>Локальные параметры ручки, маркера, ластика и разделителя.</p>
            </div>

            <div className="workbook-session__tool-settings-panel">
              <div className="workbook-session__tool-settings-cluster">
                <div className="workbook-session__tool-settings-cluster-title">Ручка</div>
                <div className="workbook-session__tool-settings-split">
                  <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                    <div className="workbook-session__tool-settings-field-main">
                      <strong>Цвет</strong>
                    </div>
                    <label className="workbook-session__tool-settings-color">
                      <input
                        type="color"
                        name="board-settings-pen-color"
                        value={toColorInputValue(mobileToolSettings.penToolSettings.color, "#2f4f7f")}
                        onChange={(event) =>
                          mobileToolSettings.onPenToolSettingsChange({ color: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                    <div className="workbook-session__tool-settings-field-main">
                      <strong>Радиус</strong>
                    </div>
                    <div className="workbook-session__tool-settings-range">
                      <input
                        type="range"
                        name="board-settings-pen-width"
                        min={1}
                        max={18}
                        value={mobileToolSettings.penToolSettings.width}
                        onChange={(event) =>
                          mobileToolSettings.onPenToolSettingsChange({
                            width: Number(event.target.value),
                          })
                        }
                      />
                      <span>{mobileToolSettings.penToolSettings.width} px</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="workbook-session__tool-settings-cluster">
                <div className="workbook-session__tool-settings-cluster-title">Маркер</div>
                <div className="workbook-session__tool-settings-split">
                  <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                    <div className="workbook-session__tool-settings-field-main">
                      <strong>Цвет</strong>
                    </div>
                    <label className="workbook-session__tool-settings-color">
                      <input
                        type="color"
                        name="board-settings-highlighter-color"
                        value={toColorInputValue(
                          mobileToolSettings.highlighterToolSettings.color,
                          "#d9c16f"
                        )}
                        onChange={(event) =>
                          mobileToolSettings.onHighlighterToolSettingsChange({
                            color: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                    <div className="workbook-session__tool-settings-field-main">
                      <strong>Радиус</strong>
                    </div>
                    <div className="workbook-session__tool-settings-range">
                      <input
                        type="range"
                        name="board-settings-highlighter-width"
                        min={6}
                        max={32}
                        value={mobileToolSettings.highlighterToolSettings.width}
                        onChange={(event) =>
                          mobileToolSettings.onHighlighterToolSettingsChange({
                            width: Number(event.target.value),
                          })
                        }
                      />
                      <span>{mobileToolSettings.highlighterToolSettings.width} px</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="workbook-session__tool-settings-cluster">
                <div className="workbook-session__tool-settings-cluster-title">Ластик</div>
                <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                  <div className="workbook-session__tool-settings-field-main">
                    <strong>Радиус</strong>
                  </div>
                  <div className="workbook-session__tool-settings-range">
                    <input
                      type="range"
                      name="board-settings-eraser-radius"
                      min={mobileToolSettings.eraserRadiusMin}
                      max={mobileToolSettings.eraserRadiusMax}
                      value={mobileToolSettings.eraserRadius}
                      onChange={(event) =>
                        mobileToolSettings.onEraserRadiusChange(Number(event.target.value))
                      }
                    />
                    <span>{mobileToolSettings.eraserRadius} px</span>
                  </div>
                </div>
              </div>

              <div className="workbook-session__tool-settings-cluster">
                <div className="workbook-session__tool-settings-cluster-title">Разделитель</div>
                <div className="workbook-session__tool-settings-split workbook-session__tool-settings-split--divider">
                  <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact workbook-session__tool-settings-field--divider-color">
                    <div className="workbook-session__tool-settings-field-main">
                      <strong>Цвет</strong>
                    </div>
                    <label className="workbook-session__tool-settings-color workbook-session__tool-settings-color--divider">
                      <input
                        type="color"
                        name="board-settings-divider-color"
                        value={toColorInputValue(mobileToolSettings.dividerColor, "#2f4f7f")}
                        onChange={(event) =>
                          mobileToolSettings.onDividerColorChange(event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact workbook-session__tool-settings-field--divider-style">
                    <div className="workbook-session__tool-settings-field-main">
                      <strong>Линия</strong>
                    </div>
                    <label className="workbook-session__tool-settings-divider-switch">
                      <span className="workbook-session__tool-settings-divider-switch-label">
                        Пунктир
                      </span>
                      <Switch
                        size="small"
                        checked={mobileToolSettings.dividerLineStyle === "dashed"}
                        onChange={(event) =>
                          mobileToolSettings.onDividerLineStyleChange(
                            event.target.checked ? "dashed" : "solid"
                          )
                        }
                        sx={{
                          width: 32,
                          height: 20,
                          padding: 0,
                          overflow: "hidden",
                          flexShrink: 0,
                          "& .MuiSwitch-switchBase": {
                            padding: "2px",
                            "&.Mui-checked": {
                              transform: "translateX(12px)",
                            },
                          },
                          "& .MuiSwitch-thumb": {
                            width: 16,
                            height: 16,
                          },
                          "& .MuiSwitch-track": {
                            borderRadius: "999px",
                            opacity: 1,
                            backgroundColor: "var(--surface-base)",
                            border: "1px solid color-mix(in srgb, var(--border-subtle) 82%, transparent)",
                          },
                          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                            backgroundColor: "var(--surface-base)",
                            opacity: 1,
                          },
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact workbook-session__tool-settings-field--divider-width">
                  <div className="workbook-session__tool-settings-field-main">
                    <strong>Толщина</strong>
                  </div>
                  <div className="workbook-session__tool-settings-range">
                    <input
                      type="range"
                      name="board-settings-divider-width"
                      min={1}
                      max={18}
                      step={1}
                      value={mobileToolSettings.dividerWidth}
                      onChange={(event) =>
                        mobileToolSettings.onDividerWidthChange(Number(event.target.value))
                      }
                    />
                    <span>{mobileToolSettings.dividerWidth} px</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
});
