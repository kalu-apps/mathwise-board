import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: [
    "**/*.test.ts",
    "**/*.test.tsx",
  ],
  project: [
    "src/**/*.{ts,tsx}",
    "backend/src/**/*.ts",
    "scripts/**/*.{ts,mjs}",
  ],
};

export default config;
