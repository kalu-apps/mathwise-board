import * as THREE from "three";
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

type FigureLineRole = "edge" | "construction" | "hidden" | "accent";

type FigureLineMaterial = THREE.LineBasicMaterial | THREE.LineDashedMaterial;

type FigureLineLayer = {
  material: FigureLineMaterial;
  role: FigureLineRole;
  opacity: number;
};

type FigureRuntime = {
  config: AmbientFigureConfig;
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>;
  glow: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  lineLayers: FigureLineLayer[];
  overlayGeometries: THREE.BufferGeometry[];
  overlayMaterials: THREE.Material[];
  baseDepth: number;
  screenX: number;
  screenY: number;
  velocityX: number;
  velocityY: number;
  spinKickX: number;
  spinKickY: number;
  spinKickZ: number;
  boundingRadius: number;
  isRound: boolean;
};

type DraftTarget = Pick<
  FigureRuntime,
  "group" | "lineLayers" | "overlayGeometries" | "overlayMaterials"
>;

export type AuthAmbientSceneController = {
  destroy: () => void;
  setThemeMode: (themeMode: ThemeMode) => void;
};

const MAX_DELTA_SECONDS = 0.045;
const FRAME_INTERVAL_MS = 1000 / 30;
const CAMERA_Z = 8.2;
const EDGE_THRESHOLD_ANGLE = 18;
const ROUND_PRESETS = new Set(["sphere", "torus"]);
const DRAFT_SEGMENTS = 48;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ease = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

const getLineRenderOrder = (role: FigureLineRole) => {
  if (role === "accent") return 5;
  if (role === "edge") return 4;
  if (role === "construction") return 3;
  return 2;
};

const createLineMaterial = (
  role: FigureLineRole,
  opacity: number,
  dashed = false
): FigureLineMaterial => {
  if (dashed) {
    return new THREE.LineDashedMaterial({
      color: "#ffffff",
      transparent: true,
      opacity,
      dashSize: 0.5,
      gapSize: 0.24,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
  }

  return new THREE.LineBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
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
  object:
    | THREE.Line<THREE.BufferGeometry, FigureLineMaterial>
    | THREE.LineLoop<THREE.BufferGeometry, FigureLineMaterial>
    | THREE.LineSegments<THREE.BufferGeometry, FigureLineMaterial>,
  material: FigureLineMaterial,
  role: FigureLineRole,
  opacity: number
) => {
  object.renderOrder = getLineRenderOrder(role);
  object.computeLineDistances();
  target.group.add(object);
  target.lineLayers.push({ material, role, opacity });
  target.overlayGeometries.push(object.geometry);
  target.overlayMaterials.push(material);
};

const addEllipseLoop = ({
  target,
  radiusX,
  radiusY,
  role,
  opacity,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
  dashed = false,
}: {
  target: DraftTarget;
  radiusX: number;
  radiusY: number;
  role: FigureLineRole;
  opacity: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
  dashed?: boolean;
}) => {
  const points = ellipsePoints(radiusX, radiusY);
  if (dashed) {
    points.push(points[0].clone());
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = createLineMaterial(role, opacity, dashed);
  const object = dashed
    ? new THREE.Line(geometry, material)
    : new THREE.LineLoop(geometry, material);
  object.rotation.set(...rotation);
  object.position.set(...position);
  registerLineObject(target, object, material, role, opacity);
};

const addSegmentSet = ({
  target,
  points,
  role,
  opacity,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
  dashed = false,
}: {
  target: DraftTarget;
  points: THREE.Vector3[];
  role: FigureLineRole;
  opacity: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
  dashed?: boolean;
}) => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = createLineMaterial(role, opacity, dashed);
  const object = new THREE.LineSegments(geometry, material);
  object.rotation.set(...rotation);
  object.position.set(...position);
  registerLineObject(target, object, material, role, opacity);
};

const addAxisGuide = (
  target: DraftTarget,
  length: number,
  tickSize: number,
  role: FigureLineRole,
  opacity: number,
  rotation: [number, number, number] = [0, 0, 0]
) => {
  addSegmentSet({
    target,
    role,
    opacity,
    rotation,
    points: [
      new THREE.Vector3(-length, 0, 0),
      new THREE.Vector3(length, 0, 0),
      new THREE.Vector3(-length, -tickSize, 0),
      new THREE.Vector3(-length, tickSize, 0),
      new THREE.Vector3(length, -tickSize, 0),
      new THREE.Vector3(length, tickSize, 0),
    ],
  });
};

const addSphereBlueprint = (target: DraftTarget, radius: number) => {
  addEllipseLoop({
    target,
    radiusX: radius * 0.94,
    radiusY: radius * 0.94,
    role: "edge",
    opacity: 0.58,
  });
  addEllipseLoop({
    target,
    radiusX: radius * 0.9,
    radiusY: radius * 0.62,
    role: "construction",
    opacity: 0.1,
    rotation: [Math.PI / 2, 0, 0],
  });
};

const addTorusBlueprint = (target: DraftTarget, radius: number) => {
  addEllipseLoop({
    target,
    radiusX: radius * 0.84,
    radiusY: radius * 0.78,
    role: "edge",
    opacity: 0.54,
  });
  addEllipseLoop({
    target,
    radiusX: radius * 0.84,
    radiusY: radius * 0.78,
    role: "construction",
    opacity: 0.12,
    rotation: [Math.PI / 2, 0, 0],
  });
  addEllipseLoop({
    target,
    radiusX: radius * 0.48,
    radiusY: radius * 0.44,
    role: "hidden",
    opacity: 0.08,
    dashed: true,
  });
};

const addPolyhedronBlueprint = (
  target: DraftTarget,
  geometry: THREE.BufferGeometry,
  radius: number,
  edgeOpacity: number
) => {
  const resolvedEdgeOpacity = clamp(edgeOpacity, 0.28, 0.42);
  const edgeMaterial = createLineMaterial("edge", resolvedEdgeOpacity);
  const edgeObject = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_ANGLE),
    edgeMaterial
  );
  registerLineObject(target, edgeObject, edgeMaterial, "edge", resolvedEdgeOpacity);

  addAxisGuide(target, radius * 0.88, radius * 0.05, "construction", 0.08, [
    0,
    0,
    Math.PI / 2,
  ]);
};

const applyBlueprintLayers = (
  target: DraftTarget,
  geometry: THREE.BufferGeometry,
  presetId: string,
  radius: number,
  edgeOpacity: number
) => {
  if (presetId === "sphere") {
    addSphereBlueprint(target, radius);
    return;
  }

  if (presetId === "torus") {
    addTorusBlueprint(target, radius);
    return;
  }

  addPolyhedronBlueprint(target, geometry, radius, edgeOpacity);
};

export const createAuthAmbientScene = ({
  container,
  variant,
  themeMode,
  reducedMotion,
}: CreateAuthAmbientSceneOptions): AuthAmbientSceneController => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  camera.position.set(0, 0, CAMERA_Z);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const figureLayer = new THREE.Group();
  scene.add(figureLayer);
  const interactionTarget = container.parentElement ?? container;

  const hemiLight = new THREE.HemisphereLight("#ffffff", "#000000", 0.8);
  const keyLight = new THREE.DirectionalLight("#ffffff", 1.16);
  keyLight.position.set(-2.4, 2.4, 5.4);
  const rimLight = new THREE.DirectionalLight("#ffffff", 0.72);
  rimLight.position.set(2.6, -1.8, 4.6);
  const fillLight = new THREE.DirectionalLight("#ffffff", 0.28);
  fillLight.position.set(0.1, 0.6, 5.2);
  scene.add(hemiLight, keyLight, rimLight, fillLight);

  const compact = container.clientWidth < 820;
  const figureBlueprints = getAuthAmbientFigures(variant, compact);
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

  const updatePalette = (nextThemeMode: ThemeMode) => {
    palette = AUTH_AMBIENT_PALETTES[nextThemeMode];
    scene.fog = new THREE.FogExp2(
      palette.fog,
      nextThemeMode === "dark" ? 0.03 : 0.024
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
        ? figure.config.opacity * 0.24
        : figure.config.opacity * 0.16;
      figure.lineLayers.forEach((layer) => {
        if (layer.role === "edge") {
          layer.material.color.set(figurePalette.edge);
        } else if (layer.role === "construction") {
          layer.material.color.set(figurePalette.construction);
        } else if (layer.role === "hidden") {
          layer.material.color.set(figurePalette.hidden);
        } else {
          layer.material.color.set(figurePalette.accent);
        }
        layer.material.opacity = layer.opacity;
      });
    });
  };

  const resize = () => {
    viewport.width = Math.max(container.clientWidth, 1);
    viewport.height = Math.max(container.clientHeight, 1);
    camera.aspect = viewport.width / viewport.height;
    camera.fov = viewport.width < 820 ? 39 : variant === "invite" ? 34 : 32;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height, false);
  };

  const createFigure = (config: AmbientFigureConfig) => {
    const geometry = getAmbientGeometry(config.presetId);
    if (!geometry) return;
    const isRound = ROUND_PRESETS.has(config.presetId);

    const material = new THREE.MeshPhongMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: config.opacity,
      emissive: "#0a0f1b",
      emissiveIntensity: isRound ? 0.06 : 0.12,
      shininess: isRound ? 132 : config.shading === "smooth" ? 84 : 42,
      flatShading: config.shading === "flat",
      depthWrite: false,
      depthTest: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
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
        opacity: isRound ? config.opacity * 0.24 : config.opacity * 0.16,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      })
    );
    glow.scale.setScalar(isRound ? 1.04 : 1.02);
    glow.renderOrder = 0;

    const group = new THREE.Group();
    group.scale.setScalar(config.scale);
    group.add(glow, mesh);
    figureLayer.add(group);

    const runtime: FigureRuntime = {
      config,
      group,
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
      spinKickX: 0,
      spinKickY: 0,
      spinKickZ: 0,
      boundingRadius: geometry.boundingSphere?.radius ?? 1,
      isRound,
    };

    applyBlueprintLayers(
      runtime,
      geometry,
      config.presetId,
      runtime.boundingRadius,
      config.edgeOpacity
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

    if (figure.screenX + radiusNdc > 1) {
      figure.screenX = 1 - radiusNdc;
      figure.velocityX = -Math.abs(figure.velocityX) * 0.98;
      figure.velocityY = clamp(
        figure.velocityY + Math.sin(figure.config.phase * 1.7) * 0.014,
        -0.22,
        0.22
      );
      figure.spinKickY += 0.12;
      figure.spinKickZ += 0.08;
    } else if (figure.screenX - radiusNdc < -1) {
      figure.screenX = -1 + radiusNdc;
      figure.velocityX = Math.abs(figure.velocityX) * 0.98;
      figure.velocityY = clamp(
        figure.velocityY - Math.cos(figure.config.phase * 1.3) * 0.014,
        -0.22,
        0.22
      );
      figure.spinKickY -= 0.12;
      figure.spinKickZ -= 0.08;
    }

    if (figure.screenY + radiusNdc > 1) {
      figure.screenY = 1 - radiusNdc;
      figure.velocityY = -Math.abs(figure.velocityY) * 0.98;
      figure.velocityX = clamp(
        figure.velocityX + Math.cos(figure.config.phase * 1.1) * 0.014,
        -0.22,
        0.22
      );
      figure.spinKickX -= 0.11;
      figure.spinKickZ += 0.07;
    } else if (figure.screenY - radiusNdc < -1) {
      figure.screenY = -1 + radiusNdc;
      figure.velocityY = Math.abs(figure.velocityY) * 0.98;
      figure.velocityX = clamp(
        figure.velocityX - Math.sin(figure.config.phase * 1.5) * 0.014,
        -0.22,
        0.22
      );
      figure.spinKickX += 0.11;
      figure.spinKickZ -= 0.07;
    }

    const world = screenToWorld(figure.screenX, figure.screenY, depth);
    world.y +=
      Math.sin(elapsed * figure.config.bobFrequency + figure.config.phase) *
      figure.config.bobAmplitude;
    figure.group.position.copy(world);

    figure.group.rotation.x += (figure.config.rotationX + figure.spinKickX) * delta;
    figure.group.rotation.y += (figure.config.rotationY + figure.spinKickY) * delta;
    figure.group.rotation.z += (figure.config.rotationZ + figure.spinKickZ) * delta;

    if (ROUND_PRESETS.has(figure.config.presetId)) {
      const subtlePulse =
        1 +
        Math.sin(elapsed * 0.7 + figure.config.phase) *
          (variant === "launch" ? 0.014 : 0.01);
      figure.group.scale.setScalar(figure.config.scale * subtlePulse);
      figure.glow.scale.setScalar(1.04 + Math.sin(elapsed * 1.1 + figure.config.phase) * 0.008);
    } else {
      figure.glow.scale.setScalar(1.02);
    }

    figure.spinKickX *= 0.93;
    figure.spinKickY *= 0.93;
    figure.spinKickZ *= 0.93;
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

    pointer.x = ease(pointer.x, pointer.targetX, 0.08);
    pointer.y = ease(pointer.y, pointer.targetY, 0.08);

    figureLayer.rotation.y = pointer.x * (variant === "launch" ? 0.15 : 0.1);
    figureLayer.rotation.x = -pointer.y * (variant === "launch" ? 0.09 : 0.06);
    figureLayer.position.x = pointer.x * 0.24;
    figureLayer.position.y = pointer.y * 0.12;

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
      world.y += Math.sin(index * 0.8) * 0.08;
      figure.group.position.copy(world);
      figure.group.rotation.set(index * 0.18, index * 0.22, index * 0.12);
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
