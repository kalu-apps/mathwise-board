import type { WorkbookStroke } from "./types";

export const upsertWorkbookStrokeById = (
  current: WorkbookStroke[],
  stroke: WorkbookStroke
) => {
  const existingIndex = current.findIndex((item) => item.id === stroke.id);
  if (existingIndex === -1) {
    return [...current, stroke];
  }
  const next = [...current];
  next[existingIndex] = stroke;
  return next;
};
