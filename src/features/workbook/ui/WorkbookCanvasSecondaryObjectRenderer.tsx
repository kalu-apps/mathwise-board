import type { ReactNode } from "react";
import type { WorkbookBoardObject } from "../model/types";

type SecondaryObjectRendererParams = {
  object: WorkbookBoardObject;
  normalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  transform: string | undefined;
};

export const renderWorkbookCanvasSecondaryObject = ({
  object,
  normalized,
  transform,
}: SecondaryObjectRendererParams): ReactNode | null => {
  if (object.type === "coordinate_grid") {
    const step =
      typeof object.meta?.step === "number" && Number.isFinite(object.meta.step)
        ? Math.max(12, Math.min(64, object.meta.step))
        : 24;
    const lines: ReactNode[] = [];
    for (let x = normalized.x; x <= normalized.x + normalized.width; x += step) {
      lines.push(
        <line
          key={`grid-x-${object.id}-${x}`}
          x1={x}
          y1={normalized.y}
          x2={x}
          y2={normalized.y + normalized.height}
          stroke={object.color ?? "#6d78ac"}
          strokeWidth={0.8}
          opacity={0.45}
        />
      );
    }
    for (let y = normalized.y; y <= normalized.y + normalized.height; y += step) {
      lines.push(
        <line
          key={`grid-y-${object.id}-${y}`}
          x1={normalized.x}
          y1={y}
          x2={normalized.x + normalized.width}
          y2={y}
          stroke={object.color ?? "#6d78ac"}
          strokeWidth={0.8}
          opacity={0.45}
        />
      );
    }
    lines.push(
      <line
        key={`grid-axis-x-${object.id}`}
        x1={normalized.x}
        y1={normalized.y + normalized.height / 2}
        x2={normalized.x + normalized.width}
        y2={normalized.y + normalized.height / 2}
        stroke="#ff8e3c"
        strokeWidth={1.2}
        opacity={0.95}
      />
    );
    lines.push(
      <line
        key={`grid-axis-y-${object.id}`}
        x1={normalized.x + normalized.width / 2}
        y1={normalized.y}
        x2={normalized.x + normalized.width / 2}
        y2={normalized.y + normalized.height}
        stroke="#ff8e3c"
        strokeWidth={1.2}
        opacity={0.95}
      />
    );
    return <g transform={transform}>{lines}</g>;
  }

  if (object.type === "measurement_length" || object.type === "measurement_angle") {
    const label = typeof object.text === "string" ? object.text : "";
    const padding = 8;
    const approxTextWidth = Math.max(70, label.length * 8.5);
    return (
      <g transform={transform}>
        <rect
          x={normalized.x}
          y={normalized.y}
          width={approxTextWidth + padding * 2}
          height={30}
          rx={10}
          ry={10}
          fill="rgba(255, 248, 225, 0.95)"
          stroke="#ffb703"
          strokeWidth={1.1}
        />
        <text
          x={normalized.x + padding}
          y={normalized.y + 20}
          fill="#7a4f00"
          fontSize={13}
          fontWeight={700}
        >
          {label}
        </text>
      </g>
    );
  }

  if (object.type === "section3d") {
    const path = `M ${normalized.x + normalized.width * 0.18} ${normalized.y + normalized.height * 0.2}
      L ${normalized.x + normalized.width * 0.82} ${normalized.y + normalized.height * 0.1}
      L ${normalized.x + normalized.width * 0.92} ${normalized.y + normalized.height * 0.58}
      L ${normalized.x + normalized.width * 0.36} ${normalized.y + normalized.height * 0.78}
      Z`;
    return (
      <path
        d={path}
        fill={object.fill ?? "rgba(255, 142, 60, 0.2)"}
        stroke={object.color ?? "#ff8e3c"}
        strokeWidth={object.strokeWidth ?? 2}
        strokeLinejoin="round"
        transform={transform}
      >
        {typeof object.text === "string" && object.text ? <title>{object.text}</title> : null}
      </path>
    );
  }

  if (object.type === "net3d") {
    const cell = Math.max(24, Math.min(normalized.width / 4, normalized.height / 3));
    const x = normalized.x + normalized.width / 2 - cell / 2;
    const y = normalized.y + normalized.height / 2 - cell / 2;
    const cells = [
      { x: x - cell, y },
      { x, y },
      { x: x + cell, y },
      { x: x + cell * 2, y },
      { x, y: y - cell },
      { x, y: y + cell },
    ];
    return (
      <g transform={transform}>
        {cells.map((cellRect, index) => (
          <rect
            key={`${object.id}-net-${index}`}
            x={cellRect.x}
            y={cellRect.y}
            width={cell}
            height={cell}
            fill={object.fill ?? "rgba(88, 209, 146, 0.14)"}
            stroke={object.color ?? "#2a9d8f"}
            strokeWidth={object.strokeWidth ?? 2}
            rx={3}
            ry={3}
          />
        ))}
        {typeof object.text === "string" && object.text ? (
          <text
            x={normalized.x + 8}
            y={normalized.y + normalized.height + 18}
            fill="#1b6d63"
            fontSize={12}
            fontWeight={600}
          >
            {object.text}
          </text>
        ) : null}
      </g>
    );
  }

  return null;
};
