import { memo } from "react";
import { Button, IconButton, Select, Switch, TextField, Tooltip } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FormatAlignCenterRoundedIcon from "@mui/icons-material/FormatAlignCenterRounded";
import FormatAlignLeftRoundedIcon from "@mui/icons-material/FormatAlignLeftRounded";
import FormatAlignRightRoundedIcon from "@mui/icons-material/FormatAlignRightRounded";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatColorFillRoundedIcon from "@mui/icons-material/FormatColorFillRounded";
import FormatColorTextRoundedIcon from "@mui/icons-material/FormatColorTextRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatUnderlinedRoundedIcon from "@mui/icons-material/FormatUnderlinedRounded";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import { WorkbookSessionTransformPanelShape2d } from "./WorkbookSessionTransformPanel.shape2d";
import { WorkbookSessionTransformPanelSolid3d } from "./WorkbookSessionTransformPanel.solid3d";
import type { WorkbookSessionTransformPanelProps } from "./WorkbookSessionTransformPanel.types";

export const WorkbookSessionTransformPanel = memo(function WorkbookSessionTransformPanel({
  tool,
  canSelect,
  canDelete,
  pointObjectCount,
  eraserRadiusMin,
  eraserRadiusMax,
  strokeWidth,
  onStrokeWidthChange,
  selectedObject,
  selectedObjectLabel,
  canToggleSelectedObjectLabels,
  selectedObjectShowLabels,
  isSelectedObjectInComposition,
  onMirrorSelectedObject,
  onUpdateSelectedObjectMeta,
  onDissolveCompositionLayer,
  onOpenGraphPanel,
  selectedLineObject,
  selectedFunctionGraphObject,
  selectedDividerObject,
  selectedPointObject,
  selectedTextObject,
  selectedShape2dObject,
  textFontOptions,
  selectedTextDraft,
  setSelectedTextDraft,
  onScheduleSelectedTextDraftCommit,
  onFlushSelectedTextDraftCommit,
  selectedTextFontFamily,
  selectedTextFontSizeDraft,
  setSelectedTextFontSizeDraft,
  selectedTextBold,
  selectedTextItalic,
  selectedTextUnderline,
  selectedTextAlign,
  selectedTextColor,
  selectedTextBackground,
  onUpdateSelectedTextFormatting,
  selectedDividerStyle,
  selectedDividerColor,
  dividerWidthDraft,
  setDividerWidthDraft,
  onUpdateSelectedDividerMeta,
  onUpdateSelectedDividerObject,
  onCommitSelectedDividerWidth,
  lineStyle,
  setLineStyle,
  selectedLineStyle,
  selectedLineKind,
  selectedLineColor,
  lineWidthDraft,
  setLineWidthDraft,
  selectedLineStartLabelDraft,
  setSelectedLineStartLabelDraft,
  selectedLineEndLabelDraft,
  setSelectedLineEndLabelDraft,
  onUpdateSelectedLineMeta,
  onUpdateSelectedLineObject,
  onCommitSelectedLineWidth,
  onCommitSelectedLineEndpointLabel,
  onConnectPointObjectsChronologically,
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
  solid3dInspectorTab,
  setSolid3dInspectorTab,
  solid3dFigureTab,
  setSolid3dFigureTab,
  selectedSolid3dState,
  selectedSolidMesh,
  selectedSolidIsCurved,
  selectedSolidHiddenEdges,
  selectedSolidSurfaceColor,
  selectedSolidFaceColors,
  selectedSolidEdgeColors,
  selectedSolidEdges,
  selectedSolidAngleMarks,
  selectedSolidVertexLabels,
  activeSolidSectionId,
  setActiveSolidSectionId,
  solid3dDraftPoints,
  solid3dDraftPointLimit,
  isSolid3dPointCollectionActive,
  onSetSolid3dHiddenEdges,
  onUpdateSelectedSolid3dSurfaceColor,
  solid3dStrokeWidthDraft,
  setSolid3dStrokeWidthDraft,
  onUpdateSelectedSolid3dStrokeWidth,
  onCommitSelectedSolid3dStrokeWidth,
  onResetSolid3dFaceColors,
  onSetSolid3dFaceColor,
  onResetSolid3dEdgeColors,
  onSetSolid3dEdgeColor,
  onAddSolid3dAngleMark,
  onUpdateSolid3dAngleMark,
  onDeleteSolid3dAngleMark,
  onStartSolid3dSectionPointCollection,
  onBuildSectionFromDraftPoints,
  onClearSolid3dDraftPoints,
  onUpdateSolid3dSection,
  onDeleteSolid3dSection,
  getSolidVertexLabel,
  getSectionVertexLabel,
}: WorkbookSessionTransformPanelProps) {
  return (
    <div className="workbook-session__card">
      <h3>Трансформации</h3>
      <div className="workbook-session__geometry">
        {!selectedObject ? (
          <p className="workbook-session__hint">Выберите объект для настройки.</p>
        ) : null}
        {selectedObject &&
        selectedObject.type !== "function_graph" &&
        selectedObject.type !== "text" ? (
          <div className="workbook-session__geometry-actions">
            <Button
              size="small"
              variant="outlined"
              onClick={() => void onMirrorSelectedObject("horizontal")}
            >
              Отразить по X
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => void onMirrorSelectedObject("vertical")}
            >
              Отразить по Y
            </Button>
          </div>
        ) : null}
        {selectedObject &&
        selectedObject.type !== "solid3d" &&
        canToggleSelectedObjectLabels &&
        !selectedShape2dObject ? (
          <div className="workbook-session__settings-row">
            <span>Показывать названия вершин/точек</span>
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
        {selectedObject && isSelectedObjectInComposition ? (
          <div className="workbook-session__settings-row">
            <span>Композиция</span>
            <Button size="small" variant="outlined" onClick={() => void onDissolveCompositionLayer()}>
              Расформировать
            </Button>
          </div>
        ) : null}

        {selectedObject?.type === "solid3d" ? (
          <WorkbookSessionTransformPanelSolid3d
            selectedSolid3dState={selectedSolid3dState}
            selectedSolidMesh={selectedSolidMesh}
            selectedSolidIsCurved={selectedSolidIsCurved}
            selectedSolidHiddenEdges={selectedSolidHiddenEdges}
            selectedSolidSurfaceColor={selectedSolidSurfaceColor}
            selectedSolidFaceColors={selectedSolidFaceColors}
            selectedSolidEdgeColors={selectedSolidEdgeColors}
            selectedSolidEdges={selectedSolidEdges}
            selectedSolidAngleMarks={selectedSolidAngleMarks}
            selectedSolidVertexLabels={selectedSolidVertexLabels}
            solid3dInspectorTab={solid3dInspectorTab}
            setSolid3dInspectorTab={setSolid3dInspectorTab}
            solid3dFigureTab={solid3dFigureTab}
            setSolid3dFigureTab={setSolid3dFigureTab}
            activeSolidSectionId={activeSolidSectionId}
            setActiveSolidSectionId={setActiveSolidSectionId}
            solid3dDraftPoints={solid3dDraftPoints}
            solid3dDraftPointLimit={solid3dDraftPointLimit}
            isSolid3dPointCollectionActive={isSolid3dPointCollectionActive}
            canSelect={canSelect}
            solid3dStrokeWidthDraft={solid3dStrokeWidthDraft}
            setSolid3dStrokeWidthDraft={setSolid3dStrokeWidthDraft}
            onUpdateSelectedSolid3dStrokeWidth={onUpdateSelectedSolid3dStrokeWidth}
            onCommitSelectedSolid3dStrokeWidth={onCommitSelectedSolid3dStrokeWidth}
            onSetSolid3dHiddenEdges={onSetSolid3dHiddenEdges}
            onUpdateSelectedSolid3dSurfaceColor={onUpdateSelectedSolid3dSurfaceColor}
            onResetSolid3dFaceColors={onResetSolid3dFaceColors}
            onSetSolid3dFaceColor={onSetSolid3dFaceColor}
            onResetSolid3dEdgeColors={onResetSolid3dEdgeColors}
            onSetSolid3dEdgeColor={onSetSolid3dEdgeColor}
            onAddSolid3dAngleMark={onAddSolid3dAngleMark}
            onUpdateSolid3dAngleMark={onUpdateSolid3dAngleMark}
            onDeleteSolid3dAngleMark={onDeleteSolid3dAngleMark}
            onStartSolid3dSectionPointCollection={onStartSolid3dSectionPointCollection}
            onBuildSectionFromDraftPoints={onBuildSectionFromDraftPoints}
            onClearSolid3dDraftPoints={onClearSolid3dDraftPoints}
            onUpdateSolid3dSection={onUpdateSolid3dSection}
            onDeleteSolid3dSection={onDeleteSolid3dSection}
            getSolidVertexLabel={getSolidVertexLabel}
            canToggleSelectedObjectLabels={canToggleSelectedObjectLabels}
            selectedObjectShowLabels={selectedObjectShowLabels}
            onUpdateSelectedObjectMeta={onUpdateSelectedObjectMeta}
          />
        ) : tool === "eraser" ? (
          <div className="workbook-session__settings">
            <p className="workbook-session__hint">
              Ластик режет штрихи и 2D-объекты, но не изменяет 3D-фигуры, их сечения и связанные
              элементы.
            </p>
            <div className="workbook-session__settings-row">
              <span>Радиус ластика</span>
              <div className="workbook-session__line-range">
                <input
                  type="range"
                  min={eraserRadiusMin}
                  max={eraserRadiusMax}
                  value={strokeWidth}
                  onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
                />
              </div>
              <strong>{strokeWidth} px</strong>
            </div>
          </div>
        ) : selectedFunctionGraphObject || tool === "function_graph" ? (
          <div className="workbook-session__settings">
            <p className="workbook-session__hint">
              Настройки графиков перенесены во вкладку «График функции».
            </p>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ShowChartRoundedIcon />}
              onClick={onOpenGraphPanel}
            >
              Открыть вкладку
            </Button>
          </div>
        ) : selectedTextObject || tool === "text" ? (
          <div className="workbook-session__settings">
            <p className="workbook-session__hint">
              {selectedTextObject
                ? "Редактируйте текст прямо на доске или через параметры ниже."
                : "Выберите текстовый блок на доске, чтобы включить параметры форматирования."}
            </p>
            <TextField
              className="workbook-session__text-transform-field"
              size="small"
              multiline
              minRows={2}
              maxRows={5}
              placeholder="Текст"
              inputProps={{ "aria-label": "Текст объекта" }}
              value={selectedTextObject ? selectedTextDraft : ""}
              disabled={!selectedTextObject}
              onChange={(event) => {
                if (!selectedTextObject) return;
                const nextValue = event.target.value;
                setSelectedTextDraft(nextValue);
                onScheduleSelectedTextDraftCommit(nextValue);
              }}
              onBlur={() => {
                void onFlushSelectedTextDraftCommit();
              }}
            />
            <div className="workbook-session__settings-row">
              <span>Шрифт</span>
              <Select
                native
                size="small"
                value={selectedTextFontFamily}
                disabled={!selectedTextObject}
                onChange={(event) =>
                  void onUpdateSelectedTextFormatting(
                    {},
                    { textFontFamily: String(event.target.value) }
                  )
                }
              >
                {textFontOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="workbook-session__settings-row">
              <span>Размер</span>
              <div className="workbook-session__line-range">
                <input
                  type="range"
                  min={12}
                  max={72}
                  step={1}
                  value={selectedTextFontSizeDraft}
                  disabled={!selectedTextObject}
                  onChange={(event) => {
                    if (!selectedTextObject) return;
                    const nextSize = Math.max(12, Math.min(72, Number(event.target.value) || 18));
                    setSelectedTextFontSizeDraft(nextSize);
                    void onUpdateSelectedTextFormatting({ fontSize: nextSize });
                  }}
                />
              </div>
            </div>
            <div className="workbook-session__text-controls-grid">
              <div className="workbook-session__text-icon-row">
                <Tooltip title="Жирный" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className={selectedTextBold ? "is-active" : ""}
                      disabled={!selectedTextObject}
                      onClick={() =>
                        void onUpdateSelectedTextFormatting({}, { textBold: !selectedTextBold })
                      }
                    >
                      <FormatBoldRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Курсив" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className={selectedTextItalic ? "is-active" : ""}
                      disabled={!selectedTextObject}
                      onClick={() =>
                        void onUpdateSelectedTextFormatting({}, { textItalic: !selectedTextItalic })
                      }
                    >
                      <FormatItalicRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Подчеркнуть" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className={selectedTextUnderline ? "is-active" : ""}
                      disabled={!selectedTextObject}
                      onClick={() =>
                        void onUpdateSelectedTextFormatting(
                          {},
                          { textUnderline: !selectedTextUnderline }
                        )
                      }
                    >
                      <FormatUnderlinedRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
              <div className="workbook-session__text-icon-row">
                <Tooltip title="Слева" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className={selectedTextAlign === "left" ? "is-active" : ""}
                      disabled={!selectedTextObject}
                      onClick={() => void onUpdateSelectedTextFormatting({}, { textAlign: "left" })}
                    >
                      <FormatAlignLeftRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="По центру" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className={selectedTextAlign === "center" ? "is-active" : ""}
                      disabled={!selectedTextObject}
                      onClick={() =>
                        void onUpdateSelectedTextFormatting({}, { textAlign: "center" })
                      }
                    >
                      <FormatAlignCenterRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Справа" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className={selectedTextAlign === "right" ? "is-active" : ""}
                      disabled={!selectedTextObject}
                      onClick={() =>
                        void onUpdateSelectedTextFormatting({}, { textAlign: "right" })
                      }
                    >
                      <FormatAlignRightRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
              <div className="workbook-session__text-color-row">
                <Tooltip title="Цвет текста" arrow>
                  <span className="workbook-session__text-color-control">
                    <FormatColorTextRoundedIcon fontSize="small" />
                    <input
                      type="color"
                      value={selectedTextColor}
                      disabled={!selectedTextObject}
                      onChange={(event) =>
                        void onUpdateSelectedTextFormatting(
                          { color: event.target.value || "#172039" },
                          { textColor: event.target.value || "#172039" }
                        )
                      }
                    />
                  </span>
                </Tooltip>
                <Tooltip title="Фон текста" arrow>
                  <span className="workbook-session__text-color-control">
                    <FormatColorFillRoundedIcon fontSize="small" />
                    <input
                      type="color"
                      value={
                        selectedTextBackground === "transparent"
                          ? "#ffffff"
                          : selectedTextBackground
                      }
                      disabled={!selectedTextObject}
                      onChange={(event) =>
                        void onUpdateSelectedTextFormatting(
                          {},
                          { textBackground: event.target.value || "transparent" }
                        )
                      }
                    />
                  </span>
                </Tooltip>
                <Tooltip title="Убрать фон текста" arrow>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!selectedTextObject}
                      onClick={() =>
                        void onUpdateSelectedTextFormatting({}, { textBackground: "transparent" })
                      }
                    >
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            </div>
          </div>
        ) : selectedDividerObject || tool === "divider" ? (
          <div className="workbook-session__settings">
            <p className="workbook-session__hint">
              Объект: {selectedDividerObject ? "Разделитель" : "Новый разделитель"}
            </p>
            <div className="workbook-session__settings-row">
              <span>Стиль разделителя</span>
              <div className="workbook-session__toggle-group">
                <button
                  type="button"
                  className={
                    (selectedDividerObject ? selectedDividerStyle : "dashed") === "solid"
                      ? "is-active"
                      : ""
                  }
                  onClick={() => {
                    if (selectedDividerObject) {
                      void onUpdateSelectedDividerMeta({ lineStyle: "solid" });
                    }
                  }}
                  disabled={!selectedDividerObject}
                >
                  Сплошной
                </button>
                <button
                  type="button"
                  className={
                    (selectedDividerObject ? selectedDividerStyle : "dashed") === "dashed"
                      ? "is-active"
                      : ""
                  }
                  onClick={() => {
                    if (selectedDividerObject) {
                      void onUpdateSelectedDividerMeta({ lineStyle: "dashed" });
                    }
                  }}
                  disabled={!selectedDividerObject}
                >
                  Пунктирный
                </button>
              </div>
            </div>
            <div className="workbook-session__settings-row">
              <span>Цвет</span>
              <input
                type="color"
                value={selectedDividerColor}
                disabled={!selectedDividerObject}
                onChange={(event) =>
                  void onUpdateSelectedDividerObject({
                    color: event.target.value || "#4f63ff",
                  })
                }
              />
            </div>
            <div className="workbook-session__settings-row">
              <span>Толщина</span>
              <div className="workbook-session__line-range">
                <input
                  type="range"
                  min={1}
                  max={18}
                  step={1}
                  value={dividerWidthDraft}
                  disabled={!selectedDividerObject}
                  onChange={(event) => {
                    const nextWidth = Math.max(1, Math.min(18, Number(event.target.value) || 1));
                    setDividerWidthDraft(nextWidth);
                    if (selectedDividerObject) {
                      void onUpdateSelectedDividerObject({ strokeWidth: nextWidth });
                    }
                  }}
                  onMouseUp={() => void onCommitSelectedDividerWidth()}
                  onTouchEnd={() => void onCommitSelectedDividerWidth()}
                  onBlur={() => void onCommitSelectedDividerWidth()}
                />
              </div>
            </div>
          </div>
        ) : selectedLineObject || tool === "line" ? (
          <div className="workbook-session__settings">
            <p className="workbook-session__hint">
              Объект: {selectedLineObject ? selectedObjectLabel : "Новая линия"}
            </p>
            <div className="workbook-session__settings-row">
              <span>Тип линии</span>
              <div className="workbook-session__toggle-group">
                <button
                  type="button"
                  className={!selectedLineObject || selectedLineKind === "line" ? "is-active" : ""}
                  onClick={() => {
                    if (selectedLineObject) {
                      void onUpdateSelectedLineMeta({ lineKind: "line" });
                    }
                  }}
                >
                  Линия
                </button>
                <button
                  type="button"
                  className={
                    selectedLineObject && selectedLineKind === "segment" ? "is-active" : ""
                  }
                  onClick={() => {
                    if (selectedLineObject) {
                      void onUpdateSelectedLineMeta({ lineKind: "segment" });
                    }
                  }}
                  disabled={!selectedLineObject}
                >
                  Отрезок
                </button>
              </div>
            </div>
            <div className="workbook-session__settings-row">
              <span>Стиль линии</span>
              <div className="workbook-session__toggle-group">
                <button
                  type="button"
                  className={(selectedLineObject ? selectedLineStyle : lineStyle) === "solid" ? "is-active" : ""}
                  onClick={() => {
                    setLineStyle("solid");
                    if (selectedLineObject) {
                      void onUpdateSelectedLineMeta({ lineStyle: "solid" });
                    }
                  }}
                >
                  Сплошная
                </button>
                <button
                  type="button"
                  className={(selectedLineObject ? selectedLineStyle : lineStyle) === "dashed" ? "is-active" : ""}
                  onClick={() => {
                    setLineStyle("dashed");
                    if (selectedLineObject) {
                      void onUpdateSelectedLineMeta({ lineStyle: "dashed" });
                    }
                  }}
                >
                  Пунктирная
                </button>
              </div>
            </div>
            <div className="workbook-session__settings-row">
              <span>Цвет линии</span>
              <input
                type="color"
                value={selectedLineColor}
                disabled={!selectedLineObject}
                onChange={(event) =>
                  void onUpdateSelectedLineObject({
                    color: event.target.value || "#4f63ff",
                  })
                }
              />
            </div>
            <div className="workbook-session__settings-row">
              <span>Толщина линии</span>
              <div className="workbook-session__line-range">
                <input
                  type="range"
                  min={1}
                  max={18}
                  step={1}
                  value={lineWidthDraft}
                  disabled={!selectedLineObject}
                  onChange={(event) => {
                    const nextWidth = Math.max(1, Math.min(18, Number(event.target.value) || 1));
                    setLineWidthDraft(nextWidth);
                    if (selectedLineObject) {
                      void onUpdateSelectedLineObject({ strokeWidth: nextWidth });
                    }
                  }}
                  onMouseUp={() => void onCommitSelectedLineWidth()}
                  onTouchEnd={() => void onCommitSelectedLineWidth()}
                  onBlur={() => void onCommitSelectedLineWidth()}
                />
              </div>
            </div>
            {selectedLineObject && selectedLineKind === "segment" ? (
              <div className="workbook-session__line-endpoints-row">
                <TextField
                  size="small"
                  placeholder="A"
                  inputProps={{ "aria-label": "Название конца A" }}
                  value={selectedLineStartLabelDraft}
                  onChange={(event) => {
                    const nextValue = event.target.value.slice(0, 12);
                    setSelectedLineStartLabelDraft(nextValue);
                    void onCommitSelectedLineEndpointLabel("start", nextValue);
                  }}
                  onBlur={() => void onCommitSelectedLineEndpointLabel("start")}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.currentTarget.blur();
                  }}
                />
                <TextField
                  size="small"
                  placeholder="B"
                  inputProps={{ "aria-label": "Название конца B" }}
                  value={selectedLineEndLabelDraft}
                  onChange={(event) => {
                    const nextValue = event.target.value.slice(0, 12);
                    setSelectedLineEndLabelDraft(nextValue);
                    void onCommitSelectedLineEndpointLabel("end", nextValue);
                  }}
                  onBlur={() => void onCommitSelectedLineEndpointLabel("end")}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.currentTarget.blur();
                  }}
                />
              </div>
            ) : selectedLineObject ? (
              <p className="workbook-session__hint">
                Чтобы подписывать концы, переключите объект в режим «Отрезок».
              </p>
            ) : null}
          </div>
        ) : selectedPointObject || tool === "point" ? (
          <div className="workbook-session__settings">
            <p className="workbook-session__hint">
              {selectedPointObject
                ? "Точка выбрана. Переименование доступно по правому клику."
                : "Инструмент «Точка»: ставьте точки кликом по доске."}
            </p>
            <div className="workbook-session__geometry-actions">
              <Button
                size="small"
                variant="outlined"
                disabled={!canDelete || pointObjectCount < 2}
                onClick={() => void onConnectPointObjectsChronologically()}
              >
                Объединить точки
              </Button>
            </div>
          </div>
        ) : selectedShape2dObject ? (
          <WorkbookSessionTransformPanelShape2d
            selectedShape2dObject={selectedShape2dObject}
            selectedObjectLabel={selectedObjectLabel}
            shape2dInspectorTab={shape2dInspectorTab}
            setShape2dInspectorTab={setShape2dInspectorTab}
            selectedShape2dHasAngles={selectedShape2dHasAngles}
            selectedShape2dShowAngles={selectedShape2dShowAngles}
            selectedShape2dLabels={selectedShape2dLabels}
            selectedShape2dSegments={selectedShape2dSegments}
            selectedShape2dAngleMarks={selectedShape2dAngleMarks}
            shapeVertexLabelDrafts={shapeVertexLabelDrafts}
            setShapeVertexLabelDrafts={setShapeVertexLabelDrafts}
            shapeAngleNoteDrafts={shapeAngleNoteDrafts}
            setShapeAngleNoteDrafts={setShapeAngleNoteDrafts}
            shapeSegmentNoteDrafts={shapeSegmentNoteDrafts}
            setShapeSegmentNoteDrafts={setShapeSegmentNoteDrafts}
            shape2dStrokeWidthDraft={shape2dStrokeWidthDraft}
            setShape2dStrokeWidthDraft={setShape2dStrokeWidthDraft}
            selectedShape2dVertexColors={selectedShape2dVertexColors}
            selectedShape2dAngleColors={selectedShape2dAngleColors}
            selectedShape2dSegmentColors={selectedShape2dSegmentColors}
            canToggleSelectedObjectLabels={canToggleSelectedObjectLabels}
            selectedObjectShowLabels={selectedObjectShowLabels}
            onUpdateSelectedObjectMeta={onUpdateSelectedObjectMeta}
            onUpdateSelectedShape2dMeta={onUpdateSelectedShape2dMeta}
            onUpdateSelectedShape2dObject={onUpdateSelectedShape2dObject}
            onCommitSelectedShape2dStrokeWidth={onCommitSelectedShape2dStrokeWidth}
            onRenameSelectedShape2dVertex={onRenameSelectedShape2dVertex}
            onScheduleSelectedShape2dAngleDraftCommit={onScheduleSelectedShape2dAngleDraftCommit}
            onFlushSelectedShape2dAngleDraftCommit={onFlushSelectedShape2dAngleDraftCommit}
            onUpdateSelectedShape2dAngleStyle={onUpdateSelectedShape2dAngleStyle}
            onScheduleSelectedShape2dSegmentDraftCommit={onScheduleSelectedShape2dSegmentDraftCommit}
            onFlushSelectedShape2dSegmentDraftCommit={onFlushSelectedShape2dSegmentDraftCommit}
            onUpdateSelectedShape2dVertexColor={onUpdateSelectedShape2dVertexColor}
            onUpdateSelectedShape2dAngleColor={onUpdateSelectedShape2dAngleColor}
            onUpdateSelectedShape2dSegmentColor={onUpdateSelectedShape2dSegmentColor}
          />
        ) : (
          <p className="workbook-session__hint">Объект: {selectedObjectLabel}.</p>
        )}
      </div>
    </div>
  );
});
