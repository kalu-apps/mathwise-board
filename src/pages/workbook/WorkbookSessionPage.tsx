import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
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
  appendWorkbookPreview,
  appendWorkbookStrokePreview,
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
} from "@/features/workbook/model/api";
import type {
  WorkbookBoardSettings,
  WorkbookBoardObject,
  WorkbookChatMessage,
  WorkbookComment,
  WorkbookConstraint,
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
  recognizeSmartInkBatch,
  recognizeSmartInkStroke,
  type SmartInkDetectedResult,
} from "@/features/workbook/model/smartInk";
import { PageLoader } from "@/shared/ui/loading";
import { generateId } from "@/shared/lib/id";
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
const OBJECT_UPDATE_FLUSH_INTERVAL_MS = 16;
const OBJECT_PREVIEW_FLUSH_INTERVAL_MS = 16;
const STROKE_PREVIEW_FLUSH_INTERVAL_MS = 24;
const STROKE_PREVIEW_EXPIRY_MS = 3_000;
const VIEWPORT_SYNC_MIN_INTERVAL_MS = 18;
const VIEWPORT_SYNC_EPSILON = 0.2;
const MAX_INCOMING_PREVIEW_PATCHES_PER_OBJECT = 20;
const ERASER_RADIUS_MIN = 4;
const ERASER_RADIUS_MAX = 160;
const EXPORT_BOUNDS_PADDING = 48;
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

const WORKBOOK_PDF_IMPORT_MAX_BYTES = 15 * 1024 * 1024;
const WORKBOOK_IMAGE_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "jpe",
  "jfif",
  "pjpeg",
  "pjp",
  "gif",
  "bmp",
  "webp",
  "svg",
  "avif",
  "apng",
  "tif",
  "tiff",
  "ico",
  "heic",
  "heif",
]);

const readFileExtension = (fileName: string) => {
  const safeName = typeof fileName === "string" ? fileName.trim().toLowerCase() : "";
  const dotIndex = safeName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= safeName.length - 1) return "";
  return safeName.slice(dotIndex + 1);
};

const isPdfUploadFile = (file: File) =>
  file.type.toLowerCase().includes("pdf") || readFileExtension(file.name) === "pdf";

const isImageUploadFile = (file: File) => {
  if (file.type.toLowerCase().startsWith("image/")) return true;
  return SUPPORTED_IMAGE_EXTENSIONS.has(readFileExtension(file.name));
};

const formatFileSizeMb = (bytes: number) =>
  `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)} МБ`;

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

const HISTORY_EVENT_TYPES = new Set<WorkbookEvent["type"]>([
  "board.stroke",
  "board.stroke.delete",
  "annotations.stroke",
  "annotations.stroke.delete",
  "board.object.create",
  "board.object.update",
  "board.object.delete",
  "board.object.pin",
  "board.clear",
  "annotations.clear",
  "geometry.constraint.add",
  "geometry.constraint.remove",
  "board.settings.update",
  "document.asset.add",
  "document.annotation.add",
  "document.annotation.clear",
]);

const DIRTY_EVENT_TYPES = new Set<WorkbookEvent["type"]>([
  ...HISTORY_EVENT_TYPES,
  "chat.message",
  "chat.message.delete",
  "chat.clear",
  "comments.upsert",
  "comments.remove",
  "timer.update",
  "settings.update",
  "permissions.update",
]);

const compactWorkbookObjectUpdateEvents = (events: WorkbookEvent[]) => {
  if (events.length <= 1) return events;
  const compacted: WorkbookEvent[] = [];
  const pendingByTypeAndObjectId = new Map<string, WorkbookEvent>();
  const removePendingByObjectId = (objectId: string) => {
    if (!objectId || pendingByTypeAndObjectId.size === 0) return;
    const suffix = `:${objectId}`;
    Array.from(pendingByTypeAndObjectId.keys()).forEach((key) => {
      if (key.endsWith(suffix)) {
        pendingByTypeAndObjectId.delete(key);
      }
    });
  };
  const flushPending = () => {
    if (pendingByTypeAndObjectId.size === 0) return;
    pendingByTypeAndObjectId.forEach((event) => compacted.push(event));
    pendingByTypeAndObjectId.clear();
  };
  events.forEach((event) => {
    if (event.type === "board.object.update") {
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as { objectId?: unknown; patch?: unknown })
          : null;
      const objectId = payload && typeof payload.objectId === "string" ? payload.objectId : "";
      const patch =
        payload?.patch && typeof payload.patch === "object"
          ? (payload.patch as Partial<WorkbookBoardObject>)
          : null;
      if (!objectId || !patch) {
        flushPending();
        compacted.push(event);
        return;
      }
      const eventKey = `${event.type}:${objectId}`;
      const previous = pendingByTypeAndObjectId.get(eventKey);
      if (previous) {
        const previousPayload =
          previous.payload && typeof previous.payload === "object"
            ? (previous.payload as {
                objectId: string;
                patch: Partial<WorkbookBoardObject>;
              })
            : { objectId, patch: {} as Partial<WorkbookBoardObject> };
        pendingByTypeAndObjectId.set(eventKey, {
          ...event,
          payload: {
            objectId,
            patch: {
              ...previousPayload.patch,
              ...patch,
            },
          },
        });
      } else {
        pendingByTypeAndObjectId.set(eventKey, event);
      }
      return;
    }
    if (
      event.type === "board.object.preview" ||
      event.type === "board.stroke.preview" ||
      event.type === "annotations.stroke.preview"
    ) {
      flushPending();
      compacted.push(event);
      return;
    }
    const deletedObjectId =
      event.type === "board.object.delete" &&
      event.payload &&
      typeof event.payload === "object" &&
      typeof (event.payload as { objectId?: unknown }).objectId === "string"
        ? ((event.payload as { objectId: string }).objectId ?? "")
        : "";
    if (deletedObjectId) {
      removePendingByObjectId(deletedObjectId);
    }
    flushPending();
    compacted.push(event);
  });
  flushPending();
  return compacted;
};

const VOLATILE_WORKBOOK_EVENT_TYPES = new Set<WorkbookEvent["type"]>([
  "board.object.preview",
  "board.stroke.preview",
  "annotations.stroke.preview",
  "board.viewport.sync",
  "presence.sync",
]);

const resolveNextLatestSeq = (
  currentLatestSeq: number,
  responseLatestSeq: number,
  events: WorkbookEvent[]
) => {
  if (events.length === 0) {
    return Math.max(0, currentLatestSeq, responseLatestSeq);
  }
  return Math.max(0, currentLatestSeq, responseLatestSeq, ...events.map((event) => event.seq));
};

const hasWorkbookEventGap = (currentLatestSeq: number, events: WorkbookEvent[]) => {
  const sequenced = events
    .filter(
      (event) =>
        !VOLATILE_WORKBOOK_EVENT_TYPES.has(event.type) &&
        typeof event.seq === "number" &&
        Number.isFinite(event.seq)
    )
    .map((event) => Math.trunc(event.seq))
    .sort((left, right) => left - right)
    .filter((seq, index, source) => index === 0 || source[index - 1] !== seq);
  if (sequenced.length === 0) return false;
  let expected = Math.max(0, Math.trunc(currentLatestSeq)) + 1;
  for (const seq of sequenced) {
    if (seq < expected) continue;
    if (seq > expected) return true;
    expected = seq + 1;
  }
  return false;
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
      const typedSection = section as { points?: unknown };
      if (!Array.isArray(typedSection.points)) return;
      typedSection.points.forEach((point: unknown) => {
        if (point && typeof point === "object" && typeof (point as { label?: unknown }).label === "string") {
          labels.push((point as { label: string }).label);
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

const mergeBoardObjectWithPatch = (
  current: WorkbookBoardObject,
  patch: Partial<WorkbookBoardObject>
): WorkbookBoardObject => {
  const hasMetaPatch = Object.prototype.hasOwnProperty.call(patch, "meta");
  if (!hasMetaPatch) {
    return {
      ...current,
      ...patch,
    };
  }
  const patchMeta = patch.meta;
  if (!patchMeta || typeof patchMeta !== "object" || Array.isArray(patchMeta)) {
    return {
      ...current,
      ...patch,
      meta: patchMeta,
    };
  }
  const currentMeta =
    current.meta && typeof current.meta === "object" && !Array.isArray(current.meta)
      ? (current.meta as Record<string, unknown>)
      : {};
  const nextMeta = {
    ...currentMeta,
    ...(patchMeta as Record<string, unknown>),
  };
  return {
    ...current,
    ...patch,
    meta: nextMeta,
  };
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

type WorkbookExportBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

const mergeExportBounds = (
  left: WorkbookExportBounds | null,
  right: WorkbookExportBounds | null
) => {
  if (!left) return right;
  if (!right) return left;
  const minX = Math.min(left.minX, right.minX);
  const minY = Math.min(left.minY, right.minY);
  const maxX = Math.max(left.maxX, right.maxX);
  const maxY = Math.max(left.maxY, right.maxY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const padExportBounds = (bounds: WorkbookExportBounds, padding: number): WorkbookExportBounds => {
  const safePadding = Math.max(0, padding);
  const minX = bounds.minX - safePadding;
  const minY = bounds.minY - safePadding;
  const maxX = bounds.maxX + safePadding;
  const maxY = bounds.maxY + safePadding;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const getStrokeExportBounds = (stroke: WorkbookStroke): WorkbookExportBounds | null => {
  if (!Array.isArray(stroke.points) || stroke.points.length === 0) return null;
  const pointsBounds = getPointsBounds(stroke.points);
  const width = Math.max(1, stroke.width ?? 1);
  const halfWidth = width / 2;
  const minX = pointsBounds.minX - halfWidth;
  const minY = pointsBounds.minY - halfWidth;
  const maxX = pointsBounds.maxX + halfWidth;
  const maxY = pointsBounds.maxY + halfWidth;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

const rotatePointAroundCenter = (
  point: WorkbookPoint,
  center: WorkbookPoint,
  angleDeg: number
): WorkbookPoint => {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

const getObjectExportBounds = (object: WorkbookBoardObject): WorkbookExportBounds => {
  const left = Math.min(object.x, object.x + object.width);
  const right = Math.max(object.x, object.x + object.width);
  const top = Math.min(object.y, object.y + object.height);
  const bottom = Math.max(object.y, object.y + object.height);
  const center = {
    x: left + (right - left) / 2,
    y: top + (bottom - top) / 2,
  };
  const basePoints: WorkbookPoint[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    ...(Array.isArray(object.points) ? object.points : []),
  ];
  const rotation =
    typeof object.rotation === "number" && Number.isFinite(object.rotation)
      ? object.rotation
      : 0;
  const boundsPoints =
    Math.abs(rotation) > 1e-3
      ? basePoints.map((point) => rotatePointAroundCenter(point, center, rotation))
      : basePoints;
  const baseBounds = getPointsBounds(boundsPoints);
  const strokePadding = Math.max(1, (object.strokeWidth ?? 1) / 2);
  return padExportBounds(baseBounds, strokePadding);
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

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });

const loadImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = dataUrl;
  });

const optimizeImageDataUrl = async (
  dataUrl: string,
  options?: { maxEdge?: number; quality?: number; maxChars?: number }
) => {
  if (typeof document === "undefined") return dataUrl;
  const image = await loadImageFromDataUrl(dataUrl);
  const maxEdge = Math.max(720, options?.maxEdge ?? 1_920);
  const quality = Math.max(0.5, Math.min(0.95, options?.quality ?? 0.84));
  const maxChars = Math.max(120_000, options?.maxChars ?? 420_000);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height);
  const ratio = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  let targetWidth = Math.max(1, Math.round(sourceWidth * ratio));
  let targetHeight = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  const renderCandidate = (width: number, height: number, outputQuality: number) => {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", outputQuality);
  };
  const original = typeof dataUrl === "string" ? dataUrl : "";
  let best = renderCandidate(targetWidth, targetHeight, quality);
  if (!best) best = original;
  if (original && original.length < best.length) {
    best = original;
  }
  if (best.length <= maxChars) return best;
  let nextQuality = quality;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    nextQuality = Math.max(0.28, nextQuality * 0.86);
    if (attempt % 2 === 1 || best.length > maxChars * 1.6) {
      targetWidth = Math.max(96, Math.round(targetWidth * 0.82));
      targetHeight = Math.max(96, Math.round(targetHeight * 0.82));
    }
    const candidate = renderCandidate(targetWidth, targetHeight, nextQuality);
    if (candidate && candidate.length < best.length) {
      best = candidate;
    }
    if (best.length <= maxChars) break;
  }
  return best;
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

type ToolPaintSettings = {
  color: string;
  width: number;
};

export default function WorkbookSessionPage() {
  const { user, openAuthModal } = useAuth();
  const { sessionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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
  const [penToolSettings, setPenToolSettings] = useState<ToolPaintSettings>({
    color: defaultColorByLayer.board,
    width: getDefaultToolWidth("pen"),
  });
  const [highlighterToolSettings, setHighlighterToolSettings] = useState<ToolPaintSettings>({
    color: "#ffd54f",
    width: getDefaultToolWidth("highlighter"),
  });
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
  const [solid3dSectionPointTarget, setSolid3dSectionPointTarget] = useState<{
    sectionId: string;
    pointIndex: number;
  } | null>(null);
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
  const [solid3dPointContextMenu, setSolid3dPointContextMenu] = useState<{
    objectId: string;
    sectionId: string;
    pointIndex: number;
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
  const [shapeSegmentNoteDrafts, setShapeSegmentNoteDrafts] = useState<string[]>([]);
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
  const [isSessionChatOpen, setIsSessionChatOpen] = useState(false);
  const [isSessionChatMinimized, setIsSessionChatMinimized] = useState(false);
  const [isSessionChatMaximized, setIsSessionChatMaximized] = useState(false);
  const [isParticipantsCollapsed, setIsParticipantsCollapsed] = useState(false);
  const [isSessionChatAtBottom, setIsSessionChatAtBottom] = useState(true);
  const [isWorkbookStreamConnected, setIsWorkbookStreamConnected] = useState(false);
  const [sessionChatDraft, setSessionChatDraft] = useState("");
  const [isSessionChatEmojiOpen, setIsSessionChatEmojiOpen] = useState(false);
  const [sessionChatPosition, setSessionChatPosition] = useState({ x: 24, y: 96 });
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
  const workspaceRef = useRef<HTMLDivElement | null>(null);
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
  const undoStackRef = useRef<WorkbookSceneSnapshot[]>([]);
  const redoStackRef = useRef<WorkbookSceneSnapshot[]>([]);
  const latestSeqRef = useRef(0);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const sessionChatListRef = useRef<HTMLDivElement | null>(null);
  const sessionChatRef = useRef<HTMLDivElement | null>(null);
  const sessionChatShouldScrollToUnreadRef = useRef(false);
  const sessionChatDragStateRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const presenceLeaveSentRef = useRef(false);
  const sessionResyncInFlightRef = useRef(false);
  const boardObjectsRef = useRef<WorkbookBoardObject[]>([]);
  const boardSettingsRef = useRef<WorkbookBoardSettings>(DEFAULT_BOARD_SETTINGS);
  const objectUpdateQueuedPatchRef = useRef<
    Map<string, Partial<WorkbookBoardObject>>
  >(new Map());
  const objectUpdateTimersRef = useRef<Map<string, number>>(new Map());
  const objectUpdateInFlightRef = useRef<Set<string>>(new Set());
  const objectUpdateDispatchOptionsRef = useRef<
    Map<string, { trackHistory: boolean; markDirty: boolean }>
  >(new Map());
  const objectPreviewQueuedPatchRef = useRef<
    Map<string, Partial<WorkbookBoardObject>>
  >(new Map());
  const objectPreviewTimersRef = useRef<Map<string, number>>(new Map());
  const objectPreviewInFlightByObjectRef = useRef<Map<string, number>>(new Map());
  const objectPreviewVersionRef = useRef<Map<string, number>>(new Map());
  const incomingPreviewQueuedPatchRef = useRef<
    Map<string, Partial<WorkbookBoardObject>[]>
  >(new Map());
  const incomingPreviewVersionByAuthorObjectRef = useRef<Map<string, number>>(new Map());
  const strokePreviewQueuedByIdRef = useRef<
    Map<string, { stroke: WorkbookStroke; previewVersion: number }>
  >(new Map());
  const strokePreviewTimersRef = useRef<Map<string, number>>(new Map());
  const strokePreviewInFlightVersionByIdRef = useRef<Map<string, number>>(new Map());
  const incomingStrokePreviewQueuedRef = useRef<Map<string, StrokePreviewEntry | null>>(
    new Map()
  );
  const incomingStrokePreviewFrameRef = useRef<number | null>(null);
  const incomingStrokePreviewVersionRef = useRef<Map<string, number>>(new Map());
  const finalizedStrokePreviewIdsRef = useRef<Set<string>>(new Set());
  const objectLastCommittedEventAtRef = useRef<Map<string, number>>(new Map());
  const incomingPreviewFrameRef = useRef<number | null>(null);
  const viewportSyncFrameRef = useRef<number | null>(null);
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
    boardObjectsRef.current = boardObjects;
  }, [boardObjects]);

  useEffect(() => {
    boardSettingsRef.current = boardSettings;
  }, [boardSettings]);

  useEffect(() => {
    if (!showCollaborationPanels) {
      setIsParticipantsCollapsed(false);
    }
  }, [showCollaborationPanels]);

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

  const filterUnseenWorkbookEvents = useCallback((events: WorkbookEvent[]) => {
    const unseen: WorkbookEvent[] = [];
    events.forEach((event) => {
      if (
        !VOLATILE_WORKBOOK_EVENT_TYPES.has(event.type) &&
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
    objectUpdateTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    objectPreviewTimersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    objectUpdateTimersRef.current.clear();
    objectUpdateInFlightRef.current.clear();
    objectUpdateDispatchOptionsRef.current.clear();
    objectPreviewTimersRef.current.clear();
    objectPreviewQueuedPatchRef.current.clear();
    objectPreviewInFlightByObjectRef.current.clear();
    objectPreviewVersionRef.current.clear();
    incomingPreviewQueuedPatchRef.current.clear();
    incomingPreviewVersionByAuthorObjectRef.current.clear();
    objectLastCommittedEventAtRef.current.clear();
    if (options?.cancelIncomingFrame !== false && incomingPreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(incomingPreviewFrameRef.current);
      incomingPreviewFrameRef.current = null;
    }
  }, []);

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
      const previewTimer = strokePreviewTimersRef.current.get(strokeId);
      if (previewTimer !== undefined) {
        window.clearTimeout(previewTimer);
        strokePreviewTimersRef.current.delete(strokeId);
      }
      strokePreviewQueuedByIdRef.current.delete(strokeId);
      strokePreviewInFlightVersionByIdRef.current.delete(strokeId);
      incomingStrokePreviewVersionRef.current.delete(strokeId);
      queueIncomingStrokePreview(null, strokeId);
    },
    [queueIncomingStrokePreview]
  );

  const clearStrokePreviewRuntime = useCallback(
    (options?: { clearFinalized?: boolean; cancelIncomingFrame?: boolean }) => {
      strokePreviewQueuedByIdRef.current.clear();
      strokePreviewTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      strokePreviewTimersRef.current.clear();
      strokePreviewInFlightVersionByIdRef.current.clear();
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
    const patches = new Map<string, Partial<WorkbookBoardObject>>();
    queue.forEach((pendingQueue, objectId) => {
      const nextPatch = pendingQueue.shift();
      if (nextPatch) {
        patches.set(objectId, nextPatch);
      }
      if (pendingQueue.length === 0) {
        queue.delete(objectId);
      } else {
        queue.set(objectId, pendingQueue);
      }
    });
    if (patches.size === 0) return;
    setBoardObjects((current) => {
      if (current.length === 0) return current;
      let changed = false;
      const next = current.map((item) => {
        const patch = patches.get(item.id);
        if (!patch) return item;
        changed = true;
        return mergeBoardObjectWithPatch(item, patch);
      });
      return changed ? next : current;
    });
    if (queue.size > 0 && typeof window !== "undefined") {
      incomingPreviewFrameRef.current = window.requestAnimationFrame(() => {
        flushIncomingPreviewQueue();
      });
    }
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
      session &&
      (session.kind === "PERSONAL" ||
        session.settings.undoPolicy === "everyone" ||
        (session.settings.undoPolicy === "teacher_only" && isTeacherActor) ||
        (session.settings.undoPolicy === "own_only" && isTeacherActor))
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

  const captureSceneSnapshot = useCallback((): WorkbookSceneSnapshot => {
    const clone = <T,>(value: T): T => structuredClone(value);
    return {
      boardStrokes: clone(boardStrokes),
      boardObjects: clone(boardObjects),
      constraints: clone(constraints),
      annotationStrokes: clone(annotationStrokes),
      chatMessages: clone(chatMessages),
      comments: clone(comments),
      timerState: timerState ? clone(timerState) : null,
      boardSettings: clone(boardSettings),
      libraryState: clone(libraryState),
      documentState: clone(documentState),
    };
  }, [
    annotationStrokes,
    boardObjects,
    boardSettings,
    boardStrokes,
    comments,
    constraints,
    chatMessages,
    documentState,
    libraryState,
    timerState,
  ]);

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

  const toScenePayload = useCallback(
    (snapshot: WorkbookSceneSnapshot) =>
      encodeScenePayload({
        strokes: [...snapshot.boardStrokes, ...snapshot.annotationStrokes],
        objects: snapshot.boardObjects,
        constraints: snapshot.constraints,
        chat: snapshot.chatMessages,
        comments: snapshot.comments,
        timer: snapshot.timerState,
        boardSettings: snapshot.boardSettings,
        library: snapshot.libraryState,
        document: snapshot.documentState,
      }),
    []
  );

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

  const pushHistorySnapshot = useCallback(() => {
    const snapshot = captureSceneSnapshot();
    const nextUndo = [...undoStackRef.current, snapshot];
    undoStackRef.current = nextUndo.slice(-80);
    redoStackRef.current = [];
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(0);
  }, [captureSceneSnapshot]);

  const rollbackHistorySnapshot = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoDepth(undoStackRef.current.length);
  }, []);

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
        if (event.type === "presence.sync") {
          const payload = event.payload as { participants?: unknown };
          if (!Array.isArray(payload.participants)) return;
          const participants = payload.participants as WorkbookSessionParticipant[];
          setSession((current) =>
            current
              ? areParticipantsEqual(current.participants, participants)
                ? current
                : {
                    ...current,
                    participants,
                  }
              : current
          );
          return;
        }
        if (event.type === "board.viewport.sync") {
          if (event.authorUserId === user?.id) return;
          const payload = event.payload as { offset?: unknown };
          const rawOffset =
            payload.offset && typeof payload.offset === "object"
              ? (payload.offset as Partial<WorkbookPoint>)
              : null;
          if (
            !rawOffset ||
            typeof rawOffset.x !== "number" ||
            !Number.isFinite(rawOffset.x) ||
            typeof rawOffset.y !== "number" ||
            !Number.isFinite(rawOffset.y)
          ) {
            return;
          }
          const offset: WorkbookPoint = { x: rawOffset.x, y: rawOffset.y };
          viewportLastReceivedAtRef.current = Date.now();
          setCanvasViewport((current) => {
            if (
              Math.abs(current.x - offset.x) <= VIEWPORT_SYNC_EPSILON &&
              Math.abs(current.y - offset.y) <= VIEWPORT_SYNC_EPSILON
            ) {
              return current;
            }
            return { x: offset.x, y: offset.y };
          });
          return;
        }
        if (event.type === "board.undo" || event.type === "board.redo") {
          const payload = event.payload as { scene?: unknown };
          if (!payload.scene || typeof payload.scene !== "object") return;
          clearObjectSyncRuntime();
          clearStrokePreviewRuntime();
          const normalized = normalizeScenePayload(payload.scene);
          restoreSceneSnapshot({
            boardStrokes: normalized.strokes.filter((stroke) => stroke.layer === "board"),
            boardObjects: normalized.objects,
            constraints: normalized.constraints,
            annotationStrokes: normalized.strokes.filter(
              (stroke) => stroke.layer === "annotations"
            ),
            chatMessages: normalized.chat,
            comments: normalized.comments,
            timerState: normalized.timer,
            boardSettings: normalized.boardSettings,
            libraryState: normalized.library,
            documentState: normalized.document,
          });
          return;
        }
        if (event.type === "board.stroke.preview" || event.type === "annotations.stroke.preview") {
          if (event.authorUserId === user?.id) return;
          const payload = event.payload as {
            stroke?: unknown;
            previewVersion?: unknown;
          };
          const stroke = normalizeStrokePayload(payload.stroke);
          if (!stroke) return;
          if (finalizedStrokePreviewIdsRef.current.has(stroke.id)) return;
          const previewVersion =
            typeof payload.previewVersion === "number" && Number.isFinite(payload.previewVersion)
              ? Math.max(1, Math.trunc(payload.previewVersion))
              : 0;
          const appliedVersion = incomingStrokePreviewVersionRef.current.get(stroke.id) ?? 0;
          if (previewVersion > 0 && previewVersion <= appliedVersion) return;
          if (previewVersion > 0) {
            incomingStrokePreviewVersionRef.current.set(stroke.id, previewVersion);
          }
          queueIncomingStrokePreview(
            {
              stroke,
              previewVersion,
              updatedAt: Date.now(),
            },
            stroke.id
          );
          return;
        }
        if (event.type === "board.stroke") {
          const stroke = normalizeStrokePayload((event.payload as { stroke?: unknown })?.stroke);
          if (!stroke || stroke.layer !== "board") return;
          finalizeStrokePreview(stroke.id);
          setBoardStrokes((current) =>
            current.some((item) => item.id === stroke.id) ? current : [...current, stroke]
          );
          return;
        }
        if (event.type === "board.stroke.delete") {
          const strokeId = (event.payload as { strokeId?: unknown })?.strokeId;
          if (typeof strokeId !== "string") return;
          finalizeStrokePreview(strokeId);
          setBoardStrokes((current) => current.filter((item) => item.id !== strokeId));
          return;
        }
        if (event.type === "annotations.stroke") {
          const stroke = normalizeStrokePayload((event.payload as { stroke?: unknown })?.stroke);
          if (!stroke || stroke.layer !== "annotations") return;
          finalizeStrokePreview(stroke.id);
          setAnnotationStrokes((current) =>
            current.some((item) => item.id === stroke.id) ? current : [...current, stroke]
          );
          return;
        }
        if (event.type === "annotations.stroke.delete") {
          const strokeId = (event.payload as { strokeId?: unknown })?.strokeId;
          if (typeof strokeId !== "string") return;
          finalizeStrokePreview(strokeId);
          setAnnotationStrokes((current) => current.filter((item) => item.id !== strokeId));
          return;
        }
        if (event.type === "board.object.create") {
          const object = normalizeObjectPayload((event.payload as { object?: unknown })?.object);
          if (!object) return;
          objectLastCommittedEventAtRef.current.set(object.id, eventTimestamp);
          setBoardObjects((current) =>
            current.some((item) => item.id === object.id) ? current : [...current, object]
          );
          return;
        }
        if (event.type === "board.object.update") {
          const payload = event.payload as {
            objectId?: unknown;
            patch?: unknown;
          };
          const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
          const patch =
            payload.patch && typeof payload.patch === "object"
              ? (payload.patch as Partial<WorkbookBoardObject>)
              : null;
          if (!objectId || !patch) return;
          objectLastCommittedEventAtRef.current.set(objectId, eventTimestamp);
          const shouldKeepLocalTextDraft =
            selectedTextDraftDirtyRef.current &&
            selectedTextDraftObjectIdRef.current === objectId &&
            event.authorUserId === user?.id &&
            typeof patch.text === "string";
          let safePatch = patch;
          if (shouldKeepLocalTextDraft) {
            safePatch = { ...patch };
            delete safePatch.text;
            if (Object.keys(safePatch).length === 0) return;
          }
          incomingPreviewQueuedPatchRef.current.delete(objectId);
          setBoardObjects((current) => {
            let found = false;
            const next = current.map((item) => {
              if (item.id !== objectId) return item;
              found = true;
              return mergeBoardObjectWithPatch(item, safePatch);
            });
            return found ? next : current;
          });
          return;
        }
        if (event.type === "board.object.preview") {
          if (event.authorUserId === user?.id) return;
          const payload = event.payload as {
            objectId?: unknown;
            patch?: unknown;
            previewVersion?: unknown;
          };
          const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
          const patch =
            payload.patch && typeof payload.patch === "object"
              ? (payload.patch as Partial<WorkbookBoardObject>)
              : null;
          if (!objectId || !patch) return;
          const committedAt = objectLastCommittedEventAtRef.current.get(objectId) ?? 0;
          if (committedAt > 0 && eventTimestamp <= committedAt) return;
          const previewVersion =
            typeof payload.previewVersion === "number" && Number.isFinite(payload.previewVersion)
              ? Math.max(1, Math.trunc(payload.previewVersion))
              : null;
          if (previewVersion !== null) {
            const versionKey = `${event.authorUserId ?? "unknown"}:${objectId}`;
            const appliedVersion =
              incomingPreviewVersionByAuthorObjectRef.current.get(versionKey) ?? 0;
            if (previewVersion <= appliedVersion) return;
            incomingPreviewVersionByAuthorObjectRef.current.set(versionKey, previewVersion);
          }
          queueIncomingPreviewPatch(objectId, patch);
          return;
        }
        if (event.type === "board.object.delete") {
          const objectId = (event.payload as { objectId?: unknown })?.objectId;
          if (typeof objectId !== "string") return;
          objectLastCommittedEventAtRef.current.set(objectId, eventTimestamp);
          objectUpdateQueuedPatchRef.current.delete(objectId);
          objectUpdateDispatchOptionsRef.current.delete(objectId);
          objectPreviewQueuedPatchRef.current.delete(objectId);
          objectUpdateInFlightRef.current.delete(objectId);
          objectPreviewInFlightByObjectRef.current.delete(objectId);
          objectPreviewVersionRef.current.delete(objectId);
          incomingPreviewQueuedPatchRef.current.delete(objectId);
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
          const pendingPreviewTimer = objectPreviewTimersRef.current.get(objectId);
          if (pendingPreviewTimer !== undefined) {
            window.clearTimeout(pendingPreviewTimer);
            objectPreviewTimersRef.current.delete(objectId);
          }
          setBoardObjects((current) => current.filter((item) => item.id !== objectId));
          setConstraints((current) =>
            current.filter(
              (constraint) =>
                constraint.sourceObjectId !== objectId &&
                constraint.targetObjectId !== objectId
            )
          );
          if (selectedObjectId === objectId) {
            setSelectedObjectId(null);
          }
          return;
        }
        if (event.type === "board.object.pin") {
          const payload = event.payload as {
            objectId?: unknown;
            pinned?: unknown;
          };
          const objectId = typeof payload.objectId === "string" ? payload.objectId : "";
          if (!objectId) return;
          setBoardObjects((current) =>
            current.map((item) =>
              item.id === objectId ? { ...item, pinned: Boolean(payload.pinned) } : item
            )
          );
          return;
        }
        if (event.type === "board.clear") {
          setBoardStrokes([]);
          setBoardObjects([]);
          clearObjectSyncRuntime();
          clearStrokePreviewRuntime();
          setFocusPoint(null);
          setPointerPoint(null);
          setFocusPointsByUser({});
          setPointerPointsByUser({});
          focusResetTimersByUserRef.current.forEach((timerId) => {
            window.clearTimeout(timerId);
          });
          focusResetTimersByUserRef.current.clear();
          setConstraints([]);
          setSelectedObjectId(null);
          setSelectedConstraintId(null);
          setPendingClearRequest(null);
          setAwaitingClearRequest(null);
          return;
        }
        if (event.type === "annotations.clear") {
          clearStrokePreviewRuntime({ clearFinalized: false });
          setAnnotationStrokes([]);
          return;
        }
        if (event.type === "board.clear.request") {
          const payload = event.payload as {
            requestId?: unknown;
            targetLayer?: unknown;
          };
          const requestId =
            typeof payload.requestId === "string" ? payload.requestId : generateId();
          const targetLayer =
            payload.targetLayer === "annotations" ? "annotations" : "board";
          const request: ClearRequest = {
            requestId,
            targetLayer,
            authorUserId: event.authorUserId,
          };
          setPendingClearRequest(request);
          if (event.authorUserId === user?.id) {
            setAwaitingClearRequest(request);
          }
          return;
        }
        if (event.type === "board.clear.confirm") {
          const requestId = (event.payload as { requestId?: unknown })?.requestId;
          if (typeof requestId !== "string") return;
          if (awaitingClearRequest && awaitingClearRequest.requestId === requestId) {
            setConfirmedClearRequest(awaitingClearRequest);
          }
          setPendingClearRequest((current) => {
            if (!current || current.requestId !== requestId) return current;
            return null;
          });
          setAwaitingClearRequest((current) => {
            if (!current || current.requestId !== requestId) return current;
            return null;
          });
          return;
        }
        if (event.type === "focus.point") {
          const payload = event.payload as {
            target?: unknown;
            point?: unknown;
            mode?: unknown;
          };
          if (payload.target !== "board") return;
          const mode =
            payload.mode === "pin" || payload.mode === "move" || payload.mode === "clear"
              ? payload.mode
              : "flash";
          const authorKey = event.authorUserId || "unknown";
          if (mode === "clear") {
            if (event.authorUserId === user?.id) {
              setPointerPoint(null);
              setFocusPoint(null);
            }
            setPointerPointsByUser((current) => {
              if (!(authorKey in current)) return current;
              const next = { ...current };
              delete next[authorKey];
              return next;
            });
            setFocusPointsByUser((current) => {
              if (!(authorKey in current)) return current;
              const next = { ...current };
              delete next[authorKey];
              return next;
            });
            const existingTimer = focusResetTimersByUserRef.current.get(authorKey);
            if (existingTimer !== undefined) {
              window.clearTimeout(existingTimer);
              focusResetTimersByUserRef.current.delete(authorKey);
            }
            return;
          }
          const point = payload.point as Partial<WorkbookPoint> | undefined;
          if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
          const pointX = point.x;
          const pointY = point.y;
          if (mode === "pin" || mode === "move") {
            if (event.authorUserId === user?.id) {
              setPointerPoint({ x: pointX, y: pointY });
            }
            setPointerPointsByUser((current) => ({
              ...current,
              [authorKey]: { x: pointX, y: pointY },
            }));
          }
          if (event.authorUserId === user?.id) {
            setFocusPoint({ x: pointX, y: pointY });
          }
          setFocusPointsByUser((current) => ({
            ...current,
            [authorKey]: { x: pointX, y: pointY },
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
            if (event.authorUserId === user?.id) {
              setFocusPoint(null);
            }
            focusResetTimersByUserRef.current.delete(authorKey);
          }, 800);
          focusResetTimersByUserRef.current.set(authorKey, nextTimer);
          return;
        }
        if (event.type === "document.asset.add") {
          const asset = normalizeDocumentAssetPayload(
            (event.payload as { asset?: unknown })?.asset
          );
          if (!asset) return;
          setDocumentState((current) => ({
            ...current,
            assets: current.assets.some((item) => item.id === asset.id)
              ? current.assets
              : [...current.assets, asset],
            activeAssetId: current.activeAssetId ?? asset.id,
          }));
          return;
        }
        if (event.type === "document.state.update") {
          const payload = event.payload as {
            activeAssetId?: unknown;
            page?: unknown;
            zoom?: unknown;
          };
          setDocumentState((current) => ({
            ...current,
            activeAssetId:
              typeof payload.activeAssetId === "string"
                ? payload.activeAssetId
                : current.activeAssetId,
            page:
              typeof payload.page === "number" && Number.isFinite(payload.page)
                ? Math.max(1, Math.floor(payload.page))
                : current.page,
            zoom:
              typeof payload.zoom === "number" && Number.isFinite(payload.zoom)
                ? Math.max(0.2, Math.min(4, payload.zoom))
                : current.zoom,
          }));
          return;
        }
        if (event.type === "document.annotation.add") {
          const annotation = normalizeDocumentAnnotationPayload(
            (event.payload as { annotation?: unknown })?.annotation
          );
          if (!annotation) return;
          setDocumentState((current) => ({
            ...current,
            annotations: [...current.annotations, annotation],
          }));
          return;
        }
        if (event.type === "document.annotation.clear") {
          setDocumentState((current) => ({
            ...current,
            annotations: [],
          }));
          return;
        }
        if (event.type === "geometry.constraint.add") {
          const payload = event.payload as { constraint?: unknown };
          if (!payload.constraint || typeof payload.constraint !== "object") return;
          const typed = payload.constraint as WorkbookConstraint;
          if (!typed.id || !typed.type || !typed.sourceObjectId || !typed.targetObjectId) {
            return;
          }
          setConstraints((current) => {
            const exists = current.some((item) => item.id === typed.id);
            if (!exists) return [...current, typed];
            return current.map((item) => (item.id === typed.id ? { ...item, ...typed } : item));
          });
          return;
        }
        if (event.type === "geometry.constraint.remove") {
          const constraintId = (event.payload as { constraintId?: unknown })?.constraintId;
          if (typeof constraintId !== "string") return;
          setConstraints((current) => current.filter((item) => item.id !== constraintId));
          setSelectedConstraintId((current) =>
            current === constraintId ? null : current
          );
          return;
        }
        if (event.type === "board.settings.update") {
          const payload = event.payload as { boardSettings?: unknown };
          if (!payload.boardSettings || typeof payload.boardSettings !== "object") return;
          setBoardSettings((current) => {
            const merged = {
              ...current,
              ...(payload.boardSettings as Partial<WorkbookBoardSettings>),
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
        if (event.type === "library.folder.upsert") {
          const payload = event.payload as { folder?: unknown };
          if (!payload.folder || typeof payload.folder !== "object") return;
          const folder = payload.folder as WorkbookLibraryState["folders"][number];
          if (!folder.id) return;
          setLibraryState((current) => {
            const exists = current.folders.some((item) => item.id === folder.id);
            return {
              ...current,
              folders: exists
                ? current.folders.map((item) =>
                    item.id === folder.id ? { ...item, ...folder } : item
                  )
                : [...current.folders, folder],
            };
          });
          return;
        }
        if (event.type === "library.folder.remove") {
          const payload = event.payload as { folderId?: unknown };
          if (typeof payload.folderId !== "string") return;
          setLibraryState((current) => ({
            ...current,
            folders: current.folders.filter((item) => item.id !== payload.folderId),
            items: current.items.map((item) =>
              item.folderId === payload.folderId ? { ...item, folderId: null } : item
            ),
          }));
          return;
        }
        if (event.type === "library.item.upsert") {
          const payload = event.payload as { item?: unknown };
          if (!payload.item || typeof payload.item !== "object") return;
          const item = payload.item as WorkbookLibraryState["items"][number];
          if (!item.id) return;
          setLibraryState((current) => {
            const exists = current.items.some((entry) => entry.id === item.id);
            return {
              ...current,
              items: exists
                ? current.items.map((entry) =>
                    entry.id === item.id ? { ...entry, ...item } : entry
                  )
                : [...current.items, item],
            };
          });
          return;
        }
        if (event.type === "library.item.remove") {
          const payload = event.payload as { itemId?: unknown };
          if (typeof payload.itemId !== "string") return;
          setLibraryState((current) => ({
            ...current,
            items: current.items.filter((item) => item.id !== payload.itemId),
          }));
          return;
        }
        if (event.type === "library.template.upsert") {
          const payload = event.payload as { template?: unknown };
          if (!payload.template || typeof payload.template !== "object") return;
          const template = payload.template as WorkbookLibraryState["templates"][number];
          if (!template.id) return;
          setLibraryState((current) => {
            const exists = current.templates.some((entry) => entry.id === template.id);
            return {
              ...current,
              templates: exists
                ? current.templates.map((entry) =>
                    entry.id === template.id ? { ...entry, ...template } : entry
                  )
                : [...current.templates, template],
            };
          });
          return;
        }
        if (event.type === "library.template.remove") {
          const payload = event.payload as { templateId?: unknown };
          if (typeof payload.templateId !== "string") return;
          setLibraryState((current) => ({
            ...current,
            templates: current.templates.filter(
              (template) => template.id !== payload.templateId
            ),
          }));
          return;
        }
        if (event.type === "comments.upsert") {
          const payload = event.payload as { comment?: unknown };
          if (!payload.comment || typeof payload.comment !== "object") return;
          const comment = payload.comment as WorkbookComment;
          if (!comment.id) return;
          setComments((current) => {
            const exists = current.some((item) => item.id === comment.id);
            return exists
              ? current.map((item) =>
                  item.id === comment.id ? { ...item, ...comment } : item
                )
              : [...current, comment];
          });
          return;
        }
        if (event.type === "comments.remove") {
          const payload = event.payload as { commentId?: unknown };
          if (typeof payload.commentId !== "string") return;
          setComments((current) =>
            current.filter((comment) => comment.id !== payload.commentId)
          );
          return;
        }
        if (event.type === "timer.update") {
          const payload = event.payload as { timer?: unknown };
          if (payload.timer === null) {
            setTimerState(null);
            return;
          }
          if (!payload.timer || typeof payload.timer !== "object") return;
          const timer = payload.timer as WorkbookTimerState;
          if (!timer.id) return;
          setTimerState(timer);
          return;
        }
        if (event.type === "settings.update") {
          const payload = event.payload as {
            settings?: Partial<WorkbookSessionSettings>;
          };
          const incomingSettings = payload.settings;
          if (!incomingSettings) return;
          setSession((current) =>
            current
              ? {
                  ...current,
                  settings: {
                    ...current.settings,
                    ...incomingSettings,
                    studentControls: {
                      ...current.settings.studentControls,
                      ...incomingSettings.studentControls,
                    },
                    smartInk: normalizeSmartInkOptions(incomingSettings.smartInk),
                  },
                }
              : current
          );
          if (incomingSettings.smartInk) {
            setSmartInkOptions(normalizeSmartInkOptions(incomingSettings.smartInk));
          }
          return;
        }
        if (event.type === "permissions.update") {
          const payload = event.payload as {
            userId?: unknown;
            permissions?: unknown;
          };
          const targetUserId =
            typeof payload.userId === "string" ? payload.userId : "";
          const patch =
            payload.permissions && typeof payload.permissions === "object"
              ? (payload.permissions as Partial<WorkbookSessionParticipant["permissions"]>)
              : null;
          if (!targetUserId || !patch) return;
          setSession((current) => {
            if (!current) return current;
            return {
              ...current,
              participants: current.participants.map((participant) =>
                participant.userId === targetUserId
                  ? {
                      ...participant,
                      permissions: {
                        ...participant.permissions,
                        ...patch,
                      },
                    }
                  : participant
              ),
            };
          });
          return;
        }
        if (event.type === "chat.message") {
          const message = normalizeChatMessagePayload(
            (event.payload as { message?: unknown })?.message
          );
          if (!message) return;
          setChatMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message]
          );
          return;
        }
        if (event.type === "chat.message.delete") {
          const messageId = (event.payload as { messageId?: unknown })?.messageId;
          if (typeof messageId !== "string" || !messageId) return;
          setChatMessages((current) => current.filter((item) => item.id !== messageId));
          return;
        }
        if (event.type === "chat.clear") {
          setChatMessages([]);
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
      clearObjectSyncRuntime,
      clearStrokePreviewRuntime,
      finalizeStrokePreview,
      queueIncomingStrokePreview,
      queueIncomingPreviewPatch,
      restoreSceneSnapshot,
      selectedObjectId,
      user?.id,
    ]
  );

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    clearStrokePreviewRuntime();
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

        const normalizedBoard = normalizeScenePayload(
          boardSnapshot?.payload ?? createEmptyScene()
        );
        const normalizedAnnotations = normalizeScenePayload(
          annotationSnapshot?.payload ?? createEmptyScene()
        );
        const restoredSmartInk = normalizeSmartInkOptions(
          normalizedBoard.boardSettings.smartInk ?? sessionData.settings?.smartInk
        );
        setSmartInkOptions(restoredSmartInk);

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
            smartInk: restoredSmartInk,
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
        setLoading(false);
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
        if (error instanceof ApiError) {
          if (error.status === 401) {
            setError("Сессия недоступна: требуется повторная авторизация.");
            openAuthModal();
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
    setLoading(false);
  }, [
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    openAuthModal,
    recoverChatMessagesFromEvents,
    sessionId,
  ]);

  const triggerSessionResync = useCallback(() => {
    if (sessionResyncInFlightRef.current) return;
    sessionResyncInFlightRef.current = true;
    void loadSession().finally(() => {
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
          triggerSessionResync();
          return;
        }
        if (unseenEvents.length > 0) {
          applyIncomingEvents(unseenEvents);
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
    const intervalMs = isWorkbookStreamConnected
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
          triggerSessionResync();
          return;
        }
        if (unseenEvents.length > 0) {
          applyIncomingEvents(unseenEvents);
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
    const normalized = normalizeSmartInkOptions(smartInkOptions);
    setBoardSettings((current) => ({
      ...current,
      smartInk: normalized,
    }));
  }, [smartInkOptions]);

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
      if (viewportSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportSyncFrameRef.current);
        viewportSyncFrameRef.current = null;
      }
      viewportSyncQueuedOffsetRef.current = null;
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

  const appendEventsAndApply = useCallback(
    async (
      events: Array<{ type: WorkbookEvent["type"]; payload: unknown }>,
      options?: {
        trackHistory?: boolean;
        markDirty?: boolean;
      }
    ) => {
      if (!sessionId) return;
      const trackHistory =
        options?.trackHistory ?? events.some((event) => HISTORY_EVENT_TYPES.has(event.type));
      const shouldMarkDirty =
        options?.markDirty ?? events.some((event) => DIRTY_EVENT_TYPES.has(event.type));
      if (trackHistory) {
        pushHistorySnapshot();
      }
      try {
        const response = await appendWorkbookEvents({
          sessionId,
          events,
        });
        const unseenEvents = filterUnseenWorkbookEvents(response.events);
        if (unseenEvents.length > 0) {
          applyIncomingEvents(unseenEvents);
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
        if (trackHistory) {
          rollbackHistorySnapshot();
        }
        throw error;
      }
    },
    [
      applyIncomingEvents,
      filterUnseenWorkbookEvents,
      markDirty,
      pushHistorySnapshot,
      rollbackHistorySnapshot,
      sessionId,
    ]
  );

  const flushQueuedViewportSync = useCallback(() => {
    viewportSyncFrameRef.current = null;
    const queuedOffset = viewportSyncQueuedOffsetRef.current;
    viewportSyncQueuedOffsetRef.current = null;
    if (!queuedOffset) return;
    if (!sessionId || !session || session.kind !== "CLASS" || isEnded) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = now - viewportSyncLastSentAtRef.current;
    if (elapsed < VIEWPORT_SYNC_MIN_INTERVAL_MS) {
      viewportSyncQueuedOffsetRef.current = queuedOffset;
      viewportSyncFrameRef.current = window.requestAnimationFrame(() => {
        flushQueuedViewportSync();
      });
      return;
    }
    viewportSyncLastSentAtRef.current = now;
    void appendEventsAndApply(
      [
        {
          type: "board.viewport.sync",
          payload: { offset: queuedOffset },
        },
      ],
      { trackHistory: false, markDirty: false }
    ).catch(() => {
      // ignore transient viewport sync errors, next interaction sends fresh offset
    });
  }, [appendEventsAndApply, isEnded, session, sessionId]);

  const queueViewportSync = useCallback(
    (offset: WorkbookPoint) => {
      viewportSyncQueuedOffsetRef.current = offset;
      if (viewportSyncFrameRef.current !== null) return;
      viewportSyncFrameRef.current = window.requestAnimationFrame(() => {
        flushQueuedViewportSync();
      });
    },
    [flushQueuedViewportSync]
  );

  const handleCanvasViewportOffsetChange = useCallback(
    (offset: WorkbookPoint) => {
      setCanvasViewport(offset);
      queueViewportSync(offset);
    },
    [queueViewportSync]
  );

  const flushQueuedStrokePreview = useCallback(
    (strokeId: string) => {
      if (strokePreviewTimersRef.current.has(strokeId)) return;
      const timerId = window.setTimeout(() => {
        strokePreviewTimersRef.current.delete(strokeId);
        if (!sessionId || !canDraw || finalizedStrokePreviewIdsRef.current.has(strokeId)) {
          strokePreviewQueuedByIdRef.current.delete(strokeId);
          strokePreviewInFlightVersionByIdRef.current.delete(strokeId);
          return;
        }
        if (strokePreviewInFlightVersionByIdRef.current.has(strokeId)) {
          flushQueuedStrokePreview(strokeId);
          return;
        }
        const queuedPreview = strokePreviewQueuedByIdRef.current.get(strokeId);
        if (!queuedPreview) return;
        strokePreviewQueuedByIdRef.current.delete(strokeId);
        strokePreviewInFlightVersionByIdRef.current.set(strokeId, queuedPreview.previewVersion);
        void appendWorkbookStrokePreview({
          sessionId,
          stroke: queuedPreview.stroke,
          previewVersion: queuedPreview.previewVersion,
        })
          .catch(() => {
            // ignore preview delivery errors: final board.stroke event will reconcile state
          })
          .finally(() => {
            const inFlightVersion = strokePreviewInFlightVersionByIdRef.current.get(strokeId);
            if (inFlightVersion === queuedPreview.previewVersion) {
              strokePreviewInFlightVersionByIdRef.current.delete(strokeId);
            }
            if (strokePreviewQueuedByIdRef.current.has(strokeId)) {
              flushQueuedStrokePreview(strokeId);
            }
          });
      }, STROKE_PREVIEW_FLUSH_INTERVAL_MS);
      strokePreviewTimersRef.current.set(strokeId, timerId);
    },
    [canDraw, sessionId]
  );

  const queueStrokePreview = useCallback(
    (payload: { stroke: WorkbookStroke; previewVersion: number }) => {
      const strokeId = payload.stroke.id;
      if (!strokeId || finalizedStrokePreviewIdsRef.current.has(strokeId)) return;
      strokePreviewQueuedByIdRef.current.set(strokeId, payload);
      flushQueuedStrokePreview(strokeId);
    },
    [flushQueuedStrokePreview]
  );

  const flushPreviewObjectUpdate = useCallback(
    (objectId: string) => {
      if (objectPreviewTimersRef.current.has(objectId)) return;
      const timerId = window.setTimeout(() => {
        objectPreviewTimersRef.current.delete(objectId);
        if (!sessionId || !canSelect) {
          objectPreviewQueuedPatchRef.current.delete(objectId);
          objectPreviewInFlightByObjectRef.current.delete(objectId);
          return;
        }
        if (objectPreviewInFlightByObjectRef.current.has(objectId)) {
          return;
        }
        const queuedPatch = objectPreviewQueuedPatchRef.current.get(objectId);
        if (!queuedPatch) return;
        objectPreviewQueuedPatchRef.current.delete(objectId);
        const nextPreviewVersion = (objectPreviewVersionRef.current.get(objectId) ?? 0) + 1;
        objectPreviewVersionRef.current.set(objectId, nextPreviewVersion);
        objectPreviewInFlightByObjectRef.current.set(objectId, nextPreviewVersion);
        void appendWorkbookPreview({
          sessionId,
          objectId,
          patch: queuedPatch as Partial<Record<string, unknown>>,
          previewVersion: nextPreviewVersion,
        })
          .catch(() => {
            // ignore preview delivery errors: authoritative object.update will reconcile state
          })
          .finally(() => {
            const inFlightVersion = objectPreviewInFlightByObjectRef.current.get(objectId);
            if (inFlightVersion === nextPreviewVersion) {
              objectPreviewInFlightByObjectRef.current.delete(objectId);
            }
            if (objectPreviewQueuedPatchRef.current.has(objectId)) {
              flushPreviewObjectUpdate(objectId);
            }
          });
      }, OBJECT_PREVIEW_FLUSH_INTERVAL_MS);
      objectPreviewTimersRef.current.set(objectId, timerId);
    },
    [canSelect, sessionId]
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
        objectUpdateInFlightRef.current.add(objectId);
        void appendEventsAndApply([
          {
            type: "board.object.update",
            payload: { objectId, patch: queuedPatch },
          },
        ], dispatchOptions)
          .catch((error) => {
            if (error instanceof ApiError && error.code === "not_found") {
              objectUpdateQueuedPatchRef.current.delete(objectId);
              objectUpdateDispatchOptionsRef.current.delete(objectId);
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

  const commitBoardSettings = useCallback(
    async (patch: Partial<WorkbookBoardSettings>) => {
      if (session?.kind === "CLASS" && !canManageSession) return;
      const mergedSettings = { ...boardSettings, ...patch };
      const normalizedLayers = normalizeSceneLayersForBoard(
        mergedSettings.sceneLayers,
        mergedSettings.activeSceneLayerId
      );
      const nextSettings: WorkbookBoardSettings = {
        ...mergedSettings,
        sceneLayers: normalizedLayers.sceneLayers,
        activeSceneLayerId: normalizedLayers.activeSceneLayerId,
      };
      try {
        await appendEventsAndApply([
          {
            type: "board.settings.update",
            payload: { boardSettings: nextSettings },
          },
        ]);
      } catch {
        setError("Не удалось сохранить настройки доски.");
      }
    },
    [appendEventsAndApply, boardSettings, canManageSession, session?.kind]
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

  const openUtilityPanel = useCallback(
    (
      tab: "settings" | "graph" | "transform" | "layers",
      options?: {
        toggle?: boolean;
      }
    ) => {
      const selectedUtilityObject =
        boardObjects.find((item) => item.id === selectedObjectId) ?? null;
      const canOpenTransformPanel = supportsTransformUtilityPanel(selectedUtilityObject);
      const canOpenGraphPanel = supportsGraphUtilityPanel(selectedUtilityObject);
      if (tab === "transform" && !canOpenTransformPanel) {
        return;
      }
      if (tab === "graph" && !canOpenGraphPanel) {
        return;
      }
      const allowToggle = options?.toggle ?? true;
      if (allowToggle && isUtilityPanelOpen && utilityTab === tab) {
        const isSolid3dSelected = Boolean(
          selectedObjectId &&
            boardObjects.some(
              (object) => object.id === selectedObjectId && object.type === "solid3d"
            )
        );
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
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      setUtilityPanelPosition((current) => {
        const fallbackX = Math.max(rect.left + 8, rect.right - 420);
        const fallbackY = Math.max(rect.top + 8, 86);
        const nextX = current.x > 0 ? current.x : fallbackX;
        const nextY = current.y > 0 ? current.y : fallbackY;
        const minX = rect.left + 8;
        const minY = rect.top + 8;
        const maxX = Math.max(minX + 24, rect.right - 320);
        const maxY = Math.max(minY + 24, rect.bottom - 120);
        return {
          x: Math.max(minX, Math.min(maxX, nextX)),
          y: Math.max(minY, Math.min(maxY, nextY)),
        };
      });
    },
    [
      boardObjects,
      isCompactViewport,
      isFullscreen,
      isUtilityPanelOpen,
      selectedObjectId,
      utilityTab,
    ]
  );

  const handleUtilityPanelDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isCompactViewport) return;
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
    if (isCompactViewport) {
      setUtilityPanelDragState(null);
      return;
    }
    if (!utilityPanelDragState) return;
    const onPointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - utilityPanelDragState.startClientX;
      const deltaY = event.clientY - utilityPanelDragState.startClientY;
      const workspaceRect = workspaceRef.current?.getBoundingClientRect();
      const minX = (workspaceRect?.left ?? 0) + 8;
      const minY = (workspaceRect?.top ?? 0) + 8;
      const maxX = Math.max(minX + 24, (workspaceRect?.right ?? window.innerWidth) - 320);
      const maxY = Math.max(minY + 24, (workspaceRect?.bottom ?? window.innerHeight) - 120);
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
  }, [isCompactViewport, utilityPanelDragState]);

  useEffect(() => {
    if (isCompactViewport) return;
    if (!isUtilityPanelOpen) return;
    if (!workspaceRef.current) return;
    setUtilityPanelPosition((current) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return current;
      const fallbackX = Math.max(rect.left + 8, rect.right - 420);
      const fallbackY = Math.max(rect.top + 8, 86);
      const nextX = current.x > 0 ? current.x : fallbackX;
      const nextY = current.y > 0 ? current.y : fallbackY;
      const minX = rect.left + 8;
      const minY = rect.top + 8;
      const maxX = Math.max(minX + 24, rect.right - 320);
      const maxY = Math.max(minY + 24, rect.bottom - 120);
      return {
        x: Math.max(minX, Math.min(maxX, nextX)),
        y: Math.max(minY, Math.min(maxY, nextY)),
      };
    });
  }, [isCompactViewport, isFullscreen, isUtilityPanelOpen]);

  const utilityPanelTitle = useMemo(() => {
    if (utilityTab === "settings") return "Настройки доски";
    if (utilityTab === "graph") return "Графики функции";
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
    try {
      await appendEventsAndApply([{ type, payload: { strokeId } }]);
    } catch {
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
    async (object: WorkbookBoardObject) => {
      if (!sessionId || !canDraw) return;
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
        objectWithPage.imageUrl.length > 46_000
      ) {
        objectWithPage = {
          ...objectWithPage,
          imageUrl: await optimizeImageDataUrl(objectWithPage.imageUrl, {
            maxEdge: 820,
            quality: 0.58,
            maxChars: 46_000,
          }),
        };
      }
      setBoardObjects((current) =>
        current.some((item) => item.id === objectWithPage.id)
          ? current
          : [...current, objectWithPage]
      );
      try {
        await appendEventsAndApply([
          {
            type: "board.object.create",
            payload: { object: objectWithPage },
          },
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
      } catch {
        setBoardObjects((current) =>
          current.filter((item) => item.id !== objectWithPage.id)
        );
        setSelectedObjectId((current) =>
          current === objectWithPage.id ? null : current
        );
        setError("Не удалось создать объект.");
      }
    },
    [
      activeSceneLayerId,
      appendEventsAndApply,
      boardSettings.currentPage,
      canDraw,
      sessionId,
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
        flushPreviewObjectUpdate(objectId);
        return;
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
      flushPreviewObjectUpdate,
      flushQueuedObjectUpdate,
      sessionId,
    ]
  );

  const commitObjectDelete = async (objectId: string) => {
    if (!sessionId || !canDelete) return;
    objectUpdateQueuedPatchRef.current.delete(objectId);
    objectUpdateDispatchOptionsRef.current.delete(objectId);
    objectPreviewQueuedPatchRef.current.delete(objectId);
    objectPreviewInFlightByObjectRef.current.delete(objectId);
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
    const previewTimer = objectPreviewTimersRef.current.get(objectId);
    if (previewTimer !== undefined) {
      window.clearTimeout(previewTimer);
      objectPreviewTimersRef.current.delete(objectId);
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
    setSelectedConstraintId(null);
    setSelectedObjectId(objectId);
    resetToolRuntimeToSelect();
    openUtilityPanel("transform", { toggle: false });
  }, [openUtilityPanel, resetToolRuntimeToSelect]);

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
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const raw = Array.isArray(target.meta?.angleNotes) ? target.meta.angleNotes : [];
      const next = vertices.map((_, itemIndex) =>
        typeof raw[itemIndex] === "string" ? raw[itemIndex] : ""
      );
      next[index] = value.slice(0, 24);
      await updateSelectedShape2dMeta({ angleNotes: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
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
      if (!selectedObjectId) return;
      const target = boardObjects.find((item) => item.id === selectedObjectId);
      if (!target || !is2dFigureObject(target)) return;
      const vertices = resolve2dFigureVertices(target);
      if (!vertices.length) return;
      const raw = Array.isArray(target.meta?.angleColors) ? target.meta.angleColors : [];
      const fallback = target.color || "#4f63ff";
      const next = vertices.map((_, itemIndex) =>
        typeof raw[itemIndex] === "string" && raw[itemIndex] ? raw[itemIndex] : fallback
      );
      next[index] = color || fallback;
      await updateSelectedShape2dMeta({ angleColors: next });
    },
    [boardObjects, selectedObjectId, updateSelectedShape2dMeta]
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
      setError("Для этой фигуры уже добавлены все возможные пометки углов.");
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
    setSolid3dSectionPointTarget(null);
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
    setSolid3dSectionPointTarget((current) =>
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
    setSolid3dSectionPointTarget(null);
    setSolid3dDraftPoints({
      objectId: selectedObject.id,
      points: [],
    });
  };

  const handleSolid3dSectionPointPick = async (payload: {
    objectId: string;
    point: Solid3dSectionPoint;
    replaceIndex?: number;
    selectOnly?: boolean;
  }) => {
    if (!selectedObject || selectedObject.type !== "solid3d") return;
    if (selectedObject.id !== payload.objectId) return;
    if (!selectedActiveSection || !selectedSolid3dState) return;
    const triangleIndices = payload.point.triangleVertexIndices ?? [];
    const barycentric = payload.point.barycentric ?? [];
    const hasEdgeOrVertexBarycentric =
      barycentric.length === 3 && barycentric.some((weight) => Math.abs(weight) <= 1e-4);
    if (
      !Number.isInteger(payload.point.faceIndex) ||
      triangleIndices.length !== 3 ||
      !hasEdgeOrVertexBarycentric
    ) {
      return;
    }
    if (payload.selectOnly) {
      if (!Number.isInteger(payload.replaceIndex)) {
        setSolid3dSectionPointTarget(null);
        return;
      }
      const replaceIndex = Number(payload.replaceIndex);
      if (replaceIndex < 0 || replaceIndex >= selectedActiveSection.points.length) {
        setSolid3dSectionPointTarget(null);
        return;
      }
      setSolid3dSectionPointTarget({
        sectionId: selectedActiveSection.id,
        pointIndex: replaceIndex,
      });
      return;
    }
    const replaceIndex = Number.isInteger(payload.replaceIndex)
      ? Number(payload.replaceIndex)
      : solid3dSectionPointTarget &&
          solid3dSectionPointTarget.sectionId === selectedActiveSection.id
        ? solid3dSectionPointTarget.pointIndex
        : -1;
    if (replaceIndex < 0 || replaceIndex >= selectedActiveSection.points.length) return;

    const nextPoints = selectedActiveSection.points.map((point, index) =>
      index === replaceIndex
        ? {
            ...payload.point,
            label: point.label || getSectionPointLabel(index),
          }
        : point
    );

    if (selectedSolidMesh && nextPoints.length >= 3) {
      const candidatePolygon = computeSectionPolygon(selectedSolidMesh, {
        ...selectedActiveSection,
        mode: "through_points",
        pointIndices: [],
        points: nextPoints,
      }).polygon;
      if (candidatePolygon.length < 3) {
        setError("Точку нельзя установить в эту позицию: сечение не пересекает фигуру корректно.");
        return;
      }
    }

    await updateSolid3dSection(selectedActiveSection.id, {
      mode: "through_points",
      pointIndices: [],
      points: ensureUniqueSectionPointLabels(nextPoints),
    });
    setSolid3dSectionPointTarget(null);
  };

  const renameSolid3dSectionPoint = async (
    sectionId: string,
    pointIndex: number,
    label: string
  ) => {
    const normalized = label.trim().slice(0, 16);
    await updateSelectedSolid3dState((state) => ({
      ...state,
      sections: state.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const updatedPoints = section.points.map((point, index) =>
          index === pointIndex
            ? {
                ...point,
                label: normalized || getSectionPointLabel(index),
              }
            : point
        );
        return {
          ...section,
          points: ensureUniqueSectionPointLabels(updatedPoints),
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
    await commitObjectCreate(object);
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
    const previousSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (!previousSnapshot) return;
    const currentSnapshot = captureSceneSnapshot();
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, currentSnapshot].slice(-80);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    restoreSceneSnapshot(previousSnapshot);
    markDirty();
    try {
      await appendEventsAndApply([
        {
          type: "board.undo",
          payload: {
            scene: toScenePayload(previousSnapshot),
          },
        },
      ], { trackHistory: false, markDirty: false });
    } catch {
      setError("Не удалось выполнить отмену действия.");
    }
  }, [
    appendEventsAndApply,
    canUseUndo,
    captureSceneSnapshot,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    markDirty,
    restoreSceneSnapshot,
    toScenePayload,
  ]);

  const handleRedo = useCallback(async () => {
    if (!canUseUndo || redoStackRef.current.length === 0) return;
    const nextSnapshot = redoStackRef.current[redoStackRef.current.length - 1];
    if (!nextSnapshot) return;
    const currentSnapshot = captureSceneSnapshot();
    clearObjectSyncRuntime();
    clearStrokePreviewRuntime();
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, currentSnapshot].slice(-80);
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(redoStackRef.current.length);
    restoreSceneSnapshot(nextSnapshot);
    markDirty();
    try {
      await appendEventsAndApply([
        {
          type: "board.redo",
          payload: {
            scene: toScenePayload(nextSnapshot),
          },
        },
      ], { trackHistory: false, markDirty: false });
    } catch {
      setError("Не удалось повторить действие.");
    }
  }, [
    appendEventsAndApply,
    canUseUndo,
    captureSceneSnapshot,
    clearObjectSyncRuntime,
    clearStrokePreviewRuntime,
    markDirty,
    restoreSceneSnapshot,
    toScenePayload,
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
    setSolid3dPointContextMenu(null);
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
    setSolid3dPointContextMenu(null);
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
    setSolid3dPointContextMenu(null);
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
    setSolid3dPointContextMenu(null);
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

  const handleSolid3dPointContextMenu = (payload: {
    objectId: string;
    sectionId: string;
    pointIndex: number;
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
      section.points[payload.pointIndex]?.label || getSectionPointLabel(payload.pointIndex);
    setObjectContextMenu(null);
    setShapeVertexContextMenu(null);
    setLineEndpointContextMenu(null);
    setSolid3dVertexContextMenu(null);
    setSolid3dSectionContextMenu(null);
    setSelectedObjectId(payload.objectId);
    setActiveSolidSectionId(payload.sectionId);
    setSolid3dPointContextMenu({
      objectId: payload.objectId,
      sectionId: payload.sectionId,
      pointIndex: payload.pointIndex,
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
    setSolid3dPointContextMenu(null);
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
      const url = isImage
        ? await optimizeImageDataUrl(sourceDataUrl, {
            maxEdge: 920,
            quality: 0.62,
            maxChars: 46_000,
          })
        : sourceDataUrl;
      if (isPdf) {
        setUploadProgress(45);
        const rendered = await renderWorkbookPdfPages({
          fileName: file.name,
          dataUrl: url,
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
      const insertOffset = boardObjects.length % 6;
      const renderedPage =
        isPdf
          ? renderedPages?.find((page) => page.page === 1) ?? renderedPages?.[0]
          : null;
      const objectImageUrl =
        isImage
          ? url
          : renderedPage?.imageUrl
            ? await optimizeImageDataUrl(renderedPage.imageUrl, {
                maxEdge: 820,
                quality: 0.58,
                maxChars: 46_000,
              })
            : undefined;
      if (isImage && !objectImageUrl) {
        setError(
          "Не удалось добавить изображение: браузер не смог обработать файл. Попробуйте другой формат или меньший размер."
        );
        return;
      }
      const object: WorkbookBoardObject = {
        id: generateId(),
        type: objectImageUrl ? "image" : "text",
        layer: "board",
        x: canvasViewport.x + 96 + insertOffset * 20,
        y: canvasViewport.y + 92 + insertOffset * 16,
        width: objectImageUrl ? 380 : 320,
        height: objectImageUrl ? 260 : 120,
        color: "#16213e",
        fill: "transparent",
        strokeWidth: 2,
        opacity: 1,
        imageUrl: objectImageUrl,
        imageName: file.name,
        text: objectImageUrl ? undefined : `PDF: ${file.name}`,
        fontSize: objectImageUrl ? undefined : 18,
        authorUserId: user?.id ?? "unknown",
        createdAt: new Date().toISOString(),
      };
      await commitObjectCreate(object);
      const assetId = generateId();
      const asset: WorkbookDocumentAsset = {
        id: assetId,
        name: file.name,
        type: isPdf ? "pdf" : isImage ? "image" : "file",
        url,
        uploadedBy: user?.id ?? "unknown",
        uploadedAt: new Date().toISOString(),
        renderedPages,
      };
      setDocumentState((current) => ({
        ...current,
        assets: current.assets.some((item) => item.id === asset.id)
          ? current.assets
          : [...current.assets, asset],
        activeAssetId: asset.id,
        page: 1,
      }));
      const syncedAsset: WorkbookDocumentAsset = {
        ...asset,
        url:
          objectImageUrl ||
          (isImage ? url : "data:,"),
        renderedPages:
          renderedPage && objectImageUrl
            ? [
                {
                  id: renderedPage.id,
                  page: renderedPage.page,
                  imageUrl: objectImageUrl,
                  width: renderedPage.width,
                  height: renderedPage.height,
                },
              ]
            : undefined,
      };
      void appendEventsAndApply(
        [
          {
            type: "document.asset.add",
            payload: { asset: syncedAsset },
          },
        ],
        { trackHistory: false, markDirty: false }
      )
        .then(() =>
          updateDocumentState({
            activeAssetId: assetId,
            page: 1,
          })
        )
        .catch(() => undefined);
      void upsertLibraryItem({
        id: generateId(),
        name: file.name,
        type: isPdf ? "pdf" : isImage ? "image" : "office",
        ownerUserId: user?.id ?? "unknown",
        sourceUrl: objectImageUrl ?? url,
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
    const insertOffset = boardObjects.length % 6;
    const renderedPage =
      active.type === "pdf"
        ? active.renderedPages?.find((page) => page.page === documentState.page) ??
          active.renderedPages?.[0]
        : null;
    const snapshotImageUrl =
      active.type === "image"
        ? await optimizeImageDataUrl(active.url, {
            maxEdge: 820,
            quality: 0.58,
            maxChars: 46_000,
          })
        : renderedPage
          ? await optimizeImageDataUrl(renderedPage.imageUrl, {
              maxEdge: 820,
              quality: 0.58,
              maxChars: 46_000,
            })
          : undefined;
    const object: WorkbookBoardObject = {
      id: generateId(),
      type: active.type === "image" || renderedPage ? "image" : "text",
      layer: "board",
      x: canvasViewport.x + 96 + insertOffset * 20,
      y: canvasViewport.y + 92 + insertOffset * 16,
      width: 320,
      height: 220,
      color: "#16213e",
      fill: "transparent",
      strokeWidth: 2,
      opacity: 1,
      imageUrl: snapshotImageUrl,
      imageName: active.name,
      text:
        active.type === "pdf"
          ? `PDF: ${active.name}`
          : active.type === "file"
            ? `Файл: ${active.name}`
            : undefined,
      fontSize: active.type === "pdf" || active.type === "file" ? 18 : undefined,
      authorUserId: user?.id ?? "unknown",
      createdAt: new Date().toISOString(),
    };
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

  const resolvePageExportBounds = useCallback(
    (page: number): WorkbookExportBounds | null => {
      const safePage = Math.max(1, Math.floor(page));
      const objectBounds = boardObjects
        .filter((object) => (object.page ?? 1) === safePage)
        .map((object) => getObjectExportBounds(object))
        .reduce<WorkbookExportBounds | null>(
          (accumulator, bounds) => mergeExportBounds(accumulator, bounds),
          null
        );
      const strokeBounds = boardStrokes
        .filter((stroke) => (stroke.page ?? 1) === safePage)
        .map((stroke) => getStrokeExportBounds(stroke))
        .reduce<WorkbookExportBounds | null>(
          (accumulator, bounds) => mergeExportBounds(accumulator, bounds),
          null
        );
      const merged = mergeExportBounds(objectBounds, strokeBounds);
      if (!merged) return null;
      return padExportBounds(merged, EXPORT_BOUNDS_PADDING);
    },
    [boardObjects, boardStrokes]
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
      const rootCanvasGroup = Array.from(svgClone.children).find((node) => {
        if (node.tagName.toLowerCase() !== "g") return false;
        const transform = node.getAttribute("transform");
        return typeof transform === "string" && transform.startsWith("translate(");
      });
      if (rootCanvasGroup) {
        rootCanvasGroup.setAttribute("transform", "translate(0 0)");
      }
    }
    const serialized = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const next = new Image();
        next.onload = () => resolve(next);
        next.onerror = () => reject(new Error("image_load_failed"));
        next.src = url;
      });
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
      ctx.drawImage(image, 0, 0, width, height);
      ctx.restore();
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
    (extension: "png" | "pdf") => {
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

  const exportBoardAsPng = async () => {
    try {
      const fileName = requestExportFileName("png");
      if (!fileName) return;
      const rendered = await renderBoardToCanvas(2.2);
      if (!rendered) return;
      const png = rendered.canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = png;
      link.download = fileName;
      link.click();
    } catch {
      setError("Не удалось экспортировать PNG.");
    }
  };

  const exportBoardAsPdf = async () => {
    if (exportingSections) return;
    setExportingSections(true);
    const currentPage = Math.max(1, boardSettings.currentPage || 1);
    let activePage = currentPage;
    try {
      const fileName = requestExportFileName("pdf");
      if (!fileName) return;
      const exportPages = Array.from(
        new Set([
          ...Array.from(
            { length: Math.max(1, boardSettings.pagesCount || 1) },
            (_, index) => index + 1
          ),
          ...boardObjects.map((object) => Math.max(1, object.page ?? 1)),
          ...boardStrokes.map((stroke) => Math.max(1, stroke.page ?? 1)),
          currentPage,
        ])
      )
        .sort((left, right) => left - right)
        .map((page) => ({
          page,
          bounds: resolvePageExportBounds(page),
        }))
        .filter(
          (entry): entry is { page: number; bounds: WorkbookExportBounds } =>
            Boolean(entry.bounds)
        );
      if (exportPages.length === 0) {
        setError("Для экспорта нет объектов на доске.");
        return;
      }
      const previousPage = currentPage;
      const renderedPages: Array<{ page: number; width: number; height: number; dataUrl: string }> =
        [];
      for (const entry of exportPages) {
        if (entry.page !== activePage) {
          await switchBoardPageForExport(entry.page);
          activePage = entry.page;
        } else {
          await waitForCanvasRender();
        }
        const rendered = await renderBoardToCanvas(2.2, { bounds: entry.bounds });
        if (!rendered) continue;
        renderedPages.push({
          page: entry.page,
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
      const firstPage = renderedPages[0];
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: firstPage.width >= firstPage.height ? "landscape" : "portrait",
        unit: "px",
        format: [firstPage.width, firstPage.height],
      });
      renderedPages.forEach((page, index) => {
        if (index > 0) {
          pdf.addPage(
            [page.width, page.height],
            page.width >= page.height ? "landscape" : "portrait"
          );
        }
        pdf.addImage(page.dataUrl, "PNG", 0, 0, page.width, page.height);
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

  const handleSolid3dSectionPointPickRef = useRef(handleSolid3dSectionPointPick);
  handleSolid3dSectionPointPickRef.current = handleSolid3dSectionPointPick;

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

  const handleCanvasObjectDelete = useCallback((objectId: string) => {
    void commitObjectDeleteRef.current(objectId);
  }, []);

  const handleCanvasSolid3dPointPick = useCallback(
    (payload: {
      objectId: string;
      point: Solid3dSectionPoint;
      faceIndex?: number;
      replaceIndex?: number;
      selectOnly?: boolean;
    }) => {
      void handleSolid3dSectionPointPickRef.current(payload);
    },
    []
  );

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
        });
        return;
      }
      if (supportsTransformUtilityPanel(target)) {
        openUtilityPanel("transform", {
          toggle: false,
        });
      }
    },
    [boardObjects, openUtilityPanel]
  );

  const handleCanvasObjectCreate = useCallback(
    (object: WorkbookBoardObject) => {
      suppressAutoPanelSelectionRef.current = object.id;
      void commitObjectCreate(object);
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
  const selectedShape2dAngleNotes = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.angleNotes)
      ? selectedShape2dObject.meta.angleNotes
      : [];
    return selectedShape2dLabels.map((_, index) =>
      typeof raw[index] === "string" ? raw[index] : ""
    );
  }, [selectedShape2dLabels, selectedShape2dObject]);
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
  const selectedShape2dAngleColors = useMemo(() => {
    if (!selectedShape2dObject) return [] as string[];
    const raw = Array.isArray(selectedShape2dObject.meta?.angleColors)
      ? selectedShape2dObject.meta.angleColors
      : [];
    const fallback = selectedShape2dObject.color || "#4f63ff";
    return selectedShape2dLabels.map((_, index) =>
      typeof raw[index] === "string" && raw[index] ? raw[index] : fallback
    );
  }, [selectedShape2dLabels, selectedShape2dObject]);
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
    if (shapeDraftObjectIdRef.current === selectedShape2dObject.id) return;
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
  const selectedActiveSection = useMemo(() => {
    if (!selectedSolid3dState?.sections.length) return null;
    if (activeSolidSectionId) {
      return (
        selectedSolid3dState.sections.find((section) => section.id === activeSolidSectionId) ??
        selectedSolid3dState.sections[0]
      );
    }
    return selectedSolid3dState.sections[0];
  }, [activeSolidSectionId, selectedSolid3dState]);
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
      setSolid3dSectionPointTarget(null);
      setSolid3dInspectorTab("section");
      setSolid3dDraftPoints(null);
      setSolid3dVertexContextMenu(null);
      setSolid3dPointContextMenu(null);
      setSolid3dSectionContextMenu(null);
    }
  }, [selectedObject?.type]);

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
    if (!selectedObject || selectedObject.type !== "solid3d") return;
    if (!selectedSolid3dState || !canSelect) return;
    const needsUpdate = selectedSolid3dState.sections.some((section) =>
      section.points.some((point) => !(point.label && point.label.trim()))
    );
    if (!needsUpdate) return;
    const nextState: Solid3dState = {
      ...selectedSolid3dState,
      sections: selectedSolid3dState.sections.map((section) => ({
        ...section,
        points: section.points.map((point, index) => ({
          ...point,
          label: point.label?.trim() || getSectionPointLabel(index),
        })),
      })),
    };
    void commitObjectUpdate(selectedObject.id, {
      meta: writeSolid3dState(nextState, selectedObject.meta),
    });
  }, [canSelect, commitObjectUpdate, selectedObject, selectedSolid3dState]);

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
    if (!solid3dSectionPointTarget || !selectedSolid3dState) return;
    const section = selectedSolid3dState.sections.find(
      (entry) => entry.id === solid3dSectionPointTarget.sectionId
    );
    if (!section || solid3dSectionPointTarget.pointIndex >= section.points.length) {
      setSolid3dSectionPointTarget(null);
    }
  }, [solid3dSectionPointTarget, selectedSolid3dState]);

  useEffect(() => {
    if (!selectedActiveSection || selectedActiveSection.visible) return;
    setSolid3dSectionPointTarget(null);
  }, [selectedActiveSection]);

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

      <header className="workbook-session__head">
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
          <div className="workbook-session__contextbar">
            <Menu
              container={overlayContainer}
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem
                onClick={() => {
                  void exportBoardAsPng();
                  setMenuAnchor(null);
                }}
              >
                Экспорт PNG
              </MenuItem>
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
            <Tooltip title="Настройки" placement="bottom" arrow>
              <span>
                <IconButton
                  size="small"
                  className={`workbook-session__toolbar-icon ${
                    isUtilityPanelOpen && utilityTab === "settings" ? "is-active" : ""
                  }`}
                  onClick={() => openUtilityPanel("settings")}
                >
                  <TuneRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="График функции" placement="bottom" arrow>
              <span>
                <IconButton
                  size="small"
                  className={`workbook-session__toolbar-icon ${
                    isUtilityPanelOpen && utilityTab === "graph" ? "is-active" : ""
                  }`}
                  disabled={!selectedObjectSupportsGraphPanel}
                  onClick={() => openUtilityPanel("graph")}
                >
                  <ShowChartRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Трансформации" placement="bottom" arrow>
              <span>
                <IconButton
                  size="small"
                  className={`workbook-session__toolbar-icon ${
                    isUtilityPanelOpen && utilityTab === "transform" ? "is-active" : ""
                  }`}
                  disabled={!selectedObjectSupportsTransformPanel}
                  onClick={() => openUtilityPanel("transform")}
                >
                  <AutoFixHighRoundedIcon />
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

            {tool === "function_graph" ? (
              <div className="workbook-session__contextbar-inline">
                <span className="workbook-session__hint">
                  Конструктор графика доступен во вкладке «График функции».
                </span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ShowChartRoundedIcon />}
                  disabled={!selectedObjectSupportsGraphPanel}
                  onClick={() => openUtilityPanel("graph", { toggle: false })}
                >
                  Открыть модуль
                </Button>
              </div>
            ) : null}

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
                  {isFullscreen ? <FullscreenExitRoundedIcon /> : <FullscreenRoundedIcon />}
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
              solid3dPointPick={
                selectedObject?.type === "solid3d" &&
                selectedActiveSection &&
                selectedActiveSection.visible
                  ? {
                      objectId: selectedObject.id,
                      sectionId: selectedActiveSection.id,
                      selectedPoints: selectedActiveSection.points,
                      replaceIndex:
                        solid3dSectionPointTarget?.sectionId === selectedActiveSection.id
                          ? solid3dSectionPointTarget.pointIndex
                          : null,
                    }
                  : null
              }
              solid3dDraftPointCollectionObjectId={solid3dSectionPointCollecting}
              solid3dSectionMarkers={
                isSolid3dPointCollectionActive && solid3dDraftPoints
                  ? {
                      objectId: solid3dDraftPoints.objectId,
                      sectionId: "draft",
                      selectedPoints: solid3dDraftPoints.points,
                    }
                  : selectedObject?.type === "solid3d" &&
                      selectedActiveSection &&
                      selectedActiveSection.visible
                  ? {
                      objectId: selectedObject.id,
                      sectionId: selectedActiveSection.id,
                      selectedPoints: selectedActiveSection.points,
                    }
                  : null
              }
              onSelectedObjectChange={handleCanvasSelectedObjectChange}
              onSelectedConstraintChange={setSelectedConstraintId}
              onStrokeCommit={handleCanvasStrokeCommit}
              onStrokePreview={commitStrokePreview}
              onStrokeDelete={handleCanvasStrokeDelete}
              onStrokeReplace={handleCanvasStrokeReplace}
              onObjectCreate={handleCanvasObjectCreate}
              onObjectUpdate={handleCanvasObjectUpdate}
              onObjectDelete={handleCanvasObjectDelete}
              onObjectContextMenu={handleObjectContextMenu}
              onShapeVertexContextMenu={handleShapeVertexContextMenu}
              onLineEndpointContextMenu={handleLineEndpointContextMenu}
              onSolid3dVertexContextMenu={handleSolid3dVertexContextMenu}
              onSolid3dPointContextMenu={handleSolid3dPointContextMenu}
              onSolid3dSectionContextMenu={handleSolid3dSectionContextMenu}
              onSolid3dPointPick={handleCanvasSolid3dPointPick}
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

        <aside className="workbook-session__sidebar">
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
            className={`workbook-session__utility-float${
              isUtilityPanelCollapsed ? " is-collapsed" : ""
            }`}
            style={
              isCompactViewport
                ? undefined
                : { left: utilityPanelPosition.x, top: utilityPanelPosition.y }
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
                boardSettings={boardSettings}
                setBoardSettings={setBoardSettings}
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
                canSave={session.kind !== "CLASS" || canManageSession}
                onSave={commitBoardSettings}
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
                shapeVertexLabelDrafts={shapeVertexLabelDrafts}
                setShapeVertexLabelDrafts={setShapeVertexLabelDrafts}
                shapeAngleNoteDrafts={shapeAngleNoteDrafts}
                setShapeAngleNoteDrafts={setShapeAngleNoteDrafts}
                shapeSegmentNoteDrafts={shapeSegmentNoteDrafts}
                setShapeSegmentNoteDrafts={setShapeSegmentNoteDrafts}
                selectedShape2dVertexColors={selectedShape2dVertexColors}
                selectedShape2dAngleColors={selectedShape2dAngleColors}
                selectedShape2dSegmentColors={selectedShape2dSegmentColors}
                onUpdateSelectedShape2dMeta={updateSelectedShape2dMeta}
                onRenameSelectedShape2dVertex={renameSelectedShape2dVertex}
                onUpdateSelectedShape2dAngleNote={updateSelectedShape2dAngleNote}
                onUpdateSelectedShape2dSegmentNote={updateSelectedShape2dSegmentNote}
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
                selectedActiveSection={selectedActiveSection}
                activeSolidSectionId={activeSolidSectionId}
                setActiveSolidSectionId={setActiveSolidSectionId}
                solid3dSectionPointTarget={solid3dSectionPointTarget}
                setSolid3dSectionPointTarget={setSolid3dSectionPointTarget}
                solid3dDraftPoints={solid3dDraftPoints}
                solid3dDraftPointLimit={solid3dDraftPointLimit}
                isSolid3dPointCollectionActive={isSolid3dPointCollectionActive}
                onSetSolid3dHiddenEdges={setSolid3dHiddenEdges}
                onUpdateSelectedSolid3dSurfaceColor={updateSelectedSolid3dSurfaceColor}
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
                getSectionPointLabel={getSectionPointLabel}
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
                label="Название вершины"
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
            open={Boolean(solid3dPointContextMenu)}
            onClose={() => setSolid3dPointContextMenu(null)}
            anchorReference="anchorPosition"
            anchorPosition={
              solid3dPointContextMenu
                ? { top: solid3dPointContextMenu.y, left: solid3dPointContextMenu.x }
                : undefined
            }
          >
            <div className="workbook-session__solid-menu">
              <TextField
                size="small"
                label="Название угла сечения"
                value={solid3dPointContextMenu?.label ?? ""}
                onChange={(event) =>
                  setSolid3dPointContextMenu((current) =>
                    current ? { ...current, label: event.target.value } : current
                  )
                }
              />
              <div className="workbook-session__solid-menu-actions workbook-session__solid-menu-actions--icons">
                <IconButton
                  size="small"
                  aria-label="Сбросить название точки сечения"
                  onClick={() => {
                    if (!solid3dPointContextMenu) return;
                    void renameSolid3dSectionPoint(
                      solid3dPointContextMenu.sectionId,
                      solid3dPointContextMenu.pointIndex,
                      getSectionPointLabel(solid3dPointContextMenu.pointIndex)
                    );
                    setSolid3dPointContextMenu(null);
                  }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="Сохранить название точки сечения"
                  onClick={() => {
                    if (!solid3dPointContextMenu) return;
                    void renameSolid3dSectionPoint(
                      solid3dPointContextMenu.sectionId,
                      solid3dPointContextMenu.pointIndex,
                      solid3dPointContextMenu.label
                    );
                    setSolid3dPointContextMenu(null);
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
                  label="Название вершины"
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
                  label={
                    lineEndpointContextMenu.endpoint === "start"
                      ? "Название конца A"
                      : "Название конца B"
                  }
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
                  label="Название точки"
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
