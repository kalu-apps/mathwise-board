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
                  fill="rgba(63, 78, 145, 0.12)"
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
                  stroke="#111827"
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
          <ellipse cx={60} cy={30} rx={24} ry={7} fill="none" stroke="#111827" strokeWidth={2} />
          <line x1={36} y1={30} x2={36} y2={74} stroke="#111827" strokeWidth={2} />
          <line x1={84} y1={30} x2={84} y2={74} stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 74, 24, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path
            d={pathArc(60, 74, 24, 7, "back")}
            fill="none"
            stroke="#111827"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
        </>
      ) : null}
      {presetId === "cone" ? (
        <>
          <line x1={60} y1={18} x2={36} y2={76} stroke="#111827" strokeWidth={2} />
          <line x1={60} y1={18} x2={84} y2={76} stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 76, 24, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path
            d={pathArc(60, 76, 24, 7, "back")}
            fill="none"
            stroke="#111827"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
        </>
      ) : null}
      {presetId === "truncated_cone" ? (
        <>
          <ellipse cx={60} cy={28} rx={13} ry={4} fill="none" stroke="#111827" strokeWidth={2} />
          <line x1={47} y1={28} x2={36} y2={76} stroke="#111827" strokeWidth={2} />
          <line x1={73} y1={28} x2={84} y2={76} stroke="#111827" strokeWidth={2} />
          <path d={pathArc(60, 76, 24, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path
            d={pathArc(60, 76, 24, 7, "back")}
            fill="none"
            stroke="#111827"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
        </>
      ) : null}
      {presetId === "sphere" ? (
        <>
          <circle
            cx={60}
            cy={50}
            r={28}
            fill="rgba(63, 78, 145, 0.08)"
            stroke="#111827"
            strokeWidth={2}
          />
          <path d={pathArc(60, 50, 28, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path
            d={pathArc(60, 50, 28, 7, "back")}
            fill="none"
            stroke="#111827"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
        </>
      ) : null}
      {presetId === "hemisphere" ? (
        <>
          <path
            d="M 32 58 A 28 28 0 0 1 88 58"
            fill="rgba(63, 78, 145, 0.08)"
            stroke="#111827"
            strokeWidth={2}
          />
          <path d={pathArc(60, 58, 28, 7, "front")} fill="none" stroke="#111827" strokeWidth={2} />
          <path
            d={pathArc(60, 58, 28, 7, "back")}
            fill="none"
            stroke="#111827"
            strokeWidth={2}
            strokeDasharray="6 5"
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
            fill="rgba(63, 78, 145, 0.06)"
            stroke="#111827"
            strokeWidth={2}
          />
          <ellipse cx={60} cy={50} rx={14} ry={8} fill="none" stroke="#111827" strokeWidth={2} />
          <path
            d={pathArc(60, 50, 30, 8, "back")}
            fill="none"
            stroke="#111827"
            strokeWidth={2}
            strokeDasharray="6 5"
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
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
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
          fill="rgba(79, 99, 255, 0.08)"
          stroke="#4f63ff"
          strokeWidth={5}
        />
      </svg>
    );
  }
  if (variant === "polyline") {
    return (
      <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
        <polyline
          points="14,70 30,38 47,62 62,28 83,54"
          fill="none"
          stroke="#4f63ff"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={14} cy={70} r={3.5} fill="#4f63ff" />
        <circle cx={83} cy={54} r={3.5} fill="#4f63ff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true">
      <polygon
        points={previewPolygonPoints ?? ""}
        fill="rgba(79, 99, 255, 0.08)"
        stroke="#4f63ff"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
};
