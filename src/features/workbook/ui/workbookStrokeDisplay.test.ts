import assert from "node:assert/strict";
import test from "node:test";
import type { WorkbookStroke } from "../model/types";
import {
  buildMovingStrokeDisplayState,
  buildRenderedStrokeSelectionKey,
  replaceRenderedStrokesBySelection,
} from "./workbookStrokeDisplay";

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
  page: 1,
  authorUserId: "teacher-1",
  createdAt: "2026-05-15T00:00:00.000Z",
  ...overrides,
});

test("keeps original selected stroke when moving replacement is missing", () => {
  const source = buildStroke();

  const next = replaceRenderedStrokesBySelection({
    baseStrokes: [source],
    selections: [{ id: source.id, layer: source.layer }],
    replacementBySelectionKey: new Map(),
    keepOriginalWhenMissingReplacement: true,
  });

  assert.deepEqual(next, [source]);
});

test("drops original selected stroke by default when replacement is missing", () => {
  const source = buildStroke();

  const next = replaceRenderedStrokesBySelection({
    baseStrokes: [source],
    selections: [{ id: source.id, layer: source.layer }],
    replacementBySelectionKey: new Map(),
  });

  assert.deepEqual(next, []);
});

test("normalizes preview fragment ids back to their source stroke selection", () => {
  const previewFragment = buildStroke({ id: "stroke-1::preview-0" });

  assert.equal(buildRenderedStrokeSelectionKey(previewFragment), "board:stroke-1");
});

test("moving display state exposes only strokes with current source data", () => {
  const source = buildStroke();

  const state = buildMovingStrokeDisplayState({
    moving: {
      start: { x: 10, y: 20 },
      current: { x: 15, y: 27 },
    },
    movingStrokeSelections: [
      { id: source.id, layer: source.layer },
      { id: "stale-stroke", layer: "board" },
    ],
    strokeByKey: new Map([["board:stroke-1", source]]),
  });

  assert.deepEqual(state.selections, [{ id: source.id, layer: source.layer }]);
  assert.deepEqual(state.replacementBySelectionKey.get("board:stroke-1")?.points, [
    { x: 15, y: 27 },
    { x: 25, y: 37 },
  ]);
  assert.equal(state.selectionKeys.has("board:stale-stroke"), false);
});
