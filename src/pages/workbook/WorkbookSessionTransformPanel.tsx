import { memo, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Alert,
  Button,
  IconButton,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FormatAlignCenterRoundedIcon from "@mui/icons-material/FormatAlignCenterRounded";
import FormatAlignLeftRoundedIcon from "@mui/icons-material/FormatAlignLeftRounded";
import FormatAlignRightRoundedIcon from "@mui/icons-material/FormatAlignRightRounded";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatColorFillRoundedIcon from "@mui/icons-material/FormatColorFillRounded";
import FormatColorTextRoundedIcon from "@mui/icons-material/FormatColorTextRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatUnderlinedRoundedIcon from "@mui/icons-material/FormatUnderlinedRounded";
import PolylineRoundedIcon from "@mui/icons-material/PolylineRounded";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import type { WorkbookBoardObject, WorkbookTool } from "@/features/workbook/model/types";
import {
  computeSectionPolygon,
  type Solid3dMesh,
} from "@/features/workbook/model/solid3dGeometry";
import {
  SHAPE_ANGLE_MARK_STYLE_OPTIONS,
  type WorkbookShapeAngleMark,
  type WorkbookShapeAngleMarkStyle,
} from "@/features/workbook/model/shapeAngleMarks";
import type {
  Solid3dAngleMark,
  Solid3dSectionPoint,
  Solid3dSectionState,
  Solid3dState,
} from "@/features/workbook/model/solid3dState";

type TextFontOption = {
  value: string;
  label: string;
};

type LineStyle = "solid" | "dashed";
type LineKind = "line" | "segment";
type TextAlign = "left" | "center" | "right";
type Solid3dInspectorTab = "figure" | "section";
type Solid3dFigureTab = "display" | "surface" | "faces" | "edges" | "angles";
type Shape2dInspectorTab = "display" | "vertices" | "angles" | "segments";
type Solid3dDraftPoints = {
  objectId: string;
  points: Solid3dSectionPoint[];
};

type WorkbookSessionTransformPanelProps = {
  tool: WorkbookTool;
  canSelect: boolean;
  canDelete: boolean;
  pointObjectCount: number;
  eraserRadiusMin: number;
  eraserRadiusMax: number;
  strokeWidth: number;
  onStrokeWidthChange: (value: number) => void;
  selectedObject: WorkbookBoardObject | null;
  selectedObjectLabel: string;
  canToggleSelectedObjectLabels: boolean;
  selectedObjectShowLabels: boolean;
  isSelectedObjectInComposition: boolean;
  onMirrorSelectedObject: (axis: "horizontal" | "vertical") => void | Promise<void>;
  onUpdateSelectedObjectMeta: (patch: Record<string, unknown>) => void | Promise<void>;
  onDissolveCompositionLayer: () => void | Promise<void>;
  onOpenGraphPanel: () => void;
  selectedLineObject: WorkbookBoardObject | null;
  selectedFunctionGraphObject: WorkbookBoardObject | null;
  selectedDividerObject: WorkbookBoardObject | null;
  selectedPointObject: WorkbookBoardObject | null;
  selectedTextObject: WorkbookBoardObject | null;
  selectedShape2dObject: WorkbookBoardObject | null;
  textFontOptions: TextFontOption[];
  selectedTextDraft: string;
  setSelectedTextDraft: Dispatch<SetStateAction<string>>;
  onScheduleSelectedTextDraftCommit: (value: string) => void;
  onFlushSelectedTextDraftCommit: () => void | Promise<void>;
  selectedTextFontFamily: string;
  selectedTextFontSizeDraft: number;
  setSelectedTextFontSizeDraft: Dispatch<SetStateAction<number>>;
  selectedTextBold: boolean;
  selectedTextItalic: boolean;
  selectedTextUnderline: boolean;
  selectedTextAlign: TextAlign;
  selectedTextColor: string;
  selectedTextBackground: string;
  onUpdateSelectedTextFormatting: (
    objectPatch: Partial<WorkbookBoardObject>,
    metaPatch?: Record<string, unknown>
  ) => void | Promise<void>;
  selectedDividerStyle: LineStyle;
  selectedDividerColor: string;
  dividerWidthDraft: number;
  setDividerWidthDraft: Dispatch<SetStateAction<number>>;
  onUpdateSelectedDividerMeta: (patch: Record<string, unknown>) => void | Promise<void>;
  onUpdateSelectedDividerObject: (patch: Partial<WorkbookBoardObject>) => void | Promise<void>;
  onCommitSelectedDividerWidth: () => void | Promise<void>;
  lineStyle: LineStyle;
  setLineStyle: Dispatch<SetStateAction<LineStyle>>;
  selectedLineStyle: LineStyle;
  selectedLineKind: LineKind;
  selectedLineColor: string;
  lineWidthDraft: number;
  setLineWidthDraft: Dispatch<SetStateAction<number>>;
  selectedLineStartLabelDraft: string;
  setSelectedLineStartLabelDraft: Dispatch<SetStateAction<string>>;
  selectedLineEndLabelDraft: string;
  setSelectedLineEndLabelDraft: Dispatch<SetStateAction<string>>;
  onUpdateSelectedLineMeta: (patch: Record<string, unknown>) => void | Promise<void>;
  onUpdateSelectedLineObject: (patch: Partial<WorkbookBoardObject>) => void | Promise<void>;
  onCommitSelectedLineWidth: () => void | Promise<void>;
  onCommitSelectedLineEndpointLabel: (
    endpoint: "start" | "end",
    value?: string
  ) => void | Promise<void>;
  onConnectPointObjectsChronologically: () => void | Promise<void>;
  shape2dInspectorTab: Shape2dInspectorTab;
  setShape2dInspectorTab: Dispatch<SetStateAction<Shape2dInspectorTab>>;
  selectedShape2dHasAngles: boolean;
  selectedShape2dShowAngles: boolean;
  selectedShape2dLabels: string[];
  selectedShape2dSegments: string[];
  selectedShape2dAngleMarks: WorkbookShapeAngleMark[];
  shapeVertexLabelDrafts: string[];
  setShapeVertexLabelDrafts: Dispatch<SetStateAction<string[]>>;
  shapeAngleNoteDrafts: string[];
  setShapeAngleNoteDrafts: Dispatch<SetStateAction<string[]>>;
  shapeSegmentNoteDrafts: string[];
  setShapeSegmentNoteDrafts: Dispatch<SetStateAction<string[]>>;
  shape2dStrokeWidthDraft: number;
  setShape2dStrokeWidthDraft: Dispatch<SetStateAction<number>>;
  selectedShape2dVertexColors: string[];
  selectedShape2dAngleColors: string[];
  selectedShape2dSegmentColors: string[];
  onUpdateSelectedShape2dMeta: (patch: Record<string, unknown>) => void | Promise<void>;
  onUpdateSelectedShape2dObject: (patch: Partial<WorkbookBoardObject>) => void | Promise<void>;
  onCommitSelectedShape2dStrokeWidth: () => void | Promise<void>;
  onRenameSelectedShape2dVertex: (index: number, value: string) => void | Promise<void>;
  onScheduleSelectedShape2dAngleDraftCommit: (index: number, value: string) => void;
  onFlushSelectedShape2dAngleDraftCommit: (
    index: number,
    value?: string
  ) => void | Promise<void>;
  onUpdateSelectedShape2dAngleStyle: (
    index: number,
    style: WorkbookShapeAngleMarkStyle
  ) => void | Promise<void>;
  onScheduleSelectedShape2dSegmentDraftCommit: (index: number, value: string) => void;
  onFlushSelectedShape2dSegmentDraftCommit: (
    index: number,
    value?: string
  ) => void | Promise<void>;
  onUpdateSelectedShape2dVertexColor: (index: number, color: string) => void | Promise<void>;
  onUpdateSelectedShape2dAngleColor: (index: number, color: string) => void | Promise<void>;
  onUpdateSelectedShape2dSegmentColor: (index: number, color: string) => void | Promise<void>;
  solid3dInspectorTab: Solid3dInspectorTab;
  setSolid3dInspectorTab: Dispatch<SetStateAction<Solid3dInspectorTab>>;
  solid3dFigureTab: Solid3dFigureTab;
  setSolid3dFigureTab: Dispatch<SetStateAction<Solid3dFigureTab>>;
  selectedSolid3dState: Solid3dState | null;
  selectedSolidMesh: Solid3dMesh | null;
  selectedSolidIsCurved: boolean;
  selectedSolidHiddenEdges: boolean;
  selectedSolidSurfaceColor: string;
  selectedSolidFaceColors: Record<string, string>;
  selectedSolidEdgeColors: Record<string, string>;
  selectedSolidEdges: Array<{
    key: string;
    label: string;
  }>;
  selectedSolidAngleMarks: Solid3dAngleMark[];
  selectedSolidVertexLabels: string[];
  activeSolidSectionId: string | null;
  setActiveSolidSectionId: Dispatch<SetStateAction<string | null>>;
  solid3dDraftPoints: Solid3dDraftPoints | null;
  solid3dDraftPointLimit: number;
  isSolid3dPointCollectionActive: boolean;
  onSetSolid3dHiddenEdges: (hidden: boolean) => void | Promise<void>;
  onUpdateSelectedSolid3dSurfaceColor: (color: string) => void | Promise<void>;
  solid3dStrokeWidthDraft: number;
  setSolid3dStrokeWidthDraft: Dispatch<SetStateAction<number>>;
  onUpdateSelectedSolid3dStrokeWidth: (strokeWidthValue: number) => void | Promise<void>;
  onCommitSelectedSolid3dStrokeWidth: () => void | Promise<void>;
  onResetSolid3dFaceColors: () => void | Promise<void>;
  onSetSolid3dFaceColor: (faceIndex: number, color: string) => void | Promise<void>;
  onResetSolid3dEdgeColors: () => void | Promise<void>;
  onSetSolid3dEdgeColor: (edgeKey: string, color: string) => void | Promise<void>;
  onAddSolid3dAngleMark: () => void | Promise<void>;
  onUpdateSolid3dAngleMark: (
    markId: string,
    patch: Partial<Solid3dAngleMark>
  ) => void | Promise<void>;
  onDeleteSolid3dAngleMark: (markId: string) => void | Promise<void>;
  onStartSolid3dSectionPointCollection: () => void;
  onBuildSectionFromDraftPoints: () => void | Promise<void>;
  onClearSolid3dDraftPoints: () => void;
  onUpdateSolid3dSection: (
    sectionId: string,
    patch: Partial<Solid3dSectionState>
  ) => void | Promise<void>;
  onDeleteSolid3dSection: (sectionId: string) => void | Promise<void>;
  getSolidVertexLabel: (index: number) => string;
  getSectionVertexLabel: (index: number) => string;
};

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
  const [activeShapeAngleKey, setActiveShapeAngleKey] = useState<string | null>(null);
  const solid3dSectionSummaries = selectedSolid3dState?.sections.map((section) => {
    const polygon =
      selectedSolidMesh && section.visible
        ? computeSectionPolygon(selectedSolidMesh, section).polygon
        : [];
    const vertexCount = polygon.length;
    const isPolygonal = !selectedSolidIsCurved && vertexCount >= 3;
    const resolvedLabels = Array.from({ length: vertexCount }, (_, index) => {
      const raw = section.vertexLabels[index];
      return typeof raw === "string" && raw.trim()
        ? raw.trim()
        : getSectionVertexLabel(index);
    });
    return {
      sectionId: section.id,
      vertexCount,
      isPolygonal,
      labelPreview: isPolygonal ? resolvedLabels.slice(0, 4).join(", ") : "",
      supportPointCount: section.points.length,
    };
  });
  const shapeAngleItems = useMemo(
    () =>
      selectedShape2dLabels.map((label, index) => {
        const angleMark = selectedShape2dAngleMarks[index] ?? {
          valueText: "",
          color: selectedShape2dAngleColors[index] ?? "#4f63ff",
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
        {selectedObject && canToggleSelectedObjectLabels && !selectedShape2dObject ? (
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
          <div className="workbook-session__solid-inspector">
            <div className="workbook-session__solid-tabs">
              <Button
                size="small"
                className="workbook-session__solid-tab-btn"
                startIcon={<ViewInArRoundedIcon />}
                variant={solid3dInspectorTab === "figure" ? "contained" : "outlined"}
                onClick={() => setSolid3dInspectorTab("figure")}
              >
                Фигура
              </Button>
              <Button
                size="small"
                className="workbook-session__solid-tab-btn"
                startIcon={<PolylineRoundedIcon />}
                variant={solid3dInspectorTab === "section" ? "contained" : "outlined"}
                onClick={() => setSolid3dInspectorTab("section")}
              >
                Сечения
              </Button>
            </div>

            {solid3dInspectorTab === "figure" ? (
              selectedSolidMesh ? (
                <div className="workbook-session__solid-card-list workbook-session__solid-card-list--figure">
                  <div className="workbook-session__solid-subtabs">
                    <button
                      type="button"
                      className={solid3dFigureTab === "display" ? "is-active" : ""}
                      onClick={() => setSolid3dFigureTab("display")}
                    >
                      Вид
                    </button>
                    {selectedSolidIsCurved ? (
                      <button
                        type="button"
                        className={solid3dFigureTab === "surface" ? "is-active" : ""}
                        onClick={() => setSolid3dFigureTab("surface")}
                      >
                        Поверхность
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={solid3dFigureTab === "faces" ? "is-active" : ""}
                          onClick={() => setSolid3dFigureTab("faces")}
                        >
                          Грани
                        </button>
                        <button
                          type="button"
                          className={solid3dFigureTab === "edges" ? "is-active" : ""}
                          onClick={() => setSolid3dFigureTab("edges")}
                        >
                          Ребра
                        </button>
                        <button
                          type="button"
                          className={solid3dFigureTab === "angles" ? "is-active" : ""}
                          onClick={() => setSolid3dFigureTab("angles")}
                        >
                          Углы
                        </button>
                      </>
                    )}
                  </div>

                  {solid3dFigureTab === "display" ? (
                    <article className="workbook-session__solid-card">
                      <div className="workbook-session__settings-row">
                        <span>Толщина контура</span>
                        <div className="workbook-session__line-range">
                          <input
                            type="range"
                            min={1}
                            max={18}
                            step={1}
                            value={solid3dStrokeWidthDraft}
                            onChange={(event) => {
                              const nextWidth = Math.max(
                                1,
                                Math.min(18, Number(event.target.value) || 1)
                              );
                              setSolid3dStrokeWidthDraft(nextWidth);
                              void onUpdateSelectedSolid3dStrokeWidth(nextWidth);
                            }}
                            onMouseUp={() => void onCommitSelectedSolid3dStrokeWidth()}
                            onTouchEnd={() => void onCommitSelectedSolid3dStrokeWidth()}
                            onBlur={() => void onCommitSelectedSolid3dStrokeWidth()}
                          />
                        </div>
                      </div>
                      <div className="workbook-session__solid-card-row">
                        <span>
                          {selectedSolidIsCurved
                            ? "Скрыть вспомогательные контуры"
                            : "Пунктир скрыт"}
                        </span>
                        <Switch
                          size="small"
                          checked={selectedSolidHiddenEdges}
                          onChange={(event) =>
                            void onSetSolid3dHiddenEdges(event.target.checked)
                          }
                        />
                      </div>
                      {selectedSolidIsCurved ? (
                        <p className="workbook-session__hint">
                          Для тел с круговым основанием скрыты служебные mesh-точки: в учебной
                          записи остаются контур, образующие, ось и сечения.
                        </p>
                      ) : null}
                    </article>
                  ) : null}

                  {solid3dFigureTab === "surface" && selectedSolidIsCurved ? (
                    <article className="workbook-session__solid-card">
                      <div className="workbook-session__solid-card-head">
                        <span className="workbook-session__solid-card-title">Поверхность тела</span>
                      </div>
                      <div className="workbook-session__solid-face-grid">
                        <div className="workbook-session__solid-face-row">
                          <span>Заливка</span>
                          <input
                            type="color"
                            className="workbook-session__solid-color"
                            value={selectedSolidSurfaceColor}
                            onChange={(event) =>
                              void onUpdateSelectedSolid3dSurfaceColor(
                                event.target.value || "#5f6aa0"
                              )
                            }
                          />
                        </div>
                      </div>
                      <p className="workbook-session__hint">
                        Для тел с круговым основанием доступны управление поверхностью и служебными
                        контурами.
                      </p>
                    </article>
                  ) : null}

                  {solid3dFigureTab === "faces" && !selectedSolidIsCurved ? (
                    <article className="workbook-session__solid-card">
                      <div className="workbook-session__solid-card-head">
                        <span className="workbook-session__solid-card-title">Окрашивание граней</span>
                        <Button size="small" variant="outlined" onClick={() => void onResetSolid3dFaceColors()}>
                          Сбросить
                        </Button>
                      </div>
                      <div className="workbook-session__solid-face-grid">
                        {selectedSolidMesh.faces.slice(0, 24).map((_, faceIndex) => (
                          <div
                            key={`solid-face-color-${faceIndex}`}
                            className="workbook-session__solid-face-row"
                          >
                            <span>
                              {`Грань ${
                                selectedSolidMesh.faces[faceIndex]
                                  .map(
                                    (vertexIndex) =>
                                      selectedSolidVertexLabels[vertexIndex] ||
                                      getSolidVertexLabel(vertexIndex)
                                  )
                                  .join("-") || faceIndex + 1
                              }`}
                            </span>
                            <input
                              type="color"
                              className="workbook-session__solid-color"
                              value={selectedSolidFaceColors[String(faceIndex)] || "#5f6aa0"}
                              onChange={(event) =>
                                void onSetSolid3dFaceColor(
                                  faceIndex,
                                  event.target.value || "#5f6aa0"
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                      {selectedSolidMesh.faces.length > 24 ? (
                        <p className="workbook-session__hint">
                          Для этой фигуры доступно много граней. Показаны первые 24.
                        </p>
                      ) : null}
                    </article>
                  ) : null}

                  {solid3dFigureTab === "edges" && !selectedSolidIsCurved ? (
                    <article className="workbook-session__solid-card">
                      <div className="workbook-session__solid-card-head">
                        <span className="workbook-session__solid-card-title">Окрашивание ребер</span>
                        <Button size="small" variant="outlined" onClick={() => void onResetSolid3dEdgeColors()}>
                          Сбросить
                        </Button>
                      </div>
                      <div className="workbook-session__solid-face-grid">
                        {selectedSolidEdges.slice(0, 24).map((edge) => (
                          <div
                            key={`solid-edge-color-${edge.key}`}
                            className="workbook-session__solid-face-row"
                          >
                            <span>{`Ребро ${edge.label}`}</span>
                            <input
                              type="color"
                              className="workbook-session__solid-color"
                              value={selectedSolidEdgeColors[edge.key] || "#4f63ff"}
                              onChange={(event) =>
                                void onSetSolid3dEdgeColor(
                                  edge.key,
                                  event.target.value || "#4f63ff"
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                      {selectedSolidEdges.length > 24 ? (
                        <p className="workbook-session__hint">
                          Для этой фигуры доступно много ребер. Показаны первые 24.
                        </p>
                      ) : null}
                    </article>
                  ) : null}

                  {solid3dFigureTab === "angles" && !selectedSolidIsCurved ? (
                    <article className="workbook-session__solid-card">
                      <div className="workbook-session__solid-card-head">
                        <span className="workbook-session__solid-card-title">Углы</span>
                        <Button size="small" variant="outlined" onClick={() => void onAddSolid3dAngleMark()}>
                          Добавить
                        </Button>
                      </div>
                      {selectedSolidAngleMarks.length ? (
                        <div className="workbook-session__solid-angle-list">
                          {selectedSolidAngleMarks.map((mark) => (
                            <div key={mark.id} className="workbook-session__solid-angle-card">
                              {(() => {
                                const fallbackFaceIndex = selectedSolidMesh.faces.findIndex((face) =>
                                  face.includes(mark.vertexIndex)
                                );
                                const storedFaceIndex =
                                  typeof mark.faceIndex === "number" &&
                                  Number.isInteger(mark.faceIndex) &&
                                  mark.faceIndex >= 0
                                    ? mark.faceIndex
                                    : null;
                                const activeFaceIndex =
                                  storedFaceIndex !== null && selectedSolidMesh.faces[storedFaceIndex]
                                    ? storedFaceIndex
                                    : Math.max(0, fallbackFaceIndex);
                                const activeFace = selectedSolidMesh.faces[activeFaceIndex] ?? [];
                                const activeVertexValue = activeFace.includes(mark.vertexIndex)
                                  ? mark.vertexIndex
                                  : (activeFace[0] ?? mark.vertexIndex);
                                const activeVertexLabel =
                                  selectedSolidVertexLabels[activeVertexValue] ||
                                  getSolidVertexLabel(activeVertexValue);
                                return (
                                  <>
                                    <div className="workbook-session__solid-angle-card-head">
                                      <div className="workbook-session__shape-angle-meta">
                                        <span className="workbook-session__shape-angle-badge">
                                          ∠{activeVertexLabel}
                                        </span>
                                        <div className="workbook-session__solid-angle-visibility">
                                          <span>Скрыть</span>
                                          <Switch
                                            size="small"
                                            checked={mark.visible === false}
                                            onChange={(event) =>
                                              void onUpdateSolid3dAngleMark(mark.id, {
                                                visible: !event.target.checked,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className="workbook-session__solid-angle-card-actions">
                                        <input
                                          type="color"
                                          className="workbook-session__solid-color"
                                          value={mark.color || "#ff8e3c"}
                                          onChange={(event) =>
                                            void onUpdateSolid3dAngleMark(mark.id, {
                                              color: event.target.value || "#ff8e3c",
                                            })
                                          }
                                        />
                                        <IconButton
                                          size="small"
                                          className="workbook-session__solid-angle-delete"
                                          onClick={() => void onDeleteSolid3dAngleMark(mark.id)}
                                        >
                                          <CloseRoundedIcon />
                                        </IconButton>
                                      </div>
                                    </div>
                                    <div className="workbook-session__solid-angle-grid">
                                      <Select
                                        native
                                        size="small"
                                        className="workbook-session__solid-angle-field workbook-session__solid-angle-field--face"
                                        value={String(activeFaceIndex)}
                                        onChange={(event) => {
                                          const nextFaceIndex = Number(event.target.value);
                                          const nextFace = selectedSolidMesh.faces[nextFaceIndex] ?? [];
                                          void onUpdateSolid3dAngleMark(mark.id, {
                                            faceIndex: nextFaceIndex,
                                            vertexIndex: nextFace.includes(mark.vertexIndex)
                                              ? mark.vertexIndex
                                              : (nextFace[0] ?? mark.vertexIndex),
                                          });
                                        }}
                                        inputProps={{ "aria-label": "Грань угла" }}
                                      >
                                        {selectedSolidMesh.faces.map((face, faceIndex) => (
                                          <option
                                            key={`face-opt-${mark.id}-${faceIndex}`}
                                            value={faceIndex}
                                          >
                                            {face
                                              .map(
                                                (vertexIndex) =>
                                                  selectedSolidVertexLabels[vertexIndex] ||
                                                  getSolidVertexLabel(vertexIndex)
                                              )
                                              .join("-")}
                                          </option>
                                        ))}
                                      </Select>
                                      <Select
                                        native
                                        size="small"
                                        className="workbook-session__solid-angle-field workbook-session__solid-angle-field--vertex"
                                        value={String(activeVertexValue)}
                                        onChange={(event) =>
                                          void onUpdateSolid3dAngleMark(mark.id, {
                                            vertexIndex: Number(event.target.value),
                                          })
                                        }
                                        inputProps={{ "aria-label": "Вершина угла" }}
                                      >
                                        {activeFace.map((vertexIndex) => (
                                          <option
                                            key={`vertex-opt-${mark.id}-${vertexIndex}`}
                                            value={vertexIndex}
                                          >
                                            {selectedSolidVertexLabels[vertexIndex] ||
                                              getSolidVertexLabel(vertexIndex)}
                                          </option>
                                        ))}
                                      </Select>
                                      <TextField
                                        size="small"
                                        className="workbook-session__solid-input workbook-session__solid-angle-field workbook-session__solid-angle-field--value"
                                        label="Значение"
                                        value={mark.label}
                                        onChange={(event) =>
                                          void onUpdateSolid3dAngleMark(mark.id, {
                                            label: event.target.value,
                                          })
                                        }
                                      />
                                      <TextField
                                        select
                                        size="small"
                                        className="workbook-session__solid-input workbook-session__solid-angle-field workbook-session__solid-angle-field--style"
                                        label="Обозначение"
                                        value={mark.style ?? "arc_single"}
                                        onChange={(event) =>
                                          void onUpdateSolid3dAngleMark(mark.id, {
                                            style: event.target.value as WorkbookShapeAngleMarkStyle,
                                          })
                                        }
                                      >
                                        {SHAPE_ANGLE_MARK_STYLE_OPTIONS.filter(
                                          (option) => option.value !== "auto"
                                        ).map((option) => (
                                          <MenuItem key={option.value} value={option.value}>
                                            {option.preview} {option.label}
                                          </MenuItem>
                                        ))}
                                      </TextField>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="workbook-session__hint">
                          Добавьте угол и задайте значение вручную.
                        </p>
                      )}
                    </article>
                  ) : null}
                </div>
              ) : (
                <p className="workbook-session__hint">
                  Выберите 3D-фигуру для настройки отображения.
                </p>
              )
            ) : (
              <>
                <div className="workbook-session__solid-section-actions">
                  <Button
                    size="small"
                    variant={isSolid3dPointCollectionActive ? "contained" : "outlined"}
                    onClick={onStartSolid3dSectionPointCollection}
                    disabled={!canSelect}
                  >
                    Добавить точки сечения
                  </Button>
                  {isSolid3dPointCollectionActive ? (
                    <>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => void onBuildSectionFromDraftPoints()}
                        disabled={!solid3dDraftPoints || solid3dDraftPoints.points.length < 3}
                      >
                        Построить сечение
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={onClearSolid3dDraftPoints}
                        disabled={!solid3dDraftPoints || solid3dDraftPoints.points.length === 0}
                      >
                        Очистить точки
                      </Button>
                    </>
                  ) : null}
                </div>

                {isSolid3dPointCollectionActive ? (
                  <Alert severity="info">
                    Кликните по ребру или вершине 3D-фигуры, чтобы добавить точку сечения.
                    {solid3dDraftPoints
                      ? ` Точки: ${solid3dDraftPoints.points.length}/${solid3dDraftPointLimit}.`
                      : null}
                  </Alert>
                ) : null}

                {selectedSolid3dState?.sections.length ? (
                  <div className="workbook-session__solid-card-list">
                    {selectedSolid3dState.sections.map((section) => {
                      const summary = solid3dSectionSummaries?.find(
                        (item) => item.sectionId === section.id
                      );
                      return (
                        <article
                          key={section.id}
                          className={`workbook-session__solid-card ${
                            activeSolidSectionId === section.id ? "is-selected" : ""
                          }`}
                          onClick={() => setActiveSolidSectionId(section.id)}
                        >
                          <div className="workbook-session__solid-card-head">
                            <span className="workbook-session__solid-card-title">{section.name}</span>
                            <div className="workbook-session__solid-card-controls">
                              <input
                                type="color"
                                className="workbook-session__solid-color"
                                value={section.color}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  void onUpdateSolid3dSection(section.id, {
                                    color: event.target.value || "#ff8e3c",
                                  })
                                }
                              />
                              <Switch
                                size="small"
                                checked={section.visible}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  void onUpdateSolid3dSection(section.id, {
                                    visible: event.target.checked,
                                  });
                                }}
                              />
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onDeleteSolid3dSection(section.id);
                                }}
                              >
                                <CloseRoundedIcon />
                              </IconButton>
                            </div>
                          </div>
                          <div className="workbook-session__solid-section-summary">
                            <div className="workbook-session__solid-section-badges">
                              <span className="workbook-session__solid-section-badge">
                                {selectedSolidIsCurved
                                  ? "Криволинейное сечение"
                                  : summary?.vertexCount && summary.vertexCount >= 3
                                    ? `Многоугольник, ${summary.vertexCount} вершин`
                                    : "Контур вычисляется автоматически"}
                              </span>
                              <span className="workbook-session__solid-section-badge is-muted">
                                Опорных точек: {summary?.supportPointCount ?? section.points.length}
                              </span>
                            </div>
                            {selectedSolidIsCurved ? (
                              <p className="workbook-session__hint">
                                Для тел с круговым основанием вершины сечения не используются.
                              </p>
                            ) : summary?.isPolygonal ? (
                              <>
                                <p className="workbook-session__hint">
                                  Переименовывайте вершины сечения правым кликом прямо на доске.
                                </p>
                                {summary.labelPreview ? (
                                  <div className="workbook-session__solid-section-preview">
                                    {summary.labelPreview}
                                    {summary.vertexCount > 4 ? " ..." : ""}
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <p className="workbook-session__hint">
                                Сечение сохранено как плоскость пересечения. Контур появится, когда
                                фигура корректно пересечётся этой плоскостью.
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="workbook-session__hint">
                    Добавьте сечение, затем укажите точки на ребрах или вершинах фигуры.
                  </p>
                )}
              </>
            )}
          </div>
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
              label="Текст"
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
                  label="A"
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
                  label="B"
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
          <div className="workbook-session__solid-inspector">
            <div className="workbook-session__solid-subtabs">
              <button
                type="button"
                className={shape2dInspectorTab === "display" ? "is-active" : ""}
                onClick={() => setShape2dInspectorTab("display")}
              >
                Вид
              </button>
              <button
                type="button"
                className={shape2dInspectorTab === "vertices" ? "is-active" : ""}
                onClick={() => setShape2dInspectorTab("vertices")}
              >
                Вершины
              </button>
              {selectedShape2dHasAngles ? (
                <button
                  type="button"
                  className={shape2dInspectorTab === "angles" ? "is-active" : ""}
                  onClick={() => setShape2dInspectorTab("angles")}
                >
                  Углы
                </button>
              ) : null}
              <button
                type="button"
                className={shape2dInspectorTab === "segments" ? "is-active" : ""}
                onClick={() => setShape2dInspectorTab("segments")}
              >
                Отрезки
              </button>
            </div>
            <div className="workbook-session__solid-card-list workbook-session__solid-card-list--figure">
              {shape2dInspectorTab === "display" ? (
                <article className="workbook-session__solid-card">
                  <div className="workbook-session__solid-card-head">
                    <span className="workbook-session__solid-card-title">Фигура</span>
                  </div>
                  <p className="workbook-session__hint">{selectedObjectLabel}</p>
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
                          const nextWidth = Math.max(
                            1,
                            Math.min(18, Number(event.target.value) || 1)
                          );
                          setShape2dStrokeWidthDraft(nextWidth);
                          void onUpdateSelectedShape2dObject({ strokeWidth: nextWidth });
                        }}
                        onMouseUp={() => void onCommitSelectedShape2dStrokeWidth()}
                        onTouchEnd={() => void onCommitSelectedShape2dStrokeWidth()}
                        onBlur={() => void onCommitSelectedShape2dStrokeWidth()}
                      />
                    </div>
                  </div>
                  <p className="workbook-session__hint">
                    Геометрические значения и обозначения вынесены в профильные вкладки.
                  </p>
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
                          label={`Вершина ${label}`}
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
                            void onRenameSelectedShape2dVertex(
                              index,
                              shapeVertexLabelDrafts[index] ?? ""
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.currentTarget.blur();
                          }}
                        />
                        <input
                          type="color"
                          className="workbook-session__solid-color"
                          value={selectedShape2dVertexColors[index] ?? "#4f63ff"}
                          onChange={(event) =>
                            void onUpdateSelectedShape2dVertexColor(index, event.target.value)
                          }
                        />
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
                            className={
                              activeShapeAngleItem?.key === item.key ? "is-active" : ""
                            }
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
                            <input
                              type="color"
                              className="workbook-session__solid-color workbook-session__shape-angle-color"
                              value={
                                selectedShape2dAngleColors[activeShapeAngleItem.index] ?? "#4f63ff"
                              }
                              onChange={(event) =>
                                void onUpdateSelectedShape2dAngleColor(
                                  activeShapeAngleItem.index,
                                  event.target.value
                                )
                              }
                            />
                          </div>
                          <div className="workbook-session__shape-angle-fields">
                            <TextField
                              size="small"
                              className="workbook-session__solid-input workbook-session__shape-angle-field"
                              label="Значение"
                              placeholder="Например: 45"
                              value={shapeAngleNoteDrafts[activeShapeAngleItem.index] ?? ""}
                              onChange={(event) => {
                                const nextValue = event.target.value.slice(0, 24);
                                setShapeAngleNoteDrafts((current) => {
                                  const next = [...current];
                                  next[activeShapeAngleItem.index] = nextValue;
                                  return next;
                                });
                                onScheduleSelectedShape2dAngleDraftCommit(
                                  activeShapeAngleItem.index,
                                  nextValue
                                );
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
                              label="Обозначение"
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
                          label="Значение"
                          placeholder="Например: 5"
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
                        <input
                          type="color"
                          className="workbook-session__solid-color"
                          value={selectedShape2dSegmentColors[index] ?? "#4f63ff"}
                          onChange={(event) =>
                            void onUpdateSelectedShape2dSegmentColor(index, event.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="workbook-session__hint">Объект: {selectedObjectLabel}.</p>
        )}
      </div>
    </div>
  );
});
