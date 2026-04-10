import type {
  WorkbookBoardObject,
  WorkbookDocumentAsset,
  WorkbookPoint,
} from "./types";
import {
  WORKBOOK_IMAGE_ASSET_META_KEY,
  WORKBOOK_IMAGE_ASPECT_RATIO_META_KEY,
} from "./scene";
import { resolveWorkbookImageAspectRatioFromDimensions } from "./imageGeometry";
import { WORKBOOK_TEXT_FALLBACK_COLOR } from "./workbookVisualColors";

type WorkbookDocumentRenderedPage =
  NonNullable<WorkbookDocumentAsset["renderedPages"]>[number];

const WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_WIDTH = 380;
const WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_HEIGHT = 260;

export const resolveWorkbookBoardInsertPosition = (
  viewport: WorkbookPoint,
  objectCount: number
) => {
  const insertOffset = Math.max(0, objectCount % 6);
  return {
    x: viewport.x + 96 + insertOffset * 20,
    y: viewport.y + 92 + insertOffset * 16,
  };
};

export const resolvePrimaryDocumentRenderedPage = (
  renderedPages: WorkbookDocumentAsset["renderedPages"],
  page = 1
) =>
  renderedPages?.find((entry) => entry.page === page) ??
  renderedPages?.[0] ??
  null;

export const resolveWorkbookImportedImageFrameSize = (params: {
  sourceWidth?: number;
  sourceHeight?: number;
}) => {
  const fallback = {
    width: WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_WIDTH,
    height: WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_HEIGHT,
  };
  const sourceWidth = Number(params.sourceWidth);
  const sourceHeight = Number(params.sourceHeight);
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)) {
    return fallback;
  }
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return fallback;
  }
  const ratio = sourceWidth / sourceHeight;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return fallback;
  }
  const width = Math.max(
    1,
    Math.round(
      Math.min(
        WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_WIDTH,
        WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_HEIGHT * ratio
      )
    )
  );
  const height = Math.max(
    1,
    Math.round(
      Math.min(
        WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_HEIGHT,
        WORKBOOK_IMPORTED_IMAGE_FRAME_MAX_WIDTH / ratio
      )
    )
  );
  return { width, height };
};

export const buildWorkbookDocumentAsset = (params: {
  assetId: string;
  fileName: string;
  type: WorkbookDocumentAsset["type"];
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  renderedPages?: WorkbookDocumentAsset["renderedPages"];
}): WorkbookDocumentAsset => ({
  id: params.assetId,
  name: params.fileName,
  type: params.type,
  url: params.url,
  uploadedBy: params.uploadedBy,
  uploadedAt: params.uploadedAt,
  renderedPages: params.renderedPages,
});

export const buildWorkbookSyncedDocumentAsset = (params: {
  asset: WorkbookDocumentAsset;
  syncedUrl: string;
  renderedPage: WorkbookDocumentRenderedPage | null;
  imageUrl?: string;
}): WorkbookDocumentAsset => ({
  ...params.asset,
  url: params.syncedUrl,
  renderedPages:
    params.renderedPage && params.imageUrl
      ? [
          {
            id: params.renderedPage.id,
            page: params.renderedPage.page,
            imageUrl: params.imageUrl,
            width: params.renderedPage.width,
            height: params.renderedPage.height,
          },
        ]
      : undefined,
});

export const buildWorkbookDocumentBoardObject = (params: {
  objectId: string;
  assetId?: string;
  fileName: string;
  authorUserId: string;
  createdAt: string;
  insertPosition: WorkbookPoint;
  imageUrl?: string;
  renderedPage?: WorkbookDocumentRenderedPage | null;
  sourceWidth?: number;
  sourceHeight?: number;
  type: "image" | "pdf" | "file";
}): WorkbookBoardObject => {
  const isVisualImage = params.type === "image" || Boolean(params.imageUrl);
  const imageFrame = resolveWorkbookImportedImageFrameSize({
    sourceWidth: params.sourceWidth ?? params.renderedPage?.width,
    sourceHeight: params.sourceHeight ?? params.renderedPage?.height,
  });
  const imageAspectRatio = resolveWorkbookImageAspectRatioFromDimensions({
    width: params.sourceWidth ?? params.renderedPage?.width,
    height: params.sourceHeight ?? params.renderedPage?.height,
  });
  const baseMeta =
    params.type === "image" && params.assetId
      ? {
          [WORKBOOK_IMAGE_ASSET_META_KEY]: params.assetId,
        }
      : undefined;
  const imageMeta =
    isVisualImage && imageAspectRatio
      ? {
          ...(baseMeta ?? {}),
          [WORKBOOK_IMAGE_ASPECT_RATIO_META_KEY]: imageAspectRatio,
        }
      : baseMeta;
  return {
    id: params.objectId,
    type: isVisualImage ? "image" : "text",
    layer: "board",
    x: params.insertPosition.x,
    y: params.insertPosition.y,
    width: isVisualImage ? imageFrame.width : 320,
    height: isVisualImage ? imageFrame.height : 120,
    color: WORKBOOK_TEXT_FALLBACK_COLOR,
    fill: "transparent",
    strokeWidth: 2,
    opacity: 1,
    imageUrl: params.imageUrl,
    imageName: params.fileName,
    text: isVisualImage ? undefined : `PDF: ${params.fileName}`,
    fontSize: isVisualImage ? undefined : 18,
    meta: imageMeta,
    authorUserId: params.authorUserId,
    createdAt: params.createdAt,
  };
};

export const buildWorkbookSnapshotBoardObject = (params: {
  objectId: string;
  asset: WorkbookDocumentAsset;
  page: number;
  authorUserId: string;
  createdAt: string;
  insertPosition: WorkbookPoint;
  imageUrl?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}): WorkbookBoardObject => {
  const renderedPage = resolvePrimaryDocumentRenderedPage(params.asset.renderedPages, params.page);
  const isVisualImage = params.asset.type === "image" || Boolean(renderedPage);
  const imageFrame = resolveWorkbookImportedImageFrameSize({
    sourceWidth: params.sourceWidth ?? renderedPage?.width,
    sourceHeight: params.sourceHeight ?? renderedPage?.height,
  });
  const imageAspectRatio = resolveWorkbookImageAspectRatioFromDimensions({
    width: params.sourceWidth ?? renderedPage?.width,
    height: params.sourceHeight ?? renderedPage?.height,
  });
  const baseMeta =
    params.asset.type === "image"
      ? {
          [WORKBOOK_IMAGE_ASSET_META_KEY]: params.asset.id,
        }
      : undefined;
  const imageMeta =
    isVisualImage && imageAspectRatio
      ? {
          ...(baseMeta ?? {}),
          [WORKBOOK_IMAGE_ASPECT_RATIO_META_KEY]: imageAspectRatio,
        }
      : baseMeta;
  return {
    id: params.objectId,
    type: isVisualImage ? "image" : "text",
    layer: "board",
    x: params.insertPosition.x,
    y: params.insertPosition.y,
    width: isVisualImage ? imageFrame.width : 320,
    height: isVisualImage ? imageFrame.height : 220,
    color: WORKBOOK_TEXT_FALLBACK_COLOR,
    fill: "transparent",
    strokeWidth: 2,
    opacity: 1,
    imageUrl: params.imageUrl,
    imageName: params.asset.name,
    meta: imageMeta,
    text:
      params.asset.type === "pdf"
        ? `PDF: ${params.asset.name}`
        : params.asset.type === "file"
          ? `Файл: ${params.asset.name}`
          : undefined,
    fontSize:
      params.asset.type === "pdf" || params.asset.type === "file" ? 18 : undefined,
    authorUserId: params.authorUserId,
    createdAt: params.createdAt,
  };
};
