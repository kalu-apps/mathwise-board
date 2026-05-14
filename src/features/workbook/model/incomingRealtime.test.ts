import assert from "node:assert/strict";
import test from "node:test";
import { upsertWorkbookStrokeById } from "./strokeCollection";
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

test("incoming stroke upsert replaces an existing stroke with the same id", () => {
  const original = buildStroke();
  const moved = buildStroke({
    points: [
      { x: 110, y: 120 },
      { x: 120, y: 130 },
    ],
    createdAt: "2026-05-15T00:00:01.000Z",
  });

  const next = upsertWorkbookStrokeById([original], moved);

  assert.equal(next.length, 1);
  assert.deepEqual(next[0], moved);
});

test("incoming stroke upsert appends a new stroke id", () => {
  const original = buildStroke();
  const nextStroke = buildStroke({ id: "stroke-2" });

  const next = upsertWorkbookStrokeById([original], nextStroke);

  assert.deepEqual(next, [original, nextStroke]);
});
