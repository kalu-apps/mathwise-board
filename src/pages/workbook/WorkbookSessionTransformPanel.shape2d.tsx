import { useMemo, useState } from "react";
import { IconButton, MenuItem, Switch, TextField } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  SHAPE_ANGLE_MARK_STYLE_OPTIONS,
  type WorkbookShapeAngleMarkStyle,
} from "@/features/workbook/model/shapeAngleMarks";
import {
  WORKBOOK_BOARD_PRIMARY_COLOR,
  WORKBOOK_SYSTEM_COLORS,
} from "@/features/workbook/model/workbookVisualColors";
import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";

type WorkbookSessionTransformPanelShape2dProps = Pick<
  WorkbookSessionTransformPanelProps,
  | "selectedShape2dObject"
  | "shape2dInspectorTab"
  | "setShape2dInspectorTab"
  | "selectedShape2dHasAngles"
  | "selectedShape2dShowAngles"
  | "selectedShape2dLabels"
  | "selectedShape2dSegments"
  | "selectedShape2dAngleMarks"
  | "shapeVertexLabelDrafts"
  | "setShapeVertexLabelDrafts"
  | "shapeAngleNoteDrafts"
  | "setShapeAngleNoteDrafts"
  | "shapeSegmentNoteDrafts"
  | "setShapeSegmentNoteDrafts"
  | "shape2dStrokeWidthDraft"
  | "setShape2dStrokeWidthDraft"
  | "selectedShape2dVertexColors"
  | "selectedShape2dAngleColors"
  | "selectedShape2dSegmentColors"
  | "canToggleSelectedObjectLabels"
  | "selectedObjectShowLabels"
  | "onUpdateSelectedObjectMeta"
  | "onUpdateSelectedShape2dMeta"
  | "onUpdateSelectedShape2dObject"
  | "onCommitSelectedShape2dStrokeWidth"
  | "onRenameSelectedShape2dVertex"
  | "onScheduleSelectedShape2dAngleDraftCommit"
  | "onFlushSelectedShape2dAngleDraftCommit"
  | "onUpdateSelectedShape2dAngleStyle"
  | "onScheduleSelectedShape2dSegmentDraftCommit"
  | "onFlushSelectedShape2dSegmentDraftCommit"
  | "onUpdateSelectedShape2dVertexColor"
  | "onUpdateSelectedShape2dAngleColor"
  | "onUpdateSelectedShape2dSegmentColor"
>;

export function WorkbookSessionTransformPanelShape2d({
  selectedShape2dObject,
  shape2dInspectorTab,
  setShape2dInspectorTab,
  selectedShape2dHasAngles,
  selectedShape2dShowAngles,
  selectedShape2dLabels,
  selectedShape2dSegments,
  selectedShape2dAngleMarks,
  shapeVertexLabelDrafts,
  setShapeVertexLabelDrafts,
  shapeAngleNoteDrafts,
  setShapeAngleNoteDrafts,
  shapeSegmentNoteDrafts,
  setShapeSegmentNoteDrafts,
  shape2dStrokeWidthDraft,
  setShape2dStrokeWidthDraft,
  selectedShape2dVertexColors,
  selectedShape2dAngleColors,
  selectedShape2dSegmentColors,
  canToggleSelectedObjectLabels,
  selectedObjectShowLabels,
  onUpdateSelectedObjectMeta,
  onUpdateSelectedShape2dMeta,
  onUpdateSelectedShape2dObject,
  onCommitSelectedShape2dStrokeWidth,
  onRenameSelectedShape2dVertex,
  onScheduleSelectedShape2dAngleDraftCommit,
  onFlushSelectedShape2dAngleDraftCommit,
  onUpdateSelectedShape2dAngleStyle,
  onScheduleSelectedShape2dSegmentDraftCommit,
  onFlushSelectedShape2dSegmentDraftCommit,
  onUpdateSelectedShape2dVertexColor,
  onUpdateSelectedShape2dAngleColor,
  onUpdateSelectedShape2dSegmentColor,
}: WorkbookSessionTransformPanelShape2dProps) {
  const [activeShapeAngleKey, setActiveShapeAngleKey] = useState<string | null>(null);
  const isEllipseSelected = selectedShape2dObject?.type === "ellipse";

  const shapeAngleItems = useMemo(
    () =>
      selectedShape2dLabels.map((label, index) => {
        const angleMark = selectedShape2dAngleMarks[index] ?? {
          valueText: "",
          color: selectedShape2dAngleColors[index] ?? WORKBOOK_BOARD_PRIMARY_COLOR,
          style: "arc_single" as const,
        };
        return {
          key: `${selectedShape2dObject?.id ?? "shape"}:${index}`,
          index,
          label,
          angleMark,
        };
      }),
    [
      selectedShape2dAngleColors,
      selectedShape2dAngleMarks,
      selectedShape2dLabels,
      selectedShape2dObject?.id,
    ]
  );

  const activeShapeAngleItem =
    shapeAngleItems.find((item) => item.key === activeShapeAngleKey) ?? shapeAngleItems[0] ?? null;
  const shape2dStrokeFallback = selectedShape2dObject?.color || WORKBOOK_BOARD_PRIMARY_COLOR;
  const shape2dFillPickerValue = useMemo(() => {
    const rawFill =
      typeof selectedShape2dObject?.fill === "string"
        ? selectedShape2dObject.fill.trim()
        : "";
    if (/^#[0-9a-fA-F]{6}$/.test(rawFill)) return rawFill;
    if (/^#[0-9a-fA-F]{3}$/.test(rawFill)) {
      const [r, g, b] = rawFill.slice(1).split("");
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return WORKBOOK_SYSTEM_COLORS.white;
  }, [selectedShape2dObject]);

  if (!selectedShape2dObject) {
    return null;
  }

  return (
    <div className="workbook-session__solid-inspector">
      <div className="workbook-session__solid-subtabs">
        <button
          type="button"
          className={shape2dInspectorTab === "display" ? "is-active" : ""}
          onClick={() => setShape2dInspectorTab("display")}
        >
          Вид
        </button>
        {!isEllipseSelected ? (
          <button
            type="button"
            className={shape2dInspectorTab === "vertices" ? "is-active" : ""}
            onClick={() => setShape2dInspectorTab("vertices")}
          >
            Вершины
          </button>
        ) : null}
        {!isEllipseSelected && selectedShape2dHasAngles ? (
          <button
            type="button"
            className={shape2dInspectorTab === "angles" ? "is-active" : ""}
            onClick={() => setShape2dInspectorTab("angles")}
          >
            Углы
          </button>
        ) : null}
        {!isEllipseSelected ? (
          <button
            type="button"
            className={shape2dInspectorTab === "segments" ? "is-active" : ""}
            onClick={() => setShape2dInspectorTab("segments")}
          >
            Отрезки
          </button>
        ) : null}
      </div>
      <div className="workbook-session__solid-card-list workbook-session__solid-card-list--figure">
        {shape2dInspectorTab === "display" ? (
          <article className="workbook-session__solid-card">
            <div className="workbook-session__solid-card-head">
              <span className="workbook-session__solid-card-title">Фигура</span>
            </div>
            <div className="workbook-session__settings-row">
              <span>Толщина контура</span>
              <div className="workbook-session__line-range">
                <input
                  type="range"
                  min={1}
                  max={18}
                  step={1}
                  value={shape2dStrokeWidthDraft}
                  onChange={(event) => {
                    const nextWidth = Math.max(1, Math.min(18, Number(event.target.value) || 1));
                    setShape2dStrokeWidthDraft(nextWidth);
                    void onUpdateSelectedShape2dObject({ strokeWidth: nextWidth });
                  }}
                  onMouseUp={() => void onCommitSelectedShape2dStrokeWidth()}
                  onTouchEnd={() => void onCommitSelectedShape2dStrokeWidth()}
                  onBlur={() => void onCommitSelectedShape2dStrokeWidth()}
                />
              </div>
            </div>
            <div className="workbook-session__settings-row">
              <span>Цвет контура</span>
              <div className="workbook-session__color-control">
                <input
                  type="color"
                  className="workbook-session__solid-color"
                  value={selectedShape2dObject.color || WORKBOOK_BOARD_PRIMARY_COLOR}
                  onChange={(event) =>
                    void onUpdateSelectedShape2dObject({
                      color: event.target.value || WORKBOOK_BOARD_PRIMARY_COLOR,
                    })
                  }
                />
                <IconButton
                  size="small"
                  className="workbook-session__color-reset-btn"
                  aria-label="Сбросить цвет контура"
                  onClick={() =>
                    void onUpdateSelectedShape2dObject({
                      color: WORKBOOK_BOARD_PRIMARY_COLOR,
                    })
                  }
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
            <div className="workbook-session__settings-row">
              <span>Заливка фигуры</span>
              <div className="workbook-session__color-control">
                <input
                  type="color"
                  className="workbook-session__solid-color"
                  value={shape2dFillPickerValue}
                  onChange={(event) =>
                    void onUpdateSelectedShape2dObject({
                      fill: event.target.value || WORKBOOK_SYSTEM_COLORS.white,
                    })
                  }
                />
                <IconButton
                  size="small"
                  className="workbook-session__color-reset-btn"
                  aria-label="Сбросить цвет заливки фигуры"
                  onClick={() =>
                    void onUpdateSelectedShape2dObject({
                      fill: WORKBOOK_SYSTEM_COLORS.white,
                    })
                  }
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          </article>
        ) : null}

        {shape2dInspectorTab === "vertices" ? (
          <article className="workbook-session__solid-card">
            <div className="workbook-session__solid-card-head">
              <span className="workbook-session__solid-card-title">Вершины</span>
            </div>
            {canToggleSelectedObjectLabels ? (
              <div className="workbook-session__solid-card-row">
                <span>Показывать названия вершин</span>
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
            <div className="workbook-session__solid-points">
              {selectedShape2dLabels.map((label, index) => (
                <div
                  key={`shape-vertex-${selectedShape2dObject.id}-${index}`}
                  className="workbook-session__solid-point-row"
                >
                  <TextField
                    size="small"
                    className="workbook-session__solid-input workbook-session__solid-input--compact"
                    placeholder={`Вершина ${label}`}
                    inputProps={{ "aria-label": `Название вершины ${label}` }}
                    value={shapeVertexLabelDrafts[index] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value.slice(0, 12);
                      setShapeVertexLabelDrafts((current) => {
                        const next = [...current];
                        next[index] = nextValue;
                        return next;
                      });
                      void onRenameSelectedShape2dVertex(index, nextValue);
                    }}
                    onBlur={() =>
                      void onRenameSelectedShape2dVertex(index, shapeVertexLabelDrafts[index] ?? "")
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.currentTarget.blur();
                    }}
                  />
                  <div className="workbook-session__color-control">
                    <input
                      type="color"
                      className="workbook-session__solid-color"
                      value={selectedShape2dVertexColors[index] ?? WORKBOOK_BOARD_PRIMARY_COLOR}
                      onChange={(event) =>
                        void onUpdateSelectedShape2dVertexColor(index, event.target.value)
                      }
                    />
                    <IconButton
                      size="small"
                      className="workbook-session__color-reset-btn"
                      aria-label={`Сбросить цвет вершины ${label}`}
                      onClick={() =>
                        void onUpdateSelectedShape2dVertexColor(index, shape2dStrokeFallback)
                      }
                    >
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}

        {shape2dInspectorTab === "angles" && selectedShape2dHasAngles ? (
          <article className="workbook-session__solid-card">
            <div className="workbook-session__solid-card-head">
              <span className="workbook-session__solid-card-title">Углы</span>
            </div>
            <div className="workbook-session__solid-card-row">
              <span>Показывать углы</span>
              <Switch
                size="small"
                checked={selectedShape2dShowAngles}
                onChange={(event) =>
                  void onUpdateSelectedShape2dMeta({
                    showAngles: event.target.checked,
                  })
                }
              />
            </div>
            <p className="workbook-session__hint">
              По умолчанию углы обозначаются одной дугой. При необходимости меняйте тип
              обозначения отдельно для каждого угла.
            </p>
            {selectedShape2dHasAngles ? (
              <div className="workbook-session__shape-angle-inspector">
                <div className="workbook-session__shape-angle-tabs">
                  {shapeAngleItems.map((item) => (
                    <button
                      key={`shape-angle-tab-${selectedShape2dObject.id}-${item.index}`}
                      type="button"
                      className={activeShapeAngleItem?.key === item.key ? "is-active" : ""}
                      onClick={() => setActiveShapeAngleKey(item.key)}
                    >
                      <span>∠{item.label}</span>
                    </button>
                  ))}
                </div>
                {activeShapeAngleItem ? (
                  <article className="workbook-session__shape-angle-card">
                    <div className="workbook-session__shape-angle-head">
                      <div className="workbook-session__shape-angle-meta">
                        <span className="workbook-session__shape-angle-badge">
                          ∠{activeShapeAngleItem.label}
                        </span>
                      </div>
                      <div className="workbook-session__color-control">
                        <input
                          type="color"
                          className="workbook-session__solid-color workbook-session__shape-angle-color"
                          value={
                            selectedShape2dAngleColors[activeShapeAngleItem.index] ??
                            WORKBOOK_BOARD_PRIMARY_COLOR
                          }
                          onChange={(event) =>
                            void onUpdateSelectedShape2dAngleColor(
                              activeShapeAngleItem.index,
                              event.target.value
                            )
                          }
                        />
                        <IconButton
                          size="small"
                          className="workbook-session__color-reset-btn"
                          aria-label={`Сбросить цвет угла ${activeShapeAngleItem.label}`}
                          onClick={() =>
                            void onUpdateSelectedShape2dAngleColor(
                              activeShapeAngleItem.index,
                              shape2dStrokeFallback
                            )
                          }
                        >
                          <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </div>
                    <div className="workbook-session__shape-angle-fields">
                      <TextField
                        size="small"
                        className="workbook-session__solid-input workbook-session__shape-angle-field"
                        placeholder="Например: 45"
                        inputProps={{ "aria-label": "Значение угла" }}
                        value={shapeAngleNoteDrafts[activeShapeAngleItem.index] ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value.slice(0, 24);
                          setShapeAngleNoteDrafts((current) => {
                            const next = [...current];
                            next[activeShapeAngleItem.index] = nextValue;
                            return next;
                          });
                          onScheduleSelectedShape2dAngleDraftCommit(activeShapeAngleItem.index, nextValue);
                        }}
                        onBlur={() =>
                          void onFlushSelectedShape2dAngleDraftCommit(
                            activeShapeAngleItem.index,
                            shapeAngleNoteDrafts[activeShapeAngleItem.index] ?? ""
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.currentTarget.blur();
                        }}
                      />
                      <TextField
                        select
                        size="small"
                        className="workbook-session__solid-input workbook-session__shape-angle-field"
                        SelectProps={{
                          inputProps: { "aria-label": "Обозначение угла" },
                        }}
                        value={activeShapeAngleItem.angleMark.style}
                        onChange={(event) =>
                          void onUpdateSelectedShape2dAngleStyle(
                            activeShapeAngleItem.index,
                            event.target.value as WorkbookShapeAngleMarkStyle
                          )
                        }
                      >
                        {SHAPE_ANGLE_MARK_STYLE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.preview} {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </div>
                  </article>
                ) : null}
              </div>
            ) : (
              <p className="workbook-session__hint">У выбранного объекта нет углов.</p>
            )}
          </article>
        ) : null}

        {shape2dInspectorTab === "segments" ? (
          <article className="workbook-session__solid-card">
            <div className="workbook-session__solid-card-head">
              <span className="workbook-session__solid-card-title">Отрезки</span>
            </div>
            <div className="workbook-session__solid-points">
              {selectedShape2dSegments.map((segment, index) => (
                <div
                  key={`shape-segment-note-${selectedShape2dObject.id}-${index}`}
                  className="workbook-session__solid-point-row"
                >
                  <span className="workbook-session__shape-angle-badge workbook-session__shape-angle-badge--segment">
                    {segment}
                  </span>
                  <TextField
                    size="small"
                    className="workbook-session__solid-input workbook-session__solid-input--compact"
                    placeholder="Например: 5"
                    inputProps={{ "aria-label": `Значение отрезка ${segment}` }}
                    value={shapeSegmentNoteDrafts[index] ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value.slice(0, 24);
                      setShapeSegmentNoteDrafts((current) => {
                        const next = [...current];
                        next[index] = nextValue;
                        return next;
                      });
                      onScheduleSelectedShape2dSegmentDraftCommit(index, nextValue);
                    }}
                    onBlur={() =>
                      void onFlushSelectedShape2dSegmentDraftCommit(
                        index,
                        shapeSegmentNoteDrafts[index] ?? ""
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.currentTarget.blur();
                    }}
                  />
                  <div className="workbook-session__color-control">
                    <input
                      type="color"
                      className="workbook-session__solid-color"
                      value={selectedShape2dSegmentColors[index] ?? WORKBOOK_BOARD_PRIMARY_COLOR}
                      onChange={(event) =>
                        void onUpdateSelectedShape2dSegmentColor(index, event.target.value)
                      }
                    />
                    <IconButton
                      size="small"
                      className="workbook-session__color-reset-btn"
                      aria-label={`Сбросить цвет отрезка ${segment}`}
                      onClick={() =>
                        void onUpdateSelectedShape2dSegmentColor(index, shape2dStrokeFallback)
                      }
                    >
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
