import { memo, type Dispatch, type SetStateAction } from "react";
import { Button, Select, Switch, TextField } from "@mui/material";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SaveAltRoundedIcon from "@mui/icons-material/SaveAltRounded";
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
  boardSettings: WorkbookBoardSettings;
  setBoardSettings: Dispatch<SetStateAction<WorkbookBoardSettings>>;
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
  canSave: boolean;
  onSave: (patch: Partial<WorkbookBoardSettings>) => void | Promise<void>;
};

export const WorkbookSessionBoardSettingsPanel = memo(function WorkbookSessionBoardSettingsPanel({
  boardSettings,
  setBoardSettings,
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
  canSave,
  onSave,
}: WorkbookSessionBoardSettingsPanelProps) {
  return (
    <div className="workbook-session__card workbook-session__board-settings">
      <div className="workbook-session__board-settings-head">
        <h3>Системные настройки доски</h3>
        <p>Настройте распознавание, разметку поля и структуру страниц.</p>
      </div>
      <div className="workbook-session__board-settings-grid">
        <section className="workbook-session__board-settings-card">
          <div className="workbook-session__board-settings-card-head">
            <h4>
              <AutoFixHighRoundedIcon fontSize="small" />
              Smart Ink
            </h4>
            <p>Автообработка рукописи, фигур и формул в реальном времени.</p>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Режим распознавания</strong>
              <small>Off / Basic / Full</small>
            </div>
            <Select
              native
              size="small"
              className="workbook-session__board-settings-select"
              value={smartInkOptions.mode}
              onChange={(event) =>
                setSmartInkOptions((current) =>
                  normalizeSmartInkOptions({
                    ...current,
                    mode:
                      event.target.value === "off" ||
                      event.target.value === "basic" ||
                      event.target.value === "full"
                        ? event.target.value
                        : current.mode,
                  })
                )
              }
            >
              <option value="off">Выкл.</option>
              <option value="basic">Basic</option>
              <option value="full">Full</option>
            </Select>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Порог уверенности</strong>
              <small>Чем выше, тем меньше ложных замен.</small>
            </div>
            <div className="workbook-session__board-settings-range">
              <input
                type="range"
                min={0.35}
                max={0.98}
                step={0.01}
                value={smartInkOptions.confidenceThreshold}
                onChange={(event) =>
                  setSmartInkOptions((current) =>
                    normalizeSmartInkOptions({
                      ...current,
                      confidenceThreshold: Number(event.target.value),
                    })
                  )
                }
              />
              <span className="workbook-session__board-settings-range-value">
                {Math.round(smartInkOptions.confidenceThreshold * 100)}%
              </span>
            </div>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>SmartShapes</strong>
              <small>Выравнивание рукописных фигур.</small>
            </div>
            <Switch
              size="small"
              className="workbook-session__board-settings-switch"
              checked={smartInkOptions.smartShapes}
              disabled={smartInkOptions.mode === "off"}
              onChange={(event) =>
                setSmartInkOptions((current) =>
                  normalizeSmartInkOptions({
                    ...current,
                    smartShapes: event.target.checked,
                  })
                )
              }
            />
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>OCR + LaTeX</strong>
              <small>Распознавание текста и математических формул.</small>
            </div>
            <Switch
              size="small"
              className="workbook-session__board-settings-switch"
              checked={smartInkOptions.smartTextOcr || smartInkOptions.smartMathOcr}
              disabled={smartInkOptions.mode !== "full"}
              onChange={(event) =>
                setSmartInkOptions((current) =>
                  normalizeSmartInkOptions({
                    ...current,
                    smartTextOcr: event.target.checked,
                    smartMathOcr: event.target.checked,
                  })
                )
              }
            />
          </div>
        </section>

        <section className="workbook-session__board-settings-card">
          <div className="workbook-session__board-settings-card-head">
            <h4>
              <BrushRoundedIcon fontSize="small" />
              Инструменты письма
            </h4>
            <p>Толщина и цвет ручки, маркера и ластика управляются явно и без скрытых жестов.</p>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Ручка</strong>
              <small>Базовый цвет и толщина штриха.</small>
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
              <small>Радиус стирания настраивается здесь и применяется ко всему полотну.</small>
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
            <h4>
              <CropFreeRoundedIcon fontSize="small" />
              Поле и сетка
            </h4>
            <p>Визуальные параметры доски и точность позиционирования объектов.</p>
          </div>
          <TextField
            size="small"
            label="Название доски"
            className="workbook-session__board-settings-text"
            value={boardSettings.title}
            onChange={(event) =>
              setBoardSettings((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Показывать сетку</strong>
              <small>Фоновая разметка для построений.</small>
            </div>
            <Switch
              checked={boardSettings.showGrid}
              className="workbook-session__board-settings-switch"
              onChange={(event) =>
                setBoardSettings((current) => ({
                  ...current,
                  showGrid: event.target.checked,
                }))
              }
            />
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Привязка к сетке</strong>
              <small>Снап для фигур и точек.</small>
            </div>
            <Switch
              checked={boardSettings.snapToGrid}
              className="workbook-session__board-settings-switch"
              onChange={(event) =>
                setBoardSettings((current) => ({
                  ...current,
                  snapToGrid: event.target.checked,
                }))
              }
            />
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Размер сетки</strong>
              <small>Плотность рабочей разметки.</small>
            </div>
            <div className="workbook-session__board-settings-range">
              <input
                type="range"
                min={8}
                max={96}
                value={boardSettings.gridSize}
                onChange={(event) =>
                  setBoardSettings((current) => ({
                    ...current,
                    gridSize: Number(event.target.value),
                  }))
                }
              />
              <span className="workbook-session__board-settings-range-value">
                {Math.round(boardSettings.gridSize)}
              </span>
            </div>
          </div>
          <div className="workbook-session__board-settings-color-grid">
            <div className="workbook-session__board-settings-color-field">
              <span>Фон доски</span>
              <label>
                <input
                  type="color"
                  value={boardSettings.backgroundColor}
                  onChange={(event) =>
                    setBoardSettings((current) => ({
                      ...current,
                      backgroundColor: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="workbook-session__board-settings-color-field">
              <span>Цвет сетки</span>
              <label>
                <input
                  type="color"
                  value={boardSettings.gridColor.startsWith("#") ? boardSettings.gridColor : "#8893be"}
                  onChange={(event) =>
                    setBoardSettings((current) => ({
                      ...current,
                      gridColor: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>
        </section>

        <section className="workbook-session__board-settings-card">
          <div className="workbook-session__board-settings-card-head">
            <h4>
              <MenuRoundedIcon fontSize="small" />
              Страницы и секции
            </h4>
            <p>Управление страницами и автоматическими разделителями тетради.</p>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Нумерация страниц</strong>
              <small>Показывать текущий номер страницы на полотне.</small>
            </div>
            <Switch
              checked={boardSettings.showPageNumbers}
              className="workbook-session__board-settings-switch"
              onChange={(event) =>
                setBoardSettings((current) => ({
                  ...current,
                  showPageNumbers: event.target.checked,
                }))
              }
            />
          </div>
          <div className="workbook-session__board-settings-two-cols">
            <label className="workbook-session__board-settings-number-field">
              <span>Страница</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, boardSettings.pagesCount)}
                value={boardSettings.currentPage}
                onChange={(event) =>
                  setBoardSettings((current) => ({
                    ...current,
                    currentPage: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
            </label>
            <label className="workbook-session__board-settings-number-field">
              <span>Всего страниц</span>
              <input
                type="number"
                min={1}
                value={boardSettings.pagesCount}
                onChange={(event) =>
                  setBoardSettings((current) => ({
                    ...current,
                    pagesCount: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
            </label>
          </div>
          <div className="workbook-session__board-settings-field">
            <div className="workbook-session__board-settings-field-main">
              <strong>Авторазделители</strong>
              <small>Автоматическое деление длинного полотна на секции.</small>
            </div>
            <Switch
              checked={boardSettings.autoSectionDividers}
              className="workbook-session__board-settings-switch"
              onChange={(event) =>
                setBoardSettings((current) => ({
                  ...current,
                  autoSectionDividers: event.target.checked,
                }))
              }
            />
          </div>
          <label className="workbook-session__board-settings-number-field">
            <span>Шаг разделителей</span>
            <input
              type="number"
              min={320}
              max={2400}
              value={boardSettings.dividerStep}
              onChange={(event) =>
                setBoardSettings((current) => ({
                  ...current,
                  dividerStep: Math.max(320, Number(event.target.value) || 320),
                }))
              }
            />
          </label>
        </section>
      </div>
      <div className="workbook-session__board-settings-footer">
        <Button
          variant="contained"
          onClick={() => void onSave(boardSettings)}
          startIcon={<SaveAltRoundedIcon />}
          disabled={!canSave}
        >
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
});
