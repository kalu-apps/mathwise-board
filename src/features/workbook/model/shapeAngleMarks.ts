import type { WorkbookBoardObject } from "./types";

export type WorkbookShapeAngleMarkStyle =
  | "auto"
  | "right_square"
  | "arc_single"
  | "arc_double"
  | "arc_triple";

export type WorkbookRenderedShapeAngleMarkStyle = Exclude<
  WorkbookShapeAngleMarkStyle,
  "auto"
>;

export type WorkbookShapeAngleMark = {
  valueText: string;
  color: string;
  style: WorkbookShapeAngleMarkStyle;
};

export const SHAPE_ANGLE_MARK_STYLE_OPTIONS: Array<{
  value: WorkbookShapeAngleMarkStyle;
  label: string;
  preview: string;
}> = [
  {
    value: "auto",
    label: "Авто",
    preview: "AUTO",
  },
  {
    value: "right_square",
    label: "Прямой угол",
    preview: "∟",
  },
  {
    value: "arc_single",
    label: "Одна дуга",
    preview: "⌒",
  },
  {
    value: "arc_double",
    label: "Две дуги",
    preview: "⌒⌒",
  },
  {
    value: "arc_triple",
    label: "Три дуги",
    preview: "⌒⌒⌒",
  },
];

const isShapeAngleMarkStyle = (value: unknown): value is WorkbookShapeAngleMarkStyle =>
  value === "auto" ||
  value === "right_square" ||
  value === "arc_single" ||
  value === "arc_double" ||
  value === "arc_triple";

const readShapeAngleMark = (
  value: unknown,
  fallbackColor: string,
  legacyValueText: string,
  legacyColor: string
): WorkbookShapeAngleMark | null => {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<WorkbookShapeAngleMark>;
  const color =
    typeof source.color === "string" && source.color.trim().length > 0
      ? source.color
      : legacyColor;
  return {
    valueText:
      typeof source.valueText === "string"
        ? source.valueText.slice(0, 24)
        : legacyValueText.slice(0, 24),
    color: color || fallbackColor,
    style: isShapeAngleMarkStyle(source.style) ? source.style : "arc_single",
  };
};

export const normalizeShapeAngleMarks = (
  object: WorkbookBoardObject | null | undefined,
  angleCount: number,
  fallbackColor: string
): WorkbookShapeAngleMark[] => {
  const rawMarks = Array.isArray(object?.meta?.angleMarks) ? object?.meta?.angleMarks : [];
  const legacyNotes = Array.isArray(object?.meta?.angleNotes) ? object?.meta?.angleNotes : [];
  const legacyColors = Array.isArray(object?.meta?.angleColors) ? object?.meta?.angleColors : [];

  return Array.from({ length: Math.max(0, angleCount) }, (_, index) => {
    const legacyValueText =
      typeof legacyNotes[index] === "string" ? legacyNotes[index] : "";
    const legacyColor =
      typeof legacyColors[index] === "string" && legacyColors[index]
        ? legacyColors[index]
        : fallbackColor;
    return (
      readShapeAngleMark(rawMarks[index], fallbackColor, legacyValueText, legacyColor) ?? {
        valueText: legacyValueText.slice(0, 24),
        color: legacyColor || fallbackColor,
        style: "arc_single",
      }
    );
  });
};

export const resolveRenderedShapeAngleMarkStyle = (
  style: WorkbookShapeAngleMarkStyle,
  angleDeg: number
): WorkbookRenderedShapeAngleMarkStyle => {
  if (style !== "auto") return style;
  return Math.abs(angleDeg - 90) <= 4 ? "right_square" : "arc_single";
};
