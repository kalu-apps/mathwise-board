import type { Dispatch, SetStateAction } from "react";
import type { WorkbookBoardObject, WorkbookTool } from "@/features/workbook/model/types";
import type { Solid3dMesh } from "@/features/workbook/model/solid3dGeometry";
import type { WorkbookShapeAngleMark, WorkbookShapeAngleMarkStyle } from "@/features/workbook/model/shapeAngleMarks";
import type {
  Solid3dAngleMark,
  Solid3dHostedPoint,
  Solid3dHostedSegment,
  Solid3dSectionPoint,
  Solid3dSectionState,
  Solid3dState,
} from "@/features/workbook/model/solid3dState";

export type TextFontOption = {
  value: string;
  label: string;
};

export type LineStyle = "solid" | "dashed";
export type LineKind = "line" | "segment";
export type TextAlign = "left" | "center" | "right";
export type Solid3dInspectorTab = "figure" | "section" | "hosted";
export type Solid3dFigureTab = "display" | "surface" | "faces" | "edges" | "angles";
export type Shape2dInspectorTab = "display" | "vertices" | "angles" | "segments";
export type Solid3dDraftPoints = {
  objectId: string;
  points: Solid3dSectionPoint[];
};

export type WorkbookSessionTransformPanelProps = {
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
  selectedSolidObjectId?: string | null;
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
  hostedGeometryDraftMode?: "segment" | null;
  hostedGeometryDraftPoints?: Solid3dSectionPoint[];
  selectedHostedEntityType?: "point" | "segment" | null;
  selectedHostedEntityId?: string | null;
  onSelectHostedEntity?: (
    entityType: "point" | "segment",
    entityId: string
  ) => void | Promise<void>;
  onClearHostedEntitySelection?: () => void;
  onStartSolid3dHostedSegmentMode?: (objectId: string) => void;
  onCancelSolid3dHostedDraft?: () => void;
  onUpdateSolid3dHostedPoint?: (
    pointId: string,
    patch: Partial<Solid3dHostedPoint>
  ) => void | Promise<void>;
  onUpdateSolid3dHostedSegment?: (
    segmentId: string,
    patch: Partial<Solid3dHostedSegment>
  ) => void | Promise<void>;
  onDeleteSolid3dHostedSegment?: (segmentId: string) => void | Promise<void>;
  getSolidVertexLabel: (index: number) => string;
  getSectionVertexLabel: (index: number) => string;
};
