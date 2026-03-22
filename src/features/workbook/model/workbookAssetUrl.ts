import { API_ROOT } from "@/shared/api/base";

const WORKBOOK_ASSET_URL_RE =
  /^\/api\/workbook\/sessions\/[^/]+\/assets\/[^/]+(?:\/content)?$/i;

const isBrokenContentAlias = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return normalized === "content" || normalized === "/content";
};

const resolveApiOrigin = () => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = new URL(API_ROOT, window.location.origin);
    return parsed.origin || window.location.origin;
  } catch {
    return window.location.origin;
  }
};

export const isWorkbookAssetContentUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  if (isBrokenContentAlias(value)) return false;
  try {
    const parsed = new URL(value.trim(), "http://workbook.local");
    return WORKBOOK_ASSET_URL_RE.test(parsed.pathname);
  } catch {
    return false;
  }
};

export const normalizeWorkbookAssetContentUrl = (value: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) return value;
  const rawValue = value.trim();
  if (isBrokenContentAlias(rawValue)) return rawValue;
  const isAbsolute = /^[a-z]+:\/\//i.test(rawValue);
  try {
    const parsed = new URL(rawValue, "http://workbook.local");
    if (!WORKBOOK_ASSET_URL_RE.test(parsed.pathname)) {
      return rawValue;
    }
    if (!parsed.pathname.endsWith("/content")) {
      parsed.pathname = `${parsed.pathname}/content`;
    }
    if (isAbsolute) {
      return parsed.toString();
    }
    const apiOrigin = resolveApiOrigin();
    if (apiOrigin) {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawValue;
  }
};
