const HEX_COLOR_LONG_RE = /^#[0-9a-fA-F]{6}$/;
const HEX_COLOR_SHORT_RE = /^#[0-9a-fA-F]{3}$/;

const normalizeHexColor = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (HEX_COLOR_LONG_RE.test(trimmed)) {
    return trimmed;
  }
  if (HEX_COLOR_SHORT_RE.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
};

export const toColorInputValue = (value: unknown, fallback: string): string =>
  normalizeHexColor(value) ?? normalizeHexColor(fallback) ?? "#000000";
