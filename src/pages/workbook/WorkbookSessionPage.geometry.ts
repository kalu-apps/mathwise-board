import { resolveSolid3dPresetId } from "@/features/workbook/model/solid3d";
import type { Solid3dMesh } from "@/features/workbook/model/solid3dGeometry";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentAnnotation,
  WorkbookDocumentAsset,
  WorkbookDocumentState,
  WorkbookLayer,
  WorkbookLibraryState,
  WorkbookPoint,
  WorkbookSceneLayer,
  WorkbookStroke,
  WorkbookTimerState,
  WorkbookTool,
} from "@/features/workbook/model/types";
import {
  ERASER_RADIUS_MAX,
  ERASER_RADIUS_MIN,
  MAIN_SCENE_LAYER_ID,
  MAIN_SCENE_LAYER_NAME,
  defaultColorByLayer,
  defaultWidthByTool,
} from "./WorkbookSessionPage.core";

export const TEXT_FONT_OPTIONS = [
  { value: "\"Fira Sans\", \"Segoe UI\", sans-serif", label: "Fira Sans" },
  { value: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif", label: "IBM Plex Sans" },
  { value: "\"JetBrains Mono\", \"Fira Mono\", monospace", label: "JetBrains Mono" },
  { value: "\"PT Sans\", \"Segoe UI\", sans-serif", label: "PT Sans" },
];

export const is2dFigureObject = (object: WorkbookBoardObject | null) =>
  Boolean(
    object &&
      (object.type === "rectangle" || object.type === "triangle" || object.type === "polygon")
  );

export const TRANSFORM_PANEL_OBJECT_TYPES = new Set<WorkbookBoardObject["type"]>([
  "solid3d",
  "rectangle",
  "triangle",
  "polygon",
  "ellipse",
  "line",
  "arrow",
  "section_divider",
  "point",
  "text",
]);

export const supportsTransformUtilityPanel = (object: WorkbookBoardObject | null) =>
  Boolean(object && TRANSFORM_PANEL_OBJECT_TYPES.has(object.type));

export const supportsGraphUtilityPanel = (object: WorkbookBoardObject | null) =>
  Boolean(object && object.type === "function_graph");

export const supportsObjectLabelMarkers = (object: WorkbookBoardObject | null) => {
  if (!object) return false;
  if (object.type === "solid3d") {
    const presetId = resolveSolid3dPresetId(
      typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube"
    );
    return !CURVED_SURFACE_ONLY_SOLID_PRESETS.has(presetId);
  }
  if (object.type === "point") return true;
  if (object.type === "rectangle" || object.type === "triangle" || object.type === "polygon") {
    return true;
  }
  if (
    (object.type === "line" || object.type === "arrow") &&
    object.meta?.lineKind === "segment"
  ) {
    return true;
  }
  return false;
};

export const is2dFigureClosed = (object: WorkbookBoardObject) => {
  if (object.type !== "polygon") return true;
  if (!Array.isArray(object.points) || object.points.length < 2) return true;
  return object.meta?.closed !== false;
};

export const resolve2dFigureVertices = (object: WorkbookBoardObject): WorkbookPoint[] => {
  const x = object.x;
  const y = object.y;
  const width = object.width;
  const height = object.height;
  const left = Math.min(x, x + width);
  const right = Math.max(x, x + width);
  const top = Math.min(y, y + height);
  const bottom = Math.max(y, y + height);
  if (object.type === "rectangle") {
    return [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ];
  }
  if (object.type === "triangle") {
    return [
      { x: left + (right - left) / 2, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
    ];
  }
  if (Array.isArray(object.points) && object.points.length >= 2) {
    return object.points;
  }
  const sides = Math.max(3, Math.min(12, Math.floor(object.sides ?? 5)));
  const cx = left + (right - left) / 2;
  const cy = top + (bottom - top) / 2;
  const rx = Math.max(1, (right - left) / 2);
  const ry = Math.max(1, (bottom - top) / 2);
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / sides;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });
};

export const ROUND_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);

export const CURVED_SURFACE_ONLY_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);

export const getSolidSectionPointLimit = (
  presetId: string | null,
  mesh: Solid3dMesh | null
) => {
  if (!mesh) return 8;
  if (presetId && ROUND_SOLID_PRESETS.has(presetId)) return 12;
  return Math.max(4, Math.min(12, mesh.faces.length || mesh.vertices.length || 8));
};

export const getPointsBounds = (points: WorkbookPoint[]) => {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 1, height: 1 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export type ConnectedFigureKind =
  | "segment"
  | "triangle"
  | "square"
  | "rectangle"
  | "rhombus"
  | "trapezoid_right"
  | "trapezoid_isosceles"
  | "trapezoid_scalene"
  | "quadrilateral"
  | "pentagon"
  | "hexagon"
  | "polygon";

export const approxEqual = (left: number, right: number, toleranceRatio = 0.08) =>
  Math.abs(left - right) <= Math.max(1e-2, Math.max(Math.abs(left), Math.abs(right)) * toleranceRatio);

export const vectorSub = (from: WorkbookPoint, to: WorkbookPoint) => ({
  x: to.x - from.x,
  y: to.y - from.y,
});

export const vectorDot = (left: WorkbookPoint, right: WorkbookPoint) => left.x * right.x + left.y * right.y;
export const vectorCross = (left: WorkbookPoint, right: WorkbookPoint) => left.x * right.y - left.y * right.x;
export const vectorLen = (value: WorkbookPoint) => Math.hypot(value.x, value.y);

export const vectorsParallel = (left: WorkbookPoint, right: WorkbookPoint) => {
  const leftLength = vectorLen(left);
  const rightLength = vectorLen(right);
  if (leftLength < 1e-6 || rightLength < 1e-6) return false;
  return Math.abs(vectorCross(left, right)) <= leftLength * rightLength * 0.08;
};

export const vectorsPerpendicular = (left: WorkbookPoint, right: WorkbookPoint) => {
  const leftLength = vectorLen(left);
  const rightLength = vectorLen(right);
  if (leftLength < 1e-6 || rightLength < 1e-6) return false;
  return Math.abs(vectorDot(left, right)) <= leftLength * rightLength * 0.12;
};

export const classifyConnectedFigureKind = (points: WorkbookPoint[]): ConnectedFigureKind => {
  if (points.length <= 1) return "polygon";
  if (points.length === 2) return "segment";
  if (points.length === 3) return "triangle";
  if (points.length === 5) return "pentagon";
  if (points.length === 6) return "hexagon";
  if (points.length !== 4) return "polygon";

  const edges = [
    vectorSub(points[0], points[1]),
    vectorSub(points[1], points[2]),
    vectorSub(points[2], points[3]),
    vectorSub(points[3], points[0]),
  ];
  const lengths = edges.map((edge) => vectorLen(edge));
  const allEqual = lengths.every((length) => approxEqual(length, lengths[0]));

  const oppositePairAParallel = vectorsParallel(edges[0], edges[2]);
  const oppositePairBParallel = vectorsParallel(edges[1], edges[3]);
  const hasRightAngles =
    vectorsPerpendicular(edges[0], edges[1]) &&
    vectorsPerpendicular(edges[1], edges[2]) &&
    vectorsPerpendicular(edges[2], edges[3]) &&
    vectorsPerpendicular(edges[3], edges[0]);

  if (hasRightAngles && allEqual) return "square";
  if (hasRightAngles) return "rectangle";
  if (allEqual) return "rhombus";

  const isTrapezoid = (oppositePairAParallel || oppositePairBParallel) && !(
    oppositePairAParallel && oppositePairBParallel
  );
  if (!isTrapezoid) return "quadrilateral";

  const baseIndices = oppositePairAParallel ? [0, 2] : [1, 3];
  const legIndices = oppositePairAParallel ? [1, 3] : [0, 2];
  const isRight =
    vectorsPerpendicular(edges[baseIndices[0]], edges[legIndices[0]]) ||
    vectorsPerpendicular(edges[baseIndices[0]], edges[legIndices[1]]) ||
    vectorsPerpendicular(edges[baseIndices[1]], edges[legIndices[0]]) ||
    vectorsPerpendicular(edges[baseIndices[1]], edges[legIndices[1]]);
  if (isRight) return "trapezoid_right";

  const isIsosceles = approxEqual(lengths[legIndices[0]], lengths[legIndices[1]]);
  return isIsosceles ? "trapezoid_isosceles" : "trapezoid_scalene";
};

export const getWorkbookObjectTypeLabel = (object: WorkbookBoardObject) => {
  if (object.type === "point") return "Точка";
  if (object.type === "line" || object.type === "arrow") {
    return object.meta?.lineKind === "segment" ? "Отрезок" : "Линия";
  }
  if (object.type === "rectangle") return "Прямоугольник";
  if (object.type === "ellipse") return "Эллипс";
  if (object.type === "triangle") return "Треугольник";
  if (object.type === "polygon") {
    const kind =
      typeof object.meta?.figureKind === "string" ? object.meta.figureKind : "";
    if (kind === "triangle") return "Треугольник";
    if (kind === "square") return "Квадрат";
    if (kind === "rectangle") return "Прямоугольник";
    if (kind === "rhombus") return "Ромб";
    if (kind === "trapezoid_right") return "Прямоугольная трапеция";
    if (kind === "trapezoid_isosceles") return "Равнобедренная трапеция";
    if (kind === "trapezoid_scalene") return "Неравнобедренная трапеция";
    if (kind === "quadrilateral") return "Четырёхугольник";
    if (kind === "pentagon") return "Пятиугольник";
    if (kind === "hexagon") return "Шестиугольник";
    return "Многоугольник";
  }
  if (object.type === "text") return "Текст";
  if (object.type === "section_divider") return "Разделитель";
  if (object.type === "sticker") return "Заметка";
  if (object.type === "solid3d") return "3D-фигура";
  if (object.type === "image") return "Изображение";
  return "Объект";
};

export const getDefaultToolWidth = (targetTool: WorkbookTool) =>
  defaultWidthByTool[targetTool] ?? 3;

export const normalizeSceneLayersForBoard = (
  sourceLayers: WorkbookSceneLayer[] | undefined,
  activeSceneLayerId: string | undefined
) => {
  const unique = (sourceLayers ?? []).reduce<WorkbookSceneLayer[]>((acc, layer) => {
    if (!layer?.id || acc.some((entry) => entry.id === layer.id)) return acc;
    return [...acc, layer];
  }, []);
  if (!unique.some((layer) => layer.id === MAIN_SCENE_LAYER_ID)) {
    unique.unshift({
      id: MAIN_SCENE_LAYER_ID,
      name: MAIN_SCENE_LAYER_NAME,
      createdAt: new Date().toISOString(),
    });
  }
  const resolvedActiveLayerId =
    typeof activeSceneLayerId === "string" &&
    unique.some((layer) => layer.id === activeSceneLayerId)
      ? activeSceneLayerId
      : MAIN_SCENE_LAYER_ID;
  return {
    sceneLayers: unique,
    activeSceneLayerId: resolvedActiveLayerId,
  };
};

export type WorkbookSceneSnapshot = {
  boardStrokes: WorkbookStroke[];
  boardObjects: WorkbookBoardObject[];
  constraints: WorkbookConstraint[];
  annotationStrokes: WorkbookStroke[];
  chatMessages: WorkbookChatMessage[];
  comments: WorkbookComment[];
  timerState: WorkbookTimerState | null;
  boardSettings: WorkbookBoardSettings;
  libraryState: WorkbookLibraryState;
  documentState: WorkbookDocumentState;
};

export type WorkbookHistoryOperation =
  | { kind: "upsert_stroke"; layer: WorkbookLayer; stroke: WorkbookStroke }
  | { kind: "remove_stroke"; layer: WorkbookLayer; strokeId: string }
  | { kind: "upsert_object"; object: WorkbookBoardObject }
  | { kind: "patch_object"; objectId: string; patch: Partial<WorkbookBoardObject> }
  | { kind: "remove_object"; objectId: string }
  | { kind: "upsert_constraint"; constraint: WorkbookConstraint }
  | { kind: "remove_constraint"; constraintId: string }
  | { kind: "patch_board_settings"; patch: Partial<WorkbookBoardSettings> }
  | { kind: "upsert_document_asset"; asset: WorkbookDocumentAsset }
  | { kind: "remove_document_asset"; assetId: string }
  | { kind: "upsert_document_annotation"; annotation: WorkbookDocumentAnnotation }
  | { kind: "remove_document_annotation"; annotationId: string };

export type WorkbookHistoryEntry = {
  forward: WorkbookHistoryOperation[];
  inverse: WorkbookHistoryOperation[];
  page: number;
  createdAt: string;
};

export type ToolPaintSettings = {
  color: string;
  width: number;
};

export type WorkbookPersonalBoardSettings = {
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  eraserRadius: number;
};

export const DEFAULT_PEN_TOOL_SETTINGS: ToolPaintSettings = {
  color: defaultColorByLayer.board,
  width: getDefaultToolWidth("pen"),
};

export const DEFAULT_HIGHLIGHTER_TOOL_SETTINGS: ToolPaintSettings = {
  color: "#c4872f",
  width: getDefaultToolWidth("highlighter"),
};

export const normalizeToolPaintSettings = (
  source: Partial<ToolPaintSettings> | null | undefined,
  fallback: ToolPaintSettings,
  minWidth: number,
  maxWidth: number
): ToolPaintSettings => ({
  color:
    typeof source?.color === "string" && source.color.trim().length > 0
      ? source.color
      : fallback.color,
  width:
    typeof source?.width === "number" && Number.isFinite(source.width)
      ? Math.max(minWidth, Math.min(maxWidth, Math.round(source.width)))
      : fallback.width,
});

export const normalizeWorkbookPersonalBoardSettings = (
  source: Partial<WorkbookPersonalBoardSettings> | null | undefined
): WorkbookPersonalBoardSettings => ({
  penToolSettings: normalizeToolPaintSettings(
    source?.penToolSettings,
    DEFAULT_PEN_TOOL_SETTINGS,
    1,
    18
  ),
  highlighterToolSettings: normalizeToolPaintSettings(
    source?.highlighterToolSettings,
    DEFAULT_HIGHLIGHTER_TOOL_SETTINGS,
    6,
    32
  ),
  eraserRadius:
    typeof source?.eraserRadius === "number" && Number.isFinite(source.eraserRadius)
      ? Math.max(ERASER_RADIUS_MIN, Math.min(ERASER_RADIUS_MAX, Math.round(source.eraserRadius)))
      : getDefaultToolWidth("eraser"),
});
