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
  glow: string;
  specular: string;
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
    scale: 1.07,
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
    opacity: 0.22,
    edgeOpacity: 0,
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
    opacity: 0.16,
    edgeOpacity: 0,
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
    opacity: 0.18,
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
    opacity: 0.17,
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
    opacity: 0.16,
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
    opacity: 0.15,
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
    scale: 0.9,
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
    opacity: 0.19,
    edgeOpacity: 0,
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
    opacity: 0.15,
    edgeOpacity: 0,
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
    opacity: 0.16,
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
    opacity: 0.14,
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
    fog: "#050713",
    hemiSky: "#ccf7ff",
    hemiGround: "#090310",
    keyLight: "#32d8ff",
    rimLight: "#ff4fd8",
    figures: {
      cyan: {
        fill: "#1ae4ff",
        edge: "#cbfdff",
        emissive: "#082c46",
        glow: "#00e5ff",
        specular: "#f4ffff",
      },
      cobalt: {
        fill: "#7762ff",
        edge: "#ece6ff",
        emissive: "#1d1248",
        glow: "#9066ff",
        specular: "#f8f2ff",
      },
      mint: {
        fill: "#38ff97",
        edge: "#deffef",
        emissive: "#0a331f",
        glow: "#22ff7d",
        specular: "#f3fff7",
      },
      violet: {
        fill: "#ff4fd8",
        edge: "#ffe1fb",
        emissive: "#42093e",
        glow: "#ff3ad0",
        specular: "#fff1fb",
      },
      glass: {
        fill: "#7ec4ff",
        edge: "#ffffff",
        emissive: "#14254d",
        glow: "#53b0ff",
        specular: "#ffffff",
      },
      ice: {
        fill: "#ffbf3f",
        edge: "#fff0bc",
        emissive: "#4a2b05",
        glow: "#ff9d00",
        specular: "#fff7e5",
      },
    },
  },
  light: {
    fog: "#f4f8ff",
    hemiSky: "#ffffff",
    hemiGround: "#edf0ff",
    keyLight: "#30bfff",
    rimLight: "#ff65d4",
    figures: {
      cyan: {
        fill: "#00b7eb",
        edge: "#4672a5",
        emissive: "#edfaff",
        glow: "#5de6ff",
        specular: "#ffffff",
      },
      cobalt: {
        fill: "#6351ff",
        edge: "#6772b8",
        emissive: "#f1efff",
        glow: "#8574ff",
        specular: "#fff8ff",
      },
      mint: {
        fill: "#00d89d",
        edge: "#4d917d",
        emissive: "#eefff7",
        glow: "#4fffc5",
        specular: "#f8fff9",
      },
      violet: {
        fill: "#f24ccc",
        edge: "#8f68ae",
        emissive: "#fff0fb",
        glow: "#ff84e6",
        specular: "#fff4fd",
      },
      glass: {
        fill: "#79a7ff",
        edge: "#587eab",
        emissive: "#f5f8ff",
        glow: "#78beff",
        specular: "#ffffff",
      },
      ice: {
        fill: "#ffb429",
        edge: "#9a7742",
        emissive: "#fff7ea",
        glow: "#ffd56d",
        specular: "#fffaf0",
      },
    },
  },
};
