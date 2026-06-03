import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWorkbookStrokeTranslatePayload,
  resolveWorkbookStrokeTranslateLayer,
  translateWorkbookStrokesByIds,
} from "./strokeTranslateEvents";
import type { WorkbookStroke } from "./types";

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

test("normalizes stroke translate payload without carrying stroke points", () => {
  const payload = normalizeWorkbookStrokeTranslatePayload({
    strokeIds: [" stroke-1 ", "stroke-2", "stroke-1", "", 42],
    dx: 12.5,
    dy: -3,
    page: 2.8,
    operationId: " move-1 ",
    ignoredPoints: [{ x: 1, y: 2 }],
  });

  assert.deepEqual(payload, {
    strokeIds: ["stroke-1", "stroke-2"],
    dx: 12.5,
    dy: -3,
    page: 2,
    operationId: "move-1",
  });
});

test("rejects empty or zero-distance stroke translate payloads", () => {
  assert.equal(
    normalizeWorkbookStrokeTranslatePayload({ strokeIds: ["stroke-1"], dx: 0, dy: 0 }),
    null
  );
  assert.equal(
    normalizeWorkbookStrokeTranslatePayload({ strokeIds: [], dx: 10, dy: 0 }),
    null
  );
});

test("caps normalized stroke ids to the configured event size", () => {
  const payload = normalizeWorkbookStrokeTranslatePayload(
    { strokeIds: ["stroke-1", "stroke-2", "stroke-3"], dx: 1, dy: 0 },
    { maxStrokeIds: 2 }
  );

  assert.deepEqual(payload?.strokeIds, ["stroke-1", "stroke-2"]);
});

test("resolves translate event layer by event type", () => {
  assert.equal(resolveWorkbookStrokeTranslateLayer("board.strokes.translate"), "board");
  assert.equal(
    resolveWorkbookStrokeTranslateLayer("annotations.strokes.translate"),
    "annotations"
  );
  assert.equal(resolveWorkbookStrokeTranslateLayer("board.stroke"), null);
});

test("translates only selected strokes by ids", () => {
  const untouched = buildStroke({ id: "stroke-2" });
  const translated = translateWorkbookStrokesByIds(
    [buildStroke(), untouched],
    ["stroke-1"],
    5,
    -2
  );

  assert.deepEqual(translated[0]?.points, [
    { x: 15, y: 18 },
    { x: 25, y: 28 },
  ]);
  assert.strictEqual(translated[1], untouched);
});
