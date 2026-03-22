const WORKBOOK_ASSET_URL_RE =
  /^\/api\/workbook\/sessions\/[^/]+\/assets\/[^/]+(?:\/content)?$/i;

export const normalizeWorkbookAssetContentUrl = (value: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) return value;
  const rawValue = value.trim();
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
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawValue;
  }
};
