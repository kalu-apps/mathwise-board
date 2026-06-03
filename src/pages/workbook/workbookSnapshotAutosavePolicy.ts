import type {
  WorkbookBoardObject,
  WorkbookDocumentState,
  WorkbookStroke,
} from "@/features/workbook/model/types";

export const WORKBOOK_SNAPSHOT_AUTOSAVE_DEBOUNCE_MS = 4_200;
export const WORKBOOK_SNAPSHOT_PENDING_RETRY_MS = 6_000;

const SNAPSHOT_BASE_AUTOSAVE_GAP_MS = 10_000;
const SNAPSHOT_LARGE_AUTOSAVE_GAP_MS = 30_000;
const SNAPSHOT_LARGE_STROKE_COUNT = 800;
const SNAPSHOT_LARGE_OBJECT_COUNT = 80;
const SNAPSHOT_LARGE_DOCUMENT_ASSET_COUNT = 3;
export const SNAPSHOT_PREEMPTIVE_COMPACTION_DATA_URL_CHARS = 160_000;

const isImageDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:image/");

const isDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:");

export const estimateWorkbookSnapshotEmbeddedDataUrlChars = (
  boardObjects: WorkbookBoardObject[],
  documentState: WorkbookDocumentState
) => {
  const objectChars = boardObjects.reduce((sum, object) => {
    if (object.type !== "image") return sum;
    return sum + (isImageDataUrl(object.imageUrl) ? object.imageUrl.length : 0);
  }, 0);
  const assetChars = documentState.assets.reduce((sum, asset) => {
    const assetUrlChars = isDataUrl(asset.url) ? asset.url.length : 0;
    const renderedPagesChars = Array.isArray(asset.renderedPages)
      ? asset.renderedPages.reduce(
          (renderedSum, renderedPage) =>
            renderedSum + (isImageDataUrl(renderedPage.imageUrl) ? renderedPage.imageUrl.length : 0),
          0
        )
      : 0;
    return sum + assetUrlChars + renderedPagesChars;
  }, 0);
  return objectChars + assetChars;
};

export const resolveWorkbookSnapshotAutosaveGapMs = (params: {
  boardObjects: WorkbookBoardObject[];
  documentState: WorkbookDocumentState;
  boardStrokes: WorkbookStroke[];
  annotationStrokes: WorkbookStroke[];
  embeddedDataUrlChars?: number;
}) => {
  const embeddedDataUrlChars =
    params.embeddedDataUrlChars ??
    estimateWorkbookSnapshotEmbeddedDataUrlChars(params.boardObjects, params.documentState);
  const strokeCount = params.boardStrokes.length + params.annotationStrokes.length;
  const isLargeSnapshot =
    embeddedDataUrlChars >= SNAPSHOT_PREEMPTIVE_COMPACTION_DATA_URL_CHARS ||
    strokeCount >= SNAPSHOT_LARGE_STROKE_COUNT ||
    params.boardObjects.length >= SNAPSHOT_LARGE_OBJECT_COUNT ||
    params.documentState.assets.length >= SNAPSHOT_LARGE_DOCUMENT_ASSET_COUNT;

  return isLargeSnapshot ? SNAPSHOT_LARGE_AUTOSAVE_GAP_MS : SNAPSHOT_BASE_AUTOSAVE_GAP_MS;
};
