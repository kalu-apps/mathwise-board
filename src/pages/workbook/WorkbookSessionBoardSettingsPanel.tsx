import { memo } from "react";
import { Switch, TextField, useMediaQuery } from "@mui/material";
import CropFreeRoundedIcon from "@mui/icons-material/CropFreeRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import type { WorkbookBoardSettings } from "@/features/workbook/model/types";

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

export type WorkbookSessionBoardSettingsPanelProps = {
  sharedBoardSettings: WorkbookBoardSettings;
  currentBoardPage: number;
  onSharedBoardSettingsChange: (patch: Partial<WorkbookBoardSettings>) => void;
  pageOptions: WorkbookBoardPageOption[];
  canManageSharedBoardSettings: boolean;
};

export const WorkbookSessionBoardSettingsPanel = memo(function WorkbookSessionBoardSettingsPanel({
  sharedBoardSettings,
  currentBoardPage,
  onSharedBoardSettingsChange,
  pageOptions,
  canManageSharedBoardSettings,
}: WorkbookSessionBoardSettingsPanelProps) {
  const isCompactViewport = useMediaQuery("(max-width: 760px)");
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
                    value={sharedBoardSettings.backgroundColor}
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
                    value={
                      sharedBoardSettings.gridColor.startsWith("#")
                        ? sharedBoardSettings.gridColor
                        : "#6d88ad"
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
      </div>
    </div>
  );
});
