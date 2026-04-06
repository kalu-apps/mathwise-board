import {
  WORKBOOK_BOARD_BACKGROUND_COLOR,
  WORKBOOK_BOARD_GRID_COLOR,
} from "./workbookVisualColors";
import type {
  WorkbookBoardPageVisualSettings,
  WorkbookBoardSettings,
} from "./types";

const PAGE_MIN = 1;

export const WORKBOOK_PAGE_VISUAL_SETTING_KEYS = [
  "showGrid",
  "gridSize",
  "gridColor",
  "backgroundColor",
  "snapToGrid",
] as const;

export type WorkbookPageVisualSettingKey =
  (typeof WORKBOOK_PAGE_VISUAL_SETTING_KEYS)[number];

export type WorkbookBoardPageVisualSettingsPatch = Partial<
  Pick<WorkbookBoardSettings, WorkbookPageVisualSettingKey>
>;

const toSafePage = (value: number) =>
  Math.max(PAGE_MIN, Math.round(Number.isFinite(value) ? value : PAGE_MIN));

const normalizeGridSize = (value: unknown, fallback: number) =>
  Math.max(
    8,
    Math.min(96, Math.round(typeof value === "number" && Number.isFinite(value) ? value : fallback))
  );

const normalizeColor = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

export const resolveWorkbookBoardPageVisualDefaults = (
  boardSettings: WorkbookBoardSettings
): WorkbookBoardPageVisualSettings => ({
  showGrid: boardSettings.showGrid !== false,
  gridSize: normalizeGridSize(boardSettings.gridSize, 22),
  gridColor: normalizeColor(boardSettings.gridColor, WORKBOOK_BOARD_GRID_COLOR),
  backgroundColor: normalizeColor(
    boardSettings.backgroundColor,
    WORKBOOK_BOARD_BACKGROUND_COLOR
  ),
  snapToGrid: Boolean(boardSettings.snapToGrid),
});

export const normalizeWorkbookBoardPageVisualSettings = (
  source: unknown,
  fallback: WorkbookBoardPageVisualSettings
): WorkbookBoardPageVisualSettings => {
  const typed = source && typeof source === "object"
    ? (source as Partial<WorkbookBoardPageVisualSettings>)
    : {};
  return {
    showGrid: typeof typed.showGrid === "boolean" ? typed.showGrid : fallback.showGrid,
    gridSize: normalizeGridSize(typed.gridSize, fallback.gridSize),
    gridColor: normalizeColor(typed.gridColor, fallback.gridColor),
    backgroundColor: normalizeColor(typed.backgroundColor, fallback.backgroundColor),
    snapToGrid:
      typeof typed.snapToGrid === "boolean" ? typed.snapToGrid : fallback.snapToGrid,
  };
};

export const normalizeWorkbookBoardPageVisualSettingsByPage = (
  source: unknown,
  fallback: WorkbookBoardPageVisualSettings,
  maxKnownPage?: number
): Record<string, WorkbookBoardPageVisualSettings> => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }
  const safeMaxKnownPage =
    typeof maxKnownPage === "number" && Number.isFinite(maxKnownPage)
      ? Math.max(PAGE_MIN, Math.round(maxKnownPage))
      : null;
  const normalized: Record<string, WorkbookBoardPageVisualSettings> = {};
  Object.entries(source as Record<string, unknown>).forEach(([key, raw]) => {
    const parsedPage = Number.parseInt(key, 10);
    if (!Number.isFinite(parsedPage)) return;
    const safePage = toSafePage(parsedPage);
    if (safeMaxKnownPage !== null && safePage > safeMaxKnownPage) return;
    normalized[String(safePage)] = normalizeWorkbookBoardPageVisualSettings(raw, fallback);
  });
  return normalized;
};

export const resolveWorkbookBoardPageVisualSettings = (
  boardSettings: WorkbookBoardSettings,
  page: number
): WorkbookBoardPageVisualSettings => {
  const fallback = resolveWorkbookBoardPageVisualDefaults(boardSettings);
  const safePage = toSafePage(page);
  const raw =
    boardSettings.pageBoardSettingsByPage?.[String(safePage)] ?? null;
  return normalizeWorkbookBoardPageVisualSettings(raw, fallback);
};

export const remapWorkbookBoardPageVisualSettingsByPageAfterDelete = (params: {
  source: Record<string, WorkbookBoardPageVisualSettings> | null | undefined;
  targetPage: number;
  fallback: WorkbookBoardPageVisualSettings;
  maxKnownPage: number;
}) => {
  const safeTargetPage = toSafePage(params.targetPage);
  const remapped: Record<string, WorkbookBoardPageVisualSettings> = {};
  const source = params.source ?? {};
  Object.entries(source).forEach(([key, raw]) => {
    const parsedPage = Number.parseInt(key, 10);
    if (!Number.isFinite(parsedPage) || parsedPage < PAGE_MIN) return;
    if (parsedPage === safeTargetPage) return;
    const nextPage = parsedPage > safeTargetPage ? parsedPage - 1 : parsedPage;
    remapped[String(toSafePage(nextPage))] = normalizeWorkbookBoardPageVisualSettings(
      raw,
      params.fallback
    );
  });
  return normalizeWorkbookBoardPageVisualSettingsByPage(
    remapped,
    params.fallback,
    params.maxKnownPage
  );
};

export const extractWorkbookBoardPageVisualSettingsPatch = (
  patch: Partial<WorkbookBoardSettings>
): WorkbookBoardPageVisualSettingsPatch => {
  const nextPatch: WorkbookBoardPageVisualSettingsPatch = {};
  WORKBOOK_PAGE_VISUAL_SETTING_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
    const value = patch[key];
    if (value === undefined) return;
    (nextPatch as Record<string, unknown>)[key] = value;
  });
  return nextPatch;
};
