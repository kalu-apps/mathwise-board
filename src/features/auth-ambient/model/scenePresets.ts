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
    fog: "#040a13",
    hemiSky: "#d7f7ff",
    hemiGround: "#05060b",
    keyLight: "#79e6ff",
    rimLight: "#ffc266",
    fillLight: "#7d98ff",
    figures: {
      cyan: {
        fill: "#0f3550",
        edge: "#d8fbff",
        construction: "#62e6ff",
        hidden: "#2e6f89",
        accent: "#ffcf5a",
        emissive: "#071422",
        glow: "#2cd8ff",
        specular: "#f4ffff",
      },
      cobalt: {
        fill: "#15254f",
        edge: "#dfe8ff",
        construction: "#7ea0ff",
        hidden: "#354b84",
        accent: "#72fff2",
        emissive: "#0b1126",
        glow: "#6d82ff",
        specular: "#f3f7ff",
      },
      mint: {
        fill: "#103a32",
        edge: "#ddfff4",
        construction: "#64ffc5",
        hidden: "#2c7868",
        accent: "#d8ff63",
        emissive: "#091913",
        glow: "#2be9b4",
        specular: "#f3fff7",
      },
      violet: {
        fill: "#251a53",
        edge: "#efe5ff",
        construction: "#aa82ff",
        hidden: "#58418d",
        accent: "#7be9ff",
        emissive: "#120d26",
        glow: "#8e63ff",
        specular: "#fbf7ff",
      },
      glass: {
        fill: "#10263b",
        edge: "#f0f7ff",
        construction: "#94c2ff",
        hidden: "#476b8d",
        accent: "#ff9f67",
        emissive: "#081019",
        glow: "#6cb5ff",
        specular: "#ffffff",
      },
      ice: {
        fill: "#47300e",
        edge: "#fff2cb",
        construction: "#ffc766",
        hidden: "#8a6530",
        accent: "#75fff6",
        emissive: "#201206",
        glow: "#ffb444",
        specular: "#fff7e5",
      },
    },
  },
  light: {
    fog: "#eff6ff",
    hemiSky: "#ffffff",
    hemiGround: "#d9e5fb",
    keyLight: "#3abef0",
    rimLight: "#ffb159",
    fillLight: "#768fff",
    figures: {
      cyan: {
        fill: "#4bc8ee",
        edge: "#315b8a",
        construction: "#11abd9",
        hidden: "#85b6ce",
        accent: "#ffab2f",
        emissive: "#f5fbff",
        glow: "#78e7ff",
        specular: "#ffffff",
      },
      cobalt: {
        fill: "#6780ff",
        edge: "#31457c",
        construction: "#5876ff",
        hidden: "#90a0d8",
        accent: "#4cf5ff",
        emissive: "#f5f7ff",
        glow: "#9eafff",
        specular: "#ffffff",
      },
      mint: {
        fill: "#2eccaa",
        edge: "#336c63",
        construction: "#18c59b",
        hidden: "#79b5a8",
        accent: "#d4ff4a",
        emissive: "#f5fffb",
        glow: "#6ff0d0",
        specular: "#ffffff",
      },
      violet: {
        fill: "#7f70ff",
        edge: "#513a8d",
        construction: "#8c62ff",
        hidden: "#a89bd6",
        accent: "#4fe4ff",
        emissive: "#fbf8ff",
        glow: "#b19cff",
        specular: "#ffffff",
      },
      glass: {
        fill: "#8eb2d6",
        edge: "#435d83",
        construction: "#6f9fd8",
        hidden: "#9db5cf",
        accent: "#ff8a4c",
        emissive: "#ffffff",
        glow: "#a7d8ff",
        specular: "#ffffff",
      },
      ice: {
        fill: "#ffb35c",
        edge: "#84623a",
        construction: "#ffab36",
        hidden: "#d0b089",
        accent: "#4ce8dd",
        emissive: "#fffaf3",
        glow: "#ffd98a",
        specular: "#ffffff",
      },
    },
  },
};
