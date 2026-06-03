import assert from "node:assert/strict";
import test from "node:test";
import { buildAreaSelection, buildImageScissorsAreaSelection } from "./sceneSelection";
import type { WorkbookBoardObject, WorkbookStroke } from "./types";

const buildObject = (
  overrides: Partial<WorkbookBoardObject> = {}
): WorkbookBoardObject => ({
  id: "object-1",
  type: "rectangle",
  layer: "board",
  x: 100,
  y: 100,
  width: 40,
  height: 40,
  color: "#111111",
  fill: "transparent",
  strokeWidth: 2,
  opacity: 1,
  authorUserId: "teacher-1",
  createdAt: "2026-05-28T00:00:00.000Z",
  ...overrides,
});

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
  createdAt: "2026-05-28T00:00:00.000Z",
  ...overrides,
});

test("area selection ignores objects that only barely touch the marquee", () => {
  const object = buildObject({ id: "nearby", x: 95, y: 95, width: 40, height: 40 });

  const selection = buildAreaSelection(
    { x: 130, y: 130, width: 10, height: 10 },
    [object],
    []
  );

  assert.equal(selection, null);
});

test("area selection keeps objects whose center is inside the marquee", () => {
  const object = buildObject({ id: "inside", x: 100, y: 100, width: 40, height: 40 });

  const selection = buildAreaSelection(
    { x: 110, y: 110, width: 25, height: 25 },
    [object],
    []
  );

  assert.deepEqual(selection?.objectIds, ["inside"]);
});

test("area selection does not grab a large background object from a small inner marquee", () => {
  const image = buildObject({
    id: "worksheet-image",
    type: "image",
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  });

  const selection = buildAreaSelection(
    { x: 300, y: 200, width: 80, height: 60 },
    [image],
    []
  );

  assert.equal(selection, null);
});

test("image scissors selection can keep a small crop marquee inside an image", () => {
  const image = buildObject({
    id: "worksheet-image",
    type: "image",
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  });
  const rect = { x: 300, y: 200, width: 80, height: 60 };

  const selection = buildImageScissorsAreaSelection({
    rect,
    probePoints: [{ x: 340, y: 230 }],
    resolveTopObject: () => image,
  });

  assert.deepEqual(selection, {
    objectIds: ["worksheet-image"],
    strokeIds: [],
    rect,
  });
});

test("image scissors selection ignores tiny click-like marquees", () => {
  const image = buildObject({
    id: "worksheet-image",
    type: "image",
    x: 0,
    y: 0,
    width: 1200,
    height: 800,
  });

  const selection = buildImageScissorsAreaSelection({
    rect: { x: 300, y: 200, width: 4, height: 4 },
    probePoints: [{ x: 302, y: 202 }],
    resolveTopObject: () => image,
  });

  assert.equal(selection, null);
});

test("area selection ignores strokes whose bounding box overlaps but path does not", () => {
  const stroke = buildStroke({
    id: "wide-empty-bounds",
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
  });

  const selection = buildAreaSelection(
    { x: 20, y: 20, width: 30, height: 30 },
    [],
    [stroke]
  );

  assert.equal(selection, null);
});

test("area selection includes strokes whose segment crosses the marquee", () => {
  const stroke = buildStroke({
    id: "crossing-stroke",
    points: [
      { x: 0, y: 30 },
      { x: 100, y: 30 },
    ],
  });

  const selection = buildAreaSelection(
    { x: 20, y: 20, width: 30, height: 30 },
    [],
    [stroke]
  );

  assert.deepEqual(selection?.strokeIds, [{ id: "crossing-stroke", layer: "board" }]);
});
