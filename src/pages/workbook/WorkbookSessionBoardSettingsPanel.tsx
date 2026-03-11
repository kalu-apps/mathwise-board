import { memo, type Dispatch, type SetStateAction } from "react";
import { Select, Switch, TextField } from "@mui/material";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import type { WorkbookBoardSettings } from "@/features/workbook/model/types";
import {
  normalizeSmartInkOptions,
  type SmartInkOptions,
} from "./workbookBoardSettingsModel";

type ToolPaintSettings = {
  color: string;
  width: number;
};

type WorkbookSessionBoardSettingsPanelProps = {
  sharedBoardSettings: WorkbookBoardSettings;
  onSharedBoardSettingsChange: (patch: Partial<WorkbookBoardSettings>) => void;
  smartInkOptions: SmartInkOptions;
  setSmartInkOptions: Dispatch<SetStateAction<SmartInkOptions>>;
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  eraserRadius: number;
  onPenToolSettingsChange: (patch: Partial<ToolPaintSettings>) => void;
  onHighlighterToolSettingsChange: (patch: Partial<ToolPaintSettings>) => void;
  onEraserRadiusChange: (value: number) => void;
  eraserRadiusMin: number;
  eraserRadiusMax: number;
  canManageSharedBoardSettings: boolean;
};

export const WorkbookSessionBoardSettingsPanel = memo(function WorkbookSessionBoardSettingsPanel({
  sharedBoardSettings,
  onSharedBoardSettingsChange,
  smartInkOptions,
  setSmartInkOptions,
  penToolSettings,
  highlighterToolSettings,
  eraserRadius,
  onPenToolSettingsChange,
  onHighlighterToolSettingsChange,
  onEraserRadiusChange,
  eraserRadiusMin,
  eraserRadiusMax,
  canManageSharedBoardSettings,
}: WorkbookSessionBoardSettingsPanelProps) {
  const updateSmartInk = (patch: Partial<SmartInkOptions>) => {
    setSmartInkOptions((current) =>
      normalizeSmartInkOptions({
        ...current,
        ...patch,
      })
    );
  };

  return (
    <div className="workbook-session__card workbook-session__board-settings">
      <div className="workbook-session__board-settings-head">
        <div className="workbook-session__board-settings-head-meta">
          <span className="workbook-session__board-settings-head-pill is-accent">
            Автосохранение
          </span>
          <span className="workbook-session__board-settings-head-pill">
            {canManageSharedBoardSettings ? "Личное + общее" : "Личное"}
          </span>
        </div>
        <h3>Настройки доски</h3>
        <p>
          {canManageSharedBoardSettings
            ? "Личные настройки письма сохраняются автоматически только для вас, а общие параметры доски синхронно обновляются у всех участников."
            : "Здесь доступны только ваши личные настройки письма и Smart Ink. Общие параметры доски изменяет преподаватель."}
        </p>
      </div>

      <div className="workbook-session__board-settings-grid">
        <section className="workbook-session__board-settings-card">
          <div className="workbook-session__board-settings-card-head">
            <div className="workbook-session__board-settings-card-title">
              <h4>
                <BrushRoundedIcon fontSize="small" />
                Инструменты письма
              </h4>
              <span className="workbook-session__board-settings-scope">Личное</span>
            </div>
            <p>Толщина и цвет ручки, маркера и ластика применяются только к вашим инструментам.</p>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Ручка</strong>
              <small>Базовый цвет и толщина обычного штриха.</small>
            </div>
            <div className="workbook-session__board-settings-color-grid">
              <div className="workbook-session__board-settings-color-field">
                <span>Цвет</span>
                <label>
                  <input
                    type="color"
                    value={penToolSettings.color}
                    onChange={(event) =>
                      onPenToolSettingsChange({ color: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="workbook-session__board-settings-range">
                <input
                  type="range"
                  min={1}
                  max={18}
                  value={penToolSettings.width}
                  onChange={(event) =>
                    onPenToolSettingsChange({ width: Number(event.target.value) })
                  }
                />
                <span className="workbook-session__board-settings-range-value">
                  {penToolSettings.width} px
                </span>
              </div>
            </div>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Маркер</strong>
              <small>Полупрозрачный цвет и увеличенная толщина подсветки.</small>
            </div>
            <div className="workbook-session__board-settings-color-grid">
              <div className="workbook-session__board-settings-color-field">
                <span>Цвет</span>
                <label>
                  <input
                    type="color"
                    value={highlighterToolSettings.color}
                    onChange={(event) =>
                      onHighlighterToolSettingsChange({ color: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="workbook-session__board-settings-range">
                <input
                  type="range"
                  min={6}
                  max={32}
                  value={highlighterToolSettings.width}
                  onChange={(event) =>
                    onHighlighterToolSettingsChange({
                      width: Number(event.target.value),
                    })
                  }
                />
                <span className="workbook-session__board-settings-range-value">
                  {highlighterToolSettings.width} px
                </span>
              </div>
            </div>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Ластик</strong>
              <small>Радиус стирания применяется сразу и сохраняется на этом устройстве.</small>
            </div>
            <div className="workbook-session__board-settings-range">
              <input
                type="range"
                min={eraserRadiusMin}
                max={eraserRadiusMax}
                value={eraserRadius}
                onChange={(event) => onEraserRadiusChange(Number(event.target.value))}
              />
              <span className="workbook-session__board-settings-range-value">
                {eraserRadius} px
              </span>
            </div>
          </div>
        </section>

        <section className="workbook-session__board-settings-card">
          <div className="workbook-session__board-settings-card-head">
            <div className="workbook-session__board-settings-card-title">
              <h4>
                <AutoFixHighRoundedIcon fontSize="small" />
                Smart Ink
              </h4>
              <span className="workbook-session__board-settings-scope">Личное</span>
            </div>
            <p>Распознавание работает только для ваших новых штрихов и сохраняется автоматически.</p>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Режим обработки</strong>
              <small>Выберите, что именно должно автоматически распознаваться в ваших штрихах.</small>
            </div>
            <Select
              native
              size="small"
              className="workbook-session__board-settings-select"
              value={smartInkOptions.mode}
              onChange={(event) =>
                updateSmartInk({
                  mode:
                    event.target.value === "off" ||
                    event.target.value === "basic" ||
                    event.target.value === "full"
                      ? event.target.value
                      : smartInkOptions.mode,
                })
              }
            >
              <option value="off">Выкл.</option>
              <option value="basic">Только фигуры</option>
              <option value="full">Фигуры + OCR / LaTeX</option>
            </Select>
          </div>

          {smartInkOptions.mode !== "off" ? (
            <>
              <div className="workbook-session__board-settings-field">
                <div className="workbook-session__board-settings-field-main">
                  <strong>Минимальная уверенность</strong>
                  <small>Автозамена сработает только если распознавание уверено выше этого порога.</small>
                </div>
                <div className="workbook-session__board-settings-range">
                  <input
                    type="range"
                    min={0.35}
                    max={0.98}
                    step={0.01}
                    value={smartInkOptions.confidenceThreshold}
                    onChange={(event) =>
                      updateSmartInk({
                        confidenceThreshold: Number(event.target.value),
                      })
                    }
                  />
                  <span className="workbook-session__board-settings-range-value">
                    {Math.round(smartInkOptions.confidenceThreshold * 100)}%
                  </span>
                </div>
              </div>
              <div className="workbook-session__board-settings-field">
                <div className="workbook-session__board-settings-field-main">
                  <strong>Выравнивать фигуры</strong>
                  <small>Подменять рукописные прямоугольники, линии и окружности на точные объекты.</small>
                </div>
                <Switch
                  size="small"
                  className="workbook-session__board-settings-switch"
                  checked={smartInkOptions.smartShapes}
                  onChange={(event) =>
                    updateSmartInk({
                      smartShapes: event.target.checked,
                    })
                  }
                />
              </div>
            </>
          ) : (
            <div className="workbook-session__board-settings-note">
              Smart Ink выключен: новые штрихи останутся рукописными без автообработки.
            </div>
          )}

          {smartInkOptions.mode === "full" ? (
            <>
              <div className="workbook-session__board-settings-field">
                <div className="workbook-session__board-settings-field-main">
                  <strong>Распознавать текст</strong>
                  <small>Преобразовывать рукописные слова в текстовые блоки.</small>
                </div>
                <Switch
                  size="small"
                  className="workbook-session__board-settings-switch"
                  checked={smartInkOptions.smartTextOcr}
                  onChange={(event) =>
                    updateSmartInk({
                      smartTextOcr: event.target.checked,
                    })
                  }
                />
              </div>
              <div className="workbook-session__board-settings-field">
                <div className="workbook-session__board-settings-field-main">
                  <strong>Распознавать формулы</strong>
                  <small>Преобразовывать математические записи в формульные объекты LaTeX.</small>
                </div>
                <Switch
                  size="small"
                  className="workbook-session__board-settings-switch"
                  checked={smartInkOptions.smartMathOcr}
                  onChange={(event) =>
                    updateSmartInk({
                      smartMathOcr: event.target.checked,
                    })
                  }
                />
              </div>
              {!smartInkOptions.smartTextOcr && !smartInkOptions.smartMathOcr ? (
                <div className="workbook-session__board-settings-note">
                  В полном режиме без OCR и LaTeX останется только автообработка фигур.
                </div>
              ) : null}
            </>
          ) : null}
        </section>

        {canManageSharedBoardSettings ? (
          <>
            <section className="workbook-session__board-settings-card">
              <div className="workbook-session__board-settings-card-head">
                <div className="workbook-session__board-settings-card-title">
                  <h4>
                    <CropFreeRoundedIcon fontSize="small" />
                    Поле и сетка
                  </h4>
                  <span className="workbook-session__board-settings-scope">Общее</span>
                </div>
                <p>Эти параметры автоматически синхронизируются у всех участников сессии.</p>
              </div>
              <TextField
                size="small"
                label="Название доски"
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
              <div className="workbook-session__board-settings-field">
                <div className="workbook-session__board-settings-field-main">
                  <strong>Размер сетки</strong>
                  <small>Плотность рабочей разметки на полотне.</small>
                </div>
                <div className="workbook-session__board-settings-range">
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
              <div className="workbook-session__board-settings-color-grid">
                <div className="workbook-session__board-settings-color-field">
                  <span>Фон доски</span>
                  <label>
                    <input
                      type="color"
                      value={sharedBoardSettings.backgroundColor}
                      onChange={(event) =>
                        onSharedBoardSettingsChange({
                          backgroundColor: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="workbook-session__board-settings-color-field">
                  <span>Цвет сетки</span>
                  <label>
                    <input
                      type="color"
                      value={
                        sharedBoardSettings.gridColor.startsWith("#")
                          ? sharedBoardSettings.gridColor
                          : "#8893be"
                      }
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

            <section className="workbook-session__board-settings-card">
              <div className="workbook-session__board-settings-card-head">
                <div className="workbook-session__board-settings-card-title">
                  <h4>
                    <MenuRoundedIcon fontSize="small" />
                    Страницы и секции
                  </h4>
                  <span className="workbook-session__board-settings-scope">Общее</span>
                </div>
                <p>Структура страниц синхронизируется автоматически и не требует отдельного сохранения.</p>
              </div>
              <div className="workbook-session__board-settings-field">
                <div className="workbook-session__board-settings-field-main">
                  <strong>Нумерация страниц</strong>
                  <small>Показывать текущую страницу на полотне.</small>
                </div>
                <Switch
                  checked={sharedBoardSettings.showPageNumbers}
                  className="workbook-session__board-settings-switch"
                  onChange={(event) =>
                    onSharedBoardSettingsChange({
                      showPageNumbers: event.target.checked,
                    })
                  }
                />
              </div>
              <div className="workbook-session__board-settings-two-cols">
                <label className="workbook-session__board-settings-number-field">
                  <span>Текущая страница</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, sharedBoardSettings.pagesCount)}
                    value={sharedBoardSettings.currentPage}
                    onChange={(event) => {
                      const nextPage = Math.max(1, Number(event.target.value) || 1);
                      onSharedBoardSettingsChange({
                        currentPage: Math.min(nextPage, Math.max(1, sharedBoardSettings.pagesCount)),
                      });
                    }}
                  />
                </label>
                <label className="workbook-session__board-settings-number-field">
                  <span>Всего страниц</span>
                  <input
                    type="number"
                    min={1}
                    value={sharedBoardSettings.pagesCount}
                    onChange={(event) => {
                      const nextPagesCount = Math.max(1, Number(event.target.value) || 1);
                      onSharedBoardSettingsChange({
                        pagesCount: nextPagesCount,
                        currentPage: Math.min(sharedBoardSettings.currentPage, nextPagesCount),
                      });
                    }}
                  />
                </label>
              </div>
              <div className="workbook-session__board-settings-field">
                <div className="workbook-session__board-settings-field-main">
                  <strong>Авторазделители</strong>
                  <small>Автоматическое деление длинного полотна на секции тетради.</small>
                </div>
                <Switch
                  checked={sharedBoardSettings.autoSectionDividers}
                  className="workbook-session__board-settings-switch"
                  onChange={(event) =>
                    onSharedBoardSettingsChange({
                      autoSectionDividers: event.target.checked,
                    })
                  }
                />
              </div>
              <label className="workbook-session__board-settings-number-field">
                <span>Шаг разделителей</span>
                <input
                  type="number"
                  min={320}
                  max={2400}
                  value={sharedBoardSettings.dividerStep}
                  onChange={(event) =>
                    onSharedBoardSettingsChange({
                      dividerStep: Math.max(320, Number(event.target.value) || 320),
                    })
                  }
                />
              </label>
            </section>
          </>
        ) : (
          <section className="workbook-session__board-settings-card workbook-session__board-settings-card--muted">
            <div className="workbook-session__board-settings-card-head">
              <div className="workbook-session__board-settings-card-title">
                <h4>
                  <MenuRoundedIcon fontSize="small" />
                  Общие настройки
                </h4>
                <span className="workbook-session__board-settings-scope">Только преподаватель</span>
              </div>
              <p>
                Сетка, страницы, фон доски и другие общие параметры меняются только в потоке преподавателя и сразу применяются ко всей сессии.
              </p>
            </div>
            <div className="workbook-session__board-settings-note">
              Если нужен доступ к общей панели, преподаватель должен открыть вам права на работу с доской в блоке «Участники».
            </div>
          </section>
        )}
      </div>
    </div>
  );
});
