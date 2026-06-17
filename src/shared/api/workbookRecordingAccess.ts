export const WORKBOOK_RECORDING_TOKEN_QUERY_PARAM = "recordingToken";
export const WORKBOOK_RECORDING_TOKEN_HEADER = "X-Workbook-Recording-Token";

const WORKBOOK_RECORDING_PATH_PREFIX = "/workbook/recording/";

const getBrowserLocation = () => {
  const location = (globalThis as {
    location?: {
      pathname?: unknown;
      search?: unknown;
      origin?: unknown;
    };
  }).location;
  if (!location) return null;
  const pathname = typeof location.pathname === "string" ? location.pathname : "";
  const search = typeof location.search === "string" ? location.search : "";
  const origin = typeof location.origin === "string" ? location.origin : "";
  return { pathname, search, origin };
};

export const isWorkbookServerRecordingRoute = () =>
  Boolean(getBrowserLocation()?.pathname.startsWith(WORKBOOK_RECORDING_PATH_PREFIX));

export const readWorkbookRecordingAccessToken = () => {
  if (!isWorkbookServerRecordingRoute()) return null;
  try {
    const token = new URLSearchParams(getBrowserLocation()?.search ?? "").get(
      WORKBOOK_RECORDING_TOKEN_QUERY_PARAM
    );
    const normalized = token?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

export const appendWorkbookRecordingAccessToken = (url: string) => {
  const token = readWorkbookRecordingAccessToken();
  if (!token) return url;
  try {
    const parsed = new URL(url, getBrowserLocation()?.origin || undefined);
    if (parsed.searchParams.has(WORKBOOK_RECORDING_TOKEN_QUERY_PARAM)) {
      return parsed.toString();
    }
    parsed.searchParams.set(WORKBOOK_RECORDING_TOKEN_QUERY_PARAM, token);
    return parsed.toString();
  } catch {
    return url;
  }
};
