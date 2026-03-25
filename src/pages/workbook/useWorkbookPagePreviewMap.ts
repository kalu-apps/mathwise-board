import { useMemo } from "react";
import type { WorkbookBoardObject, WorkbookStroke } from "@/features/workbook/model/types";
import type { WorkbookBoardPageOption } from "./WorkbookSessionBoardSettingsPanel";
import { toSafeWorkbookPage } from "./WorkbookSessionPage.core";

export type WorkbookPagePreviewData = {
  objects: WorkbookBoardObject[];
  strokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
};

type UseWorkbookPagePreviewMapParams = {
  pageOptions: WorkbookBoardPageOption[];
  boardObjects: WorkbookBoardObject[];
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
};

const MAX_OBJECTS_PER_PAGE_PREVIEW = 260;
const MAX_STROKES_PER_PAGE_PREVIEW = 320;

const buildSortedObjects = (objects: WorkbookBoardObject[]) => {
  const sortedObjects = [...objects].sort((left, right) => {
    const leftOrder = Number.isFinite(left.zOrder) ? Number(left.zOrder) : 0;
    const rightOrder = Number.isFinite(right.zOrder) ? Number(right.zOrder) : 0;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.id.localeCompare(right.id);
  });
  return sortedObjects.length > MAX_OBJECTS_PER_PAGE_PREVIEW
    ? sortedObjects.slice(sortedObjects.length - MAX_OBJECTS_PER_PAGE_PREVIEW)
    : sortedObjects;
};

const buildLimitedStrokes = (strokes: WorkbookStroke[]) =>
  strokes.length > MAX_STROKES_PER_PAGE_PREVIEW
    ? strokes.slice(strokes.length - MAX_STROKES_PER_PAGE_PREVIEW)
    : strokes;

export const useWorkbookPagePreviewMap = ({
  pageOptions,
  boardObjects,
  boardStrokes,
  annotationStrokes,
}: UseWorkbookPagePreviewMapParams) =>
  useMemo(() => {
    const pageSet = new Set(pageOptions.map((option) => option.page));
    const map = new Map<number, WorkbookPagePreviewData>();

    pageOptions.forEach((option) => {
      map.set(option.page, {
        objects: [],
        strokes: [],
        annotationStrokes: [],
      });
    });

    boardObjects.forEach((object) => {
      const page = toSafeWorkbookPage(object.page);
      if (!pageSet.has(page)) return;
      const bucket = map.get(page);
      if (!bucket) return;
      bucket.objects.push(object);
    });

    boardStrokes.forEach((stroke) => {
      const page = toSafeWorkbookPage(stroke.page);
      if (!pageSet.has(page)) return;
      const bucket = map.get(page);
      if (!bucket) return;
      bucket.strokes.push(stroke);
    });

    annotationStrokes.forEach((stroke) => {
      const page = toSafeWorkbookPage(stroke.page);
      if (!pageSet.has(page)) return;
      const bucket = map.get(page);
      if (!bucket) return;
      bucket.annotationStrokes.push(stroke);
    });

    map.forEach((bucket, page) => {
      map.set(page, {
        objects: buildSortedObjects(bucket.objects),
        strokes: buildLimitedStrokes(bucket.strokes),
        annotationStrokes: buildLimitedStrokes(bucket.annotationStrokes),
      });
    });

    return map;
  }, [annotationStrokes, boardObjects, boardStrokes, pageOptions]);

