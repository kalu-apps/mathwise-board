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
  construction: string;
  hidden: string;
  accent: string;
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
  fillLight: string;
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
    opacity: 0.1,
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
    opacity: 0.09,
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
    opacity: 0.11,
    edgeOpacity: 0.72,
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
    opacity: 0.105,
    edgeOpacity: 0.68,
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
    opacity: 0.095,
    edgeOpacity: 0.64,
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
    opacity: 0.09,
    edgeOpacity: 0.62,
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
    opacity: 0.085,
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
    opacity: 0.082,
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
    opacity: 0.095,
    edgeOpacity: 0.62,
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
    opacity: 0.085,
    edgeOpacity: 0.56,
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
    fog: "#12181f",
    hemiSky: "#d9e3ee",
    hemiGround: "#171d24",
    keyLight: "#4d6e9d",
    rimLight: "#c4872f",
    fillLight: "#2f7464",
    figures: {
      cyan: {
        fill: "#2a4b66",
        edge: "#e6edf4",
        construction: "#5f88ad",
        hidden: "#48627b",
        accent: "#c4872f",
        emissive: "#182633",
        glow: "#4d6e9d",
        specular: "#ffffff",
      },
      cobalt: {
        fill: "#2f4f7f",
        edge: "#e4ebf3",
        construction: "#6d88ad",
        hidden: "#4d617c",
        accent: "#2f7464",
        emissive: "#1b2a3d",
        glow: "#6684ab",
        specular: "#f8fbff",
      },
      mint: {
        fill: "#2f7464",
        edge: "#e5f1ee",
        construction: "#5f9a89",
        hidden: "#4d8072",
        accent: "#8da56f",
        emissive: "#1b2e29",
        glow: "#5f9a89",
        specular: "#f6fbf9",
      },
      violet: {
        fill: "#5f6f86",
        edge: "#eef2f7",
        construction: "#8d9bb0",
        hidden: "#6f7e93",
        accent: "#2f7464",
        emissive: "#232d39",
        glow: "#7d8ea6",
        specular: "#f7fafd",
      },
      glass: {
        fill: "#31414f",
        edge: "#f0f4f8",
        construction: "#7f92a7",
        hidden: "#556676",
        accent: "#c4872f",
        emissive: "#1a232c",
        glow: "#6b8297",
        specular: "#ffffff",
      },
      ice: {
        fill: "#5c4f38",
        edge: "#f6f0e6",
        construction: "#bca27d",
        hidden: "#8e7b5e",
        accent: "#2f7464",
        emissive: "#2a241b",
        glow: "#d0b38b",
        specular: "#fff9ef",
      },
    },
  },
  light: {
    fog: "#f5f8fa",
    hemiSky: "#ffffff",
    hemiGround: "#e9eef2",
    keyLight: "#4d6e9d",
    rimLight: "#c4872f",
    fillLight: "#2f7464",
    figures: {
      cyan: {
        fill: "#7fa7c9",
        edge: "#2f4f7f",
        construction: "#5f88ad",
        hidden: "#a5b6c8",
        accent: "#c4872f",
        emissive: "#f6fafc",
        glow: "#9db6cd",
        specular: "#ffffff",
      },
      cobalt: {
        fill: "#6f8cac",
        edge: "#314a66",
        construction: "#5f7f9f",
        hidden: "#a9b7c7",
        accent: "#2f7464",
        emissive: "#f6f9fc",
        glow: "#95a9be",
        specular: "#ffffff",
      },
      mint: {
        fill: "#79a392",
        edge: "#335f55",
        construction: "#5f8f80",
        hidden: "#a8c4ba",
        accent: "#c4872f",
        emissive: "#f7fcfa",
        glow: "#96c1b3",
        specular: "#ffffff",
      },
      violet: {
        fill: "#98a4b6",
        edge: "#56606f",
        construction: "#7a8798",
        hidden: "#b8c1cd",
        accent: "#2f7464",
        emissive: "#fafbfc",
        glow: "#aab4c1",
        specular: "#ffffff",
      },
      glass: {
        fill: "#b6c0ca",
        edge: "#556373",
        construction: "#8796a6",
        hidden: "#c6ced7",
        accent: "#c4872f",
        emissive: "#ffffff",
        glow: "#c4d0dc",
        specular: "#ffffff",
      },
      ice: {
        fill: "#d3c2a4",
        edge: "#7b6b51",
        construction: "#b59e79",
        hidden: "#cec0ab",
        accent: "#2f7464",
        emissive: "#fffaf1",
        glow: "#e3d1b4",
        specular: "#ffffff",
      },
    },
  },
};
