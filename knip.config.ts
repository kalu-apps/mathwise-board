import type { KnipConfig } from "knip";

const config: KnipConfig = {
  project: [
    "src/**/*.{ts,tsx}",
    "backend/src/**/*.ts",
    "scripts/**/*.{ts,mjs}",
  ],
};

export default config;
