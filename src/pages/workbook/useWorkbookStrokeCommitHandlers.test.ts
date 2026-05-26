import assert from "node:assert/strict";
import test from "node:test";
import type { WorkbookEraserCommitPayload } from "../../features/workbook/ui/WorkbookCanvas.types";
import type { WorkbookStroke } from "../../features/workbook/model/types";
import { buildWorkbookEraserCommitPlan } from "./workbookEraserCommitPlan";

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

test("batch stroke replacements are emitted as delete and replacement pairs", () => {
  const boardStroke = buildStroke({ id: "board-stroke", layer: "board" });
  const annotationStroke = buildStroke({ id: "annotation-stroke", layer: "annotations" });
  const payload: WorkbookEraserCommitPayload = {
    strokeDeletes: [{ strokeId: "stale-stroke", layer: "board" }],
    strokeReplacements: [
      {
        stroke: boardStroke,
        preserveSourceId: true,
        fragments: [[{ x: 30, y: 40 }]],
      },
      {
        stroke: annotationStroke,
        preserveSourceId: true,
        fragments: [[{ x: 50, y: 60 }]],
      },
    ],
    objectUpdates: [{ objectId: "object-1", patch: { x: 12, y: 34 } }],
  };

  const plan = buildWorkbookEraserCommitPlan({
    payload,
    currentBoardPage: 3,
    nowIso: "2026-05-26T20:00:00.000Z",
  });

  assert.deepEqual(
    plan.events.map((event) => event.type),
    [
      "board.stroke.delete",
      "board.stroke",
      "annotations.stroke.delete",
      "annotations.stroke",
      "board.stroke.delete",
      "board.object.update",
    ]
  );
  assert.deepEqual(plan.events[0].payload, { strokeId: "board-stroke" });
  assert.equal((plan.events[1].payload as { stroke: WorkbookStroke }).stroke.id, "board-stroke");
  assert.deepEqual(plan.events[2].payload, { strokeId: "annotation-stroke" });
  assert.equal(
    (plan.events[3].payload as { stroke: WorkbookStroke }).stroke.id,
    "annotation-stroke"
  );
  assert.deepEqual(plan.events[4].payload, { strokeId: "stale-stroke" });
});

test("explicit deletes do not remove a same-source replacement after it is emitted", () => {
  const source = buildStroke({ id: "same-source-stroke", layer: "board" });
  const payload: WorkbookEraserCommitPayload = {
    strokeDeletes: [{ strokeId: source.id, layer: source.layer }],
    strokeReplacements: [
      {
        stroke: source,
        preserveSourceId: true,
        fragments: [[{ x: 30, y: 40 }]],
      },
    ],
    objectUpdates: [],
  };

  const plan = buildWorkbookEraserCommitPlan({
    payload,
    currentBoardPage: 1,
    nowIso: "2026-05-26T20:00:00.000Z",
  });

  assert.deepEqual(
    plan.events.map((event) => event.type),
    ["board.stroke.delete", "board.stroke"]
  );
});
