import type {
  WorkbookBoardObject,
  WorkbookDocumentAsset,
  WorkbookPoint,
} from "./types";
import { WORKBOOK_IMAGE_ASSET_META_KEY } from "./scene";

type WorkbookDocumentRenderedPage =
  NonNullable<WorkbookDocumentAsset["renderedPages"]>[number];

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
  type: "image" | "pdf" | "file";
}): WorkbookBoardObject => {
  const isVisualImage = params.type === "image" || Boolean(params.imageUrl);
  return {
    id: params.objectId,
    type: isVisualImage ? "image" : "text",
    layer: "board",
    x: params.insertPosition.x,
    y: params.insertPosition.y,
    width: isVisualImage ? 380 : 320,
    height: isVisualImage ? 260 : 120,
    color: "#16213e",
    fill: "transparent",
    strokeWidth: 2,
    opacity: 1,
    imageUrl: params.imageUrl,
    imageName: params.fileName,
    text: isVisualImage ? undefined : `PDF: ${params.fileName}`,
    fontSize: isVisualImage ? undefined : 18,
    meta:
      params.type === "image" && params.assetId
        ? {
            [WORKBOOK_IMAGE_ASSET_META_KEY]: params.assetId,
          }
        : undefined,
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
}): WorkbookBoardObject => {
  const renderedPage = resolvePrimaryDocumentRenderedPage(params.asset.renderedPages, params.page);
  const isVisualImage = params.asset.type === "image" || Boolean(renderedPage);
  return {
    id: params.objectId,
    type: isVisualImage ? "image" : "text",
    layer: "board",
    x: params.insertPosition.x,
    y: params.insertPosition.y,
    width: 320,
    height: 220,
    color: "#16213e",
    fill: "transparent",
    strokeWidth: 2,
    opacity: 1,
    imageUrl: params.imageUrl,
    imageName: params.asset.name,
    meta:
      params.asset.type === "image"
        ? {
            [WORKBOOK_IMAGE_ASSET_META_KEY]: params.asset.id,
          }
        : undefined,
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
