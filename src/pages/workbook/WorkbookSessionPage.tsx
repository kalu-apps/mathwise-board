import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import "./workbookRouteStyles";
import {
  Alert,
  Avatar,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
  TextField,
  useMediaQuery,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ContentCutRoundedIcon from "@mui/icons-material/ContentCutRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import SentimentSatisfiedRoundedIcon from "@mui/icons-material/SentimentSatisfiedRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import CreateRoundedIcon from "@mui/icons-material/CreateRounded";
import BorderColorRoundedIcon from "@mui/icons-material/BorderColorRounded";
import PanToolRoundedIcon from "@mui/icons-material/PanToolRounded";
import AdsClickRoundedIcon from "@mui/icons-material/AdsClickRounded";
import HorizontalRuleRoundedIcon from "@mui/icons-material/HorizontalRuleRounded";
import DragHandleRoundedIcon from "@mui/icons-material/DragHandleRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import PentagonRoundedIcon from "@mui/icons-material/PentagonRounded";
import TextFieldsRoundedIcon from "@mui/icons-material/TextFieldsRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import MyLocationRoundedIcon from "@mui/icons-material/MyLocationRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";
import CenterFocusStrongRoundedIcon from "@mui/icons-material/CenterFocusStrongRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import UnfoldLessRoundedIcon from "@mui/icons-material/UnfoldLessRounded";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import ShowChartRoundedIcon from "@mui/icons-material/ShowChartRounded";
import KeyboardDoubleArrowDownRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowDownRounded";
import { useAuth } from "@/features/auth/model/AuthContext";
import {
  appendWorkbookEvents,
  appendWorkbookLiveEvents,
  createWorkbookInvite,
  getWorkbookEvents,
  getWorkbookSession,
  getWorkbookSnapshot,
  heartbeatWorkbookPresence,
  leaveWorkbookPresence,
  openWorkbookSession,
  recognizeWorkbookInk,
  renderWorkbookPdfPages,
  saveWorkbookSnapshot,
  subscribeWorkbookEventsStream,
  subscribeWorkbookLiveSocket,
} from "@/features/workbook/model/api";
import {
  type WorkbookClientEventInput,
  isDirtyWorkbookEventType,
  isHistoryTrackedWorkbookEventType,
  isLiveReplayableWorkbookEventType,
  isOptimisticWorkbookEventType,
  isVolatileWorkbookEventType,
} from "@/features/workbook/model/events";
import {
  compactWorkbookObjectUpdateEvents,
  hasWorkbookEventGap,
  mergeBoardObjectWithPatch,
  mergePreviewPathPoints,
  resolveNextLatestSeq,
  withWorkbookClientEventIds,
} from "@/features/workbook/model/runtime";
import {
  observeWorkbookRealtimeApply,
  observeWorkbookRealtimeGap,
  observeWorkbookRealtimePersistAck,
  observeWorkbookRealtimeReceive,
  observeWorkbookRealtimeSend,
} from "@/features/workbook/model/realtimeObservability";
import { startWorkbookPerformanceSession } from "@/features/workbook/model/workbookPerformance";
import {
  buildWorkbookDocumentAsset,
  buildWorkbookDocumentBoardObject,
  buildWorkbookSnapshotBoardObject,
  buildWorkbookSyncedDocumentAsset,
  resolvePrimaryDocumentRenderedPage,
  resolveWorkbookBoardInsertPosition,
} from "@/features/workbook/model/documentAssets";
import {
  getObjectExportBounds,
  getStrokeExportBounds,
  mergeExportBounds,
  padExportBounds,
  resolvePdfPagePlacement,
  resolveWorkbookPdfExportPlan,
  type WorkbookExportBounds,
} from "@/features/workbook/model/export";
import {
  formatFileSizeMb,
  isImageUploadFile,
  isPdfUploadFile,
  optimizeImageDataUrl,
  readFileAsDataUrl,
  WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
  WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
  WORKBOOK_IMAGE_IMPORT_MAX_BYTES,
  WORKBOOK_PDF_IMPORT_MAX_BYTES,
} from "@/features/workbook/model/media";
import { applyWorkbookIncomingRealtimeEvent } from "@/features/workbook/model/incomingRealtime";
import { applyWorkbookIncomingSessionMetaEvent } from "@/features/workbook/model/incomingSessionMeta";
import type {
  WorkbookBoardSettings,
  WorkbookBoardObject,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
  WorkbookDocumentAnnotation,
  WorkbookDocumentAsset,
  WorkbookDocumentState,
  WorkbookEvent,
  WorkbookLayer,
  WorkbookLibraryState,
  WorkbookPoint,
  WorkbookSceneLayer,
  WorkbookSession,
  WorkbookSessionParticipant,
  WorkbookSessionSettings,
  WorkbookTimerState,
  WorkbookStroke,
  WorkbookTool,
} from "@/features/workbook/model/types";
import {
  createEmptyScene,
  encodeScenePayload,
  normalizeChatMessagePayload,
  normalizeDocumentAnnotationPayload,
  normalizeDocumentAssetPayload,
  normalizeObjectPayload,
  normalizeScenePayload,
  normalizeStrokePayload,
} from "@/features/workbook/model/scene";
import { WorkbookCanvas } from "@/features/workbook/ui/WorkbookCanvas";
import {
  SOLID3D_PRESETS,
  getSolid3dTemplate,
  resolveSolid3dPresetId,
} from "@/features/workbook/model/solid3d";
import {
  computeSectionPolygon,
  getSolid3dMesh,
  type Solid3dMesh,
} from "@/features/workbook/model/solid3dGeometry";
import {
  readSolid3dState,
  type Solid3dSectionPoint,
  type Solid3dState,
  type Solid3dSectionState,
  writeSolid3dState,
} from "@/features/workbook/model/solid3dState";
import {
  GRAPH_FUNCTION_COLORS,
  normalizeGraphScale,
  normalizeFunctionExpression,
  sanitizeFunctionGraphDrafts,
  validateFunctionExpression,
  type GraphFunctionDraft,
} from "@/features/workbook/model/functionGraph";
import {
  getWorkbookPolygonPoints,
  toSvgPointString,
  type WorkbookPolygonPreset,
} from "@/features/workbook/model/shapeGeometry";
import {
  normalizeShapeAngleMarks,
  type WorkbookShapeAngleMark,
  type WorkbookShapeAngleMarkStyle,
} from "@/features/workbook/model/shapeAngleMarks";
import {
  recognizeSmartInkBatch,
  recognizeSmartInkStroke,
  type SmartInkDetectedResult,
} from "@/features/workbook/model/smartInk";
import { PageLoader } from "@/shared/ui/loading";
import { generateId } from "@/shared/lib/id";
import { readStorage, writeStorage } from "@/shared/lib/localDb";
import { ApiError } from "@/shared/api/client";
import { useWorkbookLivekit } from "./useWorkbookLivekit";
import {
  DEFAULT_SMART_INK_OPTIONS,
  normalizeSmartInkOptions,
  type SmartInkOptions,
} from "./workbookBoardSettingsModel";

const WorkbookSessionBoardSettingsPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionBoardSettingsPanel")).WorkbookSessionBoardSettingsPanel,
}));

const WorkbookSessionDocsWindow = lazy(async () => ({
  default: (await import("./WorkbookSessionDocsWindow")).WorkbookSessionDocsWindow,
}));

const WorkbookSessionGraphPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionGraphPanel")).WorkbookSessionGraphPanel,
}));

const WorkbookSessionLayersPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionLayersPanel")).WorkbookSessionLayersPanel,
}));

const WorkbookSessionParticipantsPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionParticipantsPanel")).WorkbookSessionParticipantsPanel,
}));

const WorkbookSessionTransformPanel = lazy(async () => ({
  default: (await import("./WorkbookSessionTransformPanel")).WorkbookSessionTransformPanel,
}));

const POLL_INTERVAL_MS = 220;
const POLL_INTERVAL_STREAM_CONNECTED_MS = 180;
const PRESENCE_INTERVAL_MS = 1_000;
const AUTOSAVE_INTERVAL_MS = 15_000;
const CONTEXTBAR_DOCKED_VIEWPORT_MAX_WIDTH = 1024;
const OBJECT_UPDATE_FLUSH_INTERVAL_MS = 16;
const VOLATILE_SYNC_FLUSH_INTERVAL_MS = 16;
const STROKE_PREVIEW_EXPIRY_MS = 3_000;
const ERASER_PREVIEW_EXPIRY_MS = 600;
const ERASER_PREVIEW_END_EXPIRY_MS = 900;
const CONTEXTBAR_VIEWPORT_MARGIN_PX = 12;
const ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX = 1.2;
const VIEWPORT_SYNC_MIN_INTERVAL_MS = 18;
const VIEWPORT_SYNC_EPSILON = 0.2;
const MAX_INCOMING_PREVIEW_PATCHES_PER_OBJECT = 20;
const ERASER_RADIUS_MIN = 4;
const ERASER_RADIUS_MAX = 160;
const MAX_EXPORT_CANVAS_SIDE = 8192;
const SESSION_CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 28;
const MAIN_SCENE_LAYER_ID = "main";
const MAIN_SCENE_LAYER_NAME = "Основной слой";
const WORKBOOK_CHAT_EMOJIS = [
  "👍",
  "✅",
  "👏",
  "🔥",
  "💡",
  "🤝",
  "🙂",
  "😊",
  "🎯",
  "📌",
  "💬",
  "🧠",
  "⭐",
  "📚",
  "📝",
  "📐",
  "📎",
  "🚀",
  "💥",
  "🙌",
  "👌",
  "😎",
  "🤔",
  "❗",
  "❓",
  "🎓",
  "🧩",
  "📈",
  "🔍",
  "⏱️",
];

const parseChatTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const defaultColorByLayer: Record<WorkbookLayer, string> = {
  board: "#4f63ff",
  annotations: "#ff8e3c",
};

const defaultWidthByTool: Partial<Record<WorkbookTool, number>> = {
  area_select: 2,
  pen: 3,
  highlighter: 12,
  eraser: 14,
  function_graph: 2,
  compass: 2,
  point: 3,
  line: 3,
  arrow: 3,
  rectangle: 3,
  ellipse: 3,
  triangle: 3,
  polygon: 3,
  text: 3,
  frame: 2,
  divider: 2,
  sticker: 2,
  comment: 2,
};

const DEFAULT_SETTINGS: WorkbookSessionSettings = {
  undoPolicy: "teacher_only",
  strictGeometry: false,
  smartInk: DEFAULT_SMART_INK_OPTIONS,
  studentControls: {
    canDraw: true,
    canSelect: true,
    canDelete: false,
    canInsertImage: true,
    canClear: false,
    canExport: true,
    canUseLaser: true,
  },
};

const DEFAULT_BOARD_SETTINGS: WorkbookBoardSettings = {
  title: "Рабочая тетрадь",
  showGrid: true,
  gridSize: 22,
  gridColor: "rgba(92, 129, 192, 0.32)",
  backgroundColor: "#ffffff",
  snapToGrid: false,
  smartInk: DEFAULT_SMART_INK_OPTIONS,
  showPageNumbers: false,
  currentPage: 1,
  pagesCount: 1,
  activeFrameId: null,
  autoSectionDividers: false,
  dividerStep: 960,
  sceneLayers: [
    {
      id: MAIN_SCENE_LAYER_ID,
      name: MAIN_SCENE_LAYER_NAME,
      createdAt: new Date().toISOString(),
    },
  ],
  activeSceneLayerId: MAIN_SCENE_LAYER_ID,
};

const DEFAULT_LIBRARY: WorkbookLibraryState = {
  folders: [],
  items: [],
  formulas: [],
  templates: [],
};

const FALLBACK_PERMISSIONS: WorkbookSessionParticipant["permissions"] = {
  canDraw: false,
  canAnnotate: false,
  canUseMedia: true,
  canUseChat: false,
  canInvite: false,
  canManageSession: false,
  canSelect: false,
  canDelete: false,
  canInsertImage: false,
  canClear: false,
  canExport: false,
  canUseLaser: false,
};

const getSectionPointLabel = (index: number) => `P${index + 1}`;
const getSolidVertexLabel = (index: number) => `V${index + 1}`;

const makeUniqueSectionPointLabel = (
  desired: string,
  fallback: string,
  used: Set<string>
) => {
  const baseRaw = desired.trim().slice(0, 16) || fallback;
  const base = baseRaw.slice(0, 16) || fallback;
  let candidate = base;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = String(counter);
    const trimmedBase = base.slice(0, Math.max(1, 16 - suffix.length));
    candidate = `${trimmedBase}${suffix}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const ensureUniqueSectionPointLabels = (points: Solid3dSectionPoint[]) => {
  const used = new Set<string>();
  return points.map((point, index) => ({
    ...point,
    label: makeUniqueSectionPointLabel(
      point.label ?? "",
      getSectionPointLabel(index),
      used
    ),
  }));
};

const getFigureVertexLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length)}`;
};

const getSectionVertexLabel = (index: number) => getFigureVertexLabel(index);

const collectBoardObjectLabels = (object: WorkbookBoardObject) => {
  const labels: string[] = [];
  if (object.type === "line" || object.type === "arrow") {
    if (typeof object.meta?.startLabel === "string") {
      labels.push(object.meta.startLabel);
    }
    if (typeof object.meta?.endLabel === "string") {
      labels.push(object.meta.endLabel);
    }
  }
  if (object.type === "point" && typeof object.meta?.label === "string") {
    labels.push(object.meta.label);
  }
  if (Array.isArray(object.meta?.vertexLabels)) {
    object.meta.vertexLabels.forEach((label) => {
      if (typeof label === "string") {
        labels.push(label);
      }
    });
  }
  if (Array.isArray(object.meta?.sections)) {
    object.meta.sections.forEach((section: unknown) => {
      if (!section || typeof section !== "object") return;
      const typedSection = section as { vertexLabels?: unknown };
      if (!Array.isArray(typedSection.vertexLabels)) return;
      typedSection.vertexLabels.forEach((label: unknown) => {
        if (typeof label === "string") {
          labels.push(label);
        }
      });
    });
  }
  return labels.map((label) => label.trim().toLowerCase()).filter(Boolean);
};

const getNextUniqueBoardLabel = (used: Set<string>, indexSeed: number) => {
  let attempt = Math.max(0, indexSeed);
  while (attempt < 4096) {
    const base = getFigureVertexLabel(attempt);
    if (!used.has(base.toLowerCase())) {
      used.add(base.toLowerCase());
      return base;
    }
    attempt += 1;
  }
  const fallback = `P${indexSeed + 1}`;
  used.add(fallback.toLowerCase());
  return fallback;
};

const clampGraphOffset = (value: number) => Math.max(-999, Math.min(999, value));

const cloneSerializable = <T,>(value: T): T => structuredClone(value);

const areSerializableValuesEqual = (left: unknown, right: unknown) => {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const normalizeMetaRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const buildBoardObjectDiffPatch = (
  previous: WorkbookBoardObject,
  next: WorkbookBoardObject
): Partial<WorkbookBoardObject> | null => {
  const patch: Partial<WorkbookBoardObject> = {};
  const patchRecord = patch as Record<string, unknown>;
  const mutableKeys: Array<keyof WorkbookBoardObject> = [
    "x",
    "y",
    "width",
    "height",
    "rotation",
    "color",
    "fill",
    "strokeWidth",
    "opacity",
    "points",
    "text",
    "fontSize",
    "imageUrl",
    "imageName",
    "sides",
    "page",
    "pinned",
    "locked",
  ];
  mutableKeys.forEach((key) => {
    if (!areSerializableValuesEqual(previous[key], next[key])) {
      patchRecord[key] = cloneSerializable(next[key]);
    }
  });
  const previousMeta = normalizeMetaRecord(previous.meta);
  const nextMeta = normalizeMetaRecord(next.meta);
  const changedMetaKeys = Array.from(
    new Set([...Object.keys(previousMeta), ...Object.keys(nextMeta)])
  ).filter((key) => !areSerializableValuesEqual(previousMeta[key], nextMeta[key]));
  if (changedMetaKeys.length > 0) {
    patch.meta = changedMetaKeys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = cloneSerializable(nextMeta[key]);
      return acc;
    }, {});
  }
  return Object.keys(patch).length > 0 ? patch : null;
};

const buildBoardSettingsDiffPatch = (
  previous: WorkbookBoardSettings,
  next: WorkbookBoardSettings
): Partial<WorkbookBoardSettings> | null => {
  const patch: Partial<WorkbookBoardSettings> = {};
  const patchRecord = patch as Record<string, unknown>;
  (Object.keys(next) as Array<keyof WorkbookBoardSettings>).forEach((key) => {
    if (!areSerializableValuesEqual(previous[key], next[key])) {
      patchRecord[key] = cloneSerializable(next[key]);
    }
  });
  return Object.keys(patch).length > 0 ? patch : null;
};

const resolveGraphFunctionsFromObject = (object: WorkbookBoardObject): GraphFunctionDraft[] => {
  if (object.type !== "function_graph") return [];
  const raw = Array.isArray(object.meta?.functions) ? object.meta.functions : [];
  return raw.reduce<GraphFunctionDraft[]>((acc, item, index) => {
    if (!item || typeof item !== "object") return acc;
    const typed = item as Partial<GraphFunctionDraft>;
    const expression =
      typeof typed.expression === "string"
        ? normalizeFunctionExpression(typed.expression)
        : "";
    if (!expression) return acc;
    return [
      ...acc,
      {
        id: typeof typed.id === "string" && typed.id ? typed.id : generateId(),
        expression,
        color:
          typeof typed.color === "string" && typed.color
            ? typed.color
            : GRAPH_FUNCTION_COLORS[index % GRAPH_FUNCTION_COLORS.length],
        visible: typed.visible !== false,
        dashed: Boolean(typed.dashed),
        width:
          typeof typed.width === "number" && Number.isFinite(typed.width)
            ? Math.max(1, Math.min(6, typed.width))
            : 2,
        offsetX:
          typeof typed.offsetX === "number" && Number.isFinite(typed.offsetX)
            ? clampGraphOffset(typed.offsetX)
            : 0,
        offsetY:
          typeof typed.offsetY === "number" && Number.isFinite(typed.offsetY)
            ? clampGraphOffset(typed.offsetY)
            : 0,
        scaleX: normalizeGraphScale(typed.scaleX ?? 1, 1),
        scaleY: normalizeGraphScale(typed.scaleY ?? 1, 1),
      },
    ];
  }, []);
};

const areGraphFunctionDraftListsEqual = (
  left: GraphFunctionDraft[],
  right: GraphFunctionDraft[]
) => {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const next = right[index];
    if (!next) return false;
    return (
      item.id === next.id &&
      item.expression === next.expression &&
      item.color === next.color &&
      item.visible === next.visible &&
      item.dashed === next.dashed &&
      (item.width ?? 2) === (next.width ?? 2) &&
      (item.offsetX ?? 0) === (next.offsetX ?? 0) &&
      (item.offsetY ?? 0) === (next.offsetY ?? 0) &&
      (item.scaleX ?? 1) === (next.scaleX ?? 1) &&
      (item.scaleY ?? 1) === (next.scaleY ?? 1)
    );
  });
};

const TEXT_FONT_OPTIONS = [
  { value: "\"Fira Sans\", \"Segoe UI\", sans-serif", label: "Fira Sans" },
  { value: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif", label: "IBM Plex Sans" },
  { value: "\"JetBrains Mono\", \"Fira Mono\", monospace", label: "JetBrains Mono" },
  { value: "\"PT Sans\", \"Segoe UI\", sans-serif", label: "PT Sans" },
];

const is2dFigureObject = (object: WorkbookBoardObject | null) =>
  Boolean(
    object &&
      (object.type === "rectangle" || object.type === "triangle" || object.type === "polygon")
  );

const TRANSFORM_PANEL_OBJECT_TYPES = new Set<WorkbookBoardObject["type"]>([
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

const supportsTransformUtilityPanel = (object: WorkbookBoardObject | null) =>
  Boolean(object && TRANSFORM_PANEL_OBJECT_TYPES.has(object.type));

const supportsGraphUtilityPanel = (object: WorkbookBoardObject | null) =>
  Boolean(object && object.type === "function_graph");

const supportsObjectLabelMarkers = (object: WorkbookBoardObject | null) => {
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

const is2dFigureClosed = (object: WorkbookBoardObject) => {
  if (object.type !== "polygon") return true;
  if (!Array.isArray(object.points) || object.points.length < 2) return true;
  return object.meta?.closed !== false;
};

const resolve2dFigureVertices = (object: WorkbookBoardObject): WorkbookPoint[] => {
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

const ROUND_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);

const CURVED_SURFACE_ONLY_SOLID_PRESETS = new Set([
  "cylinder",
  "cone",
  "truncated_cone",
  "sphere",
  "hemisphere",
  "torus",
]);

const getSolidSectionPointLimit = (
  presetId: string | null,
  mesh: Solid3dMesh | null
) => {
  if (!mesh) return 8;
  if (presetId && ROUND_SOLID_PRESETS.has(presetId)) return 12;
  return Math.max(4, Math.min(12, mesh.faces.length || mesh.vertices.length || 8));
};

const getPointsBounds = (points: WorkbookPoint[]) => {
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

type ConnectedFigureKind =
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

const approxEqual = (left: number, right: number, toleranceRatio = 0.08) =>
  Math.abs(left - right) <= Math.max(1e-2, Math.max(Math.abs(left), Math.abs(right)) * toleranceRatio);

const vectorSub = (from: WorkbookPoint, to: WorkbookPoint) => ({
  x: to.x - from.x,
  y: to.y - from.y,
});

const vectorDot = (left: WorkbookPoint, right: WorkbookPoint) => left.x * right.x + left.y * right.y;
const vectorCross = (left: WorkbookPoint, right: WorkbookPoint) => left.x * right.y - left.y * right.x;
const vectorLen = (value: WorkbookPoint) => Math.hypot(value.x, value.y);

const vectorsParallel = (left: WorkbookPoint, right: WorkbookPoint) => {
  const leftLength = vectorLen(left);
  const rightLength = vectorLen(right);
  if (leftLength < 1e-6 || rightLength < 1e-6) return false;
  return Math.abs(vectorCross(left, right)) <= leftLength * rightLength * 0.08;
};

const vectorsPerpendicular = (left: WorkbookPoint, right: WorkbookPoint) => {
  const leftLength = vectorLen(left);
  const rightLength = vectorLen(right);
  if (leftLength < 1e-6 || rightLength < 1e-6) return false;
  return Math.abs(vectorDot(left, right)) <= leftLength * rightLength * 0.12;
};

const classifyConnectedFigureKind = (points: WorkbookPoint[]): ConnectedFigureKind => {
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

const getWorkbookObjectTypeLabel = (object: WorkbookBoardObject) => {
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

const getDefaultToolWidth = (targetTool: WorkbookTool) =>
  defaultWidthByTool[targetTool] ?? 3;

const normalizeSceneLayersForBoard = (
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

const SolidPresetPreview = ({ presetId }: { presetId: string }) => {
  const template = getSolid3dTemplate(presetId);
  const isRoundPreset =
    presetId === "cylinder" ||
    presetId === "cone" ||
    presetId === "truncated_cone" ||
    presetId === "sphere" ||
    presetId === "hemisphere" ||
    presetId === "torus";
  const mapX = (value: number) => 10 + (value / 100) * 100;
  const mapY = (value: number) => 10 + (value / 100) * 80;
  const pathArc = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    part: "front" | "back"
  ) => {
    const sweep = part === "front" ? 0 : 1;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 ${sweep} ${cx + rx} ${cy}`;
  };

  return (
    <svg viewBox="0 0 120 100" role="img" aria-hidden="true">
      {!isRoundPreset
        ? (
            <>
              {template.faces?.map((face, index) => (
                <polygon
                  key={`face-${template.id}-${index}`}
                  points={face.points
                    .map((point) => `${mapX(point.x)},${mapY(point.y)}`)
                    .join(" ")}
                  fill="rgba(63, 78, 145, 0.12)"
                  stroke="none"
                />
              ))}
              {template.segments.map((segment, index) => (
                <line
                  key={`segment-${template.id}-${index}`}
                  x1={mapX(segment.from.x)}
                  y1={mapY(segment.from.y)}
                  x2={mapX(segment.to.x)}
                  y2={mapY(segment.to.y)}
                  stroke="#111827"
                  strokeWidth={2}
                  strokeDasharray={segment.hidden ? "6 5" : undefined}
                  strokeLinecap="round"
                />
              ))}
            </>
          )
        : null}
      {presetId === "cylinder" ? (
        <>
          <ellipse cx={60} cy={30} rx={24} ry={7} fill="none" stroke="#111827" strokeWidth={2} />
          <line x1={36} y1={30} x2={36} y2={74} stroke="#111827" strokeWidth={2} />
          <line x1={84} y1={30} x2={84} y2={74} stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 74, 24, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 74, 24, 7, "back")} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="6 5" />
        </>
      ) : null}
      {presetId === "cone" ? (
        <>
          <line x1={60} y1={18} x2={36} y2={76} stroke="#111827" strokeWidth={2} />
          <line x1={60} y1={18} x2={84} y2={76} stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 76, 24, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 76, 24, 7, "back")} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="6 5" />
        </>
      ) : null}
      {presetId === "truncated_cone" ? (
        <>
          <ellipse cx={60} cy={28} rx={13} ry={4} fill="none" stroke="#111827" strokeWidth={2} />
          <line x1={47} y1={28} x2={36} y2={76} stroke="#111827" strokeWidth={2} />
          <line x1={73} y1={28} x2={84} y2={76} stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 76, 24, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 76, 24, 7, "back")} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="6 5" />
        </>
      ) : null}
      {presetId === "sphere" ? (
        <>
          <circle cx={60} cy={50} r={28} fill="rgba(63, 78, 145, 0.08)" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 50, 28, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 50, 28, 7, "back")} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="6 5" />
        </>
      ) : null}
      {presetId === "hemisphere" ? (
        <>
          <path d="M 32 58 A 28 28 0 0 1 88 58" fill="rgba(63, 78, 145, 0.08)" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 58, 28, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 58, 28, 7, "back")} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="6 5" />
        </>
      ) : null}
      {presetId === "torus" ? (
        <>
          <ellipse cx={60} cy={50} rx={30} ry={18} fill="rgba(63, 78, 145, 0.06)" stroke="#111827" strokeWidth={2} />
          <ellipse cx={60} cy={50} rx={14} ry={8} fill="none" stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 50, 30, 8, "back")} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="6 5" />
        </>
      ) : null}
    </svg>
  );
};

const ShapeCatalogPreview = ({
  variant,
  sides = 5,
}: {
  variant:
    | "polygon"
    | "rectangle"
    | "ellipse"
    | "polyline"
    | "trapezoid"
    | "trapezoid_right"
    | "trapezoid_scalene"
    | "rhombus";
  sides?: number;
}) => {
  const previewPolygonPoints =
    variant === "polygon" ||
    variant === "trapezoid" ||
    variant === "trapezoid_right" ||
    variant === "trapezoid_scalene" ||
    variant === "rhombus"
      ? toSvgPointString(
          getWorkbookPolygonPoints(
            { x: 16, y: 22, width: 68, height: 56 },
            sides,
            (variant === "polygon" ? "regular" : variant) as WorkbookPolygonPreset
          )
        )
      : null;
  if (variant === "rectangle") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <rect
          x={16}
          y={24}
          width={68}
          height={52}
          rx={8}
          ry={8}
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
          strokeWidth={5}
        />
      </svg>
    );
  }
  if (variant === "ellipse") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <ellipse
          cx={50}
          cy={50}
          rx={33}
          ry={25}
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
          strokeWidth={5}
        />
      </svg>
    );
  }
  if (variant === "polyline") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <polyline
          points="14,70 30,38 47,62 62,28 83,54"
          fill="none"
          stroke="#4f63ff"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={14} cy={70} r={3.5} fill="#4f63ff" />
        <circle cx={83} cy={54} r={3.5} fill="#4f63ff" />
      </svg>
    );
  }
  if (variant === "trapezoid") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <polygon
          points={previewPolygonPoints ?? ""}
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
          strokeWidth={5}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (variant === "trapezoid_right") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <polygon
          points={previewPolygonPoints ?? ""}
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
          strokeWidth={5}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (variant === "trapezoid_scalene") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <polygon
          points={previewPolygonPoints ?? ""}
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
          strokeWidth={5}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (variant === "rhombus") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <polygon
          points={previewPolygonPoints ?? ""}
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
          strokeWidth={5}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
      <polygon
        points={previewPolygonPoints ?? ""}
        fill="rgba(79, 99, 255, 0.08)"
        stroke="#4f63ff"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
};

type ClearRequest = {
  requestId: string;
  targetLayer: WorkbookLayer;
  authorUserId: string;
};

type DocsWindowState = {
  open: boolean;
  pinned: boolean;
  maximized: boolean;
};

type WorkbookSceneSnapshot = {
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

type WorkbookHistoryOperation =
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

type WorkbookHistoryEntry = {
  forward: WorkbookHistoryOperation[];
  inverse: WorkbookHistoryOperation[];
  createdAt: string;
};

type WorkbookAreaSelection = {
  objectIds: string[];
  strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
  rect: { x: number; y: number; width: number; height: number };
};

type WorkbookAreaSelectionClipboard = {
  objects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
};

type StrokePreviewEntry = {
  stroke: WorkbookStroke;
  previewVersion: number;
  updatedAt: number;
};

type IncomingEraserPreviewEntry = {
  id: string;
  authorUserId: string;
  gestureId: string;
  layer: WorkbookLayer;
  page: number;
  radius: number;
  points: WorkbookPoint[];
  updatedAt: number;
};

type ToolPaintSettings = {
  color: string;
  width: number;
};

type WorkbookPersonalBoardSettings = {
  penToolSettings: ToolPaintSettings;
  highlighterToolSettings: ToolPaintSettings;
  eraserRadius: number;
  smartInkOptions: SmartInkOptions;
};

const DEFAULT_PEN_TOOL_SETTINGS: ToolPaintSettings = {
  color: defaultColorByLayer.board,
  width: getDefaultToolWidth("pen"),
};

const DEFAULT_HIGHLIGHTER_TOOL_SETTINGS: ToolPaintSettings = {
  color: "#ffd54f",
  width: getDefaultToolWidth("highlighter"),
};

const normalizeToolPaintSettings = (
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

const normalizeWorkbookPersonalBoardSettings = (
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
  smartInkOptions: normalizeSmartInkOptions(source?.smartInkOptions),
});

export default function WorkbookSessionPage() {
  const { user } = useAuth();
  const { sessionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId.trim()) return;
    return startWorkbookPerformanceSession(sessionId);
  }, [sessionId]);

  const [session, setSession] = useState<WorkbookSession | null>(null);
  const [boardStrokes, setBoardStrokes] = useState<WorkbookStroke[]>([]);
  const [boardObjects, setBoardObjects] = useState<WorkbookBoardObject[]>([]);
  const [constraints, setConstraints] = useState<WorkbookConstraint[]>([]);
  const [annotationStrokes, setAnnotationStrokes] = useState<WorkbookStroke[]>([]);
  const [chatMessages, setChatMessages] = useState<WorkbookChatMessage[]>([]);
  const [comments, setComments] = useState<WorkbookComment[]>([]);
  const [timerState, setTimerState] = useState<WorkbookTimerState | null>(null);
  const [boardSettings, setBoardSettings] =
    useState<WorkbookBoardSettings>(DEFAULT_BOARD_SETTINGS);
  const [libraryState, setLibraryState] =
    useState<WorkbookLibraryState>(DEFAULT_LIBRARY);
  const [documentState, setDocumentState] = useState<WorkbookDocumentState>({
    assets: [],
    activeAssetId: null,
    page: 1,
    zoom: 1,
    annotations: [],
  });
  const [tool, setTool] = useState<WorkbookTool>("select");
  const [layer] = useState<WorkbookLayer>("board");
  const [penToolSettings, setPenToolSettings] =
    useState<ToolPaintSettings>(DEFAULT_PEN_TOOL_SETTINGS);
  const [highlighterToolSettings, setHighlighterToolSettings] = useState<ToolPaintSettings>(
    DEFAULT_HIGHLIGHTER_TOOL_SETTINGS
  );
  const [eraserRadius, setEraserRadius] = useState(getDefaultToolWidth("eraser"));
  const [strokeColor, setStrokeColor] = useState(defaultColorByLayer.board);
  const [strokeWidth, setStrokeWidth] = useState(getDefaultToolWidth("select"));
  const [polygonSides, setPolygonSides] = useState(5);
  const [polygonMode, setPolygonMode] = useState<"regular" | "points">("regular");
  const [polygonPreset, setPolygonPreset] = useState<
    "regular" | "trapezoid" | "trapezoid_right" | "trapezoid_scalene" | "rhombus"
  >("regular");
  const textPreset = "";
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed">("solid");
  const [lineWidthDraft, setLineWidthDraft] = useState(3);
  const [shape2dStrokeWidthDraft, setShape2dStrokeWidthDraft] = useState(2);
  const [graphExpressionDraft, setGraphExpressionDraft] = useState("");
  const [graphDraftFunctions, setGraphDraftFunctions] = useState<GraphFunctionDraft[]>([]);
  const [smartInkOptions, setSmartInkOptions] = useState<SmartInkOptions>(
    normalizeSmartInkOptions(DEFAULT_SETTINGS.smartInk)
  );
  const [selectedGraphPresetId, setSelectedGraphPresetId] = useState<string | null>(null);
  const [graphDraftError, setGraphDraftError] = useState<string | null>(null);
  const [graphFunctionsDraft, setGraphFunctionsDraft] = useState<GraphFunctionDraft[]>([]);
  const [graphCatalogCursorActive, setGraphCatalogCursorActive] = useState(false);
  const [pendingSolid3dInsertPreset, setPendingSolid3dInsertPreset] = useState<{
    presetId: string;
    presetTitle?: string;
  } | null>(null);
  const [graphWorkbenchTab, setGraphWorkbenchTab] = useState<"catalog" | "work">(
    "catalog"
  );
  const [dividerWidthDraft, setDividerWidthDraft] = useState(2);
  const [solid3dStrokeWidthDraft, setSolid3dStrokeWidthDraft] = useState(2);
  const [solid3dInspectorTab, setSolid3dInspectorTab] = useState<"figure" | "section">(
    "section"
  );
  const [solid3dFigureTab, setSolid3dFigureTab] = useState<
    "display" | "surface" | "faces" | "edges" | "angles"
  >("display");
  const [shape2dInspectorTab, setShape2dInspectorTab] = useState<
    "display" | "vertices" | "angles" | "segments"
  >("display");
  const [activeSolidSectionId, setActiveSolidSectionId] = useState<string | null>(null);
  const [solid3dSectionPointCollecting, setSolid3dSectionPointCollecting] = useState<
    string | null
  >(null);
  const [solid3dDraftPoints, setSolid3dDraftPoints] = useState<{
    objectId: string;
    points: Solid3dSectionPoint[];
  } | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<WorkbookPoint>({ x: 0, y: 0 });
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [viewportZoom, setViewportZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 760 : false
  );
  const [isDockedContextbarViewport, setIsDockedContextbarViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= CONTEXTBAR_DOCKED_VIEWPORT_MAX_WIDTH : false
  );
  const [utilityTab, setUtilityTab] = useState<
    "settings" | "graph" | "transform" | "layers"
  >("settings");
  const [isUtilityPanelOpen, setIsUtilityPanelOpen] = useState(false);
  const [isUtilityPanelCollapsed, setIsUtilityPanelCollapsed] = useState(false);
  const [utilityPanelPosition, setUtilityPanelPosition] = useState({ x: 0, y: 86 });
  const [utilityPanelDragState, setUtilityPanelDragState] = useState<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const [frameFocusMode] = useState<"all" | "active">("all");
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null);
  const [focusPoint, setFocusPoint] = useState<WorkbookPoint | null>(null);
  const [pointerPoint, setPointerPoint] = useState<WorkbookPoint | null>(null);
  const [focusPointsByUser, setFocusPointsByUser] = useState<
    Record<string, WorkbookPoint>
  >({});
  const [pointerPointsByUser, setPointerPointsByUser] = useState<
    Record<string, WorkbookPoint>
  >({});
  const [objectContextMenu, setObjectContextMenu] = useState<{
    objectId: string;
    x: number;
    y: number;
  } | null>(null);
  const [shapeVertexContextMenu, setShapeVertexContextMenu] = useState<{
    objectId: string;
    vertexIndex: number;
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const [lineEndpointContextMenu, setLineEndpointContextMenu] = useState<{
    objectId: string;
    endpoint: "start" | "end";
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const [solid3dVertexContextMenu, setSolid3dVertexContextMenu] = useState<{
    objectId: string;
    vertexIndex: number;
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const [solid3dSectionVertexContextMenu, setSolid3dSectionVertexContextMenu] = useState<{
    objectId: string;
    sectionId: string;
    vertexIndex: number;
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const [solid3dSectionContextMenu, setSolid3dSectionContextMenu] = useState<{
    objectId: string;
    sectionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [pointLabelDraft, setPointLabelDraft] = useState("");
  const [shapeVertexLabelDraft, setShapeVertexLabelDraft] = useState("");
  const [lineEndpointLabelDraft, setLineEndpointLabelDraft] = useState("");
  const [selectedLineStartLabelDraft, setSelectedLineStartLabelDraft] = useState("");
  const [selectedLineEndLabelDraft, setSelectedLineEndLabelDraft] = useState("");
  const [selectedTextDraft, setSelectedTextDraft] = useState("");
  const [selectedTextFontSizeDraft, setSelectedTextFontSizeDraft] = useState(18);
  const selectedTextDraftValueRef = useRef("");
  const selectedTextDraftObjectIdRef = useRef<string | null>(null);
  const selectedTextDraftDirtyRef = useRef(false);
  const selectedTextDraftCommitTimerRef = useRef<number | null>(null);
  const [shapeVertexLabelDrafts, setShapeVertexLabelDrafts] = useState<string[]>([]);
  const [shapeAngleNoteDrafts, setShapeAngleNoteDrafts] = useState<string[]>([]);
  const shapeAngleDraftValuesRef = useRef<Map<number, string>>(new Map());
  const shapeAngleDraftCommitTimersRef = useRef<Map<number, number>>(new Map());
  const shapeAngleDraftObjectIdRef = useRef<string | null>(null);
  const [shapeSegmentNoteDrafts, setShapeSegmentNoteDrafts] = useState<string[]>([]);
  const shapeSegmentDraftValuesRef = useRef<Map<number, string>>(new Map());
  const shapeSegmentDraftCommitTimersRef = useRef<Map<number, number>>(new Map());
  const shapeSegmentDraftObjectIdRef = useRef<string | null>(null);
  const lineDraftObjectIdRef = useRef<string | null>(null);
  const shapeDraftObjectIdRef = useRef<string | null>(null);
  const dividerDraftObjectIdRef = useRef<string | null>(null);
  const graphDraftObjectIdRef = useRef<string | null>(null);
  const graphCatalogCursorTimeoutRef = useRef<number | null>(null);
  const suppressAutoPanelSelectionRef = useRef<string | null>(null);
  const [latestSeq, setLatestSeq] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyingInviteLink, setCopyingInviteLink] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [isStereoDialogOpen, setIsStereoDialogOpen] = useState(false);
  const [isShapesDialogOpen, setIsShapesDialogOpen] = useState(false);
  const [exportingSections, setExportingSections] = useState(false);
  const [docsWindow, setDocsWindow] = useState<DocsWindowState>({
    open: false,
    pinned: false,
    maximized: false,
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingClearRequest, setPendingClearRequest] = useState<ClearRequest | null>(
    null
  );
  const [awaitingClearRequest, setAwaitingClearRequest] =
    useState<ClearRequest | null>(null);
  const [confirmedClearRequest, setConfirmedClearRequest] =
    useState<ClearRequest | null>(null);
  const [incomingStrokePreviews, setIncomingStrokePreviews] = useState<
    Record<string, StrokePreviewEntry>
  >({});
  const [incomingEraserPreviews, setIncomingEraserPreviews] = useState<
    Record<string, IncomingEraserPreviewEntry>
  >({});
  const [isSessionChatOpen, setIsSessionChatOpen] = useState(false);
  const [isSessionChatMinimized, setIsSessionChatMinimized] = useState(false);
  const [isSessionChatMaximized, setIsSessionChatMaximized] = useState(false);
  const [isParticipantsCollapsed, setIsParticipantsCollapsed] = useState(false);
  const [isSessionChatAtBottom, setIsSessionChatAtBottom] = useState(true);
  const [isWorkbookStreamConnected, setIsWorkbookStreamConnected] = useState(false);
  const [isWorkbookLiveConnected, setIsWorkbookLiveConnected] = useState(false);
  const [sessionChatDraft, setSessionChatDraft] = useState("");
  const [isSessionChatEmojiOpen, setIsSessionChatEmojiOpen] = useState(false);
  const [sessionChatPosition, setSessionChatPosition] = useState({ x: 24, y: 96 });
  const [contextbarPosition, setContextbarPosition] = useState({ x: 24, y: 18 });
  const [floatingPanelsTop, setFloatingPanelsTop] = useState(86);
  const [sessionChatReadAt, setSessionChatReadAt] = useState<string | null>(null);
  const [isClearSessionChatDialogOpen, setIsClearSessionChatDialogOpen] = useState(false);
  const [areaSelection, setAreaSelection] = useState<WorkbookAreaSelection | null>(null);
  const [areaSelectionContextMenu, setAreaSelectionContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const areaSelectionClipboardRef = useRef<WorkbookAreaSelectionClipboard | null>(null);
  const [, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">(
    "saved"
  );
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const sessionRootRef = useRef<HTMLElement | null>(null);
  const sessionHeadRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const utilityPanelRef = useRef<HTMLDivElement | null>(null);
  const boardFileInputRef = useRef<HTMLInputElement | null>(null);
  const docsInputRef = useRef<HTMLInputElement | null>(null);
  const focusResetTimersByUserRef = useRef<Map<string, number>>(new Map());
  const dirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const laserClearInFlightRef = useRef(false);
  const autosaveDebounceRef = useRef<number | null>(null);
  const smartInkDebounceRef = useRef<number | null>(null);
  const smartInkStrokeBufferRef = useRef<WorkbookStroke[]>([]);
  const smartInkProcessedStrokeIdsRef = useRef<Set<string>>(new Set());
  const dirtyRevisionRef = useRef(0);
  const pendingAutosaveAfterSaveRef = useRef(false);
  const persistSnapshotsRef = useRef<
    ((options?: { silent?: boolean; force?: boolean }) => Promise<boolean>) | null
  >(null);
  const undoStackRef = useRef<WorkbookHistoryEntry[]>([]);
  const redoStackRef = useRef<WorkbookHistoryEntry[]>([]);
  const latestSeqRef = useRef(0);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const applyHistoryOperationsRef = useRef<
    (operations: WorkbookHistoryOperation[]) => void
  >(() => {});
  const sessionChatListRef = useRef<HTMLDivElement | null>(null);
  const sessionChatRef = useRef<HTMLDivElement | null>(null);
  const contextbarRef = useRef<HTMLDivElement | null>(null);
  const sessionChatShouldScrollToUnreadRef = useRef(false);
  const sessionChatDragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const contextbarDragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const presenceLeaveSentRef = useRef(false);
  const sessionResyncInFlightRef = useRef(false);
  const boardObjectsRef = useRef<WorkbookBoardObject[]>([]);
  const boardStrokesRef = useRef<WorkbookStroke[]>([]);
  const annotationStrokesRef = useRef<WorkbookStroke[]>([]);
  const constraintsRef = useRef<WorkbookConstraint[]>([]);
  const boardSettingsRef = useRef<WorkbookBoardSettings>(DEFAULT_BOARD_SETTINGS);
  const documentStateRef = useRef<WorkbookDocumentState>({
    assets: [],
    activeAssetId: null,
    page: 1,
    zoom: 1,
    annotations: [],
  });
  const queuedBoardSettingsCommitRef = useRef<WorkbookBoardSettings | null>(null);
  const queuedBoardSettingsHistoryBeforeRef = useRef<WorkbookBoardSettings | null>(null);
  const boardSettingsCommitTimerRef = useRef<number | null>(null);
  const boardSettingsCommitInFlightRef = useRef(false);
  const personalBoardSettingsReadyRef = useRef(false);
  const skipNextPersonalBoardSettingsPersistRef = useRef(false);
  const objectUpdateQueuedPatchRef = useRef<
    Map<string, Partial<WorkbookBoardObject>>
  >(new Map());
  const objectUpdateTimersRef = useRef<Map<string, number>>(new Map());
  const objectUpdateInFlightRef = useRef<Set<string>>(new Set());
  const objectUpdateDispatchOptionsRef = useRef<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >(new Map());
  const objectUpdateHistoryBeforeRef = useRef<Map<string, WorkbookBoardObject>>(new Map());
  const objectPreviewQueuedPatchRef = useRef<
    Map<string, Partial<WorkbookBoardObject>>
  >(new Map());
  const objectPreviewVersionRef = useRef<Map<string, number>>(new Map());
  const incomingPreviewQueuedPatchRef = useRef<
    Map<string, Partial<WorkbookBoardObject>[]>
  >(new Map());
  const incomingPreviewVersionByAuthorObjectRef = useRef<Map<string, number>>(new Map());
  const strokePreviewQueuedByIdRef = useRef<
    Map<string, { stroke: WorkbookStroke; previewVersion: number }>
  >(new Map());
  const eraserPreviewQueuedByGestureRef = useRef<
    Map<
      string,
      {
        gestureId: string;
        layer: WorkbookLayer;
        page: number;
        radius: number;
        points: WorkbookPoint[];
        ended?: boolean;
      }
    >
  >(new Map());
  const incomingStrokePreviewQueuedRef = useRef<Map<string, StrokePreviewEntry | null>>(
    new Map()
  );
  const incomingStrokePreviewFrameRef = useRef<number | null>(null);
  const incomingStrokePreviewVersionRef = useRef<Map<string, number>>(new Map());
  const incomingEraserPreviewTimersRef = useRef<Map<string, number>>(new Map());
  const finalizedStrokePreviewIdsRef = useRef<Set<string>>(new Set());
  const objectLastCommittedEventAtRef = useRef<Map<string, number>>(new Map());
  const incomingPreviewFrameRef = useRef<number | null>(null);
  const workbookLiveSendRef = useRef<
    ((events: Array<{ type: WorkbookEvent["type"]; payload: unknown }>) => boolean) | null
  >(null);
  const volatileSyncTimerRef = useRef<number | null>(null);
  const viewportSyncLastSentAtRef = useRef(0);
  const viewportSyncQueuedOffsetRef = useRef<WorkbookPoint | null>(null);
  const viewportLastReceivedAtRef = useRef(0);
  const fallbackBackPath = "/workbook";
  const fromPath = searchParams.get("from") || fallbackBackPath;
  const isEnded = session?.status === "ended";

  const actorParticipant = useMemo(
    () => session?.participants.find((participant) => participant.userId === user?.id) ?? null,
    [session?.participants, user?.id]
  );
  const actorPermissions = actorParticipant?.permissions ?? FALLBACK_PERMISSIONS;
  const canManageSession = Boolean(actorPermissions.canManageSession);
  const hasParticipantBoardToolsAccess = Boolean(
    actorPermissions.canDraw &&
      actorPermissions.canAnnotate &&
      actorPermissions.canSelect &&
      actorPermissions.canDelete &&
      actorPermissions.canInsertImage &&
      actorPermissions.canClear &&
      actorPermissions.canUseLaser
  );
  const canDraw = Boolean(actorPermissions.canDraw && !isEnded && !awaitingClearRequest);
  const canSelect = Boolean(actorPermissions.canSelect && !isEnded);
  const canInsertImage = Boolean(actorPermissions.canInsertImage && !isEnded);
  const canDelete = Boolean(actorPermissions.canDelete && !isEnded);
  const canClear = Boolean(actorPermissions.canClear && !isEnded);
  const canUseLaser = Boolean(actorPermissions.canUseLaser && !isEnded);
  const canUseMedia = Boolean(actorPermissions.canUseMedia);
  const canUseSessionChat = Boolean(actorPermissions.canUseChat);
  const canSendSessionChat = canUseSessionChat && !isEnded;
  const isClassSession = session?.kind === "CLASS";
  const canAccessBoardSettingsPanel = Boolean(
    !isClassSession || canManageSession || hasParticipantBoardToolsAccess
  );
  const canManageSharedBoardSettings = Boolean(!isClassSession || canManageSession);
  const showCollaborationPanels = Boolean(isClassSession);
  const { micEnabled, setMicEnabled } = useWorkbookLivekit({
    sessionId,
    sessionKind: session?.kind,
    canUseMedia,
    isEnded,
    userId: user?.id,
    setError,
  });
  const isCompactDialogViewport = useMediaQuery("(max-width: 640px)");
  const showSidebarParticipants = showCollaborationPanels && !isParticipantsCollapsed;
  const focusPoints = useMemo(
    () => Object.values(focusPointsByUser),
    [focusPointsByUser]
  );
  const pointerPoints = useMemo(
    () => Object.values(pointerPointsByUser),
    [pointerPointsByUser]
  );
  const previewStrokes = useMemo(
    () => Object.values(incomingStrokePreviews).map((entry) => entry.stroke),
    [incomingStrokePreviews]
  );
  const areaSelectionHasContent = Boolean(
    areaSelection &&
      (areaSelection.objectIds.length > 0 || areaSelection.strokeIds.length > 0)
  );
  const clampEraserRadius = useCallback(
    (value: number) =>
      Math.max(ERASER_RADIUS_MIN, Math.min(ERASER_RADIUS_MAX, Math.round(value))),
    []
  );
  const clampedEraserRadius = clampEraserRadius(eraserRadius);
  const resetToolRuntimeToSelect = useCallback(() => {
    setTool("select");
    setStrokeColor(defaultColorByLayer.board);
    setStrokeWidth(getDefaultToolWidth("select"));
  }, []);
  const activateTool = useCallback(
    (nextTool: WorkbookTool) => {
      setTool(nextTool);
      if (nextTool === "pen") {
        setStrokeColor(penToolSettings.color);
        setStrokeWidth(penToolSettings.width);
        return;
      }
      if (nextTool === "highlighter") {
        setStrokeColor(highlighterToolSettings.color);
        setStrokeWidth(highlighterToolSettings.width);
        return;
      }
      if (nextTool === "eraser") {
        setStrokeColor(defaultColorByLayer.board);
        setStrokeWidth(clampedEraserRadius);
        return;
      }
      setStrokeColor(defaultColorByLayer.board);
      setStrokeWidth(getDefaultToolWidth(nextTool));
    },
    [clampedEraserRadius, highlighterToolSettings, penToolSettings]
  );
  const handlePenToolSettingsChange = useCallback(
    (patch: Partial<ToolPaintSettings>) => {
      setPenToolSettings((current) => {
        const next = {
          color: typeof patch.color === "string" && patch.color ? patch.color : current.color,
          width:
            typeof patch.width === "number" && Number.isFinite(patch.width)
              ? Math.max(1, Math.round(patch.width))
              : current.width,
        };
        if (tool === "pen") {
          setStrokeColor(next.color);
          setStrokeWidth(next.width);
        }
        return next;
      });
    },
    [tool]
  );
  const handleHighlighterToolSettingsChange = useCallback(
    (patch: Partial<ToolPaintSettings>) => {
      setHighlighterToolSettings((current) => {
        const next = {
          color: typeof patch.color === "string" && patch.color ? patch.color : current.color,
          width:
            typeof patch.width === "number" && Number.isFinite(patch.width)
              ? Math.max(2, Math.round(patch.width))
              : current.width,
        };
        if (tool === "highlighter") {
          setStrokeColor(next.color);
          setStrokeWidth(next.width);
        }
        return next;
      });
    },
    [tool]
  );
  const handleEraserRadiusChange = useCallback(
    (value: number) => {
      const nextRadius = clampEraserRadius(value);
      setEraserRadius(nextRadius);
      if (tool === "eraser") {
        setStrokeWidth(nextRadius);
      }
    },
    [clampEraserRadius, tool]
  );
  useEffect(() => {
    if (tool === "pen") {
      if (strokeColor !== penToolSettings.color) {
        setStrokeColor(penToolSettings.color);
      }
      if (strokeWidth !== penToolSettings.width) {
        setStrokeWidth(penToolSettings.width);
      }
      return;
    }
    if (tool === "highlighter") {
      if (strokeColor !== highlighterToolSettings.color) {
        setStrokeColor(highlighterToolSettings.color);
      }
      if (strokeWidth !== highlighterToolSettings.width) {
        setStrokeWidth(highlighterToolSettings.width);
      }
      return;
    }
    if (tool === "eraser" && strokeWidth !== clampedEraserRadius) {
      setStrokeWidth(clampedEraserRadius);
    }
  }, [
    clampedEraserRadius,
    highlighterToolSettings.color,
    highlighterToolSettings.width,
    penToolSettings.color,
    penToolSettings.width,
    strokeColor,
    strokeWidth,
    tool,
  ]);
  const handleTransformStrokeWidthChange = useCallback(
    (value: number) => {
      handleEraserRadiusChange(value);
    },
    [handleEraserRadiusChange]
  );

  useEffect(() => {
    boardStrokesRef.current = boardStrokes;
  }, [boardStrokes]);

  useEffect(() => {
    boardObjectsRef.current = boardObjects;
  }, [boardObjects]);

  useEffect(() => {
    annotationStrokesRef.current = annotationStrokes;
  }, [annotationStrokes]);

  useEffect(() => {
    constraintsRef.current = constraints;
  }, [constraints]);

  useEffect(() => {
    boardSettingsRef.current = boardSettings;
  }, [boardSettings]);

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState]);

  useEffect(
    () => () => {
      if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(boardSettingsCommitTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!showCollaborationPanels) {
      setIsParticipantsCollapsed(false);
    }
  }, [showCollaborationPanels]);

  useEffect(() => {
    if (canAccessBoardSettingsPanel || utilityTab !== "settings") return;
    setIsUtilityPanelOpen(false);
  }, [canAccessBoardSettingsPanel, utilityTab]);

  useEffect(() => {
    if (canManageSharedBoardSettings) return;
    queuedBoardSettingsCommitRef.current = null;
    queuedBoardSettingsHistoryBeforeRef.current = null;
    boardSettingsCommitInFlightRef.current = false;
    if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(boardSettingsCommitTimerRef.current);
      boardSettingsCommitTimerRef.current = null;
    }
  }, [canManageSharedBoardSettings]);

  const areParticipantsEqual = useCallback(
    (left: WorkbookSessionParticipant[], right: WorkbookSessionParticipant[]) => {
      if (left.length !== right.length) return false;
      const normalize = (participants: WorkbookSessionParticipant[]) =>
        [...participants]
          .sort((a, b) => a.userId.localeCompare(b.userId))
          .map((participant) => ({
            userId: participant.userId,
            roleInSession: participant.roleInSession,
            isOnline: participant.isOnline,
            canUseChat: participant.permissions.canUseChat,
            canUseMedia: participant.permissions.canUseMedia,
            canDraw: participant.permissions.canDraw,
            canSelect: participant.permissions.canSelect,
            canDelete: participant.permissions.canDelete,
            canInsertImage: participant.permissions.canInsertImage,
            canClear: participant.permissions.canClear,
            canExport: participant.permissions.canExport,
            canUseLaser: participant.permissions.canUseLaser,
          }));
      const normalizedLeft = normalize(left);
      const normalizedRight = normalize(right);
      return normalizedLeft.every((participant, index) => {
        const target = normalizedRight[index];
        return JSON.stringify(participant) === JSON.stringify(target);
      });
    },
    []
  );

  const participantCards = useMemo(
    () =>
      [...(session?.participants ?? [])]
        .filter(
          (participant) =>
            participant.roleInSession === "teacher" || participant.isOnline
        )
        .sort((left, right) => {
          if (left.roleInSession !== right.roleInSession) {
            return left.roleInSession === "teacher" ? -1 : 1;
          }
          if (left.isOnline !== right.isOnline) {
            return left.isOnline ? -1 : 1;
          }
          return left.displayName.localeCompare(right.displayName, "ru");
        }),
    [session?.participants]
  );
  const onlineParticipantsCount = useMemo(
    () => participantCards.filter((participant) => participant.isOnline).length,
    [participantCards]
  );
  const sessionChatReadStorageKey = useMemo(
    () => (sessionId && user?.id ? `workbook:chat-read:${sessionId}:${user.id}` : ""),
    [sessionId, user?.id]
  );
  const contextbarStorageKey = useMemo(
    () => (sessionId && user?.id ? `workbook:contextbar:${sessionId}:${user.id}` : ""),
    [sessionId, user?.id]
  );
  const personalBoardSettingsStorageKey = useMemo(() => {
    const actorUserId = actorParticipant?.userId ?? user?.id ?? "";
    return sessionId && actorUserId
      ? `workbook:personal-board-settings:${sessionId}:${actorUserId}`
      : "";
  }, [actorParticipant?.userId, sessionId, user?.id]);
  const unreadSessionChatMessages = useMemo(() => {
    if (!user?.id) return [];
    let readIndex = sessionChatReadAt
      ? chatMessages.findIndex((message) => message.id === sessionChatReadAt)
      : -1;
    if (readIndex < 0 && sessionChatReadAt) {
      const readTimestamp = parseChatTimestamp(sessionChatReadAt);
      if (readTimestamp > 0) {
        chatMessages.forEach((message, index) => {
          if (parseChatTimestamp(message.createdAt) <= readTimestamp) {
            readIndex = index;
          }
        });
      }
    }
    return chatMessages
      .slice(readIndex + 1)
      .filter((message) => message.authorUserId !== user.id);
  }, [chatMessages, sessionChatReadAt, user?.id]);
  const sessionChatUnreadCount = unreadSessionChatMessages.length;
  const firstUnreadSessionChatMessageId = unreadSessionChatMessages[0]?.id ?? null;

  useEffect(() => {
    resetToolRuntimeToSelect();
  }, [resetToolRuntimeToSelect, sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsCompactViewport(window.innerWidth <= 760);
      setIsDockedContextbarViewport(
        window.innerWidth <= CONTEXTBAR_DOCKED_VIEWPORT_MAX_WIDTH
      );
    };
    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isCompactViewport || !isUtilityPanelOpen) return;
    setIsUtilityPanelCollapsed(true);
  }, [isCompactViewport, isUtilityPanelOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isCompactViewport) {
      setFloatingPanelsTop(12);
      return;
    }
    const updateFloatingPanelsTop = () => {
      const headRect = sessionHeadRef.current?.getBoundingClientRect() ?? null;
      if (!headRect) {
        setFloatingPanelsTop(86);
        return;
      }
      const nextTop = Math.max(
        12,
        Math.min(112, Math.round((headRect.bottom > 0 ? headRect.bottom : 0) + 10))
      );
      setFloatingPanelsTop((current) => (current === nextTop ? current : nextTop));
    };
    updateFloatingPanelsTop();
    window.addEventListener("scroll", updateFloatingPanelsTop, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", updateFloatingPanelsTop, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateFloatingPanelsTop, true);
      window.removeEventListener("resize", updateFloatingPanelsTop);
    };
  }, [isCompactViewport]);

  const resolveContextbarDefaultPosition = useCallback(() => {
    if (typeof window === "undefined") {
      return { x: 24, y: 18 };
    }
    const dockWidth = contextbarRef.current?.offsetWidth ?? 760;
    return {
      x: Math.max(12, Math.round((window.innerWidth - dockWidth) / 2)),
      y: 18,
    };
  }, []);

  const clampContextbarPosition = useCallback(
    (position: { x: number; y: number }) => {
      if (typeof window === "undefined") return position;
      const dockWidth = contextbarRef.current?.offsetWidth ?? 760;
      const dockHeight = contextbarRef.current?.offsetHeight ?? 104;
      const maxX = Math.max(
        CONTEXTBAR_VIEWPORT_MARGIN_PX,
        window.innerWidth - dockWidth - CONTEXTBAR_VIEWPORT_MARGIN_PX
      );
      const maxY = Math.max(
        CONTEXTBAR_VIEWPORT_MARGIN_PX,
        window.innerHeight - dockHeight - CONTEXTBAR_VIEWPORT_MARGIN_PX
      );
      return {
        x: Math.min(maxX, Math.max(CONTEXTBAR_VIEWPORT_MARGIN_PX, position.x)),
        y: Math.min(maxY, Math.max(CONTEXTBAR_VIEWPORT_MARGIN_PX, position.y)),
      };
    },
    []
  );

  const handleContextbarDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isDockedContextbarViewport || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "button, input, textarea, select, option, a, summary, [role='button'], [role='menuitem'], .MuiButtonBase-root, .MuiInputBase-root, .MuiSwitch-root, .MuiSlider-root"
        )
      ) {
        return;
      }
      event.preventDefault();
      contextbarDragStateRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - contextbarPosition.x,
        offsetY: event.clientY - contextbarPosition.y,
      };
    },
    [contextbarPosition.x, contextbarPosition.y, isDockedContextbarViewport]
  );

  useEffect(() => {
    if (!contextbarStorageKey) return;
    const stored = readStorage<{
      position?: { x?: number; y?: number };
    } | null>(contextbarStorageKey, null);
    if (stored?.position) {
      const x =
        typeof stored.position.x === "number" && Number.isFinite(stored.position.x)
          ? stored.position.x
          : resolveContextbarDefaultPosition().x;
      const y =
        typeof stored.position.y === "number" && Number.isFinite(stored.position.y)
          ? stored.position.y
          : resolveContextbarDefaultPosition().y;
      setContextbarPosition({ x, y });
    } else {
      setContextbarPosition(resolveContextbarDefaultPosition());
    }
  }, [contextbarStorageKey, resolveContextbarDefaultPosition]);

  useEffect(() => {
    if (!contextbarStorageKey) return;
    writeStorage(contextbarStorageKey, {
      position: contextbarPosition,
    });
  }, [contextbarPosition, contextbarStorageKey]);

  useEffect(() => {
    if (isDockedContextbarViewport) {
      contextbarDragStateRef.current = null;
      return;
    }
    setContextbarPosition((current) => {
      const next = clampContextbarPosition(current);
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [clampContextbarPosition, isDockedContextbarViewport]);

  useEffect(() => {
    if (isDockedContextbarViewport || typeof window === "undefined") return;
    const handleResize = () => {
      setContextbarPosition((current) => {
        const next = clampContextbarPosition(current);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [clampContextbarPosition, isDockedContextbarViewport]);

  useEffect(() => {
    if (isDockedContextbarViewport || typeof ResizeObserver === "undefined") return;
    const dock = contextbarRef.current;
    if (!dock) return;
    const observer = new ResizeObserver(() => {
      setContextbarPosition((current) => {
        const next = clampContextbarPosition(current);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    });
    observer.observe(dock);
    return () => observer.disconnect();
  }, [clampContextbarPosition, isDockedContextbarViewport]);

  useEffect(() => {
    if (isDockedContextbarViewport) return;
    const onPointerMove = (event: PointerEvent) => {
      const dragState = contextbarDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      setContextbarPosition(
        clampContextbarPosition({
          x: event.clientX - dragState.offsetX,
          y: event.clientY - dragState.offsetY,
        })
      );
    };
    const onPointerUp = (event: PointerEvent) => {
      const dragState = contextbarDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      contextbarDragStateRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      contextbarDragStateRef.current = null;
    };
  }, [clampContextbarPosition, isDockedContextbarViewport]);

  useEffect(() => {
    latestSeqRef.current = latestSeq;
  }, [latestSeq]);

  const persistSessionChatReadAt = useCallback(
    (value: string | null) => {
      if (!sessionChatReadStorageKey || typeof window === "undefined") return;
      if (!value) {
        window.localStorage.removeItem(sessionChatReadStorageKey);
        return;
      }
      window.localStorage.setItem(sessionChatReadStorageKey, value);
    },
    [sessionChatReadStorageKey]
  );

  const markSessionChatReadToLatest = useCallback(() => {
    const latestMessage = chatMessages[chatMessages.length - 1];
    if (!latestMessage) return;
    const latestMessageId = latestMessage.id;
    setSessionChatReadAt((current) => {
      if (current === latestMessageId) {
        return current;
      }
      persistSessionChatReadAt(latestMessageId);
      return latestMessageId;
    });
  }, [chatMessages, persistSessionChatReadAt]);

  const scrollSessionChatToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = sessionChatListRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    setIsSessionChatAtBottom(true);
  }, []);

  const scrollSessionChatToMessage = useCallback(
    (messageId: string, behavior: ScrollBehavior = "auto") => {
      const container = sessionChatListRef.current;
      if (!container) return false;
      const target = container.querySelector<HTMLElement>(
        `[data-session-chat-message-id="${messageId}"]`
      );
      if (!target) return false;
      target.scrollIntoView({
        block: "start",
        behavior,
      });
      return true;
    },
    []
  );

  const filterUnseenWorkbookEvents = useCallback((
    events: WorkbookEvent[],
    options?: { allowLiveReplay?: boolean }
  ) => {
    const unseen: WorkbookEvent[] = [];
    events.forEach((event) => {
      const allowReplay = Boolean(
        options?.allowLiveReplay &&
        isLiveReplayableWorkbookEventType(event.type)
      );
      if (
        !allowReplay &&
        !isVolatileWorkbookEventType(event.type) &&
        typeof event?.seq === "number" &&
        Number.isFinite(event.seq) &&
        event.seq <= latestSeqRef.current
      ) {
        return;
      }
      if (!event?.id || processedEventIdsRef.current.has(event.id)) return;
      processedEventIdsRef.current.add(event.id);
      unseen.push(event);
    });
    if (processedEventIdsRef.current.size > 50_000) {
      processedEventIdsRef.current.clear();
      unseen.slice(-2_000).forEach((event) => {
        if (event?.id) {
          processedEventIdsRef.current.add(event.id);
        }
      });
    }
    return unseen;
  }, []);

  const recoverChatMessagesFromEvents = useCallback((events: WorkbookEvent[]) => {
    if (events.length === 0) return [] as WorkbookChatMessage[];
    const sorted = [...events].sort((left, right) => left.seq - right.seq);
    let restored: WorkbookChatMessage[] = [];
    sorted.forEach((event) => {
      if (event.type === "chat.clear") {
        restored = [];
        return;
      }
      if (event.type === "chat.message.delete") {
        const messageId = (event.payload as { messageId?: unknown })?.messageId;
        if (typeof messageId === "string" && messageId) {
          restored = restored.filter((message) => message.id !== messageId);
        }
        return;
      }
      if (event.type !== "chat.message") return;
      const message = normalizeChatMessagePayload(
        (event.payload as { message?: unknown })?.message
      );
      if (!message) return;
      if (restored.some((item) => item.id === message.id)) return;
      restored = [...restored, message];
    });
    return restored;
  }, []);

  const clearObjectSyncRuntime = useCallback((options?: { cancelIncomingFrame?: boolean }) => {
    objectUpdateQueuedPatchRef.current.clear();
    objectUpdateHistoryBeforeRef.current.clear();
    objectUpdateTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    objectUpdateTimersRef.current.clear();
    objectUpdateInFlightRef.current.clear();
    objectUpdateDispatchOptionsRef.current.clear();
    objectPreviewQueuedPatchRef.current.clear();
    objectPreviewVersionRef.current.clear();
    incomingPreviewQueuedPatchRef.current.clear();
    incomingPreviewVersionByAuthorObjectRef.current.clear();
    objectLastCommittedEventAtRef.current.clear();
    if (options?.cancelIncomingFrame !== false && incomingPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(incomingPreviewFrameRef.current);
      incomingPreviewFrameRef.current = null;
    }
  }, []);

  const clearIncomingEraserPreviewRuntime = useCallback(() => {
    incomingEraserPreviewTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    incomingEraserPreviewTimersRef.current.clear();
    eraserPreviewQueuedByGestureRef.current.clear();
    setIncomingEraserPreviews({});
  }, []);

  const scheduleIncomingEraserPreviewExpiry = useCallback(
    (previewId: string, delay: number) => {
      const currentTimer = incomingEraserPreviewTimersRef.current.get(previewId);
      if (currentTimer !== undefined) {
        window.clearTimeout(currentTimer);
      }
      const timerId = window.setTimeout(() => {
        incomingEraserPreviewTimersRef.current.delete(previewId);
        setIncomingEraserPreviews((current) => {
          if (!(previewId in current)) return current;
          const next = { ...current };
          delete next[previewId];
          return next;
        });
      }, Math.max(60, delay));
      incomingEraserPreviewTimersRef.current.set(previewId, timerId);
    },
    []
  );

  const flushIncomingStrokePreviewQueue = useCallback(() => {
    incomingStrokePreviewFrameRef.current = null;
    const queued = new Map(incomingStrokePreviewQueuedRef.current);
    incomingStrokePreviewQueuedRef.current.clear();
    if (queued.size === 0) return;
    setIncomingStrokePreviews((current) => {
      let changed = false;
      const next: Record<string, StrokePreviewEntry> = { ...current };
      queued.forEach((entry, strokeId) => {
        if (entry === null) {
          if (next[strokeId]) {
            delete next[strokeId];
            changed = true;
          }
          return;
        }
        const existing = next[strokeId];
        if (existing && existing.previewVersion >= entry.previewVersion) {
          return;
        }
        next[strokeId] = entry;
        changed = true;
      });
      return changed ? next : current;
    });
  }, []);

  const scheduleIncomingStrokePreviewFlush = useCallback(() => {
    if (incomingStrokePreviewFrameRef.current !== null) return;
    if (typeof window === "undefined") {
      flushIncomingStrokePreviewQueue();
      return;
    }
    incomingStrokePreviewFrameRef.current = window.requestAnimationFrame(() => {
      flushIncomingStrokePreviewQueue();
    });
  }, [flushIncomingStrokePreviewQueue]);

  const queueIncomingStrokePreview = useCallback(
    (entry: StrokePreviewEntry | null, strokeId: string) => {
      incomingStrokePreviewQueuedRef.current.set(strokeId, entry);
      scheduleIncomingStrokePreviewFlush();
    },
    [scheduleIncomingStrokePreviewFlush]
  );

  const finalizeStrokePreview = useCallback(
    (strokeId: string) => {
      if (!strokeId) return;
      finalizedStrokePreviewIdsRef.current.add(strokeId);
      strokePreviewQueuedByIdRef.current.delete(strokeId);
      incomingStrokePreviewVersionRef.current.delete(strokeId);
      queueIncomingStrokePreview(null, strokeId);
    },
    [queueIncomingStrokePreview]
  );

  const clearStrokePreviewRuntime = useCallback(
    (options?: { clearFinalized?: boolean; cancelIncomingFrame?: boolean }) => {
      strokePreviewQueuedByIdRef.current.clear();
      incomingStrokePreviewQueuedRef.current.clear();
      incomingStrokePreviewVersionRef.current.clear();
      if (options?.clearFinalized !== false) {
        finalizedStrokePreviewIdsRef.current.clear();
      }
      if (
        options?.cancelIncomingFrame !== false &&
        incomingStrokePreviewFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(incomingStrokePreviewFrameRef.current);
        incomingStrokePreviewFrameRef.current = null;
      }
      setIncomingStrokePreviews({});
    },
    []
  );

  const flushIncomingPreviewQueue = useCallback(() => {
    incomingPreviewFrameRef.current = null;
    const queue = incomingPreviewQueuedPatchRef.current;
    if (queue.size === 0) return;
    const patches = new Map<string, Partial<WorkbookBoardObject>[]>();
    queue.forEach((pendingQueue, objectId) => {
      if (pendingQueue.length === 0) {
        queue.delete(objectId);
        return;
      }
      patches.set(objectId, pendingQueue.slice());
      queue.delete(objectId);
    });
    if (patches.size === 0) return;
    setBoardObjects((current) => {
      if (current.length === 0) return current;
      let changed = false;
      const next = current.map((item) => {
        const pendingPatches = patches.get(item.id);
        if (!pendingPatches || pendingPatches.length === 0) return item;
        changed = true;
        return pendingPatches.reduce(
          (previewObject, patch) => mergeBoardObjectWithPatch(previewObject, patch),
          item
        );
      });
      return changed ? next : current;
    });
  }, []);

  const queueIncomingPreviewPatch = useCallback(
    (objectId: string, patch: Partial<WorkbookBoardObject>) => {
      const pendingQueue = incomingPreviewQueuedPatchRef.current.get(objectId) ?? [];
      pendingQueue.push(patch);
      if (pendingQueue.length > MAX_INCOMING_PREVIEW_PATCHES_PER_OBJECT) {
        pendingQueue.splice(
          0,
          pendingQueue.length - MAX_INCOMING_PREVIEW_PATCHES_PER_OBJECT
        );
      }
      incomingPreviewQueuedPatchRef.current.set(objectId, pendingQueue);
      if (incomingPreviewFrameRef.current !== null) return;
      if (typeof window === "undefined") {
        flushIncomingPreviewQueue();
        return;
      }
      incomingPreviewFrameRef.current = window.requestAnimationFrame(() => {
        flushIncomingPreviewQueue();
      });
    },
    [flushIncomingPreviewQueue]
  );

  const isParticipantBoardToolsEnabled = useCallback(
    (participant: WorkbookSessionParticipant) =>
      Boolean(
        participant.permissions.canDraw &&
          participant.permissions.canAnnotate &&
          participant.permissions.canSelect &&
          participant.permissions.canDelete &&
          participant.permissions.canInsertImage &&
          participant.permissions.canClear &&
          participant.permissions.canUseLaser
      ),
    []
  );

  const boardLocked = Boolean(awaitingClearRequest);
  const canEdit = !isEnded && (canDraw || canSelect);
  const isTeacherActor = Boolean(
    actorParticipant?.roleInSession === "teacher" || actorPermissions.canManageSession
  );
  const canUseUndo = Boolean(
    !isEnded &&
      canEdit &&
      session &&
      (session.kind === "PERSONAL" ||
        session.settings.undoPolicy === "everyone" ||
        (session.settings.undoPolicy === "teacher_only" && isTeacherActor) ||
        session.settings.undoPolicy === "own_only")
  );
  const normalizedSceneLayers = useMemo(
    () =>
      normalizeSceneLayersForBoard(
        boardSettings.sceneLayers,
        boardSettings.activeSceneLayerId
      ),
    [boardSettings.activeSceneLayerId, boardSettings.sceneLayers]
  );
  const activeSceneLayerId = normalizedSceneLayers.activeSceneLayerId;

  const getObjectSceneLayerId = useCallback((object: WorkbookBoardObject) => {
    const layerId =
      object.meta && typeof object.meta === "object" && typeof object.meta.sceneLayerId === "string"
        ? object.meta.sceneLayerId
        : "";
    return layerId.trim() || MAIN_SCENE_LAYER_ID;
  }, []);

  const compositionLayers = useMemo(
    () =>
      normalizedSceneLayers.sceneLayers.filter(
        (layerItem) =>
          layerItem.id !== MAIN_SCENE_LAYER_ID &&
          boardObjects.some((object) => getObjectSceneLayerId(object) === layerItem.id)
      ),
    [boardObjects, getObjectSceneLayerId, normalizedSceneLayers.sceneLayers]
  );
  const compositionObjectsByLayer = useMemo(() => {
    const grouped = new Map<string, WorkbookBoardObject[]>();
    boardObjects.forEach((object) => {
      const layerId = getObjectSceneLayerId(object);
      if (layerId === MAIN_SCENE_LAYER_ID) return;
      const existing = grouped.get(layerId);
      if (existing) {
        existing.push(object);
      } else {
        grouped.set(layerId, [object]);
      }
    });
    return grouped;
  }, [boardObjects, getObjectSceneLayerId]);
  const compositionLayerEntries = useMemo(
    () =>
      compositionLayers.map((layer) => ({
        layer,
        objects: compositionObjectsByLayer.get(layer.id) ?? [],
      })),
    [compositionLayers, compositionObjectsByLayer]
  );

  const restoreSceneSnapshot = useCallback((snapshot: WorkbookSceneSnapshot) => {
    setBoardStrokes(snapshot.boardStrokes);
    setBoardObjects(snapshot.boardObjects);
    setConstraints(snapshot.constraints);
    setAnnotationStrokes(snapshot.annotationStrokes);
    setChatMessages(snapshot.chatMessages);
    setComments(snapshot.comments);
    setTimerState(snapshot.timerState);
    setBoardSettings((current) => {
      const next = normalizeSceneLayersForBoard(
        snapshot.boardSettings.sceneLayers,
        snapshot.boardSettings.activeSceneLayerId
      );
      return {
        ...current,
        ...snapshot.boardSettings,
        sceneLayers: next.sceneLayers,
        activeSceneLayerId: next.activeSceneLayerId,
      };
    });
    setLibraryState(snapshot.libraryState);
    setDocumentState(snapshot.documentState);
  }, []);

  const scheduleAutosave = useCallback((delayMs = 1100) => {
    if (autosaveDebounceRef.current !== null) {
      window.clearTimeout(autosaveDebounceRef.current);
      autosaveDebounceRef.current = null;
    }
    autosaveDebounceRef.current = window.setTimeout(() => {
      autosaveDebounceRef.current = null;
      void persistSnapshotsRef.current?.({ force: true });
    }, Math.max(200, delayMs));
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    dirtyRevisionRef.current += 1;
    pendingAutosaveAfterSaveRef.current = true;
    setSaveState("saving");
    scheduleAutosave();
  }, [scheduleAutosave]);

  const pushHistoryEntry = useCallback((entry: WorkbookHistoryEntry) => {
    const nextUndo = [...undoStackRef.current, entry];
    undoStackRef.current = nextUndo.slice(-80);
    redoStackRef.current = [];
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(0);
  }, []);

  const rollbackHistoryEntry = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoDepth(undoStackRef.current.length);
  }, []);

  const buildHistoryEntryFromEvents = useCallback(
    (events: Array<{ type: WorkbookEvent["type"]; payload: unknown }>) => {
      const currentBoardStrokes = boardStrokesRef.current;
      const currentAnnotationStrokes = annotationStrokesRef.current;
      const currentObjects = boardObjectsRef.current;
      const currentConstraints = constraintsRef.current;
      const currentBoardSettings = boardSettingsRef.current;
      const currentDocumentState = documentStateRef.current;
      const forward: WorkbookHistoryOperation[] = [];
      let inverse: WorkbookHistoryOperation[] = [];

      events.forEach((event) => {
        let eventForward: WorkbookHistoryOperation[] = [];
        let eventInverse: WorkbookHistoryOperation[] = [];

        if (event.type === "board.stroke" || event.type === "annotations.stroke") {
          const stroke = normalizeStrokePayload((event.payload as { stroke?: unknown })?.stroke);
          if (!stroke) return;
          eventForward = [
            { kind: "upsert_stroke", layer: stroke.layer, stroke: cloneSerializable(stroke) },
          ];
          eventInverse = [
            { kind: "remove_stroke", layer: stroke.layer, strokeId: stroke.id },
          ];
        } else if (
          event.type === "board.stroke.delete" ||
          event.type === "annotations.stroke.delete"
        ) {
          const strokeId = (event.payload as { strokeId?: unknown })?.strokeId;
          const layer = event.type === "annotations.stroke.delete" ? "annotations" : "board";
          if (typeof strokeId !== "string" || !strokeId) return;
          const source = (layer === "annotations"
            ? currentAnnotationStrokes
            : currentBoardStrokes
          ).find((item) => item.id === strokeId);
          if (!source) return;
          eventForward = [{ kind: "remove_stroke", layer, strokeId }];
          eventInverse = [
            { kind: "upsert_stroke", layer, stroke: cloneSerializable(source) },
          ];
        } else if (event.type === "board.object.create") {
          const object = normalizeObjectPayload((event.payload as { object?: unknown })?.object);
          if (!object) return;
          eventForward = [{ kind: "upsert_object", object: cloneSerializable(object) }];
          eventInverse = [{ kind: "remove_object", objectId: object.id }];
        } else if (event.type === "board.object.update") {
          const payload = event.payload as { objectId?: unknown; patch?: unknown };
          const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
          const patch =
            payload.patch && typeof payload.patch === "object"
              ? (payload.patch as Partial<WorkbookBoardObject>)
              : null;
          if (!objectId || !patch) return;
          const currentObject = currentObjects.find((item) => item.id === objectId);
          if (!currentObject) return;
          const nextObject = mergeBoardObjectWithPatch(currentObject, patch);
          const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
          const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
          if (!forwardPatch || !inversePatch) return;
          eventForward = [{ kind: "patch_object", objectId, patch: forwardPatch }];
          eventInverse = [{ kind: "patch_object", objectId, patch: inversePatch }];
        } else if (event.type === "board.object.delete") {
          const objectId = (event.payload as { objectId?: unknown })?.objectId;
          if (typeof objectId !== "string" || !objectId) return;
          const currentObject = currentObjects.find((item) => item.id === objectId);
          if (!currentObject) return;
          const relatedConstraints = currentConstraints.filter(
            (constraint) =>
              constraint.sourceObjectId === objectId || constraint.targetObjectId === objectId
          );
          eventForward = [{ kind: "remove_object", objectId }];
          eventInverse = [
            { kind: "upsert_object", object: cloneSerializable(currentObject) },
            ...relatedConstraints.map((constraint) => ({
              kind: "upsert_constraint" as const,
              constraint: cloneSerializable(constraint),
            })),
          ];
        } else if (event.type === "board.object.pin") {
          const payload = event.payload as { objectId?: unknown; pinned?: unknown };
          const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
          if (!objectId) return;
          const currentObject = currentObjects.find((item) => item.id === objectId);
          if (!currentObject) return;
          const nextObject = { ...currentObject, pinned: Boolean(payload.pinned) };
          const forwardPatch = buildBoardObjectDiffPatch(currentObject, nextObject);
          const inversePatch = buildBoardObjectDiffPatch(nextObject, currentObject);
          if (!forwardPatch || !inversePatch) return;
          eventForward = [{ kind: "patch_object", objectId, patch: forwardPatch }];
          eventInverse = [{ kind: "patch_object", objectId, patch: inversePatch }];
        } else if (event.type === "board.clear") {
          eventForward = [
            ...currentConstraints.map((constraint) => ({
              kind: "remove_constraint" as const,
              constraintId: constraint.id,
            })),
            ...currentObjects.map((object) => ({
              kind: "remove_object" as const,
              objectId: object.id,
            })),
            ...currentBoardStrokes.map((stroke) => ({
              kind: "remove_stroke" as const,
              layer: "board" as const,
              strokeId: stroke.id,
            })),
          ];
          eventInverse = [
            ...currentBoardStrokes.map((stroke) => ({
              kind: "upsert_stroke" as const,
              layer: "board" as const,
              stroke: cloneSerializable(stroke),
            })),
            ...currentObjects.map((object) => ({
              kind: "upsert_object" as const,
              object: cloneSerializable(object),
            })),
            ...currentConstraints.map((constraint) => ({
              kind: "upsert_constraint" as const,
              constraint: cloneSerializable(constraint),
            })),
          ];
        } else if (event.type === "annotations.clear") {
          eventForward = currentAnnotationStrokes.map((stroke) => ({
            kind: "remove_stroke" as const,
            layer: "annotations" as const,
            strokeId: stroke.id,
          }));
          eventInverse = currentAnnotationStrokes.map((stroke) => ({
            kind: "upsert_stroke" as const,
            layer: "annotations" as const,
            stroke: cloneSerializable(stroke),
          }));
        } else if (event.type === "geometry.constraint.add") {
          const constraint = (event.payload as { constraint?: unknown })?.constraint;
          if (!constraint || typeof constraint !== "object") return;
          const typed = constraint as WorkbookConstraint;
          if (!typed.id) return;
          eventForward = [
            { kind: "upsert_constraint", constraint: cloneSerializable(typed) },
          ];
          eventInverse = [{ kind: "remove_constraint", constraintId: typed.id }];
        } else if (event.type === "geometry.constraint.remove") {
          const constraintId = (event.payload as { constraintId?: unknown })?.constraintId;
          if (typeof constraintId !== "string" || !constraintId) return;
          const currentConstraint = currentConstraints.find((item) => item.id === constraintId);
          if (!currentConstraint) return;
          eventForward = [{ kind: "remove_constraint", constraintId }];
          eventInverse = [
            { kind: "upsert_constraint", constraint: cloneSerializable(currentConstraint) },
          ];
        } else if (event.type === "board.settings.update") {
          const incomingSettings = (event.payload as { boardSettings?: unknown })?.boardSettings;
          if (!incomingSettings || typeof incomingSettings !== "object") return;
          const merged = {
            ...currentBoardSettings,
            ...(incomingSettings as Partial<WorkbookBoardSettings>),
          };
          const normalizedLayers = normalizeSceneLayersForBoard(
            merged.sceneLayers,
            merged.activeSceneLayerId
          );
          const nextSettings: WorkbookBoardSettings = {
            ...merged,
            sceneLayers: normalizedLayers.sceneLayers,
            activeSceneLayerId: normalizedLayers.activeSceneLayerId,
          };
          const forwardPatch = buildBoardSettingsDiffPatch(currentBoardSettings, nextSettings);
          const inversePatch = buildBoardSettingsDiffPatch(nextSettings, currentBoardSettings);
          if (!forwardPatch || !inversePatch) return;
          eventForward = [{ kind: "patch_board_settings", patch: forwardPatch }];
          eventInverse = [{ kind: "patch_board_settings", patch: inversePatch }];
        } else if (event.type === "document.asset.add") {
          const asset = normalizeDocumentAssetPayload(
            (event.payload as { asset?: unknown })?.asset
          );
          if (!asset) return;
          eventForward = [
            { kind: "upsert_document_asset", asset: cloneSerializable(asset) },
          ];
          eventInverse = [{ kind: "remove_document_asset", assetId: asset.id }];
        } else if (event.type === "document.annotation.add") {
          const annotation = normalizeDocumentAnnotationPayload(
            (event.payload as { annotation?: unknown })?.annotation
          );
          if (!annotation) return;
          eventForward = [
            {
              kind: "upsert_document_annotation",
              annotation: cloneSerializable(annotation),
            },
          ];
          eventInverse = [
            { kind: "remove_document_annotation", annotationId: annotation.id },
          ];
        } else if (event.type === "document.annotation.clear") {
          eventForward = currentDocumentState.annotations.map((annotation) => ({
            kind: "remove_document_annotation" as const,
            annotationId: annotation.id,
          }));
          eventInverse = currentDocumentState.annotations.map((annotation) => ({
            kind: "upsert_document_annotation" as const,
            annotation: cloneSerializable(annotation),
          }));
        }

        if (eventForward.length === 0 || eventInverse.length === 0) return;
        forward.push(...eventForward);
        inverse = [...eventInverse, ...inverse];
      });

      if (forward.length === 0 || inverse.length === 0) {
        return null;
      }
      return {
        forward,
        inverse,
        createdAt: new Date().toISOString(),
      } satisfies WorkbookHistoryEntry;
    },
    []
  );

  const applyIncomingEvents = useCallback(
    (events: WorkbookEvent[]) => {
      if (events.length === 0) return;
      const compactedEvents = compactWorkbookObjectUpdateEvents(events);
      compactedEvents.forEach((event) => {
        try {
        const parsedEventTs = Date.parse(event.createdAt);
        const eventTimestamp = Number.isFinite(parsedEventTs)
          ? parsedEventTs
          : Date.now();
        if (
          applyWorkbookIncomingRealtimeEvent({
            event,
            eventTimestamp,
            userId: user?.id,
            selectedObjectId,
            selectedTextDraftDirty: selectedTextDraftDirtyRef.current,
            selectedTextDraftObjectId: selectedTextDraftObjectIdRef.current,
            awaitingClearRequest,
            areParticipantsEqual,
            applyHistoryOperations: (operations) =>
              applyHistoryOperationsRef.current(operations as WorkbookHistoryOperation[]),
            restoreSceneSnapshot,
            clearObjectSyncRuntime,
            clearStrokePreviewRuntime,
            clearIncomingEraserPreviewRuntime,
            scheduleIncomingEraserPreviewExpiry,
            queueIncomingStrokePreview,
            finalizeStrokePreview,
            queueIncomingPreviewPatch,
            setSession,
            setCanvasViewport,
            setIncomingEraserPreviews,
            setBoardStrokes,
            setAnnotationStrokes,
            setBoardObjects,
            setConstraints,
            setSelectedObjectId,
            setSelectedConstraintId,
            setPendingClearRequest,
            setAwaitingClearRequest,
            setConfirmedClearRequest,
            setFocusPoint,
            setPointerPoint,
            setFocusPointsByUser,
            setPointerPointsByUser,
            viewportLastReceivedAtRef,
            finalizedStrokePreviewIdsRef,
            incomingStrokePreviewVersionRef,
            objectLastCommittedEventAtRef,
            incomingPreviewQueuedPatchRef,
            incomingPreviewVersionByAuthorObjectRef,
            objectUpdateQueuedPatchRef,
            objectUpdateDispatchOptionsRef,
            objectUpdateHistoryBeforeRef,
            objectPreviewQueuedPatchRef,
            objectUpdateInFlightRef,
            objectPreviewVersionRef,
            objectUpdateTimersRef,
            focusResetTimersByUserRef,
            generateId,
            eraserPreviewPointMergeMinDistancePx:
              ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX,
            eraserPreviewExpiryMs: ERASER_PREVIEW_EXPIRY_MS,
            eraserPreviewEndExpiryMs: ERASER_PREVIEW_END_EXPIRY_MS,
            viewportSyncEpsilon: VIEWPORT_SYNC_EPSILON,
          })
        ) {
          return;
        }
        if (
          applyWorkbookIncomingSessionMetaEvent({
            event,
            normalizeSceneLayersForBoard,
            normalizeSmartInkOptions,
            setDocumentState,
            setConstraints,
            setSelectedConstraintId,
            setBoardSettings,
            setLibraryState,
            setComments,
            setTimerState,
            setSession,
            setChatMessages,
          })
        ) {
          return;
        }
        } catch (error) {
          console.warn("Workbook event apply failed", event.type, error);
        }
      });
    },
    [
      areParticipantsEqual,
      awaitingClearRequest,
      clearIncomingEraserPreviewRuntime,
      clearObjectSyncRuntime,
      clearStrokePreviewRuntime,
      finalizeStrokePreview,
      queueIncomingStrokePreview,
      scheduleIncomingEraserPreviewExpiry,
      queueIncomingPreviewPatch,
      restoreSceneSnapshot,
      selectedObjectId,
      user?.id,
    ]
  );

  const loadSession = useCallback(async (options?: { background?: boolean }) => {
    if (!sessionId) return;
    const isBackground = options?.background === true;
    if (!isBackground) {
      setLoading(true);
      setError(null);
      clearStrokePreviewRuntime();
      clearIncomingEraserPreviewRuntime();
    }
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const sessionData = await getWorkbookSession(sessionId);
        const [boardSnapshotResult, annotationSnapshotResult] = await Promise.allSettled([
          getWorkbookSnapshot(sessionId, "board"),
          getWorkbookSnapshot(sessionId, "annotations"),
        ]);
        const boardSnapshot =
          boardSnapshotResult.status === "fulfilled" ? boardSnapshotResult.value : null;
        const annotationSnapshot =
          annotationSnapshotResult.status === "fulfilled"
            ? annotationSnapshotResult.value
            : null;
        setSession(sessionData);
        queuedBoardSettingsCommitRef.current = null;
        queuedBoardSettingsHistoryBeforeRef.current = null;
        if (boardSettingsCommitTimerRef.current !== null && typeof window !== "undefined") {
          window.clearTimeout(boardSettingsCommitTimerRef.current);
          boardSettingsCommitTimerRef.current = null;
        }

        const normalizedBoard = normalizeScenePayload(
          boardSnapshot?.payload ?? createEmptyScene()
        );
        const normalizedAnnotations = normalizeScenePayload(
          annotationSnapshot?.payload ?? createEmptyScene()
        );

        setBoardStrokes(normalizedBoard.strokes.filter((stroke) => stroke.layer === "board"));
        setBoardObjects(normalizedBoard.objects.filter((item) => item.layer === "board"));
        setConstraints(normalizedBoard.constraints);
        setChatMessages(normalizedBoard.chat);
        setComments(normalizedBoard.comments);
        setTimerState(normalizedBoard.timer);
        setBoardSettings(() => {
          const normalizedLayers = normalizeSceneLayersForBoard(
            normalizedBoard.boardSettings.sceneLayers,
            normalizedBoard.boardSettings.activeSceneLayerId
          );
          return {
            ...DEFAULT_BOARD_SETTINGS,
            ...normalizedBoard.boardSettings,
            ...normalizedLayers,
            smartInk: DEFAULT_SMART_INK_OPTIONS,
            title:
              normalizedBoard.boardSettings.title ||
              sessionData.title ||
              DEFAULT_BOARD_SETTINGS.title,
          };
        });
        setLibraryState({
          ...DEFAULT_LIBRARY,
          ...normalizedBoard.library,
        });
        setDocumentState(normalizedBoard.document);
        setAnnotationStrokes(
          normalizedAnnotations.strokes.filter((stroke) => stroke.layer === "annotations")
        );
        const loadedLatestSeq = Math.max(
          boardSnapshot?.version ?? 0,
          annotationSnapshot?.version ?? 0
        );
        setLatestSeq(loadedLatestSeq);
        latestSeqRef.current = loadedLatestSeq;
        processedEventIdsRef.current.clear();
        smartInkStrokeBufferRef.current = [];
        smartInkProcessedStrokeIdsRef.current = new Set();
        clearObjectSyncRuntime();
        clearStrokePreviewRuntime();
        clearIncomingEraserPreviewRuntime();
        dirtyRef.current = false;
        undoStackRef.current = [];
        redoStackRef.current = [];
        setUndoDepth(0);
        setRedoDepth(0);
        setSaveState("saved");
        setFocusPoint(null);
        setPointerPoint(null);
        setFocusPointsByUser({});
        setPointerPointsByUser({});
        focusResetTimersByUserRef.current.forEach((timerId) => {
          window.clearTimeout(timerId);
        });
        focusResetTimersByUserRef.current.clear();
        try {
          await openWorkbookSession(sessionId);
        } catch (openError) {
          if (
            openError instanceof ApiError &&
            (openError.status === 401 ||
              openError.status === 403 ||
              openError.status === 404)
          ) {
            throw openError;
          }
        }
        if (normalizedBoard.chat.length === 0) {
          try {
            const history = await getWorkbookEvents(sessionId, 0);
            const recoveredChat = recoverChatMessagesFromEvents(history.events);
            if (recoveredChat.length > 0) {
              setChatMessages(recoveredChat);
            }
          } catch {
            // ignore chat history recovery errors
          }
        }
        if (!isBackground) {
          setLoading(false);
        }
        return;
      } catch (error) {
        const recoverable =
          error instanceof ApiError &&
          (error.code === "server_unavailable" ||
            error.code === "network_error" ||
            error.code === "timeout" ||
            error.code === "rate_limited" ||
            error.status === 502 ||
            error.status === 503 ||
            error.status === 504);
        if (recoverable && attempt < maxAttempts) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt * 250));
          continue;
        }
        if (isBackground) {
          setError("Связь с доской нестабильна. Продолжаем работу и повторяем синхронизацию.");
          return;
        }
        if (error instanceof ApiError) {
          if (error.status === 401) {
            setError("Сессия недоступна: требуется повторная авторизация.");
          } else if (error.status === 403) {
            setError("Нет доступа к этой сессии. Запросите новую ссылку у преподавателя.");
          } else if (error.status === 404) {
            setError("Сессия не найдена. Возможно, урок завершен или ссылка устарела.");
          } else {
            setError("Не удалось открыть сессию. Проверьте подключение и повторите попытку.");
          }
        } else {
          setError("Не удалось открыть сессию. Проверьте подключение и повторите попытку.");
        }
        setSession(null);
        setLoading(false);
        return;
      }
    }
    if (!isBackground) {
      setLoading(false);
    }
  }, [
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    recoverChatMessagesFromEvents,
    sessionId,
  ]);

  const triggerSessionResync = useCallback(() => {
    if (sessionResyncInFlightRef.current) return;
    sessionResyncInFlightRef.current = true;
    void loadSession({ background: true }).finally(() => {
      sessionResyncInFlightRef.current = false;
    });
  }, [loadSession]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!sessionId || !session) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await getWorkbookEvents(sessionId, latestSeqRef.current);
        if (!active) return;
        const unseenEvents = filterUnseenWorkbookEvents(response.events);
        if (hasWorkbookEventGap(latestSeqRef.current, unseenEvents)) {
          observeWorkbookRealtimeGap({
            sessionId,
            channel: "poll",
            latestSeq: latestSeqRef.current,
            nextSeq: unseenEvents[0]?.seq ?? response.latestSeq,
          });
          triggerSessionResync();
          return;
        }
        if (unseenEvents.length > 0) {
          observeWorkbookRealtimeReceive({
            sessionId,
            channel: "poll",
            latestSeq: response.latestSeq,
            events: unseenEvents,
          });
          applyIncomingEvents(unseenEvents);
          observeWorkbookRealtimeApply({
            sessionId,
            channel: "poll",
            latestSeq: response.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = resolveNextLatestSeq(
          latestSeqRef.current,
          response.latestSeq,
          unseenEvents
        );
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
      } catch {
        // ignore transient polling errors
      }
    };
    void poll();
    const intervalMs = isWorkbookStreamConnected || isWorkbookLiveConnected
      ? POLL_INTERVAL_STREAM_CONNECTED_MS
      : POLL_INTERVAL_MS;
    const intervalId = window.setInterval(() => {
      void poll();
    }, intervalMs);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [
    applyIncomingEvents,
    filterUnseenWorkbookEvents,
    isWorkbookLiveConnected,
    isWorkbookStreamConnected,
    session,
    sessionId,
    triggerSessionResync,
  ]);

  useEffect(() => {
    if (!sessionId || !session) return;
    const unsubscribe = subscribeWorkbookEventsStream({
      sessionId,
      onEvents: (payload) => {
        if (payload.sessionId !== sessionId) return;
        const unseenEvents = filterUnseenWorkbookEvents(payload.events);
        if (hasWorkbookEventGap(latestSeqRef.current, unseenEvents)) {
          observeWorkbookRealtimeGap({
            sessionId,
            channel: "stream",
            latestSeq: latestSeqRef.current,
            nextSeq: unseenEvents[0]?.seq ?? payload.latestSeq,
          });
          triggerSessionResync();
          return;
        }
        if (unseenEvents.length > 0) {
          observeWorkbookRealtimeReceive({
            sessionId,
            channel: "stream",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
          applyIncomingEvents(unseenEvents);
          observeWorkbookRealtimeApply({
            sessionId,
            channel: "stream",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = resolveNextLatestSeq(
          latestSeqRef.current,
          payload.latestSeq,
          unseenEvents
        );
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
      },
      onConnectionChange: setIsWorkbookStreamConnected,
    });
    return () => {
      setIsWorkbookStreamConnected(false);
      unsubscribe();
    };
  }, [applyIncomingEvents, filterUnseenWorkbookEvents, session, sessionId, triggerSessionResync]);

  useEffect(() => {
    if (!sessionId || !session) {
      workbookLiveSendRef.current = null;
      return;
    }
    const connection = subscribeWorkbookLiveSocket({
      sessionId,
      onEvents: (payload) => {
        if (payload.sessionId !== sessionId) return;
        const unseenEvents = filterUnseenWorkbookEvents(payload.events, {
          allowLiveReplay: true,
        });
        if (hasWorkbookEventGap(latestSeqRef.current, unseenEvents)) {
          observeWorkbookRealtimeGap({
            sessionId,
            channel: "live",
            latestSeq: latestSeqRef.current,
            nextSeq: unseenEvents[0]?.seq ?? payload.latestSeq,
          });
          triggerSessionResync();
          return;
        }
        if (unseenEvents.length > 0) {
          observeWorkbookRealtimeReceive({
            sessionId,
            channel: "live",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
          applyIncomingEvents(unseenEvents);
          observeWorkbookRealtimeApply({
            sessionId,
            channel: "live",
            latestSeq: payload.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = resolveNextLatestSeq(
          latestSeqRef.current,
          payload.latestSeq,
          unseenEvents
        );
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
      },
      onConnectionChange: setIsWorkbookLiveConnected,
    });
    workbookLiveSendRef.current = connection.sendEvents;
    return () => {
      workbookLiveSendRef.current = null;
      setIsWorkbookLiveConnected(false);
      connection.close();
    };
  }, [applyIncomingEvents, filterUnseenWorkbookEvents, session, sessionId, triggerSessionResync]);

  useEffect(() => {
    personalBoardSettingsReadyRef.current = false;
    if (!personalBoardSettingsStorageKey) return;
    const stored = readStorage<Partial<WorkbookPersonalBoardSettings> | null>(
      personalBoardSettingsStorageKey,
      null
    );
    if (stored) {
      const normalized = normalizeWorkbookPersonalBoardSettings(stored);
      skipNextPersonalBoardSettingsPersistRef.current = true;
      setPenToolSettings(normalized.penToolSettings);
      setHighlighterToolSettings(normalized.highlighterToolSettings);
      setEraserRadius(normalized.eraserRadius);
      setSmartInkOptions(normalized.smartInkOptions);
    }
    personalBoardSettingsReadyRef.current = true;
  }, [personalBoardSettingsStorageKey]);

  useEffect(() => {
    if (!personalBoardSettingsStorageKey || !personalBoardSettingsReadyRef.current) return;
    if (skipNextPersonalBoardSettingsPersistRef.current) {
      skipNextPersonalBoardSettingsPersistRef.current = false;
      return;
    }
    writeStorage(personalBoardSettingsStorageKey, {
      penToolSettings,
      highlighterToolSettings,
      eraserRadius: clampedEraserRadius,
      smartInkOptions: normalizeSmartInkOptions(smartInkOptions),
    });
  }, [
    clampedEraserRadius,
    highlighterToolSettings,
    penToolSettings,
    personalBoardSettingsStorageKey,
    smartInkOptions,
  ]);

  useEffect(() => {
    if (!sessionId || !session) return;
    let active = true;
    const heartbeat = async () => {
      try {
        const response = await heartbeatWorkbookPresence(sessionId);
        if (!active) return;
        setSession((current) =>
          current
            ? areParticipantsEqual(current.participants, response.participants)
              ? current
              : { ...current, participants: response.participants }
            : current
        );
      } catch {
        // ignore transient presence errors
      }
    };
    void heartbeat();
    const intervalId = window.setInterval(() => {
      void heartbeat();
    }, PRESENCE_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [areParticipantsEqual, session, sessionId]);

  useEffect(() => {
    if (!sessionId || !showCollaborationPanels || !user?.id) return;
    presenceLeaveSentRef.current = false;
    const leaveUrl = `/api/workbook/sessions/${encodeURIComponent(sessionId)}/presence/leave`;
    const sendLeave = () => {
      if (presenceLeaveSentRef.current) return;
      presenceLeaveSentRef.current = true;
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const payload = new Blob([JSON.stringify({})], {
          type: "application/json",
        });
        navigator.sendBeacon(leaveUrl, payload);
        return;
      }
      void fetch(leaveUrl, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    };
    const onPageHide = () => {
      sendLeave();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      if (!presenceLeaveSentRef.current) {
        void leaveWorkbookPresence(sessionId).catch(() => {
          // ignore leave errors
        });
      }
      presenceLeaveSentRef.current = false;
    };
  }, [sessionId, showCollaborationPanels, user?.id]);

  useEffect(() => {
    if (!sessionChatReadStorageKey) {
      setSessionChatReadAt(null);
      return;
    }
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(sessionChatReadStorageKey);
    setSessionChatReadAt(stored && stored.trim().length > 0 ? stored : null);
  }, [sessionChatReadStorageKey]);

  useEffect(() => {
    if (!canUseSessionChat && isSessionChatOpen) {
      setIsSessionChatOpen(false);
      setIsSessionChatEmojiOpen(false);
      setSessionChatDraft("");
    }
  }, [canUseSessionChat, isSessionChatOpen]);

  useEffect(() => {
    if (!isSessionChatOpen || isSessionChatMinimized) return;
    const hasUnread = Boolean(firstUnreadSessionChatMessageId);
    if (sessionChatShouldScrollToUnreadRef.current) {
      sessionChatShouldScrollToUnreadRef.current = false;
      if (hasUnread && firstUnreadSessionChatMessageId) {
        const scrolled = scrollSessionChatToMessage(firstUnreadSessionChatMessageId);
        if (!scrolled) {
          window.requestAnimationFrame(() => {
            void scrollSessionChatToMessage(firstUnreadSessionChatMessageId);
          });
        }
        return;
      }
      scrollSessionChatToLatest();
      return;
    }
    if (isSessionChatAtBottom) {
      scrollSessionChatToLatest();
      if (sessionChatUnreadCount > 0) {
        markSessionChatReadToLatest();
      }
    }
  }, [
    chatMessages,
    firstUnreadSessionChatMessageId,
    isSessionChatAtBottom,
    isSessionChatMinimized,
    isSessionChatOpen,
    markSessionChatReadToLatest,
    scrollSessionChatToLatest,
    scrollSessionChatToMessage,
    sessionChatUnreadCount,
  ]);

  useEffect(() => {
    if (!isSessionChatOpen || isSessionChatMinimized) return;
    const container = sessionChatListRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceToBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const nextAtBottom = distanceToBottom <= SESSION_CHAT_SCROLL_BOTTOM_THRESHOLD_PX;
      setIsSessionChatAtBottom(nextAtBottom);
      if (nextAtBottom && sessionChatUnreadCount > 0) {
        markSessionChatReadToLatest();
      }
    };
    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [
    isSessionChatMinimized,
    isSessionChatOpen,
    markSessionChatReadToLatest,
    sessionChatUnreadCount,
  ]);

  useEffect(() => {
    if (
      isCompactViewport ||
      !isSessionChatOpen ||
      isSessionChatMinimized ||
      isSessionChatMaximized
    ) {
      return;
    }
    const panel = sessionChatRef.current;
    if (!panel || typeof window === "undefined") return;
    const panelWidth = panel.offsetWidth || 420;
    const panelHeight = panel.offsetHeight || 420;
    const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
    const maxY = Math.max(8, window.innerHeight - panelHeight - 8);
    setSessionChatPosition((current) => ({
      x: Math.min(maxX, Math.max(8, current.x)),
      y: Math.min(maxY, Math.max(8, current.y)),
    }));
  }, [isCompactViewport, isSessionChatMaximized, isSessionChatMinimized, isSessionChatOpen]);

  useEffect(() => {
    if (
      isCompactViewport ||
      !isSessionChatOpen ||
      isSessionChatMaximized ||
      isSessionChatMinimized
    ) {
      return;
    }
    const onPointerMove = (event: PointerEvent) => {
      const dragState = sessionChatDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const panel = sessionChatRef.current;
      if (!panel) return;
      const panelWidth = panel.offsetWidth || 420;
      const panelHeight = panel.offsetHeight || 420;
      const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
      const maxY = Math.max(8, window.innerHeight - panelHeight - 8);
      setSessionChatPosition({
        x: Math.min(maxX, Math.max(8, event.clientX - dragState.offsetX)),
        y: Math.min(maxY, Math.max(8, event.clientY - dragState.offsetY)),
      });
    };
    const onPointerUp = (event: PointerEvent) => {
      const dragState = sessionChatDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      sessionChatDragStateRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      sessionChatDragStateRef.current = null;
    };
  }, [isCompactViewport, isSessionChatMaximized, isSessionChatMinimized, isSessionChatOpen]);

  useEffect(() => {
    if (!isCompactViewport) return;
    sessionChatDragStateRef.current = null;
    setSessionChatPosition({ x: 8, y: 56 });
  }, [isCompactViewport]);

  const persistSnapshots = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    if (!sessionId) return false;
    if (!options?.force && !dirtyRef.current) return true;
    if (isSavingRef.current) {
      pendingAutosaveAfterSaveRef.current = true;
      return true;
    }
    isSavingRef.current = true;
    pendingAutosaveAfterSaveRef.current = false;
    const revisionAtSaveStart = dirtyRevisionRef.current;
    if (!options?.silent) {
      setSaveState("saving");
    }
    try {
      await Promise.all([
        saveWorkbookSnapshot({
          sessionId,
          layer: "board",
          version: latestSeq,
          payload: encodeScenePayload({
            strokes: boardStrokes,
            objects: boardObjects,
            constraints,
            chat: chatMessages,
            comments,
            timer: timerState,
            boardSettings,
            library: libraryState,
            document: documentState,
          }),
        }),
        saveWorkbookSnapshot({
          sessionId,
          layer: "annotations",
          version: latestSeq,
          payload: encodeScenePayload({
            strokes: annotationStrokes,
            chat: [],
          }),
        }),
      ]);

      if (dirtyRevisionRef.current === revisionAtSaveStart) {
        dirtyRef.current = false;
        setSaveState("saved");
      } else {
        dirtyRef.current = true;
        pendingAutosaveAfterSaveRef.current = true;
        setSaveState("saving");
      }

      return true;
    } catch {
      setSaveState("error");
      return false;
    } finally {
      isSavingRef.current = false;
      if (pendingAutosaveAfterSaveRef.current) {
        scheduleAutosave(320);
      }
    }
  }, [
    annotationStrokes,
    boardObjects,
    boardStrokes,
    constraints,
    chatMessages,
    comments,
    timerState,
    boardSettings,
    libraryState,
    documentState,
    latestSeq,
    scheduleAutosave,
    sessionId,
  ]);

  useEffect(() => {
    persistSnapshotsRef.current = persistSnapshots;
    return () => {
      persistSnapshotsRef.current = null;
    };
  }, [persistSnapshots]);

  useEffect(() => {
    const onBeforeUnload = () => {
      void persistSnapshots({ silent: true, force: true });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [persistSnapshots]);

  useEffect(() => {
    const flushPendingChanges = () => {
      if (!dirtyRef.current) return;
      void persistSnapshotsRef.current?.({ silent: true, force: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingChanges();
      }
    };
    window.addEventListener("pagehide", flushPendingChanges);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPendingChanges);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !session) return;
    const intervalId = window.setInterval(() => {
      if (!dirtyRef.current) return;
      void persistSnapshots({ force: true });
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [persistSnapshots, session, sessionId]);

  useEffect(
    () => () => {
      if (dirtyRef.current) {
        void persistSnapshots({ silent: true, force: true });
      }
    },
    [persistSnapshots]
  );

  useEffect(
    () => () => {
      focusResetTimersByUserRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      focusResetTimersByUserRef.current.clear();
    },
    []
  );

  useEffect(
    () => () => {
      if (autosaveDebounceRef.current !== null) {
        window.clearTimeout(autosaveDebounceRef.current);
        autosaveDebounceRef.current = null;
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (smartInkDebounceRef.current !== null) {
        window.clearTimeout(smartInkDebounceRef.current);
        smartInkDebounceRef.current = null;
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (volatileSyncTimerRef.current !== null) {
        window.clearTimeout(volatileSyncTimerRef.current);
        volatileSyncTimerRef.current = null;
      }
      viewportSyncQueuedOffsetRef.current = null;
      eraserPreviewQueuedByGestureRef.current.clear();
    },
    []
  );

  useEffect(
    () => () => {
      clearObjectSyncRuntime();
    },
    [clearObjectSyncRuntime]
  );

  useEffect(
    () => () => {
      clearStrokePreviewRuntime();
    },
    [clearStrokePreviewRuntime]
  );

  useEffect(
    () => () => {
      clearIncomingEraserPreviewRuntime();
    },
    [clearIncomingEraserPreviewRuntime]
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const cutoff = Date.now() - STROKE_PREVIEW_EXPIRY_MS;
      setIncomingStrokePreviews((current) => {
        let changed = false;
        const next: Record<string, StrokePreviewEntry> = {};
        Object.entries(current).forEach(([strokeId, entry]) => {
          if (entry.updatedAt < cutoff) {
            changed = true;
            return;
          }
          next[strokeId] = entry;
        });
        return changed ? next : current;
      });
    }, 1_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (smartInkOptions.mode !== "off") return;
    smartInkStrokeBufferRef.current = [];
    if (smartInkDebounceRef.current !== null) {
      window.clearTimeout(smartInkDebounceRef.current);
      smartInkDebounceRef.current = null;
    }
  }, [smartInkOptions.mode]);

  const sendWorkbookLiveEvents = useCallback(
    (events: WorkbookClientEventInput[]) => {
      if (!sessionId || events.length === 0) return;
      observeWorkbookRealtimeSend({
        sessionId,
        channel: "live",
        events,
      });
      const sent = workbookLiveSendRef.current?.(events) ?? false;
      if (sent) return;
      void appendWorkbookLiveEvents({ sessionId, events }).catch(() => {
        // ignore volatile delivery failures: the next local frame will resend a fresher preview
      });
    },
    [sessionId]
  );

  const appendEventsAndApply = useCallback(
    async (
      events: WorkbookClientEventInput[],
      options?: {
        trackHistory?: boolean;
        markDirty?: boolean;
        historyEntry?: WorkbookHistoryEntry | null;
      }
    ) => {
      if (!sessionId) return;
      const trackHistory =
        options?.trackHistory ??
        events.some((event) => isHistoryTrackedWorkbookEventType(event.type));
      const shouldMarkDirty =
        options?.markDirty ?? events.some((event) => isDirtyWorkbookEventType(event.type));
      const historyEntry =
        options && Object.prototype.hasOwnProperty.call(options, "historyEntry")
          ? options.historyEntry ?? null
          : trackHistory
            ? buildHistoryEntryFromEvents(events)
            : null;
      const preparedEvents = withWorkbookClientEventIds(events);
      observeWorkbookRealtimeSend({
        sessionId,
        channel: "persist",
        events: preparedEvents,
      });
      const optimisticEventIds = preparedEvents
        .filter((event) => isOptimisticWorkbookEventType(event.type))
        .map((event) => event.clientEventId)
        .filter((eventId): eventId is string => typeof eventId === "string" && eventId.length > 0);
      if (historyEntry) {
        pushHistoryEntry(historyEntry);
      }
      optimisticEventIds.forEach((eventId) => {
        processedEventIdsRef.current.add(eventId);
      });
      try {
        const response = await appendWorkbookEvents({
          sessionId,
          events: preparedEvents,
        });
        observeWorkbookRealtimePersistAck({
          sessionId,
          latestSeq: response.latestSeq,
          events: response.events,
        });
        const unseenEvents = filterUnseenWorkbookEvents(response.events);
        if (unseenEvents.length > 0) {
          applyIncomingEvents(unseenEvents);
          observeWorkbookRealtimeApply({
            sessionId,
            channel: "persist",
            latestSeq: response.latestSeq,
            events: unseenEvents,
          });
        }
        const nextLatest = resolveNextLatestSeq(
          latestSeqRef.current,
          response.latestSeq,
          unseenEvents
        );
        if (nextLatest > latestSeqRef.current) {
          latestSeqRef.current = nextLatest;
          setLatestSeq(nextLatest);
        }
        if (shouldMarkDirty) {
          markDirty();
        }
      } catch (error) {
        optimisticEventIds.forEach((eventId) => {
          processedEventIdsRef.current.delete(eventId);
        });
        if (historyEntry) {
          rollbackHistoryEntry();
        }
        throw error;
      }
    },
    [
      applyIncomingEvents,
      buildHistoryEntryFromEvents,
      filterUnseenWorkbookEvents,
      markDirty,
      pushHistoryEntry,
      rollbackHistoryEntry,
      sessionId,
    ]
  );

  const flushQueuedVolatileSync = useCallback(() => {
    if (!sessionId || !session || isEnded) {
      viewportSyncQueuedOffsetRef.current = null;
      objectPreviewQueuedPatchRef.current.clear();
      strokePreviewQueuedByIdRef.current.clear();
      return;
    }

    const events: Array<{ type: WorkbookEvent["type"]; payload: unknown }> = [];
    const queuedOffset = viewportSyncQueuedOffsetRef.current;
    if (queuedOffset && session.kind === "CLASS") {
      const now = Date.now();
      const elapsed = now - viewportSyncLastSentAtRef.current;
      if (elapsed >= VIEWPORT_SYNC_MIN_INTERVAL_MS) {
        viewportSyncQueuedOffsetRef.current = null;
        viewportSyncLastSentAtRef.current = now;
        events.push({
          type: "board.viewport.sync",
          payload: { offset: queuedOffset },
        });
      } else if (volatileSyncTimerRef.current === null) {
        volatileSyncTimerRef.current = window.setTimeout(() => {
          volatileSyncTimerRef.current = null;
          flushQueuedVolatileSync();
        }, VIEWPORT_SYNC_MIN_INTERVAL_MS - elapsed);
      }
    }

    if (canSelect) {
      objectPreviewQueuedPatchRef.current.forEach((patch, objectId) => {
        objectPreviewQueuedPatchRef.current.delete(objectId);
        const nextPreviewVersion = (objectPreviewVersionRef.current.get(objectId) ?? 0) + 1;
        objectPreviewVersionRef.current.set(objectId, nextPreviewVersion);
        events.push({
          type: "board.object.preview",
          payload: {
            objectId,
            patch,
            previewVersion: nextPreviewVersion,
          },
        });
      });
    } else {
      objectPreviewQueuedPatchRef.current.clear();
    }

    if (canDraw) {
      strokePreviewQueuedByIdRef.current.forEach((entry, strokeId) => {
        if (finalizedStrokePreviewIdsRef.current.has(strokeId)) {
          strokePreviewQueuedByIdRef.current.delete(strokeId);
          return;
        }
        strokePreviewQueuedByIdRef.current.delete(strokeId);
        events.push({
          type:
            entry.stroke.layer === "annotations"
              ? ("annotations.stroke.preview" as const)
              : ("board.stroke.preview" as const),
          payload: {
            stroke: entry.stroke,
            previewVersion: entry.previewVersion,
          },
        });
      });
      eraserPreviewQueuedByGestureRef.current.forEach((entry, gestureId) => {
        eraserPreviewQueuedByGestureRef.current.delete(gestureId);
        events.push({
          type: "board.eraser.preview",
          payload: {
            gestureId: entry.gestureId,
            layer: entry.layer,
            page: entry.page,
            radius: entry.radius,
            points: entry.points,
            ...(entry.ended ? { ended: true } : {}),
          },
        });
      });
    } else {
      strokePreviewQueuedByIdRef.current.clear();
      eraserPreviewQueuedByGestureRef.current.clear();
    }

    if (events.length > 0) {
      sendWorkbookLiveEvents(events);
    }
  }, [canDraw, canSelect, isEnded, sendWorkbookLiveEvents, session, sessionId]);

  const scheduleVolatileSyncFlush = useCallback(
    (delay = VOLATILE_SYNC_FLUSH_INTERVAL_MS) => {
      if (volatileSyncTimerRef.current !== null) return;
      volatileSyncTimerRef.current = window.setTimeout(() => {
        volatileSyncTimerRef.current = null;
        flushQueuedVolatileSync();
      }, Math.max(0, delay));
    },
    [flushQueuedVolatileSync]
  );

  const queueViewportSync = useCallback(
    (offset: WorkbookPoint) => {
      viewportSyncQueuedOffsetRef.current = offset;
      const elapsed = Date.now() - viewportSyncLastSentAtRef.current;
      const delay =
        elapsed >= VIEWPORT_SYNC_MIN_INTERVAL_MS ? 0 : VIEWPORT_SYNC_MIN_INTERVAL_MS - elapsed;
      scheduleVolatileSyncFlush(delay);
    },
    [scheduleVolatileSyncFlush]
  );

  const handleCanvasViewportOffsetChange = useCallback(
    (offset: WorkbookPoint) => {
      setCanvasViewport(offset);
      queueViewportSync(offset);
    },
    [queueViewportSync]
  );

  const queueStrokePreview = useCallback(
    (payload: { stroke: WorkbookStroke; previewVersion: number }) => {
      const strokeId = payload.stroke.id;
      if (!strokeId || finalizedStrokePreviewIdsRef.current.has(strokeId)) return;
      strokePreviewQueuedByIdRef.current.set(strokeId, payload);
      scheduleVolatileSyncFlush();
    },
    [scheduleVolatileSyncFlush]
  );

  const queueEraserPreview = useCallback(
    (payload: {
      gestureId: string;
      layer: WorkbookLayer;
      page: number;
      radius: number;
      points: WorkbookPoint[];
      ended?: boolean;
    }) => {
      if (!payload.gestureId) return;
      const current = eraserPreviewQueuedByGestureRef.current.get(payload.gestureId);
      const mergedPoints = mergePreviewPathPoints(
        current?.points ?? [],
        payload.points,
        ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX
      );
      eraserPreviewQueuedByGestureRef.current.set(payload.gestureId, {
        gestureId: payload.gestureId,
        layer: payload.layer,
        page: payload.page,
        radius: payload.radius,
        points: mergedPoints,
        ended: Boolean(current?.ended || payload.ended),
      });
      scheduleVolatileSyncFlush(payload.ended ? 0 : undefined);
    },
    [scheduleVolatileSyncFlush]
  );

  const flushQueuedObjectUpdate = useCallback(
    (objectId: string) => {
      if (objectUpdateTimersRef.current.has(objectId)) return;
      const timerId = window.setTimeout(() => {
        objectUpdateTimersRef.current.delete(objectId);
        if (objectUpdateInFlightRef.current.has(objectId)) {
          flushQueuedObjectUpdate(objectId);
          return;
        }
        const queuedPatch = objectUpdateQueuedPatchRef.current.get(objectId);
        if (!queuedPatch) return;
        objectUpdateQueuedPatchRef.current.delete(objectId);
        const dispatchOptions = objectUpdateDispatchOptionsRef.current.get(objectId) ?? {
          trackHistory: true,
          markDirty: true,
        };
        objectUpdateDispatchOptionsRef.current.delete(objectId);
        const historyBefore = objectUpdateHistoryBeforeRef.current.get(objectId) ?? null;
        const historyEntry =
          dispatchOptions.trackHistory !== false && historyBefore
            ? (() => {
                const historyAfter = mergeBoardObjectWithPatch(historyBefore, queuedPatch);
                const forwardPatch = buildBoardObjectDiffPatch(historyBefore, historyAfter);
                const inversePatch = buildBoardObjectDiffPatch(historyAfter, historyBefore);
                if (!forwardPatch || !inversePatch) return null;
                return {
                  forward: [{ kind: "patch_object" as const, objectId, patch: forwardPatch }],
                  inverse: [{ kind: "patch_object" as const, objectId, patch: inversePatch }],
                  createdAt: new Date().toISOString(),
                } satisfies WorkbookHistoryEntry;
              })()
            : null;
        objectUpdateInFlightRef.current.add(objectId);
        void appendEventsAndApply([
          {
            type: "board.object.update",
            payload: { objectId, patch: queuedPatch },
          },
        ], {
          ...dispatchOptions,
          historyEntry,
        })
          .catch((error) => {
            if (error instanceof ApiError && error.code === "not_found") {
              objectUpdateQueuedPatchRef.current.delete(objectId);
              objectUpdateDispatchOptionsRef.current.delete(objectId);
              objectUpdateHistoryBeforeRef.current.delete(objectId);
              incomingPreviewQueuedPatchRef.current.delete(objectId);
              return;
            }
            if (
              error instanceof ApiError &&
              error.code === "conflict" &&
              error.status === 409
            ) {
              // Usually means invalid stale patch (object already changed/removed or rights updated).
              // Drop stale patch to avoid infinite retry loops.
              objectUpdateQueuedPatchRef.current.delete(objectId);
              objectUpdateDispatchOptionsRef.current.delete(objectId);
              objectUpdateHistoryBeforeRef.current.delete(objectId);
              objectPreviewQueuedPatchRef.current.delete(objectId);
              incomingPreviewQueuedPatchRef.current.delete(objectId);
              return;
            }
            const isTransientError =
              error instanceof ApiError &&
              (error.code === "server_unavailable" ||
                error.code === "network_error" ||
                error.code === "timeout" ||
                error.code === "rate_limited");
            if (isTransientError) {
              const pendingPatch = objectUpdateQueuedPatchRef.current.get(objectId) ?? {};
              objectUpdateQueuedPatchRef.current.set(objectId, {
                ...queuedPatch,
                ...pendingPatch,
              });
              const pendingOptions = objectUpdateDispatchOptionsRef.current.get(objectId) ?? {
                trackHistory: false,
                markDirty: false,
              };
              objectUpdateDispatchOptionsRef.current.set(objectId, {
                trackHistory: dispatchOptions.trackHistory || pendingOptions.trackHistory,
                markDirty: dispatchOptions.markDirty || pendingOptions.markDirty,
              });
              return;
            }
            setError("Не удалось обновить объект.");
          })
          .finally(() => {
            objectUpdateInFlightRef.current.delete(objectId);
            if (!objectUpdateQueuedPatchRef.current.has(objectId)) {
              objectUpdateHistoryBeforeRef.current.delete(objectId);
            }
            if (objectUpdateQueuedPatchRef.current.has(objectId)) {
              flushQueuedObjectUpdate(objectId);
            }
          });
      }, OBJECT_UPDATE_FLUSH_INTERVAL_MS);
      objectUpdateTimersRef.current.set(objectId, timerId);
    },
    [appendEventsAndApply]
  );

  const clearLayerNow = useCallback(
    async (target: WorkbookLayer) => {
      await appendEventsAndApply([
        {
          type: target === "board" ? "board.clear" : "annotations.clear",
          payload: {},
        },
      ]);
      setPendingClearRequest(null);
      setAwaitingClearRequest(null);
    },
    [appendEventsAndApply]
  );

  const flushQueuedBoardSettingsCommit = useCallback(async () => {
    if (!canManageSharedBoardSettings || boardSettingsCommitInFlightRef.current) return;
    const nextSettings = queuedBoardSettingsCommitRef.current;
    if (!nextSettings) return;
    const historyBefore = queuedBoardSettingsHistoryBeforeRef.current;
    queuedBoardSettingsCommitRef.current = null;
    boardSettingsCommitInFlightRef.current = true;
    try {
      const forwardPatch = historyBefore
        ? buildBoardSettingsDiffPatch(historyBefore, nextSettings)
        : null;
      const inversePatch = historyBefore
        ? buildBoardSettingsDiffPatch(nextSettings, historyBefore)
        : null;
      await appendEventsAndApply([
        {
          type: "board.settings.update",
          payload: {
            boardSettings: {
              ...nextSettings,
              smartInk: DEFAULT_SMART_INK_OPTIONS,
            },
          },
        },
      ], {
        historyEntry:
          forwardPatch && inversePatch
            ? {
                forward: [{ kind: "patch_board_settings", patch: forwardPatch }],
                inverse: [{ kind: "patch_board_settings", patch: inversePatch }],
                createdAt: new Date().toISOString(),
              }
            : null,
      });
      queuedBoardSettingsHistoryBeforeRef.current = null;
    } catch {
      setError("Не удалось сохранить настройки доски.");
    } finally {
      boardSettingsCommitInFlightRef.current = false;
      if (queuedBoardSettingsCommitRef.current) {
        void flushQueuedBoardSettingsCommit();
      }
    }
  }, [appendEventsAndApply, canManageSharedBoardSettings]);

  const scheduleBoardSettingsCommit = useCallback(
    (nextSettings: WorkbookBoardSettings) => {
      if (!canManageSharedBoardSettings || typeof window === "undefined") return;
      queuedBoardSettingsCommitRef.current = nextSettings;
      if (boardSettingsCommitTimerRef.current !== null) {
        window.clearTimeout(boardSettingsCommitTimerRef.current);
      }
      boardSettingsCommitTimerRef.current = window.setTimeout(() => {
        boardSettingsCommitTimerRef.current = null;
        void flushQueuedBoardSettingsCommit();
      }, 220);
    },
    [canManageSharedBoardSettings, flushQueuedBoardSettingsCommit]
  );

  const handleSharedBoardSettingsChange = useCallback(
    (patch: Partial<WorkbookBoardSettings>) => {
      if (!canManageSharedBoardSettings) return;
      setBoardSettings((current) => {
        if (!queuedBoardSettingsHistoryBeforeRef.current) {
          queuedBoardSettingsHistoryBeforeRef.current = cloneSerializable(current);
        }
        const merged = { ...current, ...patch };
        const normalizedLayers = normalizeSceneLayersForBoard(
          merged.sceneLayers,
          merged.activeSceneLayerId
        );
        const nextPagesCount = Math.max(1, Math.round(merged.pagesCount || 1));
        const nextSettings: WorkbookBoardSettings = {
          ...merged,
          sceneLayers: normalizedLayers.sceneLayers,
          activeSceneLayerId: normalizedLayers.activeSceneLayerId,
          title: typeof merged.title === "string" ? merged.title : current.title,
          gridSize: Math.max(8, Math.min(96, Math.round(merged.gridSize || current.gridSize))),
          currentPage: Math.max(
            1,
            Math.min(nextPagesCount, Math.round(merged.currentPage || current.currentPage || 1))
          ),
          pagesCount: nextPagesCount,
          dividerStep: Math.max(
            320,
            Math.min(2400, Math.round(merged.dividerStep || current.dividerStep || 320))
          ),
        };
        scheduleBoardSettingsCommit(nextSettings);
        return nextSettings;
      });
    },
    [canManageSharedBoardSettings, scheduleBoardSettingsCommit]
  );

  const upsertLibraryItem = useCallback(
    async (item: WorkbookLibraryState["items"][number]) => {
      try {
        await appendEventsAndApply([
          {
            type: "library.item.upsert",
            payload: { item },
          },
        ]);
      } catch {
        setError("Не удалось сохранить материал в библиотеке.");
      }
    },
    [appendEventsAndApply]
  );

  const updateTimer = useCallback(
    async (timer: WorkbookTimerState | null) => {
      try {
        await appendEventsAndApply([
          {
            type: "timer.update",
            payload: { timer },
          },
        ]);
      } catch {
        setError("Не удалось синхронизировать таймер.");
      }
    },
    [appendEventsAndApply]
  );

  useEffect(() => {
    if (!timerState || timerState.status !== "running") return;
    const intervalId = window.setInterval(() => {
      setTimerState((current) => {
        if (!current || current.status !== "running") return current;
        if (current.remainingSec <= 1) {
          const completed: WorkbookTimerState = {
            ...current,
            remainingSec: 0,
            status: "done",
            updatedAt: new Date().toISOString(),
          };
          void updateTimer(completed);
          return completed;
        }
        return {
          ...current,
          remainingSec: current.remainingSec - 1,
          updatedAt: new Date().toISOString(),
        };
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [timerState, updateTimer]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!sessionRootRef.current) {
        setIsFullscreen(false);
        return;
      }
      setIsFullscreen(document.fullscreenElement === sessionRootRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    const rootNode = sessionRootRef.current;
    if (!rootNode) return;
    try {
      if (document.fullscreenElement === rootNode) {
        await document.exitFullscreen();
        return;
      }
      await rootNode.requestFullscreen();
    } catch {
      setError("Не удалось переключить полноэкранный режим.");
    }
  };

  const zoomIn = () => {
    setViewportZoom((current) => Math.min(3, Number((current + 0.1).toFixed(2))));
  };

  const zoomOut = () => {
    setViewportZoom((current) => Math.max(0.3, Number((current - 0.1).toFixed(2))));
  };

  const resetZoom = () => {
    setViewportZoom(1);
  };

  const selectedObjectForUtilityPanel =
    boardObjects.find((item) => item.id === selectedObjectId) ?? null;

  const resolveUtilityPanelPositionNearObject = useCallback(
    (
      targetObject: WorkbookBoardObject | null,
      tab: "graph" | "transform"
    ): { x: number; y: number } | null => {
      if (isCompactViewport || !targetObject || typeof window === "undefined") {
        return null;
      }
      const canvasElement = workspaceRef.current?.querySelector<HTMLDivElement>(
        ".workbook-session__canvas"
      );
      if (!canvasElement) return null;
      const canvasRect = canvasElement.getBoundingClientRect();
      if (canvasRect.width <= 1 || canvasRect.height <= 1) return null;
      const measuredPanelRect = utilityPanelRef.current?.getBoundingClientRect() ?? null;
      const fallbackWidth = tab === "graph" ? 392 : 380;
      const panelWidth = Math.max(
        280,
        Math.min(
          measuredPanelRect?.width ?? fallbackWidth,
          Math.max(280, canvasRect.width - 18)
        )
      );
      const panelHeight = Math.max(
        220,
        measuredPanelRect?.height ?? (isUtilityPanelCollapsed ? 92 : 560)
      );
      const bounds = getObjectExportBounds(targetObject);
      const objectLeft = canvasRect.left + (bounds.minX - canvasViewport.x) * viewportZoom;
      const objectRight = canvasRect.left + (bounds.maxX - canvasViewport.x) * viewportZoom;
      const objectTop = canvasRect.top + (bounds.minY - canvasViewport.y) * viewportZoom;
      const objectBottom = canvasRect.top + (bounds.maxY - canvasViewport.y) * viewportZoom;
      const objectHeight = Math.max(24, objectBottom - objectTop);
      const gap = 14;
      const availableLeft = Math.max(12, canvasRect.left + 6);
      const availableRight = Math.min(window.innerWidth - 12, canvasRect.right - 6);
      const availableTop = Math.max(12, canvasRect.top + 6);
      const availableBottom = Math.min(window.innerHeight - 12, canvasRect.bottom - 6);
      const maxX = Math.max(availableLeft, availableRight - panelWidth);
      const maxY = Math.max(availableTop, availableBottom - panelHeight);
      const fitsRight = objectRight + gap + panelWidth <= availableRight;
      const fitsLeft = objectLeft - gap - panelWidth >= availableLeft;
      const nextX = fitsRight
        ? objectRight + gap
        : fitsLeft
          ? objectLeft - gap - panelWidth
          : Math.max(
              availableLeft,
              Math.min(maxX, objectRight + gap)
            );
      const desiredY = objectTop + (objectHeight - panelHeight) / 2;
      return {
        x: Math.max(availableLeft, Math.min(maxX, nextX)),
        y: Math.max(availableTop, Math.min(maxY, desiredY)),
      };
    },
    [
      canvasViewport.x,
      canvasViewport.y,
      isCompactViewport,
      isUtilityPanelCollapsed,
      viewportZoom,
    ]
  );

  const openUtilityPanel = useCallback(
    (
      tab: "settings" | "graph" | "transform" | "layers",
      options?: {
        toggle?: boolean;
        anchorObject?: WorkbookBoardObject | null;
      }
    ) => {
      if (tab === "settings" && !canAccessBoardSettingsPanel) {
        return;
      }
      const anchorObject = options?.anchorObject ?? selectedObjectForUtilityPanel;
      const canOpenTransformPanel = supportsTransformUtilityPanel(anchorObject);
      const canOpenGraphPanel = supportsGraphUtilityPanel(anchorObject);
      if (tab === "transform" && !canOpenTransformPanel) {
        return;
      }
      if (tab === "graph" && !canOpenGraphPanel) {
        return;
      }
      const allowToggle = options?.toggle ?? true;
      if (allowToggle && isUtilityPanelOpen && utilityTab === tab) {
        const isSolid3dSelected = anchorObject?.type === "solid3d";
        if (tab === "transform" && isFullscreen && isSolid3dSelected) {
          return;
        }
        setIsUtilityPanelOpen(false);
        return;
      }
      setUtilityTab(tab);
      setIsUtilityPanelOpen(true);
      setIsUtilityPanelCollapsed(isCompactViewport);
      if (isCompactViewport) {
        return;
      }
      const anchoredPosition =
        tab === "graph" || tab === "transform"
          ? resolveUtilityPanelPositionNearObject(anchorObject, tab)
          : null;
      if (anchoredPosition) {
        setUtilityPanelPosition(anchoredPosition);
        return;
      }
      if (tab === "graph" || tab === "transform") {
        return;
      }
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      setUtilityPanelPosition((current) => {
        const fallbackX = Math.max(rect.left + 8, rect.right - 420);
        const fallbackY = Math.max(rect.top + 8, floatingPanelsTop);
        const nextX = current.x > 0 ? current.x : fallbackX;
        const nextY = current.y > 0 ? current.y : fallbackY;
        const minX = rect.left + 8;
        const minY = Math.max(rect.top + 8, floatingPanelsTop);
        const maxX = Math.max(minX + 24, rect.right - 320);
        const maxY = Math.max(minY + 24, rect.bottom - 120);
        return {
          x: Math.max(minX, Math.min(maxX, nextX)),
          y: Math.max(minY, Math.min(maxY, nextY)),
        };
      });
    },
    [
      canAccessBoardSettingsPanel,
      floatingPanelsTop,
      isCompactViewport,
      isFullscreen,
      isUtilityPanelOpen,
      resolveUtilityPanelPositionNearObject,
      selectedObjectForUtilityPanel,
      utilityTab,
    ]
  );

  const handleUtilityPanelDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isCompactViewport || !isUtilityPanelOpen) return;
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof HTMLElement) {
      const interactive = target.closest(
        "button, input, textarea, select, option, a, [role='button'], .MuiButtonBase-root, .MuiInputBase-root, .MuiFormControl-root, .MuiSelect-root, .MuiSwitch-root"
      );
      if (interactive) return;
    }
    event.preventDefault();
    setUtilityPanelDragState({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: utilityPanelPosition.x,
      startTop: utilityPanelPosition.y,
    });
  };

  const activateGraphCatalogCursor = useCallback(() => {
    if (graphCatalogCursorTimeoutRef.current !== null) {
      window.clearTimeout(graphCatalogCursorTimeoutRef.current);
      graphCatalogCursorTimeoutRef.current = null;
    }
    setGraphCatalogCursorActive(true);
    graphCatalogCursorTimeoutRef.current = window.setTimeout(() => {
      setGraphCatalogCursorActive(false);
      graphCatalogCursorTimeoutRef.current = null;
    }, 1300);
  }, []);

  useEffect(
    () => () => {
      if (graphCatalogCursorTimeoutRef.current !== null) {
        window.clearTimeout(graphCatalogCursorTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (isCompactViewport || !isUtilityPanelOpen) {
      setUtilityPanelDragState(null);
      return;
    }
    if (!utilityPanelDragState) return;
    const onPointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - utilityPanelDragState.startClientX;
      const deltaY = event.clientY - utilityPanelDragState.startClientY;
      const workspaceRect = workspaceRef.current?.getBoundingClientRect();
      const panelWidth = utilityPanelRef.current?.offsetWidth ?? 360;
      const panelHeight = utilityPanelRef.current?.offsetHeight ?? 420;
      const minX = (workspaceRect?.left ?? 0) + 8;
      const minY = Math.max((workspaceRect?.top ?? 0) + 8, floatingPanelsTop);
      const maxX = Math.max(
        minX + 24,
        (workspaceRect?.right ?? window.innerWidth) - panelWidth - 8
      );
      const maxY = Math.max(
        minY + 24,
        (workspaceRect?.bottom ?? window.innerHeight) - panelHeight - 8
      );
      setUtilityPanelPosition({
        x: Math.max(minX, Math.min(maxX, utilityPanelDragState.startLeft + deltaX)),
        y: Math.max(minY, Math.min(maxY, utilityPanelDragState.startTop + deltaY)),
      });
    };
    const onPointerUp = () => setUtilityPanelDragState(null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [
    floatingPanelsTop,
    isCompactViewport,
    isUtilityPanelOpen,
    utilityPanelDragState,
  ]);

  useEffect(() => {
    if (isCompactViewport) return;
    if (!isUtilityPanelOpen) return;
    if (!workspaceRef.current) return;
    setUtilityPanelPosition((current) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return current;
      const panelWidth = utilityPanelRef.current?.offsetWidth ?? 360;
      const panelHeight = utilityPanelRef.current?.offsetHeight ?? 420;
      const fallbackX = Math.max(rect.left + 8, rect.right - 420);
      const fallbackY = Math.max(rect.top + 8, floatingPanelsTop);
      const nextX = current.x > 0 ? current.x : fallbackX;
      const nextY = current.y > 0 ? current.y : fallbackY;
      const minX = rect.left + 8;
      const minY = Math.max(rect.top + 8, floatingPanelsTop);
      const maxX = Math.max(minX + 24, rect.right - panelWidth - 8);
      const maxY = Math.max(minY + 24, rect.bottom - panelHeight - 8);
      return {
        x: Math.max(minX, Math.min(maxX, nextX)),
        y: Math.max(minY, Math.min(maxY, nextY)),
      };
    });
  }, [
      isCompactViewport,
      isFullscreen,
      isUtilityPanelOpen,
      floatingPanelsTop,
      utilityTab,
  ]);

  const utilityPanelTitle = useMemo(() => {
    if (utilityTab === "settings") return "Настройки доски";
    if (utilityTab === "graph") return "График функции";
    if (utilityTab === "layers") return "Слои";
    return "Трансформации";
  }, [utilityTab]);

  const constraintShapeTypes = useMemo(
    () =>
      new Set([
        "line",
        "arrow",
        "rectangle",
        "ellipse",
        "triangle",
        "polygon",
        "solid3d",
        "section3d",
        "net3d",
      ]),
    []
  );
  const applyConstraintsForObject = useCallback(
    (object: WorkbookBoardObject, allObjects: WorkbookBoardObject[]) => {
      if (!session?.settings?.strictGeometry) return object;
      if (!constraintShapeTypes.has(object.type)) return object;
      const relevant = constraints.filter(
        (constraint) =>
          constraint.enabled &&
          (constraint.sourceObjectId === object.id ||
            constraint.targetObjectId === object.id)
      );
      if (relevant.length === 0) return object;

      const next = { ...object };
      relevant.forEach((constraint) => {
        const otherId =
          constraint.sourceObjectId === next.id
            ? constraint.targetObjectId
            : constraint.sourceObjectId;
        const other = allObjects.find((candidate) => candidate.id === otherId);
        if (!other || !constraintShapeTypes.has(other.type)) return;
        const otherDx = other.width;
        const otherDy = other.height;
        const currentLength = Math.hypot(next.width, next.height) || 1;
        const otherLength = Math.hypot(otherDx, otherDy) || 1;
        const otherAngle = Math.atan2(otherDy, otherDx);
        const currentAngle = Math.atan2(next.height, next.width);

        if (constraint.type === "parallel") {
          next.width = Math.cos(otherAngle) * currentLength;
          next.height = Math.sin(otherAngle) * currentLength;
        }
        if (constraint.type === "perpendicular") {
          const targetAngle = otherAngle + Math.PI / 2;
          next.width = Math.cos(targetAngle) * currentLength;
          next.height = Math.sin(targetAngle) * currentLength;
        }
        if (constraint.type === "equal_length") {
          next.width = Math.cos(currentAngle) * otherLength;
          next.height = Math.sin(currentAngle) * otherLength;
        }
      });
      return next;
    },
    [constraintShapeTypes, constraints, session?.settings?.strictGeometry]
  );

  const handleConfirmClear = async () => {
    if (!pendingClearRequest || pendingClearRequest.authorUserId === user?.id) return;
    try {
      await appendEventsAndApply([
        {
          type: "board.clear.confirm",
          payload: {
            requestId: pendingClearRequest.requestId,
          },
        },
      ]);
      setPendingClearRequest(null);
    } catch {
      setError("Не удалось подтвердить очистку.");
    }
  };

  useEffect(() => {
    if (!confirmedClearRequest) return;
    void clearLayerNow(confirmedClearRequest.targetLayer).finally(() => {
      setConfirmedClearRequest(null);
    });
  }, [clearLayerNow, confirmedClearRequest]);

  const requestSmartInkAdapter = useCallback(
    async (strokes: WorkbookStroke[]) => {
      if (!sessionId) return null;
      if (smartInkOptions.mode !== "full") return null;
      if (!smartInkOptions.smartTextOcr && !smartInkOptions.smartMathOcr) return null;
      try {
        const response = await recognizeWorkbookInk({
          sessionId,
          strokes: strokes.map((stroke) => ({
            id: stroke.id,
            points: stroke.points,
            width: stroke.width,
            color: stroke.color,
          })),
          preferMath: smartInkOptions.smartMathOcr,
        });
        if (!response || !response.result) return null;
        return {
          text: response.result.text ?? "",
          latex: response.result.latex ?? undefined,
          confidence:
            typeof response.result.confidence === "number"
              ? response.result.confidence
              : undefined,
        };
      } catch {
        return null;
      }
    },
    [
      sessionId,
      smartInkOptions.mode,
      smartInkOptions.smartMathOcr,
      smartInkOptions.smartTextOcr,
    ]
  );

  const processSmartInkBuffer = useCallback(async () => {
    if (smartInkOptions.mode === "off") return;
    const buffer = smartInkStrokeBufferRef.current.filter(
      (stroke) => !smartInkProcessedStrokeIdsRef.current.has(stroke.id)
    );
    if (!buffer.length) return;

    const recognitionConfig = {
      smartShapes: smartInkOptions.smartShapes,
      smartTextOcr: smartInkOptions.smartTextOcr,
      smartMathOcr: smartInkOptions.smartMathOcr,
      handwritingAdapter: async (input: {
        stroke: WorkbookStroke;
        points: WorkbookPoint[];
      }) => {
        const sourceStrokes =
          buffer.length > 1 && input.points.length > input.stroke.points.length + 2
            ? buffer
            : [input.stroke];
        return requestSmartInkAdapter(sourceStrokes);
      },
    };

    const applyRecognized = async (
      strokes: WorkbookStroke[],
      result: SmartInkDetectedResult
    ) => {
      const objectMeta =
        result.object.meta && typeof result.object.meta === "object"
          ? result.object.meta
          : {};
      const objectWithPage: WorkbookBoardObject = {
        ...result.object,
        page: result.object.page ?? boardSettings.currentPage,
        meta: {
          ...objectMeta,
          sceneLayerId: activeSceneLayerId,
          smartInkKind: result.kind,
          smartInkConfidence: result.confidence,
        },
      };
      const events: Array<{ type: WorkbookEvent["type"]; payload: unknown }> = [
        {
          type: "board.object.create",
          payload: { object: objectWithPage },
        },
        ...strokes.map((stroke) => ({
          type: "board.stroke.delete" as const,
          payload: { strokeId: stroke.id },
        })),
      ];
      try {
        await appendEventsAndApply(events);
        strokes.forEach((stroke) => {
          smartInkProcessedStrokeIdsRef.current.add(stroke.id);
        });
        smartInkStrokeBufferRef.current = smartInkStrokeBufferRef.current.filter(
          (item) => !strokes.some((stroke) => stroke.id === item.id)
        );
        setSelectedObjectId(objectWithPage.id);
      } catch {
        setError("Не удалось применить Smart Ink преобразование.");
      }
    };

    const threshold = smartInkOptions.confidenceThreshold;

    if (smartInkOptions.mode === "full" && buffer.length >= 2) {
      const batchResult = await recognizeSmartInkBatch(buffer, recognitionConfig);
      if (batchResult.kind !== "none" && batchResult.confidence >= threshold) {
        await applyRecognized(buffer, batchResult);
        return;
      }
    }

    const lastStroke = buffer[buffer.length - 1];
    const singleResult = await recognizeSmartInkStroke(lastStroke, recognitionConfig);
    if (singleResult.kind !== "none" && singleResult.confidence >= threshold) {
      await applyRecognized([lastStroke], singleResult);
      return;
    }

    if (smartInkStrokeBufferRef.current.length > 8) {
      smartInkStrokeBufferRef.current = smartInkStrokeBufferRef.current.slice(-8);
    }
  }, [
    requestSmartInkAdapter,
    smartInkOptions.confidenceThreshold,
    smartInkOptions.mode,
    smartInkOptions.smartMathOcr,
    smartInkOptions.smartShapes,
    smartInkOptions.smartTextOcr,
    activeSceneLayerId,
    appendEventsAndApply,
    boardSettings.currentPage,
  ]);

  const queueSmartInkStroke = useCallback(
    (stroke: WorkbookStroke) => {
      if (smartInkOptions.mode === "off") return;
      smartInkStrokeBufferRef.current = [...smartInkStrokeBufferRef.current, stroke];
      if (smartInkDebounceRef.current !== null) {
        window.clearTimeout(smartInkDebounceRef.current);
      }
      smartInkDebounceRef.current = window.setTimeout(() => {
        smartInkDebounceRef.current = null;
        void processSmartInkBuffer();
      }, smartInkOptions.mode === "full" ? 620 : 360);
    },
    [processSmartInkBuffer, smartInkOptions.mode]
  );

  const applyLocalStrokeCollection = useCallback(
    (
      targetLayer: WorkbookLayer,
      updater: (current: WorkbookStroke[]) => WorkbookStroke[]
    ) => {
      if (targetLayer === "annotations") {
        setAnnotationStrokes(updater);
        return;
      }
      setBoardStrokes(updater);
    },
    []
  );

  const applyHistoryOperations = useCallback(
    (operations: WorkbookHistoryOperation[]) => {
      operations.forEach((operation) => {
        if (operation.kind === "upsert_stroke") {
          finalizeStrokePreview(operation.stroke.id);
          applyLocalStrokeCollection(operation.layer, (current) => {
            const exists = current.some((item) => item.id === operation.stroke.id);
            if (!exists) return [...current, cloneSerializable(operation.stroke)];
            return current.map((item) =>
              item.id === operation.stroke.id ? cloneSerializable(operation.stroke) : item
            );
          });
          return;
        }
        if (operation.kind === "remove_stroke") {
          finalizeStrokePreview(operation.strokeId);
          applyLocalStrokeCollection(operation.layer, (current) =>
            current.filter((item) => item.id !== operation.strokeId)
          );
          return;
        }
        if (operation.kind === "upsert_object") {
          const nextObject = cloneSerializable(operation.object);
          setBoardObjects((current) => {
            const exists = current.some((item) => item.id === nextObject.id);
            if (!exists) return [...current, nextObject];
            return current.map((item) => (item.id === nextObject.id ? nextObject : item));
          });
          return;
        }
        if (operation.kind === "patch_object") {
          setBoardObjects((current) =>
            current.map((item) =>
              item.id === operation.objectId
                ? mergeBoardObjectWithPatch(item, cloneSerializable(operation.patch))
                : item
            )
          );
          return;
        }
        if (operation.kind === "remove_object") {
          const objectId = operation.objectId;
          objectUpdateQueuedPatchRef.current.delete(objectId);
          objectUpdateDispatchOptionsRef.current.delete(objectId);
          objectUpdateHistoryBeforeRef.current.delete(objectId);
          objectPreviewQueuedPatchRef.current.delete(objectId);
          objectPreviewVersionRef.current.delete(objectId);
          incomingPreviewQueuedPatchRef.current.delete(objectId);
          objectUpdateInFlightRef.current.delete(objectId);
          Array.from(incomingPreviewVersionByAuthorObjectRef.current.keys()).forEach((key) => {
            if (key.endsWith(`:${objectId}`)) {
              incomingPreviewVersionByAuthorObjectRef.current.delete(key);
            }
          });
          const pendingUpdateTimer = objectUpdateTimersRef.current.get(objectId);
          if (pendingUpdateTimer !== undefined) {
            window.clearTimeout(pendingUpdateTimer);
            objectUpdateTimersRef.current.delete(objectId);
          }
          setBoardObjects((current) => current.filter((item) => item.id !== objectId));
          setConstraints((current) =>
            current.filter(
              (constraint) =>
                constraint.sourceObjectId !== objectId &&
                constraint.targetObjectId !== objectId
            )
          );
          setSelectedObjectId((current) => (current === objectId ? null : current));
          return;
        }
        if (operation.kind === "upsert_constraint") {
          const nextConstraint = cloneSerializable(operation.constraint);
          setConstraints((current) => {
            const exists = current.some((item) => item.id === nextConstraint.id);
            if (!exists) return [...current, nextConstraint];
            return current.map((item) => (item.id === nextConstraint.id ? nextConstraint : item));
          });
          return;
        }
        if (operation.kind === "remove_constraint") {
          setConstraints((current) =>
            current.filter((item) => item.id !== operation.constraintId)
          );
          setSelectedConstraintId((current) =>
            current === operation.constraintId ? null : current
          );
          return;
        }
        if (operation.kind === "patch_board_settings") {
          setBoardSettings((current) => {
            const merged = {
              ...current,
              ...cloneSerializable(operation.patch),
            };
            const normalizedLayers = normalizeSceneLayersForBoard(
              merged.sceneLayers,
              merged.activeSceneLayerId
            );
            return {
              ...merged,
              sceneLayers: normalizedLayers.sceneLayers,
              activeSceneLayerId: normalizedLayers.activeSceneLayerId,
            };
          });
          return;
        }
        if (operation.kind === "upsert_document_asset") {
          const nextAsset = cloneSerializable(operation.asset);
          setDocumentState((current) => {
            const exists = current.assets.some((item) => item.id === nextAsset.id);
            return {
              ...current,
              assets: exists
                ? current.assets.map((item) => (item.id === nextAsset.id ? nextAsset : item))
                : [...current.assets, nextAsset],
              activeAssetId: current.activeAssetId ?? nextAsset.id,
            };
          });
          return;
        }
        if (operation.kind === "remove_document_asset") {
          setDocumentState((current) => {
            const assets = current.assets.filter((item) => item.id !== operation.assetId);
            return {
              ...current,
              assets,
              activeAssetId:
                current.activeAssetId === operation.assetId
                  ? (assets[0]?.id ?? null)
                  : current.activeAssetId,
            };
          });
          return;
        }
        if (operation.kind === "upsert_document_annotation") {
          const nextAnnotation = cloneSerializable(operation.annotation);
          setDocumentState((current) => {
            const exists = current.annotations.some((item) => item.id === nextAnnotation.id);
            return {
              ...current,
              annotations: exists
                ? current.annotations.map((item) =>
                    item.id === nextAnnotation.id ? nextAnnotation : item
                  )
                : [...current.annotations, nextAnnotation],
            };
          });
          return;
        }
        if (operation.kind === "remove_document_annotation") {
          setDocumentState((current) => ({
            ...current,
            annotations: current.annotations.filter(
              (item) => item.id !== operation.annotationId
            ),
          }));
        }
      });
    },
    [applyLocalStrokeCollection, finalizeStrokePreview]
  );
  applyHistoryOperationsRef.current = applyHistoryOperations;

  const commitStrokePreview = useCallback(
    (payload: { stroke: WorkbookStroke; previewVersion: number }) => {
      if (!sessionId || !canDraw) return;
      if (payload.stroke.tool !== "pen" && payload.stroke.tool !== "highlighter") return;
      const strokeWithPage: WorkbookStroke = {
        ...payload.stroke,
        page: Math.max(1, payload.stroke.page ?? boardSettings.currentPage),
      };
      queueStrokePreview({
        stroke: strokeWithPage,
        previewVersion: payload.previewVersion,
      });
    },
    [boardSettings.currentPage, canDraw, queueStrokePreview, sessionId]
  );

  const commitStroke = async (stroke: WorkbookStroke) => {
    if (!sessionId || !canDraw) return;
    const type = stroke.layer === "board" ? "board.stroke" : "annotations.stroke";
    const strokeWithPage: WorkbookStroke = {
      ...stroke,
      page: Math.max(1, stroke.page ?? boardSettings.currentPage),
    };
    finalizeStrokePreview(strokeWithPage.id);
    applyLocalStrokeCollection(strokeWithPage.layer, (current) =>
      current.some((item) => item.id === strokeWithPage.id)
        ? current
        : [...current, strokeWithPage]
    );
    try {
      await appendEventsAndApply([{ type, payload: { stroke: strokeWithPage } }]);
      if (stroke.layer === "board" && stroke.tool === "pen") {
        queueSmartInkStroke(strokeWithPage);
      }
    } catch {
      applyLocalStrokeCollection(strokeWithPage.layer, (current) =>
        current.filter((item) => item.id !== strokeWithPage.id)
      );
      setError("Не удалось синхронизировать штрих. Проверьте подключение.");
    }
  };

  const commitStrokeDelete = async (strokeId: string, targetLayer: WorkbookLayer) => {
    if (!sessionId || !canDelete) return;
    const type =
      targetLayer === "annotations"
        ? ("annotations.stroke.delete" as const)
        : ("board.stroke.delete" as const);
    finalizeStrokePreview(strokeId);
    let deletedStroke: WorkbookStroke | null = null;
    applyLocalStrokeCollection(targetLayer, (current) => {
      deletedStroke = current.find((item) => item.id === strokeId) ?? null;
      return current.filter((item) => item.id !== strokeId);
    });
    try {
      await appendEventsAndApply([{ type, payload: { strokeId } }]);
    } catch {
      if (deletedStroke) {
        applyLocalStrokeCollection(targetLayer, (current) =>
          current.some((item) => item.id === strokeId)
            ? current
            : [...current, deletedStroke as WorkbookStroke]
        );
      }
      setError("Не удалось удалить штрих.");
    }
  };

  const commitStrokeReplace = async (payload: {
    stroke: WorkbookStroke;
    fragments: WorkbookPoint[][];
  }) => {
    if (!sessionId || !canDelete) return;
    const sourceStroke = payload.stroke;
    const fragments = payload.fragments
      .map((fragment) => fragment.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)))
      .filter((fragment) => fragment.length > 0);
    const layerTypeCreate =
      sourceStroke.layer === "annotations"
        ? ("annotations.stroke" as const)
        : ("board.stroke" as const);
    const layerTypeDelete =
      sourceStroke.layer === "annotations"
        ? ("annotations.stroke.delete" as const)
        : ("board.stroke.delete" as const);
    const replacementStrokes: WorkbookStroke[] = fragments.map((points) => ({
      ...sourceStroke,
      id: generateId(),
      points,
      createdAt: new Date().toISOString(),
      page: Math.max(1, sourceStroke.page ?? boardSettings.currentPage),
    }));
    const replacementIds = new Set(replacementStrokes.map((item) => item.id));
    finalizeStrokePreview(sourceStroke.id);
    applyLocalStrokeCollection(sourceStroke.layer, (current) => {
      const withoutSource = current.filter((item) => item.id !== sourceStroke.id);
      if (replacementStrokes.length === 0) return withoutSource;
      return [...withoutSource, ...replacementStrokes];
    });
    try {
      await appendEventsAndApply([
        {
          type: layerTypeDelete,
          payload: { strokeId: sourceStroke.id },
        },
        ...replacementStrokes.map((stroke) => ({
          type: layerTypeCreate,
          payload: { stroke },
        })),
      ]);
    } catch {
      applyLocalStrokeCollection(sourceStroke.layer, (current) => {
        const cleaned = current.filter((item) => !replacementIds.has(item.id));
        if (cleaned.some((item) => item.id === sourceStroke.id)) return cleaned;
        return [...cleaned, sourceStroke];
      });
      setError("Не удалось обновить штрих после стирания.");
    }
  };

  const commitObjectCreate = useCallback(
    async (
      object: WorkbookBoardObject,
      options?: {
        auxiliaryEvents?: WorkbookClientEventInput[];
      }
    ) => {
      if (!sessionId || !canDraw) return false;
      const currentMeta =
        object.meta && typeof object.meta === "object" ? object.meta : {};
      let objectWithPage: WorkbookBoardObject = {
        ...object,
        page: object.page ?? boardSettings.currentPage,
        meta: {
          ...currentMeta,
          sceneLayerId: activeSceneLayerId,
        },
      };
      if (
        objectWithPage.type === "image" &&
        typeof objectWithPage.imageUrl === "string" &&
        objectWithPage.imageUrl.startsWith("data:image/") &&
        objectWithPage.imageUrl.length > WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS
      ) {
        objectWithPage = {
          ...objectWithPage,
          imageUrl: await optimizeImageDataUrl(objectWithPage.imageUrl, {
            maxEdge: 820,
            quality: 0.58,
            maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
          }),
        };
      }
      if (
        objectWithPage.type === "image" &&
        typeof objectWithPage.imageUrl === "string" &&
        objectWithPage.imageUrl.startsWith("data:image/") &&
        objectWithPage.imageUrl.length > WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS
      ) {
        setError(
          "Не удалось подготовить изображение для доски. Уменьшите размер файла или добавьте его через окно документов."
        );
        return false;
      }
      setBoardObjects((current) =>
        current.some((item) => item.id === objectWithPage.id)
          ? current
          : [...current, objectWithPage]
      );
      const createEvent: WorkbookClientEventInput = {
        type: "board.object.create",
        payload: { object: objectWithPage },
        clientEventId: generateId(),
      };
      try {
        sendWorkbookLiveEvents([createEvent]);
        await appendEventsAndApply([
          ...(options?.auxiliaryEvents ?? []),
          createEvent,
        ]);
        if (objectWithPage.type === "image" && objectWithPage.imageUrl) {
          const now = new Date().toISOString();
          void upsertLibraryItem({
            id: generateId(),
            name: objectWithPage.imageName || "Изображение с доски",
            type: "image",
            ownerUserId: user?.id ?? "unknown",
            sourceUrl: objectWithPage.imageUrl,
            createdAt: now,
            updatedAt: now,
            folderId: null,
          });
        }
        return true;
      } catch {
        setBoardObjects((current) =>
          current.filter((item) => item.id !== objectWithPage.id)
        );
        setSelectedObjectId((current) =>
          current === objectWithPage.id ? null : current
        );
        setError("Не удалось создать объект.");
        return false;
      }
    },
    [
      activeSceneLayerId,
      appendEventsAndApply,
      boardSettings.currentPage,
      canDraw,
      sessionId,
      sendWorkbookLiveEvents,
      upsertLibraryItem,
      user?.id,
    ]
  );

  const commitObjectUpdate = useCallback(
    (
      objectId: string,
      patch: Partial<WorkbookBoardObject>,
      options?: {
        trackHistory?: boolean;
        markDirty?: boolean;
      }
    ) => {
      if (!sessionId || !canSelect) return;
      const objectsSnapshot = boardObjectsRef.current;
      const currentObject = objectsSnapshot.find((item) => item.id === objectId);
      if (!currentObject) return;
      const isPreviewOnly =
        options?.trackHistory === false && options?.markDirty === false;
      const merged = mergeBoardObjectWithPatch(currentObject, patch);
      const constrained = applyConstraintsForObject(merged, objectsSnapshot);
      const shouldApplyGeometryPatch =
        patch.x !== undefined ||
        patch.y !== undefined ||
        patch.width !== undefined ||
        patch.height !== undefined;
      const normalizedPatch: Partial<WorkbookBoardObject> = shouldApplyGeometryPatch
        ? {
            ...patch,
            x: constrained.x,
            y: constrained.y,
            width: constrained.width,
            height: constrained.height,
          }
        : patch;
      if (isPreviewOnly) {
        setBoardObjects((current) =>
          current.map((item) =>
            item.id === objectId ? mergeBoardObjectWithPatch(item, normalizedPatch) : item
          )
        );
        const pendingPatch = objectPreviewQueuedPatchRef.current.get(objectId) ?? {};
        objectPreviewQueuedPatchRef.current.set(objectId, {
          ...pendingPatch,
          ...normalizedPatch,
        });
        scheduleVolatileSyncFlush();
        return;
      }
      if (options?.trackHistory !== false && !objectUpdateHistoryBeforeRef.current.has(objectId)) {
        objectUpdateHistoryBeforeRef.current.set(objectId, cloneSerializable(currentObject));
      }
      setBoardObjects((current) =>
        current.map((item) =>
          item.id === objectId ? mergeBoardObjectWithPatch(item, normalizedPatch) : item
        )
      );
      const pendingPatch = objectUpdateQueuedPatchRef.current.get(objectId) ?? {};
      objectUpdateQueuedPatchRef.current.set(objectId, {
        ...pendingPatch,
        ...normalizedPatch,
      });
      const pendingDispatchOptions =
        objectUpdateDispatchOptionsRef.current.get(objectId) ?? null;
      const nextDispatchOptions = {
        trackHistory:
          (pendingDispatchOptions?.trackHistory ?? false) ||
          (options?.trackHistory ?? true),
        markDirty:
          (pendingDispatchOptions?.markDirty ?? false) || (options?.markDirty ?? true),
      };
      objectUpdateDispatchOptionsRef.current.set(objectId, nextDispatchOptions);
      flushQueuedObjectUpdate(objectId);
    },
    [
      applyConstraintsForObject,
      boardObjectsRef,
      canSelect,
      flushQueuedObjectUpdate,
      scheduleVolatileSyncFlush,
      sessionId,
    ]
  );

  const commitObjectDelete = async (objectId: string) => {
    if (!sessionId || !canDelete) return;
    objectUpdateQueuedPatchRef.current.delete(objectId);
    objectUpdateDispatchOptionsRef.current.delete(objectId);
    objectUpdateHistoryBeforeRef.current.delete(objectId);
    objectPreviewQueuedPatchRef.current.delete(objectId);
    objectPreviewVersionRef.current.delete(objectId);
    Array.from(incomingPreviewVersionByAuthorObjectRef.current.keys()).forEach((key) => {
      if (key.endsWith(`:${objectId}`)) {
        incomingPreviewVersionByAuthorObjectRef.current.delete(key);
      }
    });
    const pendingTimer = objectUpdateTimersRef.current.get(objectId);
    if (pendingTimer !== undefined) {
      window.clearTimeout(pendingTimer);
      objectUpdateTimersRef.current.delete(objectId);
    }
    objectUpdateInFlightRef.current.delete(objectId);
    const targetObject = boardObjects.find((item) => item.id === objectId);
    const targetLayerId = targetObject ? getObjectSceneLayerId(targetObject) : MAIN_SCENE_LAYER_ID;
    const shouldPruneLayer =
      targetLayerId !== MAIN_SCENE_LAYER_ID &&
      boardObjects.filter(
        (object) =>
          object.id !== objectId && getObjectSceneLayerId(object) === targetLayerId
      ).length === 0;
    const nextSettings: WorkbookBoardSettings | null = shouldPruneLayer
      ? {
          ...boardSettings,
          sceneLayers: normalizedSceneLayers.sceneLayers.filter(
            (entry) => entry.id !== targetLayerId
          ),
          activeSceneLayerId:
            boardSettings.activeSceneLayerId === targetLayerId
              ? MAIN_SCENE_LAYER_ID
              : boardSettings.activeSceneLayerId,
        }
      : null;
    const events: Array<{ type: WorkbookEvent["type"]; payload: unknown }> = [
      {
        type: "board.object.delete",
        payload: { objectId },
      },
    ];
    if (nextSettings) {
      events.push({
        type: "board.settings.update",
        payload: { boardSettings: nextSettings },
      });
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await appendEventsAndApply(events);
        return;
      } catch (error) {
        if (error instanceof ApiError && error.code === "not_found") {
          setBoardObjects((current) => current.filter((item) => item.id !== objectId));
          setConstraints((current) =>
            current.filter(
              (constraint) =>
                constraint.sourceObjectId !== objectId &&
                constraint.targetObjectId !== objectId
            )
          );
          return;
        }
        const transient =
          error instanceof ApiError &&
          (error.code === "server_unavailable" ||
            error.code === "network_error" ||
            error.code === "timeout" ||
            error.code === "rate_limited");
        if (transient && attempt === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 140));
          continue;
        }
        setError("Не удалось удалить объект.");
        return;
      }
    }
  };

  const commitObjectPin = async (objectId: string, pinned: boolean) => {
    if (!sessionId || !canManageSession) return;
    try {
      await appendEventsAndApply([
        {
          type: "board.object.pin",
          payload: { objectId, pinned },
        },
      ]);
    } catch {
      setError("Не удалось изменить закрепление объекта.");
    }
  };

  const scaleObject = async (factor: number, objectId?: string) => {
    if (!canSelect) return;
    const targetObjectId = objectId ?? selectedObjectId;
    if (!targetObjectId) return;
    const targetObject = boardObjects.find((item) => item.id === targetObjectId);
    if (!targetObject) return;
    const safeFactor = Number.isFinite(factor) ? factor : 1;
    if (safeFactor <= 0) return;
    const nextWidth = targetObject.width * safeFactor;
    const nextHeight = targetObject.height * safeFactor;
    if (Array.isArray(targetObject.points) && targetObject.points.length > 0) {
      const bounds = getPointsBounds(targetObject.points);
      const centerX = bounds.minX + bounds.width / 2;
      const centerY = bounds.minY + bounds.height / 2;
      const scaledPoints = targetObject.points.map((point) => ({
        x: centerX + (point.x - centerX) * safeFactor,
        y: centerY + (point.y - centerY) * safeFactor,
      }));
      const scaledBounds = getPointsBounds(scaledPoints);
      await commitObjectUpdate(targetObject.id, {
        x: scaledBounds.minX,
        y: scaledBounds.minY,
        width: scaledBounds.width,
        height: scaledBounds.height,
        points: scaledPoints,
      });
      return;
    }
    await commitObjectUpdate(targetObject.id, {
      width: Math.abs(nextWidth) < 1 ? Math.sign(nextWidth || 1) : nextWidth,
      height: Math.abs(nextHeight) < 1 ? Math.sign(nextHeight || 1) : nextHeight,
    });
  };

  const mirrorSelectedObject = useCallback(
    async (axis: "horizontal" | "vertical") => {
      if (!selectedObjectId || !canSelect) return;
      const targetObject = boardObjects.find((item) => item.id === selectedObjectId);
      if (!targetObject) return;

      const centerX = targetObject.x + targetObject.width / 2;
      const centerY = targetObject.y + targetObject.height / 2;

      if (Array.isArray(targetObject.points) && targetObject.points.length > 0) {
        const mirroredPoints = targetObject.points.map((point) => ({
          x: axis === "horizontal" ? centerX * 2 - point.x : point.x,
          y: axis === "vertical" ? centerY * 2 - point.y : point.y,
        }));
        const bounds = getPointsBounds(mirroredPoints);
        await commitObjectUpdate(targetObject.id, {
          points: mirroredPoints,
          x: bounds.minX,
          y: bounds.minY,
          width: bounds.width,
          height: bounds.height,
        });
        return;
      }

      if (targetObject.type === "line" || targetObject.type === "arrow") {
        const start = { x: targetObject.x, y: targetObject.y };
        const end = {
          x: targetObject.x + targetObject.width,
          y: targetObject.y + targetObject.height,
        };
        const mirroredStart =
          axis === "horizontal"
            ? { x: centerX * 2 - start.x, y: start.y }
            : { x: start.x, y: centerY * 2 - start.y };
        const mirroredEnd =
          axis === "horizontal"
            ? { x: centerX * 2 - end.x, y: end.y }
            : { x: end.x, y: centerY * 2 - end.y };
        await commitObjectUpdate(targetObject.id, {
          x: mirroredStart.x,
          y: mirroredStart.y,
          width: mirroredEnd.x - mirroredStart.x,
          height: mirroredEnd.y - mirroredStart.y,
        });
        return;
      }

      if (targetObject.type === "solid3d") {
        const state = readSolid3dState(targetObject.meta);
        const nextState =
          axis === "horizontal"
            ? {
                ...state,
                view: {
                  ...state.view,
                  rotationY: -state.view.rotationY,
                },
              }
            : {
                ...state,
                view: {
                  ...state.view,
                  rotationX: -state.view.rotationX,
                },
              };
        await commitObjectUpdate(targetObject.id, {
          meta: writeSolid3dState(nextState, targetObject.meta),
        });
        return;
      }

      const baseRotation =
        typeof targetObject.rotation === "number" && Number.isFinite(targetObject.rotation)
          ? targetObject.rotation
          : 0;
      await commitObjectUpdate(targetObject.id, {
        rotation:
          axis === "horizontal" ? -baseRotation : Math.PI - baseRotation,
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const deleteAreaSelectionObjects = useCallback(async () => {
    if (!canDelete || !areaSelection || !areaSelectionHasContent) return;
    const objectIds = areaSelection.objectIds.filter((id) =>
      boardObjects.some((object) => object.id === id && !object.pinned)
    );
    const strokeIds = areaSelection.strokeIds.filter((entry) => {
      if (entry.layer === "annotations") {
        return annotationStrokes.some((stroke) => stroke.id === entry.id);
      }
      return boardStrokes.some((stroke) => stroke.id === entry.id);
    });
    if (objectIds.length === 0 && strokeIds.length === 0) {
      setAreaSelectionContextMenu(null);
      return;
    }
    try {
      const deletingSet = new Set(objectIds);
      const layerIdsToRemove = normalizedSceneLayers.sceneLayers
        .filter((layerItem) => layerItem.id !== MAIN_SCENE_LAYER_ID)
        .filter((layerItem) => {
          const layerObjects = boardObjects.filter(
            (object) => getObjectSceneLayerId(object) === layerItem.id
          );
          if (layerObjects.length === 0) return false;
          return layerObjects.every((object) => deletingSet.has(object.id));
        })
        .map((layerItem) => layerItem.id);
      const events: Array<{ type: WorkbookEvent["type"]; payload: unknown }> = [];
      strokeIds.forEach((entry) => {
        events.push({
          type:
            entry.layer === "annotations"
              ? "annotations.stroke.delete"
              : "board.stroke.delete",
          payload: { strokeId: entry.id },
        });
      });
      objectIds.forEach((objectId) => {
        events.push({
          type: "board.object.delete" as const,
          payload: { objectId },
        });
      });
      if (layerIdsToRemove.length > 0) {
        const nextSettings: WorkbookBoardSettings = {
          ...boardSettings,
          sceneLayers: normalizedSceneLayers.sceneLayers.filter(
            (layerItem) => !layerIdsToRemove.includes(layerItem.id)
          ),
          activeSceneLayerId: layerIdsToRemove.includes(boardSettings.activeSceneLayerId)
            ? MAIN_SCENE_LAYER_ID
            : boardSettings.activeSceneLayerId,
        };
        events.push({
          type: "board.settings.update",
          payload: {
            boardSettings: nextSettings,
          },
        });
      }
      await appendEventsAndApply(events);
      setAreaSelection(null);
      setAreaSelectionContextMenu(null);
      if (selectedObjectId && objectIds.includes(selectedObjectId)) {
        setSelectedObjectId(null);
      }
    } catch {
      setError("Не удалось удалить элементы из выделенной области.");
    }
  }, [
    annotationStrokes,
    areaSelectionHasContent,
    appendEventsAndApply,
    areaSelection,
    boardStrokes,
    boardObjects,
    boardSettings,
    canDelete,
    getObjectSceneLayerId,
    normalizedSceneLayers.sceneLayers,
    selectedObjectId,
  ]);

  const copyAreaSelectionObjects = useCallback(() => {
    if (!canSelect || !areaSelection || !areaSelectionHasContent) return;
    const selectedObjects = areaSelection.objectIds
      .map((id) => boardObjects.find((object) => object.id === id))
      .filter(
        (object): object is WorkbookBoardObject =>
          object != null && !object.pinned
      );
    const selectedStrokes = areaSelection.strokeIds
      .map((entry) => {
        if (entry.layer === "annotations") {
          return annotationStrokes.find((stroke) => stroke.id === entry.id) ?? null;
        }
        return boardStrokes.find((stroke) => stroke.id === entry.id) ?? null;
      })
      .filter((stroke): stroke is WorkbookStroke => Boolean(stroke));
    if (selectedObjects.length === 0 && selectedStrokes.length === 0) {
      areaSelectionClipboardRef.current = null;
      return;
    }
    areaSelectionClipboardRef.current = {
      objects: selectedObjects.map((object) => structuredClone<WorkbookBoardObject>(object)),
      strokes: selectedStrokes.map((stroke) => structuredClone<WorkbookStroke>(stroke)),
    };
    setAreaSelectionContextMenu(null);
  }, [
    annotationStrokes,
    areaSelection,
    areaSelectionHasContent,
    boardObjects,
    boardStrokes,
    canSelect,
  ]);

  const pasteAreaSelectionObjects = useCallback(async () => {
    if (!canSelect) return;
    const clipboard = areaSelectionClipboardRef.current;
    if (!clipboard || (clipboard.objects.length === 0 && clipboard.strokes.length === 0)) return;
    const now = new Date().toISOString();
    const offset = 24;
    const createEvents: Array<{ type: WorkbookEvent["type"]; payload: unknown }> = [
      ...clipboard.strokes.map((stroke) => ({
        type:
          (stroke.layer === "annotations"
            ? "annotations.stroke"
            : "board.stroke") as WorkbookEvent["type"],
        payload: {
          stroke: {
            ...stroke,
            id: generateId(),
            points: stroke.points.map((point) => ({
              x: point.x + offset,
              y: point.y + offset,
            })),
            createdAt: now,
            authorUserId: user?.id ?? stroke.authorUserId,
          },
        },
      })),
      ...clipboard.objects.map((object) => ({
        type: "board.object.create" as const,
        payload: {
          object: {
            ...object,
            id: generateId(),
            x: object.x + offset,
            y: object.y + offset,
            points: Array.isArray(object.points)
              ? object.points.map((point) => ({
                  x: point.x + offset,
                  y: point.y + offset,
                }))
              : object.points,
            createdAt: now,
            authorUserId: user?.id ?? object.authorUserId,
          },
        },
      })),
    ];
    try {
      await appendEventsAndApply(createEvents);
      setAreaSelectionContextMenu(null);
    } catch {
      setError("Не удалось вставить скопированную область.");
    }
  }, [appendEventsAndApply, canSelect, user?.id]);

  const cutAreaSelectionObjects = useCallback(async () => {
    if (!canDelete || !areaSelection || !areaSelectionHasContent) return;
    copyAreaSelectionObjects();
    await deleteAreaSelectionObjects();
  }, [
    areaSelection,
    areaSelectionHasContent,
    canDelete,
    copyAreaSelectionObjects,
    deleteAreaSelectionObjects,
  ]);

  const createCompositionFromAreaSelection = useCallback(async () => {
    if (!canSelect || !areaSelection || areaSelection.objectIds.length === 0) return;
    const objectIds = areaSelection.objectIds.filter((id) =>
      boardObjects.some((object) => object.id === id && !object.pinned)
    );
    if (objectIds.length < 2) {
      setError("Для композиции выберите минимум два объекта.");
      return;
    }
    const existingLayerNames = new Set(normalizedSceneLayers.sceneLayers.map((item) => item.name));
    let index = normalizedSceneLayers.sceneLayers.length;
    let layerName = `Композиция ${index}`;
    while (existingLayerNames.has(layerName)) {
      index += 1;
      layerName = `Композиция ${index}`;
    }
    const layerId = generateId();
    const createdAt = new Date().toISOString();
    const nextSettings: WorkbookBoardSettings = {
      ...boardSettings,
      sceneLayers: [
        ...normalizedSceneLayers.sceneLayers,
        {
          id: layerId,
          name: layerName,
          createdAt,
        },
      ],
      activeSceneLayerId: boardSettings.activeSceneLayerId,
    };
    const updateEvents = objectIds.map((objectId) => {
      const object = boardObjects.find((item) => item.id === objectId);
      return {
        type: "board.object.update" as const,
        payload: {
          objectId,
          patch: {
            meta: {
              ...(object?.meta ?? {}),
              sceneLayerId: layerId,
            },
          },
        },
      };
    });
    try {
      await appendEventsAndApply([
        ...updateEvents,
        {
          type: "board.settings.update",
          payload: {
            boardSettings: nextSettings,
          },
        },
      ]);
      setAreaSelectionContextMenu(null);
    } catch {
      setError("Не удалось создать композицию.");
    }
  }, [
    appendEventsAndApply,
    areaSelection,
    boardObjects,
    boardSettings,
    canSelect,
    normalizedSceneLayers.sceneLayers,
  ]);

  const removeObjectFromComposition = useCallback(
    async (objectId: string, layerId: string) => {
      if (!canSelect || !objectId || !layerId || layerId === MAIN_SCENE_LAYER_ID) return;
      const target = boardObjects.find((object) => object.id === objectId);
      if (!target) return;
      const remainingObjects = boardObjects.filter(
        (object) => object.id !== objectId && getObjectSceneLayerId(object) === layerId
      );
      const nextSettings: WorkbookBoardSettings | null =
        remainingObjects.length === 0
          ? {
              ...boardSettings,
              sceneLayers: normalizedSceneLayers.sceneLayers.filter(
                (entry) => entry.id !== layerId
              ),
              activeSceneLayerId:
                boardSettings.activeSceneLayerId === layerId
                  ? MAIN_SCENE_LAYER_ID
                  : boardSettings.activeSceneLayerId,
            }
          : null;
      const updateEvents: Array<{ type: WorkbookEvent["type"]; payload: unknown }> = [
        {
          type: "board.object.update",
          payload: {
            objectId,
            patch: {
              meta: {
                ...(target.meta ?? {}),
                sceneLayerId: MAIN_SCENE_LAYER_ID,
              },
            },
          },
        },
      ];
      if (nextSettings) {
        updateEvents.push({
          type: "board.settings.update",
          payload: {
            boardSettings: nextSettings,
          },
        });
      }
      try {
        await appendEventsAndApply(updateEvents);
      } catch {
        setError("Не удалось убрать объект из композиции.");
      }
    },
    [
      appendEventsAndApply,
      boardObjects,
      boardSettings,
      canSelect,
      getObjectSceneLayerId,
      normalizedSceneLayers.sceneLayers,
    ]
  );

  const dissolveCompositionLayer = useCallback(
    async (layerId: string) => {
      if (!layerId || layerId === MAIN_SCENE_LAYER_ID || !canSelect) return;
      const groupedObjects = boardObjects.filter(
        (object) => getObjectSceneLayerId(object) === layerId
      );
      const updateEvents = groupedObjects.map((object) => ({
        type: "board.object.update" as const,
        payload: {
          objectId: object.id,
          patch: {
            meta: {
              ...(object.meta ?? {}),
              sceneLayerId: MAIN_SCENE_LAYER_ID,
            },
          },
        },
      }));
      const nextSettings: WorkbookBoardSettings = {
        ...boardSettings,
        sceneLayers: normalizedSceneLayers.sceneLayers.filter((entry) => entry.id !== layerId),
        activeSceneLayerId:
          boardSettings.activeSceneLayerId === layerId
            ? MAIN_SCENE_LAYER_ID
            : boardSettings.activeSceneLayerId,
      };
      try {
        await appendEventsAndApply([
          ...updateEvents,
          {
            type: "board.settings.update",
            payload: {
              boardSettings: nextSettings,
            },
          },
        ]);
      } catch {
      setError("Не удалось удалить композицию.");
      }
    },
    [
      appendEventsAndApply,
      boardObjects,
      boardSettings,
      canSelect,
      getObjectSceneLayerId,
      normalizedSceneLayers.sceneLayers,
    ]
  );

  const focusObjectInWorkspace = useCallback((objectId: string) => {
    const targetObject = boardObjects.find((item) => item.id === objectId) ?? null;
    setSelectedConstraintId(null);
    setSelectedObjectId(objectId);
    resetToolRuntimeToSelect();
    openUtilityPanel("transform", {
      toggle: false,
      anchorObject: targetObject,
    });
  }, [boardObjects, openUtilityPanel, resetToolRuntimeToSelect]);

  const updateSelectedLineMeta = useCallback(
    async (
      patch: Partial<{
        lineKind: "line" | "segment";
        lineStyle: "solid" | "dashed";
        startLabel: string;
        endLabel: string;
      }>
    ) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      const nextMeta = {
        ...(target.meta ?? {}),
        ...patch,
      };
      await commitObjectUpdate(target.id, {
        type: "line",
        meta: nextMeta,
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedObjectMeta = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target) return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedLineObject = useCallback(
    async (patch: Partial<WorkbookBoardObject>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      await commitObjectUpdate(target.id, patch);
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedFunctionGraphMeta = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || target.type !== "function_graph") return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const commitSelectedFunctionGraphDraft = useCallback(
    async (nextFunctions: GraphFunctionDraft[]) => {
      const fallbackFunctions = sanitizeFunctionGraphDrafts(nextFunctions, {
        ensureNonEmpty: false,
      });
      await updateSelectedFunctionGraphMeta({
        functions: fallbackFunctions,
      });
    },
    [updateSelectedFunctionGraphMeta]
  );

  const updateSelectedFunctionGraphAppearance = useCallback(
    (patch: { axisColor?: string; planeColor?: string }) => {
      void updateSelectedFunctionGraphMeta({
        ...(typeof patch.axisColor === "string" ? { axisColor: patch.axisColor } : {}),
        ...(typeof patch.planeColor === "string" ? { planeColor: patch.planeColor } : {}),
      });
    },
    [updateSelectedFunctionGraphMeta]
  );

  const pushSelectedGraphFunctions = useCallback(
    (nextFunctions: GraphFunctionDraft[]) => {
      const sanitized = sanitizeFunctionGraphDrafts(nextFunctions, {
        ensureNonEmpty: false,
      });
      setGraphFunctionsDraft(sanitized);
      void commitSelectedFunctionGraphDraft(sanitized);
    },
    [commitSelectedFunctionGraphDraft]
  );

  const commitSelectedLineEndpointLabel = useCallback(
    async (endpoint: "start" | "end", valueOverride?: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      if (target.meta?.lineKind !== "segment") return;
      const value =
        valueOverride ?? (endpoint === "start" ? selectedLineStartLabelDraft : selectedLineEndLabelDraft);
      const key = endpoint === "start" ? "startLabel" : "endLabel";
      const currentRaw = target.meta?.[key];
      const current = typeof currentRaw === "string" ? currentRaw : "";
      const next = value.slice(0, 12);
      if (next === current) return;
      await updateSelectedLineMeta({ [key]: next });
    },
    [
      boardObjects,
      selectedObjectId,
      selectedLineEndLabelDraft,
      selectedLineStartLabelDraft,
      updateSelectedLineMeta,
    ]
  );

  const commitSelectedLineWidth = useCallback(async () => {
    if (!selectedObjectId) return;
    const target = boardObjects.find((item) => item.id === selectedObjectId);
    if (!target || (target.type !== "line" && target.type !== "arrow")) return;
    const next = Math.max(1, Math.min(18, Math.round(lineWidthDraft)));
    const currentWidth = target.strokeWidth ?? 3;
    if (Math.abs(next - currentWidth) < 0.01) return;
    await updateSelectedLineObject({ strokeWidth: next });
  }, [boardObjects, lineWidthDraft, selectedObjectId, updateSelectedLineObject]);

  const appendSelectedGraphFunction = useCallback(
    (expressionOverride?: string) => {
      const selectedGraphObject =
        selectedObjectId != null
          ? boardObjects.find((item) => item.id === selectedObjectId)
          : null;
      if (!selectedGraphObject || selectedGraphObject.type !== "function_graph") return;
      const validation = validateFunctionExpression(
        expressionOverride ?? graphExpressionDraft
      );
      if (!validation.ok) {
        setGraphDraftError(validation.error ?? "Проверьте формулу.");
        return;
      }
      const nextFunctions = [
        ...graphFunctionsDraft,
        {
          id: generateId(),
          expression: validation.expression,
          color: GRAPH_FUNCTION_COLORS[graphFunctionsDraft.length % GRAPH_FUNCTION_COLORS.length],
          visible: true,
          dashed: false,
          width: 2,
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1,
        },
      ];
      pushSelectedGraphFunctions(nextFunctions);
      setGraphExpressionDraft("");
      setGraphDraftError(null);
    },
    [
      graphExpressionDraft,
      boardObjects,
      graphFunctionsDraft,
      pushSelectedGraphFunctions,
      selectedObjectId,
    ]
  );

  const removeSelectedGraphFunction = useCallback(
    (id: string) => {
      if (graphFunctionsDraft.length <= 1) return;
      const nextFunctions = graphFunctionsDraft.filter((entry) => entry.id !== id);
      pushSelectedGraphFunctions(nextFunctions);
    },
    [graphFunctionsDraft, pushSelectedGraphFunctions]
  );

  const updateSelectedGraphFunction = useCallback(
    (id: string, patch: Partial<GraphFunctionDraft>) => {
      const nextFunctions = graphFunctionsDraft.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      );
      pushSelectedGraphFunctions(nextFunctions);
    },
    [graphFunctionsDraft, pushSelectedGraphFunctions]
  );

  const reflectGraphFunctionByAxis = useCallback(
    (id: string, axis: "x" | "y") => {
      const selectedGraphObject =
        selectedObjectId != null
          ? boardObjects.find((item) => item.id === selectedObjectId)
          : null;
      const applyToSelected = selectedGraphObject?.type === "function_graph";
      const applyReflection = (entry: GraphFunctionDraft): GraphFunctionDraft => {
        if (entry.id !== id) return entry;
        const scaleX = normalizeGraphScale(entry.scaleX ?? 1, 1);
        const scaleY = normalizeGraphScale(entry.scaleY ?? 1, 1);
        const offsetX = clampGraphOffset(entry.offsetX ?? 0);
        const offsetY = clampGraphOffset(entry.offsetY ?? 0);
        if (axis === "x") {
          return {
            ...entry,
            scaleY: normalizeGraphScale(-scaleY, scaleY),
            offsetY: clampGraphOffset(-offsetY),
          };
        }
        return {
          ...entry,
          scaleX: normalizeGraphScale(-scaleX, scaleX),
          offsetX: clampGraphOffset(-offsetX),
        };
      };

      if (applyToSelected) {
        const nextFunctions = graphFunctionsDraft.map(applyReflection);
        pushSelectedGraphFunctions(nextFunctions);
        return;
      }

      setGraphDraftFunctions((current) => current.map(applyReflection));
    },
    [
      boardObjects,
      graphFunctionsDraft,
      pushSelectedGraphFunctions,
      selectedObjectId,
    ]
  );

  const updateSelectedTextFormatting = useCallback(
    async (
      patch: Partial<WorkbookBoardObject>,
      metaPatch?: Partial<{
        textColor: string;
        textBackground: string;
        textFontFamily: string;
        textBold: boolean;
        textItalic: boolean;
        textUnderline: boolean;
        textAlign: "left" | "center" | "right";
      }>,
      options?: {
        trackHistory?: boolean;
        markDirty?: boolean;
      }
    ) => {
      if (!selectedObjectId || !canSelect) return;
      const selectedTextObject =
        boardObjects.find((item) => item.id === selectedObjectId) ?? null;
      if (!selectedTextObject || selectedTextObject.type !== "text") return;
      await commitObjectUpdate(
        selectedTextObject.id,
        {
          ...patch,
          ...(metaPatch
            ? {
                meta: {
                  ...(selectedTextObject.meta ?? {}),
                  ...metaPatch,
                },
              }
            : {}),
        },
        options
      );
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const flushSelectedTextDraftCommit = useCallback(async (
    draftOverride?: string,
    options?: {
      trackHistory?: boolean;
    }
  ) => {
    if (!selectedObjectId) return;
    const draftObjectId = selectedTextDraftObjectIdRef.current;
    if (!draftObjectId || draftObjectId !== selectedObjectId) return;
    if (selectedTextDraftCommitTimerRef.current !== null) {
      window.clearTimeout(selectedTextDraftCommitTimerRef.current);
      selectedTextDraftCommitTimerRef.current = null;
    }
    const textValue = (draftOverride ?? selectedTextDraftValueRef.current).replace(
      /\r\n/g,
      "\n"
    );
    const selectedTextObject =
      boardObjects.find((item) => item.id === selectedObjectId) ?? null;
    if (selectedTextObject?.type !== "text") return;
    const currentValue =
      typeof selectedTextObject.text === "string" ? selectedTextObject.text : "";
    if (currentValue === textValue) {
      selectedTextDraftDirtyRef.current = false;
      return;
    }
    await updateSelectedTextFormatting(
      { text: textValue },
      undefined,
      {
        trackHistory: options?.trackHistory ?? true,
        markDirty: true,
      }
    );
  }, [boardObjects, selectedObjectId, updateSelectedTextFormatting]);

  const scheduleSelectedTextDraftCommit = useCallback(
    (value: string) => {
      if (!selectedObjectId) return;
      const normalizedValue = value.replace(/\r\n/g, "\n");
      selectedTextDraftValueRef.current = normalizedValue;
      selectedTextDraftObjectIdRef.current = selectedObjectId;
      selectedTextDraftDirtyRef.current = true;
      if (selectedTextDraftCommitTimerRef.current !== null) {
        window.clearTimeout(selectedTextDraftCommitTimerRef.current);
      }
      const selectedTextObject =
        boardObjects.find((item) => item.id === selectedObjectId) ?? null;
      const currentValue =
        selectedTextObject?.type === "text" && typeof selectedTextObject.text === "string"
          ? selectedTextObject.text
          : "";
      if (currentValue === normalizedValue) {
        selectedTextDraftDirtyRef.current = false;
        return;
      }
      setBoardObjects((current) =>
        current.map((item) =>
          item.id === selectedObjectId ? mergeBoardObjectWithPatch(item, { text: normalizedValue }) : item
        )
      );
      selectedTextDraftCommitTimerRef.current = window.setTimeout(() => {
        void flushSelectedTextDraftCommit(normalizedValue, {
          trackHistory: false,
        });
      }, 180);
    },
    [
      boardObjects,
      setBoardObjects,
      flushSelectedTextDraftCommit,
      selectedObjectId,
    ]
  );

  const normalizeGraphExpressionDraft = useCallback(
    (id: string, rawExpression: string, selectedMode: boolean) => {
      const normalized = normalizeFunctionExpression(rawExpression);
      if (selectedMode) {
        setGraphFunctionsDraft((current) =>
          current.map((entry) =>
            entry.id === id ? { ...entry, expression: normalized } : entry
          )
        );
        return;
      }
      setGraphDraftFunctions((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, expression: normalized } : entry
        )
      );
    },
    []
  );

  const commitSelectedGraphExpressions = useCallback(() => {
    const selectedGraphObject =
      selectedObjectId != null
        ? boardObjects.find((item) => item.id === selectedObjectId)
        : null;
    if (!selectedGraphObject || selectedGraphObject.type !== "function_graph") return;
    void commitSelectedFunctionGraphDraft(graphFunctionsDraft);
  }, [
    boardObjects,
    commitSelectedFunctionGraphDraft,
    graphFunctionsDraft,
    selectedObjectId,
  ]);

  const updateSelectedDividerMeta = useCallback(
    async (patch: Partial<{ lineStyle: "solid" | "dashed" }>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || target.type !== "section_divider") return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedDividerObject = useCallback(
    async (patch: Partial<WorkbookBoardObject>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || target.type !== "section_divider") return;
      await commitObjectUpdate(target.id, patch);
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const commitSelectedDividerWidth = useCallback(async () => {
    if (!selectedObjectId) return;
    const target = boardObjects.find((item) => item.id === selectedObjectId);
    if (!target || target.type !== "section_divider") return;
    const next = Math.max(1, Math.min(18, Math.round(dividerWidthDraft)));
    const current = target.strokeWidth ?? 2;
    if (Math.abs(next - current) < 0.01) return;
    await updateSelectedDividerObject({ strokeWidth: next });
  }, [boardObjects, dividerWidthDraft, selectedObjectId, updateSelectedDividerObject]);

  const renamePointObject = useCallback(
    async (objectId: string, label: string) => {
      const target = boardObjects.find((item) => item.id === objectId);
      if (!target || target.type !== "point") return;
      await commitObjectUpdate(objectId, {
        meta: {
          ...(target.meta ?? {}),
          label: label.trim().slice(0, 12),
        },
      });
    },
    [boardObjects, commitObjectUpdate]
  );

  const renameShape2dVertexByObjectId = useCallback(
    async (objectId: string, vertexIndex: number, label: string) => {
      const target = boardObjects.find((item) => item.id === objectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length || vertexIndex < 0 || vertexIndex >= vertices.length) return;
      const raw = Array.isArray(target.meta?.vertexLabels) ? target.meta.vertexLabels : [];
      const next = vertices.map((_, index) => {
        const current = typeof raw[index] === "string" ? raw[index].trim() : "";
        return current || getFigureVertexLabel(index);
      });
      next[vertexIndex] = label.trim().slice(0, 12) || getFigureVertexLabel(vertexIndex);
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          vertexLabels: next,
        },
      });
    },
    [boardObjects, commitObjectUpdate]
  );

  const renameLineEndpointByObjectId = useCallback(
    async (objectId: string, endpoint: "start" | "end", label: string) => {
      const target = boardObjects.find((item) => item.id === objectId);
      if (!target || (target.type !== "line" && target.type !== "arrow")) return;
      if (target.meta?.lineKind !== "segment") return;
      const nextLabel = label.trim().slice(0, 12);
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          [endpoint === "start" ? "startLabel" : "endLabel"]: nextLabel,
        },
      });
    },
    [boardObjects, commitObjectUpdate]
  );

  const connectPointObjectsChronologically = useCallback(async () => {
    if (!sessionId || !canDraw) return;
    if (!canDelete) {
      setError("Для объединения точек нужно разрешение на удаление.");
      return;
    }
    const points = boardObjects
      .filter((object): object is WorkbookBoardObject & { type: "point" } => object.type === "point")
      .slice()
      .sort((a, b) => {
        const left = Date.parse(a.createdAt);
        const right = Date.parse(b.createdAt);
        if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
        return a.id.localeCompare(b.id);
      });
    if (points.length < 2) {
      setError("Нужно минимум две точки, чтобы объединить их.");
      return;
    }

    const used = new Set<string>();
    const pointIds = new Set(points.map((point) => point.id));
    boardObjects.forEach((object) => {
      if (pointIds.has(object.id)) return;
      collectBoardObjectLabels(object).forEach((label) => used.add(label));
    });

    const labels = points.map((_, index) => getNextUniqueBoardLabel(used, index));
    const polylinePoints = points.map((point) => ({
      x: point.x + point.width / 2,
      y: point.y + point.height / 2,
    }));
    const bounds = getPointsBounds(polylinePoints);
    const createdAt = new Date().toISOString();
    const fallbackColor = "#4f63ff";
    const figureKind = classifyConnectedFigureKind(polylinePoints);
    const created: WorkbookBoardObject =
      polylinePoints.length === 2
        ? {
            id: generateId(),
            type: "line",
            layer: "board",
            x: polylinePoints[0].x,
            y: polylinePoints[0].y,
            width: polylinePoints[1].x - polylinePoints[0].x,
            height: polylinePoints[1].y - polylinePoints[0].y,
            color: fallbackColor,
            fill: "transparent",
            strokeWidth: 2,
            opacity: 1,
            authorUserId: user?.id ?? "unknown",
            createdAt,
            meta: {
              sceneLayerId: activeSceneLayerId,
              lineKind: "segment",
              lineStyle: "solid",
              startLabel: labels[0],
              endLabel: labels[1],
              figureKind: "segment",
            },
          }
        : {
            id: generateId(),
            type: "polygon",
            layer: "board",
            x: bounds.minX,
            y: bounds.minY,
            width: bounds.width,
            height: bounds.height,
            color: fallbackColor,
            fill: "transparent",
            strokeWidth: 2,
            opacity: 1,
            points: polylinePoints,
            sides: polylinePoints.length,
            authorUserId: user?.id ?? "unknown",
            createdAt,
            meta: {
              sceneLayerId: activeSceneLayerId,
              polygonMode: "points",
              polygonPreset: "regular",
              closed: true,
              figureKind,
              vertexLabels: labels,
              showAngles: false,
              vertexColors: Array.from({ length: polylinePoints.length }, () => fallbackColor),
              angleMarks: Array.from({ length: polylinePoints.length }, () => ({
                valueText: "",
                color: fallbackColor,
                style: "auto" as const,
              })),
              angleNotes: Array.from({ length: polylinePoints.length }, () => ""),
              angleColors: Array.from({ length: polylinePoints.length }, () => fallbackColor),
              segmentNotes: Array.from({ length: polylinePoints.length }, () => ""),
              segmentColors: Array.from({ length: polylinePoints.length }, () => fallbackColor),
            },
          };

    const deleteEvents = points.map((point) => ({
      type: "board.object.delete" as const,
      payload: { objectId: point.id },
    }));

    try {
      await appendEventsAndApply([
        {
          type: "board.object.create",
          payload: { object: created },
        },
        ...deleteEvents,
      ]);
      setSelectedObjectId(created.id);
    } catch {
      setError("Не удалось объединить точки.");
    }
  }, [activeSceneLayerId, appendEventsAndApply, boardObjects, canDelete, canDraw, sessionId, user?.id]);

  const updateSelectedShape2dMeta = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      await commitObjectUpdate(target.id, {
        meta: {
          ...(target.meta ?? {}),
          ...patch,
        },
      });
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const updateSelectedShape2dObject = useCallback(
    async (patch: Partial<WorkbookBoardObject>) => {
      if (!selectedObjectId || !canSelect) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      await commitObjectUpdate(target.id, patch);
    },
    [boardObjects, canSelect, commitObjectUpdate, selectedObjectId]
  );

  const buildShapeAngleMetaPatch = useCallback(
    (marks: WorkbookShapeAngleMark[]) => ({
      angleMarks: marks.map((mark) => ({
        valueText: mark.valueText.slice(0, 24),
        color: mark.color,
        style: mark.style,
      })),
      angleNotes: marks.map((mark) => mark.valueText.slice(0, 24)),
      angleColors: marks.map((mark) => mark.color),
    }),
    []
  );

  const updateSelectedShape2dAngleMark = useCallback(
    async (
      index: number,
      patch: Partial<Pick<WorkbookShapeAngleMark, "valueText" | "color" | "style">>
    ) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const fallback = target.color || "#4f63ff";
      const next = normalizeShapeAngleMarks(target, vertices.length, fallback);
      const currentMark = next[index];
      if (!currentMark) return;
      next[index] = {
        ...currentMark,
        ...(patch.valueText !== undefined
          ? { valueText: patch.valueText.slice(0, 24) }
          : {}),
        ...(patch.color !== undefined ? { color: patch.color || fallback } : {}),
        ...(patch.style !== undefined ? { style: patch.style } : {}),
      };
      await updateSelectedShape2dMeta(buildShapeAngleMetaPatch(next));
    },
    [
      boardObjects,
      buildShapeAngleMetaPatch,
      selectedObjectId,
      updateSelectedShape2dMeta,
    ]
  );

  const renameSelectedShape2dVertex = useCallback(
    async (index: number, label: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const raw = Array.isArray(target.meta?.vertexLabels) ? target.meta.vertexLabels : [];
      const next = vertices.map((_, vertexIndex) => {
        const value = typeof raw[vertexIndex] === "string" ? raw[vertexIndex].trim() : "";
        return value || getFigureVertexLabel(vertexIndex);
      });
      next[index] = label.trim().slice(0, 12) || getFigureVertexLabel(index);
      await updateSelectedShape2dMeta({ vertexLabels: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  const updateSelectedShape2dAngleNote = useCallback(
    async (index: number, value: string) => {
      await updateSelectedShape2dAngleMark(index, {
        valueText: value.slice(0, 24),
      });
    },
    [updateSelectedShape2dAngleMark]
  );

  const updateSelectedShape2dSegmentNote = useCallback(
    async (index: number, value: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (vertices.length < 2) return;
      const closed = is2dFigureClosed(target);
      const segmentCount = closed ? vertices.length : Math.max(0, vertices.length - 1);
      const raw = Array.isArray(target.meta?.segmentNotes) ? target.meta.segmentNotes : [];
      const next = Array.from({ length: segmentCount }, (_, itemIndex) =>
        typeof raw[itemIndex] === "string" ? raw[itemIndex] : ""
      );
      next[index] = value.slice(0, 24);
      await updateSelectedShape2dMeta({ segmentNotes: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  const updateSelectedShape2dVertexColor = useCallback(
    async (index: number, color: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const raw = Array.isArray(target.meta?.vertexColors) ? target.meta.vertexColors : [];
      const fallback = target.color || "#4f63ff";
      const next = vertices.map((_, itemIndex) =>
        typeof raw[itemIndex] === "string" && raw[itemIndex] ? raw[itemIndex] : fallback
      );
      next[index] = color || fallback;
      await updateSelectedShape2dMeta({ vertexColors: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  const updateSelectedShape2dAngleColor = useCallback(
    async (index: number, color: string) => {
      await updateSelectedShape2dAngleMark(index, {
        color,
      });
    },
    [updateSelectedShape2dAngleMark]
  );

  const updateSelectedShape2dAngleStyle = useCallback(
    async (index: number, style: WorkbookShapeAngleMarkStyle) => {
      await updateSelectedShape2dAngleMark(index, {
        style,
      });
    },
    [updateSelectedShape2dAngleMark]
  );

  const commitSelectedShape2dStrokeWidth = useCallback(async () => {
    if (!selectedObjectId) return;
    const target = boardObjects.find((item) => item.id === selectedObjectId);
    if (!target || !is2dFigureObject(target)) return;
    const next = Math.max(1, Math.min(18, Math.round(shape2dStrokeWidthDraft)));
    const current = target.strokeWidth ?? 2;
    if (Math.abs(next - current) < 0.01) return;
    await updateSelectedShape2dObject({ strokeWidth: next });
  }, [
    boardObjects,
    selectedObjectId,
    shape2dStrokeWidthDraft,
    updateSelectedShape2dObject,
  ]);

  const flushSelectedShape2dAngleDraftCommit = useCallback(
    async (index: number, draftOverride?: string) => {
      const timer = shapeAngleDraftCommitTimersRef.current.get(index);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        shapeAngleDraftCommitTimersRef.current.delete(index);
      }
      if (!selectedObjectId) return;
      const draftObjectId = shapeAngleDraftObjectIdRef.current;
      if (!draftObjectId || draftObjectId !== selectedObjectId) return;
      const nextValue = (draftOverride ?? shapeAngleDraftValuesRef.current.get(index) ?? "")
        .slice(0, 24);
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const fallback = target.color || "#4f63ff";
      const currentValue =
        normalizeShapeAngleMarks(target, vertices.length, fallback)[index]?.valueText ?? "";
      if (currentValue === nextValue) return;
      await updateSelectedShape2dAngleNote(index, nextValue);
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dAngleNote]
  );

  const scheduleSelectedShape2dAngleDraftCommit = useCallback(
    (index: number, value: string) => {
      if (!selectedObjectId) return;
      const nextValue = value.slice(0, 24);
      shapeAngleDraftObjectIdRef.current = selectedObjectId;
      shapeAngleDraftValuesRef.current.set(index, nextValue);
      const existingTimer = shapeAngleDraftCommitTimersRef.current.get(index);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        void flushSelectedShape2dAngleDraftCommit(index, nextValue);
      }, 260);
      shapeAngleDraftCommitTimersRef.current.set(index, timer);
    },
    [flushSelectedShape2dAngleDraftCommit, selectedObjectId]
  );

  const flushSelectedShape2dSegmentDraftCommit = useCallback(
    async (index: number, draftOverride?: string) => {
      const timer = shapeSegmentDraftCommitTimersRef.current.get(index);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        shapeSegmentDraftCommitTimersRef.current.delete(index);
      }
      if (!selectedObjectId) return;
      const draftObjectId = shapeSegmentDraftObjectIdRef.current;
      if (!draftObjectId || draftObjectId !== selectedObjectId) return;
      const nextValue = (draftOverride ?? shapeSegmentDraftValuesRef.current.get(index) ?? "")
        .slice(0, 24);
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (vertices.length < 2) return;
      const raw = Array.isArray(target.meta?.segmentNotes) ? target.meta.segmentNotes : [];
      const currentValue = typeof raw[index] === "string" ? raw[index] : "";
      if (currentValue === nextValue) return;
      await updateSelectedShape2dSegmentNote(index, nextValue);
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dSegmentNote]
  );

  const scheduleSelectedShape2dSegmentDraftCommit = useCallback(
    (index: number, value: string) => {
      if (!selectedObjectId) return;
      const nextValue = value.slice(0, 24);
      shapeSegmentDraftObjectIdRef.current = selectedObjectId;
      shapeSegmentDraftValuesRef.current.set(index, nextValue);
      const existingTimer = shapeSegmentDraftCommitTimersRef.current.get(index);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        void flushSelectedShape2dSegmentDraftCommit(index, nextValue);
      }, 260);
      shapeSegmentDraftCommitTimersRef.current.set(index, timer);
    },
    [flushSelectedShape2dSegmentDraftCommit, selectedObjectId]
  );

  const updateSelectedShape2dSegmentColor = useCallback(
    async (index: number, color: string) => {
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (vertices.length < 2) return;
      const closed = is2dFigureClosed(target);
      const segmentCount = closed ? vertices.length : Math.max(0, vertices.length - 1);
      const raw = Array.isArray(target.meta?.segmentColors) ? target.meta.segmentColors : [];
      const fallback = target.color || "#4f63ff";
      const next = Array.from({ length: segmentCount }, (_, itemIndex) =>
        typeof raw[itemIndex] === "string" && raw[itemIndex] ? raw[itemIndex] : fallback
      );
      next[index] = color || fallback;
      await updateSelectedShape2dMeta({ segmentColors: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
  );

  const updateSelectedSolid3dState = async (
    updater: (state: Solid3dState) => Solid3dState,
    objectIdOverride?: string
  ) => {
    if (!canSelect) return;
    const targetObjectId = objectIdOverride ?? selectedObjectId;
    if (!targetObjectId) return;
    const targetObject = boardObjects.find(
      (item): item is WorkbookBoardObject & { type: "solid3d" } =>
        item.id === targetObjectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    const currentState = readSolid3dState(targetObject.meta);
    const nextState = updater(currentState);
    await commitObjectUpdate(targetObject.id, {
      meta: writeSolid3dState(nextState, targetObject.meta),
    });
  };

  const setSolid3dHiddenEdges = async (hidden: boolean) => {
    await updateSelectedSolid3dState((state) => {
      const current = new Set(state.hiddenFaceIds);
      if (hidden) {
        current.add("hidden_edges");
      } else {
        current.delete("hidden_edges");
      }
      return {
        ...state,
        hiddenFaceIds: [...current],
      };
    });
  };

  const setSolid3dFaceColor = async (faceIndex: number, color: string) => {
    if (!Number.isInteger(faceIndex) || faceIndex < 0) return;
    await updateSelectedSolid3dState((state) => ({
      ...state,
      faceColors: {
        ...(state.faceColors ?? {}),
        [String(faceIndex)]: color || "#5f6aa0",
      },
    }));
  };

  const resetSolid3dFaceColors = async () => {
    await updateSelectedSolid3dState((state) => ({
      ...state,
      faceColors: {},
    }));
  };

  const updateSelectedSolid3dSurfaceColor = async (color: string) => {
    if (!canSelect || !selectedObjectId) return;
    const targetObject = boardObjects.find(
      (item): item is WorkbookBoardObject & { type: "solid3d" } =>
        item.id === selectedObjectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    await commitObjectUpdate(targetObject.id, {
      fill: color || "#5f6aa0",
    });
  };

  const updateSelectedSolid3dStrokeWidth = async (strokeWidthValue: number) => {
    if (!canSelect || !selectedObjectId) return;
    const targetObject = boardObjects.find(
      (item): item is WorkbookBoardObject & { type: "solid3d" } =>
        item.id === selectedObjectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    await commitObjectUpdate(targetObject.id, {
      strokeWidth: Math.max(1, Math.min(18, Math.round(strokeWidthValue))),
    });
  };

  const commitSelectedSolid3dStrokeWidth = async () => {
    if (!selectedObjectId) return;
    const targetObject = boardObjects.find(
      (item): item is WorkbookBoardObject & { type: "solid3d" } =>
        item.id === selectedObjectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    const next = Math.max(1, Math.min(18, Math.round(solid3dStrokeWidthDraft)));
    const current = targetObject.strokeWidth ?? 2;
    if (Math.abs(next - current) < 0.01) return;
    await updateSelectedSolid3dStrokeWidth(next);
  };

  const setSolid3dEdgeColor = async (edgeKey: string, color: string) => {
    if (!edgeKey.trim()) return;
    await updateSelectedSolid3dState((state) => ({
      ...state,
      edgeColors: {
        ...(state.edgeColors ?? {}),
        [edgeKey]: color || "#4f63ff",
      },
    }));
  };

  const resetSolid3dEdgeColors = async () => {
    await updateSelectedSolid3dState((state) => ({
      ...state,
      edgeColors: {},
    }));
  };

  const addSolid3dAngleMark = async () => {
    if (!selectedSolidMesh) return;
    const existing = selectedSolid3dState?.angleMarks ?? [];
    const used = new Set(
      existing.map((mark) => `${Number.isInteger(mark.faceIndex) ? mark.faceIndex : -1}:${mark.vertexIndex}`)
    );
    let nextFaceIndex = -1;
    let nextVertexIndex = -1;
    selectedSolidMesh.faces.some((face, faceIndex) => {
      if (face.length < 3) return false;
      const vertexIndex = face.find((index) => !used.has(`${faceIndex}:${index}`));
      if (vertexIndex === undefined) return false;
      nextFaceIndex = faceIndex;
      nextVertexIndex = vertexIndex;
      return true;
    });
    if (nextFaceIndex < 0 || nextVertexIndex < 0) {
      setError("Для этой фигуры уже добавлены все доступные углы.");
      return;
    }
    await updateSelectedSolid3dState((state) => ({
      ...state,
      angleMarks: [
        ...(state.angleMarks ?? []),
        {
          id: generateId(),
          faceIndex: nextFaceIndex,
          vertexIndex: nextVertexIndex,
          label: "",
          style: "arc_single",
          color: "#ff8e3c",
          visible: true,
        },
      ],
    }));
  };

  const updateSolid3dAngleMark = async (
    markId: string,
    patch: Partial<{
      faceIndex: number;
      vertexIndex: number;
      label: string;
      style: WorkbookShapeAngleMarkStyle;
      color: string;
      visible: boolean;
    }>
  ) => {
    await updateSelectedSolid3dState((state) => ({
      ...state,
      angleMarks: (state.angleMarks ?? []).map((mark) =>
        mark.id === markId
          ? (() => {
              const next = {
                ...mark,
                ...patch,
                label:
                  typeof patch.label === "string"
                    ? patch.label.trim().slice(0, 64)
                    : mark.label,
              };
              if (!selectedSolidMesh) return next;
              const requestedFaceIndex =
                typeof next.faceIndex === "number" &&
                Number.isInteger(next.faceIndex) &&
                next.faceIndex >= 0
                  ? next.faceIndex
                  : null;
              const face =
                requestedFaceIndex !== null ? selectedSolidMesh.faces[requestedFaceIndex] : null;
              if (requestedFaceIndex !== null && face && face.length >= 3) {
                if (!face.includes(next.vertexIndex)) {
                  next.vertexIndex = face[0];
                }
                next.faceIndex = requestedFaceIndex;
              } else {
                delete next.faceIndex;
              }
              return next;
            })()
          : mark
      ),
    }));
  };

  const deleteSolid3dAngleMark = async (markId: string) => {
    await updateSelectedSolid3dState((state) => ({
      ...state,
      angleMarks: (state.angleMarks ?? []).filter((mark) => mark.id !== markId),
    }));
  };

  const getPointLimitForSolidObject = (object: WorkbookBoardObject) => {
    if (object.type !== "solid3d") return 8;
    const presetId =
      typeof object.meta?.presetId === "string" ? object.meta.presetId : "cube";
    const mesh = getSolid3dMesh(
      presetId,
      Math.max(1, Math.abs(object.width)),
      Math.max(1, Math.abs(object.height))
    );
    return getSolidSectionPointLimit(presetId, mesh);
  };

  const createUniqueSectionVertexLabels = useCallback(
    (vertexCount: number) => {
      const used = new Set<string>();
      boardObjects.forEach((object) => {
        collectBoardObjectLabels(object).forEach((label) => used.add(label));
      });
      return Array.from({ length: Math.max(0, vertexCount) }, (_, index) =>
        getNextUniqueBoardLabel(used, index)
      );
    },
    [boardObjects]
  );

  const addDraftPointToSolid = (payload: { objectId: string; point: Solid3dSectionPoint }) => {
    const targetObject = boardObjects.find((item) => item.id === payload.objectId);
    if (!targetObject || targetObject.type !== "solid3d") return;
    if (solid3dSectionPointCollecting !== targetObject.id) return;
    const triangleIndices = payload.point.triangleVertexIndices ?? [];
    const barycentric = payload.point.barycentric ?? [];
    const hasEdgeOrVertexBarycentric =
      barycentric.length === 3 && barycentric.some((weight) => Math.abs(weight) <= 1e-4);
    const isSurfacePoint =
      Number.isInteger(payload.point.faceIndex) &&
      triangleIndices.length === 3 &&
      new Set(triangleIndices).size >= 1 &&
      hasEdgeOrVertexBarycentric;
    if (!isSurfacePoint) {
      setError("Точка должна лежать на ребре или вершине фигуры.");
      return;
    }
    const maxPoints = getPointLimitForSolidObject(targetObject);
    setSelectedObjectId(targetObject.id);
    setSolid3dDraftPoints((current) => {
      const sameObject = current?.objectId === targetObject.id;
      const base = sameObject ? current.points : [];
      const isDuplicate = base.some(
        (entry) =>
          Math.hypot(entry.x - payload.point.x, entry.y - payload.point.y, entry.z - payload.point.z) <
          1e-4
      );
      if (isDuplicate) return current ?? { objectId: targetObject.id, points: base };
      if (base.length >= maxPoints) return current ?? { objectId: targetObject.id, points: base };
      const nextIndex = base.length;
      const nextPoints = [
        ...base,
        {
          ...payload.point,
          label: payload.point.label || getSectionPointLabel(nextIndex),
        },
      ];
      return {
        objectId: targetObject.id,
        points: ensureUniqueSectionPointLabels(nextPoints),
      };
    });
  };

  const clearSolid3dDraftPoints = () => {
    if (solid3dSectionPointCollecting) {
      setSolid3dDraftPoints({
        objectId: solid3dSectionPointCollecting,
        points: [],
      });
      return;
    }
    setSolid3dDraftPoints(null);
  };

  const buildSectionFromDraftPoints = async () => {
    if (!solid3dDraftPoints || solid3dDraftPoints.points.length < 3) {
      setError("Для построения сечения нужно минимум 3 точки на ребрах/вершинах.");
      return;
    }
    const targetObject = boardObjects.find((item) => item.id === solid3dDraftPoints.objectId);
    if (!targetObject || targetObject.type !== "solid3d") {
      setError("Не удалось найти выбранную 3D-фигуру.");
      return;
    }
    const presetId =
      typeof targetObject.meta?.presetId === "string" ? targetObject.meta.presetId : "cube";
    const mesh = getSolid3dMesh(
      presetId,
      Math.max(1, Math.abs(targetObject.width)),
      Math.max(1, Math.abs(targetObject.height))
    );
    if (!mesh) {
      setError("Не удалось построить сечение для выбранной фигуры.");
      return;
    }
    const currentState = readSolid3dState(targetObject.meta);
    const maxPoints = getSolidSectionPointLimit(presetId, mesh);
    const tempSection: Solid3dSectionState = {
      id: generateId(),
      name: `Сечение ${Math.max(1, currentState.sections.length + 1)}`,
      visible: true,
      mode: "through_points",
      pointIndices: [],
      points: ensureUniqueSectionPointLabels(
        solid3dDraftPoints.points.slice(0, maxPoints)
      ),
      vertexLabels: [],
      offset: 0,
      tiltX: 0,
      tiltY: 0,
      keepSide: "both",
      color: "#ff8e3c",
      thickness: 2,
      fillEnabled: true,
      fillOpacity: 0.18,
      showMetrics: false,
    };
    const polygon = computeSectionPolygon(mesh, tempSection).polygon;
    if (polygon.length < 3) {
      setError("По выбранным точкам не удалось построить корректное сечение.");
      return;
    }
    const nextSection: Solid3dSectionState = {
      ...tempSection,
      points: ensureUniqueSectionPointLabels(
        solid3dDraftPoints.points.slice(0, maxPoints)
      ),
      vertexLabels: createUniqueSectionVertexLabels(polygon.length),
    };
    const nextState: Solid3dState = {
      ...currentState,
      sections: [...currentState.sections, nextSection],
    };
    await commitObjectUpdate(targetObject.id, {
      meta: writeSolid3dState(nextState, targetObject.meta),
    });
    setSelectedObjectId(targetObject.id);
    setActiveSolidSectionId(nextSection.id);
    setSolid3dSectionPointCollecting(null);
    setSolid3dDraftPoints(null);
  };

  const updateSolid3dSection = async (
    sectionId: string,
    patch: Partial<Solid3dSectionState>,
    objectIdOverride?: string
  ) => {
    const normalizedPatch: Partial<Solid3dSectionState> = { ...patch };
    if (Array.isArray(patch.points)) {
      normalizedPatch.points = ensureUniqueSectionPointLabels(patch.points);
    }
    if (Array.isArray(patch.vertexLabels)) {
      normalizedPatch.vertexLabels = patch.vertexLabels.map((label, index) =>
        (typeof label === "string" ? label.trim().slice(0, 16) : "") ||
        getSectionVertexLabel(index)
      );
    }
    await updateSelectedSolid3dState((state) => ({
      ...state,
      sections: state.sections.map((section) =>
        section.id === sectionId ? { ...section, ...normalizedPatch } : section
      ),
    }), objectIdOverride);
  };

  const deleteSolid3dSection = async (sectionId: string, objectIdOverride?: string) => {
    await updateSelectedSolid3dState((state) => ({
      ...state,
      sections: state.sections.filter((section) => section.id !== sectionId),
    }), objectIdOverride);
    if (activeSolidSectionId === sectionId) {
      const fallback =
        selectedSolid3dState?.sections.find((section) => section.id !== sectionId)?.id ?? null;
      setActiveSolidSectionId(fallback);
    }
    setSolid3dSectionVertexContextMenu((current) =>
      current?.sectionId === sectionId ? null : current
    );
  };

  const startSolid3dSectionPointCollection = () => {
    if (!selectedObject || selectedObject.type !== "solid3d") {
      setError("Сначала выберите 3D-фигуру.");
      return;
    }
    setSolid3dInspectorTab("section");
    resetToolRuntimeToSelect();
    setSolid3dSectionPointCollecting(selectedObject.id);
    setSolid3dDraftPoints({
      objectId: selectedObject.id,
      points: [],
    });
  };

  const renameSolid3dSectionVertex = async (
    sectionId: string,
    vertexIndex: number,
    label: string
  ) => {
    const normalized = label.trim().slice(0, 16);
    await updateSelectedSolid3dState((state) => ({
      ...state,
      sections: state.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const current = Array.isArray(section.vertexLabels) ? section.vertexLabels : [];
        const nextLength = Math.max(current.length, vertexIndex + 1);
        const nextLabels = Array.from({ length: nextLength }, (_, index) =>
          (typeof current[index] === "string" ? current[index].trim().slice(0, 16) : "") ||
          getSectionVertexLabel(index)
        );
        nextLabels[vertexIndex] = normalized || getSectionVertexLabel(vertexIndex);
        return {
          ...section,
          vertexLabels: nextLabels,
        };
      }),
    }));
  };

  const renameSolid3dVertex = async (vertexIndex: number, label: string) => {
    const normalized = label.trim().slice(0, 16);
    await updateSelectedSolid3dState((state) => {
      const current = Array.isArray(state.vertexLabels) ? state.vertexLabels : [];
      const nextLength = Math.max(current.length, vertexIndex + 1);
      const nextLabels = Array.from({ length: nextLength }, (_, index) =>
        current[index] ?? getSolidVertexLabel(index)
      );
      nextLabels[vertexIndex] = normalized || getSolidVertexLabel(vertexIndex);
      return {
        ...state,
        vertexLabels: nextLabels,
      };
    });
  };

  const createMathPresetObject = async (
    type: "coordinate_grid" | "solid3d" | "section3d" | "net3d",
    options?: { presetId?: string; presetTitle?: string }
  ) => {
    if (!canDraw) return;
    if (type === "solid3d") {
      setPendingSolid3dInsertPreset({
        presetId: resolveSolid3dPresetId(options?.presetId ?? "cube"),
        presetTitle: options?.presetTitle,
      });
      setSelectedObjectId(null);
      setSelectedConstraintId(null);
      resetToolRuntimeToSelect();
      return;
    }
    const defaultSolidWidth = 220;
    const defaultSolidHeight = 180;
    const objectMeta =
      type === "coordinate_grid"
        ? { step: boardSettings.gridSize }
        : options?.presetId || options?.presetTitle
          ? {
              presetId: options?.presetId ?? null,
              presetTitle: options?.presetTitle ?? null,
            }
          : undefined;
    const object: WorkbookBoardObject = {
      id: generateId(),
      type,
      layer: "board",
      x: 110 + boardObjects.length * 6,
      y: 90 + boardObjects.length * 6,
      width: type === "coordinate_grid" ? 360 : defaultSolidWidth,
      height: type === "coordinate_grid" ? 240 : defaultSolidHeight,
      color:
        type === "section3d"
          ? "#ff8e3c"
          : type === "net3d"
            ? "#2a9d8f"
            : "#4f63ff",
      fill:
        type === "section3d"
          ? "rgba(255, 142, 60, 0.2)"
          : type === "net3d"
            ? "rgba(88, 209, 146, 0.14)"
            : "transparent",
      strokeWidth: 2,
      opacity: 1,
      text: options?.presetTitle,
      meta: objectMeta,
      authorUserId: user?.id ?? "unknown",
      createdAt: new Date().toISOString(),
    };
    const created = await commitObjectCreate(object);
    if (!created) return;
    suppressAutoPanelSelectionRef.current = object.id;
    setSelectedObjectId(object.id);
    resetToolRuntimeToSelect();
  };

  const createFunctionGraphPlane = useCallback(() => {
    if (!canDraw) return;
    setSelectedConstraintId(null);
    setSelectedObjectId(null);
    setGraphDraftError(null);
    setGraphWorkbenchTab("catalog");
    activateTool("function_graph");
  }, [activateTool, canDraw]);

  useEffect(() => {
    if (!pendingSolid3dInsertPreset) return;
    if (tool === "select") return;
    setPendingSolid3dInsertPreset(null);
  }, [pendingSolid3dInsertPreset, tool]);

  const clearPendingSolid3dInsertPreset = useCallback(() => {
    setPendingSolid3dInsertPreset(null);
    resetToolRuntimeToSelect();
  }, [resetToolRuntimeToSelect]);

  const handleLaserPoint = useCallback(
    async (point: WorkbookPoint) => {
      if (!canUseLaser) return;
      const authorKey = user?.id ?? "unknown";
      setPointerPoint(point);
      setFocusPoint(point);
      setPointerPointsByUser((current) => ({
        ...current,
        [authorKey]: point,
      }));
      setFocusPointsByUser((current) => ({
        ...current,
        [authorKey]: point,
      }));
      const previousTimer = focusResetTimersByUserRef.current.get(authorKey);
      if (previousTimer !== undefined) {
        window.clearTimeout(previousTimer);
      }
      const nextTimer = window.setTimeout(() => {
        setFocusPointsByUser((current) => {
          if (!(authorKey in current)) return current;
          const next = { ...current };
          delete next[authorKey];
          return next;
        });
        setFocusPoint(null);
        focusResetTimersByUserRef.current.delete(authorKey);
      }, 800);
      focusResetTimersByUserRef.current.set(authorKey, nextTimer);
      try {
        await appendEventsAndApply([
          {
            type: "focus.point",
            payload: {
              target: "board",
              point,
              mode: "pin",
            },
          },
        ]);
      } catch {
        setError("Не удалось передать фокус.");
      }
    },
    [appendEventsAndApply, canUseLaser, user?.id]
  );

  const clearLaserPointer = useCallback(async (options?: { keepTool?: boolean }) => {
    if (!canUseLaser) return;
    if (laserClearInFlightRef.current) return;
    laserClearInFlightRef.current = true;
    const actorKey = user?.id ?? "unknown";
    setPointerPoint(null);
    setFocusPoint(null);
    setPointerPointsByUser((current) => {
      if (!(actorKey in current)) return current;
      const next = { ...current };
      delete next[actorKey];
      return next;
    });
    setFocusPointsByUser((current) => {
      if (!(actorKey in current)) return current;
      const next = { ...current };
      delete next[actorKey];
      return next;
    });
    const timerId = focusResetTimersByUserRef.current.get(actorKey);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      focusResetTimersByUserRef.current.delete(actorKey);
    }
    try {
      await appendEventsAndApply([
        {
          type: "focus.point",
          payload: {
            target: "board",
            mode: "clear",
          },
        },
      ]);
      if (!options?.keepTool) {
        resetToolRuntimeToSelect();
      }
    } catch {
      setError("Не удалось убрать указку.");
    } finally {
      laserClearInFlightRef.current = false;
    }
  }, [appendEventsAndApply, canUseLaser, resetToolRuntimeToSelect, user?.id]);

  useEffect(() => {
    if (tool === "laser" || !pointerPoint) return;
    void clearLaserPointer({ keepTool: true });
  }, [clearLaserPointer, pointerPoint, tool]);

  useEffect(() => {
    if (tool !== "laser" || !pointerPoint) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void clearLaserPointer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearLaserPointer, pointerPoint, tool]);

  const handleUndo = useCallback(async () => {
    if (!canUseUndo || undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    if (!entry) return;
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, entry].slice(-80);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    applyHistoryOperations(entry.inverse);
    markDirty();
    try {
      await appendEventsAndApply([
        {
          type: "board.undo",
          payload: {
            operations: entry.inverse,
          },
        },
      ], { trackHistory: false, markDirty: false });
    } catch {
      setError("Не удалось выполнить отмену действия.");
    }
  }, [
    applyHistoryOperations,
    appendEventsAndApply,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    markDirty,
  ]);

  const handleRedo = useCallback(async () => {
    if (!canUseUndo || redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    if (!entry) return;
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    clearIncomingEraserPreviewRuntime();
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, entry].slice(-80);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    applyHistoryOperations(entry.forward);
    markDirty();
    try {
      await appendEventsAndApply([
        {
          type: "board.redo",
          payload: {
            operations: entry.forward,
          },
        },
      ], { trackHistory: false, markDirty: false });
    } catch {
      setError("Не удалось повторить действие.");
    }
  }, [
    applyHistoryOperations,
    appendEventsAndApply,
    canUseUndo,
    clearIncomingEraserPreviewRuntime,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    markDirty,
  ]);

  useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
      );
      if (isTypingTarget) return;
      const withModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (
        tool === "area_select" &&
        areaSelectionHasContent &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        void deleteAreaSelectionObjects();
        return;
      }

      if (tool === "area_select" && withModifier && key === "c") {
        event.preventDefault();
        copyAreaSelectionObjects();
        return;
      }

      if (tool === "area_select" && withModifier && key === "x") {
        event.preventDefault();
        void cutAreaSelectionObjects();
        return;
      }

      if (tool === "area_select" && withModifier && key === "v") {
        event.preventDefault();
        void pasteAreaSelectionObjects();
        return;
      }

      if (!withModifier) return;
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (key === "z" && event.shiftKey) {
        void handleRedo();
        return;
      }
      if (key === "z") {
        void handleUndo();
        return;
      }
      if (key === "y") {
        void handleRedo();
      }
    };
    window.addEventListener("keydown", onHotkey);
    return () => window.removeEventListener("keydown", onHotkey);
  }, [
    areaSelection,
    areaSelectionHasContent,
    copyAreaSelectionObjects,
    cutAreaSelectionObjects,
    deleteAreaSelectionObjects,
    handleRedo,
    handleUndo,
    pasteAreaSelectionObjects,
    tool,
  ]);

  const handleObjectContextMenu = (objectId: string, anchor: { x: number; y: number }) => {
    setShapeVertexContextMenu(null);
    setLineEndpointContextMenu(null);
    setSolid3dVertexContextMenu(null);
    setSolid3dSectionVertexContextMenu(null);
    setSolid3dSectionContextMenu(null);
    setSelectedObjectId(objectId);
    setObjectContextMenu({ objectId, x: anchor.x, y: anchor.y });
  };

  const handleShapeVertexContextMenu = (payload: {
    objectId: string;
    vertexIndex: number;
    label: string;
    anchor: { x: number; y: number };
  }) => {
    setObjectContextMenu(null);
    setLineEndpointContextMenu(null);
    setSolid3dVertexContextMenu(null);
    setSolid3dSectionVertexContextMenu(null);
    setSolid3dSectionContextMenu(null);
    setSelectedObjectId(payload.objectId);
    setShapeVertexContextMenu({
      objectId: payload.objectId,
      vertexIndex: payload.vertexIndex,
      x: payload.anchor.x,
      y: payload.anchor.y,
      label: payload.label,
    });
  };

  const handleLineEndpointContextMenu = (payload: {
    objectId: string;
    endpoint: "start" | "end";
    label: string;
    anchor: { x: number; y: number };
  }) => {
    setObjectContextMenu(null);
    setShapeVertexContextMenu(null);
    setSolid3dVertexContextMenu(null);
    setSolid3dSectionVertexContextMenu(null);
    setSolid3dSectionContextMenu(null);
    setSelectedObjectId(payload.objectId);
    setLineEndpointContextMenu({
      objectId: payload.objectId,
      endpoint: payload.endpoint,
      x: payload.anchor.x,
      y: payload.anchor.y,
      label: payload.label,
    });
  };

  const handleSolid3dVertexContextMenu = (payload: {
    objectId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => {
    const targetObject = boardObjects.find(
      (item) => item.id === payload.objectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    const targetState = readSolid3dState(targetObject.meta);
    const label =
      targetState.vertexLabels[payload.vertexIndex] || getSolidVertexLabel(payload.vertexIndex);
    setObjectContextMenu(null);
    setShapeVertexContextMenu(null);
    setLineEndpointContextMenu(null);
    setSolid3dSectionVertexContextMenu(null);
    setSolid3dSectionContextMenu(null);
    setSelectedObjectId(payload.objectId);
    setSolid3dVertexContextMenu({
      objectId: payload.objectId,
      vertexIndex: payload.vertexIndex,
      x: payload.anchor.x,
      y: payload.anchor.y,
      label,
    });
  };

  const handleSolid3dSectionVertexContextMenu = (payload: {
    objectId: string;
    sectionId: string;
    vertexIndex: number;
    anchor: { x: number; y: number };
  }) => {
    const targetObject = boardObjects.find(
      (item) => item.id === payload.objectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    const targetState = readSolid3dState(targetObject.meta);
    const section = targetState.sections.find((item) => item.id === payload.sectionId);
    if (!section) return;
    const label =
      section.vertexLabels[payload.vertexIndex] || getSectionVertexLabel(payload.vertexIndex);
    setObjectContextMenu(null);
    setShapeVertexContextMenu(null);
    setLineEndpointContextMenu(null);
    setSolid3dVertexContextMenu(null);
    setSolid3dSectionContextMenu(null);
    setSelectedObjectId(payload.objectId);
    setActiveSolidSectionId(payload.sectionId);
    setSolid3dSectionVertexContextMenu({
      objectId: payload.objectId,
      sectionId: payload.sectionId,
      vertexIndex: payload.vertexIndex,
      x: payload.anchor.x,
      y: payload.anchor.y,
      label,
    });
  };

  const handleSolid3dSectionContextMenu = (payload: {
    objectId: string;
    sectionId: string;
    anchor: { x: number; y: number };
  }) => {
    const targetObject = boardObjects.find(
      (item) => item.id === payload.objectId && item.type === "solid3d"
    );
    if (!targetObject) return;
    const targetState = readSolid3dState(targetObject.meta);
    const section = targetState.sections.find((item) => item.id === payload.sectionId);
    if (!section) return;
    setObjectContextMenu(null);
    setShapeVertexContextMenu(null);
    setLineEndpointContextMenu(null);
    setSolid3dVertexContextMenu(null);
    setSolid3dSectionVertexContextMenu(null);
    setSelectedObjectId(payload.objectId);
    setActiveSolidSectionId(payload.sectionId);
    setSolid3dSectionContextMenu({
      objectId: payload.objectId,
      sectionId: payload.sectionId,
      x: payload.anchor.x,
      y: payload.anchor.y,
    });
  };

  const handleCopyInviteLink = useCallback(async () => {
    if (!sessionId) return;
    try {
      setCopyingInviteLink(true);
      const invite = await createWorkbookInvite(sessionId);
      const rawInviteUrl = typeof invite.inviteUrl === "string" ? invite.inviteUrl.trim() : "";
      const invitePath = rawInviteUrl.startsWith("http://") || rawInviteUrl.startsWith("https://")
        ? rawInviteUrl
        : rawInviteUrl.length > 0
          ? rawInviteUrl.startsWith("/")
            ? rawInviteUrl
            : `/${rawInviteUrl}`
          : `/workbook/invite/${encodeURIComponent(invite.token)}`;
      const absoluteInviteUrl =
        invitePath.startsWith("http://") || invitePath.startsWith("https://")
          ? invitePath
          : new URL(invitePath, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteInviteUrl);
      setError(null);
    } catch {
      setError("Не удалось скопировать ссылку приглашения.");
    } finally {
      setCopyingInviteLink(false);
    }
  }, [sessionId]);

  const handleMenuClearBoard = useCallback(async () => {
    if (!canClear || isEnded) return;
    setMenuAnchor(null);
    const confirmed = window.confirm("Очистить доску целиком?");
    if (!confirmed) return;
    try {
      await clearLayerNow("board");
      setError(null);
    } catch {
      setError("Не удалось очистить доску.");
    }
  }, [canClear, clearLayerNow, isEnded]);

  const updateParticipantPermissions = useCallback(
    async (
      targetUserId: string,
      patch: Partial<WorkbookSessionParticipant["permissions"]>
    ) => {
      if (!canManageSession) return;
      try {
        await appendEventsAndApply([
          {
            type: "permissions.update",
            payload: {
              userId: targetUserId,
              permissions: patch,
            },
          },
        ]);
      } catch {
        setError("Не удалось обновить права участника.");
      }
    },
    [appendEventsAndApply, canManageSession]
  );

  const handleToggleParticipantBoardTools = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, {
        canDraw: enabled,
        canAnnotate: enabled,
        canSelect: enabled,
        canDelete: enabled,
        canInsertImage: enabled,
        canClear: enabled,
        canUseLaser: enabled,
      });
    },
    [updateParticipantPermissions]
  );

  const handleToggleParticipantChat = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, { canUseChat: enabled });
    },
    [updateParticipantPermissions]
  );

  const handleToggleParticipantMic = useCallback(
    async (participant: WorkbookSessionParticipant, enabled: boolean) => {
      if (participant.roleInSession !== "student") return;
      await updateParticipantPermissions(participant.userId, { canUseMedia: enabled });
    },
    [updateParticipantPermissions]
  );

  const handleSendSessionChatMessage = useCallback(async () => {
    if (!sessionId || !user?.id || !canSendSessionChat) return;
    const text = sessionChatDraft.trim();
    if (!text) return;
    const authorName =
      actorParticipant?.displayName ||
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      "Участник";
    const message: WorkbookChatMessage = {
      id: generateId(),
      authorUserId: user.id,
      authorName,
      text: text.slice(0, 1000),
      createdAt: new Date().toISOString(),
    };
    setChatMessages((current) =>
      current.some((item) => item.id === message.id) ? current : [...current, message]
    );
    setSessionChatDraft("");
    setIsSessionChatEmojiOpen(false);
    setIsSessionChatAtBottom(true);
    scrollSessionChatToLatest("smooth");
    markSessionChatReadToLatest();
    try {
      await appendEventsAndApply([
        {
          type: "chat.message",
          payload: { message },
        },
      ]);
    } catch {
      setChatMessages((current) =>
        current.filter((item) => item.id !== message.id)
      );
      setSessionChatDraft(text);
      setError("Не удалось отправить сообщение в чат.");
    }
  }, [
    actorParticipant?.displayName,
    appendEventsAndApply,
    canSendSessionChat,
    markSessionChatReadToLatest,
    scrollSessionChatToLatest,
    sessionChatDraft,
    sessionId,
    user?.firstName,
    user?.id,
    user?.lastName,
  ]);

  const handleClearSessionChat = useCallback(async () => {
    if (!canManageSession || chatMessages.length === 0) return;
    const previous = chatMessages;
    setChatMessages([]);
    try {
      await appendEventsAndApply([
        {
          type: "chat.clear",
          payload: {},
        },
      ]);
    } catch {
      setChatMessages(previous);
      setError("Не удалось очистить чат.");
    }
  }, [appendEventsAndApply, canManageSession, chatMessages]);

  const handleSessionChatDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isCompactViewport || isSessionChatMinimized || isSessionChatMaximized) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button")) return;
      const panel = sessionChatRef.current;
      if (!panel) return;
      const offsetX = event.clientX - panel.getBoundingClientRect().left;
      const offsetY = event.clientY - panel.getBoundingClientRect().top;
      sessionChatDragStateRef.current = {
        pointerId: event.pointerId,
        offsetX,
        offsetY,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [isCompactViewport, isSessionChatMaximized, isSessionChatMinimized]
  );

  const updateDocumentState = async (patch: Partial<WorkbookDocumentState>) => {
    try {
      await appendEventsAndApply([
        {
          type: "document.state.update",
          payload: patch,
        },
      ]);
    } catch {
      setError("Не удалось обновить окно документов.");
    }
  };

  const syncUploadedDocumentAsset = async (
    assetId: string,
    asset: WorkbookDocumentAsset
  ) => {
    await appendEventsAndApply([
      {
        type: "document.asset.add",
        payload: { asset },
      },
      {
        type: "document.state.update",
        payload: {
          activeAssetId: assetId,
          page: 1,
        },
      },
    ]);
  };

  const handleDocsUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canInsertImage) return;
    event.target.value = "";
    try {
      setUploadingDoc(true);
      setUploadProgress(20);
      let renderedPages: WorkbookDocumentAsset["renderedPages"] = undefined;
      const isPdf = isPdfUploadFile(file);
      const isImage = isImageUploadFile(file);
      if (!isPdf && !isImage) {
        setError(
          "Не удалось добавить файл: поддерживаются PDF и изображения (PNG, JPG, WEBP, SVG, AVIF, TIFF и другие)."
        );
        return;
      }
      if (isPdf && file.size > WORKBOOK_PDF_IMPORT_MAX_BYTES) {
        setError(
          `Не удалось добавить PDF: размер файла ${formatFileSizeMb(file.size)} превышает лимит ${formatFileSizeMb(
            WORKBOOK_PDF_IMPORT_MAX_BYTES
          )}.`
        );
        return;
      }
      if (isImage && file.size > WORKBOOK_IMAGE_IMPORT_MAX_BYTES) {
        setError(
          `Не удалось добавить изображение: размер файла ${formatFileSizeMb(
            file.size
          )} превышает лимит ${formatFileSizeMb(WORKBOOK_IMAGE_IMPORT_MAX_BYTES)}.`
        );
        return;
      }
      const sourceDataUrl = await readFileAsDataUrl(file);
      const documentAssetUrl = isImage
        ? await optimizeImageDataUrl(sourceDataUrl, {
            maxEdge: 1_080,
            quality: 0.68,
            maxChars: WORKBOOK_DOCUMENT_IMAGE_MAX_DATA_URL_CHARS,
          })
        : sourceDataUrl;
      if (isPdf) {
        setUploadProgress(45);
        const rendered = await renderWorkbookPdfPages({
          fileName: file.name,
          dataUrl: documentAssetUrl,
          dpi: 128,
          maxPages: 8,
        });
        renderedPages = rendered.pages.slice(0, 8);
        if (!renderedPages.length) {
          setError(
            "Не удалось добавить PDF: документ не удалось обработать. Проверьте файл или загрузите другую версию."
          );
          return;
        }
      }
      setUploadProgress(68);
      const insertPosition = resolveWorkbookBoardInsertPosition(
        canvasViewport,
        boardObjects.length
      );
      const renderedPage = isPdf
        ? resolvePrimaryDocumentRenderedPage(renderedPages, 1)
        : null;
      const objectImageUrl =
        isImage
          ? await optimizeImageDataUrl(documentAssetUrl, {
              maxEdge: 820,
              quality: 0.58,
              maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
            })
          : renderedPage?.imageUrl
            ? await optimizeImageDataUrl(renderedPage.imageUrl, {
                maxEdge: 820,
                quality: 0.58,
                maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
              })
            : undefined;
      if (isImage && !objectImageUrl) {
        setError(
          "Не удалось добавить изображение: браузер не смог обработать файл. Попробуйте другой формат или меньший размер."
        );
        return;
      }
      const assetId = generateId();
      const uploadedAt = new Date().toISOString();
      const asset = buildWorkbookDocumentAsset({
        assetId,
        fileName: file.name,
        type: isPdf ? "pdf" : isImage ? "image" : "file",
        url: documentAssetUrl,
        uploadedBy: user?.id ?? "unknown",
        uploadedAt,
        renderedPages,
      });
      const syncedAsset = buildWorkbookSyncedDocumentAsset({
        asset,
        syncedUrl: isImage ? documentAssetUrl : objectImageUrl || "data:,",
        renderedPage,
        imageUrl: objectImageUrl,
      });
      const object = buildWorkbookDocumentBoardObject({
        objectId: generateId(),
        assetId,
        fileName: file.name,
        authorUserId: user?.id ?? "unknown",
        createdAt: uploadedAt,
        insertPosition,
        imageUrl: objectImageUrl,
        renderedPage,
        type: isPdf ? "pdf" : isImage ? "image" : "file",
      });
      const created = await commitObjectCreate(object);
      if (!created) return;
      try {
        await syncUploadedDocumentAsset(assetId, syncedAsset);
      } catch {
        setError(
          "Изображение добавлено на доску, но не удалось синхронизировать его в окне документов."
        );
      }
      void upsertLibraryItem({
        id: generateId(),
        name: file.name,
        type: isPdf ? "pdf" : isImage ? "image" : "office",
        ownerUserId: user?.id ?? "unknown",
        sourceUrl: isImage ? documentAssetUrl : objectImageUrl ?? documentAssetUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        folderId: null,
      });
      setUploadProgress(100);
    } catch (error) {
      if (error instanceof ApiError && error.status === 413) {
        setError(
          "Не удалось добавить файл: объём слишком большой для обработки. Уменьшите размер файла и повторите попытку."
        );
      } else if (error instanceof ApiError && error.status === 503) {
        setError(
          "Не удалось обработать PDF на сервере. Попробуйте позже или загрузите изображение."
        );
      } else if (
        error instanceof Error &&
        (error.message === "image_decode_failed" || error.message === "read_failed")
      ) {
        setError(
          "Не удалось прочитать файл. Проверьте целостность файла или выберите другое расширение."
        );
      } else {
        setError(
          "Импорт завершился с ошибкой. Проверьте формат/размер файла и повторите попытку."
        );
      }
    } finally {
      setUploadingDoc(false);
      setUploadProgress(0);
    }
  };

  const handleDocumentSnapshotToBoard = async () => {
    const active = documentState.assets.find(
      (asset) => asset.id === documentState.activeAssetId
    );
    if (!active) return;
    const insertPosition = resolveWorkbookBoardInsertPosition(
      canvasViewport,
      boardObjects.length
    );
    const renderedPage =
      active.type === "pdf"
        ? resolvePrimaryDocumentRenderedPage(active.renderedPages, documentState.page)
        : null;
    const snapshotImageUrl =
      active.type === "image"
        ? await optimizeImageDataUrl(active.url, {
            maxEdge: 820,
            quality: 0.58,
            maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
          })
        : renderedPage
          ? await optimizeImageDataUrl(renderedPage.imageUrl, {
              maxEdge: 820,
              quality: 0.58,
              maxChars: WORKBOOK_BOARD_IMAGE_MAX_DATA_URL_CHARS,
            })
          : undefined;
    const object = buildWorkbookSnapshotBoardObject({
      objectId: generateId(),
      asset: active,
      page: documentState.page,
      authorUserId: user?.id ?? "unknown",
      createdAt: new Date().toISOString(),
      insertPosition,
      imageUrl: snapshotImageUrl,
    });
    await commitObjectCreate(object);
  };

  const handleAddDocumentAnnotation = async () => {
    if (!documentState.activeAssetId) return;
    try {
      await appendEventsAndApply([
        {
          type: "document.annotation.add",
          payload: {
            annotation: {
              id: generateId(),
              page: documentState.page,
              color: "#ff8e3c",
              width: 3,
              points: [
                { x: 24, y: 24 },
                { x: 190, y: 24 },
              ],
              authorUserId: user?.id ?? "unknown",
              createdAt: new Date().toISOString(),
            },
          },
        },
      ]);
    } catch {
      setError("Не удалось добавить пометку.");
    }
  };

  const handleClearDocumentAnnotations = async () => {
    try {
      await appendEventsAndApply([{ type: "document.annotation.clear", payload: {} }]);
    } catch {
      setError("Не удалось очистить пометки документа.");
    }
  };

  const updateDocumentStateRef = useRef(updateDocumentState);
  updateDocumentStateRef.current = updateDocumentState;

  const handleDocumentSnapshotToBoardRef = useRef(handleDocumentSnapshotToBoard);
  handleDocumentSnapshotToBoardRef.current = handleDocumentSnapshotToBoard;

  const handleAddDocumentAnnotationRef = useRef(handleAddDocumentAnnotation);
  handleAddDocumentAnnotationRef.current = handleAddDocumentAnnotation;

  const handleClearDocumentAnnotationsRef = useRef(handleClearDocumentAnnotations);
  handleClearDocumentAnnotationsRef.current = handleClearDocumentAnnotations;

  const handleDocsWindowTogglePinned = useCallback(() => {
    setDocsWindow((current) => ({ ...current, pinned: !current.pinned }));
  }, []);

  const handleDocsWindowToggleMaximized = useCallback(() => {
    setDocsWindow((current) => ({ ...current, maximized: !current.maximized }));
  }, []);

  const handleDocsWindowClose = useCallback(() => {
    setDocsWindow((current) => ({ ...current, open: false }));
  }, []);

  const handleDocsWindowRequestUpload = useCallback(() => {
    docsInputRef.current?.click();
  }, []);

  const handleDocsWindowSnapshotToBoard = useCallback(() => {
    void handleDocumentSnapshotToBoardRef.current();
  }, []);

  const handleDocsWindowAddAnnotation = useCallback(() => {
    void handleAddDocumentAnnotationRef.current();
  }, []);

  const handleDocsWindowClearAnnotations = useCallback(() => {
    void handleClearDocumentAnnotationsRef.current();
  }, []);

  const handleDocsWindowSelectAsset = useCallback((assetId: string) => {
    void updateDocumentStateRef.current({ activeAssetId: assetId });
  }, []);

  const handleDocsWindowPageChange = useCallback((page: number) => {
    void updateDocumentStateRef.current({ page });
  }, []);

  const handleDocsWindowZoomChange = useCallback((zoom: number) => {
    void updateDocumentStateRef.current({ zoom });
  }, []);

  const dissolveCompositionLayerRef = useRef(dissolveCompositionLayer);
  dissolveCompositionLayerRef.current = dissolveCompositionLayer;

  const removeObjectFromCompositionRef = useRef(removeObjectFromComposition);
  removeObjectFromCompositionRef.current = removeObjectFromComposition;

  const handleLayersPanelDissolveLayer = useCallback((layerId: string) => {
    void dissolveCompositionLayerRef.current(layerId);
  }, []);

  const handleLayersPanelRemoveObject = useCallback((objectId: string, layerId: string) => {
    void removeObjectFromCompositionRef.current(objectId, layerId);
  }, []);

  const handleGraphPanelCreatePlane = useCallback(() => {
    void createFunctionGraphPlane();
  }, [createFunctionGraphPlane]);

  const handleGraphPanelSelectPlane = useCallback((planeId: string) => {
    setSelectedObjectId(planeId);
    resetToolRuntimeToSelect();
  }, [resetToolRuntimeToSelect]);

  const handleGraphPanelAxisColorChange = useCallback(
    (color: string) => {
      updateSelectedFunctionGraphAppearance({ axisColor: color });
    },
    [updateSelectedFunctionGraphAppearance]
  );

  const handleGraphPanelPlaneColorChange = useCallback(
    (color: string) => {
      updateSelectedFunctionGraphAppearance({ planeColor: color });
    },
    [updateSelectedFunctionGraphAppearance]
  );

  const handleGraphPanelClearPlaneBackground = useCallback(() => {
    updateSelectedFunctionGraphAppearance({ planeColor: "transparent" });
  }, [updateSelectedFunctionGraphAppearance]);

  const handleGraphPanelSelectCatalogTab = useCallback(() => {
    setGraphWorkbenchTab("catalog");
  }, []);

  const handleGraphPanelSelectWorkTab = useCallback(() => {
    setGraphWorkbenchTab("work");
  }, []);

  const handleGraphPanelExpressionDraftChange = useCallback((value: string) => {
    setGraphExpressionDraft(value);
    setSelectedGraphPresetId(null);
    setGraphDraftError((current) => (current ? null : current));
  }, []);

  const handleGraphPanelAddFunction = useCallback(() => {
    setSelectedGraphPresetId(null);
    appendSelectedGraphFunction();
  }, [appendSelectedGraphFunction]);

  const handleGraphPanelSelectPreset = useCallback(
    (presetId: string, expression: string) => {
      setSelectedGraphPresetId(presetId);
      activateGraphCatalogCursor();
      appendSelectedGraphFunction(expression);
    },
    [activateGraphCatalogCursor, appendSelectedGraphFunction]
  );

  const handleGraphPanelFunctionColorChange = useCallback(
    (id: string, color: string) => {
      updateSelectedGraphFunction(id, { color });
    },
    [updateSelectedGraphFunction]
  );

  const handleGraphPanelFunctionExpressionChange = useCallback(
    (id: string, value: string) => {
      normalizeGraphExpressionDraft(id, value, true);
    },
    [normalizeGraphExpressionDraft]
  );

  const handleGraphPanelCommitExpressions = useCallback(() => {
    commitSelectedGraphExpressions();
  }, [commitSelectedGraphExpressions]);

  const handleGraphPanelRemoveFunction = useCallback(
    (id: string) => {
      removeSelectedGraphFunction(id);
    },
    [removeSelectedGraphFunction]
  );

  const handleGraphPanelToggleVisibility = useCallback(
    (id: string, visible: boolean) => {
      updateSelectedGraphFunction(id, { visible });
    },
    [updateSelectedGraphFunction]
  );

  const handleGraphPanelReflectFunction = useCallback(
    (id: string, axis: "x" | "y") => {
      reflectGraphFunctionByAxis(id, axis);
    },
    [reflectGraphFunctionByAxis]
  );

  const waitForCanvasRender = useCallback(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      }),
    []
  );

  const switchBoardPageForExport = useCallback(
    async (targetPage: number) => {
      const safePage = Math.max(1, Math.floor(targetPage));
      if ((boardSettingsRef.current.currentPage ?? 1) === safePage) {
        await waitForCanvasRender();
        return;
      }
      setBoardSettings((state) => ({
        ...state,
        currentPage: safePage,
      }));
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      await new Promise<void>((resolve) => {
        const poll = () => {
          const now = typeof performance !== "undefined" ? performance.now() : Date.now();
          const current = boardSettingsRef.current.currentPage ?? 1;
          if (current === safePage || now - startedAt > 900) {
            resolve();
            return;
          }
          window.requestAnimationFrame(poll);
        };
        window.requestAnimationFrame(poll);
      });
      await waitForCanvasRender();
    },
    [waitForCanvasRender]
  );

  const resolveExportPageNumbers = useCallback((): number[] => {
    const maxReferencedPage = Math.max(
      1,
      boardSettings.pagesCount || 1,
      ...boardObjects.map((object) => Math.max(1, object.page ?? 1)),
      ...boardStrokes.map((stroke) => Math.max(1, stroke.page ?? 1))
    );
    const contentPages = new Set<number>();

    boardObjects.forEach((object) => {
      contentPages.add(Math.max(1, object.page ?? 1));
    });

    boardStrokes.forEach((stroke) => {
      if (!getStrokeExportBounds(stroke)) return;
      contentPages.add(Math.max(1, stroke.page ?? 1));
    });

    if (contentPages.size === 0) {
      return [Math.max(1, boardSettings.currentPage || 1)];
    }

    return Array.from(contentPages)
      .filter((page) => page >= 1 && page <= maxReferencedPage)
      .sort((left, right) => left - right);
  }, [boardObjects, boardSettings.currentPage, boardSettings.pagesCount, boardStrokes]);

  const resolvePageExportBounds = useCallback(
    (pageNumber: number): WorkbookExportBounds | null => {
      const safePage = Math.max(1, Math.floor(pageNumber));
      const objectBounds = boardObjects
        .filter((object) => Math.max(1, object.page ?? 1) === safePage)
        .map((object) => getObjectExportBounds(object));
      const strokeBounds = boardStrokes
        .filter((stroke) => Math.max(1, stroke.page ?? 1) === safePage)
        .map((stroke) => getStrokeExportBounds(stroke));
      const merged = mergeExportBounds([...objectBounds, ...strokeBounds]);
      if (!merged) return null;
      const basePadding = Math.max(
        40,
        Math.round(
          Math.max(
            boardSettings.gridSize || 0,
            boardSettings.dividerStep ? boardSettings.dividerStep * 0.045 : 0
          )
        )
      );
      return padExportBounds(merged, basePadding);
    },
    [boardObjects, boardSettings.dividerStep, boardSettings.gridSize, boardStrokes]
  );

  const renderBoardToCanvas = async (
    scale = 2,
    options?: { bounds?: WorkbookExportBounds | null }
  ) => {
    const svg = document.querySelector<SVGSVGElement>(".workbook-session__canvas-svg");
    if (!svg) return null;
    const bounds = options?.bounds ?? null;
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    if (bounds) {
      svgClone.setAttribute(
        "viewBox",
        `${bounds.minX} ${bounds.minY} ${Math.max(1, bounds.width)} ${Math.max(
          1,
          bounds.height
        )}`
      );
      svgClone.setAttribute("width", `${Math.max(1, bounds.width)}`);
      svgClone.setAttribute("height", `${Math.max(1, bounds.height)}`);
      const scaleGroup = Array.from(svgClone.children).find(
        (node) => node.tagName.toLowerCase() === "g"
      );
      if (scaleGroup) {
        scaleGroup.setAttribute("transform", "scale(1)");
        const translateGroup = Array.from(scaleGroup.children).find((node) => {
          if (node.tagName.toLowerCase() !== "g") return false;
          const transform = node.getAttribute("transform");
          return typeof transform === "string" && transform.startsWith("translate(");
        });
        if (translateGroup) {
          translateGroup.setAttribute("transform", "translate(0 0)");
        }
      }
    }
    const serialized = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const decodedImage = await (async () => {
        if (typeof createImageBitmap === "function") {
          try {
            const bitmap = await createImageBitmap(blob);
            return {
              source: bitmap as CanvasImageSource,
              release: () => bitmap.close(),
            };
          } catch {
            // Fall through to HTMLImageElement decoding below.
          }
        }
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const next = new Image();
          next.onload = () => resolve(next);
          next.onerror = () => reject(new Error("image_load_failed"));
          next.src = url;
        });
        return {
          source: image as CanvasImageSource,
          release: undefined as (() => void) | undefined,
        };
      })();
      const widthSource = bounds?.width ?? svg.viewBox.baseVal.width ?? 1600;
      const heightSource = bounds?.height ?? svg.viewBox.baseVal.height ?? 900;
      const width = Math.max(1, Math.round(widthSource));
      const height = Math.max(1, Math.round(heightSource));
      const requestedScale = Math.max(1, Math.min(4, scale));
      const safeScale = Math.min(
        requestedScale,
        MAX_EXPORT_CANVAS_SIDE / width,
        MAX_EXPORT_CANVAS_SIDE / height
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * safeScale));
      canvas.height = Math.max(1, Math.round(height * safeScale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.save();
      ctx.scale(safeScale, safeScale);
      ctx.fillStyle = boardSettings.backgroundColor || "#f5f7ff";
      ctx.fillRect(0, 0, width, height);
      if (boardSettings.showGrid) {
        const gridStep = Math.max(8, Math.min(96, Math.floor(boardSettings.gridSize || 22)));
        ctx.strokeStyle = boardSettings.gridColor || "rgba(92, 129, 192, 0.32)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const minGridX = bounds ? Math.floor(bounds.minX / gridStep) * gridStep : 0;
        const maxGridX = bounds ? bounds.maxX : width;
        for (let x = minGridX; x <= maxGridX; x += gridStep) {
          const relativeX = bounds ? x - bounds.minX : x;
          const crispX = Math.round(relativeX) + 0.5;
          ctx.moveTo(crispX, 0);
          ctx.lineTo(crispX, height);
        }
        const minGridY = bounds ? Math.floor(bounds.minY / gridStep) * gridStep : 0;
        const maxGridY = bounds ? bounds.maxY : height;
        for (let y = minGridY; y <= maxGridY; y += gridStep) {
          const relativeY = bounds ? y - bounds.minY : y;
          const crispY = Math.round(relativeY) + 0.5;
          ctx.moveTo(0, crispY);
          ctx.lineTo(width, crispY);
        }
        ctx.stroke();
      }
      ctx.drawImage(decodedImage.source, 0, 0, width, height);
      ctx.restore();
      decodedImage.release?.();
      return { canvas, width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const resolveExportFileBaseName = useCallback(() => {
    const fallback = `workbook-${sessionId || "session"}`;
    const source = session?.title?.trim() || fallback;
    const cleaned = source
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");
    return cleaned || fallback;
  }, [session?.title, sessionId]);

  const requestExportFileName = useCallback(
    (extension: "pdf") => {
      const fallback = resolveExportFileBaseName();
      if (typeof window === "undefined") {
        return `${fallback}.${extension}`;
      }
      const entered = window.prompt(
        `Введите имя файла (${extension.toUpperCase()})`,
        fallback
      );
      if (entered === null) return null;
      const normalized = entered
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .replace(new RegExp(`\\.${extension}$`, "i"), "")
        .replace(/[. ]+$/g, "");
      const base = normalized || fallback;
      return `${base}.${extension}`;
    },
    [resolveExportFileBaseName]
  );

  const exportBoardAsPdf = async () => {
    if (exportingSections) return;
    setExportingSections(true);
    const currentPage = Math.max(1, boardSettings.currentPage || 1);
    let activePage = currentPage;
    try {
      const fileName = requestExportFileName("pdf");
      if (!fileName) return;
      const exportPages = resolveExportPageNumbers();
      const previousPage = currentPage;
      const rawPageBounds = exportPages.map((pageNumber) => ({
        page: pageNumber,
        bounds: resolvePageExportBounds(pageNumber),
      }));
      const { canonicalSize, fittedBoundsByPage } =
        resolveWorkbookPdfExportPlan(rawPageBounds);
      const renderedPages: Array<{ page: number; width: number; height: number; dataUrl: string }> =
        [];
      for (const pageNumber of exportPages) {
        if (pageNumber !== activePage) {
          await switchBoardPageForExport(pageNumber);
          activePage = pageNumber;
        } else {
          await waitForCanvasRender();
        }
        const rendered = await renderBoardToCanvas(2.2, {
          bounds: fittedBoundsByPage.get(pageNumber) ?? null,
        });
        if (!rendered) continue;
        renderedPages.push({
          page: pageNumber,
          width: Math.max(1, Math.round(rendered.width)),
          height: Math.max(1, Math.round(rendered.height)),
          dataUrl: rendered.canvas.toDataURL("image/png"),
        });
      }
      if (previousPage !== activePage) {
        await switchBoardPageForExport(previousPage);
        activePage = previousPage;
      }
      if (renderedPages.length === 0) {
        setError("Не удалось подготовить страницы для PDF.");
        return;
      }
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const { offsetX, offsetY, drawWidth, drawHeight } = resolvePdfPagePlacement({
        pageWidth,
        pageHeight,
        canonicalWidth: canonicalSize.width,
        canonicalHeight: canonicalSize.height,
        margin: 30,
      });
      renderedPages.forEach((page, index) => {
        if (index > 0) {
          pdf.addPage("a4", "portrait");
        }
        pdf.addImage(page.dataUrl, "PNG", offsetX, offsetY, drawWidth, drawHeight);
      });
      pdf.save(fileName);
    } catch {
      setError("Не удалось экспортировать PDF.");
    } finally {
      if (activePage !== currentPage) {
        setBoardSettings((state) => ({
          ...state,
          currentPage,
        }));
        activePage = currentPage;
      }
      setExportingSections(false);
    }
  };

  const handleLoadBoardFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeScenePayload(parsed);
      setBoardStrokes(normalized.strokes.filter((stroke) => stroke.layer === "board"));
      setBoardObjects(normalized.objects);
      setConstraints(normalized.constraints);
      setChatMessages(normalized.chat);
      setComments(normalized.comments);
      setTimerState(normalized.timer);
      setBoardSettings(() => {
        const normalizedLayers = normalizeSceneLayersForBoard(
          normalized.boardSettings.sceneLayers,
          normalized.boardSettings.activeSceneLayerId
        );
        return {
          ...DEFAULT_BOARD_SETTINGS,
          ...normalized.boardSettings,
          ...normalizedLayers,
        };
      });
      setLibraryState({
        ...DEFAULT_LIBRARY,
        ...normalized.library,
      });
      setDocumentState(normalized.document);
      await persistSnapshots();
    } catch {
      setError("Не удалось открыть файл рабочей тетради.");
    }
  };

  const commitStrokeRef = useRef(commitStroke);
  commitStrokeRef.current = commitStroke;

  const commitStrokeDeleteRef = useRef(commitStrokeDelete);
  commitStrokeDeleteRef.current = commitStrokeDelete;

  const commitStrokeReplaceRef = useRef(commitStrokeReplace);
  commitStrokeReplaceRef.current = commitStrokeReplace;

  const handleCanvasObjectUpdate = useCallback(
    (
      objectId: string,
      patch: Partial<WorkbookBoardObject>,
      options?: { trackHistory?: boolean; markDirty?: boolean }
    ) => {
      void commitObjectUpdate(objectId, patch, options);
    },
    [commitObjectUpdate]
  );

  const commitObjectDeleteRef = useRef(commitObjectDelete);
  commitObjectDeleteRef.current = commitObjectDelete;

  const handleCanvasStrokeCommit = useCallback((stroke: WorkbookStroke) => {
    void commitStrokeRef.current(stroke);
  }, []);

  const handleCanvasStrokeDelete = useCallback((strokeId: string, targetLayer: WorkbookLayer) => {
    void commitStrokeDeleteRef.current(strokeId, targetLayer);
  }, []);

  const handleCanvasStrokeReplace = useCallback(
    (payload: Parameters<typeof commitStrokeReplace>[0]) => {
      void commitStrokeReplaceRef.current(payload);
    },
    []
  );

  const handleCanvasEraserPreview = useCallback(
    (payload: {
      gestureId: string;
      layer: WorkbookLayer;
      page: number;
      radius: number;
      points: WorkbookPoint[];
      ended?: boolean;
    }) => {
      queueEraserPreview(payload);
    },
    [queueEraserPreview]
  );

  const handleCanvasObjectDelete = useCallback((objectId: string) => {
    void commitObjectDeleteRef.current(objectId);
  }, []);

  const handleCanvasAreaSelectionChange = useCallback(
    (selection: WorkbookAreaSelection | null) => {
      setAreaSelection(selection);
      if (!selection || (selection.objectIds.length === 0 && selection.strokeIds.length === 0)) {
        setAreaSelectionContextMenu(null);
      }
    },
    []
  );

  const handleCanvasAreaSelectionContextMenu = useCallback(
    (payload: {
      objectIds: string[];
      strokeIds: Array<{ id: string; layer: WorkbookLayer }>;
      rect: { x: number; y: number; width: number; height: number };
      anchor: { x: number; y: number };
    }) => {
      setAreaSelection({
        objectIds: payload.objectIds,
        strokeIds: payload.strokeIds,
        rect: payload.rect,
      });
      setAreaSelectionContextMenu({
        x: payload.anchor.x,
        y: payload.anchor.y,
      });
    },
    []
  );

  const handleCanvasInlineTextDraftChange = useCallback(
    (objectId: string, value: string) => {
      const selectedTextTarget = boardObjects.find((item) => item.id === objectId) ?? null;
      if (!selectedTextTarget || selectedTextTarget.type !== "text") return;
      setSelectedTextDraft((current) => (current === value ? current : value));
      scheduleSelectedTextDraftCommit(value);
    },
    [boardObjects, scheduleSelectedTextDraftCommit]
  );

  const handleCanvasRequestSelectTool = useCallback(() => {
    resetToolRuntimeToSelect();
  }, [resetToolRuntimeToSelect]);

  const handleCanvasLaserPoint = useCallback((point: WorkbookPoint) => {
    void handleLaserPoint(point);
  }, [handleLaserPoint]);

  const handleCanvasLaserClear = useCallback(() => {
    void clearLaserPointer();
  }, [clearLaserPointer]);

  const handleToggleSessionChat = useCallback(() => {
    if (isSessionChatOpen) {
      setIsSessionChatOpen(false);
      setIsSessionChatEmojiOpen(false);
      return;
    }
    sessionChatShouldScrollToUnreadRef.current = true;
    setIsSessionChatAtBottom(false);
    setIsSessionChatOpen(true);
    setIsSessionChatMinimized(false);
  }, [isSessionChatOpen]);

  const handleCollapseParticipants = useCallback(() => {
    setIsParticipantsCollapsed(true);
  }, []);

  const handleToggleOwnMic = useCallback(() => {
    setMicEnabled((current) => !current);
  }, [setMicEnabled]);

  const toolButtons: Array<{ tool: WorkbookTool; label: string; icon: ReactNode }> = [
    { tool: "select", label: "Выбор", icon: <AdsClickRoundedIcon /> },
    { tool: "pan", label: "Рука", icon: <PanToolRoundedIcon /> },
    { tool: "pen", label: "Ручка", icon: <CreateRoundedIcon /> },
    { tool: "highlighter", label: "Маркер", icon: <BorderColorRoundedIcon /> },
    { tool: "line", label: "Линия", icon: <HorizontalRuleRoundedIcon /> },
    { tool: "function_graph", label: "График функции", icon: <ShowChartRoundedIcon /> },
    { tool: "point", label: "Точка", icon: <FiberManualRecordRoundedIcon /> },
    { tool: "area_select", label: "Ножницы", icon: <ContentCutRoundedIcon /> },
    { tool: "text", label: "Текст", icon: <TextFieldsRoundedIcon /> },
    { tool: "divider", label: "Разделитель", icon: <DragHandleRoundedIcon /> },
    { tool: "eraser", label: "Ластик", icon: <CleaningServicesRoundedIcon /> },
    { tool: "laser", label: "Указка (Esc/ПКМ убрать)", icon: <MyLocationRoundedIcon /> },
    { tool: "sweep", label: "Метёлка", icon: <DeleteSweepRoundedIcon /> },
  ];
  const pointToolIndex = toolButtons.findIndex((item) => item.tool === "point");
  const toolButtonsBeforeCatalog =
    pointToolIndex >= 0 ? toolButtons.slice(0, pointToolIndex + 1) : toolButtons;
  const toolButtonsAfterCatalog =
    pointToolIndex >= 0 ? toolButtons.slice(pointToolIndex + 1) : [];
  const renderToolButton = (item: {
    tool: WorkbookTool;
    label: string;
    icon: ReactNode;
  }) => {
    const isActive = tool === item.tool;
    const isDisabled =
      (item.tool === "select" && !canSelect) ||
      (item.tool === "area_select" && !canSelect) ||
      (item.tool === "eraser" && !canDelete) ||
      (item.tool === "sweep" && !canDelete) ||
      (item.tool === "laser" && !canUseLaser) ||
      (!canDraw &&
        item.tool !== "select" &&
        item.tool !== "area_select" &&
        item.tool !== "pan" &&
        item.tool !== "eraser" &&
        item.tool !== "laser" &&
        item.tool !== "sweep");
    return (
      <Tooltip key={item.tool} title={item.label} placement="left" arrow>
        <span>
          <button
            type="button"
            className={`workbook-session__tool-btn ${isActive ? "is-active" : ""}`}
            disabled={isDisabled}
            onClick={() => {
              if (item.tool === "function_graph") {
                if (tool === "function_graph") {
                  resetToolRuntimeToSelect();
                  return;
                }
                void createFunctionGraphPlane();
                return;
              }
              if (
                (item.tool === "sweep" && tool === "sweep") ||
                (item.tool === "area_select" && tool === "area_select") ||
                (item.tool === "eraser" && tool === "eraser")
              ) {
                resetToolRuntimeToSelect();
                return;
              }
              activateTool(item.tool);
            }}
            aria-label={item.label}
            title={item.label}
          >
            {item.icon}
          </button>
        </span>
      </Tooltip>
    );
  };

  const shapeCatalog: Array<{
    id: string;
    title: string;
    subtitle: string;
    icon: ReactNode;
    tool: WorkbookTool;
    apply: () => void;
  }> = [
    {
      id: "rectangle",
      title: "Прямоугольник",
      subtitle: "4 стороны",
      icon: <ShapeCatalogPreview variant="rectangle" />,
      tool: "rectangle",
      apply: () => setTool("rectangle"),
    },
    {
      id: "ellipse",
      title: "Эллипс",
      subtitle: "Окружность / овал",
      icon: <ShapeCatalogPreview variant="ellipse" />,
      tool: "ellipse",
      apply: () => setTool("ellipse"),
    },
    {
      id: "triangle",
      title: "Треугольник",
      subtitle: "3 стороны",
      icon: <ShapeCatalogPreview variant="polygon" sides={3} />,
      tool: "triangle",
      apply: () => setTool("triangle"),
    },
    {
      id: "trapezoid",
      title: "Трапеция",
      subtitle: "4 стороны",
      icon: <ShapeCatalogPreview variant="trapezoid" />,
      tool: "polygon",
      apply: () => {
        setPolygonMode("regular");
        setPolygonPreset("trapezoid");
        setPolygonSides(4);
        setTool("polygon");
      },
    },
    {
      id: "trapezoid-right",
      title: "Прямоугольная трапеция",
      subtitle: "Прямой угол",
      icon: <ShapeCatalogPreview variant="trapezoid_right" />,
      tool: "polygon",
      apply: () => {
        setPolygonMode("regular");
        setPolygonPreset("trapezoid_right");
        setPolygonSides(4);
        setTool("polygon");
      },
    },
    {
      id: "trapezoid-scalene",
      title: "Неравнобедренная трапеция",
      subtitle: "Разные боковые стороны",
      icon: <ShapeCatalogPreview variant="trapezoid_scalene" />,
      tool: "polygon",
      apply: () => {
        setPolygonMode("regular");
        setPolygonPreset("trapezoid_scalene");
        setPolygonSides(4);
        setTool("polygon");
      },
    },
    {
      id: "rhombus",
      title: "Ромб",
      subtitle: "Равные стороны",
      icon: <ShapeCatalogPreview variant="rhombus" />,
      tool: "polygon",
      apply: () => {
        setPolygonMode("regular");
        setPolygonPreset("rhombus");
        setPolygonSides(4);
        setTool("polygon");
      },
    },
    {
      id: "polygon-4",
      title: "Квадрат",
      subtitle: "Регулярный 4-угольник",
      icon: <ShapeCatalogPreview variant="polygon" sides={4} />,
      tool: "polygon",
      apply: () => {
        setPolygonMode("regular");
        setPolygonPreset("regular");
        setPolygonSides(4);
        setTool("polygon");
      },
    },
    {
      id: "polygon-5",
      title: "Пятиугольник",
      subtitle: "Регулярный 5-угольник",
      icon: <ShapeCatalogPreview variant="polygon" sides={5} />,
      tool: "polygon",
      apply: () => {
        setPolygonMode("regular");
        setPolygonPreset("regular");
        setPolygonSides(5);
        setTool("polygon");
      },
    },
    {
      id: "polygon-6",
      title: "Шестиугольник",
      subtitle: "Регулярный 6-угольник",
      icon: <ShapeCatalogPreview variant="polygon" sides={6} />,
      tool: "polygon",
      apply: () => {
        setPolygonMode("regular");
        setPolygonPreset("regular");
        setPolygonSides(6);
        setTool("polygon");
      },
    },
  ];

  const hotkeysTooltipContent = (
    <div className="workbook-session__hotkeys-tooltip">
      <strong>Горячие клавиши</strong>
      <ul>
        <li>`Ctrl/Cmd + Z` — отмена действия</li>
        <li>`Ctrl/Cmd + Shift + Z` — повтор действия</li>
        <li>`Del / Backspace` — удалить выбранный объект</li>
        <li>`Shift + Click` — мультивыбор</li>
        <li>`Ctrl/Cmd + C` — копировать выделенную область (Ножницы)</li>
        <li>`Ctrl/Cmd + V` — вставить выделенную область (Ножницы)</li>
        <li>`Ctrl/Cmd + X` — вырезать выделенную область (Ножницы)</li>
        <li>`Space` — временная рука (pan)</li>
        <li>`Esc` — убрать указку (в режиме указки)</li>
      </ul>
    </div>
  );

  const selectedObject = useMemo(
    () => boardObjects.find((item) => item.id === selectedObjectId) ?? null,
    [boardObjects, selectedObjectId]
  );
  const selectedObjectSupportsTransformPanel = useMemo(
    () => supportsTransformUtilityPanel(selectedObject),
    [selectedObject]
  );
  const selectedObjectSupportsGraphPanel = useMemo(
    () => supportsGraphUtilityPanel(selectedObject),
    [selectedObject]
  );
  const isContextualUtilityPanel = useMemo(
    () =>
      !isCompactViewport &&
      isUtilityPanelOpen &&
      ((utilityTab === "graph" && selectedObjectSupportsGraphPanel) ||
        (utilityTab === "transform" && selectedObjectSupportsTransformPanel)),
    [
      isCompactViewport,
      isUtilityPanelOpen,
      selectedObjectSupportsGraphPanel,
      selectedObjectSupportsTransformPanel,
      utilityTab,
    ]
  );

  useEffect(() => {
    if (!isUtilityPanelOpen) return;
    if (utilityTab === "graph" && !selectedObjectSupportsGraphPanel) {
      setIsUtilityPanelOpen(false);
      return;
    }
    if (utilityTab === "transform" && !selectedObjectSupportsTransformPanel) {
      setIsUtilityPanelOpen(false);
    }
  }, [
    isUtilityPanelOpen,
    selectedObjectSupportsGraphPanel,
    selectedObjectSupportsTransformPanel,
    utilityTab,
  ]);

  const handleCanvasSelectedObjectChange = useCallback(
    (nextObjectId: string | null) => {
      const suppressedObjectId = suppressAutoPanelSelectionRef.current;
      if (!nextObjectId) {
        setSelectedObjectId(null);
        return;
      }
      setSelectedObjectId(nextObjectId);
      if (suppressedObjectId === nextObjectId) {
        suppressAutoPanelSelectionRef.current = null;
        return;
      }
      const target = boardObjects.find((item) => item.id === nextObjectId) ?? null;
      if (supportsGraphUtilityPanel(target)) {
        openUtilityPanel("graph", {
          toggle: false,
          anchorObject: target,
        });
        return;
      }
      if (supportsTransformUtilityPanel(target)) {
        openUtilityPanel("transform", {
          toggle: false,
          anchorObject: target,
        });
      }
    },
    [boardObjects, openUtilityPanel]
  );

  const handleCanvasObjectCreate = useCallback(
    (object: WorkbookBoardObject) => {
      suppressAutoPanelSelectionRef.current = object.id;
      void commitObjectCreate(object).catch(() => undefined);
    },
    [commitObjectCreate]
  );

  useEffect(() => {
    if (tool === "area_select") return;
    setAreaSelection(null);
    setAreaSelectionContextMenu(null);
  }, [tool]);

  const selectedObjectLabel = useMemo(() => {
    if (!selectedObject) return "Объект не выбран";
    return getWorkbookObjectTypeLabel(selectedObject);
  }, [selectedObject]);
  const selectedObjectShowLabels = useMemo(
    () => (selectedObject ? selectedObject.meta?.showLabels !== false : true),
    [selectedObject]
  );
  const selectedObjectSceneLayerId = useMemo(
    () => (selectedObject ? getObjectSceneLayerId(selectedObject) : MAIN_SCENE_LAYER_ID),
    [getObjectSceneLayerId, selectedObject]
  );
  const selectedShape2dObject = useMemo(
    () => (is2dFigureObject(selectedObject) ? selectedObject : null),
    [selectedObject]
  );
  const selectedShape2dVertices = useMemo(
    () => (selectedShape2dObject ? resolve2dFigureVertices(selectedShape2dObject) : []),
    [selectedShape2dObject]
  );
  const selectedShape2dLabels = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.vertexLabels)
      ? selectedShape2dObject.meta.vertexLabels
      : [];
    return selectedShape2dVertices.map((_, index) => {
      const value = typeof raw[index] === "string" ? raw[index].trim() : "";
      return value || getFigureVertexLabel(index);
    });
  }, [selectedShape2dObject, selectedShape2dVertices]);
  const selectedShape2dSegments = useMemo(() => {
    if (!selectedShape2dLabels.length) return [] as string[];
    if (!selectedShape2dObject) return [] as string[];
    const closed = is2dFigureClosed(selectedShape2dObject);
    const segmentCount = closed
      ? selectedShape2dLabels.length
      : Math.max(0, selectedShape2dLabels.length - 1);
    return Array.from({ length: segmentCount }, (_, index) => {
      const start = selectedShape2dLabels[index];
      const end = selectedShape2dLabels[(index + 1) % selectedShape2dLabels.length];
      return `${start}-${end}`;
    });
  }, [selectedShape2dLabels, selectedShape2dObject]);
  const selectedShape2dAngleMarks = useMemo(
    () =>
      normalizeShapeAngleMarks(
        selectedShape2dObject,
        selectedShape2dLabels.length,
        selectedShape2dObject?.color || "#4f63ff"
      ),
    [selectedShape2dLabels.length, selectedShape2dObject]
  );
  const selectedShape2dAngleNotes = useMemo(
    () => selectedShape2dAngleMarks.map((mark) => mark.valueText),
    [selectedShape2dAngleMarks]
  );
  const selectedShape2dSegmentNotes = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.segmentNotes)
      ? selectedShape2dObject.meta.segmentNotes
      : [];
    return selectedShape2dSegments.map((_, index) =>
      typeof raw[index] === "string" ? raw[index] : ""
    );
  }, [selectedShape2dObject, selectedShape2dSegments]);
  const selectedShape2dShowAngles = useMemo(
    () => Boolean(selectedShape2dObject?.meta?.showAngles),
    [selectedShape2dObject]
  );
  const selectedShape2dHasAngles = useMemo(
    () =>
      Boolean(
        selectedShape2dObject &&
          is2dFigureClosed(selectedShape2dObject) &&
          selectedShape2dVertices.length >= 3
      ),
    [selectedShape2dObject, selectedShape2dVertices.length]
  );
  const selectedShape2dVertexColors = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.vertexColors)
      ? selectedShape2dObject.meta.vertexColors
      : [];
    const fallback = selectedShape2dObject.color || "#4f63ff";
    return selectedShape2dLabels.map((_, index) =>
      typeof raw[index] === "string" && raw[index] ? raw[index] : fallback
    );
  }, [selectedShape2dLabels, selectedShape2dObject]);
  const selectedShape2dAngleColors = useMemo(
    () => selectedShape2dAngleMarks.map((mark) => mark.color),
    [selectedShape2dAngleMarks]
  );
  const selectedShape2dSegmentColors = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.segmentColors)
      ? selectedShape2dObject.meta.segmentColors
      : [];
    const fallback = selectedShape2dObject.color || "#4f63ff";
    return selectedShape2dSegments.map((_, index) =>
      typeof raw[index] === "string" && raw[index] ? raw[index] : fallback
    );
  }, [selectedShape2dObject, selectedShape2dSegments]);
  useEffect(() => {
    if (selectedObject?.type !== "solid3d") {
      setSolid3dFigureTab("display");
    }
  }, [selectedObject?.id, selectedObject?.type]);

  useEffect(() => {
    if (!selectedShape2dObject) {
      setShape2dInspectorTab("display");
      return;
    }
    if (!selectedShape2dHasAngles && shape2dInspectorTab === "angles") {
      setShape2dInspectorTab("display");
    }
  }, [selectedShape2dHasAngles, selectedShape2dObject, shape2dInspectorTab]);

  useEffect(() => {
    if (!isUtilityPanelOpen) return;
    if (utilityTab === "transform" && !selectedObjectSupportsTransformPanel) {
      setIsUtilityPanelOpen(false);
    }
    if (utilityTab === "graph" && !selectedObjectSupportsGraphPanel) {
      setIsUtilityPanelOpen(false);
    }
  }, [
    isUtilityPanelOpen,
    selectedObjectSupportsGraphPanel,
    selectedObjectSupportsTransformPanel,
    utilityTab,
  ]);

  const selectedLineObject = useMemo(
    () =>
      selectedObject &&
      (selectedObject.type === "line" || selectedObject.type === "arrow")
        ? selectedObject
        : null,
    [selectedObject]
  );
  const selectedFunctionGraphObject = useMemo(
    () => (selectedObject?.type === "function_graph" ? selectedObject : null),
    [selectedObject]
  );
  const selectedDividerObject = useMemo(
    () => (selectedObject?.type === "section_divider" ? selectedObject : null),
    [selectedObject]
  );
  const selectedPointObject = useMemo(
    () => (selectedObject?.type === "point" ? selectedObject : null),
    [selectedObject]
  );
  const pointObjectCount = useMemo(
    () => boardObjects.reduce((count, item) => count + (item.type === "point" ? 1 : 0), 0),
    [boardObjects]
  );
  const selectedTextObject = useMemo(
    () => (selectedObject?.type === "text" ? selectedObject : null),
    [selectedObject]
  );
  const selectedLineStyle = useMemo(
    () =>
      selectedLineObject?.meta?.lineStyle === "dashed" ? "dashed" : "solid",
    [selectedLineObject?.meta?.lineStyle]
  );
  const selectedLineKind = useMemo(
    () =>
      selectedLineObject?.meta?.lineKind === "segment" ? "segment" : "line",
    [selectedLineObject?.meta?.lineKind]
  );
  const canToggleSelectedObjectLabels = useMemo(() => {
    return supportsObjectLabelMarkers(selectedObject);
  }, [selectedObject]);
  const selectedLineColor = useMemo(
    () => selectedLineObject?.color || "#4f63ff",
    [selectedLineObject?.color]
  );
  const selectedLineStrokeWidth = useMemo(
    () => selectedLineObject?.strokeWidth ?? 3,
    [selectedLineObject?.strokeWidth]
  );
  const selectedDividerStyle = useMemo(
    () => (selectedDividerObject?.meta?.lineStyle === "solid" ? "solid" : "dashed"),
    [selectedDividerObject?.meta?.lineStyle]
  );
  const selectedDividerColor = useMemo(
    () => selectedDividerObject?.color || "#4f63ff",
    [selectedDividerObject?.color]
  );
  const selectedDividerStrokeWidth = useMemo(
    () => selectedDividerObject?.strokeWidth ?? 2,
    [selectedDividerObject?.strokeWidth]
  );
  const selectedLineStartLabel = useMemo(
    () =>
      typeof selectedLineObject?.meta?.startLabel === "string"
        ? selectedLineObject.meta.startLabel
        : "",
    [selectedLineObject]
  );
  const selectedLineEndLabel = useMemo(
    () =>
      typeof selectedLineObject?.meta?.endLabel === "string"
        ? selectedLineObject.meta.endLabel
        : "",
    [selectedLineObject]
  );
  const selectedFunctionGraphFunctions = useMemo(
    () =>
      selectedFunctionGraphObject
        ? resolveGraphFunctionsFromObject(selectedFunctionGraphObject)
        : ([] as GraphFunctionDraft[]),
    [selectedFunctionGraphObject]
  );
  const selectedFunctionGraphAxisColor = useMemo(() => {
    const raw = selectedFunctionGraphObject?.meta?.axisColor;
    return typeof raw === "string" && raw.startsWith("#") ? raw : "#ff8e3c";
  }, [selectedFunctionGraphObject]);
  const selectedFunctionGraphPlaneColor = useMemo(() => {
    const raw = selectedFunctionGraphObject?.meta?.planeColor;
    return typeof raw === "string" && raw.startsWith("#") ? raw : "#ffffff";
  }, [selectedFunctionGraphObject]);
  const selectedTextColor = useMemo(() => {
    if (!selectedTextObject) return "#172039";
    return typeof selectedTextObject.meta?.textColor === "string" &&
      selectedTextObject.meta.textColor
      ? selectedTextObject.meta.textColor
      : selectedTextObject.color || "#172039";
  }, [selectedTextObject]);
  const selectedTextBackground = useMemo(() => {
    if (!selectedTextObject) return "transparent";
    return typeof selectedTextObject.meta?.textBackground === "string"
      ? selectedTextObject.meta.textBackground
      : "transparent";
  }, [selectedTextObject]);
  const selectedTextFontFamily = useMemo(() => {
    if (!selectedTextObject) return TEXT_FONT_OPTIONS[0].value;
    return typeof selectedTextObject.meta?.textFontFamily === "string" &&
      selectedTextObject.meta.textFontFamily
      ? selectedTextObject.meta.textFontFamily
      : TEXT_FONT_OPTIONS[0].value;
  }, [selectedTextObject]);
  const selectedTextBold = useMemo(
    () => Boolean(selectedTextObject?.meta?.textBold),
    [selectedTextObject]
  );
  const selectedTextItalic = useMemo(
    () => Boolean(selectedTextObject?.meta?.textItalic),
    [selectedTextObject]
  );
  const selectedTextUnderline = useMemo(
    () => Boolean(selectedTextObject?.meta?.textUnderline),
    [selectedTextObject]
  );
  const selectedTextAlign = useMemo<"left" | "center" | "right">(() => {
    if (selectedTextObject?.meta?.textAlign === "center") return "center";
    if (selectedTextObject?.meta?.textAlign === "right") return "right";
    return "left";
  }, [selectedTextObject]);
  const graphTabUsesSelectedObject = Boolean(selectedFunctionGraphObject);
  const functionGraphPlanes = useMemo(
    () =>
      boardObjects
        .filter((item): item is WorkbookBoardObject => item.type === "function_graph")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [boardObjects]
  );
  const graphPlaneEntries = useMemo(
    () =>
      functionGraphPlanes.map((plane, index) => ({
        id: plane.id,
        title: `Плоскость ${index + 1}`,
        functionCount: resolveGraphFunctionsFromObject(plane).length,
      })),
    [functionGraphPlanes]
  );
  const graphTabFunctions = graphTabUsesSelectedObject
    ? graphFunctionsDraft
    : graphDraftFunctions;
  useEffect(() => {
    if (!selectedLineObject) {
      lineDraftObjectIdRef.current = null;
      return;
    }
    if (lineDraftObjectIdRef.current === selectedLineObject.id) return;
    lineDraftObjectIdRef.current = selectedLineObject.id;
    setLineWidthDraft(Math.max(1, Math.round(selectedLineStrokeWidth)));
    setSelectedLineStartLabelDraft(selectedLineStartLabel);
    setSelectedLineEndLabelDraft(selectedLineEndLabel);
  }, [
    selectedLineEndLabel,
    selectedLineObject,
    selectedLineObject?.id,
    selectedLineStartLabel,
    selectedLineStrokeWidth,
  ]);

  useEffect(() => {
    selectedTextDraftValueRef.current = selectedTextDraft;
  }, [selectedTextDraft]);

  useEffect(() => {
    if (!selectedTextObject) {
      selectedTextDraftObjectIdRef.current = null;
      selectedTextDraftDirtyRef.current = false;
      if (selectedTextDraftCommitTimerRef.current !== null) {
        window.clearTimeout(selectedTextDraftCommitTimerRef.current);
        selectedTextDraftCommitTimerRef.current = null;
      }
      setSelectedTextDraft("");
      return;
    }
    const selectedId = selectedTextObject.id;
    if (selectedTextDraftObjectIdRef.current !== selectedId) {
      selectedTextDraftObjectIdRef.current = selectedId;
      selectedTextDraftDirtyRef.current = false;
    }
    const nextText =
      typeof selectedTextObject.text === "string" ? selectedTextObject.text : "";
    if (!selectedTextDraftDirtyRef.current) {
      setSelectedTextDraft((current) => (current === nextText ? current : nextText));
    }
    const nextSize = Math.max(12, Math.round(selectedTextObject.fontSize ?? 18));
    setSelectedTextFontSizeDraft((current) => (current === nextSize ? current : nextSize));
  }, [
    selectedTextDraft,
    selectedTextObject,
    selectedTextObject?.fontSize,
    selectedTextObject?.id,
    selectedTextObject?.text,
  ]);

  useEffect(
    () => () => {
      if (selectedTextDraftCommitTimerRef.current !== null) {
        window.clearTimeout(selectedTextDraftCommitTimerRef.current);
        selectedTextDraftCommitTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedFunctionGraphObject) {
      graphDraftObjectIdRef.current = null;
      setGraphFunctionsDraft([]);
      return;
    }
    if (graphDraftObjectIdRef.current !== selectedFunctionGraphObject.id) {
      graphDraftObjectIdRef.current = selectedFunctionGraphObject.id;
    }
    setGraphFunctionsDraft((current) =>
      areGraphFunctionDraftListsEqual(current, selectedFunctionGraphFunctions)
        ? current
        : selectedFunctionGraphFunctions
    );
    setGraphDraftError(null);
  }, [
    selectedFunctionGraphFunctions,
    selectedFunctionGraphObject,
  ]);

  useEffect(() => {
    if (selectedFunctionGraphObject) {
      setGraphWorkbenchTab("work");
      return;
    }
    if (tool === "function_graph") {
      setGraphWorkbenchTab("catalog");
    }
  }, [selectedFunctionGraphObject, tool]);

  useEffect(() => {
    if (!selectedShape2dObject) {
      shapeDraftObjectIdRef.current = null;
      return;
    }
    setShape2dStrokeWidthDraft(Math.max(1, Math.round(selectedShape2dObject.strokeWidth ?? 2)));
  }, [selectedShape2dObject, selectedShape2dObject?.id, selectedShape2dObject?.strokeWidth]);

  useEffect(() => {
    if (!selectedShape2dObject) {
      shapeAngleDraftCommitTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      shapeAngleDraftCommitTimersRef.current.clear();
      shapeAngleDraftValuesRef.current.clear();
      shapeSegmentDraftCommitTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      shapeSegmentDraftCommitTimersRef.current.clear();
      shapeSegmentDraftValuesRef.current.clear();
      shapeAngleDraftObjectIdRef.current = null;
      shapeSegmentDraftObjectIdRef.current = null;
      shapeDraftObjectIdRef.current = null;
      return;
    }
    if (shapeDraftObjectIdRef.current === selectedShape2dObject.id) return;
    shapeAngleDraftCommitTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });
    shapeAngleDraftCommitTimersRef.current.clear();
    shapeAngleDraftValuesRef.current.clear();
    shapeSegmentDraftCommitTimersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });
    shapeSegmentDraftCommitTimersRef.current.clear();
    shapeSegmentDraftValuesRef.current.clear();
    shapeAngleDraftObjectIdRef.current = selectedShape2dObject.id;
    shapeSegmentDraftObjectIdRef.current = selectedShape2dObject.id;
    shapeDraftObjectIdRef.current = selectedShape2dObject.id;
    setShapeVertexLabelDrafts(selectedShape2dLabels);
    setShapeAngleNoteDrafts(selectedShape2dAngleNotes);
    setShapeSegmentNoteDrafts(selectedShape2dSegmentNotes);
  }, [
    selectedShape2dAngleNotes,
    selectedShape2dLabels,
    selectedShape2dObject,
    selectedShape2dObject?.id,
    selectedShape2dSegmentNotes,
  ]);

  useEffect(
    () => () => {
      shapeAngleDraftCommitTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      shapeAngleDraftCommitTimersRef.current.clear();
      shapeSegmentDraftCommitTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      shapeSegmentDraftCommitTimersRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (!selectedDividerObject) {
      dividerDraftObjectIdRef.current = null;
      return;
    }
    if (dividerDraftObjectIdRef.current === selectedDividerObject.id) return;
    dividerDraftObjectIdRef.current = selectedDividerObject.id;
    setDividerWidthDraft(Math.max(1, Math.round(selectedDividerStrokeWidth)));
  }, [selectedDividerObject, selectedDividerStrokeWidth, selectedDividerObject?.id]);

  const selectedSolid3dState = useMemo(
    () =>
      selectedObject?.type === "solid3d"
        ? readSolid3dState(selectedObject.meta)
        : null,
    [selectedObject]
  );
  const selectedSolidPresetId = useMemo(() => {
    if (selectedObject?.type !== "solid3d") return null;
    return typeof selectedObject.meta?.presetId === "string"
      ? selectedObject.meta.presetId
      : "cube";
  }, [selectedObject]);
  const selectedSolidIsCurved = useMemo(
    () => Boolean(selectedSolidPresetId && CURVED_SURFACE_ONLY_SOLID_PRESETS.has(selectedSolidPresetId)),
    [selectedSolidPresetId]
  );
  useEffect(() => {
    if (selectedSolidIsCurved) {
      if (
        solid3dFigureTab === "faces" ||
        solid3dFigureTab === "edges" ||
        solid3dFigureTab === "angles"
      ) {
        setSolid3dFigureTab("surface");
      }
      return;
    }
    if (solid3dFigureTab === "surface") {
      setSolid3dFigureTab("display");
    }
  }, [selectedSolidIsCurved, solid3dFigureTab]);
  const selectedSolidMesh = useMemo(() => {
    if (!selectedObject || selectedObject.type !== "solid3d") return null;
    if (!selectedSolidPresetId) return null;
    return getSolid3dMesh(
      selectedSolidPresetId,
      Math.max(1, Math.abs(selectedObject.width)),
      Math.max(1, Math.abs(selectedObject.height))
    );
  }, [selectedObject, selectedSolidPresetId]);
  const selectedSolidVertexLabels = useMemo(
    () => selectedSolid3dState?.vertexLabels ?? [],
    [selectedSolid3dState?.vertexLabels]
  );
  const selectedSolidHiddenEdges = useMemo(
    () => Boolean(selectedSolid3dState?.hiddenFaceIds?.includes("hidden_edges")),
    [selectedSolid3dState?.hiddenFaceIds]
  );
  const selectedSolidFaceColors = useMemo(
    () => selectedSolid3dState?.faceColors ?? {},
    [selectedSolid3dState?.faceColors]
  );
  const selectedSolidSurfaceColor = useMemo(
    () =>
      selectedObject?.type === "solid3d" && typeof selectedObject.fill === "string" && selectedObject.fill
        ? selectedObject.fill
        : "#5f6aa0",
    [selectedObject]
  );
  const selectedSolidStrokeWidth = useMemo(
    () => (selectedObject?.type === "solid3d" ? selectedObject.strokeWidth ?? 2 : 2),
    [selectedObject?.type, selectedObject?.strokeWidth]
  );
  const selectedSolidEdgeColors = useMemo(
    () => selectedSolid3dState?.edgeColors ?? {},
    [selectedSolid3dState?.edgeColors]
  );
  const selectedSolidEdges = useMemo(() => {
    if (!selectedSolidMesh) return [] as Array<{ key: string; label: string }>;
    const seen = new Set<string>();
    return selectedSolidMesh.faces.reduce<Array<{ key: string; label: string }>>((acc, face) => {
      if (face.length < 2) return acc;
      face.forEach((fromIndex, localIndex) => {
        const toIndex = face[(localIndex + 1) % face.length];
        const min = Math.min(fromIndex, toIndex);
        const max = Math.max(fromIndex, toIndex);
        const key = `${min}:${max}`;
        if (seen.has(key)) return;
        seen.add(key);
        const label = `${selectedSolidVertexLabels[min] || getSolidVertexLabel(min)}-${selectedSolidVertexLabels[max] || getSolidVertexLabel(max)}`;
        acc.push({ key, label });
      });
      return acc;
    }, []);
  }, [selectedSolidMesh, selectedSolidVertexLabels]);
  const selectedSolidAngleMarks = useMemo(
    () => selectedSolid3dState?.angleMarks ?? [],
    [selectedSolid3dState?.angleMarks]
  );
  const handleTransformOpenGraphPanel = useCallback(() => {
    openUtilityPanel("graph", { toggle: false });
  }, [openUtilityPanel]);
  const handleTransformDissolveCompositionLayer = useCallback(() => {
    if (selectedObjectSceneLayerId === MAIN_SCENE_LAYER_ID) return;
    void dissolveCompositionLayer(selectedObjectSceneLayerId);
  }, [dissolveCompositionLayer, selectedObjectSceneLayerId]);
  const selectedSolidSectionPointLimit = useMemo(
    () => getSolidSectionPointLimit(selectedSolidPresetId, selectedSolidMesh),
    [selectedSolidPresetId, selectedSolidMesh]
  );
  const isSolid3dPointCollectionActive = Boolean(
    selectedObject?.type === "solid3d" &&
      solid3dSectionPointCollecting &&
      selectedObject.id === solid3dSectionPointCollecting
  );
  const solid3dDraftPointLimit = useMemo(() => {
    if (!solid3dDraftPoints) return selectedSolidSectionPointLimit;
    const targetObject = boardObjects.find((item) => item.id === solid3dDraftPoints.objectId);
    if (!targetObject || targetObject.type !== "solid3d") return selectedSolidSectionPointLimit;
    return getPointLimitForSolidObject(targetObject);
  }, [boardObjects, selectedSolidSectionPointLimit, solid3dDraftPoints]);

  useEffect(() => {
    if (selectedObject?.type !== "solid3d") {
      setActiveSolidSectionId(null);
      setSolid3dSectionPointCollecting(null);
      setSolid3dInspectorTab("section");
      setSolid3dDraftPoints(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dSectionVertexContextMenu(null);
      setSolid3dSectionContextMenu(null);
    }
  }, [selectedObject?.type]);

  useEffect(() => {
    if (selectedObject?.type !== "solid3d") return;
    setSolid3dStrokeWidthDraft(Math.max(1, Math.round(selectedSolidStrokeWidth)));
  }, [selectedObject?.id, selectedObject?.type, selectedSolidStrokeWidth]);

  useEffect(() => {
    if (!selectedSolid3dState) return;
    if (selectedSolid3dState.sections.length === 0) {
      setActiveSolidSectionId(null);
      return;
    }
    if (
      !activeSolidSectionId ||
      !selectedSolid3dState.sections.some((section) => section.id === activeSolidSectionId)
    ) {
      setActiveSolidSectionId(selectedSolid3dState.sections[0].id);
    }
  }, [activeSolidSectionId, selectedSolid3dState]);

  useEffect(() => {
    if (!selectedObject || selectedObject.type !== "solid3d") return;
    if (!selectedSolidMesh || !selectedSolid3dState) return;
    if (!canSelect) return;
    const selectedPresetRaw =
      typeof selectedObject.meta?.presetId === "string" ? selectedObject.meta.presetId : "cube";
    const selectedPresetId = resolveSolid3dPresetId(selectedPresetRaw);
    if (ROUND_SOLID_PRESETS.has(selectedPresetId)) return;
    const required = selectedSolidMesh.vertices.length;
    const current = selectedSolid3dState.vertexLabels ?? [];
    if (
      current.length >= required &&
      current.slice(0, required).every((label) => typeof label === "string" && label.trim())
    ) {
      return;
    }
    const nextLabels = Array.from({ length: required }, (_, index) => {
      const currentLabel = current[index];
      return typeof currentLabel === "string" && currentLabel.trim()
        ? currentLabel.trim()
        : `V${index + 1}`;
    });
    const nextState: Solid3dState = {
      ...selectedSolid3dState,
      vertexLabels: nextLabels,
    };
    void commitObjectUpdate(selectedObject.id, {
      meta: writeSolid3dState(nextState, selectedObject.meta),
    });
  }, [canSelect, commitObjectUpdate, selectedObject, selectedSolid3dState, selectedSolidMesh]);

  useEffect(() => {
    if (!solid3dDraftPoints) return;
    const targetObject = boardObjects.find((item) => item.id === solid3dDraftPoints.objectId);
    if (!targetObject || targetObject.type !== "solid3d") {
      setSolid3dDraftPoints(null);
      setSolid3dSectionPointCollecting(null);
    }
  }, [boardObjects, solid3dDraftPoints]);

  useEffect(() => {
    if (!solid3dSectionPointCollecting || !selectedObject) return;
    if (selectedObject.type !== "solid3d" || selectedObject.id !== solid3dSectionPointCollecting) {
      setSolid3dSectionPointCollecting(null);
      setSolid3dDraftPoints(null);
    }
  }, [selectedObject, solid3dSectionPointCollecting]);

  useEffect(() => {
    if (!solid3dSectionVertexContextMenu || !selectedSolid3dState) return;
    const section = selectedSolid3dState.sections.find(
      (entry) => entry.id === solid3dSectionVertexContextMenu.sectionId
    );
    if (!section) {
      setSolid3dSectionVertexContextMenu(null);
    }
  }, [selectedSolid3dState, solid3dSectionVertexContextMenu]);

  useEffect(() => {
    setCanvasViewport({ x: 0, y: 0 });
  }, [sessionId]);

  useEffect(() => {
    const isTypingElement = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        element.isContentEditable
      );
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (isTypingElement(event.target)) return;
      event.preventDefault();
      setSpacePanActive(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      setSpacePanActive(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleKeyUp as EventListener);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleKeyUp as EventListener);
    };
  }, []);

  const contextMenuObject = useMemo(
    () =>
      objectContextMenu
        ? boardObjects.find((item) => item.id === objectContextMenu.objectId) ?? null
        : null,
    [boardObjects, objectContextMenu]
  );
  const contextMenuShapeVertexObject = useMemo(() => {
    if (!shapeVertexContextMenu) return null;
    const object = boardObjects.find((item) => item.id === shapeVertexContextMenu.objectId) ?? null;
    if (!is2dFigureObject(object)) return null;
    return object;
  }, [boardObjects, shapeVertexContextMenu]);
  const contextMenuLineEndpointObject = useMemo(() => {
    if (!lineEndpointContextMenu) return null;
    const object = boardObjects.find((item) => item.id === lineEndpointContextMenu.objectId) ?? null;
    if (!object || (object.type !== "line" && object.type !== "arrow")) return null;
    if (object.meta?.lineKind !== "segment") return null;
    return object;
  }, [boardObjects, lineEndpointContextMenu]);
  const contextMenuSection = useMemo(() => {
    if (!solid3dSectionContextMenu || !selectedSolid3dState) return null;
    return (
      selectedSolid3dState.sections.find(
        (section) => section.id === solid3dSectionContextMenu.sectionId
      ) ?? null
    );
  }, [selectedSolid3dState, solid3dSectionContextMenu]);

  useEffect(() => {
    if (!contextMenuObject || contextMenuObject.type !== "point") {
      setPointLabelDraft("");
      return;
    }
    const label =
      typeof contextMenuObject.meta?.label === "string" ? contextMenuObject.meta.label : "";
    setPointLabelDraft(label);
  }, [contextMenuObject]);

  useEffect(() => {
    if (!shapeVertexContextMenu || !contextMenuShapeVertexObject) {
      setShapeVertexLabelDraft("");
      return;
    }
    const vertices = resolve2dFigureVertices(contextMenuShapeVertexObject);
    if (!vertices.length) {
      setShapeVertexLabelDraft("");
      return;
    }
    const labels = Array.isArray(contextMenuShapeVertexObject.meta?.vertexLabels)
      ? contextMenuShapeVertexObject.meta.vertexLabels
      : [];
    const current = labels[shapeVertexContextMenu.vertexIndex];
    const value =
      typeof current === "string" && current.trim()
        ? current.trim()
        : getFigureVertexLabel(shapeVertexContextMenu.vertexIndex);
    setShapeVertexLabelDraft(value);
  }, [contextMenuShapeVertexObject, shapeVertexContextMenu]);

  useEffect(() => {
    if (!lineEndpointContextMenu || !contextMenuLineEndpointObject) {
      setLineEndpointLabelDraft("");
      return;
    }
    const valueRaw =
      lineEndpointContextMenu.endpoint === "start"
        ? contextMenuLineEndpointObject.meta?.startLabel
        : contextMenuLineEndpointObject.meta?.endLabel;
    const fallback = lineEndpointContextMenu.endpoint === "start" ? "A" : "B";
    const value =
      typeof valueRaw === "string" && valueRaw.trim() ? valueRaw.trim() : fallback;
    setLineEndpointLabelDraft(value);
  }, [contextMenuLineEndpointObject, lineEndpointContextMenu]);

  const activeDocument = documentState.assets.find(
    (asset) => asset.id === documentState.activeAssetId
  );
  const activeDocumentPageCount =
    activeDocument?.type === "pdf"
      ? Math.max(1, activeDocument.renderedPages?.length ?? 1)
      : 1;
  const imageAssetUrls = useMemo(
    () =>
      Object.fromEntries(
        documentState.assets
          .filter((asset) => asset.type === "image" && typeof asset.url === "string" && asset.url)
          .map((asset) => [asset.id, asset.url])
      ),
    [documentState.assets]
  );
  const visibleIncomingEraserPreviews = useMemo(
    () =>
      Object.values(incomingEraserPreviews).filter(
        (preview) => preview.page === Math.max(1, boardSettings.currentPage || 1)
      ),
    [boardSettings.currentPage, incomingEraserPreviews]
  );

  const activeFrameObject = useMemo(
    () =>
      boardObjects.find(
        (object) => object.id === boardSettings.activeFrameId && object.type === "frame"
      ) ?? null,
    [boardObjects, boardSettings.activeFrameId]
  );
  const visibleBoardStrokes = useMemo(
    () =>
      boardStrokes.filter((stroke) => (stroke.page ?? 1) === (boardSettings.currentPage || 1)),
    [boardSettings.currentPage, boardStrokes]
  );
  const visibleAnnotationStrokes = useMemo(
    () =>
      annotationStrokes.filter(
        (stroke) => (stroke.page ?? 1) === (boardSettings.currentPage || 1)
      ),
    [annotationStrokes, boardSettings.currentPage]
  );

  const visibleBoardObjects = useMemo(() => {
    const byPage = boardObjects.filter(
      (object) => (object.page ?? 1) === (boardSettings.currentPage || 1)
    );
    if (frameFocusMode !== "active" || !activeFrameObject) return byPage;
    const frameLeft = activeFrameObject.x;
    const frameTop = activeFrameObject.y;
    const frameRight = activeFrameObject.x + activeFrameObject.width;
    const frameBottom = activeFrameObject.y + activeFrameObject.height;
    return byPage.filter((object) => {
      if (object.id === activeFrameObject.id) return true;
      const centerX = object.x + object.width / 2;
      const centerY = object.y + object.height / 2;
      return (
        centerX >= frameLeft &&
        centerX <= frameRight &&
        centerY >= frameTop &&
        centerY <= frameBottom
      );
    });
  }, [
    activeFrameObject,
    boardObjects,
    boardSettings.currentPage,
    frameFocusMode,
  ]);

  useEffect(() => {
    if (!selectedObjectId) return;
    if (visibleBoardObjects.some((object) => object.id === selectedObjectId)) return;
    setSelectedObjectId(null);
  }, [selectedObjectId, visibleBoardObjects]);

  useEffect(() => {
    setAreaSelection((current) => {
      if (!current) return current;
      const visibleObjectIds = new Set(visibleBoardObjects.map((object) => object.id));
      const visibleBoardStrokeIds = new Set(visibleBoardStrokes.map((stroke) => stroke.id));
      const visibleAnnotationStrokeIds = new Set(
        visibleAnnotationStrokes.map((stroke) => stroke.id)
      );
      const nextObjectIds = current.objectIds.filter((id) => visibleObjectIds.has(id));
      const nextStrokeIds = current.strokeIds.filter((entry) =>
        entry.layer === "annotations"
          ? visibleAnnotationStrokeIds.has(entry.id)
          : visibleBoardStrokeIds.has(entry.id)
      );
      if (
        nextObjectIds.length === current.objectIds.length &&
        nextStrokeIds.length === current.strokeIds.length
      ) {
        return current;
      }
      if (nextObjectIds.length === 0 && nextStrokeIds.length === 0) {
        return null;
      }
      return {
        ...current,
        objectIds: nextObjectIds,
        strokeIds: nextStrokeIds,
      };
    });
  }, [visibleAnnotationStrokes, visibleBoardObjects, visibleBoardStrokes]);

  const handleBack = useCallback(async () => {
    if (dirtyRef.current) {
      const saved = await persistSnapshots({ force: true });
      if (!saved) {
        setError("Не удалось сохранить изменения перед выходом из тетради.");
        return;
      }
    }
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      try {
        const targetUrl = new URL(fromPath, window.location.origin).toString();
        window.opener.location.assign(targetUrl);
      } catch {
        // ignore opener navigation errors; fallback will still close/navigate current tab
      }
    }
    if (typeof window !== "undefined") {
      window.setTimeout(() => navigate(fromPath), 180);
      window.close();
      return;
    }
    navigate(fromPath);
  }, [fromPath, navigate, persistSnapshots]);

  if (loading) {
    return <PageLoader minHeight="30vh" />;
  }

  if (!session) {
    return (
      <section className="workbook-session workbook-session--error">
        <Alert severity="error">{error ?? "Сессия недоступна."}</Alert>
        <div className="workbook-session__error-actions">
          <Button
            variant="contained"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            Переподключиться
          </Button>
        </div>
      </section>
    );
  }

  const overlayContainer = sessionRootRef.current ?? undefined;

  return (
    <section
      className={`workbook-session ${isFullscreen ? "is-fullscreen" : ""}`}
      ref={sessionRootRef}
    >
      <input
        ref={boardFileInputRef}
        type="file"
        accept=".json,.mwb"
        className="workbook-session__file-input"
        onChange={handleLoadBoardFile}
      />
      <input
        ref={docsInputRef}
        type="file"
        accept="application/pdf,image/*"
        className="workbook-session__file-input"
        onChange={handleDocsUpload}
      />

      <header className="workbook-session__head" ref={sessionHeadRef}>
        <div className="workbook-session__head-main">
          <IconButton
            className="workbook-session__back"
            onClick={() => void handleBack()}
            aria-label="Назад"
          >
            <ArrowBackRoundedIcon />
          </IconButton>
          <div>
            <div className="workbook-session__head-meta">
              <Chip
                size="small"
                label={session.kind === "CLASS" ? "Коллективная сессия" : "Личная тетрадь"}
              />
              {session.status === "ended" ? (
                <Chip size="small" label="Завершено" color="default" />
              ) : null}
            </div>
          </div>
        </div>
        <div className="workbook-session__head-actions">
          {canManageSession && session.kind === "CLASS" ? (
            <Button
              variant="outlined"
              startIcon={<ContentCopyRoundedIcon />}
              onClick={() => void handleCopyInviteLink()}
              disabled={copyingInviteLink}
            >
              {copyingInviteLink ? "Копируем..." : "Скопировать ссылку приглашения"}
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          className={`workbook-session__alert${
            isFullscreen ? " workbook-session__alert--floating" : ""
          }`}
        >
          {error}
        </Alert>
      ) : null}

      {pendingClearRequest &&
      pendingClearRequest.authorUserId !== user?.id &&
      session.status !== "ended" ? (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={() => void handleConfirmClear()}>
              Подтвердить
            </Button>
          }
        >
          Учитель запросил очистку слоя. Подтвердите, чтобы выполнить действие.
        </Alert>
      ) : null}

      {awaitingClearRequest ? (
        <Alert severity="info">
          Ожидаем подтверждение второго участника на очистку слоя.
        </Alert>
      ) : null}

      <div
        className={`workbook-session__layout${
          showSidebarParticipants
            ? " workbook-session__layout--sidebar-overlay"
            : " workbook-session__layout--workspace"
        }`}
      >
        <div
          className={`workbook-session__workspace${
            graphCatalogCursorActive ? " is-graph-catalog-cursor" : ""
          }`}
          ref={workspaceRef}
        >
          <div
            ref={contextbarRef}
            className={`workbook-session__contextbar-dock${
              isDockedContextbarViewport ? " is-docked" : ""
            }${
              isCompactViewport ? " is-compact" : ""
            }`}
            onPointerDown={handleContextbarDragStart}
            style={
              isDockedContextbarViewport
                ? undefined
                : {
                    left: contextbarPosition.x,
                    top: contextbarPosition.y,
                  }
            }
          >
            <div className="workbook-session__contextbar">
                <Menu
                  container={overlayContainer}
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={() => setMenuAnchor(null)}
                >
                  <MenuItem
                    onClick={() => {
                      void exportBoardAsPdf();
                      setMenuAnchor(null);
                    }}
                    disabled={exportingSections}
                  >
                    Экспорт PDF
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      void handleMenuClearBoard();
                    }}
                    disabled={!canClear || isEnded}
                  >
                    Очистить доску
                  </MenuItem>
                </Menu>
                <Tooltip title="Меню доски" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={(event) => setMenuAnchor(event.currentTarget)}
                    >
                      <MenuRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    canAccessBoardSettingsPanel
                      ? "Настройки доски"
                      : "Преподаватель еще не открыл доступ к настройкам доски"
                  }
                  placement="bottom"
                  arrow
                >
                  <span>
                    <IconButton
                      size="small"
                      className={`workbook-session__toolbar-icon ${
                        isUtilityPanelOpen && utilityTab === "settings" ? "is-active" : ""
                      }`}
                      disabled={!canAccessBoardSettingsPanel}
                      onClick={() => openUtilityPanel("settings")}
                    >
                      <TuneRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Слои" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className={`workbook-session__toolbar-icon ${
                        isUtilityPanelOpen && utilityTab === "layers" ? "is-active" : ""
                      }`}
                      onClick={() => openUtilityPanel("layers")}
                    >
                      <LayersRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Отменить" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={() => void handleUndo()}
                      disabled={!canUseUndo || undoDepth === 0}
                    >
                      <UndoRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Повторить" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={() => void handleRedo()}
                      disabled={!canUseUndo || redoDepth === 0}
                    >
                      <RedoRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Уменьшить масштаб" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={zoomOut}
                    >
                      <ZoomOutRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Сбросить масштаб до 100%" placement="bottom" arrow>
                  <button
                    type="button"
                    className="workbook-session__zoom-badge"
                    onClick={resetZoom}
                  >
                    {Math.round(viewportZoom * 100)}%
                  </button>
                </Tooltip>
                <Tooltip title="Увеличить масштаб" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={zoomIn}
                    >
                      <ZoomInRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Сбросить масштаб" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={resetZoom}
                    >
                      <CenterFocusStrongRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Загрузить документ" placement="bottom" arrow>
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={() => docsInputRef.current?.click()}
                      disabled={!canInsertImage}
                    >
                      <UploadFileRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={hotkeysTooltipContent} placement="bottom-start" arrow>
                  <span>
                    <IconButton size="small" className="workbook-session__toolbar-icon">
                      <HelpOutlineRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip
                  title={isFullscreen ? "Выйти из полного экрана" : "Полный экран"}
                  placement="bottom"
                  arrow
                >
                  <span>
                    <IconButton
                      size="small"
                      className="workbook-session__toolbar-icon"
                      onClick={() => void toggleFullscreen()}
                    >
                      {isFullscreen ? (
                        <FullscreenExitRoundedIcon />
                      ) : (
                        <FullscreenRoundedIcon />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                {showCollaborationPanels ? (
                  <Tooltip
                    title={
                      isParticipantsCollapsed
                        ? "Открыть блок участников"
                        : "Свернуть блок участников"
                    }
                    placement="bottom"
                    arrow
                  >
                    <span>
                      <IconButton
                        size="small"
                        className={`workbook-session__toolbar-icon ${
                          !isParticipantsCollapsed ? "is-active" : ""
                        }`}
                        onClick={() => setIsParticipantsCollapsed((current) => !current)}
                      >
                        <GroupRoundedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : null}
            </div>
          </div>

          <div className="workbook-session__board-shell">
            <WorkbookCanvas
              boardStrokes={visibleBoardStrokes}
              annotationStrokes={visibleAnnotationStrokes}
              previewStrokes={previewStrokes}
              boardObjects={visibleBoardObjects}
              constraints={constraints}
              layer={layer}
              tool={tool}
              color={strokeColor}
              width={strokeWidth}
              authorUserId={user?.id ?? "unknown"}
              polygonSides={polygonSides}
              polygonMode={polygonMode}
              polygonPreset={polygonPreset}
              textPreset={textPreset}
              graphFunctions={sanitizeFunctionGraphDrafts(graphDraftFunctions, {
                ensureNonEmpty: false,
              })}
              lineStyle={lineStyle}
              snapToGrid={boardSettings.snapToGrid}
              gridSize={boardSettings.gridSize}
              viewportZoom={viewportZoom}
              showGrid={boardSettings.showGrid}
              gridColor={boardSettings.gridColor}
              backgroundColor={boardSettings.backgroundColor}
              imageAssetUrls={imageAssetUrls}
              incomingEraserPreviews={visibleIncomingEraserPreviews}
              showPageNumbers={boardSettings.showPageNumbers}
              currentPage={boardSettings.currentPage}
              disabled={!canEdit || boardLocked}
              selectedObjectId={selectedObjectId}
              selectedConstraintId={selectedConstraintId}
              focusPoint={focusPoint}
              pointerPoint={pointerPoint}
              focusPoints={focusPoints}
              pointerPoints={pointerPoints}
              viewportOffset={canvasViewport}
              onViewportOffsetChange={handleCanvasViewportOffsetChange}
              onEraserRadiusChange={handleEraserRadiusChange}
              forcePanMode={spacePanActive}
              autoDividersEnabled={boardSettings.autoSectionDividers}
              autoDividerStep={boardSettings.dividerStep}
              areaSelection={areaSelection}
              solid3dDraftPointCollectionObjectId={solid3dSectionPointCollecting}
              solid3dSectionMarkers={
                isSolid3dPointCollectionActive && solid3dDraftPoints
                  ? {
                      objectId: solid3dDraftPoints.objectId,
                      sectionId: "draft",
                      selectedPoints: solid3dDraftPoints.points,
                    }
                  : null
              }
              onSelectedObjectChange={handleCanvasSelectedObjectChange}
              onSelectedConstraintChange={setSelectedConstraintId}
              onStrokeCommit={handleCanvasStrokeCommit}
              onStrokePreview={commitStrokePreview}
              onEraserPreview={handleCanvasEraserPreview}
              onStrokeDelete={handleCanvasStrokeDelete}
              onStrokeReplace={handleCanvasStrokeReplace}
              onObjectCreate={handleCanvasObjectCreate}
              onObjectUpdate={handleCanvasObjectUpdate}
              onObjectDelete={handleCanvasObjectDelete}
              onObjectContextMenu={handleObjectContextMenu}
              onShapeVertexContextMenu={handleShapeVertexContextMenu}
              onLineEndpointContextMenu={handleLineEndpointContextMenu}
              onSolid3dVertexContextMenu={handleSolid3dVertexContextMenu}
              onSolid3dSectionVertexContextMenu={handleSolid3dSectionVertexContextMenu}
              onSolid3dSectionContextMenu={handleSolid3dSectionContextMenu}
              onSolid3dDraftPointAdd={addDraftPointToSolid}
              onAreaSelectionChange={handleCanvasAreaSelectionChange}
              onAreaSelectionContextMenu={handleCanvasAreaSelectionContextMenu}
              onInlineTextDraftChange={handleCanvasInlineTextDraftChange}
              onRequestSelectTool={handleCanvasRequestSelectTool}
              onLaserPoint={handleCanvasLaserPoint}
              onLaserClear={handleCanvasLaserClear}
              solid3dInsertPreset={pendingSolid3dInsertPreset}
              onSolid3dInsertConsumed={clearPendingSolid3dInsertPreset}
            />
            <aside className="workbook-session__tools">
              {toolButtonsBeforeCatalog.map(renderToolButton)}
              <Tooltip title="Каталог 2D-фигур" placement="left" arrow>
                <span>
                  <button
                    type="button"
                    className="workbook-session__tool-btn workbook-session__tool-special"
                    disabled={!canDraw}
                    aria-label="Каталог 2D-фигур"
                    onClick={() => setIsShapesDialogOpen(true)}
                  >
                    <PentagonRoundedIcon />
                  </button>
                </span>
              </Tooltip>
              <Tooltip title="Стереометрия (3D-библиотека)" placement="left" arrow>
                <span>
                  <button
                    type="button"
                    className="workbook-session__tool-btn workbook-session__tool-special"
                    disabled={!canDraw}
                    aria-label="Стереометрия"
                    onClick={() => setIsStereoDialogOpen(true)}
                  >
                    <ViewInArRoundedIcon />
                  </button>
                </span>
              </Tooltip>
              {toolButtonsAfterCatalog.map(renderToolButton)}
            </aside>
          </div>

          {docsWindow.open ? (
            <Suspense fallback={null}>
              <WorkbookSessionDocsWindow
                pinned={docsWindow.pinned}
                maximized={docsWindow.maximized}
                canInsertImage={canInsertImage}
                uploadingDoc={uploadingDoc}
                uploadProgress={uploadProgress}
                assets={documentState.assets}
                activeAssetId={documentState.activeAssetId}
                activeDocument={activeDocument}
                page={documentState.page}
                zoom={documentState.zoom}
                activeDocumentPageCount={activeDocumentPageCount}
                annotationsCount={documentState.annotations.length}
                onTogglePinned={handleDocsWindowTogglePinned}
                onToggleMaximized={handleDocsWindowToggleMaximized}
                onClose={handleDocsWindowClose}
                onRequestUpload={handleDocsWindowRequestUpload}
                onSnapshotToBoard={handleDocsWindowSnapshotToBoard}
                onAddAnnotation={handleDocsWindowAddAnnotation}
                onClearAnnotations={handleDocsWindowClearAnnotations}
                onSelectAsset={handleDocsWindowSelectAsset}
                onChangePage={handleDocsWindowPageChange}
                onChangeZoom={handleDocsWindowZoomChange}
              />
            </Suspense>
          ) : null}

        </div>

        <aside
          className="workbook-session__sidebar"
          style={
            !isCompactViewport && showSidebarParticipants
              ? ({
                  ["--workbook-floating-top" as string]: `${floatingPanelsTop}px`,
                } as CSSProperties)
              : undefined
          }
        >
          {showSidebarParticipants ? (
            <Suspense
              fallback={
                <div className="workbook-session__card">
                  <p className="workbook-session__hint">Загрузка участников...</p>
                </div>
              }
            >
              <WorkbookSessionParticipantsPanel
                participantCards={participantCards}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                canUseSessionChat={canUseSessionChat}
                canManageSession={canManageSession}
                isSessionChatOpen={isSessionChatOpen}
                sessionChatUnreadCount={sessionChatUnreadCount}
                onToggleSessionChat={handleToggleSessionChat}
                onCollapseParticipants={handleCollapseParticipants}
                micEnabled={micEnabled}
                onToggleMic={handleToggleOwnMic}
                canUseMedia={canUseMedia}
                isEnded={isEnded}
                isParticipantBoardToolsEnabled={isParticipantBoardToolsEnabled}
                onToggleParticipantBoardTools={handleToggleParticipantBoardTools}
                onToggleParticipantChat={handleToggleParticipantChat}
                onToggleParticipantMic={handleToggleParticipantMic}
              />
            </Suspense>
          ) : null}

          {isUtilityPanelOpen ? (
          <div
            ref={utilityPanelRef}
            className={`workbook-session__utility-float${
              isUtilityPanelCollapsed ? " is-collapsed" : ""
            }${isContextualUtilityPanel ? " is-contextual" : ""}${
              utilityTab === "settings" ? " is-settings" : ""
            }`}
            style={
              isCompactViewport
                ? undefined
                : {
                    left: utilityPanelPosition.x,
                    top: Math.max(utilityPanelPosition.y, floatingPanelsTop),
                  }
            }
          >
            <div
              className="workbook-session__utility-float-head"
              onPointerDown={handleUtilityPanelDragStart}
            >
              <h3>
                <TuneRoundedIcon fontSize="small" />
                {utilityPanelTitle}
              </h3>
              <div className="workbook-session__utility-float-actions">
                <IconButton
                  size="small"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsUtilityPanelCollapsed((current) => !current);
                  }}
                  title={isUtilityPanelCollapsed ? "Развернуть" : "Свернуть"}
                >
                  {isUtilityPanelCollapsed ? (
                    <UnfoldMoreRoundedIcon fontSize="small" />
                  ) : (
                    <UnfoldLessRoundedIcon fontSize="small" />
                  )}
                </IconButton>
                <IconButton
                  size="small"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsUtilityPanelOpen(false);
                  }}
                  title="Закрыть"
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
            {!isUtilityPanelCollapsed ? (
              <div className="workbook-session__utility-float-body">
          {utilityTab === "settings" ? (
            <Suspense
              fallback={
                <div className="workbook-session__card">
                  <p className="workbook-session__hint">Загрузка панели настроек...</p>
                </div>
              }
            >
              <WorkbookSessionBoardSettingsPanel
                sharedBoardSettings={boardSettings}
                onSharedBoardSettingsChange={handleSharedBoardSettingsChange}
                smartInkOptions={smartInkOptions}
                setSmartInkOptions={setSmartInkOptions}
                penToolSettings={penToolSettings}
                highlighterToolSettings={highlighterToolSettings}
                eraserRadius={clampedEraserRadius}
                onPenToolSettingsChange={handlePenToolSettingsChange}
                onHighlighterToolSettingsChange={handleHighlighterToolSettingsChange}
                onEraserRadiusChange={handleEraserRadiusChange}
                eraserRadiusMin={ERASER_RADIUS_MIN}
                eraserRadiusMax={ERASER_RADIUS_MAX}
                canManageSharedBoardSettings={canManageSharedBoardSettings}
              />
            </Suspense>
          ) : null}

          {utilityTab === "graph" && selectedObjectSupportsGraphPanel ? (
            <Suspense
              fallback={
                <div className="workbook-session__card">
                  <p className="workbook-session__hint">Загрузка панели графиков...</p>
                </div>
              }
            >
              <WorkbookSessionGraphPanel
                graphTabUsesSelectedObject={graphTabUsesSelectedObject}
                canDraw={canDraw}
                planeEntries={graphPlaneEntries}
                onCreatePlane={handleGraphPanelCreatePlane}
                onSelectPlane={handleGraphPanelSelectPlane}
                selectedFunctionGraphAxisColor={selectedFunctionGraphAxisColor}
                selectedFunctionGraphPlaneColor={selectedFunctionGraphPlaneColor}
                onAxisColorChange={handleGraphPanelAxisColorChange}
                onPlaneColorChange={handleGraphPanelPlaneColorChange}
                onClearPlaneBackground={handleGraphPanelClearPlaneBackground}
                graphWorkbenchTab={graphWorkbenchTab}
                onSelectCatalogTab={handleGraphPanelSelectCatalogTab}
                onSelectWorkTab={handleGraphPanelSelectWorkTab}
                graphExpressionDraft={graphExpressionDraft}
                graphDraftError={graphDraftError}
                onGraphExpressionDraftChange={handleGraphPanelExpressionDraftChange}
                onAddGraphFunction={handleGraphPanelAddFunction}
                selectedGraphPresetId={selectedGraphPresetId}
                onSelectGraphPreset={handleGraphPanelSelectPreset}
                graphTabFunctions={graphTabFunctions}
                onGraphFunctionColorChange={handleGraphPanelFunctionColorChange}
                onGraphFunctionExpressionChange={handleGraphPanelFunctionExpressionChange}
                onCommitGraphExpressions={handleGraphPanelCommitExpressions}
                onRemoveGraphFunction={handleGraphPanelRemoveFunction}
                onToggleGraphFunctionVisibility={handleGraphPanelToggleVisibility}
                onReflectGraphFunctionByAxis={handleGraphPanelReflectFunction}
              />
            </Suspense>
          ) : null}

          {utilityTab === "layers" ? (
            <Suspense
              fallback={
                <div className="workbook-session__card">
                  <p className="workbook-session__hint">Загрузка панели слоёв...</p>
                </div>
              }
            >
              <WorkbookSessionLayersPanel
                layers={compositionLayerEntries}
                getObjectTypeLabel={getWorkbookObjectTypeLabel}
                onDissolveLayer={handleLayersPanelDissolveLayer}
                onFocusObject={focusObjectInWorkspace}
                onRemoveObject={handleLayersPanelRemoveObject}
                onDeleteObject={handleCanvasObjectDelete}
              />
            </Suspense>
          ) : null}

          {utilityTab === "transform" && selectedObjectSupportsTransformPanel ? (
            <Suspense
              fallback={
                <div className="workbook-session__card">
                  <p className="workbook-session__hint">Загрузка панели трансформаций...</p>
                </div>
              }
            >
              <WorkbookSessionTransformPanel
                tool={tool}
                canSelect={canSelect}
                canDelete={canDelete}
                pointObjectCount={pointObjectCount}
                eraserRadiusMin={ERASER_RADIUS_MIN}
                eraserRadiusMax={ERASER_RADIUS_MAX}
                strokeWidth={clampedEraserRadius}
                onStrokeWidthChange={handleTransformStrokeWidthChange}
                selectedObject={selectedObject}
                selectedObjectLabel={selectedObjectLabel}
                canToggleSelectedObjectLabels={canToggleSelectedObjectLabels}
                selectedObjectShowLabels={selectedObjectShowLabels}
                isSelectedObjectInComposition={selectedObjectSceneLayerId !== MAIN_SCENE_LAYER_ID}
                onMirrorSelectedObject={mirrorSelectedObject}
                onUpdateSelectedObjectMeta={updateSelectedObjectMeta}
                onDissolveCompositionLayer={handleTransformDissolveCompositionLayer}
                onOpenGraphPanel={handleTransformOpenGraphPanel}
                selectedLineObject={selectedLineObject}
                selectedFunctionGraphObject={selectedFunctionGraphObject}
                selectedDividerObject={selectedDividerObject}
                selectedPointObject={selectedPointObject}
                selectedTextObject={selectedTextObject}
                selectedShape2dObject={selectedShape2dObject}
                textFontOptions={TEXT_FONT_OPTIONS}
                selectedTextDraft={selectedTextDraft}
                setSelectedTextDraft={setSelectedTextDraft}
                onScheduleSelectedTextDraftCommit={scheduleSelectedTextDraftCommit}
                onFlushSelectedTextDraftCommit={flushSelectedTextDraftCommit}
                selectedTextFontFamily={selectedTextFontFamily}
                selectedTextFontSizeDraft={selectedTextFontSizeDraft}
                setSelectedTextFontSizeDraft={setSelectedTextFontSizeDraft}
                selectedTextBold={selectedTextBold}
                selectedTextItalic={selectedTextItalic}
                selectedTextUnderline={selectedTextUnderline}
                selectedTextAlign={selectedTextAlign}
                selectedTextColor={selectedTextColor}
                selectedTextBackground={selectedTextBackground}
                onUpdateSelectedTextFormatting={updateSelectedTextFormatting}
                selectedDividerStyle={selectedDividerStyle}
                selectedDividerColor={selectedDividerColor}
                dividerWidthDraft={dividerWidthDraft}
                setDividerWidthDraft={setDividerWidthDraft}
                onUpdateSelectedDividerMeta={updateSelectedDividerMeta}
                onUpdateSelectedDividerObject={updateSelectedDividerObject}
                onCommitSelectedDividerWidth={commitSelectedDividerWidth}
                lineStyle={lineStyle}
                setLineStyle={setLineStyle}
                selectedLineStyle={selectedLineStyle}
                selectedLineKind={selectedLineKind}
                selectedLineColor={selectedLineColor}
                lineWidthDraft={lineWidthDraft}
                setLineWidthDraft={setLineWidthDraft}
                selectedLineStartLabelDraft={selectedLineStartLabelDraft}
                setSelectedLineStartLabelDraft={setSelectedLineStartLabelDraft}
                selectedLineEndLabelDraft={selectedLineEndLabelDraft}
                setSelectedLineEndLabelDraft={setSelectedLineEndLabelDraft}
                onUpdateSelectedLineMeta={updateSelectedLineMeta}
                onUpdateSelectedLineObject={updateSelectedLineObject}
                onCommitSelectedLineWidth={commitSelectedLineWidth}
                onCommitSelectedLineEndpointLabel={commitSelectedLineEndpointLabel}
                onConnectPointObjectsChronologically={connectPointObjectsChronologically}
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
                onUpdateSelectedShape2dMeta={updateSelectedShape2dMeta}
                onUpdateSelectedShape2dObject={updateSelectedShape2dObject}
                onCommitSelectedShape2dStrokeWidth={commitSelectedShape2dStrokeWidth}
                onRenameSelectedShape2dVertex={renameSelectedShape2dVertex}
                onScheduleSelectedShape2dAngleDraftCommit={scheduleSelectedShape2dAngleDraftCommit}
                onFlushSelectedShape2dAngleDraftCommit={flushSelectedShape2dAngleDraftCommit}
                onUpdateSelectedShape2dAngleStyle={updateSelectedShape2dAngleStyle}
                onScheduleSelectedShape2dSegmentDraftCommit={scheduleSelectedShape2dSegmentDraftCommit}
                onFlushSelectedShape2dSegmentDraftCommit={flushSelectedShape2dSegmentDraftCommit}
                onUpdateSelectedShape2dVertexColor={updateSelectedShape2dVertexColor}
                onUpdateSelectedShape2dAngleColor={updateSelectedShape2dAngleColor}
                onUpdateSelectedShape2dSegmentColor={updateSelectedShape2dSegmentColor}
                solid3dInspectorTab={solid3dInspectorTab}
                setSolid3dInspectorTab={setSolid3dInspectorTab}
                solid3dFigureTab={solid3dFigureTab}
                setSolid3dFigureTab={setSolid3dFigureTab}
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
                activeSolidSectionId={activeSolidSectionId}
                setActiveSolidSectionId={setActiveSolidSectionId}
                solid3dDraftPoints={solid3dDraftPoints}
                solid3dDraftPointLimit={solid3dDraftPointLimit}
                isSolid3dPointCollectionActive={isSolid3dPointCollectionActive}
                onSetSolid3dHiddenEdges={setSolid3dHiddenEdges}
                onUpdateSelectedSolid3dSurfaceColor={updateSelectedSolid3dSurfaceColor}
                solid3dStrokeWidthDraft={solid3dStrokeWidthDraft}
                setSolid3dStrokeWidthDraft={setSolid3dStrokeWidthDraft}
                onUpdateSelectedSolid3dStrokeWidth={updateSelectedSolid3dStrokeWidth}
                onCommitSelectedSolid3dStrokeWidth={commitSelectedSolid3dStrokeWidth}
                onResetSolid3dFaceColors={resetSolid3dFaceColors}
                onSetSolid3dFaceColor={setSolid3dFaceColor}
                onResetSolid3dEdgeColors={resetSolid3dEdgeColors}
                onSetSolid3dEdgeColor={setSolid3dEdgeColor}
                onAddSolid3dAngleMark={addSolid3dAngleMark}
                onUpdateSolid3dAngleMark={updateSolid3dAngleMark}
                onDeleteSolid3dAngleMark={deleteSolid3dAngleMark}
                onStartSolid3dSectionPointCollection={startSolid3dSectionPointCollection}
                onBuildSectionFromDraftPoints={buildSectionFromDraftPoints}
                onClearSolid3dDraftPoints={clearSolid3dDraftPoints}
                onUpdateSolid3dSection={updateSolid3dSection}
                onDeleteSolid3dSection={deleteSolid3dSection}
                getSolidVertexLabel={getSolidVertexLabel}
                getSectionVertexLabel={getSectionVertexLabel}
              />
            </Suspense>
          ) : null}

              </div>
          ) : null}

          </div>
          ) : null}

          {showCollaborationPanels && isSessionChatOpen ? (
            <div
              ref={sessionChatRef}
              className={`workbook-session__session-chat${
                isSessionChatMinimized ? " is-minimized" : ""
              }${isSessionChatMaximized ? " is-maximized" : ""}`}
              style={
                isSessionChatMaximized || isCompactViewport
                  ? undefined
                  : { left: sessionChatPosition.x, top: sessionChatPosition.y }
              }
            >
              <div
                className="workbook-session__session-chat-head"
                onPointerDown={handleSessionChatDragStart}
              >
                <h4>
                  <ForumRoundedIcon fontSize="small" />
                  Чат сессии
                </h4>
                <div className="workbook-session__session-chat-head-actions">
                  <IconButton
                    size="small"
                    aria-label={isSessionChatMinimized ? "Развернуть чат" : "Свернуть чат"}
                    onClick={() => setIsSessionChatMinimized((current) => !current)}
                  >
                    {isSessionChatMinimized ? (
                      <UnfoldMoreRoundedIcon fontSize="small" />
                    ) : (
                      <UnfoldLessRoundedIcon fontSize="small" />
                    )}
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={
                      isSessionChatMaximized ? "Обычный размер чата" : "Развернуть чат на максимум"
                    }
                    onClick={() => setIsSessionChatMaximized((current) => !current)}
                    disabled={isSessionChatMinimized}
                  >
                    {isSessionChatMaximized ? (
                      <FullscreenExitRoundedIcon fontSize="small" />
                    ) : (
                      <FullscreenRoundedIcon fontSize="small" />
                    )}
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Закрыть чат"
                    onClick={() => {
                      setIsSessionChatOpen(false);
                      setIsSessionChatEmojiOpen(false);
                    }}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>

              {!isSessionChatMinimized ? (
                <>
                  <div className="workbook-session__session-chat-meta">
                    <div className="workbook-session__session-chat-avatars">
                      {participantCards.slice(0, 10).map((participant) => (
                        <Tooltip
                          key={`chat-avatar-${participant.userId}`}
                          title={participant.displayName}
                          arrow
                        >
                          <Avatar
                            src={participant.photo}
                            alt={participant.displayName}
                            className={`workbook-session__session-chat-avatar ${
                              participant.isOnline ? "is-online" : "is-offline"
                            }`}
                          >
                            {participant.displayName.slice(0, 1)}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </div>
                    <div className="workbook-session__session-chat-meta-right">
                      <span>{onlineParticipantsCount} онлайн</span>
                      {canManageSession && chatMessages.length > 0 ? (
                        <Tooltip title="Очистить чат" arrow>
                          <IconButton
                            size="small"
                            onClick={() => setIsClearSessionChatDialogOpen(true)}
                            aria-label="Очистить чат"
                          >
                            <DeleteSweepRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {sessionChatUnreadCount > 0 || !isSessionChatAtBottom ? (
                        <Tooltip title="Перемотать к последнему сообщению" arrow>
                          <IconButton
                            size="small"
                            onClick={() => {
                              scrollSessionChatToLatest("smooth");
                              markSessionChatReadToLatest();
                            }}
                            aria-label="К последнему сообщению"
                          >
                            <KeyboardDoubleArrowDownRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                  <div className="workbook-session__chat-list" ref={sessionChatListRef}>
                    {chatMessages.length === 0 ? (
                      <p className="workbook-session__hint">
                        Сообщений пока нет. Используйте чат для быстрых текстовых подсказок.
                      </p>
                    ) : (
                      chatMessages.map((message) => (
                        <div key={message.id}>
                          {firstUnreadSessionChatMessageId === message.id ? (
                            <div className="workbook-session__chat-unread-divider">
                              Непрочитанные
                            </div>
                          ) : null}
                          <article
                            data-session-chat-message-id={message.id}
                            className={`workbook-session__chat-message${
                              message.authorUserId === user?.id ? " is-own" : ""
                            }`}
                          >
                            <strong>{message.authorName}</strong>
                            <p>{message.text}</p>
                            <time>
                              {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                          </article>
                        </div>
                      ))
                    )}
                  </div>
                  {canSendSessionChat ? (
                    <div className="workbook-session__session-chat-input-wrap">
                      <div className="workbook-session__session-chat-input">
                        <IconButton
                          size="small"
                          aria-label="Эмодзи"
                          onClick={() =>
                            setIsSessionChatEmojiOpen((current) => !current)
                          }
                        >
                          <SentimentSatisfiedRoundedIcon fontSize="small" />
                        </IconButton>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Введите сообщение..."
                          value={sessionChatDraft}
                          onChange={(event) => setSessionChatDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" || event.shiftKey) return;
                            event.preventDefault();
                            void handleSendSessionChatMessage();
                          }}
                        />
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label="Отправить"
                          onClick={() => void handleSendSessionChatMessage()}
                          disabled={!sessionChatDraft.trim()}
                        >
                          <SendRoundedIcon fontSize="small" />
                        </IconButton>
                      </div>
                      {isSessionChatEmojiOpen ? (
                        <div className="workbook-session__session-chat-emoji">
                          {WORKBOOK_CHAT_EMOJIS.map((emoji) => (
                            <button
                              key={`session-chat-emoji-${emoji}`}
                              type="button"
                              onClick={() =>
                                setSessionChatDraft((current) => `${current}${emoji}`)
                              }
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="workbook-session__hint">
                      Отправка сообщений недоступна: доступ к чату отключён.
                    </p>
                  )}
                </>
              ) : null}
            </div>
          ) : null}

          <Dialog
            container={overlayContainer}
            open={isClearSessionChatDialogOpen}
            onClose={() => setIsClearSessionChatDialogOpen(false)}
            fullWidth
            maxWidth="xs"
            fullScreen={isCompactDialogViewport}
            className="workbook-session__confirm-dialog"
          >
            <DialogTitle>Очистить чат?</DialogTitle>
            <DialogContent>
              <p className="workbook-session__hint">
                Это действие удалит сообщения чата для всех участников текущей сессии.
              </p>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsClearSessionChatDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => {
                  setIsClearSessionChatDialogOpen(false);
                  void handleClearSessionChat();
                }}
              >
                Очистить
              </Button>
            </DialogActions>
          </Dialog>

          <Menu
            container={overlayContainer}
            open={Boolean(solid3dVertexContextMenu)}
            onClose={() => setSolid3dVertexContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              solid3dVertexContextMenu
                ? { top: solid3dVertexContextMenu.y, left: solid3dVertexContextMenu.x }
                : undefined
            }
          >
            <div className="workbook-session__solid-menu">
              <TextField
                size="small"
                placeholder="Название вершины"
                inputProps={{ "aria-label": "Название вершины" }}
                value={solid3dVertexContextMenu?.label ?? ""}
                onChange={(event) =>
                  setSolid3dVertexContextMenu((current) =>
                    current ? { ...current, label: event.target.value } : current
                  )
                }
              />
              <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                <IconButton
                  size="small"
                  aria-label="Сбросить название вершины"
                  onClick={() => {
                    if (!solid3dVertexContextMenu) return;
                    void renameSolid3dVertex(
                      solid3dVertexContextMenu.vertexIndex,
                      getSolidVertexLabel(solid3dVertexContextMenu.vertexIndex)
                    );
                    setSolid3dVertexContextMenu(null);
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="Сохранить название вершины"
                  onClick={() => {
                    if (!solid3dVertexContextMenu) return;
                    void renameSolid3dVertex(
                      solid3dVertexContextMenu.vertexIndex,
                      solid3dVertexContextMenu.label
                    );
                    setSolid3dVertexContextMenu(null);
                  }}
                >
                  <SaveRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          </Menu>

          <Menu
            container={overlayContainer}
            open={Boolean(solid3dSectionVertexContextMenu)}
            onClose={() => setSolid3dSectionVertexContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              solid3dSectionVertexContextMenu
                ? {
                    top: solid3dSectionVertexContextMenu.y,
                    left: solid3dSectionVertexContextMenu.x,
                  }
                : undefined
            }
          >
            <div className="workbook-session__solid-menu">
              <TextField
                size="small"
                placeholder="Название вершины сечения"
                inputProps={{ "aria-label": "Название вершины сечения" }}
                value={solid3dSectionVertexContextMenu?.label ?? ""}
                onChange={(event) =>
                  setSolid3dSectionVertexContextMenu((current) =>
                    current ? { ...current, label: event.target.value } : current
                  )
                }
              />
              <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                <IconButton
                  size="small"
                  aria-label="Сбросить название вершины сечения"
                  onClick={() => {
                    if (!solid3dSectionVertexContextMenu) return;
                    void renameSolid3dSectionVertex(
                      solid3dSectionVertexContextMenu.sectionId,
                      solid3dSectionVertexContextMenu.vertexIndex,
                      getSectionVertexLabel(solid3dSectionVertexContextMenu.vertexIndex)
                    );
                    setSolid3dSectionVertexContextMenu(null);
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="Сохранить название вершины сечения"
                  onClick={() => {
                    if (!solid3dSectionVertexContextMenu) return;
                    void renameSolid3dSectionVertex(
                      solid3dSectionVertexContextMenu.sectionId,
                      solid3dSectionVertexContextMenu.vertexIndex,
                      solid3dSectionVertexContextMenu.label
                    );
                    setSolid3dSectionVertexContextMenu(null);
                  }}
                >
                  <SaveRoundedIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          </Menu>

          <Menu
            container={overlayContainer}
            open={Boolean(solid3dSectionContextMenu && contextMenuSection)}
            onClose={() => setSolid3dSectionContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              solid3dSectionContextMenu
                ? { top: solid3dSectionContextMenu.y, left: solid3dSectionContextMenu.x }
                : undefined
            }
          >
            {contextMenuSection ? (
              <div className="workbook-session__solid-menu">
                <div className="workbook-session__solid-menu-row">
                  <span>Цвет сечения</span>
                  <input
                    type="color"
                    className="workbook-session__solid-color"
                    value={contextMenuSection.color}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        color: event.target.value || "#ff8e3c",
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-row">
                  <span>Показать сечение</span>
                  <Switch
                    size="small"
                    checked={contextMenuSection.visible}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        visible: event.target.checked,
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-row">
                  <span>Заливка</span>
                  <Switch
                    size="small"
                    checked={contextMenuSection.fillEnabled}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        fillEnabled: event.target.checked,
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-row">
                  <span>Метки параметров</span>
                  <Switch
                    size="small"
                    checked={contextMenuSection.showMetrics}
                    onChange={(event) =>
                      void updateSolid3dSection(contextMenuSection.id, {
                        showMetrics: event.target.checked,
                      }, solid3dSectionContextMenu?.objectId)
                    }
                  />
                </div>
                <div className="workbook-session__solid-menu-actions">
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      void deleteSolid3dSection(
                        contextMenuSection.id,
                        solid3dSectionContextMenu?.objectId
                      );
                      setSolid3dSectionContextMenu(null);
                    }}
                  >
                    Удалить сечение
                  </Button>
                </div>
              </div>
            ) : null}
          </Menu>

          <Menu
            container={overlayContainer}
            open={Boolean(shapeVertexContextMenu && contextMenuShapeVertexObject)}
            onClose={() => setShapeVertexContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              shapeVertexContextMenu
                ? { top: shapeVertexContextMenu.y, left: shapeVertexContextMenu.x }
                : undefined
            }
          >
            {shapeVertexContextMenu && contextMenuShapeVertexObject ? (
              <div className="workbook-session__solid-menu">
                <TextField
                  size="small"
                  placeholder="Название вершины"
                  inputProps={{ "aria-label": "Название вершины" }}
                  value={shapeVertexLabelDraft}
                  onChange={(event) =>
                    setShapeVertexLabelDraft(event.target.value.slice(0, 12))
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key !== "Enter") return;
                    void renameShape2dVertexByObjectId(
                      shapeVertexContextMenu.objectId,
                      shapeVertexContextMenu.vertexIndex,
                      shapeVertexLabelDraft
                    );
                    setShapeVertexContextMenu(null);
                  }}
                  autoFocus
                />
                <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                  <IconButton
                    size="small"
                    aria-label="Сбросить подпись вершины"
                    onClick={() => {
                      void renameShape2dVertexByObjectId(
                        shapeVertexContextMenu.objectId,
                        shapeVertexContextMenu.vertexIndex,
                        ""
                      );
                      setShapeVertexContextMenu(null);
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Сохранить подпись вершины"
                    onClick={() => {
                      void renameShape2dVertexByObjectId(
                        shapeVertexContextMenu.objectId,
                        shapeVertexContextMenu.vertexIndex,
                        shapeVertexLabelDraft
                      );
                      setShapeVertexContextMenu(null);
                    }}
                  >
                    <SaveRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ) : null}
          </Menu>

          <Menu
            container={overlayContainer}
            open={Boolean(lineEndpointContextMenu && contextMenuLineEndpointObject)}
            onClose={() => setLineEndpointContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              lineEndpointContextMenu
                ? { top: lineEndpointContextMenu.y, left: lineEndpointContextMenu.x }
                : undefined
            }
          >
            {lineEndpointContextMenu && contextMenuLineEndpointObject ? (
              <div className="workbook-session__solid-menu">
                <TextField
                  size="small"
                  placeholder={
                    lineEndpointContextMenu.endpoint === "start"
                      ? "Название конца A"
                      : "Название конца B"
                  }
                  inputProps={{
                    "aria-label":
                      lineEndpointContextMenu.endpoint === "start"
                        ? "Название конца A"
                        : "Название конца B",
                  }}
                  value={lineEndpointLabelDraft}
                  onChange={(event) =>
                    setLineEndpointLabelDraft(event.target.value.slice(0, 12))
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key !== "Enter") return;
                    void renameLineEndpointByObjectId(
                      lineEndpointContextMenu.objectId,
                      lineEndpointContextMenu.endpoint,
                      lineEndpointLabelDraft
                    );
                    setLineEndpointContextMenu(null);
                  }}
                  autoFocus
                />
                <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                  <IconButton
                    size="small"
                    aria-label="Сбросить подпись конца отрезка"
                    onClick={() => {
                      void renameLineEndpointByObjectId(
                        lineEndpointContextMenu.objectId,
                        lineEndpointContextMenu.endpoint,
                        ""
                      );
                      setLineEndpointContextMenu(null);
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Сохранить подпись конца отрезка"
                    onClick={() => {
                      void renameLineEndpointByObjectId(
                        lineEndpointContextMenu.objectId,
                        lineEndpointContextMenu.endpoint,
                        lineEndpointLabelDraft
                      );
                      setLineEndpointContextMenu(null);
                    }}
                  >
                    <SaveRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ) : null}
          </Menu>

          <Menu
            container={overlayContainer}
            open={Boolean(objectContextMenu)}
            onClose={() => setObjectContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              objectContextMenu
                ? { top: objectContextMenu.y, left: objectContextMenu.x }
                : undefined
            }
          >
            {contextMenuObject?.type === "point" ? (
              <div className="workbook-session__solid-menu">
                <TextField
                  size="small"
                  placeholder="Название точки"
                  inputProps={{ "aria-label": "Название точки" }}
                  value={pointLabelDraft}
                  onChange={(event) => setPointLabelDraft(event.target.value.slice(0, 12))}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      void renamePointObject(contextMenuObject.id, pointLabelDraft);
                      setObjectContextMenu(null);
                    }
                  }}
                  autoFocus
                />
                <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Удалить точку"
                    onClick={() => {
                      if (!canDelete) return;
                      void commitObjectDelete(contextMenuObject.id);
                      setObjectContextMenu(null);
                    }}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Сохранить название точки"
                    onClick={() => {
                      void renamePointObject(contextMenuObject.id, pointLabelDraft);
                      setObjectContextMenu(null);
                    }}
                  >
                    <SaveRoundedIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            ) : null}
            {contextMenuObject && contextMenuObject.type !== "point" ? (
              <>
                <MenuItem
                  onClick={() => {
                    void commitObjectPin(contextMenuObject.id, !contextMenuObject.pinned);
                    setObjectContextMenu(null);
                  }}
                >
                  {contextMenuObject?.pinned ? "Открепить объект" : "Закрепить объект"}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void scaleObject(1.1, contextMenuObject.id);
                    setObjectContextMenu(null);
                  }}
                >
                  Увеличить на 10%
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    void scaleObject(0.9, contextMenuObject.id);
                    setObjectContextMenu(null);
                  }}
                >
                  Уменьшить на 10%
                </MenuItem>
              </>
            ) : null}
            {contextMenuObject &&
            contextMenuObject.type !== "point" &&
            canDelete &&
            !contextMenuObject.pinned ? (
              <MenuItem
                onClick={() => {
                  void commitObjectDelete(contextMenuObject.id);
                  setObjectContextMenu(null);
                }}
              >
                Удалить
              </MenuItem>
            ) : null}
          </Menu>

          <Menu
            container={overlayContainer}
            open={Boolean(areaSelectionContextMenu && areaSelectionHasContent)}
            onClose={() => setAreaSelectionContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              areaSelectionContextMenu
                ? { top: areaSelectionContextMenu.y, left: areaSelectionContextMenu.x }
                : undefined
            }
          >
            <MenuItem
              onClick={() => void copyAreaSelectionObjects()}
              disabled={!canSelect || !areaSelectionHasContent}
            >
              Скопировать область
            </MenuItem>
            <MenuItem
              onClick={() => void cutAreaSelectionObjects()}
              disabled={!canDelete || !areaSelectionHasContent}
            >
              Вырезать область
            </MenuItem>
            <MenuItem
              onClick={() => void createCompositionFromAreaSelection()}
              disabled={!canSelect || !areaSelection || areaSelection.objectIds.length < 2}
            >
              Объединить в композицию
            </MenuItem>
            <MenuItem
              onClick={() => void deleteAreaSelectionObjects()}
              disabled={!canDelete}
            >
              Удалить выделенное
            </MenuItem>
          </Menu>

          <Dialog
            container={overlayContainer}
            open={isStereoDialogOpen}
            onClose={() => setIsStereoDialogOpen(false)}
            fullWidth
            maxWidth="md"
            className="workbook-session__stereo-dialog"
          >
            <DialogTitle>Стереометрические фигуры</DialogTitle>
            <DialogContent dividers>
              <div className="workbook-session__stereo-grid">
                {SOLID3D_PRESETS.map((preset) => (
                  <button
                    key={`stereo-preset-${preset.id}`}
                    type="button"
                    className="workbook-session__stereo-card"
                    onClick={() => {
                      void createMathPresetObject("solid3d", {
                        presetId: preset.id,
                        presetTitle: preset.title,
                      });
                      setIsStereoDialogOpen(false);
                    }}
                  >
                    <SolidPresetPreview presetId={preset.id} />
                    <span>{preset.title}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsStereoDialogOpen(false)}>Закрыть</Button>
            </DialogActions>
          </Dialog>

          <Dialog
            container={overlayContainer}
            open={isShapesDialogOpen}
            onClose={() => setIsShapesDialogOpen(false)}
            fullWidth
            maxWidth="md"
            className="workbook-session__stereo-dialog"
          >
            <DialogTitle>Каталог 2D-фигур</DialogTitle>
            <DialogContent dividers>
              <div className="workbook-session__stereo-grid">
                {shapeCatalog.map((shape) => (
                  <button
                    key={`shape-preset-${shape.id}`}
                    type="button"
                    className="workbook-session__stereo-card"
                    onClick={() => {
                      shape.apply();
                      activateTool(shape.tool);
                      setIsShapesDialogOpen(false);
                    }}
                  >
                    <div className="workbook-session__shape-icon">{shape.icon}</div>
                    <span>{shape.title}</span>
                    <small>{shape.subtitle}</small>
                  </button>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsShapesDialogOpen(false)}>Закрыть</Button>
            </DialogActions>
          </Dialog>
        </aside>
      </div>
    </section>
  );
}
