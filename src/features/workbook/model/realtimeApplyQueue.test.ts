import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbookRealtimeApplyQueue } from "./realtimeApplyQueue";
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
  seq: number
): WorkbookEvent => ({
  id: `event-${seq}`,
  sessionId: "session-1",
  seq,
  type,
  authorUserId: "teacher-1",
  payload,
  createdAt: "2026-05-15T00:00:00.000Z",
});

test("critical apply queue keeps same-id stroke replacement pairs in one chunk", () => {
  const appliedChunks: WorkbookEvent[][] = [];
  const queue = createWorkbookRealtimeApplyQueue({
    applyEvents: (events) => {
      appliedChunks.push(events);
    },
    frameBudgetMs: 10,
    criticalFrameBudgetMs: 10,
    volatileFrameBudgetMs: 1,
    maxEventsPerFrame: 1,
    maxCriticalEventsPerFrame: 1,
    maxVolatileEventsPerFrame: 1,
    maxCriticalChunkEvents: 1,
    maxVolatileChunkEvents: 1,
  });

  queue.enqueue({
    channel: "stream",
    latestSeq: 2,
    events: [
      buildEvent("board.stroke.delete", { strokeId: "stroke-1" }, 1),
      buildEvent("board.stroke", { stroke: buildStroke() }, 2),
    ],
  });

  assert.equal(appliedChunks.length, 1);
  assert.deepEqual(
    appliedChunks[0]?.map((event) => event.type),
    ["board.stroke.delete", "board.stroke"]
  );
});

test("critical apply queue still splits unrelated events by configured budget", () => {
  const appliedChunks: WorkbookEvent[][] = [];
  const queue = createWorkbookRealtimeApplyQueue({
    applyEvents: (events) => {
      appliedChunks.push(events);
    },
    frameBudgetMs: 10,
    criticalFrameBudgetMs: 10,
    volatileFrameBudgetMs: 1,
    maxEventsPerFrame: 1,
    maxCriticalEventsPerFrame: 1,
    maxVolatileEventsPerFrame: 1,
    maxCriticalChunkEvents: 1,
    maxVolatileChunkEvents: 1,
  });

  queue.enqueue({
    channel: "stream",
    latestSeq: 2,
    events: [
      buildEvent("board.stroke.delete", { strokeId: "stroke-1" }, 1),
      buildEvent("board.stroke.delete", { strokeId: "stroke-2" }, 2),
    ],
  });

  assert.equal(appliedChunks.length, 2);
  assert.deepEqual(
    appliedChunks.map((chunk) => chunk.map((event) => event.type)),
    [["board.stroke.delete"], ["board.stroke.delete"]]
  );
});
