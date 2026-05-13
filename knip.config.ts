import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: [
    "**/*.test.ts",
  ],
  project: [
    "src/**/*.{ts,tsx}",
    "backend/src/**/*.ts",
    "scripts/**/*.{ts,mjs}",
  ],
};

export default config;
