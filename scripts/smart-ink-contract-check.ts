import {
  recognizeSmartInkBatch,
  recognizeSmartInkStroke,
} from "../src/features/workbook/model/smartInk";
import { normalizeSmartInkOptions } from "../src/pages/workbook/workbookBoardSettingsModel";
import type { WorkbookPoint, WorkbookStroke } from "../src/features/workbook/model/types";

type ContractCase = {
  name: string;
  run: () => Promise<void> | void;
};

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const nowIso = () => new Date("2026-01-01T00:00:00.000Z").toISOString();

const makeStroke = (id: string, points: WorkbookPoint[]): WorkbookStroke => ({
  id,
  layer: "board",
  color: "#1f2f90",
  width: 3,
  tool: "pen",
  points,
  authorUserId: "contract-user",
  createdAt: nowIso(),
  page: 1,
});

const rectangleStroke = makeStroke("rect-1", [
  { x: 20, y: 20 },
  { x: 120, y: 20 },
  { x: 120, y: 90 },
  { x: 20, y: 90 },
  { x: 20, y: 20 },
]);

const freeTextStroke = makeStroke("text-1", [
  { x: 10, y: 10 },
  { x: 24, y: 18 },
  { x: 32, y: 28 },
  { x: 44, y: 20 },
  { x: 58, y: 31 },
  { x: 71, y: 24 },
  { x: 83, y: 35 },
]);

const freeTextStrokePart2 = makeStroke("text-2", [
  { x: 90, y: 38 },
  { x: 102, y: 29 },
  { x: 118, y: 41 },
  { x: 134, y: 34 },
  { x: 146, y: 44 },
]);

const cases: ContractCase[] = [
  {
    name: "default smart ink options keep pen mode by default",
    run: () => {
      const options = normalizeSmartInkOptions(undefined);
      assert(options.mode === "off", "Expected default mode=off");
      assert(options.smartShapes === false, "Expected smartShapes=false in off mode");
    },
  },
  {
    name: "shape mode is strictly figure-only",
    run: () => {
      const options = normalizeSmartInkOptions({
        mode: "shape",
        smartShapes: false,
        smartTextOcr: true,
        smartMathOcr: true,
      });
      assert(options.mode === "shape", "Expected mode=shape");
      assert(options.smartShapes === true, "Expected smartShapes=true in shape mode");
      assert(options.smartTextOcr === false, "Expected smartTextOcr=false in shape mode");
      assert(options.smartMathOcr === false, "Expected smartMathOcr=false in shape mode");
    },
  },
  {
    name: "legacy full/basic modes are normalized",
    run: () => {
      const legacyBasic = normalizeSmartInkOptions({ mode: "basic" as never });
      assert(legacyBasic.mode === "shape", "Expected legacy basic -> shape");
      const legacyFull = normalizeSmartInkOptions({ mode: "full" as never });
      assert(legacyFull.mode === "auto", "Expected legacy full -> auto");
    },
  },
  {
    name: "shape recognition is gated by smartShapes",
    run: async () => {
      const withShapes = await recognizeSmartInkStroke(rectangleStroke, {
        smartShapes: true,
      });
      assert(withShapes.kind === "shape", "Expected shape detection with smartShapes=true");

      const withoutShapes = await recognizeSmartInkStroke(rectangleStroke, {
        smartShapes: false,
      });
      assert(withoutShapes.kind === "none", "Expected no shape detection with smartShapes=false");
    },
  },
  {
    name: "ocr confidence is taken from adapter (single stroke)",
    run: async () => {
      const result = await recognizeSmartInkStroke(freeTextStroke, {
        smartShapes: false,
        smartTextOcr: true,
        smartMathOcr: false,
        handwritingAdapter: async () => ({
          text: "test phrase",
          confidence: 0.93,
        }),
      });
      assert(result.kind === "text", "Expected text result from OCR");
      assert(
        Math.abs(result.confidence - 0.93) < 0.0001,
        `Expected OCR confidence=0.93, got ${result.kind === "none" ? "none" : result.confidence}`
      );
    },
  },
  {
    name: "ocr confidence is taken from adapter (batch)",
    run: async () => {
      const result = await recognizeSmartInkBatch([freeTextStroke, freeTextStrokePart2], {
        smartShapes: false,
        smartTextOcr: true,
        smartMathOcr: false,
        handwritingAdapter: async () => ({
          text: "batch text",
          confidence: 0.41,
        }),
      });
      assert(result.kind === "text", "Expected batch text result from OCR");
      assert(
        Math.abs(result.confidence - 0.41) < 0.0001,
        `Expected OCR batch confidence=0.41, got ${
          result.kind === "none" ? "none" : result.confidence
        }`
      );

      const applyAt40 = result.kind !== "none" && result.confidence >= 0.4;
      const applyAt42 = result.kind !== "none" && result.confidence >= 0.42;
      assert(applyAt40 === true, "Expected apply=true at threshold 0.40");
      assert(applyAt42 === false, "Expected apply=false at threshold 0.42");
    },
  },
];

const run = async () => {
  const startedAt = Date.now();
  for (const testCase of cases) {
    await testCase.run();
    console.log(`[ok] ${testCase.name}`);
  }
  const elapsedMs = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: cases.length,
        elapsedMs,
      },
      null,
      2
    )
  );
};

void run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
