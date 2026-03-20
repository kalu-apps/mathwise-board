import type { Dispatch, SetStateAction } from "react";
import { Popover, Select } from "@mui/material";
import type { SmartInkOptions } from "./workbookBoardSettingsModel";
import { normalizeSmartInkOptions } from "./workbookBoardSettingsModel";

export type WorkbookToolSettingsPopoverTool = "pen" | "highlighter" | "eraser";

export type WorkbookToolSettingsPopoverState = {
  tool: WorkbookToolSettingsPopoverTool;
  x: number;
  y: number;
} | null;

type ToolPaintSettings = {
  color: string;
  width: number;
};

type WorkbookSessionToolSettingsPopoverProps = {
  state: WorkbookToolSettingsPopoverState;
  onClose: () => void;
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  eraserRadius: number;
  eraserRadiusMin: number;
  eraserRadiusMax: number;
  smartInkOptions: SmartInkOptions;
  setSmartInkOptions: Dispatch<SetStateAction<SmartInkOptions>>;
  onPenToolSettingsChange: (patch: Partial<ToolPaintSettings>) => void;
  onHighlighterToolSettingsChange: (patch: Partial<ToolPaintSettings>) => void;
  onEraserRadiusChange: (value: number) => void;
};

const TOOL_TITLES: Record<WorkbookToolSettingsPopoverTool, string> = {
  pen: "Ручка",
  highlighter: "Маркер",
  eraser: "Ластик",
};

export function WorkbookSessionToolSettingsPopover({
  state,
  onClose,
  penToolSettings,
  highlighterToolSettings,
  eraserRadius,
  eraserRadiusMin,
  eraserRadiusMax,
  smartInkOptions,
  setSmartInkOptions,
  onPenToolSettingsChange,
  onHighlighterToolSettingsChange,
  onEraserRadiusChange,
}: WorkbookSessionToolSettingsPopoverProps) {
  const updateSmartInk = (patch: Partial<SmartInkOptions>) => {
    setSmartInkOptions((current) =>
      normalizeSmartInkOptions({
        ...current,
        ...patch,
      })
    );
  };

  const tool = state?.tool ?? null;

  return (
    <Popover
      open={Boolean(state)}
      onClose={onClose}
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      anchorReference="anchorPosition"
      anchorPosition={state ? { top: state.y, left: state.x } : undefined}
      anchorOrigin={{ vertical: "top", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      PaperProps={{
        className: "workbook-session__tool-settings-popover",
      }}
    >
      {tool ? (
        <div className="workbook-session__tool-settings-panel">
          <div className="workbook-session__tool-settings-head">
            <h4>{TOOL_TITLES[tool]}</h4>
            <p>Настройки этого инструмента</p>
          </div>

          {tool === "pen" ? (
            <>
              <div className="workbook-session__tool-settings-field">
                <div className="workbook-session__tool-settings-field-main">
                  <strong>Цвет</strong>
                </div>
                <label className="workbook-session__tool-settings-color">
                  <input
                    type="color"
                    value={penToolSettings.color}
                    onChange={(event) =>
                      onPenToolSettingsChange({ color: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="workbook-session__tool-settings-field">
                <div className="workbook-session__tool-settings-field-main">
                  <strong>Толщина</strong>
                </div>
                <div className="workbook-session__tool-settings-range">
                  <input
                    type="range"
                    min={1}
                    max={18}
                    value={penToolSettings.width}
                    onChange={(event) =>
                      onPenToolSettingsChange({ width: Number(event.target.value) })
                    }
                  />
                  <span>{penToolSettings.width} px</span>
                </div>
              </div>

              <div className="workbook-session__tool-settings-field">
                <div className="workbook-session__tool-settings-field-main">
                  <strong>Умная ручка</strong>
                </div>
                <Select
                  native
                  size="small"
                  className="workbook-session__tool-settings-select"
                  value={smartInkOptions.mode}
                  onChange={(event) =>
                    updateSmartInk({
                      mode:
                        event.target.value === "off" ||
                        event.target.value === "shape" ||
                        event.target.value === "text" ||
                        event.target.value === "formula" ||
                        event.target.value === "auto"
                          ? event.target.value
                          : smartInkOptions.mode,
                    })
                  }
                >
                  <option value="off">Ручка</option>
                  <option value="shape">Фигуры</option>
                  <option value="text">Текст</option>
                  <option value="formula">Формулы</option>
                  <option value="auto">Авто</option>
                </Select>
              </div>

              {smartInkOptions.mode !== "off" ? (
                <div className="workbook-session__tool-settings-field">
                  <div className="workbook-session__tool-settings-field-main">
                    <strong>Порог уверенности</strong>
                  </div>
                  <div className="workbook-session__tool-settings-range">
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
                    <span>{Math.round(smartInkOptions.confidenceThreshold * 100)}%</span>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {tool === "highlighter" ? (
            <>
              <div className="workbook-session__tool-settings-field">
                <div className="workbook-session__tool-settings-field-main">
                  <strong>Цвет</strong>
                </div>
                <label className="workbook-session__tool-settings-color">
                  <input
                    type="color"
                    value={highlighterToolSettings.color}
                    onChange={(event) =>
                      onHighlighterToolSettingsChange({ color: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="workbook-session__tool-settings-field">
                <div className="workbook-session__tool-settings-field-main">
                  <strong>Толщина</strong>
                </div>
                <div className="workbook-session__tool-settings-range">
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
                  <span>{highlighterToolSettings.width} px</span>
                </div>
              </div>
            </>
          ) : null}

          {tool === "eraser" ? (
            <div className="workbook-session__tool-settings-field">
              <div className="workbook-session__tool-settings-field-main">
                <strong>Радиус стирания</strong>
              </div>
              <div className="workbook-session__tool-settings-range">
                <input
                  type="range"
                  min={eraserRadiusMin}
                  max={eraserRadiusMax}
                  value={eraserRadius}
                  onChange={(event) => onEraserRadiusChange(Number(event.target.value))}
                />
                <span>{eraserRadius} px</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Popover>
  );
}
