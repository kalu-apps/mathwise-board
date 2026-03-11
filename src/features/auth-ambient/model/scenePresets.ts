import type { ThemeMode } from "@/app/theme/themeModeContext";

export type AuthAmbientVariant = "launch" | "invite";

type AmbientColorSlot =
  | "cyan"
  | "cobalt"
  | "mint"
  | "violet"
  | "glass"
  | "ice";

export type AmbientFigureConfig = {
  presetId: string;
  colorSlot: AmbientColorSlot;
  shading: "flat" | "smooth";
  screenX: number;
  screenY: number;
  depth: number;
  scale: number;
  velocityX: number;
  velocityY: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  bobAmplitude: number;
  bobFrequency: number;
  depthAmplitude: number;
  depthFrequency: number;
  phase: number;
  opacity: number;
  edgeOpacity: number;
};

type AmbientFigureColor = {
  fill: string;
  edge: string;
  emissive: string;
};

export type AuthAmbientPalette = {
  fog: string;
  hemiSky: string;
  hemiGround: string;
  keyLight: string;
  rimLight: string;
  figures: Record<AmbientColorSlot, AmbientFigureColor>;
};

const launchDesktop: AmbientFigureConfig[] = [
  {
    presetId: "sphere",
    colorSlot: "cyan",
    shading: "smooth",
    screenX: -0.82,
    screenY: 0.48,
    depth: -2.1,
    scale: 1.34,
    velocityX: 0.16,
    velocityY: -0.1,
    rotationX: 0.06,
    rotationY: 0.18,
    rotationZ: 0.04,
    bobAmplitude: 0.12,
    bobFrequency: 1.2,
    depthAmplitude: 0.28,
    depthFrequency: 0.8,
    phase: 0.6,
    opacity: 0.14,
    edgeOpacity: 0.52,
  },
  {
    presetId: "torus",
    colorSlot: "cobalt",
    shading: "smooth",
    screenX: 0.86,
    screenY: 0.44,
    depth: -3.2,
    scale: 1.08,
    velocityX: -0.14,
    velocityY: -0.12,
    rotationX: 0.16,
    rotationY: 0.08,
    rotationZ: 0.14,
    bobAmplitude: 0.08,
    bobFrequency: 0.92,
    depthAmplitude: 0.2,
    depthFrequency: 0.62,
    phase: 1.7,
    opacity: 0.13,
    edgeOpacity: 0.56,
  },
  {
    presetId: "oblique_prism",
    colorSlot: "mint",
    shading: "flat",
    screenX: -0.56,
    screenY: -0.08,
    depth: -2.4,
    scale: 1.16,
    velocityX: 0.12,
    velocityY: 0.14,
    rotationX: 0.09,
    rotationY: 0.22,
    rotationZ: 0.11,
    bobAmplitude: 0.1,
    bobFrequency: 1.36,
    depthAmplitude: 0.24,
    depthFrequency: 0.9,
    phase: 2.4,
    opacity: 0.15,
    edgeOpacity: 0.58,
  },
  {
    presetId: "triangular_prism",
    colorSlot: "violet",
    shading: "flat",
    screenX: 0.68,
    screenY: -0.06,
    depth: -2.55,
    scale: 1.02,
    velocityX: -0.12,
    velocityY: 0.16,
    rotationX: 0.12,
    rotationY: 0.2,
    rotationZ: 0.08,
    bobAmplitude: 0.11,
    bobFrequency: 1.18,
    depthAmplitude: 0.26,
    depthFrequency: 0.86,
    phase: 0.9,
    opacity: 0.14,
    edgeOpacity: 0.56,
  },
  {
    presetId: "pyramid_square",
    colorSlot: "ice",
    shading: "flat",
    screenX: -0.74,
    screenY: -0.6,
    depth: -3.35,
    scale: 0.96,
    velocityX: 0.18,
    velocityY: 0.16,
    rotationX: 0.08,
    rotationY: 0.12,
    rotationZ: 0.14,
    bobAmplitude: 0.09,
    bobFrequency: 1.08,
    depthAmplitude: 0.18,
    depthFrequency: 0.58,
    phase: 2.9,
    opacity: 0.12,
    edgeOpacity: 0.5,
  },
  {
    presetId: "cube",
    colorSlot: "glass",
    shading: "flat",
    screenX: 0.86,
    screenY: -0.56,
    depth: -3.05,
    scale: 0.9,
    velocityX: -0.18,
    velocityY: 0.12,
    rotationX: 0.07,
    rotationY: 0.16,
    rotationZ: 0.1,
    bobAmplitude: 0.08,
    bobFrequency: 0.98,
    depthAmplitude: 0.16,
    depthFrequency: 0.54,
    phase: 1.35,
    opacity: 0.11,
    edgeOpacity: 0.46,
  },
];

const launchCompact = launchDesktop.filter((item) =>
  ["sphere", "torus", "oblique_prism", "cube"].includes(item.presetId)
);

const inviteDesktop: AmbientFigureConfig[] = [
  {
    presetId: "sphere",
    colorSlot: "cyan",
    shading: "smooth",
    screenX: -0.86,
    screenY: 0.42,
    depth: -2.8,
    scale: 1.12,
    velocityX: 0.11,
    velocityY: -0.08,
    rotationX: 0.05,
    rotationY: 0.14,
    rotationZ: 0.04,
    bobAmplitude: 0.08,
    bobFrequency: 1,
    depthAmplitude: 0.16,
    depthFrequency: 0.54,
    phase: 0.3,
    opacity: 0.12,
    edgeOpacity: 0.46,
  },
  {
    presetId: "torus",
    colorSlot: "cobalt",
    shading: "smooth",
    screenX: 0.92,
    screenY: 0.38,
    depth: -3.45,
    scale: 0.96,
    velocityX: -0.1,
    velocityY: -0.08,
    rotationX: 0.12,
    rotationY: 0.06,
    rotationZ: 0.11,
    bobAmplitude: 0.06,
    bobFrequency: 0.9,
    depthAmplitude: 0.14,
    depthFrequency: 0.5,
    phase: 1.25,
    opacity: 0.11,
    edgeOpacity: 0.46,
  },
  {
    presetId: "oblique_prism",
    colorSlot: "mint",
    shading: "flat",
    screenX: -0.78,
    screenY: -0.5,
    depth: -3.1,
    scale: 0.98,
    velocityX: 0.12,
    velocityY: 0.11,
    rotationX: 0.07,
    rotationY: 0.14,
    rotationZ: 0.08,
    bobAmplitude: 0.08,
    bobFrequency: 1.12,
    depthAmplitude: 0.16,
    depthFrequency: 0.62,
    phase: 2.05,
    opacity: 0.12,
    edgeOpacity: 0.48,
  },
  {
    presetId: "cube",
    colorSlot: "glass",
    shading: "flat",
    screenX: 0.86,
    screenY: -0.58,
    depth: -3.2,
    scale: 0.84,
    velocityX: -0.12,
    velocityY: 0.09,
    rotationX: 0.06,
    rotationY: 0.13,
    rotationZ: 0.07,
    bobAmplitude: 0.06,
    bobFrequency: 0.86,
    depthAmplitude: 0.14,
    depthFrequency: 0.46,
    phase: 2.7,
    opacity: 0.1,
    edgeOpacity: 0.42,
  },
];

const inviteCompact = inviteDesktop.filter((item) =>
  ["sphere", "oblique_prism", "cube"].includes(item.presetId)
);

export const getAuthAmbientFigures = (
  variant: AuthAmbientVariant,
  compact: boolean
) => {
  if (variant === "invite") {
    return compact ? inviteCompact : inviteDesktop;
  }
  return compact ? launchCompact : launchDesktop;
};

export const AUTH_AMBIENT_PALETTES: Record<ThemeMode, AuthAmbientPalette> = {
  dark: {
    fog: "#07101a",
    hemiSky: "#bedfff",
    hemiGround: "#081018",
    keyLight: "#7fc7ff",
    rimLight: "#88ffe2",
    figures: {
      cyan: { fill: "#55d7ff", edge: "#d6f7ff", emissive: "#0d2938" },
      cobalt: { fill: "#7b84ff", edge: "#e2e6ff", emissive: "#1e2148" },
      mint: { fill: "#4ce2c8", edge: "#d8fff5", emissive: "#102d2a" },
      violet: { fill: "#a792ff", edge: "#f0e9ff", emissive: "#291f46" },
      glass: { fill: "#d8e8ff", edge: "#ffffff", emissive: "#17253b" },
      ice: { fill: "#8fc4ff", edge: "#edf7ff", emissive: "#10243a" },
    },
  },
  light: {
    fog: "#eef5ff",
    hemiSky: "#ffffff",
    hemiGround: "#e7eef8",
    keyLight: "#5f8dff",
    rimLight: "#3ecdb2",
    figures: {
      cyan: { fill: "#4da8df", edge: "#5e7ca6", emissive: "#eef7ff" },
      cobalt: { fill: "#5669de", edge: "#6678aa", emissive: "#eef0ff" },
      mint: { fill: "#2fbfa2", edge: "#5c8f88", emissive: "#ebfaf6" },
      violet: { fill: "#7868d8", edge: "#7f7bb0", emissive: "#f4f0ff" },
      glass: { fill: "#b8c8e8", edge: "#6a83ad", emissive: "#fafcff" },
      ice: { fill: "#72addd", edge: "#6887b1", emissive: "#f0f8ff" },
    },
  },
};
