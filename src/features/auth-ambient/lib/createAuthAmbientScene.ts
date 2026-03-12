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
  velocityX: number;
  velocityY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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

const MAX_DELTA_SECONDS = 0.045;
const FRAME_INTERVAL_MS = 1000 / 30;
const CAMERA_Z = 9.1;
const EDGE_THRESHOLD_ANGLE = 18;
const ROUND_PRESETS = new Set(["sphere", "torus"]);
const DRAFT_SEGMENTS = 64;
const COMPACT_WIDTH = 820;
const NARROW_WIDTH = 620;

const SHARED_LINE_COLORS = {
  dark: {
    edge: "#d8f7ff",
    construction: "#6f9bbc",
  },
  light: {
    edge: "#365378",
    construction: "#8aa0bc",
  },
} as const;

const FIGURE_POSES: Record<string, FigurePosePreset> = {
  sphere: {
    baseRotation: [0.16, 0.52, 0.02],
    amplitude: [0.018, 0.1, 0.01],
    frequency: [0.32, 0.28, 0.24],
  },
  torus: {
    baseRotation: [0.72, 0.38, 0.04],
    amplitude: [0.022, 0.12, 0.012],
    frequency: [0.28, 0.24, 0.2],
  },
  oblique_prism: {
    baseRotation: [0.18, 0.66, 0.02],
    amplitude: [0.018, 0.11, 0.012],
    frequency: [0.26, 0.22, 0.18],
  },
  triangular_prism: {
    baseRotation: [0.14, 0.76, -0.03],
    amplitude: [0.016, 0.1, 0.01],
    frequency: [0.28, 0.24, 0.18],
  },
  pyramid_square: {
    baseRotation: [0.18, 0.58, 0.02],
    amplitude: [0.014, 0.08, 0.01],
    frequency: [0.24, 0.2, 0.16],
  },
  cube: {
    baseRotation: [0.24, 0.72, 0.02],
    amplitude: [0.018, 0.1, 0.01],
    frequency: [0.24, 0.2, 0.18],
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
    keep: ["torus", "oblique_prism", "cube"],
    overrides: {
      torus: { screenX: -0.7, screenY: -0.36, scale: 0.82, depth: -3.45 },
      oblique_prism: { screenX: 0.74, screenY: 0.06, scale: 0.88, depth: -3.15 },
      cube: { screenX: 0.62, screenY: 0.62, scale: 0.74, depth: -3.55 },
    },
  },
  invite: {
    keep: ["torus", "cube"],
    overrides: {
      torus: { screenX: -0.72, screenY: -0.34, scale: 0.8, depth: -3.5 },
      cube: { screenX: 0.7, screenY: 0.58, scale: 0.72, depth: -3.45 },
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
        screenX: -0.98,
        screenY: 0.14,
        scale: 0.78,
        depth: -3.62,
        velocityX: 0.034,
        velocityY: -0.02,
      },
      torus: {
        screenX: -0.56,
        screenY: -0.58,
        scale: 0.92,
        depth: -3.82,
        velocityX: 0.055,
        velocityY: 0.03,
      },
      oblique_prism: {
        screenX: 0.52,
        screenY: -0.04,
        scale: 0.98,
        depth: -3.18,
        velocityX: -0.05,
        velocityY: 0.04,
      },
      triangular_prism: {
        screenX: 0.94,
        screenY: 0.66,
        scale: 0.8,
        depth: -3.48,
        velocityX: -0.04,
        velocityY: -0.025,
      },
      pyramid_square: {
        screenX: -0.94,
        screenY: 0.72,
        scale: 0.72,
        depth: -3.84,
        velocityX: 0.04,
        velocityY: -0.025,
      },
      cube: {
        screenX: 0.82,
        screenY: -0.3,
        scale: 0.82,
        depth: -3.48,
        velocityX: -0.055,
        velocityY: 0.025,
      },
    },
  },
  invite: {
    keep: ["sphere", "torus", "oblique_prism", "cube"],
    overrides: {
      sphere: {
        screenX: -0.98,
        screenY: 0.2,
        scale: 0.7,
        depth: -3.54,
        velocityX: 0.028,
        velocityY: -0.018,
      },
      torus: {
        screenX: -0.58,
        screenY: -0.54,
        scale: 0.88,
        depth: -3.76,
        velocityX: 0.048,
        velocityY: 0.026,
      },
      oblique_prism: {
        screenX: 0.78,
        screenY: -0.02,
        scale: 0.86,
        depth: -3.28,
        velocityX: -0.04,
        velocityY: 0.03,
      },
      cube: {
        screenX: 0.78,
        screenY: 0.6,
        scale: 0.74,
        depth: -3.52,
        velocityX: -0.036,
        velocityY: -0.02,
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
    keep: ["torus", "oblique_prism", "cube"],
    overrides: {
      torus: {
        screenX: -0.6,
        screenY: -0.62,
        scale: 0.84,
        depth: -3.72,
        velocityX: 0.046,
        velocityY: 0.026,
      },
      oblique_prism: {
        screenX: 0.76,
        screenY: -0.06,
        scale: 0.84,
        depth: -3.24,
        velocityX: -0.04,
        velocityY: 0.034,
      },
      cube: {
        screenX: 0.78,
        screenY: 0.56,
        scale: 0.7,
        depth: -3.5,
        velocityX: -0.034,
        velocityY: -0.02,
      },
    },
  },
  invite: {
    keep: ["torus", "cube"],
    overrides: {
      torus: {
        screenX: -0.66,
        screenY: -0.58,
        scale: 0.78,
        depth: -3.62,
        velocityX: 0.04,
        velocityY: 0.024,
      },
      cube: {
        screenX: 0.74,
        screenY: 0.56,
        scale: 0.68,
        depth: -3.48,
        velocityX: -0.03,
        velocityY: -0.018,
      },
    },
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ease = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

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

const ellipsePoints = (
  radiusX: number,
  radiusY: number,
  segments = DRAFT_SEGMENTS
) => {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radiusX,
        Math.sin(angle) * radiusY,
        0
      )
    );
  }
  return points;
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

const addLoopContour = ({
  target,
  radiusX,
  radiusY,
  role,
  opacity,
  baseLineWidth,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
}: {
  target: DraftTarget;
  radiusX: number;
  radiusY: number;
  role: FigureLineRole;
  opacity: number;
  baseLineWidth: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
}) => {
  const geometry = new LineGeometry();
  geometry.setPositions(vectorPointsToArray(ellipsePoints(radiusX, radiusY), true));
  const material = createLineMaterial(opacity, baseLineWidth);
  const line = new Line2(geometry, material);
  line.rotation.set(...rotation);
  line.position.set(...position);
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
  const edgeWidth = compact ? 0.9 : 1.08;
  const constructionWidth = compact ? 0.58 : 0.72;

  if (presetId === "sphere") {
    addLoopContour({
      target,
      radiusX: radius * 0.94,
      radiusY: radius * 0.94,
      role: "edge",
      opacity: 0.82,
      baseLineWidth: edgeWidth,
    });
    addLoopContour({
      target,
      radiusX: radius * 0.88,
      radiusY: radius * 0.58,
      role: "construction",
      opacity: 0.24,
      baseLineWidth: constructionWidth,
      rotation: [Math.PI / 2, 0, 0],
    });
    addLoopContour({
      target,
      radiusX: radius * 0.72,
      radiusY: radius * 0.9,
      role: "construction",
      opacity: 0.18,
      baseLineWidth: constructionWidth,
      rotation: [0, Math.PI / 2, 0],
    });
    return;
  }

  if (presetId === "torus") {
    addLoopContour({
      target,
      radiusX: radius * 0.84,
      radiusY: radius * 0.78,
      role: "edge",
      opacity: 0.82,
      baseLineWidth: edgeWidth,
    });
    addLoopContour({
      target,
      radiusX: radius * 0.48,
      radiusY: radius * 0.44,
      role: "edge",
      opacity: 0.64,
      baseLineWidth: edgeWidth * 0.92,
    });
    addLoopContour({
      target,
      radiusX: radius * 0.78,
      radiusY: radius * 0.42,
      role: "construction",
      opacity: 0.22,
      baseLineWidth: constructionWidth,
      rotation: [Math.PI / 2, 0, 0],
    });
    addLoopContour({
      target,
      radiusX: radius * 0.56,
      radiusY: radius * 0.28,
      role: "construction",
      opacity: 0.16,
      baseLineWidth: constructionWidth * 0.92,
      rotation: [Math.PI / 2, Math.PI / 10, 0],
    });
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
  const worldCenter = new THREE.Vector3();
  const worldRight = new THREE.Vector3();

  let palette: AuthAmbientPalette = AUTH_AMBIENT_PALETTES[themeMode];
  let rafId = 0;
  let disposed = false;
  let lastFrameTime = 0;
  let lastAnimationTime = 0;

  const screenToWorld = (screenX: number, screenY: number, depth: number) => {
    reusableVector.set(screenX, screenY, 0.5).unproject(camera);
    reusableVector.sub(camera.position).normalize();
    const distance = (depth - camera.position.z) / reusableVector.z;
    return camera.position.clone().add(reusableVector.multiplyScalar(distance));
  };

  const computeRadiusNdc = (figure: FigureRuntime, depth: number) => {
    const center = screenToWorld(figure.screenX, figure.screenY, depth);
    worldCenter.copy(center);
    worldRight.copy(center);
    worldRight.x += figure.boundingRadius * figure.group.scale.x;
    worldCenter.project(camera);
    worldRight.project(camera);
    return Math.max(0.08, Math.abs(worldRight.x - worldCenter.x));
  };

  const updateLineViewportStyle = () => {
    const widthFactor =
      viewport.width < NARROW_WIDTH ? 0.84 : viewport.width < COMPACT_WIDTH ? 0.94 : 1;
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
      figure.mesh.material.color.set(figurePalette.fill);
      figure.mesh.material.emissive.set(figurePalette.emissive);
      figure.mesh.material.specular.set(figurePalette.specular);
      figure.mesh.material.opacity = figure.config.opacity;
      figure.glow.material.color.set(figurePalette.glow);
      figure.glow.material.opacity = figure.isRound
        ? figure.config.opacity * 0.14
        : figure.config.opacity * 0.09;
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
        ? 36
        : viewport.width < COMPACT_WIDTH
          ? 33
          : variant === "invite"
            ? 30
            : 28;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(
      viewport.width < COMPACT_WIDTH
        ? 1
        : Math.min(window.devicePixelRatio || 1, 1.5)
    );
    renderer.setSize(viewport.width, viewport.height, false);
    updateLineViewportStyle();
  };

  const createFigure = (config: AmbientFigureConfig) => {
    const geometry = getAmbientGeometry(config.presetId);
    if (!geometry) return;
    const isRound = ROUND_PRESETS.has(config.presetId);
    const posePreset = getPosePreset(config.presetId);

    const material = new THREE.MeshPhongMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: config.opacity,
      emissive: "#0a0f1b",
      emissiveIntensity: isRound ? 0.08 : 0.12,
      shininess: isRound ? 124 : config.shading === "smooth" ? 92 : 56,
      flatShading: config.shading === "flat",
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
      side: THREE.FrontSide,
      specular: new THREE.Color("#ffffff"),
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;

    const glow = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: isRound ? config.opacity * 0.14 : config.opacity * 0.09,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      })
    );
    glow.scale.setScalar(isRound ? 1.016 : 1.01);
    glow.renderOrder = 0;

    const group = new THREE.Group();
    group.scale.setScalar(config.scale);
    const presentationGroup = new THREE.Group();
    group.add(presentationGroup);
    presentationGroup.add(glow, mesh);
    figureLayer.add(group);

    const runtime: FigureRuntime = {
      config,
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
      velocityX: config.velocityX,
      velocityY: config.velocityY,
      minX: clamp(config.screenX - (compact ? 0.16 : 0.2), -1.12, 1.12),
      maxX: clamp(config.screenX + (compact ? 0.16 : 0.2), -1.12, 1.12),
      minY: clamp(config.screenY - (compact ? 0.12 : 0.16), -1.04, 1.04),
      maxY: clamp(config.screenY + (compact ? 0.12 : 0.16), -1.04, 1.04),
      boundingRadius: geometry.boundingSphere?.radius ?? 1,
      isRound,
      baseRotation: new THREE.Euler(...posePreset.baseRotation, "YXZ"),
      rotationAmplitude: new THREE.Vector3(...posePreset.amplitude),
      rotationFrequency: new THREE.Vector3(...posePreset.frequency),
    };

    applyPremiumContours(
      runtime,
      geometry,
      config.presetId,
      runtime.boundingRadius,
      compact
    );

    figures.push(runtime);
  };

  figureBlueprints.forEach(createFigure);
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
      lastAnimationTime = 0;
      lastFrameTime = 0;
    }
  };

  const animateFigure = (figure: FigureRuntime, elapsed: number, delta: number) => {
    figure.screenX += figure.velocityX * delta;
    figure.screenY += figure.velocityY * delta;

    const depth =
      figure.baseDepth +
      Math.sin(elapsed * figure.config.depthFrequency + figure.config.phase) *
        figure.config.depthAmplitude;
    const radiusNdc = computeRadiusNdc(figure, depth);

    if (figure.screenX + radiusNdc > figure.maxX) {
      figure.screenX = figure.maxX - radiusNdc;
      figure.velocityX = -Math.abs(figure.velocityX);
    } else if (figure.screenX - radiusNdc < figure.minX) {
      figure.screenX = figure.minX + radiusNdc;
      figure.velocityX = Math.abs(figure.velocityX);
    }

    if (figure.screenY + radiusNdc > figure.maxY) {
      figure.screenY = figure.maxY - radiusNdc;
      figure.velocityY = -Math.abs(figure.velocityY);
    } else if (figure.screenY - radiusNdc < figure.minY) {
      figure.screenY = figure.minY + radiusNdc;
      figure.velocityY = Math.abs(figure.velocityY);
    }

    const world = screenToWorld(figure.screenX, figure.screenY, depth);
    world.y +=
      Math.sin(elapsed * figure.config.bobFrequency + figure.config.phase) *
      figure.config.bobAmplitude *
      0.7;
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
    if (lastFrameTime && timestamp - lastFrameTime < FRAME_INTERVAL_MS) return;

    const elapsed = timestamp * 0.001;
    const delta = clamp(
      lastAnimationTime ? elapsed - lastAnimationTime : FRAME_INTERVAL_MS / 1000,
      0.001,
      MAX_DELTA_SECONDS
    );
    lastAnimationTime = elapsed;
    lastFrameTime = timestamp;

    pointer.x = ease(pointer.x, pointer.targetX, 0.06);
    pointer.y = ease(pointer.y, pointer.targetY, 0.06);

    figureLayer.rotation.y = pointer.x * (variant === "launch" ? 0.08 : 0.06);
    figureLayer.rotation.x = -pointer.y * (variant === "launch" ? 0.045 : 0.035);
    figureLayer.position.x = pointer.x * 0.1;
    figureLayer.position.y = pointer.y * 0.06;

    figures.forEach((figure) => animateFigure(figure, elapsed, delta));
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
