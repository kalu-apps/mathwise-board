import {
  getWorkbookPolygonPoints,
  toSvgPointString,
  type WorkbookPolygonPreset,
} from "@/features/workbook/model/shapeGeometry";
import { getSolid3dTemplate } from "@/features/workbook/model/solid3d";

export const SolidPresetPreview = ({ presetId }: { presetId: string }) => {
  const template = getSolid3dTemplate(presetId);
  const isRoundPreset =
    presetId === "cylinder" ||
    presetId === "cone" ||
    presetId === "truncated_cone" ||
    presetId === "sphere" ||
    presetId === "hemisphere" ||
    presetId === "torus";
  const mapX = (value: number) => 10 + (value / 100) * 100;
  const mapY = (value: number) => 10 + (value / 100) * 80;
  const pathArc = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    part: "front" | "back"
  ) => {
    const sweep = part === "front" ? 0 : 1;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 ${sweep} ${cx + rx} ${cy}`;
  };

  return (
    <svg viewBox="0 0 120 100" role="img" aria-hidden="true">
      {!isRoundPreset
        ? (
            <>
              {template.faces?.map((face, index) => (
                <polygon
                  key={`face-${template.id}-${index}`}
                  points={face.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(" ")}
                  fill="rgba(47, 79, 127, 0.12)"
                  stroke="none"
                />
              ))}
              {template.segments.map((segment, index) => (
                <line
                  key={`segment-${template.id}-${index}`}
                  x1={mapX(segment.from.x)}
                  y1={mapY(segment.from.y)}
                  x2={mapX(segment.to.x)}
                  y2={mapY(segment.to.y)}
                  stroke="#1f252b"
                  strokeWidth={2}
                  strokeDasharray={segment.hidden ? "6 5" : undefined}
                  strokeLinecap="round"
                />
              ))}
            </>
          )
        : null}
      {presetId === "cylinder" ? (
        <>
          <path d={pathArc(60, 30, 24, 7, "front")} fill="none" stroke="#1f252b" strokeWidth={2} />
          <path
            d={pathArc(60, 30, 24, 7, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={2}
          />
          <line x1={36} y1={30} x2={36} y2={74} stroke="#1f252b" strokeWidth={2} />
          <line x1={84} y1={30} x2={84} y2={74} stroke="#1f252b" strokeWidth={2} />
          <line
            x1={60}
            y1={30}
            x2={60}
            y2={74}
            stroke="#1f252b"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            opacity={0.7}
          />
          <path d={pathArc(60, 74, 24, 7, "front")} fill="none" stroke="#1f252b" strokeWidth={2} />
          <path
            d={pathArc(60, 74, 24, 7, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={2}
          />
        </>
      ) : null}
      {presetId === "cone" ? (
        <>
          <line x1={60} y1={18} x2={36} y2={76} stroke="#1f252b" strokeWidth={2} />
          <line x1={60} y1={18} x2={84} y2={76} stroke="#1f252b" strokeWidth={2} />
          <line
            x1={60}
            y1={18}
            x2={60}
            y2={76}
            stroke="#1f252b"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            opacity={0.72}
          />
          <path d={pathArc(60, 76, 24, 7, "front")} fill="none" stroke="#1f252b" strokeWidth={2} />
          <path
            d={pathArc(60, 76, 24, 7, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={2}
          />
        </>
      ) : null}
      {presetId === "truncated_cone" ? (
        <>
          <path d={pathArc(60, 28, 13, 4, "front")} fill="none" stroke="#1f252b" strokeWidth={2} />
          <path
            d={pathArc(60, 28, 13, 4, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={2}
          />
          <line x1={47} y1={28} x2={36} y2={76} stroke="#1f252b" strokeWidth={2} />
          <line x1={73} y1={28} x2={84} y2={76} stroke="#1f252b" strokeWidth={2} />
          <line
            x1={60}
            y1={28}
            x2={60}
            y2={76}
            stroke="#1f252b"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            opacity={0.72}
          />
          <path d={pathArc(60, 76, 24, 7, "front")} fill="none" stroke="#1f252b" strokeWidth={2} />
          <path
            d={pathArc(60, 76, 24, 7, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={2}
          />
        </>
      ) : null}
      {presetId === "sphere" ? (
        <>
          <ellipse
            cx={60}
            cy={50}
            rx={28}
            ry={24}
            fill="rgba(47, 79, 127, 0.08)"
            stroke="#1f252b"
            strokeWidth={2}
          />
          <path d={pathArc(60, 50, 28, 7, "front")} fill="none" stroke="#1f252b" strokeWidth={1.8} />
          <path
            d={pathArc(60, 50, 28, 7, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={1.8}
            strokeDasharray="6 5"
          />
          <path
            d="M 60 26 A 9 24 0 0 0 60 74"
            fill="none"
            stroke="#1f252b"
            strokeWidth={1.6}
          />
          <path
            d="M 60 26 A 9 24 0 0 1 60 74"
            fill="none"
            stroke="#1f252b"
            strokeWidth={1.4}
            strokeDasharray="6 5"
            opacity={0.8}
          />
        </>
      ) : null}
      {presetId === "hemisphere" ? (
        <>
          <path
            d="M 32 58 A 28 28 0 0 1 88 58 L 88 58 L 32 58 Z"
            fill="rgba(47, 79, 127, 0.08)"
            stroke="#1f252b"
            strokeWidth={2}
          />
          <path d={pathArc(60, 58, 28, 7, "front")} fill="none" stroke="#1f252b" strokeWidth={2} />
          <path
            d={pathArc(60, 58, 28, 7, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={2}
          />
          <line
            x1={60}
            y1={30}
            x2={60}
            y2={58}
            stroke="#1f252b"
            strokeWidth={1.4}
            strokeDasharray="6 5"
            opacity={0.72}
          />
        </>
      ) : null}
      {presetId === "torus" ? (
        <>
          <ellipse
            cx={60}
            cy={50}
            rx={30}
            ry={18}
            fill="rgba(47, 79, 127, 0.06)"
            stroke="#1f252b"
            strokeWidth={2}
          />
          <path d={pathArc(60, 50, 30, 18, "front")} fill="none" stroke="#1f252b" strokeWidth={2} />
          <path
            d={pathArc(60, 50, 30, 8, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
          <path d={pathArc(60, 50, 14, 8, "front")} fill="none" stroke="#1f252b" strokeWidth={1.8} />
          <path
            d={pathArc(60, 50, 14, 8, "back")}
            fill="none"
            stroke="#1f252b"
            strokeWidth={1.8}
            strokeDasharray="6 5"
          />
          <line
            x1={30}
            y1={50}
            x2={90}
            y2={50}
            stroke="#1f252b"
            strokeWidth={1.4}
            strokeDasharray="6 5"
            opacity={0.72}
          />
        </>
      ) : null}
    </svg>
  );
};

export const ShapeCatalogPreview = ({
  variant,
  sides = 5,
}: {
  variant:
    | "polygon"
    | "rectangle"
    | "ellipse"
    | "circle"
    | "polyline"
    | "trapezoid"
    | "trapezoid_right"
    | "trapezoid_scalene"
    | "rhombus";
  sides?: number;
}) => {
  const previewPolygonPoints =
    variant === "polygon" ||
    variant === "trapezoid" ||
    variant === "trapezoid_right" ||
    variant === "trapezoid_scalene" ||
    variant === "rhombus"
      ? toSvgPointString(
          getWorkbookPolygonPoints(
            { x: 16, y: 22, width: 68, height: 56 },
            sides,
            (variant === "polygon" ? "regular" : variant) as WorkbookPolygonPreset
          )
        )
      : null;
  if (variant === "rectangle") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <rect
          x={16}
          y={24}
          width={68}
          height={52}
          rx={8}
          ry={8}
          fill="rgba(47, 79, 127, 0.08)"
          stroke="#2f4f7f"
          strokeWidth={5}
        />
      </svg>
    );
  }
  if (variant === "ellipse") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <ellipse
          cx={50}
          cy={50}
          rx={33}
          ry={25}
          fill="rgba(47, 79, 127, 0.08)"
          stroke="#2f4f7f"
          strokeWidth={5}
        />
      </svg>
    );
  }
  if (variant === "circle") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <circle
          cx={50}
          cy={50}
          r={28}
          fill="rgba(47, 79, 127, 0.08)"
          stroke="#2f4f7f"
          strokeWidth={5}
        />
        <circle cx={50} cy={50} r={3.5} fill="#2f4f7f" />
      </svg>
    );
  }
  if (variant === "polyline") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <polyline
          points="14,70 30,38 47,62 62,28 83,54"
          fill="none"
          stroke="#2f4f7f"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={14} cy={70} r={3.5} fill="#2f4f7f" />
        <circle cx={83} cy={54} r={3.5} fill="#2f4f7f" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
      <polygon
        points={previewPolygonPoints ?? ""}
        fill="rgba(47, 79, 127, 0.08)"
        stroke="#2f4f7f"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
};
