import { memo, type Dispatch, type SetStateAction } from "react";
import { Select, Switch, TextField, useMediaQuery } from "@mui/material";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BrushRoundedIcon from "@mui/icons-material/BrushRounded";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
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

export type WorkbookBoardPageOption = {
  page: number;
  hasContent: boolean;
  label: string;
};

export type WorkbookSessionBoardSettingsPanelProps = {
  sharedBoardSettings: WorkbookBoardSettings;
  onSharedBoardSettingsChange: (patch: Partial<WorkbookBoardSettings>) => void;
  pageOptions: WorkbookBoardPageOption[];
  onSelectBoardPage: (page: number) => void;
  onAddBoardPage: () => void;
  onDeleteBoardPage: (page: number) => void;
  isBoardPageMutationPending?: boolean;
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
  pageOptions,
  onSelectBoardPage,
  onAddBoardPage,
  onDeleteBoardPage,
  isBoardPageMutationPending = false,
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
  const isCompactViewport = useMediaQuery("(max-width: 760px)");
  const updateSmartInk = (patch: Partial<SmartInkOptions>) => {
    setSmartInkOptions((current) =>
      normalizeSmartInkOptions({
        ...current,
        ...patch,
      })
    );
  };
  const safePageOptions =
    pageOptions.length > 0
      ? pageOptions
      : [
          {
            page: Math.max(1, Math.round(sharedBoardSettings.currentPage || 1)),
            hasContent: false,
            label: "Страница 1",
          },
        ];
  const safeCurrentPage = Math.max(1, Math.round(sharedBoardSettings.currentPage || 1));
  const currentPageOptionExists = safePageOptions.some((option) => option.page === safeCurrentPage);
  const selectedPage = currentPageOptionExists ? safeCurrentPage : safePageOptions[0]?.page ?? 1;
  const totalPages = Math.max(
    1,
    Math.round(sharedBoardSettings.pagesCount || 1),
    safePageOptions[safePageOptions.length - 1]?.page ?? 1
  );
  const pagesWithContent = safePageOptions.reduce(
    (count, option) => count + (option.hasContent ? 1 : 0),
    0
  );
  const canMutatePages = canManageSharedBoardSettings && !isBoardPageMutationPending;

  return (
    <div className="workbook-session__card workbook-session__board-settings">
      <div className="workbook-session__board-settings-head">
        <h3>Настройки доски</h3>
        <p>
          {canManageSharedBoardSettings
            ? isCompactViewport
              ? "Личные настройки применяются только у вас, общие синхронизируются у всех."
              : "Личные настройки письма сохраняются автоматически только для вас, а общие параметры доски синхронно обновляются у всех участников."
            : isCompactViewport
              ? "Здесь доступны только личные настройки письма и Smart Ink."
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
            </div>
            <p>
              По умолчанию ручка работает как перо. Smart Ink включается только вручную и действует
              только на ваши новые штрихи.
            </p>
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
              {smartInkOptions.mode === "full" ? (
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
              ) : (
                <div className="workbook-session__board-settings-note">
                  В режиме «Только фигуры» выравнивание фигур всегда включено.
                </div>
              )}
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
                    Страницы
                  </h4>
                </div>
                <p>
                  Управляйте страницами доски в одном месте: переключение, добавление и удаление
                  с синхронизацией для всех участников.
                </p>
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
              <div className="workbook-session__board-settings-page-panel">
                <div className="workbook-session__board-settings-page-main">
                  <strong>Текущая страница</strong>
                  <small>Выберите страницу из списка, затем добавьте новую или удалите активную.</small>
                </div>
                <div className="workbook-session__board-settings-page-actions">
                  <Select
                    native
                    size="small"
                    className="workbook-session__board-settings-select workbook-session__board-settings-page-select"
                    value={selectedPage}
                    onChange={(event) => {
                      const nextPage = Math.max(1, Number(event.target.value) || 1);
                      onSelectBoardPage(nextPage);
                    }}
                    disabled={!canMutatePages}
                  >
                    {safePageOptions.map((option) => (
                      <option key={option.page} value={option.page}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className="workbook-session__board-settings-page-btn is-add"
                    onClick={() => onAddBoardPage()}
                    disabled={!canMutatePages}
                    title="Добавить страницу"
                    aria-label="Добавить страницу"
                  >
                    <AddRoundedIcon fontSize="small" />
                  </button>
                  <button
                    type="button"
                    className="workbook-session__board-settings-page-btn is-danger"
                    onClick={() => onDeleteBoardPage(selectedPage)}
                    disabled={!canMutatePages || totalPages <= 1}
                    title="Удалить текущую страницу"
                    aria-label="Удалить текущую страницу"
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </button>
                </div>
              </div>
              <div className="workbook-session__board-settings-page-meta">
                <span>Всего страниц: {totalPages}</span>
                <span>Страниц с контентом: {pagesWithContent}</span>
              </div>
              <div className="workbook-session__board-settings-note">
                При удалении страницы ее объекты и штрихи удаляются, а все последующие страницы
                автоматически сдвигаются на один шаг вверх.
              </div>
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
