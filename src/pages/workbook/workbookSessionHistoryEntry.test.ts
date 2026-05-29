import assert from "node:assert/strict";
import test from "node:test";
import type {
  WorkbookBoardSettings,
  WorkbookDocumentState,
  WorkbookStroke,
} from "../../features/workbook/model/types";
import { buildWorkbookHistoryEntryFromEvents } from "./workbookSessionHistoryEntry";

const buildStroke = (overrides: Partial<WorkbookStroke> = {}): WorkbookStroke => ({
  id: "stroke-1",
  layer: "board",
  color: "#111111",
  width: 4,
  tool: "pen",
  points: [
    { x: 10, y: 20 },
    { x: 20, y: 30 },
  ],
  page: 3,
  authorUserId: "teacher-1",
  createdAt: "2026-05-15T00:00:00.000Z",
  ...overrides,
});

const boardSettings: WorkbookBoardSettings = {
  title: "Session",
  showGrid: true,
  gridSize: 24,
  gridColor: "#e5e7eb",
  backgroundColor: "#ffffff",
  snapToGrid: false,
  showPageNumbers: true,
  pageFrameWidth: 960,
  currentPage: 3,
  pagesCount: 3,
  pageOrder: [1, 2, 3],
  pageTitles: {},
  activeFrameId: null,
  autoSectionDividers: false,
  dividerStep: 1,
  sceneLayers: [{ id: "default", name: "Default", createdAt: "2026-05-15T00:00:00.000Z" }],
  activeSceneLayerId: "default",
};

const documentState: WorkbookDocumentState = {
  assets: [],
  activeAssetId: null,
  page: 1,
  zoom: 1,
  annotations: [],
};

test("builds undoable history for semantic board stroke translation", () => {
  const entry = buildWorkbookHistoryEntryFromEvents({
    events: [
      {
        type: "board.strokes.translate",
        payload: {
          strokeIds: ["stroke-1", "missing-stroke"],
          dx: 50,
          dy: -10,
          page: 3,
          operationId: "move-1",
        },
      },
    ],
    currentBoardStrokes: [buildStroke()],
    currentAnnotationStrokes: [],
    currentObjects: [],
    currentConstraints: [],
    currentBoardSettings: boardSettings,
    currentDocumentState: documentState,
  });

  assert.equal(entry?.page, 3);
  assert.deepEqual(entry?.forward, [
    {
      kind: "translate_strokes",
      layer: "board",
      strokeIds: ["stroke-1"],
      dx: 50,
      dy: -10,
    },
  ]);
  assert.deepEqual(entry?.inverse, [
    {
      kind: "translate_strokes",
      layer: "board",
      strokeIds: ["stroke-1"],
      dx: -50,
      dy: 10,
    },
  ]);
});
