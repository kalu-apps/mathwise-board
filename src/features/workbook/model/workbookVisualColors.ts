export const WORKBOOK_SYSTEM_COLORS = {
  primary: "#2f4f7f",
  secondary: "#2f7464",
  tertiary: "#5f6f86",
  surface: "#f8fbff",
  surfaceMuted: "#eef3f8",
  textPrimary: "#1f252b",
  textMuted: "#66727f",
  gridLine: "rgba(141, 149, 155, 0.42)",
  gridAxis: "#2f4f7f",
  warning: "#c4872f",
  warningSoft: "rgba(196, 135, 47, 0.22)",
  success: "#2f7464",
  successSoft: "rgba(47, 116, 100, 0.18)",
  danger: "#b34b57",
  dangerSoft: "rgba(179, 75, 87, 0.16)",
  pointFill: "#ffffff",
  solidDefaultFill: "#5f6f86",
  focusRing: "rgba(47, 79, 127, 0.3)",
  white: "#ffffff",
  black: "#000000",
} as const;

export const WORKBOOK_GRAPH_COLORS = [
  "#2f4f7f",
  "#2f7464",
  "#6a7c8f",
  "#b34b57",
  "#7b6aa6",
  "#6f8a57",
  "#3f6f9e",
  "#5d6f8a",
] as const;

export const WORKBOOK_TEXT_FALLBACK_COLOR = WORKBOOK_SYSTEM_COLORS.textPrimary;
export const WORKBOOK_BOARD_BACKGROUND_COLOR = WORKBOOK_SYSTEM_COLORS.surface;
export const WORKBOOK_BOARD_GRID_COLOR = WORKBOOK_SYSTEM_COLORS.gridLine;
export const WORKBOOK_BOARD_PRIMARY_COLOR = WORKBOOK_SYSTEM_COLORS.primary;
export const WORKBOOK_BOARD_ANNOTATION_COLOR = WORKBOOK_SYSTEM_COLORS.warning;
export const WORKBOOK_BOARD_HIGHLIGHTER_COLOR = "#d9c16f";
export const WORKBOOK_GRAPH_AXIS_COLOR = WORKBOOK_SYSTEM_COLORS.warning;
export const WORKBOOK_GRAPH_PLANE_COLOR = "rgba(95, 111, 134, 0.2)";
export const WORKBOOK_SHAPE_FILL_SOFT = "rgba(47, 79, 127, 0.08)";
export const WORKBOOK_SELECTION_HANDLE_STROKE = WORKBOOK_SYSTEM_COLORS.white;
export const WORKBOOK_SELECTION_HELPER_COLOR = WORKBOOK_SYSTEM_COLORS.warning;
