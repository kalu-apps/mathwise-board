import { generateId } from "@/shared/lib/id";
import type { GraphFunctionDraft } from "./functionGraph";
import { getWorkbookPolygonPoints, type WorkbookPolygonPreset } from "./shapeGeometry";
import { resolveSolid3dPresetId } from "./solid3d";
import { getSolid3dMesh } from "./solid3dGeometry";
import { DEFAULT_SOLID3D_STATE, writeSolid3dState } from "./solid3dState";
import { getFigureVertexLabel, normalizeRect, resolvePolygonFigureKind } from "./sceneGeometry";
import type { WorkbookBoardObject, WorkbookLayer, WorkbookPoint } from "./types";

export type WorkbookShapeDraftTool =
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "text"
  | "compass"
  | "formula"
  | "function_graph"
  | "frame"
  | "divider"
  | "sticker"
  | "comment"
  | "solid3d";

export type WorkbookShapeDraftInput = {
  tool: WorkbookShapeDraftTool;
  start: WorkbookPoint;
  current: WorkbookPoint;
};

type BuildWorkbookShapeObjectParams = {
  draft: WorkbookShapeDraftInput;
  layer: WorkbookLayer;
  color: string;
  width: number;
  authorUserId: string;
  polygonSides: number;
  polygonMode: "regular" | "points";
  polygonPreset?: WorkbookPolygonPreset;
  textPreset: string;
  formulaLatex?: string;
  formulaMathMl?: string;
  graphFunctions?: GraphFunctionDraft[];
  stickerText?: string;
  commentText?: string;
  lineStyle?: "solid" | "dashed";
  solid3dInsertPreset?: {
    presetId: string;
    presetTitle?: string;
  } | null;
};

const ROUND_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);

const getSolidVertexLabel = (index: number) => `V${index + 1}`;

const getRoundSolidSemanticVertexDefaults = (presetId: string, vertexCount = 0) => {
  if (presetId !== "cone" || vertexCount <= 0) return [];
  return Array.from({ length: vertexCount }, (_, index) =>
    index === vertexCount - 1 ? "A" : ""
  );
};

export const buildWorkbookPointObject = (params: {
  point: WorkbookPoint;
  layer: WorkbookLayer;
  color: string;
  width: number;
  authorUserId: string;
}): WorkbookBoardObject => ({
  id: generateId(),
  type: "point",
  layer: params.layer,
  x: params.point.x - 4,
  y: params.point.y - 4,
  width: 8,
  height: 8,
  color: params.color,
  fill: "#ffffff",
  strokeWidth: Math.max(1, params.width),
  opacity: 1,
  authorUserId: params.authorUserId,
  createdAt: new Date().toISOString(),
  meta: {
    label: "",
  },
});

export const buildWorkbookPolygonObjectFromPoints = (params: {
  sourcePoints: WorkbookPoint[];
  layer: WorkbookLayer;
  color: string;
  width: number;
  authorUserId: string;
}): WorkbookBoardObject | null => {
  if (params.sourcePoints.length < 3) return null;
  const xs = params.sourcePoints.map((point) => point.x);
  const ys = params.sourcePoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    id: generateId(),
    type: "polygon",
    layer: params.layer,
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    color: params.color,
    fill: "transparent",
    strokeWidth: params.width,
    opacity: 1,
    points: params.sourcePoints,
    sides: params.sourcePoints.length,
    authorUserId: params.authorUserId,
    createdAt: new Date().toISOString(),
  };
};

export const buildWorkbookShapeObject = (
  params: BuildWorkbookShapeObjectParams
): WorkbookBoardObject => {
  const {
    draft,
    layer,
    color,
    width,
    authorUserId,
    polygonSides,
    polygonMode,
    polygonPreset,
    textPreset,
    formulaLatex,
    formulaMathMl,
    graphFunctions,
    stickerText,
    commentText,
    lineStyle,
    solid3dInsertPreset,
  } = params;

  const rect = normalizeRect(draft.start, draft.current);
  const fromCenterRadius = Math.max(
    1,
    Math.hypot(draft.current.x - draft.start.x, draft.current.y - draft.start.y)
  );
  const compassRect =
    draft.tool === "compass"
      ? {
          x: draft.start.x - fromCenterRadius,
          y: draft.start.y - fromCenterRadius,
          width: fromCenterRadius * 2,
          height: fromCenterRadius * 2,
        }
      : rect;
  const objectType =
    draft.tool === "text"
      ? "text"
      : draft.tool === "formula"
        ? "formula"
        : draft.tool === "function_graph"
          ? "function_graph"
          : draft.tool === "solid3d"
            ? "solid3d"
            : draft.tool === "frame"
              ? "frame"
              : draft.tool === "divider"
                ? "section_divider"
                : draft.tool === "sticker"
                  ? "sticker"
                  : draft.tool === "comment"
                    ? "comment"
                    : draft.tool === "compass"
                      ? "ellipse"
                      : draft.tool;
  const polygonPoints =
    draft.tool === "polygon" && polygonMode === "regular"
      ? getWorkbookPolygonPoints(compassRect, polygonSides, polygonPreset)
      : undefined;
  const figureVertices =
    draft.tool === "rectangle"
      ? 4
      : draft.tool === "triangle"
        ? 3
        : draft.tool === "polygon"
          ? polygonPoints?.length ?? Math.max(3, Math.floor(polygonSides))
          : 0;
  const defaultFigureMeta =
    figureVertices > 0
      ? {
          vertexLabels: Array.from({ length: figureVertices }, (_, index) =>
            getFigureVertexLabel(index)
          ),
          showAngles: false,
          angleMarks: Array.from({ length: figureVertices }, () => ({
            valueText: "",
            color,
            style: "arc_single" as const,
          })),
        }
      : undefined;
  const isLineTool = draft.tool === "line" || draft.tool === "arrow";
  const lineDeltaX = draft.current.x - draft.start.x;
  const lineDeltaY = draft.current.y - draft.start.y;
  const hasLineLength = Math.hypot(lineDeltaX, lineDeltaY) > 0.25;
  const solid3dPresetId = resolveSolid3dPresetId(solid3dInsertPreset?.presetId ?? "cube");
  const solid3dPresetTitle =
    typeof solid3dInsertPreset?.presetTitle === "string" &&
    solid3dInsertPreset.presetTitle.trim().length > 0
      ? solid3dInsertPreset.presetTitle.trim()
      : null;
  const solid3dWidth = Math.max(140, compassRect.width);
  const solid3dHeight = Math.max(120, compassRect.height);
  const solid3dMesh =
    draft.tool === "solid3d"
      ? getSolid3dMesh(solid3dPresetId, solid3dWidth, solid3dHeight)
      : null;
  const initialSolid3dState =
    draft.tool === "solid3d"
      ? {
          ...DEFAULT_SOLID3D_STATE,
          vertexLabels: ROUND_SOLID_PRESETS.has(solid3dPresetId)
            ? getRoundSolidSemanticVertexDefaults(
                solid3dPresetId,
                solid3dMesh?.vertices.length ?? 0
              )
            : Array.from(
                { length: solid3dMesh?.vertices.length ?? 0 },
                (_, index) => getSolidVertexLabel(index)
              ),
        }
      : null;

  return {
    id: generateId(),
    type: objectType,
    layer,
    x:
      draft.tool === "divider"
        ? 0
        : isLineTool
          ? draft.start.x
          : compassRect.x,
    y:
      draft.tool === "divider"
        ? Math.min(draft.start.y, draft.current.y)
        : isLineTool
          ? draft.start.y
          : compassRect.y,
    width:
      draft.tool === "divider"
        ? 10_000
        : isLineTool
          ? hasLineLength
            ? lineDeltaX
            : 1
          : draft.tool === "solid3d"
            ? solid3dWidth
            : draft.tool === "text"
              ? Math.max(140, compassRect.width)
              : compassRect.width,
    height:
      draft.tool === "divider"
        ? 2
        : isLineTool
          ? hasLineLength
            ? lineDeltaY
            : 0
          : draft.tool === "solid3d"
            ? solid3dHeight
            : draft.tool === "text"
              ? Math.max(48, compassRect.height)
              : compassRect.height,
    color,
    fill:
      draft.tool === "sticker"
        ? "rgba(255, 244, 163, 0.92)"
        : draft.tool === "comment"
          ? "rgba(226, 240, 255, 0.95)"
          : draft.tool === "frame"
            ? "rgba(77, 105, 255, 0.05)"
            : draft.tool === "divider"
              ? "transparent"
              : "transparent",
    strokeWidth: width,
    opacity: 1,
    authorUserId,
    createdAt: new Date().toISOString(),
    text:
      draft.tool === "text"
        ? (textPreset.trim() || "Текст")
        : draft.tool === "formula"
          ? (formulaLatex?.trim() || formulaMathMl?.trim() || "f(x)=...")
          : draft.tool === "sticker"
            ? (stickerText?.trim() || "Стикер")
            : draft.tool === "comment"
              ? (commentText?.trim() || "Комментарий")
              : undefined,
    fontSize: draft.tool === "text" ? Math.max(14, width * 5) : undefined,
    sides: draft.tool === "polygon" ? polygonSides : undefined,
    points: polygonPoints,
    meta:
      draft.tool === "text"
        ? {
            textColor: color,
            textBackground: "transparent",
            textBold: false,
            textItalic: false,
            textUnderline: false,
            textAlign: "left",
            textFontFamily: "\"Fira Sans\", \"Segoe UI\", sans-serif",
          }
        : draft.tool === "formula"
          ? {
              latex: formulaLatex?.trim() ?? "",
              mathml: formulaMathMl?.trim() ?? "",
            }
          : draft.tool === "function_graph"
            ? {
                functions: graphFunctions,
                axisColor: "#ff8e3c",
                planeColor: "transparent",
              }
            : draft.tool === "line" || draft.tool === "arrow"
              ? {
                  lineKind: "line",
                  lineStyle,
                  arrowEnd: draft.tool === "arrow",
                  curve: {
                    c1t: 1 / 3,
                    c1n: 0,
                    c2t: 2 / 3,
                    c2n: 0,
                  },
                  startLabel: "",
                  endLabel: "",
                }
              : draft.tool === "polygon"
                ? {
                    polygonMode,
                    polygonPreset,
                    ...(resolvePolygonFigureKind(polygonSides, polygonPreset)
                      ? {
                          figureKind: resolvePolygonFigureKind(
                            polygonSides,
                            polygonPreset
                          ),
                        }
                      : {}),
                    ...(defaultFigureMeta ?? {}),
                  }
                : draft.tool === "rectangle" || draft.tool === "triangle"
                  ? defaultFigureMeta
                  : draft.tool === "frame"
                    ? {
                        title: textPreset.trim() || "Фрейм",
                      }
                    : draft.tool === "solid3d"
                      ? {
                          presetId: solid3dPresetId,
                          presetTitle: solid3dPresetTitle,
                          ...writeSolid3dState(
                            initialSolid3dState ?? DEFAULT_SOLID3D_STATE,
                            undefined
                          ),
                        }
                      : draft.tool === "divider"
                        ? { dividerType: "manual", lineStyle: "dashed" }
                        : undefined,
  };
};

export const buildWorkbookShapeCommitResult = (params: BuildWorkbookShapeObjectParams) => {
  const created = buildWorkbookShapeObject(params);
  return {
    created,
    inlineTextEdit:
      params.draft.tool === "text"
        ? {
            objectId: created.id,
            value: typeof created.text === "string" ? created.text : "",
          }
        : null,
    shouldConsumeSolid3dInsert: params.draft.tool === "solid3d",
  };
};
