import {
  GRAPH_FUNCTION_COLORS,
  normalizeGraphScale,
  normalizeFunctionExpression,
  type GraphFunctionDraft,
} from "@/features/workbook/model/functionGraph";
import {
  WORKBOOK_BOARD_ANNOTATION_COLOR,
  WORKBOOK_BOARD_BACKGROUND_COLOR,
  WORKBOOK_BOARD_GRID_COLOR,
  WORKBOOK_BOARD_PRIMARY_COLOR,
} from "@/features/workbook/model/workbookVisualColors";
import {
  clampWorkbookObjectToPageFrame,
  normalizeWorkbookPageFrameWidth,
  resolveWorkbookPageFrameBounds,
  WORKBOOK_PAGE_FRAME_WIDTH,
} from "@/features/workbook/model/pageFrame";
import type { Solid3dSectionPoint } from "@/features/workbook/model/solid3dState";
import type {
  WorkbookBoardObject,
  WorkbookBoardSettings,
  WorkbookLayer,
  WorkbookLibraryState,
  WorkbookSessionParticipant,
  WorkbookSessionSettings,
  WorkbookStroke,
  WorkbookTool,
} from "@/features/workbook/model/types";
import { generateId } from "@/shared/lib/id";

export const getNowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

// Fallback poll should stay lightweight; realtime stream/live channels carry primary sync.
export const POLL_INTERVAL_MS = 1_200;
export const POLL_INTERVAL_STREAM_CONNECTED_MS = 4_000;
export const POLL_INTERVAL_STREAM_ONLY_MS = 1_800;
export const RESYNC_MIN_INTERVAL_MS = 4_000;
export const ADAPTIVE_POLLING_MIN_MS = 320;
export const ADAPTIVE_POLLING_MAX_MS = 8_000;
export const PRESENCE_INTERVAL_MS = 1_000;
export const AUTOSAVE_INTERVAL_MS = 15_000;
export const COMPACT_VIEWPORT_MAX_WIDTH = 760;
export const CONTEXTBAR_DOCKED_VIEWPORT_MAX_WIDTH = 1024;
export const OBJECT_UPDATE_FLUSH_INTERVAL_MS = 16;
export const VOLATILE_SYNC_FLUSH_INTERVAL_MS = 16;
export const VOLATILE_PREVIEW_MAX_PER_FLUSH = 24;
export const VOLATILE_PREVIEW_QUEUE_MAX = 120;
export const STROKE_PREVIEW_EXPIRY_MS = 3_000;
export const ERASER_PREVIEW_EXPIRY_MS = 600;
export const ERASER_PREVIEW_END_EXPIRY_MS = 900;
export const CONTEXTBAR_VIEWPORT_MARGIN_PX = 12;
export const ERASER_PREVIEW_POINT_MERGE_MIN_DISTANCE_PX = 1.2;
export const VIEWPORT_SYNC_MIN_INTERVAL_MS = 18;
export const VIEWPORT_SYNC_EPSILON = 0.2;
export const MAX_INCOMING_PREVIEW_PATCHES_PER_OBJECT = 20;
export const ERASER_RADIUS_MIN = 4;
export const ERASER_RADIUS_MAX = 160;
export const MAX_EXPORT_CANVAS_SIDE = 8192;
// Smaller hydration chunks reduce long tasks during initial session open (LCP/INP path).
export const SNAPSHOT_OBJECT_PREP_CHUNK_SIZE = 64;
export const SNAPSHOT_STROKE_PREP_CHUNK_SIZE = 96;
export const SNAPSHOT_CONSTRAINT_PREP_CHUNK_SIZE = 80;
export const SESSION_CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 28;
export const PARTICIPANT_VISIBILITY_GRACE_MS = 30_000;
export const TAB_LOCK_HEARTBEAT_MS = 2_000;
export const TAB_LOCK_TTL_MS = 8_000;
export const MAIN_SCENE_LAYER_ID = "main";
export const MAIN_SCENE_LAYER_NAME = "Основной слой";

const resolveSafeViewportDimension = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;

export const resolveWorkbookViewportWidth = () => {
  if (typeof window === "undefined") return Number.POSITIVE_INFINITY;
  const windowWidth = resolveSafeViewportDimension(window.innerWidth) ?? Number.POSITIVE_INFINITY;
  const visualWidth = resolveSafeViewportDimension(window.visualViewport?.width);
  return visualWidth ? Math.min(windowWidth, visualWidth) : windowWidth;
};

export const resolveWorkbookViewportFlags = () => {
  const width = resolveWorkbookViewportWidth();
  return {
    width,
    isCompactViewport: width <= COMPACT_VIEWPORT_MAX_WIDTH,
    isDockedContextbarViewport: width <= CONTEXTBAR_DOCKED_VIEWPORT_MAX_WIDTH,
  };
};

export const toSafeWorkbookPage = (value: number | null | undefined) =>
  Math.max(1, Math.round(value || 1));

export const normalizeWorkbookPageOrder = (
  rawOrder: unknown,
  maxKnownPage: number
): number[] => {
  const safeMaxPage = Math.max(1, toSafeWorkbookPage(maxKnownPage));
  const incoming = Array.isArray(rawOrder) ? rawOrder : [];
  const used = new Set<number>();
  const normalized: number[] = [];
  incoming.forEach((candidate) => {
    const page = toSafeWorkbookPage(typeof candidate === "number" ? candidate : Number(candidate));
    if (page < 1 || page > safeMaxPage || used.has(page)) return;
    used.add(page);
    normalized.push(page);
  });
  for (let page = 1; page <= safeMaxPage; page += 1) {
    if (used.has(page)) continue;
    normalized.push(page);
  }
  return normalized;
};

export const normalizeWorkbookPageTitles = (
  rawTitles: unknown,
  maxKnownPage: number
): Record<string, string> => {
  const safeMaxPage = Math.max(1, toSafeWorkbookPage(maxKnownPage));
  if (!rawTitles || typeof rawTitles !== "object" || Array.isArray(rawTitles)) {
    return {};
  }
  const nextTitles: Record<string, string> = {};
  Object.entries(rawTitles as Record<string, unknown>).forEach(([key, value]) => {
    const page = Number.parseInt(key, 10);
    if (!Number.isFinite(page) || page < 1 || page > safeMaxPage) return;
    if (typeof value !== "string") return;
    const title = value.trim().slice(0, 96);
    if (title.length === 0) return;
    nextTitles[String(page)] = title;
  });
  return nextTitles;
};

export const resolveWorkbookPageTitle = (
  page: number,
  pageTitles: Record<string, string> | null | undefined
) => {
  const safePage = toSafeWorkbookPage(page);
  const title =
    pageTitles && typeof pageTitles[String(safePage)] === "string"
      ? pageTitles[String(safePage)]?.trim() ?? ""
      : "";
  return title.length > 0 ? title : `Страница ${safePage}`;
};

export const resolveMaxKnownWorkbookPage = (params: {
  pagesCount: number;
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
}) =>
  Math.max(
    1,
    toSafeWorkbookPage(params.pagesCount),
    ...params.boardObjects.map((object) => toSafeWorkbookPage(object.page)),
    ...params.boardStrokes.map((stroke) => toSafeWorkbookPage(stroke.page)),
    ...params.annotationStrokes.map((stroke) => toSafeWorkbookPage(stroke.page))
  );

export const WORKBOOK_CHAT_EMOJIS = [
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

export const parseChatTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type WorkbookTabLockRecord = {
  tabId: string;
  updatedAt: number;
  acquiredAt: number;
};

export const parseWorkbookTabLockRecord = (raw: string | null): WorkbookTabLockRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkbookTabLockRecord>;
    const tabId = typeof parsed.tabId === "string" ? parsed.tabId.trim() : "";
    const updatedAt =
      typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : 0;
    const acquiredAt =
      typeof parsed.acquiredAt === "number" && Number.isFinite(parsed.acquiredAt)
        ? parsed.acquiredAt
        : 0;
    if (!tabId || updatedAt <= 0) return null;
    return {
      tabId,
      updatedAt,
      acquiredAt: acquiredAt > 0 ? acquiredAt : updatedAt,
    };
  } catch {
    return null;
  }
};

export const isWorkbookTabLockStale = (record: WorkbookTabLockRecord | null, nowTs = Date.now()) =>
  !record || nowTs - record.updatedAt > TAB_LOCK_TTL_MS;

export const defaultColorByLayer: Record<WorkbookLayer, string> = {
  board: WORKBOOK_BOARD_PRIMARY_COLOR,
  annotations: WORKBOOK_BOARD_ANNOTATION_COLOR,
};

export const defaultWidthByTool: Partial<Record<WorkbookTool, number>> = {
  lock_toggle: 2,
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

export const DEFAULT_SETTINGS: WorkbookSessionSettings = {
  undoPolicy: "teacher_only",
  strictGeometry: false,
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

export const DEFAULT_BOARD_SETTINGS: WorkbookBoardSettings = {
  title: "Рабочая тетрадь",
  showGrid: true,
  gridSize: 22,
  gridColor: WORKBOOK_BOARD_GRID_COLOR,
  backgroundColor: WORKBOOK_BOARD_BACKGROUND_COLOR,
  snapToGrid: false,
  pageBoardSettingsByPage: {},
  showPageNumbers: false,
  pageFrameWidth: normalizeWorkbookPageFrameWidth(WORKBOOK_PAGE_FRAME_WIDTH),
  currentPage: 1,
  pagesCount: 1,
  pageOrder: [1],
  pageTitles: {},
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

export const WORKBOOK_PAGE_FRAME_BOUNDS = resolveWorkbookPageFrameBounds(
  DEFAULT_BOARD_SETTINGS.pageFrameWidth
);

export const DEFAULT_LIBRARY: WorkbookLibraryState = {
  folders: [],
  items: [],
  formulas: [],
  templates: [],
};

export const FALLBACK_PERMISSIONS: WorkbookSessionParticipant["permissions"] = {
  canDraw: false,
  canAnnotate: false,
  canUseMedia: true,
  canUseMicrophone: true,
  canUseCamera: true,
  canUseChat: true,
  canInvite: false,
  canManageSession: false,
  canSelect: false,
  canDelete: false,
  canInsertImage: false,
  canClear: false,
  canExport: false,
  canUseLaser: false,
};

export const getSectionPointLabel = (index: number) => `P${index + 1}`;
export const getSolidVertexLabel = (index: number) => `V${index + 1}`;

export const makeUniqueSectionPointLabel = (
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

export const ensureUniqueSectionPointLabels = (points: Solid3dSectionPoint[]) => {
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

export const getFigureVertexLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < alphabet.length) return alphabet[index];
  return `${alphabet[index % alphabet.length]}${Math.floor(index / alphabet.length)}`;
};

export const getSectionVertexLabel = (index: number) => getFigureVertexLabel(index);

export const collectBoardObjectLabels = (object: WorkbookBoardObject) => {
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

export const getNextUniqueBoardLabel = (used: Set<string>, indexSeed: number) => {
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

export const clampGraphOffset = (value: number) => Math.max(-999, Math.min(999, value));

export const cloneSerializable = <T,>(value: T): T => structuredClone(value);

export const areSerializableValuesEqual = (left: unknown, right: unknown) => {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

export const normalizeMetaRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const clampBoardObjectToPageFrame = (
  object: WorkbookBoardObject,
  pageFrameWidth = WORKBOOK_PAGE_FRAME_WIDTH
) =>
  clampWorkbookObjectToPageFrame(
    object,
    resolveWorkbookPageFrameBounds(pageFrameWidth)
  );

export const applyBoardObjectGeometryPatch = (
  object: WorkbookBoardObject,
  patch: Partial<WorkbookBoardObject>
) => ({
  ...object,
  x: typeof patch.x === "number" && Number.isFinite(patch.x) ? patch.x : object.x,
  y: typeof patch.y === "number" && Number.isFinite(patch.y) ? patch.y : object.y,
  width:
    typeof patch.width === "number" && Number.isFinite(patch.width)
      ? patch.width
      : object.width,
  height:
    typeof patch.height === "number" && Number.isFinite(patch.height)
      ? patch.height
      : object.height,
});

export const buildBoardObjectDiffPatch = (
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
    "zOrder",
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
      const hasNextValue = Object.prototype.hasOwnProperty.call(nextMeta, key);
      acc[key] = hasNextValue ? cloneSerializable(nextMeta[key]) : null;
      return acc;
    }, {});
  }
  return Object.keys(patch).length > 0 ? patch : null;
};

export const buildBoardSettingsDiffPatch = (
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

export const resolveGraphFunctionsFromObject = (object: WorkbookBoardObject): GraphFunctionDraft[] => {
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

export const areGraphFunctionDraftListsEqual = (
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
