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

type FigureRuntime = {
  config: AmbientFigureConfig;
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  baseDepth: number;
  screenX: number;
  screenY: number;
  velocityX: number;
  velocityY: number;
  spinKickX: number;
  spinKickY: number;
  spinKickZ: number;
  boundingRadius: number;
};

export type AuthAmbientSceneController = {
  destroy: () => void;
  setThemeMode: (themeMode: ThemeMode) => void;
};

const MAX_DELTA_SECONDS = 0.045;
const FRAME_INTERVAL_MS = 1000 / 30;
const CAMERA_Z = 8.2;
const EDGE_THRESHOLD_ANGLE = 18;
const ROUND_PRESETS = new Set(["sphere", "torus"]);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ease = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

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

  const hemiLight = new THREE.HemisphereLight("#ffffff", "#000000", 0.84);
  const keyLight = new THREE.DirectionalLight("#ffffff", 1.12);
  keyLight.position.set(-2.4, 2.2, 5.4);
  const rimLight = new THREE.DirectionalLight("#ffffff", 0.56);
  rimLight.position.set(2.6, -1.8, 4.6);
  scene.add(hemiLight, keyLight, rimLight);

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
    scene.fog = new THREE.FogExp2(palette.fog, nextThemeMode === "dark" ? 0.032 : 0.026);
    hemiLight.color.set(palette.hemiSky);
    hemiLight.groundColor.set(palette.hemiGround);
    keyLight.color.set(palette.keyLight);
    rimLight.color.set(palette.rimLight);

    figures.forEach((figure) => {
      const figurePalette = palette.figures[figure.config.colorSlot];
      figure.mesh.material.color.set(figurePalette.fill);
      figure.mesh.material.emissive.set(figurePalette.emissive);
      figure.mesh.material.opacity = figure.config.opacity;
      figure.edges.material.color.set(figurePalette.edge);
      figure.edges.material.opacity = figure.config.edgeOpacity;
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

    const material = new THREE.MeshPhongMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: config.opacity,
      emissive: "#111111",
      emissiveIntensity: 0.22,
      shininess: config.shading === "smooth" ? 56 : 22,
      flatShading: config.shading === "flat",
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_ANGLE),
      new THREE.LineBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: config.edgeOpacity,
        depthWrite: false,
      })
    );
    edges.renderOrder = 2;

    const group = new THREE.Group();
    group.scale.setScalar(config.scale);
    group.add(mesh, edges);
    figureLayer.add(group);

    figures.push({
      config,
      group,
      mesh,
      edges,
      baseDepth: config.depth,
      screenX: config.screenX,
      screenY: config.screenY,
      velocityX: config.velocityX,
      velocityY: config.velocityY,
      spinKickX: 0,
      spinKickY: 0,
      spinKickZ: 0,
      boundingRadius: geometry.boundingSphere?.radius ?? 1,
    });
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
          (variant === "launch" ? 0.026 : 0.016);
      figure.group.scale.setScalar(figure.config.scale * subtlePulse);
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
        figure.edges.material.dispose();
        figure.edges.geometry.dispose();
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
