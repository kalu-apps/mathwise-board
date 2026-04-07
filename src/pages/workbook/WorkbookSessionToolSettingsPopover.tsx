import { Popover, Switch } from "@mui/material";

export type WorkbookToolSettingsPopoverTool = "pen" | "highlighter" | "eraser" | "divider";

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
  overlayContainer?: Element | null;
  isFullscreen?: boolean;
  onClose: () => void;
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

const TOOL_TITLES: Record<WorkbookToolSettingsPopoverTool, string> = {
  pen: "Ручка",
  highlighter: "Маркер",
  eraser: "Ластик",
  divider: "Разделитель",
};

export function WorkbookSessionToolSettingsPopover({
  state,
  overlayContainer,
  isFullscreen = false,
  onClose,
  penToolSettings,
  highlighterToolSettings,
  eraserRadius,
  eraserRadiusMin,
  eraserRadiusMax,
  onPenToolSettingsChange,
  onHighlighterToolSettingsChange,
  onEraserRadiusChange,
  dividerColor,
  dividerWidth,
  dividerLineStyle,
  onDividerColorChange,
  onDividerWidthChange,
  onDividerLineStyleChange,
}: WorkbookSessionToolSettingsPopoverProps) {
  const portalContainer =
    typeof document !== "undefined"
      ? isFullscreen
        ? overlayContainer ?? document.body
        : document.body
      : overlayContainer;

  const tool = state?.tool ?? null;

  return (
    <Popover
      container={portalContainer}
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
              <div className="workbook-session__tool-settings-cluster">
                <div className="workbook-session__tool-settings-cluster-title">
                  Цвет и толщина
                </div>
                <div className="workbook-session__tool-settings-split">
                  <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                    <div className="workbook-session__tool-settings-field-main">
                      <strong>Цвет</strong>
                    </div>
                    <label className="workbook-session__tool-settings-color">
                      <input
                        type="color"
                        name="pen-color"
                        value={penToolSettings.color}
                        onChange={(event) =>
                          onPenToolSettingsChange({ color: event.target.value })
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
                        name="pen-width"
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
                </div>
              </div>
            </>
          ) : null}

          {tool === "highlighter" ? (
            <div className="workbook-session__tool-settings-cluster">
              <div className="workbook-session__tool-settings-cluster-title">
                Цвет и толщина
              </div>
              <div className="workbook-session__tool-settings-split">
                <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                  <div className="workbook-session__tool-settings-field-main">
                    <strong>Цвет</strong>
                  </div>
                  <label className="workbook-session__tool-settings-color">
                    <input
                      type="color"
                      name="highlighter-color"
                      value={highlighterToolSettings.color}
                      onChange={(event) =>
                        onHighlighterToolSettingsChange({ color: event.target.value })
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
                      name="highlighter-width"
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
              </div>
            </div>
          ) : null}

          {tool === "eraser" ? (
            <div className="workbook-session__tool-settings-cluster">
              <div className="workbook-session__tool-settings-cluster-title">
                Размер ластика
              </div>
              <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact">
                <div className="workbook-session__tool-settings-field-main">
                  <strong>Радиус</strong>
                </div>
                <div className="workbook-session__tool-settings-range">
                  <input
                    type="range"
                    name="eraser-radius"
                    min={eraserRadiusMin}
                    max={eraserRadiusMax}
                    value={eraserRadius}
                    onChange={(event) => onEraserRadiusChange(Number(event.target.value))}
                  />
                  <span>{eraserRadius} px</span>
                </div>
              </div>
            </div>
          ) : null}

          {tool === "divider" ? (
            <div className="workbook-session__tool-settings-cluster">
              <div className="workbook-session__tool-settings-cluster-title">
                Вид и толщина
              </div>
              <div className="workbook-session__tool-settings-split workbook-session__tool-settings-split--divider">
                <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact workbook-session__tool-settings-field--divider-color">
                  <div className="workbook-session__tool-settings-field-main">
                    <strong>Цвет</strong>
                  </div>
                  <label className="workbook-session__tool-settings-color workbook-session__tool-settings-color--divider">
                    <input
                      type="color"
                      name="divider-color"
                      value={dividerColor}
                      onChange={(event) => onDividerColorChange(event.target.value)}
                    />
                  </label>
                </div>
                <div className="workbook-session__tool-settings-field workbook-session__tool-settings-field--compact workbook-session__tool-settings-field--divider-style">
                  <div className="workbook-session__tool-settings-field-main">
                    <strong>Линия</strong>
                  </div>
                  <label className="workbook-session__tool-settings-divider-switch">
                    <span>Пунктир</span>
                    <Switch
                      size="small"
                      checked={dividerLineStyle === "dashed"}
                      onChange={(event) =>
                        onDividerLineStyleChange(event.target.checked ? "dashed" : "solid")
                      }
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
                    name="divider-width"
                    min={1}
                    max={18}
                    step={1}
                    value={dividerWidth}
                    onChange={(event) => onDividerWidthChange(Number(event.target.value))}
                  />
                  <span>{dividerWidth} px</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Popover>
  );
}
