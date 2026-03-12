import { memo } from "react";
import type {
  WorkbookPoint,
  WorkbookStroke,
  WorkbookTool,
} from "../model/types";
import type {
  WorkbookConstraintRenderSegment,
  WorkbookMaskedObjectSceneEntry,
} from "../model/sceneRender";
import { toPath, toSmoothPath } from "../model/stroke";

export type WorkbookCanvasDividerLine = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const WorkbookAutoDividerLayer = memo(function WorkbookAutoDividerLayer({
  lines,
}: {
  lines: WorkbookCanvasDividerLine[];
}) {
  return (
    <>
      {lines.map((line) => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#a1a9c8"
          strokeWidth={1}
          strokeDasharray="5 5"
          opacity={0.7}
        />
      ))}
    </>
  );
});

export const WorkbookStrokeLayer = memo(function WorkbookStrokeLayer({
  strokes,
  preview = false,
}: {
  strokes: WorkbookStroke[];
  preview?: boolean;
}) {
  return (
    <>
      {strokes.map((stroke) => (
        <path
          key={preview ? `preview-${stroke.id}` : stroke.id}
          d={toPath(stroke.points)}
          stroke={stroke.color}
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={stroke.tool === "highlighter" ? 0.5 : preview ? 0.94 : 1}
          pointerEvents={preview ? "none" : undefined}
        />
      ))}
    </>
  );
});

export const WorkbookPresenceLayer = memo(function WorkbookPresenceLayer({
  focusPoints,
  pointerPoints,
}: {
  focusPoints: WorkbookPoint[];
  pointerPoints: WorkbookPoint[];
}) {
  return (
    <>
      {focusPoints.map((focus, index) => (
        <g
          key={`focus-point-${Math.round(focus.x)}-${Math.round(focus.y)}-${index}`}
          className="workbook-session__focus-blink"
        >
          <circle cx={focus.x} cy={focus.y} r={18} />
          <line x1={focus.x - 8} y1={focus.y} x2={focus.x + 8} y2={focus.y} />
          <line x1={focus.x} y1={focus.y - 8} x2={focus.x} y2={focus.y + 8} />
        </g>
      ))}

      {pointerPoints.map((pointer, index) => (
        <g
          key={`laser-pointer-${Math.round(pointer.x)}-${Math.round(pointer.y)}-${index}`}
          className="workbook-session__teacher-pointer"
          transform={`translate(${pointer.x} ${pointer.y}) rotate(-22) scale(0.5)`}
        >
          <path
            className="workbook-session__teacher-pointer-shaft"
            d="M -82 -5 C -74 -8 -44 -9 -11 -7 L -11 7 C -44 9 -74 8 -82 5 Z"
          />
          <path
            className="workbook-session__teacher-pointer-tip"
            d="M -11 -7 L 13 0 L -11 7 Z"
          />
          <path
            className="workbook-session__teacher-pointer-accent"
            d="M -78 -2 C -58 -5 -33 -5 -13 -4"
          />
          <circle className="workbook-session__teacher-pointer-glow" cx={15} cy={0} r={7.4} />
          <circle className="workbook-session__teacher-pointer-point" cx={15} cy={0} r={3.4} />
        </g>
      ))}
    </>
  );
});

export const WorkbookObjectSceneLayer = memo(function WorkbookObjectSceneLayer({
  entries,
}: {
  entries: WorkbookMaskedObjectSceneEntry[];
}) {
  return (
    <>
      {entries.map((entry) => {
        if (
          entry.resolvedEraserCuts.length === 0 &&
          entry.maskPaths.length === 0 &&
          !entry.maskBounds
        ) {
          return <g key={entry.id}>{entry.renderedObject}</g>;
        }
        const safeMaskId = `workbook-object-mask-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        return (
          <g key={entry.id}>
            <defs>
              <mask
                id={safeMaskId}
                maskUnits="userSpaceOnUse"
                x={entry.maskBounds?.x ?? 0}
                y={entry.maskBounds?.y ?? 0}
                width={entry.maskBounds?.width ?? 1}
                height={entry.maskBounds?.height ?? 1}
              >
                <rect
                  x={entry.maskBounds?.x ?? 0}
                  y={entry.maskBounds?.y ?? 0}
                  width={entry.maskBounds?.width ?? 1}
                  height={entry.maskBounds?.height ?? 1}
                  fill="#ffffff"
                />
                {entry.resolvedEraserCuts.map((cut, index) => (
                  <circle
                    key={`${entry.id}-erase-cut-${index}`}
                    cx={cut.x}
                    cy={cut.y}
                    r={Math.max(1, cut.radius)}
                    fill="#000000"
                  />
                ))}
                {entry.maskPaths.map((path, index) => (
                  <path
                    key={`${entry.id}-erase-path-${index}`}
                    d={toSmoothPath(path.points)}
                    stroke="#000000"
                    strokeWidth={Math.max(1, path.radius * 2)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </mask>
            </defs>
            <g mask={`url(#${safeMaskId})`}>{entry.renderedObject}</g>
          </g>
        );
      })}
    </>
  );
});

export const WorkbookConstraintLayer = memo(function WorkbookConstraintLayer({
  segments,
  selectedConstraintId,
  tool,
  onSelectConstraint,
}: {
  segments: WorkbookConstraintRenderSegment[];
  selectedConstraintId: string | null;
  tool: WorkbookTool;
  onSelectConstraint: (constraintId: string) => void;
}) {
  const interactive = tool === "select";
  return (
    <>
      {segments.map((segment) => {
        const isActive = segment.constraint.id === selectedConstraintId;
        const midX = (segment.source.x + segment.target.x) / 2;
        const midY = (segment.source.y + segment.target.y) / 2;
        return (
          <g
            key={`constraint-${segment.constraint.id}`}
            className={`workbook-session__constraint-line ${isActive ? "is-active" : ""}`}
            onPointerDown={(event) => {
              if (!interactive) return;
              event.stopPropagation();
              onSelectConstraint(segment.constraint.id);
            }}
            style={{ pointerEvents: interactive ? "all" : "none" }}
          >
            <line
              x1={segment.source.x}
              y1={segment.source.y}
              x2={segment.target.x}
              y2={segment.target.y}
            />
            <text x={midX} y={midY}>
              {segment.label}
            </text>
          </g>
        );
      })}
    </>
  );
});
