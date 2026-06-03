import assert from "node:assert/strict";
import test from "node:test";
import {
  findVisuallyAbsorbedWorkbookStrokeDeleteIndexes,
  isWorkbookStrokeReplacementPair,
} from "./strokeReplacementEvents";
import type { WorkbookEvent, WorkbookStroke } from "./types";

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

const buildEvent = (
  type: WorkbookEvent["type"],
  payload: unknown,
  seq = 1
): WorkbookEvent => ({
  id: `event-${seq}`,
  sessionId: "session-1",
  seq,
  type,
  authorUserId: "teacher-1",
  payload,
  createdAt: "2026-05-15T00:00:00.000Z",
});

test("detects same-layer stroke delete and upsert replacement pairs", () => {
  const deleted = buildEvent("board.stroke.delete", { strokeId: "stroke-1" });
  const upserted = buildEvent("board.stroke", { stroke: buildStroke() }, 2);

  assert.equal(isWorkbookStrokeReplacementPair(deleted, upserted), true);
});

test("does not treat mismatched stroke layers as replacement pairs", () => {
  const deleted = buildEvent("board.stroke.delete", { strokeId: "stroke-1" });
  const upserted = buildEvent(
    "annotations.stroke",
    { stroke: buildStroke({ layer: "annotations" }) },
    2
  );

  assert.equal(isWorkbookStrokeReplacementPair(deleted, upserted), false);
});

test("marks only deletes that are followed by a same-id authoritative upsert", () => {
  const events = [
    buildEvent("board.stroke.delete", { strokeId: "moved" }, 1),
    buildEvent("board.stroke", { stroke: buildStroke({ id: "moved" }) }, 2),
    buildEvent("board.stroke.delete", { strokeId: "removed" }, 3),
  ];

  assert.deepEqual(Array.from(findVisuallyAbsorbedWorkbookStrokeDeleteIndexes(events)), [0]);
});
