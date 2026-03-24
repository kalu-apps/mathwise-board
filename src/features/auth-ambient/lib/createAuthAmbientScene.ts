import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { ThemeMode } from "@/app/theme/themeModeContext";
import {
  AUTH_AMBIENT_PALETTES,
  getAuthAmbientFigures,
  type AmbientFigureConfig,
  type AuthAmbientPalette,
  type AuthAmbientVariant,
} from "@/features/auth-ambient/model/scenePresets";
import { getAmbientGeometry } from "./threeGeometry";

type CreateAuthAmbientSceneOptions = {
  container: HTMLElement;
  variant: AuthAmbientVariant;
  themeMode: ThemeMode;
  reducedMotion: boolean;
};

type FigureLineRole = "edge" | "construction";

type FigureLineLayer = {
  material: LineMaterial;
  role: FigureLineRole;
  opacity: number;
  baseLineWidth: number;
};

type FigureRuntime = {
  config: AmbientFigureConfig;
  visualPresetId: string;
  group: THREE.Group;
  presentationGroup: THREE.Group;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  lineLayers: FigureLineLayer[];
  overlayGeometries: Array<THREE.BufferGeometry | LineGeometry | LineSegmentsGeometry>;
  overlayMaterials: THREE.Material[];
  baseDepth: number;
  screenX: number;
  screenY: number;
  anchorX: number;
  anchorY: number;
  driftAmplitudeX: number;
  driftAmplitudeY: number;
  driftFrequencyX: number;
  driftFrequencyY: number;
  boundingRadius: number;
  isRound: boolean;
  baseRotation: THREE.Euler;
  rotationAmplitude: THREE.Vector3;
  rotationFrequency: THREE.Vector3;
};

type DraftTarget = Pick<
  FigureRuntime,
  "presentationGroup" | "lineLayers" | "overlayGeometries" | "overlayMaterials"
>;

type AmbientContourSpec =
  | { kind: "sphere"; radius: number }
  | { kind: "torus"; majorRadius: number; tubeRadius: number }
  | { kind: "cone"; radius: number; height: number };

type AnchorBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type FigurePosePreset = {
  baseRotation: [number, number, number];
  amplitude: [number, number, number];
  frequency: [number, number, number];
};

type FigureLayoutOverride = Partial<
  Pick<
    AmbientFigureConfig,
    "screenX" | "screenY" | "scale" | "depth" | "velocityX" | "velocityY"
  >
>;

export type AuthAmbientSceneController = {
  destroy: () => void;
  setThemeMode: (themeMode: ThemeMode) => void;
};

const FRAME_INTERVAL_MS = 1000 / 30;
const CAMERA_Z = 9.1;
const EDGE_THRESHOLD_ANGLE = 18;
const ROUND_PRESETS = new Set(["sphere", "torus"]);
const LINE_ONLY_PRESETS = new Set(["sphere", "torus", "cone"]);
const DRAFT_SEGMENTS = 96;
const COMPACT_WIDTH = 820;
const NARROW_WIDTH = 620;
const presentationGeometryCache = new Map<string, THREE.BufferGeometry>();

const SHARED_LINE_COLORS = {
  dark: {
    edge: "#d5dde6",
    construction: "#8fa0b3",
  },
  light: {
    edge: "#2f4f7f",
    construction: "#5f6f86",
  },
} as const;

const FIGURE_POSES: Record<string, FigurePosePreset> = {
  sphere: {
    baseRotation: [0.18, 0.58, -0.74],
    amplitude: [0.006, 0.038, 0.012],
    frequency: [0.1, 0.14, 0.08],
  },
  torus: {
    baseRotation: [0.78, 0.28, 0.02],
    amplitude: [0.006, 0.034, 0.005],
    frequency: [0.1, 0.13, 0.08],
  },
  cone: {
    baseRotation: [0.08, 0.34, -0.04],
    amplitude: [0.006, 0.032, 0.004],
    frequency: [0.1, 0.12, 0.08],
  },
  oblique_prism: {
    baseRotation: [0.12, 0.56, 0.01],
    amplitude: [0.01, 0.072, 0.006],
    frequency: [0.15, 0.18, 0.13],
  },
  triangular_prism: {
    baseRotation: [0.1, 0.64, -0.02],
    amplitude: [0.01, 0.068, 0.006],
    frequency: [0.15, 0.18, 0.13],
  },
  pyramid_square: {
    baseRotation: [0.12, 0.5, 0.01],
    amplitude: [0.009, 0.058, 0.005],
    frequency: [0.14, 0.17, 0.12],
  },
  cube: {
    baseRotation: [0.18, 0.6, 0.01],
    amplitude: [0.01, 0.068, 0.005],
    frequency: [0.14, 0.18, 0.12],
  },
};

const NARROW_LAYOUTS: Record<
  AuthAmbientVariant,
  {
    keep: string[];
    overrides: Record<string, FigureLayoutOverride>;
  }
> = {
  launch: {
    keep: ["torus", "sphere", "cube"],
    overrides: {
      torus: { screenX: -0.46, screenY: -0.34, scale: 0.78, depth: -3.52 },
      sphere: { screenX: 0.5, screenY: -0.02, scale: 0.84, depth: -3.18 },
      cube: { screenX: 0.46, screenY: 0.48, scale: 0.7, depth: -3.52 },
    },
  },
  invite: {
    keep: ["torus", "cube"],
    overrides: {
      torus: { screenX: -0.44, screenY: -0.32, scale: 0.78, depth: -3.56 },
      cube: { screenX: 0.44, screenY: 0.44, scale: 0.68, depth: -3.48 },
    },
  },
};

const DESKTOP_LAYOUTS: Record<
  AuthAmbientVariant,
  {
    keep: string[];
    overrides: Record<string, FigureLayoutOverride>;
  }
> = {
  launch: {
    keep: [
      "sphere",
      "torus",
      "oblique_prism",
      "triangular_prism",
      "pyramid_square",
      "cube",
    ],
    overrides: {
      sphere: {
        screenX: 0.42,
        screenY: -0.04,
        scale: 0.92,
        depth: -3.28,
        velocityX: -0.038,
        velocityY: 0.026,
      },
      torus: {
        screenX: -0.34,
        screenY: -0.46,
        scale: 0.88,
        depth: -3.9,
        velocityX: 0.044,
        velocityY: 0.024,
      },
      oblique_prism: {
        screenX: -0.58,
        screenY: 0.16,
        scale: 0.68,
        depth: -3.78,
        velocityX: 0.034,
        velocityY: 0.018,
      },
      triangular_prism: {
        screenX: -0.54,
        screenY: 0.5,
        scale: 0.6,
        depth: -3.94,
        velocityX: 0.028,
        velocityY: -0.018,
      },
      pyramid_square: {
        screenX: 0.54,
        screenY: 0.44,
        scale: 0.72,
        depth: -3.62,
        velocityX: -0.03,
        velocityY: -0.02,
      },
      cube: {
        screenX: 0.52,
        screenY: -0.24,
        scale: 0.72,
        depth: -3.62,
        velocityX: -0.034,
        velocityY: 0.02,
      },
    },
  },
  invite: {
    keep: ["sphere", "torus", "oblique_prism", "cube"],
    overrides: {
      sphere: {
        screenX: 0.46,
        screenY: -0.02,
        scale: 0.78,
        depth: -3.32,
        velocityX: -0.03,
        velocityY: 0.022,
      },
      torus: {
        screenX: -0.34,
        screenY: -0.44,
        scale: 0.8,
        depth: -3.84,
        velocityX: 0.038,
        velocityY: 0.022,
      },
      oblique_prism: {
        screenX: -0.56,
        screenY: 0.16,
        scale: 0.62,
        depth: -3.62,
        velocityX: 0.026,
        velocityY: -0.016,
      },
      cube: {
        screenX: 0.5,
        screenY: 0.42,
        scale: 0.66,
        depth: -3.58,
        velocityX: -0.028,
        velocityY: -0.018,
      },
    },
  },
};

const COMPACT_LAYOUTS: Record<
  AuthAmbientVariant,
  {
    keep: string[];
    overrides: Record<string, FigureLayoutOverride>;
  }
> = {
  launch: {
    keep: ["torus", "sphere", "cube"],
    overrides: {
      torus: {
        screenX: -0.4,
        screenY: -0.42,
        scale: 0.8,
        depth: -3.76,
        velocityX: 0.036,
        velocityY: 0.02,
      },
      sphere: {
        screenX: 0.48,
        screenY: -0.06,
        scale: 0.76,
        depth: -3.28,
        velocityX: -0.028,
        velocityY: 0.022,
      },
      cube: {
        screenX: 0.48,
        screenY: 0.42,
        scale: 0.66,
        depth: -3.54,
        velocityX: -0.024,
        velocityY: -0.016,
      },
    },
  },
  invite: {
    keep: ["torus", "cube"],
    overrides: {
      torus: {
        screenX: -0.38,
        screenY: -0.4,
        scale: 0.76,
        depth: -3.66,
        velocityX: 0.03,
        velocityY: 0.018,
      },
      cube: {
        screenX: 0.46,
        screenY: 0.38,
        scale: 0.64,
        depth: -3.5,
        velocityX: -0.022,
        velocityY: -0.014,
      },
    },
  },
};

const ease = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

const clampScalar = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const resolveVisualPresetId = (presetId: string) =>
  presetId === "oblique_prism" ? "cone" : presetId;

const getAnchorBounds = (
  variant: AuthAmbientVariant,
  width: number
): AnchorBounds => {
  if (width < NARROW_WIDTH) {
    return { minX: -0.5, maxX: 0.5, minY: -0.42, maxY: 0.42 };
  }
  if (width < COMPACT_WIDTH) {
    return { minX: -0.56, maxX: 0.56, minY: -0.46, maxY: 0.46 };
  }
  return variant === "invite"
    ? { minX: -0.62, maxX: 0.62, minY: -0.5, maxY: 0.5 }
    : { minX: -0.66, maxX: 0.66, minY: -0.54, maxY: 0.54 };
};

const resolveFigureBlueprints = (
  variant: AuthAmbientVariant,
  width: number
) => {
  const compact = width < COMPACT_WIDTH;
  const baseConfigs = getAuthAmbientFigures(variant, compact).map((config) => ({
    ...config,
  }));

  const layout =
    width < NARROW_WIDTH
      ? NARROW_LAYOUTS[variant]
      : width < COMPACT_WIDTH
        ? COMPACT_LAYOUTS[variant]
        : DESKTOP_LAYOUTS[variant];
  return baseConfigs
    .filter((config) => layout.keep.includes(config.presetId))
    .map((config) => ({
      ...config,
      ...layout.overrides[config.presetId],
    }));
};

const rebalanceFigureAnchors = (
  figures: FigureRuntime[],
  variant: AuthAmbientVariant,
  width: number
) => {
  const bounds = getAnchorBounds(variant, width);
  const compactView = width < COMPACT_WIDTH;
  const centerSafeX = compactView ? 0.18 : variant === "invite" ? 0.22 : 0.26;
  const centerSafeY = compactView ? 0.14 : variant === "invite" ? 0.18 : 0.2;

  for (let pass = 0; pass < 5; pass += 1) {
    figures.forEach((figure) => {
      figure.anchorX = clampScalar(figure.anchorX, bounds.minX, bounds.maxX);
      figure.anchorY = clampScalar(figure.anchorY, bounds.minY, bounds.maxY);

      if (
        Math.abs(figure.anchorX) < centerSafeX &&
        Math.abs(figure.anchorY) < centerSafeY
      ) {
        figure.anchorX =
          figure.anchorX >= 0
            ? Math.max(figure.anchorX, centerSafeX)
            : Math.min(figure.anchorX, -centerSafeX);
      }
    });

    for (let index = 0; index < figures.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < figures.length; compareIndex += 1) {
        const current = figures[index];
        const compare = figures[compareIndex];
        const deltaX = compare.anchorX - current.anchorX;
        const deltaY = compare.anchorY - current.anchorY;
        const distance = Math.hypot(deltaX, deltaY) || 0.001;
        const minDistance =
          (compactView ? 0.2 : 0.24) +
          (current.config.scale + compare.config.scale) * (compactView ? 0.05 : 0.06);

        if (distance >= minDistance) continue;

        const overlap = (minDistance - distance) * 0.5;
        const pushX = (deltaX / distance) * overlap;
        const pushY = (deltaY / distance) * overlap;

        current.anchorX = clampScalar(current.anchorX - pushX, bounds.minX, bounds.maxX);
        current.anchorY = clampScalar(current.anchorY - pushY, bounds.minY, bounds.maxY);
        compare.anchorX = clampScalar(compare.anchorX + pushX, bounds.minX, bounds.maxX);
        compare.anchorY = clampScalar(compare.anchorY + pushY, bounds.minY, bounds.maxY);
      }
    }
  }

  figures.forEach((figure) => {
    figure.screenX = figure.anchorX;
    figure.screenY = figure.anchorY;
  });
};

const createLineMaterial = (opacity: number, baseLineWidth: number) =>
  new LineMaterial({
    color: "#ffffff",
    transparent: true,
    opacity,
    linewidth: baseLineWidth,
    worldUnits: false,
    alphaToCoverage: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });

const vectorPointsToArray = (points: THREE.Vector3[], closed = false) => {
  const sequence = closed ? [...points, points[0].clone()] : points;
  const positions: number[] = [];
  sequence.forEach((point) => {
    positions.push(point.x, point.y, point.z);
  });
  return positions;
};

const getContourSpec = (geometry: THREE.BufferGeometry) =>
  geometry.userData.authAmbientContourSpec as AmbientContourSpec | undefined;

const createPresentationGeometry = (presetId: string) => {
  const cached = presentationGeometryCache.get(presetId);
  if (cached) return cached;

  let geometry: THREE.BufferGeometry | null = null;

  if (presetId === "sphere") {
    const radius = 1.42;
    geometry = new THREE.SphereGeometry(radius, 56, 38);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.userData.authAmbientContourSpec = { kind: "sphere", radius };
  } else if (presetId === "torus") {
    const majorRadius = 1.34;
    const tubeRadius = 0.46;
    geometry = new THREE.TorusGeometry(majorRadius, tubeRadius, 42, 128);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.userData.authAmbientContourSpec = {
      kind: "torus",
      majorRadius,
      tubeRadius,
    };
  } else if (presetId === "cone") {
    const radius = 1.06;
    const height = 2.18;
    geometry = new THREE.ConeGeometry(radius, height, 72, 1, true);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.userData.authAmbientContourSpec = {
      kind: "cone",
      radius,
      height,
    };
  } else {
    geometry = getAmbientGeometry(presetId);
  }

  if (!geometry) return null;
  presentationGeometryCache.set(presetId, geometry);
  return geometry;
};

const sphereLatitudePoints = (
  radius: number,
  latitude: number,
  segments = DRAFT_SEGMENTS
) => {
  const points: THREE.Vector3[] = [];
  const circleRadius = Math.cos(latitude) * radius;
  const y = Math.sin(latitude) * radius;
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * circleRadius,
        y,
        Math.sin(angle) * circleRadius
      )
    );
  }
  return points;
};

const sphereMeridianPoints = (
  radius: number,
  meridianAngle: number,
  segments = DRAFT_SEGMENTS
) => {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radius;
    const localY = Math.sin(angle) * radius;
    points.push(
      new THREE.Vector3(
        Math.cos(meridianAngle) * localX,
        localY,
        Math.sin(meridianAngle) * localX
      )
    );
  }
  return points;
};

const torusLoopPoints = ({
  majorRadius,
  tubeRadius,
  fixedAngle,
  mode,
  segments = DRAFT_SEGMENTS,
}: {
  majorRadius: number;
  tubeRadius: number;
  fixedAngle: number;
  mode: "major" | "minor";
  segments?: number;
}) => {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const u = mode === "major" ? angle : fixedAngle;
    const v = mode === "minor" ? angle : fixedAngle;
    points.push(
      new THREE.Vector3(
        (majorRadius + tubeRadius * Math.cos(v)) * Math.cos(u),
        tubeRadius * Math.sin(v),
        (majorRadius + tubeRadius * Math.cos(v)) * Math.sin(u)
      )
    );
  }
  return points;
};

const ellipseArcPoints = ({
  radiusX,
  radiusZ,
  y,
  startAngle,
  endAngle,
  segments = Math.max(24, Math.round(DRAFT_SEGMENTS * 0.5)),
}: {
  radiusX: number;
  radiusZ: number;
  y: number;
  startAngle: number;
  endAngle: number;
  segments?: number;
}) => {
  const points: THREE.Vector3[] = [];
  const stepCount = Math.max(2, segments);
  for (let index = 0; index <= stepCount; index += 1) {
    const t = index / stepCount;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radiusX,
        y,
        Math.sin(angle) * radiusZ
      )
    );
  }
  return points;
};

const coneGeneratrixPoints = ({
  radius,
  height,
  angle,
}: {
  radius: number;
  height: number;
  angle: number;
}) => {
  const halfHeight = height * 0.5;
  return [
    new THREE.Vector3(0, halfHeight, 0),
    new THREE.Vector3(Math.cos(angle) * radius, -halfHeight, Math.sin(angle) * radius),
  ];
};

const registerLineObject = (
  target: DraftTarget,
  object: Line2 | LineSegments2,
  geometry: LineGeometry | LineSegmentsGeometry,
  material: LineMaterial,
  role: FigureLineRole,
  opacity: number,
  baseLineWidth: number
) => {
  object.renderOrder = role === "edge" ? 4 : 3;
  target.presentationGroup.add(object);
  target.lineLayers.push({ material, role, opacity, baseLineWidth });
  target.overlayGeometries.push(geometry);
  target.overlayMaterials.push(material);
};

const addPathContour = ({
  target,
  points,
  role,
  opacity,
  baseLineWidth,
  alwaysVisible = false,
  closed = true,
}: {
  target: DraftTarget;
  points: THREE.Vector3[];
  role: FigureLineRole;
  opacity: number;
  baseLineWidth: number;
  alwaysVisible?: boolean;
  closed?: boolean;
}) => {
  const geometry = new LineGeometry();
  geometry.setPositions(vectorPointsToArray(points, closed));
  const material = createLineMaterial(opacity, baseLineWidth);
  material.depthTest = !alwaysVisible;
  const line = new Line2(geometry, material);
  registerLineObject(target, line, geometry, material, role, opacity, baseLineWidth);
};

const addEdgeContour = ({
  target,
  geometry,
  opacity,
  baseLineWidth,
}: {
  target: DraftTarget;
  geometry: THREE.BufferGeometry;
  opacity: number;
  baseLineWidth: number;
}) => {
  const edgeGeometry = new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_ANGLE);
  const positions = Array.from(
    edgeGeometry.getAttribute("position").array as ArrayLike<number>
  );
  edgeGeometry.dispose();

  const lineGeometry = new LineSegmentsGeometry();
  lineGeometry.setPositions(positions);
  const material = createLineMaterial(opacity, baseLineWidth);
  const line = new LineSegments2(lineGeometry, material);
  registerLineObject(target, line, lineGeometry, material, "edge", opacity, baseLineWidth);
};

const applyPremiumContours = (
  target: DraftTarget,
  geometry: THREE.BufferGeometry,
  presetId: string,
  radius: number,
  compact: boolean
) => {
  const contourSpec = getContourSpec(geometry);
  const edgeWidth = compact ? 0.9 : 1.08;

  if (presetId === "sphere") {
    const sphereRadius =
      contourSpec?.kind === "sphere" ? contourSpec.radius : radius * 0.92;
    const latitudeCount = compact ? 9 : 13;
    const meridianCount = compact ? 14 : 22;
    const roundLineWidth = compact ? edgeWidth * 0.7 : edgeWidth * 0.76;
    const roundLineOpacity = compact ? 0.22 : 0.28;

    for (let index = 0; index < latitudeCount; index += 1) {
      const angle =
        -Math.PI / 2 + ((index + 1) / (latitudeCount + 1)) * Math.PI;
      addPathContour({
        target,
        points: sphereLatitudePoints(sphereRadius, angle),
        role: "edge",
        opacity: roundLineOpacity,
        baseLineWidth: roundLineWidth,
        alwaysVisible: true,
      });
    }

    for (let index = 0; index < meridianCount; index += 1) {
      addPathContour({
        target,
        points: sphereMeridianPoints(
          sphereRadius,
          (index / meridianCount) * Math.PI
        ),
        role: "edge",
        opacity: roundLineOpacity,
        baseLineWidth: roundLineWidth,
        alwaysVisible: true,
      });
    }
    return;
  }

  if (presetId === "torus") {
    const majorRadius =
      contourSpec?.kind === "torus" ? contourSpec.majorRadius : radius * 0.62;
    const tubeRadius =
      contourSpec?.kind === "torus" ? contourSpec.tubeRadius : radius * 0.28;
    const majorCount = compact ? 14 : 24;
    const minorCount = compact ? 10 : 18;
    const majorWidth = compact ? edgeWidth * 0.62 : edgeWidth * 0.68;
    const minorWidth = compact ? edgeWidth * 0.7 : edgeWidth * 0.78;

    for (let index = 0; index < majorCount; index += 1) {
      const fixedAngle = (index / majorCount) * Math.PI * 2;
      const bandOpacity =
        0.11 +
        ((1 + Math.cos(fixedAngle - Math.PI * 0.24)) / 2) * 0.09;
      addPathContour({
        target,
        points: torusLoopPoints({
          majorRadius,
          tubeRadius,
          fixedAngle,
          mode: "major",
        }),
        role: "edge",
        opacity: compact ? bandOpacity * 0.9 : bandOpacity,
        baseLineWidth: majorWidth,
      });
    }

    for (let index = 0; index < minorCount; index += 1) {
      const fixedAngle = (index / minorCount) * Math.PI * 2;
      const ringOpacity =
        0.13 +
        ((1 + Math.sin(fixedAngle * 2 - Math.PI * 0.18)) / 2) * 0.1;
      addPathContour({
        target,
        points: torusLoopPoints({
          majorRadius,
          tubeRadius,
          fixedAngle,
          mode: "minor",
        }),
        role: "edge",
        opacity: compact ? ringOpacity * 0.92 : ringOpacity,
        baseLineWidth: minorWidth,
      });
    }
    return;
  }

  if (presetId === "cone") {
    const coneRadius =
      contourSpec?.kind === "cone" ? contourSpec.radius : radius * 0.72;
    const coneHeight =
      contourSpec?.kind === "cone" ? contourSpec.height : radius * 1.64;
    const baseY = -coneHeight * 0.5;
    const lineWidth = compact ? edgeWidth * 0.72 : edgeWidth * 0.78;
    const ribCount = compact ? 8 : 12;

    addPathContour({
      target,
      points: ellipseArcPoints({
        radiusX: coneRadius,
        radiusZ: coneRadius,
        y: baseY,
        startAngle: Math.PI * 0.08,
        endAngle: Math.PI * 1.08,
      }),
      role: "edge",
      opacity: compact ? 0.22 : 0.28,
      baseLineWidth: lineWidth * 0.9,
      alwaysVisible: true,
      closed: false,
    });

    addPathContour({
      target,
      points: ellipseArcPoints({
        radiusX: coneRadius,
        radiusZ: coneRadius,
        y: baseY,
        startAngle: Math.PI * 1.08,
        endAngle: Math.PI * 2.08,
      }),
      role: "edge",
      opacity: compact ? 0.32 : 0.4,
      baseLineWidth: lineWidth,
      alwaysVisible: true,
      closed: false,
    });

    for (let index = 0; index < ribCount; index += 1) {
      const angle = (index / ribCount) * Math.PI * 2;
      const opacity =
        0.16 +
        ((1 + Math.cos(angle - Math.PI * 0.2)) / 2) * (compact ? 0.1 : 0.14);
      addPathContour({
        target,
        points: coneGeneratrixPoints({
          radius: coneRadius,
          height: coneHeight,
          angle,
        }),
        role: "edge",
        opacity,
        baseLineWidth: lineWidth * 0.84,
        alwaysVisible: true,
        closed: false,
      });
    }
    return;
  }

  addEdgeContour({
    target,
    geometry,
    opacity: compact ? 0.56 : 0.68,
    baseLineWidth: edgeWidth,
  });
};

const getPosePreset = (presetId: string) =>
  FIGURE_POSES[presetId] ?? {
    baseRotation: [0.18, 0.62, 0.02],
    amplitude: [0.016, 0.09, 0.01],
    frequency: [0.24, 0.2, 0.18],
  };

export const createAuthAmbientScene = ({
  container,
  variant,
  themeMode,
  reducedMotion,
}: CreateAuthAmbientSceneOptions): AuthAmbientSceneController => {
  const initialWidth = Math.max(container.clientWidth, window.innerWidth, 1);
  const compact = initialWidth < COMPACT_WIDTH;
  const premiumDesktop = !reducedMotion && initialWidth >= COMPACT_WIDTH;
  const frameIntervalMs = premiumDesktop ? 1000 / 60 : FRAME_INTERVAL_MS;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, 0, CAMERA_Z);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: premiumDesktop,
    powerPreference: premiumDesktop ? "high-performance" : "low-power",
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const figureLayer = new THREE.Group();
  scene.add(figureLayer);
  const interactionTarget = container.parentElement ?? container;

  const hemiLight = new THREE.HemisphereLight("#ffffff", "#000000", 0.7);
  const keyLight = new THREE.DirectionalLight("#ffffff", 1.24);
  keyLight.position.set(-2.8, 2.4, 6.2);
  const rimLight = new THREE.DirectionalLight("#ffffff", 0.52);
  rimLight.position.set(2.9, -1.6, 4.8);
  const fillLight = new THREE.DirectionalLight("#ffffff", 0.22);
  fillLight.position.set(0.1, 0.8, 5.8);
  scene.add(hemiLight, keyLight, rimLight, fillLight);

  const figureBlueprints = resolveFigureBlueprints(variant, initialWidth);
  const figures: FigureRuntime[] = [];

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const viewport = { width: 0, height: 0 };
  const reusableVector = new THREE.Vector3();

  let palette: AuthAmbientPalette = AUTH_AMBIENT_PALETTES[themeMode];
  let rafId = 0;
  let disposed = false;
  let lastFrameTime = 0;

  const screenToWorld = (screenX: number, screenY: number, depth: number) => {
    reusableVector.set(screenX, screenY, 0.5).unproject(camera);
    reusableVector.sub(camera.position).normalize();
    const distance = (depth - camera.position.z) / reusableVector.z;
    return camera.position.clone().add(reusableVector.multiplyScalar(distance));
  };

  const updateLineViewportStyle = () => {
    const widthFactor =
      viewport.width < NARROW_WIDTH ? 0.88 : viewport.width < COMPACT_WIDTH ? 0.96 : 1.04;
    figures.forEach((figure) => {
      figure.lineLayers.forEach((layer) => {
        layer.material.resolution.set(viewport.width, viewport.height);
        layer.material.linewidth = layer.baseLineWidth * widthFactor;
      });
    });
  };

  const updatePalette = (nextThemeMode: ThemeMode) => {
    palette = AUTH_AMBIENT_PALETTES[nextThemeMode];
    const linePalette =
      nextThemeMode === "dark" ? SHARED_LINE_COLORS.dark : SHARED_LINE_COLORS.light;

    scene.fog = new THREE.FogExp2(
      palette.fog,
      nextThemeMode === "dark" ? 0.026 : 0.02
    );
    hemiLight.color.set(palette.hemiSky);
    hemiLight.groundColor.set(palette.hemiGround);
    keyLight.color.set(palette.keyLight);
    rimLight.color.set(palette.rimLight);
    fillLight.color.set(palette.fillLight);

    figures.forEach((figure) => {
      const figurePalette = palette.figures[figure.config.colorSlot];
      const torusDraftFigure = figure.visualPresetId === "torus";
      const lineOnlyDraftFigure = LINE_ONLY_PRESETS.has(figure.visualPresetId);
      figure.mesh.material.color.set(figurePalette.fill);
      figure.mesh.material.emissive.set(
        lineOnlyDraftFigure ? "#000000" : figurePalette.emissive
      );
      figure.mesh.material.specular.set(
        lineOnlyDraftFigure ? "#000000" : figurePalette.specular
      );
      figure.mesh.material.opacity = torusDraftFigure ? 1 : lineOnlyDraftFigure ? 0 : figure.config.opacity;
      figure.mesh.material.colorWrite = !lineOnlyDraftFigure;
      figure.mesh.material.depthWrite = torusDraftFigure;
      figure.mesh.material.transparent = !torusDraftFigure;
      figure.mesh.visible = torusDraftFigure;
      figure.glow.material.color.set(figurePalette.glow);
      figure.glow.material.opacity = lineOnlyDraftFigure ? 0 : figure.config.opacity * 0.07;
      figure.glow.visible = !lineOnlyDraftFigure;
      figure.lineLayers.forEach((layer) => {
        layer.material.color.set(
          layer.role === "edge" ? linePalette.edge : linePalette.construction
        );
        layer.material.opacity = layer.opacity;
      });
    });
  };

  const resize = () => {
    viewport.width = Math.max(container.clientWidth || window.innerWidth, 1);
    viewport.height = Math.max(container.clientHeight || window.innerHeight, 1);
    camera.aspect = viewport.width / viewport.height;
    camera.fov =
      viewport.width < NARROW_WIDTH
        ? 34
        : viewport.width < COMPACT_WIDTH
          ? 31
          : variant === "invite"
            ? 28
            : 26;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      viewport.width < COMPACT_WIDTH
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.75)
    );
    renderer.setSize(viewport.width, viewport.height, false);
    updateLineViewportStyle();
  };

  const createFigure = (config: AmbientFigureConfig) => {
    const visualPresetId = resolveVisualPresetId(config.presetId);
    const geometry = createPresentationGeometry(visualPresetId);
    if (!geometry) return;
    const isRound = ROUND_PRESETS.has(visualPresetId);
    const lineOnlyDraft = LINE_ONLY_PRESETS.has(visualPresetId);
    const torusDraft = visualPresetId === "torus";
    const posePreset = getPosePreset(visualPresetId);

    const material = new THREE.MeshPhongMaterial({
      color: "#ffffff",
      transparent: !torusDraft,
      opacity: torusDraft ? 1 : isRound ? 0 : config.opacity,
      emissive: "#1f252b",
      emissiveIntensity: isRound ? 0 : 0.12,
      shininess: isRound ? 0 : config.shading === "smooth" ? 92 : 56,
      flatShading: config.shading === "flat",
      depthWrite: torusDraft,
      depthTest: true,
      polygonOffset: torusDraft,
      polygonOffsetFactor: torusDraft ? 1 : 0,
      polygonOffsetUnits: torusDraft ? 2 : 0,
      side: THREE.FrontSide,
      specular: new THREE.Color("#ffffff"),
    });
    material.colorWrite = !lineOnlyDraft;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = torusDraft;
    mesh.renderOrder = 1;

    const glow = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: isRound ? 0 : config.opacity * 0.07,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      })
    );
    glow.visible = !isRound;
    glow.scale.setScalar(isRound ? 1.01 : 1.006);
    glow.renderOrder = 0;

    const group = new THREE.Group();
    group.scale.setScalar(config.scale);
    const presentationGroup = new THREE.Group();
    group.add(presentationGroup);
    presentationGroup.add(glow, mesh);
    figureLayer.add(group);

    const runtime: FigureRuntime = {
      config,
      visualPresetId,
      group,
      presentationGroup,
      mesh,
      glow,
      lineLayers: [],
      overlayGeometries: [],
      overlayMaterials: [],
      baseDepth: config.depth,
      screenX: config.screenX,
      screenY: config.screenY,
      anchorX: config.screenX,
      anchorY: config.screenY,
      driftAmplitudeX: compact ? (isRound ? 0.075 : 0.066) : isRound ? 0.118 : 0.094,
      driftAmplitudeY: compact ? (isRound ? 0.052 : 0.046) : isRound ? 0.082 : 0.068,
      driftFrequencyX: 0.052 + Math.abs(config.velocityX) * 0.48,
      driftFrequencyY: 0.046 + Math.abs(config.velocityY) * 0.42,
      boundingRadius: geometry.boundingSphere?.radius ?? 1,
      isRound,
      baseRotation: new THREE.Euler(...posePreset.baseRotation, "YXZ"),
      rotationAmplitude: new THREE.Vector3(...posePreset.amplitude),
      rotationFrequency: new THREE.Vector3(...posePreset.frequency),
    };

    applyPremiumContours(
      runtime,
      geometry,
      visualPresetId,
      runtime.boundingRadius,
      compact
    );

    figures.push(runtime);
  };

  figureBlueprints.forEach(createFigure);
  rebalanceFigureAnchors(figures, variant, initialWidth);
  resize();
  updatePalette(themeMode);

  const handlePointerMove = (event: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    pointer.targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.targetY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const handlePointerLeave = () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      lastFrameTime = 0;
    }
  };

  const animateFigure = (figure: FigureRuntime, elapsed: number) => {
    const directionX = Math.sign(figure.config.velocityX) || 1;
    const directionY = Math.sign(figure.config.velocityY) || 1;
    const lanePhase = elapsed * figure.driftFrequencyX + figure.config.phase;
    const drift = Math.sin(lanePhase);
    const sway = Math.cos(
      elapsed * figure.driftFrequencyY + figure.config.phase * 0.62
    );

    figure.screenX =
      figure.anchorX +
      drift * figure.driftAmplitudeX * directionX +
      sway * figure.driftAmplitudeX * 0.14;
    figure.screenY =
      figure.anchorY +
      drift * figure.driftAmplitudeY * directionY +
      sway * figure.driftAmplitudeY * 0.1;

    const depth =
      figure.baseDepth +
      drift * figure.config.depthAmplitude * 0.72 +
      sway * figure.config.depthAmplitude * 0.2;

    const world = screenToWorld(figure.screenX, figure.screenY, depth);
    world.y +=
      sway *
      figure.config.bobAmplitude *
      0.42;
    figure.group.position.copy(world);

    const motionX =
      Math.sin(elapsed * figure.rotationFrequency.x + figure.config.phase) *
      figure.rotationAmplitude.x;
    const motionY =
      Math.sin(elapsed * figure.rotationFrequency.y + figure.config.phase * 0.7) *
      figure.rotationAmplitude.y;
    const motionZ =
      Math.sin(elapsed * figure.rotationFrequency.z + figure.config.phase * 0.4) *
      figure.rotationAmplitude.z;

    figure.presentationGroup.rotation.set(
      figure.baseRotation.x + motionX,
      figure.baseRotation.y + motionY,
      figure.baseRotation.z + motionZ,
      "YXZ"
    );
  };

  const renderFrame = (timestamp: number) => {
    if (disposed) return;
    rafId = window.requestAnimationFrame(renderFrame);
    if (document.visibilityState === "hidden") return;
    if (lastFrameTime && timestamp - lastFrameTime < frameIntervalMs) return;

    const elapsed = timestamp * 0.001;
    lastFrameTime = timestamp;

    pointer.x = ease(pointer.x, pointer.targetX, 0.045);
    pointer.y = ease(pointer.y, pointer.targetY, 0.045);

    figureLayer.rotation.y = pointer.x * (variant === "launch" ? 0.048 : 0.04);
    figureLayer.rotation.x = -pointer.y * (variant === "launch" ? 0.024 : 0.02);
    figureLayer.position.x = pointer.x * 0.05;
    figureLayer.position.y = pointer.y * 0.032;

    figures.forEach((figure) => animateFigure(figure, elapsed));
    renderer.render(scene, camera);
  };

  interactionTarget.addEventListener("pointermove", handlePointerMove);
  interactionTarget.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (reducedMotion) {
    figures.forEach((figure, index) => {
      const world = screenToWorld(figure.screenX, figure.screenY, figure.baseDepth);
      world.y += Math.sin(index * 0.8) * 0.06;
      figure.group.position.copy(world);
      figure.presentationGroup.rotation.set(
        figure.baseRotation.x,
        figure.baseRotation.y,
        figure.baseRotation.z,
        "YXZ"
      );
    });
    renderer.render(scene, camera);
  } else {
    rafId = window.requestAnimationFrame(renderFrame);
  }

  return {
    destroy() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(rafId);
      interactionTarget.removeEventListener("pointermove", handlePointerMove);
      interactionTarget.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      figureLayer.clear();
      figures.forEach((figure) => {
        figure.mesh.material.dispose();
        figure.glow.material.dispose();
        figure.overlayMaterials.forEach((material) => material.dispose());
        figure.overlayGeometries.forEach((geometry) => geometry.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
    setThemeMode(nextThemeMode) {
      updatePalette(nextThemeMode);
      renderer.render(scene, camera);
    },
  };
};
