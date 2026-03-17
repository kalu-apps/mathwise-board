import { memo, useEffect, useMemo, useRef } from "react";
import type { WorkbookPoint, WorkbookStroke } from "../model/types";

type CommittedStrokeBatch = {
  id: string;
  color: string;
  width: number;
  opacity: number;
  points: number[];
};

type WorkerRenderResult = {
  requestId: number;
  batches: CommittedStrokeBatch[];
  sourceStrokeCount: number;
  renderedStrokeCount: number;
  droppedStrokeCount: number;
  sourcePointCount: number;
  renderedPointCount: number;
};

type WorkerRenderPayload = {
  requestId: number;
  strokes: Array<{
    id: string;
    color: string;
    width: number;
    tool: string;
    page?: number;
    points: WorkbookPoint[];
  }>;
  viewportOffset: WorkbookPoint;
  zoom: number;
  width: number;
  height: number;
  currentPage: number;
  maxPointsPerStroke: number;
};

type WorkerRenderBasePayload = Omit<WorkerRenderPayload, "requestId">;

type WorkbookCommittedCanvasLayerProps = {
  strokes: WorkbookStroke[];
  viewportOffset: WorkbookPoint;
  zoom: number;
  width: number;
  height: number;
  currentPage: number;
};

const MAX_POINTS_PER_STROKE = 240;

const drawBatches = (
  canvas: HTMLCanvasElement,
  batches: CommittedStrokeBatch[],
  width: number,
  height: number
) => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const dpr =
    typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
      ? Math.max(1, Math.min(2.5, window.devicePixelRatio))
      : 1;
  const nextPixelWidth = Math.max(1, Math.round(safeWidth * dpr));
  const nextPixelHeight = Math.max(1, Math.round(safeHeight * dpr));

  if (canvas.width !== nextPixelWidth || canvas.height !== nextPixelHeight) {
    canvas.width = nextPixelWidth;
    canvas.height = nextPixelHeight;
  }
  canvas.style.width = `${safeWidth}px`;
  canvas.style.height = `${safeHeight}px`;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.save();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, safeWidth, safeHeight);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const batch of batches) {
    if (!Array.isArray(batch.points) || batch.points.length < 4) continue;
    context.globalAlpha = Math.max(0.1, Math.min(1, batch.opacity));
    context.strokeStyle = batch.color;
    context.lineWidth = Math.max(0.8, batch.width);
    context.beginPath();
    context.moveTo(batch.points[0], batch.points[1]);
    for (let pointIndex = 2; pointIndex < batch.points.length; pointIndex += 2) {
      context.lineTo(batch.points[pointIndex], batch.points[pointIndex + 1]);
    }
    context.stroke();
  }

  context.restore();
};

export const WorkbookCommittedCanvasLayer = memo(function WorkbookCommittedCanvasLayer({
  strokes,
  viewportOffset,
  zoom,
  width,
  height,
  currentPage,
}: WorkbookCommittedCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestAppliedRequestIdRef = useRef(0);
  const pendingPayloadRef = useRef<WorkerRenderPayload | null>(null);
  const workerBusyRef = useRef(false);
  const pendingDrawBatchesRef = useRef<CommittedStrokeBatch[] | null>(null);
  const drawFrameRef = useRef<number | null>(null);

  const payloadBase = useMemo<WorkerRenderBasePayload>(
    () => ({
      strokes: strokes.map((stroke) => ({
        id: stroke.id,
        color: stroke.color,
        width: stroke.width,
        tool: stroke.tool,
        page: stroke.page,
        points: stroke.points,
      })),
      viewportOffset,
      zoom,
      width,
      height,
      currentPage,
      maxPointsPerStroke: MAX_POINTS_PER_STROKE,
    }),
    [currentPage, height, strokes, viewportOffset, width, zoom]
  );

  const scheduleDraw = useMemo(
    () => (batches: CommittedStrokeBatch[]) => {
      pendingDrawBatchesRef.current = batches;
      if (drawFrameRef.current !== null) return;
      drawFrameRef.current = window.requestAnimationFrame(() => {
        drawFrameRef.current = null;
        const canvas = canvasRef.current;
        const nextBatches = pendingDrawBatchesRef.current;
        pendingDrawBatchesRef.current = null;
        if (!canvas || !nextBatches) return;
        drawBatches(canvas, nextBatches, width, height);
      });
    },
    [height, width]
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      const canvas = canvasRef.current;
      if (canvas) {
        drawBatches(canvas, [], width, height);
      }
      return;
    }
    const worker = new Worker(
      new URL("./workers/workbookCommittedStrokeBatch.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerRenderResult>) => {
      workerBusyRef.current = false;
      const data = event.data;
      if (!data || typeof data !== "object" || !Number.isFinite(data.requestId)) {
        return;
      }
      if (data.requestId < latestAppliedRequestIdRef.current) {
        return;
      }
      latestAppliedRequestIdRef.current = data.requestId;
      scheduleDraw(data.batches);
      const nextPayload = pendingPayloadRef.current;
      if (nextPayload) {
        pendingPayloadRef.current = null;
        requestIdRef.current = nextPayload.requestId;
        workerBusyRef.current = true;
        worker.postMessage(nextPayload satisfies WorkerRenderPayload);
      }
    };
    worker.onerror = () => {
      workerBusyRef.current = false;
    };
    return () => {
      if (drawFrameRef.current !== null) {
        window.cancelAnimationFrame(drawFrameRef.current);
        drawFrameRef.current = null;
      }
      worker.terminate();
      workerRef.current = null;
    };
  }, [height, scheduleDraw, width]);

  useEffect(() => {
    const worker = workerRef.current;
    const canvas = canvasRef.current;
    if (!worker || !canvas) {
      if (canvas) {
        drawBatches(canvas, [], width, height);
      }
      return;
    }
    const nextPayload: WorkerRenderPayload = {
      ...payloadBase,
      requestId: requestIdRef.current + 1,
    };
    if (workerBusyRef.current) {
      pendingPayloadRef.current = nextPayload;
      return;
    }
    requestIdRef.current = nextPayload.requestId;
    workerBusyRef.current = true;
    worker.postMessage(nextPayload);
  }, [height, payloadBase, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawBatches(canvas, pendingDrawBatchesRef.current ?? [], width, height);
  }, [height, width]);

  return (
    <canvas
      ref={canvasRef}
      className="workbook-session__canvas-committed"
      aria-hidden="true"
    />
  );
});
